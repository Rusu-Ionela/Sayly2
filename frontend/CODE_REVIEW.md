# 🛠️ Comprehensive React Native Frontend Code Review & Audit

**Scope:** `frontend/client/` (React Native / Expo + TypeScript)  
**Compared against:** `frontend/FEATURES.md`, `backend/FEATURES.md`, and live backend source under `backend/server/src/`  
**Date:** 21 September 2026  
**Method:** Line-by-line review of every screen, hook, API module, navigation file, shared component, and lib utility, cross-checked against backend routes, Zod schemas, DTOs, and Socket.IO handlers.

---

## 1. Executive Audit Summary & Health Score

- **Overall Health Score:** **58 / 100**
- **Total Issues Found:** **150**
  - **Critical:** 12 (`#1`–`#12`)
  - **High:** 28 (`#13`–`#40`)
  - **Medium:** 72 (`#41`–`#112`)
  - **Low:** 38 (`#113`–`#150`)
- **Key Risk Summary:**
  - **Product is not discoverable after onboarding.** `PUT /users/me/onboarding` can succeed with languages only, but discovery eligibility requires `profiles.profileCompleted === true`, which needs country **and age ≥ 13**. There is no age/DOB field on onboarding or edit profile. New users complete onboarding and then never appear in Discover.
  - **Profile photo save is impossible.** The picker emits `data:` base64 URLs (and sometimes `file://`). Backend `avatarSchema` only allows `http(s)` or `/media/...` and caps length at 2048.
  - **“Preview profile” always 400s.** Own Profile navigates to `PublicProfile` with the viewer’s id. Backend `getSafePublicProfile` rejects self with `BAD_REQUEST`.
  - **Realtime session dies after token refresh.** `connectSocket()` overwrites the live Socket.IO auth callback with a frozen JWT. Reconnects use the first-connect token.
  - **Chat history and optimistic sends can corrupt the thread.** Inverted pagination concatenates pages in the wrong order; media sends can leave duplicate bubbles because upsert matches on `content` instead of `clientMessageId`; inbox `message_status` overwrites `lastMessage` with an older row.
  - **Web stores refresh tokens in `localStorage`.** XSS steals long-lived session rotation. Native SecureStore writes that fail are swallowed, so the app believes the session is persisted when it is not.
  - **No app-level Error Boundary and no HTTP timeout.** A render exception or hung `fetch` can freeze splash / “Loading your account…” forever.

The architecture (feature folders, TanStack Query, Auth context, Socket provider) is sound. The happy path for login → languages → chat can work in a seeded environment. Production readiness is blocked by discoverability, media, session persistence, and several chat races.

---

## 2. Specification Gaps (`features.md` vs Codebase)

| Feature Name | Expected Behavior (`features.md`) | Current Implementation Status | Missing / Broken Elements |
| :--- | :--- | :--- | :--- |
| Discover visibility toggle | Profile: “Show me in Discover” switch, local storage key `profile.showInDiscover` | **Not implemented.** Comment only on Profile. Dead table later admits it is deferred. | No switch, no storage key, no backend `discoverable` flag. Screen section of FEATURES still documents it as live. |
| WarmErrorState | Shared error + retry component listed in FEATURES | **Missing file.** | `WarmErrorState.tsx` does not exist. Root gate has no me-query error UI. |
| preferenceStorage.ts | Separate non-secret preference adapter | **Missing file.** Theme uses the same `storage` as JWTs. | Keychain I/O for theme; web still uses localStorage. |
| AbortSignal on GETs | `apiClient` “AbortSignal on GETs” | **Partial.** Some Query `queryFn`s pass `signal`; `apiClient.request` never times out and does not inject a default AbortController. | Splash / bootstrap can hang forever. |
| Zod forms where used | Stack table claims Zod forms | **Partial.** Edit profile uses RHF + Zod. Auth uses hand-rolled validators. Settings password has neither. | Auth/Settings validation diverges from backend Zod. |
| onboardingApi re-exports `getMe` | FEATURES feature map | **Broken doc.** `onboardingApi.ts` only re-exports `completeOnboarding`. | `useOnboarding` imports `getMe` from profile. |
| Dev reset code | ForgotPassword shows optional **Dev reset code** box | **Missing.** Styles `devCodeBox` exist unused. | Local/dev reset requires reading email or logs. |
| Sign-up consent | Copy: “I have read and agree…” with Privacy + Terms links | **Incomplete.** Links exist; no required checkbox. | Weak consent record. |
| Onboarding native language | FEATURES: “1 native, ≤10 spoken/fluent, ≤5 learning” | **UI sections exist** via `LanguageSetupSections`, but `canContinue` only checks counts `> 0`. | User can continue with fluent-only spoken list if they never pick Native (depends on section UX). Age/country/photo/goals are not collected at all. |
| Onboarding country, photo, goals, age | Backend onboarding schema accepts them; discovery needs country + age | **Not in live OnboardingScreen.** Pickers exist as unused/edit-only components. | New users never become `profileCompleted`. |
| Preview profile | Profile → PublicProfile self preview | **Broken.** Backend rejects self. | Always “Profile unavailable”. |
| Discover Message CTA | Message → `Conversation { conversationId }` or profile if no id | **Degraded.** Discover DTO has no `conversationId`. After refresh, Message always opens Public Profile. | Only in-session optimistic accept has `conversationId`. |
| Presence on Discover / Connections | Cards: avatar + online/presence indicator | **Fake.** Always green; `accessibilityLabel="Open to practice"`. | Misleading trust signal. Chat inbox presence is real. |
| ConversationScreen / ChatScreen aliases | FEATURES §10 | **Missing.** `features/chat/index.ts` only exports `ChatsScreen` and `ChatDetailScreen`. | Spec drift; navigation uses `Conversation` route name (OK). |
| Socket emit list | FEATURES: `send_message`, `typing_*` only | **Incomplete docs.** Client also emits `join_conversation` and `message_read`. Does not listen `message_error`. | Future “cleanup” risk. |
| clientMessageId uniqueness | FEATURES dead table: “backend uniqueness still pending” | **Stale.** Backend already idempotent on `clientMessageId`. | Client still does not match upserts on that id. |
| Contact & help | Profile footer → help | **Dead-end.** Navigates to Settings, which has no support section. | No mailto / FAQ. |
| Privacy & safety copy | “Password, account, and appearance” | **Mislabelled.** Row opens Settings (OK) but Connections subtitle says “people you follow”. | Follow language is dating/social, not language-exchange. |
| Corrections / learning loop | Product rules + backend skill: corrections, saved phrases | **Not in frontend or backend chat.** Translate/transcribe only. | Core language-exchange loop missing. |
| Matching / swipe | Explicitly **not** product | **Correctly unused.** Backend `/matching` is 501. | Fine; keep unwired. |
| Deep links for password reset | ResetPassword param `code?` | **Unused.** No linking config; Forgot does not pass `code`. | Email links cannot open prefilled reset. |
| i18n | App English | **Broken mix.** Edit success and Discover empty title are Romanian. | Inconsistent product language. |
| Dark theme | Settings Light / Dark / Auto | **Partial.** Many profile/settings/onboarding pickers hardcode `lightColors`. | Unreadable contrast on Dark. |
| GET `/discover/users/:id` | Defined, unused by live PublicProfile | **As documented in dead table.** Live path is `GET /users/:id/public-profile`. | Doc noise only. |
| Chat inbox pagination | Backend `{ items, nextCursor, hasMore }` | **Dropped.** Client returns `page.items` only; single `useQuery`. | Users with >20 conversations never see older threads. |
| Pull-to-refresh on thread | Not specified but needed given reconnect gaps | **Missing.** | Hard to recover missed messages. |
| Unblock / block list | Safety exists as block/report | **No list/unblock UI.** | Permanent block with no in-app recovery. |

---

## 3. Backend & API Integration Mismatches

| File & Line | Expected API Contract (Backend) | Actual Frontend Implementation | Risk / Impact |
| :--- | :--- | :--- | :--- |
| `features/onboarding/screens/OnboardingScreen.tsx` 54–59 | `PUT /users/me/onboarding` optional `country`, `age`/`dateOfBirth`; `computeProfileCompleted` requires both + languages | Sends only `displayName` + language arrays | User is `onboardingCompleted: true` but `profileCompleted: false` → excluded from `GET /discover` |
| `features/profile/screens/ProfileScreen.tsx` 88–89 | `GET /users/:id/public-profile` throws 400 if `viewerId === targetUserId` (`users/repository.ts` 331–337) | Navigates with own `profile.id` | Preview always errors |
| `features/onboarding/components/ProfilePhotoPicker.tsx` 34–46 + `EditProfileScreen.tsx` 162 | `avatarSchema`: `http(s)` or `/media/...`, max 2048 (`users/schema.ts` 35–52) | Sends `data:image/...;base64,...` or `file://` | Save always 400 |
| `EditProfileScreen.tsx` 162 | `avatarUrl` nullable to clear (`putMeProfileSchema`) | `trim() \|\| undefined` omits field | Remove photo never persists |
| `features/auth/validation.ts` 50–58 vs `users/schema.ts` 166 | Onboarding/profile `displayName` min 2 max 50 | Register allows min 1 max 80 (`auth/schema.ts` 17–21) | 51–80 char names cannot finish onboarding |
| `features/settings/screens/SettingsScreen.tsx` 76–79 | `newPasswordSchema` min 8, letter + digit, max 128 | Client only checks `length < 6` | False local success then opaque 400 |
| `features/auth/validation.ts` 29–36 | Same `newPasswordSchema` + null-byte reject + max 128 | Min 8 + letter/number only | Overlong/null-byte passwords fail server-side only |
| `features/auth/validation.ts` 11–19 | `emailSchema` max 254 | No max | Rare 400s |
| `lib/apiClient.ts` 137–145 | `POST /auth/refresh` returns `{ accessToken, refreshToken, user }` | Casts JSON; ignores `user`; no runtime check | `Bearer undefined`; stale user |
| `lib/api/errors.ts` 74–107 | Inactive refresh → 403 `FORBIDDEN` (`auth/service.ts` 164–166) | `FORBIDDEN` not mapped | Generic “Something went wrong” |
| `features/discovery/types.ts` 24 + `DiscoverScreen.tsx` 178–184 | Discover DTO has `connectionStatus` / `connectionId`, **no** `conversationId` (`discovery/dto.ts` 58–76) | UI expects `user.conversationId` for Message | Message always detours after refresh |
| `features/chat/api/chatApi.ts` 26–30 | `GET /conversations` → `{ items, nextCursor, hasMore, limit }` | Returns `page.items` array only | Pagination discarded |
| `features/chat/types.ts` 2 vs backend `messaging/types.ts` | `ONLINE \| OFFLINE \| UNKNOWN` | Client `ONLINE \| OFFLINE` | UNKNOWN treated as offline |
| `features/chat/hooks/useMessages.ts` | Backend emits `message_error`; join/read required | No `message_error` listener; FEATURES omits join/read | Silent socket failures |
| `chatApi.ts` 122–128 | Media MIME allow-list; octet-stream rejected | Fallback `application/octet-stream` | Some uploads 400 |
| `features/profile/schema.ts` 34–37 | Spoken 1–10, learning 1–5, ≤1 NATIVE | Zod `.min(1)` only; Edit uses `LanguageLevelList` which allows multiple NATIVE | Save 400 after valid-looking UI |
| `onboarding/constants.ts` 6–12 | Proficiency enum includes ELEMENTARY, UPPER_INTERMEDIATE | Filter/edit chips omit both | Cannot target those levels |
| `CountryPicker` / filters send country **name** | Backend accepts name or ISO-2; stores mixed | Display lookup is name-only | ISO values render as raw `"US"` |
| `ForgotPasswordScreen` / `ResetPasswordScreen` | Reset requires `challengeId` + 6-digit `token` + password (`auth/schema.ts` 56–70). FEATURES.md backend table still says `token` + `password` only | Frontend **is aligned with live backend**, not with stale backend FEATURES | Doc drift on backend side; FE OK if `challengeId` present |
| `apiClient.ts` 80–88 | No `/auth/session` route | Listed in `AUTH_SKIP_PATHS` | Dead skip path |
| `authApi.getMe` vs Root `GET /users/me` | Two identity endpoints | Bootstrap `/auth/me`; gate `/users/me` | Extra round-trip; `/auth/me` has no `onboardingCompleted` |
| Translate VOICE/VIDEO | Backend transcribe-then-translate; 400 without transcript | MessageBubble offers Translate for VOICE/VIDEO even when `transcript` is null (lines 131–140) | Alert spam |
| `PATCH /users/me/password` via safetyApi | Matches backend path | OK | — |
| Connection request body | `recipientId` or `receiverId`; intro ≤280 sanitized | Client uses `recipientId` + 280 slice | Mostly OK; whitespace collapse edge |

---

## 4. Complete Issue & Bug Directory

*Every issue found across auth, onboarding, splash, navigation, lib, chat, discovery, connections, profile, languages, settings, safety, theme, and shared UI.*

### 🔴 Critical & High Severity Issues (Crashes, Data Loss, Security, Core Spec Breaks)

#### Issue #1: Web stores access and refresh tokens in `localStorage`
- **File Location:** `frontend/client/src/lib/storage.ts` (Lines 156–182); `frontend/client/src/features/auth/authStorage.ts` (Lines 35–53)
- **Category:** Security
- **Root Cause:** On web, `storage` is the `webStorage` adapter that reads/writes `localStorage`. Both JWTs and the refresh token go there. The file comments admit production should use HttpOnly cookies; that work is not done.
- **Impact:** Any XSS (malicious script, compromised dependency, HTML injection) steals the long-lived refresh token and can mint new access tokens until rotation/revocation. This is a full account takeover on the web client.

#### Issue #2: SecureStore write failures are swallowed — session looks persisted
- **File Location:** `frontend/client/src/lib/storage.ts` (Lines 129–150)
- **Category:** Security / Crash
- **Root Cause:** `secureStorage.set` catches errors, logs a warning, deletes the key, and **returns without throwing**. `authStorage.setTokens` and `AuthProvider.persistSession` assume success.
- **Impact:** Login/register succeeds in memory. After process death, tokens are gone → surprise logout. Partial chunk writes can leave inconsistent keys. User believes they are signed in.

#### Issue #3: Root onboarding gate treats `/users/me` failure as “needs onboarding”
- **File Location:** `frontend/client/src/navigation/RootNavigator.tsx` (Lines 25–68)
- **Category:** Spec Gap / Crash
- **Root Cause:** `onboardingCompleted = meQuery.data?.onboardingCompleted === true`. Only `meQuery.isLoading` is special-cased. On `isError` or empty data, the value is `false`, so a signed-in user is forced into `OnboardingScreen`.
- **Impact:** Network/5xx on `GET /users/me` dumps completed users into onboarding. They may re-submit languages or get stuck. The Auth → Onboarding → App gate is not safe.

#### Issue #4: No request timeout — splash / account loading can hang forever
- **File Location:** `frontend/client/src/lib/apiClient.ts` (Lines 321–326); `AuthProvider.tsx` (Lines 99–150); `RootNavigator.tsx` (Lines 46–60)
- **Category:** Crash / Performance
- **Root Cause:** `fetch` is called with no `AbortSignal` timeout. FEATURES claims AbortSignal on GETs. Bootstrap waits on `getMe()` before `isInitialized`. Root waits on `isInitialized` then on `meQuery.isLoading`.
- **Impact:** Hung TCP to the API → splash never ends, or “Loading your account…” forever. No offline escape hatch.

#### Issue #5: Register `displayName` max 80 vs onboarding max 50 — onboarding hard-fails
- **File Location:** `frontend/client/src/features/auth/validation.ts` (Lines 50–58); `OnboardingScreen.tsx` (Lines 54–59); backend `auth/schema.ts` (Lines 17–21); `users/schema.ts` (Line 166)
- **Category:** API Mismatch
- **Root Cause:** User can register a 51–80 character name. Onboarding always sends `displayName: user?.displayName` to `PUT /users/me/onboarding`, which Zod-rejects max 50. There is no name editor on onboarding.
- **Impact:** Account created and signed in, permanently blocked from completing onboarding.

#### Issue #6: “Preview profile” always fails (self public profile)
- **File Location:** `frontend/client/src/features/profile/screens/ProfileScreen.tsx` (Lines 88–89); backend `users/repository.ts` (Lines 331–337)
- **Category:** Spec Gap / API Mismatch
- **Root Cause:** `navigation.navigate("PublicProfile", { userId: profile.id })`. Backend `getSafePublicProfile` throws `Use /users/me for your own profile` when viewer === target.
- **Impact:** Spec documents self-preview as a live control. Every tap lands on the error screen.

#### Issue #7: New users never become discoverable (age + country gate)
- **File Location:** `OnboardingScreen.tsx` (Lines 54–58); `EditProfileScreen.tsx` (no age/DOB); backend `users/dto.ts` (Lines 75–89); `users/repository.ts` (Lines 207–213); `discovery/repository.ts` (Lines 240–245)
- **Category:** Spec Gap / API Mismatch
- **Root Cause:** Live onboarding only sends languages. `computeProfileCompleted` requires displayName, non-empty country, age ≥ 13, and both language lists. Discovery requires `profileCompleted === true`. Edit profile can set country but **cannot set age**. `PUT /users/me/profile` has no age/DOB fields.
- **Impact:** After “successful” onboarding, users are invisible on Discover. Empty partner feed for everyone who only finished language setup. This is a core spec break for a language-exchange product.

#### Issue #8: Profile photo save cannot succeed
- **File Location:** `ProfilePhotoPicker.tsx` (Lines 21–47); `EditProfileScreen.tsx` (Line 162); backend `users/schema.ts` (Lines 35–52)
- **Category:** API Mismatch
- **Root Cause:** Picker builds `data:${mime};base64,...` (up to ~350k chars) or raw `asset.uri` (`file://` / `ph://`). Backend only allows http(s) or `/media/...`, max 2048 chars.
- **Impact:** Choosing a photo then Save always validation-fails. Generic “Could not save” alert. Avatars never update from the UI.

#### Issue #9: Optimistic media send can leave duplicate bubbles
- **File Location:** `frontend/client/src/features/chat/cache.ts` (Lines 35–77); `useMessages.ts` (Lines 178–209)
- **Category:** Crash (UI) / Race
- **Root Cause:** Upsert matches optimistic rows by `replaceLocalId` **or** `senderId + content`. After upload, optimistic `content` becomes the remote URL. `message_new` can arrive **before** the socket ack. If content no longer matches the local URI, the server row is appended; the ack then merges by server id and **leaves** the `msg-…` row. Matching never uses `clientMessageId` even though both sides send it.
- **Impact:** Duplicate media/voice bubbles; broken identity; wrong unread/preview.

#### Issue #10: Socket auth callback replaced with a frozen token
- **File Location:** `frontend/client/src/lib/socket.ts` (Lines 15–33)
- **Category:** Security / Race
- **Root Cause:** `io(..., { auth: (cb) => authStorage.getTokens()... })` is correct, but `connectSocket()` then does `instance.auth = { token: tokens?.accessToken }` — a static object. Reconnects reuse the JWT from first connect. Token refresh updates HTTP memory + SecureStore but does not `resetSocket()`.
- **Impact:** After access-token rotation, socket reconnects with a revoked/expired token → silent realtime death until full sign-out.

#### Issue #11: Inbox `message_status` corrupts conversation preview
- **File Location:** `useConversations.ts` (Lines 34–38); `cache.ts` (Lines 99–128)
- **Category:** Crash (logic) / Race
- **Root Cause:** On read receipts, backend emits many updated messages. Inbox takes `messages[messages.length - 1]` and runs `patchConversationWithMessage`, which **always** sets `lastMessage` to that payload, even if it is an older message whose status just changed.
- **Impact:** Wrong preview text/time; list jumps; possible unread bumps.

#### Issue #12: Inverted pagination concatenates pages in the wrong order
- **File Location:** `ChatDetailScreen.tsx` (Lines 44–47, 191–195)
- **Category:** Performance / Spec Gap
- **Root Cause:** Infinite query pages are `[newestBatch, olderBatch, …]`. Each batch is chronological ascending. `flatMap` then `.reverse()` is non-monotonic once page 2+ loads (example: `[70…41, 100…71]` as inverted data).
- **Impact:** Messages jump/reorder when loading history; wrong visual end of chat.

#### Issue #13: Orphaned tokens after bootstrap network failure without cached user
- **File Location:** `AuthProvider.tsx` (Lines 125–145, 239)
- **Category:** Security / Architecture
- **Root Cause:** On network error, tokens are kept but `user` may stay `null`. `isSignedIn = Boolean(user && accessToken)` → Auth UI while SecureStore still has tokens. Socket may still authenticate.
- **Impact:** Split-brain: UI logged out, background HTTP/socket still authed (or vice versa after partial restore).

#### Issue #14: Refresh success does not validate response shape
- **File Location:** `apiClient.ts` (Lines 137–145)
- **Category:** Crash / Security
- **Root Cause:** Casts JSON to `{ accessToken; refreshToken }` with no checks. Empty/malformed body writes `undefined` tokens.
- **Impact:** Subsequent requests send `Authorization: Bearer undefined`. Session corruption.

#### Issue #15: Socket handshake reads SecureStore, not in-memory token
- **File Location:** `lib/socket.ts` (Lines 15–18); `AuthProvider.tsx` (Lines 81–87)
- **Category:** Security / Architecture
- **Root Cause:** Handshake uses `authStorage.getTokens()`, not `accessTokenRef`. Combined with Issue #2 (silent write fail) and Issue #10 (frozen auth), HTTP and socket can disagree.
- **Impact:** Realtime uses stale/missing token while REST works (or the reverse).

#### Issue #16: TanStack Query retries after 401
- **File Location:** `queryClient.ts` (Line 8)
- **Category:** Performance / Security
- **Root Cause:** Default `retry: 1` retries all failed queries, including post-logout 401s.
- **Impact:** Extra 401s, repeated `onAuthFailure`, flicker.

#### Issue #17: Client password rules weaker than server (register)
- **File Location:** `validation.ts` (Lines 29–36); backend `shared/validation/text.ts` (Lines 29–35)
- **Category:** API Mismatch / Security
- **Root Cause:** Client: min 8 + letter + number. Server also max 128 and rejects `\u0000`.
- **Impact:** Opaque server errors for overlong/null-byte passwords.

#### Issue #18: Email max length not enforced on client
- **File Location:** `validation.ts` (Lines 11–19)
- **Category:** API Mismatch
- **Root Cause:** No 254 cap after trim.
- **Impact:** Rare validation 400s with generic copy.

#### Issue #19: Sign-up asserts legal agreement with no control
- **File Location:** `SignUpScreen.tsx` (Privacy/Terms copy; no checkbox)
- **Category:** Spec Gap / Security (compliance)
- **Root Cause:** Copy claims agreement; submit does not require acknowledgment.
- **Impact:** Weak consent record.

#### Issue #20: Default API base URL is cleartext HTTP
- **File Location:** `apiClient.ts` (Lines 33–54)
- **Category:** Security
- **Root Cause:** Fallback `http://localhost:4000` / LAN host / `10.0.2.2`. Tokens travel in `Authorization` over HTTP if `EXPO_PUBLIC_API_URL` is unset in a release build.
- **Impact:** Credential interception on open Wi-Fi. Critical if shipped without HTTPS override.

#### Issue #21: Theme preference stored via the secrets adapter
- **File Location:** `ThemeProvider.tsx` (Lines 43–57); `storage.ts` (Lines 175–182)
- **Category:** Architecture / Performance
- **Root Cause:** FEATURES documents `preferenceStorage.ts` (missing). Theme uses `storage` → SecureStore on native.
- **Impact:** Keychain I/O for a non-secret; competes with token chunking; conceptually unsafe mixing.

#### Issue #22: Dev reset code UI missing
- **File Location:** `FEATURES.md` (Lines 176–179); `ForgotPasswordScreen.tsx` (entire file); `authFormStyles.ts` (`devCodeBox` unused)
- **Category:** Spec Gap
- **Root Cause:** Screen never renders `devCode` from a non-prod forgot-password response.
- **Impact:** Local reset harder without mailbox access.

#### Issue #23: Onboarding continue does not require a native language in code
- **File Location:** `OnboardingScreen.tsx` (Lines 26–28); FEATURES line 204
- **Category:** Spec Gap
- **Root Cause:** `canContinue` is spoken.length > 0 && learning.length > 0. Native constraint lives only inside `LanguageSetupSections` UX, not in the gate.
- **Impact:** If sections are bypassed or state is patched, users enter Discover without a native language. Combined with #7, they still will not appear in the feed.

#### Issue #24: Single-character display names: register OK, onboarding fails
- **File Location:** `validation.ts` (Lines 50–54); backend onboarding min 2; `OnboardingScreen.tsx` (Line 56)
- **Category:** API Mismatch
- **Root Cause:** Register min 1. Onboarding resubmits the name.
- **Impact:** Same hard-block as #5 for 1-character names.

#### Issue #25: Socket `emit` has no ack timeout
- **File Location:** `socket/SocketProvider.tsx` (Lines 91–106)
- **Category:** Race / Crash
- **Root Cause:** Promise waits forever if the server never acks (disconnect mid-handler, proxy drop).
- **Impact:** Send stuck in `"sending"`; no HTTP fallback until process kill.

#### Issue #26: No `message_error` listener
- **File Location:** backend `messaging/socket.ts` (emits `message_error`); frontend hooks (no listener)
- **Category:** API Mismatch
- **Root Cause:** Client only uses ack `ok: false`. Fire-and-forget and some failures emit `message_error`.
- **Impact:** Silent send/join/read failures.

#### Issue #27: Conversations pagination discarded
- **File Location:** `chatApi.ts` (Lines 26–30); `useConversations.ts` (Lines 17–21)
- **Category:** Spec Gap / API Mismatch
- **Root Cause:** `getConversations` unwraps to `items`; hook is a single `useQuery`.
- **Impact:** Inbox capped at first page (default 20).

#### Issue #28: No message refetch on socket reconnect
- **File Location:** `useMessages.ts` (Lines 80–124); `SocketProvider.tsx` (Lines 55–62)
- **Category:** Race / Architecture
- **Root Cause:** On reconnect, client re-joins the room only. No `invalidateQueries` / gap fill.
- **Impact:** Missed `message_new` / status while offline until leaving the screen.

#### Issue #29: Content-based optimistic match is unsafe
- **File Location:** `cache.ts` (Lines 50–59)
- **Category:** Race
- **Root Cause:** Fallback pairs local row by identical `content` + `senderId`.
- **Impact:** Two identical texts or URI→URL change mis-associate bubbles.

#### Issue #30: `removeClippedSubviews` on inverted lists including iOS
- **File Location:** `ChatDetailScreen.tsx` (Line 183)
- **Category:** Crash / Performance
- **Root Cause:** `removeClippedSubviews={Platform.OS !== "web"}` enables clipping on iOS inverted FlatLists (known blank-cell bugs).
- **Impact:** Blank messages while scrolling; wrong tap targets.

#### Issue #31: Translate offered for VOICE/VIDEO without transcript
- **File Location:** `MessageBubble.tsx` (Lines 118–140); backend learning service
- **Category:** Spec Gap / Unhandled status
- **Root Cause:** Translate shows for any non-IMAGE (or IMAGE with caption), including VOICE/VIDEO with `transcript == null`. Backend 400s.
- **Impact:** Alert spam; dead-end learning UX.

#### Issue #32: No corrections / saved-phrase product surface
- **File Location:** entire `features/chat`; product rules in frontend skill / FEATURES chat §9–10
- **Category:** Spec Gap
- **Root Cause:** Only translate/transcribe. No correction API/UI.
- **Impact:** Language-exchange loop (HelloTalk/Tandem-style corrections) missing.

#### Issue #33: Discover “Message” never gets `conversationId` from API
- **File Location:** `discovery/types.ts` (Line 24); `DiscoverScreen.tsx` (Lines 178–184); backend `discovery/dto.ts` (Lines 58–76)
- **Category:** API Mismatch
- **Root Cause:** Discover DTO has no `conversationId`. UI: if missing, open Public Profile.
- **Impact:** After refresh, Message never opens chat directly.

#### Issue #34: Password change client vs server rules disagree
- **File Location:** `SettingsScreen.tsx` (Lines 76–79); backend `text.ts` (Lines 29–35)
- **Category:** API Mismatch / Security
- **Root Cause:** FE `newPassword.length < 6`. BE min 8 + letter + digit.
- **Impact:** Users pass client check, then “Could not change password”.

#### Issue #35: Connection accept/decline/cancel/remove: silent failures
- **File Location:** `DiscoverScreen.tsx` (Lines 145–177); `ConnectionsScreen.tsx`; `PublicProfileScreen.tsx`; `useConnections.ts` (Lines 85–177)
- **Category:** Missing UI states
- **Root Cause:** Screens call `mutate(...)` with no `onError`. Hooks only patch cache on success.
- **Impact:** 403/409/network leave the UI idle; user thinks nothing happened or that it worked.

#### Issue #36: Edit profile allows multiple NATIVE; API rejects
- **File Location:** `LanguageLevelList.tsx` (spoken chips include NATIVE); `profile/schema.ts` (Line 34); backend `languages/schema.ts` (max one native)
- **Category:** API Mismatch
- **Root Cause:** Language Preferences uses `LanguageSetupSections` (enforces 1 native). Edit Profile does not.
- **Impact:** Save fails after a seemingly valid edit.

#### Issue #37: Cannot clear profile photo on the server
- **File Location:** `EditProfileScreen.tsx` (Line 162); backend `avatarUrl` nullable
- **Category:** Spec Gap / API Mismatch
- **Root Cause:** Remove sets `""`; submit sends `undefined`, so the field is omitted.
- **Impact:** “Remove” only clears the form; saved profile keeps the old image.

#### Issue #38: Language Preferences rapid edits race
- **File Location:** `LanguagePreferencesScreen.tsx`; `useLanguages.ts` (Lines 59–101)
- **Category:** Architecture / Performance
- **Root Cause:** Every spoken/learning change fires immediate `PUT /users/me/languages`. Overlapping mutates can use stale closures even with optimistic cache (in-flight PUTs still race on the server).
- **Impact:** Lost language rows, flicker, validation errors under fast taps.

#### Issue #39: Fake “online / open to practice” presence
- **File Location:** `UserDiscoveryCard.tsx` (Lines 119–125); `ConnectionCard.tsx`; FEATURES 221, 261
- **Category:** Spec Gap
- **Root Cause:** Always renders a green presence dot. No presence API on those screens.
- **Impact:** Misleading availability; a11y announces everyone as open to practice.

#### Issue #40: FEATURES still documents Discover visibility toggle as live
- **File Location:** `FEATURES.md` (Line 342 vs dead table 460); `ProfileScreen.tsx` (Line 86)
- **Category:** Spec Gap
- **Root Cause:** Screen section lists the switch; code is a comment; follow-ups say backend `discoverable` is missing.
- **Impact:** QA/product expect a control that does not exist.

---

### 🟠 Medium Severity Issues

#### Issue #41: FEATURES AbortSignal claim vs no default timeout
- **File Location:** `FEATURES.md` (Line 48); `apiClient.ts`
- **Category:** Spec Gap / Performance
- **Root Cause:** Some queries pass `signal`; client never applies a timeout controller.
- **Impact:** Same hang class as #4 for any GET.

#### Issue #42: `preferenceStorage.ts` documented, not present
- **File Location:** `FEATURES.md` (Line 54)
- **Category:** Spec Gap
- **Root Cause:** File does not exist.
- **Impact:** Theme mixed into secret storage (#21).

#### Issue #43: `WarmErrorState.tsx` documented, not present
- **File Location:** `FEATURES.md` (Line 67); `RootNavigator.tsx` (Lines 54–60)
- **Category:** Spec Gap
- **Root Cause:** No shared error+retry for profile gate.
- **Impact:** Ties to #3.

#### Issue #44: “Zod forms where used” overstated
- **File Location:** `FEATURES.md` (Line 9); `validation.ts`
- **Category:** Spec Gap / Architecture
- **Root Cause:** Auth is hand-rolled.
- **Impact:** Dual validation languages; drift from backend Zod.

#### Issue #45: `onboardingApi` does not re-export `getMe`
- **File Location:** `FEATURES.md` (Line 93); `onboarding/api/onboardingApi.ts`
- **Category:** Spec Gap
- **Root Cause:** Only `completeOnboarding`.
- **Impact:** Doc lie; not a runtime bug.

#### Issue #46: Splash exit can stall if fade is interrupted
- **File Location:** `features/splash/SplashScreen.tsx` (exit animation completion)
- **Category:** Crash
- **Root Cause:** `onComplete()` only if animation `finished === true`. Interrupted animation can leave `hasExitedRef` true without completing.
- **Impact:** User stuck on splash.

#### Issue #47: Welcome carousel `setState` after unmount
- **File Location:** `WelcomeHeroCarousel.tsx`
- **Category:** Memory / Performance
- **Root Cause:** Cleanup clears interval only; in-flight `Animated.start` still `setIndex`.
- **Impact:** RN warning; wasted work.

#### Issue #48: MosaicBackdrop rebuilds large tile lists
- **File Location:** `SplashBackdrop.tsx` / `AmbientBackground`
- **Category:** Performance
- **Root Cause:** Dozens/hundreds of absolute Views on dimension/theme change. Auth + splash + app shell all paint mosaics.
- **Impact:** Jank on low-end Android during splash/auth.

#### Issue #49: `isSignedIn` ignores refresh token / JWT expiry
- **File Location:** `AuthProvider.tsx` (Line 239)
- **Category:** Architecture
- **Root Cause:** Signed-in iff user + access token strings exist.
- **Impact:** Expired access still “signed in” until first 401. Acceptable if refresh is reliable (#14 is not).

#### Issue #50: `clearSession` / `onAuthFailure` not single-flight
- **File Location:** `AuthProvider.tsx` (Lines 66–75, 89–92); `apiClient.ts` (Lines 355–356)
- **Category:** Architecture
- **Root Cause:** Concurrent 401s each call `onAuthFailure`.
- **Impact:** Duplicate SecureStore deletes, query clears, socket resets.

#### Issue #51: Login/Register/SignOut share one `isLoading`
- **File Location:** `AuthProvider.tsx` (Lines 40, 163, 189, 215)
- **Category:** Architecture
- **Root Cause:** Single boolean for all auth mutations.
- **Impact:** Unlikely dual mounts, but sign-out disables login chrome if both exist.

#### Issue #52: Reset success does not auto-navigate
- **File Location:** `ResetPasswordScreen.tsx`
- **Category:** Spec Gap
- **Root Cause:** User must tap “Back to sign in”. Server already revoked other sessions.
- **Impact:** Weak completion UX.

#### Issue #53: Reset/forgot do not map backend `fields` for `token` / `challengeId`
- **File Location:** `validation.ts` `mapBackendFields` (Lines 93–103)
- **Category:** API Mismatch
- **Root Cause:** Mapper only email/password/displayName.
- **Impact:** Field-level reset errors show as form-level only.

#### Issue #54: Dual identity fetches (`/auth/me` + `/users/me`)
- **File Location:** `authApi.ts` (Lines 17–18); `profileApi.ts`; `AuthProvider` 119; `RootNavigator` 25
- **Category:** Performance / Architecture
- **Root Cause:** Bootstrap cannot see `onboardingCompleted` from `/auth/me`.
- **Impact:** Extra round-trip after every cold start.

#### Issue #55: Cached AuthUser strips bio/photo
- **File Location:** `authStorage.ts` (Lines 19–31)
- **Category:** Architecture
- **Root Cause:** Intentional minimal cache.
- **Impact:** Offline bootstrap shows empty photo until profile loads. Fine if documented.

#### Issue #56: SecureStore chunk writes are not atomic
- **File Location:** `storage.ts` (Lines 140–143)
- **Category:** Crash / Security
- **Root Cause:** Metadata + chunks written in `Promise.all`. Kill mid-write → incomplete set → `get` returns null.
- **Impact:** False logout.

#### Issue #57: `AUTH_SKIP_PATHS` includes `/auth/session`
- **File Location:** `apiClient.ts` (Lines 80–88)
- **Category:** Architecture
- **Root Cause:** No backend route.
- **Impact:** Dead code.

#### Issue #58: No deep link for reset with `challengeId` + code
- **File Location:** `navigation/types.ts`; `AuthNavigator.tsx`
- **Category:** Spec Gap
- **Root Cause:** No linking config.
- **Impact:** Email cannot open ResetPassword prefilled.

#### Issue #59: ForgotPassword button re-submits if `codeSent && !challengeId`
- **File Location:** `ForgotPasswordScreen.tsx` (Lines 114–120, 34–38)
- **Category:** Edge case
- **Root Cause:** `handleSubmit` clears `challengeId` at start; if response omits it, button calls `handleSubmit` again.
- **Impact:** Wipes success state; extra emails.

#### Issue #60: Onboarding country/photo/goals components unused by live onboarding
- **File Location:** `CountryPicker.tsx`, `ProfilePhotoPicker.tsx`, `PracticeGoalsPicker.tsx`, `LanguageLevelList.tsx` vs `OnboardingScreen.tsx`
- **Category:** Architecture / Spec Gap
- **Root Cause:** Live onboarding is languages-only.
- **Impact:** Dead surface; `ProfilePhotoPicker` data URLs would fail if wired naively (#8).

#### Issue #61: Socket connects during onboarding
- **File Location:** `SocketProvider.tsx` (Lines 44–49); `main.tsx` (Lines 35–39)
- **Category:** Performance / Architecture
- **Root Cause:** Connects on `isSignedIn`, not `onboardingCompleted`.
- **Impact:** Unnecessary socket during language setup.

#### Issue #62: `connectSocket` Promise can hang
- **File Location:** `socket.ts` (Lines 35–52)
- **Category:** Crash
- **Root Cause:** Waits for `connect` / `connect_error` only. If neither fires, Promise never settles. `io` timeout is 8000ms so `connect_error` usually fires — but assigning static `auth` (#10) can produce odd reconnect loops.
- **Impact:** SocketProvider stuck `connecting`.

#### Issue #63: In-flight mutations after logout
- **File Location:** `AuthProvider.tsx` (Line 74)
- **Category:** Architecture
- **Root Cause:** `queryClient.clear()` does not cancel in-flight mutations.
- **Impact:** Results may write into a new user’s cache if they sign in quickly (low probability).

#### Issue #64: Refresh `user` payload ignored
- **File Location:** `apiClient.ts` (Lines 137–145); `auth/service.ts` (Lines 179–183)
- **Category:** API Mismatch
- **Root Cause:** Client does not update stored user from refresh.
- **Impact:** Status/displayName changes wait until next me.

#### Issue #65: Hardcoded Privacy/Terms URLs may 404
- **File Location:** `SignUpScreen.tsx`; `ProfileScreen.tsx` (Line 22); `SettingsScreen.tsx` (Line 27)
- **Category:** Spec Gap
- **Root Cause:** `https://sayly.app/privacy` with no in-app fallback.
- **Impact:** Dead legal links.

#### Issue #66: Typing indicator can stick after leaving composer
- **File Location:** `ChatInput.tsx` (Line 128)
- **Category:** Race / Memory
- **Root Cause:** Unmount clears timers but does not `onTypingChange(false)`.
- **Impact:** Partner sees “typing…” until their 4s timeout.

#### Issue #67: Partner typing local timeout only
- **File Location:** `useMessages.ts` (Lines 101–106)
- **Category:** Race
- **Root Cause:** 4s client timeout; lost `typing_stop` relies on it.
- **Impact:** Stale typing UI.

#### Issue #68: Web voice player listener leak
- **File Location:** `ChatMedia.tsx` (Lines 20–41)
- **Category:** Memory / Performance
- **Root Cause:** `addEventListener("ended"|"error")` never removed; no unmount `pause()`.
- **Impact:** Ghost audio when scrolling recycled rows on web.

#### Issue #69: Web object URLs for recordings not revoked
- **File Location:** `RecordSendButton.tsx`
- **Category:** Memory
- **Root Cause:** `URL.createObjectURL` without `revokeObjectURL`.
- **Impact:** Memory growth during long web sessions.

#### Issue #70: Native record hold timers / camera not cleaned on unmount
- **File Location:** `RecordSendButton.native.tsx`
- **Category:** Memory / Crash
- **Root Cause:** Hold/tick intervals and `CameraView` may survive unmount mid-hold.
- **Impact:** Recording continues; setState on unmounted component.

#### Issue #71: Upload default MIME rejected by multer
- **File Location:** `chatApi.ts` (Lines 122–128)
- **Category:** API Mismatch
- **Root Cause:** Unknown extension → `application/octet-stream`.
- **Impact:** Gallery/voice assets fail with opaque errors.

#### Issue #72: Signed / relative media URLs cached forever in message content
- **File Location:** messages persist `/media/files/...` or absolute URLs
- **Category:** Spec Gap
- **Root Cause:** No re-sign on 404.
- **Impact:** Old media can break if storage/URL policy changes.

#### Issue #73: Presence not queried when opening a thread
- **File Location:** Chat header uses last inbox payload; socket `user_online_status` can be queried
- **Category:** Spec Gap
- **Root Cause:** Client only listens; never emits snapshot request for partner.
- **Impact:** Stale Online/Offline until next broadcast.

#### Issue #74: Unread cleared before server ack
- **File Location:** `useMessages.ts` (Lines 57–68)
- **Category:** Race
- **Root Cause:** `clearConversationUnread` then best-effort emit; failures swallowed.
- **Impact:** Badge 0 while server still unread.

#### Issue #75: Double inbox + thread handling of `message_new`
- **File Location:** `useMessages.ts` (Lines 85–91); `useConversations.ts` (Lines 26–28)
- **Category:** Architecture / Race
- **Root Cause:** Both patch conversation; thread also mark-reads.
- **Impact:** Badge flicker.

#### Issue #76: No `leave_conversation`
- **File Location:** `useMessages.ts` join only
- **Category:** Architecture / Memory
- **Root Cause:** Socket stays in every visited conversation room for the connection lifetime.
- **Impact:** Extra fan-out.

#### Issue #77: Cold open conversation header empty
- **File Location:** `ChatDetailScreen.tsx` (Lines 43, 136–149)
- **Category:** Spec Gap
- **Root Cause:** Partner info only from conversations query; no GET-by-id.
- **Impact:** Title “Chat”, no safety menu, no presence.

#### Issue #78: Thin HTTP mapping for translate/transcribe/upload
- **File Location:** `MessageBubble.tsx` catch → Alert
- **Category:** Unhandled HTTP status
- **Root Cause:** 429 / 501 / 503 treated as generic strings. Whisper missing → 501 `NOT_IMPLEMENTED`.
- **Impact:** Poor recovery (“not configured” vs “try again”).

#### Issue #79: `keyExtractor` uses unstable optimistic ids
- **File Location:** `ChatDetailScreen.tsx` (Line 177)
- **Category:** Performance
- **Root Cause:** Row key `item.id` changes `msg-…` → server id → remount.
- **Impact:** Media players restart; scroll jank.

#### Issue #80: `VIDEO_NOTE_MARKER` magic thumbnail string
- **File Location:** `chat/constants.ts`; `RecordSendButton`; schema allows arbitrary `thumbnailUrl`
- **Category:** Architecture / Spec Gap
- **Root Cause:** Round video note encoded as sentinel thumbnail, not a real field.
- **Impact:** Pollutes DB; breaks if thumbnail becomes a real URL.

#### Issue #81: Android KeyboardAvoidingView `behavior` undefined on many forms
- **File Location:** `LoginScreen.tsx`; `ChatDetailScreen.tsx` (Lines 103–106); `EditProfileScreen.tsx` (Lines 194–197)
- **Category:** UX
- **Root Cause:** iOS padding only.
- **Impact:** Obscured fields on some Android keyboards.

#### Issue #82: Dual discover query aliases
- **File Location:** `discoveryApi.ts` (Lines 15–22)
- **Category:** API Mismatch (cosmetic)
- **Root Cause:** Sends both `spokenLanguageId` and `spokenLanguage`.
- **Impact:** None functionally; noisy contract.

#### Issue #83: Proficiency filter ignored for learning when spoken is also set
- **File Location:** backend `discovery/repository.ts` (Lines 206–231); `FilterBottomSheet.tsx`
- **Category:** Spec Gap
- **Root Cause:** Combined filters apply proficiency only to spoken. UI does not explain.
- **Impact:** Surprising empty/wrong results.

#### Issue #84: Discovery proficiency options omit two levels
- **File Location:** `discovery/utils.ts`; `onboarding/constants.ts` (Lines 6–12)
- **Category:** API Mismatch
- **Root Cause:** Chips: BEGINNER…NATIVE only. Catalog has ELEMENTARY / UPPER_INTERMEDIATE.
- **Impact:** Cannot target those levels; edit can silently drop them.

#### Issue #85: Country stored as name vs ISO display bugs
- **File Location:** `CountryPicker.tsx`; `shared/data/countries.ts`
- **Category:** API Mismatch
- **Root Cause:** Names and ISO can both exist in DB. Name-only lookup fails for `"US"`.
- **Impact:** Ugly labels; picker may not show selection.

#### Issue #86: Public profile omits age; Discover shows age
- **File Location:** `UserDiscoveryCard.tsx` (Lines 134–136); safe public DTO has no age
- **Category:** Spec Gap
- **Root Cause:** Privacy on public DTO vs discovery cards.
- **Impact:** Age visible in feed, gone on profile open.

#### Issue #87: Connections list hard-capped at 200
- **File Location:** backend connections repository `.limit(200)`; FE single GET
- **Category:** Spec Gap / Performance
- **Root Cause:** FE assumes full lists.
- **Impact:** Heavy users lose older requests with no hint.

#### Issue #88: Accepted connection without `conversationId` hides Message
- **File Location:** `ConnectionCard.tsx`; `PublicProfileScreen` handleMessage
- **Category:** Missing UI states
- **Root Cause:** Card hides Message if `!conversationId`.
- **Impact:** Stuck ACCEPTED with only Remove.

#### Issue #89: `keepPreviousData` shows wrong partners after filter change
- **File Location:** `useDiscovery.ts`; `DiscoverScreen.tsx`
- **Category:** Performance / UX
- **Root Cause:** Old items/total remain while new filters load.
- **Impact:** Wrong partner count and cards after Apply.

#### Issue #90: Search debounce 150ms
- **File Location:** `DiscoverScreen.tsx`
- **Category:** Performance
- **Root Cause:** Hits rate-limited `/discover` per keystroke burst.
- **Impact:** Extra load; possible 429.

#### Issue #91: FlatList wrapped in Reanimated `Animated.View`
- **File Location:** `DiscoverScreen.tsx`
- **Category:** Performance
- **Root Cause:** Entering animation wraps the scroll host.
- **Impact:** Android scroll/layout quirks.

#### Issue #92: `languageCatalog = languagesQuery.data ?? []` breaks memo
- **File Location:** `DiscoverScreen.tsx`
- **Category:** Performance
- **Root Cause:** New `[]` each render while catalog loading → `UserDiscoveryCard` memo never skips.
- **Impact:** Extra re-renders of every card.

#### Issue #93: Hardcoded `lightColors` (dark mode broken)
- **File Location:** `EditProfileScreen.tsx` (Line 28); `ProfileHeader.tsx`; `LanguageBadges.tsx`; `BioSection.tsx`; `PracticeGoalsSection.tsx`; `BlockReportMenu.tsx`; `SettingsScreen.tsx` (Line 20); `SettingsRow.tsx`; `LanguageSnackbar.tsx`; `ProfilePhotoPicker.tsx` (Line 5); `CountryPicker.tsx`
- **Category:** Spec Gap / Architecture
- **Root Cause:** Settings offers Dark/Auto; these UIs ignore `useColors()`.
- **Impact:** Light surfaces on dark theme; contrast failures.

#### Issue #94: Romanian copy in English app
- **File Location:** `EditProfileScreen.tsx` (Line 170); `DiscoveryEmptyState.tsx`
- **Category:** Spec Gap
- **Root Cause:** `"Profil actualizat cu succes!"`, `"Gata de zbor. Începe prima ta conversație!"`
- **Impact:** Inconsistent product language.

#### Issue #95: Practice goals required on edit even if empty from onboarding
- **File Location:** `profile/schema.ts` (Lines 30–33)
- **Category:** Spec Gap
- **Root Cause:** Client `.min(1)`; onboarding never sets goals.
- **Impact:** Users cannot save other fields until they pick goals.

#### Issue #96: Age never editable after onboarding
- **File Location:** Edit profile (no DOB); `putMeProfileSchema` has no age
- **Category:** Spec Gap
- **Root Cause:** Combined with #7, no recovery path.
- **Impact:** Permanent `profileCompleted: false`.

#### Issue #97: Contact & help → Settings with no help content
- **File Location:** `ProfileScreen.tsx` (Lines 140–147)
- **Category:** Spec Gap
- **Root Cause:** Footer navigates to Settings.
- **Impact:** Dead-end.

#### Issue #98: Connections menu copy says “follow”
- **File Location:** `ProfileScreen.tsx` (Line 117)
- **Category:** Spec Gap
- **Root Cause:** Product is connection requests, not follow.
- **Impact:** Wrong mental model.

#### Issue #99: Block/report menu always light; no self-guard
- **File Location:** `BlockReportMenu.tsx`; `PublicProfileScreen` always shows ⋮
- **Category:** Security / Spec Gap
- **Root Cause:** If self-preview worked, Block/Report/Connect would show. Backend would 400.
- **Impact:** Bad UX; today masked by #6.

#### Issue #100: `FeedbackToast` sits under floating tab bar
- **File Location:** `FeedbackToast.tsx`; `ConnectionRequestModal.tsx`
- **Category:** UX
- **Root Cause:** `bottom: 28` ignores tab bar inset.
- **Impact:** “Request sent” obscured on Discover.

#### Issue #101: Remove connection does not refresh chat list
- **File Location:** `useConnections.ts` (Lines 175–177 vs accept 111)
- **Category:** Spec Gap
- **Root Cause:** Accept invalidates conversations; remove does not.
- **Impact:** Stale partner header until manual refresh.

#### Issue #102: Language Preferences catalog lookup uses wrong array
- **File Location:** `LanguagePreferencesScreen.tsx` `mapToItems`
- **Category:** Architecture
- **Root Cause:** Searches previous user languages, not `manager.catalog`.
- **Impact:** Temp items can display raw language ids.

#### Issue #103: Fluent/native editor cannot change proficiency in Preferences
- **File Location:** `LanguageSectionEditor.tsx`; `LanguageSetupSections.tsx`
- **Category:** Spec Gap
- **Root Cause:** Spoken add locks NATIVE/FLUENT; Edit Profile can change levels.
- **Impact:** Path-dependent proficiency.

#### Issue #104: Settings password modal: no `onRequestClose`, fields not cleared on cancel
- **File Location:** `SettingsScreen.tsx` (password modal)
- **Category:** Missing UI / Security
- **Root Cause:** Android back may not dismiss; Cancel leaves passwords in state.
- **Impact:** Credential residue if reopened.

#### Issue #105: Delete account Alert after `signOut` race
- **File Location:** `SettingsScreen.tsx` (Lines 63–67)
- **Category:** Crash / UX
- **Root Cause:** `signOut()` then `Alert.alert` — Settings may unmount first.
- **Impact:** Success alert may never show.

#### Issue #106: Client edit schema does not enforce max spoken/learning counts
- **File Location:** `profile/schema.ts` (Lines 34–37)
- **Category:** API Mismatch
- **Root Cause:** UI has `maxItems`; Zod does not.
- **Impact:** Bypass → 400.

#### Issue #107: Intro message sanitize mismatch
- **File Location:** `ConnectionRequestModal.tsx`; backend connections schema
- **Category:** API Mismatch
- **Root Cause:** Client caps raw 280; server collapses whitespace then re-checks 280.
- **Impact:** Rare validation error.

#### Issue #108: No Error Boundary anywhere
- **File Location:** `main.tsx` (entire tree)
- **Category:** Crash
- **Root Cause:** Zero `ErrorBoundary` / `componentDidCatch`.
- **Impact:** Any render throw whitescreens the app.

#### Issue #109: Reset password hardcodes “5 minutes”
- **File Location:** `ResetPasswordScreen.tsx`; Forgot uses `expiresInSeconds` but does not pass it
- **Category:** API Mismatch
- **Root Cause:** Copy not driven by API.
- **Impact:** Wrong expiry if server config changes.

#### Issue #110: Onboarding error alert uses raw `error.message`
- **File Location:** `OnboardingScreen.tsx` (Lines 61–65)
- **Category:** Missing error states
- **Root Cause:** Not `toUserFacingAuthMessage`.
- **Impact:** Non-user-facing strings.

#### Issue #111: `completeOnboarding` does not invalidate languages queries
- **File Location:** `useOnboarding.ts`
- **Category:** Architecture
- **Root Cause:** Only `setQueryData` on profile.me.
- **Impact:** Language Preferences may be stale for one mount.

#### Issue #112: Logger does not redact `challengeId`
- **File Location:** `logger.ts`
- **Category:** Security
- **Root Cause:** Redacts `token` but not reset challenge ids.
- **Impact:** Reset challenges in device logs.

---

### 🟡 Low Severity Issues

#### Issue #113: `AuthField` duplicates light/dark styles
- **File Location:** `AuthField.tsx`
- **Category:** Architecture
- **Root Cause:** Near-duplicate style trees.
- **Impact:** Maintenance cost.

#### Issue #114: `AuthBackdrop` `variant` prop unused
- **File Location:** `AuthBackdrop.tsx`
- **Category:** Architecture
- **Root Cause:** Prop accepted, unused.
- **Impact:** Dead API.

#### Issue #115: `authFormStyles` title forces colors that fight light `tone`
- **File Location:** `authFormStyles.ts`
- **Category:** Architecture
- **Root Cause:** Forgot/Reset mix copy colors and dark-oriented banners.
- **Impact:** Contrast glitches.

#### Issue #116: `maskEmail` keeps full domain
- **File Location:** `logger.ts`
- **Category:** Security
- **Root Cause:** Local part truncated; domain intact.
- **Impact:** Identifying in logs.

#### Issue #117: FEATURES: AuthProvider “may refresh / load me” on login
- **File Location:** `FEATURES.md` (Line 151); `AuthProvider.signIn` uses session body only
- **Category:** Spec Gap
- **Root Cause:** Login does not call getMe.
- **Impact:** Doc only.

#### Issue #118: Weak tests for refresh failure, Root gate error, SecureStore failure
- **File Location:** `AuthProvider.test.ts`, `apiClient.test.ts`
- **Category:** Architecture
- **Root Cause:** Missing coverage for #2, #3, #14.
- **Impact:** Regressions land.

#### Issue #119: `isApiError` uses `instanceof`
- **File Location:** `errors.ts` (Lines 70–72)
- **Category:** Crash
- **Root Cause:** Breaks across realms/bundles.
- **Impact:** Network errors treated as unknown.

#### Issue #120: POST retry after 401 can double-submit
- **File Location:** `apiClient.ts` (Lines 349–353)
- **Category:** Architecture
- **Root Cause:** Non-idempotent POST replayed after refresh if server already processed.
- **Impact:** Rare duplicate requests.

#### Issue #121: Main navigator deprecated `UserPreview` alias
- **File Location:** `MainNavigator.tsx`; `navigation/types.ts`
- **Category:** Architecture
- **Root Cause:** Alias of PublicProfile.
- **Impact:** Fine; clutter.

#### Issue #122: Welcome assets preload errors swallowed
- **File Location:** `welcomeAssets.ts`; `RootNavigator.tsx` (Lines 31–34)
- **Category:** Performance
- **Root Cause:** `.finally` marks ready anyway.
- **Impact:** Ready with missing images. Acceptable.

#### Issue #123: chat `index.ts` missing documented aliases
- **File Location:** `features/chat/index.ts`; FEATURES §10
- **Category:** Spec Gap
- **Root Cause:** No `ConversationScreen` / `ChatScreen` exports.
- **Impact:** Import confusion.

#### Issue #124: No pull-to-refresh on thread
- **File Location:** `ChatDetailScreen.tsx`
- **Category:** Spec Gap
- **Root Cause:** Only `onEndReached` pagination.
- **Impact:** Hard to recover #28.

#### Issue #125: Thread uses spinner, not skeleton
- **File Location:** `ChatDetailScreen.tsx` (Lines 162–163)
- **Category:** Spec Gap
- **Root Cause:** Inbox has `ChatListSkeleton`; thread does not.
- **Impact:** Weaker loading UX.

#### Issue #126: `isUploadedMediaUrl` treats any `http(s)` as uploaded
- **File Location:** `lib/mediaUrl.ts`
- **Category:** Architecture
- **Root Cause:** Skips upload if content already absolute.
- **Impact:** Usually OK; skips upload for attacker-controlled absolute URL in a draft.

#### Issue #127: Composer not disabled while offline
- **File Location:** `ChatDetailScreen` / `ChatInput`
- **Category:** Spec Gap
- **Root Cause:** Optimistic send then fail alert.
- **Impact:** Acceptable if retry works.

#### Issue #128: Native audio/video: one player per visible bubble
- **File Location:** `ChatMedia.native.tsx`
- **Category:** Performance
- **Root Cause:** No shared player / play-one-at-a-time.
- **Impact:** Heavy on long threads.

#### Issue #129: Rate-limited typing pulses
- **File Location:** `ChatInput` + backend typing limiter
- **Category:** Race
- **Root Cause:** Pulses dropped under load.
- **Impact:** Partner typing flickers.

#### Issue #130: `markedRead` tied to `pages.length` only
- **File Location:** `useMessages.ts` (Lines 130–134)
- **Category:** Race
- **Root Cause:** Will not re-mark on refetch of same page count.
- **Impact:** Mitigated by per-`message_new` markRead.

#### Issue #131: No message search / reactions / edit / delete
- **Category:** Spec Gap
- **Root Cause:** Not in FEATURES live screens.
- **Impact:** Fine unless product requires them.

#### Issue #132: Dead `getUserPreview` documentation
- **File Location:** `FEATURES.md` (Line 459)
- **Category:** Spec Gap
- **Root Cause:** Live UI uses `getPublicProfile`.
- **Impact:** Doc noise.

#### Issue #133: Unfiltered Discover empty state has no CTA
- **File Location:** `DiscoveryEmptyState.tsx`
- **Category:** Missing UI
- **Root Cause:** Romanian title, no body, no “Edit profile” action.
- **Impact:** Dead-end empty feed (also caused by #7).

#### Issue #134: No mutation success toasts except request modal
- **File Location:** accept/decline paths
- **Category:** Missing UI
- **Root Cause:** Silent success.
- **Impact:** Weak feedback.

#### Issue #135: `SettingsRow` unused `onPress`
- **File Location:** `SettingsRow.tsx`
- **Category:** Architecture
- **Root Cause:** Prop declared, parent wraps Pressable.
- **Impact:** Confusing API.

#### Issue #136: PublicProfile deprecated comment incomplete
- **File Location:** `PublicProfileScreen.tsx`
- **Category:** Architecture
- **Root Cause:** Comment without alias export.
- **Impact:** None.

#### Issue #137: Optional `connectionStatus` on DiscoverUser
- **File Location:** `discovery/types.ts` (Lines 22–23)
- **Category:** Type mismatch
- **Root Cause:** Backend always sends it; UI treats undefined as Send Request.
- **Impact:** Wrong CTAs if API omits field.

#### Issue #138: `age: 0` treated as missing
- **File Location:** `UserDiscoveryCard.tsx` (Line 134)
- **Category:** Logic
- **Root Cause:** Falsy check. Invalid given min 13.
- **Impact:** None in practice.

#### Issue #139: FilterBottomSheet country FlatList may lack flex
- **File Location:** `FilterBottomSheet.tsx`
- **Category:** UI
- **Root Cause:** List inside maxHeight sheet without `flex: 1`.
- **Impact:** Incomplete scroll on some devices.

#### Issue #140: `useDiscovery` refresh truncates to page 1 then refetches
- **File Location:** `useDiscovery.ts`
- **Category:** Performance
- **Root Cause:** Brief stale cards during PTR.
- **Impact:** Flicker.

#### Issue #141: No unblock / report-history UI
- **File Location:** Settings + safety
- **Category:** Spec Gap
- **Root Cause:** Block exists; no list.
- **Impact:** Permanent block with no in-app recovery.

#### Issue #142: Report reasons English-only (OK until i18n)
- **File Location:** `safety/types.ts`; matches backend `REPORT_REASONS`
- **Category:** Spec Gap
- **Root Cause:** Hardcoded.
- **Impact:** Fine.

#### Issue #143: matching backend stub unused
- **File Location:** `backend/.../matching/service.ts`; no FE calls
- **Category:** Spec Gap
- **Root Cause:** 501 by design.
- **Impact:** Confusion if someone wires it.

#### Issue #144: `GET /languages` is public
- **File Location:** backend `languages/routes.ts`
- **Category:** Security
- **Root Cause:** Intentional catalog.
- **Impact:** Scrapable ISO list. Acceptable.

#### Issue #145: Profile skeleton still has bone for removed Discover switch
- **File Location:** `ProfileSkeleton.tsx`
- **Category:** Spec Gap
- **Root Cause:** Loading layout mismatch.
- **Impact:** Visual only.

#### Issue #146: `usePutMeProfile` does not invalidate public self cache
- **File Location:** `useProfile.ts`
- **Category:** Architecture
- **Root Cause:** After #6 is fixed, preview could be stale.
- **Impact:** Stale self-preview.

#### Issue #147: Two write paths for languages
- **File Location:** Preferences `PUT /users/me/languages`; Edit `PUT /users/me/profile`
- **Category:** Architecture
- **Root Cause:** Dual sources of truth.
- **Impact:** Usually OK with invalidation.

#### Issue #148: `Screen` always transparent background
- **File Location:** `Screen.tsx` (Line 20)
- **Category:** Architecture
- **Root Cause:** Relies on `AmbientBackground` behind everything.
- **Impact:** Fine; screens without mosaic would flash.

#### Issue #149: `queryClient` default `staleTime: 30s` vs chat `10s`/`15s`
- **File Location:** `queryClient.ts`; chat hooks override
- **Category:** Architecture
- **Root Cause:** Inconsistent freshness.
- **Impact:** Low.

#### Issue #150: No health check / offline banner
- **File Location:** app shell
- **Category:** Spec Gap
- **Root Cause:** Socket status shown only on Chats. Other tabs have no offline chrome.
- **Impact:** Discover/profile fail with generic errors.

**Count note:** `#1`–`#12` Critical, `#13`–`#40` High, `#41`–`#112` Medium, `#113`–`#150` Low. **Total: 150 unique findings.**

---

## 5. Fixes, Refactored Boilerplate & Solutions

*Production-ready patches for every major issue / anti-pattern. Apply in the order listed. Copy-paste into the named files; keep existing exports and call sites.*

### Solution for Issue #3 — Never treat me-query error as onboarding-incomplete

- **Problem File:** `frontend/client/src/navigation/RootNavigator.tsx`
- **Explanation of Fix:** Branch loading / error / completed / incomplete explicitly. Add a retry surface so a 5xx cannot force Onboarding.

- **Refactored Code Fix:**

```tsx
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "@/features/auth";
import { preloadWelcomeAssets } from "@/features/auth/welcomeAssets";
import { OnboardingScreen, useCurrentUser } from "@/features/onboarding";
import { SplashScreen } from "@/features/splash";
import { WarmEmptyState } from "@/shared/components/WarmEmptyState";
import { WarmLoadingView } from "@/shared/components/WarmLoadingView";
import { navigationThemeFor, useColors, useThemeScheme } from "@/shared/theme";

import { AuthNavigator } from "./AuthNavigator";
import { MainNavigator } from "./MainNavigator";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isSignedIn, isInitialized } = useAuth();
  const colors = useColors();
  const scheme = useThemeScheme();
  const [splashDone, setSplashDone] = useState(false);
  const [welcomeAssetsReady, setWelcomeAssetsReady] = useState(false);
  const meQuery = useCurrentUser(isSignedIn && splashDone);
  const onboardingCompleted = meQuery.data?.onboardingCompleted === true;

  useEffect(() => {
    let cancelled = false;
    void preloadWelcomeAssets().finally(() => {
      if (!cancelled) setWelcomeAssetsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSplashComplete = useCallback(() => {
    setSplashDone(true);
  }, []);

  const splashReady = isInitialized && welcomeAssetsReady;

  if (!splashDone) {
    return <SplashScreen isReady={splashReady} onComplete={handleSplashComplete} />;
  }

  return (
    <NavigationContainer theme={navigationThemeFor(scheme, colors)}>
      {isSignedIn && meQuery.isLoading ? (
        <View style={styles.loading}>
          <WarmLoadingView
            accessibilityLabel="Loading your account"
            status="Loading your account..."
          />
        </View>
      ) : isSignedIn && meQuery.isError && !meQuery.data ? (
        <View style={styles.loading}>
          <WarmEmptyState
            title="Could not load your account"
            body="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => {
              void meQuery.refetch();
            }}
          />
        </View>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false }}>
          {isSignedIn ? (
            onboardingCompleted ? (
              <Stack.Screen name="App" component={MainNavigator} />
            ) : (
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            )
          ) : (
            <Stack.Screen name="Auth" component={AuthNavigator} />
          )}
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
});
```

If you prefer the documented `WarmErrorState`, add `frontend/client/src/shared/components/WarmErrorState.tsx` as a thin wrapper around `WarmEmptyState` with the same props.

---

### Solution for Issues #2, #21, #56 — Fail persistence loudly; split preference storage

- **Problem File:** `frontend/client/src/lib/storage.ts`
- **Explanation of Fix:** `set` must throw after cleanup. Export a **preferences** adapter that is never SecureStore. Theme and UI flags use that.

- **Refactored Code Fix:** replace `secureStorage.set` catch and the exports at the bottom of `storage.ts`:

```ts
  async set(key: string, value: string): Promise<void> {
    await deleteSecureItem(key);

    const chunks = splitUtf8(value, MAX_BYTES);

    try {
      if (chunks.length === 1) {
        await SecureStore.setItemAsync(key, chunks[0]!);
        return;
      }

      await Promise.all(
        chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, index), chunk)),
      );
      await SecureStore.setItemAsync(key, `${CHUNK_PREFIX}${chunks.length}`);
    } catch (error) {
      log.warn("storage", "secure set failed", {
        key,
        message: error instanceof Error ? error.message : "unknown",
      });
      await deleteSecureItem(key);
      throw error instanceof Error ? error : new Error("Failed to persist secure storage");
    }
  },
```

```ts
const secureAuthStorage = Platform.OS === "web" ? webStorage : secureStorage;
const preferencesStorage = webStorage;

export const storage = Platform.OS === "web" ? preferencesStorage : secureAuthStorage;
export { preferencesStorage };
```

Then in `ThemeProvider.tsx`:

```ts
import { preferencesStorage } from "@/lib/storage";
// replace storage.get / storage.set with preferencesStorage.get / preferencesStorage.set
```

And in `AuthProvider.persistSession`, allow the throw so sign-in fails if tokens cannot be stored (do not catch inside persist).

---

### Solution for Issues #4, #41 — Default request timeout + AbortSignal

- **Problem File:** `frontend/client/src/lib/apiClient.ts`
- **Explanation of Fix:** Every `fetch` gets a 15s timeout merged with the caller’s signal. Validate refresh JSON before persisting.

- **Refactored Code Fix:**

```ts
const DEFAULT_TIMEOUT_MS = 15_000;

function mergeSignal(userSignal: AbortSignal | undefined, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onAbort = () => controller.abort();
  userSignal?.addEventListener("abort", onAbort);

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      userSignal?.removeEventListener("abort", onAbort);
    },
  };
}

function isUsableTokenPair(data: unknown): data is { accessToken: string; refreshToken: string } {
  if (!data || typeof data !== "object") return false;
  const record = data as { accessToken?: unknown; refreshToken?: unknown };
  return (
    typeof record.accessToken === "string" &&
    record.accessToken.length > 0 &&
    typeof record.refreshToken === "string" &&
    record.refreshToken.length > 0
  );
}
```

Use `mergeSignal` around the `fetch` in `request` and in `refreshAccessToken`. After `response.json()`:

```ts
      const data: unknown = await response.json();
      if (!isUsableTokenPair(data)) {
        log.warn("api", "token refresh returned invalid body");
        return false;
      }
      await authHandlers.onTokensRefreshed({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
```

Also skip retries on 401 in `queryClient.ts`:

```ts
import { QueryClient } from "@tanstack/react-query";

import { isApiError } from "./api/errors";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (count, error) => {
        if (isApiError(error) && (error.isUnauthorized || error.status === 403)) {
          return false;
        }
        return count < 1;
      },
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});
```

---

### Solution for Issues #10, #15, #25, #62 — Live socket auth + emit timeout

- **Problem File:** `frontend/client/src/lib/socket.ts` and `SocketProvider.tsx`
- **Explanation of Fix:** Never assign a static `auth` object. Prefer in-memory token. Time out emits so HTTP fallback can run.

- **Refactored Code Fix:**

```ts
// lib/socket.ts
import { io, type Socket } from "socket.io-client";

import { authStorage } from "@/features/auth/authStorage";
import { API_BASE_URL } from "@/lib/apiClient";

let socket: Socket | null = null;
let getAccessToken: () => string | null = () => null;

export function configureSocketAuth(getter: () => string | null) {
  getAccessToken = getter;
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: true,
      timeout: 8000,
      auth: (cb) => {
        const memory = getAccessToken();
        if (memory) {
          cb({ token: memory });
          return;
        }
        void authStorage.getTokens().then((tokens) => {
          cb(tokens?.accessToken ? { token: tokens.accessToken } : {});
        });
      },
    });
  }
  return socket;
}

export async function connectSocket(): Promise<Socket> {
  const instance = getSocket();
  if (instance.connected) return instance;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Socket connect timed out"));
    }, 10_000);

    const onConnect = () => {
      cleanup();
      resolve(instance);
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      clearTimeout(timeout);
      instance.off("connect", onConnect);
      instance.off("connect_error", onError);
    };

    instance.once("connect", onConnect);
    instance.once("connect_error", onError);
    instance.connect();
  });
}

export function resetSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
```

In `AuthProvider` `configureApiAuth` effect, also call `configureSocketAuth(() => accessTokenRef.current)`.

In `SocketProvider.emit`:

```ts
  const emit = useCallback(<T = unknown,>(event: string, payload?: unknown) => {
    return new Promise<T>((resolve, reject) => {
      const current = getSocket();
      if (!current.connected) {
        reject(new Error("Socket is not connected"));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error("Socket ack timed out"));
      }, 8_000);

      current.emit(event, payload, (response: T & { ok?: boolean; error?: string }) => {
        clearTimeout(timeout);
        if (response && typeof response === "object" && "ok" in response && response.ok === false) {
          reject(new Error(response.error ?? "Socket request failed"));
          return;
        }
        resolve(response);
      });
    });
  }, []);
```

On `onConnect`, invalidate chat queries:

```ts
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";

// inside onConnect:
void queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations });
void queryClient.invalidateQueries({ queryKey: ["chat", "messages"] });
```

---

### Solution for Issues #9, #11, #29 — Dedupe by `clientMessageId`; do not rewrite lastMessage from status

- **Problem File:** `frontend/client/src/features/chat/cache.ts`
- **Explanation of Fix:** Match optimistic rows on `clientMessageId` / `replaceLocalId` only. When a server id lands, purge leftover local ids. Inbox status patches ticks on the matching last message only.

- **Refactored Code Fix:**

```ts
import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

import { isLocalMessageId } from "./model/clientMessageId";
import type { ChatMessage, Conversation, LocalSendState, OnlineStatus } from "./types";

export { isLocalMessageId } from "./model/clientMessageId";

type MessagesCache = {
  pages: Array<{
    items: ChatMessage[];
    nextCursor?: string | null;
    hasMore?: boolean;
    limit?: number;
    page?: number;
  }>;
  pageParams: unknown[];
};

function sameClientId(item: ChatMessage, message: ChatMessage, replaceLocalId?: string) {
  if (replaceLocalId && item.id === replaceLocalId) return true;
  const incoming = message.clientMessageId ?? (isLocalMessageId(message.id) ? message.id : null);
  if (!incoming) return false;
  return item.clientMessageId === incoming || item.id === incoming;
}

export function upsertMessageInCache(
  queryClient: QueryClient,
  conversationId: string,
  message: ChatMessage,
  replaceLocalId?: string,
) {
  queryClient.setQueryData<MessagesCache>(queryKeys.chat.messages(conversationId), (current) => {
    if (!current?.pages.length) {
      return {
        pages: [{ items: [message], hasMore: false, limit: 30 }],
        pageParams: [undefined],
      };
    }

    const alreadyHasId = current.pages.some((page) =>
      page.items.some((item) => item.id === message.id),
    );

    const localId = current.pages
      .flatMap((page) => page.items)
      .find((item) => isLocalMessageId(item.id) && sameClientId(item, message, replaceLocalId))?.id;

    return {
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        items: page.items
          .filter((item) => {
            if (alreadyHasId && isLocalMessageId(item.id) && sameClientId(item, message, replaceLocalId)) {
              return false;
            }
            return true;
          })
          .map((item) => {
            if (item.id === message.id) return { ...item, ...message, localState: undefined };
            if (localId && item.id === localId) return { ...message, localState: undefined };
            return item;
          }),
      })),
    };
  });

  if (
    !queryClient
      .getQueryData<MessagesCache>(queryKeys.chat.messages(conversationId))
      ?.pages.some((page) => page.items.some((item) => item.id === message.id || item.id === localPlaceholder(message, replaceLocalId)))
  ) {
    queryClient.setQueryData<MessagesCache>(queryKeys.chat.messages(conversationId), (current) => {
      if (!current?.pages.length) {
        return {
          pages: [{ items: [message], hasMore: false, limit: 30 }],
          pageParams: [undefined],
        };
      }
      const has = current.pages.some((page) =>
        page.items.some((item) => item.id === message.id || (localId && item.id === localId)),
      );
      if (has) return current;
      const [first, ...rest] = current.pages;
      return {
        ...current,
        pages: [{ ...first!, items: [...first!.items, message] }, ...rest],
      };
    });
  }
}

function localPlaceholder(message: ChatMessage, replaceLocalId?: string) {
  return replaceLocalId ?? message.clientMessageId ?? message.id;
}
```

The append-if-missing block above is intentionally conservative. A cleaner single-pass version:

```ts
export function upsertMessageInCache(
  queryClient: QueryClient,
  conversationId: string,
  message: ChatMessage,
  replaceLocalId?: string,
) {
  queryClient.setQueryData<MessagesCache>(queryKeys.chat.messages(conversationId), (current) => {
    if (!current?.pages.length) {
      return {
        pages: [{ items: [message], hasMore: false, limit: 30 }],
        pageParams: [undefined],
      };
    }

    let replaced = false;
    const pages = current.pages.map((page) => ({
      ...page,
      items: page.items.reduce<ChatMessage[]>((acc, item) => {
        const isServerMatch = item.id === message.id;
        const isLocalMatch =
          isLocalMessageId(item.id) && sameClientId(item, message, replaceLocalId);

        if (isServerMatch || isLocalMatch) {
          if (!replaced) {
            acc.push({ ...message, localState: undefined });
            replaced = true;
          }
          return acc;
        }
        acc.push(item);
        return acc;
      }, []),
    }));

    if (!replaced) {
      const [first, ...rest] = pages;
      return {
        ...current,
        pages: [{ ...first!, items: [...first!.items, message] }, ...rest],
      };
    }

    return { ...current, pages };
  });
}
```

`patchConversationWithMessage` — only replace lastMessage when the incoming row is that last message **or newer**:

```ts
export function patchConversationWithMessage(
  queryClient: QueryClient,
  message: ChatMessage,
  viewerId?: string | null,
  options?: { statusOnly?: boolean },
) {
  queryClient.setQueryData<Conversation[]>(queryKeys.chat.conversations, (current) => {
    if (!current) return current;

    return current
      .map((conversation) => {
        if (conversation.id !== message.conversationId) return conversation;

        const last = conversation.lastMessage;
        const isSameLast = last?.id === message.id;
        const isNewer =
          !last ||
          message.createdAt > last.createdAt ||
          (isLocalMessageId(last.id) && last.clientMessageId === message.clientMessageId);

        if (options?.statusOnly && !isSameLast) {
          return conversation;
        }

        if (!options?.statusOnly && !isNewer && !isSameLast) {
          return conversation;
        }

        const fromOther = Boolean(viewerId && message.senderId !== viewerId);
        const shouldReplacePreview = isSameLast || isNewer;

        return {
          ...conversation,
          lastMessage: shouldReplacePreview ? { ...message, localState: undefined } : last,
          lastMessageAt: shouldReplacePreview ? message.createdAt : conversation.lastMessageAt,
          updatedAt: shouldReplacePreview ? message.createdAt : conversation.updatedAt,
          unreadCount:
            isSameLast || !fromOther || options?.statusOnly
              ? conversation.unreadCount
              : conversation.unreadCount + 1,
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  });
}
```

In `useConversations.ts` status handler:

```ts
    const onStatus = (payload: { conversationId: string; messages: ChatMessage[] }) => {
      for (const message of payload.messages) {
        patchConversationWithMessage(queryClient, message, userId, { statusOnly: true });
      }
    };
```

Also listen globally:

```ts
socket.on("message_error", (payload: { error?: string }) => {
  log.warn("socket", "message_error", payload);
});
```

---

### Solution for Issue #12 + #79 — Newest-first inverted pages + stable keys

- **Problem File:** `frontend/client/src/features/chat/screens/ChatDetailScreen.tsx`
- **Explanation of Fix:** Each page is ascending; pages[0] is newest. For an inverted list, reverse **inside** each page, then concatenate.

- **Refactored Code Fix:**

```tsx
  const invertedMessages = useMemo(() => {
    const pages = messagesQuery.data?.pages ?? [];
    return pages.flatMap((page) => [...page.items].reverse());
  }, [messagesQuery.data]);
```

```tsx
              keyExtractor={(item) => item.clientMessageId ?? item.id}
              removeClippedSubviews={Platform.OS === "android"}
```

---

### Solution for Issues #6, #99 — Self preview without hitting public-profile

- **Problem File:** `ProfileScreen.tsx` + `PublicProfileScreen.tsx`
- **Explanation of Fix:** Do not call `GET /users/:id/public-profile` for self. Either navigate to a dedicated preview that renders `useProfile()` with public layout and **hides** Connect/Block, or pass `{ userId, previewSelf: true }` and short-circuit the query.

Minimal change in `PublicProfileScreen` query:

```ts
const { userId } = route.params;
const { user: me } = useAuth();
const isSelf = me?.id === userId;
const meQuery = useProfile();
const publicQuery = usePublicProfile(userId, { enabled: !isSelf });
const profile = isSelf ? mapMeToPublicLayout(meQuery.data) : publicQuery.data;
```

Hide `BlockReportMenu` and connection CTAs when `isSelf`. Map `/users/me` fields to the public layout (avatar, languages, bio, goals). Do **not** show email.

---

### Solution for Issues #7, #23, #96 — Collect country + age so users become discoverable

- **Problem File:** `OnboardingScreen.tsx` (and optionally Edit Profile)
- **Explanation of Fix:** Backend already accepts `country`, `age` / `dateOfBirth` on onboarding. Discovery requires them. Add CountryPicker + age (or DOB) to the live onboarding payload. Require one NATIVE in spoken.

Because `PUT /users/me/profile` **cannot** set age, onboarding (or a new backend field) is the only recovery path today. Prefer DOB (`YYYY-MM-DD`) so age stays consistent.

- **Refactored Code Fix:** (additive to `OnboardingScreen` — keep `LanguageSetupSections`)

```tsx
import { CountryPicker } from "@/features/onboarding/components/CountryPicker";

// state
const [country, setCountry] = useState("");
const [dateOfBirth, setDateOfBirth] = useState(""); // YYYY-MM-DD from a date field

const hasNative = spokenLanguages.some((item) => item.proficiency === "NATIVE");
const canContinue =
  spokenLanguages.length > 0 &&
  learningLanguages.length > 0 &&
  hasNative &&
  country.trim().length >= 2 &&
  /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth);

completeOnboarding.mutate({
  displayName: user?.displayName,
  spokenLanguages,
  learningLanguages,
  country: country.trim(),
  dateOfBirth,
});
```

Also cap register displayName at 50 and min 2 in `validation.ts` so Issue #5/#24 cannot happen:

```ts
function validateDisplayName(displayName: string): string | undefined {
  const value = displayName.trim();
  if (!value) return "Display name is required.";
  if (value.length < 2) return "Display name must be at least 2 characters.";
  if (value.length > 50) return "Display name is too long.";
  return undefined;
}

export function validateRegisterPassword(password: string): string | undefined {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 128) return "Password is too long.";
  if (password.includes("\u0000")) return "Password contains invalid characters.";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include at least one letter and one number.";
  }
  return undefined;
}
```

Until age exists on `PUT /users/me/profile`, add a backend field **or** keep DOB on onboarding only and document that age is immutable. Product should still add DOB to Edit Profile via a backend schema change.

---

### Solution for Issues #8, #37 — Upload avatar via `/media/uploads`; send `null` to clear

- **Problem File:** `ProfilePhotoPicker.tsx` + `EditProfileScreen.tsx`
- **Explanation of Fix:** Never send `data:` or `file://`. Upload the file with the existing `uploadChatFile` helper (or a dedicated `uploadAvatar`), persist the returned `/media/...` URL. On Remove, submit `avatarUrl: null`.

- **Refactored Code Fix:**

```tsx
// ProfilePhotoPicker.tsx — stop requesting base64
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: false,
    });
    // onChange(asset.uri) — local preview only
```

```tsx
// EditProfileScreen onSubmit
import { uploadChatFile } from "@/features/chat/api/chatApi";
import { isUploadedMediaUrl } from "@/lib/mediaUrl";

    save.mutate(
      {
        displayName: values.displayName.trim(),
        bio: values.bio.trim(),
        country: values.country.trim(),
        avatarUrl: await resolveAvatarForSubmit(values.avatarUrl),
        practiceGoals: values.practiceGoals,
        spokenLanguages: values.spokenLanguages,
        learningLanguages: values.learningLanguages,
      },
      // ...
    );

async function resolveAvatarForSubmit(value: string | undefined): Promise<string | null | undefined> {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (isUploadedMediaUrl(trimmed) || trimmed.startsWith("/media/")) return trimmed;
  const uploaded = await uploadChatFile(trimmed, "image/jpeg", "avatar.jpg");
  return uploaded.url;
}
```

`editProfileSchema.avatarUrl` should allow empty string (cleared). Submit maps empty → `null`.

---

### Solution for Issues #33, #27 — Discover Message + inbox pagination

- **Problem File:** backend `discovery/dto.ts` (preferred) **or** frontend fallback
- **Explanation of Fix:** Best fix is adding `conversationId` to the discover DTO when status is ACCEPTED (same lookup connections already do). Frontend fallback: navigate to chat by resolving from the conversations cache, or open Public Profile only if still missing.

Frontend-only fallback in `DiscoverScreen`:

```ts
        case "message": {
          if (user.conversationId) {
            navigation.navigate("Conversation", { conversationId: user.conversationId });
            return;
          }
          const conversations = queryClient.getQueryData<Conversation[]>(queryKeys.chat.conversations);
          const match = conversations?.find((item) => item.otherUser.id === user.id);
          if (match) {
            navigation.navigate("Conversation", { conversationId: match.id });
            return;
          }
          openPublicProfile(user.id);
          return;
        }
```

Keep `getConversations` page-shaped:

```ts
export function getConversations(opts: RequestOpts = {}) {
  return apiClient.get<ConversationsPage>("/conversations?limit=50", { signal: opts.signal });
}
```

Then convert `useConversations` to `useInfiniteQuery` using `nextCursor` / `hasMore`. Until that lands, request `limit=50` (backend max) to reduce the cap.

---

### Solution for Issues #34, #35, #104 — Password parity + mutation errors

- **Problem File:** `SettingsScreen.tsx` + connection screens
- **Explanation of Fix:** Reuse `validateRegisterPassword`. Always pass `onError` to connection mutates. Clear password fields on close.

```ts
  const submitPassword = () => {
    const passwordError = validateRegisterPassword(newPassword);
    if (passwordError) {
      Alert.alert("Password", passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords do not match", "Check the confirmation field.");
      return;
    }
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setPasswordOpen(false);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          Alert.alert("Password updated", "Your password has been changed.");
        },
        onError: (error) =>
          Alert.alert(
            "Could not change password",
            isApiError(error) ? error.message : "Check your current password.",
          ),
      },
    );
  };

  const closePassword = () => {
    setPasswordOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };
```

Shared connection error helper:

```ts
function alertConnectionError(error: unknown) {
  Alert.alert(
    "Could not update connection",
    isApiError(error) ? error.message : "Check your connection and try again.",
  );
}

// usage
accept.mutate(user.connectionId, { onError: alertConnectionError });
```

---

### Solution for Issue #1 — Web token storage (architecture)

- **Problem File:** `storage.ts` / future cookie auth
- **Explanation of Fix:** Do **not** treat localStorage as acceptable for production web. Short-term: keep access token in memory only; persist refresh only if you accept XSS risk. Production: backend sets refresh as `HttpOnly; Secure; SameSite=Strict` cookie; `apiClient` uses `credentials: "include"` on `/auth/refresh`; native keeps SecureStore.

This requires a backend cookie session path. Until then, gate the web build:

```ts
if (Platform.OS === "web" && !__DEV__) {
  log.warn("auth", "web localStorage tokens are not production-safe");
}
```

Fail the production web build if cookie auth is not enabled. Document in FEATURES.

---

### Solution for Issues #31, #66, #68, #93 — Small but high-leverage patches

**Hide Translate until there is text to translate** (`MessageBubble.tsx`):

```tsx
          {message.type === "VOICE" || message.type === "VIDEO" ? (
            <Pressable onPress={() => void run("transcribe")} disabled={busy !== null}>
              <Text style={[styles.action, { color: colors.accent }]}>
                {busy === "transcribe" ? "Transcribing…" : message.transcript ? "Transcribed" : "Transcribe"}
              </Text>
            </Pressable>
          ) : null}
          {(message.type === "TEXT" || message.caption || message.transcript) &&
          (message.type !== "IMAGE" || Boolean(message.caption)) ? (
            <Pressable onPress={() => void run("translate")} disabled={busy !== null}>
              <Text style={[styles.action, { color: colors.accent }]}>
                {busy === "translate" ? "Translating…" : message.translatedContent ? "Translated" : "Translate"}
              </Text>
            </Pressable>
          ) : null}
```

**Stop typing on unmount** (`ChatInput.tsx`):

```tsx
  useEffect(() => {
    return () => {
      clearTimers();
      onTypingChange?.(false);
    };
  }, [onTypingChange]);
```

**Web audio cleanup** (`ChatMedia.tsx`):

```tsx
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [src]);
```

**Dark theme:** replace `import { lightColors as colors }` with `const colors = useColors();` in every file listed in Issue #93. Do this mechanically; do not leave `lightColors` aliases in feature screens.

**Presence honesty:** remove the green dot on Discover/Connections until a real `onlineStatus` field exists, or bind it only when the API provides it.

**Romanian copy:**

```ts
Alert.alert("Profile updated", "Your changes are live.", ...);
// DiscoveryEmptyState title:
"Ready to practice. Start your first conversation!"
```

**Error boundary** wrap in `main.tsx`:

```tsx
import { ErrorBoundary } from "react-error-boundary";

<ErrorBoundary
  fallbackRender={({ resetErrorBoundary }) => (
    <WarmEmptyState
      title="Something went wrong"
      body="The app hit an unexpected error."
      actionLabel="Reload"
      onAction={resetErrorBoundary}
    />
  )}
>
  <RootNavigator />
</ErrorBoundary>
```

If you do not want a new dependency, a 20-line class component with `componentDidCatch` is enough.

---

### Grouped pattern: native language + one proficiency catalog

Share one module (already exists: `features/languages/model/proficiency.ts`) in:

- `onboarding/constants.ts` `PROFICIENCY_OPTIONS`
- `discovery/utils.ts` filter chips
- `LanguageLevelList`
- `editProfileSchema` max counts + `.refine` at most one `NATIVE`

```ts
.superRefine((value, ctx) => {
  const nativeCount = value.spokenLanguages.filter((item) => item.proficiency === "NATIVE").length;
  if (nativeCount > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["spokenLanguages"],
      message: "Choose at most one native language",
    });
  }
  if (value.spokenLanguages.length > 10) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["spokenLanguages"], message: "At most 10 spoken languages" });
  }
  if (value.learningLanguages.length > 5) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["learningLanguages"], message: "At most 5 learning languages" });
  }
})
```

Debounce language preference PUTs (Issue #38) with a 400ms trailing debounce in `LanguagePreferencesScreen` instead of firing on every chip tap.

---

### FEATURES.md corrections (docs-only, required for spec parity)

Update `frontend/FEATURES.md`:

1. Remove or mark **deferred**: Discover visibility toggle, `preferenceStorage.ts` until implemented, `WarmErrorState` until added, Dev reset code, `getUserPreview`, ConversationScreen aliases, clientMessageId “pending uniqueness”.
2. Document live socket emits: `join_conversation`, `message_read`; listen `message_error`.
3. Onboarding: languages only **today**; country + DOB **required for Discover** — call that out until Issue #7 is fixed.
4. Profile preview: currently broken against public-profile self-ban.
5. AbortSignal: “callers may pass signal; default timeout TBD” until #4 ships.

---

### Recommended fix order (production)

1. RootNavigator me-error gate (#3)
2. Age/country on onboarding → discoverability (#7)
3. Avatar upload via media API (#8, #37)
4. Self profile preview (#6)
5. Socket live auth + emit timeout + reconnect invalidate (#10, #25, #28)
6. Chat upsert by `clientMessageId` + inverted pages + inbox status (#9, #11, #12)
7. SecureStore throws + query 401 no-retry + refresh body validation (#2, #14, #16)
8. Discover `conversationId` + connection `onError` (#33, #35)
9. Password/displayName validation parity (#5, #24, #34)
10. Theme tokens, fake presence, Romanian copy, Error Boundary (#39, #93, #94, #108)

Until items 2–4 ship, **do not** treat Discover, Profile photo, or Preview profile as test-passed in QA. They fail on the real backend contract.
)
