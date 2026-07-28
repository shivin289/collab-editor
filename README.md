# Collab Editor

A real-time collaborative text editor — multiple people can open the same document via a shareable link and see each other's edits and cursors live, similar in spirit to Google Docs.

**Live demo:** _add your deployed URL here after deploying_
**Repo:** _add your GitHub URL here_

## Why I built this

Most fresher full-stack projects are CRUD apps (task managers, e-commerce clones). This project's goal was to go one level deeper: implement real-time synchronization over WebSockets, handle multi-user presence, and think through the trade-offs of collaborative editing — the kind of system-design questions that come up in real interviews.

## Features

- Create a document and share the link — anyone with it can join and edit
- Live text sync across all connected users (Socket.io)
- See who else is currently in the document, each with a distinct color
- Auto-save to PostgreSQL (debounced, so it doesn't hit the DB on every keystroke)
- Editable document title, synced across users
- No login required for v1 — just enter a name to join

## Architecture

```
┌─────────────┐         WebSocket          ┌─────────────┐
│   Browser A │ ◄─────────────────────────► │             │
└─────────────┘                             │             │
                                             │   Backend   │      ┌────────────┐
┌─────────────┐         WebSocket           │  (Express + │ ───► │ PostgreSQL │
│   Browser B │ ◄─────────────────────────► │  Socket.io) │      └────────────┘
└─────────────┘                             │             │
                                             └─────────────┘
```

- **Frontend:** React (Vite), plain `<textarea>` for the editor, `socket.io-client` for real-time sync, React Router for `/doc/:id` routes.
- **Backend:** Express for REST (create/fetch/rename documents), Socket.io for real-time events, `pg` for PostgreSQL access.
- **Database:** PostgreSQL. Two tables: `documents` (current content) and `document_snapshots` (schema ready for version history — not yet wired up, a natural v2 feature).

### How real-time sync works

1. Client A types → frontend calls `sendContentChange`, which updates local state immediately (no lag) and emits `content-change` over the socket.
2. Server receives it, broadcasts to everyone else in that document's Socket.io room, and schedules a debounced save to Postgres (1 second after the last edit).
3. Client B receives `content-change` and applies it directly to its textarea.

**Conflict resolution — the trade-off worth explaining in an interview:** this implementation uses **last-write-wins**. It works well for the common case (people editing different parts of the document), but two users typing in the *exact* same character position in the same instant can produce an inconsistent result — one edit can overwrite the other. A production-grade version would use a CRDT library like [Yjs](https://github.com/yjs/yjs) or Operational Transformation (the algorithm Google Docs itself uses) for true conflict-free merging. I chose last-write-wins for v1 deliberately, to keep the system understandable end-to-end rather than depending on a library I couldn't fully explain — and because it's still correct and a natural place to point to for a "what would you improve" interview question.

## Project structure

```
collab-editor/
├── backend/
│   ├── src/
│   │   ├── server.js           # Express + Socket.io entrypoint
│   │   ├── routes/documents.js # REST: create/fetch/rename documents
│   │   ├── sockets/
│   │   │   ├── collabSocket.js # Core real-time logic (join, edit, cursor, presence)
│   │   │   └── colors.js       # Assigns each user a distinct color
│   │   └── db/
│   │       ├── pool.js         # Postgres connection pool
│   │       ├── documents.js    # DB queries
│   │       └── schema.sql      # Table definitions
│   ├── scripts/
│   │   └── test-integration.js # End-to-end test (see "Testing" below)
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/Home.jsx          # Create/browse documents
│   │   ├── pages/DocumentPage.jsx  # The editor view
│   │   ├── components/Editor.jsx   # The textarea + cursor tracking
│   │   ├── components/UserPresence.jsx
│   │   └── hooks/useCollabSocket.js # All socket connection logic
│   └── Dockerfile
└── docker-compose.yml
```

## Running locally

### Option A — Docker Compose (easiest, no local Node/Postgres needed)

```bash
docker compose up --build
```

Then open **http://localhost:5173**. The backend runs on port 4000, Postgres on 5432.

### Option B — Manual setup

**Prerequisites:** Node.js 20+, a running PostgreSQL instance.

```bash
# 1. Backend
cd backend
cp .env.example .env        # edit DATABASE_URL to point at your Postgres
npm install
psql "$DATABASE_URL" -f src/db/schema.sql   # create the tables
npm run dev                 # starts on http://localhost:4000

# 2. Frontend (in a separate terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                 # starts on http://localhost:5173
```

## Testing

Rather than a handful of trivial unit tests, this project has an **end-to-end integration test** that spins up the real Express + Socket.io server, connects two simulated browser clients, and verifies the actual collaborative flow: document creation, both clients joining, live content sync between them, cursor broadcasting, debounced database persistence, and presence updates on disconnect.

It runs against an in-memory Postgres-compatible engine (`pg-mem`), so it needs no database setup:

```bash
cd backend
npm run test:integration
```

## Deploying

- **Backend:** Render, Railway, or Fly.io (free tiers all support long-running Node + WebSocket connections — note that some serverless platforms like Vercel Functions do *not* support persistent WebSockets, so a traditional Node host is needed here).
- **Frontend:** Vercel, Netlify, or Render static site.
- **Database:** Neon or Supabase (free-tier Postgres).

Set `CLIENT_ORIGIN` on the backend to your deployed frontend URL, and `VITE_API_URL` / `VITE_SOCKET_URL` on the frontend to your deployed backend URL.

## What I'd build next (v2 ideas)

- Real CRDT-based conflict resolution (Yjs) instead of last-write-wins
- Named cursors rendered inline in the text (currently presence is shown as a badge list, not inline carets — a plain `<textarea>` can't render arbitrary overlays without switching to a `contenteditable` div)
- Document version history using the `document_snapshots` table (schema is already there)
- Basic auth so documents can be private
