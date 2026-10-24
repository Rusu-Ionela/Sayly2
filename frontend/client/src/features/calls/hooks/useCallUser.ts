import { useCallback, useState } from "react";
import { Alert } from "react-native";

import { openDirectConversation } from "@/features/chat/api/chatApi";

import { useCall } from "../CallContext";
import type { CallKind, CallPeer } from "../callState";
import { CALLS_UNSUPPORTED_MESSAGE } from "../webrtc";

/** Starts an audio/video call with an accepted language partner, opening their chat if needed. */
export function useCallUser() {
  const { startCall, supported } = useCall();
  const [busy, setBusy] = useState(false);

  const callUser = useCallback(
    async (user: CallPeer & { conversationId: string | null }, kind: CallKind) => {
      if (!supported) {
        Alert.alert("Calls unavailable", CALLS_UNSUPPORTED_MESSAGE);
        return;
      }
      setBusy(true);
      try {
        const conversationId =
          user.conversationId ?? (await openDirectConversation(user.id)).conversationId;
        await startCall({
          conversationId,
          kind,
          peer: { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl },
        });
      } catch (error) {
        Alert.alert(
          "Can’t start the call",
          error instanceof Error ? error.message : "Please try again.",
        );
      } finally {
        setBusy(false);
      }
    },
    [startCall, supported],
  );

  return { callUser, busy };
}
