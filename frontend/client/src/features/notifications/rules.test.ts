import type { ChatMessage } from "@/features/chat/types";

import { badgeLabel } from "./useNotificationBadges";
import { correctionBanner, messageBanner, targetFromPushData } from "./rules";

jest.mock("@/features/chat/hooks/useConversations", () => ({ useConversations: jest.fn() }));

const prefs = { notifyMessages: true, notifyConnectionRequests: true };

const message = {
  id: "m1",
  conversationId: "c1",
  senderId: "james",
  type: "TEXT",
  content: "Salut!",
} as ChatMessage;

describe("message banners", () => {
  const context = { viewerId: "maria", openConversationId: null, senderName: "James", prefs };

  it("shows who wrote and a preview", () => {
    expect(messageBanner(message, context)).toMatchObject({
      title: "James",
      body: "Salut!",
      target: { screen: "Conversation", conversationId: "c1" },
    });
  });

  it("skips your own messages, the open chat, and when turned off", () => {
    expect(messageBanner(message, { ...context, viewerId: "james" })).toBeNull();
    expect(messageBanner(message, { ...context, openConversationId: "c1" })).toBeNull();
    expect(
      messageBanner(message, { ...context, prefs: { ...prefs, notifyMessages: false } }),
    ).toBeNull();
  });
});

describe("correction banners", () => {
  const event = {
    conversationId: "c1",
    messageId: "m1",
    correction: {
      id: "k1",
      messageId: "m1",
      authorId: "james",
      correctedText: "I have a cat",
      note: null,
      createdAt: "2026-10-20T10:01:00.000Z",
    },
  };
  const context = { viewerId: "maria", openConversationId: null, authorName: "James", prefs };

  it("tells the author who corrected them", () => {
    expect(correctionBanner(event, context)).toMatchObject({
      title: "James suggested a correction",
      body: "I have a cat",
      target: { screen: "Conversation", conversationId: "c1" },
    });
  });

  it("stays quiet for your own correction, the open chat, and when turned off", () => {
    expect(correctionBanner(event, { ...context, viewerId: "james" })).toBeNull();
    expect(correctionBanner(event, { ...context, openConversationId: "c1" })).toBeNull();
    expect(
      correctionBanner(event, { ...context, prefs: { ...prefs, notifyMessages: false } }),
    ).toBeNull();
  });
});

describe("push taps", () => {
  it("opens the right screen", () => {
    expect(targetFromPushData({ type: "message", conversationId: "c1" })).toEqual({
      screen: "Conversation",
      conversationId: "c1",
    });
    expect(targetFromPushData({ type: "connection_request", userId: "james" })).toEqual({
      screen: "PublicProfile",
      userId: "james",
    });
    expect(targetFromPushData({ type: "connection_accepted", userId: "james" })).toEqual({
      screen: "PublicProfile",
      userId: "james",
    });
    expect(targetFromPushData({ type: "connection_request" })).toBeNull();
    expect(targetFromPushData({ type: "message" })).toBeNull();
    expect(targetFromPushData("nonsense")).toBeNull();
  });
});

describe("badges", () => {
  it("hides zero and caps large counts", () => {
    expect(badgeLabel(0)).toBeUndefined();
    expect(badgeLabel(3)).toBe(3);
    expect(badgeLabel(250)).toBe("99+");
  });
});
