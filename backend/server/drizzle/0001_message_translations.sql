CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "MessageTranslation" (
  id text PRIMARY KEY,
  "messageId" text NOT NULL REFERENCES "Message"(id) ON DELETE CASCADE,
  "targetLang" text NOT NULL,
  "sourceHash" text NOT NULL,
  "providerVersion" text NOT NULL,
  text text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "MessageTranslation_cache_uidx"
  ON "MessageTranslation" ("messageId", "targetLang", "sourceHash", "providerVersion");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "MessageTranslation_messageId_idx"
  ON "MessageTranslation" ("messageId");
--> statement-breakpoint
INSERT INTO "MessageTranslation" (
  id,
  "messageId",
  "targetLang",
  "sourceHash",
  "providerVersion",
  text,
  "createdAt",
  "updatedAt"
)
SELECT
  md5(m.id || ':' || lower(m."translatedLang") || ':' || encode(digest(src.source_text, 'sha256'), 'hex')),
  m.id,
  lower(m."translatedLang"),
  encode(digest(src.source_text, 'sha256'), 'hex'),
  'legacy-unknown',
  m."translatedContent",
  m."createdAt",
  m."updatedAt"
FROM "Message" m
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN m.type IN ('VOICE', 'VIDEO') THEN NULLIF(btrim(COALESCE(m.transcript, '')), '')
    WHEN m.type = 'IMAGE' THEN NULLIF(btrim(COALESCE(m.caption, '')), '')
    ELSE NULLIF(btrim(m.content), '')
  END AS source_text
) src
WHERE m."translatedContent" IS NOT NULL
  AND btrim(m."translatedContent") <> ''
  AND m."translatedLang" IS NOT NULL
  AND btrim(m."translatedLang") <> ''
  AND src.source_text IS NOT NULL
ON CONFLICT ("messageId", "targetLang", "sourceHash", "providerVersion") DO NOTHING;
