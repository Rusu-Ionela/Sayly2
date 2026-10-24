type LanguageBadge = { name: string; flagEmoji: string };

/** Compact card of another member (Following, Visitors, Viewed profiles). */
export type MemberSummary = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /** "" / null when the member hides their location. */
  country: string;
  city: string | null;
  isPro: boolean;
  nativeLanguage: LanguageBadge | null;
  learningLanguage: LanguageBadge | null;
  /** UNKNOWN when the member hides their online status. */
  onlineStatus: "ONLINE" | "OFFLINE" | "UNKNOWN";
  lastSeen: string | null;
};

/** Paged list response shared by the member-list endpoints. */
export type MemberPage<TItem> = {
  items: TItem[];
  total: number;
  nextOffset: number | null;
};
