# Multi-instance setup (Redis, presence, translations, local uploads)

This server can run more than one Node process if they share PostgreSQL, Redis, and the same upload directory on one machine. These changes do **not** make the backend fully production-ready by themselves.

## What Redis is used for

| Capability | Redis feature | Required? |
|---|---|---|
| HTTP + Socket.IO rate limits and AI concurrency | Strings + Lua `INCR`/`PEXPIRE` | Yes. Outage returns `503 SERVICE_UNAVAILABLE`, not unlimited traffic. |
| Translation job lease | `SET NX PX` | Yes for translate/transcribe coordination. PostgreSQL unique index is the durable cache boundary. |
| Online presence leases | Strings + sets + a bounded expiry zset | Presence reads must not break inbox loads. Redis failure returns `onlineStatus: "UNKNOWN"` and last-seen from PostgreSQL. |
| Socket.IO adapter | Dedicated pub/sub clients | Required to emit to sockets on other processes. The adapter is **not** durable or exactly-once. |
| Session revocation notify | Pub/sub | Acceleration only. PostgreSQL `authVersion` / refresh-token family remains the source of truth. Missed messages are recovered by socket revalidation. |

PostgreSQL remains authoritative for accounts, sessions, messages, and translations.

## Local services

```powershell
# PostgreSQL 16+ listening on localhost:5432
# Redis 7+ listening on localhost:6379

cd backend/server
copy .env.example .env
# Edit .env: DATABASE_URL, JWT secrets, RESET_CODE_PEPPER, REDIS_URL

npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

Health:

- `GET /health` — process is up
- `GET /ready` — PostgreSQL and Redis both answer; returns 503 while draining

Tests use an in-memory Redis (`REDIS_USE_MEMORY=true` / `NODE_ENV=test`) and do not need a live Redis server. To exercise a real Redis instance, set `REDIS_USE_MEMORY=false` and `REDIS_URL`.

```powershell
npm run typecheck
npm run typecheck:all
npm test
npm run build
```

Compiled smoke (development, after `npm run build`):

```powershell
$env:NODE_ENV="development"
node dist/index.js
```

Then `GET http://localhost:4000/health`. Stop with Ctrl+C so Redis and PostgreSQL pools close.

## Migrations

There was no Drizzle journal before this work. Versioned SQL now lives in `drizzle/`:

1. `0000_baseline.sql` — idempotent current schema (safe on empty and existing databases).
2. `0001_message_translations.sql` — `MessageTranslation` table, unique cache key, retry-safe backfill of legacy `Message.translatedContent` / `translatedLang` only when the current source text can be hashed. Uncertain rows are skipped. Provider is stored as `legacy-unknown`.

```powershell
npm run db:migrate
```

Do not use `db:push` or schema reset in production. Do not edit SQL that has already been applied.

Rollback of `0001`: stop using the new table in a release, then `DROP TABLE IF EXISTS "MessageTranslation";` after a backup. Leave legacy message columns in place.

## Rate-limit defaults

| Action | Identity | Default |
|---|---|---|
| Register | trusted IP (`req.ip`, `trust proxy = 1`) | 20 / 15 min |
| Login | IP + hashed email (never raw email in Redis keys) | 20 IP / 10 account / 15 min |
| Reset issue | IP + hashed email | 10 IP / 5 account / 15 min |
| Reset verify | IP (PostgreSQL still owns per-challenge attempts) | 10 / 15 min |
| Refresh | IP | 30 / min |
| Logout | IP (not the login bucket) | 60 / min |
| Password change | user id | 5 / 15 min |
| Message send (HTTP `/conversations/:id/messages`, `/messaging/...`, and socket `send_message`) | user id | 120 / min |
| Upload | user id | 30 / min |
| Translate / transcribe | user id | 20 / min, plus concurrency 2/user and 8 global |
| Reports | user id | 10 / hour |
| Connection requests / blocks | user id | 40 / min |
| Discovery | user id | 60 / min |
| Socket connect | handshake address | 30 / min |
| Typing | user id | 30 / 10 s |

Outage policy: security-sensitive and expensive paths return HTTP `503` / `{ code: "SERVICE_UNAVAILABLE" }` with `Retry-After`. Exhausted quota is `429` / `RATE_LIMITED`. Socket acks add `code` and `retryAfterMs` without removing `error`.

## Presence

A user is online while at least one per-socket lease exists. Heartbeats refresh the lease. Process crashes drop leases when TTL expires; a bounded zset sweeper (not a per-user timer, not keyspace notifications) persists monotonic `User.lastSeenAt` and notifies accepted, unblocked partners.

Redis failure is not treated as offline.

## Socket.IO adapter and load balancing

`@socket.io/redis-adapter` with the `redis` (node-redis v4) client. Polling remains enabled (`websocket` + `polling`).

Sticky sessions are still required for HTTP long-polling. Without affinity, Engine.IO sessions get HTTP 400 when a handshake lands on another process. WebSocket-only would avoid affinity but would still need the adapter for cross-process emits.

The adapter distributes live events. It does not make events durable or exactly-once.

## Uploads

Uploads stay on local disk (`UPLOADS_DIR`, default `./uploads`).
Set `MEDIA_SIGNING_SECRET` (min 32 chars) in production so media signatures are not tied to JWT rotation.
Optional `MEDIA_USER_QUOTA_BYTES` caps total uploaded bytes per user (default 500 MB).

- Every API process on the **same machine** must use the same absolute directory.
- Separate machines cannot see those files.
- Keep the directory on a persistent volume, restrict OS permissions to the service account, and back it up independently of Redis.
- Signed URLs, MIME allowlisting, and owner records are unchanged. Local disk is not public object storage.

## Frontend / DTO compatibility

Translate path is unchanged: `POST /conversations/:id/messages/:messageId/translate`.

The response still includes `translatedContent` and `translatedLang`, now filled from the **requested** target language (body `targetLang`, else the viewer's native language). History/inbox payloads no longer copy an arbitrary last-written translation onto every message. After a list refetch, the client should call translate again; cache hits are fast.

Optional client updates:

- Send `targetLang` explicitly.
- Treat `onlineStatus: "UNKNOWN"` as presence unavailable (do not show a confident offline state).
- Socket `message_error` / acks may include `code` and `retryAfterMs`.

## Deployment

1. Run Redis 7+ and PostgreSQL.
2. Set `REDIS_URL` (and TLS/auth as needed). Production refuses to start without it.
3. Set `UPLOADS_DIR` to a persistent path shared by processes on that host.
4. Run `npm run db:migrate`.
5. Rolling restart. Load balancer: sticky sessions if polling is enabled.
6. Confirm `/ready` returns `{ ok: true }`.

Rollback: deploy the previous application image. Redis keys expire. Keep `MessageTranslation` unless you also roll back that migration.

## Remaining blockers outside this task

- Durable object storage if more than one machine serves media.
- SMTP, secret rotation, and production env hardening.
- Full integration tests against two live Node processes and a real Redis replica.
- Provider spend caps, outbox/mail workers, and a complete operations profile (metrics, restore drill).
