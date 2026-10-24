import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";

import { queryKeys } from "@/lib/queryKeys";

import { setConversationPinnedHttp } from "../api/chatApi";

/** Pin or unpin a chat; the server owns ordering and the 3-chat limit, so just refetch. */
export function usePinConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, pinned }: { conversationId: string; pinned: boolean }) =>
      setConversationPinnedHttp(conversationId, pinned),
    onError: (error) =>
      Alert.alert("Could not update pin", error instanceof Error ? error.message : "Try again."),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations }),
  });
}
