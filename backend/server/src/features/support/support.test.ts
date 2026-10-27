import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createSupportTicketSchema, SUPPORT_MESSAGE_MAX } from "@sayly/shared";

vi.mock("../../shared/middleware/authenticate", () => import("../../test/authMock"));
vi.mock("../../infra/limiter/middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../infra/limiter/middleware")>();
  return {
    ...actual,
    supportTicketLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  };
});
vi.mock("./service", () => ({
  createTicket: vi.fn(async (_userId: string, input: { kind: string; subject: string }) => ({
    id: "ticket-1",
    kind: input.kind,
    topic: null,
    subject: input.subject,
    status: "OPEN",
    contactEmail: "me@example.com",
    createdAt: "2026-10-21T10:00:00.000Z",
  })),
  listTickets: vi.fn(async () => ({ items: [] })),
}));

import { createApp } from "../../lib/app";
import { TEST_VIEWER_ID } from "../../test/authMock";
import * as supportService from "./service";

const service = vi.mocked(supportService);
const app = createApp();
const auth = { Authorization: "Bearer test" };

const bugReport = {
  kind: "BUG_REPORT",
  subject: "  Chat   freezes ",
  message: "The chat freezes when I send a voice message.\n\n\n\nEvery time.",
  device: { appVersion: "1.0.0", platform: "ANDROID", osVersion: "15", deviceModel: "Pixel 9" },
};

describe("support tickets", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("validation", () => {
    it("cleans up the subject and message", () => {
      const parsed = createSupportTicketSchema.parse(bugReport);
      expect(parsed.subject).toBe("Chat freezes");
      expect(parsed.message).toBe("The chat freezes when I send a voice message.\n\nEvery time.");
    });

    it("rejects messages that are too short or too long", () => {
      expect(() => createSupportTicketSchema.parse({ ...bugReport, message: "Broken" })).toThrow();
      expect(() =>
        createSupportTicketSchema.parse({ ...bugReport, message: "x".repeat(SUPPORT_MESSAGE_MAX + 1) }),
      ).toThrow();
    });

    it("rejects unknown kinds, topics and platforms", () => {
      expect(() => createSupportTicketSchema.parse({ ...bugReport, kind: "SPAM" })).toThrow();
      expect(() => createSupportTicketSchema.parse({ ...bugReport, topic: "BILLING" })).toThrow();
      expect(() =>
        createSupportTicketSchema.parse({
          ...bugReport,
          device: { appVersion: "1.0.0", platform: "SYMBIAN" },
        }),
      ).toThrow();
    });

    it("does not let the client choose the sender, email or status", () => {
      for (const extra of [{ userId: "u2" }, { contactEmail: "x@y.z" }, { status: "RESOLVED" }]) {
        expect(() => createSupportTicketSchema.parse({ ...bugReport, ...extra })).toThrow();
      }
    });

    it("keeps device details optional", () => {
      const { device: _device, ...withoutDevice } = bugReport;
      expect(createSupportTicketSchema.parse(withoutDevice).device).toBeUndefined();
    });
  });

  describe("routes", () => {
    it("saves the ticket for the signed-in member", async () => {
      const res = await request(app).post("/support/tickets").set(auth).send(bugReport).expect(201);
      expect(res.body).toMatchObject({ id: "ticket-1", status: "OPEN" });
      expect(service.createTicket).toHaveBeenCalledWith(
        TEST_VIEWER_ID,
        expect.objectContaining({ kind: "BUG_REPORT", subject: "Chat freezes" }),
      );
    });

    it("answers 400 for an invalid body", async () => {
      await request(app)
        .post("/support/tickets")
        .set(auth)
        .send({ kind: "FEATURE_REQUEST", subject: "Hi", message: "short" })
        .expect(400);
      expect(service.createTicket).not.toHaveBeenCalled();
    });

    it("lists your own tickets", async () => {
      await request(app).get("/support/tickets").set(auth).expect(200);
      expect(service.listTickets).toHaveBeenCalledWith(TEST_VIEWER_ID);
    });

    it("requires authentication", async () => {
      await request(app).post("/support/tickets").send(bugReport).expect(401);
      await request(app).post("/support/bug-report").send(bugReport).expect(401);
      expect(service.createTicket).not.toHaveBeenCalled();
    });

    it("takes the kind from the dedicated feedback routes", async () => {
      const { kind: _kind, ...report } = bugReport;
      await request(app).post("/support/bug-report").set(auth).send(report).expect(201);
      expect(service.createTicket).toHaveBeenLastCalledWith(
        TEST_VIEWER_ID,
        expect.objectContaining({ kind: "BUG_REPORT", subject: "Chat freezes" }),
      );

      const { device: _device, ...idea } = report;
      await request(app).post("/support/feature-request").set(auth).send(idea).expect(201);
      expect(service.createTicket).toHaveBeenLastCalledWith(
        TEST_VIEWER_ID,
        expect.objectContaining({ kind: "FEATURE_REQUEST" }),
      );
    });

    it("does not let the body override the route's kind", async () => {
      await request(app).post("/support/feature-request").set(auth).send(bugReport).expect(400);
      expect(service.createTicket).not.toHaveBeenCalled();
    });
  });
});
