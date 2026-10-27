import { z } from "zod";
import { PROFICIENCY_LEVELS } from "@sayly/shared";

import { DISCOVERY_PROFICIENCY_VALUES } from "../../features/discovery/schema";

const proficiencySchema = z.enum(PROFICIENCY_LEVELS);

export const DiscoverLanguageSchema = z
  .object({
    languageId: z.string().meta({ example: "ru" }),
    code: z.string().meta({ example: "ru" }),
    name: z.string().meta({ example: "Russian" }),
    proficiency: proficiencySchema,
  })
  .meta({ id: "DiscoverLanguage" });

export const DiscoverUserSchema = z
  .object({
    id: z.string().meta({ example: "clxyz..." }),
    displayName: z.string().meta({ example: "Maria" }),
    country: z.string().meta({ example: "RU" }),
    profileImageUrl: z.string().nullable().meta({ example: "https://cdn.example/maria.png" }),
    photoUrl: z.string().optional(),
    age: z.number().int().nullable().meta({ example: 28 }),
    spokenLanguages: z.array(DiscoverLanguageSchema),
    learningLanguages: z.array(DiscoverLanguageSchema),
    matchScore: z.number().int(),
    matchType: z.enum(["MUTUAL", "PARTIAL", "NONE"]),
    matchLabel: z.string().meta({
      example: "Maria speaks Russian (Native) and wants to learn English",
    }),
    matchReasons: z.array(z.string()).meta({
      example: ["Speaks Russian (native), which you're learning", "Wants to learn Hindi, which you speak"],
    }),
    bio: z.string().max(160).meta({ description: "Public bio snippet (max 160 chars)" }),
    practiceGoals: z.array(z.string()),
    sharedGoals: z.array(z.string()).meta({ description: "Practice goals the viewer shares" }),
  })
  .meta({ id: "DiscoverUser" });

export const DiscoverPageMetaSchema = z
  .object({
    page: z.number().int().meta({ example: 1 }),
    limit: z.number().int().meta({ example: 20 }),
    total: z.number().int().meta({ example: 42 }),
    totalPages: z.number().int().meta({ example: 3 }),
    hasMore: z.boolean(),
  })
  .meta({ id: "DiscoverPageMeta" });

export const DiscoverPageSchema = z
  .object({
    items: z.array(DiscoverUserSchema),
    meta: DiscoverPageMetaSchema,
    page: z.number().int().meta({ example: 1, description: "Alias of meta.page" }),
    limit: z.number().int().meta({ example: 20, description: "Alias of meta.limit" }),
    totalCount: z.number().int().meta({ example: 42, description: "Alias of meta.total" }),
    totalPages: z.number().int().meta({ example: 3, description: "Alias of meta.totalPages" }),
    total: z.number().int().meta({ example: 42, description: "Alias of meta.total" }),
    hasMore: z.boolean().meta({ description: "Alias of meta.hasMore" }),
  })
  .meta({ id: "DiscoverPage" });

export const DiscoverPublicLanguageSchema = z
  .object({
    languageId: z.string().meta({ example: "ru" }),
    code: z.string().meta({ example: "ru" }),
    name: z.string().meta({ example: "Russian" }),
    flagEmoji: z.string().meta({ example: "🇷🇺" }),
    proficiency: proficiencySchema,
  })
  .meta({ id: "DiscoverPublicLanguage" });

export const DiscoverPublicProfileSchema = z
  .object({
    id: z.string().meta({ example: "clxyz..." }),
    displayName: z.string().meta({ example: "Maria" }),
    avatarUrl: z.string().nullable(),
    profileImageUrl: z.string().nullable(),
    country: z.string().meta({ example: "RU" }),
    bio: z.string(),
    spokenLanguages: z.array(DiscoverPublicLanguageSchema),
    learningLanguages: z.array(DiscoverPublicLanguageSchema),
    practiceGoals: z.array(z.string()).meta({ example: ["Conversation"] }),
    conversationId: z.string().nullable(),
    isFollowing: z.boolean(),
    followerCount: z.number().int(),
    city: z.string().meta({ example: "Moscow" }),
    topics: z.array(z.string()).meta({ example: ["Music", "Travel"] }),
    photos: z.array(z.string()).meta({ description: "Signed URLs of gallery photos, newest last." }),
    location: z
      .object({ latitude: z.number(), longitude: z.number() })
      .nullable()
      .meta({ description: "City-level position (about 1 km precision) for the profile map." }),
  })
  .meta({ id: "DiscoverPublicProfile" });

export const DiscoverQueryOpenApiSchema = z
  .object({
    search: z.string().max(80).optional().meta({
      example: "Maria",
      description: "Case-insensitive search on displayName and UserLanguage names (DISC-002)",
    }),
    spokenLanguageId: z.string().optional().meta({
      example: "ru",
      description: "Language catalog id the partner speaks (DISC-003)",
    }),
    learningLanguageId: z.string().optional().meta({
      example: "en",
      description: "Language catalog id the partner is learning (DISC-003)",
    }),
    spokenLanguage: z.string().optional().meta({
      description: "Alias of spokenLanguageId for existing clients",
    }),
    learningLanguage: z.string().optional().meta({
      description: "Alias of learningLanguageId for existing clients",
    }),
    country: z.string().optional().meta({
      example: "RO",
      description: "ISO 3166-1 alpha-2 or English country name (DISC-003)",
    }),
    practiceGoal: z.string().optional().meta({
      example: "Conversation",
      description: "Only partners with this practice goal",
    }),
    matchType: z.enum(["MUTUAL"]).optional().meta({
      description: "MUTUAL keeps only complementary partners (each can teach the other)",
    }),
    proficiency: z.enum(PROFICIENCY_LEVELS).optional().meta({
      example: DISCOVERY_PROFICIENCY_VALUES[0],
      description: "Proficiency level filter (DISC-003). Core values: BEGINNER, INTERMEDIATE, ADVANCED, FLUENT, NATIVE.",
    }),
    page: z.coerce.number().int().min(1).optional().meta({
      example: 1,
      description: "1-based page (DISC-004). Default 1.",
    }),
    limit: z.coerce.number().int().min(1).max(50).optional().meta({
      example: 20,
      description: "Page size (DISC-004). Default 20, max 50.",
    }),
  })
  .meta({ id: "DiscoverQuery" });
