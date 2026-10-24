import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../features/auth/tokens", () => ({ verifyAccessToken: vi.fn() }));

import { verifyAccessToken } from "../features/auth/tokens";
import { verifyReauthToken } from "./socket";

const session = { userId: "u1", authVersion: 2, familyId: "f1" };
const claims = { sub: "u1", authVersion: 2, familyId: "f1", exp: 2_000_000 };

describe("socket reauth", () => {
  beforeEach(() => vi.mocked(verifyAccessToken).mockReset());

  it("returns the new expiry for the same user and session", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue(claims as never);
    await expect(verifyReauthToken(session, "token")).resolves.toBe(2_000_000_000);
  });

  it("rejects a token for another user, session or password version", async () => {
    for (const other of [{ sub: "u2" }, { familyId: "f2" }, { authVersion: 3 }]) {
      vi.mocked(verifyAccessToken).mockResolvedValue({ ...claims, ...other } as never);
      await expect(verifyReauthToken(session, "token")).rejects.toThrow("Unauthorized");
    }
  });

  it("rejects missing or oversized tokens without verifying them", async () => {
    await expect(verifyReauthToken(session, undefined)).rejects.toThrow("Unauthorized");
    await expect(verifyReauthToken(session, "x".repeat(9000))).rejects.toThrow("Unauthorized");
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });
});
