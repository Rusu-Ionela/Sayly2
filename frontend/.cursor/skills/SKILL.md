---
name: language-exchange-mobile-frontend
description: >
  Guides AI coding agents building the React Native + TypeScript mobile frontend
  for a language exchange app similar in product scope to Tandem or HelloTalk.
  Covers Expo/Expo Router, UI architecture, NativeWind/Tailwind, TanStack Query,
  Zustand, forms, realtime chat, partner discovery, onboarding, notifications,
  accessibility, performance, and mobile UX.
---

# Language Exchange Mobile Frontend Skill

## Product boundary

This is a language-learning and language-exchange application.

Core loop:

onboard → choose languages/goals → discover compatible learners → connect → chat/practice → corrections → continue learning

The product is not a dating app.

## Preferred technology

Use the repository's actual stack.

Preferred when available:
- React Native
- TypeScript
- Expo
- Expo Router
- NativeWind
- TanStack Query
- Zustand
- React Hook Form
- Zod
- Reanimated
- FlashList
- Socket.IO/WebSocket

Do not introduce a new state/navigation/styling framework when an existing project choice already solves the problem.

## Before coding

1. Inspect existing project structure.
2. Identify navigation system.
3. Identify styling/design system.
4. Identify API/data layer.
5. Identify authentication/session handling.
6. Identify state-management approach.
7. Find an existing feature similar to the requested feature.
8. Reuse established patterns.
9. Check whether the backend endpoint already exists.
10. Keep the diff focused.

## Feature implementation flow

For a new feature:

```text
screen
  ↓
feature components
  ↓
feature hook
  ↓
typed API function
  ↓
backend endpoint
```

For server state:

```text
API → TanStack Query/cache → UI
```

For client state:

```text
local state/Zustand → UI
```

Do not duplicate state unnecessarily.

## Required states

Every network-driven screen should consider:

```text
loading
success
empty
error
retry
refresh
offline/reconnecting where relevant
```

## Onboarding

Onboarding should collect only useful learning information.

Typical data:
- native languages
- learning languages
- proficiency
- learning goals
- interests
- availability

Make progress visible and avoid excessive initial forms.

## Discovery

Discovery should feel like finding a study/conversation partner.

Good signals:
- language compatibility
- proficiency
- goals
- interests
- availability

Never create dating-oriented compatibility UI.

## Chat

Chat is a learning surface, not only messaging.

Support backend capabilities such as:
- text
- voice
- media
- corrections
- reactions
- translation/AI suggestions

Do not invent unsupported message types.

Message sending must handle:
- optimistic state if used
- pending
- sent
- delivered
- read
- failed
- retry

## Corrections

Display corrections without destroying the original learner message.

A correction UI should make it obvious:
- what the learner wrote
- what was corrected
- who corrected it
- why/what the correction means if available

## Realtime

Manage socket lifecycle carefully:
- connect once after auth
- register listeners once
- clean up listeners
- reconnect
- reconcile events with cached state
- disconnect on logout

Never create duplicate listeners from repeated renders.

## Navigation

Keep auth/onboarding/app flows separate.

Use deep links safely.

Do not expose private conversations or profiles through navigation alone; the backend remains authoritative.

## Forms

Use typed schemas and controlled validation.

Prevent duplicate submissions.

Handle mobile keyboards and safe areas.

Preserve input on recoverable errors.

## Styling

Use design tokens rather than arbitrary values.

Prefer semantic component APIs:

```tsx
<Button variant="primary" />
<Button variant="secondary" />
<Avatar size="md" />
<Text variant="body" />
```

Avoid one-off styling that creates visual drift.

## Performance

Use:
- FlashList for large lists
- pagination
- image caching/resizing
- stable list keys
- Reanimated for animations
- query caching

Do not optimize everything blindly.

## Accessibility

Every feature should support:
- accessible labels
- adequate touch targets
- text scaling
- contrast
- meaningful error states
- reduced motion where practical

## Security

The mobile app is not a security boundary.

Never:
- trust client authorization
- ship secrets/API keys
- log tokens
- log private message content
- assume hidden UI is sufficient to protect data

Use secure storage for sensitive session credentials.

## Definition of done

Before finishing:
- typecheck
- run relevant tests
- verify navigation
- verify loading/empty/error states
- verify keyboard behavior
- verify accessibility labels for new controls
- verify no secrets are introduced
- inspect the final diff for unrelated changes
