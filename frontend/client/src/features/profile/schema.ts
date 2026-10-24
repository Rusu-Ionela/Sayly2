import { z } from "zod";

import { dateOfBirthError } from "@/features/profile/model/dateOfBirth";
import { PRACTICE_GOALS } from "@/features/profile/model/practiceGoals";
import {
  CEFR_LEVELS,
  MAX_CERTIFICATES,
  MAX_PROFILE_PHOTOS,
  MAX_TOPICS,
  MIN_CERTIFICATE_YEAR,
  TOPICS,
} from "@/features/profile/model/profileLimits";

const proficiencySchema = z.enum([
  "NATIVE",
  "FLUENT",
  "ADVANCED",
  "UPPER_INTERMEDIATE",
  "INTERMEDIATE",
  "ELEMENTARY",
  "BEGINNER",
]);

export const certificateFormSchema = z.object({
  languageId: z.string().min(1, "Choose a language"),
  level: z.enum(CEFR_LEVELS),
  title: z
    .string()
    .trim()
    .min(2, "Certificate name must be at least 2 characters")
    .max(60, "Certificate name must be at most 60 characters"),
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
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name must be at most 50 characters"),
    bio: z.string().trim().max(500, "Bio must be at most 500 characters"),
    country: z.string().trim().min(2, "Select a country"),
    city: z
      .string()
      .trim()
      .refine((value) => value === "" || value.length >= 2, "City must be at least 2 characters")
      .refine((value) => value.length <= 60, "City must be at most 60 characters"),
    dateOfBirth: z
      .string()
      .trim()
      .superRefine((value, ctx) => {
        const message = dateOfBirthError(value);
        if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
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
      .max(10, "You can add up to 10 spoken languages"),
    learningLanguages: z
      .array(languageSelectionSchema)
      .min(1, "Add at least one learning language")
      .max(5, "You can add up to 5 learning languages"),
  })
  .superRefine((value, ctx) => {
    const nativeCount = value.spokenLanguages.filter(
      (item) => item.proficiency === "NATIVE",
    ).length;
    if (nativeCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["spokenLanguages"],
        message: "Mark one spoken language as Native",
      });
    } else if (nativeCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["spokenLanguages"],
        message: "You can only have one native language",
      });
    }

    const spokenIds = new Set(value.spokenLanguages.map((item) => item.languageId));
    for (const item of value.learningLanguages) {
      if (spokenIds.has(item.languageId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["learningLanguages"],
          message: "A language cannot be both spoken and learning",
        });
        break;
      }
    }
  });

export type EditProfileFormValues = z.infer<typeof editProfileSchema>;
