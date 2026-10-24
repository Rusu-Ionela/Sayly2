import { createId } from "@paralleldrive/cuid2";
import {
  type AnyPgColumn,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

import { generateSaylyId } from "../shared/utils/saylyId";

export const userStatusEnum = pgEnum("UserStatus", ["ACTIVE", "INACTIVE", "SUSPENDED", "DELETED"]);
export const userRoleEnum = pgEnum("UserRole", ["USER", "ADMIN"]);
export const authProviderEnum = pgEnum("AuthProvider", ["EMAIL", "GOOGLE", "APPLE"]);
export const connectionStatusEnum = pgEnum("ConnectionStatus", [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "CANCELLED",
]);
/** Lifecycle for member-submitted safety reports. */
export const reportStatusEnum = pgEnum("ReportStatus", ["PENDING", "IN_REVIEW", "RESOLVED", "DISMISSED"]);
/** LANG-002P0 role of a language on a user profile. Postgres enum name stays UserLanguageType. */
export const userLanguageTypeEnum = pgEnum("UserLanguageType", ["SPEAKS", "LEARNING"]);
export const proficiencyLevelEnum = pgEnum("ProficiencyLevel", [
  "BEGINNER",
  "ELEMENTARY",
  "INTERMEDIATE",
  "UPPER_INTERMEDIATE",
  "ADVANCED",
  "FLUENT",
  "NATIVE",
]);
export const conversationTypeEnum = pgEnum("ConversationType", ["DIRECT", "GROUP"]);
export const messageTypeEnum = pgEnum("MessageType", ["TEXT", "IMAGE", "VOICE", "VIDEO", "SYSTEM"]);
export const messageStatusEnum = pgEnum("MessageStatus", ["SENT", "DELIVERED", "READ"]);
export const groupVisibilityEnum = pgEnum("GroupVisibility", ["PUBLIC", "PRIVATE"]);
export const supportTicketKindEnum = pgEnum("SupportTicketKind", [
  "CONTACT",
  "FEATURE_REQUEST",
  "BUG_REPORT",
]);
export const supportTicketStatusEnum = pgEnum("SupportTicketStatus", [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
]);
export const supportTopicEnum = pgEnum("SupportTopic", [
  "ACCOUNT",
  "SECURITY",
  "LANGUAGE_EXCHANGE",
  "PRO",
  "OTHER",
]);
export const devicePlatformEnum = pgEnum("DevicePlatform", ["IOS", "ANDROID", "WEB"]);
export const groupRoleEnum = pgEnum("GroupRole", ["OWNER", "MODERATOR", "MEMBER"]);
/** PENDING = join request to a private group awaiting moderator approval. */
export const groupMemberStatusEnum = pgEnum("GroupMemberStatus", ["ACTIVE", "PENDING"]);
/** CEFR level stated on a language certificate (self-reported, not verified). */
export const cefrLevelEnum = pgEnum("CefrLevel", ["A1", "A2", "B1", "B2", "C1", "C2"]);

export type UserStatus = (typeof userStatusEnum.enumValues)[number];
export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type AuthProvider = (typeof authProviderEnum.enumValues)[number];
export type ConnectionStatus = (typeof connectionStatusEnum.enumValues)[number];
export type ReportStatus = (typeof reportStatusEnum.enumValues)[number];
export type UserLanguageType = (typeof userLanguageTypeEnum.enumValues)[number];
/** LANG-002P0 alias — same values as UserLanguageType (`SPEAKS` | `LEARNING`). */
export type LanguageType = UserLanguageType;
export type ProficiencyLevel = (typeof proficiencyLevelEnum.enumValues)[number];
export type ConversationType = (typeof conversationTypeEnum.enumValues)[number];
export type MessageType = (typeof messageTypeEnum.enumValues)[number];
export type MessageStatus = (typeof messageStatusEnum.enumValues)[number];
export type GroupVisibility = (typeof groupVisibilityEnum.enumValues)[number];
export type GroupRole = (typeof groupRoleEnum.enumValues)[number];
export type GroupMemberStatus = (typeof groupMemberStatusEnum.enumValues)[number];
export type CefrLevel = (typeof cefrLevelEnum.enumValues)[number];

export const users = pgTable(
  "User",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    email: text("email").notNull().unique(),
    passwordHash: text("passwordHash").notNull(),
    displayName: text("displayName").notNull().default(""),
    bio: text("bio").notNull().default(""),
    photoUrl: text("photoUrl"),
    emailVerifiedAt: timestamp("emailVerifiedAt", { precision: 3, mode: "date" }),
    status: userStatusEnum("status").notNull().default("ACTIVE"),
    role: userRoleEnum("role").notNull().default("USER"),
    authProvider: authProviderEnum("authProvider").notNull().default("EMAIL"),
    onboardingCompleted: boolean("onboardingCompleted").notNull().default(false),
    authVersion: integer("authVersion").notNull().default(0),
    /** Set by billing/admin only — never writable through profile endpoints. */
    isPro: boolean("isPro").notNull().default(false),
    /** Short public code people share to find this profile ("Sayly ID"). */
    saylyId: text("saylyId")
      .notNull()
      .unique()
      .$defaultFn(() => generateSaylyId()),
    /** Visitors after this moment count as "new" on the profile dashboard. */
    visitorsSeenAt: timestamp("visitorsSeenAt", { precision: 3, mode: "date" }),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    lastSeenAt: timestamp("lastSeenAt", { precision: 3, mode: "date" }),
  },
  (table) => [
    index("User_status_idx").on(table.status),
    index("User_role_idx").on(table.role),
  ],
);

export const refreshTokens = pgTable(
  "RefreshToken",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("tokenHash").notNull().unique(),
    familyId: text("familyId").notNull(),
    expiresAt: timestamp("expiresAt", { precision: 3, mode: "date" }).notNull(),
    revokedAt: timestamp("revokedAt", { precision: 3, mode: "date" }),
    replacedById: text("replacedById").references((): AnyPgColumn => refreshTokens.id, { onDelete: "set null" }),
    userAgent: text("userAgent"),
    ip: text("ip"),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("RefreshToken_userId_idx").on(table.userId),
    index("RefreshToken_familyId_idx").on(table.familyId),
    index("RefreshToken_expiresAt_idx").on(table.expiresAt),
  ],
);

export const passwordResetTokens = pgTable(
  "PasswordResetToken",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("tokenHash").notNull(),
    challengeHash: text("challengeHash").notNull().unique(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expiresAt", { precision: 3, mode: "date" }).notNull(),
    usedAt: timestamp("usedAt", { precision: 3, mode: "date" }),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("PasswordResetToken_userId_idx").on(table.userId),
    index("PasswordResetToken_expiresAt_idx").on(table.expiresAt),
    index("PasswordResetToken_tokenHash_idx").on(table.tokenHash),
  ],
);

export const profiles = pgTable(
  "Profile",
  {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("userId")
    .notNull()
    .unique()
    .references(() => users.id),
  displayName: text("displayName").notNull(),
  firstName: text("firstName"),
  lastName: text("lastName"),
  /** MALE or FEMALE. Kept off public profiles. */
  gender: text("gender"),
  bio: text("bio"),
  country: text("country").notNull(),
  city: text("city"),
  dateOfBirth: timestamp("dateOfBirth", { precision: 3, mode: "date" }),
  /** Three onboarding answers, in prompt order. */
  profileAnswers: text("profileAnswers").array().notNull().default([]),
  /** Learning preferences (values in features/users/learningPreferences.ts). */
  communicationMethods: text("communicationMethods").array().notNull().default([]),
  timeCommitment: text("timeCommitment"),
  learningSchedule: text("learningSchedule").array().notNull().default([]),
  correctionPreference: text("correctionPreference"),
  age: integer("age"),
  profileImageUrl: text("profileImageUrl"),
  practiceGoals: text("practiceGoals").array().notNull().default([]),
  /** Conversation topics (see users/topics.ts). */
  topics: text("topics").array().notNull().default([]),
  /** Gallery: ordered stable `/media/files/...` paths of the user's own images. */
  photos: text("photos").array().notNull().default([]),
  profileCompleted: boolean("profileCompleted").notNull().default(false),
  /** When false, user is hidden from Discover even if profile is complete. */
  discoverable: boolean("discoverable").notNull().default(true),
  /** City-level position (rounded to 2 decimals, ~1 km) for the profile map. Null until geocoded. */
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
  },
  (table) => [
    check("Profile_gender_valid", sql`${table.gender} in ('MALE', 'FEMALE')`),
    index("Profile_profileImageUrl_idx")
      .on(table.profileImageUrl)
      .where(sql`${table.profileImageUrl} is not null`),
  ],
);

/**
 * In-progress onboarding is kept server-side so a member can resume on another
 * device or after an interrupted session. It is deleted atomically once setup
 * completes; this is not part of the public profile.
 */
export const onboardingDrafts = pgTable("OnboardingDraft", {
  userId: text("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  step: text("step").notNull().default("profile"),
  questionIndex: integer("questionIndex").notNull().default(0),
  draft: jsonb("draft").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

/**
 * One row per user, created lazily on the first settings change — a missing row means
 * "all defaults". `Profile.discoverable` stays on Profile because discovery filters on it.
 */
export const userSettings = pgTable("UserSettings", {
  userId: text("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  showOnlineStatus: boolean("showOnlineStatus").notNull().default(true),
  showLocation: boolean("showLocation").notNull().default(true),
  notifyMessages: boolean("notifyMessages").notNull().default(true),
  notifyConnectionRequests: boolean("notifyConnectionRequests").notNull().default(true),
  notifyGroupActivity: boolean("notifyGroupActivity").notNull().default(true),
  /** When false, nobody can open this profile from a shared Sayly ID link. */
  showSaylyId: boolean("showSaylyId").notNull().default(true),
  /** When false, certificates are hidden on the public profile. */
  showCertificates: boolean("showCertificates").notNull().default(true),
  /** ISO-639-1 code chat translations default to; null = native language. */
  translateTo: text("translateTo"),
  updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

/**
 * Expo push tokens, one row per device. The token is the key: a phone belongs to the
 * account that signed in on it last, so a re-registration moves it to that user.
 */
export const pushTokens = pgTable(
  "PushToken",
  {
    token: text("token").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** "ios" | "android" */
    platform: text("platform").notNull(),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [index("PushToken_userId_idx").on(table.userId)],
);

export const notificationTypeEnum = pgEnum("NotificationType", ["CORRECTION", "REFERENCE"]);

/**
 * In-app inbox. Chat messages are not stored here (the chat list is their inbox); this holds
 * the rest: corrections and references (a new follower arrives as a silent chat notice). `dedupeKey` makes each event land once.
 */
export const notifications = pgTable(
  "Notification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    actorId: text("actorId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Set for CORRECTION: the chat to open. */
    conversationId: text("conversationId").references(() => conversations.id, { onDelete: "cascade" }),
    dedupeKey: text("dedupeKey").notNull(),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
    readAt: timestamp("readAt", { precision: 3, mode: "date" }),
  },
  (table) => [
    uniqueIndex("Notification_dedupeKey_key").on(table.dedupeKey),
    index("Notification_user_createdAt_idx").on(table.userId, table.createdAt),
  ],
);

export const languageCertificates = pgTable(
  "LanguageCertificate",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    languageId: text("languageId")
      .notNull()
      .references(() => languages.id),
    level: cefrLevelEnum("level").notNull(),
    /** e.g. "IELTS", "DELE", "Goethe-Zertifikat". */
    title: text("title").notNull(),
    issuedYear: integer("issuedYear"),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [index("LanguageCertificate_userId_idx").on(table.userId)],
);

export const languages = pgTable(
  "Language",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    /** ISO-639-1 (two-letter), unique. */
    code: text("code").notNull().unique(),
    flagEmoji: text("flagEmoji").notNull().default(""),
    /** 1 = most popular in language exchange. */
    sortOrder: integer("sortOrder").notNull().default(9999),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("Language_sortOrder_idx").on(table.sortOrder)],
);

export const userLanguages = pgTable(
  "UserLanguage",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("userId")
      .notNull()
      .references(() => users.id),
    languageId: text("languageId")
      .notNull()
      .references(() => languages.id),
    type: userLanguageTypeEnum("type").notNull(),
    proficiencyLevel: proficiencyLevelEnum("proficiencyLevel").notNull(),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("UserLanguage_userId_languageId_type_key").on(
      table.userId,
      table.languageId,
      table.type,
    ),
    uniqueIndex("UserLanguage_one_spoken_native_uidx")
      .on(table.userId)
      .where(sql`${table.type} = 'SPEAKS' AND ${table.proficiencyLevel} = 'NATIVE'`),
    index("UserLanguage_userId_idx").on(table.userId),
    index("UserLanguage_languageId_idx").on(table.languageId),
  ],
);

export const conversations = pgTable(
  "Conversation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    type: conversationTypeEnum("type").notNull().default("DIRECT"),
    lastMessageId: text("lastMessageId").references((): AnyPgColumn => messages.id, { onDelete: "set null" }),
    lastMessageAt: timestamp("lastMessageAt", { precision: 3, mode: "date" }),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [index("Conversation_lastMessageAt_idx").on(table.lastMessageAt)],
);

export const conversationParticipants = pgTable(
  "ConversationParticipant",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    conversationId: text("conversationId")
      .notNull()
      .references(() => conversations.id),
    userId: text("userId")
      .notNull()
      .references(() => users.id),
    joinedAt: timestamp("joinedAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
    lastMessageAt: timestamp("lastMessageAt", { precision: 3, mode: "date" }),
    /** Set while this user has the chat pinned to the top of their list. */
    pinnedAt: timestamp("pinnedAt", { precision: 3, mode: "date" }),
  },
  (table) => [
    uniqueIndex("ConversationParticipant_conversationId_userId_key").on(
      table.conversationId,
      table.userId,
    ),
    index("ConversationParticipant_userId_lastMessageAt_idx").on(table.userId, table.lastMessageAt),
  ],
);

export const messages = pgTable(
  "Message",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    conversationId: text("conversationId")
      .notNull()
      .references(() => conversations.id),
    senderId: text("senderId")
      .notNull()
      .references(() => users.id),
    type: messageTypeEnum("type").notNull(),
    content: text("content").notNull(),
    status: messageStatusEnum("status").notNull().default("SENT"),
    durationMs: integer("durationMs"),
    mimeType: text("mimeType"),
    thumbnailUrl: text("thumbnailUrl"),
    transcript: text("transcript"),
    translatedContent: text("translatedContent"),
    translatedLang: text("translatedLang"),
    caption: text("caption"),
    clientMessageId: text("clientMessageId"),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("Message_senderId_idx").on(table.senderId),
    index("Message_history_order_idx").on(table.conversationId, table.createdAt, table.id),
    uniqueIndex("Message_senderId_clientMessageId_uidx")
      .on(table.senderId, table.clientMessageId)
      .where(sql`${table.clientMessageId} is not null`),
    index("Message_unread_conversationId_senderId_idx")
      .on(table.conversationId, table.senderId, table.status)
      .where(sql`${table.status} in ('SENT', 'DELIVERED')`),
    // Look up which message shows a given uploaded file (media access check).
    index("Message_media_content_idx")
      .on(table.content)
      .where(sql`${table.type} <> 'TEXT'`),
    index("Message_thumbnailUrl_idx")
      .on(table.thumbnailUrl)
      .where(sql`${table.thumbnailUrl} is not null`),
  ],
);

export const messageTranslations = pgTable(
  "MessageTranslation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    messageId: text("messageId")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    targetLang: text("targetLang").notNull(),
    sourceHash: text("sourceHash").notNull(),
    providerVersion: text("providerVersion").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("MessageTranslation_cache_uidx").on(
      table.messageId,
      table.targetLang,
      table.sourceHash,
      table.providerVersion,
    ),
  ],
);

/** Partner correction of a chat message (language-learning loop). */
export const messageCorrections = pgTable(
  "MessageCorrection",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    messageId: text("messageId")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    authorId: text("authorId")
      .notNull()
      .references(() => users.id),
    correctedText: text("correctedText").notNull(),
    note: text("note"),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("MessageCorrection_messageId_idx").on(table.messageId),
    index("MessageCorrection_authorId_idx").on(table.authorId),
  ],
);

/** User-saved phrases from chat for later practice. */
export const savedPhrases = pgTable(
  "SavedPhrase",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceText: text("sourceText").notNull(),
    correctedText: text("correctedText"),
    note: text("note"),
    messageId: text("messageId").references(() => messages.id, { onDelete: "set null" }),
    languageCode: text("languageCode"),
    /** Example sentence (expressions saved from the catalog). */
    example: text("example"),
    /** Catalog expression id (see messaging/expressions.ts); null for chat phrases. */
    expressionId: text("expressionId"),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("SavedPhrase_userId_createdAt_idx").on(table.userId, table.createdAt),
    uniqueIndex("SavedPhrase_userId_expressionId_uidx")
      .on(table.userId, table.expressionId)
      .where(sql`${table.expressionId} is not null`),
  ],
);

/** Latest visit of one profile by one member — powers "Visitors" and "Viewed profiles". */
export const profileViews = pgTable(
  "ProfileView",
  {
    viewerId: text("viewerId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    viewedId: text("viewedId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewedAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.viewerId, table.viewedId] }),
    check("ProfileView_no_self", sql`${table.viewerId} <> ${table.viewedId}`),
    index("ProfileView_viewedId_viewedAt_idx").on(table.viewedId, table.viewedAt),
    index("ProfileView_viewerId_viewedAt_idx").on(table.viewerId, table.viewedAt),
  ],
);

/** Free-text conversation topics a member offers; at most one is the "main" topic. */
export const conversationTopics = pgTable(
  "ConversationTopic",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    isMain: boolean("isMain").notNull().default(false),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("ConversationTopic_userId_createdAt_idx").on(table.userId, table.createdAt),
    uniqueIndex("ConversationTopic_one_main_uidx")
      .on(table.userId)
      .where(sql`${table.isMain} = true`),
  ],
);

/**
 * Contact messages, feature requests and bug reports from members. `contactEmail` is a
 * snapshot of the account email when it was sent, so support can reply even after the
 * member changes it. Device fields are only filled when the member chose to attach them.
 */
export const supportTickets = pgTable(
  "SupportTicket",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: supportTicketKindEnum("kind").notNull(),
    topic: supportTopicEnum("topic"),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    contactEmail: text("contactEmail").notNull(),
    appVersion: text("appVersion"),
    platform: devicePlatformEnum("platform"),
    osVersion: text("osVersion"),
    deviceModel: text("deviceModel"),
    status: supportTicketStatusEnum("status").notNull().default("OPEN"),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("SupportTicket_userId_createdAt_idx").on(table.userId, table.createdAt),
    index("SupportTicket_kind_status_createdAt_idx").on(table.kind, table.status, table.createdAt),
  ],
);

export const blocks = pgTable(
  "Block",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    blockerId: text("blockerId")
      .notNull()
      .references(() => users.id),
    blockedId: text("blockedId")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("Block_blockerId_blockedId_key").on(table.blockerId, table.blockedId),
    check("Block_no_self", sql`${table.blockerId} <> ${table.blockedId}`),
  ],
);

/** A consent-based request between two members. Only ACCEPTED pairs may start a new direct chat. */
export const connections = pgTable(
  "Connection",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    requesterId: text("requesterId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientId: text("recipientId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: connectionStatusEnum("status").notNull().default("PENDING"),
    introMessage: text("introMessage"),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("Connection_no_self", sql`${table.requesterId} <> ${table.recipientId}`),
    uniqueIndex("Connection_requesterId_recipientId_key").on(table.requesterId, table.recipientId),
    uniqueIndex("Connection_unordered_pair_uidx").on(
      sql`least(${table.requesterId}, ${table.recipientId})`,
      sql`greatest(${table.requesterId}, ${table.recipientId})`,
    ),
    index("Connection_recipient_status_order_idx").on(table.recipientId, table.status, table.updatedAt),
    index("Connection_requester_status_order_idx").on(table.requesterId, table.status, table.updatedAt),
  ],
);

/** One-way follow. Composite key = one row per (follower, followee) pair. */
export const follows = pgTable(
  "Follow",
  {
    followerId: text("followerId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followeeId: text("followeeId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.followerId, table.followeeId] }),
    check("Follow_no_self", sql`${table.followerId} <> ${table.followeeId}`),
    index("Follow_followeeId_idx").on(table.followeeId),
    index("Follow_follower_createdAt_idx").on(table.followerId, table.createdAt),
  ],
);

/**
 * A short public note one member writes about a language partner, with a 1–5 rating
 * (4–5 count as positive). API caps body at 500 characters; one per author and subject.
 */
export const references = pgTable(
  "Reference",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    authorId: text("authorId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectId: text("subjectId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    /** Older references (written before ratings existed) count as positive. */
    rating: integer("rating").notNull().default(5),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("Reference_rating_range", sql`${table.rating} between 1 and 5`),
    uniqueIndex("Reference_authorId_subjectId_key").on(table.authorId, table.subjectId),
    check("Reference_no_self", sql`${table.authorId} <> ${table.subjectId}`),
    index("Reference_subject_createdAt_idx").on(table.subjectId, table.createdAt),
  ],
);

export const directConversations = pgTable(
  "DirectConversation",
  {
    userLowId: text("userLowId")
      .notNull()
      .references(() => users.id),
    userHighId: text("userHighId")
      .notNull()
      .references(() => users.id),
    conversationId: text("conversationId")
      .notNull()
      .unique()
      .references(() => conversations.id),
  },
  (table) => [
    primaryKey({ columns: [table.userLowId, table.userHighId] }),
    check("DirectConversation_ordered", sql`${table.userLowId} < ${table.userHighId}`),
  ],
);

export const mediaAssets = pgTable(
  "MediaAsset",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    ownerId: text("ownerId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storageKey: text("storageKey").notNull().unique(),
    mimeType: text("mimeType").notNull(),
    size: integer("size").notNull(),
    kind: text("kind").notNull(),
    purpose: text("purpose").notNull().default("CHAT"),
    conversationId: text("conversationId").references(() => conversations.id),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("MediaAsset_ownerId_idx").on(table.ownerId),
    check("MediaAsset_size_nonneg", sql`${table.size} >= 0`),
  ],
);

export const reports = pgTable(
  "Report",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    reporterId: text("reporterId")
      .notNull()
      .references(() => users.id),
    reportedId: text("reportedId")
      .notNull()
      .references(() => users.id),
    messageId: text("messageId").references(() => messages.id, { onDelete: "set null" }),
    reason: text("reason").notNull(),
    details: text("details"),
    status: reportStatusEnum("status").notNull().default("PENDING"),
    /** Most recent administrator to review the report; retained review details are never member-visible. */
    reviewerId: text("reviewerId").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewedAt", { precision: 3, mode: "date" }),
    reviewNote: text("reviewNote"),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("Report_reportedId_idx").on(table.reportedId),
    index("Report_reporterId_idx").on(table.reporterId),
    index("Report_status_createdAt_idx").on(table.status, table.createdAt),
    index("Report_reviewerId_idx").on(table.reviewerId),
  ],
);

/**
 * Language-practice group. Discussion lives in a GROUP Conversation so it reuses Message.
 * Membership is authoritative in GroupMember, not ConversationParticipant.
 */
export const groups = pgTable(
  "Group",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    languageId: text("languageId")
      .notNull()
      .references(() => languages.id),
    /** Null = open to every level. */
    level: proficiencyLevelEnum("level"),
    /** One of PRACTICE_GOALS, e.g. "Conversation". */
    topic: text("topic"),
    audience: text("audience").notNull().default(""),
    rules: text("rules").notNull().default(""),
    visibility: groupVisibilityEnum("visibility").notNull().default("PUBLIC"),
    ownerId: text("ownerId")
      .notNull()
      .references(() => users.id),
    conversationId: text("conversationId")
      .notNull()
      .unique()
      .references(() => conversations.id),
    /** Denormalized ACTIVE member count, maintained under the group row lock. */
    memberCount: integer("memberCount").notNull().default(0),
    maxMembers: integer("maxMembers").notNull().default(200),
    deletedAt: timestamp("deletedAt", { precision: 3, mode: "date" }),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("Group_member_bounds", sql`${table.memberCount} >= 0 AND ${table.memberCount} <= ${table.maxMembers}`),
    check("Group_max_members_range", sql`${table.maxMembers} BETWEEN 2 AND 1000`),
    index("Group_languageId_idx").on(table.languageId),
    index("Group_ownerId_idx").on(table.ownerId),
    index("Group_live_idx").on(table.deletedAt, table.updatedAt),
  ],
);

export const groupMembers = pgTable(
  "GroupMember",
  {
    groupId: text("groupId")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: groupRoleEnum("role").notNull().default("MEMBER"),
    status: groupMemberStatusEnum("status").notNull().default("ACTIVE"),
    lastReadAt: timestamp("lastReadAt", { precision: 3, mode: "date" }),
    joinedAt: timestamp("joinedAt", { precision: 3, mode: "date" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.userId] }),
    index("GroupMember_userId_status_idx").on(table.userId, table.status),
    index("GroupMember_groupId_status_idx").on(table.groupId, table.status),
  ],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  languages: many(userLanguages),
  settings: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userId],
  }),
  certificates: many(languageCertificates),
  conversationTopics: many(conversationTopics),
  pushTokens: many(pushTokens),
  refreshTokens: many(refreshTokens),
  passwordResetTokens: many(passwordResetTokens),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

export const conversationTopicsRelations = relations(conversationTopics, ({ one }) => ({
  user: one(users, {
    fields: [conversationTopics.userId],
    references: [users.id],
  }),
}));

export const pushTokensRelations = relations(pushTokens, ({ one }) => ({
  user: one(users, {
    fields: [pushTokens.userId],
    references: [users.id],
  }),
}));

export const languageCertificatesRelations = relations(languageCertificates, ({ one }) => ({
  user: one(users, {
    fields: [languageCertificates.userId],
    references: [users.id],
  }),
  language: one(languages, {
    fields: [languageCertificates.languageId],
    references: [languages.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

export const languagesRelations = relations(languages, ({ many }) => ({
  users: many(userLanguages),
}));

export const userLanguagesRelations = relations(userLanguages, ({ one }) => ({
  user: one(users, {
    fields: [userLanguages.userId],
    references: [users.id],
  }),
  language: one(languages, {
    fields: [userLanguages.languageId],
    references: [languages.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  participants: many(conversationParticipants),
  messages: many(messages),
}));

export const conversationParticipantsRelations = relations(conversationParticipants, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationParticipants.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [conversationParticipants.userId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  translations: many(messageTranslations),
}));

export const messageTranslationsRelations = relations(messageTranslations, ({ one }) => ({
  message: one(messages, {
    fields: [messageTranslations.messageId],
    references: [messages.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type OnboardingDraft = typeof onboardingDrafts.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type LanguageCertificate = typeof languageCertificates.$inferSelect;
export type Language = typeof languages.$inferSelect;
export type UserLanguage = typeof userLanguages.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type ConversationParticipant = typeof conversationParticipants.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type MessageTranslation = typeof messageTranslations.$inferSelect;
export type DirectConversation = typeof directConversations.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type Connection = typeof connections.$inferSelect;
export type ProfileView = typeof profileViews.$inferSelect;
export type ConversationTopic = typeof conversationTopics.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type GroupMember = typeof groupMembers.$inferSelect;
