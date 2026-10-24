import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

import { PROFICIENCY_VALUES } from "../../features/languages/schema";
import { DISCOVERY_PROFICIENCY_VALUES } from "../../features/discovery/schema";

extendZodWithOpenApi(z);

const proficiencySchema = z.enum(PROFICIENCY_VALUES);

export const DiscoverLanguageSchema = z
  .object({
    languageId: z.string().openapi({ example: "ru" }),
    code: z.string().openapi({ example: "ru" }),
    name: z.string().openapi({ example: "Russian" }),
    proficiency: proficiencySchema,
  })
  .openapi("DiscoverLanguage");

export const DiscoverUserSchema = z
  .object({
    id: z.string().openapi({ example: "clxyz..." }),
    displayName: z.string().openapi({ example: "Maria" }),
    country: z.string().openapi({ example: "RU" }),
    profileImageUrl: z.string().nullable().openapi({ example: "https://cdn.example/maria.png" }),
    photoUrl: z.string().optional(),
    age: z.number().int().nullable().openapi({ example: 28 }),
    spokenLanguages: z.array(DiscoverLanguageSchema),
    learningLanguages: z.array(DiscoverLanguageSchema),
    matchScore: z.number().int(),
    matchType: z.enum(["MUTUAL", "PARTIAL", "NONE"]),
    matchLabel: z.string().openapi({
      example: "Maria speaks Russian (Native) and wants to learn English",
    }),
    matchReasons: z.array(z.string()).openapi({
      example: ["Speaks Russian (native), which you're learning", "Wants to learn Hindi, which you speak"],
    }),
    bio: z.string().max(160).openapi({ description: "Public bio snippet (max 160 chars)" }),
    practiceGoals: z.array(z.string()),
    sharedGoals: z.array(z.string()).openapi({ description: "Practice goals the viewer shares" }),
  })
  .openapi("DiscoverUser");

export const DiscoverPageMetaSchema = z
  .object({
    page: z.number().int().openapi({ example: 1 }),
    limit: z.number().int().openapi({ example: 20 }),
    total: z.number().int().openapi({ example: 42 }),
    totalPages: z.number().int().openapi({ example: 3 }),
    hasMore: z.boolean(),
  })
  .openapi("DiscoverPageMeta");

export const DiscoverPageSchema = z
  .object({
    items: z.array(DiscoverUserSchema),
    meta: DiscoverPageMetaSchema,
    page: z.number().int().openapi({ example: 1, description: "Alias of meta.page" }),
    limit: z.number().int().openapi({ example: 20, description: "Alias of meta.limit" }),
    totalCount: z.number().int().openapi({ example: 42, description: "Alias of meta.total" }),
    totalPages: z.number().int().openapi({ example: 3, description: "Alias of meta.totalPages" }),
    total: z.number().int().openapi({ example: 42, description: "Alias of meta.total" }),
    hasMore: z.boolean().openapi({ description: "Alias of meta.hasMore" }),
  })
  .openapi("DiscoverPage");

export const DiscoverPublicLanguageSchema = z
  .object({
    languageId: z.string().openapi({ example: "ru" }),
    code: z.string().openapi({ example: "ru" }),
    name: z.string().openapi({ example: "Russian" }),
    flagEmoji: z.string().openapi({ example: "🇷🇺" }),
    proficiency: proficiencySchema,
  })
  .openapi("DiscoverPublicLanguage");

export const DiscoverPublicProfileSchema = z
  .object({
    id: z.string().openapi({ example: "clxyz..." }),
    displayName: z.string().openapi({ example: "Maria" }),
    avatarUrl: z.string().nullable(),
    profileImageUrl: z.string().nullable(),
    country: z.string().openapi({ example: "RU" }),
    bio: z.string(),
    spokenLanguages: z.array(DiscoverPublicLanguageSchema),
    learningLanguages: z.array(DiscoverPublicLanguageSchema),
    practiceGoals: z.array(z.string()).openapi({ example: ["Conversation"] }),
    conversationId: z.string().nullable(),
    isFollowing: z.boolean(),
    followerCount: z.number().int(),
    city: z.string().openapi({ example: "Moscow" }),
    topics: z.array(z.string()).openapi({ example: ["Music", "Travel"] }),
    photos: z.array(z.string()).openapi({ description: "Signed URLs of gallery photos, newest last." }),
    location: z
      .object({ latitude: z.number(), longitude: z.number() })
      .nullable()
      .openapi({ description: "City-level position (about 1 km precision) for the profile map." }),
  })
  .openapi("DiscoverPublicProfile");

export const DiscoverQueryOpenApiSchema = z
  .object({
    search: z.string().max(80).optional().openapi({
      example: "Maria",
      description: "Case-insensitive search on displayName and UserLanguage names (DISC-002)",
    }),
    spokenLanguageId: z.string().optional().openapi({
      example: "ru",
      description: "Language catalog id the partner speaks (DISC-003)",
    }),
    learningLanguageId: z.string().optional().openapi({
      example: "en",
      description: "Language catalog id the partner is learning (DISC-003)",
    }),
    spokenLanguage: z.string().optional().openapi({
      description: "Alias of spokenLanguageId for existing clients",
    }),
    learningLanguage: z.string().optional().openapi({
      description: "Alias of learningLanguageId for existing clients",
    }),
    country: z.string().optional().openapi({
      example: "RO",
      description: "ISO 3166-1 alpha-2 or English country name (DISC-003)",
    }),
    practiceGoal: z.string().optional().openapi({
      example: "Conversation",
      description: "Only partners with this practice goal",
    }),
    matchType: z.enum(["MUTUAL"]).optional().openapi({
      description: "MUTUAL keeps only complementary partners (each can teach the other)",
    }),
    proficiency: z.enum(PROFICIENCY_VALUES).optional().openapi({
      example: DISCOVERY_PROFICIENCY_VALUES[0],
      description: "Proficiency level filter (DISC-003). Core values: BEGINNER, INTERMEDIATE, ADVANCED, FLUENT, NATIVE.",
    }),
    page: z.coerce.number().int().min(1).optional().openapi({
      example: 1,
      description: "1-based page (DISC-004). Default 1.",
    }),
    limit: z.coerce.number().int().min(1).max(50).optional().openapi({
      example: 20,
      description: "Page size (DISC-004). Default 20, max 50.",
    }),
  })
  .openapi("DiscoverQuery");
