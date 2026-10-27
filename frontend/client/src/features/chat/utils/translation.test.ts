import type { ChatMessage } from "../types";
import { AUTO_TRANSLATE_LIMIT, autoTranslateQueue, canTranslate } from "./translation";

const message = (id: string, extra: Partial<ChatMessage> = {}) =>
  ({
    id,
    conversationId: "c1",
    senderId: "partner",
    type: "TEXT",
    content: "Hola",
    status: "READ",
    createdAt: "2026-10-24T10:00:00.000Z",
    ...extra,
  }) as ChatMessage;

describe("translatable messages", () => {
  it("covers text, captioned photos and transcribed notes only", () => {
    expect(canTranslate(message("t"))).toBe(true);
    expect(canTranslate(message("p", { type: "IMAGE", caption: null }))).toBe(false);
    expect(canTranslate(message("p", { type: "IMAGE", caption: "Beach" }))).toBe(true);
    expect(canTranslate(message("v", { type: "VOICE", transcript: null }))).toBe(false);
    expect(canTranslate(message("v", { type: "VOICE", transcript: "Hello" }))).toBe(true);
    expect(canTranslate(message("s", { type: "SYSTEM" }))).toBe(false);
  });
});

describe("auto-translate queue", () => {
  const isLocal = (id: string) => id.startsWith("local-");

  it("takes the partner's untranslated messages, newest first", () => {
    const queue = autoTranslateQueue(
      [
        message("new"),
        message("mine", { senderId: "me" }),
        message("done", { translatedContent: "Hello" }),
        message("local-1"),
        message("old"),
      ],
      "me",
      new Set(["old"]),
      isLocal,
    );
    expect(queue.map((item) => item.id)).toEqual(["new"]);
  });

  it("stops at the per-visit limit", () => {
    const many = Array.from({ length: 30 }, (_, index) => message(`m${index}`));
    const tried = new Set(["x1", "x2"]);
    expect(autoTranslateQueue(many, "me", tried, isLocal)).toHaveLength(AUTO_TRANSLATE_LIMIT - 2);
  });
});
