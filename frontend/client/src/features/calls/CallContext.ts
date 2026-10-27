import { createContext, useContext } from "react";
import type { MediaStream } from "react-native-webrtc";

import type { CallKind, CallPeer, CallState } from "./callState";

export type CallContextValue = {
  state: CallState;
  supported: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  startCall: (input: { conversationId: string; kind: CallKind; peer: CallPeer }) => Promise<void>;
  accept: () => Promise<void>;
  /** Cancels, declines (while ringing) or ends, whichever applies. */
  hangUp: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  /** Loudspeaker vs earpiece. */
  toggleSpeaker: () => void;
  flipCamera: () => void;
};

export const CallContext = createContext<CallContextValue | null>(null);

export function useCall() {
  const value = useContext(CallContext);
  if (!value) {
    throw new Error("useCall must be used within CallProvider");
  }
  return value;
}
