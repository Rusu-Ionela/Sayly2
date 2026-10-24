import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../shared/errors/AppError";

const postFollowNotice = vi.fn(async () => undefined);
vi.mock("./repository", () => ({ postFollowNotice }));

const { announceFollow } = await import("./followNotice");

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("announceFollow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts the notice from the follower to the followee", () => {
    announceFollow("ana", "ben");
    expect(postFollowNotice).toHaveBeenCalledWith("ana", "ben");
  });

  it("never throws when the pair cannot be chatted with", async () => {
    postFollowNotice.mockRejectedValueOnce(new AppError("User not found", 404, "NOT_FOUND"));
    expect(() => announceFollow("ana", "ben")).not.toThrow();
    await settle();
  });

  it("never throws on an unexpected failure either", async () => {
    postFollowNotice.mockRejectedValueOnce(new Error("db down"));
    expect(() => announceFollow("ana", "ben")).not.toThrow();
    await settle();
  });
});
