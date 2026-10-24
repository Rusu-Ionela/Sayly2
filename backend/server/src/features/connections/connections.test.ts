import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../../shared/middleware/authenticate", () => import("../../test/authMock"));
vi.mock("../messaging/conversations.repository", () => ({ getOrCreateDirectConversation: vi.fn() }));
vi.mock("../notifications/service", () => ({ notifyConnectionAccepted: vi.fn(), notifyConnectionRequest: vi.fn() }));
vi.mock("./repository", () => ({
  getConnection: vi.fn(),
  listConnections: vi.fn(),
  requestConnection: vi.fn(),
  respondToConnection: vi.fn(),
}));

import { createApp } from "../../lib/app";
import { getOrCreateDirectConversation } from "../messaging/conversations.repository";
import { notifyConnectionAccepted, notifyConnectionRequest } from "../notifications/service";
import * as repository from "./repository";

const auth = { Authorization: "Bearer test" };
const connection = {
  id: "connection-1",
  status: "PENDING" as const,
  direction: "OUTGOING" as const,
  introMessage: "Would you like to practise together?",
  createdAt: "2026-10-23T00:00:00.000Z",
  updatedAt: "2026-10-23T00:00:00.000Z",
  member: {
    id: "user-2",
    displayName: "Yuki",
    avatarUrl: null,
    country: "JP",
    city: null,
    isPro: false,
    nativeLanguage: null,
    learningLanguage: null,
    onlineStatus: "UNKNOWN" as const,
    lastSeen: null,
  },
};

describe("connection request routes", () => {
  const app = createApp();

  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", async () => {
    await request(app).get("/connections").expect(401);
    await request(app).post("/connections/user-2").send({}).expect(401);
    await request(app).patch("/connections/connection-1").send({ action: "ACCEPT" }).expect(401);
  });

  it("requests and reads a connection using the authenticated member only", async () => {
    vi.mocked(repository.requestConnection).mockResolvedValueOnce({
      connection: {
        id: connection.id,
        requesterId: "viewer-1",
        recipientId: "user-2",
        status: "PENDING",
        introMessage: connection.introMessage,
        createdAt: new Date(connection.createdAt),
        updatedAt: new Date(connection.updatedAt),
      },
      created: true,
      accepted: false,
    });
    vi.mocked(repository.getConnection).mockResolvedValueOnce(connection);

    const res = await request(app)
      .post("/connections/user-2")
      .set(auth)
      .send({ introMessage: "  Would you like to practise together?  " })
      .expect(200);

    expect(res.body).toEqual(connection);
    expect(repository.requestConnection).toHaveBeenCalledWith(
      "viewer-1",
      "user-2",
      "Would you like to practise together?",
    );
    expect(notifyConnectionRequest).toHaveBeenCalledWith("viewer-1", "user-2");
    expect(repository.getConnection).toHaveBeenCalledWith("viewer-1", "user-2");
  });

  it("validates and sends only explicit connection actions", async () => {
    vi.mocked(repository.respondToConnection).mockResolvedValueOnce({
      connection: {
        id: connection.id,
        requesterId: "viewer-1",
        recipientId: "user-2",
        status: "ACCEPTED",
        introMessage: connection.introMessage,
        createdAt: new Date(connection.createdAt),
        updatedAt: new Date(connection.updatedAt),
      },
      changed: true,
    });
    vi.mocked(repository.getConnection).mockResolvedValueOnce({ ...connection, status: "ACCEPTED" });

    await request(app)
      .patch("/connections/connection-1")
      .set(auth)
      .send({ action: "ACCEPT" })
      .expect(200, { ...connection, status: "ACCEPTED" });
    expect(repository.respondToConnection).toHaveBeenCalledWith("viewer-1", "connection-1", "ACCEPT");
    expect(getOrCreateDirectConversation).toHaveBeenCalledWith("viewer-1", "user-2");
    expect(notifyConnectionAccepted).toHaveBeenCalledWith("viewer-1", "user-2");

    await request(app)
      .patch("/connections/connection-1")
      .set(auth)
      .send({ action: "DELETE_ALL" })
      .expect(400);
  });

  it("lets either accepted partner remove the relationship without deleting chat history", async () => {
    vi.mocked(repository.respondToConnection).mockResolvedValueOnce({
      connection: {
        id: connection.id,
        requesterId: "viewer-1",
        recipientId: "user-2",
        status: "CANCELLED",
        introMessage: null,
        createdAt: new Date(connection.createdAt),
        updatedAt: new Date(connection.updatedAt),
      },
      changed: true,
    });
    vi.mocked(repository.getConnection).mockResolvedValueOnce(null);

    await request(app)
      .patch("/connections/connection-1")
      .set(auth)
      .send({ action: "REMOVE" })
      .expect(200, null);
    expect(repository.respondToConnection).toHaveBeenCalledWith("viewer-1", "connection-1", "REMOVE");
    expect(getOrCreateDirectConversation).not.toHaveBeenCalled();
  });
});
