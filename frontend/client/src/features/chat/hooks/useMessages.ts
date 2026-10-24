import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/features/auth";
import { ApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/queryKeys";
import { isUploadedMediaUrl } from "@/lib/mediaUrl";
import { savePhrase as savePhraseHttp } from "@/features/collections/api/collectionsApi";

import {
  correctMessageHttp,
  getMessages,
  markConversationReadHttp,
  sendMessageHttp,
  transcribeMessageHttp,
  translateMessageHttp,
  uploadChatFile,
} from "../api/chatApi";
import {
  clearConversationUnread,
  patchConversationWithMessage,
  patchMessageCorrection,
  setLocalSendState,
  upsertMessageInCache,
} from "../cache";
import { isLocalMessageId, resolveClientMessageId } from "../model/clientMessageId";
import { useSocketContext } from "../socket/SocketProvider";
import type {
  ChatMessage,
  MessageCorrectedEvent,
  MessageStatusEvent,
  SendMessagePayload,
  TypingEvent,
} from "../types";

function isRemoteUrl(value: string) {
  return isUploadedMediaUrl(value);
}

export function useMessages(conversationId: string) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const { socket, isConnected, emit } = useSocketContext();
  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingClear = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = useInfiniteQuery({
    queryKey: queryKeys.chat.messages(conversationId),
    queryFn: ({ pageParam, signal }) =>
      typeof pageParam === "number"
        ? getMessages(conversationId, { page: pageParam, limit: 30 }, { signal })
        : getMessages(conversationId, { before: pageParam, limit: 30 }, { signal }),
    initialPageParam: undefined as string | number | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore) return undefined;
      if (lastPage.nextCursor) return lastPage.nextCursor;
      if (lastPage.page) return lastPage.page + 1;
      return undefined;
    },
    enabled: Boolean(conversationId),
    staleTime: 10_000,
  });

  const markRead = useCallback(async () => {
    if (!conversationId) return;
    try {
      if (isConnected) {
        await emit("message_read", { conversationId });
      } else {
        await markConversationReadHttp(conversationId);
      }
      clearConversationUnread(queryClient, conversationId);
    } catch {
      // Read receipts are best-effort; keep unread until ack succeeds.
    }
  }, [conversationId, emit, isConnected, queryClient]);

  useEffect(() => {
    return () => {
      if (typingClear.current) {
        clearTimeout(typingClear.current);
        typingClear.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!socket || !isConnected || !conversationId) return;

    void emit("join_conversation", { conversationId }).catch(() => undefined);

    const onNew = (message: ChatMessage) => {
      if (message.conversationId !== conversationId) return;
      upsertMessageInCache(queryClient, conversationId, message);
      // Inbox list owns conversation preview patches (#75).
      if (userId && message.senderId !== userId) {
        void markRead();
      }
    };

    const onStatus = (payload: MessageStatusEvent) => {
      if (payload.conversationId !== conversationId) return;
      for (const message of payload.messages) {
        upsertMessageInCache(queryClient, conversationId, message);
      }
    };

    const onTypingStart = (payload: TypingEvent) => {
      if (payload.conversationId !== conversationId || payload.userId === userId) return;
      setPartnerTyping(true);
      if (typingClear.current) clearTimeout(typingClear.current);
      // Keepalive from the partner is sparse; clear only after a quiet gap.
      typingClear.current = setTimeout(() => setPartnerTyping(false), 8000);
    };

    const onTypingStop = (payload: TypingEvent) => {
      if (payload.conversationId !== conversationId || payload.userId === userId) return;
      if (typingClear.current) {
        clearTimeout(typingClear.current);
        typingClear.current = null;
      }
      setPartnerTyping(false);
    };

    const onMessageError = (payload: {
      error?: string;
      code?: string;
      clientMessageId?: string;
      conversationId?: string;
    }) => {
      if (payload.conversationId && payload.conversationId !== conversationId) {
        return;
      }
      // Expired session: the socket reconnects with a fresh token by itself and sends fall
      // back to HTTP, so this is not something to alarm the user about.
      if (payload.code === "UNAUTHORIZED") {
        return;
      }
      const message = payload.error || "Could not send message. Try again.";
      Alert.alert("Message failed", message);
      if (payload.clientMessageId) {
        setLocalSendState(queryClient, conversationId, payload.clientMessageId, "failed");
      }
    };

    const onCorrected = (payload: MessageCorrectedEvent) => {
      if (payload.conversationId !== conversationId) return;
      patchMessageCorrection(queryClient, conversationId, payload.messageId, payload.correction);
    };

    socket.on("message_new", onNew);
    socket.on("message_status", onStatus);
    socket.on("message_corrected", onCorrected);
    socket.on("typing_start", onTypingStart);
    socket.on("typing_stop", onTypingStop);
    socket.on("message_error", onMessageError);

    return () => {
      socket.off("message_new", onNew);
      socket.off("message_status", onStatus);
      socket.off("message_corrected", onCorrected);
      socket.off("typing_start", onTypingStart);
      socket.off("typing_stop", onTypingStop);
      socket.off("message_error", onMessageError);
      void emit("leave_conversation", { conversationId }).catch(() => undefined);
    };
  }, [socket, isConnected, conversationId, emit, queryClient, userId, markRead]);

  useEffect(() => {
    if (!conversationId || !query.data?.pages.length) return;
    void markRead();
  }, [conversationId, markRead, query.dataUpdatedAt, query.data?.pages.length]);

  const setTyping = useCallback(
    (typing: boolean) => {
      if (!isConnected || !conversationId) return;
      void emit(typing ? "typing_start" : "typing_stop", { conversationId }).catch(() => undefined);
    },
    [conversationId, emit, isConnected],
  );

  const send = useCallback(
    async (payload: SendMessagePayload | string, existingClientMessageId?: string) => {
      if (!conversationId || !userId) {
        throw new Error("Not ready to send");
      }

      const body: SendMessagePayload =
        typeof payload === "string" ? { content: payload, type: "TEXT" } : payload;
      const type = body.type ?? "TEXT";
      const clientMessageId = resolveClientMessageId(existingClientMessageId);
      const optimistic: ChatMessage = {
        id: clientMessageId,
        conversationId,
        senderId: userId,
        type,
        content: body.content,
        status: "SENT",
        durationMs: body.durationMs ?? null,
        mimeType: body.mimeType ?? null,
        thumbnailUrl: body.thumbnailUrl ?? null,
        caption: body.caption ?? null,
        clientMessageId,
        localState: "sending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!existingClientMessageId) {
        upsertMessageInCache(queryClient, conversationId, optimistic);
        patchConversationWithMessage(queryClient, optimistic, userId);
      } else {
        setLocalSendState(queryClient, conversationId, clientMessageId, "sending");
      }

      try {
        let content = body.content;
        if (type !== "TEXT" && !isRemoteUrl(content)) {
          const uploaded = await uploadChatFile(content, body.mimeType ?? undefined, body.fileName);
          content = uploaded.url;
          upsertMessageInCache(
            queryClient,
            conversationId,
            { ...optimistic, content },
            clientMessageId,
          );
        }

        const sendBody = {
          clientMessageId,
          conversationId,
          content,
          type,
          durationMs: body.durationMs != null ? Math.round(body.durationMs) : undefined,
          mimeType: body.mimeType,
          thumbnailUrl: body.thumbnailUrl,
          caption: body.caption,
        };

        if (isConnected) {
          try {
            const result = await emit<{ ok: boolean; message: ChatMessage }>(
              "send_message",
              sendBody,
            );
            if (result?.message) {
              upsertMessageInCache(queryClient, conversationId, result.message, clientMessageId);
              patchConversationWithMessage(queryClient, result.message, userId);
              return true;
            }
          } catch {
            // Fall back to HTTP if the socket ack fails after a successful upload.
          }
        }

        const saved = await sendMessageHttp(conversationId, sendBody);
        upsertMessageInCache(queryClient, conversationId, saved, clientMessageId);
        patchConversationWithMessage(queryClient, saved, userId);
        return true;
      } catch (error) {
        setLocalSendState(queryClient, conversationId, clientMessageId, "failed");
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Could not send.";
        Alert.alert("Message not sent", message);
        return false;
      }
    },
    [conversationId, emit, isConnected, queryClient, userId],
  );

  const retry = useCallback(
    (message: ChatMessage) => {
      if (!isLocalMessageId(message.id)) return;
      return send(
        {
          content: message.content,
          type: message.type,
          durationMs: message.durationMs ?? undefined,
          mimeType: message.mimeType ?? undefined,
          thumbnailUrl: message.thumbnailUrl ?? undefined,
          caption: message.caption ?? undefined,
        },
        message.clientMessageId ?? message.id,
      );
    },
    [send],
  );

  const translate = useCallback(
    async (message: ChatMessage) => {
      if (!conversationId || isLocalMessageId(message.id)) return;
      const updated = await translateMessageHttp(conversationId, message.id);
      upsertMessageInCache(queryClient, conversationId, updated);
    },
    [conversationId, queryClient],
  );

  const transcribe = useCallback(
    async (message: ChatMessage) => {
      if (!conversationId || isLocalMessageId(message.id)) return;
      const updated = await transcribeMessageHttp(conversationId, message.id);
      upsertMessageInCache(queryClient, conversationId, updated);
    },
    [conversationId, queryClient],
  );

  const correct = useCallback(
    async (message: ChatMessage, correctedText: string) => {
      if (!conversationId || isLocalMessageId(message.id)) return;
      const correction = await correctMessageHttp(conversationId, message.id, correctedText);
      // Shown at once for the author too; the partner gets it via "message_corrected".
      patchMessageCorrection(queryClient, conversationId, message.id, correction);
    },
    [conversationId, queryClient],
  );

  const savePhrase = useCallback(
    async (message: ChatMessage) => {
      if (isLocalMessageId(message.id)) return;
      const sourceText =
        message.type === "TEXT"
          ? message.content.trim()
          : (message.caption ?? message.transcript ?? "").trim();
      if (!sourceText) return;
      await savePhraseHttp({
        sourceText,
        messageId: message.id,
        correctedText: message.translatedContent?.trim() || undefined,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.collection.phrases });
    },
    [queryClient],
  );

  return {
    ...query,
    emit,
    isConnected,
    send,
    retry,
    translate,
    transcribe,
    correct,
    savePhrase,
    setTyping,
    partnerTyping,
    markRead,
  };
}
