import { z } from "zod";

import { callSignalDataSchema } from "./calls";
import { languageIdSchema } from "./icebreakers";
import { singleLineTextSchema } from "./validation";

/**
 * Party Rooms: live audio rooms. One HOST runs the room, SPEAKERS talk, LISTENERS listen and
 * may raise a hand. The server keeps the room state and relays WebRTC signalling; audio flows
 * peer to peer (a speaker sends to every other participant), so rooms stay small.
 */
export const PARTY_ROLES = ["HOST", "SPEAKER", "LISTENER"] as const;
export type PartyRole = (typeof PARTY_ROLES)[number];

/** Host included. Every speaker uploads one audio stream per participant (no media server). */
export const PARTY_MAX_SPEAKERS = 6;
export const PARTY_MAX_PARTICIPANTS = 40;
export const PARTY_TITLE_MIN = 3;
export const PARTY_TITLE_MAX = 80;

/** Quick reactions: a fixed set and a per-user rate limit, shown as floating animations. */
export const PARTY_REACTIONS = ["HEART", "CLAP", "FIRE"] as const;
export type PartyReaction = (typeof PARTY_REACTIONS)[number];
export const PARTY_REACTION_EMOJI: Record<PartyReaction, string> = {
  HEART: "❤️",
  CLAP: "👏",
  FIRE: "🔥",
};
/** At most this many reactions per member in `PARTY_REACTION_WINDOW_MS`. */
export const PARTY_REACTION_LIMIT = 8;
export const PARTY_REACTION_WINDOW_MS = 10_000;

export const PARTY_END_REASONS = ["host_ended", "host_left", "empty"] as const;
export type PartyEndReason = (typeof PARTY_END_REASONS)[number];

/** Socket event names. Client -> server events reply through the ack callback. */
export const PARTY_EVENTS = {
  // client -> server
  /** Creates a room (same rules as POST /party-rooms); the ack carries `{ id }`, then join. */
  create: "party_create",
  join: "party_join",
  leave: "party_leave",
  raiseHand: "party_raise_hand",
  promote: "party_promote",
  /** Host turns down a raised hand: the hand goes down and the listener is told. */
  declineHand: "party_decline_hand",
  demote: "party_demote",
  remove: "party_remove",
  setMuted: "party_set_muted",
  muteUser: "party_mute_user",
  end: "party_end",
  react: "party_react",
  signal: "party_signal",
  // server -> client
  state: "party_state",
  signalRelay: "party_signal_relay",
  reaction: "party_reaction",
  ended: "party_ended",
  removed: "party_removed",
  forceMute: "party_force_mute",
  handDeclined: "party_hand_declined",
} as const;

/** POST /party-rooms. With `groupId`, only active members of that group can join. */
export const createPartyRoomSchema = z
  .object({
    title: singleLineTextSchema(PARTY_TITLE_MIN, PARTY_TITLE_MAX, "Title"),
    languageId: languageIdSchema,
    groupId: z.string().trim().min(1).max(64).optional(),
  })
  .strict();
export type CreatePartyRoomInput = z.input<typeof createPartyRoomSchema>;

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const listPartyRoomsQuerySchema = z.object({
  languageId: z.preprocess(blankToUndefined, languageIdSchema.optional()),
  groupId: z.preprocess(blankToUndefined, z.string().trim().min(1).max(64).optional()),
});
export type ListPartyRoomsQuery = z.infer<typeof listPartyRoomsQuerySchema>;

const idSchema = z.string().trim().min(1).max(128);

export const partyRoomIdEventSchema = z.object({ roomId: idSchema }).strict();
export const partyTargetEventSchema = z.object({ roomId: idSchema, userId: idSchema }).strict();
export const partyRaiseHandEventSchema = z.object({ roomId: idSchema, raised: z.boolean() }).strict();
export const partySetMutedEventSchema = z.object({ roomId: idSchema, muted: z.boolean() }).strict();
export const partyReactEventSchema = z
  .object({ roomId: idSchema, kind: z.enum(PARTY_REACTIONS) })
  .strict();
/**
 * `key` names one peer connection on both ends (it changes when the pair's send directions
 * change), so a late signal for a replaced connection is ignored instead of breaking the new one.
 */
export const partySignalEventSchema = z
  .object({
    roomId: idSchema,
    toUserId: idSchema,
    key: z.string().min(1).max(160),
    data: callSignalDataSchema,
  })
  .strict();
export type PartySignalEventInput = z.infer<typeof partySignalEventSchema>;

export type PartyPersonDto = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export type PartyParticipantDto = PartyPersonDto & {
  role: PartyRole;
  muted: boolean;
  /** ISO time the hand went up; null when down. Only listeners raise hands. */
  handRaisedAt: string | null;
  joinedAt: string;
};

export type PartyRoomStatus = "LIVE" | "ENDED";

/** Full live state, sent on join and broadcast after every change. */
export type PartyRoomDto = {
  id: string;
  title: string;
  languageId: string;
  languageName: string;
  flagEmoji: string | null;
  groupId: string | null;
  status: PartyRoomStatus;
  hostId: string;
  /** Host first, then speakers by join time. */
  speakers: PartyParticipantDto[];
  /** Listeners; raised hands first (oldest hand first), then by join time. */
  listeners: PartyParticipantDto[];
  maxSpeakers: number;
  maxParticipants: number;
  createdAt: string;
};

/** Lobby card for GET /party-rooms. */
export type PartyRoomSummaryDto = {
  id: string;
  title: string;
  languageId: string;
  languageName: string;
  flagEmoji: string | null;
  groupId: string | null;
  host: PartyPersonDto;
  speakers: PartyPersonDto[];
  participantCount: number;
  createdAt: string;
};

export type PartySignalRelayEvent = {
  roomId: string;
  fromUserId: string;
  key: string;
  data: z.infer<typeof callSignalDataSchema>;
};
export type PartyReactionEvent = {
  roomId: string;
  userId: string;
  kind: PartyReaction;
  /** Unique per reaction, so the UI can key its animation. */
  id: string;
};
export type PartyEndedEvent = { roomId: string; reason: PartyEndReason };
export type PartyRemovedEvent = { roomId: string };
export type PartyForceMuteEvent = { roomId: string };
export type PartyHandDeclinedEvent = { roomId: string };

/** True for roles that send audio. */
export function partyRoleSpeaks(role: PartyRole): boolean {
  return role === "HOST" || role === "SPEAKER";
}
