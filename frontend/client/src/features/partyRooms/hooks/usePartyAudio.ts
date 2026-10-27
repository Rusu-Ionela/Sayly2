import {
  PARTY_EVENTS,
  type CallSignalData,
  type PartyRoomDto,
  type PartySignalRelayEvent,
} from "@sayly/shared";
import { useEffect, useRef, useState } from "react";
import type { MediaStream, RTCPeerConnection } from "react-native-webrtc";
import type { Socket } from "socket.io-client";

import { resetCallAudio, setCallSpeaker } from "@/features/calls/audioRoute";
import { ensureCallPermissions, getWebRtc } from "@/features/calls/webrtc";
import { apiClient } from "@/lib/apiClient";

import { findParticipant, planPeers, type PeerPlan } from "../model/partyModel";

type IceServer = { urls: string[]; username?: string; credential?: string };
type Link = { key: string; pc: RTCPeerConnection; queued: CallSignalData[] };
type Emit = <T = unknown>(event: string, payload?: unknown) => Promise<T>;

/** Signals that arrive before their link exists (state and offer can cross) wait this long. */
const PENDING_SIGNAL_TTL_MS = 10_000;

/**
 * Keeps the room's audio mesh in line with its state: opens the microphone while this member
 * speaks, opens one peer connection per link from `planPeers`, and rebuilds a link when its key
 * changes (someone joined or left the stage). Remote audio plays by itself in react-native-webrtc.
 * Does nothing where WebRTC is unavailable (Expo Go, web): the room still works, without sound.
 */
export function usePartyAudio({
  room,
  selfId,
  socket,
  emit,
  muted,
}: {
  room: PartyRoomDto | null;
  selfId: string | null;
  socket: Socket | null;
  emit: Emit;
  muted: boolean;
}) {
  const supported = getWebRtc() !== null;
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const links = useRef(new Map<string, Link>());
  const pending = useRef(new Map<string, { data: CallSignalData; at: number }[]>());
  const iceServers = useRef<IceServer[] | null>(null);
  const roomId = room?.id ?? null;
  const roomIdRef = useRef(roomId);
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  const self = findParticipant(room, selfId);
  const speaking = self ? self.role !== "LISTENER" : false;

  // Microphone: open while on stage, released as soon as the member steps down.
  useEffect(() => {
    const webrtc = getWebRtc();
    if (!webrtc || !speaking) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    void (async () => {
      try {
        await ensureCallPermissions("AUDIO");
        stream = await webrtc.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        setMicError(null);
        setLocalStream(stream);
      } catch (error) {
        setMicError(error instanceof Error ? error.message : "Could not open the microphone.");
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    };
  }, [speaking]);

  // Mute is the track switch; the server only mirrors it for everyone's UI.
  useEffect(() => {
    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }, [localStream, muted]);

  // Loudspeaker while in a room, normal playback after.
  useEffect(() => {
    if (!supported || !roomId) return;
    void setCallSpeaker(true);
    return () => {
      void resetCallAudio();
    };
  }, [supported, roomId]);

  // Links: diff the plan against open connections.
  useEffect(() => {
    const webrtc = getWebRtc();
    if (!webrtc || !room || !selfId) return;
    const plans = planPeers(selfId, room);
    const current = links.current;

    for (const [peerId, link] of current) {
      if (plans.get(peerId)?.key !== link.key) {
        link.pc.close();
        current.delete(peerId);
      }
    }

    const sendSignal = (plan: PeerPlan, data: CallSignalData) => {
      emit(PARTY_EVENTS.signal, {
        roomId: room.id,
        toUserId: plan.peerId,
        key: plan.key,
        data,
      }).catch(() => undefined);
    };

    const open = async (plan: PeerPlan) => {
      if (!iceServers.current) {
        const response = await apiClient.get<{ iceServers: IceServer[] }>("/calls/ice-servers");
        iceServers.current = response.iceServers;
      }
      // The plan may have moved on while the ICE servers loaded.
      if (current.has(plan.peerId) || roomIdRef.current !== room.id) return;
      const pc = new webrtc.RTCPeerConnection({ iceServers: iceServers.current });
      const link: Link = { key: plan.key, pc, queued: [] };
      current.set(plan.peerId, link);

      pc.addEventListener("icecandidate", (event) => {
        if (!event.candidate) return;
        const { candidate, sdpMid, sdpMLineIndex } = event.candidate;
        sendSignal(plan, {
          type: "candidate",
          candidate: { candidate, sdpMid: sdpMid ?? null, sdpMLineIndex: sdpMLineIndex ?? null },
        });
      });
      if (plan.iSend && localStream) {
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
      }
      if (plan.iOffer) {
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);
        sendSignal(plan, { type: "offer", sdp: offer.sdp });
      }
      const waiting = pending.current.get(plan.key) ?? [];
      pending.current.delete(plan.key);
      for (const item of waiting) {
        await handleSignal(plan, link, item.data);
      }
    };

    const handleSignal = async (plan: PeerPlan, link: Link, data: CallSignalData) => {
      const { pc } = link;
      if (data.type === "candidate") {
        if (pc.remoteDescription) {
          await pc
            .addIceCandidate(new webrtc.RTCIceCandidate(data.candidate))
            .catch(() => undefined);
        } else {
          link.queued.push(data); // candidates can outrun the offer/answer
        }
        return;
      }
      await pc.setRemoteDescription(
        new webrtc.RTCSessionDescription({ type: data.type, sdp: data.sdp }),
      );
      for (const item of link.queued.splice(0)) {
        if (item.type === "candidate") {
          await pc
            .addIceCandidate(new webrtc.RTCIceCandidate(item.candidate))
            .catch(() => undefined);
        }
      }
      if (data.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(plan, { type: "answer", sdp: answer.sdp });
      }
    };

    for (const plan of plans.values()) {
      if (current.has(plan.peerId)) continue;
      // A sending link waits for the microphone; the effect re-runs once it is open.
      if (plan.iSend && !localStream) continue;
      void open(plan).catch(() => {
        current.get(plan.peerId)?.pc.close();
        current.delete(plan.peerId);
      });
    }

    if (!socket) return;
    const onSignal = (event: PartySignalRelayEvent) => {
      if (event.roomId !== room.id) return;
      const link = current.get(event.fromUserId);
      const plan = plans.get(event.fromUserId);
      if (!link || !plan || link.key !== event.key) {
        const now = Date.now();
        const queue = (pending.current.get(event.key) ?? []).filter(
          (item) => now - item.at < PENDING_SIGNAL_TTL_MS,
        );
        pending.current.set(event.key, [...queue, { data: event.data, at: now }]);
        return;
      }
      void handleSignal(plan, link, event.data).catch(() => undefined);
    };
    socket.on(PARTY_EVENTS.signalRelay, onSignal);
    return () => {
      socket.off(PARTY_EVENTS.signalRelay, onSignal);
    };
  }, [room, selfId, socket, emit, localStream]);

  // Leaving the room (or the screen) closes every link.
  useEffect(() => {
    const current = links.current;
    const queued = pending.current;
    return () => {
      for (const link of current.values()) link.pc.close();
      current.clear();
      queued.clear();
    };
  }, [roomId]);

  return { supported, micError, micReady: localStream !== null };
}
