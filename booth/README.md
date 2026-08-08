# Plug-N-Pay booth app (M8)

The phone game and the public leaderboard screen. Design:
`docs/specs/2026-08-08-booth-frontend-design.md`. Visual system:
[`DESIGN.md`](./DESIGN.md) (Apple Wallet / HIG tokens from
[awesome-ios-design-md](https://github.com/Meliwat/awesome-ios-design-md)).
System requirements: `docs/specs/REQUIREMENTS.md` (FR-BOOTH-*, FR-SPLIT-*).

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

## Deploy (Render) — required for a room full of phones

A QR that says `localhost` only works on your laptop. Deploy once, then **always
host from the Render URL**.

1. [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint**
2. Connect `XreeceX/monad-blitz-london_Plug-N-Pay`, pick branch `demo/render-booth`
   → Apply `render.yaml`. The blueprint pins that branch and `rootDir: booth`, so
   this demo deploys on its own — separate from `main` and from wherever the
   webpage and backend are hosted.
3. Wait for `plug-n-pay-booth` to go live
4. Open **that** URL on the projector → **OPEN HOST LOBBY**
5. Phones scan the QR (it uses Render’s `RENDER_EXTERNAL_URL` automatically)

If you still have an old Static Site from an earlier setup, delete it — this
demo needs the Node Web Service (`npm start`) so `/api/room` works.

Same-Wi‑Fi fallback before Render is up: open
`http://<your-lan-ip>:5174/` on the host laptop (not localhost), then the QR
encodes the LAN address.
