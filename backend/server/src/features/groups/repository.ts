import { and, asc, count, desc, eq, gt, ilike, inArray, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db, type DbTransaction } from "../../db/client";
import { isUniqueViolation } from "../../db/errors";
import {
  conversations,
  groupMembers,
  groups,
  languages,
  messages,
  profiles,
  users,
  type GroupMemberStatus,
  type GroupRole,
} from "../../db/schema";
import { AppError } from "../../shared/errors/AppError";
import { resignMediaUrl } from "../media/storage";
import { toMessageDto } from "../messaging/repository";
import { visibleCountry } from "../users/settings";

import * as policy from "./policy";
import type { CreateGroupInput, ListGroupsQuery, UpdateGroupInput } from "./schema";
import type {
  GroupDetailDto,
  GroupMemberDto,
  GroupMessageDto,
  GroupMessagesPage,
  GroupPersonDto,
  GroupSummaryDto,
  GroupsPage,
  MembershipChange,
} from "./types";
import { escapeIlike, lockUser } from "../../db/helpers";

type Executor = typeof db | DbTransaction;
type GroupRow = typeof groups.$inferSelect;

const viewerMember = alias(groupMembers, "viewer_member");

function toPerson(row: {
  id: string;
  displayName: string | null;
  avatar: string | null;
  country: string | null;
}): GroupPersonDto {
  return {
    id: row.id,
    displayName: row.displayName || "Sayly member",
    avatarUrl: row.avatar ? (resignMediaUrl(row.avatar) ?? row.avatar) : null,
    country: row.country ?? "",
  };
}

const personColumns = {
  id: users.id,
  displayName: profiles.displayName,
  avatar: profiles.profileImageUrl,
  country: visibleCountry,
};

async function loadPeople(executor: Executor, userIds: string[]) {
  if (userIds.length === 0) return new Map<string, GroupPersonDto>();
  const rows = await executor
    .select(personColumns)
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(inArray(users.id, userIds));
  return new Map(rows.map((row) => [row.id, toPerson(row)]));
}

async function getMembership(executor: Executor, groupId: string, userId: string): Promise<policy.Membership> {
  const [row] = await executor
    .select({ role: groupMembers.role, status: groupMembers.status })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** Serializes every membership change on a group; also hides deleted groups. */
async function lockGroup(tx: DbTransaction, groupId: string): Promise<GroupRow> {
  const [row] = await tx
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
    .for("update")
    .limit(1);
  if (!row) {
    throw new AppError("Group not found", 404, "NOT_FOUND");
  }
  return row;
}

async function getLiveGroup(groupId: string): Promise<GroupRow> {
  const [row] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
    .limit(1);
  if (!row) {
    throw new AppError("Group not found", 404, "NOT_FOUND");
  }
  return row;
}

async function adjustMemberCount(tx: DbTransaction, groupId: string, delta: 1 | -1) {
  await tx
    .update(groups)
    .set({ memberCount: sql`${groups.memberCount} + ${delta}` })
    .where(eq(groups.id, groupId));
}

async function activeMemberIds(executor: Executor, groupId: string, roles?: GroupRole[]) {
  const rows = await executor
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.status, "ACTIVE"),
        roles ? inArray(groupMembers.role, roles) : undefined,
      ),
    );
  return rows.map((row) => row.userId);
}

const summaryColumns = {
  group: groups,
  language: {
    id: languages.id,
    code: languages.code,
    name: languages.name,
    flagEmoji: languages.flagEmoji,
  },
  lastActivityAt: conversations.lastMessageAt,
  viewerRole: viewerMember.role,
  viewerStatus: viewerMember.status,
};

type SummaryRow = {
  group: GroupRow;
  language: GroupSummaryDto["language"];
  lastActivityAt: Date | null;
  viewerRole: GroupRole | null;
  viewerStatus: GroupMemberStatus | null;
};

function summaryBase(viewerId: string) {
  return db
    .select(summaryColumns)
    .from(groups)
    .innerJoin(languages, eq(languages.id, groups.languageId))
    .innerJoin(conversations, eq(conversations.id, groups.conversationId))
    .leftJoin(
      viewerMember,
      and(eq(viewerMember.groupId, groups.id), eq(viewerMember.userId, viewerId)),
    );
}

function toSummary(row: SummaryRow, unreadCount: number): GroupSummaryDto {
  const { group } = row;
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    language: row.language,
    level: group.level,
    topic: group.topic,
    audience: group.audience,
    visibility: group.visibility,
    memberCount: group.memberCount,
    maxMembers: group.maxMembers,
    lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
    createdAt: group.createdAt.toISOString(),
    viewer: row.viewerRole && row.viewerStatus ? { role: row.viewerRole, status: row.viewerStatus } : null,
    unreadCount,
  };
}

/** One grouped query for the whole page — no per-group N+1. */
async function loadUnreadCounts(viewerId: string, groupIds: string[]) {
  if (groupIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ groupId: groups.id, value: count() })
    .from(messages)
    .innerJoin(groups, eq(groups.conversationId, messages.conversationId))
    .innerJoin(
      groupMembers,
      and(
        eq(groupMembers.groupId, groups.id),
        eq(groupMembers.userId, viewerId),
        eq(groupMembers.status, "ACTIVE"),
      ),
    )
    .where(
      and(
        inArray(groups.id, groupIds),
        ne(messages.senderId, viewerId),
        gt(messages.createdAt, sql`COALESCE(${groupMembers.lastReadAt}, ${groupMembers.joinedAt})`),
      ),
    )
    .groupBy(groups.id);
  return new Map(rows.map((row) => [row.groupId, Number(row.value)]));
}

export async function listGroups(viewerId: string, query: ListGroupsQuery): Promise<GroupsPage> {
  const conditions: (SQL | undefined)[] = [isNull(groups.deletedAt)];
  if (query.scope === "mine") {
    conditions.push(sql`${viewerMember.userId} IS NOT NULL`);
  }
  if (query.search) {
    const needle = `%${escapeIlike(query.search)}%`;
    conditions.push(or(ilike(groups.name, needle), ilike(groups.description, needle), ilike(groups.audience, needle)));
  }
  if (query.languageId) conditions.push(eq(groups.languageId, query.languageId));
  if (query.level) conditions.push(eq(groups.level, query.level));
  if (query.topic) conditions.push(eq(groups.topic, query.topic));
  const where = and(...conditions);

  const order =
    query.sort === "popular"
      ? [desc(groups.memberCount), desc(groups.createdAt)]
      : query.sort === "new"
        ? [desc(groups.createdAt)]
        : [sql`${conversations.lastMessageAt} DESC NULLS LAST`, desc(groups.memberCount)];

  const [totalRow] = await db
    .select({ value: count() })
    .from(groups)
    .innerJoin(conversations, eq(conversations.id, groups.conversationId))
    .leftJoin(viewerMember, and(eq(viewerMember.groupId, groups.id), eq(viewerMember.userId, viewerId)))
    .where(where);
  const total = Number(totalRow?.value ?? 0);

  const rows = await summaryBase(viewerId)
    .where(where)
    .orderBy(...order, asc(groups.id))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);

  const unread = await loadUnreadCounts(
    viewerId,
    rows.filter((row) => row.viewerStatus === "ACTIVE").map((row) => row.group.id),
  );

  return {
    items: rows.map((row) => toSummary(row, unread.get(row.group.id) ?? 0)),
    page: query.page,
    limit: query.limit,
    total,
    hasMore: query.page * query.limit < total,
  };
}

export async function getGroupDetail(viewerId: string, groupId: string): Promise<GroupDetailDto> {
  const [row] = await summaryBase(viewerId)
    .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
    .limit(1);
  if (!row) {
    throw new AppError("Group not found", 404, "NOT_FOUND");
  }

  const membership: policy.Membership =
    row.viewerRole && row.viewerStatus ? { role: row.viewerRole, status: row.viewerStatus } : null;

  const [moderatorIds, unread, pendingRow] = await Promise.all([
    activeMemberIds(db, groupId, ["MODERATOR"]),
    policy.isActiveMember(membership) ? loadUnreadCounts(viewerId, [groupId]) : Promise.resolve(new Map()),
    policy.isModerator(membership)
      ? db
        .select({ value: count() })
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "PENDING")))
        .then((result) => result[0])
      : Promise.resolve(undefined),
  ]);
  const people = await loadPeople(db, [row.group.ownerId, ...moderatorIds.slice(0, 20)]);

  return {
    ...toSummary(row, unread.get(groupId) ?? 0),
    rules: row.group.rules,
    owner: people.get(row.group.ownerId) ?? toPerson({ id: row.group.ownerId, displayName: null, avatar: null, country: null }),
    moderators: moderatorIds.flatMap((id) => people.get(id) ?? []),
    pendingCount: Number(pendingRow?.value ?? 0),
  };
}

async function assertMembershipQuota(tx: DbTransaction, userId: string) {
  await lockUser(tx, userId);
  const [row] = await tx.select({ value: count() }).from(groupMembers).where(eq(groupMembers.userId, userId));
  if (Number(row?.value ?? 0) >= policy.MAX_GROUP_MEMBERSHIPS) {
    throw new AppError(`You can be in at most ${policy.MAX_GROUP_MEMBERSHIPS} groups`, 409, "CONFLICT");
  }
}

export async function createGroup(userId: string, input: CreateGroupInput): Promise<GroupDetailDto> {
  const groupId = await db.transaction(async (tx) => {
    // Locks the creator row first so the quotas below cannot be raced.
    await assertMembershipQuota(tx, userId);

    const [language] = await tx
      .select({ id: languages.id })
      .from(languages)
      .where(eq(languages.id, input.languageId))
      .limit(1);
    if (!language) {
      throw new AppError("Unknown language", 400, "VALIDATION_ERROR", { languageId: "Unknown language" });
    }

    const [owned] = await tx
      .select({ value: count() })
      .from(groups)
      .where(and(eq(groups.ownerId, userId), isNull(groups.deletedAt)));
    if (Number(owned?.value ?? 0) >= policy.MAX_OWNED_GROUPS) {
      throw new AppError(`You can own at most ${policy.MAX_OWNED_GROUPS} groups`, 409, "CONFLICT");
    }

    const [conversation] = await tx.insert(conversations).values({ type: "GROUP" }).returning({ id: conversations.id });
    if (!conversation) throw new Error("Database did not return conversation");

    const [group] = await tx
      .insert(groups)
      .values({ ...input, ownerId: userId, conversationId: conversation.id, memberCount: 1 })
      .returning({ id: groups.id });
    if (!group) throw new Error("Database did not return group");

    await tx.insert(groupMembers).values({ groupId: group.id, userId, role: "OWNER", status: "ACTIVE" });
    return group.id;
  });

  return getGroupDetail(userId, groupId);
}

/**
 * For account deletion: hands each group the user owns to its most senior active member (a
 * moderator first), closes it when nobody is left, and drops every membership of the user.
 */
export async function removeUserFromAllGroups(tx: DbTransaction, userId: string) {
  const memberships = await tx
    .select({ groupId: groupMembers.groupId, role: groupMembers.role, status: groupMembers.status })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  for (const membership of memberships) {
    const group = await lockGroup(tx, membership.groupId).catch(() => null);

    if (group && membership.role === "OWNER") {
      const [successor] = await tx
        .select({ userId: groupMembers.userId })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, membership.groupId),
            eq(groupMembers.status, "ACTIVE"),
            ne(groupMembers.userId, userId),
          ),
        )
        .orderBy(sql`case when ${groupMembers.role} = 'MODERATOR' then 0 else 1 end`, asc(groupMembers.joinedAt))
        .limit(1);

      if (successor) {
        await tx
          .update(groupMembers)
          .set({ role: "OWNER" })
          .where(and(eq(groupMembers.groupId, membership.groupId), eq(groupMembers.userId, successor.userId)));
        await tx.update(groups).set({ ownerId: successor.userId }).where(eq(groups.id, membership.groupId));
      } else {
        await tx.update(groups).set({ deletedAt: new Date() }).where(eq(groups.id, membership.groupId));
        await tx.delete(groupMembers).where(eq(groupMembers.groupId, membership.groupId));
        continue;
      }
    }

    await tx
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, membership.groupId), eq(groupMembers.userId, userId)));
    if (group && membership.status === "ACTIVE") {
      await adjustMemberCount(tx, membership.groupId, -1);
    }
  }
}

export async function updateGroup(userId: string, groupId: string, patch: UpdateGroupInput) {
  await db.transaction(async (tx) => {
    const group = await lockGroup(tx, groupId);
    policy.assertCanEdit(await getMembership(tx, groupId, userId), patch, group.memberCount);
    await tx.update(groups).set(patch).where(eq(groups.id, groupId));
  });
  return getGroupDetail(userId, groupId);
}

/** Soft delete: history is kept for moderation, the group disappears everywhere. */
export async function deleteGroup(userId: string, groupId: string) {
  return db.transaction(async (tx) => {
    await lockGroup(tx, groupId);
    policy.assertOwner(await getMembership(tx, groupId, userId));
    const memberIds = await activeMemberIds(tx, groupId);
    await tx.update(groups).set({ deletedAt: new Date() }).where(eq(groups.id, groupId));
    // Frees everyone's membership quota; messages stay attached to the conversation.
    await tx.delete(groupMembers).where(eq(groupMembers.groupId, groupId));
    return { memberIds: memberIds.filter((id) => id !== userId) };
  });
}

function membershipEvent(groupId: string, type: string, extra: Record<string, unknown> = {}) {
  return { groupId, type, ...extra };
}

export async function joinGroup(userId: string, groupId: string): Promise<MembershipChange> {
  const outcome = await db.transaction(async (tx) => {
    // User lock before group lock: account deletion locks in that order too (no deadlock).
    await lockUser(tx, userId);
    const group = await lockGroup(tx, groupId);
    const status = policy.joinOutcome(group, await getMembership(tx, groupId, userId));
    await assertMembershipQuota(tx, userId);
    await tx.insert(groupMembers).values({ groupId, userId, role: "MEMBER", status });
    if (status === "ACTIVE") {
      await adjustMemberCount(tx, groupId, 1);
    }
    const moderators = status === "PENDING" ? await activeMemberIds(tx, groupId, ["OWNER", "MODERATOR"]) : [];
    return { status, moderators };
  });

  return {
    group: await getGroupDetail(userId, groupId),
    notify:
      outcome.status === "PENDING"
        ? [{ userIds: outcome.moderators, event: "group_membership", payload: membershipEvent(groupId, "REQUESTED", { userId }) }]
        : [],
  };
}

export async function leaveGroup(userId: string, groupId: string) {
  await db.transaction(async (tx) => {
    await lockGroup(tx, groupId);
    const membership = await getMembership(tx, groupId, userId);
    policy.assertCanLeave(membership);
    await tx.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
    if (membership?.status === "ACTIVE") {
      await adjustMemberCount(tx, groupId, -1);
    }
  });
  return getGroupDetail(userId, groupId);
}

export async function approveMember(actorId: string, groupId: string, targetId: string): Promise<MembershipChange> {
  await db.transaction(async (tx) => {
    const group = await lockGroup(tx, groupId);
    policy.assertCanApprove(await getMembership(tx, groupId, actorId), await getMembership(tx, groupId, targetId));
    policy.assertHasCapacity(group);
    await tx
      .update(groupMembers)
      .set({ status: "ACTIVE", joinedAt: new Date() })
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetId)));
    await adjustMemberCount(tx, groupId, 1);
  });
  return {
    group: await getGroupDetail(actorId, groupId),
    notify: [{ userIds: [targetId], event: "group_membership", payload: membershipEvent(groupId, "APPROVED") }],
  };
}

/** Removes an active member or rejects a pending request. */
export async function removeMember(actorId: string, groupId: string, targetId: string): Promise<MembershipChange> {
  const wasPending = await db.transaction(async (tx) => {
    await lockGroup(tx, groupId);
    const target = await getMembership(tx, groupId, targetId);
    policy.assertCanRemove(actorId, await getMembership(tx, groupId, actorId), targetId, target);
    await tx.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetId)));
    if (target?.status === "ACTIVE") {
      await adjustMemberCount(tx, groupId, -1);
    }
    return target?.status === "PENDING";
  });
  return {
    group: await getGroupDetail(actorId, groupId),
    notify: [
      {
        userIds: [targetId],
        event: "group_membership",
        payload: membershipEvent(groupId, wasPending ? "REJECTED" : "REMOVED"),
      },
    ],
  };
}

export async function changeRole(
  actorId: string,
  groupId: string,
  targetId: string,
  role: "MODERATOR" | "MEMBER",
): Promise<MembershipChange> {
  await db.transaction(async (tx) => {
    await lockGroup(tx, groupId);
    policy.assertCanChangeRole(await getMembership(tx, groupId, actorId), await getMembership(tx, groupId, targetId), role);
    await tx
      .update(groupMembers)
      .set({ role })
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetId)));
  });
  return {
    group: await getGroupDetail(actorId, groupId),
    notify: [{ userIds: [targetId], event: "group_membership", payload: membershipEvent(groupId, "ROLE_CHANGED", { role }) }],
  };
}

export async function transferOwnership(actorId: string, groupId: string, targetId: string): Promise<MembershipChange> {
  await db.transaction(async (tx) => {
    await lockGroup(tx, groupId);
    policy.assertCanTransfer(
      actorId,
      await getMembership(tx, groupId, actorId),
      targetId,
      await getMembership(tx, groupId, targetId),
    );
    await tx
      .update(groupMembers)
      .set({ role: "MODERATOR" })
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, actorId)));
    await tx
      .update(groupMembers)
      .set({ role: "OWNER" })
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetId)));
    await tx.update(groups).set({ ownerId: targetId }).where(eq(groups.id, groupId));
  });
  return {
    group: await getGroupDetail(actorId, groupId),
    notify: [{ userIds: [targetId], event: "group_membership", payload: membershipEvent(groupId, "ROLE_CHANGED", { role: "OWNER" }) }],
  };
}

export async function listMembers(viewerId: string, groupId: string, status: GroupMemberStatus): Promise<GroupMemberDto[]> {
  await getLiveGroup(groupId);
  const membership = await getMembership(db, groupId, viewerId);
  if (status === "PENDING") {
    policy.assertCanModerate(membership);
  } else {
    policy.assertCanReadContent(membership);
  }

  const rows = await db
    .select({
      ...personColumns,
      role: groupMembers.role,
      status: groupMembers.status,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, status), eq(users.status, "ACTIVE")))
    .orderBy(
      sql`CASE ${groupMembers.role} WHEN 'OWNER' THEN 0 WHEN 'MODERATOR' THEN 1 ELSE 2 END`,
      asc(groupMembers.joinedAt),
    );

  return rows.map((row) => ({
    ...toPerson(row),
    role: row.role,
    status: row.status,
    joinedAt: row.joinedAt.toISOString(),
  }));
}

async function toGroupMessages(groupId: string, rows: (typeof messages.$inferSelect)[]): Promise<GroupMessageDto[]> {
  const people = await loadPeople(db, [...new Set(rows.map((row) => row.senderId))]);
  return rows.map((row) => ({
    ...toMessageDto(row),
    groupId,
    sender: people.get(row.senderId) ?? toPerson({ id: row.senderId, displayName: null, avatar: null, country: null }),
  }));
}

async function requireReadableGroup(viewerId: string, groupId: string) {
  const group = await getLiveGroup(groupId);
  policy.assertCanReadContent(await getMembership(db, groupId, viewerId));
  return group;
}

export async function listGroupMessages(
  viewerId: string,
  groupId: string,
  query: { before?: string; limit: number },
): Promise<GroupMessagesPage> {
  const group = await requireReadableGroup(viewerId, groupId);
  let cursor: { createdAt: Date; id: string } | undefined;
  if (query.before) {
    const [anchor] = await db
      .select({ id: messages.id, createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.id, query.before), eq(messages.conversationId, group.conversationId)))
      .limit(1);
    if (!anchor) {
      throw new AppError("Invalid cursor", 400, "VALIDATION_ERROR");
    }
    cursor = anchor;
  }

  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, group.conversationId),
        cursor
          ? or(lt(messages.createdAt, cursor.createdAt), and(eq(messages.createdAt, cursor.createdAt), lt(messages.id, cursor.id)))
          : undefined,
      ),
    )
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const page = (hasMore ? rows.slice(0, query.limit) : rows).reverse();
  return {
    items: await toGroupMessages(groupId, page),
    nextCursor: hasMore && page[0] ? page[0].id : null,
    hasMore,
    limit: query.limit,
  };
}

export async function sendGroupMessage(
  userId: string,
  groupId: string,
  input: { content: string; clientMessageId?: string },
): Promise<{ message: GroupMessageDto; recipientIds: string[]; created: boolean }> {
  const group = await requireReadableGroup(userId, groupId);
  const clientMessageId = input.clientMessageId ?? null;

  async function findPrior() {
    if (!clientMessageId) return null;
    const [prior] = await db
      .select()
      .from(messages)
      .where(and(eq(messages.senderId, userId), eq(messages.clientMessageId, clientMessageId)))
      .limit(1);
    if (prior && (prior.conversationId !== group.conversationId || prior.content !== input.content)) {
      throw new AppError("Idempotency key reused for different input", 409, "CONFLICT");
    }
    return prior ?? null;
  }

  const prior = await findPrior();
  if (prior) {
    return { message: (await toGroupMessages(groupId, [prior]))[0]!, recipientIds: [], created: false };
  }

  let saved: typeof messages.$inferSelect;
  try {
    saved = await db.transaction(async (tx) => {
      await tx.select({ id: conversations.id }).from(conversations).where(eq(conversations.id, group.conversationId)).for("update");
      const [created] = await tx
        .insert(messages)
        .values({ conversationId: group.conversationId, senderId: userId, type: "TEXT", content: input.content, clientMessageId })
        .returning();
      if (!created) throw new Error("Database did not return message");
      await tx
        .update(conversations)
        .set({ lastMessageId: created.id, lastMessageAt: created.createdAt })
        .where(eq(conversations.id, group.conversationId));
      await tx
        .update(groupMembers)
        .set({ lastReadAt: created.createdAt })
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
      return created;
    });
  } catch (error) {
    const retried = isUniqueViolation(error) ? await findPrior() : null;
    if (retried) {
      return { message: (await toGroupMessages(groupId, [retried]))[0]!, recipientIds: [], created: false };
    }
    throw error;
  }

  return {
    message: (await toGroupMessages(groupId, [saved]))[0]!,
    recipientIds: await activeMemberIds(db, groupId),
    created: true,
  };
}

export async function markGroupRead(userId: string, groupId: string) {
  await requireReadableGroup(userId, groupId);
  await db
    .update(groupMembers)
    .set({ lastReadAt: new Date() })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
}

/**
 * For features that live inside a group (feed, Party Rooms): the live group and the viewer's
 * membership, so they apply the same rules as the discussion. 404 for deleted groups.
 */
export async function getGroupAccess(groupId: string, userId: string) {
  const group = await getLiveGroup(groupId);
  return { group, membership: await getMembership(db, groupId, userId) };
}

/** Ids of the group's active members, for socket fan-out. */
export function listActiveMemberIds(groupId: string) {
  return activeMemberIds(db, groupId);
}

/** Groups the user is an active member of (ids only). */
export async function listActiveGroupIdsOf(userId: string): Promise<string[]> {
  const rows = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(and(eq(groupMembers.userId, userId), eq(groupMembers.status, "ACTIVE")));
  return rows.map((row) => row.groupId);
}
