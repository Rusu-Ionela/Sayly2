import { randomInt } from "crypto";

import {
  FLASH_QUEST_CHALLENGES,
  FLASH_QUEST_CONNECT_WINDOW_MS,
  FLASH_QUEST_DURATION_MS,
  FLASH_QUEST_EVENTS,
  FLASH_QUEST_MAX_MESSAGES,
  FLASH_QUEST_SEARCH_TIMEOUT_MS,
  type FlashQuestDto,
  type FlashQuestStatus,
  type FlashQuestTopicDto,
} from "@sayly/shared";

import type { FlashQuest } from "../../db/schema";
import { AppError } from "../../shared/errors/AppError";
import { requestConnection } from "../connections/repository";
import { ICEBREAKER_PROMPTS } from "../icebreakers/catalog";
import { promptDay, toPromptDto } from "../icebreakers/prompt";
import { normalizeLanguageCode } from "../languages/catalog";
import { emitToUsers } from "../messaging/gateway";
import { recordActivityInBackground } from "../streaks";
import { loadMemberSummaries } from "../users/memberSummary";

import * as repository from "./repository";

/** Messages sent a moment after the timer still count (network lag). */
const MESSAGE_GRACE_MS = 5_000;

/** The status a member sees right now: ENDED and timed-out searches come from the clock. */
export function effectiveStatus(quest: FlashQuest, now: Date): FlashQuestStatus {
  if (quest.status === "CANCELLED") return "CANCELLED";
  if (quest.status === "SEARCHING") {
    return now.getTime() - quest.createdAt.getTime() > FLASH_QUEST_SEARCH_TIMEOUT_MS ? "CANCELLED" : "SEARCHING";
  }
  return quest.endsAt && now >= quest.endsAt ? "ENDED" : "ACTIVE";
}

function topicFor(quest: FlashQuest): FlashQuestTopicDto {
  const prompt = ICEBREAKER_PROMPTS.find((item) => item.id === quest.promptId) ?? ICEBREAKER_PROMPTS[0];
  const challenge = FLASH_QUEST_CHALLENGES.find((item) => item.id === quest.challengeId) ?? FLASH_QUEST_CHALLENGES[0];
  if (!prompt) throw new Error("Icebreaker catalog is empty");
  const dto = toPromptDto(prompt, quest.languageId, promptDay(quest.createdAt));
  return { text: dto.text, english: dto.english, challenge: challenge.text };
}

function roleOf(quest: FlashQuest, userId: string): "host" | "guest" {
  return quest.hostId === userId ? "host" : "guest";
}

function partnerOf(quest: FlashQuest, userId: string): string | null {
  return quest.hostId === userId ? quest.guestId : quest.hostId;
}

export async function toQuestDto(quest: FlashQuest, viewerId: string, now: Date = new Date()): Promise<FlashQuestDto> {
  const partnerId = partnerOf(quest, viewerId);
  const [languageName, summaries, messages] = await Promise.all([
    repository.languageName(quest.languageId),
    loadMemberSummaries(partnerId ? [partnerId] : []),
    quest.guestId ? repository.listMessages(quest.id) : Promise.resolve([]),
  ]);
  const partner = partnerId ? summaries.get(partnerId) : undefined;
  const isHost = roleOf(quest, viewerId) === "host";
  const iWant = isHost ? quest.hostWantsConnect : quest.guestWantsConnect;
  const theyWant = isHost ? quest.guestWantsConnect : quest.hostWantsConnect;

  return {
    id: quest.id,
    status: effectiveStatus(quest, now),
    languageId: quest.languageId,
    languageName,
    topic: topicFor(quest),
    partner: partner
      ? { id: partner.id, displayName: partner.displayName, avatarUrl: partner.avatarUrl, country: partner.country }
      : null,
    startedAt: quest.startedAt?.toISOString() ?? null,
    endsAt: quest.endsAt?.toISOString() ?? null,
    serverNow: now.toISOString(),
    searchExpiresAt: new Date(quest.createdAt.getTime() + FLASH_QUEST_SEARCH_TIMEOUT_MS).toISOString(),
    messages: messages.map((message) => ({
      id: message.id,
      senderId: message.senderId,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    })),
    iWantToConnect: iWant,
    partnerWantsToConnect: theyWant,
    connected: quest.hostWantsConnect && quest.guestWantsConnect,
  };
}

/** Each member gets the quest from their own side (partner, "I want to connect"). */
async function broadcast(quest: FlashQuest, now: Date = new Date()) {
  const members = [quest.hostId, quest.guestId].filter((id): id is string => Boolean(id));
  await Promise.all(
    members.map(async (memberId) => {
      emitToUsers([memberId], FLASH_QUEST_EVENTS.updated, await toQuestDto(quest, memberId, now));
    }),
  );
}

async function requireQuest(userId: string, questId: string): Promise<FlashQuest> {
  const quest = await repository.findQuestFor(userId, questId);
  if (!quest) {
    throw new AppError("Flash quest not found", 404, "NOT_FOUND");
  }
  return quest;
}

function pickRandom<T>(items: readonly T[]): T {
  const item = items[randomInt(items.length)];
  if (item === undefined) throw new Error("Nothing to pick from");
  return item;
}

/** POST /matchmaking/flash-quest — pair with someone practising the same language, or wait for one. */
export async function startQuest(userId: string, rawLanguageId: string): Promise<FlashQuestDto> {
  const languageId = normalizeLanguageCode(rawLanguageId);
  if (!languageId) {
    throw new AppError("Unknown language", 400, "VALIDATION_ERROR");
  }
  const now = new Date();

  const open = await repository.findOpenQuestFor(userId, now);
  if (open) {
    if (open.status === "ACTIVE") {
      throw new AppError("Finish your current Flash Quest first", 409, "CONFLICT");
    }
    if (open.languageId === languageId) {
      return toQuestDto(open, userId, now);
    }
    await repository.cancelQuest(open.id);
  }

  const { quest, matched } = await repository.matchOrCreate({
    userId,
    languageId,
    promptId: pickRandom(ICEBREAKER_PROMPTS).id,
    challengeId: pickRandom(FLASH_QUEST_CHALLENGES).id,
    now,
    durationMs: FLASH_QUEST_DURATION_MS,
  });
  if (matched) {
    await broadcast(quest, now);
  }
  return toQuestDto(quest, userId, now);
}

/** GET /matchmaking/flash-quest/:id — also retries pairing while the search is open. */
export async function getQuest(userId: string, questId: string): Promise<FlashQuestDto> {
  const now = new Date();
  const quest = await requireQuest(userId, questId);
  if (quest.hostId === userId && effectiveStatus(quest, now) === "SEARCHING") {
    const joined = await repository.joinOlderSearch(quest, now, FLASH_QUEST_DURATION_MS);
    if (joined) {
      await broadcast(joined, now);
      return toQuestDto(joined, userId, now);
    }
  }
  return toQuestDto(quest, userId, now);
}

/** DELETE /matchmaking/flash-quest/:id — stop searching, or leave a running quest. */
export async function leaveQuest(userId: string, questId: string): Promise<FlashQuestDto> {
  const now = new Date();
  const quest = await requireQuest(userId, questId);
  const status = effectiveStatus(quest, now);
  if (status !== "SEARCHING" && status !== "ACTIVE") {
    return toQuestDto(quest, userId, now);
  }
  const cancelled = (await repository.cancelQuest(quest.id)) ?? quest;
  if (status === "ACTIVE") {
    await broadcast(cancelled, now);
  }
  return toQuestDto(cancelled, userId, now);
}

/** POST /matchmaking/flash-quest/:id/messages — only while the timer runs. Counts for the streak. */
export async function sendMessage(userId: string, questId: string, body: string): Promise<FlashQuestDto> {
  const now = new Date();
  const quest = await requireQuest(userId, questId);
  const withinTime =
    quest.status === "ACTIVE" && quest.endsAt && now.getTime() <= quest.endsAt.getTime() + MESSAGE_GRACE_MS;
  if (!withinTime) {
    throw new AppError("This Flash Quest is over", 409, "CONFLICT");
  }
  if ((await repository.countMessages(quest.id)) >= FLASH_QUEST_MAX_MESSAGES) {
    throw new AppError("This Flash Quest has reached its message limit", 409, "CONFLICT");
  }
  await repository.insertMessage(quest.id, userId, body);
  recordActivityInBackground(userId);
  await broadcast(quest, now);
  return toQuestDto(quest, userId, now);
}

/**
 * POST /matchmaking/flash-quest/:id/connect — "stay friends". When the second member says yes,
 * the two become connected (each side sent a request, so it is accepted at once) and the day
 * counts for both members' streaks.
 */
export async function chooseToConnect(userId: string, questId: string): Promise<FlashQuestDto> {
  const now = new Date();
  const quest = await requireQuest(userId, questId);
  const partnerId = partnerOf(quest, userId);
  const closesAt = (quest.endsAt?.getTime() ?? 0) + FLASH_QUEST_CONNECT_WINDOW_MS;
  if (!partnerId || !quest.startedAt || quest.status === "SEARCHING" || now.getTime() > closesAt) {
    throw new AppError("This Flash Quest can no longer be turned into a connection", 409, "CONFLICT");
  }

  const role = roleOf(quest, userId);
  const partnerSaidYes = role === "host" ? quest.guestWantsConnect : quest.hostWantsConnect;
  if (partnerSaidYes) {
    await requestConnection(partnerId, userId, "We met in a Flash Quest");
    await requestConnection(userId, partnerId);
  }

  const updated = (await repository.setWantsConnect(quest.id, role)) ?? quest;
  if (partnerSaidYes) {
    recordActivityInBackground(userId);
    recordActivityInBackground(partnerId);
  }
  await broadcast(updated, now);
  return toQuestDto(updated, userId, now);
}
