import { and, desc, eq, inArray, or } from "drizzle-orm";

import { db } from "../../db/client";
import { isUniqueViolation } from "../../db/errors";
import { lockUser, requireRow } from "../../db/helpers";
import {
  blocks,
  connections,
  follows,
  groupMembers,
  groups,
  conversationParticipants,
  messages,
  profiles,
  reports,
  users,
} from "../../db/schema";
import { AppError } from "../../shared/errors/AppError";
import { visibleCountry } from "../users/settings";

import type { BlockDto, ReportDto, ReportReviewStatus, ReportsPage } from "./types";

export async function assertUsersExist(userIds: string[]) {
  if (userIds.length === 0) {
    return;
  }

  const found = await db
    .select({ id: users.id, status: users.status })
    .from(users)
    .where(inArray(users.id, userIds));

  if (found.length !== userIds.length) {
    throw new AppError("User not found", 404);
  }
}

export async function isBlockedEitherWay(userA: string, userB: string) {
  const [block] = await db
    .select({ id: blocks.id })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, userA), eq(blocks.blockedId, userB)),
        and(eq(blocks.blockerId, userB), eq(blocks.blockedId, userA)),
      ),
    )
    .limit(1);

  return Boolean(block);
}

export async function assertNotBlocked(userA: string, userB: string) {
  if (await isBlockedEitherWay(userA, userB)) {
    throw new AppError("Messaging is unavailable with this user", 403);
  }
}

export async function createBlock(blockerId: string, blockedId: string): Promise<BlockDto> {
  if (blockerId === blockedId) {
    throw new AppError("Cannot block yourself", 400, "VALIDATION_ERROR");
  }

  await assertUsersExist([blockedId]);

  const block = await db.transaction(async (tx) => {
    const [firstId, secondId] = blockerId < blockedId ? [blockerId, blockedId] : [blockedId, blockerId];
    await lockUser(tx, firstId);
    await lockUser(tx, secondId);

    let row;
    try {
      const [created] = await tx.insert(blocks).values({ blockerId, blockedId }).returning();
      row = created;
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }

    if (!row) {
      const [existing] = await tx
        .select()
        .from(blocks)
        .where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)))
        .limit(1);
      row = existing;
    }

    await tx
      .delete(follows)
      .where(
        or(
          and(eq(follows.followerId, blockerId), eq(follows.followeeId, blockedId)),
          and(eq(follows.followerId, blockedId), eq(follows.followeeId, blockerId)),
        ),
      );

    await tx.delete(connections).where(
      or(
        and(eq(connections.requesterId, blockerId), eq(connections.recipientId, blockedId)),
        and(eq(connections.requesterId, blockedId), eq(connections.recipientId, blockerId)),
      ),
    );

    return requireRow(row, "block");
  });

  return {
    id: block.id,
    blockerId: block.blockerId,
    blockedId: block.blockedId,
    createdAt: block.createdAt.toISOString(),
  };
}

export async function listBlocks(blockerId: string) {
  const rows = await db
    .select({
      id: blocks.id,
      blockerId: blocks.blockerId,
      blockedId: blocks.blockedId,
      createdAt: blocks.createdAt,
      displayName: profiles.displayName,
      avatarUrl: profiles.profileImageUrl,
      country: visibleCountry,
    })
    .from(blocks)
    .leftJoin(profiles, eq(profiles.userId, blocks.blockedId))
    .where(eq(blocks.blockerId, blockerId))
    .orderBy(desc(blocks.createdAt))
    .limit(200);

  return {
    items: rows.map((row) => ({
      id: row.id,
      blockerId: row.blockerId,
      blockedId: row.blockedId,
      createdAt: row.createdAt.toISOString(),
      user: {
        id: row.blockedId,
        displayName: row.displayName ?? "User",
        avatarUrl: row.avatarUrl,
        country: row.country ?? "",
      },
    })),
  };
}

export async function deleteBlock(blockerId: string, blockedId: string) {
  if (!blockedId.trim()) {
    throw new AppError("User id is required", 400, "VALIDATION_ERROR");
  }
  const deleted = await db
    .delete(blocks)
    .where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)))
    .returning({ id: blocks.id });
  if (deleted.length === 0) {
    throw new AppError("Block not found", 404, "NOT_FOUND");
  }
}

export async function createReport(input: {
  reporterId: string;
  reportedId: string;
  reason: string;
  messageId?: string;
  details?: string;
}): Promise<ReportDto> {
  if (input.reporterId === input.reportedId) {
    throw new AppError("Cannot report yourself", 400);
  }

  await assertUsersExist([input.reportedId]);

  if (input.messageId) {
    const [message] = await db
      .select({ id: messages.id })
      .from(messages)
      .innerJoin(
        conversationParticipants,
        and(
          eq(conversationParticipants.conversationId, messages.conversationId),
          eq(conversationParticipants.userId, input.reporterId),
        ),
      )
      .where(and(eq(messages.id, input.messageId), eq(messages.senderId, input.reportedId)))
      .limit(1);

    // Group chats have no participant rows, so fall back to active group membership.
    const [groupMessage] = message
      ? []
      : await db
          .select({ id: messages.id })
          .from(messages)
          .innerJoin(groups, eq(groups.conversationId, messages.conversationId))
          .innerJoin(
            groupMembers,
            and(
              eq(groupMembers.groupId, groups.id),
              eq(groupMembers.userId, input.reporterId),
              eq(groupMembers.status, "ACTIVE"),
            ),
          )
          .where(and(eq(messages.id, input.messageId), eq(messages.senderId, input.reportedId)))
          .limit(1);

    if (!message && !groupMessage) {
      throw new AppError("Message not found", 404, "NOT_FOUND");
    }
  }

  const [report] = await db
    .insert(reports)
    .values({
      reporterId: input.reporterId,
      reportedId: input.reportedId,
      reason: input.reason,
      messageId: input.messageId,
      details: input.details,
    })
    .returning();

  const created = requireRow(report, "report");

  return toReportDto(created);
}

function toReportDto(report: typeof reports.$inferSelect): ReportDto {
  return {
    id: report.id,
    reporterId: report.reporterId,
    reportedId: report.reportedId,
    messageId: report.messageId,
    reason: report.reason,
    details: report.details,
    status: report.status,
    reviewerId: report.reviewerId,
    reviewedAt: report.reviewedAt?.toISOString() ?? null,
    reviewNote: report.reviewNote,
    createdAt: report.createdAt.toISOString(),
  };
}

/** Admin-only callers receive reports newest first, bounded to avoid an unpaginated moderation queue. */
export async function listReports(input: { status?: ReportDto["status"]; limit: number }): Promise<ReportsPage> {
  const query = db.select().from(reports).orderBy(desc(reports.createdAt)).limit(input.limit);
  const rows = input.status ? await query.where(eq(reports.status, input.status)) : await query;
  return { items: rows.map(toReportDto) };
}

export async function reviewReport(
  adminId: string,
  reportId: string,
  input: { status: ReportReviewStatus; reviewNote?: string },
): Promise<ReportDto> {
  const [updated] = await db
    .update(reports)
    .set({
      status: input.status,
      reviewerId: adminId,
      reviewedAt: new Date(),
      reviewNote: input.reviewNote?.trim() || null,
    })
    .where(eq(reports.id, reportId))
    .returning();

  if (!updated) {
    throw new AppError("Report not found", 404, "NOT_FOUND");
  }
  return toReportDto(updated);
}
