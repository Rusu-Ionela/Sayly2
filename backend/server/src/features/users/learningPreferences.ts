import { z } from "zod";

/** How the member likes to practise (any number). */
export const COMMUNICATION_METHODS = ["TEXT", "VOICE_MESSAGES", "CALLS", "VIDEO_CALLS", "IN_PERSON"] as const;
/** How much time they can give (one). */
export const TIME_COMMITMENTS = ["CASUAL", "WEEKLY", "FEW_TIMES_A_WEEK", "DAILY"] as const;
/** When they are usually free (any number). */
export const LEARNING_SCHEDULES = ["MORNINGS", "AFTERNOONS", "EVENINGS", "WEEKENDS", "FLEXIBLE"] as const;
/** How they want mistakes handled (one). */
export const CORRECTION_PREFERENCES = ["CORRECT_ME", "ONLY_WHEN_ASKED", "DONT_CORRECT"] as const;

export type CommunicationMethod = (typeof COMMUNICATION_METHODS)[number];
export type TimeCommitment = (typeof TIME_COMMITMENTS)[number];
export type LearningSchedule = (typeof LEARNING_SCHEDULES)[number];
export type CorrectionPreference = (typeof CORRECTION_PREFERENCES)[number];

/** "Learning preferences" on the profile — public, so partners know what to expect. */
export type LearningPreferencesDto = {
  communication: CommunicationMethod[];
  timeCommitment: TimeCommitment | null;
  schedule: LearningSchedule[];
  correction: CorrectionPreference | null;
};

const uniqueList = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .array(z.enum(values))
    .max(values.length)
    .refine((list) => new Set(list).size === list.length, "Duplicate values");

/** Part of PATCH /users/me. Send only what changed; null clears a single choice. */
export const learningPreferencesSchema = z
  .object({
    communication: uniqueList(COMMUNICATION_METHODS),
    timeCommitment: z.enum(TIME_COMMITMENTS).nullable(),
    schedule: uniqueList(LEARNING_SCHEDULES),
    correction: z.enum(CORRECTION_PREFERENCES).nullable(),
  })
  .partial()
  .strict();

export type LearningPreferencesInput = z.infer<typeof learningPreferencesSchema>;

type StoredPreferences = {
  communicationMethods?: string[] | null;
  timeCommitment?: string | null;
  learningSchedule?: string[] | null;
  correctionPreference?: string | null;
};

const isOneOf = <T extends string>(values: readonly T[], value: string | null | undefined): value is T =>
  value != null && (values as readonly string[]).includes(value);

/** Stored columns → DTO. Unknown values (e.g. from an older app) are dropped. */
export function toLearningPreferencesDto(profile: StoredPreferences | null | undefined): LearningPreferencesDto {
  const time = profile?.timeCommitment;
  const correction = profile?.correctionPreference;
  return {
    communication: (profile?.communicationMethods ?? []).filter((value): value is CommunicationMethod =>
      isOneOf(COMMUNICATION_METHODS, value),
    ),
    timeCommitment: isOneOf(TIME_COMMITMENTS, time) ? time : null,
    schedule: (profile?.learningSchedule ?? []).filter((value): value is LearningSchedule =>
      isOneOf(LEARNING_SCHEDULES, value),
    ),
    correction: isOneOf(CORRECTION_PREFERENCES, correction) ? correction : null,
  };
}

/** DTO patch → Profile columns to set (only the fields that were sent). */
export function toLearningPreferenceColumns(input: LearningPreferencesInput) {
  return {
    ...(input.communication !== undefined ? { communicationMethods: input.communication } : {}),
    ...(input.timeCommitment !== undefined ? { timeCommitment: input.timeCommitment } : {}),
    ...(input.schedule !== undefined ? { learningSchedule: input.schedule } : {}),
    ...(input.correction !== undefined ? { correctionPreference: input.correction } : {}),
  };
}
