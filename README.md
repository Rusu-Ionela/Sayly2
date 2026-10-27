# Sayly

Language exchange app. Feature-based TypeScript on both the React Native client and the Node.js API.

```text
frontend/client    React Native + Expo (SDK 58) app
backend/server     Express + PostgreSQL (Drizzle) + Socket.IO API
packages/shared    @sayly/shared: catalogs, limits and Zod schemas both sides use
```

Anything the app and the API must agree on (countries, practice goals, profile limits, CEFR and
proficiency levels, password rules, support/topic/reference schemas) lives in `packages/shared`.
Change it there, never by copying a value into one side.

## Setup

Install in this order. Never run `npm install` in the repository root: an Expo install there is
picked up instead of the app's and breaks the build.

```bash
cd packages/shared && npm install
cd ../../backend/server && npm install
cd ../../frontend/client && npm install
```

Copy `backend/server/.env.example` to `backend/server/.env` and `frontend/client/.env.example`
to `frontend/client/.env`.

```bash
cd backend/server
npm run db:migrate   # apply the checked-in migrations
npm run dev          # API on http://localhost:4000, docs at /api-docs

cd frontend/client
npx expo start -c    # scan the QR code with Expo Go
```

The backend builds `packages/shared` automatically before `dev`, `test`, `build`, `typecheck`
and the `db:*` scripts. The app reads it from source, so edits show up on the next reload.

## Checks

```bash
cd backend/server && npm run typecheck:all && npm test
cd frontend/client && npm run check && npm run deadcode
```

## Notes

- Expo Go from the App Store / Play Store only opens projects on the latest Expo SDK. When a new
  SDK ships, upgrade every package together (`npx expo install expo@^NN --fix` in
  `frontend/client`).
- Audio/video calls (WebRTC) need a development build; they do not run in Expo Go.
