CREATE TABLE "Follow" (
	"followerId" text NOT NULL,
	"followeeId" text NOT NULL,
	"createdAt" timestamp (3) NOT NULL,
	CONSTRAINT "Follow_followerId_followeeId_pk" PRIMARY KEY("followerId","followeeId"),
	CONSTRAINT "Follow_no_self" CHECK ("Follow"."followerId" <> "Follow"."followeeId")
);
--> statement-breakpoint
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_User_id_fk" FOREIGN KEY ("followerId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followeeId_User_id_fk" FOREIGN KEY ("followeeId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Follow_followeeId_idx" ON "Follow" USING btree ("followeeId");--> statement-breakpoint
CREATE INDEX "Follow_follower_createdAt_idx" ON "Follow" USING btree ("followerId","createdAt");