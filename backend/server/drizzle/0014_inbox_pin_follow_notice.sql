CREATE TYPE "public"."NotificationType" AS ENUM('CORRECTION', 'REFERENCE');--> statement-breakpoint
ALTER TYPE "public"."MessageType" ADD VALUE 'SYSTEM';--> statement-breakpoint
CREATE TABLE "Notification" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" "NotificationType" NOT NULL,
	"actorId" text NOT NULL,
	"conversationId" text,
	"dedupeKey" text NOT NULL,
	"createdAt" timestamp (3) NOT NULL,
	"readAt" timestamp (3)
);
--> statement-breakpoint
ALTER TABLE "ConversationParticipant" ADD COLUMN "pinnedAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_User_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification" USING btree ("dedupeKey");--> statement-breakpoint
CREATE INDEX "Notification_user_createdAt_idx" ON "Notification" USING btree ("userId","createdAt");