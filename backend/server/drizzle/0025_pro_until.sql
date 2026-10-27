-- Temporary Sayly Pro (weekly friends-leaderboard reward). Additive and idempotent.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "proUntil" timestamp (3);
