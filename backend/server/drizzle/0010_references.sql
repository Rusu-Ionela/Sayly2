CREATE TABLE "Reference" (
	"id" text PRIMARY KEY NOT NULL,
	"authorId" text NOT NULL,
	"subjectId" text NOT NULL,
	"body" text NOT NULL,
	"createdAt" timestamp (3) NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	CONSTRAINT "Reference_no_self" CHECK ("Reference"."authorId" <> "Reference"."subjectId")
);
--> statement-breakpoint
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_authorId_User_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_subjectId_User_id_fk" FOREIGN KEY ("subjectId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "Reference_authorId_subjectId_key" ON "Reference" USING btree ("authorId","subjectId");--> statement-breakpoint
CREATE INDEX "Reference_subject_createdAt_idx" ON "Reference" USING btree ("subjectId","createdAt");