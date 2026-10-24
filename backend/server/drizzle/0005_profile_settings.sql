CREATE TYPE "public"."CefrLevel" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2');--> statement-breakpoint
CREATE TABLE "LanguageCertificate" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"languageId" text NOT NULL,
	"level" "CefrLevel" NOT NULL,
	"title" text NOT NULL,
	"issuedYear" integer,
	"createdAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UserSettings" (
	"userId" text PRIMARY KEY NOT NULL,
	"showOnlineStatus" boolean DEFAULT true NOT NULL,
	"showLocation" boolean DEFAULT true NOT NULL,
	"notifyMessages" boolean DEFAULT true NOT NULL,
	"notifyConnectionRequests" boolean DEFAULT true NOT NULL,
	"notifyGroupActivity" boolean DEFAULT true NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "city" text;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "topics" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "photos" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "isPro" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "LanguageCertificate" ADD CONSTRAINT "LanguageCertificate_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "LanguageCertificate" ADD CONSTRAINT "LanguageCertificate_languageId_Language_id_fk" FOREIGN KEY ("languageId") REFERENCES "public"."Language"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "LanguageCertificate_userId_idx" ON "LanguageCertificate" USING btree ("userId");