-- Give reports an explicit moderation lifecycle and retain the last administrator action.
DO $$ BEGIN
  CREATE TYPE "public"."ReportStatus" AS ENUM('PENDING', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "status" "ReportStatus" NOT NULL DEFAULT 'PENDING';
--> statement-breakpoint
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "reviewerId" text;
--> statement-breakpoint
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "reviewedAt" timestamp (3);
--> statement-breakpoint
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "reviewNote" text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "Report" ADD CONSTRAINT "Report_reviewerId_User_id_fk"
    FOREIGN KEY ("reviewerId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Report_status_createdAt_idx" ON "Report" USING btree ("status", "createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Report_reviewerId_idx" ON "Report" USING btree ("reviewerId");
