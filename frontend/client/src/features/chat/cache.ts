import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

import { isLocalMessageId } from "./model/clientMessageId";
import type {
  ChatMessage,
  Conversation,
  ConversationsPage,
  LocalSendState,
  MessageCorrection,
  OnlineStatus,
} from "./types";

export { isLocalMessageId } from "./model/clientMessageId";

type MessagesCache = {
  pages: Array<{
    items: ChatMessage[];
    nextCursor?: string | null;
    hasMore?: boolean;
    limit?: number;
    page?: number;
  }>;
  pageParams: unknown[];
};

type ConversationsCache = Conversation[] | InfiniteData<ConversationsPage>;

function mapConversationList(
  current: ConversationsCache | undefined,
  mapItems: (items: Conversation[]) => Conversation[],
): ConversationsCache | undefined {
  if (!current) {
    return current;
  }
  if (Array.isArray(current)) {
    return mapItems(current);
  }
  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      items: mapItems(page.items),
    })),
  };
}

function sameClientId(item: ChatMessage, message: ChatMessage, replaceLocalId?: string) {
  if (replaceLocalId && item.id === replaceLocalId) {
    return true;
  }
  const incoming = message.clientMessageId ?? (isLocalMessageId(message.id) ? message.id : null);
  if (!incoming) {
    return false;
  }
  return item.clientMessageId === incoming || item.id === incoming;
}

export function upsertMessageInCache(
  queryClient: QueryClient,
  conversationId: string,
  message: ChatMessage,
  replaceLocalId?: string,
) {
  queryClient.setQueryData<MessagesCache>(queryKeys.chat.messages(conversationId), (current) => {
    if (!current?.pages.length) {
      return {
        pages: [{ items: [message], hasMore: false, limit: 30 }],
        pageParams: [undefined],
      };
    }

    let replaced = false;
    const pages = current.pages.map((page) => ({
      ...page,
      items: page.items.reduce<ChatMessage[]>((acc, item) => {
        const isServerMatch = item.id === message.id;
        const isLocalMatch =
          isLocalMessageId(item.id) && sameClientId(item, message, replaceLocalId);

        if (isServerMatch || isLocalMatch) {
          if (!replaced) {
            acc.push({
              ...message,
              // Status/translation updates do not carry the correction; keep the known one.
              correction: message.correction !== undefined ? message.correction : item.correction,
              localState: undefined,
            });
            replaced = true;
          }
          return acc;
        }
        acc.push(item);
        return acc;
      }, []),
    }));

    if (!replaced) {
      const [first, ...rest] = pages;
      return {
        ...current,
        pages: [{ ...first!, items: [...first!.items, message] }, ...rest],
      };
    }

    return { ...current, pages };
  });
}

/** A partner's correction arrived (socket) or was just sent (HTTP): show it under the message. */
export function patchMessageCorrection(
  queryClient: QueryClient,
  conversationId: string,
  messageId: string,
  correction: MessageCorrection,
) {
  queryClient.setQueryData<MessagesCache>(queryKeys.chat.messages(conversationId), (current) => {
    if (!current?.pages.length) return current;
    return {
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        items: page.items.map((item) => (item.id === messageId ? { ...item, correction } : item)),
      })),
    };
  });
}

export function setLocalSendState(
  queryClient: QueryClient,
  conversationId: string,
  messageId: string,
  localState: LocalSendState,
) {
  queryClient.setQueryData<MessagesCache>(queryKeys.chat.messages(conversationId), (current) => {
    if (!current) return current;
    return {
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        items: page.items.map((item) => (item.id === messageId ? { ...item, localState } : item)),
      })),
    };
  });
}

export function patchConversationWithMessage(
  queryClient: QueryClient,
  message: ChatMessage,
  viewerId?: string | null,
  options?: { statusOnly?: boolean },
) {
  queryClient.setQueryData<ConversationsCache>(queryKeys.chat.conversations, (current) =>
    mapConversationList(current, (items) =>
      items
        .map((conversation) => {
          if (conversation.id !== message.conversationId) {
            return conversation;
          }

          const last = conversation.lastMessage;
          const isSameLast = last?.id === message.id;
          const isNewer =
            !last ||
            message.createdAt > last.createdAt ||
            (isLocalMessageId(last.id) && last.clientMessageId === message.clientMessageId);

          if (options?.statusOnly && !isSameLast) {
            return conversation;
          }

          if (!options?.statusOnly && !isNewer && !isSameLast) {
            return conversation;
          }

          const fromOther = Boolean(viewerId && message.senderId !== viewerId);
          const shouldReplacePreview = isSameLast || isNewer;

          return {
            ...conversation,
            lastMessage: shouldReplacePreview ? { ...message, localState: undefined } : last,
            lastMessageAt: shouldReplacePreview ? message.createdAt : conversation.lastMessageAt,
            updatedAt: shouldReplacePreview ? message.createdAt : conversation.updatedAt,
            unreadCount:
              isSameLast || !fromOther || options?.statusOnly
                ? conversation.unreadCount
                : conversation.unreadCount + 1,
          };
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    ),
  );
}

export function clearConversationUnread(queryClient: QueryClient, conversationId: string) {
  queryClient.setQueryData<ConversationsCache>(queryKeys.chat.conversations, (current) =>
    mapConversationList(current, (items) =>
      items.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation,
      ),
    ),
  );
}

export function patchPartnerPresence(
  queryClient: QueryClient,
  payload: { userId: string; onlineStatus: OnlineStatus; lastSeen: string | null },
) {
  queryClient.setQueryData<ConversationsCache>(queryKeys.chat.conversations, (current) =>
    mapConversationList(current, (items) =>
      items.map((conversation) =>
        conversation.otherUser.id === payload.userId
          ? {
              ...conversation,
              otherUser: {
                ...conversation.otherUser,
                onlineStatus: payload.onlineStatus,
                lastSeen: payload.lastSeen,
              },
            }
          : conversation,
      ),
    ),
  );
}
