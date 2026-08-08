# Plug-N-Pay — Coverage Ledger

Machine-checkable index of every identified requirement, constraint, assumption, use case, interface, data
rule, risk, and open decision in the two baseline spec documents. One row per identifier. Built by indexing
only — no design work, no critique, no code touched.

**Sources indexed (completely):**
- `docs/specs/REQUIREMENTS.md` (717 lines) — the baseline
- `docs/specs/2026-08-08-booth-frontend-design.md` (620 lines) — module M8 detailed design

**Total identifiers: 183.** Evidence and per-prefix counts in [Counts](#counts) below.

Column key: **Design/Arch/API/Test doc** = does this ID's obligation have to land in that downstream document —
`MUST` / `should` / `—`. **Pri** = MoSCoW letter as written in the source, `—` if the item carries none.
**Ver** = verification method as written (`D` demonstration / `T` test / `I` inspection / `A` analysis), `—` if none.

## Ledger

| ID | Pri | Ver | Source | One-line obligation | Design doc | Arch doc | API doc | Test doc | Notes |
|---|---|---|---|---|---|---|---|---|---|
| A1 | — | — | REQUIREMENTS.md:110 | Vehicle Agent: holds MON + contract cert, signs session authorisations; simulated for this build. | MUST | should | should | — | Machine actor. |
| A2 | — | — | REQUIREMENTS.md:111 | Station Agent: holds identity+wallet, reports delivered energy, gets paid without extending credit. | MUST | should | should | — | Adversarial role in UC-7. |
| A3 | — | — | REQUIREMENTS.md:112 | Metering Device: produces signed readings at fixed cadence; signature is the sole payment authoriser. | MUST | should | should | — | Ties to ASM-6 trust boundary. |
| A4 | — | — | REQUIREMENTS.md:113 | Price Oracle: supplies kWh price and V2G buy-back rate, readable at open and on rate change. | MUST | should | should | — | |
| A5 | — | — | REQUIREMENTS.md:114 | Grid Aggregator: V2G counterparty, funds discharge payouts, signals demand events. | MUST | should | should | — | |
| A6 | — | — | REQUIREMENTS.md:115 | Driver: near-zero interaction; sees a live honest number, owes nothing after unplugging. | MUST | — | — | — | Screenless by design; owns no UI requirement (§2.3). |
| A7 | — | — | REQUIREMENTS.md:116 | Demo Operator: needs deterministic controls that work under stage pressure. | MUST | should | — | — | Drives M9. |
| A8 | — | — | REQUIREMENTS.md:117 | Audience Participant: wants instant fun via QR scan, no install, no wallet. | MUST | should | — | — | Drives M8. |
| A9 | — | — | REQUIREMENTS.md:118 | Peer Reviewer/Judge: needs the claim proven on stage, not merely asserted. | MUST | — | — | — | Central to UC-6 and CON-6. |
| CON-1 | — | — | REQUIREMENTS.md:137 | All code MUST be written today; no pre-built projects or forked codebases beyond std libs. | — | MUST | — | — | Source: rules.md. |
| CON-2 | — | — | REQUIREMENTS.md:138 | Repository MUST be public, deployed and operational on Monad testnet. | — | MUST | — | — | Ties NFR-M-3. |
| CON-3 | — | — | REQUIREMENTS.md:139 | Code freeze 18:00, submission 18:30, three-minute pitch — hard delivery deadline. | — | MUST | — | — | Source: about.md, project_demo.md. |
| CON-4 | — | — | REQUIREMENTS.md:140 | Team size MUST NOT exceed four people. | — | — | — | — | Orphan — organisational constraint, no technical doc owns it. |
| CON-5 | — | — | REQUIREMENTS.md:141 | Assume public testnet RPC rate limits exist and are lower than wanted (undocumented). | — | MUST | — | should | Closed by FR-REL-9 measurement, §13.4. |
| CON-6 | — | — | REQUIREMENTS.md:142 | System must survive technical scrutiny from a developer audience, not marketing scrutiny. | MUST | — | — | — | Source: judging_criteria.md. |
| CON-7 | — | — | REQUIREMENTS.md:143 | Full ISO 15118 is out of budget; a documented stand-in is required. | MUST | should | — | — | Drives FR-ID-2/ASM-5. |
| ASM-1 | — | — | REQUIREMENTS.md:149 | Faucet MUST supply enough MON to fund relay wallet pool (FR-REL-8) + identity pool (FR-SIM-6). | should | MUST | — | — | If wrong: fall back to single wallet + batching (FR-REL-2). |
| ASM-2 | — | — | REQUIREMENTS.md:150 | Simulated metering assumed acceptable to reviewers when labelled honestly. | MUST | — | — | — | Enforced by FR-MET-5. |
| ASM-3 | — | — | REQUIREMENTS.md:151 | Venue wifi assumed usable but unreliable. | should | MUST | — | — | Governs §12 fallback ladder. |
| ASM-4 | — | — | REQUIREMENTS.md:152 | Public RPC assumed to sustain ≥10/s rehearsed, ~50/s stretch, until FR-REL-9 measures it. | — | MUST | — | should | If wrong, FR-REL-2 batching becomes mandatory. |
| ASM-5 | — | — | REQUIREMENTS.md:153 | Reviewers assumed to accept a simplified handshake as "modelled on" ISO 15118. | MUST | — | — | — | Weaken pitch claim, not code, if wrong. |
| ASM-6 | — | — | REQUIREMENTS.md:154 | Signature verification happens off-chain in the relay, not per-signature on-chain — a named trust boundary. | MUST | MUST | should | — | Central to FR-SET-2, IF-1, NFR-M-4; tension w/ OD-1 (see Contradictions). |
| M1 | — | — | REQUIREMENTS.md:179 | Mutual authentication on connect; bind certificate identity to wallet address. | MUST | MUST | should | — | Off-chain agents + registry contract. |
| M2 | — | — | REQUIREMENTS.md:180 | Produce signed readings at fixed cadence with a realistic charge curve. | MUST | MUST | should | — | Off-chain, signed with device key. |
| M3 | — | — | REQUIREMENTS.md:181 | Serve price per kWh and the V2G buy-back rate. | MUST | MUST | should | — | Omitted from §11 freeze module list despite M-priority FRs (see Contradictions). |
| M4 | — | — | REQUIREMENTS.md:182 | Sessions, value movement; no payment exists without a signed reading. | MUST | MUST | MUST | — | On-chain, Monad. |
| M5 | — | — | REQUIREMENTS.md:183 | Aggregate ticks across sessions into transactions; manage nonces and the hot wallet. | MUST | MUST | MUST | — | Off-chain service; added to freeze list 2026-08-08. |
| M6 | — | — | REQUIREMENTS.md:184 | Create N concurrent vehicle/station pairs with a mix of directions. | MUST | MUST | — | — | Off-chain. |
| M7 | — | — | REQUIREMENTS.md:185 | Render the network live for a room. | MUST | MUST | should | — | Browser; "the wall" per §1.4. |
| M8 | — | — | REQUIREMENTS.md:186 | Audience-facing toy; generates real concurrent load. | MUST | MUST | MUST | — | Full design in booth-frontend-design.md. |
| M9 | — | — | REQUIREMENTS.md:187 | Start, stop, spin-up, room surge, degradation switches. | MUST | MUST | should | — | Operator surface; omitted from §11 freeze module list despite M-priority FRs (see Contradictions). |
| UC-1 | — | — | REQUIREMENTS.md:195 | Vehicle+station mutually verify, resolve wallets, open an on-chain session at a known price. | MUST | should | should | — | |
| UC-2 | — | — | REQUIREMENTS.md:210 | Each signed reading converts to value movement, visible within 1s of landing. | MUST | should | MUST | should | Core financial-correctness path. |
| UC-3 | — | — | REQUIREMENTS.md:224 | Session closes when readings stop; settled state is final, no reconciliation step. | MUST | — | — | should | "The product," per the doc's own framing. |
| UC-4 | — | — | REQUIREMENTS.md:236 | V2G offer reverses direction and pays the vehicle via the same mechanism, sign-flipped. | MUST | — | should | should | Must not require a second code path (FR-SET-7). |
| UC-5 | — | — | REQUIREMENTS.md:251 | Operator spins up N concurrent charge/discharge pairs, all ticking concurrently. | MUST | MUST | should | — | The throughput claim, demonstrated. |
| UC-6 | — | — | REQUIREMENTS.md:262 | A 10m-away viewer can tell many independent payments are settling, without narration. | MUST | should | should | — | |
| UC-7 | — | — | REQUIREMENTS.md:271 | A settlement without a valid signed reading MUST be rejected; no value moves. | MUST | MUST | — | MUST | "The security core of the system." |
| UC-8 | — | — | REQUIREMENTS.md:278 | On RPC failure the demo degrades and states its mode; never shows a frozen dashboard as live. | MUST | MUST | — | should | |
| UC-9 | — | — | REQUIREMENTS.md:286 | Audience QR-scan session appears on the wall, indistinguishable from simulated activity. | MUST | should | MUST | — | |
| UC-10 | — | — | REQUIREMENTS.md:296 | Room surge substitutes for simulated load (not additive), staying at/below the rehearsed RPC ceiling. | MUST | MUST | should | — | Architectural gap closed 2026-08-08 (was additive, ~110 peak). |
| UC-11 | — | — | REQUIREMENTS.md:310 | Identity bound to wallet in registry so a later handshake resolves to a payable address. | MUST | MUST | should | should | Pre-registration bootstrapping note added 2026-08-08. |
| UC-12 | — | — | REQUIREMENTS.md:317 | Rate change mid-session: ticks before settle at old rate, after at new — no retroactive repricing. | MUST | — | — | should | |
| FR-ID-1 | M | D | REQUIREMENTS.md:329 | Vehicle and station MUST mutually authenticate with no human action or manual payment entry. | MUST | — | should | — | |
| FR-ID-2 | M | I | REQUIREMENTS.md:330 | Handshake MUST be documented as "modelled on" ISO 15118, never as conformant. | MUST | should | — | — | Ties CON-7/ASM-5. |
| FR-ID-3 | M | T | REQUIREMENTS.md:331 | A verified identity MUST resolve to exactly one on-chain wallet address. | MUST | — | MUST | MUST | |
| FR-ID-4 | M | T | REQUIREMENTS.md:332 | An unverified or unregistered party MUST NOT be able to open a session. | MUST | MUST | should | MUST | |
| FR-ID-5 | M | T | REQUIREMENTS.md:333 | A party MUST NOT present another's identity to redirect payment. | MUST | MUST | should | MUST | |
| FR-ID-6 | S | D | REQUIREMENTS.md:334 | Registry SHOULD support registering identities at runtime, not only at deploy. | MUST | — | should | — | |
| FR-ID-7 | C | I | REQUIREMENTS.md:335 | Handshake MAY derive session keys from certificate exchange instead of pre-provisioned wallets. | MUST | — | — | — | Explicitly not today (§11); blocked by OD-2. |
| FR-MET-1 | M | D | REQUIREMENTS.md:341 | Metering source MUST emit readings at a configurable cadence, default 1Hz. | MUST | should | — | — | |
| FR-MET-2 | M | I | REQUIREMENTS.md:342 | Each reading MUST carry timestamp, instantaneous kW, and cumulative energy delta. | MUST | — | MUST | — | Wire format, §7.1. |
| FR-MET-3 | M | T | REQUIREMENTS.md:343 | Each reading MUST be signed by the metering device's key. | MUST | MUST | MUST | MUST | Security core; ties ASM-6/IF-1. |
| FR-MET-4 | M | D | REQUIREMENTS.md:344 | Simulator MUST produce a realistic charge curve: ramp, plateau, taper near full. | MUST | — | — | — | |
| FR-MET-5 | M | I | REQUIREMENTS.md:345 | Simulated metering MUST be labelled wherever it could be mistaken for hardware. | MUST | — | — | — | Mitigates RSK-6. |
| FR-MET-6 | M | T | REQUIREMENTS.md:346 | Readings MUST support negative/reversed flow to represent discharge. | MUST | — | MUST | MUST | |
| FR-MET-7 | M | T | REQUIREMENTS.md:347 | A replayed reading MUST be rejected. | MUST | should | MUST | MUST | Ties DR-2/FR-SET-9. |
| FR-MET-8 | C | A | REQUIREMENTS.md:348 | System SHOULD accept real current-sensing hardware without changes above the metering interface. | — | MUST | should | — | Explicitly not today (§11). |
| FR-PR-1 | M | T | REQUIREMENTS.md:354 | A price per kWh MUST be readable at session open. | MUST | — | MUST | MUST | |
| FR-PR-2 | M | T | REQUIREMENTS.md:355 | A separate, distinguishable V2G buy-back rate MUST exist. | MUST | — | MUST | MUST | |
| FR-PR-3 | S | D | REQUIREMENTS.md:356 | V2G rate SHOULD be expressible as a peak premium tied to a demand window. | MUST | — | should | — | |
| FR-PR-4 | M | T | REQUIREMENTS.md:357 | A rate change mid-session MUST apply only to subsequent ticks. | MUST | — | should | MUST | Needs Rate.effectiveFrom (§6). |
| FR-PR-5 | C | I | REQUIREMENTS.md:358 | Pricing MAY be served by a live oracle instead of configuration. | should | MUST | should | — | Explicitly not today (§11). |
| FR-SET-1 | M | I | REQUIREMENTS.md:364 | A session MUST record payer, payee, price, direction, and start time. | MUST | — | MUST | — | |
| FR-SET-2 | M | T | REQUIREMENTS.md:365 | Value MUST move only in response to a validated signed metering event — the security core. | MUST | MUST | MUST | MUST | Verification is off-chain in relay (ASM-6); pitch must say "verifies," not "trustlessly verifies on-chain." |
| FR-SET-3 | M | T | REQUIREMENTS.md:366 | Settled value MUST equal metered energy × applicable price, to the tick. | MUST | should | MUST | MUST | Enforced on-chain per IF-4. |
| FR-SET-4 | M | D | REQUIREMENTS.md:367 | A session MUST close when readings stop, within a configurable threshold. | MUST | — | should | — | |
| FR-SET-5 | M | I | REQUIREMENTS.md:368 | Closing MUST NOT require a separate reconciliation or invoice transaction. | MUST | — | should | — | |
| FR-SET-6 | M | I | REQUIREMENTS.md:369 | Every settlement MUST emit an event carrying session, direction, amount, cumulative energy. | MUST | — | MUST | — | |
| FR-SET-7 | M | I | REQUIREMENTS.md:370 | Charge and discharge MUST use the same settlement path, differing only by sign/rate. | MUST | should | — | — | A second code path fails this requirement. |
| FR-SET-8 | M | T | REQUIREMENTS.md:371 | A session MUST NOT settle beyond the payer's funded balance. | MUST | should | should | MUST | §9: serves no use case, failure-mode only. |
| FR-SET-9 | M | T | REQUIREMENTS.md:372 | Settlement MUST be idempotent per (session, sequence). | MUST | — | MUST | MUST | Ties DR-2. |
| FR-SET-10 | S | I | REQUIREMENTS.md:373 | Contract SHOULD expose live per-session cumulative totals for the dashboard to read. | should | — | MUST | — | Feeds FR-DASH-*. |
| FR-SET-11 | W | — | REQUIREMENTS.md:374 | Contract MAY implement rate-based streaming (balance = elapsed time × rate) as production optimisation. | should | MUST | — | — | Explicitly not today (§11); documents the deferred production path. |
| FR-REL-1 | M | D | REQUIREMENTS.md:380 | Relay MUST submit one transaction per session per tick — the primary architecture. | MUST | MUST | should | — | Resolves Q2, 2026-08-08. |
| FR-REL-2 | S | D | REQUIREMENTS.md:381 | Relay SHOULD support aggregating many sessions' ticks into one transaction, as fallback if RPC capacity is insufficient. | MUST | MUST | should | — | Fallback mode; reversal trigger in §13.3. |
| FR-REL-3 | M | T | REQUIREMENTS.md:382 | Relay MUST manage nonces without collision/stall; shape depends on per-tick vs batched mode. | MUST | MUST | — | MUST | §9: serves no use case, failure-mode only; open tension w/ §13.2 scoping (§13.3). |
| FR-REL-4 | M | D | REQUIREMENTS.md:383 | On RPC failure/rate-limit, relay MUST degrade rather than silently drop sessions. | MUST | MUST | — | — | |
| FR-REL-5 | M | I | REQUIREMENTS.md:384 | Relay MUST expose its current mode so the dashboard can state it. | should | — | MUST | — | Feeds FR-DASH-6/NetworkSnapshot.mode. |
| FR-REL-6 | S | T | REQUIREMENTS.md:385 | Relay MUST accept energy deltas from booth-app sessions through the same interface as simulated ones. | should | should | MUST | MUST | Tension w/ OD-1 (see Contradictions). |
| FR-REL-7 | M | I | REQUIREMENTS.md:386 | Relay MUST NOT hold or require any participant's private key beyond its own hot wallet. | should | MUST | — | — | |
| FR-REL-8 | M | T | REQUIREMENTS.md:387 | Relay MUST submit from a pool of funded wallets, sized for parallel target tps. | MUST | MUST | — | MUST | Makes ASM-1/faucet a harder dependency; drives RSK-4. |
| FR-REL-9 | M | T | REQUIREMENTS.md:388 | DONE: measured RPC ceiling — knee at 40-45 req/s; reproducible via tools/measure-rpc.mjs. | — | MUST | — | MUST | Closes CON-5; first task of the build (§11). |
| FR-SIM-1 | M | D | REQUIREMENTS.md:394 | Spawner MUST create N concurrent vehicle/station pairs, N a runtime parameter. | MUST | — | should | — | IF-11. |
| FR-SIM-2 | M | D | REQUIREMENTS.md:395 | Spawned sessions MUST include both charging and discharging concurrently. | MUST | — | — | — | |
| FR-SIM-3 | M | D | REQUIREMENTS.md:396 | Each simulated session MUST have an independent charge curve (no synchronised clones). | MUST | — | — | — | |
| FR-SIM-4 | S | D | REQUIREMENTS.md:397 | Spawner MUST be able to run at a rehearsed conservative N and a higher stress N. | MUST | should | — | — | |
| FR-SIM-5 | S | I | REQUIREMENTS.md:398 | Sessions SHOULD start staggered, not simultaneously, to avoid a self-inflicted RPC spike. | MUST | should | — | — | |
| FR-SIM-6 | M | I | REQUIREMENTS.md:399 | Simulated identities MUST be drawn from a pool registered before code freeze, not live during spin-up. | MUST | MUST | — | — | UC-11 bootstrapping gap, closed 2026-08-08. |
| FR-DASH-1 | M | D | REQUIREMENTS.md:405 | Scrolling feed MUST show individual settlements as they land, across all sessions. | MUST | — | should | — | |
| FR-DASH-2 | M | D | REQUIREMENTS.md:406 | Running counters MUST show total settlements and total MON moved since start. | MUST | — | should | — | |
| FR-DASH-3 | M | D | REQUIREMENTS.md:407 | A node view MUST pulse each participant at the moment it settles. | MUST | — | should | — | |
| FR-DASH-4 | M | D | REQUIREMENTS.md:408 | A split indicator MUST show charge volume against V2G volume. | MUST | — | should | — | |
| FR-DASH-5 | M | D | REQUIREMENTS.md:409 | Dashboard MUST be legible from ten metres on a projector. | MUST | — | — | — | |
| FR-DASH-6 | M | I | REQUIREMENTS.md:410 | Dashboard MUST show on-chain vs simulated and never present one as the other. | MUST | MUST | should | — | Ties NFR-R-3/IF-7. |
| FR-DASH-7 | S | T | REQUIREMENTS.md:411 | Dashboard MUST render ≥60 concurrent nodes without dropping below a readable frame rate. | MUST | should | — | MUST | |
| FR-DASH-8 | M | A | REQUIREMENTS.md:412 | Dashboard MUST use a reconnect-safe streaming transport and MUST NOT show a frozen-but-live state on drop. | MUST | MUST | MUST | — | Corrected wording, §13.2; possible transport conflict w/ booth doc (see Contradictions). |
| FR-DASH-9 | S | D | REQUIREMENTS.md:413 | Dashboard SHOULD link a settlement to its transaction on a block explorer. | MUST | — | should | — | |
| FR-DASH-10 | M | D | REQUIREMENTS.md:414 | Dashboard MUST open idle and become live on operator action, transition visible. | MUST | — | — | — | |
| FR-BOOTH-1 | S | D | REQUIREMENTS.md:424 | Participant MUST reach a playable state from QR scan: no install, no login, no wallet. | MUST | — | — | — | Existence req on a module built last (§11). |
| FR-BOOTH-2 | S | D | REQUIREMENTS.md:425 | App MUST NOT block on the network and MUST NOT show a participant a network error. | MUST | MUST | — | — | Degradation ladder L0-L3, booth doc §9. |
| FR-BOOTH-3 | S | T | REQUIREMENTS.md:426 | App MUST report energy deltas to the relay through the M5 interface. | MUST | — | MUST | MUST | POST /api/tick, booth doc §8. |
| FR-BOOTH-4 | S | D | REQUIREMENTS.md:427 | App MUST remain fully playable with the relay unreachable. | MUST | MUST | — | — | Degradation level L2. |
| FR-BOOTH-5 | M | I | REQUIREMENTS.md:428 | App MUST NOT collect credentials, private keys, or payment details. | MUST | should | should | — | Conditional constraint (stays M even though M8 is low-priority). |
| FR-BOOTH-6 | M | I | REQUIREMENTS.md:429 | Any participant reward MUST be decided by skill, never a random attribute. | MUST | — | — | — | Fairness invariant, booth doc §6. |
| FR-BOOTH-7 | M | I | REQUIREMENTS.md:430 | Reward terms MUST be stated in the app before a participant plays. | MUST | — | — | — | Booth doc §7 terms panel. |
| FR-BOOTH-8 | M | I | REQUIREMENTS.md:431 | App MUST NOT solicit votes; MUST state the reward's placement-dependency as fact. | MUST | — | — | — | Amended 2026-08-08 when conditional reward chosen (§13.1); cited booth-frontend-design.md:349. |
| FR-BOOTH-9 | S | D | REQUIREMENTS.md:432 | App MUST generate + silently register an ephemeral session key client-side before first delta; participant never handles a key. | MUST | should | MUST | — | Resolves FR-MET-3 vs FR-BOOTH-5 gap. |
| FR-BOOTH-10 | S | D | REQUIREMENTS.md:433 | Public leaderboard MUST show live standings, legible in a busy room, updating ≥ every 5s. | MUST | — | MUST | — | GET /api/leaderboard. |
| FR-BOOTH-11 | S | D | REQUIREMENTS.md:434 | Public screen MUST seal 10s before contest close with an unambiguous sealed state. | MUST | — | should | — | |
| FR-BOOTH-12 | M | I | REQUIREMENTS.md:435 | Final standings MUST be reviewed before publication, revealed after the event, not at venue. | MUST | — | — | — | Booth doc §3.8. |
| FR-BOOTH-13 | M | T | REQUIREMENTS.md:436 | Scores above the simulated physical maximum (4,200) MUST be rejected or flagged. | MUST | — | MUST | MUST | Anti-cheat plausibility ceiling, booth doc §6. |
| FR-OPS-1 | M | D | REQUIREMENTS.md:442 | Operator MUST be able to start the network with one deterministic action. | MUST | — | — | — | |
| FR-OPS-2 | S | D | REQUIREMENTS.md:443 | Operator MUST trigger a room surge that ramps down simulated sessions proportionally, so peak concurrency never exceeds the rehearsed limit. | MUST | MUST | should | — | UC-10 substitution-not-addition fix. |
| FR-OPS-3 | S | D | REQUIREMENTS.md:444 | Operator MUST be able to force degraded mode, to rehearse it. | MUST | should | — | — | |
| FR-OPS-4 | M | D | REQUIREMENTS.md:445 | System MUST run the full demo beat with zero phones connected. | MUST | MUST | — | — | Mitigates RSK-3. |
| FR-OPS-5 | M | I | REQUIREMENTS.md:446 | A recorded fallback of the working system MUST exist before code freeze. | should | MUST | — | — | Ties AC-10/NFR-R-4. |
| FR-OPS-6 | S | I | REQUIREMENTS.md:447 | Logs MUST retain enough detail to confirm a settlement really landed on-chain. | should | MUST | — | — | |
| FR-OPS-7 | S | D | REQUIREMENTS.md:448 | Operator surface MUST include a control to submit one deliberately malformed/unsigned settlement on demand. | MUST | should | should | MUST | Makes UC-7/AC-7 provable live without an adversarial test harness. |
| DR-1 | — | — | REQUIREMENTS.md:465 | A Settlement MUST reference exactly one validated Reading, or one batch of them. | should | — | MUST | should | |
| DR-2 | — | — | REQUIREMENTS.md:466 | (sessionId, seq) is unique; replays are rejected. | should | — | MUST | MUST | Ties FR-MET-7/FR-SET-9. |
| DR-3 | — | — | REQUIREMENTS.md:467 | Sum of a session's monDelta MUST equal sum of whDelta × applicable rate. | should | — | MUST | MUST | Ties FR-SET-3. |
| DR-4 | — | — | REQUIREMENTS.md:468 | Timestamps in UTC ms; client-supplied times advisory, server/chain time authoritative. | should | should | MUST | — | Trust-boundary note (client vs server time). |
| DR-5 | — | — | REQUIREMENTS.md:469 | No entity stores a private key belonging to another party. | should | MUST | should | — | |
| IF-1 | — | — | REQUIREMENTS.md:483 | Consumer (the relay, off-chain) MUST verify signature against registered meterId key before any value moves. | should | MUST | MUST | — | Ties ASM-6; contract trusts relay's attestation, doesn't recheck. |
| IF-2 | — | — | REQUIREMENTS.md:484 | seq MUST increase monotonically per session. | should | — | MUST | should | |
| IF-3 | — | — | REQUIREMENTS.md:485 | whDelta MAY be negative, denoting discharge. | should | — | MUST | — | |
| IF-4 | — | — | REQUIREMENTS.md:489 | Batch submission carries per-session energy deltas (whDelta), not pre-computed MON; contract computes whDelta × price on-chain. | should | MUST | MUST | should | Keeps FR-SET-3 enforced, not merely asserted off-chain. |
| IF-5 | — | — | REQUIREMENTS.md:490 | A partial batch failure MUST NOT settle any entry in that batch. | should | should | MUST | MUST | Atomicity. |
| IF-6 | — | — | REQUIREMENTS.md:494 | Settlement events MUST be consumable via reconnect-safe streaming (SSE recommended); dashboard recovers without reload. | MUST | MUST | MUST | — | Possible transport conflict w/ booth doc (see Contradictions). |
| IF-7 | — | — | REQUIREMENTS.md:495 | Every rendered figure MUST be traceable to an event or an explicit simulation flag. | MUST | — | MUST | — | |
| IF-8 | — | — | REQUIREMENTS.md:501 | All booth-app calls MUST be fire-and-forget from the client's perspective. | MUST | — | MUST | — | Booth doc §8 principle. |
| IF-9 | — | — | REQUIREMENTS.md:502 | All booth-app writes MUST be idempotent on (sessionId, seq). | should | — | MUST | MUST | |
| IF-10 | — | — | REQUIREMENTS.md:503 | Relay MUST tolerate a burst of roughly sixty new sessions within twenty seconds. | should | MUST | should | should | Reconciled with NFR-P-2 via UC-10 substitution. |
| IF-11 | — | — | REQUIREMENTS.md:507 | Spin-up MUST take N as a parameter. | should | — | MUST | — | FR-SIM-1. |
| IF-12 | — | — | REQUIREMENTS.md:508 | Controls MUST be operable without typing during the pitch. | MUST | — | — | — | |
| NFR-P-1 | — | D | REQUIREMENTS.md:518 | Settlement cadence per session: 1Hz, configurable. | MUST | should | — | — | |
| NFR-P-2 | — | D | REQUIREMENTS.md:519 | ≥10 concurrent sessions sustained live/rehearsed; the 50-session stretch is recorded, not live. | MUST | MUST | — | — | "The project's central claim"; tension w/ IF-10 (reconciled via UC-10). |
| NFR-P-3 | — | D | REQUIREMENTS.md:520 | Settlement visible on the wall ≤1s after landing. | MUST | should | should | — | |
| NFR-P-4 | — | D | REQUIREMENTS.md:521 | Dashboard frame rate at target concurrency: readable, no visible stutter. | MUST | — | — | — | |
| NFR-P-5 | — | T | REQUIREMENTS.md:522 | Booth app frame rate on mid-range Android: 60fps. | MUST | should | — | MUST | |
| NFR-P-6 | — | D | REQUIREMENTS.md:523 | Booth app time from QR scan to playable: ≤3s on venue wifi. | MUST | should | — | — | |
| NFR-R-1 | — | D | REQUIREMENTS.md:531 | Demo MUST complete its three minutes without a visible freeze. | should | MUST | — | — | |
| NFR-R-2 | — | D | REQUIREMENTS.md:532 | Any single component failure MUST degrade the demo rather than end it. | should | MUST | — | — | |
| NFR-R-3 | — | I | REQUIREMENTS.md:533 | Degraded operation MUST be labelled, never disguised. | MUST | should | should | — | Ties FR-DASH-6. |
| NFR-R-4 | — | I | REQUIREMENTS.md:534 | A recorded fallback MUST exist before code freeze. | — | MUST | — | — | Duplicate of AC-10/FR-OPS-5. |
| NFR-S-1 | — | T | REQUIREMENTS.md:540 | No value moves without a valid signed metering event. | should | MUST | MUST | MUST | Restates FR-SET-2 as an NFR. |
| NFR-S-2 | — | T | REQUIREMENTS.md:541 | Identity spoofing MUST NOT redirect payment. | should | MUST | should | MUST | Restates FR-ID-5. |
| NFR-S-3 | — | T | REQUIREMENTS.md:542 | Replayed readings MUST be rejected. | should | should | MUST | MUST | Restates FR-MET-7/DR-2. |
| NFR-S-4 | — | I | REQUIREMENTS.md:543 | No private key is committed to the repository. | — | MUST | — | — | |
| NFR-S-5 | — | I | REQUIREMENTS.md:544 | Relay hot wallet holds only demo funds; exposure stated in README. | — | MUST | — | — | |
| NFR-S-6 | — | I | REQUIREMENTS.md:545 | Booth app collects no credential, key, or payment detail. | MUST | should | — | — | Duplicate of FR-BOOTH-5. |
| NFR-U-1 | — | D | REQUIREMENTS.md:551 | Wall MUST be readable from ten metres by a first-time viewer. | MUST | — | — | — | |
| NFR-U-2 | — | D | REQUIREMENTS.md:552 | A viewer MUST be able to tell charge from discharge without reading text. | MUST | — | — | — | |
| NFR-U-3 | — | D | REQUIREMENTS.md:553 | Booth app playable one-handed, portrait, on a scratched screen in a bright room. | MUST | — | — | — | |
| NFR-U-4 | — | I | REQUIREMENTS.md:554 | Booth app MUST respect prefers-reduced-motion. | MUST | — | — | — | |
| NFR-M-1 | — | I | REQUIREMENTS.md:560 | Every simplification against the real standards is documented in the README. | should | MUST | — | — | |
| NFR-M-2 | — | I | REQUIREMENTS.md:561 | Contract source is verifiable against the deployed address. | — | MUST | should | — | |
| NFR-M-3 | — | I | REQUIREMENTS.md:562 | Repository public and deployment operational on Monad testnet. | — | MUST | — | — | Restates CON-2. |
| NFR-M-4 | — | I | REQUIREMENTS.md:563 | Signature-verification trust boundary (ASM-6) stated explicitly in README/pitch, alongside its production-path fix. | should | MUST | — | — | Names ZK-proof-of-batch as the closing path. |
| AC-1 | — | D | REQUIREMENTS.md:594 | A charging session opens with no human entering payment details. | should | — | — | MUST | |
| AC-2 | — | D | REQUIREMENTS.md:595 | Value moves at 1Hz, on-chain, against signed metering. | should | should | — | MUST | |
| AC-3 | — | D | REQUIREMENTS.md:596 | Unplugging stops the payment; no invoice step follows. | should | — | — | MUST | |
| AC-4 | — | D | REQUIREMENTS.md:597 | A V2G session pays the vehicle using the same path, sign flipped. | should | — | — | MUST | |
| AC-5 | — | D | REQUIREMENTS.md:598 | At least ten concurrent sessions settle live, both directions running. | should | MUST | — | MUST | The throughput claim; ties NFR-P-2/FR-REL-9. |
| AC-6 | — | D | REQUIREMENTS.md:599 | Wall shows the feed, the counters, the node view, and the split. | should | — | — | MUST | |
| AC-7 | — | D | REQUIREMENTS.md:600 | A settlement without a signed reading is refused, shown live via FR-OPS-7's operator control. | should | should | — | MUST | Deliberately D not T — no adversarial harness realistically buildable. |
| AC-8 | — | D | REQUIREMENTS.md:601 | Demo survives forced RPC degradation. | should | MUST | — | MUST | |
| AC-9 | — | I | REQUIREMENTS.md:602 | Contracts deployed and verifiable on Monad testnet; repository public. | — | MUST | — | MUST | Restates CON-2/NFR-M-2/3. |
| AC-10 | — | I | REQUIREMENTS.md:603 | A recorded fallback exists. | — | should | — | MUST | Restates NFR-R-4/FR-OPS-5. |
| AC-11 | — | I | REQUIREMENTS.md:604 | Every simplification is documented. | — | should | — | MUST | Restates NFR-M-1. |
| RSK-1 | — | — | REQUIREMENTS.md:630 | Public RPC rate-limits under demo load could freeze the wall mid-pitch — worst identified failure. | should | MUST | — | should | Mitigated by FR-REL-2/FR-REL-4. |
| RSK-2 | — | — | REQUIREMENTS.md:631 | Architecture changing late (Q2 decided under pressure) risks rework at the worst hour. | — | MUST | — | — | Mitigation now moot: Q2 resolved. |
| RSK-3 | — | — | REQUIREMENTS.md:632 | Venue wifi collapse would prevent the audience from joining. | should | MUST | — | — | Mitigated by FR-OPS-4 (zero-phone beat). |
| RSK-4 | — | — | REQUIREMENTS.md:633 | Faucet failing to fund the relay wallet pool + identity pool would drop concurrency or break per-tick mode. | — | MUST | — | should | Mitigation rewritten 2026-08-08 under FR-REL-8. |
| RSK-5 | — | — | REQUIREMENTS.md:634 | Risk: reviewer reads the project as "Superfluid plus an EV skin," hurting novelty score. | — | — | — | — | Orphan — pitch/narrative risk, no technical doc owns it. |
| RSK-6 | — | — | REQUIREMENTS.md:635 | Risk: simulated metering read as overclaiming, hurting credibility with a technical audience. | MUST | — | — | — | Mitigated by FR-MET-5 labelling. |
| RSK-7 | — | — | REQUIREMENTS.md:636 | Risk: time lost to a module with no stage presence leaves the core unfinished. | — | — | — | — | Orphan — mitigated by §11 build order, not a technical doc. |
| Q1 | — | — | REQUIREMENTS.md:646 | Open: should the team use a dedicated RPC endpoint instead of the public one? | — | MUST | — | — | Blocks FR-REL-2, FR-REL-4, NFR-P-2. Unresolved. Also cited booth-frontend-design.md:619. |
| Q2 | — | — | REQUIREMENTS.md:647 | RESOLVED: per-tick calls (one txn/session/tick) chosen as primary; batching demoted to fallback. | — | MUST | should | — | See FR-REL-1/2, §13.3. Also cited booth-frontend-design.md:619. |
| Q3 | — | — | REQUIREMENTS.md:648 | RESOLVED: rehearse concurrency at 10, attempt 50 as stretch. | — | MUST | — | should | Recorded in NFR-P-2/AC-5; open_questions.md still stale on this point. |
| OD-1 | — | — | REQUIREMENTS.md:668 | Open: are booth-app sessions settled on-chain, or only reported to the wall? | should | MUST | should | — | Blocks FR-BOOTH-3/FR-REL-6; tension with their confident wording (see Contradictions). Also booth doc §15 item 5. |
| OD-2 | — | — | REQUIREMENTS.md:669 | Open: pre-provisioned wallets, or identities derived live from the handshake? | should | MUST | — | — | Blocks FR-ID-7. |

## Counts

Acceptance test per the task: grep both source files for every identifier prefix, dedupe, count, and compare
to the row count above. Commands run via a sandboxed shell (`grep (BSD grep, GNU compatible) 2.6.0-FreeBSD`);
word-boundary behaviour verified first (`\bM[1-9]\b` against `M1 M12 AM1 XM1 M9x` correctly returns only `M1`).

```
REQ="docs/specs/REQUIREMENTS.md"
BOOTH="docs/specs/2026-08-08-booth-frontend-design.md"
grep -ohE '<pattern>' "$REQ" "$BOOTH" | sort -u | wc -l    # per prefix
```

| Prefix | Pattern | Command output (IDs) | Count | Ledger rows | PASS/FAIL |
|---|---|---|---|---|---|
| `FR-ID-` | `\bFR-ID-[0-9]+\b` | FR-ID-1..FR-ID-7 | 7 | 7 | PASS |
| `FR-MET-` | `\bFR-MET-[0-9]+\b` | FR-MET-1..FR-MET-8 | 8 | 8 | PASS |
| `FR-PR-` | `\bFR-PR-[0-9]+\b` | FR-PR-1..FR-PR-5 | 5 | 5 | PASS |
| `FR-SET-` | `\bFR-SET-[0-9]+\b` | FR-SET-1..FR-SET-11 | 11 | 11 | PASS |
| `FR-REL-` | `\bFR-REL-[0-9]+\b` | FR-REL-1..FR-REL-9 | 9 | 9 | PASS |
| `FR-SIM-` | `\bFR-SIM-[0-9]+\b` | FR-SIM-1..FR-SIM-6 | 6 | 6 | PASS |
| `FR-DASH-` | `\bFR-DASH-[0-9]+\b` | FR-DASH-1..FR-DASH-10 | 10 | 10 | PASS |
| `FR-BOOTH-` | `\bFR-BOOTH-[0-9]+\b` | FR-BOOTH-1..FR-BOOTH-13 | 13 | 13 | PASS |
| `FR-OPS-` | `\bFR-OPS-[0-9]+\b` | FR-OPS-1..FR-OPS-7 | 7 | 7 | PASS |
| `NFR-P-` | `\bNFR-P-[0-9]+\b` | NFR-P-1..NFR-P-6 | 6 | 6 | PASS |
| `NFR-R-` | `\bNFR-R-[0-9]+\b` | NFR-R-1..NFR-R-4 | 4 | 4 | PASS |
| `NFR-S-` | `\bNFR-S-[0-9]+\b` | NFR-S-1..NFR-S-6 | 6 | 6 | PASS |
| `NFR-U-` | `\bNFR-U-[0-9]+\b` | NFR-U-1..NFR-U-4 | 4 | 4 | PASS |
| `NFR-M-` | `\bNFR-M-[0-9]+\b` | NFR-M-1..NFR-M-4 | 4 | 4 | PASS |
| `IF-` | `\bIF-[0-9]+\b` | IF-1..IF-12 | 12 | 12 | PASS |
| `DR-` | `\bDR-[0-9]+\b` | DR-1..DR-5 | 5 | 5 | PASS |
| `AC-` | `\bAC-[0-9]+\b` | AC-1..AC-11 | 11 | 11 | PASS |
| `UC-` | `\bUC-[0-9]+\b` | UC-1..UC-12 | 12 | 12 | PASS |
| `CON-` | `\bCON-[0-9]+\b` | CON-1..CON-7 | 7 | 7 | PASS |
| `ASM-` | `\bASM-[0-9]+\b` | ASM-1..ASM-6 | 6 | 6 | PASS |
| `RSK-` | `\bRSK-[0-9]+\b` | RSK-1..RSK-7 | 7 | 7 | PASS |
| `OD-` | `\bOD-[0-9]+\b` | OD-1, OD-2 | 2 | 2 | PASS |
| `M1`–`M9` | `\bM[1-9]\b` | M1 M2 M3 M4 M5 M6 M7 M8 M9 | 9 | 9 | PASS |
| `A1`–`A9` | `\bA[1-9]\b` | A1 A2 A3 A4 A5 A6 A7 A8 A9 | 9 | 9 | PASS |
| `Q1`/`Q2`/`Q3` | `\bQ[1-3]\b` | Q1 Q2 Q3 | 3 | 3 | PASS |
| **TOTAL** | (union of all above) | — | **183** | **183** | **PASS** |

The union of all 25 patterns, deduplicated (`grep -ohE "$COMBINED" "$REQ" "$BOOTH" \| sort -u \| wc -l`), independently
returned **183**, matching the sum of the per-prefix counts exactly — the two computed totals agree with each other
as well as with the ledger row count.

**Per-file breakdown (informational, not part of the pass/fail test):** of the 183 identifiers, **183** are matched
in `REQUIREMENTS.md` (it defines all of them — every ID's Source line above points there) and only **3** are also
cited in `2026-08-08-booth-frontend-design.md`: `FR-BOOTH-8` (line 349), `Q1` and `Q2` (both line 619). The booth
doc defines zero new IDs in these prefixes; it is pure prose referencing the baseline, consistent with
REQUIREMENTS.md §1.6 ("Identifiers are stable and must not be renumbered") and its own framing as the baseline
("Everything else in `docs/specs/` is subordinate to this file," line 3).

**Row count = 183. All 25 prefixes PASS. No missing ID.**

## Priority slices

**Every `M`-priority functional requirement (52):**

FR-ID-1, FR-ID-2, FR-ID-3, FR-ID-4, FR-ID-5, FR-MET-1, FR-MET-2, FR-MET-3, FR-MET-4, FR-MET-5, FR-MET-6,
FR-MET-7, FR-PR-1, FR-PR-2, FR-PR-4, FR-SET-1, FR-SET-2, FR-SET-3, FR-SET-4, FR-SET-5, FR-SET-6, FR-SET-7,
FR-SET-8, FR-SET-9, FR-REL-1, FR-REL-3, FR-REL-4, FR-REL-5, FR-REL-7, FR-REL-8, FR-REL-9, FR-SIM-1, FR-SIM-2,
FR-SIM-3, FR-SIM-6, FR-DASH-1, FR-DASH-2, FR-DASH-3, FR-DASH-4, FR-DASH-5, FR-DASH-6, FR-DASH-8, FR-DASH-10,
FR-BOOTH-5, FR-BOOTH-6, FR-BOOTH-7, FR-BOOTH-8, FR-BOOTH-12, FR-BOOTH-13, FR-OPS-1, FR-OPS-4, FR-OPS-5

(Cross-check: 52 M + 20 S + 3 C + 1 W = 76 = the full FR-* universe.)

**Every ID named in REQUIREMENTS.md §11 "must exist by freeze" (48):**

The text names 8 ACs explicitly, plus "every `M` requirement in M1, M2, M5, M4, M6, M7":

AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-9, AC-10,
FR-ID-1, FR-ID-2, FR-ID-3, FR-ID-4, FR-ID-5 (M1),
FR-MET-1, FR-MET-2, FR-MET-3, FR-MET-4, FR-MET-5, FR-MET-6, FR-MET-7 (M2),
FR-SET-1, FR-SET-2, FR-SET-3, FR-SET-4, FR-SET-5, FR-SET-6, FR-SET-7, FR-SET-8, FR-SET-9 (M4),
FR-REL-1, FR-REL-3, FR-REL-4, FR-REL-5, FR-REL-7, FR-REL-8, FR-REL-9 (M5),
FR-SIM-1, FR-SIM-2, FR-SIM-3, FR-SIM-6 (M6),
FR-DASH-1, FR-DASH-2, FR-DASH-3, FR-DASH-4, FR-DASH-5, FR-DASH-6, FR-DASH-8, FR-DASH-10 (M7)

Note: this module list (M1, M2, M4, M5, M6, M7) excludes M3 and M9 even though both carry their own M-priority
FRs (FR-PR-1/2/4 and FR-OPS-1/4/5 respectively) — see [Contradictions](#contradictions-noticed-while-indexing).

**Every ID named §11 "explicitly not today" (4):**

FR-SET-11 (rate-based streaming), FR-ID-7 (live key derivation from certificates), FR-MET-8 (real hardware),
FR-PR-5 (live oracle). All four carry Pri `C` or `W`, consistent with being deprioritized.

## Verification split

Ver applies only to the 111 IDs that carry a Ver column (76 FR + 24 NFR + 11 AC); the other 72 IDs (actors,
constraints, assumptions, modules, use cases, risks, Q1-3, OD-1/2) carry no verification method (`—`) by the
ledger's own convention. Counts computed by parsing the transcribed (ID, Ver) table, cross-checked against a
manual tally — both agree.

| Ver | Meaning | Count |
|---|---|---|
| D | Demonstration | 49 |
| T | Test | 24 |
| I | Inspection | 35 |
| A | Analysis | 2 |
| — | none (FR-SET-11 only) | 1 |
| **Total** | | **111** |

**`T` list (24) — needs automated checks:**

FR-ID-3, FR-ID-4, FR-ID-5, FR-MET-3, FR-MET-6, FR-MET-7, FR-PR-1, FR-PR-2, FR-PR-4, FR-SET-2, FR-SET-3,
FR-SET-8, FR-SET-9, FR-REL-3, FR-REL-6, FR-REL-8, FR-REL-9, FR-DASH-7, FR-BOOTH-3, FR-BOOTH-13, NFR-P-5,
NFR-S-1, NFR-S-2, NFR-S-3

**`D` list (49) — needs an operator script:**

FR-ID-1, FR-ID-6, FR-MET-1, FR-MET-4, FR-PR-3, FR-SET-4, FR-REL-1, FR-REL-2, FR-REL-4, FR-SIM-1, FR-SIM-2,
FR-SIM-3, FR-SIM-4, FR-DASH-1, FR-DASH-2, FR-DASH-3, FR-DASH-4, FR-DASH-5, FR-DASH-9, FR-DASH-10, FR-BOOTH-1,
FR-BOOTH-2, FR-BOOTH-4, FR-BOOTH-9, FR-BOOTH-10, FR-BOOTH-11, FR-OPS-1, FR-OPS-2, FR-OPS-3, FR-OPS-4, FR-OPS-7,
NFR-P-1, NFR-P-2, NFR-P-3, NFR-P-4, NFR-P-6, NFR-R-1, NFR-R-2, NFR-U-1, NFR-U-2, NFR-U-3, AC-1, AC-2, AC-3,
AC-4, AC-5, AC-6, AC-7, AC-8

**`I` list (35):**

FR-ID-2, FR-ID-7, FR-MET-2, FR-MET-5, FR-PR-5, FR-SET-1, FR-SET-5, FR-SET-6, FR-SET-7, FR-SET-10, FR-REL-5,
FR-REL-7, FR-SIM-5, FR-SIM-6, FR-DASH-6, FR-BOOTH-5, FR-BOOTH-6, FR-BOOTH-7, FR-BOOTH-8, FR-BOOTH-12, FR-OPS-5,
FR-OPS-6, NFR-R-3, NFR-R-4, NFR-S-4, NFR-S-5, NFR-S-6, NFR-U-4, NFR-M-1, NFR-M-2, NFR-M-3, NFR-M-4, AC-9,
AC-10, AC-11

**`A` list (2):** FR-MET-8, FR-DASH-8

**`—` list (1):** FR-SET-11 (Pri `W`, explicitly deferred, carries no verification method at all)

## Traceability holes

REQUIREMENTS.md §9's traceability table maps only `FR-*` IDs to use cases (it never claims to cover NFR/AC/IF/DR/
CON/ASM/RSK/OD/Q — those are out of its stated scope, so the diff below is scoped to the FR-* namespace, which
is the namespace §9 actually enumerates). §9's own closing note claims exactly two requirements serve no use
case: "FR-SET-8 (funding limit) and FR-REL-3 (nonces) are failure-mode requirements."

Diffing §9's table (all 12 rows, transcribed and parsed programmatically) against the full FR-* universe (76 IDs)
found **33 uncovered IDs, not 2**. §9 significantly under-reports its own gap — 31 requirements it does not map
to any use case go unmentioned by its own admission note.

**Full uncovered set (33):**

FR-BOOTH-5, FR-BOOTH-6, FR-BOOTH-7, FR-BOOTH-8, FR-BOOTH-9, FR-BOOTH-10, FR-BOOTH-11, FR-BOOTH-12, FR-BOOTH-13,
FR-DASH-7, FR-DASH-8, FR-DASH-9, FR-ID-7, FR-MET-4, FR-MET-5, FR-MET-8, FR-OPS-1, FR-OPS-3, FR-OPS-5, FR-OPS-6,
FR-OPS-7, FR-PR-5, FR-REL-1, FR-REL-3, FR-REL-7, FR-REL-8, FR-REL-9, FR-SET-8, FR-SET-10, FR-SET-11, FR-SIM-4,
FR-SIM-5, FR-SIM-6

**Undisclosed (31) — present above but NOT named in §9's "serves no use case" note:**

FR-BOOTH-5, FR-BOOTH-6, FR-BOOTH-7, FR-BOOTH-8, FR-BOOTH-9, FR-BOOTH-10, FR-BOOTH-11, FR-BOOTH-12, FR-BOOTH-13,
FR-DASH-7, FR-DASH-8, FR-DASH-9, FR-ID-7, FR-MET-4, FR-MET-5, FR-MET-8, FR-OPS-1, FR-OPS-3, FR-OPS-5, FR-OPS-6,
FR-OPS-7, FR-PR-5, FR-REL-1, FR-REL-7, FR-REL-8, FR-REL-9, FR-SET-10, FR-SET-11, FR-SIM-4, FR-SIM-5, FR-SIM-6

A plausible partial explanation (not a resolution — recorded as observation only): most of the undisclosed set
is either M8/M9 operator-and-booth machinery that §9's use-case list under-represents (FR-OPS-1/3/5/6/7,
FR-BOOTH-5..13 — UC-9/UC-10 cite only FR-BOOTH-1..4 and FR-OPS-2/4), or `S`/`C`/`W`-priority items whose
absence from a use-case flow is lower-stakes (FR-MET-4/5/8, FR-PR-5, FR-SIM-4/5/6, FR-SET-10/11, FR-DASH-7/8/9,
FR-REL-1/7/8/9, FR-ID-7). That said, `FR-REL-1` (the primary settlement architecture, Pri `M`) and `FR-DASH-8`
(reconnect-safe transport, Pri `M`) being absent from any UC row is a materially bigger gap than the two the
document owns up to.

## Orphans

Three IDs could not be placed as `MUST` in any of the four downstream docs (Design/Arch/API/Test) under the
task's own placement rules — they are process/narrative concerns, not technical-document content:

- **CON-4** (team size ≤ 4) — an organisational/rules constraint. Doesn't define topology, deployment, payload,
  module behaviour, or a test target; no downstream technical doc owns team composition.
- **RSK-5** (reviewer reads project as "Superfluid plus an EV skin") — a pitch-positioning/novelty risk. Its
  mitigation ("lead with why 1Hz settlement is economic only at this cost profile... in the pitch") is spoken-word
  narrative, not something any of Design/Arch/API/Test captures.
- **RSK-7** (time lost to a module with no stage presence) — a build-sequencing/planning risk. Its mitigation is
  "§11 build order," a planning artifact, not one of the four downstream docs.

## Contradictions noticed while indexing

Recorded only, not resolved, per the task's own instruction.

1. **Streaming-transport guidance conflicts for "the wall."** REQUIREMENTS.md defines "the wall" as module M7,
   the Operations Dashboard (`REQUIREMENTS.md:44`), and its interface requirements IF-6 and FR-DASH-8 recommend
   SSE / reconnect-safe streaming for chain→dashboard settlement events (`REQUIREMENTS.md:494`,
   `REQUIREMENTS.md:412`). `2026-08-08-booth-frontend-design.md` constraint #1 states flatly that SSE is killed
   ("A single SSE connection feeding the projector dies after five minutes on Hobby, mid-pitch. The wall polls
   instead," `booth-frontend-design.md:45`) and its own `/api/wall` endpoint is 1/s-polled, no streaming
   (`booth-frontend-design.md:408`, and the pitch-moment "Wall" description at `booth-frontend-design.md:593`
   describing the same per-participant node-flare behaviour FR-DASH-3 specifies). It is not resolved in either
   document whether these are the same rendered surface using contradictory transports, or two distinct feeds
   sharing one screen.
2. **§11's "must exist by freeze" module list omits M3 and M9 despite each carrying `M`-priority FRs.**
   `REQUIREMENTS.md:612` names "every `M` requirement in M1, M2, **M5**, M4, M6, M7" as must-exist-by-freeze —
   the same paragraph that explicitly calls out M5 having been a "serious defect" when it was previously
   missing (`REQUIREMENTS.md:614`). Yet M3 (FR-PR-1, FR-PR-2, FR-PR-4, all Pri `M`) and M9 (FR-OPS-1, FR-OPS-4,
   FR-OPS-5, all Pri `M`) are absent from that same module list, with no stated reason — and UC-1's own main
   flow depends on M3 for price resolution (`REQUIREMENTS.md:201`).
3. **OD-1 (open: does the booth app settle on-chain?) is in tension with FR-BOOTH-3 / FR-REL-6's confident
   wording.** `REQUIREMENTS.md:668` still lists "are booth-app sessions settled on-chain, or reported to the
   wall only?" as an unresolved decision. But FR-REL-6 (`REQUIREMENTS.md:385`) states the relay "MUST accept
   energy deltas from booth-app sessions through the same interface as simulated ones" and FR-BOOTH-3
   (`REQUIREMENTS.md:426`) states the app "MUST report energy deltas to the relay through the M5 interface" —
   both phrased as settled fact, not contingent on OD-1's resolution. `booth-frontend-design.md:438` ("the phone
   never touches the chain... assume it will not hold and let the wall's MON figure degrade to `simulated`
   without ceremony") and its own open-decisions item 5 (`booth-frontend-design.md:611`) confirm OD-1 is indeed
   still open — reinforcing that FR-REL-6/FR-BOOTH-3's confident phrasing is ahead of a decision the docs
   themselves say hasn't been made.
4. **Booth doc internally contradicts itself on the reward decision.** `booth-frontend-design.md:341` states
   "Decision, 2026-08-08: the conditional prize share. The team pays 20% of any cash prize won... An
   unconditional pot was offered and declined" — i.e., decided, and decided *against* the unconditional pot.
   Yet the same document's own open-decisions list still carries, at `booth-frontend-design.md:608`: "2.
   **Reward: unconditional £100 pot, or 20% of winnings?** §7 recommends unconditional. Blocks the terms panel
   copy" — both stale (the decision is already made) and backwards (§7 chose conditional, not unconditional).
   REQUIREMENTS.md §13.1 (`REQUIREMENTS.md:659`) corroborates §7's actual decision (20% conditional, top 10,
   unconditional declined), confirming item 2 of the booth doc's open-decisions list is the stale one.
