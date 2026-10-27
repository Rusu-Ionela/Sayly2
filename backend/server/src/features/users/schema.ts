import { z } from "zod";
import {
  BIO_MAX,
  CEFR_LEVELS,
  CERTIFICATE_TITLE_MAX,
  CERTIFICATE_TITLE_MIN,
  CITY_MAX,
  CITY_MIN,
  currentPasswordSchema,
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  FIRST_NAME_MIN,
  isValidCountryInput,
  LAST_NAME_MIN,
  MAX_AGE,
  MAX_AVATAR_BYTES,
  MAX_CERTIFICATES,
  MAX_PROFILE_PHOTOS,
  MAX_TOPICS,
  MIN_AGE,
  MIN_CERTIFICATE_YEAR,
  multilineTextSchema,
  newPasswordSchema,
  PERSON_NAME_MAX,
  PRACTICE_GOALS,
  singleLineTextSchema,
  TOPICS,
} from "@sayly/shared";

import { storedTextSchema } from "../../shared/validation/text";
import {
  addLanguageSelectionIssues,
  languageSelectionSchema,
  learningLanguagesFieldSchema,
  mapLanguageSelections,
  spokenLanguagesFieldSchema,
  syncUserLanguagesSchema,
} from "../languages/schema";
import { normalizeLanguageCode } from "../languages/catalog";

import { extractStorageKey, stableFilePath } from "../media/storage";

import { ageFromDateOfBirth, parseStrictUtcDate } from "./age";
import { learningPreferencesSchema } from "./learningPreferences";
import type { AvatarInput, AvatarMimeType } from "./avatar";
import type { UpdateProfileInput, UpdateSettingsInput } from "./types";

export { syncUserLanguagesSchema as updateLanguagesSchema };

const countrySchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .refine((value) => !value.includes("\u0000"), "Invalid characters")
  .refine(isValidCountryInput, {
    message: "country must be a valid ISO 3166-1 alpha-2 code or known country name",
  })
  .transform((value) => {
    const trimmed = value.trim();
    if (trimmed.length === 2) {
      return trimmed.toUpperCase();
    }
    return trimmed;
  });

/**
 * Avatars must be our own uploads (a `/media/files/...` path, signed or not): the face check
 * can only run on files we store, so arbitrary external image URLs are refused.
 */
function isAllowedAvatarUrl(value: string): boolean {
  return value.length <= 2048 && extractStorageKey(value) !== null;
}

/** URL-only avatar (onboarding uploads through /media first). */
const avatarUrlSchema = storedTextSchema(1, 2048).refine(isAllowedAvatarUrl, {
  message: "Upload your profile photo from your device",
});

const AVATAR_DATA_URI = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
/** base64 inflates by 4/3 — reject oversized strings before decoding them. */
const MAX_AVATAR_DATA_URI_LENGTH = Math.ceil((MAX_AVATAR_BYTES * 4) / 3) + 64;

/** Magic bytes, so a renamed HTML/SVG payload cannot pose as an image. */
function matchesImageSignature(mimeType: AvatarMimeType, data: Buffer): boolean {
  switch (mimeType) {
    case "image/jpeg":
      return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
    case "image/png":
      return data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/webp":
      return (
        data.subarray(0, 4).toString("ascii") === "RIFF" &&
        data.subarray(8, 12).toString("ascii") === "WEBP"
      );
  }
}

/**
 * Avatar: an http(s) URL / server media path, or an inline base64 data URI
 * (jpeg/png/webp, max 2 MB decoded). "" or null clears the avatar.
 */
const avatarSchema = z
  .string()
  .max(MAX_AVATAR_DATA_URI_LENGTH, "Profile image must be 2 MB or smaller")
  .refine((value) => !value.includes("\u0000"), "Invalid characters")
  .transform((raw, ctx): AvatarInput | null => {
    const value = raw.trim();
    if (!value) {
      return null;
    }

    if (value.startsWith("data:")) {
      const match = AVATAR_DATA_URI.exec(value);
      if (!match) {
        ctx.addIssue({
          code: "custom",
          message: "Profile image must be a base64 JPEG, PNG or WebP",
        });
        return z.NEVER;
      }
      const mimeType = match[1] as AvatarMimeType;
      const data = Buffer.from(match[2]!, "base64");
      if (data.byteLength > MAX_AVATAR_BYTES) {
        ctx.addIssue({ code: "custom", message: "Profile image must be 2 MB or smaller" });
        return z.NEVER;
      }
      if (!matchesImageSignature(mimeType, data)) {
        ctx.addIssue({ code: "custom", message: "Profile image content does not match its type" });
        return z.NEVER;
      }
      return { kind: "inline", mimeType, data };
    }

    if (!isAllowedAvatarUrl(value)) {
      ctx.addIssue({
        code: "custom",
        message: "Upload your profile photo from your device",
      });
      return z.NEVER;
    }
    return { kind: "url", url: value };
  });

function uniqueArray<T extends z.ZodTypeAny>(item: T, max: number, label: string) {
  return z
    .array(item)
    .max(max, `You can add up to ${max} ${label}`)
    .refine((values) => new Set(values).size === values.length, {
      message: `${label} must not contain duplicates`,
    });
}

const practiceGoalsSchema = uniqueArray(z.enum(PRACTICE_GOALS), PRACTICE_GOALS.length, "practiceGoals");
const topicsSchema = uniqueArray(z.enum(TOPICS), MAX_TOPICS, "topics");

/** Gallery entries are server media references; normalised to the stable stored path. */
const galleryPhotoSchema = z
  .string()
  .max(2048)
  .transform((value, ctx) => {
    const key = extractStorageKey(value.trim());
    if (!key) {
      ctx.addIssue({ code: "custom", message: "Photos must be images you uploaded" });
      return z.NEVER;
    }
    return stableFilePath(key);
  });
const photosSchema = uniqueArray(galleryPhotoSchema, MAX_PROFILE_PHOTOS, "photos");

const certificateSchema = z
  .object({
    languageId: z.string().trim().min(1).max(64),
    level: z.enum(CEFR_LEVELS),
    title: singleLineTextSchema(CERTIFICATE_TITLE_MIN, CERTIFICATE_TITLE_MAX, "Certificate name"),
    issuedYear: z
      .number()
      .int()
      .min(MIN_CERTIFICATE_YEAR)
      .refine((year) => year <= new Date().getUTCFullYear(), "Year cannot be in the future")
      .nullable()
      .optional(),
  })
  .strict();
const certificatesSchema = z.array(certificateSchema).max(MAX_CERTIFICATES);

/** "" clears the city. */
const citySchema = z
  .union([singleLineTextSchema(CITY_MIN, CITY_MAX, "City"), z.literal("")])
  .transform((value) => value || null);

const displayNameSchema = singleLineTextSchema(DISPLAY_NAME_MIN, DISPLAY_NAME_MAX, "Display name");
const firstNameSchema = singleLineTextSchema(FIRST_NAME_MIN, PERSON_NAME_MAX, "First name");
const lastNameSchema = singleLineTextSchema(LAST_NAME_MIN, PERSON_NAME_MAX, "Last name");
const bioSchema = multilineTextSchema(BIO_MAX, "Bio");

const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD")
  .transform((value, ctx) => {
    const date = parseStrictUtcDate(value);
    if (!date) {
      ctx.addIssue({ code: "custom", message: "Invalid dateOfBirth" });
      return z.NEVER;
    }
    const age = ageFromDateOfBirth(date);
    if (age < MIN_AGE || age > MAX_AGE) {
      ctx.addIssue({
        code: "custom",
        message: `Age must be between ${MIN_AGE} and ${MAX_AGE}`,
      });
      return z.NEVER;
    }
    return date;
  });

/**
 * PRO-002 — the single edit-profile contract, shared by PUT /users/me/profile and
 * PATCH /users/me. Profile fields, avatar, gallery, topics, goals, certificates and
 * languages are applied in one transaction. At least one field must be present.
 * Account toggles (Discover visibility, privacy, notifications) live in updateSettingsSchema.
 *
 * `avatarUrl` / `profileImageUrl` / `photoUrl` are aliases kept for older clients;
 * the first one present wins (an explicit null still counts as present → clears).
 */
export const updateProfileSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    bio: bioSchema.optional(),
    country: countrySchema.optional(),
    city: citySchema.nullable().optional(),
    dateOfBirth: dateOfBirthSchema.optional(),
    avatarUrl: avatarSchema.nullable().optional(),
    profileImageUrl: avatarSchema.nullable().optional(),
    photoUrl: avatarSchema.nullable().optional(),
    practiceGoals: practiceGoalsSchema.optional(),
    topics: topicsSchema.optional(),
    photos: photosSchema.optional(),
    certificates: certificatesSchema.optional(),
    learningPreferences: learningPreferencesSchema.optional(),
    spokenLanguages: spokenLanguagesFieldSchema.optional(),
    learningLanguages: learningLanguagesFieldSchema.optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one profile field is required",
  })
  .refine(
    (value) =>
      (value.spokenLanguages === undefined) === (value.learningLanguages === undefined),
    {
      message: "spokenLanguages and learningLanguages must be provided together",
      path: ["spokenLanguages"],
    },
  )
  .superRefine((value, ctx) => {
    if (value.spokenLanguages && value.learningLanguages) {
      addLanguageSelectionIssues(value.spokenLanguages, value.learningLanguages, ctx);
    }
  })
  .transform(
    ({ avatarUrl, profileImageUrl, photoUrl, spokenLanguages, learningLanguages, ...rest }): UpdateProfileInput => ({
      ...rest,
      avatar: [avatarUrl, profileImageUrl, photoUrl].find((value) => value !== undefined),
      ...(spokenLanguages && learningLanguages
        ? {
            languages: {
              spokenLanguages: mapLanguageSelections(spokenLanguages),
              learningLanguages: mapLanguageSelections(learningLanguages),
            },
          }
        : {}),
    }),
  );

const profileAnswerSchema = z
  .string()
  .trim()
  .min(15, "Write at least 15 characters")
  .max(280, "Keep each answer under 280 characters")
  .refine((value) => !value.includes("\u0000"), "Invalid characters");

const genderSchema = z.enum(["MALE", "FEMALE"]);

const onboardingStepSchema = z.enum([
  "profile",
  "gender",
  "hello",
  "nativePrompt",
  "nativePick",
  "fluentPrompt",
  "fluentPick",
  "learnPrompt",
  "learnPick",
  "questions",
  "country",
  "photo",
]);

const onboardingDraftTextSchema = (max: number) => z.string().max(max);

/** PUT /users/me/onboarding-draft — partial, resumable onboarding state. */
export const onboardingDraftSchema = z
  .object({
    step: onboardingStepSchema,
    questionIndex: z.number().int().min(0).max(2),
    draft: z
      .object({
        firstName: onboardingDraftTextSchema(40),
        lastName: onboardingDraftTextSchema(40),
        dateOfBirth: z.string().max(10),
        gender: genderSchema.nullable(),
        skipFluent: z.boolean(),
        spokenLanguages: z.array(languageSelectionSchema).max(10),
        learningLanguages: z.array(languageSelectionSchema).max(5),
        answers: z.tuple([
          onboardingDraftTextSchema(280),
          onboardingDraftTextSchema(280),
          onboardingDraftTextSchema(280),
        ]),
        country: onboardingDraftTextSchema(80),
      })
      .strict(),
  })
  .strict();

/** PUT /users/me/onboarding — language selection only; profile details can be added later. */
export const completeOnboardingSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    firstName: firstNameSchema.optional(),
    lastName: lastNameSchema.optional(),
    gender: genderSchema.optional(),
    bio: bioSchema.optional(),
    country: countrySchema.optional(),
    age: z.coerce.number().int().min(MIN_AGE).max(MAX_AGE).optional(),
    dateOfBirth: dateOfBirthSchema.optional(),
    profileImageUrl: z.union([avatarUrlSchema, z.literal(""), z.null()]).optional(),
    spokenLanguages: spokenLanguagesFieldSchema,
    learningLanguages: learningLanguagesFieldSchema,
    practiceGoals: practiceGoalsSchema.optional(),
    profileAnswers: z.array(profileAnswerSchema).length(3).optional(),
  })
  .superRefine((value, ctx) => {
    addLanguageSelectionIssues(value.spokenLanguages, value.learningLanguages, ctx);
  })
  .transform((value) => ({
    ...value,
    profileImageUrl: value.profileImageUrl ? value.profileImageUrl : undefined,
    spokenLanguages: mapLanguageSelections(value.spokenLanguages),
    learningLanguages: mapLanguageSelections(value.learningLanguages),
    practiceGoals: value.practiceGoals,
  }));

/** PATCH /users/me/settings — privacy + notification toggles; send only what changed. */
export const updateSettingsSchema = z
  .object({
    discoverable: z.boolean().optional(),
    showOnlineStatus: z.boolean().optional(),
    showLocation: z.boolean().optional(),
    notifyMessages: z.boolean().optional(),
    notifyConnectionRequests: z.boolean().optional(),
    notifyGroupActivity: z.boolean().optional(),
    notifyStreakReminders: z.boolean().optional(),
    showSaylyId: z.boolean().optional(),
    showCertificates: z.boolean().optional(),
    /** Language code, or null to translate into your native language. */
    translateTo: z
      .string()
      .max(16)
      .transform((value, ctx) => {
        const code = normalizeLanguageCode(value);
        if (!code) {
          ctx.addIssue({ code: "custom", message: "Unsupported translation language" });
          return z.NEVER;
        }
        return code;
      })
      .nullable()
      .optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one setting is required",
  }) satisfies z.ZodType<UpdateSettingsInput>;

export const changePasswordSchema = z.object({
  currentPassword: currentPasswordSchema,
  newPassword: newPasswordSchema,
});
