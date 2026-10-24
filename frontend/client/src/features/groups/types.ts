import type { ChatMessage, LocalSendState } from "@/features/chat/types";
import type { ProficiencyLevel } from "@/features/languages/types";

type GroupRole = "OWNER" | "MODERATOR" | "MEMBER";
export type GroupMemberStatus = "ACTIVE" | "PENDING";
export type GroupVisibility = "PUBLIC" | "PRIVATE";
export type GroupViewer = { role: GroupRole; status: GroupMemberStatus } | null;

type GroupPerson = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  country: string;
};

export type GroupSummary = {
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
  viewer: GroupViewer;
  unreadCount: number;
};

export type GroupDetail = GroupSummary & {
  rules: string;
  owner: GroupPerson;
  moderators: GroupPerson[];
  pendingCount: number;
};

export type GroupMember = GroupPerson & {
  role: GroupRole;
  status: GroupMemberStatus;
  joinedAt: string;
};

export type GroupMessage = ChatMessage & {
  groupId: string;
  sender: GroupPerson;
  localState?: LocalSendState;
};

export type GroupsPage = {
  items: GroupSummary[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export type GroupMessagesPage = {
  items: GroupMessage[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
};

export type GroupFilters = {
  scope: "discover" | "mine";
  search?: string;
  languageId?: string;
  level?: ProficiencyLevel;
  topic?: string;
  sort?: "active" | "popular" | "new";
};

export type CreateGroupInput = {
  name: string;
  description: string;
  languageId: string;
  level: ProficiencyLevel | null;
  topic: string | null;
  audience: string;
  rules: string;
  visibility: GroupVisibility;
  maxMembers: number;
};
