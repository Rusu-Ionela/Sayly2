import type { CallKind, CallPeerSummary } from "@sayly/shared";

export type { CallKind };
export type CallPeer = CallPeerSummary;

type CallPhase = "idle" | "outgoing" | "incoming" | "connecting" | "active";

export type CallState = {
  phase: CallPhase;
  callId: string | null;
  conversationId: string | null;
  kind: CallKind;
  peer: CallPeer | null;
  muted: boolean;
  cameraOff: boolean;
  /** Loudspeaker instead of the earpiece. Video calls start on the speaker, audio calls don't. */
  speakerOn: boolean;
  /** Epoch ms when media first flowed; drives the on-screen timer. */
  connectedAt: number | null;
  /** One-line result of the last call ("Call declined"), shown briefly after it ends. */
  notice: string | null;
};

export const idleCall: CallState = {
  phase: "idle",
  callId: null,
  conversationId: null,
  kind: "AUDIO",
  peer: null,
  muted: false,
  cameraOff: false,
  speakerOn: false,
  connectedAt: null,
  notice: null,
};

type Ring = { callId: string; conversationId: string; kind: CallKind; peer: CallPeer };

export type CallAction =
  | ({ type: "outgoing" } & Ring)
  | ({ type: "incoming" } & Ring)
  | { type: "connecting" }
  | { type: "connected"; at: number }
  /** Without callId the call ends whatever it is (local hang-up); with one, stale events are ignored. */
  | { type: "ended"; reason: string; callId?: string }
  | { type: "toggleMute" }
  | { type: "toggleCamera" }
  | { type: "toggleSpeaker" }
  | { type: "clearNotice" };

function endNotice(reason: string, phase: CallPhase): string | null {
  switch (reason) {
    case "declined":
      return "Call declined";
    case "cancelled":
      // The caller gave up before this person answered.
      return phase === "incoming" ? "Missed call" : null;
    case "disconnected":
      return "Call lost";
    case "failed":
      return "Couldn’t connect the call";
    case "ended":
      return "Call ended";
    case "answered_elsewhere":
      return "Answered on another device";
    default:
      return null;
  }
}

export function callReducer(state: CallState, action: CallAction): CallState {
  switch (action.type) {
    case "outgoing":
    case "incoming": {
      if (state.phase !== "idle") return state;
      const { type, ...ring } = action;
      return { ...idleCall, ...ring, phase: type, speakerOn: ring.kind === "VIDEO" };
    }
    case "connecting":
      return state.phase === "outgoing" || state.phase === "incoming"
        ? { ...state, phase: "connecting" }
        : state;
    case "connected":
      return state.phase === "connecting"
        ? { ...state, phase: "active", connectedAt: action.at }
        : state;
    case "ended": {
      if (state.phase === "idle") return state;
      if (action.callId && action.callId !== state.callId) return state;
      return { ...idleCall, notice: endNotice(action.reason, state.phase) };
    }
    case "toggleMute":
      return state.phase === "idle" ? state : { ...state, muted: !state.muted };
    case "toggleCamera":
      return state.phase === "idle" || state.kind !== "VIDEO"
        ? state
        : { ...state, cameraOff: !state.cameraOff };
    case "toggleSpeaker":
      return state.phase === "idle" ? state : { ...state, speakerOn: !state.speakerOn };
    case "clearNotice":
      return state.notice ? { ...state, notice: null } : state;
  }
}
