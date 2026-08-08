# Amber Current — Software Requirements Specification

**The main requirements document.** Everything else in `docs/specs/` is subordinate to this file.

| | |
|---|---|
| **System** | Amber Current — per-second machine-to-machine settlement for EV charging on Monad |
| **Version** | 1.0 |
| **Date** | 2026-08-08 |
| **Source of truth for intent** | `docs/idea/idea.md`, `docs/idea/story.md` |
| **Status** | Baselined. Open items tracked in §13 and `docs/idea/open_questions.md` |

---

## 1. Introduction

### 1.1 Purpose

This document states what Amber Current must do, for whom, and how each requirement will be shown to have been met. It is written for three audiences: the people building it today, a peer reviewing the submission, and anyone picking the project up afterwards.

### 1.2 Product scope

Amber Current is a **settlement rail**. A vehicle and a charging station authenticate each other automatically on physical connection, open a payment relationship between their on-chain wallets, and move value continuously in step with metered energy — in either direction — for exactly as long as current flows. When the current stops, the obligation stops. There is no invoice step, because the last settled on-chain state already is the bill.

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

Amber Current sits between two existing standards and a chain, and invents neither end:

```
   ISO 15118 Plug & Charge          OCMF signed metering
   (identity, already solved)       (trusted measurement, already solved)
              │                              │
              └──────────────┬───────────────┘
                             ▼
                   ┌───────────────────┐
                   │  AMBER CURRENT    │   ← the contribution
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
| **ASM-1** | Testnet faucet supplies enough MON to fund all demo wallets. | Reduce concurrency; fund one relay wallet only |
| **ASM-2** | Simulated metering is acceptable to reviewers when labelled honestly. | Nothing changes; labelling is already required by FR-MET-5 |
| **ASM-3** | Venue wifi is usable but unreliable. | §12 fallback ladder governs |
| **ASM-4** | Public RPC sustains at least a few transactions per second. | Batched settlement (M5) becomes mandatory rather than preferred |
| **ASM-5** | Reviewers accept a simplified handshake as "modelled on" ISO 15118. | Weaken the claim in the pitch, not the code |

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
3. Room-total power crosses a marked threshold on the wall.
**Alternates**
- *2a* No phones connected → the wall carries the beat with simulated load and the operator's script does not change.
**Postconditions** The throughput claim is demonstrated by the audience rather than asserted by the presenter.

### UC-11 · Register a vehicle or station identity
**Actors** A1, A2 · **Main flow** An identity is bound to a wallet address in the registry, so a later handshake resolves to a payable address.
**Alternates** *1a* Duplicate registration → rejected.
**Postconditions** The handshake step and the payment step are cryptographically linked, so a spoofed station cannot redirect payment.

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
| FR-SET-2 | Value MUST move only in response to a validated signed metering event. **This is the security core of the system.** | M | T |
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
| FR-REL-1 | The relay MUST submit settlements for all active sessions without requiring one funded wallet per session. | M | I |
| FR-REL-2 | The relay MUST support aggregating many sessions' ticks into one transaction per interval. | M | D |
| FR-REL-3 | The relay MUST manage nonces so concurrent submissions do not collide or stall. | M | T |
| FR-REL-4 | On RPC failure or rate limiting, the relay MUST degrade — larger batches or lower cadence — rather than dropping sessions silently. | M | D |
| FR-REL-5 | The relay MUST expose its current mode so the dashboard can state it. | M | I |
| FR-REL-6 | The relay MUST accept energy deltas from booth-app sessions through the same interface as simulated ones. | S | T |
| FR-REL-7 | The relay MUST NOT hold or require any participant's private key beyond its own hot wallet. | M | I |

### M6 — Simulator & spawner

| ID | Requirement | Pri | Ver |
|---|---|---|---|
| FR-SIM-1 | The spawner MUST create N concurrent vehicle/station pairs where N is a runtime parameter. | M | D |
| FR-SIM-2 | Spawned sessions MUST include both charging and discharging sessions concurrently. | M | D |
| FR-SIM-3 | Each simulated session MUST have an independent charge curve, so the wall does not show synchronised clones. | M | D |
| FR-SIM-4 | The spawner MUST be able to run at a rehearsed conservative N and a higher stress N. | S | D |
| FR-SIM-5 | Sessions SHOULD start staggered rather than simultaneously, to avoid a self-inflicted RPC spike. | S | I |

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
| FR-DASH-8 | The dashboard MUST NOT depend on a single long-lived connection that expires mid-demo. | M | A |
| FR-DASH-9 | The dashboard SHOULD link a settlement to its transaction on a block explorer. | S | D |
| FR-DASH-10 | The dashboard MUST open on an idle state and become live on operator action, so the transition is visible. | M | D |

### M8 — Booth app

Full design: `docs/specs/2026-08-08-booth-frontend-design.md`. Requirements here are the system-level obligations only.

| ID | Requirement | Pri | Ver |
|---|---|---|---|
| FR-BOOTH-1 | A participant MUST reach a playable state from QR scan with no install, no login, and no wallet. | M | D |
| FR-BOOTH-2 | The app MUST NOT block on the network at any point, and MUST NOT display a network error to a participant. | M | D |
| FR-BOOTH-3 | The app MUST report energy deltas to the relay through the M5 interface. | S | T |
| FR-BOOTH-4 | The app MUST remain fully playable with the relay unreachable. | M | D |
| FR-BOOTH-5 | The app MUST NOT collect credentials, private keys, or payment details. | M | I |
| FR-BOOTH-6 | Any participant reward MUST be decided by skill, never by a randomly assigned attribute. | M | I |
| FR-BOOTH-7 | Reward terms MUST be stated in the app before a participant plays. | M | I |
| FR-BOOTH-8 | The app MUST NOT reference voting, judging, or the team's placement anywhere. | M | I |

### M9 — Demo control & observability

| ID | Requirement | Pri | Ver |
|---|---|---|---|
| FR-OPS-1 | The operator MUST be able to start the network with one deterministic action. | M | D |
| FR-OPS-2 | The operator MUST be able to trigger a room surge that reaches connected phones. | S | D |
| FR-OPS-3 | The operator MUST be able to force degraded mode, to rehearse it. | S | D |
| FR-OPS-4 | The system MUST run the full demo beat with zero phones connected. | M | D |
| FR-OPS-5 | A recorded fallback of the working system MUST exist before code freeze. | M | I |
| FR-OPS-6 | Logs MUST retain enough detail to answer "did that settlement really land on chain" after the fact. | S | I |

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

- **IF-1** The consumer MUST verify `signature` against the registered `meterId` key before any value moves.
- **IF-2** `seq` MUST increase monotonically per session.
- **IF-3** `whDelta` MAY be negative, which denotes discharge.

### 7.2 Relay → Chain

- **IF-4** A batch submission MUST carry an array of per-session deltas and settle them atomically.
- **IF-5** A partial batch failure MUST NOT settle any entry in that batch.

### 7.3 Chain → Dashboard

- **IF-6** Settlement events MUST be consumable without a WebSocket subscription, because the dashboard cannot depend on a long-lived connection (FR-DASH-8).
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
| NFR-P-1 | Settlement cadence per session | 1 Hz, configurable | D |
| NFR-P-2 | Concurrent sessions sustained during the demo | ≥ 10 rehearsed, ≥ 50 attempted | D |
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
| NFR-U-2 | A viewer can tell charge from discharge without reading text. | D |
| NFR-U-3 | The booth app is playable one-handed, in portrait, on a scratched screen in a bright room. | D |
| NFR-U-4 | The booth app respects `prefers-reduced-motion`. | I |

### 8.5 Maintainability and transparency

| ID | Requirement | Ver |
|---|---|---|
| NFR-M-1 | Every simplification against the real standards is documented in the README. | I |
| NFR-M-2 | Contract source is verifiable against the deployed address. | I |
| NFR-M-3 | The repository is public and the deployment is operational on Monad testnet (CON-2). | I |

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
| AC-7 | A settlement without a signed reading is refused. | T |
| AC-8 | The demo survives forced RPC degradation. | D |
| AC-9 | The contracts are deployed and verifiable on Monad testnet; the repository is public. | I |
| AC-10 | A recorded fallback exists. | I |
| AC-11 | Every simplification is documented. | I |

---

## 11. Priority slice for the 18:00 freeze

Not everything above ships today. This is the honest cut.

**Must exist by freeze** — AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-9, AC-10, and every `M` requirement in M1, M2, M4, M6, M7.

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
| RSK-4 | Faucet cannot fund enough wallets | Concurrency drops | Relay-owned hot wallet, so N wallets are not needed | Relay |
| RSK-5 | Reviewer reads the project as "Superfluid plus an EV skin" | Novelty score suffers | Lead with why 1 Hz settlement is economic only at this cost profile; do not claim the primitive is new | Pitch |
| RSK-6 | Simulated metering read as overclaiming | Credibility loss with a technical audience | FR-MET-5 labelling, stated aloud in the pitch | Pitch |
| RSK-7 | Time lost to a module with no stage presence | Core unfinished | §11 build order | Lead |

---

## 13. Open decisions

Blocking items live in `docs/idea/open_questions.md` and are not duplicated here. Their requirement impact:

| Open question | Requirements waiting on it |
|---|---|
| Q1 · Dedicated RPC endpoint? | FR-REL-2, FR-REL-4, NFR-P-2 |
| Q2 · Per-tick calls or batched aggregation as primary? | FR-SET-6, FR-SET-9, FR-REL-1..3 — this decides contract signatures and the dashboard's event schema, so it must be settled before contract code is written |
| ~~Q3 · Target concurrency N?~~ | **RESOLVED 2026-08-08: rehearse at 10, attempt 50.** Recorded in NFR-P-2 and AC-5. `open_questions.md` still reads "Unresolved" and is now stale on this point. |

### 13.1 Decisions recorded against this baseline

| Decision | Choice | Where it lives |
|---|---|---|
| Concurrency acceptance bar | 10 rehearsed, 50 attempted | NFR-P-2, AC-5 |
| Booth app build position | Last, after the core modules | §11 build order |
| Driver-facing screen | None. A6 stays screenless | §2.3, no UI requirement |
| Honesty constraints strength | All three remain MUST | FR-BOOTH-6, FR-BOOTH-8, FR-MET-5 |

Two further items originate in this document:

| ID | Decision | Blocks |
|---|---|---|
| OD-1 | Are booth-app sessions settled on-chain, or reported to the wall only? | FR-BOOTH-3, FR-REL-6 |
| OD-2 | Pre-provisioned wallets, or identities derived live from the handshake? | FR-ID-7 |

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
