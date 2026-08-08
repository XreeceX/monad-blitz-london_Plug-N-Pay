# Plug-N-Pay — Test Plan

| | |
|---|---|
| **System** | Plug-N-Pay — per-second machine-to-machine settlement for EV charging on Monad testnet |
| **Subordinate to** | `docs/specs/REQUIREMENTS.md` (per `CLAUDE.md`: requirements win on any disagreement) |
| **Companion** | `docs/specs/RUNBOOK.md` — run it, test it, deploy it, operate it live |
| **Sources** | `REQUIREMENTS.md` (717 lines), `2026-08-08-booth-frontend-design.md` (620 lines), `docs/dispatch/2026-08-08-plug-n-pay-downstream-specs/{coverage-ledger.md,monad-facts.md}`, `CLAUDE.md` |
| **User's ask, verbatim** | "make sure that i can run it and test it then it can be push to live server and it will be ready for people to use" |

## 0. Document status

Started while `docs/specs/ARCHITECTURE.md`, `docs/specs/API.md`, and `docs/specs/DESIGN.md` were all being authored concurrently by other agents; everything derivable from `REQUIREMENTS.md`, the booth spec, and `monad-facts.md` alone was drafted first, then patched three times as each sibling document landed. **All four spec documents now exist and are incorporated.** `ARCHITECTURE.md` gave the wallet-pool sizing, the write-path decision gate, and the ADR-6 booth switch. `API.md` gave the real `PlugNPaySettlement` contract API and `/v1/*` relay HTTP API, replacing this plan's originally-invented function/endpoint names throughout §4–§5. `DESIGN.md` gave the exact repo layout, the canonical `W0–W7` build-wave sequence (mapped against this plan's own P0–P5 phases in §2.3), and settled the one real contradiction that had opened between `ARCHITECTURE.md` and `API.md` over the booth on-chain switch (§12 item 3) — resolved, not left open. Remaining `[PENDING ARCH]` tags are genuinely small: a handful of `API.md` §7's own TBDs (compiler version, batch size N, the ops-secret header scheme) that no document has closed yet.

## 1. Purpose and audience

This is what "test it" means for Plug-N-Pay, made concrete: a matrix mapping every `MUST`/`should` requirement to a specific check, and grouped suites for the parts that need more than one row to specify. It is written for the people building against it today and for whoever verifies the finished submission — including the row-11 adversarial Opus pass this dispatch's own conventions call for.

It does not duplicate `REQUIREMENTS.md`. Every row cites the requirement it verifies; read the requirement there, read the check here.

## 2. Test strategy

### 2.1 Layers

| Layer | Scope | Speed | Needs testnet? |
|---|---|---|---|
| **Contract unit** | M4 settlement contracts, M1 registry — Foundry, local EVM | Fast (ms–s) | No |
| **Relay integration** | M5 signature verification, nonce/pool management, degradation, booth ingestion | Fast–medium | No (mocked chain) except the load harness (§6) |
| **End-to-end on testnet** | Real transactions, chain ID 10143, funded wallets, real receipts | Slow, costs MON + RPC budget | Yes |
| **Load** | FR-REL-9's read-path (done) and write-path (§6) harnesses | Minutes | Yes |
| **Manual / operator demonstration** | The `D`-verified majority — an operator runs a script, confirms a pass condition on screen | Minutes | Yes, live |
| **Inspection** | Reading code, README, or UI copy against a checklist | Seconds–minutes | No |
| **Analysis** | Arguing from a measured number or the design, where no runtime check is buildable | N/A | N/A |

### 2.2 Why demonstration and inspection dominate

Of the 111 requirement IDs that carry a verification method in `REQUIREMENTS.md`, 49 are `D`, 35 are `I`, 24 are `T`, 2 are `A` (coverage-ledger.md "Verification split"). Automated tests are the minority by design, not by omission — `REQUIREMENTS.md` §1.6 defines all four methods as first-class, and AC-7 was deliberately moved from `T` to `D` on 2026-08-08 (REQUIREMENTS.md:600) because "no adversarial test harness is realistically buildable today, and claiming one would be a verification method nobody can run." This plan follows that precedent throughout: where a requirement is honestly a `D` or an `I`, the row below names the operator script or the inspection checklist, not an invented test that nobody will maintain.

### 2.3 Build-phase gating

Phase codes used in every table below, matching the build order in `REQUIREMENTS.md` §11 (lines 611–626):

| Code | Phase | Why this order |
|---|---|---|
| **P0** | FR-REL-9 RPC ceiling measurement | "The first task of the build, before contracts" (REQUIREMENTS.md:619). Read-path: **done** (§13.4). Write-path: open, see §6 |
| **P1** | Contracts + metering + identity + pricing (M1, M2, M3, M4) | "Nothing else has anything to show without them" (REQUIREMENTS.md:625) |
| **P2** | Relay + simulator (M5, M6) | Per-tick relay carries 7 `M` requirements (REQUIREMENTS.md:617); needed before concurrency can be shown |
| **P3** | Dashboard (M7) | "What the audience actually sees" (REQUIREMENTS.md:625) |
| **P4** | Booth app (M8) | "The only module whose absence costs nothing on stage" (REQUIREMENTS.md:625) — built and tested last |
| **P5** | Demo control, rehearsal, honesty inspections (M9 + §7–§9 of this document) | Runs across whatever exists; final rehearsal needs P1–P4 done |
| **CONT** | Continuous / pre-submission | README, inspections, anything checked once at the end regardless of build order |

**Cross-reference to the canonical build waves.** `DESIGN.md` §12 and `ARCHITECTURE.md` §12 both name the actual build sequence **W0–W7**, landed after this section's P0–P5 scheme was already drafted. Rather than rename ~130 matrix rows, here's the mapping — use W-codes when talking to the build team, P-codes when navigating this document:

| This doc's phase | Canonical wave(s) | Wave deliverable |
|---|---|---|
| P0 | **W0** | `tools/probe-write.mjs` + `tools/fund-pool.mjs` — write tx/s known, pool funded ≥100 MON |
| P1 | **W1** (M4+M3) → **W2** (M2+M1) | Contract deployed+verified; signed readings on a real curve |
| P2 | **W3** (M5) | Relay settling 10 tx/s, zero nonce collisions |
| P3 | **W4** (M7) | Wall rendering live, `SIMULATED` banner within 3s of relay death |
| P4 | *(not a wave — M8 is explicitly outside the freeze slice, `DESIGN.md`'s own M8 heading)* | Built and tested last, per REQUIREMENTS.md §11 |
| P5 | **W5** (M6+M9) → **W6** (integration) → **W7** (recording) | Spawner+controls; full beat twice (with/without phones); 🔴 the recorded fallback exists |

**W1 also names the gas-measurement task** referenced throughout §4–§6 below — it "also produces the measured gas limits that replace the `(guess)` values" in `relay/config.mjs` (`DESIGN.md` §12). Everywhere this plan says a gas figure is a placeholder, W1 is the task that fixes it.

### 2.4 Conventions used in the matrix

- **`→ same as FR-X`** — several NFRs restate an FR verbatim in different words (coverage-ledger.md flags this explicitly, e.g. NFR-S-1 restates FR-SET-2). One test proves both; the row says which one to run, not a second copy of it.
- **`[PENDING ARCH]`** — the check's *property* is fully specified; the exact file path, module name, or function signature is not, because it depends on `ARCHITECTURE.md`/`DESIGN.md`. Build against the property; file the exact path once those documents land.
- Contract/relay/wall file paths below assume: `contracts/` (Foundry: `src/`, `test/`, `script/`), `relay/` (Node.js), `wall/` (dashboard). This is a **T2 assumption**, stated here once rather than per-row — booth's own layout (`src/game/`, `src/screens/`, `api/`) is not an assumption, it is fixed by `2026-08-08-booth-frontend-design.md` §12.

---

## 3. Verification matrix

One row per `MUST`/`should` requirement ID. Compressed requirement text — read the ID in `REQUIREMENTS.md` for the full wording.

### M1 — Identity & Handshake

| ID | Requirement | Pri | Ver | Test case / command / artifact | Pass criterion | Phase |
|---|---|---|---|---|---|---|
| FR-ID-1 | No human payment entry on connect | M | D | Demo beat 1 (§7): connect sim vehicle+station, watch session open | Session opens on wall with zero manual field entry | P1 |
| FR-ID-2 | Handshake documented "modelled on" ISO 15118, never "conformant" | M | I | §9 checklist: grep README + pitch copy + UI strings for `conformant`/`compliant` | Zero hits; "modelled on ISO 15118" phrasing present wherever the handshake is described | CONT |
| FR-ID-3 | Verified identity → exactly one wallet | M | T | `forge test --match-test test_RegisterResolvesToOneWallet` [PENDING ARCH: contracts/test/Registry.t.sol] | Lookup returns exactly one non-zero address; re-registering the same identity to a different wallet reverts | P1 |
| FR-ID-4 | Unregistered party can't open a session | M | T | `forge test --match-test test_RevertWhen_OpenSessionUnregisteredParty` | `openSession` reverts for an unregistered address | P1 |
| FR-ID-5 | Party can't present another's identity to redirect payment | M | T | `forge test --match-test test_RevertWhen_SpoofedIdentityRedirectsPayment` | Session resolves to the *registered* wallet only; a spoofed caller cannot redirect the payee/payer address. Same evidence satisfies NFR-S-2 | P1 |
| FR-ID-6 | Registry supports runtime registration, not deploy-only | S | D | Demo: register a new identity live, no redeploy | New identity resolves a wallet without a contract redeploy | P1 |
| FR-ID-7 | Live key derivation from certificate exchange | C | I | **Not tested** — explicitly deferred (REQUIREMENTS.md §11, "explicitly not today") | — | out of scope |

### M2 — Metering

| ID | Requirement | Pri | Ver | Test case / command / artifact | Pass criterion | Phase |
|---|---|---|---|---|---|---|
| FR-MET-1 | Configurable cadence, default 1 Hz | M | D | Demo: change cadence config, observe reading interval | Interval matches config; default run is 1 Hz | P1 |
| FR-MET-2 | Reading carries timestamp, kW, cumulative Δ energy | M | I | Read the `Reading` struct/type against §7.1's wire format (`{sessionId, seq, timestampMs, kW, whDelta, meterId, signature}`) | All 4 data fields present, matches §6 data model | P1 |
| FR-MET-3 | Reading signed by the metering device's key | M | T | `forge test --match-test test_RevertWhen_BadSignature` (or relay-side equivalent, see §5 — IF-1 places verification in the relay, not the contract, per ASM-6) | Wrong-key signature rejected, zero value moved. Same evidence satisfies NFR-S-1 | P1/P2 |
| FR-MET-4 | Realistic charge curve: ramp, plateau, taper | M | D | Demo: run one simulated session to completion, plot kW vs time | All 3 phases visible in the plotted curve | P1 |
| FR-MET-5 | Simulated metering labelled wherever mistakable for hardware | M | I | §9 checklist | See §9 | CONT |
| FR-MET-6 | Readings support negative/reversed flow (discharge) | M | T | `forge test --match-test test_SettleAcceptsNegativeWhDelta` | Negative `whDelta` flips settlement direction (payer/payee swap), does not revert | P1 |
| FR-MET-7 | Replayed reading rejected | M | T | `forge test --match-test test_RevertWhen_ReplayedSeq` | Same `(sessionId, seq)` submitted twice: second call is a no-op, zero additional value moved. Same evidence satisfies DR-2 and NFR-S-3 | P1 |
| FR-MET-8 | Accept real hardware without interface changes | C | A | **Not tested** — explicitly deferred (REQUIREMENTS.md §11) | — | out of scope |

### M3 — Pricing

| ID | Requirement | Pri | Ver | Test case / command / artifact | Pass criterion | Phase |
|---|---|---|---|---|---|---|
| FR-PR-1 | Price per kWh readable at session open | M | T | `forge test --match-test test_OpenSessionRecordsPrice` | `session.priceMonPerKwh` matches the configured rate at open | P1 |
| FR-PR-2 | Separate, distinguishable V2G buy-back rate | M | T | `forge test --match-test test_V2GRateDistinctFromChargeRate` | Charge rate ≠ V2G rate in storage; a `DISCHARGE` session records the V2G rate | P1 |
| FR-PR-3 | V2G rate as a peak premium tied to a demand window | S | D | Demo: trigger a demand window, show the premium rate apply | Rate visibly changes during the window | P1 |
| FR-PR-4 | Rate change mid-session applies only forward | M | T | `forge test --match-test test_RateChangeAppliesOnlyToSubsequentTicks` | Settle tick N at rate R1; change rate to R2; settle tick N+1; tick N's `monDelta` used R1, tick N+1 used R2. Same evidence satisfies DR-3 at the boundary | P1 |
| FR-PR-5 | Live oracle instead of config | C | I | **Not tested** — explicitly deferred (REQUIREMENTS.md §11) | — | out of scope |

### M4 — Settlement contracts

| ID | Requirement | Pri | Ver | Test case / command / artifact | Pass criterion | Phase |
|---|---|---|---|---|---|---|
| FR-SET-1 | Session records payer, payee, price, direction, start time | M | I | Read the `Session` struct against §6's data model | All 5 fields present (+ `status`) | P1 |
| FR-SET-2 | **Security core.** Value moves only on a validated signed reading | M | T | Relay: `test_ReadingsRejectsBadSignature` (§5) — a bad signature never reaches `settle`. Contract: `test_NoBalanceChangeOnStaleReplayedSequence`/`test_RevertWhen_SettleExceedsReserve` (§4) — the contract's own independent guards, since it doesn't re-check signatures (ASM-6). Live: `POST /v1/ops/malformed-settlement` (§8) | Zero balance change without a prior signature check at `POST /v1/readings` (ASM-6). Same evidence satisfies NFR-S-1. Pitch language says "verifies," never "trustlessly verifies on-chain" (REQUIREMENTS.md:365, `API.md:156-158`) | P1/P2 |
| FR-SET-3 | Settled value = metered energy × applicable price, to the tick | M | T | `forge test --match-test test_SettledValueEqualsEnergyTimesPrice --fuzz-runs 512` | `monDelta == whDelta × price` holds across randomised `(whDelta, price)` fuzz inputs, fixed-point rounding rule stated in the test. Same evidence satisfies DR-3 | P1 |
| FR-SET-4 | Session closes when readings stop, within a configurable threshold | M | D | Demo: stop feeding one simulated session, watch it close after the threshold | Status flips to closed; node goes quiet on the wall (§7) | P1 |
| FR-SET-5 | Closing needs no separate reconciliation/invoice transaction | M | I | Read the close path | No second on-chain call required or emitted beyond the last settlement | P1 |
| FR-SET-6 | Every settlement emits an event with session, direction, amount, cumulative energy | M | I | Read the event definition against §6's `Settlement` entity | All 4 fields present in the emitted event | P1 |
| FR-SET-7 | Charge/discharge share one path, differ only by sign/rate | M | I | Read `settle()` (or equivalent): count code paths keyed on `direction` | Exactly one path. A second path (e.g. `if (direction == DISCHARGE) { ... }` duplicating logic) fails this requirement outright | P1 |
| FR-SET-8 | Session can't settle beyond the payer's funded balance | M | T | `forge test --match-test test_RevertWhen_SettleExceedsReserve` — expects `InsufficientReserve(sessionId, required, available)` (§4) | Reverts rather than overdrawing; `reserveOf(payer)` reflects the true remaining balance (UC-2 alt 4a) | P1 |
| FR-SET-9 | Settlement idempotent per `(session, sequence)` | M | T | Contract: `test_RevertWhen_SeqNotMonotonic` — expects `StaleOrReplayedSequence` (§4). Relay: `test_StaleSeqReturns200AcceptedFalse` (§5) | Same `(sessionId, seq)` submitted twice: relay layer returns `200 {accepted:false}` before it reaches chain; contract layer reverts if one somehow gets through. Same evidence satisfies DR-2 alongside FR-MET-7 | P1/P2 |
| FR-SET-10 | Contract exposes live per-session cumulative totals | S | I | Read for a public view/getter; call it after a settlement | Returns the correct cumulative, not stale | P1 |
| FR-SET-11 | Rate-based streaming balance | W | — | **Not tested** — explicitly deferred production path (REQUIREMENTS.md §11) | — | out of scope |

### M5 — Settlement relay / batcher

| ID | Requirement | Pri | Ver | Test case / command / artifact | Pass criterion | Phase |
|---|---|---|---|---|---|---|
| FR-REL-1 | One transaction per session per tick (primary architecture) | M | D | Demo + log inspection: run N sessions for T seconds, count transactions | Tx count ≈ N × T (no aggregation) | P2 |
| FR-REL-2 | Fallback: aggregate many sessions' ticks into one tx/interval | S | D | Demo: force fallback mode (FR-OPS-3), inspect one submitted tx | Multiple sessions' ticks present in a single tx | P2 |
| FR-REL-3 | Nonce management, no collision/stall (mode-dependent) | M | T | `test_NoNonceCollisionUnderParallelSubmission` [PENDING ARCH: relay wallet-pool module] | Sustained parallel submission window: zero "nonce too low"/"already known" RPC errors, zero stalled (pending > 3 blocks, monad-facts.md Q4/Q5) transactions | P2 |
| FR-REL-4 | Degrade on RPC failure/rate-limit, never drop silently | M | D | Demo: FR-OPS-3 forced-degradation drill (§7) | Batches grow or cadence drops; no session vanishes from the wall without a labelled reason | P2 |
| FR-REL-5 | Relay exposes its current mode | M | I | Read the status endpoint / `NetworkSnapshot.mode` field, compare to actual relay behaviour | Reported mode matches observed behaviour at time of read | P2 |
| FR-REL-6 | Booth-app deltas accepted through the same M5 interface as simulated ones | S | T | `test_RelayAcceptsBoothTickSameInterfaceAsSimulated` | A booth-shaped tick and a simulator-shaped tick both traverse the same relay function/queue | P2 |
| FR-REL-7 | Relay holds no participant private key beyond its own hot wallet(s) | M | I | Grep relay source + env/config for stored keys | Only the relay's own pool keys present; no vehicle/station/booth session key ever transits or is stored by the relay. Same evidence satisfies DR-5 | P2 |
| FR-REL-8 | Pool of funded wallets, sized for target tx/s in parallel | M | T | `test_WalletPoolSizedForTargetTps` | Per ADR-2 (ARCHITECTURE.md:1482): **10 wallets, 6 the hard floor**, one in-flight tx each, local nonce tracking — one wallet delivers ~1.67 tx/s at measured occupancy, 6× short of the 10 tx/s budget alone. Every wallet funded above the 10 MON reserve floor (monad-facts.md Q3) | P2 |
| FR-REL-9 | RPC ceiling measured, not assumed | M | T | Read-path: **done**, `node tools/measure-rpc.mjs` (§13.4). Write-path: §6 of this document | Read-path knee: 40–45 req/s (REQUIREMENTS.md:717). Write-path: not yet measured — see §6 and §12 | P0 (read) / P2 (write) |

### M6 — Simulator & spawner

| ID | Requirement | Pri | Ver | Test case / command / artifact | Pass criterion | Phase |
|---|---|---|---|---|---|---|
| FR-SIM-1 | N is a runtime parameter | M | D | Demo: spin up N=5, then N=15 | Session count matches N each time | P2 |
| FR-SIM-2 | Charging and discharging sessions concurrently | M | D | Demo: one spin-up | Both directions present simultaneously | P2 |
| FR-SIM-3 | Independent charge curves, no synchronised clones | M | D | Visual: watch the node grid pulse | No two nodes pulse in lockstep; curves phase-offset | P2 |
| FR-SIM-4 | Runs at rehearsed N and stress N | S | D | Demo: run at 10 (AC-5 floor) and at 60 (current NFR-P-2 target, REQUIREMENTS.md:522 — see §12 note on the stale "50" figure) | Both N values run without a code change | P2 |
| FR-SIM-5 | Staggered starts, not simultaneous | S | I | Read spawner start-offset logic | Non-zero stagger between session starts | P2 |
| FR-SIM-6 | Identities drawn from a pre-registered pool, not registered live during spin-up | M | I | Read the spin-up code path | Zero identity-registration calls inside spin-up; a separate setup/seed script registers the pool pre-freeze (UC-11 bootstrapping note, REQUIREMENTS.md:315) | P2 |

### M7 — Operations dashboard

| ID | Requirement | Pri | Ver | Test case / command / artifact | Pass criterion | Phase |
|---|---|---|---|---|---|---|
| FR-DASH-1 | Scrolling feed of individual settlements | M | D | Demo beat (§7) | Feed shows entries as they land, across all sessions | P3 |
| FR-DASH-2 | Running counters: total settlements, total MON moved | M | D | Demo beat | Counters increment live, monotonically | P3 |
| FR-DASH-3 | Node view pulses each participant on settlement | M | D | Demo beat | Pulse visibly synced to a landing settlement | P3 |
| FR-DASH-4 | Split indicator: charge volume vs V2G volume | M | D | Demo beat | Split visibly shifts when a V2G session runs | P3 |
| FR-DASH-5 | Legible from 10 metres on a projector | M | D | Physical check: view from 10m | Numbers/labels readable. Same evidence satisfies NFR-U-1 | P3 |
| FR-DASH-6 | Shows on-chain vs simulated, never conflates them | M | I | §9 checklist — central item | See §9 | CONT |
| FR-DASH-7 | Renders ≥60 concurrent nodes without dropping below readable frame rate | S | T | Frame-budget test against a synthetic 60-node stress state [PENDING ARCH: rendering stack/perf tooling not yet chosen] | Sustained frame time under budget (target ≤20ms/frame, ≥50fps) for a held 60-node window | P3 |
| FR-DASH-8 | Reconnect-safe streaming transport; never shows frozen-as-live | M | A | Per FD-3 (SSE, self-hosted relay→wall): kill the relay process mid-session, observe wall state, restart relay, observe recovery | Wall shows a labelled disconnected/stale state (not a static live-looking screen) on drop, recovers without a page reload on restart. Same evidence satisfies IF-6 | P3 |
| FR-DASH-9 | Links a settlement to its block-explorer transaction | S | D | Demo: click a feed entry | Opens `testnet.monadvision.com` or `testnet.monadscan.com` at the correct tx hash | P3 |
| FR-DASH-10 | Opens idle, becomes live on operator action, transition visible | M | D | Demo: cold load, then FR-OPS-1 start action | Visible idle→live transition, not a live-on-load default | P3 |

### M8 — Booth app

Full design: `2026-08-08-booth-frontend-design.md`. Grouped test suite: §10 of this document.

| ID | Requirement | Pri | Ver | Test case / command / artifact | Pass criterion | Phase |
|---|---|---|---|---|---|---|
| FR-BOOTH-1 | Playable from QR scan: no install, no login, no wallet | S | D | Demo: fresh device, scan QR | Reaches `charging` screen state with none of the three | P4 |
| FR-BOOTH-2 | Never blocks on network; never shows a network error to a participant | S | D | Demo: disable network mid-session (airplane mode) | No error surfaces to the player; degradation ladder L2 (booth spec §9) engages silently | P4 |
| FR-BOOTH-3 | ~~Reports energy deltas to the relay.~~ **Superseded 2026-08-08 by §16** — the booth app makes zero chain calls; taps go to the game server (M10) only, never the relay | — | — | **Not tested.** Testing relay delivery here would test a path §16 deliberately deleted | — | — |
| FR-BOOTH-4 | Fully playable with relay unreachable | S | D | Demo: block relay endpoint, play a full round | Full game loop completes; leaderboard falls back to localStorage (booth spec §9, L2) | P4 |
| FR-BOOTH-5 | No credentials/private keys/payment details collected | M | I | §9 checklist | See §9 | CONT |
| FR-BOOTH-6 | Reward decided by skill, never a random attribute | M | I | Read `src/game/engine.ts` (or equivalent): confirm rarity (`src/game/cars.ts`) never enters the score formula | Score is a pure function of `whCharged`/`whDischarged` only (booth spec §5) | P4 |
| FR-BOOTH-7 | Reward terms stated before play | M | I | UI walkthrough: confirm terms panel copy (booth spec §7) renders before or at the leaderboard screen a player sees pre-claim | Terms panel text matches booth spec §7's final copy, shown before a `CLAIM` action | P4 |
| FR-BOOTH-8 | No vote solicitation; states placement-dependency as fact | M | I | Grep all UI copy + share-card text for "vote"/"help us win" | Zero hits; the £240-conditional-on-placing sentence (booth spec §7) present verbatim | P4 |
| FR-BOOTH-9 | Ephemeral client-side key generated + silently registered before first delta | S | D | Intercept the first `/api/tick` call for a fresh session | A registration call for a freshly generated key preceded it; UI never renders a key-entry field (grep component tree) | P4 |
| FR-BOOTH-10 | Public leaderboard, live standings, updates ≥ every 5s | S | D | Demo: watch the public screen for 15s | At least 3 refreshes observed | P4 |
| FR-BOOTH-11 | Public screen seals 10s before close, unambiguous sealed state | S | D | Demo: watch through close | Hard swap to `FINAL STANDINGS SEALED` at T-10s, not a freeze (booth spec §3.8) | P4 |
| FR-BOOTH-12 | Standings reviewed before publication, revealed after the event, not at venue | M | I | Process check: confirm publication happens in Discord post-event, not on the venue screen | No winner name shown at the venue | P4/CONT |
| FR-BOOTH-13 | Effective tap rate capped at **30/s**, above any human rate (five fingers ≈25/s); the cap must sit outside, not inside, the human range | M | T | `test_ScoreCapsAtThirtyTapsPerSecond` — see §10. **Corrected 2026-08-08: current requirement is 30/s, not 20/s** — a 20/s cap let a 4-finger human and a script tie at the same score (5,732), reintroducing exactly the tie-at-the-money problem soft saturation exists to prevent (REQUIREMENTS.md:437) | Any input ≥30 taps/s yields an identical score; no score at or below a plausible human ceiling matches a scripted one | P4 |
| FR-BOOTH-14 | Accepts up to 5 concurrent pointers; instructions say so | M | D | Demo: 3–5 simultaneous touches on a real device | All pointers counted; instructions text states "multiple fingers allowed" | P4 |
| FR-BOOTH-15 | ~~6-second settlement interval, phase-staggered per player.~~ **Withdrawn 2026-08-08** (REQUIREMENTS.md:439) — booth sessions no longer settle on-chain at all (§16), so there is no per-player chain interval to test | — | — | **Not tested — the requirement itself no longer exists.** Do not build or test a phase-stagger; see §16 items below instead | — | — |
| FR-BOOTH-16 | ~~Session-open scheduling.~~ **Withdrawn 2026-08-08** with FR-BOOTH-15 (REQUIREMENTS.md:440), same reason | — | — | **Not tested** | — | — |

### §16 — The demo/backend split (game server M10, FR-SPLIT-1..8)

New 2026-08-08 (REQUIREMENTS.md §16, lines 767–824). The booth app makes **zero chain calls** — it runs the settlement engine in memory against a game server (M10), and the room's combined energy settles once, at the end, as a single real `settleRoomAggregate` transaction from the team's own funded wallet. This replaces the earlier booth-on-chain design entirely; FR-BOOTH-3/15/16 above are dead, not just deprioritised.

| ID | Requirement | Pri | Ver | Test case / command / artifact | Pass criterion | Phase |
|---|---|---|---|---|---|---|
| FR-SPLIT-1 | Booth app makes zero chain calls, holds no key material | M | I | `grep -rniE "ethers|web3|viem|wagmi|rpc.?url|privatekey|wallet" booth/src booth/api` (adjust to the real booth source root) — run in CI, not just by hand | Zero hits for any chain client, wallet library, RPC URL, or key material anywhere in the booth bundle | P4 |
| FR-SPLIT-2 | Booth surfaces show nothing that looks verifiable but isn't — no tx hashes, block numbers, addresses, explorer links | M | I | **Automated, not a manual read** — `test_BoothResponsesContainNoChainArtifacts`: regex every booth API response schema and the built client bundle for `0x[a-fA-F0-9]{40,64}`, the string `monadvision`/`monadscan`, or a field named `txHash`/`blockNumber`/`address`. Run as a CI check, not a checklist item someone can skip at 17:50 | Zero matches. Simulated MON/kWh figures are fine — nothing that could be mistaken for a receipt is | P4 |
| FR-SPLIT-3 | Scoring is server-authoritative | M | T | `test_ClientReportedScoreIgnored` — POST a fabricated score to the game server's session-end endpoint, assert the leaderboard reflects the server's own tap-event-derived computation, not the submitted value | Fabricated score never appears on the leaderboard | P4 |
| FR-SPLIT-4 | Game server rate-caps taps per connection at the engine cap (30/s, FR-BOOTH-13) | M | T | `test_ServerSideRateCapBinds` — send a synthetic tap stream at 60/s directly to the game server's ingest endpoint (bypassing the client entirely), assert the server's own computed score matches the 30/s-capped curve, not the raw 60/s one | Server-side score identical to a genuine 30/s stream — proves the cap isn't just cosmetic in the client | P4 |
| FR-SPLIT-5 | Both surfaces carry a permanent, visible label | M | D | Demo: view phone and dashboard side by side | Phone reads `SIMULATION — same engine, nothing on-chain`; dashboard reads `LIVE — Monad testnet` + contract address. Both visible at all times, not a dismissible toast | P4 |
| FR-SPLIT-6 | Player count unbounded by the chain; any limit is the game server's and is stated | M | D | Demo/inspection: check the game server's own connection-count behavior and any stated limit in its UI copy | No chain-derived cap exists; if the game server itself caps concurrent players, that cap is visibly stated | P4 |
| FR-SPLIT-7 | Game server exposes the room aggregate (total kWh, total MON) for one `settleRoomAggregate` submission | M | D | Demo: query the aggregate endpoint mid-event, cross-check its sum against a manual tally of a few known sessions | Aggregate figure matches the manual tally within rounding | P5 |
| FR-SPLIT-8 | Aggregate tx is pre-signed with automatic retry; rehearsal aggregate minted 10 min before the pitch; a stall >5s shows the rehearsal hash with a plain statement of what it is | M | D | **The stall path is the highest-value test in this whole section — it's the one most likely to fire live.** `test_StallFallbackShowsRehearsalHashWithLabel`: simulate the live `settleRoomAggregate` send hanging past 5 seconds (mock a slow/non-responding RPC), assert the presenter-facing screen swaps to the rehearsal hash within the 5s window, with visible text stating it's the rehearsal figure, not silently presenting it as live | Never a bare "pending..." spinner past 5s; never the rehearsal hash presented without the disclosure text | P5 |

**Booth engine tests carried over unchanged from the pre-split design** (§10 below) — the tap-rate cap, score determinism, frame-rate independence, and multi-pointer handling are properties of the settlement *engine*, and §16.2's own design goal is that the engine is "the literal same accounting module both sides use" (REQUIREMENTS.md:788). Only the *transport* changed (game server instead of relay); the engine math did not.

### M9 — Demo control & observability

| ID | Requirement | Pri | Ver | Test case / command / artifact | Pass criterion | Phase |
|---|---|---|---|---|---|---|
| FR-OPS-1 | One deterministic start action | M | D | Demo: press start | Network reaches the same state every rehearsal | P5 |
| FR-OPS-2 | Surge ramps down simulated sessions proportionally; never exceeds the rehearsed ceiling | S | D | Demo: trigger surge with phones connected | Simulated count drops as phone count rises; peak concurrency stays ≤ rehearsed limit (UC-10) | P5 |
| FR-OPS-3 | Operator can force degraded mode, to rehearse it | S | D | Demo: press the forced-degradation control | Relay/wall visibly enter degraded mode on command, not only under real RPC failure | P5 |
| FR-OPS-4 | Full demo beat runs with zero phones connected | M | D | Rehearsal: run the full §7 script with all phones off | Every beat lands identically; presenter script needs no edits | P5 |
| FR-OPS-5 | Recorded fallback exists before code freeze | M | I | Check the recording file exists, plays, and matches the current build | File present, dated before 18:00 freeze, watchable start-to-finish. Same evidence satisfies AC-10/NFR-R-4 | CONT |
| FR-OPS-6 | Logs retain enough detail to confirm a settlement landed on-chain | S | I | Pick 3 random settlements from a rehearsal run, find their tx hash + receipt in logs | Each is traceable from log entry to on-chain receipt | P5 |
| FR-OPS-7 | Operator control submits one deliberately malformed/unsigned settlement on demand | S | D | §8 of this document | See §8 | P5 |

### Non-functional requirements

| ID | Requirement | Ver | Test case / command / artifact | Pass criterion | Phase |
|---|---|---|---|---|---|
| NFR-P-1 | Settlement cadence 1 Hz, configurable | D | → same as FR-MET-1 | — | P1 |
| NFR-P-2 | **Rewritten 2026-08-08 (§16).** ~10 on-chain simulated sessions at 1Hz — comfortably inside the measured 10 tx/s write ceiling. Booth players are unbounded and contribute zero chain load; their only limit is the game server (FR-SPLIT-6), not this NFR | D | Demo/load: run §6's write-path measurement at N≈10, separately confirm booth accepts a much larger synthetic player count with no chain-side effect | ~10 real on-chain sessions settle live within the measured ceiling; booth player count is demonstrably not chain-gated | P2/P5 |
| NFR-P-3 | Settlement visible on wall ≤1s after landing | D | Stopwatch from tx receipt to wall render, 10 samples | p95 ≤ 1s. Note: reading `"latest"` (Proposed) state is required to hit this — see monad-facts.md Q8, "already at or past the 1-second budget" if waiting for `finalized` | P3 |
| NFR-P-4 | Dashboard frame rate: readable, no visible stutter | D | Visual, during load test | No dropped-frame stutter perceptible at target concurrency | P3 |
| NFR-P-5 | Booth app 60fps on mid-range Android | T | **Manual device test** — Chrome DevTools remote profiling on a real mid-range Android device. No CI device farm in this build's budget; say so rather than claim a script that doesn't exist | Sustained ≥60fps through one full round | P4 |
| NFR-P-6 | QR scan → playable ≤3s on venue wifi | D | Stopwatch, venue wifi, 5 samples | p95 ≤ 3s | P4 |
| NFR-R-1 | Demo completes 3 minutes without a visible freeze | D | Full rehearsal, timed | No freeze observed end-to-end | P5 |
| NFR-R-2 | Any single component failure degrades, doesn't end, the demo | D | Kill relay, then chain RPC, then wall, one at a time, mid-rehearsal | Demo continues in each case, labelled degraded | P5 |
| NFR-R-3 | Degraded operation labelled, never disguised | I | §9 checklist | See §9 | CONT |
| NFR-R-4 | Recorded fallback exists before freeze | I | → same as FR-OPS-5 | — | CONT |
| NFR-S-1 | No value moves without a valid signed metering event | T | → same as FR-SET-2 | — | P1/P2 |
| NFR-S-2 | Identity spoofing doesn't redirect payment | T | → same as FR-ID-5 | — | P1 |
| NFR-S-3 | Replayed readings rejected | T | → same as FR-MET-7 | — | P1 |
| NFR-S-4 | No private key committed to the repository | I | §9 checklist — `git log -p -- '*.env' '*.pem' '*key*'` plus a secret-pattern scan before every push | Zero matches. **Gates every push, not just CONT** | CONT |
| NFR-S-5 | Relay hot wallet holds only demo funds; exposure stated in README | I | Read README for the exposure statement; cross-check wallet balance is demo-scale | Statement present; balance consistent with monad-facts.md Q6's burn estimate, not production-scale | CONT |
| NFR-S-6 | Booth app collects no credential/key/payment detail | I | → same as FR-BOOTH-5 | — | CONT |
| NFR-U-1 | Wall readable from 10m by a first-time viewer | D | → same as FR-DASH-5 | — | P3 |
| NFR-U-2 | Charge vs discharge tellable without reading text | D | Demo: show a colleague a live V2G flip with sound off, ask which direction | Correctly identified without narration | P3 |
| NFR-U-3 | Booth app playable one-handed, portrait, scratched screen, bright room | D | Physical test: real device, one hand, direct sunlight or bright indoor light | Fully playable | P4 |
| NFR-U-4 | Respects `prefers-reduced-motion` | I | Set the OS flag, reload booth app | Sweeps/particles/shake replaced by crossfades (booth spec §10) | P4 |
| NFR-M-1 | Every simplification documented in README | I | §9 checklist | See §9 | CONT |
| NFR-M-2 | Contract source verifiable against deployed address | I | Run the verification API flow (RUNBOOK.md §5), then check the explorer shows verified source | Green "verified" badge on at least one of the three explorers | CONT |
| NFR-M-3 | Repository public, deployment operational on testnet | I | Check repo visibility + live contract/relay/wall URLs | Public repo; all three reachable | CONT |
| NFR-M-4 | Trust boundary (ASM-6) stated in README + pitch, with the named production fix | I | §9 checklist | See §9 | CONT |

### Acceptance criteria

| ID | Criterion | Ver | Proven by | Phase |
|---|---|---|---|---|
| AC-1 | Session opens with no human entering payment details | D | §7 beat 1 | P5 |
| AC-2 | Value moves at 1Hz, on-chain, against signed metering | D | §7 beat 2 + FR-SET-2/3 test evidence | P5 |
| AC-3 | Unplugging stops payment, no invoice step | D | §7 beat 4 | P5 |
| AC-4 | V2G session pays vehicle, same path, sign flipped | D | §7 beat 3 | P5 |
| AC-5 | ≥10 concurrent sessions settle live, both directions | D | §6 write-path measurement + §7 rehearsal at N=10 | P5 |
| AC-6 | Wall shows feed, counters, node view, split | D | §7, FR-DASH-1..4 | P5 |
| AC-7 | Settlement without a signed reading is refused | D | §8 — deliberately not `T` (REQUIREMENTS.md:600) | P5 |
| AC-8 | Demo survives forced RPC degradation | D | §7 forced-degradation drill | P5 |
| AC-9 | Contracts deployed + verifiable; repo public | I | → same as NFR-M-2/M-3 | CONT |
| AC-10 | Recorded fallback exists | I | → same as FR-OPS-5 | CONT |
| AC-11 | Every simplification documented | I | → same as NFR-M-1 | CONT |

### Data and interface rules (cross-referenced, not re-specified)

| ID | Rule | Proven by |
|---|---|---|
| DR-1 | Settlement references exactly one validated Reading or batch | FR-SET-2/IF-5 tests — a settlement event's reference always resolves to a real, verified reading set |
| DR-2 | `(sessionId, seq)` unique, replays rejected | FR-MET-7 + FR-SET-9 tests |
| DR-3 | Sum of `monDelta` = sum of `whDelta` × applicable rate | FR-SET-3 + FR-PR-4 tests |
| DR-4 | Timestamps UTC ms; client time advisory, server/chain time authoritative | Inspection: confirm settlement ordering/thresholds use server or block time, never a client-supplied timestamp, in both the relay and the booth `/api/session` clock-offset logic (booth spec §8) |
| DR-5 | No entity stores another party's private key | → same as FR-REL-7 |
| IF-1 | Relay verifies signature against registered `meterId` key before value moves | → same as FR-MET-3/FR-SET-2 |
| IF-2 | `seq` increases monotonically per session | Covered inside FR-MET-7's replay test — add an out-of-order (lower `seq` than current max) case to the same test |
| IF-3 | `whDelta` may be negative (discharge) | → same as FR-MET-6 |
| IF-4 | Batch carries energy deltas, not pre-computed MON; contract computes `whDelta × price` on-chain | → same as FR-SET-3 — inspect the batch payload schema to confirm no MON amount field exists |
| IF-5 | Partial batch failure settles nothing in that batch | `forge test --match-test test_BatchEntryFailedRevertsWholeBatch` (§4) — expects `BatchEntryFailed(index, reason)`; one bad entry in an N-entry `settleBatch` reverts all N, zero balance change |
| IF-6 | Settlement events via reconnect-safe streaming, dashboard recovers without reload | → same as FR-DASH-8 |
| IF-7 | Every rendered figure traceable to an event or an explicit simulation flag | §9 checklist, folded into FR-DASH-6 |
| IF-8 | Booth calls fire-and-forget from the client | Inspection: confirm no booth API call is `await`-blocking render (booth spec §8 principle) |
| IF-9 | Booth writes idempotent on `(sessionId, seq)` | → same as FR-MET-7 pattern, applied to `/api/tick` |
| IF-10 | Relay tolerates a burst of ~60 new sessions within 20s | Load test: fire 60 `/api/session` calls across a 20s window, measure accept rate |

---

## 4. Contract test suite

`contracts/test/PlugNPaySettlement.t.sol` (Foundry). One deployed contract, `PlugNPaySettlement` — identity registry + rate registry + session/settlement logic (`API.md` §intro DECISION). Grouped by concern; every case below also appears as a matrix row above. Function/event/error names below are quoted directly from `API.md` §1, not invented — this section was rewritten once `API.md` landed, replacing an earlier draft that had to guess them.

**Session lifecycle**
- `test_RegisterIdentityStoresRoleAndWallet` — `registerIdentity(address, Role)`, read back via `getIdentity` (FR-ID-3)
- `test_RevertWhen_ReregisteringWallet` — expect `IdentityAlreadyRegistered(wallet)` (FR-ID-3's "exactly one wallet")
- `test_OpenSessionRecordsPayerPayeeDirectionStart` — `openSession(sessionId, payer, payee, direction)`, read back via `getSession` (FR-SET-1)
- `test_RevertWhen_OpenSessionUnregisteredParty` — expect `UnregisteredIdentity(party)` (FR-ID-4)
- `test_RevertWhen_OpeningDuplicateSessionId` — expect `SessionAlreadyOpen(sessionId)` (not in the original ledger-derived draft of this plan — found only once the real error list existed)
- `test_CloseSessionForTimeoutCase` — `closeSession(sessionId)`, the FR-SET-4 case where readings simply stop and no `isFinal=true` tick ever arrives
- `test_IsFinalFoldsCloseIntoSettle` — `settle(..., isFinal: true)` closes the session in the same call; `closeSession` is never invoked when a final tick arrives cleanly (FR-SET-5, FR-BOOTH-16)

**The settlement path**
- `test_SettleComputesMonDeltaFromWhDeltaTimesRate --fuzz-runs 512` — exact formula from `API.md:143`: `monDeltaWei = (abs(whDelta_mWh) × monWeiPerKwh) / 1_000_000`. Golden case: `whDelta=2000 mWh, monWeiPerKwh=1.2e17` → `monDeltaWei=2.4e14` (`API.md:146-147`) — assert this exact value, not just the formula, then fuzz around it (FR-SET-3, DR-3)
- `test_SettleEmitsSettledEventWithAllEightFields` — `Settled(sessionId, direction, seq, whDelta, monDeltaWei, cumulativeWhSession, cumulativeMonWeiSession, isFinal)` (FR-SET-6)
- `test_SetRateThenSettleAppliesRateAtTick` / `test_RateChangeAppliesOnlyToSubsequentTicks` — `setRate(context, monWeiPerKwh)` then `settle`; a rate change between two ticks must not retroactively reprice the earlier one (FR-PR-4)
- `test_RevertWhen_SettleBeforeRateSet` — expect `RateNotSet(context)`
- `test_GetNetworkSnapshotReflectsCumulativeTotals` — `getNetworkSnapshot()` (FR-SET-10)

**Idempotency on `(sessionId, seq)` — two layers, both real, both tested separately**
- **Relay layer** (before it ever reaches chain): `POST /v1/readings` on a stale/replayed `seq` returns `200 { accepted: false }`, never a 5xx and never a contract call (`API.md:320,325-327`) — this is §5's test, not this section's
- **Contract layer** (the backstop if a stale `seq` reaches `settle`/`settleBatch` anyway): `test_RevertWhen_SeqNotMonotonic` — expect `StaleOrReplayedSequence(sessionId, got, lastSeen)` (IF-2, DR-2, FR-SET-9, FR-MET-7)

**Replay rejection** — the `StaleOrReplayedSequence` case above; replay *is* the non-monotonic/duplicate-seq case, not a separate mechanism.

**The funded-balance guard (FR-SET-8)**
- `test_DepositThenSettleWithinReserve` — `deposit(payer)` then `settle` within the deposited amount
- `test_RevertWhen_SettleExceedsReserve` — expect `InsufficientReserve(sessionId, required, available)`
- `test_ReserveOfReflectsRemainingBalance` — `reserveOf(payer)` after a partial settlement

**Sign-flip symmetry (FR-SET-7) — proves charge and discharge share one path**
- `test_ChargeMovesMonPayerToPayee` — `direction: CHARGE`, assert MON moves `payer → payee` (`API.md:85`'s explicit resolution)
- `test_DischargeMovesMonPayeeToPayer` — `direction: DISCHARGE`, assert MON moves `payee → payer` (the station pays the vehicle, at the V2G rate) — same `settle()` function as the charge case, `direction` fixed at `openSession` and read, never re-decided per tick
- `test_NegativeWhDeltaAcceptedOnDischargeSession` — `whDelta` is `int256`; a `DISCHARGE` session's ticks carry the sign convention IF-3 describes (FR-MET-6)

**Rate changes apply only forward (FR-PR-4)** — see settlement path above.

**Access control**
- `test_RevertWhen_NonRelayCallsSettle` — expect `NotRelay(caller)` (ASM-6 — only `RELAY_ROLE` may move value)
- `test_RevertWhen_NonOperatorCallsSetRate` — expect `NotOperator(caller)`
- `test_RegisterIdentityRoleGate` — `API.md` §7 TBD #6 leaves open whether `registerIdentity` should be `RELAY_ROLE`-gated, `OPERATOR_ROLE`-gated, or both (the doc currently grants both). Write this test to assert whichever the build actually implements, and treat a passing test here as also *closing* that TBD, not just checking it

**Negative cases where value must NOT move — the security core (FR-SET-2)**
- `test_NoBalanceChangeOnStaleReplayedSequence`
- `test_NoBalanceChangeWhenReserveInsufficient`
- `test_BatchEntryFailedRevertsWholeBatch` — one bad entry in `settleBatch` reverts the **entire array**, per `BatchEntryFailed(index, reason)`'s own stated semantics (IF-5)
- No on-chain signature check exists to test here **by design** — `settle`/`settleBatch` trust the caller's `RELAY_ROLE` grant as the attestation that `POST /v1/readings` already verified the signature (`API.md:154-158`, ASM-6). The signature check itself is §5's test, not this section's — a contract-level "bad signature" test would be testing something the contract deliberately does not do.

**Batch atomicity (IF-4, IF-5)**
- `test_SettleBatchAllOrNothing_BatchEntryFailed`
- `test_SettleEntryStructCarriesEnergyNotMon` — inspect the `SettleEntry` struct: `whDelta` is `int256` (mWh), no MON-denominated field exists — confirms IF-4 structurally, not just by convention

**Gas — hardcoded limits, never `eth_estimateGas` on the hot path (project `CLAUDE.md` hard rule, `API.md` §1.5)**
- `test_SettleGasUnderHardcodedLimit` — call `settle()`, assert gas used stays under the hardcoded **150,000** starting limit (`API.md:225` — itself `monad-facts.md` Q6's unsourced-but-stated "assumed practical" figure, TBD #1 in `API.md` §7 until a real measurement replaces it pre-freeze). If actual usage exceeds it, Monad still bills the full limit (`gas_paid = gas_limit × price_per_gas`) — this is a cost bug, not a correctness bug, and it's silent unless someone checks
- Inspection, not a test: grep the relay source for `estimateGas` calls anywhere in the settlement path — zero expected hits

Run: `forge test --match-path 'contracts/test/PlugNPaySettlement.t.sol' -vv`. Fast, offline, no testnet RPC — every case above runs against Foundry's local EVM. Compiler: Solidity `^0.8.20+` per `API.md` §1 (exact pinned version is `API.md` §7 TBD #1's sibling, owner: whoever writes M4 first).

---

## 5. Relay test suite

`relay/test/` (assume Node.js — Vitest or the project's chosen runner; exact tool is an architecture decision, the HTTP surface under test is not — every endpoint below is quoted from `API.md` §3–§4).

**Signature verification (`POST /v1/readings`, §2's EIP-712 scheme)**
- `test_ReadingsRejectsBadSignature` — a reading signed with the wrong key gets `400 { error: { code: "BAD_SIGNATURE" } }` and never reaches a `settle`/`settleBatch` call (FR-MET-3, IF-1)
- `test_ReadingsAcceptsValidSignature` — happy path: `202 { accepted: true, sessionId, seq }`, positive control for the above
- `test_ReadingsRejectsUnregisteredMeter` — `403 { error: { code: "UNREGISTERED_METER" } }` when `meterId` doesn't resolve via `getIdentity`
- `test_SignatureCoversAllFieldsExceptKW` — mutate any signed field (`sessionId`, `seq`, `timestampMs`, `whDelta`, `meterId`) after signing, assert rejection; mutating only `kW` (explicitly excluded from the signed struct, `API.md:263`) must NOT invalidate the signature — this is the one field a test could wrongly assume is covered

**Nonce management under parallel submission**
- `test_NoNonceCollisionUnderParallelSubmission` — the 10-wallet pool (6 hard floor, `ARCHITECTURE.md` ADR-2), each submitting on its own nonce sequence concurrently, one in-flight tx per wallet, zero collisions (FR-REL-3, FR-REL-8)
- `test_SerialisedPipelineUnderBatchMode` — when running in FR-REL-2 fallback mode, confirm the next `settleBatch` is not submitted until the previous confirms or is abandoned (REQUIREMENTS.md:382)
- `test_SettleUsesSendRawTransactionSync` — inspect the submission code path: every `settle`/`settleBatch` call uses `eth_sendRawTransactionSync` with an explicit `timeout_ms`, no separate `eth_getTransactionReceipt` poll exists anywhere (`API.md:33`, ADR-3) — this is a "grep for the poll and find none" test as much as a behavioural one

**Degraded-mode transitions (`GET /v1/mode`, `POST /v1/ops/degrade`)**
- `test_DegradesOnRepeated429` — simulate RPC 429s, confirm `GET /v1/mode` transitions `"live" → "degraded"` rather than sessions silently dropping (FR-REL-4)
- `test_ModeFieldReflectsActualState` — `{ mode, since, walletPoolSize, sessionsActive }` matches actual behaviour at every transition (FR-REL-5)
- `test_ForcedDegradeViaOperatorControl` — `POST /v1/ops/degrade { force: true }` flips the same `mode` field a real 429 would (needed for the rehearsal in §7 to mean anything); `{ force: false }` releases it

**Queue behaviour under RPC 429**
- `test_QueuesRatherThanDropsOnRateLimit` — ticks queue and settle on recovery per UC-2 alt 5a; if recovery never comes, the session closes at the last confirmed state rather than hanging forever
- `test_ReadingsReturns429WhenSheddingLoad` — per `API.md:378`'s status table, a shedding relay returns `429` to the reading's own sender, distinct from a downstream RPC 429 — don't conflate the two in the same assertion

**Idempotency**
- `test_StaleSeqReturns200AcceptedFalse` — exact contract from `API.md:320,325-327`: a replayed or ≤-last-seen `seq` on `POST /v1/readings` returns `200 { accepted: false, reason: "stale-seq", lastSeen }`, **never a 5xx**, before it ever reaches a batch

**SSE stream to the dashboard (`GET /v1/stream`)**
- `test_StreamEmitsSettlementEventWithTxHashAndIsSimulated` — `settlement` event payload carries `Settled`'s 8 fields plus `txHash`, `blockNumber`, `isSimulated` (`API.md:407`) — `isSimulated` is what lets FR-DASH-6/IF-7 be checked mechanically rather than by eyeballing the wall
- `test_StreamHeartbeatEvery15s` — a silent-but-alive connection is distinguishable from a dead one (`API.md:423`)
- `test_ReconnectReplaysFromLastEventId` — send `Last-Event-ID`, assert events after that ID replay from the relay's ring buffer (buffer depth is `API.md` §7 TBD #7 — untested until sized) (IF-6, FR-DASH-8)

**The booth-session path — flag this test suite reads differently depending on which sibling doc wins (see §12)**
- `test_RelayAcceptsBoothTickSameInterfaceAsSimulated` — per `API.md` §3's DECISION, the wall backend forwards accumulated `whDelta` from `/api/tick` to `POST /v1/readings`, translating booth's shape into the canonical §2 Reading — same endpoint, same idempotency, same signature check as any other meter (FR-REL-6)
- `test_BoothForwardingRespectsOnChainFlag` — **contradiction test, not a normal case.** `ARCHITECTURE.md` ADR-6 says this forwarding is gated by `BOOTH_ONCHAIN` (default `false`); `API.md` §3 describes it as unconditional, with no flag mentioned anywhere in that document. Write this test to assert whichever the actual relay code does, and treat its first run as the tiebreak — don't assume which sibling document the implementer followed
- `test_BoothSessionRegistersEphemeralKeySilently` (FR-BOOTH-9 — relay side of the registration call)

Run: `npm run test:relay` [PENDING ARCH: exact script name — name it this unless `DESIGN.md` picks otherwise]. No testnet RPC needed — mock the chain client; the one thing this suite must NOT do is spend real MON on every CI run.

---

## 6. The FR-REL-9 load harness (build task **W0**)

`ARCHITECTURE.md` §12 names the write-path measurement **W0**, budgeted 20 minutes, and treats it as the single gate the whole per-tick architecture stands or falls on (ADR-1). Everything in this section is that task's spec.

### 6.1 What's measured, what's provisional, and what's still genuinely open

**Read-path: done, final.** `node tools/measure-rpc.mjs` against `https://testnet-rpc.monad.xyz`. Result in REQUIREMENTS.md §13.4 (lines 703–718): clean to ~40 req/s, first refusals at 45. Closed CON-5.

**Write-path: done, but provisional — re-run is a real, named requirement, not a nice-to-have.** `node tools/measure-write-rpc.mjs` from a single wallet (REQUIREMENTS.md lines 726–743, this is the tool's real name — not `probe-write.mjs`/`measure-write-rpc.mjs --max 80` this plan cited in an earlier draft before the actual run landed):

| tx/s | ok | p50 ms | verdict |
|---|---|---|---|
| 2 | 6/6 | 52 | clean |
| 5 | 15/15 | 50 | clean |
| 10 | 30/30 | 50 | **clean — ceiling** |
| 15 | 43/45 | 159 | refused |
| 20 | 58/60 | 530 | refused |
| 30 | 85/90 | 1,677 | refused |

**10 tx/s clean from one wallet — exactly what the on-chain design needs (~10 sessions × 1 Hz), zero margin.** Two reasons this is provisional, both stated in REQUIREMENTS.md:739 and both worth re-testing rather than trusting: (1) it ran from the well-known public test key `0x…0001`, which other teams may also be hammering, so contention could be depressing the number; (2) failures above 10 tx/s classified as "other," not specifically rate-limit/nonce/mempool, so the refusal mechanism itself is unidentified. **`test_WriteCeilingRisesWithWalletPool`**: re-run as `PRIVATE_KEY=k1,k2,k3 node tools/measure-write-rpc.mjs --send` with multiple funded wallets — REQUIREMENTS.md:741 states plainly that FR-REL-8 (the wallet pool) "remains unproven" until this runs, because whether 10 tx/s is the *node's* ceiling or *one account's* nonce-ordering ceiling is exactly what decides whether the pool is essential or wasted effort.

**A methodology bug worth testing for, not just reading about (REQUIREMENTS.md:743).** The first write-path run hardcoded `maxFeePerGas` at 60 gwei against a live 102 gwei base fee — every send failed "fee too low," and the tool reported a fabricated sub-2-tx/s ceiling that was purely a client bug, not a chain limit. `test_FeesReadFromChainNotHardcoded` — inspect the measurement tool: assert `maxFeePerGas` is read live per run, never a hardcoded constant. **Discard any capacity figure this plan or any teammate cites that predates this fix** — a number under ~2 tx/s from this tool is almost certainly the fee bug, not a real ceiling.

**Booth no longer has a write-path number to worry about at all.** §16 (2026-08-08) moved booth off-chain entirely — this section's numbers now govern only the real rail (M1–M7)'s ~10 simulated sessions, not a 60-player crowd. The one remaining on-chain crowd interaction is §16.4's single `settleRoomAggregate` transaction (FR-SPLIT-7/8, tested above in the §16 table) — one transaction against a 10 tx/s ceiling is, in REQUIREMENTS.md's own words, "tenfold margin" (line 810), a different and much safer problem than the withdrawn 60-phones-at-once design.

### 6.2 Harness design (eval-harness method: define success → dataset → metrics → baseline → decision)

**E1 — Define success.** Can the relay sustain real signed `settle()` transactions, from the funded wallet pool, at the rate the current design needs — **10 tx/s**, which is both AC-5's floor (10 sessions × 1 tick/s) and NFR-P-2's current 60-player target under the 6s cadence (60 ÷ 6 = 10 tx/s, REQUIREMENTS.md:522) — with headroom, not just at the edge.

**E2 — Build the "dataset."** Not ML data — a rate-ramp schedule, mirroring `measure-rpc.mjs`'s `phase()` pattern but against `eth_sendRawTransactionSync` (monad-facts.md Q7: one RPC call per tick, receipt included, vs. 2–4 calls/tick without it — use the sync variant or the harness measures the wrong thing). Each phase submits real `settle()` calls carrying valid signed readings from the fixture set (§11), from wallets in the actual relay pool, at a held rate for 5–6s before stepping up — same cadence `measure-rpc.mjs` already used.

**E3 — Metrics.** Per rate step: accepted count, first-refusal rate (429s), **revert count** (distinct from RPC-level failure — monad-facts.md Q14/`docs/monad_dev_resources.md:237`, "tx can be included, pay gas, still revert. Always check receipts"), nonce-error count, p50/p95 latency (send→receipt), MON burned (cross-check against monad-facts.md Q6's 0.00635–0.015 MON/tx estimate — a number wildly outside that band means the gas limit is miscalibrated, not that the measurement is wrong).

**E4 — Baseline + harness, one command.** `node tools/probe-write.mjs` — named and placed by `DESIGN.md` §0.1/§12 (build wave W0), sibling to `tools/measure-rpc.mjs`. Run alongside `node tools/fund-pool.mjs`, which claims from the faucet and brings the 10-wallet pool to its funded state (§6 go-live checklist target: ≥100 MON combined, `DESIGN.md` §12's own W0 closing bar). Run both from the **venue network**, not from home — monad-facts.md Q2 confirms the per-IP-vs-per-key-vs-global scope is undocumented, and if it's per-IP and the venue NATs the room behind one address, every other team sharing that address changes the real ceiling. A measurement taken from a residential connection tells you nothing about the number that matters on the day.

**E5 — Slice + report + decision rule.** Reproduce §13.4's table shape, write-path column added. Decision rule, now precise per `ARCHITECTURE.md` ADR-1 (line 1477) rather than the looser version this section originally proposed: **pass bar is 10 tx/s sustained with 429s below 1% over a held 60-second window. Make the call on the measurement, at 14:10, not on stage** (echoing REQUIREMENTS.md:700's "not on stage," now with an actual deadline attached). Below that bar, switch to FR-REL-2 batching before freeze; FR-REL-3 collapses to its serialised form (§5.6 Mode 2 in `ARCHITECTURE.md`).

**ADR-3's own fallback, folded in:** if `eth_sendRawTransactionSync` turns out unavailable or unreliable against `https://testnet-rpc.monad.xyz` (this is itself unverified — `ARCHITECTURE.md` §14 item 2 lists it as sourced from documentation, never yet called against this endpoint), fall back to `eth_sendRawTransaction` + a receipt poll **and halve the settlement rate to 5 tx/s in the same change** — the sync method is worth 2–4× the RPC budget per tick, so losing it isn't cost-neutral.

**The `BOOTH_ONCHAIN` switch this section previously described is dead, not just defaulted off.** §16 (2026-08-08) didn't gate booth-on-chain behind a threshold — it removed the on-chain booth path entirely. There is no switch to flip, no bar to clear, and no `test_BoothOnChainFlagDefaultsFalse` to write; testing for a flag's default state implies the flag exists as a live decision point, and it no longer does. FR-BOOTH-3/FR-REL-6 are themselves marked superseded above (§3 M8 table) for the same reason.

### 6.3 When to run this

Immediately once contracts are deployed to testnet and the relay's wallet pool is funded (P2, after P1) — `ARCHITECTURE.md` §12 schedules W0 at 20 minutes into the build, before contracts. Every hour it's deferred is an hour the per-tick architecture might be silently wrong.

---

## 7. Demo rehearsal script

Three-minute pitch slot, `CON-3`. Every beat below names the requirement IDs it demonstrates and what "pass" looks like on the actual screen a judge is looking at.

| Time | Beat | Operator action | Demonstrates | Pass = on screen |
|---|---|---|---|---|
| 0:00–0:20 | Open, then live | FR-OPS-1 one-action start | AC-1, FR-DASH-10, FR-ID-1 | Wall flips idle→live; first sessions appear with zero manual field entry |
| 0:20–0:45 | The whole demo, at a glance | Point at feed / counters / node grid / split | AC-6, FR-DASH-1..4 | All four elements visibly live and changing |
| 0:45–1:10 | The Flip, at network scale | Point at a V2G session reversing | AC-4, UC-4, FR-SET-7 | Direction flips on the split indicator; say aloud: "same settlement path, sign flipped" |
| 1:10–1:20 | The number just stops | Unplug (or simulate-unplug) one live node | AC-3, FR-SET-4/5 | Node goes quiet immediately; no invoice/reconciliation step follows |
| 1:20–1:50 | The room joins | "Phones out" line (booth spec §14), trigger `POST /api/surge` ~2s ahead | UC-10, FR-OPS-2, FR-BOOTH-3, NFR-P-2 | Room-total conduit crosses the marked breaker threshold; simulated count visibly drops as phone count rises |
| 1:50–2:10 | Say the honesty lines | Spoken, no action | FR-ID-2, FR-MET-5, NFR-M-4 | Presenter states: modelled-on-ISO-15118, simulated-metering labelled, relay verifies (not "trustlessly verifies on-chain") |
| 2:10–2:30 | Prove it, don't assert it | Click one feed entry through to the explorer | FR-DASH-9, AC-9 | Explorer opens at the correct tx hash, contract shows verified source |
| 2:30–2:50 | The claim, stated as a number | Read the concurrency counter aloud, **with its cadence** | AC-5, NFR-P-2 | Counter shows the actual sustained N, stated as measured, not hoped-for (REQUIREMENTS.md:528) — say the cadence too ("60 sessions, every 6 seconds"), not the session count alone: `ARCHITECTURE.md` ADR-8 fixes the system to a constant 10 tx/s budget, so N alone is a meaningless claim without T (`N ÷ T = 10`) |
| 2:50–3:00 | Buffer | — | — | — |

**Rehearsed separately before the pitch (not inside the 3 minutes):**

- **Zero-phones variant (FR-OPS-4).** Run the full script above with every phone off. Pass: every beat lands identically; the presenter's script requires zero edits; simulated load alone carries the room-surge beat.
- **Forced-degradation drill (FR-OPS-3, AC-8).** Mid-rehearsal, press the forced-degrade control. Pass: relay/wall visibly switch to degraded mode, labelled on the wall (never a silent freeze, NFR-R-3), demo continues to completion (NFR-R-1/R-2).

---

## 8. The adversarial demonstration (AC-7 / FR-OPS-7)

`REQUIREMENTS.md` marks AC-7 `D`, deliberately not `T` (line 600) — "no adversarial test harness is realistically buildable today, and claiming one would be a verification method nobody can run." This is the operator procedure that makes the claim provable live instead.

**Setup.** At least one live session on the wall, so there's a real settlement stream to contrast against.

**Trigger.** Operator presses the dedicated FR-OPS-7 control on the M9 operator surface, which calls `POST /v1/ops/malformed-settlement { sessionId }` (`API.md:362-366`). The relay submits one unsigned/garbled reading through the **normal** ingest path — `POST /v1/readings`, not a special bypass — and returns `200 { submitted: true, expectedRevert: "StaleOrReplayedSequence" | "BAD_SIGNATURE" }`. Using the normal path rather than a bypass is the point: it proves the rejection is the real production check firing, not a demo-only stub.

**What must NOT happen.** No balance change on either wallet. No settlement event emitted — the SSE stream (`GET /v1/stream`) carries no `settlement` event for this call. The running MON-moved counter (FR-DASH-2) does not increment. Contract-side, this is the same guarantee `test_NoBalanceChangeOnStaleReplayedSequence`/`test_ReadingsRejectsBadSignature` (§4/§5) prove offline — the live control exercises the identical `POST /v1/readings` → (rejected, never reaches `settle`) path, on the record, in front of a reviewer.

**What the wall MUST visibly do.** A 10-metre viewer must register that something was rejected, not silence — exactly the same legibility bar FR-DASH-5/NFR-U-1 already set for everything else on the wall. The precise visual (a red flash, a rejection line in the feed, a counter) is an M7 design decision **[PENDING ARCH/DESIGN — the wall's rejection-event UI]**; the requirement on it is fixed regardless of which one is chosen: absence of value movement alone is not a demonstration if nobody in the room can see that the rejection happened.

**Reviewer-triggered variant.** If a judge asks "what happens if I lie about the energy delivered" (CON-6 — this audience votes, and will ask), the operator has the same control ready to press on request, not just on the rehearsed cue. This is exactly why REQUIREMENTS.md scoped AC-7 as `D` — it needs to be repeatable on demand, not just once in a rehearsed run.

---

## 9. Honesty-constraint inspections

`CLAUDE.md`'s honesty constraints and their matching `I`-verified requirements. Each row: the artefact to read, and what disqualifies it.

| ID | What it requires | Artefact to read | Disqualifying condition |
|---|---|---|---|
| FR-MET-5 | Simulated metering labelled wherever mistakable for hardware | Wall UI, booth UI, pitch script | Any screen showing a simulated reading with no `simulated` marker visible at normal viewing distance |
| FR-DASH-6 | Dashboard states on-chain vs simulated, never conflates | Wall UI, every rendered figure | A number with no visible source flag (on-chain / simulated), or a simulated number styled identically to an on-chain one |
| NFR-R-3 | Degraded operation labelled, never disguised | Wall UI during a forced-degrade drill (§7) | Wall looks identical in degraded and normal mode |
| FR-ID-2 | Handshake documented as "modelled on" ISO 15118, never conformant | README, pitch script, UI copy | The words "conformant," "compliant," or "ISO 15118" unqualified by "modelled on" / "simulated for this demo" |
| NFR-M-1 | Every simplification against the real standards documented in README | README | Any of: simplified handshake, simulated metering, off-chain signature verification, no real hardware, no live oracle — present in the code but absent from the README |
| NFR-M-4 | The ASM-6 trust boundary stated in README and pitch, with the named production fix | README, pitch script | Missing either the "relay verifies off-chain, contract trusts the attestation" statement or the named fix (a ZK-proof of the verified batch submitted on-chain, per REQUIREMENTS.md:566) |
| NFR-S-4 | No private key committed | `git log -p`, working tree, `.env*` files | Any hex string matching a private-key shape, any `.env` file tracked by git, any hardcoded key literal in source |
| NFR-S-5 | Relay hot wallet holds only demo funds; exposure stated in README | README, wallet balance | README silent on what the relay's key can do if leaked, or balance far exceeding demo-scale (monad-facts.md Q6) |
| FR-BOOTH-5 / NFR-S-6 | Booth app collects no credential/key/payment detail | Booth UI, `/api/session` payload, the `CLAIM` form | Any field asking for a private key, password, card number, or seed phrase |
| FR-BOOTH-6 | Reward decided by skill, never a random attribute | `src/game/engine.ts`, `src/game/cars.ts` | Score formula references rarity/tier/any randomly-assigned field |
| FR-BOOTH-7 | Reward terms stated before play | Booth UI flow order | A player can reach `charging` without having been shown the terms panel |
| FR-BOOTH-8 | No vote solicitation; states placement-dependency as fact | All booth copy, share cards, spoken booth patter | Any phrase resembling "vote for us" / "help us win"; OR the placement-dependency sentence missing entirely |
| AC-11 | Every simplification documented | → same artefact as NFR-M-1 | — |

Run this checklist once fully, then again in the final hour before submission (`docs/event_details/submission_process.md`) — code changes after the first pass are exactly what re-breaks a label.

---

## 10. Booth app tests

Beyond the per-requirement rows in the M8 matrix — the properties that need more than one line.

**Score model determinism.** Golden-value test against booth spec §5's calibration table (verbatim, lines 286–296): simulate a constant tap rate for a full 45s session (`SESSION_MS = 45_000`) and assert the resulting score matches the table within integer rounding.

```
taps/s → expected score (Flip at)
4  → 2109  (never)
5  → 2365  (42.6s)
7  → 3323  (35.6s)
9  → 4052  (30.3s)
12 → 4785  (26.6s)
15 → 5269  (25.5s)
20 → 5732  (24.6s — engine cap)
```

`test_ScoreModelMatchesCalibrationTable` — parametrised over the 7 rows above.

**FR-BOOTH-13's rate cap (not the stale 4,200 ceiling — see §12).** `test_ScoreCapsAtTwentyTapsPerSecond` — feed synthetic tap streams at 25, 50, and 200 taps/s; assert all three produce the identical score (5,732) the 20 taps/s row does. This is the actual anti-cheat mechanism per booth spec §6: "a script gains nothing... no genuine player is falsely accused."

**Frame-rate independence (NFR-U / booth spec §6 fairness invariant 3).** `test_ScoreIndependentOfFrameRate` — replay the identical `pointerdown` timestamp sequence through the game loop at two different fixed `dt` step sizes (e.g. 1/120s vs 1/30s). Assert identical final score. This is only true if tap rate is derived from `pointerdown` timestamps and energy accumulates from `dt` — exactly what booth spec §6 requires and what makes this testable at all; if the implementation ever derives rate from a per-frame counter instead, this test is the one that catches it.

**Anti-cheat rules (booth spec §6 table, lines 317–325):**
- `test_MultiPointerUpTo5Counted` (FR-BOOTH-14) — pointers 1–5 all contribute; a 6th is ignored, not penalised
- `test_FlagsSuspiciousRateAbove18TapsPerSec` — a session averaging >18 taps/s is flagged for review, not rejected outright (booth spec §6: "Flagging is free because the reveal is delayed")
- `test_RejectsReplayedOrOutOfOrderSeq` — same idempotency pattern as FR-MET-7, applied to `/api/tick`
- `test_ClockIsServerAuthoritative` (DR-4) — session duration measured against the `clockOffset` established at `/api/session`, not client wall-clock

**FR-BOOTH-15/16 settlement timing.** `test_SettlementStaggerAcrossPlayers` — spin up N synthetic booth sessions (N = 10 and N = 60), record settlement timestamps, assert: (a) each session's own settlements are 6s apart, (b) offsets across sessions spread rather than cluster (no >2 settlements within the same 200ms window at N=60), (c) peak simultaneous settlements in any 1s window ≈ N/6. `test_FinalSettlementServesAsClose` — confirm no separate close call after the last tick.

Run: `npm run test:booth` [PENDING ARCH — name matches the relay convention above; adjust once the booth app's actual `package.json` exists per its own file structure, booth spec §12].

---

## 11. Test data and fixtures

**Charge curve fixture.** Two distinct curves exist in the source material and both need a fixture: M2's simulator curve (FR-MET-4: ramp/plateau/taper, shape unspecified beyond that) and the booth engine's curve (booth spec §5's exact formula, `kW_target = P_MAX_KW × (1 − e^(−r/R_REF)) × taper × surge`). Don't reuse one fixture for both without checking they're meant to match — nothing in the source documents says they must be the same shape, only that each individually ramps/plateaus/tapers.

**Signed reading fixtures.** A small deterministic set of `{sessionId, seq, timestampMs, kW, whDelta, meterId, signature}` tuples (§7.1 wire format / `API.md` §2), **EIP-712 typed-data signed**, not an ad hoc hash — `API.md:254-261` gives the exact domain and type:
```
EIP712Domain: { name: "PlugNPay", version: "1", chainId: 10143, verifyingContract: <PlugNPaySettlement address> }
Reading: { sessionId: bytes32, seq: uint256, timestampMs: uint64, whDelta: int256, meterId: address }
```
Note `kW` is deliberately **not** in the signed struct (display-only) — a fixture that signs over `kW` by mistake will fail every test that checks the signature ignores it (§5's `test_SignatureCoversAllFieldsExceptKW`). Sign with a **test-only** private key generated for and committed only as a fixture — never a funded wallet's key, and never a key that could be confused with one (NFR-S-4 boundary). Include: a valid ramp, a valid taper, a negative-`whDelta` (discharge) entry, a bad-signature entry, a replayed-`seq` entry, an out-of-order-`seq` entry, and one entry with `isFinal: true` to exercise the fold-close-into-settle path (FR-SET-5, FR-BOOTH-16).

**Funded-wallet fixture.** Testnet wallets funded via `https://faucet.monad.xyz`, referenced only by environment variable (`RELAY_WALLET_POOL_KEYS` or similar [PENDING ARCH]), never committed. Fund every wallet at least 3 blocks (~1.2s, monad-facts.md Q4) before first use, and keep every relay wallet's balance above the 10 MON reserve floor (monad-facts.md Q3) — a wallet that drops below it is capped at ~1 tx/1.2s, which silently breaks the per-tick design for that one wallet without reverting anything.

**Determinism.** Fixed seeds for the simulator's charge-curve noise (if any), fixed timestamps via an injectable clock rather than live `Date.now()` in every test, so a failing test reproduces on a second run instead of flaking. This matters more than usual here: booth scores carry real money (§7 of the booth spec), so a non-deterministic scoring test would be worse than no test.

---

## 12. Coverage gaps, stated

Honest gaps, not padding. Anything listed here is a real hole today, not a hedge.

1. **The write-path measurement (build task W0, §6) has not run.** This is the single largest open risk in this test plan, and `ARCHITECTURE.md` §14 independently lists it as open item #1 for the same reason: "Only reads were measured... every capacity number here assumes writes ≤ reads and applies a 4× margin." AC-5 and NFR-P-2's real safety margin is an assumption, not yet a fact, until W0 runs and clears the 10 tx/s / <1% 429s / 60s bar (ADR-1) — decided at 14:10, per the architecture, not on stage.

2. **The coverage ledger is stale against the current `REQUIREMENTS.md` on two points, corrected throughout this plan — and `ARCHITECTURE.md` independently found the same thing.** `coverage-ledger.md` describes FR-BOOTH-13 as a "4,200 plausibility ceiling" — the current requirement (REQUIREMENTS.md:436) replaced that with a 20 taps/s hard rate cap and explicitly says the 4,200 number "caught nothing" because it sat above the curve's own asymptote. The ledger also stops at FR-BOOTH-13; `REQUIREMENTS.md` in its current form additionally defines FR-BOOTH-14, FR-BOOTH-15, and FR-BOOTH-16 (lines 437–439, all Pri `M`), which this plan tests (§3, §10). `ARCHITECTURE.md` §15's own requirement index flags this by name — "Ledger-stale IDs (FR-BOOTH-14/15/16) included" — independent corroboration from a document written concurrently with this one, not by either of us reading the other's work. Per `CLAUDE.md`'s document hierarchy (requirements win on disagreement), this plan tests against the current `REQUIREMENTS.md` text throughout, not the ledger's description.

3. **FR-BOOTH-3 and FR-REL-6 read as unconditional; three sibling documents disagreed on how they're gated, and the third one landed with a working answer.** `ARCHITECTURE.md` ADR-6 said booth sessions settle on-chain only when `BOOTH_ONCHAIN=true`, defaulting **false**. `API.md` §3's DECISION, written independently to resolve the same ambiguity, described the wall backend forwarding every booth tick to `POST /v1/readings` **unconditionally** — no flag. `DESIGN.md` landed last and settles it: §0.2 fixes `CFG.BOOTH_ONCHAIN: false` as a real config field, §0.3 marks `OD-1` "**Closed**" against `ARCHITECTURE.md`'s design, and §M8.3/§M5.7 describe the actual branch — `if (source === 'booth' && !CFG.BOOTH_ONCHAIN) { ... }` — that implements it. `API.md` §3's unconditional-forwarding paragraph is superseded by this, the same way `API.md` §5 itself superseded the booth spec's stale single-hot-wallet paragraph — a later, more concrete document overriding an earlier one's design call, not a hierarchy violation. Test `test_BoothForwardingRespectsOnChainFlag` and `test_WallLabelsBoothMonSimulatedWhenFlagOff` against the `DESIGN.md` §M5.7 branch specifically; if the shipped code instead matches `API.md`'s unconditional description, that's a real implementation bug against three converging specs, not an ambiguity to shrug at.

4. **The booth-frontend-design.md document contradicts itself on two numbers a builder could reasonably follow by mistake:**
   - §2's narrative walkthrough (line 62) describes a 30-second round with 2 surge windows (`8–11s`, `19–22s`); §5's authoritative game constants (lines 236–251) specify `SESSION_MS = 45_000` with 3 surge windows (`10–13s`, `24–27s`, `36–39s`), and §5's own prose confirms this is the current, deliberately-extended version ("The battery was 1.6 kWh while the round was 30 seconds. Extending to 45s..."). This plan tests against §5. Flagging here so whoever builds the booth app doesn't code the §2 walkthrough by mistake.
   - §11 (line 519) says to "track pointer ids, ignore beyond two concurrent"; §5's constant `MAX_POINTERS = 5` (line 242) and `REQUIREMENTS.md`'s FR-BOOTH-14 both say 5. This plan tests against 5 pointers (the requirement, and the newer of the two contradicting lines). An implementer who reads only §11 would ship a requirement violation.

5. **NFR-P-5 and NFR-P-6 (booth performance) are manual device tests today, not automated ones**, despite carrying `T`/`D` in the ledger. No mobile device farm exists in this build's two-hour booth-app budget (booth spec, header table). Said plainly rather than naming a CI job that will not exist.

6. **FR-DASH-7's 60-node render-performance test has no harness yet** — it needs a synthetic 60-node stress state and a chosen profiling method, both `[PENDING ARCH]` on the rendering stack `ARCHITECTURE.md`/`DESIGN.md` will name.

7. **Almost all `[PENDING ARCH]` tags are now resolved; the small remainder waits on `DESIGN.md` specifically.** `ARCHITECTURE.md` resolved the wallet-pool sizing, the write-path decision gate, and the booth on-chain switch (§6, §3 M5 table). `API.md` then resolved what looked like the biggest remaining gap — exact contract function/event/error names and the relay's HTTP surface — which is why §4 and §5 above quote real names (`PlugNPaySettlement.settle()`, `POST /v1/readings`, `StaleOrReplayedSequence`, etc.) rather than invented placeholders. What's left genuinely waits on `DESIGN.md`: `API.md` §7's own TBD list names the exact gaps — pinned compiler version (TBD #1), `settleBatch`'s batch size N (TBD #2), the full `deposit`/withdrawal lifecycle (TBD #3), the ops-surface shared-secret scheme (TBD #4), EIP-712 domain values fixed at deploy (TBD #5), which role(s) gate `registerIdentity` (TBD #6), and the single-vs-split-contract call itself (TBD #8) — plus this plan's own remaining items: exact repo directory layout (contracts/ vs repo root), npm script names, and the SSE ring-buffer depth (TBD #7).

8. **FR-ID-7, FR-MET-8, FR-PR-5, FR-SET-11 are not tested, on purpose** — `REQUIREMENTS.md` §11 explicitly defers all four past today's freeze. Testing them would contradict the requirements document they come from.

9. **AC-7 is `D`, not `T`, on purpose** — restated here for the record because it's the one place in this whole plan where "we didn't write an automated test" is the *correct* answer, not a gap. See §2.2 and §8.

10. **DR-4's timestamp-authority rule and IF-8's fire-and-forget principle are inspection-only** — nothing in the source documents assigns them a `T`, and no test framework meaningfully distinguishes "the client's clock was ignored" from "the client's clock happened to agree with the server's" without controlling both, which is more machinery than the two-hour booth budget or the relay's build order affords today.
