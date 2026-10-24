import type { ProficiencyLevel } from "@/features/languages/types";
import { PRACTICE_GOALS } from "@/features/profile/model/practiceGoals";

export { PRACTICE_GOALS };

export const PROFICIENCY_OPTIONS: { label: string; value: ProficiencyLevel }[] = [
  { label: "Native", value: "NATIVE" },
  { label: "Fluent", value: "FLUENT" },
  { label: "Advanced", value: "ADVANCED" },
  { label: "Intermediate", value: "INTERMEDIATE" },
  { label: "Beginner", value: "BEGINNER" },
];
