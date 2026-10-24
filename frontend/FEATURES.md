# Sayly Frontend — Features & Screen Guide

> **Out of date:** the Connections tab, `features/connections/`, `ConnectionRequestModal` and the `/connections` endpoints described below were removed. People are now followed one-way (`features/follows/`, `PUT/DELETE /follows/:userId`), and the tabs are Community | Chats | Groups | Profile. Sections 7–8 and the Discover CTAs still describe the old flow; the rest is current.


Mobile client for the Sayly language-exchange app (React Native / Expo + TypeScript).

| | |
|---|---|
| **App root** | `frontend/client/` |
| **Live entry** | `frontend/client/index.ts` → `src/main.tsx` → `RootNavigator` |
| **Stack** | React Navigation, TanStack Query, Socket.IO client, Auth context, Zod forms where used |

> Partner discovery uses **Discover + Connections**, not a dating-style swipe flow.

---

## Navigation map

```
SplashScreen (gate, outside navigator)
└─ NavigationContainer (RootNavigator)
   ├─ Auth (signed out)
   │    Welcome → Login | SignUp | ForgotPassword → ResetPassword
   ├─ Onboarding (signed in && !onboardingCompleted)
   └─ App / MainNavigator (signed in && onboarding done)
        MainTabs: Discover (“Sayly”) | Connections | Chats | Profile
        Stack: PublicProfile | UserPreview* | Conversation | EditProfile
               | LanguagePreferences | Settings
```

\* `UserPreview` is a deprecated alias of `PublicProfile` (same screen component).

| File | Role |
|------|------|
| `src/navigation/RootNavigator.tsx` | Splash → Auth / Onboarding / App |
| `src/navigation/AuthNavigator.tsx` | Welcome, Login, SignUp, Forgot/Reset |
| `src/navigation/MainNavigator.tsx` | Tabs + stack screens |
| `src/navigation/types.ts` | Param lists |
| `src/navigation/floatingTabBar.tsx` | Floating tab bar styles + padding helper |
| `src/navigation/tabIcons.tsx` | Tab icons (Sayly brand + Ionicons) |

---

## Shared infrastructure

### Lib (`src/lib/`)

| File | Role |
|------|------|
| `apiClient.ts` | HTTP client; attaches access token; auto `POST /auth/refresh` (single-flight); default 15s AbortSignal timeout on requests; `get` / `post` / `put` / `patch` / `delete` / `postForm` |
| `api/errors.ts` | `ApiError`, user-facing auth error messages |
| `socket.ts` | Socket.IO singleton to `API_BASE_URL`; JWT in handshake; connect / disconnect / reset |
| `queryClient.ts` | TanStack Query client (default staleTime / retry) |
| `queryKeys.ts` | Central query key factories |
| `storage.ts` | Secure/native + web localStorage adapter for auth tokens |
| `preferenceStorage.ts` | Non-secret preference storage (theme, UI flags) — re-exports `preferencesStorage` from `storage.ts` |
| `logger.ts` | Structured client logging with recursive redaction |
| `mediaUrl.ts` | Resolve relative media URLs against API base |

### Shared UI (`src/shared/components/`)

| Component | File | Used for |
|-----------|------|----------|
| `Screen` | `Screen.tsx` | Safe-area screen shell |
| `Avatar` | `Avatar.tsx` | Circular photo / initials |
| `Button` | `Button.tsx` | Primary CTA |
| `PressableScale` | `PressableScale.tsx` | Press feedback |
| `WarmEmptyState` | `WarmEmptyState.tsx` | Empty states |
| `WarmErrorState` | `WarmErrorState.tsx` | Error + retry |
| `WarmLoadingView` | `WarmLoadingView.tsx` | Warm loading copy |
| `AmbientBackground` | `AmbientBackground.tsx` | App-wide mosaic background (`main.tsx`) |
| `SelectionMark` | `SelectionMark.tsx` | Shared radio/selection mark |
| `ModalSafeFrame` | `ModalSafeFrame.tsx` | Modal safe-area frame |

### Theme (`src/shared/theme/`)

Colors, spacing, radius, typography, `ThemeProvider`, light/dark/system scheme.

### Shared hooks / utils

| Path | Role |
|------|------|
| `src/shared/hooks/useDebounce.ts` | Debounced search input (Discover) |
| `src/shared/utils/withoutTextNodes.tsx` | Safe wrappers avoiding accidental text-node children |
| `src/shared/data/countries.ts` | ISO country list + flag helpers |

---

## Feature → API module map

| Feature folder | API module | Endpoints used |
|----------------|------------|----------------|
| `features/auth/` | `api/authApi.ts` | `POST /auth/login`, `/register`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`; `GET /auth/me` |
| `features/profile/` | `api/profileApi.ts` | `GET/PATCH /users/me`; `PUT /users/me/profile`; `GET /users/:id/public-profile`; `PUT /users/me/onboarding` |
| `features/onboarding/` | `api/onboardingApi.ts` | Re-exports profile onboarding + `getMe` |
| `features/discovery/` | `api/discoveryApi.ts` | `GET /discover`; `GET /discover/users/:id` (defined, unused by live PublicProfile) |
| `features/connections/` | `api/connectionsApi.ts` | `GET /connections/requests`; `POST /connections/request`; `PATCH .../accept\|decline\|cancel`; `DELETE /connections/:id` |
| `features/chat/` | `api/chatApi.ts` | `/conversations` inbox, messages, read, translate, transcribe; `POST /media/uploads` |
| `features/languages/` | `api/languagesApi.ts` | `GET /languages`; `GET/PUT/PATCH /users/me/languages` |
| `features/safety/` | `api/safetyApi.ts` | `POST /blocks`; `POST /reports`; `DELETE /users/me`; `PATCH /users/me/password` |
| `features/settings/` | (no dedicated API) | Uses safety + theme |
| `features/splash/` | none | Local splash only |

### Socket events (chat)

| Direction | Events |
|-----------|--------|
| Listen | `message_new`, `message_status`, `typing_start`, `typing_stop`, `user_online_status` |
| Emit | `send_message`, `typing_start`, `typing_stop` |

---

# Screens (live app)

---

## 0. Splash

| | |
|---|---|
| **Screen** | Splash |
| **File** | `features/splash/SplashScreen.tsx` (+ `SplashBackdrop.tsx` / mosaic) |
| **What you see** | Mosaic backdrop; pulsing rings; Sayly logo; title **“Sayly”**; subtitle **“Learn languages. Meet real people.”**; fades out when auth + welcome assets are ready (min ~2.8s) |
| **Endpoints** | None |
| **Hooks / logic** | Root waits on `useAuth().isInitialized` + `preloadWelcomeAssets()` |
| **Components** | `SaylyLogo` (`components/SaylyLogo`), mosaic backdrop, theme typography |
| **Navigation** | Calls `onComplete` → Root shows Auth / Onboarding / App |

After splash, if signed in and `GET /users/me` is still loading, Root shows `WarmLoadingView` (“Loading your account…”).

---

## 1. Welcome

| | |
|---|---|
| **Screen** | Welcome |
| **File** | `features/auth/screens/WelcomeScreen.tsx` |
| **What you see** | Title “Welcome to Sayly!”; subtitle about learning with friends; hero image carousel; **Create account**; **Log in** |
| **Endpoints** | None (welcome assets preloaded locally) |
| **Code** | `WelcomeHeroCarousel`, `WelcomeActionButton`, `AuthBackdrop`, `useAuthCopyColors`, `welcomeAssets.ts` |
| **Navigation** | → SignUp; → Login |

---

## 2. Login

| | |
|---|---|
| **Screen** | Login |
| **File** | `features/auth/screens/LoginScreen.tsx` |
| **What you see** | Close; “Welcome back!”; Email field; Password field; **Forgot password?**; form error; **Log in**; footer link to Sign up |
| **Endpoints** | `POST /auth/login` via `useAuth().signIn` (session body only; profile loads via `/users/me` in RootNavigator) |
| **Code** | `AuthBackdrop`, `AuthCloseButton`, `AuthField`, `AuthPrimaryButton`; `features/auth/AuthProvider.tsx`; `features/auth/api/authApi.ts` |
| **Navigation** | Close → Welcome; → ForgotPassword; → SignUp; success → Root re-routes |

---

## 3. Sign up

| | |
|---|---|
| **Screen** | SignUp |
| **File** | `features/auth/screens/SignUpScreen.tsx` |
| **What you see** | Close; “Create a new account”; Privacy + Terms links; Display name; Email; Password; Confirm password; **Create account**; footer → Log in |
| **Endpoints** | `POST /auth/register` via `useAuth().signUp` |
| **Code** | Same auth shell as Login (`AuthField`, `AuthPrimaryButton`, etc.) |
| **Navigation** | Close → Welcome; → Login; success → Root |

---

## 4. Forgot password

| | |
|---|---|
| **Screen** | ForgotPassword |
| **File** | `features/auth/screens/ForgotPasswordScreen.tsx` |
| **What you see** | Email field (pre-send); after send: confirmation copy and optional **Dev reset code** box; **Send reset code** / **Enter reset code**; Back to sign in |
| **Endpoints** | `POST /auth/forgot-password` via `authApi.requestPasswordReset` |
| **Code** | `AuthFormShell`, `AuthField`, `AuthPrimaryButton` |
| **Navigation** | Close/back → Login; after send → ResetPassword (optional `code` param) |

---

## 5. Reset password

| | |
|---|---|
| **Screen** | ResetPassword |
| **File** | `features/auth/screens/ResetPasswordScreen.tsx` |
| **What you see** | Reset code (6 digits); New password; Confirm; success banner; **Update password** / **Back to sign in**; Request a new code |
| **Endpoints** | `POST /auth/reset-password` via `authApi.resetPassword` |
| **Navigation** | → Login; replace → ForgotPassword |

---

## 6. Onboarding

| | |
|---|---|
| **Screen** | Onboarding |
| **File** | `features/onboarding/screens/OnboardingScreen.tsx` |
| **What you see** | Eyebrow “Almost there”; title `Set up your languages, {firstName}`; subtitle about partners finding you; status copy (“Start with…”, “Add at least one…”, “Looking good…”); loading / error + Try again; **LanguageSetupSections** (native / fluent / learning); sticky **Continue** / “Saving…” |
| **Endpoints** | `GET /languages` (`useLanguages`); `PUT /users/me/onboarding` (`useCompleteOnboarding`); display name from `useAuth` / me |
| **Code** | `LanguageSetupSections` (`features/languages/components/LanguageSetupSections.tsx`), `LanguageCatalogModal`, `LanguageSectionEditor`, `Screen`, `Button` |
| **Language rules in UI** | 1 native, ≤10 spoken/fluent, ≤5 learning; catalog modal + level editor |
| **Navigation** | None explicit — success updates `profile.me` → Root switches to `App` |

---

## 7. Discover (tab label: “Sayly”) — home / partner feed

| | |
|---|---|
| **Screen** | Discover |
| **File** | `features/discovery/screens/DiscoverScreen.tsx` |
| **What you see** | Greeting `Hey, {firstName}!` / “Hey there!”; “Ready to practice?”; **search bar** (“Search by name or language” + clear); **filter button** (gear + active-count badge); partner count `{n} partner(s)`; **scrollable partner cards** (pull-to-refresh, infinite scroll, footer spinner); empty / error + Retry; **FilterBottomSheet**; **ConnectionRequestModal** |

### Per partner card (`UserCard` / `UserDiscoveryCard`)

| UI element | Detail |
|------------|--------|
| Avatar | Photo or initials + online/presence indicator |
| Display name | Username shown as `displayName` |
| Country | Flag emoji + country name |
| Age | Shown when available |
| Match badge | Mutual / Partial / other (`MatchBadge`) |
| Match label | e.g. “Practice together” + compatibility copy |
| Speaks chips | Up to 3 languages + proficiency |
| Learning chips | Languages they want to learn |
| CTAs by connection status | **Send Request** / **Pending—Cancel** / **Accept + Decline** / **Message + Remove** |

### Filters sheet (`FilterBottomSheet`)

| Filter | UI |
|--------|-----|
| They speak | Language catalog (`LanguageCatalogModal`) |
| They learn | Language catalog |
| Proficiency | `ProficiencySelector` |
| Country | Searchable country list |
| Actions | Reset / Apply |

| | |
|---|---|
| **Endpoints** | `GET /discover?...` (`useDiscovery`); `GET /users/me` (`useProfile` for greeting); `GET /languages` (cards/filters); connection mutations: accept / decline / cancel / remove; `POST /connections/request` from modal |
| **Code** | `DiscoverySearchBar`, `FilterButton`, `FilterBottomSheet`, `UserCard`, `MatchBadge`, `DiscoveryLoadingView`, `DiscoveryEmptyState`, `ConnectionRequestModal`, `Avatar`, `PressableScale`, `Screen`; hooks in `features/discovery/hooks/`, `features/connections/hooks/` |
| **Navigation** | Tap card → `PublicProfile` `{ userId }`; Message → `Conversation` `{ conversationId }` (or profile if no id) |

---

## 8. Connections

| | |
|---|---|
| **Screen** | Connections |
| **File** | `features/connections/screens/ConnectionsScreen.tsx` |
| **What you see** | Title “Connections”; subtitle; tabs **Incoming (n)** / **Outgoing (n)** / **Connected (n)**; FlatLists with pull-to-refresh; empty states; **ConnectionCard** rows |

### Per connection card

| UI element | Detail |
|------------|--------|
| Avatar + presence | Online / offline |
| Display name | Username |
| Flag + country | Location |
| Intro message | Optional text on request |
| Incoming actions | Accept / Decline |
| Outgoing | “Request Pending” + Cancel |
| Connected | Message (if `conversationId`) + Remove |

| | |
|---|---|
| **Endpoints** | `GET /connections/requests` (`useConnections`); `PATCH /connections/:id/accept\|decline\|cancel`; `DELETE /connections/:id` |
| **Code** | `ConnectionCard`, `Screen`, `WarmLoadingView`, `WarmEmptyState`, `Avatar`, `PressableScale` |
| **Navigation** | → PublicProfile; → Conversation |

---

## 9. Chats (inbox)

| | |
|---|---|
| **Screen** | Chats |
| **File** | `features/chat/screens/ChatsScreen.tsx` |
| **What you see** | Title “Chats” + Live / Connecting… / Offline indicator; subtitle; skeleton / error + Retry / list; empty “No chats yet” |

### Per chat row (`ChatListItem`)

| UI element | Detail |
|------------|--------|
| Avatar | + online/offline |
| Display name | Partner username |
| Time | Last activity |
| Preview | Last message text (+ delivery ticks if mine) |
| Unread badge | Count when unread |

| | |
|---|---|
| **Endpoints** | `GET /conversations` (`useConversations`); realtime via socket `message_new`, `message_status`, `user_online_status` |
| **Code** | `ChatListItem`, `ChatListSkeleton`, `MessageTicks`, `WarmEmptyState`, `Avatar`, `Screen` |
| **Navigation** | → Conversation |

---

## 10. Conversation (chat thread)

| | |
|---|---|
| **Screen** | Conversation |
| **File** | `features/chat/screens/ChatDetailScreen.tsx` (also exported as `ConversationScreen` / `ChatScreen` aliases) |
| **What you see** | Custom header: back, avatar + presence, **displayName**, subtitle (typing / Online / country / Reconnecting); ⋮ safety menu; inverted message list; empty “Say hello…”; typing indicator; composer |

### Message bubble (`MessageBubble`)

| Type / action | Detail |
|---------------|--------|
| TEXT / IMAGE / VIDEO / VOICE | Content + optional caption / transcript / translation |
| Meta | Clock time; delivery ticks |
| Actions | Transcribe / Translate / Correct / Save; in-chat **Search**; retry on failed send |

### Composer (`ChatInput`)

| Control | Detail |
|---------|--------|
| Attach (+) | Gallery / camera photo or video |
| Text field | Message body |
| Send / Record | Text send or voice `RecordSendButton` |
| Preview | `MediaPreviewModal` before send |

| | |
|---|---|
| **Endpoints** | `GET /conversations/:id/messages`; `POST /conversations/:id/messages`; `PATCH /conversations/:id/read`; `POST .../translate`; `POST .../transcribe`; `POST /media/uploads`; socket `send_message`, typing events |
| **Code** | `MessageBubble`, `ChatInput`, `TypingIndicator`, `RecordSendButton`, `MediaPreviewModal`, `BlockReportMenu` (`features/safety`), `useMessages`, `useConversations` |
| **Navigation** | goBack; on block → MainTabs Chats |

---

## 11. Profile (own)

| | |
|---|---|
| **Screen** | Profile |
| **File** | `features/profile/screens/ProfileScreen.tsx` |
| **What you see** | Header firstName + **settings gear**; **About me** row (avatar, chevron → Edit); **Show in Discover** toggle; **Preview profile**; menu rows: Languages, Saved phrases, Practice goals, Connections, Privacy & safety; Privacy policy link; Contact & help; **Log out**. |

| | |
|---|---|
| **Endpoints** | `GET /users/me` (`useProfile`); `POST /auth/logout` via `useAuth().signOut` |
| **Code** | `ProfileMenuRow`, `ProfileSkeleton`, `Avatar`, `PressableScale`, `Screen` |
| **Navigation** | Settings; EditProfile; PublicProfile (self preview); LanguagePreferences; Connections tab; Settings again |

---

## 12. Public profile

| | |
|---|---|
| **Screen** | PublicProfile / UserPreview |
| **File** | `features/profile/screens/PublicProfileScreen.tsx` |
| **What you see** | Header title = displayName; “Public profile” + ⋮ menu; **ProfileHeader** (avatar, name, flag, country); Spoken / Learning **LanguageBadgeList**; Practice goals chips; Bio “About me”; sticky **ConnectionActions**; ConnectionRequestModal; BlockReportMenu |

### Connection actions by status

| Status | Actions |
|--------|---------|
| None | Send Request |
| Pending (outgoing) | Pending + Cancel |
| Incoming | Accept + Decline |
| Connected | Message + Remove Connection |

| | |
|---|---|
| **Endpoints** | `GET /users/:id/public-profile` (`usePublicProfile`); connection mutations; `POST /blocks`, `POST /reports` via BlockReportMenu |
| **Code** | `ProfileHeader`, `LanguageBadgeList`, `PracticeGoalsSection`, `BioSection`, `ConnectionActions`, `ProfileSkeleton`, `ConnectionRequestModal`, `BlockReportMenu` |
| **Navigation** | → Conversation; goBack on block |

---

## 13. Edit profile

| | |
|---|---|
| **Screen** | EditProfile |
| **File** | `features/profile/screens/EditProfileScreen.tsx` |
| **What you see** | Custom ‹ Back (discard confirm if dirty); title/subtitle; **ProfilePhotoPicker**; Display name; **CountryPicker**; Bio + `n/500` counter; Spoken **LanguageLevelList**; Learning **LanguageLevelList**; **PracticeGoalsPicker**; sticky **Save** |

| | |
|---|---|
| **Endpoints** | `GET /users/me` (`useProfile`); `GET /languages`; `PUT /users/me/profile` (`usePutMeProfile`) |
| **Code** | Profile photo/country/goals pickers under `features/profile/components/`; language lists under `features/languages/` |
| **Navigation** | goBack on save / discard |

---

## 14. Language preferences

| | |
|---|---|
| **Screen** | LanguagePreferences |
| **File** | `features/languages/screens/LanguagePreferencesScreen.tsx` |
| **What you see** | “Languages” + subtitle; skeleton / error + Try again; **LanguageSetupSections** (auto-save on change); **LanguageSnackbar** |

| | |
|---|---|
| **Endpoints** | `GET /languages`; `GET /users/me/languages`; `PUT /users/me/languages` (`useManageUserLanguages`) |
| **Code** | `LanguageSetupSections`, `LanguageCatalogModal`, `LanguageSectionEditor`, `LanguageSnackbar` |
| **Navigation** | Stack Back only |

---

## 15. Settings

| | |
|---|---|
| **Screen** | Settings |
| **File** | `features/settings/screens/SettingsScreen.tsx` |
| **What you see** | Appearance Light / Dark / Auto; Edit profile; Language preferences; **Change password** modal (current / new / confirm); Privacy policy; Sign out; **Delete account** (danger) |

| | |
|---|---|
| **Endpoints** | `PATCH /users/me/password` (`useChangePassword`); `DELETE /users/me` (`useDeleteAccount`); `POST /auth/logout` (`signOut`); theme via local `useTheme` |
| **Navigation** | → EditProfile; → LanguagePreferences |

---

# Endpoint quick index (live client)

| Method | Path | Used by |
|--------|------|---------|
| POST | `/auth/login` | Login |
| POST | `/auth/register` | SignUp |
| POST | `/auth/refresh` | `apiClient` (silent) |
| POST | `/auth/logout` | Profile / Settings sign out |
| POST | `/auth/forgot-password` | ForgotPassword |
| POST | `/auth/reset-password` | ResetPassword |
| GET | `/users/me` | Profile, Discover greeting, Root onboarding gate, EditProfile |
| PUT | `/users/me/profile` | EditProfile |
| PUT | `/users/me/onboarding` | Onboarding |
| GET | `/users/:id/public-profile` | PublicProfile |
| GET | `/discover` | Discover |
| GET | `/languages` | Onboarding, filters, EditProfile, LanguagePreferences |
| GET / PUT | `/users/me/languages` | LanguagePreferences |
| GET | `/connections/requests` | Connections (+ Discover actions refresh) |
| POST | `/connections/request` | ConnectionRequestModal |
| PATCH / DELETE | `/connections/:id/...` | Accept / Decline / Cancel / Remove |
| GET | `/conversations` | Chats / Conversation header |
| GET / POST | `/conversations/:id/messages` | Conversation |
| PATCH | `/conversations/:id/read` | Conversation open |
| POST | `.../translate`, `.../transcribe` | Message actions |
| POST | `/media/uploads` | Chat media / voice |
| POST | `/blocks`, `/reports` | BlockReportMenu |
| PATCH | `/users/me/password` | Settings |
| DELETE | `/users/me` | Settings delete account |

---

# Dead / unwired / deferred

| Item | Notes |
|------|--------|
| `getPublicProfile` | Live public profile UI (`GET /users/:id`) |
| Discover visibility toggle | Live on Profile — maps to `PUT /users/me/profile` `discoverable` |
| Blocked users | Settings → Blocked users (`GET/DELETE /blocks`) |
| Corrections / saved phrases | Chat message **Correct** / **Save**; Profile → Saved phrases (`/learning/phrases`) |
| Chat `clientMessageId` | Client sends idempotency id; backend uniqueness still pending |
| Message reactions / edit / delete | Not shipped — needs dedicated API + UI; in-chat **search** is live |

---

# How to extend this doc

When adding a screen or feature:

1. List **every visible UI element** (names, counts, buttons, empty states).
2. Name the **exact endpoint(s)** and the **API / hook file**.
3. List **screen file + feature components + shared components**.
4. Note **navigation** in and out.
5. Mark anything stubbed or unwired separately so it is not confused with live product.
