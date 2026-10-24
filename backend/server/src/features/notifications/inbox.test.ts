import { beforeEach, describe, expect, it, vi } from "vitest";

const insertInboxItem = vi.fn(async () => undefined);
vi.mock("./inbox.repository", () => ({ insertInboxItem }));

const inbox = await import("./inbox");

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("inbox recording", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keys a reference per author and subject so edits do not re-notify", () => {
    inbox.recordReference("ana", "ben");
    expect(insertInboxItem).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "ben", type: "REFERENCE", dedupeKey: "reference:ana:ben" }),
    );
  });

  it("links a correction to its chat", () => {
    inbox.recordCorrection("k1", "ana", "ben", "c1");
    expect(insertInboxItem).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "ben", type: "CORRECTION", conversationId: "c1", dedupeKey: "correction:k1" }),
    );
  });

  it("swallows a failed write so the triggering action still succeeds", async () => {
    insertInboxItem.mockRejectedValueOnce(new Error("db down"));
    expect(() => inbox.recordReference("ana", "ben")).not.toThrow();
    await settle();
  });
});
