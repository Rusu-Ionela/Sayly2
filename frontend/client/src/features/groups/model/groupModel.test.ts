import { flattenGroupMessages, groupPrimaryAction, upsertGroupMessage } from "./groupModel";
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
