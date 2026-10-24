# Sayly Backend — Features & API Guide

API server for the Sayly language-exchange app (Express + TypeScript).

| | |
|---|---|
| **Server root** | `backend/server/` |
| **Source** | `backend/server/src/` |
| **Stack** | Express, PostgreSQL + Drizzle ORM, Socket.IO, Zod validation, Jose JWTs, Argon2 passwords |

**Auth model:** short-lived JWT access tokens + rotating opaque refresh tokens (hashed in DB). Clients send `Authorization: Bearer <accessToken>` (no cookies).

Paths below are relative to `backend/server/src/` unless noted.

---

## Bootstrap & mounts

| File | Role |
|------|------|
| `index.ts` | dotenv → `createApp()` → HTTP server → `createSocketServer()` → listen |
| `lib/app.ts` | Express factory: helmet, CORS, JSON (5mb), logger, health, OpenAPI, routers, error handler |
| `lib/socket.ts` | Socket.IO + JWT handshake + messaging handlers |
| `config/env.ts` | Env (DB, JWT, swagger, rate limits, OpenAI, reset URL) |

### Router mount map (`createApp` in `lib/app.ts`)

| Mount | Router | Feature folder |
|-------|--------|----------------|
| `GET /health` | Inline `{ ok: true }` | — |
| Swagger (if enabled) | `mountOpenApi(app)` | `docs/` |
| `/auth` | `authRouter` | `features/auth/` |
| `/users` | `usersRouter` | `features/users/` |
| `/discover` | `discoveryRouter` | `features/discovery/` |
| `/conversations` | `conversationsRouter` (+ pin: `PUT/DELETE /:id/pin`) | `features/messaging/` |
| `/groups` | `groupsRouter` | `features/groups/` |
| `/learning` | `learningRouter` (saved phrases) | `features/messaging/` |
| `/blocks` | `blocksRouter` | `features/safety/` |
| `/follows` | `followsRouter` (one-way follow; replaced connections) | `features/follows/` |
| `/calls` | `callsRouter` | `features/calls/` |
| `/references` | `referencesRouter` | `features/references/` |
| `/reports` | `reportsRouter` | `features/safety/` |
| `/languages` | `languagesRouter` | `features/languages/` |
| `/locations` | `locationsRouter` | `features/locations/` |
| `/notifications` | `notificationsRouter` (push tokens + in-app inbox) | `features/notifications/` |
| `/media` | `mediaRouter` | `features/media/` |

Middleware order: `trust proxy` → helmet → cors → `express.json` → `requestLogger` → routes → `errorHandler`.

---

## Health & docs

### Health

- **`GET /health`** — public  
- Response: `{ "ok": true }`  
- Defined inline in `lib/app.ts`

### OpenAPI / Swagger

| Path | Purpose |
|------|---------|
| `docs/openapi.ts` | OpenAPI 3.1 “Sayly API” + Swagger UI |
| `docs/paths/*.paths.ts` | Path registrations |
| `docs/schemas/*.schemas.ts` | Shared schemas |
| `docs/HOW_TO_DOCUMENT_ENDPOINTS.md` | How to document endpoints |

Enabled via `ENABLE_SWAGGER` (default on outside production). UI at `SWAGGER_PATH` (default `/api-docs`); raw JSON at `{swaggerPath}/openapi.json`.

**Documented tags:** Auth, Languages, Discovery, Follows, Groups, References, Chat.  
**Thin / missing in OpenAPI:** password reset, many `/users/*` profile routes, blocks/reports, matching stubs, Socket.IO, `/messaging/*` aliases, health, static media files.

---

## Rate limiting

**Files:** `infra/limiter/limiter.ts`, `infra/limiter/middleware.ts` (Redis-backed; shared with Socket.IO). See `backend/server/SETUP.md`.

| Limiter | Applied to | Defaults |
|---------|------------|----------|
| Register / login / reset / refresh | Public auth routes (IP and hashed-email where needed) | See SETUP.md |
| `messageSendLimiter` | HTTP send and socket `send_message` | 120 / 60 seconds |
| Translate / transcribe / uploads / discovery / reports | Authenticated user id | See SETUP.md |

Exceeded → `AppError` 429 `RATE_LIMITED` with `Retry-After`. Redis outage → 503 `SERVICE_UNAVAILABLE` (not unlimited).

---

## Shared layer

### Middleware (`shared/middleware/`)

| File | Behavior |
|------|----------|
| `authenticate.ts` | Bearer → Jose verify (`features/auth/tokens`) → ACTIVE user → `req.user` / `req.userId` |
| `requireUserId.ts` | 401 if no user id |
| `errorHandler.ts` | `AppError` / Zod → `{ success: false, error: { code, message, fields? } }` |
| `requestLogger.ts` | requestId + HTTP logs when `ENABLE_DEV_LOGS` |
| `rateLimit.ts` | Compatibility re-exports of Redis limiters |

### Utils / errors / types

| Path | Role |
|------|------|
| `shared/errors/AppError.ts` | Typed codes + `notImplemented()` → 501 |
| `shared/utils/logger.ts` | Structured logs (email masking) |
| `shared/utils/pagination.ts` | Legacy limit/offset helper |
| `shared/utils/jwt.ts` | HMAC JWT verify used by **Socket.IO** handshake |
| `shared/types/express.d.ts` | `Request` augmentation |

> HTTP and Socket.IO auth both use Jose from `features/auth/tokens.ts`.

### DB (`db/`)

| File | Role |
|------|------|
| `client.ts` | `pg` Pool + Drizzle |
| `schema.ts` | Tables + enums |
| `errors.ts` | Unique-violation helper |

---

## DB schema (Drizzle) — `db/schema.ts`

### Enums

`UserStatus` (ACTIVE / INACTIVE / SUSPENDED / DELETED), `UserRole`, `AuthProvider`, `UserLanguageType` (SPEAKS / LEARNING), `ProficiencyLevel` (BEGINNER … NATIVE), `ConnectionStatus` (PENDING / ACCEPTED / DECLINED / CANCELLED), `ConversationType` (DIRECT), `MessageType` (TEXT / IMAGE / VOICE / VIDEO), `MessageStatus` (SENT / DELIVERED / READ).

### Tables

| Table var | PG name | Purpose |
|-----------|---------|---------|
| `users` | `User` | Account, displayName, status, onboardingCompleted, lastSeenAt |
| `refreshTokens` | `RefreshToken` | Hashed refresh + family rotation |
| `passwordResetTokens` | `PasswordResetToken` | Hashed 6-digit reset codes |
| `profiles` | `Profile` | country, DOB, age, practiceGoals, profileCompleted |
| `languages` | `Language` | Catalog (id=code, flag, sortOrder) |
| `userLanguages` | `UserLanguage` | SPEAKS / LEARNING + proficiency |
| `follows` | `Follow` | follower / followee (one-way) |
| `notifications` | `Notification` | in-app inbox: corrections, references |
| `conversations` | `Conversation` | DIRECT, lastMessage* |
| `conversationParticipants` | `ConversationParticipant` | membership |
| `messages` | `Message` | content, media meta, transcript; legacy translation columns retained |
| `messageTranslations` | `MessageTranslation` | per-language translation cache |
| `blocks` | `Block` | blocker / blocked |
| `reports` | `Report` | reporter / reported, reason, optional messageId |

---

## Feature → file map

| Domain | Router | Controller | Service | Repository | Validators | Extra |
|--------|--------|------------|---------|------------|------------|-------|
| Auth | `auth/routes.ts` | `controller.ts` | `service.ts` | `repository.ts` | `schema.ts` | `tokens.ts`, `password.ts`, `mail.ts` |
| Users | `users/routes.ts` | `controller.ts` | `service.ts` | `repository.ts` | `schema.ts` (+ languages) | `countries.ts`, `practiceGoals.ts`, `dto.ts` |
| Languages | `languages/routes.ts` | `controller.ts` | `service.ts` | `repository.ts` | `schema.ts` | `catalog.ts`, `dto.ts` |
| Discovery | `discovery/routes.ts` | `controller.ts` | `service.ts` | `repository.ts` | `schema.ts` | `scoring.ts`, `pagination.ts`, `dto.ts` |
| Follows | `follows/routes.ts` | `controller.ts` | — | `repository.ts` | — | — |
| Messaging | `messaging/routes.ts` | `controller.ts` | `service.ts` | `repository.ts` | `schema.ts` | `socket.ts`, `gateway.ts`, `presence.ts`, `learning.ts` |
| Media | `media/routes.ts` | `controller.ts` | `service.ts` | — | `schema.ts` | `storage.ts` |
| Safety | `safety/routes.ts` | `controller.ts` | `service.ts` | `repository.ts` | `schema.ts` | — |

---

# Features by domain

---

## 1. Auth

**Folder:** `features/auth/`  
**Mount:** `/auth` · **Rate limit:** entire router · **Socket:** none  
**Used by frontend:** Login, SignUp, Forgot/Reset, apiClient refresh, sign out

| Method | Path | Auth | Body (validators in `schema.ts`) | What it does | Code path |
|--------|------|------|----------------------------------|--------------|-----------|
| POST | `/auth/register` | Public | `email`, `password` (≥8, letter+number), `displayName` | Create user + Argon2 hash + refresh row; return session 201 | `controller.register` → `service` → `repository` |
| POST | `/auth/login` | Public | `email`, `password` | Verify ACTIVE user; issue session | same |
| POST | `/auth/refresh` | Public | `refreshToken` | Rotate refresh; revoke old; reuse of revoked → revoke family | same |
| POST | `/auth/logout` | Public | `refreshToken` | Revoke if present; always `{ ok: true }` | same |
| GET | `/auth/me` | Bearer | — | `{ user }` auth summary | `controller.me` |
| POST | `/auth/forgot-password` | Public | `email` | Issue hashed 6-digit code + email; always ok; non-prod may include `devCode` | `service` + `mail.ts` |
| POST | `/auth/reset-password` | Public | `token` (6 digits), `password` | Update password; revoke all refresh tokens | same |

**Helpers:** `tokens.ts` (Jose access JWT), `password.ts` (Argon2), `mail.ts` (reset email).  
**OpenAPI:** register / login / refresh / logout / me documented; forgot / reset **not**.

---

## 2. Users / profile / onboarding

**Folder:** `features/users/`  
**Mount:** `/users` · All routes Bearer · **Socket:** none  
**Language validators reused from:** `features/languages/schema.ts`  
**Used by frontend:** Profile, EditProfile, Onboarding, LanguagePreferences, Settings (password / delete), PublicProfile

| Method | Path | Auth | Body / params | What it does | Code path |
|--------|------|------|---------------|--------------|-----------|
| GET | `/users/me` | Bearer | — | Full `CurrentUserDto` (email, profile, languages, goals) | `controller.getMe` |
| PUT | `/users/me/onboarding` | Bearer | Required `spokenLanguages[]`, `learningLanguages[]`; optional displayName, bio, country, age, DOB, profileImageUrl, practiceGoals | Complete onboarding; sync languages; set flags | `controller.completeOnboarding` |
| PUT | `/users/me/profile` | Bearer | At least one of displayName / bio / country / avatar* / practiceGoals / languages (spoken+learning together) | Atomic profile edit (PRO-002) | `controller.putMeProfile` |
| PATCH | `/users/me` | Bearer | Optional displayName, bio, country, photo/avatar URLs | Legacy partial profile | `controller.updateMe` |
| PATCH | `/users/me/password` | Bearer | `currentPassword`, `newPassword` (min 6) | Change password | `controller.changePassword` |
| DELETE | `/users/me` | Bearer | — | Soft-delete account | `controller.deleteMe` |
| GET | `/users/me/languages` | Bearer | — | Grouped `{ SPEAKS, LEARNING }` via languages service | `controller.getMyLanguages` |
| PUT | `/users/me/languages` | Bearer | Sync body | Full language replace → grouped response | `controller.putMyLanguages` |
| PATCH | `/users/me/languages` | Bearer | Same sync body | Same sync → full `CurrentUserDto` | `controller.updateLanguages` |
| GET | `/users/` | Bearer | — | **501** `NOT_IMPLEMENTED` (`searchUsers`) | stub |
| GET | `/users/:id/public-profile` | Bearer | param `id` | Safe public profile (PRO-001 / DISC-006) | `controller.getPublicProfile` |
| GET | `/users/:id` | Bearer | param `id` | Legacy public profile (age ok, no DOB) | `controller.getUserById` |

**Practice goals catalog** (`practiceGoals.ts`): Conversation, Speaking, Listening, Reading, Writing, Grammar, Vocabulary, Pronunciation, Culture.  
**Language rules:** spoken 1–10, learning 1–5, ≤1 NATIVE; cannot be both SPEAKS and LEARNING.  
**Countries:** `countries.ts`.  
**DTOs:** `dto.ts`.  
**OpenAPI:** public-profile + me/languages GET/PUT; most other users routes undocumented.

---

## 3. Languages (catalog)

**Folder:** `features/languages/`  
**Mount:** `/languages`  
**Used by frontend:** Onboarding, Discover filters, EditProfile, LanguagePreferences

| Method | Path | Auth | Body | What it does | Code path |
|--------|------|------|------|--------------|-----------|
| GET | `/languages` | **Public** | — | Cached catalog: `id`, `code`, `name`, `flagEmoji`, `sortOrder` | `controller` → `service` → `repository` / `catalog.ts` |

User language CRUD lives under `/users/me/languages` (users feature).  
**OpenAPI:** yes. **Socket:** none.

---

## 4. Discovery (partner feed)

**Folder:** `features/discovery/`  
**Mounts:** `/discover` and `/discovery` · Bearer · **Socket:** none  
**Used by frontend:** Discover screen (`GET /discover`)

| Method | Path | Auth | Query / params | What it does | Code path |
|--------|------|------|----------------|--------------|-----------|
| GET | `/discover` | Bearer | See query table | Paginated partner cards + matchScore | `controller` → `service` → `repository` + `scoring.ts` |
| GET | `/discovery` | Bearer | same | Alias of above | same router mounted twice |
| GET | `/discover/users/:id` | Bearer | param `id` | Alias of `GET /users/:id/public-profile` | discovery controller → users public profile |

### Query params (`discoverQuerySchema` in `schema.ts`)

| Param | Notes |
|-------|--------|
| `search` | Display name / language (max 80) |
| `spokenLanguageId` / `spokenLanguage` | SPEAKS filter (aliases) |
| `learningLanguageId` / `learningLanguage` | LEARNING filter |
| `country` | Via country aliases |
| `proficiency` | BEGINNER … NATIVE (normalized) |
| `page` | default 1 |
| `limit` | default 20, max 50 |

**Eligibility:** not viewer; ACTIVE; onboarding + profile completed; not blocked either way.  
**Scoring** (`scoring.ts`): MUTUAL ≥100, PARTIAL 50–99, NONE &lt;50; sort matchScore DESC.  
**Response cards typically include:** user id, displayName, avatar, country, age, languages, matchScore / match type, connection status.  
**OpenAPI:** yes (both mounts + discover user + public-profile).

---

## 5. Connections

**Folder:** `features/connections/`  
**Mount:** `/connections` · Bearer · **Socket:** none (accept creates conversation for messaging)  
**Used by frontend:** Connections tab, Discover CTAs, PublicProfile CTAs, ConnectionRequestModal

| Method | Path | Auth | Body / params | What it does | Code path |
|--------|------|------|---------------|--------------|-----------|
| POST | `/connections/request` | Bearer | `recipientId`\|`receiverId`, optional `introMessage`\|`message` (≤280 sanitized) | Send / reopen PENDING request → 201 | `controller` → `service` → `repository` |
| GET | `/connections/requests` | Bearer | — | `{ received, sent, accepted }` (no DECLINED / CANCELLED) | same |
| GET | `/connections` | Bearer | — | Same as requests | same |
| PATCH | `/connections/:id/accept` | Bearer | id | Recipient only → ACCEPTED + ensure DIRECT conversation | same |
| PATCH | `/connections/:id/decline` | Bearer | id | Recipient → DECLINED | same |
| PATCH | `/connections/:id/cancel` | Bearer | id | Requester, PENDING → CANCELLED | same |
| DELETE | `/connections/:id` | Bearer | id | Remove ACCEPTED (soft CANCELLED); messages kept | same |

**Rules:** no self-connect; block check; PENDING / ACCEPTED → 409; DECLINED / CANCELLED can be resent.  
**OpenAPI:** full coverage.

---

## 6. Messaging (HTTP)

**Folder:** `features/messaging/`  
**Mounts:** `/conversations` (primary), `/messaging` (legacy)  
**Used by frontend:** Chats inbox, Conversation screen

### Primary — `/conversations`

| Method | Path | Auth | Body / query | What it does | Socket side-effects | Code path |
|--------|------|------|--------------|--------------|---------------------|-----------|
| GET | `/conversations` | Bearer | `cursor?`, `limit` 1–50 (default 20) | Inbox: partner, last message, unread, online | — | `controller` → `service` → `repository` |
| GET | `/conversations/:id/messages` | Bearer | `before?`, `page?`, `limit` 1–100 (default 30) | Message history | — | same |
| POST | `/conversations/:id/messages` | Bearer + messaging RL | `content` 1–4000, optional `type`, `durationMs`, `mimeType`, `thumbnailUrl`, `caption`* | Persist message; require ACCEPTED + not blocked | Emits `message_new` | same + `gateway.ts` |
| PATCH | `/conversations/:id/read` | Bearer | — | Mark inbound unread → READ | Emits `message_status` | same |
| POST | `/conversations/:id/messages/:messageId/translate` | Bearer | `targetLang?` | Translate (MyMemory); cache on message | — | `learning.ts` |
| POST | `/conversations/:id/messages/:messageId/transcribe` | Bearer | — | Whisper if `OPENAI_API_KEY`; VOICE / VIDEO | — | `learning.ts` |

\*Schema accepts `caption`; HTTP controller currently may not forward `caption` to the service — check `controller.ts` if debugging captions.

### Legacy aliases — `/messaging`

Same handlers under:
- `GET /messaging/conversations`
- `GET|POST /messaging/conversations/:conversationId/messages`
- `PATCH /messaging/conversations/:conversationId/read`
- `POST …/messages/:messageId/translate|transcribe`

**Access:** conversation member + ACCEPTED connection + not blocked.  
**OpenAPI:** primary `/conversations` + translate / transcribe documented; `/messaging/*` **not**.

---

## 7. Realtime (Socket.IO)

| Piece | File |
|-------|------|
| Bootstrap | `lib/socket.ts` |
| Handlers | `features/messaging/socket.ts` |
| Emit helpers | `features/messaging/gateway.ts` |
| Presence | `features/messaging/presence.ts` (in-memory) |
| Event validators | `features/messaging/schema.ts` |

**Handshake:** `auth.token` or `Authorization: Bearer` → `socket.data.userId`  
**Rooms:** `user:{userId}`, `conversation:{conversationId}`  
**Used by frontend:** `src/lib/socket.ts` + chat hooks

### Client → server

| Event | Payload | Behavior |
|-------|---------|----------|
| `join_conversation` | `conversationId` | Authz → join room |
| `send_message` | send-message schema | Persist; ack; `message_new`; best-effort DELIVERED if recipient online |
| `typing_start` / `typing_stop` | `conversationId` | Forward to partner / room |
| `message_read` | read schema | Mark read; `message_status` |
| `user_online_status` | status schema | Self or chat partners only |
| `disconnect` | — | Last socket → persist `lastSeenAt`, broadcast offline |

Acks: `{ ok: true, … }` / `{ ok: false, error }`. Failures may emit `message_error`.

### Server → client

| Event | Payload |
|-------|---------|
| `message_new` | `ChatMessage` |
| `message_status` | `{ conversationId, messages }` |
| `typing_start` / `typing_stop` | `{ conversationId, userId }` |
| `user_online_status` | `{ userId, onlineStatus, lastSeen }` |
| `message_error` | `{ error }` |

**OpenAPI:** Socket events not documented.

---

## 8. Media

**Folder:** `features/media/`  
**Mount:** `/media`  
**Used by frontend:** Conversation media / voice upload (`POST /media/uploads`)

| Method | Path | Auth | Input | What it does | Code path |
|--------|------|------|-------|--------------|-----------|
| GET | `/media/files/*` | Public static | — | Serve `uploads/` dir | Express static via `routes.ts` / `storage.ts` |
| POST | `/media/uploads` | Bearer | Multipart field `file`; max **40 MB**; image / audio / video MIME allowlist | 201 `{ url, mimeType, kind, size }` | `controller` → `service` → `storage.ts` |

**URL shape:** `/media/files/{cuid}{ext}` (relative; client resolves with API base).  
**OpenAPI:** POST upload under Chat tag; static files not documented.  
**Socket:** none (clients upload then send URL in message).

---

## 9. Safety (blocks & reports)

**Folder:** `features/safety/`  
**Mounts:** `/blocks`, `/reports` · Bearer · **Socket:** none  
**Used by frontend:** `BlockReportMenu` on PublicProfile / Conversation

| Method | Path | Auth | Body | What it does | Code path |
|--------|------|------|------|--------------|-----------|
| POST | `/blocks` | Bearer | `userId` | Create block; cancel PENDING / ACCEPTED connections both ways → 201 | `controller` → `service` → `repository` |
| POST | `/reports` | Bearer | `userId`, `reason` enum, optional `messageId`, `details` ≤1000 | Create report → 201 | same |

**Report reasons:** `Spam`, `Harassment`, `Inappropriate Content`.  
**Shared helpers:** `assertNotBlocked` / `isBlockedEitherWay` used by messaging, connections, discovery.  
**OpenAPI:** not documented.

---

## 10. Matching (stubs — not product)

**Folder:** `features/matching/`  
**Mount:** `/matching` · Bearer · **No repository**  
**Frontend:** matching API / screen exist but are **not** in navigation

| Method | Path | Auth | Body | Behavior |
|--------|------|------|------|----------|
| GET | `/matching` | Bearer | — | **501** `NOT_IMPLEMENTED` |
| POST | `/matching/like` | Bearer | `userId` | Validates then **501** |

Product “matching” = **discovery scoring + connections**, not this router.  
**OpenAPI:** not documented.

---

# Endpoint index (all HTTP)

| Area | Endpoints | Notes |
|------|-----------|-------|
| Health | `GET /health` | public |
| Auth | 7 routes under `/auth` | all rate-limited |
| Users | 12 routes under `/users` | 1 search → 501 |
| Languages | `GET /languages` | public catalog |
| Discovery | `GET /discover`, `GET /discovery`, `GET /discover/users/:id` | |
| Connections | 7 routes | request, lists, accept/decline/cancel, delete |
| Conversations | 6 primary routes | inbox, messages, read, translate, transcribe |
| Messaging legacy | 6 aliases under `/messaging` | same handlers |
| Media | static files + upload | |
| Safety | `POST /blocks`, `POST /reports` | |
| Matching | 2 stubs | both 501 |
| Socket inbound | ~6 events + disconnect | |
| Socket outbound | ~5–6 event families | |

---

# Frontend ↔ backend mapping (quick)

| Frontend screen / flow | Backend endpoints |
|------------------------|-------------------|
| Login / SignUp / Logout / Refresh | `/auth/*` |
| Forgot / Reset password | `/auth/forgot-password`, `/auth/reset-password` |
| Onboarding | `PUT /users/me/onboarding`, `GET /languages` |
| Discover feed + filters | `GET /discover`, `GET /languages`, connection mutations |
| Connections tabs | `GET /connections/requests` + accept/decline/cancel/remove |
| Chats inbox | `GET /conversations` + socket presence / message events |
| Conversation | messages CRUD, read, translate, transcribe, `POST /media/uploads`, sockets |
| Own Profile | `GET /users/me`, `POST /auth/logout` |
| Public Profile | `GET /users/:id/public-profile` + connections + blocks/reports |
| Edit Profile | `PUT /users/me/profile`, `GET /languages` |
| Language Preferences | `GET/PUT /users/me/languages`, `GET /languages` |
| Settings password / delete | `PATCH /users/me/password`, `DELETE /users/me` |

---

# Gaps / notes

1. OpenAPI covers Auth (partial), Languages, Discovery, Connections, Chat; omits reset, most users routes, safety, matching, sockets, `/messaging` aliases.
2. Dual JWT helpers (HTTP Jose vs Socket HMAC) share the same secret.
3. Matching module is a placeholder; real partner flow = discovery + connections.
4. Rate limits only on `/auth` and HTTP send-message (in-memory).
5. `media/schema.ts` may define unused upload meta; upload is multipart-only.
6. Soft-deleted users / cancelled connections keep message history by design.

---

# How to extend this doc

When adding an endpoint:

1. Document **method + path**, auth, validators, and behavior.
2. List **router → controller → service → repository** files.
3. Note **which frontend screen / hook** calls it (update `frontend/FEATURES.md` too).
4. Mark OpenAPI / Socket coverage.
5. Keep stubs (501) clearly labeled so they are not confused with live product.
