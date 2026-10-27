import {
  flattenGroupMessages,
  groupActivity,
  groupPrimaryAction,
  upsertGroupMessage,
} from "./groupModel";
import type { GroupMessage } from "../types";

const base = { visibility: "PUBLIC" as const, memberCount: 3, maxMembers: 10, viewer: null };

function message(id: string, clientMessageId?: string, content = "hi"): GroupMessage {
  return {
    id,
    clientMessageId,
    content,
    groupId: "g1",
    conversationId: "c1",
    senderId: "u1",
    type: "TEXT",
    status: "SENT",
    createdAt: "2026-10-16T10:00:00.000Z",
    updatedAt: "2026-10-16T10:00:00.000Z",
    sender: { id: "u1", displayName: "Anya", avatarUrl: null, country: "RU" },
  };
}

describe("groupPrimaryAction", () => {
  it("picks the action from membership and visibility", () => {
    expect(groupPrimaryAction(base).kind).toBe("join");
    expect(groupPrimaryAction({ ...base, visibility: "PRIVATE" }).kind).toBe("request");
    expect(groupPrimaryAction({ ...base, memberCount: 10 }).kind).toBe("full");
    expect(
      groupPrimaryAction({ ...base, viewer: { role: "MEMBER", status: "PENDING" } }).kind,
    ).toBe("pending");
    expect(
      groupPrimaryAction({ ...base, memberCount: 10, viewer: { role: "MEMBER", status: "ACTIVE" } })
        .kind,
    ).toBe("open");
  });
});

describe("upsertGroupMessage", () => {
  const data = {
    pages: [
      { items: [message("m2")], nextCursor: "m2", hasMore: true, limit: 30 },
      { items: [message("m1")], nextCursor: null, hasMore: false, limit: 30 },
    ],
    pageParams: [undefined, "m2"],
  };

  it("appends new messages to the newest page in order", () => {
    const next = upsertGroupMessage(data, message("m3"));
    expect(flattenGroupMessages(next).map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
  });

  it("replaces an optimistic message by clientMessageId instead of duplicating", () => {
    const optimistic = upsertGroupMessage(data, message("msg-local", "cid-1"));
    const confirmed = upsertGroupMessage(optimistic, message("m3", "cid-1"));
    expect(flattenGroupMessages(confirmed).map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
  });

  it("ignores socket echoes of a message already present", () => {
    const once = upsertGroupMessage(data, message("m3"));
    const twice = upsertGroupMessage(once, message("m3"));
    expect(flattenGroupMessages(twice)).toHaveLength(3);
  });
});

describe("groupActivity", () => {
  const now = Date.parse("2026-10-27T12:00:00.000Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it("is live within 15 minutes", () => {
    expect(groupActivity(ago(5 * 60_000), now)).toEqual({ live: true, label: "Active now" });
  });

  it("labels minutes, hours and days", () => {
    expect(groupActivity(ago(40 * 60_000), now)?.label).toBe("Active 40m ago");
    expect(groupActivity(ago(3 * 3_600_000), now)?.label).toBe("Active 3h ago");
    expect(groupActivity(ago(2 * 86_400_000), now)?.label).toBe("Active 2d ago");
  });

  it("is null when never active, invalid or older than a week", () => {
    expect(groupActivity(null, now)).toBeNull();
    expect(groupActivity("nope", now)).toBeNull();
    expect(groupActivity(ago(8 * 86_400_000), now)).toBeNull();
  });
});
