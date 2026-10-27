import type { ProficiencyLevel } from "@/features/languages/types";
import type { IconName } from "@/shared/components/SettingRow";
import type { CefrLevel } from "@sayly/shared";

import type { Price } from "../api/certificatesApi";

/** Levels a test can certify, in order. */
export const TEST_LEVELS = ["A2", "B1", "B2", "C1"] as const satisfies readonly CefrLevel[];
export type TestLevel = (typeof TEST_LEVELS)[number];

/**
 * The test one step above where you are: a beginner aims for A2, an intermediate
 * learner for B1, and so on (capped at C1).
 */
export function recommendedTestLevel(proficiency: ProficiencyLevel | undefined): TestLevel {
  switch (proficiency) {
    case "INTERMEDIATE":
      return "B1";
    case "UPPER_INTERMEDIATE":
      return "B2";
    case "ADVANCED":
    case "FLUENT":
    case "NATIVE":
      return "C1";
    default:
      return "A2";
  }
}

/** "US$2.66"-style price in the device locale. */
export function formatPrice(amountMinor: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
      amountMinor / 100,
    );
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

export function discountPercent(price: Price) {
  if (price.originalAmountMinor <= price.amountMinor) return 0;
  return Math.round((1 - price.amountMinor / price.originalAmountMinor) * 100);
}

export const WHAT_YOU_GET: readonly { icon: IconName; title: string; body: string }[] = [
  {
    icon: "document-text-outline",
    title: "PDF certificate",
    body: "A shareable certificate with your level, ready for your CV or LinkedIn.",
  },
  {
    icon: "ribbon-outline",
    title: "Badge on your profile",
    body: "Partners see your verified level next to the language.",
  },
  {
    icon: "stats-chart-outline",
    title: "Personal scorecard",
    body: "Your strengths and weak spots in reading, listening and grammar.",
  },
  {
    icon: "refresh-outline",
    title: "Free retake",
    body: "Didn't pass? Take the test again at no extra cost.",
  },
];

export const CERTIFICATE_FAQ: readonly { question: string; answer: string }[] = [
  {
    question: "How does the test work?",
    answer:
      "The test runs online in the app and takes about 45 minutes. It covers reading, listening and grammar at the level you choose.",
  },
  {
    question: "When do I get my result?",
    answer: "Immediately. Your score and certificate are ready as soon as you finish.",
  },
  {
    question: "Which level should I take?",
    answer:
      "We suggest the level one step above what you set for the language on your profile. You can pick any level.",
  },
  {
    question: "What if I don't pass?",
    answer: "You can retake the same level for free.",
  },
  {
    question: "Who can see my certificate?",
    answer:
      "Partners see it on your profile while “Show certificates on my profile” is on. You can turn it off at any time.",
  },
];
