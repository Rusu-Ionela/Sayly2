import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { isApiError } from "@/lib/api/errors";
import type { AppStackParamList } from "@/navigation/types";

import { openDirectConversation } from "../api/chatApi";

/**
 * Opens a one-to-one chat with an accepted language partner. Existing legacy chats still open.
 * Pass the conversation id when it is already known to skip the network call.
 */
export function useOpenChat() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const openChat = useCallback(
    async (userId: string, knownConversationId?: string | null, draft?: string) => {
      if (knownConversationId) {
        navigation.navigate("Conversation", { conversationId: knownConversationId, draft });
        return;
      }
      setBusyUserId(userId);
      try {
        const { conversationId } = await openDirectConversation(userId);
        void queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations });
        navigation.navigate("Conversation", { conversationId, draft });
      } catch (error) {
        const message =
          isApiError(error) && error.code === "CONNECTION_REQUIRED"
            ? "Send a Connect request first. You can chat after they accept it."
            : isApiError(error)
              ? error.message
              : "This person is unavailable right now. Please try again.";
        Alert.alert("Can't start chat", message);
      } finally {
        setBusyUserId(null);
      }
    },
    [navigation],
  );

  return { openChat, busyUserId };
}
