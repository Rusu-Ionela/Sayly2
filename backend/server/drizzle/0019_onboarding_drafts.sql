-- Server-side resume state for incomplete onboarding. The JSON payload is validated
-- at the API boundary and deleted in the same transaction as completed onboarding.
CREATE TABLE "OnboardingDraft" (
  "userId" text PRIMARY KEY NOT NULL,
  "step" text DEFAULT 'profile' NOT NULL,
  "questionIndex" integer DEFAULT 0 NOT NULL,
  "draft" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "OnboardingDraft" ADD CONSTRAINT "OnboardingDraft_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
