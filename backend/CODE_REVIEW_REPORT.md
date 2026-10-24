# Backend Code Review & Remediation Report

## 1. Executive Summary

**Verdict: not ready for production.** The backend has a sensible feature-oriented outline and several good foundations—parameterized Drizzle queries, explicit public DTOs, Argon2 in the main auth flow, and indexed message history—but active security and consistency defects undermine them. The password-change endpoint contains a hard-coded verification bypass and stores plaintext passwords. Recovery uses a globally searchable six-digit bearer code. Signing/database credentials are shipped in the archive. Socket authentication is weaker than HTTP authentication. Private media is public and accepts unsafe content. Promised atomic edits and retry/state-transition guarantees do not survive concurrency.

**Finding count: 67 distinct entries**: 3 CRITICAL, 21 HIGH, 37 MEDIUM, and 6 LOW/CHORES. Closely related symptoms share one root-cause entry; cross-references identify interactions rather than inflate counts. Severity reflects the supplied code and stated assumptions, not a formal CVSS calculation or evidence of an incident.

**Reviewed inputs and boundaries.** This report reviews the provided `backend.zip` and `FEATURES(8).md`, including all 146 archive files: application code, seven test files, schema, scripts, TypeScript/Vitest/Drizzle configuration, package manifest/lock metadata, OpenAPI, static SVG, and repository guidance. The attached feature document is byte-identical to `backend/FEATURES.md` (SHA-256 `f9510cc2c642c11d39c1493eeb8300124bd13d3c8fa05986a2f9e24fdebdccb7`). Locations use archive-relative paths and original line numbers or exact function/table names. No application source was changed. Remediation is supplied for review and implementation, not represented as applied or production-tested.

**Assurance limits.** This is a comprehensive source audit of the supplied snapshot, not a guarantee that every possible defect has been found. No live database, deployed schema, proxy rules, frontend rendering, production logs, external provider account, dependency advisory feed result, or load-test environment was available. The archive’s credentials were never used to connect to a service. Concurrency consequences are source-derived schedules requiring the integration tests specified below. Recommendations introducing tables, Redis, storage adapters or provider adapters are explicitly architectural changes and require migrations/client coordination; they are not drop-in snippets against the unchanged schema.

**Verification actually performed:**


| Check                                                      | Result                                                                             | Interpretation                                                                                    |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Requirements comparison and archive inventory              | Completed; identical feature documents                                             | One requirements baseline, no invented frontend/backend scope                                     |
| Source tracing                                             | All mounted HTTP paths, realtime handlers, repositories, DTOs and schemas examined | Includes legacy aliases and intentional stubs                                                     |
| Safe isolated password-change probe                        | Hard-coded bypass accepted; replacement stored as plaintext                        | Executed the source function with a synthetic account and mocked DB; no real credentials/database |
| Safe isolated upload predicate probe                       | `.html` with octet-stream and SVG accepted                                         | Confirms predicate acceptance; browser exploitability depends on CSP/hosting                      |
| Safe isolated JWT probe                                    | Missing exp and wrong issuer/audience accepted by socket verifier                  | Signed with a synthetic key; not an unsigned-token bypass                                         |
| Safe isolated logger probe                                 | accessToken/refreshToken/confirmPassword and nested password unredacted            | Confirms implementation defect without real secrets                                               |
| Country helper probe                                       | CZ aliases omit accepted Czechia spelling                                          | Reproduces asymmetric filtering                                                                   |
| Dependency metadata                                        | Lockfile v3, 340 package entries, registry-resolved entries have integrity         | Does not establish absence of dependency vulnerabilities                                          |
| `npm ci --ignore-scripts --offline --no-audit --no-fund`   | Failed: ENOTCACHED for zod 3.25.76                                                 | Exact build, Vitest suite and full typecheck were not run; no fabricated pass counts              |
| Database integration, migration, load and deployment tests | Not run                                                                            | Explicit release gates, not verified behavior                                                     |


**First remediation sequence:** contain exposed credentials/configuration (C01, H07, H18); fix password/recovery/session security (C02–C03, H01–H07); protect uploads/private media and quotas (H08–H10); repair messaging idempotency and relationship transactions (H11–H16); establish migrations/build/integration gates (H17, H21, M35). These are release blockers. Lower severity items still require triage; low severity does not mean intentionally ignored.

## 2. Feature Alignment Gap Analysis

The supplied feature file is substantially an implementation/API inventory, not a complete independent product requirements specification. Its documented weaknesses (public static media, limited rate limits, missing OpenAPI coverage) remain reviewable security/design problems. Conversely, explicitly excluded or stubbed product areas are not automatically missing requirements. Repository `.cursor` guidance supplies architectural intent but its “typical domains” do not mandate building every possible social-learning feature.


| Required/documented area                     | Source assessment                                                                                                     | Gaps / related findings                                                                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bootstrap, mounts, aliases, health           | All documented router families mounted; discovery router also exposes `/discovery/users/:id` through its second mount | Build/runtime config H21; readiness/shutdown M31; alias missing in endpoint inventory/docs L02                                                         |
| Register                                     | Zod, normalized email, Argon2 and user+refresh transaction present                                                    | Exposed signing key C01; password normalization M01; startup/signing configuration H18; conflict mapping M28                                           |
| Login and `/auth/me`                         | Real Argon2 verification and ACTIVE-user middleware present                                                           | Change-password corrupts hashes C02; timing M06; shared auth bucket H10                                                                                |
| Refresh rotation/reuse                       | Sequential happy path implemented                                                                                     | Concurrent rotation/revocation invalidates guarantees H02                                                                                              |
| Logout                                       | Revokes supplied active refresh row, generic success for unknown token                                                | Family/access/socket lifecycle H05; contract should state expiry semantics                                                                             |
| Forgot/reset                                 | Routes, 6-digit generation, hashed storage, expiry and password hashing exist                                         | No delivery H06; global low-entropy credential C03; development disclosure H07; non-atomic H01                                                         |
| Password change                              | Route exists                                                                                                          | Active universal bypass and plaintext storage C02; inconsistent policy M01                                                                             |
| Current profile                              | Explicit self DTO includes own email/DOB as expected                                                                  | Completion flags M08; stale age M09; duplicate profile source fields L03                                                                               |
| Onboarding                                   | Required language pair, country/age/DOB validation and flags partially implemented                                    | Sequential writes H13; completion bypass M08; DOB edge cases M09; repeated submission defaults goals to [] (L06 below)                                 |
| PUT profile (“atomic”, PRO-002)              | Fields and language validation present                                                                                | **Not atomic** across profile/User/languages H13; media/flags M08/M10                                                                                  |
| Legacy PATCH profile                         | Reachable and validates known keys                                                                                    | Empty update can set completion; larger avatar cap; inconsistent semantics M08/M10                                                                     |
| Public profile and discovery profile aliases | DTOs exclude email, hashes, raw DOB and auth metadata; bidirectional block/ACTIVE checks present                      | Public profile checks onboarding+profile existence but not stored profileCompleted; align policy with discovery M08, L02                               |
| User search                                  | Explicit 501                                                                                                          | **Expected documented stub**, not missing completed functionality                                                                                      |
| Language catalog                             | Cached public catalog, sorted entries, DTOs implemented                                                               | Public reads write seed data; cache stampede/catalog identity M12                                                                                      |
| Spoken/learning sync                         | Limits, duplicate and cross-role validation exist; standalone sync transaction exists                                 | Concurrent full-replace invariants M11; flags M08; NATIVE meaning needs clarification                                                                  |
| Discovery eligibility                        | SQL excludes self, inactive/incomplete profiles and blocks                                                            | Stored completeness is unreliable M08; snapshot drift M15                                                                                              |
| Discovery search/filter/score                | Parameterized queries, language-overlap score bands match documented rules                                            | Country/search correctness M13; repeated ranking/deep offsets M14; collation/snapshot M15                                                              |
| Connection request/reopen                    | Self check, block check, active recipient and intro sanitization present                                              | Opposite-direction duplicate H15; reopen/block races H14; no abuse budget H10                                                                          |
| Accept/decline/cancel/remove                 | Actor/state checks and soft cancellation exist; accept creates/reuses chat                                            | Checks are stale at commit H14; direct-pair invariant H15; inactive-partner policy M17                                                                 |
| Connection lists                             | Incoming/sent/accepted groups and omission of terminal intros implemented                                             | Unbounded and N+1 M16; suspended partners M17                                                                                                          |
| Conversation inbox/history                   | Membership, accepted connection, blocks and cursor/offset paths present; last-message/unread loads batched            | Status policy M17, ordering M20, deep offsets M14; retained history is intentionally inaccessible after connection cancellation under current contract |
| Send text/image/voice/video                  | Both transports validate, persist transactionally and emit                                                            | Cross-conversation retry H11; concurrent retry H12; media ownership H09; post-block race H14                                                           |
| Captions                                     | HTTP controller **does forward** caption and clientMessageId to service                                               | Feature-file caption warning is stale, not a confirmed missing implementation L02                                                                      |
| Read receipts                                | Inbound messages only, guarded by conversation access                                                                 | Unbounded batch/response and empty-array semantics M21                                                                                                 |
| Translation                                  | Provider call, native-language fallback and cached fields exist                                                       | Truncation/source race M24; unbounded outbound work M25; per-target cache M26; external-processing policy M27                                          |
| Transcription                                | Local upload path, provider key check, Whisper request and caching exist                                              | Asset ownership H09; memory/timeouts/provider limits M25; storage consistency M36. Missing key intentionally returns 501                               |
| Socket auth/rooms/events                     | All documented handler families registered                                                                            | Weaker verification H03, indefinite sessions H04, no event limits H10, uncaught tasks H20                                                              |
| Presence/typing/delivery                     | Single-process Maps, lastSeen persistence and broadcasts exist                                                        | Block privacy M18; duplicate events M19; unbounded cache/replicas M22; receipt semantics M23                                                           |
| Uploads/static media                         | Multipart route, 40 MB file cap, local serving and URL result exist                                                   | Claimed allowlist is bypassable H08; owner/privacy H09; total quotas H10; durability M36                                                               |
| Blocks                                       | Self guard, DB block and connection cancellation transaction present                                                  | Concurrent retry M34; shared state lock H14; presence revocation M18                                                                                   |
| Reports                                      | Enum/detail validation and target/sender checks present                                                               | Reporter conversation authorization missing H16; abuse limits H10. No review queue/status/admin process supplied; see scope below                      |
| Matching                                     | 501 list/like stubs match guide                                                                                       | **Explicitly not product**; do not replace with dating/swipe functionality                                                                             |
| OpenAPI                                      | Auth/language/discovery/connection/chat registrations present                                                         | Partial route coverage and schema drift L02                                                                                                            |
| Error handling/logging                       | Typed AppError/Zod responses; production generic 500 message                                                          | Disabled production logs H19; secret redaction M03; classification M28                                                                                 |
| Database/schema/scripts                      | Useful FKs/indexes and transactions in selected flows                                                                 | No migrations H17; missing invariants M32; unsafe scripts M02; timezone M37                                                                            |


**Not proven missing from this feature contract:** OAuth sign-in (enum values alone are not a feature), email verification, push notifications/device tokens, reactions/corrections, subscriptions, privacy preference UI, unblock/block-list endpoints, an admin moderation console, or learning-progress analytics. There is no implementation for these in the supplied tree, but the guide does not promise them. If required for launch, create explicit acceptance criteria and designs; do not mark them complete based on enum fields or aspirational guidance. Reports currently stop at storage, so an operational moderation process must be established separately even if an admin UI is not in scope.

**Security assessment by requested category:**


| Category                          | Conclusion grounded in this snapshot                                                                                                                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SQL injection                     | No confirmed SQLi: reviewed request-fed queries use Drizzle parameters; raw script SQL is fixed. ILIKE escaping is a search correctness bug, not string-concatenated SQL execution.                                        |
| XSS / unsafe content              | Arbitrary active upload content confirmed; browser execution conditions in H08. Text returned in JSON is not automatically an XSS vulnerability without a rendering sink.                                                  |
| CSRF                              | Explicit bearer credentials, no auth cookies. No confirmed classic ambient-cookie CSRF path; CORS hardening is still needed. Reassess if cookies are introduced.                                                           |
| Broken authentication             | Confirmed active password bypass, reset design defects, weak socket verification/lifecycle and leaked signing material.                                                                                                    |
| IDOR / broken authorization       | Report message reference authorization and attachment ownership defects; cross-conversation idempotency emission. Normal history endpoints do check membership.                                                            |
| SSRF / path traversal             | No demonstrated arbitrary server URL fetch: provider hosts are fixed and localUploadPath rejects `..`, slash and backslash. Asset authorization remains broken.                                                            |
| Rate limits / resource exhaustion | Major uncovered expensive operations, unbounded lists/batches, local-only throttles/presence and unlimited storage.                                                                                                        |
| Errors / transaction rollback     | Transactions used correctly in some paths, but many multi-write flows and concurrency preconditions are outside them. Generic production handler hides stack traces; upload errors/configuration can still expose details. |
| Dependencies                      | Lockfile reviewed structurally; live CVE/advisory status unverified. No invented CVE findings.                                                                                                                             |




## 3. Exhaustive Issue Log & Actionable Fixes

Each entry below is tied to observed code. Conditional impacts and assumptions are stated explicitly. **Fix blocks are proposed changes:** snippets name required imports or new models where relevant; multi-component changes include implementation and validation steps. Apply dependent changes together (especially the common lock protocol, session versioning, media model and migrations). Exact line numbers refer to the supplied snapshot before changes.

**CRITICAL**

### CRITICAL - C01: Database credentials and JWT signing secrets are included in the distributed archive

- **Location:** `backend/server/.env:3–6`; deployment defaults at `.env:11–15`
- **The Problem:** The archive contains populated DATABASE_URL, DIRECT_URL, JWT_ACCESS_SECRET, and JWT_REFRESH_SECRET values, not empty example fields. The database URLs include credentials. Their current validity was not tested. The bundled NODE_ENV is development. Anyone receiving this archive receives the signing material; deleting the file from a future ZIP does not revoke it.
- **The Impact:** If these credentials are deployed, recipients can access the database according to its grants and mint signed access tokens for known user IDs. This is a release-blocking credential exposure, not proof that a live system has already been compromised.
- **The Fix:**

1. Rotate the database credential and the access signing secret at their owners; update runtime secret configuration and restart all API/socket instances. Invalidate existing refresh sessions so previously stolen sessions cannot reissue tokens. Rotate any other exposed credential actually in use; JWT_REFRESH_SECRET is currently unused, but must not be reused elsewhere.
2. Inspect access/audit records for the exposure interval. Do not reproduce old values in tickets, reports, command histories, or logs.
3. Exclude `.env`, uploads, and local diagnostics from source/archive generation. Add the following repository ignore rules; if Git already tracks the file, remove it from tracking and follow the repository's coordinated history-cleanup process after rotation.

```gitignore
.env
.env.*
!.env.example
node_modules/
dist/
uploads/
```

1. Validate archive contents in CI and deploy using injected secrets. Set NODE_ENV=production explicitly. Add startup checks from H18. The attached originals were not modified by this review.



### CRITICAL - C02: Active password-change endpoint has a universal bypass and writes plaintext

- **Location:** `backend/server/src/features/users/repository.ts` — `changePassword` (line 611); `src/features/users/routes.ts:12`; `src/features/users/schema.ts:144–147`
- **The Problem:** The reachable PATCH /users/me/password path accepts the literal `sayly123` as the current password for every account. It also accepts placeholder/plaintext comparisons instead of verifying Argon2. It then assigns newPassword directly to passwordHash. A normal Argon2 account cannot change its password using its actual current password. This is authenticated: it affects the account identified by the caller’s access token, not an arbitrary userId supplied in the body.
- **The Impact:** A stolen access token bypasses password reauthentication and can corrupt the victim’s credentials. Plaintext becomes available to database readers/backups. Later /auth/login invokes Argon2 verification on plaintext and fails, locking the user out.
- **The Fix:**

Replace the function and import `hashPassword`, `verifyPassword` from `../auth/password`, plus `refreshTokens` and `isNull`. Preserve the existing return shape:

```ts
export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.status !== "ACTIVE") throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw new AppError("Current password is incorrect", 400, "VALIDATION_ERROR");
  }
  const passwordHash = await hashPassword(newPassword);
  await db.transaction(async tx => {
    const changed = await tx.update(users).set({ passwordHash, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.status, "ACTIVE"),
        eq(users.passwordHash, user.passwordHash))).returning({ id: users.id });
    if (!changed.length) throw new AppError("Account changed; retry", 409, "CONFLICT");
    await tx.update(refreshTokens).set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  });
  return { ok: true as const };
}
```

Use the same password policy for register/reset/change (M01), rate-limit this route, and add immediate access/socket revocation (H05). Detect existing non-Argon2 rows with an offline administrator query returning IDs only; require a secure recovery flow rather than treating plaintext as a valid hash. Test wrong password, the old bypass value, correct Argon2 password, login after change, and concurrent changes.

### CRITICAL - C03: Password reset uses a global six-digit bearer credential

- **Location:** `backend/server/src/features/auth/service.ts` — `resetPassword` (line 255); `backend/server/src/features/auth/tokens.ts` — `createPasswordResetCode` (line 100); `backend/server/src/features/auth/repository.ts` — `findPasswordResetTokenByHash` (line 205); `src/db/schema.ts` — `passwordResetTokens`
- **The Problem:** Reset requests contain only token and password. A SHA-256 hash of a six-digit code globally identifies the account. There are only 1,000,000 possible values; no account/challenge binding or per-challenge attempt counter exists. IP-only throttling is the only online brake. The globally unique hash is retained for used/expired rows, so repeated codes also cause insert failures even after expiry. With N outstanding distinct codes, one random guess succeeds against some account with probability N/1,000,000.
- **The Impact:** Distributed guessing can change another account’s password; offline enumeration of reset hashes is trivial. The attacker may not immediately know the victim’s email, but unauthorized password modification itself is a compromise. Global uniqueness also increasingly breaks legitimate recovery as historical codes accumulate.
- **The Fix:**

Keep a six-digit UI only if it is bound to a high-entropy reset challenge:

1. Generate a random 32-byte `challengeId` for every request; return an indistinguishable random challenge for nonexistent emails too. Store only the real challenge hash, userId, code HMAC, expiresAt, attempts=0, usedAt=null.
2. Change the reset body to `{ challengeId, token, password }`; this is a coordinated client/API change. Never select an account by code alone.
3. HMAC the combination using a separate RESET_CODE_PEPPER injected from secrets:

```ts
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
const challengeId = randomBytes(32).toString("base64url");
function codeDigest(challengeId: string, code: string, pepper: string) {
  return createHmac("sha256", pepper).update(challengeId).update("\0").update(code).digest();
}
```

1. Lock the challenge row; reject used, expired, inactive-user, or attempts>=5 states. Increment attempts for an incorrect code and COMMIT that increment before returning the generic error; throwing inside the transaction would roll it back. Compare fixed-length digests using timingSafeEqual.
2. Complete the successful transition atomically as H01 specifies. Replace the global codeHash uniqueness constraint with unique challengeHash. Add a per-account resend cooldown and per-challenge, per-IP, and shared service limits. Invalidate earlier challenges under a user lock. Purge expired challenge records according to a documented retention period.

A high-entropy single-use email URL token is a simpler alternative if the six-digit requirement changes. These controls follow [OWASP’s reset guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

**HIGH**

### HIGH - H01: Reset issuance and consumption are not atomic or single-use under concurrency

- **Location:** `backend/server/src/features/auth/service.ts` — `forgotPassword` (line 220); `backend/server/src/features/auth/service.ts` — `resetPassword` (line 255); `src/features/auth/repository.ts:175–220`
- **The Problem:** Issuance deletes old reset rows and inserts the next one in separate transactions. Consumption reads a token, hashes the password, updates User, marks the token used, and revokes refresh tokens independently. Two requests can both pass the unused check; failures can leave a changed password with a reusable token or surviving refresh tokens.
- **The Impact:** The final password depends on race timing. Partial failures violate the documented single-use recovery/session lifecycle.
- **The Fix:**

After C03, use one repository transaction for consumption. Lock User first and challenge second in a consistent order shared with login/refresh/password change; recheck status, expiry, attempts and usedAt inside the lock. Hash the candidate password before acquiring long-lived locks, but only after cheap validation and attempt throttling. Update passwordHash, increment authVersion, mark the challenge used, invalidate other challenges, and revoke sessions in that transaction. Return a result discriminator from the transaction and throw HTTP errors after commit where failed attempts must persist.
For issuance, lock the User row and invalidate/create challenge rows inside one transaction; enqueue the email through a durable outbox in the same transaction. Never delete the previous code before the replacement can be committed. Integration test two simultaneous resets and inject a failure after every database statement: exactly one reset succeeds and all-or-nothing state is preserved.

### HIGH - H02: Refresh rotation can create multiple valid descendants and race with revocation

- **Location:** `backend/server/src/features/auth/service.ts` — `refresh` (line 134); `backend/server/src/features/auth/repository.ts` — `rotateRefreshToken` (line 139)
- **The Problem:** The service checks revokedAt/expiry/account status before the transaction. rotateRefreshToken inserts a child then unconditionally updates the parent by ID. Concurrent calls using the same parent both create valid children; an overlapping family revoke/logout/password reset can miss the child created after its scan.
- **The Impact:** Token rotation and reuse detection do not reliably contain a stolen refresh token. Security state becomes timing-dependent.
- **The Fix:**

Refactor rotation into a single locked decision:

1. Add a SessionFamily table with id, userId, revokedAt and absoluteExpiresAt, or equivalent durable family revocation state. Lock User, family, and parent token in that order for refresh, login issuance, logout and account security mutations.
2. Validate active user, family state, parent expiry and parent revokedAt inside the lock. If reuse is detected, set family.revokedAt and revoke its tokens; COMMIT before throwing TOKEN_REVOKED outside the transaction.
3. Otherwise insert exactly one child, update parent.replacedById/revokedAt, and return the new opaque secret. Add a unique predecessorId on children as a second invariant if that column is introduced.
4. Do not allow a child to extend past family.absoluteExpiresAt. Require clients to serialize refresh calls. If retry grace is desired, design it explicitly; never silently create siblings.
5. Test concurrent refresh/refresh, refresh/logout, refresh/reset and family reuse using independent PostgreSQL connections. Row locks only on the old token are insufficient if family revocation does not participate in the same protocol.



### HIGH - H03: Socket handshake bypasses issuer/audience and active-account validation

- **Location:** `backend/server/src/lib/socket.ts` — `createSocketServer` (line 8); `backend/server/src/shared/utils/jwt.ts` — `verifyAccessToken` (line 28)
- **The Problem:** The custom socket verifier verifies an HMAC but does not enforce issuer, audience, header algorithm semantics, or a mandatory numeric expiry. It does not require sub to be a string. The socket handshake never loads the account or checks ACTIVE status. Isolated probes using a synthetic key confirmed acceptance of a token without exp and one with wrong issuer/audience. This is not an alg=none bypass: a valid HMAC is still required.
- **The Impact:** Suspended accounts with an unexpired access token can reconnect and continue permitted conversation actions. Tokens issued for another purpose with the same signing key can be accepted.
- **The Fix:**

Delete the custom signer/verifier after migrating its callers. Use the same verified principal loader for HTTP and sockets:

```ts
io.use(async (socket, next) => {
  try {
    const header = socket.handshake.headers.authorization;
    const token = typeof socket.handshake.auth?.token === "string"
      ? socket.handshake.auth.token
      : typeof header === "string" && /^Bearer /i.test(header) ? header.slice(7) : "";
    if (!token || token.length > 8192) throw new Error("Unauthorized");
    const claims = await verifyAccessToken(token); // ../features/auth/tokens
    const user = await findUserById(claims.sub);  // ../features/auth/repository
    if (!user || user.status !== "ACTIVE") throw new Error("Unauthorized");
    socket.data.userId = user.id;
    next();
  } catch { next(new Error("Unauthorized")); }
});
```

In the Jose helper set `algorithms: ["HS256"]`, `requiredClaims: ["sub", "exp", "iat", "iss", "aud"]`, preserve issuer/audience validation, validate nonempty subject, and return exp plus authVersion/session identity for H04/H05. Test both transports with inactive accounts, malformed claim types, missing expiry and wrong audience.

### HIGH - H04: Established sockets never expire or reauthenticate after account changes

- **Location:** `backend/server/src/features/messaging/socket.ts` — `registerMessagingSockets` (line 62); `backend/server/src/lib/socket.ts` — `createSocketServer` (line 8)
- **The Problem:** Authentication runs once at connect. Every later event trusts socket.data.userId indefinitely. Event authorization verifies relationship state but not the caller’s active account/session. A socket can remain connected beyond JWT expiry and suspension.
- **The Impact:** A short-lived access token becomes a long-lived realtime session. Revoking a user at HTTP authentication does not revoke an existing socket.
- **The Fix:**

Store verified exp and session/version in socket.data. Schedule disconnect at expiry (clear the timer on disconnect), and reject every event when expired or when the session/version is revoked. Use a shared revocation channel to call `io.in(userRoom(userId)).disconnectSockets(true)` across replicas after suspension, deletion, password recovery and session termination. Revalidate account/session at each sensitive mutation; do not rely solely on a timer that can be delayed or on pub/sub that can lose an event. Require reconnection with a newly verified access token. Add real Socket.IO integration tests for expiry during a connection and suspension while a socket is already in its user/conversation rooms.

### HIGH - H05: Account security changes do not consistently revoke access, reset challenges, and refresh sessions

- **Location:** `backend/server/src/features/users/repository.ts` — `softDeleteAccount` (line 572); `backend/server/src/features/auth/service.ts` — `logout` (line 190); `backend/server/src/features/auth/service.ts` — `resetPassword` (line 255); `src/features/auth/tokens.ts`
- **The Problem:** Deletion cancels connections but leaves refresh/reset rows. Password change does not revoke tokens at all. Reset revokes refresh tokens only; previously issued access tokens remain valid until expiry. Logout revokes one token row but neither its family atomically nor its access token/socket. Soft-deleted users are denied by HTTP’s ACTIVE check, so retained token rows do not alone permit HTTP login.
- **The Impact:** Stolen sessions can remain active after security actions; leftover reset codes can overwrite a newly chosen password. Logout semantics are incomplete, especially for sockets.
- **The Fix:**

Add User.authVersion (integer, default 0) and include it in access claims; compare it with the account on HTTP/socket authentication. Atomically increment it, revoke all refresh families and invalidate reset challenges for password reset/change and deletion. For device-only logout use a session family ID claim and revoke that family rather than incrementing the user-wide version. Serialize issuance and revocation with the User/family locks from H02. Disconnect relevant sockets after commit via a durable revocation event. Keep historical messages as FEATURES explicitly requires; token revocation does not require deleting chat history. Document whether successful password change requires login again and update mobile clients accordingly.

### HIGH - H06: Password recovery does not send any email

- **Location:** `backend/server/src/features/auth/mail.ts` — `sendPasswordResetEmail` (line 11)
- **The Problem:** The mail function only writes logs; no SMTP/provider delivery is implemented. In production the API returns ok and hides the code, so the user has no way to receive it. Tests mock the mail function and cannot detect this.
- **The Impact:** The advertised forgot/reset password feature is unusable in production, including recovery from the plaintext-password bug.
- **The Fix:**

Introduce a Mailer interface and a real configured transport, with provider credentials injected through validated environment variables. Persist a reset-email outbox job in the same transaction as challenge issuance. A worker claims due jobs with FOR UPDATE SKIP LOCKED, sends the template, records provider message ID, retries transient errors with bounded backoff, and marks permanent failures. Do not log tokens or include them in job error messages. Encrypt secret-bearing outbox payloads and expire them with the challenge. Validate configuration at startup; never silently fall back to console mail in production. Keep the public forgot-password response identical for known/unknown email. Test the adapter with a local fake mail server and validate actual delivery in a controlled staging account before release.

### HIGH - H07: Development reset codes can be exposed by deployment configuration

- **Location:** `backend/server/src/features/auth/service.ts` — `forgotPassword` (line 220); `src/features/auth/mail.ts:22–27`; `src/config/env.ts:37–55`; `backend/server/.env:15`
- **The Problem:** Every non-production environment returns devCode for a real account. The bundled configuration selects development, and NODE_ENV defaults to development if omitted. Setting ENABLE_DEV_LOGS=true in production also logs the raw code in the second mail log block. This is conditional on deployment settings; production with correct defaults does not return devCode.
- **The Impact:** A publicly reachable development-configured instance provides the recovery credential to the requester, enabling direct account takeover. Log readers can also gain recovery codes.
- **The Fix:**

Remove devCode from the externally served API entirely. Use an isolated fake mail inbox in local tests. Remove raw-code/reset-URL logging in every environment and ensure tests capture messages through a fake Mailer rather than an HTTP response. Validate NODE_ENV against development/test/production and require it explicitly in the deployment entrypoint; fail production startup on dev mail mode. Add a test that every configuration permitted by production deployment returns the same forgot-password JSON for existing and nonexistent users, without codes or reset URLs.

### HIGH - H08: Uploads accept arbitrary extensions and active browser content

- **Location:** `backend/server/src/features/media/storage.ts` — `isAllowedFile` (line 41); `backend/server/src/features/media/storage.ts` — `chatUpload` (line 54); `src/features/media/routes.ts:12`; `src/lib/app.ts:24–25`
- **The Problem:** application/octet-stream accepts any nonempty extension, which is then retained. image/*, audio/* and video/* accept types outside the apparent allowlist, including image/svg+xml. MIME comes from the client and file bytes are never inspected. Synthetic predicate probes accepted .html with octet-stream and SVG. Public static delivery derives MIME from the extension. Swagger-enabled deployments disable CSP globally.
- **The Impact:** An authenticated user can host HTML/SVG or non-media bytes on the API origin. Script execution when a victim opens active content is especially direct when CSP is disabled; otherwise exploitability depends on response CSP and browser behavior. Even with CSP, arbitrary public hosting and misleading media remain.
- **The Fix:**

Use a quarantined upload pipeline:

1. Limit file/field/part counts before accepting multipart data; write temporary bytes outside the served directory.
2. Detect type from bytes with a maintained content-inspection library; allow an explicit set of supported raster image/audio/video formats. Reject SVG/HTML and unknown/octet-stream unless detection resolves to an allowed format. Never choose the final extension from originalname.
3. Decode/re-encode images and probe audio/video with resource limits; reject corrupt files, excessive dimensions/duration and unsupported codecs. Map detected type to a fixed extension and persist the verified MIME.
4. Generate server-owned storage keys, scan where needed, and publish only after verification and owner metadata commit. Delete temporary files in finally on all rejection/failure paths.
5. Serve private media as H09 describes, ideally from an isolated media origin. Use nosniff and a restrictive CSP on any attachment responses. Add fixtures for renamed HTML, SVG, MIME spoofing, corrupt media and file-size boundaries.

This follows [OWASP’s upload validation guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html); a filename/MIME check alone is insufficient.

### HIGH - H09: Private chat media has no ownership, authorization, or lifecycle model

- **Location:** `backend/server/src/features/media/routes.ts` (lines 1–36); `backend/server/src/features/media/service.ts` (lines 1–23); `backend/server/src/features/messaging/repository.ts` — `sendMessage` (line 410); `backend/server/src/features/messaging/learning.ts` — `localUploadPath` (line 103)
- **The Problem:** All files are publicly served before authenticate. Uploads create no owner/purpose/database record. Any user can attach another known media URL, invent a thumbnail, or request transcription of a known local upload by embedding its basename into their own message. The path helper rejects traversal but does not establish ownership. FEATURES documents public media, so this is a security/design defect in the contract itself, not a missing implementation of that line.
- **The Impact:** A leaked URL grants indefinite access outside the conversation’s block/account policy. Another user can reuse or transcribe someone else’s uploaded audio. Random filenames reduce guessing, but are not an authorization boundary.
- **The Fix:**

Add MediaAsset(id, ownerId, storageKey, verifiedMime, size, kind, purpose, state, createdAt, expiresAt) plus a MessageAttachment association. Return an assetId from upload; accept it in media-message creation and verify ownerId=userId, state=READY, allowed kind and purpose inside the send transaction. Bind the asset to the conversation on commit; decide whether explicitly authorized forwarding creates a new association. Resolve transcription through that association, never from arbitrary content strings. Replace express.static for chat attachments with an authenticated asset handler that verifies accessible conversation membership or a short-lived signed download URL issued after authorization. Public avatars should use a separate deliberate policy. Add expiry cleanup for unattached uploads and retention/deletion jobs. Coordinate this API change with mobile URL handling.

### HIGH - H10: Expensive and abusive operations bypass the limited HTTP throttles

- **Location:** `src/shared/middleware/rateLimit.ts`; `src/features/messaging/socket.ts`; media, discovery, connections, safety, users and learning routes
- **The Problem:** Only /auth and HTTP message sends are limited. Socket sends, typing, joins, read events, online lookups, uploads, translation/transcription, password change, reports and connection requests have no application quota. Uploads are individually capped at 40 MB but total storage and request concurrency are unbounded. The shared auth bucket also lets normal refresh/me/logout traffic exhaust the login allowance for every user behind one NAT.
- **The Impact:** Authenticated abuse can fill disk, consume provider budget, flood reports, saturate PostgreSQL and generate event storms. Multiple API replicas multiply process-local allowances; socket transport bypasses HTTP send limits entirely.
- **The Fix:**

Create one shared limiter service consumed by both HTTP middleware and socket/service entrypoints. Use atomic Redis token-bucket or fixed-window operations keyed by action and userId, plus an independent trusted-IP limit for public auth/handshakes. Use distinct buckets for login, reset issue/verify, refresh, uploads, AI, reports and sends; do not charge logout/me to the login bucket. Add per-account upload byte quotas and maximum outstanding uploads; enforce AI concurrency and daily spend limits before file reads/provider requests. Limit simultaneous sockets and joined rooms per account, debounce typing, and cap IDs in read batches. On Redis outage, fail closed for security/cost-sensitive writes or use an explicitly bounded emergency policy. Exercise the same send quota via HTTP and sockets and verify replica-wide counters. Document chosen product limits instead of burying defaults in handlers.

### HIGH - H11: Idempotency can emit a message from one conversation to another recipient

- **Location:** `backend/server/src/features/messaging/repository.ts` — `sendMessage` (line 410); `src/features/messaging/controller.ts:45`; `src/features/messaging/socket.ts:94–96`
- **The Problem:** The prior-message lookup is keyed only by senderId and clientMessageId. If the sender reuses a key from conversation A while sending to authorized conversation B, the repository returns A’s message with B’s recipientId. The gateway then emits that message to B’s user room and A’s conversation room. It does not compare conversation, content or metadata. Authorization was checked only for B.
- **The Impact:** An accidental retry-key collision can disclose conversation A content to B, revive events for a now-blocked relationship, and return a response that contradicts the requested conversation. This requires a prior message authored by the caller; it is not arbitrary access to messages authored by strangers.
- **The Fix:**

Retain the global sender/key constraint if desired, but reject mismatched reuse before returning any prior message:

```ts
if (prior) {
  const same = prior.conversationId === input.conversationId &&
    prior.type === (input.type ?? "TEXT") && prior.content === input.content &&
    prior.caption === (input.caption?.trim() || null) &&
    prior.durationMs === (input.durationMs ?? null) &&
    prior.mimeType === (input.mimeType ?? null) &&
    prior.thumbnailUrl === (input.thumbnailUrl ?? null);
  if (!same) throw new AppError("Idempotency key reused for different input", 409, "CONFLICT");
  return { message: toMessageDto(prior), recipientId: otherUserId, created: false };
}
```

Add `created: boolean` to SendMessageResult. Emit message_new/promote delivery only when created=true; otherwise return the prior result without side effects. For mediaAssetId after H09 include the immutable association in the equality/fingerprint. Apply H12 so concurrent identical retries also work. Test A→B cross-conversation reuse and verify that B receives no event.

### HIGH - H12: Concurrent message retries hit a unique violation instead of returning the original result

- **Location:** `backend/server/src/features/messaging/repository.ts` — `sendMessage` (line 410); `src/db/schema.ts` — `Message_senderId_clientMessageId_uidx`
- **The Problem:** The pre-insert lookup and insert are separate operations. Two retries can both see no row; the unique index correctly prevents duplicate storage, but the losing transaction throws and becomes HTTP 500/socket failure. The code does not catch or resolve that conflict.
- **The Impact:** Mobile retries fail unpredictably and may encourage the client to generate a new key and duplicate the message.
- **The Fix:**

Within the message transaction use `INSERT ... ON CONFLICT DO NOTHING RETURNING *` targeting the existing partial unique index (or redesign it as an ordinary sender/key unique constraint, which also permits multiple NULLs in PostgreSQL). When no row is returned, select by sender/key in a new statement under READ COMMITTED, verify the complete immutable input as H11 requires, and return created=false. Only the actual inserting transaction updates the inbox summary and writes the outbox event. If using catch instead, catch the 23505 outside the rolled-back transaction and load the winning row in a fresh transaction; do not query inside an aborted PostgreSQL transaction. Require a key for retryable client sends and document its scope. Test many simultaneous identical requests with one stored row, one created event, and consistent successful responses.

### HIGH - H13: Onboarding and advertised atomic profile editing can partially commit

- **Location:** `backend/server/src/features/users/repository.ts` — `completeOnboarding` (line 257); `backend/server/src/features/users/repository.ts` — `putMeProfile` (line 501); `backend/server/src/features/users/repository.ts` — `updateProfile` (line 466)
- **The Problem:** Onboarding writes Profile, deletes/inserts languages and updates User without a transaction. PUT profile writes Profile/User first and invokes a separate language transaction afterwards. The “pooler compatibility” comments do not supply atomicity; this repository uses pg and already uses transactions elsewhere. Errors or concurrent requests leave inconsistent duplicate profile fields, missing languages or incorrect completion flags.
- **The Impact:** FEATURES’ PRO-002 atomic edit guarantee is false. A failed request may already have changed public data or destroyed language preferences.
- **The Fix:**

Make the service orchestrate one db.transaction per user mutation. Lock `User` by ID with FOR UPDATE at the start; verify active state and load Profile inside the transaction. Pass its DbTransaction into all profile/User/language repository operations; do not call the global db or start nested independent transactions. Upsert Profile with onConflictDoUpdate(userId), sync languages under the same user lock, compute completion from the resulting state and update User. Build the response from that same transaction snapshot. Validate IDs and inexpensive input before beginning the transaction. Refactor syncUserLanguages into an operation taking a tx argument, with a standalone wrapper only for independent calls. Fault-inject after each statement and verify rollback; run onboarding/profile/language mutations concurrently and confirm each successful result is a valid full state.

### HIGH - H14: Connection transitions and block/send checks are vulnerable to stale authorization

- **Location:** `backend/server/src/features/connections/repository.ts` — `acceptConnection` (line 279); `createRequest`, `declineConnection`, `cancelConnection`, `removeConnection`; `backend/server/src/features/safety/repository.ts` — `createBlock` (line 52); `backend/server/src/features/messaging/repository.ts` — `sendMessage` (line 410)
- **The Problem:** Connection mutations read status/actor before writes that filter only by ID. Accept does not recheck a block or requester status. Block cancellation and message authorization do not share a lock with send/request transitions. An accept can overwrite a concurrent cancel/block, and a send authorized before a block can commit afterward. Reopening a terminal row can race with a second reopen and reverse request direction.
- **The Impact:** State transitions violate recipient/requester rules at commit time, requests can reappear after a block, and blocked communication can still be committed in a race.
- **The Fix:**

Define a single lock protocol for pair operations: lock both User rows in canonical ID order (or a dedicated canonical Relationship row), then the relationship/conversation. Use it for request, accept, decline, cancel, remove, block and send. Recheck actor, ACTIVE status, block existence and expected relationship status within the transaction. Updates must include expected state and actor predicates and inspect RETURNING:

```ts
const changed = await tx.update(connections)
  .set({ status: "ACCEPTED", updatedAt: new Date() })
  .where(and(eq(connections.id, connectionId), eq(connections.recipientId, userId),
    eq(connections.status, "PENDING")))
  .returning();
if (!changed.length) throw new AppError("Connection state changed", 409, "CONFLICT");
```

All competing paths must acquire the same locks; adding a transaction to only accept is insufficient. Create/reuse the conversation in that transaction. Outbox delivery must recheck policy where an event would disclose content after a later block. Test accept/cancel, accept/block, reverse reopen, send/block and deletion/request races.

### HIGH - H15: Database uniqueness allows reciprocal connections and duplicate direct conversations

- **Location:** `src/db/schema.ts` — `connections`, `conversations`; `backend/server/src/features/connections/repository.ts` — `createRequest` (line 164); `acceptConnection`, `findConversationId`
- **The Problem:** The unique index is directional (requesterId, recipientId). Simultaneous A→B and B→A inserts both succeed. No unique canonical pair identifies a DIRECT conversation. Pair lookup groups participant rows without an explicit direct-pair identity. Duplicate reciprocal connections can create separate conversations or multiply inbox joins.
- **The Impact:** Users see duplicate requests/chats, arbitrary connection status and inconsistent unread/history state. Sequential same-row accepts often serialize on the update; the independently confirmed cross-pair race is the dangerous case.
- **The Fix:**

First inspect and reconcile reciprocal rows/conversations in a reviewed data migration; preserve messages and map clients to one canonical conversation. Then enforce:

```sql
CREATE UNIQUE INDEX "Connection_unordered_pair_uidx"
ON "Connection" (LEAST("requesterId", "recipientId"), GREATEST("requesterId", "recipientId"));
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_no_self"
CHECK ("requesterId" <> "recipientId");
```

Represent direct identity explicitly, for example DirectConversation(userLowId, userHighId, conversationId UNIQUE) with primary key(userLowId,userHighId), foreign keys and CHECK(userLowId<userHighId). In the locked acceptance transaction use INSERT ON CONFLICT for that mapping, then ensure exactly the two participant rows. Lookups should use that mapping rather than GROUP BY/count across arbitrary membership. Keep requester/recipient direction on Connection for lifecycle authorization. Mirror constraints in Drizzle migrations and test opposite-direction requests concurrently.

### HIGH - H16: Reports accept message references outside the reporter’s conversations

- **Location:** `backend/server/src/features/safety/repository.ts` — `createReport` (line 104)
- **The Problem:** For message reports the code checks only message existence and senderId=reportedId. It never checks that reporterId is a participant in that message’s conversation. Report.messageId is also plain text without a foreign key.
- **The Impact:** A user who knows a message ID can submit an unauthorized report against another conversation and probe whether that ID belongs to a particular sender. The response does not reveal content, so this is an authorization/evidence-integrity defect rather than direct message-text disclosure.
- **The Fix:**

Select the reportable message with a membership join:

```ts
const [message] = await db.select({ id: messages.id }).from(messages)
  .innerJoin(conversationParticipants, and(
    eq(conversationParticipants.conversationId, messages.conversationId),
    eq(conversationParticipants.userId, input.reporterId)))
  .where(and(eq(messages.id, input.messageId), eq(messages.senderId, input.reportedId)))
  .limit(1);
if (!message) throw new AppError("Message not found", 404, "NOT_FOUND");
```

Import conversationParticipants. Use historical membership here rather than the normal accepted/not-blocked send guard: a victim must still be able to report after blocking/removing a connection. Add a foreign key with an explicit evidence retention policy (or immutable evidence snapshot), and test stranger message IDs, own messages, nonexistent messages and reporting after block.

### HIGH - H17: No reproducible migration set is shipped; messaging repair omits current schema

- **Location:** `backend/server/drizzle.config.ts`; `backend/server/package.json` — db:migrate; `backend/server/scripts/ensure-messaging-schema.ts`; missing `backend/server/drizzle/`
- **The Problem:** The ZIP contains no migration SQL/journal despite exposing db:generate/db:migrate. The messaging repair adds caption and earlier fields but not clientMessageId or its unique index, while every message select/insert now expects that column. The repair assumes existing base tables/enums. Schema.ts alone does not tell which changes a deployed database has received.
- **The Impact:** A clean database cannot be reproducibly bootstrapped with the supplied migrate workflow. A database upgraded only with the advertised repair script can fail message operations with missing-column errors.
- **The Fix:**

Generate and commit a reviewed baseline and ordered upgrade migrations, including all enum/table/column/index definitions. Inventory actual deployed schema before choosing a baseline; do not run destructive db:push/reset against it. Add the missing clientMessageId migration and partial unique index after detecting duplicates. Convert ad hoc repairs to versioned migrations, separating enum additions and dependent usage where PostgreSQL requires it. Put seeds after schema migration, with a separate migration role from the runtime DML role. CI must create an empty PostgreSQL database, apply all migrations, run integration tests, then run migrate again and assert no pending drift. Test upgrade from the last supported deployed snapshot, including last-message backfill.

### HIGH - H18: Environment settings fail open and production configuration is insufficiently validated

- **Location:** `backend/server/src/config/env.ts` (lines 1–64); `backend/server/src/db/client.ts` (lines 1–22); `backend/server/.env.example`
- **The Problem:** NODE_ENV accepts arbitrary values/defaults to development, secrets need only be nonempty, duration strings are validated only when later used, and numeric values permit zero/negative/fractional settings. CLIENT_ORIGIN is loaded but ignored. JWT_REFRESH_SECRET is required although opaque refresh tokens never use it. db/client accepts DIRECT_URL alone while env.ts insists on DATABASE_URL and always prefers the direct endpoint when both exist.
- **The Impact:** Misconfiguration can expose debug behavior, weaken JWTs, break auth after partial DB writes, disable useful limits or exhaust direct database connections. Startup behavior differs across entrypoints.
- **The Fix:**

Create a single Zod environment schema loaded once before constructing resources. Require NODE_ENV as an enum in deployment, PORT as integer 1–65535, positive integer limit/window values, supported positive duration strings, and non-placeholder random access secret of at least 32 bytes. Validate origins as exact http(s) origins and reset destinations against the chosen app scheme/HTTPS policy. Validate optional provider credentials together with their feature flags. Use DATABASE_URL for runtime pool access and a separately named migration URL for DDL; document explicit fallback if required. Remove JWT_REFRESH_SECRET if it remains unused; do not imply that it signs opaque refresh tokens. Export immutable parsed config and stop reading process.env in DB/scripts independently. Add configuration tests for invalid NODE_ENV, empty/weak secrets, zero TTL and malformed durations.

### HIGH - H19: Production error and security logging is disabled by default

- **Location:** `backend/server/src/shared/utils/logger.ts` — `write` (line 44); `src/config/env.ts:55`; `src/shared/middleware/requestLogger.ts:11–14`
- **The Problem:** All levels, including warn/error and refresh-reuse alerts, return immediately unless ENABLE_DEV_LOGS is enabled. Production defaults that flag to false. HTTP completion logs are also skipped entirely. Security incidents and database/provider failures can therefore produce no application diagnostics.
- **The Impact:** Operators cannot reliably detect attacks, diagnose 500 responses, or determine whether remediation worked.
- **The Fix:**

Separate log level from developer verbosity. Always permit warn/error and necessary security audit events; enable structured info access logs according to the operational policy, and gate only debug detail. For the existing logger, replace the unconditional isEnabled check with `if (level === "debug" && !env.enableDevLogs) return;`. Move request completion logging outside the early dev-log return, use a full randomUUID request ID and return it in X-Request-Id. Log route path without sensitive query strings, status, duration, event code and request ID. Add metrics for auth failures, token reuse, queue failures, DB latency and rejected uploads. Apply M03 redaction before enabling production logs; do not solve missing logs by exposing reset codes.

### HIGH - H20: Unobserved socket promises can terminate the process

- **Location:** `src/features/messaging/socket.ts:78,161–162` — `broadcastPresence`, disconnect handler
- **The Problem:** `void broadcastPresence(userId)` and `void messagingService.persistLastSeen(...)` discard promises without catch. Database errors reject these promises outside the handler try/catch. promoteDelivered catches errors, but these other background paths do not.
- **The Impact:** On runtimes treating unhandled rejections as fatal, a transient DB failure during connect/disconnect can crash the API. Even under a warning-only policy, failures disappear.
- **The Fix:**

Attach explicit rejection handling at every detached task:

```ts
function runBackground(name: string, task: Promise<unknown>) {
  void task.catch(error => logger.error("socket", name, {
    message: error instanceof Error ? error.message : "Unknown error",
  }));
}
runBackground("presence broadcast failed", broadcastPresence(userId));
runBackground("last-seen persistence failed", messagingService.persistLastSeen(userId, lastSeen));
```

Import the corrected production logger. Where ordering matters, combine persistence and broadcast in one caught async task. Durable security/account notifications must use the outbox rather than detached promises. Add a DB-rejection test for connect/disconnect and assert that the process stays alive and one sanitized error is recorded.

### HIGH - H21: Build configuration combines incompatible CommonJS and bundler resolution

- **Location:** `backend/server/tsconfig.json:4–5`; `backend/server/tsconfig.build.json`; `backend/server/package.json` — build/start; lockfile TypeScript 6.0.3
- **The Problem:** The project asks tsc to emit CommonJS with moduleResolution=bundler. Bundler resolution is not a compatible setting for this CommonJS compilation mode. Development uses tsx, so a working dev server does not establish that tsc builds or that dist/index.js can load all dependencies. The exact project build could not run because offline npm installation failed; this finding is grounded in the configuration, not a fabricated compiler execution.
- **The Impact:** The declared production build/start pipeline is not release-ready. Runtime compatibility is also unspecified for ESM dependencies such as Jose.
- **The Fix:**

Choose a Node runtime/module strategy and make all scripts agree. A concrete path for this package is a maintained Node 24 runtime with NodeNext resolution, retaining CommonJS package classification initially:

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext",
    "lib": ["ES2022"], "outDir": "dist", "rootDir": "src", "strict": true,
    "noUncheckedIndexedAccess": true, "esModuleInterop": true,
    "skipLibCheck": true, "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true, "types": ["node"], "noEmitOnError": true
  },
  "include": ["src"], "exclude": ["dist", "node_modules"]
}
```

Pin and validate that runtime in CI; run npm ci, npm run typecheck:all, npm run build and an actual `node dist/index.js` smoke test with disposable config/database. If any dependency cannot be required on the selected runtime, migrate the package to ESM (`type: module`, .js local import specifiers under NodeNext) rather than suppressing compiler errors. Do not switch to ESNext output without either ESM runtime configuration or a real bundler. See [TypeScript’s module resolution documentation](https://www.typescriptlang.org/tsconfig/moduleResolution.html).

**MEDIUM**

### MEDIUM - M01: Password normalization and policy disagree across endpoints

- **Location:** `src/features/auth/schema.ts:14–19,35–45,67–76`; `src/features/users/schema.ts:144–147`
- **The Problem:** Registration/reset preserve password whitespace, while login trims it. A password containing intentional leading/trailing spaces hashes successfully but cannot be submitted identically at login. Register/reset have no maximum while change uses min 6/max 128, weaker than the documented register rule.
- **The Impact:** Legitimate users are locked out by normalization, can downgrade password requirements, and can submit unnecessarily large hashing inputs.
- **The Fix:**

Export a shared newPasswordSchema preserving exact text, with the currently required min 8, letter+number rule and a documented max (for example 128 characters). Reuse it at register, reset and change. Login/currentPassword must preserve exact bytes, only enforce nonempty and a compatible upper bound; do not apply new-password complexity rules when verifying existing credentials. Remove the login trim transform. Bound email length and refresh-token body sizes as well. Before introducing limits, check whether legitimate existing credentials exceed them and provide a recovery path. Test a password with spaces end-to-end through register/login/change/reset.

### MEDIUM - M02: Unused demo authentication code and unsafe operator scripts remain in the release tree

- **Location:** `backend/server/src/features/users/repository.ts` — `findOrCreateLoginUser` (line 135); `ensureDemoUserId`; `scripts/create-onboarding-test-user.ts`; `scripts/inspect-and-reset-passwords.ts`; `scripts/seed-demo-users.ts`; `scripts/inspect-latest-user.ts`
- **The Problem:** Unused repository helpers store/compare plaintext and accept demo placeholders. They are not mounted by the active auth router, so they are latent hazards rather than a second unauthenticated bypass. The onboarding script writes plaintext. Reset/demo scripts load the default .env, reactivate accounts and overwrite passwords without a production guard; diagnostic scripts print email/DOB/hash fragments.
- **The Impact:** Accidental reuse or running a convenience script against the wrong database can corrupt credentials, undo moderation and disclose personal data.
- **The Fix:**

Delete the unreachable demo login functions from application repositories and remove their exports/references. Keep fixtures under a test/dev-only command directory excluded from deployment. Use hashPassword in every fixture writer. Require both NODE_ENV in {development,test} and an explicit disposable database identifier/allowlist before any destructive script; merely checking the environment name is insufficient when it points to a real DB. Replace hard-coded user IDs and common passwords with explicit fixture IDs/random values, never reactivate arbitrary users, and run multi-table seed changes transactionally. Separate read-only inspection from reset commands and output only fields required for the task. Do not execute any supplied reset/seed script during an audit.

### MEDIUM - M03: Log redaction misses camel-case secrets and nested values

- **Location:** `src/shared/utils/logger.ts:7–14,20–41`; `src/shared/middleware/errorHandler.ts:78–84`; requestLogger path logging
- **The Problem:** The set contains accessToken/refreshToken/confirmPassword, but lookup lowercases the key. Those names never match. Redaction is shallow, and free-form err.message/stack and originalUrl may contain sensitive query parameters or Drizzle query parameter values. The isolated redaction probe confirmed the camel-case/nested misses; no claim is made that every existing call currently logs a token.
- **The Impact:** Enabling operational logs can expose credentials, reset codes, message text or PII during failure handling.
- **The Fix:**

Normalize the denylist to lowercase and recurse with depth/cycle bounds:

```ts
const secretKeys = new Set([
  "password", "newpassword", "currentpassword", "confirmpassword", "passwordhash",
  "accesstoken", "refreshtoken", "token", "tokenhash", "authorization", "cookie",
  "code", "reseturl", "database_url", "direct_url", "openai_api_key"
]);
function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > 8) return "[depth-limit]";
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map(v => redact(v, depth + 1, seen));
  return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,
    secretKeys.has(k.toLowerCase()) ? "[redacted]" : redact(v, depth + 1, seen)]));
}
```

Prefer an allowlist of safe metadata for database/auth errors; recursion cannot redact secrets embedded in arbitrary strings. Log error class/code and controlled stack frames, not SQL plus parameters. Omit URL queries and use req.path/route templates. Test nested arrays, camel-case names, cycles and realistic wrapped DB errors.

### MEDIUM - M04: CORS reflects every origin and Swagger disables CSP for the whole app

- **Location:** `src/lib/app.ts:24–34`; `src/lib/socket.ts:9–11`; `src/config/env.ts:43`
- **The Problem:** CLIENT_ORIGIN is unused: both transports reflect arbitrary origins with credentials enabled. Enabling Swagger disables CSP globally rather than only for docs. Bearer tokens are explicitly supplied, so this is not by itself proof of cookie-based CSRF or automatic token theft.
- **The Impact:** The browser-origin trust boundary is unnecessarily permissive and compounds the active-content upload issue. Future cookie use would make the configuration more dangerous.
- **The Fix:**

Parse configured exact origins once and share the allowlist. For HTTP:

```ts
const allowed = new Set(env.clientOrigin.split(",").map(s => s.trim()).filter(Boolean));
app.use(cors({
  origin(origin, cb) { cb(null, !origin || allowed.has(origin)); },
  credentials: false,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
  exposedHeaders: ["X-Request-Id"]
}));
```

Native clients may omit Origin; continue authenticating them. Configure Socket.IO origin checks and allowRequest for browser connections, since WebSocket origin policy is not enforced merely by HTTP CORS. Keep Helmet CSP globally; customize only Swagger route policy or disable docs in production. Keep attachments on an isolated origin with their own restrictive policy. Test allowed/disallowed browser origins and no-Origin mobile clients.

### MEDIUM - M05: Proxy trust and session IP attribution can be spoofed on some deployments

- **Location:** `src/lib/app.ts:22`; `src/features/auth/controller.ts:14–26`
- **The Problem:** Trusting exactly one hop is safe only when every request must traverse the intended proxy. Directly reachable or variable-hop deployments can let clients supply the trusted forwarding value. requestMeta independently takes the first X-Forwarded-For value, bypassing Express’s trust calculation altogether.
- **The Impact:** Rate limits can become bypassable under the wrong topology and refresh-session IP audit data can be forged. The deployed proxy/network configuration was not provided, so external exploitability is conditional.
- **The Fix:**

Restrict network ingress to the reverse proxy and set trust proxy to its exact CIDRs/function, verified against every ingress route. Use only `req.ip` for session metadata:

```ts
function requestMeta(req: Request): RequestMeta {
  return { userAgent: req.get("user-agent")?.slice(0, 512), ip: req.ip };
}
```

Have the edge strip/replace untrusted forwarding headers. Add deployment tests for direct ingress rejection, spoofed X-Forwarded-For and IPv6 normalization. Do not blindly change trust proxy to true.

### MEDIUM - M06: Login timing reveals account existence and reset issuance lacks account cooldown

- **Location:** `backend/server/src/features/auth/service.ts` — `login` (line 111); `backend/server/src/features/auth/service.ts` — `forgotPassword` (line 220); `src/shared/middleware/rateLimit.ts`
- **The Problem:** Missing/inactive accounts return before Argon2 verification, while real active accounts perform an expensive verify. Forgot-password performs different DB/mail work for real accounts. Generic response messages do not erase these timing differences. IP-only rate limits do not bound reset requests targeting one email from many IPs.
- **The Impact:** Attackers can improve email enumeration and repeatedly invalidate a victim’s reset code or flood mail once delivery is implemented. Registration explicitly returns duplicate-email conflict as documented, so enumeration cannot be claimed fully solved by timing equalization alone.
- **The Fix:**

Verify login against a precomputed valid dummy Argon2 hash when the user is absent/inactive, then return the same invalid-credentials error. Keep bounded per-account and IP attempt controls; do not recompute the dummy hash on each request. Queue forgot-password processing and return the same response/challenge shape for all accounts. Enforce a per-account resend cooldown and delivery budget, without permanently locking the account on unauthenticated requests. Decide separately whether the documented registration 409 is acceptable. Measure timing distributions under controlled load rather than adding arbitrary sleeps.

### MEDIUM - M07: Expired token records accumulate without cleanup

- **Location:** `src/db/schema.ts` — RefreshToken and PasswordResetToken; `src/features/auth/repository.ts`; absence of maintenance worker
- **The Problem:** Every login/refresh adds a row. Used reset tokens remain indefinitely; issuance deletes only unused rows for that user. No cleanup job is present. The reset hash collision consequence is separately addressed by C03.
- **The Impact:** Token indexes, backups and queries grow continuously, while session metadata is retained longer than needed.
- **The Fix:**

Define retention periods for expired reset challenges, revoked sessions and security audit events. Add a scheduled bounded cleanup job using expiresAt indexes, deleting in batches (e.g. 1,000 IDs ordered by expiry) until its time budget ends. Keep family revocation state until all descendants are expired, so cleanup does not undermine replay detection. Record aggregate deletion counts, not tokens/IPs. Store minimal durable security events separately if needed. Test that active families/challenges are never deleted and that the job can resume safely after failure.

### MEDIUM - M08: Profile completion can be bypassed and is computed differently by each path

- **Location:** `backend/server/src/features/users/repository.ts` — `completeOnboarding` (line 257); `updateProfile`, `putMeProfile`, `updateUserLanguages`; `backend/server/src/features/users/dto.ts` — `isProfileComplete` (line 75)
- **The Problem:** Onboarding marks profileCompleted only when country and age are available. Later profile/language edits unconditionally set it true; even legacy PATCH {} is accepted and sets it true. The DTO independently considers goals/country/languages sufficient, without the same age rule. Discovery relies on the stored flag, so the user-visible status and eligibility disagree.
- **The Impact:** Incomplete or age-unvalidated profiles can become discoverable, while other users can see “complete” in /users/me but remain excluded from discovery.
- **The Fix:**

Define the completion policy once with product ownership, including whether age is mandatory or only checked when supplied. Implement a pure function taking the full resulting profile/language state and use it on onboarding, PATCH, PUT, language changes and DTOs. Reject an empty legacy PATCH. Compute and persist the flag inside H13’s transaction; DTOs should reflect that same rule, not OR against a stale flag. Backfill existing flags after validating the policy. Test language-only onboarding, empty PATCH, country-only edit, missing age, valid completed profile and removal of required data. Do not silently treat optional age in the current contract as verified identity.

### MEDIUM - M09: Date-of-birth and stored age drift or disagree

- **Location:** `src/features/users/schema.ts` — `dateOfBirthSchema`, `completeOnboardingSchema`; `backend/server/src/features/users/repository.ts` — `ageFromDateOfBirth` (line 36); `completeOnboarding`; `src/features/users/dto.ts` age fields
- **The Problem:** The DOB parser relies on JavaScript Date normalization, accepts time suffixes, and has no upper age limit matching age<=120. Local-time age calculation varies around timezone boundaries. Existing DOB plus a later age-only onboarding request can persist an age inconsistent with DOB. Cached age is returned indefinitely and does not advance on birthdays.
- **The Impact:** Age-based eligibility and displayed ages become inaccurate; invalid calendar inputs may normalize to another day.
- **The Fix:**

Accept DOB as a strict YYYY-MM-DD calendar date, verify that parsed UTC year/month/day exactly round-trip, and require age in the selected 13–120 policy on today’s UTC/date-only calendar. If DOB exists, derive age from DOB and reject or ignore a conflicting age field explicitly. Store DOB as PostgreSQL date rather than timestamp; return only derived coarse age publicly. For users providing only age, store an ageAsOfDate and define an update policy instead of pretending it is a verified birth date. Add leap-day, future-date, February-overflow, timezone-boundary and birthday tests.

### MEDIUM - M10: Profile media accepts arbitrary schemes and large database-embedded payloads

- **Location:** `src/features/users/schema.ts:35`; `src/features/users/repository.ts` — `completeOnboarding`, `updateProfile`, `putMeProfile`; public DTOs
- **The Problem:** Avatar fields are arbitrary strings up to two million characters. PUT/onboarding reject above 400,000 in repository code, but legacy PATCH accepts the larger limit. No URL/scheme/type/ownership validation exists. The same string is duplicated across User/Profile and included in public list payloads; CurrentUserDto repeats it under three aliases.
- **The Impact:** Large data URLs amplify DB/network/memory usage, especially in discovery and unbounded connections. Unsafe URL schemes can reach clients; actual XSS depends on how those clients render/open the string, which is outside this archive.
- **The Fix:**

Move avatars to MediaAsset references using H08/H09. Validate an owned verified image assetId at the boundary and store one canonical reference. During transition, accept only approved HTTPS media hosts or exact server-issued relative paths with a small URL length limit; reject javascript:, file:, arbitrary data: and unknown schemes. If old data URLs must be migrated, decode/validate/upload them in an offline controlled task. Apply identical validation and clearing semantics to all profile routes. Avoid repeating large values under aliases; deprecate aliases only with client coordination. Profile-image validation is not a server-side SSRF fix, because the current code does not fetch arbitrary avatar URLs.

### MEDIUM - M11: Concurrent language replacements can merge incompatible selections

- **Location:** `backend/server/src/features/languages/repository.ts` — `syncUserLanguages` (line 141); `src/db/schema.ts` — `userLanguages`; `src/features/languages/schema.ts` — `addLanguageSelectionIssues`
- **The Problem:** Transactions read existing languages without locking the user. Two disjoint replacements can both compute inserts/deletes from the same old snapshot and commit a union rather than either intended replacement. DB uniqueness includes type, so opposite SPEAKS/LEARNING rows are legal. Native count is checked only for SPEAKS, leaving the document’s unqualified “≤1 NATIVE” ambiguous for LEARNING.
- **The Impact:** Concurrent mobile edits can exceed counts or violate cross-role/native invariants despite each request passing validation.
- **The Fix:**

Acquire the same User FOR UPDATE lock used by H13 before reading languages. Perform the entire replacement within that transaction. Add unique(userId,languageId) if cross-role duplication is always forbidden; replace the existing three-column unique constraint after reconciling data. Add a partial unique index on userId for SPEAKS/NATIVE to enforce at most one spoken native. Decide whether LEARNING/NATIVE should be rejected; if the documented native limit is global, enforce it across both arrays and in an appropriate partial index. Validate maximum counts under the user lock; a simple CHECK cannot count other rows. Keep bounded sequential updates if desired (at most 15 rows); they are not the unbounded N+1 bottleneck found in connections.

### MEDIUM - M12: Public language reads perform hundreds of seed writes and cache misses stampede

- **Location:** `backend/server/src/features/languages/repository.ts` — `listLanguages` (line 92); `seedLanguageCatalog`, `findUserLanguages`
- **The Problem:** An uncached GET /languages seeds the catalog if row count is smaller than the bundled array, doing sequential upserts. Concurrent misses all enter seeding. A count comparison cannot detect missing required codes when unrelated extra rows keep the count high. User-language reads have no deterministic ordering, yet nativeLanguageCode falls back to the first spoken row.
- **The Impact:** A public read becomes a write-heavy operation and cold-start bottleneck. Missing IDs can break onboarding, and fallback translation language can change nondeterministically.
- **The Fix:**

Move seeding to a versioned deployment/seed task, bulk-upsert catalog rows once, and verify required codes by set membership/catalog version rather than total row count. Make GET read-only with a TTL cache and a shared in-flight Promise so concurrent misses reuse one load; clear that promise in finally and do not cache failures. Order user language rows explicitly by type and catalog sortOrder/code, or add an explicit preferred/native language setting. Test an incomplete catalog with extra custom rows and simultaneous cold reads.

### MEDIUM - M13: Discovery country aliases are asymmetric and search escaping changes the query

- **Location:** `backend/server/src/features/users/countries.ts` — `countryMatchCandidates` (line 260); `backend/server/src/features/discovery/repository.ts` — `escapeIlike` (line 52)
- **The Problem:** Only one primary country name is included for an ISO filter even though validation stores any accepted alias. For example CZ expands to cz/czech republic, while a profile may contain Czechia; the isolated helper check confirmed this mismatch. escapeIlike deletes % and _ instead of escaping them and leaves backslash untouched, changing literal searches or their wildcard behavior. Drizzle parameterization still prevents SQL injection here.
- **The Impact:** Valid profiles disappear under country filters; searches containing punctuation/wildcards do not behave as users expect.
- **The Fix:**

Canonicalize every new country write to ISO-2 via normalizeCountryInput and migrate stored names using all known aliases, leaving unrecognized values for review. During transition include every COUNTRY_NAME_TO_ISO entry mapping to the selected ISO, not just the first. Escape literal LIKE metacharacters without deleting user text:

```ts
function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, ch => `\\${ch}`);
}
```

Keep parameterized Drizzle ilike and verify the database’s escape semantics with integration tests for %, _, backslash, Czechia/Czech Republic/CZ and both Côte/Cote aliases. The country list is an app-supported subset, not a complete territory catalog; document that or source a maintained dataset if full territory coverage is required.

### MEDIUM - M14: Discovery ranking, count and deep offset queries have a scalability ceiling

- **Location:** `backend/server/src/features/discovery/repository.ts` — `discoverPartners` (line 300); `matchScoreSql`; `src/features/discovery/schema.ts` — page; `src/features/messaging/schema.ts` — page
- **The Problem:** Every discovery request runs exact count plus a score-sorted OFFSET query with repeated correlated overlap subqueries. Page has no maximum safe offset; message offset pagination has the same unbounded depth. The code correctly hydrates only page IDs, so this is not an application-side all-user load or classic N+1.
- **The Impact:** Large candidate sets and deep pages consume increasing DB work even though the response limit is small. No live EXPLAIN/load measurements were available, so actual latency is unmeasured.
- **The Fix:**

Immediately bound legacy page/offset to a documented reasonable depth and reject unsafe integers. Introduce a cursor ordered by `(matchScore DESC, displayName ASC, id ASC)` with a cursor tied to viewer language/filter version; omit or separately cache exact counts if product permits. Rewrite overlap scoring as one aggregate over candidate language rows rather than repeated subqueries, preserving the exact score bands:

```sql
SELECT ul."userId",
 count(*) FILTER (WHERE ul.type='SPEAKS' AND ul."languageId"=ANY($1::text[])) AS they,
 count(*) FILTER (WHERE ul.type='LEARNING' AND ul."languageId"=ANY($2::text[])) AS we,
 count(*) FILTER (WHERE ul.type='LEARNING' AND ul."languageId"=ANY($1::text[])) AS shared_learn,
 count(*) FILTER (WHERE ul.type='SPEAKS' AND ul."languageId"=ANY($2::text[])) AS shared_speak
FROM "UserLanguage" ul GROUP BY ul."userId";
```

Here $1 is viewer learning IDs and $2 spoken IDs. Join this aggregate to eligible users; compute the existing CASE once. Benchmark both plans on realistic distributions before adoption—aggregation is not guaranteed faster for every dataset. Keep cursor history as the preferred messaging path.

### MEDIUM - M15: Discovery hydration and client-side re-sorting can contradict the database page

- **Location:** `backend/server/src/features/discovery/repository.ts` — `discoverPartners` (line 300); `backend/server/src/features/discovery/scoring.ts` — `compareByMatchScoreDesc` (line 124)
- **The Problem:** Eligibility/count/page IDs and final profile/language loads occur in separate snapshots. A user blocked/suspended or changed after page selection can still be hydrated, and scores can change between SQL selection and JS recomputation. The page is then re-sorted with localeCompare, which may not match PostgreSQL collation used to choose page boundaries.
- **The Impact:** Counts/order can be inconsistent across pages, and a concurrent privacy change may be reflected late in the response.
- **The Fix:**

Use one bounded read-only REPEATABLE READ transaction for count/page/hydration when a consistent snapshot is required, and preserve pageIds order without localeCompare. Select the computed score alongside IDs and derive displayed bands from it, or calculate both using one query/one source of truth. Reapply eligibility/block policy in the final payload query if strict post-selection filtering is required, accepting that any response has a defined snapshot time. Specify collation and cursor tie-breakers in the API. Test equal scores, accented names and concurrent profile/block changes. Do not claim absolute revocation of bytes already returned to a client.

### MEDIUM - M16: Connection lists are unbounded and perform one conversation query per accepted row

- **Location:** `backend/server/src/features/connections/repository.ts` — `listForUser` (line 229); `toConnectionDto`, `findConversationId`
- **The Problem:** The list query has no limit. attachUsersMany batches profile loads, but the subsequent awaited loop calls toConnectionDto, which performs findConversationId for every accepted connection. That is approximately 2+A DB round trips for A accepted rows, with conversation lookups sequential.
- **The Impact:** Latency and memory grow with the entire relationship graph; one prolific account can tie up a worker/pool for a large response.
- **The Fix:**

Add independently paginated received/sent/accepted lists, or a `status`/`direction` filter with one cursor page. Preserve a bounded legacy compatibility response during client migration. Replace per-row conversation lookup with a join to the direct-pair mapping from H15, or one bulk participant query over the page’s partner IDs. Assemble DTOs synchronously from Maps. Use stable `(updatedAt,id)` ordering and limit+1, and load only profile fields actually returned. Query-count tests should stay constant as the page grows from 1 to 50 accepted connections; do not merely parallelize unbounded N queries.

### MEDIUM - M17: Suspended partners remain in conversations and connection lists

- **Location:** `backend/server/src/features/messaging/repository.ts` — `assertCanAccessConversation` (line 139); `listConversations`; `backend/server/src/features/connections/repository.ts` — `listForUser` (line 229); `acceptConnection`
- **The Problem:** Message access checks membership, block and accepted connection but never verifies either account’s active status. HTTP authenticates the caller, not the partner. Inbox joins User without status filtering, and connection lists do not filter account status. Suspension does not automatically cancel relationships as soft deletion does.
- **The Impact:** Active users can continue sending to suspended users, and suspended profiles remain visible in these surfaces. Combined with socket auth defects, suspended users can actively participate.
- **The Fix:**

Include both participants’ ACTIVE status in the shared conversation authorization query and in acceptance/request policies. Define whether suspended partners appear as a redacted unavailable row or are excluded; apply that policy consistently to inbox and connection DTOs. Ensure moderation transitions revoke sockets/sessions. If read-only history remains available, separate canReadHistory from canSend rather than relaxing send rules. Test ACTIVE→SUSPENDED transitions for HTTP, existing sockets, inbox, pending accept and direct profile access.

### MEDIUM - M18: Blocked or removed partners can still monitor presence

- **Location:** `backend/server/src/features/messaging/repository.ts` — `listPartnerIds` (line 158); `src/features/messaging/socket.ts` — `broadcastPresence`, user_online_status handler
- **The Problem:** listPartnerIds uses historical conversation membership only. It is used both as the presence query allowlist and broadcast recipient list, without accepted-connection/block/account-status filtering. After removal or block, the membership rows intentionally remain.
- **The Impact:** Former or blocked contacts can query and receive online/offline activity despite being denied chat access.
- **The Fix:**

Replace listPartnerIds for presence with a dedicated policy-filtered query joining active accounts and accepted connections and excluding blocks both directions. For single-user lookups use EXISTS against that relationship rather than loading the complete partner list. Filter broadcast recipients at emission time and revoke relevant room/presence subscriptions after relationship changes. Preserve historical membership for message retention/reporting; do not delete it as a shortcut. Add socket tests showing no presence reply/event after block, remove or suspension.

### MEDIUM - M19: Overlapping Socket.IO rooms receive duplicate events and sender devices miss updates

- **Location:** `backend/server/src/features/messaging/gateway.ts` — `emitNewMessage` (line 23); `emitMessageStatus`, `emitTyping`
- **The Problem:** The gateway sends separately to conversation room and recipient user room. A socket in both receives two events. Status/typing have the same overlap. Sender devices that are not joined to the conversation do not receive message_new, since only the recipient’s user room is targeted.
- **The Impact:** Duplicate bubbles/receipts and unnecessary processing occur, while the sender’s other devices can show a stale inbox.
- **The Fix:**

Use one room-union emission, which deduplicates matching sockets within the broadcast:

```ts
server.to([
  conversationRoom(message.conversationId),
  userRoom(message.senderId),
  userRoom(recipientId),
]).emit("message_new", message);
```

For status use one array containing the conversation and authorized user rooms. For typing use a single union and `.except(userRoom(senderId))`. Emit only for newly created messages as H11 specifies; include event/message IDs so clients can deduplicate replay. Revoke unauthorized room membership on policy changes and do not assume unioning rooms provides authorization by itself. Test one socket in two rooms and two devices per user.

### MEDIUM - M20: Message summary ordering can move backwards during concurrent sends

- **Location:** `backend/server/src/features/messaging/repository.ts` — `sendMessage` (line 410); `src/db/schema.ts` — Message/Conversation timestamps
- **The Problem:** `now` is captured before the transaction. Every send unconditionally replaces conversation and participant lastMessageAt/lastMessageId. A slower earlier-timestamp send can update the summary after a later message. Same-millisecond messages are ordered by ID in history but summary uses whichever update wins.
- **The Impact:** Inbox preview/order can point to an older message and disagree with the message history’s canonical order.
- **The Fix:**

Serialize sends by the conversation/pair lock from H14 and assign an authoritative order inside that critical section. Prefer a per-conversation sequence allocated atomically, with unique(conversationId,sequence); use it for history cursors and summary. If retaining timestamp/ID ordering, update last-message summary only when the saved tuple `(createdAt,id)` is greater than the current tuple, and keep participant timestamps consistent with the selected summary. Avoid node-clock ordering across replicas by using a DB sequence or carefully defined database timestamp. Test delayed transactions and equal timestamps, asserting summary equals the final history maximum.

### MEDIUM - M21: Read receipts load and return the entire unread history without a bound

- **Location:** `backend/server/src/features/messaging/repository.ts` — `markMessagesRead` (line 487); `src/features/messaging/schema.ts` — messageReadEventSchema; `src/features/messaging/controller.ts` — markConversationRead
- **The Problem:** HTTP read selects all unread IDs, performs an IN update, reselects all full messages, returns them and broadcasts them. Socket messageIds has no max; an explicit empty array means mark everything because the code checks length truthiness. Large histories can exceed practical payload/parameter/memory limits.
- **The Impact:** Opening an old conversation can generate very large queries and duplicate private message payloads across sockets. Empty-batch semantics can mark messages read unexpectedly.
- **The Fix:**

Use per-participant lastReadSequence (or a monotonic `(createdAt,id)` high-water mark) and emit only conversationId/readerId/readThrough. Verify that the anchor belongs to the conversation and was available to the caller. During compatibility migration, cap messageIds to a fixed batch size (e.g. 100), distinguish undefined=all from []=none explicitly, and use a single UPDATE ... RETURNING of only changed IDs/status rather than returning message contents. Batch legacy mark-all updates or aggregate read state without parameterizing every ID. Test empty, oversized and large-backlog reads.

### MEDIUM - M22: Presence cache leaks memory and is inconsistent across restarts and replicas

- **Location:** `backend/server/src/features/messaging/presence.ts` (lines 1–51); `src/features/messaging/socket.ts` presence lifecycle; `src/lib/socket.ts`
- **The Problem:** lastSeenByUser never evicts entries. Online sockets and Socket.IO rooms are local to one process, with no shared adapter. Socket presence queries call getPresence without the persisted DB lastSeen fallback that inbox uses. A reconnect racing an earlier offline broadcast can emit misleading state.
- **The Impact:** Long-running instances accumulate one cache entry per historically connected user; horizontal deployments deliver incomplete events and contradictory status. After restart a socket lookup can show null lastSeen while inbox knows it.
- **The Fix:**

For a single instance, use a bounded TTL/LRU last-seen cache and load persisted lastSeen on cache miss; debounce connect/disconnect broadcasts and make DB writes monotonic (`GREATEST(lastSeenAt, suppliedAt)`). For multiple instances, use Redis presence with per-socket leases/heartbeats and expiry, a Socket.IO shared adapter, and the required load-balancer affinity if polling remains enabled. Determine online from all live leases, not one node. Treat process death/TTL expiry as offline and persist lastSeen via a bounded worker. Add restart, two-instance and multi-device tests before claiming horizontal scalability.

### MEDIUM - M23: Realtime delivery is not durable and DELIVERED does not mean client receipt

- **Location:** `backend/server/src/features/messaging/socket.ts` — `promoteDelivered` (line 34); `src/features/messaging/controller.ts` — sendMessage; `src/features/messaging/gateway.ts`
- **The Problem:** DB commit and socket emit are separate, so a process crash can persist a message without notifying peers. Socket sends mark DELIVERED merely when the recipient is considered online; no client receipt acknowledgment is required. HTTP sends do not run that promotion. Offline messages have no delivery promotion on reconnect.
- **The Impact:** Clients receive inconsistent delivery badges and can miss realtime updates until they explicitly fetch history. Message data itself remains durable in PostgreSQL.
- **The Fix:**

Define SENT=committed, DELIVERED=acknowledged by an authorized recipient device, READ=explicit recipient read state. Add a bounded receipt event validated against message recipient/membership and update status monotonically with conditional SQL. Use the same flow for HTTP/socket sends. Persist a message-created outbox event in the send transaction, publish with retries, and deduplicate using event/message IDs. On reconnect use a durable cursor to reconcile missed messages/status; do not promise exactly-once network delivery. If best-effort presence-based delivery is retained intentionally, rename/document it accurately and keep transport behavior consistent.

### MEDIUM - M24: Translation silently truncates text and races incompatible source-language guesses

- **Location:** `backend/server/src/features/messaging/learning.ts` — `translateWithMyMemory` (line 11); `translateMessage`, `nativeLanguageCode`
- **The Problem:** Only sourceText.slice(0,500) is sent, although messages can contain 4,000 characters and captions 1,000. autodetect|target and en|target requests run concurrently; the first successful result wins, even for non-English input. Source language is not validated/detected by a reliable path. Target language is any 2–8 character string, which can contain invalid provider values.
- **The Impact:** Users receive a partial or wrong translation presented as the complete message. Concurrent requests double provider traffic and may produce different results for the same source.
- **The Fix:**

Introduce a translation adapter with explicit supported source/target languages, validated provider responses and documented provider limits. Determine source language through explicit message metadata or a supported detector; do not race an English assumption against detection. Split long text into bounded sentence-aware chunks according to the provider’s actual byte/character limit, translate every chunk in order with bounded concurrency, and cache only a complete successful result. Alternatively reject unsupported lengths clearly instead of silently truncating. Validate targetLang against the supported catalog/provider map. Add non-English, mixed-script, >500-character, emoji and partial-provider-failure tests using a fake provider.

### MEDIUM - M25: Translation and transcription lack timeouts, concurrency control and bounded response parsing

- **Location:** `backend/server/src/features/messaging/learning.ts` — `translateWithMyMemory` (line 11); `transcribeMessage`
- **The Problem:** fetch calls have no deadline/cancellation. Failed translation fetches are swallowed; winning requests do not abort losers. Transcription reads up to 40 MB into memory and copies it into a new Uint8Array/Blob before provider upload. Provider response JSON is cast rather than schema-validated. Unrestricted simultaneous requests can repeat expensive work before a transcript/cache is stored.
- **The Impact:** Slow providers hold requests and memory, large uploads multiply memory usage, and duplicate work consumes budget. Malformed provider fields can surface as internal errors.
- **The Fix:**

Wrap each provider request with AbortSignal.timeout and a caller-disconnect signal; abort redundant attempts. Add a distributed job uniqueness key `(messageId, operation, targetLang, sourceVersion)` and bounded worker concurrency. Validate upload media/size against the chosen provider before reading, stream where the client supports it, or use a worker with an explicit memory budget and chunk/compress oversized media. Limit response bytes and parse with a Zod response schema before use. Map provider 429, timeout, unsupported-media and 5xx into controlled retryable/nonretryable outcomes; retry with bounded jitter only where safe. Log sanitized provider error code/latency, never private source text or API keys. Test timeout, malformed JSON, concurrent identical requests and cancellation.

### MEDIUM - M26: One translation slot is shared across all targets and users

- **Location:** `src/db/schema.ts` — Message.translatedContent/translatedLang; `backend/server/src/features/messaging/repository.ts` — `saveTranslation` (line 540); `src/features/messaging/learning.ts` — translateMessage
- **The Problem:** The Message row has one translatedContent/translatedLang pair. Participants requesting different languages overwrite each other’s cache, and all subsequent message DTOs include whichever translation was written last. Cache misses can duplicate provider work.
- **The Impact:** Language choice flips between devices/participants and repeated requests churn provider calls. This is not a disclosure to nonmembers, but it is incorrect per-target caching and user behavior.
- **The Fix:**

Add MessageTranslation(messageId, targetLang, sourceVersion, provider, text, createdAt) with unique(messageId,targetLang,sourceVersion,provider). Upsert by that key after a complete provider result. Read the requested translation explicitly, or include only the viewer-selected language in message DTOs. Keep original content immutable and version transcript/caption input used for translation. Use the M25 job-dedup design for concurrent work. Backfill existing translations without overwriting originals, then deprecate the shared fields through a coordinated DTO migration. Test two participants translating one message into different languages simultaneously.

### MEDIUM - M27: Private conversation text is sent to an external service without an explicit application policy boundary

- **Location:** `backend/server/src/features/messaging/learning.ts` — `translateWithMyMemory` (line 11); `transcribeMessage`; FEATURES messaging/learning sections
- **The Problem:** Translation places private source text in a third-party GET query; transcription uploads private media to another provider. The backend has no provider policy/consent/preference check or centralized data-minimization interface. A translate/transcribe button may imply intent, but frontend disclosure and provider agreements are not supplied, so lack of user consent or legal noncompliance cannot be concluded from this ZIP.
- **The Impact:** Text can appear in provider/proxy URL logs and third-party processing occurs outside the ordinary conversation access model. Deployment must establish the actual privacy policy before enabling the feature.
- **The Fix:**

Centralize outbound learning operations behind adapters that enforce the chosen product policy, provider enablement and minimal payload. Have the client clearly disclose external processing and send an operation-specific user request; gate optional processing if the product requires explicit consent. Prefer provider POST payloads where supported, redact request URLs, and document retention/region/deletion behavior based on verified provider terms. Add a configuration kill switch and prevent automatic background translation without the same policy. Keep the report’s conclusion technical: external transfer is confirmed; contract/legal adequacy requires separate evidence.

### MEDIUM - M28: Error normalization misclassifies parser/storage failures and misses wrapped database conflicts

- **Location:** `backend/server/src/shared/middleware/errorHandler.ts` (lines 1–100); `backend/server/src/db/errors.ts` — `isUniqueViolation` (line 2); `src/features/media/routes.ts:16–33`; `src/lib/app.ts`
- **The Problem:** Malformed JSON and oversized bodies reach the generic 500 branch instead of 400/413. Multer/storage errors are all exposed as validation messages, which can leak filesystem details for operational errors. isUniqueViolation checks only error.code; Drizzle may wrap the pg error in cause, so intended duplicate-conflict handling can become 500. There is no headersSent guard or JSON 404 handler.
- **The Impact:** Clients receive incorrect retry/error semantics, operational failures can disclose internals, and conflict races are harder to handle. Production generic responses correctly avoid stack traces; this finding does not claim global production stack leakage.
- **The Fix:**

Normalize known errors explicitly. Recognize body-parser entity.parse.failed as 400 and entity.too.large as 413; map known Multer validation codes to controlled messages and send unknown storage errors to generic 500. Begin the handler with `if (res.headersSent) return next(err);`. Add an AppError JSON 404 after routers. Traverse a bounded cause chain for SQLSTATE and inspect the constraint before mapping:

```ts
export function pgErrorCode(error: unknown): string | undefined {
  const seen = new Set<unknown>();
  for (let depth = 0; depth < 6 && error && typeof error === "object"; depth++) {
    if (seen.has(error)) break;
    seen.add(error);
    if ("code" in error && typeof error.code === "string") return error.code;
    error = "cause" in error ? error.cause : undefined;
  }
  return undefined;
}
```

Do not map every 23505 to duplicate email; classify the intended constraint. Add production-mode tests for malformed JSON, oversized body, wrapped duplicate key, ENOSPC and unknown route.

### MEDIUM - M29: Validation leaves inconsistent IDs, null bytes and message metadata at database/client boundaries

- **Location:** `src/features/messaging/schema.ts`; `src/features/safety/schema.ts`; `src/features/connections/schema.ts`; `src/features/users/schema.ts`; `src/features/auth/schema.ts`
- **The Problem:** Many IDs/cursors have no upper bounds; messageIds arrays are unbounded (M21). Non-text messages use the same arbitrary content string as text and accept unrelated metadata. PostgreSQL text cannot store NUL, but most user-controlled text schemas permit it, producing a database 500 rather than validation failure. Duplicate send schemas already risk HTTP/socket drift. This is not a demonstrated SQL injection or mass-assignment path: values are parameterized and writes use explicit fields.
- **The Impact:** Clients can submit internally inconsistent messages and avoid meaningful media validation. Malformed inputs waste work or generate 500s.
- **The Fix:**

Define shared bounded ID/cursor schemas matching supported IDs without prematurely rejecting legacy fixtures, and apply them to route params/events/bodies. Reject `\u0000` in stored text at validation boundaries. Build sendMessageEventSchema by extending the HTTP schema with conversationId. Use a discriminated union: TEXT accepts bounded text; IMAGE/VOICE/VIDEO require the server-owned assetId from H09, with duration/MIME/thumbnail derived from verified media rather than client claims. Reject unsupported metadata combinations and unknown writable fields where appropriate. Bound raw intro strings before normalization as well as their normalized length. Test HTTP/socket schema equivalence and NUL input.

### MEDIUM - M30: Database pool lacks error handling, timeouts and an explicit connection budget

- **Location:** `backend/server/src/db/client.ts` (lines 1–22)
- **The Problem:** The pg Pool is created with only connectionString. There is no idle-client error listener, connection acquisition timeout, query/statement deadline, or documented pool sizing across replicas. Direct URL is preferred for all traffic. Defaults may be adequate locally but do not establish production resilience.
- **The Impact:** Idle connection errors can become unhandled EventEmitter errors, stalled queries hold resources, and replica count can exhaust the database connection limit.
- **The Fix:**

Configure a validated runtime pool budget and timeouts; export the pool only through the DB lifecycle module:

```ts
const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10, // replace with measured per-replica budget
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  statement_timeout: 10000,
  query_timeout: 12000,
});
pool.on("error", error => logger.error("db", "idle connection error", {
  name: error.name, message: "Database connection failed"
}));
```

Compute max from `(database connection allowance - migration/admin reserve)/maximum replicas`, including workers. Set transaction-local lock_timeout/statement_timeout for critical writes. Verify TLS/certificate settings with the actual provider; no disabling certificate verification as a shortcut. Monitor pool waitingCount and query latency. These numbers are starting examples requiring measurement, not proven capacity settings.

### MEDIUM - M31: Health check is only liveness and shutdown does not drain resources

- **Location:** `src/lib/app.ts:40–42`; `src/index.ts`; `src/db/client.ts` — closeDb
- **The Problem:** /health always returns ok even if PostgreSQL is unavailable or migrations are missing. There are no SIGTERM/SIGINT drain handlers, no captured Socket.IO instance for shutdown, and no HTTP server error handling.
- **The Impact:** Load balancers can send traffic to unusable instances; deploy/restart can cut in-flight writes/events and leave pool resources unmanaged.
- **The Fix:**

Keep /health as the documented liveness response and add a separate /ready check with a short DB SELECT 1 deadline, migration-version check and draining flag. Capture `const io=createSocketServer(httpServer)`. On SIGTERM/SIGINT mark not ready, stop accepting requests, close/disconnect Socket.IO, wait for in-flight work/outbox handoff, then closeDb and exit. Enforce a shutdown deadline with an unref timer; log unresolved work safely. Add httpServer error handling for listen failures. Test a DB outage, missing migration, SIGTERM during a write and reconnection after deployment.

### MEDIUM - M32: Remaining database invariants and hot-path indexes are incomplete

- **Location:** `src/db/schema.ts`; queries in messaging, discovery, connections and safety repositories
- **The Problem:** Existing message-time/unread, participant-user, token and block-pair indexes are useful and should not be described as entirely missing. However history ordering adds id to createdAt while its index omits id; connection lists filter direction/status/order without matching composite indexes. Sender membership, Report.messageId and Conversation.lastMessageId consistency are not enforced as relational invariants. A Block reverse index matters for reverse/global cleanup paths, not the existing exact two-value pair predicate.
- **The Impact:** Preventable invalid records can enter through scripts/bugs, and large-table sorts/filters may cost more than necessary. Index performance is a hypothesis until EXPLAIN ANALYZE confirms it.
- **The Fix:**

After H15/M11 reconciliation, evaluate these migrations against real plans:

```sql
CREATE INDEX "Message_history_order_idx"
  ON "Message" ("conversationId", "createdAt" DESC, id DESC);
CREATE INDEX "Connection_requester_status_order_idx"
  ON "Connection" ("requesterId", status, "updatedAt" DESC, id DESC);
CREATE INDEX "Connection_recipient_status_order_idx"
  ON "Connection" ("recipientId", status, "updatedAt" DESC, id DESC);
ALTER TABLE "Message" ADD CONSTRAINT "Message_sender_member_fk"
  FOREIGN KEY ("conversationId", "senderId")
  REFERENCES "ConversationParticipant" ("conversationId", "userId");
ALTER TABLE "Block" ADD CONSTRAINT "Block_no_self" CHECK ("blockerId" <> "blockedId");
```

Add positive/bounded duration and nonempty/message-length constraints consistent with API rules. Decide Report evidence deletion policy before adding its FK. A lastMessageId FK alone does not prove it belongs to the same conversation; use a composite relation or constrain summary writes transactionally. Add canonical-country/search indexes only after measuring the revised query, and remove redundant indexes only after usage review. For large tables plan concurrent index creation outside transaction-wrapped migrations.

### MEDIUM - M33: Account deletion retains identifiable profile data and public media without a defined retention workflow

- **Location:** `backend/server/src/features/users/repository.ts` — `softDeleteAccount` (line 572); `src/features/media/storage.ts`; `src/db/schema.ts`
- **The Problem:** Deletion changes email/password/status and flags but leaves User.displayName/bio/photoUrl, Profile DOB/country/bio/image/goals, language rows, refresh metadata and uploaded files. FEATURES explicitly says soft deletion/history retention by design; this is not a claim that every record must be hard-deleted. No retention/purge/anonymization policy or worker accompanies that design.
- **The Impact:** Deleted users’ personal information and public media remain available in storage indefinitely and may survive in recipient-facing history according to DTOs. Actual legal obligations cannot be inferred from source alone.
- **The Fix:**

Define retained chat/report evidence separately from account/profile/media data, with product-approved periods and recipient-visible tombstone behavior. During deletion atomically revoke security state (H05), mark the account unavailable, and enqueue an idempotent cleanup job. Remove/anonymize unnecessary profile fields and public avatars; preserve messages/evidence only as the policy requires. Bind media assets to owners/messages so cleanup can distinguish shared retained evidence from orphan uploads. Track deletedAt/purgeAfter and cleanup status. Test public URL revocation, profile redaction, reporting access and retries without destroying required history.

### MEDIUM - M34: Block creation is not idempotent under concurrent retries

- **Location:** `backend/server/src/features/safety/repository.ts` — `createBlock` (line 52)
- **The Problem:** The function returns an existing block on a pre-read, but two simultaneous first requests can both miss it and the losing insert fails the unique constraint. Its early existing return also skips connection cancellation, so inconsistent connection state left by another race is not repaired.
- **The Impact:** Mobile retries can receive 500 and a repeated block action does not necessarily reassert its intended relationship policy.
- **The Fix:**

Use H14’s common pair lock and always enforce connection cancellation in the same transaction. Insert block with ON CONFLICT(blockerId,blockedId) DO NOTHING RETURNING; if absent, select the existing row under the lock. Return the same canonical BlockDto for both paths. Cancel all active pair connections even for an existing block, then publish policy-change/revocation after commit. Test simultaneous block requests and a preexisting block with an inconsistent PENDING/ACCEPTED row. Do not expose raw unique constraint errors to the caller.

### MEDIUM - M35: Existing tests bypass the repositories where most critical bugs reside

- **Location:** All seven `src/features/**/*.test.ts`; `vitest.config.mts`; `vitest.setup.ts`; `package.json`
- **The Problem:** Auth tests mock repositories/mail; most route tests mock services and authentication. They establish schema/controller wiring but do not test real SQL, transaction races, socket handshake/events, upload bytes, account-password change or migrations. Profile privacy tests exercise serializers but not real query/authorization integration. No safety/media/socket test files or CI workflow are shipped.
- **The Impact:** Green unit tests would not establish production readiness and can coexist with the confirmed bypasses, broken atomicity and cross-conversation event bug.
- **The Fix:**

Keep the useful unit tests, then add a disposable PostgreSQL integration suite using committed migrations and real auth. Cover C02/C03/H01/H02 with controlled concurrency barriers; H11/H12 with two conversations and socket event capture; H14/H15 with reverse-pair and block races; H08/H09 with actual multipart bytes/private reads; H03/H04/M18 with actual Socket.IO clients. Stub only external mail/AI transports, not business repositories under test. Add production-mode error/log tests. In CI run clean install, full typecheck, build/start smoke, unit/integration tests and dependency audit. Record query counts and selected EXPLAIN plans for performance acceptance. Never use the archive’s credentials for test setup; require a disposable TEST_DATABASE_URL.

### MEDIUM - M36: Local upload storage has no durable deployment or quota recovery strategy

- **Location:** `backend/server/src/features/media/storage.ts` (lines 1–74); `src/features/messaging/learning.ts` — readFile; absence of media maintenance jobs
- **The Problem:** Files are written under process.cwd()/uploads and referenced by relative public URLs. No shared/durable storage adapter, quota accounting, backup mapping, orphan cleanup or disk-full handling exists. On another replica the same URL/transcription path may not exist; on an ephemeral deployment files disappear on replacement. mkdirSync runs only at module initialization, so it is not a per-request synchronous I/O bottleneck.
- **The Impact:** Persisted messages can reference missing files, replicas return inconsistent media, and unlimited uploads can fill the application disk.
- **The Fix:**

Introduce a Storage interface with put/read/delete and a durable private object-storage implementation linked to MediaAsset records. Inject the configured storage root/bucket; do not derive durability from cwd. Use a quarantine→verified→attached lifecycle with byte quotas reserved before upload and reconciled on completion/failure. A worker reaps expired unattached assets and repairs mismatched metadata/storage states. During migration copy existing files, verify hashes, retain URL mapping until clients transition and confirm restore from backup. Handle ENOSPC/provider storage failures as sanitized operational errors and report quota rejection explicitly. For a deliberately single-node deployment, a persistent volume plus tested backup/restore is an acceptable documented interim solution.

### MEDIUM - M37: Timezone-less timestamps and application-clock writes weaken ordering consistency

- **Location:** `src/db/schema.ts` — timestamp declarations; `src/features/messaging/repository.ts` — createdAt/lastMessageAt; `src/features/auth/repository.ts` — expiry comparisons
- **The Problem:** The schema uses timestamp without time zone for event/expiry instants and application-generated Date values. Multiple processes with different timezone settings or clock skew can interpret/order these instants inconsistently. This is a deployment-dependent risk, not a reproduced time shift in a live database.
- **The Impact:** Token expiry, lastSeen, inbox ordering and audit timestamps can disagree across nodes or migrations.
- **The Fix:**

Standardize event/expiry columns to timestamptz and DOB to date. Before conversion, identify the timezone convention of existing stored values; if verified UTC, migrate with `USING "createdAt" AT TIME ZONE 'UTC'` (repeat deliberately for each instant column). Do not blindly reinterpret unknown historical timestamps. Use DB-generated time or sequence for authoritative ordering and expiry decisions in locked transactions, while returning ISO UTC strings. Keep hosts time-synchronized. Test database/app timezone changes and clock-skew scenarios; use the message sequence from M20 for deterministic chat ordering.

**LOW/CHORES**

### LOW/CHORES - L01: Test fixtures and typecheck scope drift from the current schema

- **Location:** `src/features/auth/auth.test.ts` — TestUser/makeUser; `tsconfig.json`; `tsconfig.build.json`; `vitest.setup.ts`
- **The Problem:** TestUser omits required User fields authProvider, onboardingCompleted and lastSeenAt, yet is passed to typed repository mocks. Build excludes tests; default typecheck targets the build config, so it cannot reveal these fixture mismatches. Scripts and Vitest configuration are outside tsconfig include. The full compiler run was not available; the structural mismatch is visible in source.
- **The Impact:** Untyped/unchecked fixture drift hides meaningful contract changes and can break typecheck:all once the build configuration is corrected.
- **The Fix:**

Build fixtures using `satisfies typeof users.$inferSelect` or a complete equivalent factory, including all nonoptional fields. Keep compile-only tests in a dedicated tsconfig with noEmit/rootDir adjusted to include src, scripts and test config. Make CI run both application build and full tooling/test typecheck. Use controlled mock reset semantics (resetAllMocks where implementations must not carry between cases) rather than relying solely on clearAllMocks. Keep unrelated optional-undefined matcher differences out of the defect count unless reproduced with the actual test runner.

### LOW/CHORES - L02: OpenAPI and feature documentation drift from the implemented contract

- **Location:** `FEATURES(8).md` messaging notes; `backend/FEATURES.md`; `src/docs/openapi.ts`; `src/docs/paths/*.paths.ts`; `src/docs/schemas/{chat,connection,user,language}.schemas.ts`
- **The Problem:** Password reset, most user mutations, safety and socket events remain undocumented as the feature guide already admits. Chat request/response schemas omit clientMessageId. Connection docs require recipientId even though receiverId alone is accepted. UserSchema omits INACTIVE from the database enum (active auth routes rarely return it). Translation/transcription docs omit actual 502/501 outcomes. The feature note claiming caption may not be forwarded is stale: it is forwarded. Duplicated schemas do not encode all runtime constraints.
- **The Impact:** Generated clients and QA can misunderstand valid payloads, errors, idempotency and feature completeness.
- **The Fix:**

Reuse boundary schemas where transformation-aware OpenAPI generation permits it; otherwise define explicit wire schemas and contract tests comparing accepted payloads/response shapes. Add all active HTTP paths and their auth/error outcomes, include clientMessageId, model alias alternatives with oneOf/anyOf, and document socket payloads/acks separately. Mark intentional 501 endpoints as non-product rather than promising them. Update caption/atomicity notes only when the code is verified. Generate a route-to-spec coverage manifest in CI and validate real responses against documented schemas.

### LOW/CHORES - L03: Business logic resides in repositories and shared authorization is duplicated

- **Location:** `src/features/{users,connections,messaging,safety}/repository.ts`; corresponding `service.ts`; `src/features/media/service.ts`; repeated requireParam/requireRow helpers
- **The Problem:** Services mostly forward calls while repositories enforce business policy, build DTOs, read presence and decide transactions. Block checks exist in safety, connections and users; one comment still says safety is Prisma-based even though it is Drizzle. Media service accepts Express Request only to build a relative URL and ignores it.
- **The Impact:** Authorization/transaction fixes must be repeated in multiple places, increasing drift and making business rules harder to test independently. This is a maintenance finding, not proof that the entire architecture must be replaced.
- **The Fix:**

Preserve the feature folders. Move transaction orchestration/policy to services, pass typed tx/repository contexts, and keep repositories focused on bounded queries. Extract one conversation/relationship authorization policy with explicit read/send/report/presence capabilities. Keep DTO serialization pure and remove unused Express parameters from media services. Share request-param/row helpers only where behavior genuinely matches. Delete stale Prisma comments and unused legacy helpers after checking imports. Apply this while fixing each domain, not as a simultaneous rewrite of all modules.

### LOW/CHORES - L04: Unused exports, inconsistent errors and misleading comments add maintenance risk

- **Location:** `src/shared/utils/pagination.ts`; `src/features/media/schema.ts`; `src/features/matching/`*; `src/shared/errors/AppError.ts`; safety repository; `src/features/users/routes.ts`; `.cursor/rules/*.mdc`; `.env.example`
- **The Problem:** parsePage accepts NaN/negative limits but is not used by active paginated routes. uploadMetaSchema is unused by multipart upload. Several AppError calls use 403/404 with default BAD_REQUEST code. Matching and users search are explicitly 501 stubs. The comment about /:id capturing /:id/public-profile is misleading for an exact route. Cursor rule globs target obsolete src/modules paths and .env.example refers to Prisma Migrate.
- **The Impact:** Dead code can be reused unsafely, error-code consumers behave inconsistently, and repository guidance fails to target the actual files.
- **The Fix:**

Delete unused parsePage or replace it with the validated shared pagination schema before reuse. Remove unused upload metadata or wire an explicit purpose into MediaAsset handling. Supply FORBIDDEN/NOT_FOUND/VALIDATION_ERROR codes consistently with status; add a small table-driven error-contract test. Keep stubs clearly marked or unmount them with client agreement; do not invent a missing dating/like feature. Update rule globs to src/features and remove stale comments/tool references. Formatting/indentation and duplicate aliases are cleanup tasks after security fixes.

### LOW/CHORES - L05: No pinned runtime, deployment/runbook or dependency-security gate is supplied

- **Location:** `backend/server/package.json`; `package-lock.json`; absence of CI/deployment/runbook files in this ZIP
- **The Problem:** The package has no engines/packageManager declaration or runtime-version file. The lockfile is present (340 package entries, registry sources with integrity), but no current advisory scan was executable and no deployment/recovery runbook is included. Absence from this archive does not prove none exists elsewhere.
- **The Impact:** Developers may use incompatible Node/npm versions, and dependency vulnerabilities or migration/backup failures may reach production unnoticed.
- **The Fix:**

Pin the supported maintained Node runtime/npm version used to validate H21; declare engines and packageManager and use the same versions in CI/deployment. Run npm ci plus a current npm audit/advisory scan and review production reachability of advisories; do not label package versions vulnerable without evidence. Document migration ordering, secret injection/rotation, HTTPS proxy topology, media durability, readiness, logs, backup/restore and rollback. Validate restore and deployment against disposable infrastructure before release. Include artifact secret scanning to prevent C01 recurring.

### LOW/CHORES - L06: Repeated onboarding clears omitted practice goals and avatar removal has no contract

- **Location:** `src/features/users/schema.ts` — completeOnboardingSchema transform; `src/features/users/repository.ts` — completeOnboarding/putMeProfile/updateProfile
- **The Problem:** The onboarding schema converts absent practiceGoals to [], so the repository’s fallback to existing goals never applies on a repeated partial onboarding request. Avatar schemas reject null/empty values on edit and nullish selection cannot express clearing the current avatar. Whether removal is a required feature is unspecified, but omission should not accidentally erase unrelated saved data.
- **The Impact:** Retries/partial onboarding can lose saved goals; clients have no documented way to remove an avatar through existing edit routes.
- **The Fix:**

Preserve undefined in the onboarding transform (`practiceGoals: value.practiceGoals`) so repository defaults retain existing values; choose [] only when creating a new profile or when the client explicitly requests clearing under the product rules. Define optional-versus-null semantics for editable avatars, e.g. absent=unchanged, null=remove, assetId=set, and implement it consistently in all profile write paths. Coordinate nullable schema/DTO changes with clients. Add tests for resubmitting onboarding without goals and setting/removing/omitting an avatar.

## 4. Global Refactoring Suggestions

**A. Keep the existing feature architecture, but give it real boundaries.** Use routes/controllers for validated transport input, services for policy and transactions, repositories for queries with an injected transaction handle, and pure DTO functions for serialization. The current feature folders are serviceable. A microservice rewrite would add risk without solving any of the observed defects. Extract shared policy only when multiple real callers need identical behavior.


| Shared component           | Responsibilities                                                                            | Callers                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Principal/session verifier | Jose claims, ACTIVE user, authVersion/session family, expiry                                | HTTP middleware, socket handshake/event guards                       |
| Relationship policy        | Canonical pair, lock ordering, blocks, active statuses, send/read/report/presence decisions | Connections, messaging, safety, users                                |
| Transaction unit of work   | One pg transaction, consistent locks, conditional writes, post-commit outbox                | Password/session, profile/languages, pair transitions, message sends |
| MediaAsset/storage adapter | Owner, verified bytes, purpose, private delivery, quota, retention                          | Uploads, avatars, chat, transcription                                |
| Rate/quota service         | Shared atomic user/IP/action counters and concurrent-work budgets                           | HTTP and socket entrypoints, provider workers                        |
| Outbox/worker              | Retry-safe mail, message events, policy revocation, cleanup jobs                            | Core write transactions                                              |
| Error/logger layer         | Stable codes, redacted production telemetry, request correlation                            | All transports and background jobs                                   |
| Contract schemas           | Runtime input, response shape and generated docs                                            | HTTP, socket, tests, client generation                               |


**B. Define concurrency invariants before refactoring.** Adopt one documented lock order: user rows in canonical ID order, then session/relationship/conversation rows, then child records. A block/send or refresh/reset fix is incomplete unless every conflicting path uses the protocol. Prefer database constraints plus conditional writes over pre-read checks alone. A transaction guarantees atomicity, not automatic serializability of application decisions made before it. Keep slow hashing, media decoding and external provider requests outside long DB locks; recheck mutable security predicates inside the short committing transaction.

**C. Make migrations a deliverable.** Inventory deployed schema, create reviewed baseline/upgrade migrations, reconcile existing bad data without losing messages/evidence, and test clean install plus upgrade. Priorities: session/version and reset challenge model; canonical connection/direct-conversation identity; idempotent message writes; media ownership; profile/language invariants; translation cache; time-zone conversion only after confirming historical conventions. Roll out expand→backfill→switch readers/writers→contract for client-facing changes. Do not ship a schema change that only exists in TypeScript.

**D. Preserve and correct contracts deliberately.** The guide’s current success bodies differ by endpoint; do not introduce a universal envelope that breaks clients without a versioned plan. Keep bearer authentication and explicit privacy DTOs. Retain documented legacy aliases while clients transition, but share handlers/validators and rate limits. Clearly distinguish account status, profile completeness, connection state, conversation membership and media authorization. Keep original messages immutable; store translations/transcripts/receipts in explicitly modeled derived state.

**E. Establish a realistic operational profile.** For a single instance, document persistent media volume, connection budgets, in-memory presence limitations and restart recovery. Before horizontal scaling, add shared quota/presence state, socket adapter and shared media storage. Use bounded workers for expensive provider operations, application readiness, graceful shutdown, structured production logs and queue/DB/storage metrics. Do not create a Redis dependency merely for the tiny static language catalog; fix its read-time writes and miss stampede first.

**F. Release acceptance gates.** These checks are intentionally tied to found defects, not generic test-volume targets:


| Gate                      | Required evidence                                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credentials/configuration | Rotations completed if values were live; no secrets in new artifact; production settings fail closed                                                     |
| Build/runtime             | Fresh npm ci, application and test/tooling typecheck, build, compiled startup on pinned runtime                                                          |
| Database                  | Empty-install and supported-upgrade migrations pass; constraints verified; rollback/failure injection for multi-write flows                              |
| Auth                      | Argon2 change-password login round trip; bypass rejected; account-bound limited reset; one successful concurrent consume; rotation/revocation race tests |
| Authorization             | Stranger conversation/message/media denied; reporter can report their historical conversation after block; inactive actors denied                        |
| Messaging                 | One persisted message for concurrent retry; conflicting key returns 409; no cross-conversation emit; stable summary order; bounded receipts              |
| Realtime                  | Expiry/suspension disconnect; blocked presence denied; no duplicate union-room events; restart/multi-device reconciliation                               |
| Uploads                   | HTML/SVG/spoofed bytes rejected; verified owner-only assets; bounded multipart/total quota; cleanup and durable retrieval                                |
| Provider operations       | Bounded timeout/memory/concurrency, full translation, correct language/cache key, sanitized failure telemetry                                            |
| Performance               | Bounded connection query count; representative discovery/history EXPLAIN ANALYZE; load test against chosen SLOs                                          |
| Recovery/operations       | DB/storage restore drill, readiness/outage behavior, graceful deploy, outbox retry/reconciliation, current dependency-advisory scan                      |


**G. File-by-file coverage ledger.** Every original archive file is listed below. “No separate finding” means no additional distinct issue was identified in that file during this source review; it is not a certification. Barrel exports, pure types, static catalogs and docs are recorded alongside executable code. Line counts are text lines in the provided files; package-lock is reviewed as structured dependency metadata and SVG as a static asset/security surface. Repository guidance is context, not executed application code. Paths are archive-relative.


| File                                                          | Lines | Review disposition                                                                                                             |
| ------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------ |
| `backend/.cursor/rules/chat-and-messaging.mdc`                | 72    | Architecture/security guidance reviewed; obsolete path globs in L04; aspirational domains not treated as product requirements  |
| `backend/.cursor/rules/discovery-and-matching.mdc`            | 54    | Architecture/security guidance reviewed; obsolete path globs in L04; aspirational domains not treated as product requirements  |
| `backend/.cursor/rules/drizzle-migrations.mdc`                | 42    | Architecture/security guidance reviewed; obsolete path globs in L04; aspirational domains not treated as product requirements  |
| `backend/.cursor/rules/language-exchange-backend.mdc`         | 142   | Architecture/security guidance reviewed; obsolete path globs in L04; aspirational domains not treated as product requirements  |
| `backend/.cursor/rules/media-and-uploads.mdc`                 | 33    | Architecture/security guidance reviewed; obsolete path globs in L04; aspirational domains not treated as product requirements  |
| `backend/.cursor/rules/moderation-and-safety.mdc`             | 62    | Architecture/security guidance reviewed; obsolete path globs in L04; aspirational domains not treated as product requirements  |
| `backend/.cursor/rules/module-patterns.mdc`                   | 65    | Architecture/security guidance reviewed; obsolete path globs in L04; aspirational domains not treated as product requirements  |
| `backend/.cursor/rules/notifications.mdc`                     | 30    | Architecture/security guidance reviewed; obsolete path globs in L04; aspirational domains not treated as product requirements  |
| `backend/.cursor/rules/ponytail.mdc`                          | 31    | Architecture/security guidance reviewed; obsolete path globs in L04; aspirational domains not treated as product requirements  |
| `backend/.cursor/rules/privacy-settings.mdc`                  | 45    | Architecture/security guidance reviewed; obsolete path globs in L04; aspirational domains not treated as product requirements  |
| `backend/.cursor/skills/SKILL.md`                             | 172   | Architecture/security guidance reviewed; obsolete path globs in L04; aspirational domains not treated as product requirements  |
| `backend/.cursor/skills/reference.md`                         | 121   | Architecture/security guidance reviewed; obsolete path globs in L04; aspirational domains not treated as product requirements  |
| `backend/FEATURES.md`                                         | 463   | Byte-identical requirements baseline; feature matrix and L02                                                                   |
| `backend/server/.env`                                         | 15    | C01, H07, H18 — values inspected only for credential/configuration classification; not reproduced or used                      |
| `backend/server/.env.example`                                 | 28    | H18/L04 — defaults, missing settings and stale migration guidance                                                              |
| `backend/server/drizzle.config.ts`                            | 20    | H17/H18 — migration path and database configuration                                                                            |
| `backend/server/package-lock.json`                            | 5002  | L05 — dependency versions, registry sources, integrity and runtime constraints; live advisory status unverified                |
| `backend/server/package.json`                                 | 52    | H21/L05 — scripts, dependencies and runtime/deployment contract                                                                |
| `backend/server/scripts/create-onboarding-test-user.ts`       | 69    | M02 — operator/fixture safety, credential handling and PII                                                                     |
| `backend/server/scripts/ensure-messaging-schema.ts`           | 122   | H17 — schema repair/seed migration workflow                                                                                    |
| `backend/server/scripts/ensure-password-reset-table.ts`       | 43    | H17 — schema repair/seed migration workflow                                                                                    |
| `backend/server/scripts/inspect-and-reset-passwords.ts`       | 82    | M02 — operator/fixture safety, credential handling and PII                                                                     |
| `backend/server/scripts/inspect-latest-user.ts`               | 84    | M02 — operator/fixture safety, credential handling and PII                                                                     |
| `backend/server/scripts/seed-demo-users.ts`                   | 183   | M02 — operator/fixture safety, credential handling and PII                                                                     |
| `backend/server/scripts/seed-languages.ts`                    | 36    | H17 — schema repair/seed migration workflow                                                                                    |
| `backend/server/src/assets/logo/sayly.svg`                    | 6     | Static SVG inspected for script/foreignObject/event/remote-reference markers; not mounted by supplied app; no separate finding |
| `backend/server/src/config/env.ts`                            | 64    | H07/H18 — environment validation and deployment defaults                                                                       |
| `backend/server/src/db/client.ts`                             | 22    | H17, M28/M30/M32/M37 — schema, integrity, migrations, pool and wrapped errors                                                  |
| `backend/server/src/db/errors.ts`                             | 9     | H17, M28/M30/M32/M37 — schema, integrity, migrations, pool and wrapped errors                                                  |
| `backend/server/src/db/schema.ts`                             | 426   | H17, M28/M30/M32/M37 — schema, integrity, migrations, pool and wrapped errors                                                  |
| `backend/server/src/docs/HOW_TO_DOCUMENT_ENDPOINTS.md`        | 64    | L02 — route/schema registration, response/error contracts and documentation consistency reviewed                               |
| `backend/server/src/docs/components/responses.ts`             | 63    | L02 — route/schema registration, response/error contracts and documentation consistency reviewed                               |
| `backend/server/src/docs/openapi.ts`                          | 180   | L02 — route/schema registration, response/error contracts and documentation consistency reviewed                               |
| `backend/server/src/docs/paths/auth.paths.ts`                 | 164   | L02 — route/schema registration, response/error contracts and documentation consistency reviewed                               |
| `backend/server/src/docs/paths/chat.paths.ts`                 | 236   | L02 — route/schema registration, response/error contracts and documentation consistency reviewed                               |
| `backend/server/src/docs/paths/connections.paths.ts`          | 213   | L02 — route/schema registration, response/error contracts and documentation consistency reviewed                               |
| `backend/server/src/docs/paths/discovery.paths.ts`            | 128   | L02 — route/schema registration, response/error contracts and documentation consistency reviewed                               |
| `backend/server/src/docs/paths/languages.paths.ts`            | 86    | L02 — route/schema registration, response/error contracts and documentation consistency reviewed                               |
| `backend/server/src/docs/schemas/auth.schemas.ts`             | 6     | L02 — route/schema registration, response/error contracts and documentation consistency reviewed                               |
| `backend/server/src/docs/schemas/chat.schemas.ts`             | 140   | L02 — route/schema registration, response/error contracts and documentation consistency reviewed                               |
| `backend/server/src/docs/schemas/connection.schemas.ts`       | 74    | L02 — route/schema registration, response/error contracts and documentation consistency reviewed                               |
| `backend/server/src/docs/schemas/discovery.schemas.ts`        | 134   | L02 — route/schema registration, response/error contracts and documentation consistency reviewed                               |
| `backend/server/src/docs/schemas/error.schemas.ts`            | 22    | L02 — route/schema registration, response/error contracts and documentation consistency reviewed                               |
| `backend/server/src/docs/schemas/language.schemas.ts`         | 49    | L02 — route/schema registration, response/error contracts and documentation consistency reviewed                               |
| `backend/server/src/docs/schemas/user.schemas.ts`             | 39    | L02 — route/schema registration, response/error contracts and documentation consistency reviewed                               |
| `backend/server/src/features/auth/auth.test.ts`               | 424   | M35, L01 — assertions, mocks, schema/route coverage and integration gaps reviewed                                              |
| `backend/server/src/features/auth/controller.ts`              | 76    | C03, H01–H07, M01/M06/M07/M28 — auth lifecycle and transport/schema alignment                                                  |
| `backend/server/src/features/auth/index.ts`                   | 1     | C03, H01–H07, M01/M06/M07/M28 — auth lifecycle and transport/schema alignment                                                  |
| `backend/server/src/features/auth/mail.ts`                    | 29    | C03, H01–H07, M01/M06/M07/M28 — auth lifecycle and transport/schema alignment                                                  |
| `backend/server/src/features/auth/password.ts`                | 13    | C03, H01–H07, M01/M06/M07/M28 — auth lifecycle and transport/schema alignment                                                  |
| `backend/server/src/features/auth/repository.ts`              | 223   | C03, H01–H07, M01/M06/M07/M28 — auth lifecycle and transport/schema alignment                                                  |
| `backend/server/src/features/auth/routes.ts`                  | 17    | C03, H01–H07, M01/M06/M07/M28 — auth lifecycle and transport/schema alignment                                                  |
| `backend/server/src/features/auth/schema.ts`                  | 83    | C03, H01–H07, M01/M06/M07/M28 — auth lifecycle and transport/schema alignment                                                  |
| `backend/server/src/features/auth/service.ts`                 | 281   | C03, H01–H07, M01/M06/M07/M28 — auth lifecycle and transport/schema alignment                                                  |
| `backend/server/src/features/auth/tokens.ts`                  | 110   | C03, H01–H07, M01/M06/M07/M28 — auth lifecycle and transport/schema alignment                                                  |
| `backend/server/src/features/auth/types.ts`                   | 51    | C03, H01–H07, M01/M06/M07/M28 — auth lifecycle and transport/schema alignment                                                  |
| `backend/server/src/features/connections/connections.test.ts` | 414   | M35, L01 — assertions, mocks, schema/route coverage and integration gaps reviewed                                              |
| `backend/server/src/features/connections/controller.ts`       | 43    | H14/H15, M16/M17, L03 — pair lifecycle, authorization, DTOs and query shape                                                    |
| `backend/server/src/features/connections/index.ts`            | 2     | H14/H15, M16/M17, L03 — pair lifecycle, authorization, DTOs and query shape                                                    |
| `backend/server/src/features/connections/repository.ts`       | 393   | H14/H15, M16/M17, L03 — pair lifecycle, authorization, DTOs and query shape                                                    |
| `backend/server/src/features/connections/routes.ts`           | 14    | H14/H15, M16/M17, L03 — pair lifecycle, authorization, DTOs and query shape                                                    |
| `backend/server/src/features/connections/schema.ts`           | 81    | H14/H15, M16/M17, L03 — pair lifecycle, authorization, DTOs and query shape                                                    |
| `backend/server/src/features/connections/service.ts`          | 28    | H14/H15, M16/M17, L03 — pair lifecycle, authorization, DTOs and query shape                                                    |
| `backend/server/src/features/connections/types.ts`            | 33    | H14/H15, M16/M17, L03 — pair lifecycle, authorization, DTOs and query shape                                                    |
| `backend/server/src/features/discovery/controller.ts`         | 23    | M08/M13–M15/M32 — eligibility, matching, filters, paging, SQL and DTO privacy                                                  |
| `backend/server/src/features/discovery/discovery.test.ts`     | 389   | M35, L01 — assertions, mocks, schema/route coverage and integration gaps reviewed                                              |
| `backend/server/src/features/discovery/dto.ts`                | 77    | M08/M13–M15/M32 — eligibility, matching, filters, paging, SQL and DTO privacy                                                  |
| `backend/server/src/features/discovery/index.ts`              | 1     | M08/M13–M15/M32 — eligibility, matching, filters, paging, SQL and DTO privacy                                                  |
| `backend/server/src/features/discovery/pagination.ts`         | 23    | M08/M13–M15/M32 — eligibility, matching, filters, paging, SQL and DTO privacy                                                  |
| `backend/server/src/features/discovery/repository.ts`         | 432   | M08/M13–M15/M32 — eligibility, matching, filters, paging, SQL and DTO privacy                                                  |
| `backend/server/src/features/discovery/routes.ts`             | 9     | M08/M13–M15/M32 — eligibility, matching, filters, paging, SQL and DTO privacy                                                  |
| `backend/server/src/features/discovery/schema.ts`             | 74    | M08/M13–M15/M32 — eligibility, matching, filters, paging, SQL and DTO privacy                                                  |
| `backend/server/src/features/discovery/scoring.ts`            | 136   | M08/M13–M15/M32 — eligibility, matching, filters, paging, SQL and DTO privacy                                                  |
| `backend/server/src/features/discovery/service.ts`            | 15    | M08/M13–M15/M32 — eligibility, matching, filters, paging, SQL and DTO privacy                                                  |
| `backend/server/src/features/discovery/types.ts`              | 65    | M08/M13–M15/M32 — eligibility, matching, filters, paging, SQL and DTO privacy                                                  |
| `backend/server/src/features/languages/catalog.ts`            | 201   | M11/M12, L03 — catalog, language invariants, ordering and synchronization                                                      |
| `backend/server/src/features/languages/controller.ts`         | 8     | M11/M12, L03 — catalog, language invariants, ordering and synchronization                                                      |
| `backend/server/src/features/languages/dto.ts`                | 53    | M11/M12, L03 — catalog, language invariants, ordering and synchronization                                                      |
| `backend/server/src/features/languages/index.ts`              | 21    | M11/M12, L03 — catalog, language invariants, ordering and synchronization                                                      |
| `backend/server/src/features/languages/languages.test.ts`     | 285   | M35, L01 — assertions, mocks, schema/route coverage and integration gaps reviewed                                              |
| `backend/server/src/features/languages/repository.ts`         | 191   | M11/M12, L03 — catalog, language invariants, ordering and synchronization                                                      |
| `backend/server/src/features/languages/routes.ts`             | 7     | M11/M12, L03 — catalog, language invariants, ordering and synchronization                                                      |
| `backend/server/src/features/languages/schema.ts`             | 134   | M11/M12, L03 — catalog, language invariants, ordering and synchronization                                                      |
| `backend/server/src/features/languages/service.ts`            | 48    | M11/M12, L03 — catalog, language invariants, ordering and synchronization                                                      |
| `backend/server/src/features/languages/types.ts`              | 37    | M11/M12, L03 — catalog, language invariants, ordering and synchronization                                                      |
| `backend/server/src/features/matching/controller.ts`          | 13    | Intentional 501 stubs confirmed against FEATURES; L04; no invented product gap                                                 |
| `backend/server/src/features/matching/index.ts`               | 1     | Intentional 501 stubs confirmed against FEATURES; L04; no invented product gap                                                 |
| `backend/server/src/features/matching/routes.ts`              | 9     | Intentional 501 stubs confirmed against FEATURES; L04; no invented product gap                                                 |
| `backend/server/src/features/matching/schema.ts`              | 5     | Intentional 501 stubs confirmed against FEATURES; L04; no invented product gap                                                 |
| `backend/server/src/features/matching/service.ts`             | 9     | Intentional 501 stubs confirmed against FEATURES; L04; no invented product gap                                                 |
| `backend/server/src/features/matching/types.ts`               | 6     | Intentional 501 stubs confirmed against FEATURES; L04; no invented product gap                                                 |
| `backend/server/src/features/media/controller.ts`             | 11    | H08–H10, M28/M36, L03/L04 — upload bytes, ownership, storage and transport                                                     |
| `backend/server/src/features/media/index.ts`                  | 1     | H08–H10, M28/M36, L03/L04 — upload bytes, ownership, storage and transport                                                     |
| `backend/server/src/features/media/routes.ts`                 | 36    | H08–H10, M28/M36, L03/L04 — upload bytes, ownership, storage and transport                                                     |
| `backend/server/src/features/media/schema.ts`                 | 6     | H08–H10, M28/M36, L03/L04 — upload bytes, ownership, storage and transport                                                     |
| `backend/server/src/features/media/service.ts`                | 23    | H08–H10, M28/M36, L03/L04 — upload bytes, ownership, storage and transport                                                     |
| `backend/server/src/features/media/storage.ts`                | 74    | H08–H10, M28/M36, L03/L04 — upload bytes, ownership, storage and transport                                                     |
| `backend/server/src/features/media/types.ts`                  | 8     | H08–H10, M28/M36, L03/L04 — upload bytes, ownership, storage and transport                                                     |
| `backend/server/src/features/messaging/controller.ts`         | 76    | H03/H04/H09–H12/H20, M17–M29 — private access, realtime, persistence and learning operations                                   |
| `backend/server/src/features/messaging/gateway.ts`            | 62    | H03/H04/H09–H12/H20, M17–M29 — private access, realtime, persistence and learning operations                                   |
| `backend/server/src/features/messaging/index.ts`              | 3     | H03/H04/H09–H12/H20, M17–M29 — private access, realtime, persistence and learning operations                                   |
| `backend/server/src/features/messaging/learning.ts`           | 159   | H03/H04/H09–H12/H20, M17–M29 — private access, realtime, persistence and learning operations                                   |
| `backend/server/src/features/messaging/messaging.test.ts`     | 227   | M35, L01 — assertions, mocks, schema/route coverage and integration gaps reviewed                                              |
| `backend/server/src/features/messaging/presence.ts`           | 51    | H03/H04/H09–H12/H20, M17–M29 — private access, realtime, persistence and learning operations                                   |
| `backend/server/src/features/messaging/repository.ts`         | 560   | H03/H04/H09–H12/H20, M17–M29 — private access, realtime, persistence and learning operations                                   |
| `backend/server/src/features/messaging/routes.ts`             | 54    | H03/H04/H09–H12/H20, M17–M29 — private access, realtime, persistence and learning operations                                   |
| `backend/server/src/features/messaging/schema.ts`             | 54    | H03/H04/H09–H12/H20, M17–M29 — private access, realtime, persistence and learning operations                                   |
| `backend/server/src/features/messaging/service.ts`            | 40    | H03/H04/H09–H12/H20, M17–M29 — private access, realtime, persistence and learning operations                                   |
| `backend/server/src/features/messaging/socket.ts`             | 164   | H03/H04/H09–H12/H20, M17–M29 — private access, realtime, persistence and learning operations                                   |
| `backend/server/src/features/messaging/types.ts`              | 116   | H03/H04/H09–H12/H20, M17–M29 — private access, realtime, persistence and learning operations                                   |
| `backend/server/src/features/safety/controller.ts`            | 24    | H14/H16, M18/M34, L04 — blocks/reports, authorization and error contracts                                                      |
| `backend/server/src/features/safety/index.ts`                 | 2     | H14/H16, M18/M34, L04 — blocks/reports, authorization and error contracts                                                      |
| `backend/server/src/features/safety/repository.ts`            | 151   | H14/H16, M18/M34, L04 — blocks/reports, authorization and error contracts                                                      |
| `backend/server/src/features/safety/routes.ts`                | 10    | H14/H16, M18/M34, L04 — blocks/reports, authorization and error contracts                                                      |
| `backend/server/src/features/safety/schema.ts`                | 14    | H14/H16, M18/M34, L04 — blocks/reports, authorization and error contracts                                                      |
| `backend/server/src/features/safety/service.ts`               | 17    | H14/H16, M18/M34, L04 — blocks/reports, authorization and error contracts                                                      |
| `backend/server/src/features/safety/types.ts`                 | 19    | H14/H16, M18/M34, L04 — blocks/reports, authorization and error contracts                                                      |
| `backend/server/src/features/users/controller.ts`             | 91    | C02, H13, M02/M08–M11/M13/M33, L03/L06 — profile/account/privacy paths                                                         |
| `backend/server/src/features/users/countries.ts`              | 277   | C02, H13, M02/M08–M11/M13/M33, L03/L06 — profile/account/privacy paths                                                         |
| `backend/server/src/features/users/dto.ts`                    | 206   | C02, H13, M02/M08–M11/M13/M33, L03/L06 — profile/account/privacy paths                                                         |
| `backend/server/src/features/users/index.ts`                  | 16    | C02, H13, M02/M08–M11/M13/M33, L03/L06 — profile/account/privacy paths                                                         |
| `backend/server/src/features/users/practiceGoals.ts`          | 16    | C02, H13, M02/M08–M11/M13/M33, L03/L06 — profile/account/privacy paths                                                         |
| `backend/server/src/features/users/privacy.test.ts`           | 97    | M35, L01 — assertions, mocks, schema/route coverage and integration gaps reviewed                                              |
| `backend/server/src/features/users/profile.test.ts`           | 167   | M35, L01 — assertions, mocks, schema/route coverage and integration gaps reviewed                                              |
| `backend/server/src/features/users/repository.ts`             | 634   | C02, H13, M02/M08–M11/M13/M33, L03/L06 — profile/account/privacy paths                                                         |
| `backend/server/src/features/users/routes.ts`                 | 20    | C02, H13, M02/M08–M11/M13/M33, L03/L06 — profile/account/privacy paths                                                         |
| `backend/server/src/features/users/schema.ts`                 | 147   | C02, H13, M02/M08–M11/M13/M33, L03/L06 — profile/account/privacy paths                                                         |
| `backend/server/src/features/users/service.ts`                | 82    | C02, H13, M02/M08–M11/M13/M33, L03/L06 — profile/account/privacy paths                                                         |
| `backend/server/src/features/users/types.ts`                  | 117   | C02, H13, M02/M08–M11/M13/M33, L03/L06 — profile/account/privacy paths                                                         |
| `backend/server/src/index.ts`                                 | 23    | M31 — lifecycle/listener/shutdown and startup logging                                                                          |
| `backend/server/src/lib/app.ts`                               | 62    | M04/M05/M28/M31 — middleware order, routes, CORS/CSP, liveness/error contract                                                  |
| `backend/server/src/lib/socket.ts`                            | 45    | H03/H04/H10, M04/M22 — handshake, transport and multi-instance state                                                           |
| `backend/server/src/shared/errors/AppError.ts`                | 38    | H03/H10/H19, M03/M05/M28/M29, L04 — cross-cutting auth, errors, logs and validation                                            |
| `backend/server/src/shared/middleware/authenticate.ts`        | 55    | H03/H10/H19, M03/M05/M28/M29, L04 — cross-cutting auth, errors, logs and validation                                            |
| `backend/server/src/shared/middleware/errorHandler.ts`        | 100   | H03/H10/H19, M03/M05/M28/M29, L04 — cross-cutting auth, errors, logs and validation                                            |
| `backend/server/src/shared/middleware/rateLimit.ts`           | 29    | H03/H10/H19, M03/M05/M28/M29, L04 — cross-cutting auth, errors, logs and validation                                            |
| `backend/server/src/shared/middleware/requestLogger.ts`       | 39    | H03/H10/H19, M03/M05/M28/M29, L04 — cross-cutting auth, errors, logs and validation                                            |
| `backend/server/src/shared/middleware/requireUserId.ts`       | 12    | H03/H10/H19, M03/M05/M28/M29, L04 — cross-cutting auth, errors, logs and validation                                            |
| `backend/server/src/shared/types/express.d.ts`                | 14    | H03/H10/H19, M03/M05/M28/M29, L04 — cross-cutting auth, errors, logs and validation                                            |
| `backend/server/src/shared/utils/jwt.ts`                      | 66    | H03/H10/H19, M03/M05/M28/M29, L04 — cross-cutting auth, errors, logs and validation                                            |
| `backend/server/src/shared/utils/logger.ts`                   | 111   | H03/H10/H19, M03/M05/M28/M29, L04 — cross-cutting auth, errors, logs and validation                                            |
| `backend/server/src/shared/utils/pagination.ts`               | 11    | H03/H10/H19, M03/M05/M28/M29, L04 — cross-cutting auth, errors, logs and validation                                            |
| `backend/server/tsconfig.build.json`                          | 4     | H21, L01 — compilation mode and test/tooling scope                                                                             |
| `backend/server/tsconfig.json`                                | 19    | H21, L01 — compilation mode and test/tooling scope                                                                             |
| `backend/server/vitest.config.mts`                            | 9     | M35, L01 — test configuration and environment isolation                                                                        |
| `backend/server/vitest.setup.ts`                              | 15    | M35, L01 — test configuration and environment isolation                                                                        |




**H. Interpreting completion of this audit.** The log includes all distinct issues identified in this review and explicitly records files without additional findings. Proposed fixes still need implementation, migration review and the stated integration checks. No claim is made that static review can prove the absence of all flaws, that unexecuted tests passed, that exposed credentials are currently live, or that the backend has been repaired by producing this report.