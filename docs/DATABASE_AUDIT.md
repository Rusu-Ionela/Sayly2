# Database Engineering Audit — Sayly backend

Audit date: 2026-10-22. Method: static review of the repository only. **No live database was contacted** (project notes say the Supabase URL must not be touched without explicit approval), so nothing here is measured. Items that need a live database or an `EXPLAIN` are labelled *hypothesis* or listed in §20.

> **Update 2026-10-22 (after read-only inspection and applying migrations to Supabase).**
> - `drizzle.__drizzle_migrations` **did exist but was empty** (the "no history table" note was out of date). It now holds 15 rows (0000–0006, 0008–0015). `0007_drop_connections` is deliberately not recorded: the live `Connection` table still has 2 rows.
> - Applied to live: `0013` (3 indexes; its URL clean-up rewrote 0 rows), `0014` (Notification table, `pinnedAt`, `SYSTEM` message type) and `0015` (5 redundant indexes dropped; foreign keys on `Report.messageId`, `Notification.conversationId`, `RefreshToken.replacedById`; CHECKs on `Profile.gender`, `MediaAsset.size`). `UserLanguage_userId_idx` was **kept**: it has 1,275 scans, so my "redundant" call was wrong in practice.
> - Live still has objects the schema does not know about (tables `Connection`, `ConversationTopic`, `ProfileView`, `SupportTicket`; columns `User.saylyId/visitorsSeenAt`, `UserSettings.showSaylyId/showCertificates/translateTo`, `SavedPhrase.example/expressionId`). They were left untouched.
> - F-07 is now confirmed drift: `User.photoUrl` is null while `Profile.profileImageUrl` is set for 2 of 8 users.
> - F-13 (split `messaging/repository.ts`) is done: `conversations.repository.ts`, `messages.repository.ts`, `messageDto.ts`, with `repository.ts` re-exporting them.

No source file or database row was changed. This report is the only file written.

---

## 1. Executive summary

The database layer is in better shape than most projects of this size. The auth/refresh-token flow, group membership quotas, message idempotency and block checks all use real row locks, unique indexes and transactions, and the SQL is parameterised throughout (no injection path found). The main risks are not in the query code but around it:

| # | Headline | Sev |
|---|----------|-----|
| F-01 | The migration chain cannot build a fresh database, and the live database has no migration history | **P1** |
| F-02 | Discovery ranking scores every eligible user on every page (hypothesis, fine today) | **P1** |
| F-03 | `Profile.age` is stored, so it goes stale after a birthday | P2 |
| F-04 | Lock-order inversion between account deletion and joining a group | P2 |
| F-05 | Non-production 500 responses include SQL text; `NODE_ENV` defaults to `development` | P2 |
| F-06 | Only unique violations are classified; deadlocks, FK and timeout errors become generic 500s | P2 |
| F-07 | `User.displayName/bio/photoUrl` duplicate `Profile` | P2 |
| F-08 | Eight redundant or low-value indexes, three of them on the hottest write table | P2 |
| F-09 | Missing FKs and CHECK constraints on several columns | P2 |
| F-10 | No test connects to real Postgres | P2 |
| F-11 | Media reclaim runs regex scans over `Message` inside a locked transaction (hypothesis) | P2 |

No P0 (data loss, auth bypass) was found. Section 18 has the full ranked table.

---

## 2. Current database architecture

**Facts (verified in files):**
- Engine: PostgreSQL. Dialect `postgresql` (`backend/server/drizzle.config.ts`).
- `drizzle-orm ^0.45.2`, `drizzle-kit ^0.31.10`, driver `pg ^8.23.0` (`package.json`).
- One schema file: `src/db/schema.ts` (24 tables, 13 enums). One client: `src/db/client.ts`.
- Pool: `max` from `DB_POOL_MAX` (default 10), connect timeout 5 s, idle 30 s, `statement_timeout` 10 s, `query_timeout` 12 s.
- No multi-tenancy; one `UserRole` enum (`USER`, `ADMIN`). No `ADMIN`-only DB paths were found.
- Shutdown calls `closeDb()` (`src/index.ts:77`).

```
Expo app (React Native)
   ↓ HTTPS / Socket.IO
Express routes  (features/*/routes.ts)  + Socket.IO handlers (lib/socket.ts, messaging/socket.ts, calls/socket.ts)
   ↓ authenticate middleware, zod validation, rate limiters (Redis or in-memory)
controllers (features/*/controller.ts)
   ↓
services (thin; messaging/service.ts only forwards to repository)
   ↓
repositories (features/*/repository.ts) — queries live HERE, plus a few in service/controller-level files
   ↓ drizzle-orm/node-postgres  (db, db.query relational API, db.transaction)
pg.Pool (max 10, statement_timeout 10 s)
   ↓
PostgreSQL (Supabase, per project notes — not verifiable from the repo)
```

Query code is **not** confined to repositories: `auth/repository.ts`, `messaging/learning.ts`, `messaging/corrections.ts`, `media/service.ts`, `users/settings.ts` and `calls/socket.ts` import `db` directly.

**Migration strategy:** hand-reviewed SQL under `drizzle/` (0000–0014) plus Drizzle snapshots (0003 onward). Live DB changes have been applied by one-off scripts, not `drizzle-kit migrate` (project notes). Three `scripts/ensure-*.ts` files contain hand-written DDL.

---

## 3. Schema inventory

24 tables. FK actions as declared in `schema.ts`. "NA" = `NO ACTION` (Drizzle default).

| Table | Purpose | Notable constraints / indexes |
|---|---|---|
| User | Account, auth state | unique email; idx status, role (low cardinality); `authVersion` |
| RefreshToken | Rotating refresh tokens | FK user CASCADE; unique tokenHash; idx user/family/expiresAt; `replacedById` no FK |
| PasswordResetToken | Reset challenges | FK user CASCADE; unique challengeHash |
| Profile | Public profile | `userId` unique, FK NA; arrays for goals/topics/photos; `age` stored |
| UserSettings | Privacy/notify toggles | PK = userId, CASCADE |
| PushToken | Expo tokens | PK token; FK CASCADE |
| Notification (new) | In-app inbox | unique dedupeKey; idx (user, createdAt); `conversationId` no FK |
| LanguageCertificate | Self-reported CEFR | CASCADE user; FK language NA |
| Language | Catalogue | unique code |
| UserLanguage | Spoken/learning | unique (user, language, type); partial unique "one native" |
| Conversation | Chat container | `lastMessageId` no FK |
| ConversationParticipant | Direct-chat members; `pinnedAt` (new) | unique (conv, user) |
| Message | Chat messages | partial unique (sender, clientMessageId); 8 indexes |
| MessageTranslation | Translation cache | unique cache key; CASCADE message |
| MessageCorrection | Partner corrections | CASCADE message; no uniqueness |
| SavedPhrase | Saved expressions | SET NULL on message |
| Block | Blocks | unique pair; CHECK no self |
| Follow | One-way follow | composite PK; CHECK no self; both CASCADE |
| Reference | Profile reference | unique (author, subject); CHECK no self |
| DirectConversation | Canonical pair → conversation | PK (low, high); CHECK low < high; unique conversationId |
| MediaAsset | Upload registry | unique storageKey; `kind`/`purpose` free text |
| Report | User/message reports | `messageId` no FK; `reason` free text; no status |
| Group | Practice group | CHECK member bounds; soft delete; denormalised `memberCount` |
| GroupMember | Membership | composite PK; CASCADE both |

Relations declared with Drizzle `relations()` exist only for user/profile/settings/languages/conversations/messages. FK constraints are declared separately with `.references()`; I checked that every `relations()` pair used by `db.query` has a real FK behind it.

---

## 4. Critical findings (P1)

### F-01 — Migration chain cannot create a fresh database (P1, confidence High for files)
- **Evidence:** `drizzle/0000_baseline.sql` creates enums inside `DO $$ … EXCEPTION WHEN duplicate_object` blocks (e.g. `AuthProvider`, line 12). `drizzle/0003_thin_black_bird.sql` is a full re-baseline with plain `CREATE TYPE "public"."AuthProvider"` and `CREATE TABLE "Block"` (lines 1–11). Running 0000→0003 on an empty database therefore fails at 0003. Snapshots exist only for 0003–0014; 0000–0002 have none.
- **Live state (from project notes, not re-verified today):** Supabase has no `drizzle.__drizzle_migrations` table, so `drizzle-kit migrate` would try to replay everything.
- **Also:** `package.json` exposes `db:push` and `db:migrate`; both are unsafe here. `scripts/ensure-*.ts` apply DDL outside the migration history.
- **Impact:** a staging or disaster-recovery database cannot be rebuilt from the repo; schema drift is undetectable.
- **Fix (no change to applied history):** do not edit 0000–0013. Produce a verified `schema.sql` snapshot from the live DB (read-only `pg_dump --schema-only`), commit it as the bootstrap path, and seed `__drizzle_migrations` for 0000–0013 once, with approval. Remove or guard `db:push`.
- **Data-loss risk:** none for the plan above; high if anyone runs `db:migrate`/`db:push` today.
- **Tests:** a CI job that builds an empty Postgres from the bootstrap + pending migrations and diffs it against `schema.ts`.

### F-02 — Discovery ranking cost grows with the user table (P1 *hypothesis*)
- **Where:** `features/discovery/repository.ts` — `matchScoreSql` (~line 112), `discoverPartners` (~328–470).
- **Current behaviour:** the score is a SQL `CASE` with up to seven correlated subqueries over `UserLanguage` (3 `EXISTS`, 4 counts) plus an array `INTERSECT`. It is used in `ORDER BY` (so every eligible row is scored before `LIMIT/OFFSET`) and again, for the `MUTUAL` filter, in a separate `COUNT(*)` with the same `WHERE`. A second `db.query.users.findMany` then loads the page.
- **Why it matters:** each page request is O(eligible users × subqueries). At today's volume this is fine, and the code comment says so (line ~376). It will degrade first as users grow.
- **Evidence status:** static only. No `EXPLAIN` was possible.
- **Options, in order of cost:** (1) add index `UserLanguage (languageId, type) INCLUDE (userId)` — supports the `languageId IN (...)` probes; (2) skip the `COUNT` unless the client needs a total; (3) keyset pagination on (score, displayName, id) as the comment suggests; (4) precompute scores only if (1)–(3) are not enough.
- **Migration:** (1) is additive and low risk (`CREATE INDEX CONCURRENTLY`).

---

## 5. Schema design problems

- **F-03 `Profile.age` is derived data stored as data (P2, confirmed).** `profiles.age` (`schema.ts:157`) is written only when `dateOfBirth` is edited (`users/repository.ts:373`, `:526`) and read into DTOs (`discovery/repository.ts:454`, `users/dto.ts:163`). After a birthday the stored age is wrong until the user re-saves their date of birth. *Fix without migration:* compute `ageFromDateOfBirth(dateOfBirth)` in the DTO mappers. Drop the column later with expand→contract.
- **F-07 `User` duplicates `Profile` (P2).** `users.displayName/bio/photoUrl` are mirrored from `Profile` (`users/repository.ts:199–201, 348, 423, 557, 604`; `media/service.ts:92` reads `users.photoUrl`). Two writers, one truth, a drift risk. *Fix:* stop reading `users.*`; later drop columns (expand→contract). Not urgent.
- **F-09 Missing integrity constraints (P2/P3).**
  - No FK: `Report.messageId` (`:615`), `Notification.conversationId` (`:244`), `RefreshToken.replacedById` (`:101`), `Conversation.lastMessageId` (`:332`, circular — a deferred FK or leave and document).
  - Text columns that behave as enums with no CHECK: `Profile.gender` (comment says MALE/FEMALE, `:150`), `Report.reason` (`:616`), `MediaAsset.kind/purpose`, `PushToken.platform`. The API validates these (zod), so this is defence in depth, not a live bug.
  - Numeric ranges: `Profile.age`, `MediaAsset.size` have no CHECK. `Group` has good CHECKs — use it as the pattern.
  - *Fix:* add `NOT VALID` CHECKs and FKs, then `VALIDATE` (no long lock). Only for columns where bad data is plausible.
- **No uniqueness on `MessageCorrection`** — a partner can add unlimited corrections to one message. Probably intended (history); confirm.
- **Report has no status/reviewer columns.** Correct for now; needed before any moderation tooling.
- **Cascade policy is mixed (P3).** New-style tables cascade (Follow, Reference, Notification, GroupMember, UserSettings); older ones use NO ACTION (Profile, UserLanguage, Message, Participant, Block, Report). I found no hard-delete path (`delete(users)` does not exist; accounts are soft-deleted), so this is latent. Document the rule: *accounts are never hard-deleted; if they ever are, chat history must not cascade.*
- **Normalisation:** the schema is mostly 3NF. Intentional denormalisation that is justified and guarded: `Group.memberCount` (CHECK + row lock), `Conversation.lastMessageAt`, `DirectConversation` canonical pair. Arrays on `Profile` (goals/topics/photos) are acceptable at these sizes; they only hurt if you must query by topic at scale (then use a junction table or GIN index — not needed now).

---

## 6. Drizzle ORM issues

- No deprecated APIs or `any` abuse found in the query layer; `relations()` usage is consistent with the installed 0.45 API.
- Relations ≠ constraints: confirmed that every relation used by `db.query` is backed by a real FK. (`usersRelations.profile` declares `fields` on the non-FK side; it works, but Drizzle's docs put `fields` on the FK side. Cosmetic.)
- Raw SQL (21 sites) is parameterised through `sql` templates; the only dynamic fragment is the media regex built from storage keys, which are validated alphanumeric (`media/service.ts:62`, comment + `safeStorageKey`). No injection path found.
- `timestamp` columns are `timestamp(3) without time zone`, `mode: "date"`. Drizzle interprets these as UTC, so behaviour is correct, but it relies on a UTC convention (P3).
- Most `createdAt` defaults are `$defaultFn(() => new Date())` (application clock), while `Language` and `UserLanguage` use DB `defaultNow()`. With several API instances, clock skew can reorder `Message.createdAt` slightly; ordering stays deterministic because every cursor ends in `id` (P3, hypothesis).
- Types: `schema.ts` exports `$inferSelect` aliases for 16 tables; DTOs are separate (`features/*/dto.ts`). That separation is justified — keep it.

---

## 7. Duplicate database logic

| Logic | Locations | Verdict |
|---|---|---|
| "Neither user blocked the other" subquery | was copied in 5 places | **Consolidated this session** into `safety/blockFilter.ts` (`notBlockedBetween`) |
| `escapeIlike` | `discovery/repository.ts:60`, `groups/repository.ts:40` | identical → extract to `shared/` (trivial, safe) |
| `requireRow` | `auth/repository.ts:25`, `messaging/repository.ts:44`, `safety/repository.ts:21` | identical → extract (trivial) |
| `SELECT id FROM users WHERE id=? FOR UPDATE` (row lock) | 5 files (`groups:293`, `languages:160`, `media:132`, `safety:73–74`, `users:205/591`) | extract `lockUser(tx, id)`; **also centralises lock ordering** (see F-04) |
| "target must be ACTIVE and not blocked, else 404" | `follows/repository.ts` `assertCanFollow`, `references/repository.ts` `assertSubjectVisible` | behaviour equivalent → one helper in `safety/` |
| Page-based pagination (`limit+1`, `hasMore`) | follows, references, inbox, groups, discovery | same shape; a 5-line helper is justified, a generic repository is not |

Do **not** merge `discoverPartners` with the other list queries; the business rules differ.

---

## 8. Query performance problems

- **F-02** (above) is the only significant one.
- **OFFSET pagination** with a separate count: discovery, groups, follows, references, inbox, and message history when `page` is supplied (`messaging/repository.ts` `listMessagesByOffset`, `page ≤ 100` by `schema.ts:57`). Small per-user lists are fine; message history already has a cursor mode and is the default path.
- `listConversations` runs a grouped unread count over the page's conversations, served by the partial index `Message_unread_conversationId_senderId_idx`. Fine.
- N+1: none found. `discoverPartners` uses a two-step id-then-`inArray` load, which is the right pattern.
- `ILIKE '%term%'` on `Profile.displayName` and on `Group.name/description/audience` cannot use a B-tree; it is a sequential scan. Acceptable at current size; add a `pg_trgm` GIN index if search becomes slow (*hypothesis*).
- **F-11 (P2, hypothesis):** `reclaimUnusedMedia` (`media/service.ts:62–95`) runs `messages.content ~ pattern`, `messages.thumbnailUrl ~ pattern`, and regex over `profiles` / `users.photoUrl`. A regex cannot use the partial B-tree `Message_media_content_idx`, so it scans `Message`. It runs inside `db.transaction` while `createOwnedUpload` holds the owner row `FOR UPDATE` (`:132`). Cost scales with the whole `Message` table, and the 10 s `statement_timeout` would turn it into an upload error. *Check:* `EXPLAIN` it on a copy; if confirmed, look up references by exact path (`content IN (...)`, which the index serves) instead of regex.

---

## 9. Indexing recommendations

No index below should be dropped before checking `pg_stat_user_indexes` on the live DB (`idx_scan = 0` over a full traffic cycle).

**Redundant (prefix of another index) — candidates to drop (F-08, P2):**

| Index | Covered by |
|---|---|
| `Message_conversationId_idx` | `Message_conversationId_createdAt_idx`, `Message_history_order_idx`, unread partial index |
| `Message_conversationId_createdAt_idx` | `Message_history_order_idx (conversationId, createdAt, id)` |
| `UserLanguage_userId_idx` | unique `(userId, languageId, type)` |
| `ConversationParticipant_userId_idx` | `(userId, lastMessageAt)` |
| `DirectConversation_conversationId_idx` | the `unique()` on the same column (`schema.ts:572`) |
| `MessageTranslation_messageId_idx` | unique cache key starting with `messageId` |

`Message` is the hottest write table (every chat message and every status update writes to each index), so trimming it has the best payoff. Expected benefit is lower write amplification and storage — an estimate, not a measurement.

**Low value:** `User_status_idx`, `User_role_idx` (two or three distinct values; rarely selective).

**Candidate to add (needs `EXPLAIN` first):** `UserLanguage (languageId, type) INCLUDE (userId)` for discovery (F-02). Existing coverage: unique `(userId, languageId, type)` (good for "this user's rows") and `UserLanguage_languageId_idx`.

**Keep:** the partial indexes on `Message` (unread, media content, thumbnail) and `Message_history_order_idx`; they match real queries I traced.

---

## 10. Transactions and concurrency

**Done well (verified):** refresh-token rotation locks parent token and user (`auth/repository.ts:140–232`) with reuse detection and a grace window; password-reset consume locks challenge and user; message send is idempotent via the partial unique `(senderId, clientMessageId)` and handles the race by catching the unique violation (`messaging/repository.ts`); direct-conversation creation handles the pair race the same way; group joins lock the group row and keep `memberCount` consistent under a CHECK; block creation locks both users in sorted order (`safety/repository.ts:72`); the new follow notice reuses `insertMessage` and its unique key.

- **F-04 Lock-order inversion (P2, confirmed in code, rare in practice).**
  - `softDeleteAccount` locks the **user** row, then `removeUserFromAllGroups` locks each **group** row (`users/repository.ts:586–600`, `groups/repository.ts:342–349`).
  - `joinGroup` locks the **group** row (`lockGroup`), then `assertMembershipQuota` locks the **user** row (`groups/repository.ts:414–418`, `:293`).
  - Concurrent delete + join by the same user can deadlock; Postgres aborts one with `40P01`, which the app does not map or retry → generic 500 (see F-06).
  - *Fix:* always take the user lock first (call `assertMembershipQuota` before `lockGroup` in `joinGroup`), or centralise in `lockUser`.
- **P3 — read-modify-write on `authVersion`:** `softDeleteAccount` and `changePassword` write `user.authVersion + 1` from a read taken **before** the transaction (`users/repository.ts:601, 670`). `changePassword` is guarded by a password-hash equality check; `softDeleteAccount` checks `status` outside the lock. Practical impact is negligible (both writers bump the same value and revoke tokens), but `SET authVersion = authVersion + 1` is the correct form.
- **Pins (new):** two parallel pin requests can exceed the 3-pin limit by one; the list query hard-caps at 3 (`LIMIT`). Acceptable; a partial-unique or advisory lock would be over-engineering.
- No unbounded long transactions found; the media transaction (F-11) is the longest.

---

## 11. Security and authorization

- SQL injection: none found (all values parameterised; regex input restricted to validated keys).
- Ownership checks live at the query/service boundary: every chat read goes through `assertCanAccessConversation` (membership + both users ACTIVE + not blocked, with a 404 that hides block status); follows, references, reports and pins do the same; group actions use `policy.*`. Group conversations have no `ConversationParticipant` rows, so the direct-chat endpoints reject them. I found no cross-user read/write path.
- Public DTOs are built from explicit column lists (discovery states "never load email/passwordHash"); `db.query.users.findFirst` in `softDeleteAccount` and `changePassword` loads full rows but they stay server-side.
- **F-05 (P2, conditional):** `middleware/errorHandler.ts` returns `err.message` and `err.cause.message` to the client for any 500 when `!env.isProduction`. Drizzle puts "Failed query: … params: …" there. `NODE_ENV` **defaults to `development`** (`config/env.ts:35`), so a deployment that forgets to set it would leak SQL and bound parameters. *Fix:* default unknown/unset to the safe behaviour, or require `NODE_ENV` in non-local deployments.
- Soft delete (P3): `softDeleteAccount` does not delete the user's `PushToken` rows (the cascade only fires on hard delete). Messaging to a deleted user is blocked by status checks, so there is no practical leak, but the device stays linked to the dead account id.
- Not verified: database role privileges (Supabase `service_role` vs app role), RLS. The app connects with one pool identity, so RLS would not currently help; authorization is application-side by design.

---

## 12. Migration safety

- F-01 is the main item.
- 0000–0002 have no snapshots; 0003 is a re-baseline (`ConversationType` there is `('DIRECT')` only; `GROUP` arrives in 0004, correctly).
- `0014_inbox_pin_follow_notice.sql` (written this session, **not applied**) contains `ALTER TYPE "MessageType" ADD VALUE 'SYSTEM'`. That is safe on PostgreSQL ≥ 12 inside a transaction as long as nothing in the same transaction uses the new value — true here. It also adds a table and a nullable column (no table rewrite, no long lock).
- `GET /conversations` now selects `ConversationParticipant.pinnedAt`; deploying the backend before applying 0014 breaks the chat list. Apply first (expand), deploy second.
- Env mismatch (P3): `drizzle.config.ts` reads `DIRECT_URL || DATABASE_URL`; `config/env.ts:148` and `.env.example` define `DATABASE_MIGRATE_URL` instead, and `databaseMigrateUrl` is never used. Migrating through a pooled URL is a known foot-gun.

---

## 13. Scalability assessment

- Single API instance assumed (rate limiter has an in-memory fallback; Redis is optional). Pool max 10 is reasonable behind Supabase's pooler; no per-request clients are created.
- First limits, in likely order: discovery ranking (F-02); `Message` write amplification (F-08); media regex scans (F-11).
- Not recommended now: replicas, partitioning, queues, caching. Message partitioning or archival would only matter at tens of millions of rows.
- Retention: `src/index.ts` already sweeps expired `RefreshToken` and `PasswordResetToken` rows daily (`pruneExpiredTokens`). *(An earlier draft of this report wrongly said no cleanup existed.)* Only the new `Notification` inbox lacked one; it is now pruned after 90 days by the same job.

---

## 14. Code quality

Clean feature folders, small repositories, thin services, consistent error type (`AppError`). Weak spots: direct `db` imports in non-repository files (listed in §2), the three `requireRow` copies, and `messaging/repository.ts` (~840 lines) mixing conversations, messages, receipts and presence checks.

---

## 15. Data integrity assessment

Strong: self-reference CHECKs (Block, Follow, Reference), canonical-pair CHECK, one-native-language partial unique, group member bounds, message idempotency, notification dedupe. Gaps are F-03, F-09 and the unvalidated text-as-enum columns. Money: none in the schema (no billing yet; `User.isPro` is a boolean flag).

---

## 16. Testing gaps

- 27 test files, all unit/route tests with the DB client or repository mocked. **No test connects to Postgres** (grep found no test containers, no `DATABASE_URL` use).
- Missing, in priority order: (1) migration bootstrap on empty Postgres (F-01); (2) constraint tests — unique idempotency key, dedupeKey, CHECKs; (3) concurrency — two parallel `sendMessage` with one `clientMessageId`, parallel refresh rotation, delete-vs-join (F-04); (4) pagination determinism with equal timestamps; (5) pin-limit and pinned-first ordering on a real DB; (6) authorization: user A cannot read/pin/correct a conversation of B.
- Use a real Postgres (Docker/Testcontainers); an in-memory substitute would not reproduce partial indexes or locking.

---

## 17. Proposed architecture (targeted, no rewrite)

1. Keep `schema.ts` as one file until it passes roughly 1,000 lines, then split by feature with a barrel export; no behaviour change.
2. Put shared query fragments next to their owner: `safety/blockFilter.ts` (done), plus `lockUser`, `escapeIlike`, `requireRow`, `assertActiveAndNotBlocked`.
3. Move the direct `db` imports in `learning.ts`, `corrections.ts`, `settings.ts` behind their feature's repository when each file is next touched.
4. One error mapper for Postgres SQLSTATE: `23505`→409, `23503`→409/404, `40001`/`40P01`→bounded retry (idempotent operations only) then 503, `57014`→503. Extend `db/errors.ts`, call from `errorHandler`.
5. Derive `age` at read time; keep `dateOfBirth` as the single source.
6. Expand→contract for the `User` mirror columns.

---

## 18. Ranked findings

| ID | Sev | Where | Problem | Fix | Needs migration | Confidence |
|---|---|---|---|---|---|---|
| F-01 | P1 | `drizzle/0000…0003`, `package.json` scripts | Chain can't build a fresh DB; no history table live | Bootstrap snapshot + seed history (approved); guard `db:push` | No schema change | High (files) |
| F-02 | P1 | `discovery/repository.ts` | O(users) scoring per page | Index, drop count, keyset | Index only | Hypothesis |
| F-03 | P2 | `schema.ts:157`, `users/repository.ts:373,526` | Stored age goes stale | Compute in DTO | No (drop column later) | High |
| F-04 | P2 | `users/repository.ts:586`, `groups/repository.ts:293,414` | Lock-order inversion | Lock user first | No | High (code), rare |
| F-05 | P2 | `errorHandler.ts`, `env.ts:35` | SQL detail in non-prod 500s; unsafe default | Safe default | No | High |
| F-06 | P2 | `db/errors.ts`, `errorHandler.ts` | Only 23505 handled | SQLSTATE mapper + bounded retry | No | High |
| F-07 | P2 | `schema.ts` User vs Profile | Duplicate columns | Expand→contract | Later | High |
| F-08 | P2 | `schema.ts` indexes | 6 redundant + 2 low-value | Drop after `pg_stat` check | Yes (drops) | Medium (static) |
| F-09 | P2/P3 | `schema.ts:101,244,332,615` etc. | Missing FKs/CHECKs | `NOT VALID` then `VALIDATE` | Yes | High |
| F-10 | P2 | `src/**/*.test.ts` | No real-DB tests | Testcontainers suite | No | High |
| F-11 | P2 | `media/service.ts:62–135` | Regex scans in locked tx | Exact-path lookup | No | Hypothesis |
| F-12 | P3 | `users/repository.ts:601,670` | `authVersion + 1` from stale read | `authVersion + 1` in SQL | No | High |
| F-13 | P3 | `users/repository.ts` softDelete | PushToken rows kept | Delete them | No | High |
| F-14 | P3 | `drizzle.config.ts` vs `env.ts` | Migrate-URL mismatch | Align names | No | High |
| F-15 | P3 | notifications | No retention job for inbox rows (tokens were already pruned) | Fixed: 90-day prune | No | High |
| F-16 | P3 | `schema.ts` | App-clock timestamps; UTC-by-convention | Prefer `defaultNow()` | Optional | Hypothesis |
| F-17 | P3 | 3 files | Duplicated helpers | Extract | No | High |

---

## 19. Refactoring roadmap

**Stage 1 — Security / integrity (no schema change):** F-05 safe `NODE_ENV` default; F-06 SQLSTATE mapper; F-13 delete push tokens on account deletion. *Verify:* unit tests per error class. *Recovery:* revert commit.

**Stage 2 — Concurrency:** F-04 lock order; F-12 SQL increment. *Verify:* a real-DB concurrency test (needs Stage 6 harness first, or run once manually). Low risk.

**Stage 3 — Performance:** `EXPLAIN` F-02 and F-11 on a copy; then the `UserLanguage` index (`CREATE INDEX CONCURRENTLY`), then drop redundant indexes in a separate release after `pg_stat_user_indexes` confirms. *Recovery:* recreate index (seconds–minutes).

**Stage 4 — Duplicate logic:** extract `escapeIlike`, `requireRow`, `lockUser`, `assertActiveAndNotBlocked`. Pure refactor, covered by existing tests.

**Stage 5 — Schema:** F-03 age at read (no migration) → later drop column; F-09 FKs/CHECKs via `NOT VALID` + `VALIDATE`; F-07 expand→contract. Needs backfill checks for existing bad rows before `VALIDATE`.

**Stage 6 — Tests / hardening:** F-01 bootstrap + CI schema-diff job; Testcontainers suite (§16); retention jobs (F-15); pool and slow-query metrics.

**Apply 0014 first** (additive), deploy the backend second.

---

## 20. Production readiness — what is verified, what is not

**Verified from the repo:** the items above.

**Not verifiable here — needs someone with access:**
- Live schema vs `schema.ts` (drift), live indexes and `pg_stat_user_indexes`, table sizes, `EXPLAIN` plans.
- Whether `drizzle.__drizzle_migrations` still doesn't exist (taken from notes dated 2026-10-18).
- Backups, point-in-time recovery, restore tests, monitoring, alerting, slow-query log, connection counts (Supabase dashboard).
- DB role privileges / RLS posture; whether `NODE_ENV=production` is set in the deployment.
- Real traffic volumes and table growth.

**Not production-ready on this evidence alone:** F-01 (no reproducible schema) and F-05 (conditional leak) should be resolved first; everything else is hardening.

---

## 21. Recommended next actions (safest order)

1. Verify `NODE_ENV=production` in the deployment; then fix the default (F-05).
2. Take a read-only schema dump of the live DB to resolve F-01, and approve the bootstrap plan.
3. Apply `0014_inbox_pin_follow_notice.sql` (needs your approval), then deploy the backend.
4. Add the SQLSTATE mapper (F-06) and fix lock order (F-04).
5. Run `EXPLAIN` for discovery and media reclaim on a copy of the data, then decide on indexes (F-02, F-08, F-11).
6. Add the real-Postgres test harness and the concurrency tests.

Waiting for your go-ahead before changing anything.
