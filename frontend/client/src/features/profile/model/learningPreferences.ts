import type { IconName } from "@/shared/components/SettingRow";

/** Same values as backend features/users/learningPreferences.ts. */
type CommunicationMethod = "TEXT" | "VOICE_MESSAGES" | "CALLS" | "VIDEO_CALLS" | "IN_PERSON";
type TimeCommitment = "CASUAL" | "WEEKLY" | "FEW_TIMES_A_WEEK" | "DAILY";
type LearningSchedule = "MORNINGS" | "AFTERNOONS" | "EVENINGS" | "WEEKENDS" | "FLEXIBLE";
type CorrectionPreference = "CORRECT_ME" | "ONLY_WHEN_ASKED" | "DONT_CORRECT";

export type LearningPreferences = {
  communication: CommunicationMethod[];
  timeCommitment: TimeCommitment | null;
  schedule: LearningSchedule[];
  correction: CorrectionPreference | null;
};

type Option<T extends string> = { id: T; label: string };

type PreferenceGroup =
  | {
      key: "communication";
      multiple: true;
      icon: IconName;
      title: string;
      hint: string;
      options: Option<CommunicationMethod>[];
    }
  | {
      key: "schedule";
      multiple: true;
      icon: IconName;
      title: string;
      hint: string;
      options: Option<LearningSchedule>[];
    }
  | {
      key: "timeCommitment";
      multiple: false;
      icon: IconName;
      title: string;
      hint: string;
      options: Option<TimeCommitment>[];
    }
  | {
      key: "correction";
      multiple: false;
      icon: IconName;
      title: string;
      hint: string;
      options: Option<CorrectionPreference>[];
    };

/** The Learning preferences screen and the public profile card, in display order. */
export const LEARNING_PREFERENCE_GROUPS: PreferenceGroup[] = [
  {
    key: "communication",
    multiple: true,
    icon: "chatbubbles-outline",
    title: "Communication",
    hint: "How you like to practise. Pick any.",
    options: [
      { id: "TEXT", label: "Text" },
      { id: "VOICE_MESSAGES", label: "Voice messages" },
      { id: "CALLS", label: "Calls" },
      { id: "VIDEO_CALLS", label: "Video calls" },
      { id: "IN_PERSON", label: "Meet in person" },
    ],
  },
  {
    key: "timeCommitment",
    multiple: false,
    icon: "hourglass-outline",
    title: "Time commitment",
    hint: "How much time you can give.",
    options: [
      { id: "CASUAL", label: "Now and then" },
      { id: "WEEKLY", label: "Once a week" },
      { id: "FEW_TIMES_A_WEEK", label: "A few times a week" },
      { id: "DAILY", label: "Every day" },
    ],
  },
  {
    key: "schedule",
    multiple: true,
    icon: "calendar-outline",
    title: "Learning schedule",
    hint: "When you're usually free. Pick any.",
    options: [
      { id: "MORNINGS", label: "Mornings" },
      { id: "AFTERNOONS", label: "Afternoons" },
      { id: "EVENINGS", label: "Evenings" },
      { id: "WEEKENDS", label: "Weekends" },
      { id: "FLEXIBLE", label: "Flexible" },
    ],
  },
  {
    key: "correction",
    multiple: false,
    icon: "create-outline",
    title: "Correction",
    hint: "How partners should handle your mistakes.",
    options: [
      { id: "CORRECT_ME", label: "Please correct me" },
      { id: "ONLY_WHEN_ASKED", label: "Only when I ask" },
      { id: "DONT_CORRECT", label: "Don't correct me" },
    ],
  },
];

/** Labels of the chosen values, per group (empty groups left out). */
export function describePreferences(preferences: LearningPreferences) {
  return LEARNING_PREFERENCE_GROUPS.flatMap((group) => {
    const raw = preferences[group.key];
    const chosen: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const labels = group.options.filter((option) => chosen.includes(option.id)).map((o) => o.label);
    return labels.length ? [{ key: group.key, icon: group.icon, title: group.title, labels }] : [];
  });
}

/** Menu subtitle: "Video calls · Every day · …" or a prompt. */
export function learningPreferencesSummary(preferences: LearningPreferences): string {
  const parts = describePreferences(preferences).map((group) => group.labels.join(", "));
  return parts.length ? parts.join(" · ") : "Communication, time, schedule and corrections";
}

type GroupKey = PreferenceGroup["key"];

/**
 * The patch for tapping `id` in `group`: multi-choice groups add/remove it, single-choice
 * groups select it, or clear it when it was already selected.
 */
export function togglePreference(
  preferences: LearningPreferences,
  group: GroupKey,
  id: string,
): Partial<LearningPreferences> {
  switch (group) {
    case "communication": {
      const current = preferences.communication;
      const value = id as CommunicationMethod;
      return {
        communication: current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value],
      };
    }
    case "schedule": {
      const current = preferences.schedule;
      const value = id as LearningSchedule;
      return {
        schedule: current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value],
      };
    }
    case "timeCommitment":
      return { timeCommitment: preferences.timeCommitment === id ? null : (id as TimeCommitment) };
    case "correction":
      return { correction: preferences.correction === id ? null : (id as CorrectionPreference) };
  }
}

export function isSelected(preferences: LearningPreferences, group: GroupKey, id: string) {
  const value = preferences[group];
  return Array.isArray(value) ? (value as string[]).includes(id) : value === id;
}
