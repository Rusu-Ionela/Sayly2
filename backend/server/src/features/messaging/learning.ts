import { createHash, randomUUID } from "crypto";
import { readFile } from "fs/promises";
import path from "path";

import { and, desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { env } from "../../config/env";
import { db } from "../../db/client";
import { messageCorrections, savedPhrases } from "../../db/schema";
import { acquireLock, releaseLock, withConcurrency } from "../../infra/limiter/limiter";
import { translationLockKey } from "../../infra/redis/keys";
import { AppError } from "../../shared/errors/AppError";
import { normalizeLanguageCode } from "../languages/catalog";
import { getMyLanguages } from "../languages/service";
import { UPLOADS_DIR } from "../media/storage";
import { translateText, translationProvider } from "../translation/provider";
import { resolveSourceLanguage } from "../translation/sourceLanguage";
import { getTranslateToSetting } from "../users/settings";

import { toCorrectionDto } from "./corrections";
import { EXPRESSION_LANGUAGES, findExpression, listExpressions } from "./expressions";
import * as messagingRepository from "./repository";
import type { ChatMessage } from "./types";

/** Recorded with each cached translation (which provider produced it). */
export const TRANSLATION_PROVIDER_VERSION = translationProvider.version;
const TRANSLATION_LOCK_TTL_MS = 15_000;
const TRANSLATION_WAIT_MS = 12_000;
const AI_INFLIGHT_TTL_MS = 30_000;

const transcriptionResponseSchema = z.object({
  text: z.string().min(1),
});

function sourceHashFor(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function textToTranslate(message: {
  type: string;
  content: string;
  transcript?: string | null;
  caption?: string | null;
}) {
  if (message.type === "VOICE" || message.type === "VIDEO") {
    return message.transcript?.trim() || "";
  }
  if (message.type === "IMAGE") {
    return message.caption?.trim() || "";
  }
  // System notices carry a code, not text a person wrote.
  if (message.type === "SYSTEM") return "";
  return message.content;
}

/** "Translate to" setting, falling back to your native (or first spoken) language. */
export async function translationTargetCode(userId: string) {
  const translateTo = await getTranslateToSetting(userId);
  if (translateTo) {
    return translateTo;
  }
  const grouped = await getMyLanguages(userId);
  const native =
    grouped.SPEAKS.find((item) => item.proficiency === "NATIVE") ?? grouped.SPEAKS[0];
  return native?.code ?? "en";
}

async function waitForCachedTranslation(input: {
  messageId: string;
  targetLang: string;
  sourceHash: string;
}) {
  const deadline = Date.now() + TRANSLATION_WAIT_MS;
  while (Date.now() < deadline) {
    const cached = await messagingRepository.findTranslation(input);
    if (cached) {
      return cached;
    }
    await sleep(200);
  }
  return null;
}

export async function translateMessage(
  userId: string,
  conversationId: string,
  messageId: string,
  targetLang?: string,
  sourceLang?: string,
): Promise<ChatMessage> {
  const message = await messagingRepository.getAccessibleMessage(userId, conversationId, messageId);
  const requested = targetLang ?? (await translationTargetCode(userId));
  const target = normalizeLanguageCode(requested);
  if (!target) {
    throw new AppError("Unsupported target language", 400, "VALIDATION_ERROR");
  }
  const requestedSource = sourceLang === undefined ? undefined : normalizeLanguageCode(sourceLang);
  if (requestedSource === null) {
    throw new AppError("Unsupported source language", 400, "VALIDATION_ERROR");
  }
  if (requestedSource === target) {
    throw new AppError("Source and target language are the same", 400, "VALIDATION_ERROR");
  }

  const sourceText = textToTranslate(message);
  if (!sourceText) {
    throw new AppError(
      message.type === "VOICE" || message.type === "VIDEO"
        ? "Transcribe the voice or video message before translating"
        : message.type === "IMAGE"
          ? "Add a caption before translating a photo"
          : "This message has no text to translate",
      400,
      "VALIDATION_ERROR",
    );
  }

  const sourceHash = sourceHashFor(sourceText);
  // Only translations made by the current provider version count: earlier ones guessed the
  // source language and could be wrong ("salut" → "health").
  const cacheKey = {
    messageId: message.id,
    targetLang: target,
    sourceHash,
    providerVersion: TRANSLATION_PROVIDER_VERSION,
  };
  const existing = await messagingRepository.findTranslation(cacheKey);
  if (existing) {
    return messagingRepository.toTranslatedMessageDto(message, { text: existing.text, lang: existing.targetLang });
  }

  const lockKey = translationLockKey(message.id, target, sourceHash);
  const lockOwner = randomUUID();
  const gotLock = await acquireLock(lockKey, lockOwner, TRANSLATION_LOCK_TTL_MS);
  if (!gotLock) {
    const waited = await waitForCachedTranslation(cacheKey);
    if (waited) {
      return messagingRepository.toTranslatedMessageDto(message, { text: waited.text, lang: waited.targetLang });
    }
    throw new AppError("Could not translate this message right now", 503, "SERVICE_UNAVAILABLE");
  }

  try {
    const winner = await messagingRepository.findTranslation(cacheKey);
    if (winner) {
      return messagingRepository.toTranslatedMessageDto(message, { text: winner.text, lang: winner.targetLang });
    }

    const source = requestedSource ?? (await resolveSourceLanguage(sourceText, message.senderId, target));
    const translated = await withConcurrency(
      "ai_user",
      userId,
      env.aiUserConcurrency,
      AI_INFLIGHT_TTL_MS,
      () =>
        withConcurrency("ai_global", "all", env.aiGlobalConcurrency, AI_INFLIGHT_TTL_MS, () =>
          translateText(sourceText, source, target),
        ),
    );

    const latest = await messagingRepository.getAccessibleMessage(userId, conversationId, messageId);
    const latestSource = textToTranslate(latest);
    if (sourceHashFor(latestSource) !== sourceHash) {
      throw new AppError("Message source changed before translation finished", 409, "CONFLICT");
    }

    const saved = await messagingRepository.saveMessageTranslation({
      messageId: latest.id,
      targetLang: target,
      sourceHash,
      providerVersion: TRANSLATION_PROVIDER_VERSION,
      text: translated,
    });

    return messagingRepository.toTranslatedMessageDto(latest, { text: saved.text, lang: saved.targetLang });
  } finally {
    await releaseLock(lockKey, lockOwner);
  }
}

/**
 * Adds translations already made (in the viewer's target language, for the message's current
 * text) to a page of messages, so a chat reopened later still shows them. Read-only: never
 * calls the provider.
 */
export async function withCachedTranslations(userId: string, items: ChatMessage[]): Promise<ChatMessage[]> {
  const pending = items.filter((item) => !item.translatedContent && textToTranslate(item));
  if (pending.length === 0) return items;

  const target = normalizeLanguageCode(await translationTargetCode(userId));
  if (!target) return items;

  const rows = await messagingRepository.findTranslationsFor(
    pending.map((item) => item.id),
    target,
    TRANSLATION_PROVIDER_VERSION,
  );
  if (rows.length === 0) return items;

  const byKey = new Map(rows.map((row) => [`${row.messageId}:${row.sourceHash}`, row]));
  return items.map((item) => {
    if (item.translatedContent) return item;
    const source = textToTranslate(item);
    const hit = source ? byKey.get(`${item.id}:${sourceHashFor(source)}`) : undefined;
    return hit ? { ...item, translatedContent: hit.text, translatedLang: hit.targetLang } : item;
  });
}

/**
 * Translates profile text (bio, topics) into the viewer's native language.
 * Not cached, so each tap calls the provider again; add a cache table if profile translation traffic grows.
 */
export async function translateProfileText(
  userId: string,
  authorId: string,
  sourceText: string,
  targetLang?: string,
) {
  const target = normalizeLanguageCode(targetLang ?? (await translationTargetCode(userId)));
  if (!target) {
    throw new AppError("Unsupported target language", 400, "VALIDATION_ERROR");
  }
  const source = await resolveSourceLanguage(sourceText, authorId, target);

  const text = await withConcurrency("ai_user", userId, env.aiUserConcurrency, AI_INFLIGHT_TTL_MS, () =>
    withConcurrency("ai_global", "all", env.aiGlobalConcurrency, AI_INFLIGHT_TTL_MS, () =>
      translateText(sourceText, source, target),
    ),
  );
  return { text, lang: target };
}

function localUploadPath(fileUrl: string) {
  const marker = "/media/files/";
  const index = fileUrl.indexOf(marker);
  if (index === -1) return null;
  const name = fileUrl.slice(index + marker.length).split("?")[0] ?? "";
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return null;
  }
  return path.join(UPLOADS_DIR, name);
}

export async function transcribeMessage(userId: string, conversationId: string, messageId: string) {
  const message = await messagingRepository.getAccessibleMessage(userId, conversationId, messageId);
  if (message.type !== "VOICE" && message.type !== "VIDEO") {
    throw new AppError("Only voice or video messages can be transcribed", 400, "VALIDATION_ERROR");
  }

  if (message.transcript) {
    return messagingRepository.toMessageDto(message);
  }

  if (!env.openaiApiKey) {
    throw new AppError(
      "Voice transcription is not configured on this server (OPENAI_API_KEY)",
      501,
      "NOT_IMPLEMENTED",
    );
  }

  const filePath = localUploadPath(message.content);
  if (!filePath) {
    throw new AppError("Could not find the audio file to transcribe", 400, "VALIDATION_ERROR");
  }

  const bytes = await readFile(filePath);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)]), path.basename(filePath));
  form.append("model", "whisper-1");

  const payload = await withConcurrency(
    "ai_user",
    userId,
    env.aiUserConcurrency,
    AI_INFLIGHT_TTL_MS,
    () =>
      withConcurrency("ai_global", "all", env.aiGlobalConcurrency, AI_INFLIGHT_TTL_MS, async () => {
        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.openaiApiKey}` },
          body: form,
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) {
          throw new AppError("Transcription failed", 502, "INTERNAL_ERROR");
        }
        return response.json() as Promise<unknown>;
      }),
  );

  const parsed = transcriptionResponseSchema.safeParse(payload);
  const transcript = parsed.success ? parsed.data.text.trim() : "";
  if (!transcript) {
    throw new AppError("Transcription returned empty text", 502, "INTERNAL_ERROR");
  }

  return messagingRepository.saveTranscript(message.id, transcript);
}

export async function correctMessage(
  userId: string,
  conversationId: string,
  messageId: string,
  correctedText: string,
  note?: string,
) {
  const message = await messagingRepository.getAccessibleMessage(userId, conversationId, messageId);
  if (message.senderId === userId) {
    throw new AppError("You can only correct a partner's message", 400, "VALIDATION_ERROR");
  }
  if (message.type === "SYSTEM") {
    throw new AppError("This message cannot be corrected", 400, "VALIDATION_ERROR");
  }
  const text = correctedText.trim();
  if (!text || text.length > 2000) {
    throw new AppError("Correction text is required", 400, "VALIDATION_ERROR");
  }

  const [row] = await db
    .insert(messageCorrections)
    .values({
      messageId,
      authorId: userId,
      correctedText: text,
      note: note?.trim() || null,
    })
    .returning();

  // The message author is who must hear about it (in real time and by push).
  return { correction: toCorrectionDto(row!), messageSenderId: message.senderId };
}

export async function listMessageCorrections(
  userId: string,
  conversationId: string,
  messageId: string,
) {
  await messagingRepository.getAccessibleMessage(userId, conversationId, messageId);
  const rows = await db
    .select()
    .from(messageCorrections)
    .where(eq(messageCorrections.messageId, messageId))
    .orderBy(desc(messageCorrections.createdAt))
    .limit(20);
  return { items: rows.map(toCorrectionDto) };
}

type SavedPhraseRow = typeof savedPhrases.$inferSelect;

function toSavedPhraseDto(row: SavedPhraseRow) {
  return {
    id: row.id,
    sourceText: row.sourceText,
    correctedText: row.correctedText,
    note: row.note,
    example: row.example,
    expressionId: row.expressionId,
    messageId: row.messageId,
    languageCode: row.languageCode,
    createdAt: row.createdAt.toISOString(),
  };
}

export type SavePhraseInput =
  | {
      sourceText: string;
      correctedText?: string;
      note?: string;
      messageId?: string;
      languageCode?: string;
    }
  | { expressionId: string };

/** Catalog expressions are copied from the server catalog — clients only send the id. */
function phraseValues(userId: string, input: SavePhraseInput) {
  if ("expressionId" in input) {
    const expression = findExpression(input.expressionId);
    if (!expression) {
      throw new AppError("Expression not found", 404, "NOT_FOUND");
    }
    return {
      userId,
      sourceText: expression.phrase,
      note: expression.meaning,
      example: expression.example,
      languageCode: expression.languageCode,
      expressionId: expression.id,
    };
  }
  const sourceText = input.sourceText.trim();
  if (!sourceText || sourceText.length > 2000) {
    throw new AppError("Phrase text is required", 400, "VALIDATION_ERROR");
  }
  return {
    userId,
    sourceText,
    correctedText: input.correctedText?.trim() || null,
    note: input.note?.trim() || null,
    messageId: input.messageId || null,
    languageCode: input.languageCode || null,
  };
}

/** Saving a catalog expression twice returns the existing entry. */
export async function savePhrase(userId: string, input: SavePhraseInput) {
  const values = phraseValues(userId, input);
  const [row] = await db.insert(savedPhrases).values(values).onConflictDoNothing().returning();
  if (row) {
    return toSavedPhraseDto(row);
  }
  const [existing] = await db
    .select()
    .from(savedPhrases)
    .where(
      and(eq(savedPhrases.userId, userId), eq(savedPhrases.expressionId, values.expressionId ?? "")),
    )
    .limit(1);
  if (!existing) {
    throw new AppError("Could not save this phrase", 409, "CONFLICT");
  }
  return toSavedPhraseDto(existing);
}

export async function listSavedPhrases(userId: string) {
  const rows = await db
    .select()
    .from(savedPhrases)
    .where(eq(savedPhrases.userId, userId))
    .orderBy(desc(savedPhrases.createdAt))
    .limit(200);
  return { items: rows.map(toSavedPhraseDto) };
}

/**
 * GET /learning/expressions — curated idioms in `languageCode`, or in every language
 * you are learning; `savedPhraseId` is set for the ones already in your Collection.
 */
export async function listExpressionsFor(userId: string, languageCode?: string) {
  const codes = languageCode
    ? [languageCode]
    : (await getMyLanguages(userId)).LEARNING.map((item) => item.code);
  const expressions = listExpressions(codes);
  const saved = await db
    .select({ id: savedPhrases.id, expressionId: savedPhrases.expressionId })
    .from(savedPhrases)
    .where(and(eq(savedPhrases.userId, userId), isNotNull(savedPhrases.expressionId)));
  const savedIds = new Map(saved.map((row) => [row.expressionId, row.id]));

  return {
    languages: EXPRESSION_LANGUAGES,
    items: expressions.map((item) => ({ ...item, savedPhraseId: savedIds.get(item.id) ?? null })),
  };
}

export async function deleteSavedPhrase(userId: string, phraseId: string) {
  const deleted = await db
    .delete(savedPhrases)
    .where(and(eq(savedPhrases.userId, userId), eq(savedPhrases.id, phraseId)))
    .returning({ id: savedPhrases.id });
  if (deleted.length === 0) {
    throw new AppError("Phrase not found", 404, "NOT_FOUND");
  }
}


