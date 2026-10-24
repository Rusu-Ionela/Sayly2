import type { GroupMessage, GroupMessagesPage, GroupSummary, GroupViewer } from "../types";

export type GroupPrimaryAction =
  | { kind: "open"; label: "Open discussion" }
  | { kind: "join"; label: "Join group" }
  | { kind: "request"; label: "Request to join" }
  | { kind: "pending"; label: "Request pending" }
  | { kind: "full"; label: "Group is full" };

/** Mirrors server rules for display only; the API stays authoritative. */
export function groupPrimaryAction(
  group: Pick<GroupSummary, "visibility" | "memberCount" | "maxMembers" | "viewer">,
): GroupPrimaryAction {
  if (group.viewer?.status === "ACTIVE") return { kind: "open", label: "Open discussion" };
  if (group.viewer?.status === "PENDING") return { kind: "pending", label: "Request pending" };
  if (group.visibility === "PRIVATE") return { kind: "request", label: "Request to join" };
  if (group.memberCount >= group.maxMembers) return { kind: "full", label: "Group is full" };
  return { kind: "join", label: "Join group" };
}

export const isGroupModerator = (viewer: GroupViewer) =>
  viewer?.status === "ACTIVE" && (viewer.role === "OWNER" || viewer.role === "MODERATOR");

export const isGroupOwner = (viewer: GroupViewer) =>
  viewer?.status === "ACTIVE" && viewer.role === "OWNER";

export function roleLabel(role: string) {
  return role === "OWNER" ? "Owner" : role === "MODERATOR" ? "Moderator" : "Member";
}

type Pages = { pages: GroupMessagesPage[]; pageParams: unknown[] };

/**
 * Insert or replace a message in the newest page. Matches on server id or
 * clientMessageId so an optimistic bubble is swapped, never duplicated.
 */
export function upsertGroupMessage(
  data: Pages | undefined,
  message: GroupMessage,
): Pages | undefined {
  if (!data) return data;
  const same = (item: GroupMessage) =>
    item.id === message.id ||
    Boolean(message.clientMessageId && item.clientMessageId === message.clientMessageId);
  const exists = data.pages.some((page) => page.items.some(same));
  const pages = data.pages.map((page, index) => {
    if (exists) return { ...page, items: page.items.map((item) => (same(item) ? message : item)) };
    return index === 0 ? { ...page, items: [...page.items, message] } : page;
  });
  return { ...data, pages };
}

/** Pages are [newest, older…], each ascending — flatten oldest→newest. */
export function flattenGroupMessages(data: Pages | undefined): GroupMessage[] {
  if (!data) return [];
  return [...data.pages].reverse().flatMap((page) => page.items);
}
