# Idea: Real-Time Machine-to-Machine Payments for EV Charging (on Monad)

## 1. One-line pitch

A plug-and-charge EV connector that is also a live payment stream: MON flows automatically, per second, priced per kWh, exactly matched to metered energy — in either direction (grid→car or car→grid) — with no invoice, no subscription, and no settlement lag, because it settles on Monad, the only chain fast and cheap enough to make per-second on-chain payment economically real.

## 2. The problem this solves

Today's EV charging and V2G payment stack is built entirely around *batching*, because blockchains (and even most legacy payment rails) are too slow or too expensive to settle per-second:

- **Charging networks** meter continuously but bill in coarse chunks — a flat session fee, a rounded kWh estimate, or a post-hoc invoice. The user has no real-time visibility into what they owe until the session ends (or later).
- **Subscriptions and RFID/app-based billing** require an account, a card on file, a monthly reconciliation process, and a trust relationship with an operator — friction that is especially bad for casual/one-off charging (a stranger's driveway charger, a highway rest stop, a workplace charger).
- **V2G (vehicle-to-grid) payouts** are almost nonexistent at the individual level today specifically *because* the settlement infrastructure for "many small, short, bidirectional energy trades" doesn't exist cheaply. Utilities that want distributed batteries to peak-shave have no low-friction way to pay a random car $0.30 for 20 minutes of discharge at 6:47pm.
- **Disputes and estimation errors** are common with post-hoc billing — "you were charged for a session that ended early," "the rate changed mid-session and no one told you." A live, metered, streamed payment removes the entire category of billing disputes: the payment *is* the meter.
- **Settlement risk / counterparty risk**: with batched billing, the station operator extends implicit credit to every driver, and the driver has to trust the operator's meter and billing accuracy after the fact. Streaming payment tied 1:1 to live physical metering removes this — you can't be billed for power you didn't receive because payment obligation only exists while power is flowing.

Fundamentally, the physical reality of charging (current flows continuously, second by second, until it doesn't) has never been able to have a matching *financial* reality (payment flows continuously, second by second, until it doesn't) — because no ledger has been fast/cheap enough to settle at that granularity. High gas costs and multi-second block times on most chains mean "one on-chain transaction per second, forever, for every charging session in a network" is a non-starter financially. This is the gap the idea fills.

## 3. The core idea

When a car and a charging station physically connect:

1. **Automatic mutual identification** happens using the same mechanism real EVs already use for "Plug & Charge": **ISO 15118**, specifically its TLS-based mutual authentication and contract-certificate exchange (originally designed for roaming/billing identification between EV, EVSE, and backend). We repurpose/extend this handshake so that, instead of (or alongside) identifying a billing account with a utility, it exchanges **on-chain wallet identities / session keys** for the car and the station.
2. This handshake **opens a payment channel / stream** between the car's wallet and the station's wallet — a smart-contract-mediated relationship that says "as long as verified metering events keep arriving showing energy flow at rate R, keep moving value at a rate derived from R × price-per-kWh."
3. **A physical meter (real or, for hackathon purposes, simulated/emulated) reports instantaneous power draw.** Every second (or every N seconds, tunable), a signed metering reading is produced — ideally from the charger's own metrology hardware (many EVSEs already have OCMF/German-calibration-law-style signed meter data for exactly this reason — legal-for-trade signed meter values are an existing standard, e.g. "OCMF" used in Germany for e-mobility billing disputes).
4. That signed reading feeds a small on-chain (or on-chain-anchored) computation: `payment_delta = kWh_delta × price_per_kWh`, and the value moves — car→station wallet during charging, or station/grid→car wallet during V2G discharge.
5. **The moment metering readings stop arriving** (car unplugged, charging session ends, current stops flowing), the stream simply stops. No final invoice step, no reconciliation — the last confirmed on-chain state *is* the final bill, already settled.
6. **Reversal for V2G** is the same primitive run backwards: when the car is discharging into the grid (aggregator/utility contract signals "V2G session, buy-back rate = X"), the metering readings still flow every second, but the value now moves from the counterparty's wallet into the car's wallet. From the protocol's point of view it is the *identical* stream mechanism with a sign flip and a different price feed — this symmetry is a key design point, not an afterthought.

Why Monad specifically: the entire premise depends on **per-second (or sub-second) on-chain settlement being economically viable at scale** — potentially millions of concurrent charging sessions each producing a state update roughly once per second. On slow/expensive chains this is impossible (gas cost per update would dwarf the value being transferred, e.g. paying $0.50 in gas to move $0.001 of energy value). Monad's high throughput and low, predictable fees are what make "a real on-chain transaction every second, per session, for the duration of charging" a viable design rather than a thought experiment — this is explicitly *only* possible at Monad's speed/cost profile, not a chain-agnostic idea with Monad bolted on.

## 4. What "streaming payment" actually means here (technical shape)

There are two reasonable implementation strategies to prototype at a hackathon; the idea should stay agnostic between them and the spec docs can pick one:

**A. On-chain streaming via superfluid-style constant-flow-rate contracts**
- Model borrowed from token-streaming protocols (e.g., Sablier/Superfluid-style flow-rate streams): instead of transferring value every second, the sender opens a stream with a *rate* (MON per second), and the recipient's withdrawable balance is a pure function of elapsed time × rate — computed lazily, no per-second transaction needed at all for the *value transfer* itself.
- The metering layer's job becomes: **adjust the flow rate** in near-real-time as actual power draw changes (a session isn't constant-rate — power draw ramps, tapers near full charge, etc.), and **terminate the stream** the instant metering stops.
- This is attractive because it minimizes the number of on-chain writes (only rate-change events, not every single second), while still giving the *recipient* a live, second-by-second-accruing balance — visually and economically it's identical to "money moves every second," but implemented efficiently.
- Monad's speed still matters here because rate *changes* still need to be frequent (charging current is not perfectly flat) and because reconciling against the physical meter (closing out the stream to match actual metered kWh, not just elapsed time × last rate) benefits from cheap, fast settlement.

**B. Literal per-second/per-tick on-chain micro-settlement**
- Every metering tick (1 Hz or configurable) produces a small on-chain transaction/state update that actually moves value.
- Simpler mental model, maximally literal to "payment matches physical reality," and a stronger demo of Monad's raw throughput/cost advantage — but only viable because Monad can absorb that transaction volume/cost profile; this is the version that most directly proves the "only possible at Monad speed" claim.
- Could be simplified further with a rollup/state-channel-like batching-with-instant-finality pattern if needed for hackathon scope, while still framing it as "on-chain settlement, per tick."

The idea document intentionally leaves both open; a later spec should choose (or hybridize: rate-based streaming for the steady state, discrete settlement transactions at session start/stop/rate-change/dispute-checkpoints).

## 5. System components

1. **EV-side wallet / onboard unit**: holds MON, holds (or derives) the ISO 15118 contract certificate / identity used in the Plug & Charge handshake, signs session-open/session-continue authorizations. In the real world this is embedded in the vehicle; for a hackathon this is simulated as a software wallet + a small client that speaks the relevant parts of ISO 15118 (or a simplified stand-in protocol inspired by it, if full ISO 15118 stack integration is out of scope for the hackathon timeframe).
2. **EVSE-side (charging station) wallet / controller**: mirrors the above — holds a station identity/wallet, participates in the mutual handshake, and is the entity metering + reporting actual power delivered (or received, for V2G).
3. **Metering source**: the ground truth for "how much energy actually moved." For a hackathon, this can be:
   - A simulated meter (software emitting signed synthetic power-draw readings on a timer, optionally with realistic charge-curve shaping — fast ramp, taper near 100%), or
   - A real cheap smart-plug/current-sensor (e.g., a CT clamp + microcontroller) if hardware is available, generating genuine live readings.
   - Readings should be **signed** by the metering device's key so the on-chain contract (or an oracle layer) can trust "this much energy moved" without trusting the station operator's say-so alone — this is what makes the payment trust-minimized rather than just "the station's app tells the chain how much to charge you."
4. **Price oracle / rate source**: price-per-kWh for charging, and a (likely different, possibly dynamic/peak-based) buy-back rate for V2G. Could be a static demo value, a simple on-chain oracle contract, or pull from a mock "utility peak-demand" feed to make the V2G "premium rate during peak demand" story concrete.
5. **Smart contract(s) on Monad**:
   - Session/stream contract: opens on handshake, tracks flow rate and/or per-tick settlements, enforces "no payment obligation without a corresponding signed metering event," closes on session end.
   - Wallet/balance contract or direct native-MON handling for both parties.
   - Optional: a registry contract mapping station/vehicle identities (from the ISO 15118-derived certs) to on-chain wallet addresses, so the handshake step and the payment step are cryptographically linked (you can't spoof "I am this station" to redirect payment).
6. **Live settlement dashboard** (this is the demo's emotional core, matching the story — see Section 11 for full detail): not a consumer app, but an observability surface onto the settlement layer, showing live transactions, running totals, and a map of concurrent sessions across many simulated cars and stations at once.

## 11. Product framing: infrastructure, not a consumer app

This is a **settlement/payment rail**, not a product a driver opens and interacts with directly — closer to a protocol running underneath an app (a charging network's own app, a car manufacturer's dashboard, a utility's V2G program) than an app in its own right. The car and station talk to each other and to the chain machine-to-machine; a human driver's only touchpoint is whatever their EV's dashboard or charging network's existing app chooses to surface (e.g. the live-ticking-number moment in the story is what a *downstream* app would build on top of this rail, not something this project ships itself).

This matters for scoping: there is no login flow, no driver-facing app screen, no onboarding UX to design or build. What this project *does* ship is the settlement layer itself (contracts + simulated M2M clients) plus one purpose-built **observability dashboard** (Section 11a below) whose job is to make an inherently invisible, machine-to-machine process visible for a demo audience — it is explicitly an operator/demo view, not the end-user product surface.

## 11a. Live settlement dashboard (the demo surface)

Since there's no consumer app to demo, the dashboard *is* the demo. It should read like a live ops/monitoring console for the settlement network — "watching value move like electricity" — not like a wallet or billing app. Concretely:

- **Live scrolling settlement feed**: a real-time log of individual settlement events as they land on-chain, e.g.:
  - `Car 0x8a2… → Station #4 · 0.0021 MON · charging`
  - `Station #7 → Car 0xC91… · 0.0089 MON · V2G sell`
  New entries append/scroll continuously as ticks settle across *all* concurrent sessions, not just one.
- **Running counters** (top of dashboard, updating live since demo/session start): total transactions settled, total MON moved (gross, and/or split by direction).
- **Visual grid/map of simulated stations and cars**: each node pulses or flashes the instant it participates in a settlement, so the audience can *see* activity distributed across the network, not just read numbers.
- **Live charge-vs-V2G split**: a running ratio/bar showing buy-side (charging) volume vs. sell-side (V2G) volume happening concurrently, reinforcing the bidirectional/symmetric story visually.

## 11b. Demo at concurrent scale, not a single session

The demo should not be "one car, one station, watch a number move" — it should spin up **many simulated sessions concurrently** (e.g. 10–50 car↔station sessions running at once, a mix of charging and V2G-discharging) so the dashboard shows real throughput: a busy, continuously-updating feed and map, not an isolated transaction. This is also the strongest, most direct visual proof of the "only possible at Monad's speed/cost" claim — a slower or more expensive chain couldn't sustain this many concurrent per-second settlements live on stage. This point should directly inform Section 9's hackathon scope decisions (the simulator layer needs to support spinning up N concurrent simulated car/station pairs, not just one hardcoded pair).

## 11c. Naming: Amber Current

**Decision: Amber Current.** Chosen over Voltstream (existing unrelated companies already use the name — real collision risk) and Open Circuit (more evocative, but a generic electrical-engineering term, weaker trademark defensibility) — Amber Current had no meaningful collisions found and keeps the option open to carry the name past the hackathon if this becomes a real project.

## 11d. Demo opening: dashboard-led, no physical prop

The demo opens on the dashboard itself, not a physical charging-cable prop — consistent with the infrastructure/no-consumer-app framing in Section 11: a plug-in moment would re-center the pitch on a single session right before pivoting to concurrent scale, which undercuts the "this is a settlement rail, not a product" positioning. The opening beat is hitting "Spin Up Network" and watching the dashboard go from idle to live across many concurrent sessions at once.

## 6. End-to-end flow (charging / forward direction)

1. Car connects to station (physically or simulated connect event).
2. ISO 15118-style handshake: mutual TLS/cert exchange → both sides authenticate identity → contract certificate maps to (or unlocks) each party's on-chain wallet/session key.
3. Session-open transaction (or off-chain-signed session-open message anchored on first tick) establishes: payer = car wallet, payee = station wallet, price-per-kWh, direction = charge.
4. Metering device begins emitting signed readings (e.g., every 1s: timestamp, instantaneous power in kW, cumulative kWh delta since last tick).
5. Each reading is translated into a value movement: `Δvalue = Δ kWh × price_per_kWh`, applied either as a stream-rate update (approach A) or a discrete on-chain settlement (approach B).
6. Dashboard reflects the live balance change in near-real-time.
7. Car unplugged / charging stops (current drops to ~0 and stays there, or explicit disconnect event) → metering stream ends → session-close finalizes total, no further value moves. Total on-chain movement should reconcile exactly to metered kWh × price, with no separate invoice step.

## 7. End-to-end flow (V2G / reverse direction)

1. Same physical connection, but a session-type flag (from a utility/aggregator signal, or user opt-in via an app/dashboard toggle) marks this as a **discharge** session, with a buy-back price-per-kWh (potentially time-of-day/demand-based, e.g. "peak premium rate 6–8pm").
2. Same handshake and identity-linking as forward direction.
3. Metering now reports power flowing *out* of the vehicle into the station/grid.
4. Value movement direction flips: payer = station/grid-side wallet (ultimately funded by the utility/aggregator), payee = car wallet.
5. Same live dashboard, same per-second granularity, just counting up instead of down.
6. Session ends the same way — stops the instant discharge stops, final settled amount = metered kWh discharged × buy-back rate.

## 8. Why this is a strong hackathon idea

- **Concrete, demoable, visual**: a live ticking number that visibly reverses direction is a great 60–90 second demo — the audience doesn't need to understand streaming payment theory to feel it.
- **Genuinely chain-differentiated**: this isn't "put an existing payment idea on a blockchain for buzzword reasons" — the core claim (per-second real settlement, uneconomical elsewhere) is a real, defensible reason the idea needs Monad's throughput/cost profile specifically. That's a strong hackathon narrative for a Monad-sponsored/aligned event.
- **Grounded in real-world standards, not hand-waved**: ISO 15118 Plug & Charge is real and already deployed by major automakers/charging networks; signed legal-for-trade meter data (OCMF-style) is real and already used for e-mobility billing disputes in some jurisdictions. The idea is "take two things that already exist and already solve *authentication* and *trusted metering*, and wire their output directly into a payment rail fast enough to keep up with them," not "invent physics."
- **Symmetric elegance**: charge vs. discharge (V2G) being the *same* mechanism with a sign flip is a clean technical/product story that's easy to explain and easy to build (build the primitive once, flip a sign for the demo's second act).
- **Removes a real, relatable pain point**: estimated bills, monthly subscriptions to charging networks, and billing disputes are things people actually complain about with EV charging today.

## 9. Hackathon scope suggestions (things to decide in the spec docs, flagged here as open questions)

- Full ISO 15118 protocol implementation is heavy (TLS mutual auth, XML/EXI message stack, contract certificate provisioning chains). For a hackathon, likely scope: **implement a simplified stand-in handshake that captures the essential property** (automatic mutual authentication on physical connect, no manual entry of payment details) and clearly document it as "modeled on ISO 15118 Plug & Charge" rather than a full conformant implementation — unless a team member has an existing ISO 15118 stack to integrate.
- Real metering hardware vs. simulated: recommend simulated-but-realistic (a script that emits a plausible charge curve: ramp up, steady fast-charge plateau, taper near full) as the baseline, with real CT-clamp hardware as a stretch goal if time/parts allow.
- Streaming approach A vs. B (see Section 4): recommend prototyping **B (literal discrete per-tick on-chain settlement)** first for hackathon purposes because it most directly and legibly proves the "only possible at Monad's speed" claim to judges, with A (rate-based streaming) mentioned as the production-grade optimization path in the spec/writeup.
- Price oracle: a static or manually-toggleable rate (with a distinct "peak V2G buy-back rate" value) is sufficient; a real dynamic oracle is a stretch goal.
- Identity/wallet binding: decide whether car and station wallets are pre-provisioned test wallets (simpler) or derived live from the handshake's certificate exchange (more faithful to the "no separate step" story, more complex).

## 10. Naming note

Throughout, "MON" refers to Monad's native token, used as the unit that streams between car and station wallets in both directions.
