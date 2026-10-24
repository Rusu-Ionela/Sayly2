# Language Learning App

Language exchange App. Feature-based TypeScript on both the React Native client and the Node.js server.

```text
frontend/client   React Native + TypeScript
backend/server    Node.js + TypeScript
```

Team rules for adding features, imports, and shared code: [CONVENTIONS.md](./CONVENTIONS.md).

## Setup

```bash
cd frontend/client && npm install
cd backend/server && npm install
```

Copy `backend/server/.env.example` to `backend/server/.env` and `frontend/client/.env.example` to `frontend/client/.env`. Then:

```bash
cd backend/server
npm run db:push
npm run dev

cd frontend/client
npm start
```

Feature endpoints currently return `501 Not implemented` until you fill in the service. `GET /health`, `GET /languages`, and `/auth/*` (except forgot-password) work. Interactive API docs: `http://localhost:4000/api-docs`.
