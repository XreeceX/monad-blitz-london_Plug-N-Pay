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
npm run dev        # phone app on your LAN (host is enabled for phone testing)
```

- Phone app: `http://<your-ip>:5173/`
- Public wall / host screen: `http://<your-ip>:5173/#wall`
  - Seal the standings (FR-BOOTH-11): press `S` twice within 3 seconds.

Works fully offline — with no game server the app plays identically and the
leaderboard falls back to this device only, labelled as such (degradation L2).

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

`render.yaml` at the repo root deploys this as a Render **Static Site**:

1. Render dashboard → **New → Blueprint** → select this repo → Apply.
2. That's it — it builds `booth/` and publishes `dist/`, auto-deploying on
   every push to `main`.
3. Once the game server exists, uncomment `VITE_API_BASE` in `render.yaml`
   (its Render URL + `/api`) and set `VITE_PUBLIC_URL` to the booth site's
   own URL so the wall's QR encodes the public address. Redeploy.

Until the server is live the deployed app runs in its designed offline mode:
fully playable, leaderboard local to each device and labelled as such.

Manual alternative: `npm run build` → static files in `dist/`; any static
host works.
