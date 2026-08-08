# Plug-N-Pay — Software Requirements Specification

**The main requirements document.** Everything else in `docs/specs/` is subordinate to this file.

| | |
|---|---|
| **System** | Plug-N-Pay — per-second machine-to-machine settlement for EV charging on Monad |
| **Version** | 1.0 |
| **Date** | 2026-08-08 |
| **Source of truth for intent** | `docs/idea/idea.md`, `docs/idea/story.md` |
| **Status** | Baselined. Open items tracked in §13 and `docs/idea/open_questions.md` |

---

## 1. Introduction

### 1.1 Purpose

This document states what Plug-N-Pay must do, for whom, and how each requirement will be shown to have been met. It is written for three audiences: the people building it today, a peer reviewing the submission, and anyone picking the project up afterwards.

### 1.2 Product scope

Plug-N-Pay is a **settlement rail**. A vehicle and a charging station authenticate each other automatically on physical connection, open a payment relationship between their on-chain wallets, and move value continuously in step with metered energy — in either direction — for exactly as long as current flows. When the current stops, the obligation stops. There is no invoice step, because the last settled on-chain state already is the bill.

The system exists to close a gap named in `idea.md` §2: the physical reality of charging is continuous, and until a ledger was fast and cheap enough to settle per second, the financial reality could not match it.

### 1.3 What this is not

It is **not a consumer application** (`idea.md` §11). There is no driver login, no wallet onboarding flow, and no billing screen to design. A driver's only touchpoint is whatever a downstream app — a carmaker's dashboard, a charging network's app — chooses to surface. The system ships the rail plus the instrumentation needed to make an invisible machine-to-machine process visible to a room.

### 1.4 Definitions

| Term | Meaning |
|---|---|
| **EVSE** | Electric Vehicle Supply Equipment. The charging station. |
| **Plug & Charge** | Automatic mutual authentication on physical connection, per ISO 15118. No card, no app, no account entry. |
| **OCMF** | Open Charge Metering Format. Signed, legally-billable meter readings, already used for e-mobility billing disputes. |
| **V2G** | Vehicle-to-grid. Current flows out of the battery into the grid; the driver is paid. |
| **Tick** | One metering interval. Produces one signed reading and one settlement effect. |
| **Session** | One continuous connection between a vehicle and a station, from handshake to disconnect. |
| **Stream** | The payment relationship opened by a session. |
| **SoC** | State of charge. |
| **MON** | Monad's native token. The unit that moves in both directions. |
| **The wall** | The operations dashboard rendered on the projector during the pitch. |

### 1.5 References

- `docs/idea/idea.md` — product intent, system components, end-to-end flows
- `docs/idea/story.md` — the user narrative the system must make true
- `docs/idea/open_questions.md` — unresolved architecture decisions
- `docs/event_details/rules.md`, `judging_criteria.md`, `project_demo.md` — delivery constraints
- `docs/specs/2026-08-08-booth-frontend-design.md` — module M8 detailed design

### 1.6 Requirement conventions

Identifiers are stable and must not be renumbered. `MUST` / `SHOULD` / `MAY` carry their ordinary force. Every functional requirement names a **verification method**:

| Method | Meaning |
|---|---|
| **D** — Demonstration | Shown running, on stage or on request |
| **T** — Test | Automated or scripted check with a pass/fail result |
| **I** — Inspection | Read the code or the contract |
| **A** — Analysis | Argued from measurements or from the design |

Priority uses MoSCoW against the 18:00 code freeze: **M** must exist to demo, **S** should, **C** could, **W** won't this time.

---

## 2. Overall description

### 2.1 Product perspective

Plug-N-Pay sits between two existing standards and a chain, and invents neither end:

```
   ISO 15118 Plug & Charge          OCMF signed metering
   (identity, already solved)       (trusted measurement, already solved)
              │                              │
              └──────────────┬───────────────┘
                             ▼
                   ┌───────────────────┐
                   │    PLUG-N-PAY     │   ← the contribution
                   │  settlement rail  │
                   └───────────────────┘
                             ▼
                      Monad (per-second
                      settlement, economic
                      only at this cost profile)
```

The contribution is the wiring: taking two things that already solve authentication and trusted measurement, and connecting their output to a ledger fast enough to keep up with them.

### 2.2 Product functions, at a glance

1. Authenticate a vehicle and a station to each other without human action.
2. Bind those identities to on-chain wallets.
3. Open a payment stream on connection.
4. Convert signed meter readings into value movement, once per tick.
5. Reverse direction for V2G with no change to the mechanism.
6. Terminate the instant metering stops, with the settled state as the final bill.
7. Run many sessions concurrently.
8. Make all of it visible.

### 2.3 User classes and characteristics

The system's primary actors are machines. This is a defining property, not an accident, and it shapes every interface requirement below.

| ID | Actor | Human? | Characteristics | What they need from the system |
|---|---|---|---|---|
| **A1** | **Vehicle Agent** | No | Onboard unit. Holds MON, holds a contract certificate, signs session authorisations. Simulated for this build. | To be identified, to pay only for delivered energy, to be paid for discharge |
| **A2** | **Station Agent** | No | EVSE controller. Holds a station identity and wallet. Reports delivered energy. | To be paid without extending credit, to prove what it delivered |
| **A3** | **Metering Device** | No | Produces signed readings at a fixed cadence. Real hardware or a simulated charge curve. | To have its signature be the only thing that authorises payment |
| **A4** | **Price Oracle** | No | Supplies price per kWh, and a separate V2G buy-back rate. | To be readable at session open and on rate change |
| **A5** | **Grid Aggregator** | No | The V2G counterparty. Funds discharge payouts, signals demand events. | To buy power at a published rate and pay per second |
| **A6** | **Driver** | Yes | Plugs in, unplugs. Wants no account and no surprise. Near-zero interaction by design. | To see a live honest number and to owe nothing after unplugging |
| **A7** | **Demo Operator** | Yes | Runs the pitch. Drives the wall and triggers the room moment. | Deterministic controls that work under stage pressure |
| **A8** | **Audience Participant** | Yes | Scans a QR code at the booth or during the pitch. Wants a toy. | Instant fun, no install, no wallet |
| **A9** | **Peer Reviewer / Judge** | Yes | A skilled developer with three minutes and a vote. | To see the claim proven, not asserted |

**A6 has no screen in this system.** `idea.md` §11 is explicit: the live ticking number in `story.md` is what a downstream app builds on this rail. That is why A6 appears in use cases but owns no user interface requirement.

### 2.4 Operating environment

| Layer | Environment |
|---|---|
| Chain | Monad testnet, chain ID **10143** (`0x279f`), RPC `https://testnet-rpc.monad.xyz`, native token MON |
| Contracts | Solidity, EVM-compatible |
| Agents / relay | Node.js, off-chain processes |
| Dashboard | Browser on a projector, 1920×1080 assumed, viewed from up to 10 metres |
| Booth app | Mobile browsers, portrait, iOS Safari and Android Chrome |
| Game server (M10) | **Render**, cloud-hosted, so phones can fall back to cellular when venue wifi degrades |
| Network | Venue wifi, congested, shared with every other team |

### 2.5 Design and implementation constraints

| ID | Constraint | Source |
|---|---|---|
| **CON-1** | All code written today. No pre-built projects, no forked codebases beyond standard libraries. | `rules.md` |
| **CON-2** | Public repository, deployed and operational on Monad testnet. | `rules.md` |
| **CON-3** | Code freeze 18:00, submission 18:30, three-minute pitch. | `about.md`, `project_demo.md` |
| **CON-4** | Team of at most four. | `rules.md` |
| **CON-5** | Public testnet RPC rate limits are **undocumented**. Assume they exist and are lower than wanted. | `open_questions.md` Q1 |
| **CON-6** | The audience are developers who vote. The system must survive technical scrutiny, not marketing scrutiny. | `judging_criteria.md` |
| **CON-7** | Full ISO 15118 (TLS mutual auth, EXI message stack, certificate provisioning) is out of budget. A documented stand-in is required. | `idea.md` §9 |

### 2.6 Assumptions and dependencies

| ID | Assumption | If wrong |
|---|---|---|
| **ASM-1** | Testnet faucet supplies enough MON to fund the relay's **wallet pool** (FR-REL-8) plus the pre-registered identity pool (FR-SIM-6). Per-tick settlement made this a harder dependency than the original single-wallet assumption, and the faucet's own per-request limits are unverified. | Reduce concurrency. Falling back to a single relay wallet means falling back to batching (FR-REL-2), because one account cannot issue per-tick load in parallel — the two are the same decision |
| **ASM-2** | Simulated metering is acceptable to reviewers when labelled honestly. | Nothing changes; labelling is already required by FR-MET-5 |
| **ASM-3** | Venue wifi is usable but unreliable. | §12 fallback ladder governs |
| **ASM-4** | Public RPC sustains at least the rehearsed concurrency in transactions per second — 10/s at AC-5's bar, ~50/s for the stretch attempt. This is an assumption only until FR-REL-9 measures it. | Batching (FR-REL-2) stops being the fallback and becomes mandatory, and FR-REL-3 collapses to its serialised form |
| **ASM-5** | Reviewers accept a simplified handshake as "modelled on" ISO 15118. | Weaken the claim in the pitch, not the code |
| **ASM-6** | Signature verification against the metering key happens off-chain, in the relay (M5), not per-signature in the M4 contract — on-chain verification of every tick from every concurrent session would exceed gas/RPC budget. The relay is therefore a **named trust boundary**: the contract trusts the relay's attestation that it checked each signature, it does not re-check them itself. | If this trust boundary is unacceptable to a reviewer, the fallback is to state it as the explicit production gap it is (e.g. a ZK-proof of the signature batch submitted on-chain) rather than attempt on-chain verification today. See NFR-M-4. |

---

## 3. Module decomposition

```
┌───────────────────────────────────────────────────────────────┐
│ M9  Demo Control & Observability                              │
├───────────────────────────────────────────────────────────────┤
│ M7  Operations Dashboard (the wall)   │  M8  Booth App        │
├───────────────────────────────────────┴───────────────────────┤
│ M6  Session Simulator & Spawner                               │
├───────────────────────────────────────────────────────────────┤
│ M5  Settlement Relay / Batcher                                │
├───────────────────────────────────────────────────────────────┤
│ M4  Settlement Contracts (Monad)                              │
├───────────────┬───────────────┬───────────────┬───────────────┤
│ M1 Identity & │ M2 Metering   │ M3 Pricing    │               │
│    Handshake  │               │               │               │
└───────────────┴───────────────┴───────────────┴───────────────┘
```

| ID | Module | Responsibility | Owner boundary |
|---|---|---|---|
| **M1** | Identity & Handshake | Mutual authentication on connect; bind certificate identity to wallet address | Off-chain agents + registry contract |
| **M2** | Metering | Produce signed readings at a fixed cadence, with a realistic charge curve | Off-chain, signed with a device key |
| **M3** | Pricing | Serve price per kWh and the V2G buy-back rate | Contract or config |
| **M4** | Settlement Contracts | Sessions, value movement, the rule that no payment exists without a signed reading | On-chain, Monad |
| **M5** | Settlement Relay | Aggregate ticks across sessions into transactions; manage nonces and the hot wallet | Off-chain service |
| **M6** | Simulator & Spawner | Create N concurrent vehicle/station pairs with a mix of directions | Off-chain |
| **M7** | Operations Dashboard | Render the network live for a room | Browser |
| **M8** | Booth App | Audience-facing toy; generates real concurrent load | Browser — see `2026-08-08-booth-frontend-design.md` |
| **M9** | Demo Control | Start, stop, spin-up, room surge, degradation switches | Operator surface |

---

## 4. Use cases

Format: **UC-n · Name** — actors, preconditions, main flow, alternates, postconditions.

### UC-1 · Open a charging session on physical connection
**Actors** A1, A2, A3 · **Trigger** connector latches
**Preconditions** Both parties registered (UC-11); both wallets funded
**Main flow**
1. Vehicle and station exchange identity credentials and each verify the other.
2. Each maps the verified identity to an on-chain wallet address via the registry.
3. Direction is resolved to `CHARGE`; price per kWh is read from M3.
4. A session is opened on-chain recording payer, payee, price, direction, start time.
5. The metering device begins emitting signed readings.
**Alternates**
- *1a* Verification fails → no session opens, no value can move, station shows unauthorised.
- *2a* Identity has no registered wallet → session refused.
- *3a* Price source unavailable → session refused rather than opened at an unknown price.
**Postconditions** An open session exists on-chain; no value has moved yet.

### UC-2 · Settle continuously while energy flows
**Actors** A2, A3 · **Trigger** a signed reading arrives
**Main flow**
1. Reading arrives: timestamp, instantaneous kW, cumulative kWh delta since the last tick.
2. Signature verified against the registered metering key.
3. `Δvalue = Δ kWh × price` computed.
4. Value moves from the vehicle wallet to the station wallet.
5. A settlement event is emitted and appears on the wall within one second.
**Alternates**
- *2a* Signature invalid → tick discarded, no value moves, discrepancy recorded.
- *4a* Payer balance insufficient → session force-closes at the last funded tick.
- *5a* RPC rejects or rate-limits → tick queues; on recovery it settles; if it cannot, the session closes at the last confirmed state.
**Postconditions** Cumulative settled value equals metered energy × price, to the tick.

### UC-3 · Terminate on unplug, with no invoice
**Actors** A1, A2, A6 · **Trigger** disconnect, or readings stop
**Main flow**
1. Readings stop arriving.
2. After the stop threshold, the session closes.
3. The final settled amount is the total. No reconciliation transaction is produced.
**Alternates**
- *1a* Readings stop because the meter died rather than because the car unplugged → same outcome, because the system deliberately cannot distinguish them: no reading, no payment.
**Postconditions** Session closed. Total on-chain movement reconciles exactly to metered kWh × price. Nothing further is owed.

*This use case is the product. `story.md`: "The number simply stops. Not 'processing your final bill' — stopped, because nothing is flowing anymore."*

### UC-4 · Accept a V2G offer and reverse the stream
**Actors** A5, A1, A6 · **Trigger** aggregator publishes a demand event
**Main flow**
1. Aggregator signals a discharge window with a buy-back rate.
2. The offer is accepted (driver opt-in, or dashboard toggle).
3. A session opens with direction `DISCHARGE`, payer = aggregator, payee = vehicle.
4. Metering reports power flowing out of the vehicle.
5. Value moves to the vehicle wallet, per tick.
**Alternates**
- *2a* Not accepted → nothing happens; no default opt-in.
- *3a* Aggregator wallet underfunded → offer refused before any energy moves.
**Postconditions** Vehicle wallet balance increased by metered discharge × buy-back rate.

*The mechanism is identical to UC-1/UC-2 with a sign flip and a different rate. Any implementation requiring a second code path has failed FR-SET-7.*

### UC-5 · Spin up a concurrent network
**Actors** A7 · **Trigger** operator invokes spin-up
**Main flow**
1. Operator specifies N.
2. N vehicle/station pairs are created with a mix of charge and discharge directions.
3. All sessions open and begin ticking concurrently.
4. The wall shows every session settling live.
**Alternates**
- *3a* RPC saturates → batching absorbs it (FR-REL-2); if it still saturates, N is reduced and the reduction is stated on the wall rather than hidden.
**Postconditions** N concurrent sessions settling. This is the throughput claim, demonstrated.

### UC-6 · Observe the network
**Actors** A7, A9 · **Preconditions** at least one session live
**Main flow**
1. A scrolling feed shows individual settlements as they land.
2. Running counters show total settlements and total MON moved.
3. A node grid pulses each participant at the moment it settles.
4. A split bar shows charge volume against V2G volume.
**Postconditions** A viewer ten metres away can tell, without narration, that many independent payments are settling continuously.

### UC-7 · Refuse payment without a signed reading *(negative case, and the security core)*
**Actors** A2 (adversarial) · **Trigger** station reports energy it did not deliver
**Main flow**
1. A settlement is attempted without a valid signed reading, or with a replayed one.
2. The system rejects it. No value moves.
**Postconditions** Payment obligation exists only where signed metering exists. A station cannot bill for power it did not deliver.

### UC-8 · Survive RPC degradation
**Actors** A7 · **Trigger** RPC returns 429 or times out
**Main flow**
1. Failures are detected.
2. Settlement switches to a degraded mode (larger batches, lower cadence, or queueing).
3. The wall states which mode it is in.
**Postconditions** The demo continues. The audience is never shown a frozen dashboard presented as a live one.

### UC-9 · Audience participant joins as a live session
**Actors** A8 · **Trigger** QR scan
**Main flow**
1. Participant opens the booth app, is assigned a vehicle, plugs in with a swipe.
2. Their play produces energy deltas reported to the relay.
3. Their session appears on the wall alongside simulated ones.
**Alternates**
- *2a* Relay unreachable → the app runs fully locally and the participant notices nothing. The wall shows simulated nodes instead.
**Postconditions** Audience activity is indistinguishable, on the wall, from simulated activity — because it is the same kind of activity.

### UC-10 · The room surge
**Actors** A7, A8 · **Trigger** operator triggers a surge during the pitch
**Main flow**
1. A surge is scheduled a short time in the future, against server time.
2. Every connected phone begins simultaneously.
3. **Simulated sessions (M6) ramp down proportionally as audience sessions connect**, so peak concurrency during the surge stays at or below the rehearsed RPC safety limit rather than adding audience load on top of the full simulated load. The surge is a *substitution* of load, not an addition to it.
4. Room-total power crosses a marked threshold on the wall.
**Alternates**
- *2a* No phones connected → the wall carries the beat with simulated load and the operator's script does not change.
- *3a* Audience sessions exceed the safety limit on their own → additional simulated sessions are not spawned to compensate; excess audience connections queue or are capped, stated on the wall (FR-DASH-6/NFR-R-3 style labelling), rather than silently pushing concurrency past the rehearsed limit.
**Postconditions** The throughput claim is demonstrated by the audience rather than asserted by the presenter, without exceeding the concurrency ceiling established by NFR-P-2/IF-10.

*Gap closed 2026-08-08: the un-reconciled prior version implied 50 rehearsed simulated sessions (NFR-P-2) plus a ~60-phone surge burst (IF-10) could co-occur, i.e. a peak of ~110 — well past the point RSK-1 already names as the worst failure mode. The fix is architectural (substitution, not addition), not just a relabelling of numbers.*

### UC-11 · Register a vehicle or station identity
**Actors** A1, A2 · **Main flow** An identity is bound to a wallet address in the registry, so a later handshake resolves to a payable address.
**Alternates** *1a* Duplicate registration → rejected.
**Postconditions** The handshake step and the payment step are cryptographically linked, so a spoofed station cannot redirect payment.

**Gap closed 2026-08-08 — bootstrapping order:** M6's simulated vehicle/station pairs (up to 50, per NFR-P-2) MUST NOT be registered live during spin-up (UC-5) — registering dozens of identities as on-chain transactions at the moment the operator triggers "spin up" would itself consume RPC headroom right before the demo needs it most. A pool of pre-registered identities (sized to at least the rehearsed-plus-stretch concurrency target) MUST be registered during deployment/setup, before code freeze, and UC-5's spawner draws from that pool rather than registering on demand. Booth-app sessions (FR-BOOTH-9) are the one exception, registering live at a low, audience-paced rate, not in a spin-up burst.

### UC-12 · Handle a mid-session rate change
**Actors** A4, A2 · **Main flow** A new rate is published; the session records the change; ticks before it settle at the old rate and ticks after at the new one.
**Postconditions** No retroactive repricing. `story.md`'s complaint — "the rate changed mid-session and no one told you" — cannot occur.

---

## 5. Functional requirements

### M1 — Identity & Handshake

| ID | Requirement | Pri | Ver |
|---|---|---|---|
| FR-ID-1 | On connection, vehicle and station MUST authenticate each other with no human action and no manual entry of payment details. | M | D |
| FR-ID-2 | The handshake MUST be documented as *modelled on* ISO 15118 Plug & Charge, not as a conformant implementation, wherever it is described. | M | I |
| FR-ID-3 | A verified identity MUST resolve to exactly one on-chain wallet address. | M | T |
| FR-ID-4 | An unverified or unregistered party MUST NOT be able to open a session. | M | T |
| FR-ID-5 | A party MUST NOT be able to present another party's identity to redirect payment. | M | T |
| FR-ID-6 | The registry SHOULD support registering identities at runtime, not only at deploy. | S | D |
| FR-ID-7 | The handshake MAY exchange session keys derived from the certificate exchange rather than using pre-provisioned wallets. | C | I |

### M2 — Metering

| ID | Requirement | Pri | Ver |
|---|---|---|---|
| FR-MET-1 | The metering source MUST emit readings at a configurable cadence, defaulting to 1 Hz. | M | D |
| FR-MET-2 | Each reading MUST contain a timestamp, instantaneous power in kW, and cumulative energy delta since the previous reading. | M | I |
| FR-MET-3 | Each reading MUST be signed by the metering device's key. | M | T |
| FR-MET-4 | The simulator MUST produce a realistic charge curve: ramp, plateau, taper near full. | M | D |
| FR-MET-5 | Simulated metering MUST be labelled as simulated wherever a viewer could mistake it for hardware. | M | I |
| FR-MET-6 | Readings MUST support negative or reversed flow to represent discharge. | M | T |
| FR-MET-7 | A replayed reading MUST be rejected. | M | T |
| FR-MET-8 | The system SHOULD accept readings from real current-sensing hardware without changes above the metering interface. | C | A |

### M3 — Pricing

| ID | Requirement | Pri | Ver |
|---|---|---|---|
| FR-PR-1 | A price per kWh MUST be readable at session open. | M | T |
| FR-PR-2 | A separate V2G buy-back rate MUST exist and MUST be distinguishable from the charging rate. | M | T |
| FR-PR-3 | The V2G rate SHOULD be expressible as a peak premium tied to a demand window. | S | D |
| FR-PR-4 | A rate change mid-session MUST apply only to subsequent ticks. | M | T |
| FR-PR-5 | Pricing MAY be served by a live oracle rather than configuration. | C | I |

### M4 — Settlement contracts

| ID | Requirement | Pri | Ver |
|---|---|---|---|
| FR-SET-1 | A session MUST record payer, payee, price, direction, and start time. | M | I |
| FR-SET-2 | Value MUST move only in response to a validated signed metering event. **This is the security core of the system.** Validation happens off-chain in the relay (M5), which is a named trust boundary — see ASM-6. The pitch language must say "verifies," not "trustlessly verifies on-chain." | M | T |
| FR-SET-3 | Settled value MUST equal metered energy × applicable price, to the tick. | M | T |
| FR-SET-4 | A session MUST close when readings stop, within a configurable threshold. | M | D |
| FR-SET-5 | Closing MUST NOT require a separate reconciliation or invoice transaction. The last settled state is final. | M | I |
| FR-SET-6 | Every settlement MUST emit an event carrying session, direction, amount, and cumulative energy. | M | I |
| FR-SET-7 | Charge and discharge MUST use the same settlement path, differing only by sign and rate. A second code path fails this requirement. | M | I |
| FR-SET-8 | A session MUST NOT settle beyond the payer's funded balance. | M | T |
| FR-SET-9 | Settlement MUST be idempotent per (session, sequence). | M | T |
| FR-SET-10 | The contract SHOULD expose live per-session cumulative totals for the dashboard to read. | S | I |
| FR-SET-11 | The contract MAY implement rate-based streaming, where the withdrawable balance is a function of elapsed time × rate, as the production optimisation. | W | — |

### M5 — Settlement relay / batcher

| ID | Requirement | Pri | Ver |
|---|---|---|---|
| FR-REL-1 | The relay MUST submit **one transaction per session per tick**. This is the primary architecture, decided 2026-08-08 (§13.1, resolves Q2). | M | D |
| FR-REL-2 | The relay SHOULD support aggregating many sessions' ticks into one transaction per interval, as the **fallback** if measured RPC capacity proves insufficient (FR-REL-9). | S | D |
| FR-REL-3 | The relay MUST manage nonces so submissions do not collide or stall. **The shape of this depends on which mode is running, and the two are not the same job.** Under FR-REL-1 (per-tick, primary) it is genuine parallel nonce management across a wallet pool (FR-REL-8), because many transactions per second cannot be issued from one sequential account. Under FR-REL-2 (batched, fallback) it collapses to a serialised pipeline — the next batch is not submitted until the previous confirms or is abandoned — and nothing more should be built. Build for the mode in play. | M | T |
| FR-REL-4 | On RPC failure or rate limiting, the relay MUST degrade — larger batches or lower cadence — rather than dropping sessions silently. | M | D |
| FR-REL-5 | The relay MUST expose its current mode so the dashboard can state it. | M | I |
| FR-REL-6 | The relay MUST accept energy deltas from booth-app sessions through the same interface as simulated ones. | S | T |
| FR-REL-7 | The relay MUST NOT hold or require any participant's private key beyond its own hot wallet. | M | I |
| FR-REL-8 | Because one account's transactions are processed in nonce order, the relay MUST submit from a **pool of funded wallets**, sized so the target transactions per second can be issued in parallel rather than queued behind a single nonce. This makes the faucet a harder dependency than ASM-1 assumed. | M | T |
| FR-REL-9 | **DONE 2026-08-08 — see §13.4.** Public RPC serves ~40 req/s cleanly; first refusals at 45, latency collapses by 50 (p50 456 ms) and 70 (p50 1,960 ms). Read calls only, so this is an upper bound on write throughput. Reproduce with `node tools/measure-rpc.mjs`. | M | T |

### M6 — Simulator & spawner

| ID | Requirement | Pri | Ver |
|---|---|---|---|
| FR-SIM-1 | The spawner MUST create N concurrent vehicle/station pairs where N is a runtime parameter. | M | D |
| FR-SIM-2 | Spawned sessions MUST include both charging and discharging sessions concurrently. | M | D |
| FR-SIM-3 | Each simulated session MUST have an independent charge curve, so the wall does not show synchronised clones. | M | D |
| FR-SIM-4 | The spawner MUST be able to run at a rehearsed conservative N and a higher stress N. | S | D |
| FR-SIM-5 | Sessions SHOULD start staggered rather than simultaneously, to avoid a self-inflicted RPC spike. | S | I |
| FR-SIM-6 | Simulated vehicle/station identities MUST be drawn from a pool registered before code freeze (UC-11 bootstrapping note), not registered live during spin-up (UC-5). | M | I |

### M7 — Operations dashboard

| ID | Requirement | Pri | Ver |
|---|---|---|---|
| FR-DASH-1 | A scrolling feed MUST show individual settlements as they land, across all sessions. | M | D |
| FR-DASH-2 | Running counters MUST show total settlements and total MON moved since start. | M | D |
| FR-DASH-3 | A node view MUST pulse each participant at the moment it settles. | M | D |
| FR-DASH-4 | A split indicator MUST show charge volume against V2G volume. | M | D |
| FR-DASH-5 | The dashboard MUST be legible from ten metres on a projector. | M | D |
| FR-DASH-6 | The dashboard MUST show whether it is displaying on-chain or simulated values, and never present one as the other. | M | I |
| FR-DASH-7 | The dashboard MUST render at least 60 concurrent nodes without dropping below a readable frame rate. | S | T |
| FR-DASH-8 | The dashboard MUST tolerate a dropped connection gracefully: it MUST use a reconnect-safe streaming transport (e.g. Server-Sent Events, or a WebSocket with aggressive client-side auto-reconnect) and MUST NOT require a page reload or show a frozen-but-live-looking state if the connection drops. (Originally worded as a blanket ban on long-lived connections — corrected: the actual intent is resilience against venue wifi drops, not avoiding streaming transports, since polling at demo-relevant frequency would overload the relay itself.) | M | A |
| FR-DASH-9 | The dashboard SHOULD link a settlement to its transaction on a block explorer. | S | D |
| FR-DASH-10 | The dashboard MUST open on an idle state and become live on operator action, so the transition is visible. | M | D |

### M8 — Booth app

Full design: `docs/specs/2026-08-08-booth-frontend-design.md`. Requirements here are the system-level obligations only.

Priority split (corrected — see traceability note below): FR-BOOTH-1/2/4 are *existence* requirements on a module §11 explicitly builds last and says "is the only module whose absence costs nothing on stage" — they cannot simultaneously be M. FR-BOOTH-5/6/7/8 are *conditional constraints*: they don't require M8 to exist, but if it does exist, violating them is not acceptable at any priority. They stay M for that reason, not because the module is guaranteed to ship.

| ID | Requirement | Pri | Ver |
|---|---|---|---|
| FR-BOOTH-1 | A participant MUST reach a playable state from QR scan with no install, no login, and no wallet. | S | D |
| FR-BOOTH-2 | The app MUST NOT block on the network at any point, and MUST NOT display a network error to a participant. | S | D |
| FR-BOOTH-3 | The app MUST report tap events to the **game server (M10)**. Amended 2026-08-08 by §16 — the original required reporting energy deltas through the M5 relay interface, which the booth no longer touches. | M | T |
| FR-BOOTH-4 | The app MUST remain fully playable with the relay unreachable. | S | D |
| FR-BOOTH-5 | The app MUST NOT collect credentials, private keys, or payment details. | M | I |
| FR-BOOTH-6 | Any participant reward MUST be decided by skill, never by a randomly assigned attribute. | M | I |
| FR-BOOTH-7 | Reward terms MUST be stated in the app before a participant plays. | M | I |
| FR-BOOTH-8 | The app MUST NOT solicit votes or ask a participant to influence the judging in any way. It MUST state the reward's dependency on the team placing, as fact, because FR-BOOTH-7 requires complete terms and a hidden condition is worse than a disclosed one. Amended 2026-08-08 when the conditional reward was chosen — see §13.1. | M | I |
| FR-BOOTH-9 | ~~Ephemeral client-side session key.~~ **Withdrawn 2026-08-08.** It existed to reconcile FR-MET-3 (every reading signed) with FR-BOOTH-5 (collect no keys). §16 dissolved the conflict instead: a client that signs nothing and submits nothing needs no key, and FR-SPLIT-1 forbids the app holding key material at all. Keeping it would have had the frontend generate and register a key with no consumer. | — | — |
| FR-BOOTH-10 | A public leaderboard screen MUST show live standings at the booth, legible across a busy room, updating at least every 5 s. | S | D |
| FR-BOOTH-11 | The public screen MUST seal 10 s before the contest closes, showing an unambiguous sealed state rather than merely freezing, so a stale screen cannot be mistaken for a live one. | S | D |
| FR-BOOTH-12 | Final standings MUST be reviewed before publication and revealed after the event, not at the venue. | M | I |
| FR-BOOTH-13 | The engine MUST cap the effective tap rate at **30/s** — above any human rate, since five fingers reaches about 25/s. The cap MUST NOT sit inside the human range: at 20/s a four-finger player and a script both score 5,732, which reintroduces a tie at the prize-winning positions that soft saturation exists to prevent. An earlier score ceiling of 4,200 was also useless, sitting above the curve's own asymptote of 4,040. | M | T |
| FR-BOOTH-14 | The app MUST accept up to 5 concurrent pointers and MUST state in its instructions that multiple fingers are allowed. Three fingers reaches 12–15 taps/s; silently discarding a third finger would penalise the best players with nothing on screen explaining why. | M | D |
| FR-BOOTH-15 | ~~Settlement interval per booth session.~~ **Withdrawn 2026-08-08.** Booth sessions no longer settle on-chain at all (§16), so there is no interval to tune and no per-player chain load. The measurement that drove it stands in §13.4 and now governs M4/M5 only. | — | — |
| FR-BOOTH-16 | ~~Session-open scheduling.~~ **Withdrawn 2026-08-08** with FR-BOOTH-15, for the same reason. | — | — |

### M9 — Demo control & observability

| ID | Requirement | Pri | Ver |
|---|---|---|---|
| FR-OPS-1 | The operator MUST be able to start the network with one deterministic action. | M | D |
| FR-OPS-2 | The operator MUST be able to trigger a room surge that reaches connected phones. Triggering it MUST ramp down concurrently-running simulated sessions (M6) proportionally, so peak concurrency during the surge never exceeds the rehearsed RPC safety limit (UC-10). | S | D |
| FR-OPS-3 | The operator MUST be able to force degraded mode, to rehearse it. | S | D |
| FR-OPS-4 | The system MUST run the full demo beat with zero phones connected. | M | D |
| FR-OPS-5 | A recorded fallback of the working system MUST exist before code freeze. | M | I |
| FR-OPS-6 | Logs MUST retain enough detail to answer "did that settlement really land on chain" after the fact. | S | I |
| FR-OPS-7 | The operator surface MUST include a control that submits one deliberately malformed/unsigned settlement on demand, so UC-7/AC-7 can be proven live if a reviewer asks, rather than relying on an automated adversarial test harness nobody has time to build. | S | D |

---

## 6. Data requirements

| Entity | Fields | Notes |
|---|---|---|
| **Identity** | `id`, `role` (vehicle \| station \| meter \| aggregator), `pubKey`, `wallet` | UC-11. One wallet per identity |
| **Session** | `sessionId`, `payer`, `payee`, `direction`, `priceMonPerKwh`, `startedAt`, `closedAt`, `status` | `direction ∈ {CHARGE, DISCHARGE}` |
| **Reading** | `sessionId`, `seq`, `timestamp`, `kW`, `whDelta`, `meterId`, `signature` | Signature covers every other field |
| **Settlement** | `sessionId`, `seq`, `whDelta`, `monDelta`, `direction`, `txHash`, `blockNumber` | One per settled tick or batch entry |
| **Rate** | `context` (charge \| v2g), `monPerKwh`, `effectiveFrom` | FR-PR-4 needs `effectiveFrom` |
| **NetworkSnapshot** | `activeSessions`, `totalSettlements`, `totalMonMoved`, `chargeVolume`, `v2gVolume`, `mode` | What M7 renders |

**Integrity rules**

- **DR-1** A Settlement MUST reference exactly one validated Reading, or one batch of them.
- **DR-2** `(sessionId, seq)` is unique. Replays are rejected (FR-MET-7, FR-SET-9).
- **DR-3** Sum of a session's `monDelta` MUST equal sum of `whDelta` × applicable rate.
- **DR-4** Timestamps are recorded in UTC milliseconds. Client-supplied times are advisory; server or chain time is authoritative.
- **DR-5** No entity stores a private key belonging to another party.

---

## 7. Interface requirements

### 7.1 Metering → Settlement

Signed payload. Signature covers the whole struct.

```
{ sessionId, seq, timestampMs, kW, whDelta, meterId, signature }
```

- **IF-1** The consumer MUST verify `signature` against the registered `meterId` key before any value moves. **The consumer is the relay (M5), off-chain, not the M4 contract per-signature** — see ASM-6. The contract trusts the relay's batch submission as an attestation that this check already happened.
- **IF-2** `seq` MUST increase monotonically per session.
- **IF-3** `whDelta` MAY be negative, which denotes discharge.

### 7.2 Relay → Chain

- **IF-4** A batch submission MUST carry an array of per-session **energy deltas (`whDelta`)**, not pre-computed MON amounts, and settle them atomically. The M4 contract, not the relay, MUST perform `whDelta × price` on-chain against the registered rate — the relay attests to signature validity (ASM-6) but never dictates the settled MON amount, which is what keeps FR-SET-3 true rather than merely asserted by an off-chain party.
- **IF-5** A partial batch failure MUST NOT settle any entry in that batch.

### 7.3 Chain → Dashboard

- **IF-6** Settlement events MUST be consumable via a reconnect-safe streaming transport (SSE recommended for native browser auto-reconnect) rather than high-frequency polling, and the dashboard MUST recover without a reload if that connection drops (FR-DASH-8).
- **IF-7** Every rendered figure MUST be traceable to an event or an explicit simulation flag.

### 7.4 Booth app → Relay

Defined in `2026-08-08-booth-frontend-design.md` §8. System-level obligations:

- **IF-8** All calls MUST be fire-and-forget from the client's perspective.
- **IF-9** All writes MUST be idempotent on `(sessionId, seq)`.
- **IF-10** The relay MUST tolerate a burst of roughly sixty new sessions within twenty seconds.

### 7.5 Operator → System

- **IF-11** Spin-up MUST take N as a parameter (FR-SIM-1).
- **IF-12** Controls MUST be operable without typing during the pitch.

---

## 8. Non-functional requirements

### 8.1 Performance and throughput

| ID | Requirement | Target | Ver |
|---|---|---|---|
| NFR-P-1 | Settlement cadence per session | **1 Hz for simulated sessions (M6) — this is the product claim.** Booth sessions (M8) settle at 6 s, because 60 of them at 1 Hz would need 60 tx/s. The two never run at full load together: UC-10 ramps simulated sessions down as phones connect, so the budget carries either ~10 simulated at 1 Hz or 60 phones at 6 s, not both | D |
| NFR-P-2 | Concurrent sessions sustained during the demo | **~10 on-chain simulated sessions at 1 Hz**, comfortably inside the measured 10 tx/s write ceiling (§13.4). Booth players are **unbounded** and contribute zero chain load (§16); the game server, not the chain, is their only limit | D |
| NFR-P-3 | Settlement visible on the wall after landing | ≤ 1 s | D |
| NFR-P-4 | Dashboard frame rate at target concurrency | Readable, no visible stutter | D |
| NFR-P-5 | Booth app frame rate on mid-range Android | 60 fps | T |
| NFR-P-6 | Booth app time from QR scan to playable | ≤ 3 s on venue wifi | D |

**NFR-P-2 is the project's central claim.** `idea.md` §11b: a slower or costlier chain could not sustain this many concurrent per-second settlements live on stage. If this number is not met, the pitch must state the number actually achieved rather than the number hoped for.

### 8.2 Reliability

| ID | Requirement | Ver |
|---|---|---|
| NFR-R-1 | The demo MUST complete its three minutes without a visible freeze. | D |
| NFR-R-2 | Any single component failure MUST degrade the demo rather than end it. | D |
| NFR-R-3 | Degraded operation MUST be labelled, never disguised. | I |
| NFR-R-4 | A recorded fallback MUST exist before code freeze. | I |

### 8.3 Security

| ID | Requirement | Ver |
|---|---|---|
| NFR-S-1 | No value moves without a valid signed metering event. | T |
| NFR-S-2 | Identity spoofing MUST NOT redirect payment. | T |
| NFR-S-3 | Replayed readings MUST be rejected. | T |
| NFR-S-4 | No private key is committed to the repository. | I |
| NFR-S-5 | The relay hot wallet holds only demo funds, and its exposure is stated in the README. | I |
| NFR-S-6 | The booth app collects no credential, key, or payment detail. | I |

### 8.4 Usability

| ID | Requirement | Ver |
|---|---|---|
| NFR-U-1 | The wall is readable from ten metres by someone who has not seen it before. | D |
| NFR-U-2 | A viewer ten metres away can tell charge from discharge without reading text. On the wall this is carried by **direction of travel and fill state**, not by a second hue — see §17. | D |
| NFR-U-3 | The booth app is playable one-handed, in portrait, on a scratched screen in a bright room. | D |
| NFR-U-4 | The booth app respects `prefers-reduced-motion`. | I |

### 8.5 Maintainability and transparency

| ID | Requirement | Ver |
|---|---|---|
| NFR-M-1 | Every simplification against the real standards is documented in the README. | I |
| NFR-M-2 | Contract source is verifiable against the deployed address. | I |
| NFR-M-3 | The repository is public and the deployment is operational on Monad testnet (CON-2). | I |
| NFR-M-4 | The signature-verification trust boundary (ASM-6: off-chain in the relay, not per-signature on-chain) is stated explicitly in the README and in the pitch, alongside the named production path (e.g. a ZK-proof of the verified batch submitted on-chain) that would close it. | I |

---

## 9. Traceability

| Use case | Requirements | Modules | Demo beat |
|---|---|---|---|
| UC-1 Open charging session | FR-ID-1..5, FR-PR-1, FR-SET-1 | M1, M3, M4 | Sessions appear |
| UC-2 Settle continuously | FR-MET-1..3, FR-SET-2,3,6,9 | M2, M4, M5 | The feed scrolls |
| UC-3 Terminate on unplug | FR-SET-4,5 | M4 | Nodes go quiet |
| UC-4 V2G reversal | FR-PR-2,3, FR-MET-6, FR-SET-7 | M2, M3, M4 | Direction flips |
| UC-5 Concurrent spin-up | FR-SIM-1..3, FR-REL-2 | M5, M6 | Idle → live |
| UC-6 Observe | FR-DASH-1..6,10 | M7 | The whole demo |
| UC-7 Refuse unsigned payment | FR-SET-2, FR-MET-3,7 | M2, M4 | Spoken, or shown on request |
| UC-8 RPC degradation | FR-REL-4,5, FR-DASH-6 | M5, M7 | Invisible if it works |
| UC-9 Audience session | FR-BOOTH-1..4, FR-REL-6 | M8, M5 | The room joins |
| UC-10 Room surge | FR-OPS-2,4, FR-BOOTH-3 | M8, M9 | The climax |
| UC-11 Registration | FR-ID-3,5,6 | M1 | Setup |
| UC-12 Rate change | FR-PR-4 | M3, M4 | Spoken |

**Requirements serving no use case, and why they stay:** FR-SET-8 (funding limit) and FR-REL-3 (nonces) are failure-mode requirements. Neither appears in a demo beat, and both end the demo if unmet.

---

## 10. Acceptance criteria

The system is done when all of these hold. Anything unmet is stated plainly rather than presented as met.

| ID | Criterion | Ver |
|---|---|---|
| AC-1 | A charging session opens with no human entering payment details. | D |
| AC-2 | Value moves at 1 Hz, on-chain, against signed metering. | D |
| AC-3 | Unplugging stops the payment, and no invoice step follows. | D |
| AC-4 | A V2G session pays the vehicle using the same path with the sign flipped. | D |
| AC-5 | At least ten concurrent sessions settle live, with both directions running. | D |
| AC-6 | The wall shows the feed, the counters, the node view, and the split. | D |
| AC-7 | A settlement without a signed reading is refused. | D — the operator submits one deliberately malformed reading on demand (FR-OPS-7) and the system visibly rejects it. Deliberately not `T`: no adversarial test harness is realistically buildable today, and claiming one would be a verification method nobody can run |
| AC-8 | The demo survives forced RPC degradation. | D |
| AC-9 | The contracts are deployed and verifiable on Monad testnet; the repository is public. | I |
| AC-10 | A recorded fallback exists. | I |
| AC-11 | Every simplification is documented. | I |

---

## 11. Priority slice for the 18:00 freeze

Not everything above ships today. This is the honest cut.

**Must exist by freeze** — AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-9, AC-10, and every `M` requirement in M1, M2, **M5**, M4, M6, M7.

**M5 was missing from this list until 2026-08-08 and its absence was a serious defect.** The earlier slice named M1, M2, M4, M6 and M7 only, which was correct while batching was the primary architecture and a trivial submitter would do. Under the per-tick decision (§13.3) the relay carries seven `M` requirements including the wallet pool (FR-REL-8), and without them AC-2 and AC-5 — the project's central claim — do not ship.

**FR-REL-9's measurement is the first task of the build, before contracts.** It is cheap, it takes minutes, and its result decides whether the per-tick path survives at all. Every other fork in §13.3 hangs off that number, so measuring it late means discovering the answer after the code that depends on it exists.

**Should follow if time allows** — M5 batching beyond the simplest form, M8 relay integration, FR-OPS-2, FR-DASH-9.

**Explicitly not today** — FR-SET-11 (rate-based streaming), FR-ID-7 (live key derivation from certificates), FR-MET-8 (real hardware), FR-PR-5 (live oracle). Each is the production path and is described as such rather than dropped in silence.

**The order that protects the demo:** contracts and metering first, because nothing else has anything to show without them. The dashboard next, because it is what the audience actually sees. The relay's batching after that, since a simple submitter is enough at low N. The booth app last, because it is the only module whose absence costs nothing on stage.

---

## 12. Risks

| ID | Risk | Impact | Mitigation | Owner |
|---|---|---|---|---|
| RSK-1 | Public RPC rate-limits under demo load | Wall freezes mid-pitch — the worst identified failure | Batching (FR-REL-2), degraded mode (FR-REL-4), rehearse at a conservative N | Relay |
| RSK-2 | Architecture changes late because Q2 was decided under pressure | Rework at the worst hour | Decide batching before any contract code is written | Lead |
| RSK-3 | Venue wifi collapses | Audience cannot join | FR-OPS-4: the beat runs with zero phones | Operator |
| RSK-4 | Faucet cannot fund the relay's wallet pool and the pre-registered identity pool | Concurrency drops, or per-tick becomes impossible | Size the pool to the rehearsed bar of ten rather than the stretch fifty; fund it early, before the faucet is under load from every other team. Mitigation rewritten 2026-08-08 — the previous one ("relay-owned hot wallet, so N wallets are not needed") was written when batching was primary and is false under FR-REL-8 | Relay |
| RSK-5 | Reviewer reads the project as "Superfluid plus an EV skin" | Novelty score suffers | Lead with why 1 Hz settlement is economic only at this cost profile; do not claim the primitive is new | Pitch |
| RSK-6 | Simulated metering read as overclaiming | Credibility loss with a technical audience | FR-MET-5 labelling, stated aloud in the pitch | Pitch |
| RSK-7 | Time lost to a module with no stage presence | Core unfinished | §11 build order | Lead |

---

## 13. Open decisions

Blocking items live in `docs/idea/open_questions.md` and are not duplicated here. Their requirement impact:

| Open question | Requirements waiting on it |
|---|---|
| Q1 · Dedicated RPC endpoint? | FR-REL-2, FR-REL-4, NFR-P-2 |
| ~~Q2 · Per-tick calls or batched aggregation as primary?~~ | **RESOLVED 2026-08-08: per-tick, one transaction per session per tick.** Batching demoted to fallback. See FR-REL-1, FR-REL-2, and §13.3. |
| ~~Q3 · Target concurrency N?~~ | **RESOLVED 2026-08-08: rehearse at 10, attempt 50.** Recorded in NFR-P-2 and AC-5. `open_questions.md` still reads "Unresolved" and is now stale on this point. |

### 13.1 Decisions recorded against this baseline

| Decision | Choice | Where it lives |
|---|---|---|
| Concurrency acceptance bar | 10 rehearsed, 50 attempted | NFR-P-2, AC-5 |
| Booth app build position | Last, after the core modules | §11 build order |
| Driver-facing screen | None. A6 stays screenless | §2.3, no UI requirement |
| Honesty constraints strength | All three remain MUST | FR-BOOTH-6, FR-BOOTH-8, FR-MET-5 |
| Primary settlement architecture | One transaction per session per tick. Batching is the fallback. Resolves Q2 | FR-REL-1, FR-REL-2, §13.3 |
| Booth player reward | 20% of any cash prize won, top 10, conditional on the team placing. Unconditional pot declined | Booth spec §7, table A |
| FR-BOOTH-8 scope | Amended: soliciting votes stays banned; stating the payout's dependency on placement is now required | FR-BOOTH-8, FR-BOOTH-7 |
| Contest reveal | Public screen live all day, sealed 10 s before close, winners revealed later in Discord | FR-BOOTH-10..12, booth spec §3.8 |
| Booth cheat defence | Engine caps effective tap rate at 30/s, above any human; runs averaging >18/s flagged for review before the reveal. **The 4,200 score ceiling recorded here earlier was dead on arrival — the curve's asymptote is 4,040.** Server-side recompute stays P1 | FR-BOOTH-13, booth spec §6 |

Two further items originate in this document:

| ID | Decision | Blocks |
|---|---|---|
| OD-1 | Are booth-app sessions settled on-chain, or reported to the wall only? | FR-BOOTH-3, FR-REL-6 |
| OD-2 | Pre-provisioned wallets, or identities derived live from the handshake? | FR-ID-7 |

### 13.2 Gaps found and closed against this baseline (2026-08-08, adversarial review with Gemini 3.1 Pro)

| Gap | Resolution | Where it lives |
|---|---|---|
| Signature verification location undefined; on-chain-per-tick is infeasible at target concurrency | Named as a trust boundary: relay (M5) verifies off-chain, contract trusts the relay's attestation | ASM-6, FR-SET-2, IF-1, NFR-M-4 |
| Booth app has no key but FR-MET-3 requires every reading signed | ~~Ephemeral client-side key~~ — resolved differently by §16: the booth signs nothing, so the conflict no longer exists. FR-BOOTH-9 withdrawn | FR-BOOTH-9 |
| FR-BOOTH-1/2/4/5/6/7/8 all marked M despite M8 being built last with "absence costs nothing" | Split: playability requirements (1/2/4) downgraded to S; standing constraints (5/6/7/8) stay M as conditional ("if it ships, these are non-negotiable") | M8 table |
| FR-DASH-8/IF-6 banned long-lived connections, which forces high-frequency polling that would overload the relay | Reworded to require a reconnect-safe streaming transport (SSE/WS with auto-reconnect), not a ban on streaming itself | FR-DASH-8, IF-6 |
| NFR-P-2 (50 simulated) and IF-10 (60-phone surge) were never reconciled — additive reading implies a ~110 peak, past RSK-1's named worst failure mode | Surge substitutes for simulated load rather than adding to it; excess is capped and labelled, not silently allowed through | UC-10, FR-OPS-2 |
| AC-7 marked **T** with no automated adversarial harness realistically buildable today | Changed to **D**, backed by a new operator control that submits one deliberately malformed reading on demand | AC-7, FR-OPS-7 |
| IF-4 left ambiguous whether the relay or the contract computes MON from energy — if the relay computes it, FR-SET-3 is asserted, not enforced | Contract does `whDelta × price` on-chain from a relay-submitted energy delta, never a relay-submitted MON amount | IF-4 |
| FR-REL-3 (nonce management) implied general concurrent-tx handling that contradicts FR-REL-2's single-batch-per-interval model | Scoped down to serialised-pipeline nonce handling only | FR-REL-3 |
| No pre-registration step specified for M6's simulated identities; registering ~50 identities live during spin-up would burn RPC headroom right before the demo needs it | Pool of identities registered during deployment, before code freeze; spin-up draws from the pool | UC-11, FR-SIM-6 |

### 13.3 Consequences of the per-tick decision

One transaction per session per tick was chosen over bundling for the stronger claim: separate transactions, no aggregation, nothing hidden. Three things follow, and none are optional.

**A pool of wallets, not one.** A single account's transactions are processed in nonce order, so one wallet cannot issue many per second in parallel — they queue behind each other. The relay needs several funded wallets submitting concurrently (FR-REL-8). This makes ASM-1 harder than it looked: the faucet must fund a pool, and its own limits are unverified.

**The RPC limit must be measured, not assumed.** No published figure exists for the public testnet endpoint. Send transactions at a rising rate and find where it starts refusing (FR-REL-9). That turns the project's largest unknown into a number, in minutes.

**Load scales with concurrency, so the rehearsed number carries the demo.** At the acceptance bar of ten sessions this is ten transactions a second, a far smaller bet than fifty. The fifty-session attempt is a stretch target, not a pass condition (AC-5). If the measurement comes back below what the stretch needs, run the stretch from a recording.

**Open tension with §13.2.** The adversarial review scoped FR-REL-3 down to serialised-pipeline nonce handling and said to build nothing more. That reasoning assumed batching was primary. The per-tick decision reinstates the parallel-nonce work it ruled out. FR-REL-3 now covers both modes explicitly, but the two conclusions were reached from different premises and the reviewer has not seen the newer decision.

**Reversal trigger.** If measured capacity cannot sustain ten sessions with headroom, switch to FR-REL-2 batching — and FR-REL-3 collapses back to the simpler serialised form. Make that call on the measurement, early, not on stage.

### 13.4 The RPC measurement, and what it decided

Run 2026-08-08 against `https://testnet-rpc.monad.xyz` with `tools/measure-rpc.mjs`. Read calls (`eth_blockNumber`), paced by arrival time, five to six seconds per rate.

| req/s | ok | 429 | p50 ms | p95 ms |
|---|---|---|---|---|
| 5 | 25/25 | 0 | 27 | 118 |
| 10 | 50/50 | 0 | 24 | 103 |
| 20 | 100/100 | 0 | 21 | 108 |
| 40 | 200/200 | 0 | 81 | 162 |
| 45 | 267/270 | 3 | 99 | 147 |
| 50 | 296/300 | 4 | 456 | 731 |
| 60 | 350/360 | 10 | 900 | 1,761 |
| 70 | 416/420 | 4 | 1,960 | 3,815 |

**The knee is between 40 and 45 req/s.** Latency is flat to about 20 req/s, rises by 40, and collapses past 50.

**What it settles:**

- **AC-5's ten concurrent sessions need 10 tx/s. That has roughly four times headroom and sits in the flat-latency band.** Per-tick settlement (FR-REL-1) is the right call at the rehearsed bar, and the reversal trigger above does not fire.
- **The fifty-session stretch in NFR-P-2 is not achievable live.** 50 req/s is already past the knee for read calls, which are the cheap ones — writes add signature recovery, nonce ordering and mempool admission, so the write ceiling is strictly lower than 40. Run the stretch from a recording, or drop the claim. Attempting it live walks into RSK-1.
- **CON-5 is closed.** The limit was undocumented; it is now measured. It was never published because it is enforced dynamically — refusals begin as a trickle (1.1% at 45 req/s) rather than a hard cutoff, so a naive test at a single rate would have missed it entirely.

**RETRACTED 2026-08-08 — the write ceiling below was not real.** Kept because three decisions were made on it and the record should show why.

A re-test at higher rates from the same wallet returned **25 tx/s: 75/75 clean · 40 tx/s: 109/120 · 60 tx/s: 180/180 clean**. A failure rate that does not rise with load is not a ceiling. The 40 tx/s losses were all `The request timed out` and the same wallet then ran 60 tx/s without a single failure.

**What actually happened.** The original run showed 30/30 at 10 tx/s and 43/45 at 15, and a 4% loss was read as the onset of rate limiting. It was noise. The read measurement has the same defect: 3 refusals in 270 at 45 req/s and 4 in 300 at 50 were called a knee on the same reasoning. **Neither number should be quoted as a capacity limit.** What both runs do establish is that transient timeouts occur at a low single-digit rate at every load tested, so the relay needs retry, which it needed anyway.

Contributing factor: the runs used the shared public key `0x…0001`, whose nonce moved from 20 to 89 between runs, so other people are actively transacting from it. Contention was never ruled out.

**Consequences, stated plainly:**

- **The zero-margin alarm was false.** Ten simulated sessions at 1 Hz is not at any ceiling.
- **FR-REL-8's wallet pool is not supported by evidence.** A single wallet sustained 60 tx/s. The nonce-serialisation argument may still hold at some higher rate, but nothing here demonstrates it, and the pool should not be built on this measurement.
- **§16's split does not depend on this.** It was justified partly by these numbers, and that part is void. It stands on the reasons that survive: the crowd path no longer depends on public infrastructure the team does not control, the demo cannot be taken down by someone else's traffic, and player count is unbounded. Those were the owner's reasons and they are unaffected. **It is 15:40 and the split is specced and agreed; reopening it on a corrected number would cost more than it could win.**

**The measurement that would settle it** is still the one nobody has run: several *own* funded wallets, from the venue network, close to the pitch. Until then treat write capacity as *"at least 60 tx/s single-wallet, ceiling unknown, expect ~1-3% transient timeouts at any rate"*.

---

**Original run, retained for the record (do not quote as a limit).**

**Write path, measured 2026-08-08 (provisional).** Run with `tools/measure-write-rpc.mjs` from a single wallet:

| tx/s | ok | p50 ms | verdict |
|---|---|---|---|
| 2 | 6/6 | 52 | clean |
| 5 | 15/15 | 50 | clean |
| 10 | 30/30 | 50 | **clean — ceiling** |
| 15 | 43/45 | 159 | refused |
| 20 | 58/60 | 530 | refused |
| 30 | 85/90 | 1,677 | refused |

**10 tx/s from one wallet, which is exactly what the design needs and therefore zero margin.** 60 players at a 6-second interval is 10 tx/s on the nose; any variance on the day costs settlements mid-pitch. The interval is therefore widened to **8 seconds** (7.5 tx/s, 25% headroom, 5 settlements per player across a 45-second round).

**Provisional, for two reasons.** It ran from the well-known public test key `0x…0001`, which others also use, so contention may have depressed the result. And the failures above 10 tx/s classified as "other" rather than rate-limit, nonce or mempool, so the mechanism of refusal is not identified.

**FR-REL-8 remains unproven.** Whether 10 tx/s is the node's limit or one account's nonce ordering is exactly what decides if the wallet pool is essential or wasted work, and it cannot be answered without more funded wallets — only key #1 has a balance. Re-run as `PRIVATE_KEY=k1,k2,k3 node tools/measure-write-rpc.mjs --send`. If the ceiling rises with the pool, FR-REL-8 is proven and the interval can go back to 6 seconds.

**One bug worth recording**, because it would otherwise be repeated: the first run hardcoded `maxFeePerGas` at 60 gwei while the base fee was 102. Every send failed with "Transaction fee too low" and the tool reported a ceiling below 2 tx/s — a fabricated capacity limit that was purely a client-side fee bug. Fees are now read from the chain per run.

---

## 14. Out of scope

Named so nobody builds them by accident, and so a reviewer can see the boundary was chosen rather than missed.

- A driver-facing consumer application, onboarding, or account system (`idea.md` §11)
- A full ISO 15118 stack: TLS mutual authentication, EXI encoding, certificate provisioning chains (CON-7)
- Real metering hardware and legal-for-trade certification
- Roaming or settlement between charging networks
- Fiat on-ramp, off-ramp, or tax treatment
- Grid physics: load balancing, frequency response, battery degradation modelling
- Mainnet deployment, audits, key management for production funds

---

## 15. Glossary

See §1.4. Additional terms used in requirements: **tick** (one metering interval and its settlement effect), **the wall** (the projector dashboard, module M7), **degraded mode** (any reduced-cadence or larger-batch operation entered under RPC pressure, which must always be labelled).


---

## 16. The demo/backend split (decided 2026-08-08)

**The booth app makes no chain calls.** Not one. No wallets, no RPC, no transaction submission, no gas, no confirmations. It runs the settlement engine in memory against a game server, and everything a player sees is computed locally to the same rules the on-chain contract uses.

### 16.1 Why

The write measurement in §13.4 put the single-wallet ceiling at 10 tx/s. Sixty phones settling individually needed exactly that, with no margin, on public infrastructure the team does not control and cannot provision. Every attempt to fit the crowd inside that budget — capping players, widening the interval, pooling wallets — traded away either audience size or safety, and the pool remained unproven for want of a funded wallet.

Moving the crowd off-chain removes the constraint rather than negotiating with it. The real settlement demo needs only about ten concurrent sessions, which sits comfortably inside the measured ceiling, and it runs from a wallet the team funds and controls.

### 16.2 The seam

| | Booth app (M8) + game server (M10) | Real rail (M1–M7) |
|---|---|---|
| Settlement | In memory, same accounting rules | On-chain, Monad testnet |
| Wallets | None | Funded, team-controlled |
| Chain calls | **Zero** | Per-tick, 1 Hz |
| Players | Unbounded | ~10 simulated sessions |
| Label | `SIMULATION — same engine, nothing on-chain` | `LIVE — Monad testnet` + contract address |

The engine SHOULD be the literal same accounting module both sides use, so "same engine, simulated" is true by construction rather than by assertion.

### 16.3 Requirements

| ID | Requirement | Pri | Ver |
|---|---|---|---|
| FR-SPLIT-1 | The booth app MUST make zero chain calls and hold no key material. | M | I |
| FR-SPLIT-2 | The booth app MUST NOT display anything that looks verifiable but is not — no transaction hashes, block numbers, addresses, or explorer-styled links. A developer will paste one into the explorer within seconds of seeing it. Simulated MON and kWh figures are fine because nobody can mistake them for a receipt. | M | I |
| FR-SPLIT-3 | Scoring MUST be server-authoritative: the game server computes the score from tap events and the client renders only. With cash on a public leaderboard and a room full of developers, a client-reported score is an open endpoint. | M | T |
| FR-SPLIT-4 | The game server MUST rate-cap taps per connection at the engine cap (30/s, FR-BOOTH-13). | M | T |
| FR-SPLIT-5 | Both surfaces MUST carry their label permanently and visibly: the phone reads `SIMULATION — same engine, nothing on-chain`, the dashboard reads `LIVE — Monad testnet` with the contract address. The symmetry is what makes the honesty structural rather than a disclaimer. | M | D |
| FR-SPLIT-6 | Player count MUST be unbounded by the chain. Any limit is the game server's and MUST be stated if one exists. | M | D |

### 16.4 The bridge: one aggregate settlement

At the close of the pitch, the room's combined simulated energy settles as **a single real transaction** on Monad testnet, from the team's funded wallet, and the presenter shows the hash on the explorer.

| ID | Requirement | Pri | Ver |
|---|---|---|---|
| FR-SPLIT-7 | The game server MUST expose the room aggregate (total kWh, total MON) for a single `settleRoomAggregate` submission. | M | D |
| FR-SPLIT-8 | The aggregate transaction MUST be pre-signed with automatic retry, and a rehearsal aggregate MUST be minted ten minutes before the pitch. If the live send stalls beyond five seconds, show the rehearsal hash and **say plainly what it is**. | M | D |

One transaction against a measured 10 tx/s ceiling is tenfold margin, confirms inside a second, and is genuinely explorer-verifiable. Netting off-chain metering into one on-chain settlement is an established pattern rather than a dodge.

**Rejected alternatives.** An offline queue settling after the pitch is invisible at the moment people vote, and "it'll settle later" is the sound of an overclaim. A pre-recorded replay is discounted to zero by a developer audience and contaminates trust in the live dashboard beside it.

### 16.5 The honesty line

Said by the presenter **before anyone asks**, because volunteering the limitation converts it into evidence of rigour:

> "We load-tested Monad's public RPC this afternoon — it holds ten transactions a second from one wallet, and sixty phones settling individually is exactly ten a second with zero margin. So we made an engineering call: your phone runs our settlement engine in pure simulation, zero chain calls, and the projector is the real rail, live on Monad testnet right now. Here's the explorer. Check any session."

A peer vote punishes perceived overclaiming far harder than it punishes modest scope.

### 16.6 Residual risk

The risk has moved, not vanished. It is now **venue wifi**. Host the game server in the cloud so phones can fall back to cellular; run the dashboard locally with a hotspot.


---

## 17. Wall palette: one accent, direction carried by form

The booth palette is cyan on near-black with a single accent, and the Flip inverts the whole screen (booth spec §10). **That inversion is only available to the phone**, which shows one session at a time. The wall shows many concurrent sessions and cannot invert per node, so the question is whether it needs a second hue to satisfy NFR-U-2.

**Decision: it does not. The wall stays single-accent, and direction is carried by form.**

| | Charging | Selling to grid |
|---|---|---|
| Node | Solid fill | Hollow ring |
| Pulse | Travels **inward**, toward the node | Travels **outward**, away from it |
| Luminance | Cyan at power-proportional brightness | Same, plus a brighter rim |

NFR-U-2 asks that a viewer tell the two apart *without reading text*, not specifically by colour. Direction of travel is more legible across a room than hue is, and it is truthful rather than decorative: the pulse moves the way the energy moves. A projector also distorts colour unpredictably while it never distorts motion.

**This is a reversible call with a test.** At rehearsal, stand ten metres from the projector with both directions running and see whether the difference reads in under two seconds. If it does not, the documented fallback is to give V2G nodes a **white-hot rim** rather than introducing a third colour, keeping the cyan-and-black identity intact.

**Why not simply add a second hue.** The booth spec's §10 argument holds here too: cyan on black is one screenshot away from every generated dark dashboard, and single-accent restraint is most of what separates them. A second hue added for legibility would be defensible; a second hue added by default would not, and the test decides which this is.
