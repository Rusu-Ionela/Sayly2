import { z } from "zod";
import { PRACTICE_GOALS } from "@sayly/shared";

import { proficiencyLevelEnum } from "../../db/schema";
import { storedTextSchema } from "../../shared/validation/text";

import { DEFAULT_MAX_MEMBERS } from "./policy";

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const languageIdSchema = z.string().trim().min(2).max(16).regex(/^[A-Za-z0-9-]+$/, "Invalid language");
const levelSchema = z.enum(proficiencyLevelEnum.enumValues);
const topicSchema = z.enum(PRACTICE_GOALS);
const visibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);
const trimmed = (min: number, max: number) => storedTextSchema(min, max).transform((v) => v.trim());

export const createGroupSchema = z
  .object({
    name: trimmed(3, 60),
    description: trimmed(0, 600).default(""),
    languageId: languageIdSchema,
    level: levelSchema.nullable().default(null),
    topic: topicSchema.nullable().default(null),
    audience: trimmed(0, 120).default(""),
    rules: trimmed(0, 1000).default(""),
    visibility: visibilitySchema.default("PUBLIC"),
    maxMembers: z.number().int().min(2).max(1000).default(DEFAULT_MAX_MEMBERS),
  })
  .strict();

export const updateGroupSchema = z
  .object({
    name: trimmed(3, 60).optional(),
    description: trimmed(0, 600).optional(),
    level: levelSchema.nullable().optional(),
    topic: topicSchema.nullable().optional(),
    audience: trimmed(0, 120).optional(),
    rules: trimmed(0, 1000).optional(),
    visibility: visibilitySchema.optional(),
    maxMembers: z.number().int().min(2).max(1000).optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field is required",
  });

export const listGroupsQuerySchema = z.object({
  scope: z.preprocess(blankToUndefined, z.enum(["discover", "mine"]).default("discover")),
  search: z.preprocess(blankToUndefined, z.string().trim().min(1).max(80).optional()),
  languageId: z.preprocess(blankToUndefined, languageIdSchema.optional()),
  level: z.preprocess(blankToUndefined, levelSchema.optional()),
  topic: z.preprocess(blankToUndefined, topicSchema.optional()),
  sort: z.preprocess(blankToUndefined, z.enum(["active", "popular", "new"]).default("active")),
  page: z.coerce.number().int().min(1).max(100).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const listMembersQuerySchema = z.object({
  status: z.preprocess(blankToUndefined, z.enum(["ACTIVE", "PENDING"]).default("ACTIVE")),
});

export const changeRoleSchema = z.object({ role: z.enum(["MODERATOR", "MEMBER"]) }).strict();

export const transferOwnershipSchema = z.object({ userId: z.string().trim().min(1).max(64) }).strict();

export const sendGroupMessageSchema = z
  .object({
    content: trimmed(1, 4000),
    clientMessageId: z.string().trim().min(8).max(80).optional(),
  })
  .strict();

export const listGroupMessagesQuerySchema = z.object({
  before: z.preprocess(blankToUndefined, z.string().trim().min(1).max(64).optional()),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type CreateGroupInput = z.output<typeof createGroupSchema>;
export type UpdateGroupInput = z.output<typeof updateGroupSchema>;
export type ListGroupsQuery = z.output<typeof listGroupsQuerySchema>;
