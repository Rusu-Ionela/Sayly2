import type { IconName } from "@/shared/components/SettingRow";
import type { SupportTopic } from "@sayly/shared";

type FaqEntry = { question: string; answer: string };

export type FaqCategory = {
  /** Same ids as contact topics, so "Still need help?" can preselect the category. */
  id: Exclude<SupportTopic, "OTHER">;
  title: string;
  icon: IconName;
  entries: FaqEntry[];
};

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: "ACCOUNT",
    title: "Account",
    icon: "person-circle-outline",
    entries: [
      {
        question: "How do I change my name, photo or bio?",
        answer:
          "Open Profile and tap Edit profile. Changes are saved to your account on every device.",
      },
      {
        question: "Can I hide my profile from new people?",
        answer:
          'Yes. Turn off "Show me in the Community" on your Profile or in Settings → Privacy. People you already talk to can still reach you.',
      },
      {
        question: "How do I get a copy of my data?",
        answer:
          "Go to Settings → Legal → Download my data. You get your profile, topics, collection, follows and sent messages as a file.",
      },
      {
        question: "How do I delete my account?",
        answer:
          "Settings → Account → Delete account. Your profile, photos and certificates are removed and you disappear from Discover. This can't be undone.",
      },
    ],
  },
  {
    id: "SECURITY",
    title: "Security & safety",
    icon: "shield-checkmark-outline",
    entries: [
      {
        question: "Someone is bothering me. What can I do?",
        answer:
          "Open their profile, tap ⋮ and choose Block or Report. Blocked members can't see or message you, and reports are anonymous.",
      },
      {
        question: "How do I change my password?",
        answer: "Go to Settings → Security → Change password. You'll need your current password.",
      },
      {
        question: "Who can see my location and online status?",
        answer:
          'You decide. Turn off "Show my location" or "Show my online status" in Settings → Privacy at any time.',
      },
    ],
  },
  {
    id: "LANGUAGE_EXCHANGE",
    title: "Language exchange",
    icon: "language-outline",
    entries: [
      {
        question: "How do I find a language partner?",
        answer:
          "Open Community to see members who speak the language you're learning and are learning yours. Send a connection request and say hi!",
      },
      {
        question: "How do corrections and translations work?",
        answer:
          "Long-press a message in a chat to translate it or suggest a correction. Save useful phrases to your Collection to review later.",
      },
      {
        question: "What are Language Parties?",
        answer:
          "Group conversations where several members practise together. Read the Language Parties guidelines before joining.",
      },
    ],
  },
  {
    id: "PRO",
    title: "Sayly Pro",
    icon: "star-outline",
    entries: [
      {
        question: "What do I get with Sayly Pro?",
        answer:
          "See who visited your profile, the profiles you viewed and more ways to find the right partner.",
      },
      {
        question: "How do I cancel my subscription?",
        answer:
          "Subscriptions are managed by the App Store or Google Play. Cancel from your store account's subscription settings at least a day before renewal.",
      },
      {
        question: "Can I get a refund?",
        answer:
          "Refunds are handled by the store you paid through. Request one from Apple or Google, or contact us and we'll help.",
      },
    ],
  },
];
