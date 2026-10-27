import { CONNECTION_EVENTS, type ConnectionEventDto } from "@sayly/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useAuth } from "@/features/auth";
import type { ChatMessage, Conversation, MessageCorrectedEvent } from "@/features/chat/types";
import { useSocketContext } from "@/features/chat/socket/SocketProvider";
import type { CurrentUserProfile } from "@/features/profile/types";
import { queryKeys } from "@/lib/queryKeys";
import { currentRoute } from "@/navigation/navigationRef";

import { useInAppBanner } from "./InAppBanner";
import { openNotificationTarget } from "./openTarget";
import { connectionBanner, correctionBanner, messageBanner, type BannerContent } from "./rules";

type ConversationsCache = { pages: { items: Conversation[] }[] };

const DEFAULT_PREFS = { notifyMessages: true, notifyConnectionRequests: true };

/**
 * Shows in-app banners for new chat messages, corrections of your messages and partner
 * requests (the only live signal on web, where push does not exist).
 */
export function useRealtimeNotifications() {
  const { socket, isConnected } = useSocketContext();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const { show } = useInAppBanner();

  useEffect(() => {
    if (!socket || !isConnected) return;

    const prefs = () =>
      queryClient.getQueryData<CurrentUserProfile>(queryKeys.profile.me)?.settings ?? DEFAULT_PREFS;

    const present = (content: BannerContent | null) => {
      if (!content) return;
      const { target, ...banner } = content;
      show({ ...banner, onPress: () => openNotificationTarget(target) });
    };

    const openConversationId = () => {
      const route = currentRoute();
      return route?.name === "Conversation"
        ? ((route.params as { conversationId?: string } | undefined)?.conversationId ?? null)
        : null;
    };

    /** The other person of a chat, from the cached inbox. */
    const partnerName = (conversationId: string) =>
      queryClient
        .getQueryData<ConversationsCache>(queryKeys.chat.conversations)
        ?.pages.flatMap((page) => page.items)
        .find((item) => item.id === conversationId)?.otherUser.displayName ?? null;

    const onMessage = (message: ChatMessage) => {
      present(
        messageBanner(message, {
          viewerId: userId,
          openConversationId: openConversationId(),
          senderName: partnerName(message.conversationId),
          prefs: prefs(),
        }),
      );
    };

    const onCorrected = (event: MessageCorrectedEvent) => {
      present(
        correctionBanner(event, {
          viewerId: userId,
          openConversationId: openConversationId(),
          authorName: partnerName(event.conversationId),
          prefs: prefs(),
        }),
      );
    };

    const onConnection = (kind: "request" | "accepted") => (other: ConnectionEventDto) => {
      // Refresh requests, the profile's Connections badge and that member's Connect button.
      void queryClient.invalidateQueries({ queryKey: queryKeys.connections.all });
      present(connectionBanner(kind, other, prefs()));
    };
    const onConnectionRequest = onConnection("request");
    const onConnectionAccepted = onConnection("accepted");

    socket.on("message_new", onMessage);
    socket.on("message_corrected", onCorrected);
    socket.on(CONNECTION_EVENTS.request, onConnectionRequest);
    socket.on(CONNECTION_EVENTS.accepted, onConnectionAccepted);
    return () => {
      socket.off("message_new", onMessage);
      socket.off("message_corrected", onCorrected);
      socket.off(CONNECTION_EVENTS.request, onConnectionRequest);
      socket.off(CONNECTION_EVENTS.accepted, onConnectionAccepted);
    };
  }, [socket, isConnected, queryClient, show, userId]);
}
