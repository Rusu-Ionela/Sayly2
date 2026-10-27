import type { ConnectionEventDto } from "@sayly/shared";

import type { ChatMessage, MessageCorrectedEvent } from "@/features/chat/types";
import { lastMessagePreview } from "@/features/chat/utils/messagePreview";
import type { IconName } from "@/shared/components/SettingRow";

/** Where tapping a notification leads. */
export type NotificationTarget =
  | { screen: "Conversation"; conversationId: string }
  | { screen: "PublicProfile"; userId: string }
  | { screen: "Connections" }
  | { screen: "Community" };

export type BannerContent = {
  key: string;
  icon: IconName;
  title: string;
  body: string;
  target: NotificationTarget;
};

type Preferences = { notifyMessages: boolean; notifyConnectionRequests: boolean };

/** Banner for a chat message — not for your own messages or the chat you are reading. */
export function messageBanner(
  message: ChatMessage,
  context: {
    viewerId: string | null | undefined;
    openConversationId: string | null;
    senderName: string | null;
    prefs: Preferences;
  },
): BannerContent | null {
  if (!context.prefs.notifyMessages) return null;
  if (!context.viewerId || message.senderId === context.viewerId) return null;
  if (context.openConversationId === message.conversationId) return null;

  return {
    key: `chat-${message.conversationId}`,
    icon: "chatbubble-ellipses-outline",
    title: context.senderName?.trim() || "New message",
    body: lastMessagePreview(message),
    target: { screen: "Conversation", conversationId: message.conversationId },
  };
}

/** Banner for a correction of one of your messages — not your own, not the open chat. */
export function correctionBanner(
  event: MessageCorrectedEvent,
  context: {
    viewerId: string | null | undefined;
    openConversationId: string | null;
    authorName: string | null;
    prefs: Preferences;
  },
): BannerContent | null {
  if (!context.prefs.notifyMessages) return null;
  if (!context.viewerId || event.correction.authorId === context.viewerId) return null;
  if (context.openConversationId === event.conversationId) return null;

  return {
    key: `correction-${event.messageId}`,
    icon: "create-outline",
    title: `${context.authorName?.trim() || "Your partner"} suggested a correction`,
    body: event.correction.correctedText,
    target: { screen: "Conversation", conversationId: event.conversationId },
  };
}

/** Banner for a new partner request (opens your requests) or an accepted one (their profile). */
export function connectionBanner(
  kind: "request" | "accepted",
  other: ConnectionEventDto,
  prefs: Preferences,
): BannerContent | null {
  if (!prefs.notifyConnectionRequests) return null;
  const name = other.displayName.trim() || "Someone";

  return kind === "request"
    ? {
        key: `connection-request-${other.userId}`,
        icon: "person-add-outline",
        title: "New connection request",
        body: `${name} would like to practise with you.`,
        target: { screen: "Connections" },
      }
    : {
        key: `connection-accepted-${other.userId}`,
        icon: "people-outline",
        title: "You're connected",
        body: `You and ${name} can now chat and call.`,
        target: { screen: "PublicProfile", userId: other.userId },
      };
}

/** Push payload `data` → target (unknown or malformed data opens nothing). */
export function targetFromPushData(data: unknown): NotificationTarget | null {
  if (!data || typeof data !== "object") return null;
  const { type, conversationId, userId } = data as Record<string, unknown>;
  if (type === "message" && typeof conversationId === "string" && conversationId) {
    return { screen: "Conversation", conversationId };
  }
  // A new request opens your requests, where you can accept it.
  if (type === "connection_request") {
    return { screen: "Connections" };
  }
  if (type === "connection_accepted" && typeof userId === "string" && userId) {
    return { screen: "PublicProfile", userId };
  }
  // Streak reminder: Community has the streak badge and today's icebreaker.
  if (type === "streak_reminder") {
    return { screen: "Community" };
  }
  return null;
}
