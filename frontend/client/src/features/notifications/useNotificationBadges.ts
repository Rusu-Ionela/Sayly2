import { useMemo } from "react";

import { useConversations } from "@/features/chat/hooks/useConversations";

/** Tab-bar badge text: undefined hides it, large counts collapse to "99+". */
export function badgeLabel(count: number): string | number | undefined {
  if (count <= 0) return undefined;
  return count > 99 ? "99+" : count;
}

/** Unread chats, kept live by the realtime socket. */
export function useNotificationBadges() {
  const conversations = useConversations();

  const unreadMessages = useMemo(
    () => (conversations.data ?? []).reduce((sum, item) => sum + (item.unreadCount ?? 0), 0),
    [conversations.data],
  );

  return {
    chats: badgeLabel(unreadMessages),
  };
}
