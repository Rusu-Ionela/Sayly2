# Language Exchange Mobile Frontend — Quick Reference

## Preferred architecture

```text
app/navigation
    ↓
screens
    ↓
feature components
    ↓
hooks
    ↓
API/query layer
    ↓
backend
```

## Product areas

| Area | Main UI |
|---|---|
| Auth | login, signup, OTP |
| Onboarding | languages, proficiency, goals, interests |
| Discover | partner feed, filters |
| Profile | learner profile, languages, goals |
| Connections | requests/accepted partners |
| Chat | conversations, messages, composer |
| Corrections | language corrections |
| Notifications | message/learning activity |
| Settings | privacy, notifications, account |
| Safety | block/report flows |

## Example partner

```text
Name: Anna
Native: Russian
Learning: Hindi
Hindi: Beginner
Goals: Conversation, pronunciation
Interests: Music, travel, films
```

This represents learning compatibility.

## Example screen states

```text
Discover
├── loading
├── results
├── empty
├── error
└── refreshing
```

## Example chat state

```text
Message
├── composing
├── sending
├── sent
├── delivered
├── read
└── failed → retry
```

## Typical query keys

```text
['me']
['profile', userId]
['discover', filters]
['connections']
['conversations']
['conversation', conversationId]
['messages', conversationId]
['notifications']
```

Use the project's established key factory if one exists.

## Typical realtime events

```text
message:new
message:read
message:reaction
correction:created
typing:start
typing:stop
presence:updated
```

## Typical reusable primitives

```text
Button
Text
Input
Avatar
Badge
Card
Sheet
Modal
Divider
Skeleton
EmptyState
ErrorState
LanguageChip
ProficiencyBadge
PartnerCard
MessageBubble
CorrectionCard
```

Do not create these if the project already has equivalent components.

## AI-assisted learning UI

If the app adds AI translation/correction:
- clearly label AI-generated output
- allow users to compare original and suggestion
- avoid silently replacing learner text
- show loading/error states
- rate-limit expensive actions server-side
- never expose provider credentials
