import { and, desc, eq } from "drizzle-orm";

import { db } from "../../db/client";
import { supportTickets, users, type SupportTicket } from "../../db/schema";
import { AppError } from "../../shared/errors/AppError";

import type { CreateSupportTicketInput, SupportTicketDto } from "./types";

function toSupportTicketDto(row: SupportTicket): SupportTicketDto {
  return {
    id: row.id,
    kind: row.kind,
    topic: row.topic,
    subject: row.subject,
    status: row.status,
    contactEmail: row.contactEmail,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Email of an active member — support replies there. */
export async function getActiveMemberEmail(userId: string): Promise<string> {
  const [row] = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.status, "ACTIVE")))
    .limit(1);
  if (!row) {
    throw new AppError("Account not found", 404, "NOT_FOUND");
  }
  return row.email;
}

export async function insertTicket(
  userId: string,
  contactEmail: string,
  input: CreateSupportTicketInput,
): Promise<SupportTicketDto> {
  const [row] = await db
    .insert(supportTickets)
    .values({
      userId,
      contactEmail,
      kind: input.kind,
      topic: input.topic ?? null,
      subject: input.subject,
      message: input.message,
      appVersion: input.device?.appVersion ?? null,
      platform: input.device?.platform ?? null,
      osVersion: input.device?.osVersion ?? null,
      deviceModel: input.device?.deviceModel ?? null,
    })
    .returning();
  if (!row) {
    throw new AppError("Could not save your message", 500);
  }
  return toSupportTicketDto(row);
}

export async function listTickets(userId: string, limit = 50): Promise<SupportTicketDto[]> {
  const rows = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, userId))
    .orderBy(desc(supportTickets.createdAt))
    .limit(limit);
  return rows.map(toSupportTicketDto);
}
