import type { InboxItem } from "./api";
import { inboxRow } from "./inboxView";

const base: InboxItem = {
  id: "n1",
  type: "REFERENCE",
  conversationId: null,
  createdAt: "2026-10-20T10:00:00.000Z",
  readAt: null,
  actor: { id: "u2", displayName: "Ana", avatarUrl: null },
};

describe("inboxRow", () => {
  it("opens the author's profile for a reference", () => {
    expect(inboxRow(base)).toMatchObject({
      text: "Ana wrote a reference for you",
      target: { screen: "PublicProfile", userId: "u2" },
    });
  });

  it("opens the chat for a correction", () => {
    expect(inboxRow({ ...base, type: "CORRECTION", conversationId: "c1" }).target).toEqual({
      screen: "Conversation",
      conversationId: "c1",
    });
  });

  it("falls back to the profile when a correction has no chat", () => {
    expect(inboxRow({ ...base, type: "CORRECTION" }).target).toEqual({
      screen: "PublicProfile",
      userId: "u2",
    });
  });

  it("never renders an empty name", () => {
    const row = inboxRow({ ...base, actor: { ...base.actor, displayName: " " } });
    expect(row.text).toBe("Someone wrote a reference for you");
  });
});
