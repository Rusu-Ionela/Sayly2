import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { AppError } from "../../shared/errors/AppError";

vi.mock("../../shared/middleware/authenticate", () => ({
  optionalAuthenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
  authenticate: (
    req: { get: (name: string) => string | undefined; userId?: string; user?: { id: string } },
    _res: unknown,
    next: (err?: unknown) => void,
  ) => {
    if (!req.get("authorization")) {
      next(new AppError("Authentication required", 401, "UNAUTHORIZED"));
      return;
    }
    req.userId = "viewer-1";
    req.user = { id: "viewer-1" };
    next();
  },
}));

vi.mock("../notifications/inbox", () => ({ recordCorrection: vi.fn(), recordReference: vi.fn() }));

vi.mock("../messaging/followNotice", () => ({ announceFollow: vi.fn() }));

vi.mock("./repository", () => ({
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
  listFollowing: vi.fn(),
  isFollowing: vi.fn(),
  countFollowers: vi.fn(),
}));

import { createApp } from "../../lib/app";
import * as repository from "./repository";

const mockedFollow = vi.mocked(repository.followUser);
const mockedUnfollow = vi.mocked(repository.unfollowUser);
const mockedList = vi.mocked(repository.listFollowing);

const app = createApp();
const auth = { Authorization: "Bearer test" };

describe("follows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication", async () => {
    expect((await request(app).put("/follows/user-2")).status).toBe(401);
    expect((await request(app).delete("/follows/user-2")).status).toBe(401);
    expect((await request(app).get("/follows")).status).toBe(401);
  });

  it("follows a user as the authenticated viewer", async () => {
    mockedFollow.mockResolvedValueOnce({ following: true });
    const res = await request(app).put("/follows/user-2").set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ following: true });
    expect(mockedFollow).toHaveBeenCalledWith("viewer-1", "user-2");
  });

  it("surfaces 404 for unavailable or blocking users", async () => {
    mockedFollow.mockRejectedValueOnce(new AppError("User not found", 404, "NOT_FOUND"));
    expect((await request(app).put("/follows/user-2").set(auth)).status).toBe(404);
  });

  it("surfaces 400 when following yourself", async () => {
    mockedFollow.mockRejectedValueOnce(
      new AppError("You cannot follow yourself", 400, "VALIDATION_ERROR"),
    );
    expect((await request(app).put("/follows/viewer-1").set(auth)).status).toBe(400);
  });

  it("unfollows", async () => {
    mockedUnfollow.mockResolvedValueOnce({ following: false });
    const res = await request(app).delete("/follows/user-2").set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ following: false });
    expect(mockedUnfollow).toHaveBeenCalledWith("viewer-1", "user-2");
  });

  it("lists who the viewer follows, page 1 by default", async () => {
    mockedList.mockResolvedValueOnce({ items: [], page: 1, hasMore: false });
    const res = await request(app).get("/follows").set(auth);
    expect(res.status).toBe(200);
    expect(mockedList).toHaveBeenCalledWith("viewer-1", 1);
  });

  it("rejects an invalid page", async () => {
    const res = await request(app).get("/follows?page=0").set(auth);
    expect(res.status).toBe(400);
    expect(mockedList).not.toHaveBeenCalled();
  });
});
