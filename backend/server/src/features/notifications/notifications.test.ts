import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PushMessage } from "./expoPush";

const repo = {
  displayNameOf: vi.fn(async (id: string) => (id === "james" ? "James" : "Maria")),
  notificationPreferencesOf: vi.fn(async () => ({ notifyMessages: true, notifyConnectionRequests: true })),
  pushTokensOf: vi.fn(async () => ["ExponentPushToken[aaa]"]),
  deletePushTokens: vi.fn(async () => undefined),
  savePushToken: vi.fn(),
  removePushToken: vi.fn(),
};
const sendExpoPush = vi.fn<(messages: PushMessage[]) => Promise<string[]>>(async () => []);

vi.mock("./repository", () => repo);
vi.mock("./expoPush", () => ({ sendExpoPush }));
const recordCorrection = vi.fn();
vi.mock("./inbox", () => ({ recordCorrection }));

const service = await import("./service");
const { registerPushTokenSchema } = await import("./schema");
const real = await vi.importActual<typeof import("./expoPush")>("./expoPush");

/** Lets the fire-and-forget notification work finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("message notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  const message = {
    id: "m1",
    conversationId: "v1",
    senderId: "james",
    type: "TEXT",
    content: "Salut! Ce faci?",
    caption: null,
  } as unknown as Parameters<typeof service.notifyNewMessage>[0];

  it("forgets devices Expo reports as unregistered", async () => {
    sendExpoPush.mockResolvedValueOnce(["ExponentPushToken[aaa]"]);
    service.notifyNewMessage(message, "maria");
    await settle();
    expect(repo.deletePushTokens).toHaveBeenCalledWith(["ExponentPushToken[aaa]"]);
  });

  it("pushes the sender name and a preview", async () => {
    service.notifyNewMessage(message, "maria");
    await settle();
    expect(sendExpoPush.mock.calls[0]?.[0]?.[0]).toMatchObject({
      title: "James",
      body: "Salut! Ce faci?",
      data: { type: "message", conversationId: "v1" },
    });
  });

  it("respects 'Messages' turned off in Settings", async () => {
    repo.notificationPreferencesOf.mockResolvedValueOnce({
      notifyMessages: false,
      notifyConnectionRequests: true,
    });
    service.notifyNewMessage(message, "maria");
    await settle();
    expect(sendExpoPush).not.toHaveBeenCalled();
  });

  it("describes media and shortens long text", () => {
    expect(service.messagePreview({ type: "VOICE", content: "x", caption: null })).toBe(
      "🎤 Voice message",
    );
    expect(service.messagePreview({ type: "IMAGE", content: "x", caption: null })).toBe("📷 Photo");
    const long = service.messagePreview({ type: "TEXT", content: "a".repeat(300), caption: null });
    expect(long).toHaveLength(140);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("correction notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  const correction = {
    id: "k1",
    messageId: "m1",
    authorId: "james",
    correctedText: "I have a cat",
    note: null,
    createdAt: "2026-10-20T10:01:00.000Z",
  };

  it("pushes the correction to the message author", async () => {
    service.notifyCorrection(correction, "maria", "c1");
    await settle();
    expect(repo.pushTokensOf).toHaveBeenCalledWith("maria");
    expect(sendExpoPush.mock.calls[0]?.[0]?.[0]).toMatchObject({
      title: "James suggested a correction",
      body: "I have a cat",
      data: { type: "message", conversationId: "c1" },
    });
  });

  it("stores the correction in the inbox even when push is off", async () => {
    repo.notificationPreferencesOf.mockResolvedValueOnce({
      notifyMessages: false,
      notifyConnectionRequests: true,
    });
    service.notifyCorrection(correction, "maria", "c1");
    await settle();
    expect(recordCorrection).toHaveBeenCalledWith("k1", "james", "maria", "c1");
    expect(sendExpoPush).not.toHaveBeenCalled();
  });

  it("respects 'Messages' turned off in Settings", async () => {
    repo.notificationPreferencesOf.mockResolvedValueOnce({
      notifyMessages: false,
      notifyConnectionRequests: true,
    });
    service.notifyCorrection(correction, "maria", "c1");
    await settle();
    expect(sendExpoPush).not.toHaveBeenCalled();
  });
});

describe("connection notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("notifies an opted-in recipient about a pending request", async () => {
    service.notifyConnectionRequest("james", "maria");
    await settle();
    expect(sendExpoPush.mock.calls[0]?.[0]?.[0]).toMatchObject({
      title: "New connection request",
      body: "James would like to practise with you.",
      data: { type: "connection_request", userId: "james" },
    });
  });

  it("notifies both opted-in members after acceptance", async () => {
    service.notifyConnectionAccepted("james", "maria");
    await settle();
    const messages = sendExpoPush.mock.calls.map(([batch]) => batch?.[0]);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ data: { type: "connection_accepted", userId: "maria" } }),
        expect.objectContaining({ data: { type: "connection_accepted", userId: "james" } }),
      ]),
    );
  });

  it("respects connection notification preferences", async () => {
    repo.notificationPreferencesOf.mockResolvedValueOnce({
      notifyMessages: true,
      notifyConnectionRequests: false,
    });
    service.notifyConnectionRequest("james", "maria");
    await settle();
    expect(sendExpoPush).not.toHaveBeenCalled();
  });
});

describe("Expo push transport", () => {
  it("returns tokens of uninstalled apps and keeps going on errors", async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            { status: "ok", id: "1" },
            { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } },
          ],
        }),
        { status: 200 },
      ),
    );
    const dead = await real.sendExpoPush(
      [
        { to: "ExponentPushToken[ok]", title: "t", body: "b", data: {} },
        { to: "ExponentPushToken[gone]", title: "t", body: "b", data: {} },
      ],
      fakeFetch as unknown as typeof fetch,
    );
    expect(dead).toEqual(["ExponentPushToken[gone]"]);
  });

  it("never throws when Expo is unreachable", async () => {
    const failing = vi.fn(async () => {
      throw new Error("offline");
    });
    await expect(
      real.sendExpoPush(
        [{ to: "ExponentPushToken[x]", title: "t", body: "b", data: {} }],
        failing as unknown as typeof fetch,
      ),
    ).resolves.toEqual([]);
  });
});

describe("push token validation", () => {
  it("accepts Expo tokens only", () => {
    expect(
      registerPushTokenSchema.safeParse({ token: "ExponentPushToken[abc123]", platform: "android" })
        .success,
    ).toBe(true);
    expect(
      registerPushTokenSchema.safeParse({ token: "https://evil.example", platform: "ios" }).success,
    ).toBe(false);
    expect(
      registerPushTokenSchema.safeParse({ token: "ExponentPushToken[abc]", platform: "web" }).success,
    ).toBe(false);
  });
});
