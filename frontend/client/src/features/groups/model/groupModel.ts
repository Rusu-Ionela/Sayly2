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

export type GroupActivity = { live: boolean; label: string };

const LIVE_WINDOW_MS = 15 * 60_000;
const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * How recently a club was active, from its last message/post time. "Live" means something
 * happened in the last 15 minutes. null when the club has never been active.
 */
export function groupActivity(
  lastActivityAt: string | null,
  now = Date.now(),
): GroupActivity | null {
  if (!lastActivityAt) return null;
  const at = Date.parse(lastActivityAt);
  if (Number.isNaN(at)) return null;
  const ago = Math.max(0, now - at);
  if (ago < LIVE_WINDOW_MS) return { live: true, label: "Active now" };
  if (ago < HOUR_MS) return { live: false, label: `Active ${Math.floor(ago / 60_000)}m ago` };
  if (ago < DAY_MS) return { live: false, label: `Active ${Math.floor(ago / HOUR_MS)}h ago` };
  if (ago < 7 * DAY_MS) return { live: false, label: `Active ${Math.floor(ago / DAY_MS)}d ago` };
  return null;
}
