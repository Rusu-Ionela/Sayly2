CREATE TYPE "public"."GroupMemberStatus" AS ENUM('ACTIVE', 'PENDING');--> statement-breakpoint
CREATE TYPE "public"."GroupRole" AS ENUM('OWNER', 'MODERATOR', 'MEMBER');--> statement-breakpoint
CREATE TYPE "public"."GroupVisibility" AS ENUM('PUBLIC', 'PRIVATE');--> statement-breakpoint
ALTER TYPE "public"."ConversationType" ADD VALUE 'GROUP';--> statement-breakpoint
CREATE TABLE "GroupMember" (
	"groupId" text NOT NULL,
	"userId" text NOT NULL,
	"role" "GroupRole" DEFAULT 'MEMBER' NOT NULL,
	"status" "GroupMemberStatus" DEFAULT 'ACTIVE' NOT NULL,
	"lastReadAt" timestamp (3),
	"joinedAt" timestamp (3) NOT NULL,
	CONSTRAINT "GroupMember_groupId_userId_pk" PRIMARY KEY("groupId","userId")
);
--> statement-breakpoint
CREATE TABLE "Group" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"languageId" text NOT NULL,
	"level" "ProficiencyLevel",
	"topic" text,
	"audience" text DEFAULT '' NOT NULL,
	"rules" text DEFAULT '' NOT NULL,
	"visibility" "GroupVisibility" DEFAULT 'PUBLIC' NOT NULL,
	"ownerId" text NOT NULL,
	"conversationId" text NOT NULL,
	"memberCount" integer DEFAULT 0 NOT NULL,
	"maxMembers" integer DEFAULT 200 NOT NULL,
	"deletedAt" timestamp (3),
	"createdAt" timestamp (3) NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	CONSTRAINT "Group_conversationId_unique" UNIQUE("conversationId"),
	CONSTRAINT "Group_member_bounds" CHECK ("Group"."memberCount" >= 0 AND "Group"."memberCount" <= "Group"."maxMembers"),
	CONSTRAINT "Group_max_members_range" CHECK ("Group"."maxMembers" BETWEEN 2 AND 1000)
);
--> statement-breakpoint
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_Group_id_fk" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Group" ADD CONSTRAINT "Group_languageId_Language_id_fk" FOREIGN KEY ("languageId") REFERENCES "public"."Language"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Group" ADD CONSTRAINT "Group_ownerId_User_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Group" ADD CONSTRAINT "Group_conversationId_Conversation_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "GroupMember_userId_status_idx" ON "GroupMember" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX "GroupMember_groupId_status_idx" ON "GroupMember" USING btree ("groupId","status");--> statement-breakpoint
CREATE INDEX "Group_languageId_idx" ON "Group" USING btree ("languageId");--> statement-breakpoint
CREATE INDEX "Group_ownerId_idx" ON "Group" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX "Group_live_idx" ON "Group" USING btree ("deletedAt","updatedAt");