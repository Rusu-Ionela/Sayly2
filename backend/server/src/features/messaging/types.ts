import type { Message, MessageStatus, MessageType } from "../../db/schema";

export type ConversationType = "DIRECT";
export type OnlineStatus = "ONLINE" | "OFFLINE" | "UNKNOWN";

/** A partner's suggested rewrite of a message (language-learning feedback). */
export type MessageCorrectionDto = {
  id: string;
  messageId: string;
  authorId: string;
  correctedText: string;
  note: string | null;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
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
  /** Latest correction suggested by the partner, when any. */
  correction?: MessageCorrectionDto | null;
  createdAt: string;
  updatedAt: string;
};

/** Socket payload of "message_corrected". */
export type MessageCorrectedEvent = {
  conversationId: string;
  messageId: string;
  correction: MessageCorrectionDto;
};

export type ChatPartner = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  photoUrl?: string;
  country: string;
  onlineStatus: OnlineStatus;
  lastSeen: string | null;
};

export type ConversationListItem = {
  id: string;
  type: ConversationType;
  otherUser: ChatPartner;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  lastMessageAt: string | null;
  updatedAt: string;
  pinnedAt: string | null;
};

export type ConversationsPage = {
  items: ConversationListItem[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
};

export type MessagesPage = {
  items: ChatMessage[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
  page?: number;
  total?: number;
};

export type SendMessageInput = {
  conversationId: string;
  content: string;
  type?: MessageType;
  durationMs?: number;
  mimeType?: string;
  thumbnailUrl?: string;
  caption?: string;
  clientMessageId?: string;
};

export type SocketAck<T = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

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

/** @deprecated Use ChatMessage */
export type MessageDto = ChatMessage;

export type ListConversationsQuery = {
  cursor?: string;
  limit: number;
};

export type ListMessagesQuery = {
  before?: string;
  page?: number;
  limit: number;
};

export type ConversationAccess = {
  conversationId: string;
  otherUserId: string;
};

export type SendMessageResult = {
  message: ChatMessage;
  recipientId: string;
  created: boolean;
};

export type MessageRow = Message;
