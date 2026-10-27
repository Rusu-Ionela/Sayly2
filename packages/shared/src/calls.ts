import { z } from "zod";

/**
 * 1:1 call contract between the app and the API. The server only relays signalling;
 * audio and video flow peer to peer over WebRTC.
 */
export const CALL_KINDS = ["AUDIO", "VIDEO"] as const;
export type CallKind = (typeof CALL_KINDS)[number];

/** Why a call ended, as sent in `call_ended`. */
export const CALL_END_REASONS = [
  "cancelled", // caller hung up before an answer
  "declined", // callee rejected
  "ended", // either side hung up an active call
  "disconnected", // a participant lost their connection
  "answered_elsewhere", // callee picked up on another device
] as const;
export type CallEndReason = (typeof CALL_END_REASONS)[number];

/** Socket event names. Client -> server events reply through the ack callback. */
export const CALL_EVENTS = {
  // client -> server
  invite: "call_invite",
  accept: "call_accept",
  decline: "call_decline",
  end: "call_end",
  signal: "call_signal",
  // server -> client
  incoming: "call_incoming",
  accepted: "call_accepted",
  ended: "call_ended",
} as const;

/** The caller hangs up on its own after this long without an answer. */
export const CALL_RING_TIMEOUT_MS = 45_000;

const SDP_MAX = 20_000;
const CANDIDATE_MAX = 1_000;

/** Offer, answer or ICE candidate, relayed verbatim to the other participant. */
export const callSignalDataSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["offer", "answer"]),
    sdp: z.string().min(1).max(SDP_MAX),
  }),
  z.object({
    type: z.literal("candidate"),
    candidate: z.object({
      candidate: z.string().max(CANDIDATE_MAX),
      sdpMid: z.string().max(64).nullable(),
      sdpMLineIndex: z.number().int().min(0).max(64).nullable(),
    }),
  }),
]);
export type CallSignalData = z.infer<typeof callSignalDataSchema>;

export type CallPeerSummary = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export type CallIncomingEvent = {
  callId: string;
  conversationId: string;
  kind: CallKind;
  caller: CallPeerSummary;
};
export type CallAcceptedEvent = { callId: string };
export type CallEndedEvent = { callId: string; reason: CallEndReason };
export type CallSignalEvent = { callId: string; data: CallSignalData };
