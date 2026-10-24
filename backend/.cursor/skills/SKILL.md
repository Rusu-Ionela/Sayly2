---
name: language-exchange-backend
description: >
  Guides AI coding agents working on a language exchange backend similar in product scope
  to Tandem or HelloTalk. Use for authentication, profiles, language preferences,
  partner discovery, matching, conversations, realtime chat, corrections, notifications,
  moderation, blocks/reports, media, privacy, subscriptions, PostgreSQL/Drizzle changes,
  and API work.
---

# Language Exchange Backend Skill

## Product boundary

This is a language learning and language exchange platform.

The core loop is:

user profile → language goals → discover compatible learners → connect → chat/practice → corrections/learning → notifications/progress

Do not turn the product into a dating app.

## When to use

Use this skill for:
- REST/API endpoints
- authentication and onboarding
- language/proficiency models
- learner profiles
- partner discovery
- matching/connection flows
- conversations and messages
- corrections
- translation or AI-assisted learning features
- realtime chat/presence
- push notifications
- blocks/reports/moderation
- media uploads
- privacy/settings
- subscriptions/entitlements
- PostgreSQL/Drizzle schema and migrations

Always read applicable `.cursor/rules/*.mdc` rules before editing.

## Non-negotiables

1. Preserve the existing project architecture.
2. Reuse existing modules/helpers/dependencies.
3. Validate untrusted input with Zod or the project's equivalent.
4. Authorize every private resource server-side.
5. Never expose private profile/account/message data accidentally.
6. Enforce blocks and moderation server-side.
7. Keep message ordering and retry behavior deterministic.
8. Do not add dating mechanics.
9. Do not edit secrets or `.env` files unless explicitly requested.
10. Keep migrations reviewable and safe.

## Feature workflow

Before coding:
- inspect the relevant module
- find existing route/controller/service/repository patterns
- inspect schema and existing relations
- inspect auth/role middleware
- inspect tests for neighboring behavior
- check whether the feature already exists

Then implement the smallest consistent change.

## Typical endpoint checklist

```text
- [ ] validation schema
- [ ] authorization decision
- [ ] repository/database change if required
- [ ] service/business logic
- [ ] controller
- [ ] route registration
- [ ] OpenAPI/docs if the repo uses them
- [ ] tests for non-trivial behavior
```

## Common domain model

A typical implementation may include:

User
├── Profile
├── Languages
│   ├── Native / spoken
│   └── Learning / target
├── Learning Goals
├── Interests
├── Discovery Settings
├── Connections
├── Conversations
│   └── Messages
│       └── Corrections / Reactions / Attachments
├── Notifications
├── Blocks / Reports
└── Sessions / Device Tokens

Do not blindly create all tables. Add only what the product/repository requires.

## Discovery

Candidate selection should prioritize learning compatibility, not romance or appearance.

At minimum:
- target/native language compatibility
- proficiency compatibility
- learning goals
- availability/timezone when useful
- privacy/discovery settings
- block/suspension exclusion

Keep candidate ranking explainable.

## Chat

A chat request must be authorized against conversation membership.

Server owns sender identity and canonical timestamps.

For mobile retry safety, use idempotency keys when appropriate.

Durable message state belongs in PostgreSQL.
Ephemeral typing/presence belongs in realtime infrastructure.

## Corrections

Never overwrite the original learner message.

Use a separate correction record referencing the original message and correction author.

## Safety

Every discovery/message flow must account for:
- blocks
- reports
- suspended/banned users
- rate limits
- privacy settings

## Notifications

Respect notification preferences and avoid leaking message contents.

Queue/retry notification delivery where appropriate.

## Database

Use database constraints for durable invariants and transactions for multi-record state changes.

Index real access patterns, especially:
- messages by conversation and time
- conversation participants by user
- discovery language relationships
- blocks
- reports
- notifications
- device tokens

## Quality bar

Before finishing:
- run the smallest relevant test/check
- typecheck the touched code
- verify authorization paths
- verify no private fields were added to public DTOs
- verify migration SQL if schema changed
- inspect the final diff for unrelated changes
