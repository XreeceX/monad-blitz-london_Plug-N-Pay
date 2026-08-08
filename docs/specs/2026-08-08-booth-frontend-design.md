# Plug-N-Pay — Booth App Frontend Spec

| | |
|---|---|
| **Date** | 2026-08-08 (Monad Blitz London, event day) |
| **Status** | Ready to build. Open decisions in §15 need answers before the relevant P0 task starts. |
| **Build budget** | One developer, ~2 hours, in parallel with contracts and the ops dashboard |
| **Deadline** | Code freeze 18:00, submission 18:30, pitch slot 18:30–20:30 |
| **Stack** | Vite 8.2.1 + React 19.2.8 + TypeScript, deployed to Vercel |

---

## 0. What this is, and what it is not

A phone web app reached by scanning a QR code. Its job is to hold sixty people's attention at a booth and, during the pitch, to turn the audience into live load on the projector behind the presenter.

It is **not** the product. Plug-N-Pay is a settlement rail with no consumer app (`docs/idea/idea.md` §11). This toy borrows the product's physics — metered energy, per-second settlement, the vehicle-to-grid sign flip — and makes them playable. Nothing here ships as the real thing.

Two reasons it earns its build time on a day this short:

1. **Judging is a peer vote** (`docs/event_details/judging_criteria.md`). Everyone who plays is a voter. A toy in sixty hands is the widest surface the team has.
2. **The audience becomes the demo.** `idea.md` §11b wants 10–50 concurrent sessions to prove Monad's throughput claim. Simulated sessions prove it weakly. Sixty phones tapping at once prove it in a way a room can see.

---

## 1. Constraints that shaped every decision below

Verified 2026-08-08. Values marked UNVERIFIED must not be treated as facts.

| # | Constraint | Value | Source |
|---|---|---|---|
| 1 | Vercel functions cap streaming duration | Hobby **300s hard max**; Pro 300s default / 800s configurable; 1800s is beta-only | [vercel.com/docs/functions/limitations](https://vercel.com/docs/functions/limitations) |
| 2 | `navigator.vibrate` on iOS Safari | **Not supported.** Silent no-op, never an error | [caniuse](https://caniuse.com/mdn-api_navigator_vibrate), [mdn/browser-compat-data#29166](https://github.com/mdn/browser-compat-data/issues/29166) |
| 3 | Killing tap delay + zoom on iOS | `touch-action: manipulation` handles double-tap zoom and the ~300ms delay. Selection and callout need their own properties | [paulau.dev](https://paulau.dev/blog/disable-pinch-zoom-on-ios-safari/) |
| 4 | Screen Wake Lock | iOS Safari 16.4+, Android Chrome 84+. Auto-releases on tab hide; must reacquire on `visibilitychange` | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) |
| 5 | Vercel KV | **Retired**, migrated to Upstash Dec 2024. Use "Upstash for Redis" from the Vercel Marketplace. Free tier: 256 MB, 500k commands/month | [vercel.com/marketplace/upstash](https://vercel.com/marketplace/upstash) |
| 6 | Monad testnet | Chain **10143** / **0x279f**. RPC `https://testnet-rpc.monad.xyz`. Symbol MON. Mainnet is 143 — different chain | [docs.monad.xyz](https://docs.monad.xyz/developer-essentials/network-information) |
| 7 | Testnet explorer | No single canonical one. Docs list `testnet.monadscan.com` and `testnet.monadvision.com` | [docs.monad.xyz/tooling-and-infra/block-explorers](https://docs.monad.xyz/tooling-and-infra/block-explorers) |
| 8 | Public testnet RPC rate limit | **Undocumented.** No published req/s or req/day figure | as above |
| 9 | Monad brand purple | **UNRESOLVED.** Live brand kit shows `#6E54FF`; `#836EF9` is widely used across the ecosystem | [monad.xyz/brand-and-media-kit](https://www.monad.xyz/brand-and-media-kit) |
| 10 | Testnet faucet amount and rate limit | **UNVERIFIED.** `faucet.monad.xyz` is the on-domain URL; circulating figures (0.5–10 MON, once per 24h) trace to third-party aggregators | — |

Three of these changed the design outright:

- **#1 killed Server-Sent Events.** A single SSE connection feeding the projector dies after five minutes on Hobby, mid-pitch. The wall polls instead (§8).
- **#2 killed haptics as a load-bearing element.** Roughly half the room is on iOS, where `vibrate` does nothing. Every moment that felt good because of a buzz must feel good without one. Haptics stay as an Android-only bonus.
- **#5** means any `@vercel/kv` snippet found today is a dead end.

---

## 2. The player's sixty seconds

```
scan QR
  │
  ├─ 0.0s   boot, identity assigned, car rolled
  ├─ 0.2s   CAR REVEAL          ~1.9s, skippable by touching anything
  ├─ 2.1s   GARAGE              car + charge post + nickname chip
  │           swipe up ─────────► cable follows the thumb
  ├─ ~6s    LATCH               snap, flare, first amber pip travels the cable
  ├─ 6.8s   HANDSHAKE           1.2s, two addresses link, "Plug & Charge"
  ├─ 8.0s   CHARGING            30s tap race
  │           ├─ 0–8s     build
  │           ├─ 8–11s    GRID SURGE ×2
  │           ├─ 19–22s   GRID SURGE ×2
  │           ├─ 80% SoC  taper wall, each tap yields less
  │           └─ 100% SoC THE FLIP → V2G, amber becomes cyan, earnings accelerate
  ├─ 38s    RESULTS             energy moved, MON, rank
  └─ 45s    LEADERBOARD         top 10, your row highlighted, reward terms
```

Whole loop under a minute. A player can start a second run from the results screen in one tap, keeping the same car.

---

## 3. Screens

The app is a single-page state machine. No router, no navigation.

```ts
type Screen =
  | 'boot' | 'reveal' | 'garage' | 'plugging'
  | 'handshake' | 'charging' | 'results' | 'leaderboard'
```

### 3.1 Boot

Under 800ms. Reads or creates `deviceId` (crypto.randomUUID, localStorage), derives the car from it, generates a handle like `DRIVER-7F2`. No login, no wallet, no permission prompt.

The car is derived from `deviceId`, not re-rolled per visit. A refresh returns the same car. This is deliberate: rerolling for a Legendary would waste booth time and, because rarity is cosmetic (§6), would gain nothing.

### 3.2 Car reveal

Four seconds decide whether someone keeps playing. Beats, with the whole scene composed but hidden:

| t (ms) | Beat | Motion |
|---|---|---|
| 0–150 | Black | — |
| 150, 230 | Headlight cones snap on | Opacity step, no easing. They are switches, not fades |
| 230–800 | Garage light sweep | Rotated light-bar sprite translates left→right, `cubic-bezier(.16,1,.3,1)`. A clip rect chases it, revealing paint. Body settles `scale(1.05)` → `scale(1)` on the same curve |
| 800–1150 | Spec plate stamps in | `scale(1.35)` → `1` + fade, `cubic-bezier(.34,1.56,.64,1)` |
| 1150–1900 | Rarity flourish | Tier-scaled, see §4 |
| 1900 | Connector drops into its holster | Two-keyframe spring, then a chevron pulses on a 1.2s loop |

**Input is live from 0ms.** Any touch fast-forwards to the 1900ms composed state. The reveal never holds a player hostage.

`prefers-reduced-motion`: a single 200ms crossfade to the final scene.

### 3.3 Garage and swipe-to-plug

The only gesture in the app, so it has to be worth repeating.

- **Target**: 96px hit circle on the connector, docked bottom-centre in a holster. Thumb-reachable one-handed.
- **Cable**: one SVG cubic bezier from the station port at the bottom edge to the connector. Control points lag the drag with damped follow (`control += (target - control) * 0.18` per frame, offset against velocity) so the cable whips and slacks like it has mass. At rest it hangs in a sag; dragging up pulls the sag out. This is the only path whose `d` is rewritten per frame — one path, cheap.
- **Magnet**: within 90px of the charge port, the connector rotates to align and lerps toward the port at 0.25/frame. Scratched screens and fat thumbs still land it.
- **Commit**: release within 60px of the port.
- **Miss**: connector falls home on a gravity spring (550ms, one bounce), cable resags, port ring gives one "not yet" pulse. No error text.

**Latch payoff**, with the haptic removed from the critical path (constraint #2):

| t (ms) | Event |
|---|---|
| 0 | Snap-translate to port, 80ms ease-in |
| 80 | Chassis dips 3px and recovers over 120ms — weight transfer |
| 100 | WebAudio thunk: 60Hz sine 50ms + a noise tick. **This gesture is what unlocks the AudioContext.** `navigator.vibrate?.(12)` fires here too and is expected to do nothing on iOS |
| 150 | Port ring flares, `scale(1)` → `1.8`, opacity → 0 |
| 200 | First amber pip departs along the cable; MON panel slides up |
| 350 | Stream ignites at 6 pips/s |

The dip, the flare and the thunk carry the feel on iOS. The buzz is a bonus on Android.

### 3.4 Handshake

1.2s, skippable. Two truncated addresses (`0x8a2…4f1` car, `0xC91…07e` station) slide toward each other, a link glyph closes between them, and the caption reads `PLUG & CHARGE · CONTRACT CERT VERIFIED`. Beneath, in muted type: `ISO 15118-style handshake, simulated for this demo`.

This is the only place the real product surfaces, and it is honest about being a stand-in. Engineers in the audience will read that line and think better of the team, not worse.

### 3.5 Charging

The screen someone hammers without looking away.

**Layout, top to bottom:**

```
┌──────────────────────────────┐
│  1 847 Wh          ⟨hero⟩    │  energy delivered, tabular numerals
│  −0.2214 MON       ⟨amber⟩   │  what you're paying, ticking every frame
├──────────────────────────────┤
│         [ car, filling ]     │  amber level rises inside the silhouette
│  ▓▓▓▓▓▓▓▓░░░░│░░░  312 kW    │  power bar, taper zone pre-marked at 80%
├──────────────────────────────┤
│                              │
│      ⟨ TAP ZONE — 40% ⟩      │  full width, borderless, zero furniture
│                              │
└──────────────────────────────┘
```

**Three things never move:** the tap zone, the car, and the counter. The thumb occludes the bottom 40%, so all feedback lives above it. Ripple rings emanate from the actual touch point using pooled nodes.

**Why energy is the hero number, not MON.** During charging the driver is *paying*, so a MON figure counts down, which deflates a game. Watt-hours only ever climb. Showing Wh large and the MON cost small underneath keeps a rising number on screen while staying honest to the product: the payment is the meter. After the Flip, MON earnings become the hero and turn cyan.

**Escalation, so 30 seconds builds instead of flatlining:**

- 0–8s: dark, modest pip density
- 8–11s and 19–22s: **grid surge**, ×2, screen-edge amber vignette, `GRID SURGE ×2` stamps on
- 10–20s: background grid layers begin parallax drift, ripples brighten
- 80%+: amber deepens toward hot orange, per-tap gain visibly shrinks, pips slow and fatten. Honest physics, and engineers recognise it
- 100%: **the Flip**
- final 5s: countdown numerals stamp per second, `scale(3)` → `1` + fade
- 30s: freeze frame, chime, results card slides up

**The one element that must be beautiful:** the cable stream. Pip density and speed are the player's input rendered as light, which is the product thesis drawn in a single element.

### 3.6 The Flip (the signature mechanic)

Crossing 100% state of charge hard-flips the game into vehicle-to-grid sell-back.

- 300ms white flash frame
- The cable's light stream **reverses direction**. The car now feeds the grid
- Amber cuts to cyan across the whole page
- Label flips `PAYING` → `EARNING`
- The battery **drains** while MON accelerates upward at the premium sell-back rate
- Hero number switches from Wh to MON earned

It earns its place for three reasons. It is the pitch's one novel claim ("reverse the current and the same mechanism pays the driver") made playable, so the toy teaches the product. It is a plot twist rather than a modifier, and sixty phones flipping colour at different moments produce a visible cascade across the room. And it costs about twelve minutes, because it is a sign change, a state flag and a palette swap over machinery that already exists.

The taper is what makes reaching it feel earned. Without the taper wall at 80%, the Flip is just a timer.

### 3.7 Results and leaderboard

Results: energy moved, MON paid and earned, rank, and the car's spec plate. One primary button, `CHARGE AGAIN`, which returns to the garage with the same car. Secondary: `LEADERBOARD`.

Leaderboard: top 10, the player's own row pinned and highlighted even when outside the top 10, and the reward terms panel (§7). Polls `/api/leaderboard` every 5s while visible, never while charging.

### 3.8 The public leaderboard screen and the seal

A second surface, separate from the phone: a large screen at the booth showing the live standings all day. It is what makes the contest feel like a contest rather than sixty private games.

**The seal.** Ten seconds before the contest closes, the public screen goes dark and shows `FINAL STANDINGS SEALED`. From that moment nobody in the room can see who won, or what score they would have needed to beat. Players keep their own score on their own phone; nothing else is visible.

**The reveal happens later, in Discord**, not at the venue. Three things follow from that, and they are the reason this design is stronger than announcing on the day:

- Nobody can target the top score in the closing seconds, because nobody can see it.
- The team reviews the final list before publishing it, with no clock pressure and no audience (§6).
- The result gives the project a reason to exist after the event, which a leaderboard announced and forgotten in the room does not.

**Requirements on the screen:** legible across a busy room; updates at least every 5s; shows the seal state unambiguously rather than merely freezing, so a stale screen is never mistaken for a live one.

---

## 4. The car system

Eight bespoke top-down cars cannot be drawn in this budget. One parametric SVG can.

**One body path, six parameters:** hull length/width scale, cabin inset, wheelbase, wheel style (2 variants), paint HSL, accent stripe on/off.

Variety reads as intentional because **rarity is expressed as paint physics, not geometry**:

| Tier | Treatment | Cost |
|---|---|---|
| Common | Flat paint | — |
| Rare | Static metallic highlight layer | 2 min |
| Epic | Animated sheen sweep — a white gradient bar clipped to the body, `translateX`, transform-only — on reveal and every 6s idle | 4 min |
| Legendary | Two-layer iridescent sheen, 8-particle spark pop, one extra light-sweep beat | 4 min |

A generated spec plate (`KESTREL GT · 78 kWh`) makes each car feel catalogued rather than randomly hued. **The plate's kWh figure is flavour text. Every car has identical capacity and identical physics** (§6).

Top-down is the right view: the charge port, the cable route and the fill level are all visible in one silhouette, and one path animates cheaply. A three-quarter hero view would look better in the reveal and would double the art budget for a screen that lasts two seconds.

---

## 5. Game model

All constants in `src/game/constants.ts` so they can be tuned live at the booth.

```ts
SESSION_MS         = 45_000
CAPACITY_KWH       = 2.2      // typical player (7 taps/s) flips at t≈35.6s
P_MAX_KW           = 350
R_REF_TAPS_PER_SEC = 7        // soft-saturation reference, NOT a cap
R_HARD_CAP_PER_SEC = 30       // above any human rate. NOT 20 — see §6
MAX_POINTERS       = 5        // multi-finger is allowed and expected
EMA_TAU_MS         = 450
TAPER_START_SOC    = 0.80
TAPER_FLOOR        = 0.25     // multiplier at 100% SoC
SURGE_WINDOWS_MS   = [[10000, 13000], [24000, 27000], [36000, 39000]]
SURGE_MULTIPLIER   = 2.0
TICK_REPORT_MS     = 1_000    // tap events → game server. NOT a chain call.
                              // The booth app settles nothing. See REQUIREMENTS §16
PRICE_MON_PER_KWH  = 0.12     // charging, player pays
V2G_MON_PER_KWH    = 0.30     // sell-back premium, player earns
```

Per frame, with `dt` in seconds:

```
r          = EMA(instantaneous tap rate, EMA_TAU_MS)
base       = P_MAX_KW * (1 - exp(-r / R_REF_TAPS_PER_SEC))   // soft saturation
taper      = soc <= 0.80 ? 1
             : 1 - ((soc - 0.80) / 0.20) * (1 - TAPER_FLOOR)
surge      = inSurgeWindow(t) ? SURGE_MULTIPLIER : 1
kW_target  = base * (phase === 'v2g' ? 1 : taper) * surge
kW        += (kW_target - kW) * (1 - exp(-dt / 0.25))     // display smoothing

whDelta    = kW * dt / 3.6
phase === 'charge'
  ? (soc += whDelta / (CAPACITY_KWH * 1000), whCharged += whDelta,
     monPaid += whDelta / 1000 * PRICE_MON_PER_KWH)
  : (soc -= whDelta / (CAPACITY_KWH * 1000), whDischarged += whDelta,
     monEarned += whDelta / 1000 * V2G_MON_PER_KWH)

if (phase === 'charge' && soc >= 1) flip()
```

**Score, one integer, server-recomputable:**

```
score = round(whCharged + whDischarged * 1.5)
```

Watt-hours moved, with discharge weighted 1.5× so reaching the Flip pays. Every player scores something, including one who never reaches 100%.

**Why soft saturation instead of a hard tap-rate cap.** An earlier draft used `min(r / 12, 1)`, which clamps. Simulating it showed the clamp put a hard ceiling on *score*: every player sustaining 12 taps/s or more finished on **exactly 3712**, identical. That is a tie at the top of the leaderboard, which is precisely where the money sits. `1 - exp(-r / R_REF)` is strictly increasing with no ceiling, so faster tapping always scores higher and two players tie only if their tap rates match to several decimal places.

It also behaves better against cheating than the clamp did. Returns diminish sharply: a human at 12 taps/s reaches 82% of `P_MAX`, an autoclicker at 50 taps/s reaches 99.9%. The cheat is worth about **1.22×**, bounded, rather than unbounded.

**Calibration** (simulated at 120Hz with the taper and both surge windows):

| taps/s | score | Flip at | technique |
|---|---|---|---|
| 4 | 2109 | never | casual, one thumb |
| 5 | 2365 | 42.6s | casual, one thumb |
| 7 — typical | 3323 | 35.6s | one thumb |
| 9 | 4052 | 30.3s | two thumbs |
| 12 | 4785 | 26.6s | three fingers |
| 15 | 5269 | 25.5s | three fingers, fast |
| 20 | 5732 | 24.6s | four fingers |
| 25 | 5976 | 24.0s | five fingers, plausible ceiling |
| 30+ | 6098 | 23.8s | engine cap — no human reaches this |

`CAPACITY_KWH` is tuned to 2.2 for the 45-second round. A typical player flips at 35.6s and earns for the last nine seconds; a casual one at 5 taps/s flips at 42.6s, barely, right at the end, which is the best feeling available. At 4 taps/s the Flip stays out of reach, deliberately — it has to be worth chasing.

The battery was 1.6 kWh while the round was 30 seconds. Extending to 45s without resizing it would have had a typical player flip at 25.7s and spend the remaining 19 seconds in V2G, turning the twist into most of the game.

---

## 6. Fairness and anti-cheat

Real money on a public tap leaderboard. Treat the client as hostile.

**Fairness invariants** — every player must face a provably identical challenge:

1. **Rarity affects nothing.** Not capacity, not multiplier, not duration. It changes paint and a light sweep. A luck-assigned multiplier on a cash leaderboard is indefensible and would be the first thing a player shouts about.
2. **Surge windows sit at fixed offsets from session start, identical for everyone.** They are not random. Randomised windows would hand one player a better session than another, and "the grid surges twice per session" is no less fun.
3. **Frame rate must not affect score.** A 120Hz iPhone must not out-earn a 30fps Android. Energy accumulates from `dt`, and tap rate is derived from **timestamps of `pointerdown` events**, never from a per-frame counter.
4. **Session duration is measured against server time**, using the offset established at session start (§8).

**Anti-cheat, and an honest ranking of what is worth building today:**

| Defence | Rule | Worth it in 2h? |
|---|---|---|
| Multi-finger play | **Allowed, up to 5 concurrent pointers.** Three fingers reaches 12–15 taps/s and is legitimate skill | Yes — and say so in the instructions |
| Autoclicker | Cap the effective rate at **30** taps/s rather than rejecting. Above it everyone scores 6,098, and no human reaches 30/s, so real players never tie while a script's edge over the best plausible human falls to 2% | Yes, 1 line |
| Suspicious rate | Flag any run averaging over 18 taps/s for human review before the Discord reveal. Flagging is free because the reveal is delayed (§3.8) — nobody is accused in the room | Yes, cheap |
| Direct POST to the relay | Server recomputes score from the tick stream and ignores the client's number | **P1.** Not buildable today alongside everything else |
| Forged or replayed ticks | Idempotency on `(sessionId, seq)`; reject `seq` ≤ last seen | Yes, cheap |
| Clock manipulation | Server stamps start and end; client `t` is advisory | Yes, cheap |
| Interval-variance analysis | Flag near-zero variance between taps | No. Theatre at this scale |

**The honest consequence, and why it is smaller than it looks.** Without server-side recompute, anyone can send an arbitrary score straight to the endpoint. In a room of sixty developers that is a realistic thing to happen, not a theoretical one.

It matters much less here because of the reveal design (§3.8): winners are never announced at the venue. The standings seal before the contest closes and are published afterwards in Discord. **Detection therefore does not have to be real-time — it only has to happen before a name is announced**, which removes the failure everyone fears, where a faked score wins publicly and the team has to argue about paying it in front of the room.

**The defence, in two parts:**

1. **A hard rate cap, not a score ceiling.** An earlier draft set a score ceiling of 4,200 and it was worthless: the scoring curve's asymptote was 4,040, so nothing could ever exceed it and the check caught nothing. Soft saturation also compresses cheating — a script at 200 taps/s scored only 18% above an elite human — which is good for fairness but means **score alone cannot detect a cheat**. The engine caps the effective rate at **30** taps/s (`R_HARD_CAP_PER_SEC`). The cap was briefly set to 20, which was wrong for the reason this very section gives: at 20 a four-finger player and a script both score 5,732, reintroducing a tie at exactly the leaderboard positions carrying prize money. Five fingers reaches about 25/s, so 30 sits above any human and every real player keeps a distinct score. Scripts tie at 6,098, only 2% above the best plausible human, and are flagged at >18/s regardless.
2. **Review before announcing.** Sort the final list before publishing to Discord. A fabricated entry sits so far outside the real distribution that it is obvious by eye, and there is no clock pressure while doing it.

Server-side recompute (P1) remains the stronger defence and is worth building if the booth app finishes early. It is no longer required to protect the prize.

---

## 7. The reward

The team's intent: top 10 players share 20% of any cash prize won.

**One problem to name plainly.** The people playing are the same people who cast the votes that decide whether the prize exists. A payout conditional on the team placing is, structurally, a payment contingent on the voters' own behaviour. Nobody is likely to accuse the team of anything, but the fix is cheap enough that there is no reason to carry the ambiguity.

**Decision, 2026-08-08: the conditional prize share.** The team pays 20% of any cash prize won, split across the top 10. An unconditional pot was offered and declined. Table A below is therefore the active one.

Because the payout depends on placing, **the condition must be stated up front**. Disclosure is the whole mitigation here: a player who reads the terms before playing knows exactly what is and is not promised, and nothing is hidden that could later look like it was.

**Terms panel copy, final:**

> **Top 10 share 20% of any cash prize we win.** That's £240 split ten ways if we place first, and nothing if we don't place at all. Play as often as you like; your best run counts. Winners are listed here and paid by the team at the venue.

**What the app must never say:** anything asking a participant to vote for the project or to influence the judging. No "vote for us", no "help us win", not in copy, not on a share card, not spoken at the booth. Stating the payout condition as fact is required; trading on it is not (FR-BOOTH-8).

**Payout tables.** Each sums exactly to its pot.

| Rank | A: £240 pot, top 10 ★ active | B: £240 pot, top 5 | C: £100 unconditional, top 10 |
|---|---|---|---|
| 1 | 60 | 80 | 25 |
| 2 | 45 | 60 | 18 |
| 3 | 35 | 45 | 14 |
| 4 | 25 | 30 | 11 |
| 5 | 20 | 25 | 9 |
| 6 | 11 | — | 6 |
| 7 | 11 | — | 5 |
| 8 | 11 | — | 4 |
| 9 | 11 | — | 4 |
| 10 | 11 | — | 4 |
| **Total** | **240** | **240** | **100** |

★ recommended.

**Tie at a cut-line:** earlier server receipt timestamp wins. Deterministic, no judgement call, and it can be explained in one sentence to someone who is annoyed.

**Claiming**, under 15 minutes of build: the results screen shows a `CLAIM` button linking to a Google Form asking for handle and one contact method of the player's choice. Collect nothing else. **Do not collect wallet private keys, email addresses you do not need, or any payment detail.** A winner proves identity by producing the `deviceId` stored in their browser, shown on the results screen as a short code. Anyone who cleared storage is settled by the team on the spot.

---

## 8. Phone ↔ wall interface contract

The section the backend developer implements against. It is deliberately dull.

> **SUPERSEDED 2026-08-08 — read `REQUIREMENTS.md` §16 first.** This section described the booth app reporting energy deltas to the settlement relay, which submitted them on-chain. **The booth app no longer touches the chain at all.** It talks to a game server that runs the settlement engine in memory. The endpoint shapes below are still broadly the right shape for that server, but every reference to settlement, wallets, batching or the chain is void, and `POST /api/surge`'s server-clock scheduling is the one piece worth keeping verbatim.
>
> What replaced it, in one line: taps go to the game server, the game server scores them (FR-SPLIT-3) and holds the leaderboard, and the only chain interaction in the entire crowd path is a single aggregate transaction at the close of the pitch (§16.4).

**Principle: the phone is authoritative for its own gameplay and never blocks on the network.** Every request is fire-and-forget. Every failure is silent. There is no spinner, no retry dialog, no error toast anywhere in this app. That principle survives the pivot unchanged and is the reason the app still works if the venue wifi dies mid-round.

**Transport: polling or a websocket to the game server.** The Vercel streaming cap (constraint #1) applied to a serverless dashboard reading chain events; a cloud-hosted game server has no such limit. Sixty websockets is trivial.

### Endpoints

```http
POST /api/session
  →  { deviceId, nickname, carId }
  ←  { sessionId, startAt, serverNow,
       surgeWindows: [[8000,11000],[19000,22000]],
       priceMonPerKwh: 0.12, v2gMonPerKwh: 0.30 }
```
The phone computes `clockOffset = serverNow - Date.now()` here and schedules everything against server time.

```http
POST /api/tick                          # ~1/s, batched, fire-and-forget
  →  { sessionId, seq, ticks: [ { t, kW, whDelta, taps } ] }
  ←  204
```
Idempotent on `(sessionId, seq)`. The server ignores any `seq` at or below the last one seen. Use `navigator.sendBeacon` when the page is hiding.

```http
POST /api/session/end
  →  { sessionId, whCharged, whDischarged, score, tapCount }
  ←  { rank, top: [ { rank, nick, score } ] }
```

```http
GET /api/wall                           # polled 1/s by the projector only
  ←  { players: [ { id, nick, hue, kW, soc, phase } ],
       totalKW, totalWh, totalMon, count, surgeAt }
```

```http
GET /api/leaderboard?n=10
  ←  { entries: [ { rank, nick, score, carName } ], updatedAt }
```

```http
POST /api/surge                         # presenter only, shared secret header
  →  { atEpochMs }
```

### Redis keys (Upstash, per constraint #5)

| Key | Type | Purpose | TTL |
|---|---|---|---|
| `sess:<id>` | hash | live session state for the wall | 120s |
| `live` | zset by `lastSeen` | membership for the wall; prune older than 5s | — |
| `lb` | zset by score, member `<deviceId>:<nick>` | leaderboard, best score per device | — |
| `surge` | string, epoch ms | pending room surge | 30s |

### Client queue behaviour

In-memory queue, cap 50 ticks. On failure, retry with backoff (250ms, 1s, 4s), then drop the oldest. The queue never blocks the render loop and never surfaces to the player.

### Chain writes

**Void — see REQUIREMENTS §16.** Retained only because the reasoning below is what led to the split.

**The phone never touches the chain.** If the team wants audience sessions settling on Monad, the relay owns it: aggregate every active session's watt-hour delta into one batched transaction per second from a single funded hot wallet. That is the multicall design already under discussion in `docs/idea/open_questions.md` Q2, and it means one wallet to fund and one place to manage nonces. With the public RPC's limits undocumented (constraint #8), assume it will not hold and let the wall's MON figure degrade to `simulated` without ceremony.

---

## 9. Degradation ladder

Every level is a state the audience must never be able to distinguish from a deliberate design choice.

| Level | Condition | Phone | Wall |
|---|---|---|---|
| **L0** | relay up, chain up | Full | Live nodes, live MON, on-chain |
| **L1** | relay up, chain down | Full, unchanged | Live nodes, MON labelled `simulated` |
| **L2** | relay down | Fully local. Leaderboard from localStorage. Player sees nothing wrong | Runs its own simulated nodes |
| **L3** | venue wifi dead before anyone loads the page | Nothing loads | Wall runs standalone; presenter narrates instead of inviting the room |

L3 is the one that cannot be engineered around in two hours. The mitigation is a rehearsed pitch that works with zero phones connected, plus a recorded fallback, per `docs/event_details/project_demo.md`.

---

## 10. Design system

Night-garage instrument panel. Near-black asphalt; light exists only where energy flows, so every glow is earned by the physics. Two poles carry semantic state: amber means you are paying, cyan means you are earning. They are never decorative.

```css
:root {
  --asphalt:  #0B0E12;   /* page */
  --panel:    #14181F;
  --amber-1:  #FFB000;   /* charging: you pay */
  --amber-2:  #FF6A00;   /* taper zone, hot */
  --cyan-1:   #35E0FF;   /* V2G: you earn */
  --monad:    #6E54FF;   /* SEE §15.1 — unresolved, do not ship blind */
  --text:     #F2F4F8;
  --muted:    #8A94A6;
  --radius:   14px;
  --space:    8px;
}
```

Single dark theme. A bright room and scratched screens mean maximum contrast wins; there is no light mode and no theme toggle.

**Type:** system UI for prose. Every number in `ui-monospace` with `font-variant-numeric: tabular-nums`. Money is an instrument reading, not an arcade score, and digits must not jitter as they tick.

**Motion rules, non-negotiable for 60fps on a mid-range Android:**

- `transform` and `opacity` only. No animated `filter`, no animated layout properties
- One `requestAnimationFrame` loop for the entire app. DOM writes batched at the end of it
- "Glow" is a pre-baked SVG radial-gradient sprite faded via opacity. Never `filter: blur()`
- `will-change` on exactly two elements: the cable core and the hero counter
- Pooled particle nodes, maximum 24, reused

**`prefers-reduced-motion`:** no shake, no particles, no sweeps. Crossfades replace transitions, the cable holds still with an opacity-pulsing core, and the counter keeps ticking. The meter is the message even when nothing moves.

---

## 11. Platform rules

```html
<meta name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover">
```

`user-scalable=no` is ignored by iOS Safari. `touch-action` is the lever that works.

```css
html, body { overscroll-behavior: none; }   /* kills pull-to-refresh mid-game */

.tap-zone, button, .connector {
  touch-action: manipulation;               /* double-tap zoom + ~300ms delay */
  -webkit-user-select: none; user-select: none;
  -webkit-touch-callout: none;              /* long-press menu */
  -webkit-tap-highlight-color: transparent;
}
```

All four properties are required. `touch-action` alone leaves selection and the callout menu live, and a long-press during a tap race will surface a context menu over the game (constraint #3).

**Input:** count `pointerdown`, not `touchstart` or `click`. Track pointer ids, ignore beyond two concurrent.

**Wake lock:** request on entering `charging`, reacquire on `visibilitychange` when the document becomes visible (constraint #4). A screen that sleeps mid-run loses the player.

**Audio:** WebAudio, synthesised, zero assets. The AudioContext unlocks on the plug gesture, which is the first user gesture in the flow.

**Haptics:** `navigator.vibrate?.(12)`. Android only. Nothing in the design may depend on it (constraint #2).

---

## 12. File structure

```
src/
  main.tsx
  App.tsx                    screen state machine
  state/session.ts           useReducer, no external store
  screens/
    Reveal.tsx  Garage.tsx  Charging.tsx  Results.tsx  Leaderboard.tsx
  components/
    Car.tsx                  parametric top-down SVG
    Cable.tsx                the one per-frame path
    ChargePost.tsx
    BatteryFill.tsx
    Counter.tsx              tabular-nums ticker
  game/
    loop.ts                  the single rAF loop
    engine.ts                tap → kW → energy → MON, taper, surge, flip
    constants.ts             §5 values, tuned live at the booth
    cars.ts                  catalogue + deterministic assignment from deviceId
  net/
    relay.ts                 fire-and-forget queue, clock offset
  audio/synth.ts
  styles/tokens.css
api/                          Vercel functions, §8
```

---

## 13. Build plan

Honest accounting. **P0 is 105 minutes and the budget is 120.** Fifteen minutes of slack is not much; the first thing that overruns eats it.

### P0 — the app is good without anything below it

| Task | Min |
|---|---|
| Scaffold: `npm create vite@latest booth -- --template react-ts`, tokens, state machine, viewport + touch CSS | 10 |
| Parametric car SVG, 6 params, 2 wheel variants | 15 |
| Reveal: light sweep + plate stamp (no rarity flourish yet) | 8 |
| Swipe-to-plug: cable bezier, magnet, latch payoff | 18 |
| Charging screen: tap engine, battery fill, counters, power bar | 20 |
| The Flip | 12 |
| Results + local leaderboard | 10 |
| Relay client + `/api/session`, `/api/tick`, `/api/wall` | 12 |
| **Total** | **105** |

### P1 — in priority order, each independently droppable

Escalation pass (10) · Upstash leaderboard (10) · rarity flourish (10) · WebAudio + surge visuals (10) · room-surge sync (10) · server-side score recompute (25) · wall polish (10)

### P2 — named so they can be argued about and then not built

Cadence overdrive · rarity latch ceremony · share card · pack-temperature pacing meter

**Pack temperature is cut deliberately.** It is the cleverest idea considered and the worst value: about 20 minutes, it needs tutorialising inside a 30-second game, and it teaches the same pacing lesson the taper already teaches for free.

---

## 14. The pitch moment

The ten seconds this whole build exists for. Put the QR on the **first slide**, so the room joins during the intro and the wall is already populated by the time the demo starts.

> **Presenter:** "Phones out. Right now you are sixty cars. On my mark, you're one grid. Full current."

One keypress hits `POST /api/surge` with a timestamp about two seconds in the future. Phones pick it up on their next 1s poll and schedule locally against their measured clock offset, so they fire together within roughly ±50ms — close enough that a room reads it as simultaneous.

**Phones:** amber vignette, `GRID SURGE ×2` stamps on, ×2 multiplier, a ten-second countdown ticking in unison across the room. The unison is the effect.

**Wall:** one horizontal amber conduit spans the projector with a marked breaker threshold, `DC FAST · 1.0 MW`. Per-player nodes flare as taps arrive. When the room total crosses the threshold, the breaker slams: full-screen flash, conduit goes white-hot, the room-total counter rolls up and freezes.

> **Presenter, over the freeze:** "That number is sixty payment streams settling per second on Monad. That's machine-speed money. That's Plug-N-Pay."

Then each phone shows that player's personal slice of the total.

**Rehearse the version with zero phones connected.** The wall's own simulated nodes must carry the same beat, and the presenter's line must still land. If the venue wifi collapses, nobody in the audience should be able to tell that a plan changed.

---

## 15. Open decisions

Everything else in this document is decided. These five are not, and each blocks a specific task.

1. **Monad purple: `#6E54FF` or `#836EF9`?** Blocks the tokens file, which is the first P0 task. Someone opens `monad.xyz/brand-and-media-kit` and reads the value off the page. Two minutes.
2. **Reward: unconditional £100 pot, or 20% of winnings?** §7 recommends unconditional. Blocks the terms panel copy.
3. ~~**Prize adjudication.**~~ **RESOLVED 2026-08-08.** Live public screen all day, sealed 10 seconds before the contest closes, winners revealed afterwards in Discord. Protected by a plausibility ceiling of 4,200 plus review before announcing (§3.8, §6). Server-side recompute stays P1 and is no longer required to protect the prize.
4. **Who writes the four API endpoints** — the frontend developer inside the 120 minutes, or the backend developer as part of the dashboard work? The 12-minute P0 line item assumes the frontend developer writes only the client.
5. **Does the wall connect to the chain at all today?** §8 gives the relay-owned batching design. It is the backend developer's call and nothing in this app depends on the answer.

---

## 16. Sources

- Event format, schedule, peer-vote judging, 3-minute demo: `docs/event_details/` (`about.md`, `judging_criteria.md`, `project_demo.md`, `rules.md`)
- Product framing, dashboard as demo surface, concurrent-scale requirement: `docs/idea/idea.md` §11, §11a, §11b
- RPC risk and batched-settlement design: `docs/idea/open_questions.md` Q1, Q2
- Platform and infrastructure facts: table in §1, each row carrying its own URL
