import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import { useAuth } from "@/features/auth";
import { log } from "@/lib/logger";
import { queryKeys } from "@/lib/queryKeys";

import { setAutoTranslateHttp } from "../api/chatApi";
import { isLocalMessageId } from "../cache";
import type { ChatMessage, ConversationsPage } from "../types";
import { autoTranslateQueue } from "../utils/translation";

type ConversationsCache = InfiniteData<ConversationsPage>;

/** Turns "translate incoming messages" on or off for one chat; the toggle reacts at once. */
export function useSetAutoTranslate() {
  const queryClient = useQueryClient();
  const key = queryKeys.chat.conversations;

  const patch = (conversationId: string, autoTranslate: boolean) =>
    queryClient.setQueryData<ConversationsCache>(key, (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === conversationId ? { ...item, autoTranslate } : item,
              ),
            })),
          }
        : data,
    );

  return useMutation({
    mutationFn: ({ conversationId, enabled }: { conversationId: string; enabled: boolean }) =>
      setAutoTranslateHttp(conversationId, enabled),
    onMutate: ({ conversationId, enabled }) => patch(conversationId, enabled),
    onError: (error, { conversationId, enabled }) => {
      patch(conversationId, !enabled);
      Alert.alert(
        "Could not change auto-translate",
        error instanceof Error ? error.message : "Please try again.",
      );
    },
  });
}

/**
 * While auto-translate is on, translates the partner's messages one at a time, newest first
 * (at most AUTO_TRANSLATE_LIMIT per visit). Translations are cached by the API, so a message
 * is paid for once and shows up translated next time without a new request.
 */
export function useAutoTranslateIncoming(
  enabled: boolean,
  messagesNewestFirst: ChatMessage[],
  translate: (message: ChatMessage) => Promise<void>,
) {
  const { userId } = useAuth();
  const tried = useRef(new Set<string>());
  const running = useRef(false);
  // Bumped after each pass, so messages that arrived meanwhile get their turn.
  const [pass, setPass] = useState(0);
  // Read inside the loop: each translation updates the cache and re-runs the effect, which must
  // not stop the loop; only leaving the chat or switching auto-translate off does.
  const active = useRef(enabled);

  useEffect(() => {
    active.current = enabled;
    return () => {
      active.current = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || running.current) return;
    const queue = autoTranslateQueue(messagesNewestFirst, userId, tried.current, isLocalMessageId);
    if (queue.length === 0) return;

    running.current = true;
    void (async () => {
      for (const message of queue) {
        if (!active.current) break;
        tried.current.add(message.id);
        try {
          await translate(message);
        } catch (error) {
          // A provider hiccup or rate limit: leave the rest for the next visit.
          log.warn("chat", "auto-translate stopped", {
            message: error instanceof Error ? error.message : "unknown",
          });
          running.current = false;
          return;
        }
      }
      running.current = false;
      if (active.current) setPass((value) => value + 1);
    })();
  }, [enabled, messagesNewestFirst, translate, userId, pass]);
}
