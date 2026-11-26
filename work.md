# Architecture Notes

## Overview

Atelier is split into two independent packages:

- `frontend/` — Next.js App Router UI, HTML5 Canvas board, and Socket.IO client.
- `backend/` — Express HTTP server, Socket.IO real-time room/turn engine, and MongoDB persistence.

![System architecture](docs/architecture.svg)

## Key Design Decisions

| Area | Choice | Rationale |
| --- | --- | --- |
| Live room state | Server memory (`Map<string, Room>`) | Timers, strokes, and scores update every second; keeping live state in memory avoids database writes on pointer movement. |
| Database | MongoDB (optional fallback) | Stores the word bank and completed match summaries. If `MONGODB_URI` is unset or unavailable, the server falls back to its built-in categorized word list. |
| Canvas sync | Normalized coordinates (`0`–`1`) | Strokes scale cleanly across different screen sizes and DPRs. The drawer paints locally first and streams bounded points over Socket.IO. |
| Word privacy | Server-authoritative checks | Only the active drawer receives `word_options` and `your_word`. Guess matching runs exclusively on the server. |
| Rate limiting | HTTP + per-socket fixed windows | Protects `/health`, room creation/joining, guesses, and drawing events from flooding. |

## Game Flow

![Round and game flow](docs/game-flow.svg)

1. **Lobby:** Host configures players, rounds, draw time, word count, hints, word mode (`Normal`, `Hidden`, `Combo`), and category. Players can ready up; host starts with 2+ connected players after all guests are ready.
2. **Word choice:** Server picks `N` words and sends `word_options` only to the current drawer (12s timeout auto-picks if idle).
3. **Drawing & guessing:** Server starts the countdown, computes progressive hints, validates/relays strokes from the drawer, and scores normalized guesses (speed bonus + 50pt drawer bonus).
4. **Rotation & finish:** Turns rotate across connected players for the configured number of rounds, then display the final leaderboard with a **Play Again** option for the host.

## Scaling Note

Live rooms live in single-process memory. Horizontal scaling across multiple backend instances would require a shared store (e.g., Redis) and a Socket.IO adapter.


## Logic review — 25 November 2026

Fixed stable drawing seats across disconnects, server-side readiness, late-guess scoring, incomplete stroke snapshots, client canvas state mutation, final stroke message size, stale empty-room cleanup, disconnected lobby seats, and malformed numeric settings. Stroke completion is capped at 1,000 points; client coordinates are rounded to keep messages below the transport limit. Disconnected clients cannot draw or submit guesses through the UI.

Run `npm run test:regression` for focused logic regressions and `npm run test:smoke` against a running backend for the four-turn Socket.IO flow. SELF_HOST=1 runs the smoke server on an isolated test port with MongoDB disabled. Browser visual review and live MongoDB validation were not performed in this review.

### Gaming UI and sound update
The UI now uses dark green panels, amber action controls, stronger player/score hierarchy, and a prominent timer while retaining the light canvas. GameAudio is a separate client component using Web Audio oscillators: game state changes trigger short cues, and no audio runs on the stroke path. Sounds require explicit opt-in, stop when muted, and the audio context closes on unmount. The backend health route reports process uptime without touching MongoDB; configure an external five-minute monitor after deployment.
