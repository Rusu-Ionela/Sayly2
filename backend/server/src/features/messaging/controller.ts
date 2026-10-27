import type { Request, Response } from "express";
import { autoTranslateSchema, translateMessageSchema } from "@sayly/shared";
import { z } from "zod";

import { AppError } from "../../shared/errors/AppError";
import { requireUserId } from "../../shared/middleware/requireUserId";

import { notifyCorrection, notifyNewMessage } from "../notifications";
import { emitMessageCorrected, emitMessageStatus, emitNewMessage } from "./gateway";
import {
  listConversationsQuerySchema,
  listMessagesQuerySchema,
  openDirectConversationSchema,
  sendMessageSchema,
} from "./schema";
import * as messagingService from "./service";
import { promoteDelivered } from "./socket";

function requireParam(value: string | string[] | undefined, name: string) {
  if (typeof value !== "string" || !value) {
    throw new AppError(`Missing ${name}`, 400, "VALIDATION_ERROR");
  }
  return value;
}

export async function listConversations(req: Request, res: Response) {
  const query = listConversationsQuerySchema.parse(req.query);
  res.json(await messagingService.listConversations(requireUserId(req), query));
}

export async function openDirectConversation(req: Request, res: Response) {
  const { userId } = openDirectConversationSchema.parse(req.body);
  const result = await messagingService.getOrCreateDirectConversation(requireUserId(req), userId);
  res.status(result.created ? 201 : 200).json({ conversationId: result.conversationId });
}

export async function listMessages(req: Request, res: Response) {
  const query = listMessagesQuerySchema.parse(req.query);
  const conversationId = requireParam(req.params.id ?? req.params.conversationId, "id");
  res.json(await messagingService.listMessages(requireUserId(req), conversationId, query));
}

export async function sendMessage(req: Request, res: Response) {
  const body = sendMessageSchema.parse(req.body);
  const conversationId = requireParam(req.params.conversationId ?? req.params.id, "id");
  const userId = requireUserId(req);
  const result = await messagingService.sendMessage(userId, {
    conversationId,
    content: body.content,
    type: body.type,
    durationMs: body.durationMs,
    mimeType: body.mimeType,
    thumbnailUrl: body.thumbnailUrl,
    caption: body.caption,
    clientMessageId: body.clientMessageId,
  });

  if (result.created) {
    emitNewMessage(result.message, result.recipientId);
    notifyNewMessage(result.message, result.recipientId);
    void promoteDelivered(userId, result.recipientId, conversationId, result.message.id);
  }
  res.status(result.created ? 201 : 200).json(result.message);
}

export async function markConversationRead(req: Request, res: Response) {
  const conversationId = requireParam(req.params.id ?? req.params.conversationId, "id");
  const result = await messagingService.markMessagesRead(requireUserId(req), conversationId);

  if (result.messages.length > 0) {
    emitMessageStatus({ conversationId, messages: result.messages }, result.senderIds);
  }

  res.json({ conversationId, messages: result.messages, readCount: result.messages.length });
}

/** PUT/DELETE /conversations/:id/pin — pin to or unpin from the top of my chat list. */
export function setPinned(pinned: boolean) {
  return async (req: Request, res: Response) => {
    const conversationId = requireParam(req.params.id, "id");
    res.json(
      await messagingService.setConversationPinned(requireUserId(req), conversationId, pinned),
    );
  };
}

/** PUT /conversations/:id/auto-translate { enabled } */
export async function setAutoTranslate(req: Request, res: Response) {
  const conversationId = requireParam(req.params.id, "id");
  const { enabled } = autoTranslateSchema.parse(req.body);
  res.json(await messagingService.setConversationAutoTranslate(requireUserId(req), conversationId, enabled));
}

export async function translateMessage(req: Request, res: Response) {
  const conversationId = requireParam(req.params.id ?? req.params.conversationId, "id");
  const messageId = requireParam(req.params.messageId, "messageId");
  const body = translateMessageSchema.parse(req.body ?? {});
  res.json(
    await messagingService.translateMessage(
      requireUserId(req),
      conversationId,
      messageId,
      body.targetLang,
      body.sourceLang,
    ),
  );
}

export async function transcribeMessage(req: Request, res: Response) {
  const conversationId = requireParam(req.params.id ?? req.params.conversationId, "id");
  const messageId = requireParam(req.params.messageId, "messageId");
  res.json(await messagingService.transcribeMessage(requireUserId(req), conversationId, messageId));
}

export async function correctMessage(req: Request, res: Response) {
  const conversationId = requireParam(req.params.id ?? req.params.conversationId, "id");
  const messageId = requireParam(req.params.messageId, "messageId");
  const body = z
    .object({
      correctedText: z.string().trim().min(1).max(2000),
      note: z.string().trim().max(500).optional(),
    })
    .parse(req.body ?? {});
  const userId = requireUserId(req);
  const { correction, messageSenderId } = await messagingService.correctMessage(
    userId,
    conversationId,
    messageId,
    body.correctedText,
    body.note,
  );
  emitMessageCorrected({ conversationId, messageId, correction }, [messageSenderId, userId]);
  notifyCorrection(correction, messageSenderId, conversationId);
  res.status(201).json(correction);
}

export async function listMessageCorrections(req: Request, res: Response) {
  const conversationId = requireParam(req.params.id ?? req.params.conversationId, "id");
  const messageId = requireParam(req.params.messageId, "messageId");
  res.json(
    await messagingService.listMessageCorrections(requireUserId(req), conversationId, messageId),
  );
}

export async function listSavedPhrases(req: Request, res: Response) {
  res.json(await messagingService.listSavedPhrases(requireUserId(req)));
}

const chatPhraseSchema = z.object({
  sourceText: z.string().trim().min(1).max(2000),
  correctedText: z.string().trim().max(2000).optional(),
  note: z.string().trim().max(500).optional(),
  messageId: z.string().trim().min(1).optional(),
  languageCode: z.string().trim().max(16).optional(),
});
const catalogPhraseSchema = z.object({ expressionId: z.string().trim().min(1).max(128) }).strict();

/** POST /learning/phrases — a phrase from chat, or `{ expressionId }` from the catalog. */
export async function savePhrase(req: Request, res: Response) {
  const body = z.union([catalogPhraseSchema, chatPhraseSchema]).parse(req.body ?? {});
  res.status(201).json(await messagingService.savePhrase(requireUserId(req), body));
}

/** GET /learning/expressions?language=xx — curated idioms (defaults to your learning languages). */
export async function listExpressions(req: Request, res: Response) {
  const { language } = z
    .object({ language: z.string().trim().regex(/^[a-z]{2,3}$/).optional() })
    .parse(req.query);
  res.json(await messagingService.listExpressionsFor(requireUserId(req), language));
}

export async function deleteSavedPhrase(req: Request, res: Response) {
  const phraseId = requireParam(req.params.phraseId, "phraseId");
  await messagingService.deleteSavedPhrase(requireUserId(req), phraseId);
  res.status(204).send();
}

