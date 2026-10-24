export const PUSH_PLATFORMS = ["ios", "android"] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

export type InboxType = "CORRECTION" | "REFERENCE";

export type NewInboxItem = {
  userId: string;
  actorId: string;
  type: InboxType;
  conversationId?: string;
  dedupeKey: string;
};

export type InboxItem = {
  id: string;
  type: InboxType;
  /** CORRECTION only: the chat to open. */
  conversationId: string | null;
  createdAt: string;
  readAt: string | null;
  actor: { id: string; displayName: string; avatarUrl: string | null };
};

export type InboxPage = { items: InboxItem[]; page: number; hasMore: boolean };
