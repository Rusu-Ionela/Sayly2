import type { GroupMemberStatus, GroupRole, GroupVisibility, ProficiencyLevel } from "../../db/schema";
import type { ChatMessage } from "../messaging/types";

export type GroupPersonDto = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  country: string;
};

export type GroupViewerDto = { role: GroupRole; status: GroupMemberStatus } | null;

export type GroupSummaryDto = {
  id: string;
  name: string;
  description: string;
  language: { id: string; code: string; name: string; flagEmoji: string };
  level: ProficiencyLevel | null;
  topic: string | null;
  audience: string;
  visibility: GroupVisibility;
  memberCount: number;
  maxMembers: number;
  lastActivityAt: string | null;
  createdAt: string;
  viewer: GroupViewerDto;
  /** Only for active members; messages from others since they last read. */
  unreadCount: number;
};

export type GroupDetailDto = GroupSummaryDto & {
  rules: string;
  owner: GroupPersonDto;
  moderators: GroupPersonDto[];
  /** Moderators only. */
  pendingCount: number;
};

export type GroupMemberDto = GroupPersonDto & {
  role: GroupRole;
  status: GroupMemberStatus;
  joinedAt: string;
};

export type GroupMessageDto = ChatMessage & {
  groupId: string;
  sender: GroupPersonDto;
};

export type GroupsPage = {
  items: GroupSummaryDto[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export type GroupMessagesPage = {
  items: GroupMessageDto[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
};

/** Outcome of a membership mutation plus who must be notified. */
export type MembershipChange = {
  group: GroupDetailDto;
  notify: { userIds: string[]; event: "group_membership"; payload: Record<string, unknown> }[];
};
