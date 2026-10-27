import { z } from "zod";

import { languageIdSchema } from "./icebreakers";
import { multilineTextSchema } from "./validation";

/** A quest lasts exactly this long once both members are in. */
export const FLASH_QUEST_DURATION_MS = 3 * 60 * 1000;
/** A search with nobody to pair with gives up after this. */
export const FLASH_QUEST_SEARCH_TIMEOUT_MS = 60 * 1000;
/** After the timer, the "stay friends" choice stays open this long. */
export const FLASH_QUEST_CONNECT_WINDOW_MS = 60 * 60 * 1000;
export const FLASH_QUEST_MESSAGE_MAX = 300;
export const FLASH_QUEST_MAX_MESSAGES = 200;

/**
 * SEARCHING: waiting for a partner. ACTIVE: the timer runs. ENDED: time is up.
 * CANCELLED: the search was stopped or timed out, or a member left.
 */
export type FlashQuestStatus = "SEARCHING" | "ACTIVE" | "ENDED" | "CANCELLED";

/** Small twists that turn the topic into a shared challenge. Ids are stable; add new ones at the end. */
export const FLASH_QUEST_CHALLENGES = [
  { id: "fq01", text: "Each of you asks at least two follow-up questions." },
  { id: "fq02", text: "Use one new word your partner teaches you." },
  { id: "fq03", text: "Answer only in the language you are practising — no translations!" },
  { id: "fq04", text: "Find three things you have in common." },
  { id: "fq05", text: "Each of you corrects one sentence of the other, kindly." },
  { id: "fq06", text: "Describe it so well your partner can draw it." },
  { id: "fq07", text: "Finish with a question your partner has never been asked." },
  { id: "fq08", text: "Use a question word in every message: who, what, where, why, how." },
] as const;

export const startFlashQuestSchema = z.object({ languageId: languageIdSchema }).strict();
export type StartFlashQuestInput = z.infer<typeof startFlashQuestSchema>;

export const flashQuestMessageSchema = z
  .object({
    body: multilineTextSchema(FLASH_QUEST_MESSAGE_MAX, "Message").pipe(
      z.string().min(1, "Write a message"),
    ),
  })
  .strict();
export type FlashQuestMessageInput = z.infer<typeof flashQuestMessageSchema>;

export type FlashQuestTopicDto = {
  /** The question in the quest language when a translation exists, otherwise English. */
  text: string;
  english: string;
  challenge: string;
};

export type FlashQuestPartnerDto = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  country: string;
};

export type FlashQuestMessageDto = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export type FlashQuestDto = {
  id: string;
  status: FlashQuestStatus;
  languageId: string;
  languageName: string;
  topic: FlashQuestTopicDto;
  partner: FlashQuestPartnerDto | null;
  /** ISO times; null while searching. */
  startedAt: string | null;
  endsAt: string | null;
  /** Server clock when this was built, so the app can correct its own timer. */
  serverNow: string;
  /** When a search gives up. */
  searchExpiresAt: string;
  messages: FlashQuestMessageDto[];
  iWantToConnect: boolean;
  partnerWantsToConnect: boolean;
  /** True once both said yes and the connection exists. */
  connected: boolean;
};

/** Socket events the API sends to both members of a quest; the payload is a FlashQuestDto. */
export const FLASH_QUEST_EVENTS = {
  updated: "flash_quest_updated",
} as const;
