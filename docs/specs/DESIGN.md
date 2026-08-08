# Plug-N-Pay — Detailed Design

**Subordinate to `docs/specs/REQUIREMENTS.md`.** Where this document disagrees with the
requirements, the requirements win and this document is wrong. Where it disagrees with
`docs/specs/ARCHITECTURE.md`, they were written together and one of them has a bug —
report it.

| | |
|---|---|
| **Scope** | Module-level design for M1–M9, the data model, and the DR-1..5 integrity rules |
| **Version** | 1.0 · 2026-08-08 |
| **Companion** | `ARCHITECTURE.md` (topology, budgets, trust boundary, the 14 contradiction resolutions) |
| **Language** | Solidity ^0.8.24 for M4; Node.js 20 ESM for M1/M2/M3/M5/M6/M9; browser ES modules for M7 |

**`▶ FREEZE SLICE`** marks what must exist by 18:00 (CON-3, `REQUIREMENTS.md:139`).
Per `ARCHITECTURE.md` §11 C13 the slice is **M1, M2, M3, M4, M5, M6, M7, M9** — every
module except M8.

**Numbers.** Every Monad platform figure carries a `file:line` or a URL. Values labelled
**(guess)** have no source and are marked as such. Figures without either do not appear.

---

## 0. Global constraints — every module inherits these

Copied verbatim from the baseline so no module section has to restate them.

| # | Constraint | Source |
|---|---|---|
| G1 | Chain is Monad **testnet**, chain ID `10143` (`0x279F`). Mainnet is `143` and is a different chain | `docs/monad_dev_resources.md:113` |
| G2 | Settlement budget is **10 tx/s total**, across every population | `ARCHITECTURE.md` §4, ADR-8 |
| G3 | Gas is charged on `gas_limit`, not on gas used. Every limit is measured once and hardcoded | `.agents/skills/gas/SKILL.md:13` |
| G4 | **Never call `eth_estimateGas` on a per-tick path** | `ARCHITECTURE.md` §6.2; `CLAUDE.md` |
| G5 | One in-flight transaction per wallet, strict nonce order, never increment past a failure | `ARCHITECTURE.md` §5.6 |
| G6 | Simulated metering is **labelled as simulated** wherever a viewer could mistake it for hardware | FR-MET-5, `REQUIREMENTS.md:345` |
| G7 | The handshake is **modelled on** ISO 15118, never described as conformant | FR-ID-2, `REQUIREMENTS.md:330` |
| G8 | Signature verification is off-chain in the relay. Say "verifies", never "trustlessly verifies on-chain" | ASM-6, NFR-M-4; `ARCHITECTURE.md` §3.4 |
| G9 | **No private key is committed.** Keys come from `.env` or the OS keystore only | NFR-S-4, `REQUIREMENTS.md:546` |
| G10 | Timestamps are UTC milliseconds. Client-supplied times are advisory; server or chain time is authoritative | DR-4, `REQUIREMENTS.md:471` |

### 0.1 File structure

```
contracts/
  PlugNPay.sol              M4 + M3 + the registry half of M1   ▶
  script/Deploy.s.sol       deploy + verify                     ▶
relay/
  index.mjs                 process entry, wiring               ▶
  config.mjs                every constant in §0.2              ▶
  m1-registry.mjs           identity binding, handshake         ▶
  m2-metering.mjs           charge curve, Reading, signing      ▶
  m3-rates.mjs              rate table, effectiveFrom mirror    ▶
  m5-relay.mjs              queue, verify, submit, degrade      ▶
  m5-wallet-pool.mjs        pool, nonces, health                ▶
  m6-spawner.mjs            session lifecycle, control law      ▶
  m7-feed.mjs               SSE server for the wall             ▶
  m9-control.mjs            operator HTTP API, injectors        ▶
wall/
  index.html, wall.mjs      M7 dashboard                        ▶
  wall.css                  1920×1080 type scale                ▶
ops/
  index.html, ops.mjs       M9 operator surface                 ▶
tools/
  measure-rpc.mjs           EXISTS — FR-REL-9, read path
  probe-write.mjs           W0: write path + sync method + Regime B
  fund-pool.mjs             W0: claim, sweep, verify
booth/                      M8 — see `2026-08-08-booth-frontend-design.md`
```

### 0.2 Configuration constants

One file, `relay/config.mjs`. Nothing below is hardcoded anywhere else.

```js
export const CFG = {
  // ── chain ──────────────────────────────────────────────────────────────
  CHAIN_ID:            10143,              // docs/monad_dev_resources.md:113
  RPC_URLS:           ['https://testnet-rpc.monad.xyz'],   // ARCHITECTURE.md §4.5
  CONTRACT:            '0x…',              // filled at deploy

  // ── throughput (ADR-8) ─────────────────────────────────────────────────
  TX_BUDGET_PER_SEC:   10,                 // ARCHITECTURE.md §4.1
  SIM_TICK_MS:         1000,               // NFR-P-1, 1 Hz, configurable
  BOOTH_TICK_MS:       6000,               // FR-BOOTH-15
  N_SIM_MAX:           10,                 // AC-5 bar; = TX_BUDGET × SIM_TICK/1000
  N_BOOTH_MAX:         60,                 // NFR-P-2, IF-10
  RAMP_MAX_PER_SEC:    2,                  // FR-SIM-5, no self-inflicted spike

  // ── wallet pool (ARCHITECTURE.md §5) ───────────────────────────────────
  POOL_SIZE:           10,                 // 6 is the hard floor
  POOL_MIN_WALLETS:    6,
  RESERVE_FLOOR_MON:   10,                 // concepts/references/reserve-balance.md:3
  WALLET_TARGET_MON:   15,                 // floor + burn + rehearsal margin
  BALANCE_POLL_MS:     5000,

  // ── gas (measure in W1, then freeze these) ─────────────────────────────
  GAS_SETTLE:          150_000,            // (guess) until W1 measures it
  GAS_OPEN:            180_000,            // (guess)
  GAS_CLOSE:            80_000,            // (guess)
  GAS_REGISTER:        100_000,            // (guess)
  GAS_SET_RATE:         90_000,            // (guess)

  // ── timing ─────────────────────────────────────────────────────────────
  SEND_TIMEOUT_MS:     2000,               // eth_sendRawTransactionSync timeout_ms
  SESSION_IDLE_MS:     5000,               // FR-SET-4 close threshold
  SSE_HEARTBEAT_MS:    1000,               // wall liveness detector

  // ── degradation (ARCHITECTURE.md §8) ───────────────────────────────────
  CADENCE_LADDER_MS:  [1000, 2000, 6000],
  DEGRADE_AFTER_429:   3,                  // consecutive
  RECOVER_AFTER_OK:    30,                 // consecutive clean submits

  // ── switches ───────────────────────────────────────────────────────────
  // NO BOOTH_ONCHAIN FLAG. Deleted, not defaulted off.
  //   FR-SPLIT-1 (M, verified by Inspection): the booth app MUST make zero chain
  //   calls and hold no key material. A runtime switch capable of enabling booth
  //   chain-writes violates that requirement BY EXISTING — inspection would find a
  //   code path that puts wallets in a phone app. Booth-on-chain is out of scope;
  //   REQUIREMENTS.md §16 is the reason. See PART II.
  USE_SYNC_SEND:       true,               // ADR-3 — UNVERIFIED, see PART II §M-ADR3
};
```

**`N_SIM_MAX` is derived, not chosen:** `TX_BUDGET_PER_SEC × (SIM_TICK_MS / 1000) = 10`.
Changing the budget or the cadence changes the session count automatically. That
relationship is ADR-8 and it must not be broken by hardcoding a different number.

### 0.3 Baseline items this design inherits

Constraints and decisions that shape the modules below without belonging to any one of
them. Each is discharged in `ARCHITECTURE.md` at the section named; repeated here so a
developer reading only this document is not missing a constraint that binds their code.

| ID | What it means for the code you are about to write | Discharged |
|---|---|---|
| **CON-1** | Every line is written today. No pre-built project, no forked codebase beyond standard libraries — so every module below is scoped to be writable inside its wave (§12) | `ARCHITECTURE.md` §12 |
| **CON-5** / **ASM-4** | The RPC limit was undocumented, is now **measured at 40–45 req/s** for reads. Nothing in this design may assume more than the 10 tx/s budget (G2) | `ARCHITECTURE.md` §4.1, §11 C1 |
| **ASM-3** | Venue wifi is usable but unreliable. Every module's dependency-failure row assumes the network goes away mid-demo, not that it stays up | `ARCHITECTURE.md` §8 |
| **FR-SET-2** | **The security core.** Value moves only against a validated signed metering event. Validation is off-chain in M5 (§M5.2, the trust boundary); the contract enforces its own independent guards (§M4.1). The pitch says "verifies," never "trustlessly verifies on-chain" (G8) | §M4.1, §M5.2 |
| **FR-BOOTH-4** | The booth app stays fully playable with the relay unreachable — which is why §M5.7 answers `204` unconditionally and never returns an error the phone could render | §M5.7, `ARCHITECTURE.md` §8.3 (L2) |
| **NFR-R-1** | Three minutes with no visible freeze. Every degraded path in §M5.5 keeps the wall moving; none of them stops the render loop | §M5.5, §M7.6 |
| **NFR-M-1** / **NFR-M-3** | Every simplification is documented in the README, and the repo is public with a live testnet deployment. The simplifications this design creates: the M1.1 handshake table, the Proposed-state read (`ARCHITECTURE.md` §7.2), and the ASM-6 boundary | §M1.1, §M4.7 |
| **RSK-2** | Architecture changing late is the named rework risk. It is retired: Q2 is resolved and §M4.6 pre-builds the batch entry point so ADR-1's reversal needs no redeploy | §M4.6 |
| **Q1** | Dedicated RPC endpoint — none exists for this event (`open_questions.md:18`). `CFG.RPC_URLS` is an array so sharding is config, not code | §0.2 |
| **Q2** | **Resolved: per-tick.** This is why M5 exists in the shape it does, and why §M4.6 is a fallback rather than the main path | §M5.4 |
| **Q3** | **Resolved: rehearse at 10.** `N_SIM_MAX = 10`, and §M6.5 names the stress profile recording-only | §M6.5 |
| **OD-1** | **Closed — booth makes zero chain calls** (`REQUIREMENTS.md` §16, FR-SPLIT-1). No switch, no flag, no branch | PART II, `ARCHITECTURE.md` §16.4 |

---

## M1 — Identity & Handshake ▶ FREEZE SLICE

**Responsibility.** Authenticate a vehicle and a station to each other with no human
action, and bind each verified identity to exactly one on-chain wallet so a later
settlement cannot be redirected.

**Requirements.** FR-ID-1, FR-ID-2, FR-ID-3, FR-ID-4, FR-ID-5 (all `M`); FR-ID-6 (`S`);
FR-ID-7 (`C`, not today). UC-1, UC-11. NFR-S-2. CON-7, ASM-5. DR-5.

**Structure.** Split across two homes: the **registry** lives on-chain inside
`PlugNPay.sol` (identity → wallet is a payment-critical binding and belongs where the
payment happens); the **handshake** is `relay/m1-registry.mjs`, off-chain.

### M1.1 The handshake, step by step — modelled on ISO 15118 (FR-ID-2, G7)

Full ISO 15118 is out of budget: TLS mutual authentication, the EXI message stack and
certificate provisioning chains (CON-7, `REQUIREMENTS.md:143`). What is preserved is the
**essential property** the standard delivers — automatic mutual authentication on
physical connection, with no manual entry of payment details (`idea.md:127`).

| # | ISO 15118 does | Plug-N-Pay does | Preserved? |
|---|---|---|---|
| 1 | `SupportedAppProtocolReq/Res` | Skipped — one protocol version exists | n/a |
| 2 | TLS mutual auth with an X.509 chain to a V2G root | **secp256k1 keypair per party, public key pre-registered on-chain.** No certificate chain, no CA | ⚠ Simplified — no revocation, no hierarchy |
| 3 | `PaymentDetailsReq` carrying the contract certificate | `HandshakeHello { id, role, nonce, timestampMs }`, signed | ✅ Identity asserted and proven |
| 4 | `AuthorizationReq` — a challenge the EV signs | `HandshakeChallenge { peerNonce }` → `HandshakeProof` signing `(ownNonce ‖ peerNonce)` | ✅ **Mutual**, fresh, replay-proof |
| 5 | Backend resolves the contract ID to a billing account | Registry resolves `id → wallet` on-chain | ✅ This is the load-bearing step |
| 6 | `ChargeParameterDiscovery`, `PowerDelivery` | Direction resolved, price read from M3, `openSession` on-chain | ✅ |

**What must be said about it, everywhere it is described** (FR-ID-2, ASM-5):

> The handshake is **modelled on** ISO 15118 Plug & Charge. It reproduces the property
> that matters — automatic mutual authentication on connection, with no human entering
> payment details — using signed nonce exchange instead of the TLS certificate stack.
> It is not a conformant ISO 15118 implementation, and the certificate chain, revocation
> and provisioning layers are absent.

### M1.2 Algorithm

```
handshake(vehicleId, stationId) -> SessionParams | Refusal

  1. veh  ← HandshakeHello{ id: vehicleId,  role: VEHICLE, nonce: Nv, ts }  signed by Kv
     sta  ← HandshakeHello{ id: stationId,  role: STATION, nonce: Ns, ts }  signed by Ks

  2. FOR each party P in (veh, sta):                                # FR-ID-4
        rec ← registry.lookup(P.id)                                 # one eth_call, cached
        IF rec is empty            -> REFUSE("unregistered")        # UC-1 alt 2a
        IF |now - P.ts| > 30_000   -> REFUSE("stale hello")
        IF NOT verify(P.sig, P.body, rec.pubKey)
                                   -> REFUSE("bad identity sig")    # FR-ID-1

  3. # mutual proof — each signs the OTHER's nonce, so neither can replay a
     #                 transcript captured from an earlier session
     proofV ← sign(Kv, Nv ‖ Ns);   proofS ← sign(Ks, Ns ‖ Nv)
     IF NOT verify(proofV, rec_v.pubKey) OR NOT verify(proofS, rec_s.pubKey)
                                   -> REFUSE("bad mutual proof")

  4. direction ← CHARGE | DISCHARGE                                 # from the spawner/aggregator
     rate      ← M3.rateFor(direction, now)                         # FR-PR-1, FR-PR-2
     IF rate is null            -> REFUSE("no price")               # UC-1 alt 3a

  5. payer, payee ← (direction == CHARGE)
                      ? (rec_v.wallet, rec_s.wallet)
                      : (rec_agg.wallet, rec_v.wallet)              # UC-4

  6. RETURN { payer, payee, direction, rate, meterId }              # → M4.openSession
```

**Step 3 is the whole security property.** Each party signs a value it did not choose,
so a transcript captured from an earlier session proves nothing in a later one.

### M1.3 Why spoofing cannot redirect payment (FR-ID-5, NFR-S-2, UC-11)

The binding is structural. `registry[id] = { pubKey, wallet, role }` is written once
and is immutable after (`REQUIREMENTS.md:312` — duplicate registration rejected).
Step 5 above takes `wallet` **from the registry record**, never from the handshake
message. So an attacker who somehow produced a valid proof for station `S` would still
send value to the wallet the registry bound to `S`, which is the real station's.

There is nowhere in the flow where a party supplies an address that gets paid.
`settle()` takes no address at all (§M4.4). **Nothing to spoof** is a stronger property
than *a check that catches spoofing*, and it is why UC-11 is a setup step rather than a
runtime defence.

### M1.4 Registry data structure

On-chain, in `PlugNPay.sol`:

```solidity
enum Role { NONE, VEHICLE, STATION, METER, AGGREGATOR }   // NONE = unregistered

struct Identity {
    address wallet;    // 20 bytes  ┐ one slot
    Role    role;      //  1 byte   │
    bool    active;    //  1 byte   ┘
    bytes32 pubKey;    // 32 bytes  — second slot
}
mapping(bytes32 => Identity) public registry;             // keccak256(idString) => Identity
```

Two slots per identity, packed so `wallet`, `role` and `active` share one
(`ARCHITECTURE.md` §6.3 — cold storage is 8,100 gas against warm 100, so slot count is
the gas cost).

### M1.5 Runtime registration (FR-ID-6, `S`)

`registerIdentity` is callable after deploy, which satisfies FR-ID-6 with no extra code.
Two callers use it:

- **Setup, before freeze** — the identity pool of 60 (FR-SIM-6, §M6.2).
- **Runtime, audience-paced** — booth sessions (FR-BOOTH-9), at the low rate
  UC-11's bootstrapping note permits (`REQUIREMENTS.md:315`).

**Never in a spin-up burst.** Registering dozens of identities at the moment the
operator hits "spin up" would consume RPC headroom exactly when the demo needs it
(`REQUIREMENTS.md:315`).

### M1.6 Errors and dependency failure

| Condition | Behaviour |
|---|---|
| Registry `eth_call` fails | Serve from the in-memory cache warmed at bring-up. The pool of 60 is static, so a cache miss is only possible for a booth identity — refuse that one session, continue |
| Unregistered party | `REFUSE("unregistered")`, no session, no value (FR-ID-4, UC-1 alt 2a) |
| Duplicate registration | Contract reverts `AlreadyRegistered` (UC-11 alt 1a) |
| Clock skew > 30 s | `REFUSE("stale hello")` — prevents indefinite transcript reuse |
| **M3 unavailable** | `REFUSE("no price")`. **A session is refused rather than opened at an unknown price** (UC-1 alt 3a) — this is deliberate and must not be "fixed" with a default rate |

---

## M2 — Metering ▶ FREEZE SLICE

**Responsibility.** Produce signed readings at a fixed cadence following a realistic
charge curve, in both directions, such that the signature is the only thing authorising
payment.

**Requirements.** FR-MET-1..7 (all `M`); FR-MET-8 (`C`, not today). IF-1, IF-2, IF-3.
DR-1, DR-4. NFR-S-1, NFR-S-3. UC-2, UC-7. A3, ASM-2, RSK-6.

**File.** `relay/m2-metering.mjs`.

### M2.1 The charge curve (FR-MET-4)

Three phases — ramp, plateau, taper near full — because a flat line reads as fake to
anyone who has charged a car (`idea.md:54`).

```
 kW
 ▲
 │        ┌──────────────────────┐
 │       ╱                        ╲
 │      ╱                          ╲___
 │     ╱                                ╲___
 │    ╱                                      ╲__
 └───┴──────────┴──────────────────┴──────────────► SoC
     0%        ramp              taper          100%
              (0→8%)           (from 80%)
```

```js
// All four parameters are randomised per session so the wall shows no
// synchronised clones (FR-SIM-3).
function kwAt(soc, p) {                    // soc ∈ [0,1]
  const RAMP_END = 0.08, TAPER_START = 0.80;
  if (soc < RAMP_END)      return p.peakKw * (soc / RAMP_END);        // ramp
  if (soc < TAPER_START)   return p.peakKw * (1 - 0.06 * soc);        // slight droop
  const t = (soc - TAPER_START) / (1 - TAPER_START);                  // 0→1
  return p.peakKw * (1 - t) ** 1.7 + p.trickleKw;                     // taper
}

// DISCHARGE (V2G, UC-4): the same function, negated. NOT a second curve.
function kwAtSigned(soc, p, direction) {
  return direction === 'DISCHARGE' ? -kwAt(1 - soc, p) : kwAt(soc, p);
}
```

**`kwAtSigned` is the FR-SET-7 principle applied one layer up.** Discharge is the same
curve with a sign flip and a mirrored state of charge. A second curve function would be
the metering-layer version of the second code path FR-SET-7 forbids.

Per-session parameters (each drawn once at spawn):

| Parameter | Range | Why |
|---|---|---|
| `peakKw` | 7–150 | Covers domestic AC through DC rapid |
| `capacityKwh` | 40–100 | Realistic pack sizes |
| `startSoc` | 0.10–0.75 | Sessions do not all start empty |
| `trickleKw` | 0.5–2.0 | Charging never quite reaches zero before the cutoff |
| `jitter` | ±3% per tick | Real current is not smooth |

These are plausible EV figures, not sourced measurements — **(guess)**, and they only
have to be plausible, because the metering is labelled simulated (G6).

### M2.2 The Reading struct (FR-MET-2, IF-1, IF-2, IF-3)

```js
/**
 * @typedef {Object} Reading
 * @property {string} sessionId    // bytes32 hex
 * @property {number} seq          // uint32, strictly increasing per session (IF-2)
 * @property {number} timestampMs  // UTC ms (DR-4, G10)
 * @property {number} kW           // signed; negative = discharge (FR-MET-6, IF-3)
 * @property {number} whDelta      // signed watt-hours since the previous reading
 * @property {string} meterId      // bytes32 hex — the registry key, NOT the station's
 * @property {string} signature    // 65-byte hex; covers every field above (IF-1)
 */
```

`whDelta` is in **watt-hours as an integer**, never kilowatt-hours as a float. Floating
point in a value-bearing field is a rounding bug waiting for a demo, and the contract
does integer arithmetic (§M4.4).

```js
whDelta = Math.round(kW * 1000 * (tickMs / 3_600_000));   // W × h → Wh, signed
```

### M2.3 Signature scheme (FR-MET-3)

secp256k1 over a domain-separated digest. Same curve as the chain, so one library
covers both and the contract could verify it later without a new precompile
(relevant to the ADR-4 reversal path).

```js
digest = keccak256(abi.encode(
    "PLUGNPAY_READING_V1",   // domain separator — a reading can never be replayed
    CFG.CHAIN_ID,            //   into another protocol, chain or session
    sessionId, seq, timestampMs, kW, whDelta, meterId
));
signature = secp256k1.sign(digest, meterPrivateKey);
```

**The domain separator is not decoration.** Without it, a signature over the same tuple
is valid in any other context that hashes the same fields — including mainnet, where
chain `143` is a different chain entirely (G1).

**FR-MET-5 / G6 is discharged here at the source.** Every `Reading` produced by this
module carries `simulated: true` in the relay's internal envelope, and M7 renders that
flag. The flag is set by construction, not by configuration, so no build can accidentally
present simulated metering as hardware.

### M2.4 Replay defence (FR-MET-7, NFR-S-3, DR-2)

Three independent layers. Any one of them alone would satisfy the requirement; all three
exist because this is the security core (`REQUIREMENTS.md:365`) and the cost is trivial.

| Layer | Mechanism | Where | Catches |
|---|---|---|---|
| 1 | `seq` must be strictly greater than the session's `lastSeq` | Relay, in memory | Ordinary replay and reordering |
| 2 | `(sessionId, seq)` seen-set, per session, cleared on close | Relay, in memory | Replay after a `lastSeq` reset |
| 3 | `settled[sessionId][seq]` bitmap | **On-chain**, M4 | Everything above, **independently of the relay** |

Layer 3 is what makes FR-OPS-7's `INJECT REPLAY` button meaningful
(`ARCHITECTURE.md` §10.4): the operator forces a duplicate past layers 1 and 2 and the
contract still refuses, producing an on-chain revert a judge can click.

### M2.5 Negative `whDelta` and discharge (FR-MET-6, IF-3, UC-4)

`whDelta < 0` denotes discharge. It is a signed integer end to end:

```
M2  kwAtSigned() → negative kW → negative whDelta   (int)
M5  no branch — the value is passed through          (int)
M4  int256 whDelta; monDelta = whDelta × rate        (int256, sign preserved)
    direction of value movement follows the sign     (FR-SET-7)
M7  negative renders as the V2G colour and an upward counter (NFR-U-2)
```

**No module contains `if (direction == DISCHARGE)` on the value path.** Grep for it
before freeze — a hit is an FR-SET-7 violation.

### M2.6 Errors and dependency failure

| Condition | Behaviour |
|---|---|
| Tick loop overruns its interval | Emit one reading with the true elapsed `whDelta`; do not emit two. Energy is conserved, cadence is not |
| Session already closed | Drop the reading silently; the curve advances no further |
| Signing key missing | **Fail loudly at startup, never at tick time.** Validate all 60 meter keys during bring-up |
| Relay queue full | Metering is upstream of the queue. `whDelta` accumulates in the session's pending delta (`ARCHITECTURE.md` §8.2) rather than being dropped |

---

## M3 — Pricing ▶ FREEZE SLICE

**Responsibility.** Serve the charging price per kWh and a distinguishable V2G buy-back
rate, such that a rate change applies only to subsequent ticks.

**Requirements.** FR-PR-1, FR-PR-2, FR-PR-4 (all `M`); FR-PR-3 (`S`); FR-PR-5 (`C`, not
today). UC-1, UC-12. DR-3. A4.

**⚠ M3 was omitted from §11's freeze list; that omission is a defect** — UC-1 step 3
reads price from M3 and alternate 3a refuses the session without it
(`REQUIREMENTS.md:201,207`), so without M3 no session opens at all. See
`ARCHITECTURE.md` §11 C13.

**Home.** The rate table lives **on-chain, inside `PlugNPay.sol`**, with a read-through
mirror in `relay/m3-rates.mjs`. On-chain is required by IF-4: the contract computes
`whDelta × price` itself, so it must hold the price. A relay-held price would make
FR-SET-3 an assertion by an off-chain party rather than an enforced property.

### M3.1 Storage and the `effectiveFrom` mechanism (FR-PR-4)

The naive design — one mutable `price` variable — silently reprices history. This one
cannot, because rates are an **append-only log** and every settlement resolves the rate
that was in force at its own timestamp.

```solidity
enum Ctx { CHARGE, V2G }                                  // FR-PR-2: separate, distinguishable

struct Rate {
    uint128 monPerKwh;      // 18-decimal fixed point
    uint64  effectiveFrom;  // unix seconds; 0 = genesis rate
}
mapping(Ctx => Rate[]) public rates;                      // append-only, ascending

function setRate(Ctx ctx, uint128 monPerKwh, uint64 effectiveFrom) external onlyOwner {
    Rate[] storage h = rates[ctx];
    require(h.length == 0 || effectiveFrom > h[h.length - 1].effectiveFrom, "NotMonotonic");
    h.push(Rate(monPerKwh, effectiveFrom));
    emit RateSet(ctx, monPerKwh, effectiveFrom);
}

/// The rate in force at `at`. Reverse scan: the newest rate is the common case,
/// and the history is a handful of entries in a three-minute demo.
function rateAt(Ctx ctx, uint64 at) public view returns (uint128) {
    Rate[] storage h = rates[ctx];
    for (uint256 i = h.length; i > 0; i--) {
        if (h[i - 1].effectiveFrom <= at) return h[i - 1].monPerKwh;
    }
    revert NoRate();                                      // UC-1 alt 3a
}
```

**Why `setRate` cannot rewrite the past.** There is no update path — only `push`, and
only forward in time (`NotMonotonic`). A tick settled before `effectiveFrom` resolves
through `rateAt` to the older entry, which is still there. **FR-PR-4 is true by
construction rather than by a check**, which is what makes `story.md:13`'s complaint —
"the rate changed mid-session and no one told you" — structurally impossible rather
than merely guarded against.

### M3.2 Which timestamp resolves the rate

`settle()` calls `rateAt(ctx, uint64(block.timestamp))`, not a relay-supplied time.

**DR-4 requires it** (`REQUIREMENTS.md:471`): client-supplied times are advisory, chain
time is authoritative. If the relay chose the timestamp it could pick the rate, which
would hand the trust boundary a lever it does not otherwise have
(`ARCHITECTURE.md` §3.2).

**Accepted cost:** a tick metered microseconds before a rate change may settle at the
new rate if its block lands after the change. The window is one block, ~300 ms
(https://docs.monad.xyz/, fetched 2026-08-08). That is a bounded, explainable
discrepancy; a relay-chosen timestamp would be an unbounded, unexplainable one.

### M3.3 The V2G premium window (FR-PR-3, `S`)

FR-PR-3 wants the V2G rate expressible as a peak premium tied to a demand window. The
`effectiveFrom` log already provides it with no new mechanism:

```
setRate(V2G, 0.12e18,  0)                 // baseline
setRate(V2G, 0.30e18,  T_peak_start)      // premium — story.md:9, "between 6 and 8pm"
setRate(V2G, 0.12e18,  T_peak_end)        // back to baseline
```

Three queued calls before the demo. The operator's `TRIGGER PEAK` button (§M9) simply
advances the clock past `T_peak_start`, and the wall's V2G rate visibly jumps mid-demo.
Booth defaults, for consistency: `priceMonPerKwh: 0.12`, `v2gMonPerKwh: 0.30`
(`2026-08-08-booth-frontend-design.md:395`).

### M3.4 Errors and dependency failure

| Condition | Behaviour |
|---|---|
| No rate set for a context | `rateAt` reverts `NoRate`. **Sessions refuse to open** (UC-1 alt 3a) rather than open at an unknown price |
| Relay mirror stale | Only affects the price shown pre-open. The settled price always comes from `rateAt` on-chain, so a stale mirror cannot cause a mispriced settlement |
| `setRate` with a past timestamp | Reverts `NotMonotonic` |

**Not today (`REQUIREMENTS.md:623`):** FR-PR-5, a live oracle. The `Rate[]` log is
already the shape an oracle would push into, so the production path is a new writer,
not a new design.

---

## M4 — Settlement Contracts ▶ FREEZE SLICE

**Responsibility.** Hold sessions, move value against validated readings, and enforce
the rules that do not depend on the relay behaving.

**Requirements.** FR-SET-1..9 (all `M`); FR-SET-10 (`S`); FR-SET-11 (`W`, not today).
IF-4, IF-5. DR-1, DR-2, DR-3. NFR-S-1, NFR-M-2. UC-1..UC-4, UC-7, UC-12. AC-9.

**File.** `contracts/PlugNPay.sol`. One contract — registry (M1), rates (M3) and
settlement (M4) together, because they share storage on the hot path and a cross-contract
call is a cold account access at 10,100 gas (`.agents/skills/gas/SKILL.md:115`) on every
tick.

### M4.1 What the contract enforces regardless of the relay

This list is the answer to "if the relay is trusted, what is the contract for?"

| # | Guard | Requirement | Defeats |
|---|---|---|---|
| 1 | `(sessionId, seq)` settles at most once | FR-SET-9, DR-2 | Replay, double-settlement, relay retry bugs |
| 2 | `monDelta` is computed on-chain from `whDelta × rateAt(...)` | IF-4, FR-SET-3 | A relay that submits a MON amount of its choosing |
| 3 | Settlement never exceeds the payer's funded balance | FR-SET-8 | Unbounded drain |
| 4 | Only an `OPEN` session settles | FR-SET-4 | Settling after close |
| 5 | `payer`/`payee` are immutable after open | FR-SET-1, FR-ID-5 | Payment redirection |
| 6 | Rate resolves by chain time, not relay time | FR-PR-4, DR-4 | Relay rate-shopping |

Guard 2 is the one that matters most and it is subtle: **the relay attests to signature
validity, and it never dictates the settled amount.** `ARCHITECTURE.md` §3.2's blast
radius is bounded to "overstate `whDelta`" precisely because of it.

### M4.2 Storage layout — packed for the hot path

Cold storage costs 8,100 gas against warm 100 (`.agents/skills/gas/SKILL.md:116,118`),
an 81× ratio, so slot count is the dominant cost of `settle()` (G3).

```solidity
struct Session {
    // ── slot 0 ── read by settle()
    address payer;          // 20 B  ┐
    uint8   direction;      //  1 B  │  CHARGE=0, DISCHARGE=1
    uint8   status;         //  1 B  │  OPEN=1, CLOSED=2
    uint16  ctx;            //  2 B  │  Ctx for rateAt()
    uint64  startedAt;      //  8 B  ┘  = 32 B exactly

    // ── slot 1 ── read by settle()
    address payee;          // 20 B  ┐
    uint32  lastSeq;        //  4 B  │
    uint64  closedAt;       //  8 B  ┘  = 32 B exactly

    // ── slot 2 ── written by settle()
    uint128 funded;         // 16 B  ┐  remaining payer balance for this session
    int128  cumWh;          // 16 B  ┘  signed cumulative watt-hours

    // ── slot 3 ── written by settle()
    int256  cumMon;         // 32 B     signed cumulative MON moved
}
mapping(bytes32 => Session) public sessions;
mapping(bytes32 => mapping(uint32 => bool)) public settled;   // FR-SET-9, DR-2
```

**`settle()` touches four slots** — the two it reads, the two it writes — plus the
`settled` flag. That is the "4 cold storage slots" figure the funding arithmetic in
`ARCHITECTURE.md` §5.4 is built on.

`funded` decrements as value moves, so FR-SET-8's guard is a single comparison against
a warm slot rather than a balance lookup (which would be a cold *account* access at
10,100 gas).

### M4.3 Events (FR-SET-6, FR-SET-10)

```solidity
event SessionOpened(bytes32 indexed sessionId, address indexed payer, address indexed payee,
                    uint8 direction, uint128 rateAtOpen, uint64 startedAt);   // FR-SET-1

event Settled(bytes32 indexed sessionId, uint32 seq, int256 whDelta, int256 monDelta,
              uint8 direction, int128 cumWh, int256 cumMon);                  // FR-SET-6

event SessionClosed(bytes32 indexed sessionId, int128 totalWh, int256 totalMon,
                    uint64 closedAt);                                          // FR-SET-5

event SettlementRefused(bytes32 indexed sessionId, uint32 seq, bytes4 reason); // UC-7 evidence
```

`Settled` carries `cumWh` and `cumMon`, which discharges **FR-SET-10** (`S`, live
per-session totals for the dashboard) without a separate view call — the wall reads the
running total straight off the event it already receives, at zero extra RPC cost
(`ARCHITECTURE.md` §4.2).

`SettlementRefused` exists so a rejection is on-chain evidence rather than a relay log
entry. It is what `INJECT REPLAY` produces.

### M4.4 The settle path — one code path, sign flip only (FR-SET-7)

```solidity
error NotOpen(); error AlreadySettled(); error Underfunded(); error NoRate();

function settle(bytes32 sessionId, uint32 seq, int256 whDelta) external onlyRelay {
    Session storage s = sessions[sessionId];

    if (s.status != OPEN)              revert NotOpen();                  // FR-SET-4
    if (settled[sessionId][seq])       revert AlreadySettled();           // FR-SET-9, DR-2
    settled[sessionId][seq] = true;                                       // set BEFORE the transfer

    // IF-4: the CONTRACT computes MON from energy. The relay never supplies an amount.
    uint128 rate    = rateAt(Ctx(s.ctx), uint64(block.timestamp));        // FR-PR-4, DR-4
    int256  monDelta = (whDelta * int256(uint256(rate))) / 1_000_000;     // Wh × MON/kWh → MON

    // ── THE SIGN FLIP — the entire difference between charging and V2G ──
    // whDelta > 0 : energy into the vehicle  → value payer → payee
    // whDelta < 0 : energy out of the vehicle → value payee → payer
    uint256 amount  = uint256(monDelta >= 0 ? monDelta : -monDelta);
    address from    = monDelta >= 0 ? s.payer : s.payee;
    address to      = monDelta >= 0 ? s.payee : s.payer;

    if (amount > s.funded) revert Underfunded();                          // FR-SET-8
    s.funded -= uint128(amount);

    s.cumWh  += int128(whDelta);                                          // DR-3
    s.cumMon += monDelta;
    s.lastSeq = seq;                                                      // IF-2

    _move(from, to, amount);
    emit Settled(sessionId, seq, whDelta, monDelta, s.direction, s.cumWh, s.cumMon);
}
```

**There is no `if (direction == DISCHARGE)` branch.** Direction is stored for reporting
only; the value path reads the *sign of `monDelta`*, which comes from the sign of
`whDelta`, which comes from `kwAtSigned` in M2. **A reviewer can verify FR-SET-7 by
reading eleven lines and finding no second path** — that is the requirement's own test
("A second code path fails this requirement", `REQUIREMENTS.md:370`).

Three ordering details that are load-bearing:

- **`settled[...]` is set before the transfer.** Checks-effects-interactions. A
  re-entrant call finds the flag already set and reverts `AlreadySettled`.
- **`s.funded` decrements before `_move`.** Same reason.
- **Integer division `/ 1_000_000`** converts Wh × (MON/kWh, 18-dec) to MON at 18
  decimals. It truncates toward zero, so a rounding error can never create MON — the
  worst case is that a fraction of a watt-hour goes unsettled, which DR-3 tolerates
  because both sides of its equation use the same truncated arithmetic.

### M4.5 Open and close

```solidity
function openSession(bytes32 sessionId, bytes32 payerId, bytes32 payeeId,
                     uint8 direction, uint16 ctx) external payable onlyRelay {
    require(sessions[sessionId].status == 0, "Exists");
    Identity storage p = registry[payerId];
    Identity storage q = registry[payeeId];
    require(p.active && q.active, "Unregistered");           // FR-ID-4
    rateAt(Ctx(ctx), uint64(block.timestamp));               // reverts NoRate — UC-1 alt 3a

    sessions[sessionId] = Session({
        payer: p.wallet, payee: q.wallet,                    // FR-SET-1, FR-ID-5 — from the
        direction: direction, ctx: ctx, status: OPEN,        //   REGISTRY, not the caller
        startedAt: uint64(block.timestamp), closedAt: 0,
        funded: uint128(msg.value), lastSeq: 0, cumWh: 0, cumMon: 0
    });
    emit SessionOpened(sessionId, p.wallet, q.wallet, direction,
                       rateAt(Ctx(ctx), uint64(block.timestamp)), uint64(block.timestamp));
}

/// FR-SET-5: closing moves NO value. The last settled state is already final.
function closeSession(bytes32 sessionId) external onlyRelay {
    Session storage s = sessions[sessionId];
    require(s.status == OPEN, "NotOpen");
    s.status = CLOSED;
    s.closedAt = uint64(block.timestamp);
    emit SessionClosed(sessionId, s.cumWh, s.cumMon, s.closedAt);
    // No reconciliation transfer. No invoice. UC-3, story.md:7.
}
```

**`closeSession` moving no value is the product** (`REQUIREMENTS.md:234`). Any refund,
true-up or reconciliation transfer added here fails FR-SET-5 and breaks the claim the
whole project rests on.

### M4.6 Batch entry point — FR-REL-2 fallback, IF-4, IF-5

Built even though per-tick is primary, because ADR-1's reversal trigger can fire and
retrofitting a contract function after deployment costs a redeploy and a re-verification.

```solidity
/// IF-4: an array of ENERGY DELTAS, never pre-computed MON amounts.
/// IF-5: all-or-nothing — a partial failure settles no entry in the batch.
function settleBatch(bytes32[] calldata ids, uint32[] calldata seqs,
                     int256[] calldata whDeltas) external onlyRelay {
    require(ids.length == seqs.length && ids.length == whDeltas.length, "LenMismatch");
    for (uint256 i = 0; i < ids.length; i++) {
        _settle(ids[i], seqs[i], whDeltas[i]);   // any revert unwinds the whole tx — IF-5
    }
}
```

IF-5's atomicity is free: a Solidity revert unwinds every state change in the
transaction. It is stated explicitly because a `try/catch` per entry — a natural thing
to reach for — would violate it.

### M4.7 Deployment and verification (NFR-M-2, AC-9, CON-2)

Per `.agents/skills/scaffold/SKILL.md:97`: **always use the verification API**, which
verifies on MonadVision, Socialscan and Monadscan in one call. Do **not** reach for
`forge verify-contract` first.

```bash
forge script script/Deploy.s.sol --rpc-url https://testnet-rpc.monad.xyz --broadcast
forge verify-contract <ADDR> PlugNPay --chain 10143 --show-standard-json-input \
  > /tmp/standard-input.json
# POST chainId=10143, contractAddress, contractName, compilerVersion,
#      standardJsonInput, foundryMetadata  →  https://agents.devnads.com/v1/verify
```
(`.agents/skills/scaffold/SKILL.md:105-161`.) Fallback only if the API fails:
`--verifier sourcify --verifier-url "https://sourcify-api-monad.blockvision.org/"`
(`.agents/skills/scaffold/SKILL.md:169-172`).

**Never invent an address.** Any external address must be verified to have code via
`cast code <addr> --rpc-url https://testnet-rpc.monad.xyz`
(`.agents/skills/addresses/SKILL.md:28-35`). This build needs none, but if Wrapped MON
is ever touched, the **testnet** address is
`0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541` (`docs/monad_dev_resources.md:159`) — **not**
the mainnet address `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A` that appears in the
local addresses skill's default table (`.agents/skills/addresses/SKILL.md:42`), which is
headed "Canonical contracts (on Monad mainnet)" (`.agents/skills/addresses/SKILL.md:38`).

### M4.8 Errors and dependency failure

| Revert | Cause | Relay response |
|---|---|---|
| `AlreadySettled` | Duplicate `(sessionId, seq)` | Log, drop, do not retry. Expected during `INJECT REPLAY` |
| `Underfunded` | FR-SET-8 tripped | **Force-close the session at the last funded tick** (UC-2 alt 4a) |
| `NotOpen` | Settle after close | Log, drop |
| `NoRate` | No rate for the context | Refuse the open (UC-1 alt 3a) |
| Out of gas | Hardcoded limit too tight | **Alarm.** The limit is wrong; do not raise it silently at runtime — G3 means a raised limit costs MON on every subsequent tick |

**Not today (`REQUIREMENTS.md:623`):** FR-SET-11, rate-based streaming where the
withdrawable balance is `elapsed × rate`. It is the production optimisation
(`idea.md:37`) and is named as such rather than dropped.

---

## M5 — Settlement Relay ▶ FREEZE SLICE

**Responsibility.** Verify signatures, allocate wallets, submit one transaction per
session per tick, degrade visibly under pressure, and expose its mode.

**Requirements.** FR-REL-1, FR-REL-3, FR-REL-4, FR-REL-5, FR-REL-7, FR-REL-8, FR-REL-9
(all `M`); FR-REL-2, FR-REL-6 (`S`). IF-1, IF-4, IF-5, IF-9. ASM-1, ASM-6. UC-2, UC-8.
NFR-S-1, NFR-S-5. RSK-1, RSK-4. AC-2, AC-8.

**This module is the trust boundary** (`ARCHITECTURE.md` §3). It is also the module whose
absence was called "a serious defect" when it was missing from the freeze slice
(`REQUIREMENTS.md:617`).

**Files.** `relay/m5-relay.mjs` (queue, verify, degrade), `relay/m5-wallet-pool.mjs`
(pool, nonces, health).

### M5.1 Internal structure

```
                 ┌──────────────────────────── m5-relay.mjs ─────────────────────┐
  Reading ──────►│  ① verify        ② replay guard      ③ pending-delta ledger    │
  (M2, M8)       │     ecrecover        seq + seen-set     per session, coalescing│
                 │        │                  │                    │              │
                 │        └──────────────────┴────────────────────┘              │
                 │                           ▼                                    │
                 │                    ④ submit queue (FIFO per session)           │
                 │                           │                                    │
                 │            ┌──────────────┴───────────────┐                    │
                 │            ▼                              ▼                    │
                 │     ⑤ wallet pool                  ⑥ mode machine              │
                 │        (m5-wallet-pool)               NORMAL/DEGRADED/…        │
                 │            │                              │                    │
                 └────────────┼──────────────────────────────┼────────────────────┘
                              ▼                              ▼
                eth_sendRawTransactionSync            GET /relay/mode  (FR-REL-5)
                              │                              │
                              └──── receipt ──► SSE ────────►│──► wall (M7)
```

### M5.2 Verification — the boundary check (IF-1, ASM-6, TB-1)

```js
function verifyReading(r) {
  const rec = registry.get(r.meterId);
  if (!rec || !rec.active)            return REJECT('unregistered-meter');   // FR-ID-4
  const digest = readingDigest(r);                                            // §M2.3
  const signer = secp256k1.recover(digest, r.signature);
  if (signer !== rec.pubKey)          return REJECT('bad-signature');         // IF-1
  const st = sessionState.get(r.sessionId);
  if (!st || st.status !== 'OPEN')    return REJECT('not-open');
  if (r.seq <= st.lastSeq)            return REJECT('replay-seq');            // IF-2, FR-MET-7
  if (st.seen.has(r.seq))             return REJECT('replay-seen');           // DR-2
  return ACCEPT;
}
```

**Every rejection publishes to the wall and increments a visible discrepancy counter**
(UC-2 alt 2a). A silent rejection would make FR-OPS-7's demonstration invisible and
would hide a real bug behind a clean-looking dashboard.

**This function is the boundary.** Everything downstream trusts its verdict, and
`ARCHITECTURE.md` §3.2 states exactly what that buys an attacker who compromises it.

### M5.3 The wallet pool (FR-REL-8, G5)

```js
class WalletPool {
  // state per wallet: { addr, signer, nextNonce, status, balanceMon, lastCheck }
  //   status ∈ IDLE | BUSY | DRAINING | RETIRED

  async bringUp() {                                    // ARCHITECTURE.md §5.5.1
    for (const w of this.wallets) {
      w.balanceMon = await rpc.getBalance(w.addr);
      if (w.balanceMon < CFG.RESERVE_FLOOR_MON)        // §5.3 Regime A
        throw new Error(`${w.addr} below reserve floor — refusing to start`);
      w.nextNonce = await rpc.getTransactionCount(w.addr, 'pending');  // ONCE. G5.
      w.status = 'IDLE';
    }
    await this.smokeTest();      // one real settle() per wallet — readiness is a
                                 // successful tx, never a balance read (§5.5.1)
  }

  acquire() {
    const w = this.wallets.find(x => x.status === 'IDLE');
    if (!w) return null;                               // caller coalesces — §M5.6
    w.status = 'BUSY';
    return w;
  }

  release(w, { ok }) {
    if (ok) w.nextNonce++;                             // increment ONLY on success — G5
    w.status = 'IDLE';
  }

  async resync(w) {                                    // on nonce drift only, ≤1/s pool-wide
    w.status = 'DRAINING';
    w.nextNonce = await rpc.getTransactionCount(w.addr, 'pending');
    w.status = 'IDLE';
  }
}
```

**`release()` increments only on success.** A rejected transaction consumed no nonce.
Incrementing past a failure creates a gap, and gapped-transaction behaviour on Monad is
undocumented (`monad-facts.md` Unverified #2) against a chain with no global mempool
(`docs/monad_dev_resources.md:238`) — so a gap may simply never be picked up. This one
line is the difference between a pool that recovers from a 429 and a pool that wedges.

**Health loop**, every `BALANCE_POLL_MS` (5 s), one wallet per pass — 0.2 req/s, the only
read in the steady-state budget (`ARCHITECTURE.md` §4.2):

```js
if (w.balanceMon < CFG.RESERVE_FLOOR_MON) { w.status = 'RETIRED'; ui.poolDegraded(); }
if (activeWallets() < CFG.POOL_MIN_WALLETS) mode.enter('REDUCED_N');   // §8 ladder
```

### M5.4 Submission (ADR-3, FR-REL-1)

```js
async function submit(entry, wallet) {
  const tx = {
    to: CFG.CONTRACT, chainId: CFG.CHAIN_ID, nonce: wallet.nextNonce,
    gasLimit: CFG.GAS_SETTLE,                     // hardcoded. NEVER eth_estimateGas. G3/G4
    data: encode('settle', [entry.sessionId, entry.seq, entry.whDelta]),
  };
  const raw = await wallet.signer.sign(tx);

  const receipt = CFG.USE_SYNC_SEND
    ? await rpc.call('eth_sendRawTransactionSync', [raw, { timeout_ms: CFG.SEND_TIMEOUT_MS }])
    : await sendAndPoll(raw);                     // ADR-3 reversal: ALSO halve TX_BUDGET

  pool.release(wallet, { ok: receipt?.status === '0x1' });
  if (receipt?.status === '0x1') feed.publish(settledEvent(entry, receipt));  // ADR-7
  return receipt;
}
```

One RPC call per settled tick. The arithmetic for why this is mandatory rather than
merely nice is in `ARCHITECTURE.md` §11 C11.

### M5.5 Degraded-mode state machine (FR-REL-4, FR-REL-5, UC-8, AC-8)

```
                    3 consecutive 429s
      ┌──────────┐ ─────────────────────► ┌───────────────┐
      │  NORMAL  │                        │ DEGRADED_2S   │  cadence 1s → 2s
      │  1 Hz    │ ◄───────────────────── │               │
      └──────────┘   30 clean submits     └───────────────┘
            ▲                                     │ 3 more 429s
            │                                     ▼
            │                             ┌───────────────┐
            │                             │ DEGRADED_6S   │  cadence → 6s
            │                             └───────────────┘
            │                                     │ 3 more 429s
            │                                     ▼
            │                             ┌───────────────┐
            │  manual only                │  BATCHED      │  FR-REL-2, ADR-1 reversal
            └──────────────────────────── │  (Mode 2      │  nonces collapse to serial
                                          │   nonces)     │
                                          └───────────────┘
                       all sends fail 10s          │
                                ▼                  ▼
                        ┌───────────────────────────────┐
                        │  SIMULATED                    │  chain unreachable;
                        │  metering + wall keep running │  every MON figure
                        │  MON labelled `simulated`     │  labelled — NFR-R-3
                        └───────────────────────────────┘
```

**FR-REL-5** is one endpoint, and it is what makes the whole ladder honest:

```http
GET /relay/mode
 →  { mode: "DEGRADED_2S", cadenceMs: 2000, sessions: 10, poolActive: 9,
      queueDepth: 3, chainReachable: true, since: 1754661234567 }
```

M7 polls nothing — this object rides the SSE stream on every change and once per second
as a heartbeat. **The wall renders `mode` verbatim.** There is no path by which the wall
can display a mode the relay is not in, which is how NFR-R-3 ("labelled, never
disguised") is enforced mechanically rather than by discipline.

**FR-OPS-3** forces any transition manually so the ladder can be rehearsed
(`REQUIREMENTS.md:447`) — and that same control, extended to drop the SSE connection,
is FR-DASH-8's demo beat (`ARCHITECTURE.md` §11 C14).

### M5.6 Coalescing, and the rate-epoch rule

When no wallet is free, the tick is not dropped:

```js
function onNoWalletAvailable(entry) {
  const p = pending.get(entry.sessionId) ?? { whDelta: 0, rateEpoch: entry.rateEpoch };

  // ── the exception that matters (ARCHITECTURE.md §8.2) ──
  // Coalescing across a rate change would settle old energy at a new rate:
  // retroactive repricing, which FR-PR-4 forbids and UC-12 exists to prevent.
  if (p.rateEpoch !== entry.rateEpoch) {
    forceFlush(entry.sessionId, p);             // settle the old epoch at the OLD rate first
    p.whDelta = 0; p.rateEpoch = entry.rateEpoch;
  }

  p.whDelta += entry.whDelta;                   // lossless within an epoch — DR-3 holds
  pending.set(entry.sessionId, p);
}
```

Cumulative settled energy still equals cumulative metered energy, so DR-3 and FR-SET-3
hold exactly. Only the *cadence* degrades, never the *total* — which is the invariant
the whole degradation ladder is built to protect.

### M5.7 The booth interface — **WITHDRAWN**

> **The relay has no booth interface.** `REQUIREMENTS.md` §16 (`:767`) removed the crowd
> from the chain entirely, and commit `15d2117` marks the booth interface contract
> superseded. There is no `/relay/tick` from a phone, no `source: 'booth'` discriminator,
> and no `BOOTH_ONCHAIN` branch — **the flag is deleted, not defaulted off**, because
> FR-SPLIT-1 is verified by Inspection and a switch that could enable booth chain-writes
> fails that inspection by existing.
>
> FR-REL-6 ("accept booth deltas through the same interface") is satisfied vacuously:
> there are no booth deltas to accept. Booth energy lives in M10's memory and reaches the
> chain only as the single `settleRoomAggregate` at the close (PART II).

The relay's only reading source is M2. `onReading` loses its `source` parameter and its
branch:

```js
function onReading(reading) {
  if (verifyReading(reading) !== ACCEPT) return;   // §M5.2 — the trust boundary
  enqueue(reading);                                 // one path, no discriminator
}
```

**IF-8 and IF-9 move to M10** (PART II §M10.2), where the fire-and-forget and
idempotency obligations now belong — the phone talks to the game server, never to the
relay.

### M5.8 Key handling (FR-REL-7, NFR-S-5, DR-5, G9)

The relay holds its own pool keys and the simulated meter keys — the keys of simulated
devices it *is*. It holds **no participant's key**: a booth player's ephemeral key is
generated on their phone and never transmitted (FR-BOOTH-9), so DR-5 holds by
construction.

`.env` only, `.env*` gitignored, plus a CI job that greps the diff for
`0x[0-9a-f]{64}`. README states the hot-wallet exposure: ~150 MON of testnet MON, zero
mainnet value (NFR-S-5).

### M5.9 Errors and dependency failure

| Condition | Behaviour | Requirement |
|---|---|---|
| 429 | Advance the cadence ladder; never drop a session silently | FR-REL-4 |
| Timeout on the sync call | Retry once on a **different** wallet, then coalesce forward | §8 |
| Nonce drift | `resync()` that wallet, ≤1/s pool-wide | FR-REL-3 |
| Pool exhausted | Coalesce (§M5.6); raise `queueDepth` on the wall | §8 |
| Chain unreachable 10 s | Enter `SIMULATED`; keep metering and the wall alive | NFR-R-2, NFR-R-3 |
| **M7 disconnects** | Keep settling. The wall is a consumer, never a dependency | NFR-R-2 |

---

## M6 — Simulator & Spawner ▶ FREEZE SLICE

**Responsibility.** Create and retire N concurrent vehicle/station pairs with a mix of
directions and independent curves, without ever exceeding the settlement budget.

**Requirements.** FR-SIM-1, FR-SIM-2, FR-SIM-3, FR-SIM-6 (all `M`); FR-SIM-4, FR-SIM-5
(`S`). UC-5, UC-10. IF-11. FR-OPS-2. NFR-P-2.

**File.** `relay/m6-spawner.mjs`.

### M6.1 Session lifecycle

```
   IDLE ──spawn()──► OPENING ──openSession() ok──► ACTIVE ──┐
                        │                            │      │ ticks at cadence
                        │ revert                     │      │ (M2 → M5)
                        ▼                            │      │
                     FAILED                          │◄─────┘
                    (logged,                         │
                     pool slot                       │ no reading for SESSION_IDLE_MS (5 s)
                     released)                       │ or explicit stop
                                                     ▼
                                                  CLOSING ──closeSession()──► CLOSED
                                                                              (FR-SET-4/5)
```

### M6.2 Drawing from the pre-registered pool (FR-SIM-6)

```js
// 60 identity triples (vehicle, station, meter) registered BEFORE code freeze,
// during setup. UC-11 bootstrapping note, REQUIREMENTS.md:315.
const pool = loadIdentityPool();   // [{ vehicleId, stationId, meterId, meterKey }, …]

function spawn(direction) {
  const id = pool.take();                                  // NEVER registerIdentity() here
  if (!id) return null;                                    // pool exhausted → refuse, log
  const params = randomCurveParams();                      // FR-SIM-3, independent per session
  return openSession(id, direction, params);
}
```

**Registering identities live during spin-up is forbidden** (`REQUIREMENTS.md:315`):
sixty registration transactions at the moment the operator hits "spin up" would consume
RPC headroom precisely when the demo needs it. The pool is registered at T-2h40
(`ARCHITECTURE.md` §5.5.1) and `spawn()` only draws from it.

### M6.3 Staggered starts (FR-SIM-5)

```js
async function spinUp(n) {                                 // FR-SIM-1, IF-11
  for (let i = 0; i < n; i++) {
    spawn(i % 3 === 0 ? 'DISCHARGE' : 'CHARGE');           // FR-SIM-2: ~1/3 V2G, concurrent
    await sleep(1000 / CFG.RAMP_MAX_PER_SEC);              // 2/s — no self-inflicted spike
  }
}
```

Ten sessions take five seconds to come up. **That is a feature, not a delay:** the wall's
idle→live transition (FR-DASH-10) becomes visible as a ramp rather than a jump, and the
opening beat `idea.md:96` describes — "watching the dashboard go from idle to live" —
needs something to watch.

The one-in-three discharge mix satisfies FR-SIM-2 (both directions concurrently) and
gives FR-DASH-4's split bar two populations to compare from the first second.

### M6.4 The substitution control law (UC-10, FR-OPS-2)

Implements `ARCHITECTURE.md` §9.2. Reproduced here because this module owns it.

```js
setInterval(() => {
  const nBooth = boothSessions.countActive();              // lastSeen < 5s
  let target = Math.max(0, CFG.TX_BUDGET_PER_SEC - Math.ceil(nBooth / 6));
  target = Math.min(target, CFG.N_SIM_MAX);

  const delta = target - simSessions.count();
  const step  = Math.min(Math.abs(delta), CFG.RAMP_MAX_PER_SEC);

  if (delta < 0) closeOldest(step);                        // audience displaces simulated
  else if (delta > 0) spawnStaggered(step);

  if (nBooth > CFG.N_BOOTH_MAX) {
    queueExcess();                                          // UC-10 alt 3a: cap and LABEL
    feed.publish({ notice: `${nBooth - CFG.N_BOOTH_MAX} PLAYERS QUEUED` });
    // NEVER spawn simulated sessions to compensate for missing audience
  }
}, 1000);
```

**Six booth players displace one simulated session** because a booth session at 6 s
consumes 1/6 of what a simulated session at 1 Hz consumes. The budget stays flat at
10 tx/s from zero phones to sixty (`ARCHITECTURE.md` §9.1), which is what makes UC-10's
peak safe.

### M6.5 Rehearsed and stress N (FR-SIM-4)

| Profile | N | Cadence | tx/s | Use |
|---|---|---|---|---|
| `rehearsed` | 10 | 1 Hz | 10 | **The live demo.** AC-5's bar with 4× RPC headroom |
| ~~`room`~~ | ~~60 booth @ 6 s~~ | — | **0** | **Withdrawn.** Booth consumes no chain capacity (FR-SPLIT-1). Crowd size no longer appears in any throughput profile |
| `stress` | 25 | 1 Hz | 25 | **Recording only.** Past the 4× margin; never live (`ARCHITECTURE.md` §4.3) |

`stress` exists so FR-SIM-4 is satisfiable and so a higher number can be shown to have
been tested. It is labelled recording-only in the config, not left to the operator's
memory at 17:55.

### M6.6 Errors and dependency failure

| Condition | Behaviour |
|---|---|
| `openSession` reverts | Mark `FAILED`, return the identity to the pool, log, continue with the rest |
| Identity pool exhausted | Refuse further spawns; publish `POOL EXHAUSTED` to the wall. Never register live |
| Relay in `SIMULATED` | Keep spawning and ticking. The curves run; the MON figures are labelled |
| Operator requests N > `N_SIM_MAX` | Clamp to the max and **state the clamp on the wall** (NFR-R-3), never silently |

---

## M7 — Operations Dashboard (the wall) ▶ FREEZE SLICE

**Responsibility.** Make an invisible machine-to-machine process legible to a room from
ten metres, and never misrepresent what it is showing.

**Requirements.** FR-DASH-1..6, FR-DASH-8, FR-DASH-10 (all `M`); FR-DASH-7, FR-DASH-9
(`S`). IF-6, IF-7. NFR-P-3, NFR-P-4, NFR-U-1, NFR-U-2, NFR-R-3. UC-6. AC-6.

**Files.** `wall/index.html`, `wall/wall.mjs`, `wall/wall.css`.

### M7.1 Layout — 1920×1080, read from 10 metres

```
┌────────────────────────────────────────────────────────────────────────────┐
│ PLUG-N-PAY          ● LIVE · ON-CHAIN          MONAD TESTNET 10143         │ 72px
├───────────────────────────────┬────────────────────────────────────────────┤
│                               │                                            │
│   SETTLEMENTS      TOTAL MON  │   ○ ○ ○ ○ ○ ○ ○ ○ ○ ○                      │
│      1,284          3.4471    │   ○ ● ○ ○ ○ ◉ ○ ○ ○ ○   ← ③ node grid      │
│   ▲ 144px numerals            │   ○ ○ ○ ◉ ○ ○ ○ ● ○ ○      pulse on settle │
│   ② running counters          │   ○ ○ ○ ○ ○ ○ ○ ○ ○ ○      (FR-DASH-3)     │
│      (FR-DASH-2)              │   ● charge   ◉ V2G                         │
├───────────────────────────────┴────────────────────────────────────────────┤
│ ① 0x8a2…→ Station #4  ·  0.0021 MON  ·  CHARGE   ·  0x7f3c…  ON-CHAIN  ↗   │
│   Station #7→0xC91…   ·  0.0089 MON  ·  V2G      ·  0x2b91…  ON-CHAIN  ↗   │ 40px
│   0x4d1…→ Station #2  ·  0.0017 MON  ·  CHARGE   ·  0x9e07…  ON-CHAIN  ↗   │ rows
│   ← scrolling settlement feed, newest at top (FR-DASH-1)                   │
├────────────────────────────────────────────────────────────────────────────┤
│ ④ CHARGE ███████████████████████████░░░░░░░░░ V2G      68% / 32%           │ 96px
│   split bar (FR-DASH-4) — colour, not text (NFR-U-2)                       │
└────────────────────────────────────────────────────────────────────────────┘
```

The four required elements of AC-6 and UC-6 are ①②③④. Nothing else is on the screen at
freeze.

**Type scale for 10 m (NFR-U-1, FR-DASH-5).** The rule of thumb is ~1 cm of cap height
per 3 m of viewing distance; at 10 m that is ~3.3 cm, which on a 2 m-wide projected
1920 px image is ≈ 32 px minimum. Everything is set well above it — feed rows at 40 px,
counters at 144 px. **This is an estimate, not a measured figure — verify by standing at
the back of the room during W6** (`ARCHITECTURE.md` §12.2).

**Colour carries direction, so NFR-U-2 works without reading.** Charge is Monad primary
purple `#6E54FF`, published on the brand kit
(https://www.monad.xyz/brand-and-media-kit, fetched 2026-08-08). V2G is `#FFAE45`
(orange, same palette, same fetch) — maximally distinct from purple at distance.
`#836EF9` is ecosystem convention and does not appear on the current brand page; the
published value is used.

### M7.2 The provenance rule — FR-DASH-6 and IF-7

**Every rendered figure carries its origin, and the origin is derived, never
configured:**

```js
const provenance = ev.txHash ? 'ON-CHAIN' : 'SIMULATED';   // IF-7, FR-DASH-6
```

A settlement event is labelled `ON-CHAIN` **if and only if** it carries a transaction
hash from a receipt. There is no flag an operator could set wrongly and no default that
could lie. Three consequences:

- Booth activity never reaches the wall's settlement feed at all — it lives on the M10
  leaderboard, labelled `SIMULATION — same engine, nothing on-chain` (FR-SPLIT-5).
- In the relay's `SIMULATED` mode nothing carries a hash, so the whole wall flips
  without a code path dedicated to that transition.
- **FR-DASH-9** is free: the hash that proves provenance is also the explorer link.

```js
// FR-DASH-9 — testnet explorers, docs/monad_dev_resources.md:117-118
const EXPLORER = 'https://testnet.monadvision.com/tx/';   // or testnet.monadscan.com
```
No single explorer is canonical in the docs
(`2026-08-08-booth-frontend-design.md:38`); MonadVision is used and the choice is
one constant.

**The clickable hash is FR-REL-1's demo beat** (`ARCHITECTURE.md` §11 C14): one row, one
transaction, one hash — a judge clicking any row verifies the per-tick architecture
without the presenter saying a word.

### M7.3 Transport and reconnection (FR-DASH-8, IF-6, FD-3)

```js
const es = new EventSource(`${RELAY}/feed`);      // SSE — ADR-5. Native auto-reconnect.

es.addEventListener('settled',  e => onSettled(JSON.parse(e.data)));
es.addEventListener('mode',     e => renderMode(JSON.parse(e.data)));   // FR-REL-5
es.addEventListener('heartbeat', () => lastBeat = Date.now());

// FR-DASH-8: NEVER a frozen-but-live-looking state.
setInterval(() => {
  if (Date.now() - lastBeat > 3000) {
    setBanner('SIMULATED · RELAY UNREACHABLE');   // NFR-R-3 — labelled, never disguised
    startLocalSimulation();                        // booth ladder L2 (§8.3)
  }
}, 1000);
```

`EventSource` reconnects on its own, so FR-DASH-8's "must not require a page reload" is
satisfied by the platform. **The three-second heartbeat check is the part that has to be
written**, and it is the requirement's actual intent — resilience against venue wifi
drops (`REQUIREMENTS.md:412`). Without it the page would sit on stale data looking alive,
which is the exact failure UC-8 forbids.

### M7.4 Idle → live (FR-DASH-10)

```
  IDLE                          →  ARMING           →  LIVE
  ─────────────────────────────    ──────────────      ─────────────────────────
  Logo, "SPIN UP NETWORK"          Grid fades in       Nodes pulse, feed scrolls,
  Counters at 0, grid empty        one node at a       counters climb
  Dimmed, obviously waiting        time as sessions
                                   open (2/s, §M6.3)
```

The transition must be **visible** — it is the opening beat (`idea.md:96`). M6's 2/s ramp
gives it five seconds of visible fill rather than an instant jump.

### M7.5 Rendering 60 nodes (FR-DASH-7, NFR-P-4)

| Concern | Approach |
|---|---|
| 60+ nodes | One `<canvas>`, one `requestAnimationFrame` loop. Not 60 DOM nodes with CSS transitions |
| Pulse animation | Per-node decay value, `p *= 0.92` per frame. No timers, no allocation |
| Feed rows | Ring buffer of 40 rows; recycle DOM nodes rather than create and destroy |
| Counters | Update the text once per frame at most, never per event |
| Backpressure | If events arrive faster than frames, **coalesce into the frame** — never queue frames behind events |

At 10 tx/s and 60 fps there are six frames per settlement, so the loop is far from
saturated. The canvas choice is insurance against the `stress` profile and against a
projector running at a lower refresh rate than the laptop.

### M7.6 Errors and dependency failure

| Condition | Wall behaviour |
|---|---|
| SSE drops | Auto-reconnect; after 3 s show `SIMULATED · RELAY UNREACHABLE` and run local nodes |
| Relay in `DEGRADED_*` | Mode chip with the cadence, verbatim from `/relay/mode`. **Cyan is the only accent** — degradation reads as a dimmed/outlined chip against the near-black ground, not as a second hue (palette, PART II) |
| Relay in `SIMULATED` | Full-width banner; every MON figure labelled |
| A settlement is refused | Red row in the feed with the reason (UC-7 / FR-OPS-7 evidence) |
| Explorer unreachable | Row still renders; only the link is dead |

---

## M8 — Booth App *(not in the freeze slice)*

**Full design: `docs/specs/2026-08-08-booth-frontend-design.md` (626 lines).** It is not
restated here. This section specifies only the relay-facing contract and the
consequences of FD-1/ADR-6.

**Requirements.** FR-BOOTH-5, 6, 7, 8, 12, 13, 14, 15, 16 (`M` — conditional constraints
that bind *if* the module ships); FR-BOOTH-1, 2, 3, 4, 9, 10, 11 (`S`). IF-8, IF-9,
IF-10. NFR-P-5, NFR-P-6, NFR-U-3, NFR-U-4, NFR-S-6. UC-9, UC-10.

**⚠ The coverage ledger predates FR-BOOTH-14/15/16** (`ARCHITECTURE.md` §0). All three
are covered here.

### M8.1 The relay-facing contract

The booth backend calls the relay through **the same interface simulated sessions use**
(FR-REL-6). Booth-internal endpoints (`/api/session`, `/api/tick`, `/api/wall`,
`/api/leaderboard`, `/api/surge`) are the booth spec's own
(`2026-08-08-booth-frontend-design.md:390-426`) and are unchanged.

```http
POST /relay/session          # once per player, during the join window (FR-BOOTH-16)
  →  { deviceId, ephemeralPubKey, carId }
  ←  { sessionId, meterId, startAt, serverNow, priceMonPerKwh, v2gMonPerKwh }
     # the relay registers ephemeralPubKey as a METER identity (FR-BOOTH-9, UC-11)

POST /relay/tick             # every 6 s, phase-staggered (FR-BOOTH-15)
  →  { sessionId, seq, timestampMs, kW, whDelta, meterId, signature }
  ←  204 always              # IF-8 fire-and-forget; FR-BOOTH-2 never an error
     # idempotent on (sessionId, seq) — IF-9, DR-2
```

**The payload is byte-identical to a simulated `Reading`** (§M2.2). That identity is
what FR-REL-6 means by "the same interface", and it is why UC-9's postcondition holds:
audience activity is indistinguishable on the wall from simulated activity because it is
the same kind of activity (`REQUIREMENTS.md:294`).

### M8.2 Cadence and phase-staggering (FR-BOOTH-15)

```js
const offset = (playerIndex * 6000) / nPlayers;      // FR-BOOTH-15, REQUIREMENTS.md:438
setTimeout(() => setInterval(sendTick, 6000), offset);
```

Sixty players at 6 s is 10 tx/s **spread evenly**. Unstaggered, the identical load
arrives as a 60-transaction spike every six seconds — 60 tx/s instantaneous, six times
the budget and past the measured knee. The stagger is the entire difference between
fitting and not.

**FR-BOOTH-16** removes the other burst: opens complete during the join window before the
round starts, and the final settlement doubles as the close, so there are no 60 closes at
the end (`ARCHITECTURE.md` §9.3).

### M8.3 The FD-1 consequence

**Superseded by `REQUIREMENTS.md` §16 — see PART II.** The table below described a
runtime switch that no longer exists. Current behaviour:

| | Behaviour |
|---|---|
| Phone | Talks to **M10 the game server**, never to the relay. Zero chain calls, no key material (FR-SPLIT-1) |
| Relay | Has no booth interface (§M5.7 withdrawn) |
| Wall | Shows the **rail only** — ~10 simulated sessions, labelled `LIVE — Monad testnet` + contract address (FR-SPLIT-5) |
| RPC cost | **Zero**, structurally rather than by configuration |
| The switch | **Deleted.** FR-SPLIT-1 is inspected, and a switch that could enable booth chain-writes fails inspection by existing |

**"The phone never touches the chain"** (`2026-08-08-booth-frontend-design.md:443`) stays
true in both configurations. What is **superseded** in that same line is the single-hot-
wallet design — settlement submits from a pool of ten (FR-REL-8,
`ARCHITECTURE.md` §11 C7). Per FD-5, annotate, do not rewrite.

### M8.4 Superseded items in the booth spec (FD-5)

Recorded here; the booth document is annotated, not edited.

| Line | Says | Status |
|---|---|---|
| `:443` | "one batched transaction per second from a single funded hot wallet" | **Superseded** by FR-REL-8 and the per-tick decision. Pool of 10, one tx per session per tick |
| `:45`, `:386` | "SSE is dead, the wall polls" | **Scoped, not wrong.** True for the Vercel hop; the relay→wall hop uses SSE (FD-3, ADR-5) |
| `:600` | "sixty payment streams settling **per second**" | **Factually wrong by 6×** at FR-BOOTH-15's 6 s cadence. Replacement line in `ARCHITECTURE.md` §4.3 |
| `:613` | reward "unresolved, §7 recommends unconditional" | **Stale and backwards.** Decided conditional 20% at `:346`; `REQUIREMENTS.md:662` corroborates |
| `:39` | RPC limit "Undocumented" | **Superseded.** Published at 50 rps, measured at 40–45 (`ARCHITECTURE.md` §11 C1) |

### M8.5 Requirements this module carries that are not about the relay

Listed so none is lost, with its home in the booth spec. All are `I` or `D` verification.

| ID | Obligation | Home |
|---|---|---|
| FR-BOOTH-5 / NFR-S-6 | Collect no credential, key or payment detail | booth §7 claiming, `:376` |
| FR-BOOTH-6 | Reward by skill, never a random attribute | booth §6 |
| FR-BOOTH-7 | Terms stated before play | booth §7 terms panel, `:352` |
| FR-BOOTH-8 | Never solicit votes; state the placement dependency as fact | booth `:354` |
| FR-BOOTH-12 | Standings reviewed before publication, revealed after the event | booth §3.8 |
| FR-BOOTH-13 | Effective tap rate capped at **30/s** (was 20/s — see §M10.3) | booth §6 |
| FR-BOOTH-14 | Accept 5 pointers; say so in the instructions | booth §3.5 |
| FR-BOOTH-10 | Public leaderboard, legible across a busy room, updating ≥ every 5 s | booth §3.8 |
| FR-BOOTH-11 | Public screen seals 10 s before close — an unambiguous sealed state, not a freeze, so a stale screen cannot read as live | booth §3.8 |
| NFR-U-4 | Respect `prefers-reduced-motion` | booth §11 |

---

## M9 — Demo Control & Observability ▶ FREEZE SLICE

**Responsibility.** Give the operator deterministic controls that work under stage
pressure, and make the system's honesty demonstrable on demand.

**Requirements.** FR-OPS-1, FR-OPS-4, FR-OPS-5 (all `M`); FR-OPS-2, FR-OPS-3, FR-OPS-6,
FR-OPS-7 (`S`). IF-12. AC-7, AC-8, AC-10. NFR-R-4. A7.

**⚠ M9 was omitted from §11's freeze list; that omission is a defect** — FR-OPS-1 is the
demo's opening action (`idea.md:96`) and FR-OPS-5 is a `MUST` by freeze. See
`ARCHITECTURE.md` §11 C13.

**Files.** `relay/m9-control.mjs`, `ops/index.html`, `ops/ops.mjs`.

### M9.1 The operator surface

Large touch targets, no text input during the pitch (IF-12,
`REQUIREMENTS.md:511`). Every control is one press.

```
┌─────────────────────── PLUG-N-PAY · OPS ───────────────────────┐
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │            ▶  S P I N   U P   N E T W O R K             │   │  FR-OPS-1
│   └─────────────────────────────────────────────────────────┘   │  the opening beat
│                                                                 │
│   ┌──────────────────┐  ┌──────────────────┐                    │
│   │  ⚡ ROOM SURGE    │  │  ⛰ TRIGGER PEAK  │                    │  FR-OPS-2 / FR-PR-3
│   └──────────────────┘  └──────────────────┘                    │
│                                                                 │
│   ┌──────────────────┐  ┌──────────────────┐                    │
│   │  ⚠ FORCE DEGRADE │  │  ✂ DROP FEED     │                    │  FR-OPS-3 / FR-DASH-8
│   └──────────────────┘  └──────────────────┘                    │
│                                                                 │
│   ── PROVE IT (FR-OPS-7) ─────────────────────────────────────  │
│   ┌──────────────────┐  ┌──────────────────┐                    │
│   │  ✗ BAD SIGNATURE │  │  ⟲ REPLAY        │                    │  AC-7 / UC-7
│   └──────────────────┘  └──────────────────┘                    │
│                                                                 │
│   mode DEGRADED_2S · pool 9/10 · queue 3 · sessions 10          │
└─────────────────────────────────────────────────────────────────┘
```

### M9.2 Controls

| Control | Requirement | Effect |
|---|---|---|
| **SPIN UP NETWORK** | FR-OPS-1, UC-5, IF-11 | `spinUp(N_SIM_MAX)` — staggered at 2/s (§M6.3). One press, deterministic, no parameters typed |
| **ROOM SURGE** | FR-OPS-2, UC-10 | Schedules a surge ~2 s ahead against server time; simulated sessions ramp down under the §M6.4 control law. **The ramp-down is part of this button, not a separate action** |
| **TRIGGER PEAK** | FR-PR-3 | Advances past `T_peak_start`; the V2G rate visibly jumps (§M3.3) |
| **FORCE DEGRADE** | FR-OPS-3, AC-8 | Forces the next rung of the §M5.5 ladder so it can be rehearsed |
| **DROP FEED** | FR-DASH-8 | Kills the SSE connection. The wall shows `RECONNECTING` and recovers without a reload — FR-DASH-8's demo beat (`ARCHITECTURE.md` §11 C14) |
| **BAD SIGNATURE** | FR-OPS-7, AC-7 | §M9.3 |
| **REPLAY** | FR-OPS-7, AC-7 | §M9.3 |

### M9.3 The two injectors (FR-OPS-7, UC-7, AC-7)

AC-7 is verified by **Demonstration** deliberately: no adversarial harness is
realistically buildable today, and claiming one would be a verification method nobody
can run (`REQUIREMENTS.md:603`).

```js
// ── ✗ BAD SIGNATURE — proves the RELAY-side check (IF-1, TB-1) ──
function injectBadSignature() {
  const s = pickActiveSession();
  const r = { ...nextReading(s), signature: '0x' + 'de'.repeat(65) };  // garbage
  const verdict = relay.verifyReading(r);                               // → REJECT
  feed.publish({ refused: true, sessionId: s.id, reason: 'BAD SIGNATURE' });
  // NO TRANSACTION IS EVER BUILT. That is the point.
}

// ── ⟲ REPLAY — proves the CONTRACT-side guard (FR-SET-9, DR-2) ──
async function injectReplay() {
  const s = pickActiveSession();
  const r = lastSettledReading(s);                       // a genuinely valid, already-used one
  const receipt = await relay.submitBypassingSeenSet(r); // skip layers 1–2 ON PURPOSE
  feed.publish({ refused: true, sessionId: s.id, reason: 'ALREADY SETTLED',
                 txHash: receipt.transactionHash });     // status 0x0 — ON-CHAIN evidence
}
```

**The second is the stronger demo.** The first proves the relay behaves. The second
proves **the contract does not depend on the relay behaving** — it produces a real
transaction hash a judge can click and read a revert on a public explorer. Given that
`ARCHITECTURE.md` §3 openly concedes the relay is trusted for signature validity,
showing what the contract enforces *anyway* is the strongest three seconds available.

Both publish a red row to the wall (§M7.6), so UC-7 is visible rather than narrated.

### M9.4 Zero-phone operation (FR-OPS-4, RSK-3)

Every control above works with no phones connected. The `n_booth = 0` case is the
**nominal** path through §M6.4, not a fallback: the loop settles at ten simulated
sessions and the full beat runs (UC-10 alt 2a). ROOM SURGE with zero phones still fires
the wall's surge visual driven by simulated load, so the presenter's script does not
change (`2026-08-08-booth-frontend-design.md:604`).

**This is rehearsed, not assumed** — W6 runs the beat once with phones and once without
(`ARCHITECTURE.md` §12.2).

### M9.5 Logging (FR-OPS-6)

One JSONL file, append-only, enough to answer "did that settlement really land on chain"
after the fact (`REQUIREMENTS.md:450`):

```jsonl
{"t":1754661234567,"ev":"settled","sessionId":"0x…","seq":142,"whDelta":31,
 "monDelta":"3720000000000","txHash":"0x7f3c…","block":12345678,"wallet":"0xA1…","mode":"NORMAL"}
{"t":1754661234901,"ev":"refused","sessionId":"0x…","seq":142,"reason":"ALREADY_SETTLED",
 "txHash":"0x2b91…","status":0}
```

`txHash` + `blockNumber` on every settled row is the whole requirement: any line can be
checked against the explorer months later.

### M9.6 The recorded fallback (FR-OPS-5, NFR-R-4, AC-10) — 🔴 hard gate

**Must exist before code freeze.** A `MUST` three times over, and the item most likely to
be sacrificed to a build that is nearly finished.

| ☐ | Item |
|---|---|
| ☐ | Full 3-minute beat at N=10, screen-recorded at 1920×1080, **audio included** |
| ☐ | Shows: idle→live, feed scrolling, counters climbing, node pulses, the charge/V2G split |
| ☐ | Shows both injectors firing and being refused (AC-7) |
| ☐ | Shows one forced degradation and recovery (AC-8) |
| ☐ | Stored **locally on the presenting laptop**, not in cloud storage the venue wifi has to reach |
| ☐ | Playable full-screen with one keypress, no application switching |
| ☐ | **If played on stage, captioned `RECORDED` on screen** — NFR-R-3, never disguised |

**Scheduled 17:20–17:40, and it starts at 17:20 whatever the state of the build**
(`ARCHITECTURE.md` §12.3). A recording of a partial system beats no recording of a
complete one.

---

## 10. Data model

`REQUIREMENTS.md` §6 (`:457-464`), with types and on-chain/off-chain placement.

### 10.1 Entities

| Entity | Field | Type | On-chain | Off-chain | Notes |
|---|---|---|---|---|---|
| **Identity** | `id` | `bytes32` (keccak of the id string) | ✅ key | ✅ | UC-11 |
| | `role` | `enum Role` uint8 | ✅ | ✅ | vehicle \| station \| meter \| aggregator |
| | `pubKey` | `bytes32` | ✅ | ✅ | Verification key for readings |
| | `wallet` | `address` | ✅ | ✅ | **One wallet per identity** (FR-ID-3) |
| | `active` | `bool` | ✅ | — | Packed with `wallet` (§M1.4) |
| **Session** | `sessionId` | `bytes32` | ✅ key | ✅ | |
| | `payer`, `payee` | `address` | ✅ | ✅ | Immutable after open (FR-SET-1) |
| | `direction` | uint8 | ✅ | ✅ | `CHARGE=0`, `DISCHARGE=1` |
| | `priceMonPerKwh` | — | **resolved via `rateAt`** | mirror | Not stored per session — see §10.3 |
| | `startedAt`, `closedAt` | `uint64` s | ✅ | ✅ ms | Chain seconds; relay ms (DR-4) |
| | `status` | uint8 | ✅ | ✅ | `OPEN=1`, `CLOSED=2` |
| | `funded` | `uint128` | ✅ | — | FR-SET-8 guard |
| | `cumWh`, `cumMon` | `int128`, `int256` | ✅ | ✅ | Signed; FR-SET-10, DR-3 |
| **Reading** | `sessionId`, `seq` | `bytes32`, `uint32` | ⚠ `seq` only, in `settled` | ✅ | IF-2 |
| | `timestampMs` | `uint64` | ❌ | ✅ | Advisory (DR-4); chain time settles |
| | `kW` | `int32` | ❌ | ✅ | Display and curve only |
| | `whDelta` | `int256` | ✅ **as a call argument** | ✅ | Signed (IF-3, FR-MET-6) |
| | `meterId` | `bytes32` | ❌ | ✅ | Verified off-chain (ASM-6, IF-1) |
| | `signature` | `bytes` (65) | ❌ | ✅ | **Never reaches the chain** — the boundary |
| **Settlement** | `sessionId`, `seq` | | ✅ | ✅ | |
| | `whDelta`, `monDelta` | `int256` | ✅ event | ✅ | `monDelta` computed on-chain (IF-4) |
| | `direction` | uint8 | ✅ event | ✅ | |
| | `txHash`, `blockNumber` | | — receipt | ✅ | **Provenance** (FR-DASH-6, IF-7, FR-DASH-9) |
| **Rate** | `context` | `enum Ctx` | ✅ | mirror | charge \| v2g (FR-PR-2) |
| | `monPerKwh` | `uint128` 18-dec | ✅ | mirror | |
| | `effectiveFrom` | `uint64` s | ✅ | mirror | **FR-PR-4** (§M3.1) |
| **NetworkSnapshot** | all fields | | ❌ | ✅ derived | M7 render state, never persisted |

### 10.2 Why the signature never reaches the chain

It is the single most important row in the table. The `Reading.signature` is verified in
the relay and discarded (ASM-6, IF-1). The chain receives `whDelta` alone. **That is the
trust boundary in one line of a data model**, and `ARCHITECTURE.md` §3.2 states exactly
what it costs.

### 10.3 Why `Session` stores no price

`REQUIREMENTS.md:460` lists `priceMonPerKwh` on the Session entity. Storing it would
freeze the rate at open and make FR-PR-4's mid-session rate change impossible — UC-12
would have no mechanism.

Instead the rate is resolved per settlement via `rateAt(ctx, block.timestamp)` (§M3.1),
and `SessionOpened` emits `rateAtOpen` for display and audit. The Session **entity** is
fully represented; the price is a function of `(ctx, time)` rather than a stored field.
**This is a deliberate deviation from §6's literal field list, made to satisfy FR-PR-4,
and it is flagged rather than silent.**

### 10.4 Integrity rules DR-1..5 — where each is enforced

| ID | Rule | Enforced where | How |
|---|---|---|---|
| **DR-1** | A Settlement references exactly one validated Reading, or one batch of them | **Relay** (§M5.2) + **contract** (§M4.4) | Every `settle()` originates from exactly one `verifyReading` ACCEPT. `settleBatch` maps 1:1 over entries (§M4.6). Coalescing (§M5.6) merges *readings before settlement*, producing one settlement per submitted delta — the invariant is one settlement per submission, and the audit trail keeps the merged `seq` list |
| **DR-2** | `(sessionId, seq)` is unique; replays rejected | **Three places** (§M2.4): relay `lastSeq`, relay seen-set, on-chain `settled[][]` | The on-chain layer is independent of the relay, which is what makes FR-OPS-7's replay injector meaningful |
| **DR-3** | Σ `monDelta` = Σ `whDelta` × applicable rate | **Contract**, by construction (§M4.4) | `monDelta` is *computed* from `whDelta × rateAt(...)`, so the two can never diverge. `cumWh` and `cumMon` accumulate in the same transaction. Coalescing preserves it because it sums `whDelta` within one rate epoch (§M5.6) |
| **DR-4** | UTC ms; client times advisory, server/chain time authoritative | **Contract** (§M3.2) + relay | `rateAt` uses `block.timestamp`. `Reading.timestampMs` is display and ordering only, and never selects a rate |
| **DR-5** | No entity stores another party's private key | **By construction** (§M5.8) | Booth keys are generated on the phone and never transmitted (FR-BOOTH-9). The relay holds its own pool keys and the simulated meters' keys — devices it *is* (FR-REL-7) |

**DR-1 deserves the extra sentence it gets above** because coalescing looks like it
violates it. It does not: coalescing merges *readings* into one pending delta before any
settlement exists, so the settlement that results still references exactly the set of
validated readings that produced it, and the log records the merged `seq` list
(§M9.5).

---

## 11. Requirements with no use case — where each now lives

`ARCHITECTURE.md` §11 C14 promised this table. §9's traceability names two uncovered
requirements; the ledger's diff finds 33. Each is assigned a module section and a
verification method here, so none can be lost by omission.

**The two `M`-priority ones got demo beats** (`ARCHITECTURE.md` §11 C14): FR-REL-1 via
the clickable per-row `txHash` (§M7.2), FR-DASH-8 via the DROP FEED control (§M9.2).

| ID | Pri | Home in this document | Ver |
|---|---|---|---|
| FR-REL-1 | M | §M5.4 · demo beat §M7.2 | D |
| FR-DASH-8 | M | §M7.3 · demo beat §M9.2 | A |
| FR-SET-8 | M | §M4.4 funded guard | T |
| FR-REL-3 | M | §M5.3 nonce ledger | T |
| FR-REL-7 | M | §M5.8 | I |
| FR-REL-8 | M | §M5.3 | T |
| FR-REL-9 | M | DONE — `REQUIREMENTS.md:702`; successor in `ARCHITECTURE.md` §12.1 | T |
| FR-SIM-6 | M | §M6.2 | I |
| FR-MET-4 | M | §M2.1 | D |
| FR-MET-5 | M | §M2.3 (set by construction) | I |
| FR-OPS-1 | M | §M9.2 | D |
| FR-OPS-5 | M | §M9.6 · 🔴 hard gate | I |
| FR-BOOTH-5, 6, 7, 8, 12, 13 | M | §M8.5 | I / T |
| FR-BOOTH-14, 15, 16 | M | §M8.2 · **absent from the ledger** | D / T |
| FR-SET-10 | S | §M4.3 (`Settled` carries `cumWh`/`cumMon`) | I |
| FR-DASH-7 | S | §M7.5 | T |
| FR-DASH-9 | S | §M7.2 (free — same hash as provenance) | D |
| FR-SIM-4 | S | §M6.5 | D |
| FR-SIM-5 | S | §M6.3 | I |
| FR-OPS-3 | S | §M9.2 FORCE DEGRADE | D |
| FR-OPS-6 | S | §M9.5 | I |
| FR-OPS-7 | S | §M9.3 both injectors | D |
| FR-BOOTH-9, 10, 11 | S | §M8.1, §M8.5 | D |
| FR-ID-7 | C | Not today — `REQUIREMENTS.md:623`. OD-2 closed (`ARCHITECTURE.md` §11 C12) | I |
| FR-MET-8 | C | Not today. Interface boundary preserved — §2.1 reversal note | A |
| FR-PR-5 | C | Not today. `Rate[]` is already the oracle's write shape — §M3.4 | I |
| FR-SET-11 | W | Not today. Production path — §M4.8 | — |

---

## 12. Build sequence for this design

Mirrors `ARCHITECTURE.md` §12.2. Each task ends in something testable.

| Wave | Module | Deliverable | Test that closes it |
|---|---|---|---|
| **W0** | tools | `probe-write.mjs`, `fund-pool.mjs` | Sync method works; write tx/s known; Regime B answered; pool ≥100 MON |
| **W1** | M4 + M3 | `PlugNPay.sol` deployed and verified | `settle()` moves value both directions; duplicate `seq` reverts; `rateAt` returns the old rate for an old timestamp |
| **W2** | M2 + M1 | Signed readings on a real curve | Signature verifies; replay rejected; `whDelta < 0` on discharge; handshake refuses an unregistered party |
| **W3** | M5 | Relay settling 10 tx/s | 10 concurrent sessions for 60 s, zero nonce collisions, mode endpoint reports `NORMAL` |
| **W4** | M7 | Wall rendering live | Feed scrolls, counters climb, nodes pulse, split moves; kill the relay → `SIMULATED` banner within 3 s |
| **W5** | M6 + M9 | Spawner + controls | One press spins up 10 staggered sessions; both injectors visibly refused |
| **W6** | all | Integration | Full beat twice — once with phones, once without (FR-OPS-4) |
| **W7** | — | 🔴 Recording | The file exists and plays full-screen offline |

**W1 also produces the measured gas limits** that replace the `(guess)` values in §0.2.
Until it does, every MON figure in `ARCHITECTURE.md` §5.4 rests on the 150,000-gas
assumption, which is labelled a guess in both documents and in `monad-facts.md` Q6.

---

# PART II — the booth/chain split

`REQUIREMENTS.md` grew to 824 lines after M1–M9 above were written. Its new §16
(`:767`) changes M8 fundamentally and adds a module. Recorded here as supersession rather
than a silent rewrite.

**Reasoning, budgets and the decision history are in `ARCHITECTURE.md` §16–17 and are not
repeated.** This part carries only the module-level consequences.

## M8 — Booth App · **SUPERSEDED BY THE SPLIT**

> **§M8.1's `/relay/session` and `/relay/tick` contract is withdrawn.** Commit `15d2117`
> marks it superseded. `CFG.BOOTH_ONCHAIN` is deleted, not defaulted — there is no branch
> to switch. FR-BOOTH-15 and FR-BOOTH-16 are **withdrawn** (`REQUIREMENTS.md:438-439`),
> so §M8.2's phase-stagger arithmetic solves a problem that no longer exists.

**What M8 is now:** a phone client that runs the settlement engine **in memory** against
the M10 game server, makes **zero chain calls**, and holds **no key material**.
FR-BOOTH-9's ephemeral key is withdrawn with the rest — there is nothing to sign for.

**New requirements it carries:** FR-SPLIT-1, FR-SPLIT-2, FR-SPLIT-3, FR-SPLIT-5,
FR-SPLIT-6 (all `M`).

| ID | Obligation | How M8 satisfies it |
|---|---|---|
| **FR-SPLIT-1** | Zero chain calls, no key material | No RPC client, no signer, no wallet library in the bundle. Verifiable by inspecting `package.json` — the strongest form of "I" verification available |
| **FR-SPLIT-2** | **Display nothing that looks verifiable but is not** | No transaction hashes, block numbers, addresses, or explorer-styled links anywhere in the phone UI. Simulated MON and kWh figures are fine — nobody mistakes a kWh for a receipt. **A developer will paste a fake hash into the explorer within seconds**, and this requirement exists because that would be fatal |
| **FR-SPLIT-3** | Server-authoritative scoring | The client sends tap *events* and renders; it never sends a score. With cash on a public leaderboard and a room of developers, a client-reported score is an open endpoint |
| **FR-SPLIT-5** | Permanent visible label | `SIMULATION — same engine, nothing on-chain`, always on screen, never dismissible |
| **FR-SPLIT-6** | Player count unbounded by the chain | True by construction — no chain in the path |

**Everything else in §M8.5 stands unchanged** (FR-BOOTH-5/6/7/8/10/11/12/14 and NFR-U-3/4),
except FR-BOOTH-13's cap, which is now **30/s**.

## M10 — Game Server *(new module)*

**Responsibility.** Hold booth session state, compute scores authoritatively, run the
shared settlement engine in simulation, and expose the room aggregate for the bridge.

**Requirements.** FR-SPLIT-3, FR-SPLIT-4, FR-SPLIT-6, FR-SPLIT-7 (all `M`).
FR-BOOTH-10/11/13. IF-8, IF-9.

**Where it runs:** cloud, **not the venue laptop** — phones must be able to fall back to
cellular when venue wifi degrades (`REQUIREMENTS.md:823`). See `ARCHITECTURE.md` §17.1.

### M10.1 The shared engine — the part that makes the honesty structural

```
                    ┌──────────────────────────────┐
                    │   engine/settlement.mjs      │   ONE module, TWO callers
                    │   monDelta = whDelta × rate  │
                    └──────────────┬───────────────┘
                       ┌───────────┴────────────┐
                       ▼                        ▼
            M10 game server              M4 PlugNPay.sol
            in-memory, simulated         on-chain, real
            "SIMULATION —                "LIVE — Monad testnet"
             same engine,                 + contract address
             nothing on-chain"
```

`REQUIREMENTS.md:787`: *"The engine SHOULD be the literal same accounting module both
sides use, so 'same engine, simulated' is true by construction rather than by
assertion."*

**Take the SHOULD as a MUST.** If the two sides diverge, the claim becomes an assertion a
reviewer cannot check, and the symmetry in FR-SPLIT-5's paired labels is what makes the
whole split read as rigour rather than as a retreat. Extract `whDelta × rate` into one
JS module; the Solidity `settle()` mirrors it, and a single test asserts the two agree
across a table of inputs.

### M10.2 Endpoints

```http
POST /game/session   → { deviceId, nickname, carId }
                     ← { sessionId, startAt, serverNow, priceMonPerKwh, v2gMonPerKwh }
POST /game/taps      → { sessionId, seq, taps: [tMs, …] }    # EVENTS, never a score
                     ← 204                                    # IF-8, IF-9
GET  /game/leaderboard?n=10                                   # FR-BOOTH-10, ≥ every 5 s
GET  /game/aggregate → { totalWh, totalMon, players }         # FR-SPLIT-7 — the bridge
```

`/game/taps` carrying **events rather than a score** is FR-SPLIT-3. It is one schema
decision and it closes the whole cheating surface: there is no field in which to send a
number you did not earn.

### M10.3 The tap cap (FR-SPLIT-4, FR-BOOTH-13)

**30/s, enforced server-side per connection.**

```js
const TAP_CAP_PER_SEC = 30;   // FR-BOOTH-13, REQUIREMENTS.md:436
```

**Why 30 and not 20** — the reasoning matters because the earlier value was actively
harmful. Five fingers reaches about 25/s, so a 20/s cap sits *inside* the human range: a
four-finger player and a script both saturate and both score 5,732, reintroducing exactly
the tie at prize-winning positions that soft saturation exists to prevent. At 30/s a
script's edge over the best plausible human is **2%** (6,098). The real defence is not the
cap at all — it is **review before the reveal** of any run averaging above 18/s
(FR-BOOTH-12).

The `4,200` plausibility ceiling is dead twice over: superseded here, and useless anyway
because it sat above the curve's own asymptote of 4,040. **`REQUIREMENTS.md:665` (§13.1)
still records it and is stale** — flagged, not fixed, since this document does not edit
the baseline.

### M10.4 Errors and dependency failure

| Condition | Behaviour |
|---|---|
| Phone loses connectivity | Game continues locally; taps queue and resend. Player sees nothing wrong (FR-BOOTH-2/4) |
| Game server down | Phone stays fully playable, leaderboard from `localStorage` (booth ladder L2) |
| Redis down | Sessions live in process memory; leaderboard degrades to in-memory for the round |
| **Relay or chain down** | **No effect whatsoever.** M10 has no chain dependency — that is the point of the split |

## M4 addendum — `settleRoomAggregate` (FR-SPLIT-7, FR-SPLIT-8)

One new entry point. The bridge from the simulated room to one real transaction.

```solidity
/// The room's combined simulated energy, settled as ONE real transaction at the
/// close of the pitch. FR-SPLIT-7. Same on-chain price computation as settle()
/// (IF-4) — the aggregate is NOT a special case that bypasses the pricing rule.
function settleRoomAggregate(bytes32 roomId, int256 totalWh)
    external onlyRelay
{
    require(!roomSettled[roomId], "AlreadySettled");      // idempotent, DR-2
    roomSettled[roomId] = true;
    uint128 rate     = rateAt(Ctx.CHARGE, uint64(block.timestamp));
    int256  totalMon = (totalWh * int256(uint256(rate))) / 1_000_000;
    _move(roomPayer, roomPayee, uint256(totalMon >= 0 ? totalMon : -totalMon));
    emit RoomSettled(roomId, totalWh, totalMon, uint64(block.timestamp));
}
```

**Relay-side obligations (FR-SPLIT-8):**

| Item | Design |
|---|---|
| Pre-signed | The transaction is built and signed **before** the pitch, not during it |
| Automatic retry | Resubmit on failure without operator action |
| **Rehearsal aggregate at T-10min** | A real aggregate settled in rehearsal; its hash is saved |
| **5-second stall rule** | If the live send has not confirmed in 5 s, show the rehearsal hash **and say plainly that it is the rehearsal one** |

That last row is NFR-R-3 under maximum pressure — a fallback artefact exists, it is
presentable, and presenting it as the live one would be the precise failure the honesty
constraints forbid. Write the presenter's sentence now, not on stage:

> *"That's the rehearsal aggregate from ten minutes ago — the live one is still
> confirming. Same contract, same wallet, you can check both."*

**Margin:** one transaction against a measured 10 tx/s ceiling is **tenfold headroom**
and confirms inside a second (`REQUIREMENTS.md:809`).

## Module map, updated

| Module | Status |
|---|---|
| M1–M7, M9 | Unchanged. ▶ Freeze slice |
| **M8** | **Superseded** — zero chain calls, no keys, simulation-labelled |
| **M10** | **New** — game server, server-authoritative, holds the shared engine |
| **M4** | **+ `settleRoomAggregate`** |

**The freeze slice is unchanged** (M1, M2, M3, M4, M5, M6, M7, M9). M10 belongs to the
booth track, which `REQUIREMENTS.md:625` still builds last — but it is now the *only*
thing the booth needs, and it is smaller than the relay integration it replaces.

## Three corrections that apply across the whole document

### §M-ISFINAL · `settle()` has no `isFinal` parameter — answering `api-author`

**No parameter. FR-SET-5 is satisfied by the close path costing nothing, not by folding
the close into a settlement.**

FR-BOOTH-16 (which *did* require the final settlement to double as the close) is
**withdrawn** (`REQUIREMENTS.md:439`), so that obligation is gone. What remains is
FR-SET-5: *"Closing MUST NOT require a separate reconciliation or invoice transaction.
The last settled state is final."*

Read it precisely — it forbids a **reconciliation** transaction, not a state change:

| | |
|---|---|
| What FR-SET-5 forbids | A transaction that **moves value** at close — a true-up, refund, or invoice settlement |
| What `closeSession()` does | Flips `status` to `CLOSED`, stamps `closedAt`, emits `SessionClosed`. **`_move` is never called** (§M4.5) |
| Why that satisfies it | The last `settle()` already moved the final value. Closing transfers nothing, reconciles nothing, and computes no total the ticks had not already accumulated in `cumWh`/`cumMon` |

So the requirement is met by the **absence of a transfer in the close path**, which a
reviewer verifies by reading eleven lines of `closeSession` and finding no `_move`. An
`isFinal` flag on `settle()` would be a second way to close a session — a second code
path for one outcome, which is the shape FR-SET-7 rejects elsewhere in this contract.

**Rail sessions may not even reach `closeSession`.** FR-SET-4 closes on the idle
threshold (`SESSION_IDLE_MS`, 5 s), and a demo that ends with sessions still ticking
simply leaves them `OPEN` — which is correct, because the settled state is already final
and nothing is owed (UC-3, `story.md:7`).

### §M-PALETTE · Cyan is the only accent

The booth palette changed after §M7.1 was written. Current:

| Token | Value | Use |
|---|---|---|
| Ground | **near-black** | Every surface |
| Accent | **cyan** — the *only* accent | Active state, progress, emphasis |
| The Flip | **inverts the screen** | Not a hue shift — the whole surface inverts |

**Any `amber` in this document is stale.** The degraded-mode chip (§M7.6) reads as a
dimmed or outlined cyan chip, not a second colour, and the Flip's signature moment is an
inversion.

⚠ **§M7.1's wall palette (`#6E54FF` purple / `#FFAE45` orange) is NOT confirmed against
this change.** The wall and the booth may legitimately differ — the wall needs
charge-versus-V2G distinguishable by colour alone at ten metres (NFR-U-2), which a
single-accent palette does not obviously provide. **Confirm against the booth session's
token file before building M7.** Flagged rather than guessed; I do not own
`2026-08-08-booth-frontend-design.md`.

### §M-ADR3 · `eth_sendRawTransactionSync` is UNVERIFIED

`CFG.USE_SYNC_SEND: true` rests on documentation only
(https://docs.monad.xyz/reference/json-rpc/api, fetched 2026-08-08). **It has never been
called against `testnet-rpc.monad.xyz`.** The write measurement in `REQUIREMENTS.md`
§13.4 used viem's standard `sendTransaction` — i.e. **async `eth_sendRawTransaction`**,
not the sync variant.

So the measured 10 tx/s figure is for the *async* path, and §M5.4's one-RPC-call-per-tick
claim is unproven on this endpoint.

**Fallback if it is absent or unreliable:** set `USE_SYNC_SEND: false`, take
`eth_sendRawTransaction` plus a receipt poll, **and cut the simulated session count in
the same change** — the fallback costs 2–4 RPC calls per tick instead of 1, so holding
the session count would multiply load against an already zero-margin ceiling.
`ARCHITECTURE.md` §16.5 carries the arithmetic.
