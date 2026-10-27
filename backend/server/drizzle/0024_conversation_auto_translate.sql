-- Per-member, per-chat "translate incoming messages automatically". Additive and idempotent.
ALTER TABLE "ConversationParticipant" ADD COLUMN IF NOT EXISTS "autoTranslate" boolean DEFAULT false NOT NULL;
