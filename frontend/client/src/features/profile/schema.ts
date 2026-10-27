import { z } from "zod";

import { dateOfBirthError } from "@/features/profile/model/dateOfBirth";
import {
  BIO_MAX,
  CEFR_LEVELS,
  CERTIFICATE_TITLE_MAX,
  CERTIFICATE_TITLE_MIN,
  CITY_MAX,
  CITY_MIN,
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  MAX_CERTIFICATES,
  MAX_LEARNING_LANGUAGES,
  MAX_PROFILE_PHOTOS,
  MAX_SPOKEN_LANGUAGES,
  MAX_TOPICS,
  MIN_CERTIFICATE_YEAR,
  PRACTICE_GOALS,
  PROFICIENCY_LEVELS,
  TOPICS,
} from "@sayly/shared";

const proficiencySchema = z.enum(PROFICIENCY_LEVELS);

export const certificateFormSchema = z.object({
  languageId: z.string().min(1, "Choose a language"),
  level: z.enum(CEFR_LEVELS),
  title: z
    .string()
    .trim()
    .min(
      CERTIFICATE_TITLE_MIN,
      `Certificate name must be at least ${CERTIFICATE_TITLE_MIN} characters`,
    )
    .max(
      CERTIFICATE_TITLE_MAX,
      `Certificate name must be at most ${CERTIFICATE_TITLE_MAX} characters`,
    ),
  issuedYear: z
    .number()
    .int()
    .min(MIN_CERTIFICATE_YEAR, `Year must be ${MIN_CERTIFICATE_YEAR} or later`)
    .max(new Date().getFullYear(), "Year cannot be in the future")
    .nullable(),
});

export type CertificateFormValues = z.infer<typeof certificateFormSchema>;

const languageSelectionSchema = z.object({
  languageId: z.string().min(1),
  proficiency: proficiencySchema,
});

export const editProfileSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(DISPLAY_NAME_MIN, `Name must be at least ${DISPLAY_NAME_MIN} characters`)
      .max(DISPLAY_NAME_MAX, `Name must be at most ${DISPLAY_NAME_MAX} characters`),
    bio: z.string().trim().max(BIO_MAX, `Bio must be at most ${BIO_MAX} characters`),
    country: z.string().trim().min(2, "Select a country"),
    city: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || value.length >= CITY_MIN,
        `City must be at least ${CITY_MIN} characters`,
      )
      .refine((value) => value.length <= CITY_MAX, `City must be at most ${CITY_MAX} characters`),
    dateOfBirth: z
      .string()
      .trim()
      .superRefine((value, ctx) => {
        const message = dateOfBirthError(value);
        if (message) ctx.addIssue({ code: "custom", message });
      }),
    avatarUrl: z.string().optional(),
    practiceGoals: z.array(z.enum(PRACTICE_GOALS)).max(PRACTICE_GOALS.length),
    topics: z.array(z.enum(TOPICS)).max(MAX_TOPICS, `Pick up to ${MAX_TOPICS} topics`),
    photos: z.array(z.string()).max(MAX_PROFILE_PHOTOS, `Add up to ${MAX_PROFILE_PHOTOS} photos`),
    certificates: z
      .array(certificateFormSchema)
      .max(MAX_CERTIFICATES, `Add up to ${MAX_CERTIFICATES} certificates`),
    spokenLanguages: z
      .array(languageSelectionSchema)
      .min(1, "Add at least one spoken language")
      .max(MAX_SPOKEN_LANGUAGES, `You can add up to ${MAX_SPOKEN_LANGUAGES} spoken languages`),
    learningLanguages: z
      .array(languageSelectionSchema)
      .min(1, "Add at least one learning language")
      .max(
        MAX_LEARNING_LANGUAGES,
        `You can add up to ${MAX_LEARNING_LANGUAGES} learning languages`,
      ),
  })
  .superRefine((value, ctx) => {
    const nativeCount = value.spokenLanguages.filter(
      (item) => item.proficiency === "NATIVE",
    ).length;
    if (nativeCount === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["spokenLanguages"],
        message: "Mark one spoken language as Native",
      });
    } else if (nativeCount > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["spokenLanguages"],
        message: "You can only have one native language",
      });
    }

    const spokenIds = new Set(value.spokenLanguages.map((item) => item.languageId));
    for (const item of value.learningLanguages) {
      if (spokenIds.has(item.languageId)) {
        ctx.addIssue({
          code: "custom",
          path: ["learningLanguages"],
          message: "A language cannot be both spoken and learning",
        });
        break;
      }
    }
  });

export type EditProfileFormValues = z.infer<typeof editProfileSchema>;
