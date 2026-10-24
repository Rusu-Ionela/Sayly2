DO $$ BEGIN
  CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'GOOGLE', 'APPLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "UserLanguageType" AS ENUM ('SPEAKS', 'LEARNING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "ProficiencyLevel" AS ENUM ('BEGINNER', 'ELEMENTARY', 'INTERMEDIATE', 'UPPER_INTERMEDIATE', 'ADVANCED', 'FLUENT', 'NATIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "ConversationType" AS ENUM ('DIRECT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'VOICE', 'VIDEO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "User" (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  "passwordHash" text NOT NULL,
  "displayName" text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  "photoUrl" text,
  "emailVerifiedAt" timestamp(3),
  status "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  role "UserRole" NOT NULL DEFAULT 'USER',
  "authProvider" "AuthProvider" NOT NULL DEFAULT 'EMAIL',
  "onboardingCompleted" boolean NOT NULL DEFAULT false,
  "authVersion" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp(3) NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT NOW(),
  "lastSeenAt" timestamp(3)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "User_status_idx" ON "User" (status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User" (role);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authVersion" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "RefreshToken" (
  id text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "tokenHash" text NOT NULL UNIQUE,
  "familyId" text NOT NULL,
  "expiresAt" timestamp(3) NOT NULL,
  "revokedAt" timestamp(3),
  "replacedById" text,
  "userAgent" text,
  ip text,
  "createdAt" timestamp(3) NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx" ON "RefreshToken" ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "RefreshToken_familyId_idx" ON "RefreshToken" ("familyId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_idx" ON "RefreshToken" ("expiresAt");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  id text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "tokenHash" text NOT NULL,
  "challengeHash" text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  "expiresAt" timestamp(3) NOT NULL,
  "usedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
ALTER TABLE "PasswordResetToken" ADD COLUMN IF NOT EXISTS "challengeHash" text;
--> statement-breakpoint
ALTER TABLE "PasswordResetToken" ADD COLUMN IF NOT EXISTS "attempts" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE "PasswordResetToken" SET "challengeHash" = "tokenHash" WHERE "challengeHash" IS NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "PasswordResetToken" ALTER COLUMN "challengeHash" SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_challengeHash_key" ON "PasswordResetToken" ("challengeHash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken" ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken" ("expiresAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_idx" ON "PasswordResetToken" ("tokenHash");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Profile" (
  id text PRIMARY KEY,
  "userId" text NOT NULL UNIQUE REFERENCES "User"(id),
  "displayName" text NOT NULL,
  bio text,
  country text NOT NULL,
  "dateOfBirth" timestamp(3),
  age integer,
  "profileImageUrl" text,
  "practiceGoals" text[] NOT NULL DEFAULT '{}',
  "profileCompleted" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Language" (
  id text PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  "flagEmoji" text NOT NULL DEFAULT '',
  "sortOrder" integer NOT NULL DEFAULT 9999,
  "createdAt" timestamp(3) NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Language_sortOrder_idx" ON "Language" ("sortOrder");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UserLanguage" (
  id text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "User"(id),
  "languageId" text NOT NULL REFERENCES "Language"(id),
  type "UserLanguageType" NOT NULL,
  "proficiencyLevel" "ProficiencyLevel" NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UserLanguage_userId_languageId_type_key" ON "UserLanguage" ("userId", "languageId", type);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UserLanguage_one_spoken_native_uidx" ON "UserLanguage" ("userId") WHERE type = 'SPEAKS' AND "proficiencyLevel" = 'NATIVE';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UserLanguage_userId_idx" ON "UserLanguage" ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UserLanguage_languageId_idx" ON "UserLanguage" ("languageId");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Connection" (
  id text PRIMARY KEY,
  "requesterId" text NOT NULL REFERENCES "User"(id),
  "recipientId" text NOT NULL REFERENCES "User"(id),
  status "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
  "introMessage" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Connection_requesterId_recipientId_key" ON "Connection" ("requesterId", "recipientId");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Connection_unordered_pair_uidx" ON "Connection" (LEAST("requesterId", "recipientId"), GREATEST("requesterId", "recipientId"));
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "Connection" ADD CONSTRAINT "Connection_no_self" CHECK ("requesterId" <> "recipientId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Connection_recipientId_idx" ON "Connection" ("recipientId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Connection_requester_status_order_idx" ON "Connection" ("requesterId", status, "updatedAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Connection_recipient_status_order_idx" ON "Connection" ("recipientId", status, "updatedAt");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Conversation" (
  id text PRIMARY KEY,
  type "ConversationType" NOT NULL DEFAULT 'DIRECT',
  "lastMessageId" text,
  "lastMessageAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Conversation_lastMessageAt_idx" ON "Conversation" ("lastMessageAt");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ConversationParticipant" (
  id text PRIMARY KEY,
  "conversationId" text NOT NULL REFERENCES "Conversation"(id),
  "userId" text NOT NULL REFERENCES "User"(id),
  "joinedAt" timestamp(3) NOT NULL DEFAULT NOW(),
  "lastMessageAt" timestamp(3)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant" ("conversationId", "userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ConversationParticipant_userId_idx" ON "ConversationParticipant" ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ConversationParticipant_userId_lastMessageAt_idx" ON "ConversationParticipant" ("userId", "lastMessageAt");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Message" (
  id text PRIMARY KEY,
  "conversationId" text NOT NULL REFERENCES "Conversation"(id),
  "senderId" text NOT NULL REFERENCES "User"(id),
  type "MessageType" NOT NULL,
  content text NOT NULL,
  status "MessageStatus" NOT NULL DEFAULT 'SENT',
  "durationMs" integer,
  "mimeType" text,
  "thumbnailUrl" text,
  transcript text,
  "translatedContent" text,
  "translatedLang" text,
  caption text,
  "clientMessageId" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "clientMessageId" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Message_conversationId_idx" ON "Message" ("conversationId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Message_senderId_idx" ON "Message" ("senderId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx" ON "Message" ("conversationId", "createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Message_history_order_idx" ON "Message" ("conversationId", "createdAt", id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Message_senderId_clientMessageId_uidx" ON "Message" ("senderId", "clientMessageId") WHERE "clientMessageId" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Message_unread_conversationId_senderId_idx" ON "Message" ("conversationId", "senderId", status) WHERE status IN ('SENT', 'DELIVERED');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Block" (
  id text PRIMARY KEY,
  "blockerId" text NOT NULL REFERENCES "User"(id),
  "blockedId" text NOT NULL REFERENCES "User"(id),
  "createdAt" timestamp(3) NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Block_blockerId_blockedId_key" ON "Block" ("blockerId", "blockedId");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "Block" ADD CONSTRAINT "Block_no_self" CHECK ("blockerId" <> "blockedId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "DirectConversation" (
  "userLowId" text NOT NULL REFERENCES "User"(id),
  "userHighId" text NOT NULL REFERENCES "User"(id),
  "conversationId" text NOT NULL UNIQUE REFERENCES "Conversation"(id),
  PRIMARY KEY ("userLowId", "userHighId"),
  CHECK ("userLowId" < "userHighId")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "DirectConversation_conversationId_idx" ON "DirectConversation" ("conversationId");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "MediaAsset" (
  id text PRIMARY KEY,
  "ownerId" text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "storageKey" text NOT NULL UNIQUE,
  "mimeType" text NOT NULL,
  size integer NOT NULL,
  kind text NOT NULL,
  purpose text NOT NULL DEFAULT 'CHAT',
  "conversationId" text REFERENCES "Conversation"(id),
  "createdAt" timestamp(3) NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "MediaAsset_ownerId_idx" ON "MediaAsset" ("ownerId");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Report" (
  id text PRIMARY KEY,
  "reporterId" text NOT NULL REFERENCES "User"(id),
  "reportedId" text NOT NULL REFERENCES "User"(id),
  "messageId" text,
  reason text NOT NULL,
  details text,
  "createdAt" timestamp(3) NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Report_reportedId_idx" ON "Report" ("reportedId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Report_reporterId_idx" ON "Report" ("reporterId");
