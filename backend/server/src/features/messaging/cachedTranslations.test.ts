import { createHash } from "crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repository", () => ({
  findTranslationsFor: vi.fn(),
  getAccessibleMessage: vi.fn(),
  findTranslation: vi.fn(async () => null),
  saveMessageTranslation: vi.fn(async (row: { text: string; targetLang: string }) => row),
  toTranslatedMessageDto: vi.fn(
    (message: { id: string }, translation: { text: string; lang: string } | null) => ({
      id: message.id,
      translatedContent: translation?.text ?? null,
      translatedLang: translation?.lang ?? null,
    }),
  ),
}));

vi.mock("../users/settings", () => ({
  getTranslateToSetting: vi.fn(async () => "ro"),
}));

vi.mock("../languages/service", () => ({
  getMyLanguages: vi.fn(),
}));

import { getMemoryRedis, setRedisCommandsForTests } from "../../infra/redis/client";
import { getMyLanguages } from "../languages/service";
import * as repository from "./repository";
import { TRANSLATION_PROVIDER_VERSION, translateMessage, withCachedTranslations } from "./learning";
import type { ChatMessage } from "./types";

const repo = vi.mocked(repository);
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

function message(id: string, content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    conversationId: "c1",
    senderId: "partner",
    type: "TEXT",
    content,
    status: "READ",
    durationMs: null,
    mimeType: null,
    thumbnailUrl: null,
    transcript: null,
    translatedContent: null,
    translatedLang: null,
    caption: null,
    clientMessageId: null,
    createdAt: "2026-10-24T10:00:00.000Z",
    updatedAt: "2026-10-24T10:00:00.000Z",
    ...extra,
  } as ChatMessage;
}

describe("translations saved with the chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows earlier translations in the viewer's language when the chat is reopened", async () => {
    repo.findTranslationsFor.mockResolvedValue([
      { messageId: "m1", sourceHash: hash("Hello"), targetLang: "ro", text: "Salut" },
      // Translated before the text changed: must not be shown.
      { messageId: "m2", sourceHash: hash("Old text"), targetLang: "ro", text: "Vechi" },
    ]);

    const items = await withCachedTranslations("viewer", [message("m1", "Hello"), message("m2", "New text")]);

    expect(repo.findTranslationsFor).toHaveBeenCalledWith(["m1", "m2"], "ro", TRANSLATION_PROVIDER_VERSION);
    expect(items[0]).toMatchObject({ translatedContent: "Salut", translatedLang: "ro" });
    expect(items[1]).toMatchObject({ translatedContent: null });
  });

  it("skips the lookup when nothing on the page can be translated", async () => {
    const items = [message("s1", "follow_notice", { type: "SYSTEM" })];
    expect(await withCachedTranslations("viewer", items)).toBe(items);
    expect(repo.findTranslationsFor).not.toHaveBeenCalled();
  });

  it('translates "salut" from a Romanian speaker into English correctly', async () => {
    getMemoryRedis().reset();
    setRedisCommandsForTests(getMemoryRedis());
    vi.mocked(getMyLanguages).mockResolvedValue({
      SPEAKS: [{ code: "ro", proficiency: "NATIVE" }],
      LEARNING: [{ code: "en", proficiency: "BEGINNER" }],
    } as never);
    const sent = { ...message("m-salut", "salut"), senderId: "ro-speaker", createdAt: new Date(), updatedAt: new Date() };
    repo.getAccessibleMessage.mockResolvedValue(sent as never);
    const fetchMock = vi.fn(async (_url: URL) => ({
      json: async () => ({
        responseStatus: 200,
        responseData: { translatedText: "Hi," },
        matches: [
          { translation: "Hi,", match: 0.99, quality: "74" },
          { translation: "Hello", match: 0.98, quality: "74" },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await translateMessage("en-viewer", "c1", "m-salut", "en");

    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get("langpair")).toBe("ro|en");
    expect(result).toMatchObject({ translatedContent: "Hi,", translatedLang: "en" });
    expect(getMyLanguages).toHaveBeenCalledWith("ro-speaker");
    vi.unstubAllGlobals();
  });

  it("rejects an unknown source language without calling the provider", async () => {
    repo.getAccessibleMessage.mockResolvedValue({
      ...message("m1", "Hello"),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(translateMessage("viewer", "c1", "m1", "ro", "klingon")).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
