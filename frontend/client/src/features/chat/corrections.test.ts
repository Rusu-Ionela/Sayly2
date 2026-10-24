import { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

import { patchMessageCorrection, upsertMessageInCache } from "./cache";
import type { ChatMessage, MessageCorrection } from "./types";

const message: ChatMessage = {
  id: "m1",
  conversationId: "c1",
  senderId: "maria",
  type: "TEXT",
  content: "I has a cat",
  status: "SENT",
  createdAt: "2026-10-20T10:00:00.000Z",
  updatedAt: "2026-10-20T10:00:00.000Z",
};

const correction: MessageCorrection = {
  id: "k1",
  messageId: "m1",
  authorId: "james",
  correctedText: "I have a cat",
  note: null,
  createdAt: "2026-10-20T10:01:00.000Z",
};

function cached(queryClient: QueryClient) {
  const data = queryClient.getQueryData<{ pages: { items: ChatMessage[] }[] }>(
    queryKeys.chat.messages("c1"),
  );
  return data?.pages[0]?.items[0];
}

describe("message corrections in the chat cache", () => {
  it("shows a correction under its message", () => {
    const queryClient = new QueryClient();
    upsertMessageInCache(queryClient, "c1", message);
    patchMessageCorrection(queryClient, "c1", "m1", correction);
    expect(cached(queryClient)?.correction?.correctedText).toBe("I have a cat");
  });

  it("keeps the correction when a status update arrives without it", () => {
    const queryClient = new QueryClient();
    upsertMessageInCache(queryClient, "c1", { ...message, correction });
    upsertMessageInCache(queryClient, "c1", { ...message, status: "READ" });
    expect(cached(queryClient)?.status).toBe("READ");
    expect(cached(queryClient)?.correction).toEqual(correction);
  });
});
