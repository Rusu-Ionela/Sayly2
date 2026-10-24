-- Restore consent-based language-partner requests. `Follow` remains a separate,
-- one-way social action; no follow is reinterpreted as a request without consent.
DO $$ BEGIN
  CREATE TYPE "public"."ConnectionStatus" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE "Connection" (
  "id" text PRIMARY KEY NOT NULL,
  "requesterId" text NOT NULL,
  "recipientId" text NOT NULL,
  "status" "ConnectionStatus" DEFAULT 'PENDING' NOT NULL,
  "introMessage" text,
  "createdAt" timestamp (3) NOT NULL,
  "updatedAt" timestamp (3) NOT NULL,
  CONSTRAINT "Connection_no_self" CHECK ("Connection"."requesterId" <> "Connection"."recipientId")
);
--> statement-breakpoint
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_requesterId_User_id_fk" FOREIGN KEY ("requesterId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_recipientId_User_id_fk" FOREIGN KEY ("recipientId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "Connection_requesterId_recipientId_key" ON "Connection" USING btree ("requesterId", "recipientId");
--> statement-breakpoint
CREATE UNIQUE INDEX "Connection_unordered_pair_uidx" ON "Connection" USING btree (least("requesterId", "recipientId"), greatest("requesterId", "recipientId"));
--> statement-breakpoint
CREATE INDEX "Connection_recipient_status_order_idx" ON "Connection" USING btree ("recipientId", "status", "updatedAt");
--> statement-breakpoint
CREATE INDEX "Connection_requester_status_order_idx" ON "Connection" USING btree ("requesterId", "status", "updatedAt");
