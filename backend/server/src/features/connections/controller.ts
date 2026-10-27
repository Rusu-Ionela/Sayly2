import type { Request, Response } from "express";
import { z } from "zod";

import { requireUserId } from "../../shared/middleware/requireUserId";
import { boundedIdSchema } from "../../shared/validation/text";
import { getOrCreateDirectConversation } from "../messaging/conversations.repository";
import { notifyConnectionAccepted, notifyConnectionRequest } from "../notifications/service";
import { loadMemberSummaries } from "../users/memberSummary";

import * as repository from "./repository";

const userIdParamSchema = z.object({ userId: boundedIdSchema });
const connectionIdParamSchema = z.object({ id: boundedIdSchema });
const requestSchema = z.object({ introMessage: z.string().trim().max(280).optional() }).strict();
const respondSchema = z.object({ action: z.enum(["ACCEPT", "DECLINE", "CANCEL", "REMOVE"]) }).strict();

export async function listConnections(req: Request, res: Response) {
  res.json(await repository.listConnections(requireUserId(req)));
}

export async function getConnection(req: Request, res: Response) {
  const { userId } = userIdParamSchema.parse(req.params);
  res.json(await repository.getConnection(requireUserId(req), userId));
}

export async function requestConnection(req: Request, res: Response) {
  const { userId } = userIdParamSchema.parse(req.params);
  const { introMessage } = requestSchema.parse(req.body ?? {});
  const viewerId = requireUserId(req);
  // The peer's card loads on its own connection while the transaction runs; it is only sent
  // once the transaction has passed the visibility gate.
  const [result, member] = await Promise.all([
    repository.requestConnection(viewerId, userId, introMessage),
    loadMemberSummaries([userId]),
  ]);
  if (result.created && result.connection.status === "PENDING") {
    notifyConnectionRequest(result.connection.requesterId, result.connection.recipientId);
  }
  if (result.accepted) {
    await getOrCreateDirectConversation(result.connection.requesterId, result.connection.recipientId);
    notifyConnectionAccepted(result.connection.requesterId, result.connection.recipientId);
  }
  // The read shape includes only the peer's public summary, never raw account fields.
  res.status(200).json(await repository.toViewerDto(result.connection, viewerId, member));
}

export async function respondToConnection(req: Request, res: Response) {
  const { id } = connectionIdParamSchema.parse(req.params);
  const { action } = respondSchema.parse(req.body ?? {});
  const viewerId = requireUserId(req);
  const result = await repository.respondToConnection(viewerId, id, action);
  const { connection } = result;
  const accepted = connection.status === "ACCEPTED";
  const [dto] = await Promise.all([
    repository.toViewerDto(connection, viewerId),
    // Acceptance is the single transition that makes chat eligible. Create it now so both
    // members see the same direct thread immediately; the repository is race-safe/idempotent.
    accepted ? getOrCreateDirectConversation(connection.requesterId, connection.recipientId) : undefined,
  ]);
  if (accepted && result.changed) notifyConnectionAccepted(connection.requesterId, connection.recipientId);
  res.json(dto);
}
