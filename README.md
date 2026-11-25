# Atelier — The drawing room

A real-time multiplayer drawing and guessing game.

## Stack

- Next.js, React, TypeScript, HTML Canvas
- Node.js, Express, Socket.IO
- MongoDB for persistent words and completed match summaries

The Express server owns live rooms, game state, scores, timers, and stroke history. The Next.js app presents the UI and connects directly to Socket.IO. Current rooms are kept in server memory to avoid database writes during drawing.

## Structure

Application code is split into two top-level folders with no cross-imports:

- `frontend/` — Next.js UI, HTML Canvas board, and browser-side Socket.IO client
- `backend/` — Node.js, Express, Socket.IO, MongoDB models, and game logic (`src/config`, `src/models`, `src/services`, `src/socket`, `src/types`, `src/utils`, `src/index.ts`)

## Run locally

1. Install Node.js 20.9 or later and run `npm install` at the repo root (or separately inside `frontend/` and `backend/`).
2. Copy `frontend/.env.example` to `frontend/.env.local` and `backend/.env.example` to `backend/.env.local`. Set `NEXT_PUBLIC_SOCKET_URL` in `frontend/.env.local` to the Express server URL. To use MongoDB, set `MONGODB_URI` in `backend/.env.local`. Without it, the server uses its built-in word list and skips match history.
3. In one terminal, run `npm run server:dev`.
4. In another terminal, run `npm run dev`.
5. Open `http://localhost:3000` in two browser windows. Create a room in one and join it from the other using the invite link.

With the game server running, `npm run test:smoke` runs an automated two-client, four-turn game against `http://127.0.0.1:4000`.

The game server defaults to port 4000 and accepts `http://localhost:3000` as the frontend origin. Set `PORT` and `FRONTEND_ORIGIN` for deployment.

## Deployment

Deploy `frontend/` and `backend/` as two independent services:

- **Backend (Render / Railway):**
  - Root directory: `backend`
  - Build command: `npm install && npm run build`
  - Start command: `npm start`
  - Health check path: `/health`
  - Env vars: `FRONTEND_ORIGIN=https://<frontend-host>` (comma-separated if multiple), `MONGODB_URI=<connection-string>` (optional)
- **Frontend (Vercel / Netlify):**
  - Root directory: `frontend`
  - Build command: `npm install && npm run build`
  - Start command: `npm start` (or platform Next.js default)
  - Env vars: `NEXT_PUBLIC_SOCKET_URL=https://<backend-host>`

**Live URL:** pending deployment.

## Game flow

Create or join a private room → guests ready up → host starts → drawer selects a word → drawer draws while others guess → server awards points → next drawer → final leaderboard. Each configured round gives every active player one drawing turn.

The browser stores normalized points (0–1) rather than pixels, so strokes scale with canvas size. The drawer paints locally immediately and sends bounded stroke points over Socket.IO. The server checks the sender is the current drawer, keeps the stroke for reconnects, and relays it. Guess matching happens only on the server; the word is sent only to the drawer until the turn ends.

See [work.md](work.md) for diagrams, UI decisions, performance priorities, and the development checklist.

## Current constraints

- Live rooms are in one server process. Horizontal scaling would require shared room state and a Socket.IO adapter.
- The game uses room codes rather than accounts or email.
- Public matchmaking is not implemented. Hosts can remove players from their room.

Run `npm run test:regression` for deterministic logic regression tests.
