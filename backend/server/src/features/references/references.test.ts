import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../../shared/middleware/authenticate", () => import("../../test/authMock"));
vi.mock("../../infra/limiter/middleware", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../infra/limiter/middleware")>()),
  mutationLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("./repository", () => ({
  listReferencesPage: vi.fn(async () => ({ items: [], hasMore: false })),
  summarizeReferences: vi.fn(async () => ({ total: 0, positive: 0 })),
  findMine: vi.fn(async () => null),
  haveExchangedMessages: vi.fn(async () => false),
  upsertReference: vi.fn(),
  deleteReference: vi.fn(async () => undefined),
}));
vi.mock("../notifications/inbox", () => ({ recordCorrection: vi.fn(), recordReference: vi.fn() }));
vi.mock("../users/memberSummary", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../users/memberSummary")>()),
  assertVisibleMember: vi.fn(async () => undefined),
}));

import { createApp } from "../../lib/app";
import { TEST_VIEWER_ID } from "../../test/authMock";
import { AppError } from "../../shared/errors/AppError";
import { assertVisibleMember } from "../users/memberSummary";
import * as referencesRepository from "./repository";
import { saveReferenceSchema } from "./schema";
import { REFERENCE_BODY_MAX } from "./types";

const repo = vi.mocked(referencesRepository);
const visible = vi.mocked(assertVisibleMember);
const notFound = () => new AppError("User not found", 404, "NOT_FOUND");
const app = createApp();
const auth = { Authorization: "Bearer test" };
const saved = { id: "ref-1", rating: 5, body: "Great partner", createdAt: "2026-10-18T10:00:00.000Z" };

describe("references", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validation", () => {
    it("accepts a 1–5 rating and cleans up the text", () => {
      expect(saveReferenceSchema.parse({ rating: 4, body: "  Great   partner!\n\n\n\nThanks " })).toEqual({
        rating: 4,
        body: "Great partner!\n\nThanks",
      });
    });

    it("rejects bad ratings, empty or over-long text, and extra fields", () => {
      const ok = { rating: 5, body: "A lovely conversation." };
      for (const bad of [
        { ...ok, rating: 0 },
        { ...ok, rating: 6 },
        { ...ok, rating: 4.5 },
        { body: ok.body },
        { ...ok, body: "   " },
        { ...ok, body: "x".repeat(REFERENCE_BODY_MAX + 1) },
        { ...ok, authorId: "someone-else" },
      ]) {
        expect(() => saveReferenceSchema.parse(bad)).toThrow();
      }
    });
  });

  describe("GET /users/:userId/references", () => {
    it("requires authentication", async () => {
      await request(app).get("/users/user-2/references").expect(401);
    });

    it("shows that a member has no references yet", async () => {
      const res = await request(app).get("/users/user-2/references").set(auth).expect(200);
      expect(res.body).toEqual({
        summary: { total: 0, positive: 0 },
        items: [],
        page: 1,
        hasMore: false,
        canWrite: false,
        mine: null,
      });
      expect(repo.listReferencesPage).toHaveBeenCalledWith(TEST_VIEWER_ID, "user-2", 1);
      // Counts leave out authors the viewer blocked, like the list does.
      expect(repo.summarizeReferences).toHaveBeenCalledWith("user-2", TEST_VIEWER_ID);
    });

    it("lets partners who chatted write, and returns your own reference", async () => {
      repo.findMine.mockResolvedValueOnce(saved);
      repo.summarizeReferences.mockResolvedValueOnce({ total: 3, positive: 2 });
      const res = await request(app).get("/users/user-2/references?page=2").set(auth).expect(200);
      expect(res.body).toMatchObject({ page: 2, canWrite: true, mine: saved, summary: { total: 3, positive: 2 } });
    });

    it("never offers writing about yourself", async () => {
      repo.haveExchangedMessages.mockResolvedValue(true);
      const res = await request(app).get(`/users/${TEST_VIEWER_ID}/references`).set(auth).expect(200);
      expect(res.body.canWrite).toBe(false);
      expect(repo.findMine).not.toHaveBeenCalled();
      expect(visible).not.toHaveBeenCalled();
      repo.haveExchangedMessages.mockResolvedValue(false);
    });

    it("404s when the profile itself would (inactive, unfinished or blocked)", async () => {
      visible.mockRejectedValueOnce(notFound());
      await request(app).get("/users/user-2/references").set(auth).expect(404);
      expect(repo.listReferencesPage).not.toHaveBeenCalled();
    });

    it("rejects an invalid page", async () => {
      await request(app).get("/users/user-2/references?page=0").set(auth).expect(400);
    });
  });

  describe("POST /users/:userId/references", () => {
    const body = { rating: 5, body: "Great partner" };

    it("needs a real exchange first", async () => {
      await request(app).post("/users/user-2/references").set(auth).send(body).expect(403);
      expect(repo.upsertReference).not.toHaveBeenCalled();
    });

    it("saves your reference once you've both written", async () => {
      repo.haveExchangedMessages.mockResolvedValueOnce(true);
      repo.upsertReference.mockResolvedValueOnce(saved);
      const res = await request(app).post("/users/user-2/references").set(auth).send(body).expect(201);
      expect(res.body).toEqual(saved);
      expect(repo.upsertReference).toHaveBeenCalledWith(TEST_VIEWER_ID, "user-2", body);
    });

    it("404s for a member you can't see", async () => {
      visible.mockRejectedValueOnce(notFound());
      await request(app).post("/users/user-2/references").set(auth).send(body).expect(404);
      expect(repo.upsertReference).not.toHaveBeenCalled();
    });

    it("rejects writing about yourself and invalid bodies", async () => {
      await request(app).post(`/users/${TEST_VIEWER_ID}/references`).set(auth).send(body).expect(400);
      await request(app).post("/users/user-2/references").set(auth).send({ body: "" }).expect(400);
      expect(repo.upsertReference).not.toHaveBeenCalled();
    });
  });

  it("DELETE withdraws your reference", async () => {
    const res = await request(app).delete("/users/user-2/references").set(auth).expect(200);
    expect(res.body).toEqual({ deleted: true });
    expect(repo.deleteReference).toHaveBeenCalledWith(TEST_VIEWER_ID, "user-2");
  });
});
