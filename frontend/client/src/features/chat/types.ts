type MessageStatus = "SENT" | "DELIVERED" | "READ";
export type OnlineStatus = "ONLINE" | "OFFLINE";
export type LocalSendState = "sending" | "failed";
type ChatMessageType = "TEXT" | "IMAGE" | "VOICE" | "VIDEO" | "SYSTEM";

/** A partner's suggested rewrite of a message. */
export type MessageCorrection = {
  id: string;
  messageId: string;
  authorId: string;
  correctedText: string;
  note: string | null;
  createdAt: string;
};

/** Socket payload of "message_corrected". */
export type MessageCorrectedEvent = {
  conversationId: string;
  messageId: string;
  correction: MessageCorrection;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  type: ChatMessageType;
  content: string;
  status: MessageStatus;
  durationMs?: number | null;
  mimeType?: string | null;
  thumbnailUrl?: string | null;
  transcript?: string | null;
  translatedContent?: string | null;
  translatedLang?: string | null;
  caption?: string | null;
  clientMessageId?: string | null;
  /** Latest correction suggested by the partner; undefined when the payload omits it. */
  correction?: MessageCorrection | null;
  createdAt: string;
  updatedAt: string;
  localState?: LocalSendState;
};

export type Conversation = {
  id: string;
  type?: "DIRECT";
  otherUser: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    photoUrl?: string;
    country: string;
    onlineStatus?: OnlineStatus;
    lastSeen?: string | null;
  };
  lastMessage: ChatMessage | null;
  unreadCount: number;
  lastMessageAt?: string | null;
  updatedAt: string;
  /** Set while the viewer has this chat pinned. */
  pinnedAt?: string | null;
  /** Incoming messages are translated automatically for me. */
  autoTranslate?: boolean;
};

export type ConversationsPage = {
  items: Conversation[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
};

export type MessagesPage = {
  items: ChatMessage[];
  nextCursor?: string | null;
  hasMore: boolean;
  limit: number;
  page?: number;
  total?: number;
};

export type TypingEvent = {
  conversationId: string;
  userId: string;
};

export type UserOnlineStatusEvent = {
  userId: string;
  onlineStatus: OnlineStatus;
  lastSeen: string | null;
};

export type MessageStatusEvent = {
  conversationId: string;
  messages: ChatMessage[];
};

export type SendMessagePayload = {
  content: string;
  type?: ChatMessage["type"];
  durationMs?: number;
  mimeType?: string;
  thumbnailUrl?: string;
  uploadFromUri?: string;
  fileName?: string;
  caption?: string;
};

export type ChatMediaDraft = {
  type: Exclude<ChatMessageType, "TEXT" | "SYSTEM">;
  uri: string;
  mimeType?: string;
  fileName?: string;
  durationMs?: number;
  thumbnailUrl?: string;
  caption?: string;
};
