/** Fixed row height of a chat list row (and its skeleton). */
export const CHAT_LIST_ROW_HEIGHT = 92;
export const CHAT_LIST_AVATAR_SIZE = 64;

export const VIDEO_NOTE_MARKER = "video-note";

/**
 * Inverted chat lists: when a new message arrives and the reader is within this many points of
 * the newest one, scroll to show it; older pages loading above never move the view.
 */
export const CHAT_LIST_MVCP = { autoscrollToTopThreshold: 120 } as const;
