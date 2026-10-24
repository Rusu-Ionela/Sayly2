import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

const languageBadge = z.object({ name: z.string(), flagEmoji: z.string() }).nullable();

export const MemberSummarySchema = z
  .object({
    id: z.string(),
    displayName: z.string().openapi({ example: "Yuki" }),
    avatarUrl: z.string().nullable(),
    country: z.string().openapi({ description: '"" when the member hides their location' }),
    city: z.string().nullable(),
    isPro: z.boolean(),
    nativeLanguage: languageBadge,
    learningLanguage: languageBadge,
    onlineStatus: z.enum(["ONLINE", "OFFLINE", "UNKNOWN"]),
    lastSeen: z.string().nullable(),
  })
  .openapi("MemberSummary");

export const ProfileVisitsPageSchema = z
  .object({
    locked: z.boolean().openapi({ description: "true for non-Pro members: counts only, no items" }),
    total: z.number().int(),
    newCount: z.number().int(),
    items: z.array(
      z.object({ member: MemberSummarySchema, viewedAt: z.string(), isNew: z.boolean() }),
    ),
    nextOffset: z.number().int().nullable(),
  })
  .openapi("ProfileVisitsPage");

export const ConversationTopicsSchema = z
  .object({
    items: z.array(
      z.object({
        id: z.string(),
        title: z.string().openapi({ example: "Learning to surf" }),
        isMain: z.boolean(),
        createdAt: z.string(),
      }),
    ),
    max: z.number().int().openapi({ example: 10 }),
  })
  .openapi("ConversationTopics");

export const CreateTopicRequestSchema = z
  .object({
    title: z.string().min(3).max(80),
    isMain: z.boolean().optional(),
  })
  .openapi("CreateTopicRequest");

export const CertificateOffersSchema = z
  .object({
    tests: z.array(
      z.object({
        level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
        name: z.string(),
        summary: z.string(),
        durationMinutes: z.number().int(),
        format: z.literal("ONLINE"),
        instantResult: z.boolean(),
        price: z.object({
          currency: z.string().openapi({ example: "USD" }),
          amountMinor: z.number().int().openapi({ example: 266 }),
          originalAmountMinor: z.number().int().openapi({ example: 443 }),
        }),
      }),
    ),
    freeRetake: z.boolean(),
    purchasable: z.boolean(),
  })
  .openapi("CertificateOffers");

export const ExpressionsSchema = z
  .object({
    languages: z.array(z.string()),
    items: z.array(
      z.object({
        id: z.string().openapi({ example: "en-spill-the-beans" }),
        languageCode: z.string(),
        phrase: z.string(),
        meaning: z.string(),
        example: z.string(),
        savedPhraseId: z.string().nullable(),
      }),
    ),
  })
  .openapi("Expressions");
