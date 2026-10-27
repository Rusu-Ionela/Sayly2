/** Members count as "on the radar" while online, or for this long after they were last seen. */
export const RADAR_ACTIVE_WINDOW_MINUTES = 15;
/** Most partners the radar shows at once (three rings, room for each avatar). */
export const RADAR_MAX_PARTNERS = 24;

/** ONLINE = connected right now; RECENT = seen within the active window. */
export type RadarAvailability = "ONLINE" | "RECENT";

/** 0 = inner ring (each can teach the other), 1 = one-way or shared goal, 2 = outer ring. */
export type RadarRing = 0 | 1 | 2;

export type RadarLanguageBadge = { languageId: string; name: string; flagEmoji: string | null };

export type RadarPartnerDto = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /** "" when the member hides their location. */
  country: string;
  availability: RadarAvailability;
  /** ISO time of the last activity; now for ONLINE members. */
  lastActiveAt: string;
  ring: RadarRing;
  matchScore: number;
  matchType: "MUTUAL" | "PARTIAL" | "NONE";
  /** The first data-backed reason this member is a good fit, if any. */
  matchReason: string | null;
  /** The language they can help the viewer with, if any. */
  canTeach: RadarLanguageBadge | null;
  /** The language they want to practise that the viewer speaks, if any. */
  wantsToLearn: RadarLanguageBadge | null;
  conversationId: string | null;
};

export type RadarDto = {
  items: RadarPartnerDto[];
  onlineCount: number;
  generatedAt: string;
};
