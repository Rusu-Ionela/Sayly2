import { and, desc, eq, or } from "drizzle-orm";

import { db } from "../../db/client";
import { connections } from "../../db/schema";
import { lockUser, requireRow } from "../../db/helpers";
import { AppError } from "../../shared/errors/AppError";
import { isBlockedEitherWay } from "../safety/repository";
import { assertVisibleMember, loadMemberSummaries } from "../users/memberSummary";

import type { ConnectionDto, ConnectionsPage } from "./types";

type ConnectionRow = typeof connections.$inferSelect;
type ConnectionRequestResult = { connection: ConnectionRow; created: boolean; accepted: boolean };
type ConnectionResponseResult = { connection: ConnectionRow; changed: boolean };
type ConnectionAction = "ACCEPT" | "DECLINE" | "CANCEL" | "REMOVE";

function between(userId: string, otherUserId: string) {
  return or(
    and(eq(connections.requesterId, userId), eq(connections.recipientId, otherUserId)),
    and(eq(connections.requesterId, otherUserId), eq(connections.recipientId, userId)),
  );
}

function toDto(row: ConnectionRow, viewerId: string, member: ConnectionDto["member"]): ConnectionDto {
  return {
    id: row.id,
    status: row.status,
    direction: row.recipientId === viewerId ? "INCOMING" : "OUTGOING",
    introMessage: row.introMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    member,
  };
}

export async function findConnectionBetween(userId: string, otherUserId: string) {
  const [row] = await db.select().from(connections).where(between(userId, otherUserId)).limit(1);
  return row ?? null;
}

export async function isConnectionAccepted(userId: string, otherUserId: string) {
  const [row] = await db
    .select({ id: connections.id })
    .from(connections)
    .where(and(between(userId, otherUserId), eq(connections.status, "ACCEPTED")))
    .limit(1);
  return Boolean(row);
}

/** Creates a request, or accepts a crossed request because both members have opted in. */
export async function requestConnection(
  requesterId: string,
  recipientId: string,
  introMessage?: string,
): Promise<ConnectionRequestResult> {
  await assertVisibleMember(requesterId, recipientId);

  return db.transaction(async (tx) => {
    const [firstId, secondId] = requesterId < recipientId ? [requesterId, recipientId] : [recipientId, requesterId];
    await lockUser(tx, firstId);
    await lockUser(tx, secondId);

    if (await isBlockedEitherWay(requesterId, recipientId)) {
      throw new AppError("User not found", 404, "NOT_FOUND");
    }

    const [existing] = await tx.select().from(connections).where(between(requesterId, recipientId)).limit(1);
    if (existing?.status === "ACCEPTED") {
      return { connection: existing, created: false, accepted: false };
    }
    if (existing?.status === "PENDING" && existing.requesterId === requesterId) {
      return { connection: existing, created: false, accepted: false };
    }
    if (existing?.status === "PENDING") {
      const [accepted] = await tx
        .update(connections)
        .set({ status: "ACCEPTED", updatedAt: new Date() })
        .where(eq(connections.id, existing.id))
        .returning();
      return { connection: requireRow(accepted, "connection"), created: false, accepted: true };
    }
    if (existing) {
      const [renewed] = await tx
        .update(connections)
        .set({
          requesterId,
          recipientId,
          status: "PENDING",
          introMessage: introMessage?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(connections.id, existing.id))
        .returning();
      return { connection: requireRow(renewed, "connection"), created: true, accepted: false };
    }

    const [created] = await tx
      .insert(connections)
      .values({ requesterId, recipientId, introMessage: introMessage?.trim() || null })
      .returning();
    return { connection: requireRow(created, "connection"), created: true, accepted: false };
  });
}

export async function respondToConnection(
  viewerId: string,
  connectionId: string,
  action: ConnectionAction,
): Promise<ConnectionResponseResult> {
  const [existing] = await db.select().from(connections).where(eq(connections.id, connectionId)).limit(1);
  if (!existing || (existing.requesterId !== viewerId && existing.recipientId !== viewerId)) {
    throw new AppError("Connection request not found", 404, "NOT_FOUND");
  }

  const expectedActor = action === "CANCEL" ? existing.requesterId : action === "REMOVE" ? viewerId : existing.recipientId;
  if (expectedActor !== viewerId) {
    throw new AppError("You cannot update this connection request", 403, "FORBIDDEN");
  }

  const nextStatus = action === "ACCEPT" ? "ACCEPTED" : action === "DECLINE" ? "DECLINED" : "CANCELLED";
  const requiredStatus = action === "REMOVE" ? "ACCEPTED" : "PENDING";
  if (existing.status === nextStatus) {
    return { connection: existing, changed: false };
  }
  if (existing.status !== requiredStatus) {
    throw new AppError(
      action === "REMOVE" ? "This connection is no longer active" : "This connection request is no longer pending",
      409,
      "CONFLICT",
    );
  }

  const [updated] = await db
    .update(connections)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(and(eq(connections.id, connectionId), eq(connections.status, requiredStatus)))
    .returning();
  if (updated) {
    return { connection: updated, changed: true };
  }

  // A simultaneous accept/cancel/decline may have won after the initial read. Never let the
  // later writer overwrite that state; an idempotent repeat of the same action is still safe.
  const [current] = await db.select().from(connections).where(eq(connections.id, connectionId)).limit(1);
  if (current?.status === nextStatus) {
    return { connection: current, changed: false };
  }
  throw new AppError(
    action === "REMOVE" ? "This connection is no longer active" : "This connection request is no longer pending",
    409,
    "CONFLICT",
  );
}

export async function getConnection(viewerId: string, otherUserId: string): Promise<ConnectionDto | null> {
  await assertVisibleMember(viewerId, otherUserId);
  const row = await findConnectionBetween(viewerId, otherUserId);
  if (!row) return null;
  const member = (await loadMemberSummaries([otherUserId])).get(otherUserId);
  return member ? toDto(row, viewerId, member) : null;
}

export async function listConnections(viewerId: string): Promise<ConnectionsPage> {
  const rows = await db
    .select()
    .from(connections)
    .where(
      and(
        or(eq(connections.requesterId, viewerId), eq(connections.recipientId, viewerId)),
        or(eq(connections.status, "PENDING"), eq(connections.status, "ACCEPTED")),
      ),
    )
    .orderBy(desc(connections.updatedAt))
    .limit(200);
  const members = await loadMemberSummaries(
    rows.map((row) => (row.requesterId === viewerId ? row.recipientId : row.requesterId)),
  );
  const page: ConnectionsPage = { incoming: [], outgoing: [], accepted: [] };
  for (const row of rows) {
    const otherUserId = row.requesterId === viewerId ? row.recipientId : row.requesterId;
    const member = members.get(otherUserId);
    if (!member) continue;
    const dto = toDto(row, viewerId, member);
    if (row.status === "ACCEPTED") page.accepted.push(dto);
    else if (dto.direction === "INCOMING") page.incoming.push(dto);
    else page.outgoing.push(dto);
  }
  return page;
}
