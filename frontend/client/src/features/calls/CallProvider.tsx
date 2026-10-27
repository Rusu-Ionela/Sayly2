import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CALL_EVENTS,
  CALL_RING_TIMEOUT_MS,
  type CallAcceptedEvent,
  type CallEndedEvent,
  type CallIncomingEvent,
  type CallSignalData,
  type CallSignalEvent,
} from "@sayly/shared";
import { Alert } from "react-native";
import type { MediaStream, RTCPeerConnection } from "react-native-webrtc";

import { useSocketContext } from "@/features/chat/socket/SocketProvider";
import { apiClient } from "@/lib/apiClient";

import { resetCallAudio, setCallSpeaker } from "./audioRoute";
import { CallScreen } from "./CallScreen";
import { CallContext, type CallContextValue } from "./CallContext";
import { callReducer, idleCall, type CallKind } from "./callState";
import { CALLS_UNSUPPORTED_MESSAGE, ensureCallPermissions, getWebRtc } from "./webrtc";

/** Give up on an unanswered call after this long (the server forgets it after 90 s). */
const RING_TIMEOUT_MS = CALL_RING_TIMEOUT_MS;

type IceServer = { urls: string[]; username?: string; credential?: string };

type SignalData = CallSignalData;

export function CallProvider({ children }: { children: ReactNode }) {
  const { socket, emit } = useSocketContext();
  const [state, dispatch] = useReducer(callReducer, idleCall);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Event handlers outlive renders, so they read the latest state through a ref.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const queuedCandidates = useRef<SignalData[]>([]);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supported = getWebRtc() !== null;

  const clearRingTimer = useCallback(() => {
    if (ringTimer.current) {
      clearTimeout(ringTimer.current);
      ringTimer.current = null;
    }
  }, []);

  /** Releases camera, microphone and the peer connection. Safe to call repeatedly. */
  const cleanup = useCallback(() => {
    clearRingTimer();
    pcRef.current?.close();
    pcRef.current = null;
    localRef.current?.getTracks().forEach((track) => track.stop());
    localRef.current = null;
    queuedCandidates.current = [];
    setLocalStream(null);
    setRemoteStream(null);
  }, [clearRingTimer]);

  const hangUp = useCallback(() => {
    const { callId, phase } = stateRef.current;
    if (callId) {
      // Rejecting a ring is its own event so the caller sees "declined".
      const event = phase === "incoming" ? CALL_EVENTS.decline : CALL_EVENTS.end;
      emit(event, { callId }).catch(() => undefined);
    }
    cleanup();
    dispatch({ type: "ended", reason: "local" });
  }, [cleanup, emit]);

  const sendSignal = useCallback(
    (callId: string, data: SignalData) => {
      emit(CALL_EVENTS.signal, { callId, data }).catch(() => undefined);
    },
    [emit],
  );

  const openMedia = useCallback(async (kind: CallKind) => {
    const webrtc = getWebRtc();
    if (!webrtc) throw new Error(CALLS_UNSUPPORTED_MESSAGE);
    await ensureCallPermissions(kind);
    const stream = await webrtc.mediaDevices.getUserMedia({
      audio: true,
      video: kind === "VIDEO" ? { facingMode: "user" } : false,
    });
    localRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const createPeer = useCallback(
    async (callId: string) => {
      const webrtc = getWebRtc();
      const local = localRef.current;
      if (!webrtc || !local) throw new Error("Call media is not ready");

      const { iceServers } = await apiClient.get<{ iceServers: IceServer[] }>("/calls/ice-servers");
      const pc = new webrtc.RTCPeerConnection({ iceServers });

      pc.addEventListener("icecandidate", (event) => {
        if (event.candidate) {
          const { candidate, sdpMid, sdpMLineIndex } = event.candidate;
          sendSignal(callId, {
            type: "candidate",
            candidate: { candidate, sdpMid: sdpMid ?? null, sdpMLineIndex: sdpMLineIndex ?? null },
          });
        }
      });
      pc.addEventListener("track", (event) => {
        setRemoteStream(event.streams[0] ?? null);
      });
      pc.addEventListener("connectionstatechange", () => {
        if (pc.connectionState === "connected") {
          dispatch({ type: "connected", at: Date.now() });
        } else if (pc.connectionState === "failed") {
          emit(CALL_EVENTS.end, { callId }).catch(() => undefined);
          cleanup();
          dispatch({ type: "ended", reason: "failed", callId });
        }
      });

      local.getTracks().forEach((track) => pc.addTrack(track, local));
      pcRef.current = pc;
      return pc;
    },
    [cleanup, emit, sendSignal],
  );

  const flushCandidates = useCallback(async () => {
    const webrtc = getWebRtc();
    const pc = pcRef.current;
    if (!webrtc || !pc) return;
    const queued = queuedCandidates.current;
    queuedCandidates.current = [];
    for (const item of queued) {
      if (item.type === "candidate") {
        await pc.addIceCandidate(new webrtc.RTCIceCandidate(item.candidate)).catch(() => undefined);
      }
    }
  }, []);

  const handleSignal = useCallback(
    async (callId: string, data: SignalData) => {
      const webrtc = getWebRtc();
      const pc = pcRef.current;
      if (!webrtc || !pc || stateRef.current.callId !== callId) return;

      if (data.type === "candidate") {
        if (pc.remoteDescription) {
          await pc
            .addIceCandidate(new webrtc.RTCIceCandidate(data.candidate))
            .catch(() => undefined);
        } else {
          queuedCandidates.current.push(data); // candidates can outrun the offer/answer
        }
        return;
      }

      await pc.setRemoteDescription(
        new webrtc.RTCSessionDescription({ type: data.type, sdp: data.sdp }),
      );
      await flushCandidates();
      if (data.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(callId, { type: "answer", sdp: answer.sdp });
      }
    },
    [flushCandidates, sendSignal],
  );

  const startCall = useCallback<CallContextValue["startCall"]>(
    async ({ conversationId, kind, peer }) => {
      if (!getWebRtc()) throw new Error(CALLS_UNSUPPORTED_MESSAGE);
      if (stateRef.current.phase !== "idle") throw new Error("You’re already in a call");

      await openMedia(kind);
      try {
        const { callId } = await emit<{ callId: string }>(CALL_EVENTS.invite, {
          conversationId,
          kind,
        });
        dispatch({ type: "outgoing", callId, conversationId, kind, peer });
        ringTimer.current = setTimeout(hangUp, RING_TIMEOUT_MS);
      } catch (error) {
        cleanup();
        throw error;
      }
    },
    [cleanup, emit, hangUp, openMedia],
  );

  const accept = useCallback(async () => {
    const { phase, callId, kind } = stateRef.current;
    if (phase !== "incoming" || !callId) return;
    clearRingTimer();
    try {
      await openMedia(kind);
      dispatch({ type: "connecting" });
      await createPeer(callId); // ready before the caller's offer arrives
      await emit(CALL_EVENTS.accept, { callId });
    } catch {
      emit(CALL_EVENTS.end, { callId }).catch(() => undefined);
      cleanup();
      dispatch({ type: "ended", reason: "failed", callId });
    }
  }, [cleanup, clearRingTimer, createPeer, emit, openMedia]);

  // Server -> client signalling.
  useEffect(() => {
    if (!socket) return;

    const onIncoming = (payload: CallIncomingEvent) => {
      if (!getWebRtc() || stateRef.current.phase !== "idle") {
        // Busy here, or this device can't take calls: let another device (or nobody) answer.
        if (stateRef.current.phase !== "idle") {
          emit(CALL_EVENTS.decline, { callId: payload.callId }).catch(() => undefined);
        } else {
          Alert.alert(`${payload.caller.displayName} is calling you`, CALLS_UNSUPPORTED_MESSAGE);
        }
        return;
      }
      dispatch({
        type: "incoming",
        callId: payload.callId,
        conversationId: payload.conversationId,
        kind: payload.kind,
        peer: payload.caller,
      });
      ringTimer.current = setTimeout(() => {
        dispatch({ type: "ended", reason: "cancelled", callId: payload.callId });
      }, RING_TIMEOUT_MS + 5_000);
    };

    const onAccepted = async ({ callId }: CallAcceptedEvent) => {
      if (stateRef.current.phase !== "outgoing" || stateRef.current.callId !== callId) return;
      clearRingTimer();
      dispatch({ type: "connecting" });
      try {
        const pc = await createPeer(callId);
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);
        sendSignal(callId, { type: "offer", sdp: offer.sdp });
      } catch {
        hangUp();
      }
    };

    const onSignal = ({ callId, data }: CallSignalEvent) => {
      void handleSignal(callId, data).catch(() => undefined);
    };

    const onEnded = ({ callId, reason }: CallEndedEvent) => {
      if (stateRef.current.callId !== callId) return;
      cleanup();
      dispatch({ type: "ended", reason, callId });
    };

    const onDisconnect = () => {
      if (stateRef.current.phase === "idle") return;
      cleanup();
      dispatch({ type: "ended", reason: "disconnected" });
    };

    socket.on(CALL_EVENTS.incoming, onIncoming);
    socket.on(CALL_EVENTS.accepted, onAccepted);
    socket.on(CALL_EVENTS.signal, onSignal);
    socket.on(CALL_EVENTS.ended, onEnded);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off(CALL_EVENTS.incoming, onIncoming);
      socket.off(CALL_EVENTS.accepted, onAccepted);
      socket.off(CALL_EVENTS.signal, onSignal);
      socket.off(CALL_EVENTS.ended, onEnded);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket, emit, cleanup, clearRingTimer, createPeer, handleSignal, hangUp, sendSignal]);

  // Release the camera if the provider ever unmounts mid-call (sign-out).
  useEffect(() => cleanup, [cleanup]);

  const toggleMute = useCallback(() => {
    const muted = !stateRef.current.muted;
    localRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    dispatch({ type: "toggleMute" });
  }, []);

  const toggleCamera = useCallback(() => {
    const off = !stateRef.current.cameraOff;
    localRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !off;
    });
    dispatch({ type: "toggleCamera" });
  }, []);

  const toggleSpeaker = useCallback(() => {
    dispatch({ type: "toggleSpeaker" });
  }, []);

  // Route the other person's voice once media flows (WebRTC sets up the audio session first),
  // and whenever the speaker button is pressed. Normal playback comes back after the call.
  const routedRef = useRef(false);
  useEffect(() => {
    if (state.phase === "active") {
      routedRef.current = true;
      void setCallSpeaker(state.speakerOn);
    } else if (state.phase === "idle" && routedRef.current) {
      routedRef.current = false;
      void resetCallAudio();
    }
  }, [state.phase, state.speakerOn]);

  const flipCamera = useCallback(() => {
    localRef.current?.getVideoTracks().forEach((track) => track._switchCamera());
  }, []);

  // The end-of-call notice is shown for a few seconds, then cleared.
  useEffect(() => {
    if (!state.notice) return;
    const timer = setTimeout(() => dispatch({ type: "clearNotice" }), 3_000);
    return () => clearTimeout(timer);
  }, [state.notice]);

  const value = useMemo<CallContextValue>(
    () => ({
      state,
      supported,
      localStream,
      remoteStream,
      startCall,
      accept,
      hangUp,
      toggleMute,
      toggleCamera,
      toggleSpeaker,
      flipCamera,
    }),
    [
      state,
      supported,
      localStream,
      remoteStream,
      startCall,
      accept,
      hangUp,
      toggleMute,
      toggleCamera,
      toggleSpeaker,
      flipCamera,
    ],
  );

  return (
    <CallContext.Provider value={value}>
      {children}
      <CallScreen />
    </CallContext.Provider>
  );
}
