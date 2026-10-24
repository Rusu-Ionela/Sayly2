# Language Exchange Backend — Quick Reference

## Architecture

```text
routes
  ↓
controllers
  ↓
services
  ↓
repositories
  ↓
PostgreSQL / Drizzle
```

Cross-cutting:
- Auth middleware
- Zod validation
- Redis
- Socket.IO/WebSocket
- Push notifications
- Object storage
- Queue/worker if present

## Main modules

| Module | Responsibility |
|---|---|
| auth | signup, login, OTP/session lifecycle |
| users | account lifecycle |
| profiles | learner profile |
| languages | language catalog + proficiency |
| discovery | learner search/recommendations |
| matching | connection requests/state |
| conversations | conversation membership |
| messages | durable chat messages |
| corrections | language corrections |
| media | secure uploads |
| notifications | in-app/push notifications |
| blocks | user blocking |
| reports | user/content reports |
| moderation | restrictions/suspensions |
| settings | privacy/preferences |
| subscriptions | paid entitlements if applicable |

## Core invariants

- A user cannot read/write another user's private data without authorization.
- A non-member cannot access a private conversation.
- A blocked relationship must be respected server-side.
- A suspended/banned account cannot continue normal product actions.
- A message sender is always taken from authenticated server context.
- Original messages remain immutable when corrections are created.
- Public discovery never returns private account fields.

## Discovery compatibility

```text
User A:
  native: Hindi
  learning: Russian

User B:
  native: Russian
  learning: Hindi

=> strong language-exchange compatibility
```

This is a learning compatibility example, not a dating score.

## Suggested realtime events

```text
message:new
message:updated
message:read
message:reaction
correction:created
typing:start
typing:stop
presence:updated
```

Only durable state should be persisted.

## Suggested notification events

```text
message.received
connection.requested
connection.accepted
correction.received
learning.reminder
security.alert
```

## Database hot paths

```text
messages(conversation_id, created_at)
conversation_participants(user_id, conversation_id)
user_languages(user_id, language_id, type)
blocks(blocker_id, blocked_id)
reports(status, created_at)
notifications(user_id, created_at)
device_tokens(user_id)
```

Use actual query plans before adding indexes.

## AI-assisted learning

If the app later adds AI translation/correction:
- validate provider responses
- rate-limit expensive endpoints
- never expose provider API keys
- distinguish AI-generated suggestions from human corrections
- do not silently rewrite learner content
- store only the minimum data required by the feature
