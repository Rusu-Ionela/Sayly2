import { shouldPersistQuery } from "./queryPersistence";

const query = (queryKey: readonly unknown[], status: "success" | "error" | "pending" = "success") =>
  ({ queryKey, state: { status } }) as unknown as Parameters<typeof shouldPersistQuery>[0];

describe("offline cache", () => {
  it("keeps my profile, chats, streak and today's icebreaker", () => {
    for (const key of [
      ["profile", "me"],
      ["conversations"],
      ["messages", "c1"],
      ["streak", "me"],
      ["icebreakers", "today", "es"],
    ]) {
      expect(shouldPersistQuery(query(key))).toBe(true);
    }
  });

  it("never stores discovery, other people's profiles or failed requests", () => {
    expect(shouldPersistQuery(query(["discovery", {}]))).toBe(false);
    expect(shouldPersistQuery(query(["public-profile", "u2"]))).toBe(false);
    expect(shouldPersistQuery(query(["profile", "me"], "error"))).toBe(false);
  });
});
