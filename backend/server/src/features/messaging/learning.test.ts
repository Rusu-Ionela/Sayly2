import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../languages/service", () => ({
  getMyLanguages: vi.fn(async () => ({
    SPEAKS: [{ code: "en", proficiency: "NATIVE" }],
    LEARNING: [],
  })),
}));

vi.mock("./repository", () => ({
  getAccessibleMessage: vi.fn(),
  findTranslation: vi.fn(),
  saveMessageTranslation: vi.fn(),
  toMessageDto: vi.fn((message: { id: string }) => ({
    id: message.id,
    translatedContent: null,
    translatedLang: null,
  })),
  toTranslatedMessageDto: vi.fn(
    (message: { id: string }, translation?: { text: string; lang: string } | null) => ({
      id: message.id,
      translatedContent: translation?.text ?? null,
      translatedLang: translation?.lang ?? null,
    }),
  ),
}));

import { AppError } from "../../shared/errors/AppError";
import { getMemoryRedis, setRedisCommandsForTests } from "../../infra/redis/client";
import { normalizeLanguageCode } from "../languages/catalog";
import * as repository from "./repository";
import { textToTranslate, translateMessage, TRANSLATION_PROVIDER_VERSION } from "./learning";

const mockedRepo = vi.mocked(repository);

const baseMessage = {
  id: "msg-1",
  conversationId: "conv-1",
  senderId: "user-1",
  type: "TEXT" as const,
  content: "Hello there",
  status: "SENT" as const,
  durationMs: null,
  mimeType: null,
  thumbnailUrl: null,
  transcript: null,
  translatedContent: null,
  translatedLang: null,
  caption: null,
  clientMessageId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("per-language translations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMemoryRedis().reset();
    setRedisCommandsForTests(getMemoryRedis());
    mockedRepo.getAccessibleMessage.mockResolvedValue(baseMessage);
    mockedRepo.findTranslation.mockResolvedValue(null);
    mockedRepo.saveMessageTranslation.mockImplementation(async (input) => ({
      id: "tr-1",
      messageId: input.messageId,
      targetLang: input.targetLang,
      sourceHash: input.sourceHash,
      providerVersion: input.providerVersion,
      text: input.text,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setRedisCommandsForTests(null);
  });

  it("derives source text from the message type", () => {
    expect(textToTranslate(baseMessage)).toBe("Hello there");
    expect(textToTranslate({ ...baseMessage, type: "IMAGE", caption: "a cat" })).toBe("a cat");
    expect(textToTranslate({ ...baseMessage, type: "VOICE", transcript: "spoken" })).toBe("spoken");
  });

  it("normalizes language aliases against the catalog", () => {
    expect(normalizeLanguageCode("RO")).toBe("ro");
    expect(normalizeLanguageCode("zh-CN")).toBe("zh");
    expect(normalizeLanguageCode("not-a-lang")).toBeNull();
  });

  it("stores Romanian and Hindi translations independently", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        return {
          json: async () => ({
            responseStatus: 200,
            responseData: {
              translatedText: url.includes("ro") ? "Salut" : "Namaste",
            },
          }),
        };
      }),
    );

    const romanian = await translateMessage("viewer-1", "conv-1", "msg-1", "ro");
    const hindi = await translateMessage("viewer-1", "conv-1", "msg-1", "hi");

    expect(romanian.translatedLang).toBe("ro");
    expect(hindi.translatedLang).toBe("hi");
    expect(mockedRepo.saveMessageTranslation.mock.calls.map((call) => call[0]?.targetLang)).toEqual([
      "ro",
      "hi",
    ]);
  });

  it("reuses a cached row for identical requests", async () => {
    mockedRepo.findTranslation.mockResolvedValue({
      id: "tr-cached",
      messageId: "msg-1",
      targetLang: "ro",
      sourceHash: "ignored",
      providerVersion: TRANSLATION_PROVIDER_VERSION,
      text: "Salut",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await translateMessage("viewer-1", "conv-1", "msg-1", "ro");
    expect(result.translatedContent).toBe("Salut");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockedRepo.saveMessageTranslation).not.toHaveBeenCalled();
  });

  it("does not cache a provider failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("timeout");
    }));

    await expect(translateMessage("viewer-1", "conv-1", "msg-1", "ro")).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      statusCode: 502,
    });
    expect(mockedRepo.saveMessageTranslation).not.toHaveBeenCalled();
  });

  it("rejects an unauthorized caller before returning cache", async () => {
    mockedRepo.getAccessibleMessage.mockRejectedValue(new AppError("Forbidden", 403, "FORBIDDEN"));
    mockedRepo.findTranslation.mockResolvedValue({
      id: "tr-secret",
      messageId: "msg-1",
      targetLang: "ro",
      sourceHash: "x",
      providerVersion: TRANSLATION_PROVIDER_VERSION,
      text: "secret",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(translateMessage("stranger", "conv-1", "msg-1", "ro")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mockedRepo.findTranslation).not.toHaveBeenCalled();
  });

  it("does not return an outdated translation after the source changes", async () => {
    mockedRepo.findTranslation.mockResolvedValue(null);
    mockedRepo.getAccessibleMessage
      .mockResolvedValueOnce(baseMessage)
      .mockResolvedValueOnce({ ...baseMessage, content: "Changed source" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({
          responseStatus: 200,
          responseData: { translatedText: "Salut" },
        }),
      })),
    );

    await expect(translateMessage("viewer-1", "conv-1", "msg-1", "ro")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(mockedRepo.saveMessageTranslation).not.toHaveBeenCalled();
  });
});
