import type { IconName } from "@/shared/components/SettingRow";

import type { CurrentUserProfile } from "../types";

import { learningPreferencesSummary } from "./learningPreferences";

export type ProfileMenuRoute =
  | {
      name:
        | "LanguagePreferences"
        | "Certificates"
        | "Collection"
        | "LearningPreferences"
        | "Topics"
        | "Connections"
        | "Following";
    }
  | { name: "ProfileVisits"; params: { mode: "visitors" | "viewed" } };

export type ProfileMenuItem = {
  key: string;
  icon: IconName;
  title: string;
  subtitle: string;
  /** Pro-only feature: shows the PRO badge. */
  pro?: boolean;
  /** Unread-style counter on the right (new visitors). */
  badge?: number;
  route: ProfileMenuRoute;
};

function count(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function languagesSummary(profile: CurrentUserProfile) {
  const native = profile.spokenLanguages.find((item) => item.proficiency === "NATIVE");
  const learning = profile.learningLanguages.map((item) => item.name);
  const parts = [
    native ? `Native: ${native.name}` : null,
    learning.length ? `Learning: ${learning.join(", ")}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Native, fluent and learning languages";
}

/** The Profile tab's navigation list, with live counts in the subtitles. */
export function buildProfileMenu(profile: CurrentUserProfile): ProfileMenuItem[] {
  const { savedPhrases, following, newVisitors } = profile.stats;
  const certificates = profile.certificates.length;

  return [
    {
      key: "languages",
      icon: "globe-outline",
      title: "Languages",
      subtitle: languagesSummary(profile),
      route: { name: "LanguagePreferences" },
    },
    {
      key: "certificates",
      icon: "shield-checkmark-outline",
      title: "Certificates",
      subtitle: certificates
        ? count(certificates, "certificate", "certificates")
        : "Certify your language level",
      route: { name: "Certificates" },
    },
    {
      key: "collection",
      icon: "bookmark-outline",
      title: "Collection",
      subtitle: savedPhrases ? `${savedPhrases} saved` : "Save expressions and idioms",
      route: { name: "Collection" },
    },
    {
      key: "learningPreferences",
      icon: "options-outline",
      title: "Learning preferences",
      subtitle: learningPreferencesSummary(profile.learningPreferences),
      route: { name: "LearningPreferences" },
    },
    {
      key: "topics",
      icon: "chatbubbles-outline",
      title: "Topics",
      subtitle: profile.mainTopic
        ? `Main topic: ${profile.mainTopic}`
        : "Add what you love to talk about",
      route: { name: "Topics" },
    },
    {
      key: "connections",
      icon: "people-circle-outline",
      title: "Connections",
      subtitle: "Requests and language partners",
      route: { name: "Connections" },
    },
    {
      key: "following",
      icon: "people-outline",
      title: "Following",
      subtitle: following ? count(following, "person", "people") : "People you follow",
      route: { name: "Following" },
    },
    {
      key: "visitors",
      icon: "person-outline",
      title: "Visitors",
      subtitle: newVisitors
        ? `${count(newVisitors, "new visitor", "new visitors")} to your profile`
        : "See who viewed your profile",
      pro: true,
      badge: newVisitors || undefined,
      route: { name: "ProfileVisits", params: { mode: "visitors" } },
    },
    {
      key: "viewed",
      icon: "videocam-outline",
      title: "Viewed profiles",
      subtitle: "Profiles you looked at",
      pro: true,
      route: { name: "ProfileVisits", params: { mode: "viewed" } },
    },
  ];
}

/** Text shared with "Share profile". */
export function shareProfileMessage(saylyId: string) {
  return `Let's practise languages together on Sayly! My Sayly ID is ${saylyId}.\nhttps://sayly.app/u/${saylyId}`;
}
