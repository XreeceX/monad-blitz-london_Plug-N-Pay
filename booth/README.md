# Plug-N-Pay booth app (M8)

The phone game and the public leaderboard screen. Design:
`docs/specs/2026-08-08-booth-frontend-design.md`. System requirements:
`docs/specs/REQUIREMENTS.md` (FR-BOOTH-*, FR-SPLIT-*).

**This app makes zero chain calls and holds no key material (FR-SPLIT-1).**
Everything a player sees is computed locally by the same engine rules, and it
says so on screen, permanently (FR-SPLIT-5).

## Run

```bash
npm install
npm run dev        # Vite (:5173) + room server (:3001), proxied together
```

- Host frontpage: `http://<your-ip>:5173/` → **OPEN HOST LOBBY** (projector)
- Players join only by scanning the QR — waiting lobby until you hit **START ROUND**
- One presentation round; no solo / no typed room codes
- Standings wall: opened from the host screen after start (`?#wall`)
  - Seal (FR-BOOTH-11): press `S` twice within 3 seconds

The room server is required for the hosted round.

## For the backend (game server, M10)

The client speaks the §8 contract, base URL `VITE_API_BASE` (default `/api`):

| Endpoint | Direction | Notes |
|---|---|---|
| `POST /api/session` | `{deviceId, nickname, carId}` → `{sessionId, startAt, serverNow, surgeWindows, priceMonPerKwh, v2gMonPerKwh}` | client measures clock offset from `serverNow` |
| `POST /api/tick` | `{sessionId, seq, ticks:[{t,kW,whDelta,taps}]}` → `204` | ~1/s, idempotent on `(sessionId, seq)`, fire-and-forget |
| `POST /api/session/end` | `{sessionId, whCharged, whDischarged, score, tapCount}` → `{rank, top}` | server MUST recompute/validate score (FR-SPLIT-3) |
| `GET /api/leaderboard?n=10` | → `{entries:[{rank,nick,score,carName}], updatedAt}` | polled 5s by phones + wall |
| `GET /api/wall` | → `{players, totalKW, totalWh, totalMon, count, surgeAt}` | polled 1s by the wall only |

Every client request is fire-and-forget with silent failure — the server being
down must never be visible on a phone (FR-BOOTH-2/4).

Server-side obligations the client cannot enforce: recompute the score from the
tick stream, rate-cap taps at 30/s per connection (FR-SPLIT-4), flag runs
averaging >18 taps/s for review before the Discord reveal.

## Engine calibration

```bash
npx tsx scripts/calibrate.ts
```

Verifies the engine against the spec §5 table (7 taps/s → ~3,300, flip ≈36s;
strictly increasing with tap rate; 30/s hard cap). Current worst deviation: 1.2%.

## Deploy (Render)

`render.yaml` deploys **one Node Web Service** that serves the SPA and the
room-sync API (`server.mjs`):

1. Render dashboard → **New → Blueprint** → select this repo → Apply.
2. Wait for the build. Open the service URL — that is the live demo.
3. Optional: set `VITE_PUBLIC_URL` to that URL in the Render env and rebuild
   so host QR codes always encode the canonical address.

If you already have a Static Site from an earlier blueprint, delete it and
re-apply the blueprint (or create a new Web Service with root `booth`,
build `npm ci && npm run build`, start `npm start`).
