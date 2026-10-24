DROP INDEX "ConversationParticipant_userId_idx";--> statement-breakpoint
DROP INDEX "DirectConversation_conversationId_idx";--> statement-breakpoint
DROP INDEX "MessageTranslation_messageId_idx";--> statement-breakpoint
DROP INDEX "Message_conversationId_idx";--> statement-breakpoint
DROP INDEX "Message_conversationId_createdAt_idx";--> statement-breakpoint
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_conversationId_Conversation_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_replacedById_RefreshToken_id_fk" FOREIGN KEY ("replacedById") REFERENCES "public"."RefreshToken"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Report" ADD CONSTRAINT "Report_messageId_Message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_size_nonneg" CHECK ("MediaAsset"."size" >= 0);--> statement-breakpoint
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_gender_valid" CHECK ("Profile"."gender" in ('MALE', 'FEMALE'));