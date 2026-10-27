import type { ProficiencyLevel } from "./types";

type ProficiencyOption = {
  value: ProficiencyLevel;
  label: string;
  cefr: string;
  description: string;
};

const PROFICIENCY_DETAILS: ProficiencyOption[] = [
  {
    value: "BEGINNER",
    label: "Beginner",
    cefr: "A1 / A2",
    description: "Simple phrases and everyday introductions.",
  },
  {
    value: "ELEMENTARY",
    label: "Elementary",
    cefr: "A2",
    description: "Familiar topics with some help.",
  },
  {
    value: "INTERMEDIATE",
    label: "Intermediate",
    cefr: "B1",
    description: "Can hold a conversation about familiar subjects.",
  },
  {
    value: "UPPER_INTERMEDIATE",
    label: "Upper intermediate",
    cefr: "B2",
    description: "Comfortable in most social and work situations.",
  },
  {
    value: "ADVANCED",
    label: "Advanced",
    cefr: "C1",
    description: "Fluent, nuanced, and independent.",
  },
  {
    value: "FLUENT",
    label: "Fluent",
    cefr: "C1 / C2",
    description: "Near-native ease in most contexts.",
  },
  {
    value: "NATIVE",
    label: "Native",
    cefr: "Native",
    description: "Grew up with this language.",
  },
];

export function proficiencyMeta(level: ProficiencyLevel): ProficiencyOption {
  return PROFICIENCY_DETAILS.find((item) => item.value === level) ?? PROFICIENCY_DETAILS[0]!;
}

/** Simplified learning levels shown in the learning-language editor. */
export const LEARNING_LEVEL_OPTIONS = [
  { value: "BEGINNER" as const, label: "Beginner", bars: 1 },
  { value: "INTERMEDIATE" as const, label: "Intermediate", bars: 2 },
  { value: "ADVANCED" as const, label: "Advanced", bars: 3 },
];

export type LearningLevel = (typeof LEARNING_LEVEL_OPTIONS)[number]["value"];

export function normalizeLearningProficiency(level: ProficiencyLevel): LearningLevel {
  switch (level) {
    case "BEGINNER":
    case "ELEMENTARY":
      return "BEGINNER";
    case "INTERMEDIATE":
    case "UPPER_INTERMEDIATE":
      return "INTERMEDIATE";
    case "ADVANCED":
    case "FLUENT":
    case "NATIVE":
      return "ADVANCED";
    default:
      return "BEGINNER";
  }
}

export function learningProficiencyLabel(level: ProficiencyLevel): string {
  const normalized = normalizeLearningProficiency(level);
  return LEARNING_LEVEL_OPTIONS.find((item) => item.value === normalized)?.label ?? "Beginner";
}
