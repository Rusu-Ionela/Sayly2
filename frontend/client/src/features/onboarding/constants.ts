import type { ProficiencyLevel } from "@/features/languages/types";

export const PROFICIENCY_OPTIONS: { label: string; value: ProficiencyLevel }[] = [
  { label: "Native", value: "NATIVE" },
  { label: "Fluent", value: "FLUENT" },
  { label: "Advanced", value: "ADVANCED" },
  { label: "Intermediate", value: "INTERMEDIATE" },
  { label: "Beginner", value: "BEGINNER" },
];
