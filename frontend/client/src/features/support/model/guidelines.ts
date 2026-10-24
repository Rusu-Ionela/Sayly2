import type { IconName } from "@/shared/components/SettingRow";

type Guideline = {
  icon: IconName;
  title: string;
  body: string;
};

export type GuidelinesKind = "community" | "parties";

type GuidelinesPage = {
  icon: IconName;
  heading: string;
  intro: string;
  rules: Guideline[];
  note: string;
};

/** Community-wide rules and the Language Parties house rules, shown by one screen. */
const GUIDELINES: Record<GuidelinesKind, GuidelinesPage> = {
  community: {
    icon: "earth-outline",
    heading: "Community guidelines",
    intro:
      "Sayly is a place to learn languages with real people. These rules keep it friendly and safe.",
    rules: [
      {
        icon: "school-outline",
        title: "Come here to learn",
        body: "Sayly is for language exchange, not dating. Keep conversations about languages, cultures and everyday life.",
      },
      {
        icon: "heart-outline",
        title: "Be respectful",
        body: "Treat partners the way you'd like to be treated. No insults, hate speech or pressure of any kind.",
      },
      {
        icon: "swap-horizontal-outline",
        title: "Give as much as you take",
        body: "Split your time fairly between both languages and help your partner as much as they help you.",
      },
      {
        icon: "lock-closed-outline",
        title: "Protect your privacy",
        body: "Don't share passwords, money or private details, and never ask others for theirs.",
      },
      {
        icon: "ban-outline",
        title: "No spam or selling",
        body: "Don't promote products, services, channels or other apps, and don't send the same message to many people.",
      },
      {
        icon: "person-outline",
        title: "Be yourself",
        body: "Use your own photos and real information. Fake profiles and impersonation are removed.",
      },
      {
        icon: "flag-outline",
        title: "Report what feels wrong",
        body: "Block or report anyone who breaks these rules from their profile. Reports are anonymous and reviewed by our team.",
      },
    ],
    note: "Members who break these guidelines may lose access to Sayly.",
  },
  parties: {
    icon: "people-outline",
    heading: "Language Parties guidelines",
    intro: "Parties work when everyone feels welcome. Keep these in mind every time you join.",
    rules: [
      {
        icon: "happy-outline",
        title: "Be kind and patient",
        body: "Everyone is learning. Mistakes are welcome here: encourage people and never mock an accent or a slip.",
      },
      {
        icon: "chatbubbles-outline",
        title: "Share the conversation",
        body: "Give everyone a turn. Ask questions, invite quieter people in and keep your turns short.",
      },
      {
        icon: "language-outline",
        title: "Stick to the party's languages",
        body: "Speak the languages the party is for. Switch only to explain a word, then switch back.",
      },
      {
        icon: "create-outline",
        title: "Correct gently, when asked",
        body: "Offer corrections if people want them. Suggest the better phrase instead of pointing at the mistake.",
      },
      {
        icon: "shield-checkmark-outline",
        title: "Keep it safe",
        body: "No harassment, hate speech, sexual content or flirting. Never share anyone's private details or recordings.",
      },
      {
        icon: "pricetag-outline",
        title: "No selling or spam",
        body: "Parties are for practice, not for promoting products, services, channels or other apps.",
      },
      {
        icon: "flag-outline",
        title: "Report what feels wrong",
        body: "Block or report anyone who breaks these rules from their profile. Reports are anonymous and reviewed by our team.",
      },
    ],
    note: "Members who break these rules may be removed from parties or lose access to Sayly.",
  },
};

/** Unknown deep-link values fall back to the community guidelines. */
export function guidelinesFor(kind: string | undefined): GuidelinesPage {
  return kind === "parties" ? GUIDELINES.parties : GUIDELINES.community;
}
