import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { AppError } from "../../shared/errors/AppError";
import { buildOpenApiDocument } from "../../docs/openapi";

vi.mock("../../shared/middleware/authenticate", () => import("../../test/authMock"));

vi.mock("./service", () => ({
  listConversations: vi.fn(),
  listMessages: vi.fn(),
  sendMessage: vi.fn(),
  markMessagesRead: vi.fn(),
  setConversationPinned: vi.fn(),
  assertCanAccessConversation: vi.fn(),
  getOrCreateDirectConversation: vi.fn(),
  markMessagesDelivered: vi.fn(),
  listPartnerIds: vi.fn(),
  persistLastSeen: vi.fn(),
  translateMessage: vi.fn(),
  transcribeMessage: vi.fn(),
}));

import { createApp } from "../../lib/app";
import * as messagingService from "./service";
import {
  listConversationsQuerySchema,
  listMessagesQuerySchema,
  sendMessageSchema,
} from "./schema";

const mockedListConversations = vi.mocked(messagingService.listConversations);
const mockedListMessages = vi.mocked(messagingService.listMessages);
const mockedSend = vi.mocked(messagingService.sendMessage);
const mockedRead = vi.mocked(messagingService.markMessagesRead);
const mockedOpenDirect = vi.mocked(messagingService.getOrCreateDirectConversation);

const app = createApp();

const sampleMessage = {
  id: "msg-1",
  conversationId: "conv-1",
  senderId: "viewer-1",
  type: "TEXT" as const,
  content: "Salut",
  status: "SENT" as const,
  createdAt: "2026-09-07T10:00:00.000Z",
  updatedAt: "2026-09-07T10:00:00.000Z",
};

describe("CHAT-001 / CHAT-002 messaging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validation", () => {
    it("defaults conversation list limit to 20", () => {
      expect(listConversationsQuerySchema.parse({})).toEqual({ limit: 20 });
    });

    it("defaults message list limit to 30", () => {
      expect(listMessagesQuerySchema.parse({})).toEqual({ limit: 30 });
    });

    it("accepts a before cursor", () => {
      expect(listMessagesQuerySchema.parse({ before: "msg-9", limit: "20" })).toEqual({
        before: "msg-9",
        limit: 20,
      });
    });

    it("rejects empty message content", () => {
      expect(sendMessageSchema.safeParse({ content: "  " }).success).toBe(false);
    });

    it("accepts IMAGE messages", () => {
      expect(sendMessageSchema.parse({ content: "/media/files/photo.jpg", type: "IMAGE" })).toEqual({
        content: "/media/files/photo.jpg",
        type: "IMAGE",
      });
    });

    it("accepts a photo caption", () => {
      expect(
        sendMessageSchema.parse({
          content: "/media/files/photo.jpg",
          type: "IMAGE",
          caption: "hello from the farm",
        }),
      ).toMatchObject({ caption: "hello from the farm" });
    });

    it("accepts VIDEO messages with duration", () => {
      expect(
        sendMessageSchema.parse({
          content: "https://cdn.example/clip.mp4",
          type: "VIDEO",
          durationMs: 4200,
          mimeType: "video/mp4",
        }),
      ).toMatchObject({ type: "VIDEO", durationMs: 4200 });
    });
  });

  describe("GET /conversations", () => {
    it("requires auth", async () => {
      const res = await request(app).get("/conversations");
      expect(res.status).toBe(401);
    });

    it("returns a cursor page", async () => {
      mockedListConversations.mockResolvedValue({
        items: [
          {
            id: "conv-1",
            type: "DIRECT",
            otherUser: {
              id: "user-2",
              displayName: "Maria",
              avatarUrl: null,
              country: "RO",
              onlineStatus: "OFFLINE",
              lastSeen: null,
            },
            lastMessage: sampleMessage,
            unreadCount: 2,
            lastMessageAt: sampleMessage.createdAt,
            updatedAt: sampleMessage.createdAt,
            pinnedAt: null,
          },
        ],
        nextCursor: null,
        hasMore: false,
        limit: 20,
      });

      const res = await request(app).get("/conversations").set("Authorization", "Bearer test");
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].unreadCount).toBe(2);
      expect(res.body.items[0].otherUser.displayName).toBe("Maria");
      expect(mockedListConversations).toHaveBeenCalledWith("viewer-1", { limit: 20 });
    });
  });

  describe("pinning", () => {
    const mockedPin = vi.mocked(messagingService.setConversationPinned);

    it("requires auth", async () => {
      expect((await request(app).put("/conversations/conv-1/pin")).status).toBe(401);
    });

    it("pins and unpins for the signed-in user only", async () => {
      mockedPin.mockResolvedValue({ conversationId: "conv-1", pinned: true });
      const pinned = await request(app).put("/conversations/conv-1/pin").set("Authorization", "Bearer test");
      expect(pinned.status).toBe(200);
      expect(mockedPin).toHaveBeenLastCalledWith("viewer-1", "conv-1", true);

      mockedPin.mockResolvedValue({ conversationId: "conv-1", pinned: false });
      await request(app).delete("/conversations/conv-1/pin").set("Authorization", "Bearer test");
      expect(mockedPin).toHaveBeenLastCalledWith("viewer-1", "conv-1", false);
    });

    it("answers 409 when the pin limit is reached", async () => {
      mockedPin.mockRejectedValue(new AppError("You can pin up to 3 chats", 409, "CONFLICT"));
      const res = await request(app).put("/conversations/conv-1/pin").set("Authorization", "Bearer test");
      expect(res.status).toBe(409);
    });
  });

  describe("GET /conversations/:id/messages", () => {
    it("forwards the before cursor", async () => {
      mockedListMessages.mockResolvedValue({
        items: [sampleMessage],
        nextCursor: null,
        hasMore: false,
        limit: 30,
      });

      const res = await request(app)
        .get("/conversations/conv-1/messages?before=msg-9")
        .set("Authorization", "Bearer test");

      expect(res.status).toBe(200);
      expect(mockedListMessages).toHaveBeenCalledWith("viewer-1", "conv-1", {
        before: "msg-9",
        limit: 30,
      });
    });
  });

  describe("POST /conversations/:id/messages", () => {
    it("saves a message", async () => {
      mockedSend.mockResolvedValue({
        message: sampleMessage,
        recipientId: "user-2",
        created: true,
      });

      const res = await request(app)
        .post("/conversations/conv-1/messages")
        .set("Authorization", "Bearer test")
        .send({ content: "Salut" });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe("msg-1");
      expect(mockedSend).toHaveBeenCalledWith("viewer-1", {
        conversationId: "conv-1",
        content: "Salut",
        type: undefined,
      });
    });
  });

  describe("PATCH /conversations/:id/read", () => {
    it("marks unread messages as read", async () => {
      mockedRead.mockResolvedValue({
        messages: [{ ...sampleMessage, senderId: "user-2", status: "READ" }],
        senderIds: ["user-2"],
      });

      const res = await request(app)
        .patch("/conversations/conv-1/read")
        .set("Authorization", "Bearer test");

      expect(res.status).toBe(200);
      expect(res.body.readCount).toBe(1);
      expect(mockedRead).toHaveBeenCalledWith("viewer-1", "conv-1");
    });
  });

  describe("POST /conversations/direct", () => {
    it("requires authentication", async () => {
      const res = await request(app).post("/conversations/direct").send({ userId: "user-2" });
      expect(res.status).toBe(401);
    });

    it("rejects a missing userId", async () => {
      const res = await request(app)
        .post("/conversations/direct")
        .set("Authorization", "Bearer test")
        .send({});
      expect(res.status).toBe(400);
      expect(mockedOpenDirect).not.toHaveBeenCalled();
    });

    it("creates a conversation without any connection request (201)", async () => {
      mockedOpenDirect.mockResolvedValueOnce({ conversationId: "conv-9", created: true });
      const res = await request(app)
        .post("/conversations/direct")
        .set("Authorization", "Bearer test")
        .send({ userId: "user-2" });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ conversationId: "conv-9" });
      expect(mockedOpenDirect).toHaveBeenCalledWith("viewer-1", "user-2");
    });

    it("returns the existing conversation (200)", async () => {
      mockedOpenDirect.mockResolvedValueOnce({ conversationId: "conv-9", created: false });
      const res = await request(app)
        .post("/conversations/direct")
        .set("Authorization", "Bearer test")
        .send({ userId: "user-2" });
      expect(res.status).toBe(200);
    });

    it("passes through 404 for unavailable or blocking users", async () => {
      mockedOpenDirect.mockRejectedValueOnce(new AppError("User not found", 404, "NOT_FOUND"));
      const res = await request(app)
        .post("/conversations/direct")
        .set("Authorization", "Bearer test")
        .send({ userId: "user-2" });
      expect(res.status).toBe(404);
    });
  });

  it("documents chat paths in OpenAPI", () => {
    const document = buildOpenApiDocument();
    const paths = document.paths ?? {};
    expect(paths["/conversations"]).toBeDefined();
    expect(paths["/conversations/{id}/messages"]).toBeDefined();
    expect(paths["/conversations/{id}/read"]).toBeDefined();
    expect(paths["/conversations/{id}/messages/{messageId}/translate"]).toBeDefined();
    expect(paths["/media/uploads"]).toBeDefined();
  });
});
