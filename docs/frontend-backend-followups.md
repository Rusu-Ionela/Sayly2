# Frontend / backend follow-ups

## Chat idempotency

Frontend now sends `clientMessageId` on Socket.IO `send_message` and HTTP `POST /conversations/:id/messages`, and reuses the same id on retry / HTTP fallback.

Backend schema + repository now accept optional `clientMessageId` and dedupe on `(senderId, clientMessageId)`.

**Ops required:** run `npm run db:push` (or generate/migrate) in `backend/server` so the `Message.clientMessageId` column and unique partial index exist.

## Discover visibility — shipped

- Backend: `Profile.discoverable` (default `true`), writable via `PUT /users/me/profile`, filtered in `GET /discover`.
- Frontend: Profile **Show in Discover** switch.

**Ops required:** apply schema / `ensure-review-schema` so the `discoverable` column exists.

## Web auth storage — shipped (best-effort)

- Native: Expo SecureStore for access + refresh.
- Web: access + refresh tokens stay in memory; refresh uses HttpOnly cookie + `credentials: "include"`.
- Legacy web `localStorage` token keys are cleared on read/write.
- Cookie refresh/logout require a trusted `Origin`/`Referer` matching `CLIENT_ORIGIN` (CSRF guard).

Production still needs HTTPS-only cookies in real deploys (`Secure` + `SameSite=None` when cross-site).

## Corrections / saved phrases — shipped (MVP)

- Backend: `POST/GET .../messages/:id/corrections`, `/learning/phrases` CRUD.
- Frontend: chat **Correct** / **Save**; Profile **Saved phrases** screen.

**Ops required:** apply `MessageCorrection` / `SavedPhrase` tables via migration or `ensure-review-schema`.

## Message reactions / edit / delete

Still deferred (no API). In-chat **search** of loaded messages is available in the conversation header.

## Block list — shipped

- Backend: `GET /blocks`, `DELETE /blocks/:userId` (plus existing create block).
- Frontend: Settings → **Blocked users**.

## Password-reset deep links

Client linking prefixes: `sayly://`, `https://sayly.app`.

Example: `sayly://reset-password?challengeId=…&code=123456`
