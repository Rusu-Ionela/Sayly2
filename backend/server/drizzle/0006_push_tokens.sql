CREATE TABLE "PushToken" (
	"token" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"platform" text NOT NULL,
	"createdAt" timestamp (3) NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "PushToken_userId_idx" ON "PushToken" USING btree ("userId");