-- Group feed (posts, comments, reactions) and live audio Party Rooms. Additive only, and safe to run more than once.
CREATE TABLE IF NOT EXISTS "GroupPost" (
	"id" text PRIMARY KEY NOT NULL,
	"groupId" text NOT NULL,
	"authorId" text NOT NULL,
	"kind" text DEFAULT 'THOUGHT' NOT NULL,
	"body" text NOT NULL,
	"clientId" text,
	"createdAt" timestamp (3) NOT NULL,
	CONSTRAINT "GroupPost_kind_check" CHECK ("kind" IN ('THOUGHT', 'QUESTION'))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "GroupPost" ADD CONSTRAINT "GroupPost_groupId_Group_id_fk"
    FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "GroupPost" ADD CONSTRAINT "GroupPost_authorId_User_id_fk"
    FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "GroupPost_feed_idx" ON "GroupPost" USING btree ("groupId", "createdAt", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "GroupPost_author_clientId_key" ON "GroupPost" USING btree ("authorId", "clientId");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "GroupPostComment" (
	"id" text PRIMARY KEY NOT NULL,
	"postId" text NOT NULL,
	"authorId" text NOT NULL,
	"body" text NOT NULL,
	"clientId" text,
	"createdAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "GroupPostComment" ADD CONSTRAINT "GroupPostComment_postId_GroupPost_id_fk"
    FOREIGN KEY ("postId") REFERENCES "public"."GroupPost"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "GroupPostComment" ADD CONSTRAINT "GroupPostComment_authorId_User_id_fk"
    FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "GroupPostComment_post_idx" ON "GroupPostComment" USING btree ("postId", "createdAt", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "GroupPostComment_author_clientId_key" ON "GroupPostComment" USING btree ("authorId", "clientId");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "GroupPostReaction" (
	"postId" text NOT NULL,
	"userId" text NOT NULL,
	"kind" text NOT NULL,
	"createdAt" timestamp (3) NOT NULL,
	CONSTRAINT "GroupPostReaction_postId_userId_pk" PRIMARY KEY ("postId", "userId"),
	CONSTRAINT "GroupPostReaction_kind_check" CHECK ("kind" IN ('LIKE', 'LOVE', 'HAHA', 'CLAP'))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "GroupPostReaction" ADD CONSTRAINT "GroupPostReaction_postId_GroupPost_id_fk"
    FOREIGN KEY ("postId") REFERENCES "public"."GroupPost"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "GroupPostReaction" ADD CONSTRAINT "GroupPostReaction_userId_User_id_fk"
    FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PartyRoom" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"languageId" text NOT NULL,
	"groupId" text,
	"hostId" text NOT NULL,
	"status" text DEFAULT 'LIVE' NOT NULL,
	"createdAt" timestamp (3) NOT NULL,
	"endedAt" timestamp (3),
	CONSTRAINT "PartyRoom_status_check" CHECK ("status" IN ('LIVE', 'ENDED'))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "PartyRoom" ADD CONSTRAINT "PartyRoom_languageId_Language_id_fk"
    FOREIGN KEY ("languageId") REFERENCES "public"."Language"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "PartyRoom" ADD CONSTRAINT "PartyRoom_groupId_Group_id_fk"
    FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "PartyRoom" ADD CONSTRAINT "PartyRoom_hostId_User_id_fk"
    FOREIGN KEY ("hostId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PartyRoom_live_idx" ON "PartyRoom" USING btree ("status", "createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PartyRoom_group_idx" ON "PartyRoom" USING btree ("groupId", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PartyRoom_host_idx" ON "PartyRoom" USING btree ("hostId", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PartyRoomParticipant" (
	"roomId" text NOT NULL,
	"userId" text NOT NULL,
	"role" text DEFAULT 'LISTENER' NOT NULL,
	"muted" boolean DEFAULT true NOT NULL,
	"handRaisedAt" timestamp (3),
	"socketId" text NOT NULL,
	"joinedAt" timestamp (3) NOT NULL,
	CONSTRAINT "PartyRoomParticipant_roomId_userId_pk" PRIMARY KEY ("roomId", "userId"),
	CONSTRAINT "PartyRoomParticipant_role_check" CHECK ("role" IN ('HOST', 'SPEAKER', 'LISTENER'))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "PartyRoomParticipant" ADD CONSTRAINT "PartyRoomParticipant_roomId_PartyRoom_id_fk"
    FOREIGN KEY ("roomId") REFERENCES "public"."PartyRoom"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "PartyRoomParticipant" ADD CONSTRAINT "PartyRoomParticipant_userId_User_id_fk"
    FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "PartyRoomParticipant_userId_key" ON "PartyRoomParticipant" USING btree ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PartyRoomParticipant_socket_idx" ON "PartyRoomParticipant" USING btree ("socketId");
