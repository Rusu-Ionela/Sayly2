UPDATE "Message" SET "content" = split_part("content", '?', 1) WHERE "type" <> 'TEXT' AND "content" LIKE '/media/files/%?%';--> statement-breakpoint
UPDATE "Message" SET "thumbnailUrl" = split_part("thumbnailUrl", '?', 1) WHERE "thumbnailUrl" LIKE '/media/files/%?%';--> statement-breakpoint
UPDATE "Profile" SET "profileImageUrl" = split_part("profileImageUrl", '?', 1) WHERE "profileImageUrl" LIKE '/media/files/%?%';--> statement-breakpoint
UPDATE "User" SET "photoUrl" = split_part("photoUrl", '?', 1) WHERE "photoUrl" LIKE '/media/files/%?%';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Message_media_content_idx" ON "Message" USING btree ("content") WHERE "Message"."type" <> 'TEXT';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Message_thumbnailUrl_idx" ON "Message" USING btree ("thumbnailUrl") WHERE "Message"."thumbnailUrl" is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Profile_profileImageUrl_idx" ON "Profile" USING btree ("profileImageUrl") WHERE "Profile"."profileImageUrl" is not null;
