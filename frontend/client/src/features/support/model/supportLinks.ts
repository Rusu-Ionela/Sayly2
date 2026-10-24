import type { IconName } from "@/shared/components/SettingRow";

export const SUPPORT_EMAIL = "support@sayly.app";

/** Where "Make our day and rate us" falls back when the in-app review sheet is unavailable. */
export const STORE_LINKS = {
  ios: "https://apps.apple.com/app/sayly",
  android: "https://play.google.com/store/apps/details?id=app.sayly",
} as const;

export type ExternalLink = {
  id: string;
  title: string;
  subtitle?: string;
  icon: IconName;
  url: string;
};

/** "Sayly community" section in Settings: blog and social channels. */
export const COMMUNITY_LINKS: ExternalLink[] = [
  {
    id: "blog",
    title: "Check out the Sayly blog",
    subtitle: "Tips, stories and learning guides",
    icon: "newspaper-outline",
    url: "https://sayly.app/blog",
  },
  {
    id: "youtube",
    title: "Subscribe on YouTube",
    icon: "logo-youtube",
    url: "https://www.youtube.com/@saylyapp",
  },
  {
    id: "tiktok",
    title: "Follow us on TikTok",
    icon: "logo-tiktok",
    url: "https://www.tiktok.com/@saylyapp",
  },
  {
    id: "instagram",
    title: "Follow us on Instagram",
    icon: "logo-instagram",
    url: "https://www.instagram.com/saylyapp",
  },
  {
    id: "snapchat",
    title: "Add us on Snapchat",
    icon: "logo-snapchat",
    url: "https://www.snapchat.com/add/saylyapp",
  },
];
