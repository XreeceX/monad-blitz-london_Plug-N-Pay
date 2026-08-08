# Plug-N-Pay — API Specification

M4 (settlement contract), M5 (relay HTTP + SSE), M8 (booth ↔ relay wire format). Subordinate to
`docs/specs/REQUIREMENTS.md` — on any disagreement the requirements win and this doc is wrong, not the other
way round (see project `CLAUDE.md`, Document hierarchy).

**Status:** first draft, written under the 18:00 code-freeze clock. `ARCHITECTURE.md` and `DESIGN.md` did not
exist on disk at time of writing — this doc proceeds directly from `REQUIREMENTS.md` §5–§8 and makes the
interface-level design calls that a missing ARCHITECTURE/DESIGN doc would otherwise have made. Every such call
is flagged inline as **DECISION** (my choice, stated so it can be overridden) or **TBD** (genuinely undecided,
owner named). Nothing here is invented Monad platform behaviour — chain facts cite
`docs/dispatch/2026-08-08-plug-n-pay-downstream-specs/monad-facts.md` (short: `monad-facts.md`) or a
`.agents/skills/` file.

**Contract naming — CONFIRMED against ARCHITECTURE.md (§8):** one deployed contract, **`PlugNPay.sol`**
(renamed from this doc's original placeholder `PlugNPay` — ARCHITECTURE.md §2.1 names it explicitly
and that name wins), covering identity registry + rate registry + session/settlement logic. The single-contract
call this doc made blind is independently confirmed: "Nine modules... collapse onto five running processes plus
**one contract**" (ARCHITECTURE.md §2.1, line 92-93).

---

## 0. Conventions

| Thing | Convention |
|---|---|
| `sessionId` | 32-byte hex string on the wire (`0x` + 64 hex chars) = `bytes32` on-chain. **DECISION:** generated off-chain (relay or booth wall), e.g. `keccak256(deviceId ‖ nickname ‖ startAtMs)` for booth, a UUID cast to bytes32 for simulated sessions. Never contract-assigned — a contract-side auto-increment would serialise opens through one storage slot, which fights the parallel relay-wallet-pool design (FR-REL-8). |
| Addresses | Standard 20-byte `0x`-prefixed EVM addresses. Monad is EVM-compatible; chain ID `10143` (`0x279f`), never `143` (mainnet) — see project `CLAUDE.md` / `docs/monad_dev_resources.md`. |
| Energy | Signed integer **milliwatt-hours (mWh)**. Never a float on any wire format this doc defines. (Booth's existing player-facing JSON keeps its own decimal `kW` for display — see §5 note.) |
| Value | **MON-wei** (1 MON = 10¹⁸ wei, same decimals as ETH). **MUST be a decimal string in JSON, never a JS number** — a wei amount over ≈0.009 MON already exceeds `Number.MAX_SAFE_INTEGER`. This is the single easiest correctness bug available to whoever implements this; it is called out here so nobody discovers it live. |
| Time | `timestampMs` = Unix epoch milliseconds, UTC (DR-4). Client-supplied times are advisory; relay-receipt time or block time is authoritative. |
| Gas | Monad bills `gas_paid = gas_limit × price_per_gas` — the **limit**, not gas used (`monad-facts.md` Q6; `.agents/skills/gas/SKILL.md:13`). Every gas limit below is a **starting number to hardcode**, to be replaced with one measured value from a real testnet call before freeze. **Never call `eth_estimateGas` on the settle path** — this is a project hard rule (`CLAUDE.md`), not a style preference. |
| Sync submission | The settlement path uses `eth_sendRawTransactionSync` — submits and blocks until the receipt is available, 1 RPC call per tick instead of send+poll (`monad-facts.md` Q7). Treated as mandatory, not optional, per the team brief. |

---

## 1. Smart contract API (M4) — `PlugNPay`

Solidity `^0.8.20+` (custom errors, standard `AccessControl`-shape roles). **TBD:** pin the exact compiler
version in `foundry.toml`/`hardhat.config` at implementation time — owner: whoever writes M4 first.

### 1.1 Types

```solidity
enum Role         { VEHICLE, STATION, METER, AGGREGATOR }   // mirrors Data requirements §6 Identity.role
enum Direction    { CHARGE, DISCHARGE }                      // mirrors Session.direction
enum RateContext  { CHARGE, V2G }                             // mirrors Rate.context

struct Identity {
    address wallet;     // == the identity's id (see DECISION below)
    Role    role;
    bool    registered;
}

struct Session {
    address  payer;          // DECISION: vehicle identity, fixed for the session's life
    address  payee;          // DECISION: station identity, fixed for the session's life
    Direction direction;     // fixed at open; does not flip mid-session (see §1.2 settle)
    uint64   startedAt;
    uint64   closedAt;       // 0 while open
    uint256  lastSeq;
    uint256  cumulativeWh;   // unsigned magnitude, mWh
    uint256  cumulativeMonWei;
    bool     open;
}

struct SettleEntry {         // one array element of settleBatch()
    bytes32   sessionId;
    uint256   seq;
    int256    whDelta;       // mWh, signed — negative denotes discharge energy flow (IF-3)
    bool      isFinal;       // true → this call also closes the session (FR-SET-5, FR-BOOTH-16)
}
```

**DECISION — identity `id` == `wallet`:** the Data requirements table (§6) lists `Identity{ id, role, pubKey,
wallet }` as four fields. This build collapses `id` and `wallet` into one address, and drops standalone `pubKey`
storage: ECDSA signature verification (IF-1, done off-chain in the relay — see §2) recovers a signer address via
`ecrecover` and compares it directly to the registered `wallet`, so a separately stored public key serves no
purpose an address doesn't already serve. If DESIGN.md wants a non-ECDSA metering signature scheme later, this
simplification needs revisiting — flagged, not silently dropped.

**Payer/payee under V2G (UC-4):** `payer`/`payee` name the vehicle/station identities for the session, fixed at
open. `direction` decides which way MON actually moves on each `settle()` call: `CHARGE` moves MON
`payer → payee`; `DISCHARGE` moves MON `payee → payer` (the station pays the vehicle for energy received,
priced at the V2G rate, not the charge rate). REQUIREMENTS.md does not spell out payer/payee semantics under
V2G explicitly — this is this doc's resolution, consistent with FR-SET-7 ("same path, differing only by sign
and rate").

### 1.2 Functions

| Function | Purpose | Access | Req. IDs |
|---|---|---|---|
| `registerIdentity` | Register a wallet as a vehicle/station/meter/aggregator identity | `RELAY_ROLE` or `OPERATOR_ROLE` | FR-ID-1, FR-ID-3, FR-ID-4, FR-ID-6, FR-SIM-6 |
| `openSession` | Open a session between two registered identities | `RELAY_ROLE` | FR-SET-1, UC-1 |
| `settle` | Settle one tick for one session (primary path, one tx/session/tick) | `RELAY_ROLE` | FR-REL-1, FR-SET-2, FR-SET-3, FR-SET-6, FR-SET-7, FR-SET-9, IF-2, IF-4 |
| `settleBatch` | Settle many entries atomically (fallback path) | `RELAY_ROLE` | FR-REL-2, IF-4, IF-5 |
| `closeSession` | Explicit close for the FR-SET-4 timeout case (no final tick arrived) | `RELAY_ROLE` | FR-SET-4, FR-SET-5 |
| `setRate` | Set the MON/kWh rate for a context (charge or V2G) | `OPERATOR_ROLE` | FR-PR-1, FR-PR-2, FR-PR-4 |
| `deposit` | Fund a payer's on-chain reserve | anyone, for `msg.sender` or a named `payer` | FR-SET-8 (funding side) |
| `settleRoomAggregate` | **NEW — see §9.** The one real transaction bridging the crowd/booth path to chain | `OPERATOR_ROLE` | FR-SPLIT-7, FR-SPLIT-8 |
| `getRate` | Read current rate | view, public | FR-PR-1 |
| `getSession` | Read session state | view, public | FR-SET-10 |
| `getIdentity` | Read identity registration | view, public | FR-ID-3 |
| `reserveOf` | Read a payer's remaining on-chain balance | view, public | FR-SET-8 |
| `getNetworkSnapshot` | Aggregate counters for the dashboard | view, public | FR-SET-10, feeds `NetworkSnapshot` (§6 data reqs) minus `mode` |

```solidity
function registerIdentity(address wallet, Role role) external;
function openSession(bytes32 sessionId, address payer, address payee, Direction direction) external;

function settle(
    bytes32 sessionId,
    uint256 seq,
    int256  whDelta,      // mWh; IF-4 — energy delta, never a pre-computed MON amount
    bool    isFinal        // kept despite ARCHITECTURE.md's 3-arg settle() — see §8
) external;

function settleBatch(SettleEntry[] calldata entries) external;   // IF-5: all-or-nothing

function closeSession(bytes32 sessionId) external;

function setRate(RateContext context, uint256 monWeiPerKwh) external;

function deposit(address payer) external payable;

function settleRoomAggregate(       // NEW, §9 — the crowd/booth bridge (FR-SPLIT-7/8), not part of the
    bytes32 roundId,                // original draft. roundId distinguishes the rehearsal call from the
    uint256 totalWhMwh,             // live one — both are real transactions with different IDs.
    uint256 totalMonWei             // Game server supplies BOTH figures directly (FR-SPLIT-7's own wording:
) external;                          // "expose the room aggregate (total kWh, total MON)") — this call does
                                      // NOT re-derive totalMonWei from a rate the way settle() does; §9 explains why.

function getRate(RateContext context) external view returns (uint256 monWeiPerKwh, uint64 effectiveFrom);
function getSession(bytes32 sessionId) external view returns (Session memory);
function getIdentity(address wallet) external view returns (Identity memory);
function reserveOf(address payer) external view returns (uint256 monWei);
function getNetworkSnapshot() external view returns (
    uint256 activeSessions,
    uint256 totalSettlements,
    uint256 totalMonWeiMoved,
    uint256 chargeVolumeWh,
    uint256 v2gVolumeWh
);
```

**Settlement math (IF-4, FR-SET-3), done on-chain, not by the relay:**

**CONFIRMED against ARCHITECTURE.md §7.1/§8:** `settle`/`settleBatch` take **no timestamp parameter** — this
doc originally included one (`timestampMs`) and it is removed here. The rate is resolved on-chain from
`rateAt(direction, block.timestamp)` (ARCHITECTURE.md §7.1 step ⑥, FR-PR-4), using the chain's own clock, which
DR-4 already establishes as authoritative over any client-supplied time. `timestampMs` still exists — it stays
in the *off-chain* metering Reading (§2), inside the signed payload, for the relay's own bookkeeping only.

```
monWeiPerKwh = rateAt(session.direction, block.timestamp)        // on-chain, not a parameter (FR-PR-4)
monDeltaWei  = (abs(whDelta_mWh) × monWeiPerKwh) / 1_000_000      // 1 kWh = 1,000,000 mWh
```

Worked example: `whDelta = 2000` mWh (2 Wh, a 7.2 kW tick over 1 s), `monWeiPerKwh = 1.2 × 10¹⁷` (0.12 MON/kWh)
→ `monDeltaWei = (2000 × 1.2×10¹⁷) / 1,000,000 = 2.4×10¹⁴ wei = 0.00024 MON`.

**`isFinal` folds the close into the settle call** (FR-SET-5: "closing MUST NOT require a separate reconciliation
or invoice transaction"; FR-BOOTH-16: "the final settlement MUST also serve as the close"). `closeSession()`
exists only for the FR-SET-4 edge case — a session whose readings simply stop, with no final tick to carry
`isFinal=true`.

**No on-chain signature check, by design.** `settle`/`settleBatch` do **not** verify the metering signature —
ASM-6 places that check off-chain, in the relay (§2). The contract trusts the caller's `RELAY_ROLE` grant as the
attestation that the signature was already checked. Say **"verifies"**, never "trustlessly verifies on-chain,"
anywhere this is described (NFR-M-4) — including in code comments a future contributor might quote out of
context.

**Handshake language (FR-ID-2):** `registerIdentity`/`openSession` implement a handshake **modelled on** ISO
15118 Plug & Charge. Do not describe it as a conformant implementation in any doc, comment, or pitch line that
touches these two functions.

### 1.3 Events

```solidity
event IdentityRegistered(address indexed wallet, Role indexed role);

event SessionOpened(
    bytes32   indexed sessionId,
    address   indexed payer,
    address   indexed payee,
    Direction direction,
    uint64    startedAt
);

event Settled(                                    // FR-SET-6: session, direction, amount, cumulative energy
    bytes32   indexed sessionId,
    Direction indexed direction,
    uint256   seq,
    int256    whDelta,
    uint256   monDeltaWei,
    uint256   cumulativeWhSession,
    uint256   cumulativeMonWeiSession,
    bool      isFinal
);

event SessionClosed(
    bytes32 indexed sessionId,
    uint64  closedAt,
    uint256 totalWhSession,
    uint256 totalMonWeiSession
);

event RateChanged(RateContext indexed context, uint256 monWeiPerKwh, uint64 effectiveFrom);

event RoomAggregateSettled(          // NEW, §9 — FR-SPLIT-7/8's one bridge transaction
    bytes32 indexed roundId,
    uint256 totalWhMwh,
    uint256 totalMonWei,
    uint64  settledAt
);
```

The dashboard (M7) consumes `Settled` almost exclusively — it alone carries every field FR-SET-6 and FR-DASH-3/4
need (session id to pulse a node, direction to split charge/V2G volume, `monDeltaWei` and cumulative totals for
the running counters).

### 1.4 Custom errors

| Error | Fires when | In |
|---|---|---|
| `NotRelay(address caller)` | Caller lacks `RELAY_ROLE` | `openSession`, `settle`, `settleBatch`, `closeSession`, `registerIdentity` |
| `NotOperator(address caller)` | Caller lacks `OPERATOR_ROLE` | `setRate`, `registerIdentity` (operator path) |
| `UnregisteredIdentity(address party)` | `payer` or `payee` not registered | `openSession` (FR-ID-4) |
| `IdentityAlreadyRegistered(address wallet)` | Re-registering a wallet | `registerIdentity` (guards FR-ID-3's "exactly one wallet") |
| `SessionAlreadyOpen(bytes32 sessionId)` | Opening a `sessionId` already in use | `openSession` |
| `SessionNotOpen(bytes32 sessionId)` | Settling/closing a session that doesn't exist or is already closed | `settle`, `settleBatch`, `closeSession` |
| `StaleOrReplayedSequence(bytes32 sessionId, uint256 got, uint256 lastSeen)` | `seq <= lastSeq` | `settle`, `settleBatch` (IF-2, DR-2, FR-SET-9, FR-MET-7) |
| `InsufficientReserve(bytes32 sessionId, uint256 required, uint256 available)` | Settling beyond payer's funded balance | `settle`, `settleBatch` (FR-SET-8) |
| `RateNotSet(RateContext context)` | No rate registered yet for the context | `settle`, `settleBatch` |
| `BatchEntryFailed(uint256 index, bytes reason)` | Any entry in `settleBatch` would revert | `settleBatch` — reverts the **whole** array (IF-5) |
| `RoundAlreadySettled(bytes32 roundId)` | Re-using a `roundId` | `settleRoomAggregate` — NEW, §9 |

### 1.5 Gas limits — measure, then hardcode

**CONFIRMED against ARCHITECTURE.md §6.3 — the table below now matches it exactly, formula included.** Per
`monad-facts.md` Q6, a `settle()`-shaped call (4 cold storage slots + 1 native-MON internal transfer) has a
documented floor of 63,500 gas; ARCHITECTURE.md §6.3 independently derives the same per-function budgets below
from the same opcode costs (cold storage 8,100 gas vs. warm 100 gas — an 81× ratio, which is why `settle()`'s
storage layout is a gas decision, not a style one).

**Hardcoding rule (ARCHITECTURE.md §6.3): `hardcoded limit = measured × 1.25`, except `settle` at `× 1.15`** —
`settle` runs ~1,800 times per demo run against tens of times for everything else, so its margin is worth
tightening. Every figure below is still `TO MEASURE` in W1 — nobody has run these against real deployed
bytecode yet, so this TBD stays open, just no longer bare.

| Function | Hot path? | Budget (pre-measurement guess) | Hardcode formula | Note |
|---|---|---|---|---|
| `settle` | **Yes** — per tick | **150,000** | measured × **1.15** | Matches this doc's original figure exactly. Never `eth_estimateGas` here — also rate-limited at half the general RPC quota (25 rps vs 50, ARCHITECTURE.md §6.2), so it's doubly wrong on the hot path. |
| `settleBatch` | Yes, if FR-REL-2 fallback is ever engaged | `≈ 40,000 + N × 130,000` (N = batch size) | measured × 1.15 | Not in ARCHITECTURE.md's table (it covers only the 5 primary functions) — this doc's own extrapolation stands. Batch size N is **TBD** — owner: whoever builds the FR-REL-2 fallback. ADR-1 (per-tick, not batching, is primary) suggests this path may not be needed at the target 10 tx/s load at all. |
| `openSession` | No — once per session | **180,000** (≈5 cold `SSTORE`s) | measured × 1.25 | Revised up from this doc's original ~100–120k guess to match ARCHITECTURE.md §6.3 exactly. |
| `closeSession` | No — edge case only | **80,000** | measured × 1.25 | See §8 — whether/how often this fires is one of the two places this doc diverges from ARCHITECTURE.md's apparent design. |
| `registerIdentity` | No — setup / occasional | **100,000** (2 cold slots) | measured × 1.25 | Revised up from ~80,000 to match ARCHITECTURE.md §6.3. |
| `setRate` | No — operator action | **90,000** (2 cold slots) | measured × 1.25 | Revised up from ~50,000 to match ARCHITECTURE.md §6.3. |
| `deposit` | No | ~30,000 | measured × 1.25 | Not one of ARCHITECTURE.md's 5 measured functions (payer-funding wasn't in its scope) — this doc's own guess stands. |
| `getRate` / `getSession` / `getIdentity` / `reserveOf` / `getNetworkSnapshot` | N/A | N/A | N/A | `eth_call`, not a transaction — no gas limit to set. |
| `settleRoomAggregate` | Once, at the pitch climax (+ once for rehearsal) | **200,000** (padded, not derived) | measured × 1.25, but pad generously anyway | Not in ARCHITECTURE.md (didn't exist there) and not derived from §6.3's opcode table — this fires exactly once live and FR-SPLIT-8 demands it not fail, so this doc deliberately over-pads rather than tightens. See §9. |

---

## 2. Metering payload (IF-1, IF-2, IF-3)

```
{ sessionId, seq, timestampMs, kW, whDelta, meterId, signature }
```

| Field | Type (wire) | Unit | Notes |
|---|---|---|---|
| `sessionId` | hex string | — | `0x` + 64 hex chars, matches an open on-chain session |
| `seq` | integer | — | **MUST increase monotonically per session** (IF-2). Relay/contract reject `seq ≤ lastSeq` (DR-2, FR-MET-7, FR-SET-9) |
| `timestampMs` | integer | Unix ms UTC | DR-4 — advisory; relay receipt time is authoritative |
| `kW` | number | kW | Instantaneous power. Display-only — **not** a settlement input; only `whDelta` moves money |
| `whDelta` | integer | **mWh**, signed | **MAY be negative — negative denotes discharge (IF-3)**. Same field feeds both CHARGE and DISCHARGE sessions per FR-SET-7 |
| `meterId` | address (hex string) | — | Identity registered with `role = METER`; the relay resolves this via `getIdentity(meterId)` to get the expected signer |
| `signature` | hex string | — | Covers every other field in this struct — see below |

### Signing scheme

**DECISION:** EIP-712 typed-data signature, secp256k1 (same curve as the Monad/EVM account model — no new
crypto primitive introduced). Domain separator uses chain ID `10143`. Exact domain `name`/`version` and the
verifying-contract address are **TBD** — owner: whoever implements M4, fixed at deploy time.

```
EIP712Domain: { name: "PlugNPay", version: "1", chainId: 10143, verifyingContract: <PlugNPay address> }
Reading: { sessionId: bytes32, seq: uint256, timestampMs: uint64, whDelta: int256, meterId: address }
```

`kW` is **not** part of the signed struct — it is derived/display data, not a payment authoriser, so excluding
it keeps the signed payload minimal. `signature` is a standard 65-byte ECDSA signature (`r`, `s`, `v`), hex
`0x`-encoded, 132 characters including the `0x` prefix.

### Verification (IF-1)

**Happens off-chain, in the relay — not on the M4 contract, and not per-signature on-chain (ASM-6).** The relay:

1. Resolves `meterId` → expected signer via `getIdentity(meterId).wallet` (cached, not called live per reading).
2. Recovers the signer from `signature` over the EIP-712 hash (`ecrecover`-equivalent, e.g. `ethers.verifyTypedData`).
3. Rejects the reading (HTTP 403, see §3.1) if the recovered signer ≠ the registered meter wallet, **before** it
   ever reaches a `settle()`/`settleBatch()` call. A bad signature never becomes an on-chain revert — it never
   gets that far.

### Worked example

```json
{
  "sessionId": "0x7a3f...b91c",
  "seq": 42,
  "timestampMs": 1754654321000,
  "kW": 7.2,
  "whDelta": 2000,
  "meterId": "0x1f9C2a...4D8e",
  "signature": "0x8f3e...1c02"
}
```
(2000 mWh = 2 Wh, consistent with 7.2 kW sustained for 1 second — matches the settlement worked example in §1.2.)

---

## 3. Relay HTTP API (M5)

Base path `/relay` — **corrected from this doc's original `/v1`** to match ARCHITECTURE.md's confirmed
`POST /relay/tick` (§2.2 topology diagram, line 156; see §8). JSON request/response bodies unless noted. All wei-denominated fields are decimal strings
(§0). Standard error shape:

```json
{ "error": { "code": "STALE_SEQUENCE", "message": "seq 41 <= last seen 42 for session 0x7a3f...b91c" } }
```

**SUPERSEDED 2026-08-08 — booth never calls this API at all. See §9.** An earlier revision of this section
resolved FR-BOOTH-3 as a server-to-server hop, with the wall backend forwarding booth ticks to
`POST /relay/tick` below. REQUIREMENTS.md §16 overrides that: the booth app and its game server (M10) make
**zero** calls into this relay API, full stop. FR-BOOTH-3 taken literally is now in tension with FR-SPLIT-1 —
flagged, not silently resolved, in §9. Everything below in §3 is used only by real/simulated meters (M2, M6) on
the actual on-chain rail.

### 3.1 `POST /relay/tick` — canonical metering ingest

**Renamed from this doc's original `/v1/readings`.** ARCHITECTURE.md's topology diagram (§2.2, line 156) showed
this same path also carrying booth-forwarded ticks — **no longer true, see §9; REQUIREMENTS.md §16 postdates
that diagram.** Used directly by real/simulated meters only (M2, M6, TB-1). The booth app and its game server
(M10) never call this endpoint (FR-SPLIT-1) — see §5.

```http
POST /relay/tick
  → { sessionId, seq, timestampMs, kW, whDelta, meterId, signature }   # §2 struct, exactly
  ← 202 { accepted: true, sessionId, seq }
  ← 200 { accepted: false, reason: "stale-seq", lastSeen: 42 }         # idempotent replay, not an error
  ← 400 { error: { code: "BAD_SIGNATURE" | "MALFORMED", message } }
  ← 403 { error: { code: "UNREGISTERED_METER", message } }
```

A signature failure is discarded, not retried and never queued — "FAIL → discard, record discrepancy, no value
moves" (UC-2 alt 2a; ARCHITECTURE.md §7.1 step ②).

**Idempotency (IF-9, DR-2):** keyed on `(sessionId, seq)`. A replay or an already-seen-or-older `seq` returns
`200 { accepted: false }`, never a 5xx — mirrors the booth wall's own `/api/tick` semantics ("ignores any `seq`
at or below the last one seen").

### 3.2 `GET /relay/mode` — FR-REL-5

**Renamed from `/v1/mode`**, same `/relay` base-path correction as §3.1. This specific path is this doc's own
convention, not ARCHITECTURE-confirmed the way `/relay/tick` is — flagged in §8.

```http
GET /relay/mode
  ← { mode: "live" | "batched" | "degraded", since: <timestampMs>, walletPoolSize: 3, sessionsActive: 23 }
```

**`walletPoolSize: 3` — corrected 2026-08-08, was `10`.** ARCHITECTURE.md ADR-2 sized the pool at ten wallets
for the pre-§16 world, where 60 booth phones settling individually needed 10 tx/s. REQUIREMENTS.md §16 deletes
that load entirely — the real rail now needs only ~10 concurrent *simulated* sessions at 1 Hz, and the measured
single-wallet ceiling (10 tx/s clean, §13.4) already covers that alone. 2–3 wallets is redundancy/parallel
margin now, not raw throughput need — see §9. The dashboard reads this field to state its own mode honestly
(FR-DASH-6, NFR-R-3) — a degraded relay must show as degraded, never as a frozen "live" view.

### 3.3 Operator control surface (M9)

Shared-secret header on every `/relay/ops/*` call (renamed from `/v1/ops/*`). TB-4 confirms the mechanism —
"Ops → relay | shared-secret header | The operator. Physical control of the laptop is the security model" —
but not an exact header name; that stays **TBD**, owner: M9 implementer. **Never commit the secret value**
(NFR-S-4) — env var only.

```http
POST /relay/ops/network/start                 # FR-OPS-1 — one deterministic action
  ← 200 { started: true }

POST /relay/ops/network/spawn                 # FR-OPS-1, FR-SIM-1, IF-11
  → { n: 10 }
  ← 200 { spawned: 10, sessionIds: [...] }

POST /relay/ops/surge                         # FR-OPS-2 — network-wide demo surge.
  → { atEpochMs }                             # NOT the same as booth's own POST /api/surge (§5) —
  ← 200 { triggered: true }                   # that one is an in-game surge window inside a single
                                                # booth match. This one ramps M6 simulated sessions DOWN
                                                # proportionally as phones connect, per FR-OPS-2's own text.

POST /relay/ops/degrade                        # FR-OPS-3 — force degraded mode, for rehearsal
  → { force: true | false }
  ← 200 { mode: "degraded" }

POST /relay/ops/malformed-settlement            # FR-OPS-7 — deliberately bad settlement, on demand
  → { sessionId }                              # relay submits one unsigned/garbled reading through the
  ← 200 { submitted: true, expectedRevert: "StaleOrReplayedSequence" | "BAD_SIGNATURE" }
                                                # normal path, live, so UC-7/AC-7 can be proven to a
                                                # skeptical reviewer without a separate test harness.

```

**There is no booth on-chain switch. Removed 2026-08-08 — see REQUIREMENTS.md §16.** An earlier revision of
this document specified `POST /relay/ops/booth-onchain`, a runtime flag enabling on-chain settlement for booth
sessions. **FR-SPLIT-1 (`M`, verified by inspection) states the booth app MUST make zero chain calls and hold
no key material.** A switch capable of turning booth chain-writes on violates that requirement by existing, so
the endpoint is deleted rather than defaulted off.

OD-1 is closed by §16, not by a switch: **booth sessions never settle on-chain.** The booth app talks to the
game server only, holds no wallet, and makes no RPC call. `FR-BOOTH-15` and `FR-BOOTH-16` — the 6-second
staggered booth settlement interval and its session-open scheduling — are **withdrawn**
(REQUIREMENTS.md:438-439).

The crowd path has exactly one chain interaction: the `settleRoomAggregate` bridge (FR-SPLIT-7/8, §16.4),
triggered here, not automatically — a human fires both of these:

```http
POST /relay/ops/settle-room-aggregate/rehearse   # FR-SPLIT-8 — mint ~10 min before the pitch
  → { roundId, totalWhMwh, totalMonWei }          # from the game server's exposed aggregate (FR-SPLIT-7)
  ← 200 { txHash, confirmedMs }                    # stored server-side as the fallback for the call below

POST /relay/ops/settle-room-aggregate             # FR-SPLIT-7/8 — the live climax call
  → { roundId, totalWhMwh, totalMonWei }           # a DIFFERENT roundId from the rehearsal call — §9
  ← 200 { txHash, source: "live", confirmedMs }
  ← 200 { txHash, source: "rehearsal", note: "live send stalled >5s — showing the rehearsal hash" }
                                                    # FR-SPLIT-8's fallback: if live doesn't confirm within
                                                    # 5s, return the pre-signed rehearsal tx's hash instead,
                                                    # with the "note" field so the caller can render the
                                                    # required plain statement of what it is, not disguise it
```

Both calls sit behind the same `/relay/ops/*` shared-secret header as everything else in this section.
"Pre-signed" means the relay holds fully-signed raw transaction bytes ready to broadcast before either button
is pressed — the retry/fallback logic in FR-SPLIT-8 is what makes the 5-second stall threshold meetable; see
§9 for why `roundId` (not a fixed key) is what lets the rehearsal and live transactions coexist.

### 3.4 Status codes and idempotency, summarised

| Code | Meaning |
|---|---|
| 200 | Success, including "accepted: false" idempotent replays |
| 202 | Accepted, settlement queued (not yet on-chain) |
| 400 | Malformed request body or bad signature |
| 403 | Unregistered identity/meter |
| 409 | Session state conflict (e.g. opening an already-open `sessionId`) |
| 429 | Relay is shedding load (ties to FR-REL-4 degrade-not-drop behaviour) |
| 5xx | Relay-side failure; the client (meter/simulator/booth wall) retries per its own backoff, never blocks |

---

## 4. Relay → dashboard stream (SSE)

**Why SSE, and why this is a *different* transport from booth's wall (§5):** IF-6/FR-DASH-8 call for a
reconnect-safe streaming transport for chain→dashboard settlement events, and SSE is the natural fit — native
browser auto-reconnect, works well for a one-way event feed. But `booth-frontend-design.md` constraint #1 rules
SSE out for the **wall's own** projector feed, because a Vercel Hobby function's connection dies at five minutes,
mid-pitch. **The transport splits by hop, not by requirement:** the relay that streams settlement events to the
Operations Dashboard (M7) is **self-hosted**, not a Vercel function, so it isn't subject to that 300 s cap and
can hold an SSE connection open for the full demo. The booth's phone↔wall traffic (§5) stays on 1 Hz polling
because the wall genuinely is Vercel-hosted. Two different processes, two different constraints, two different
transports — not a contradiction, provided nobody deploys the relay itself to Vercel.

**CONFIRMED against ARCHITECTURE.md:** this split is exactly ADR-5 ("SSE relay→wall, polling phone→Vercel") and
ADR-7 ("the wall is fed by the relay, not by a chain subscription"), and the topology diagram's own deployment
precondition — "`wall` must reach `relay` directly — same laptop or same LAN. No Vercel function sits in that
path" (§2.2) — is the thing that makes ADR-5 true. TB-5 states the wall's own honesty obligation on top of this:
"The wall never asserts a figure is on-chain unless the event carries a `txHash`" — which is why every
`settlement` event below carries one.

### `GET /relay/stream`

**Renamed from `/v1/stream`**, same `/relay` base-path correction as §3 — this specific path is this doc's own
convention, not independently ARCHITECTURE-confirmed.

```http
GET /relay/stream
Accept: text/event-stream
Last-Event-ID: 118                    # optional, for reconnect

← HTTP/1.1 200 OK
  Content-Type: text/event-stream

  id: 119
  event: settlement
  data: {"sessionId":"0x7a3f...","direction":"CHARGE","seq":42,"whDelta":2000,"monDeltaWei":"240000000000000","cumulativeWhSession":"84000","txHash":"0x...","blockNumber":1234567,"isSimulated":false}

  id: 120
  event: mode
  data: {"mode":"live"}

  : heartbeat
  id: 121
  event: heartbeat
  data: {"ts":1754654325000}
```

| Event | Payload | Fires |
|---|---|---|
| `settlement` | `Settled` event fields (§1.3) + `txHash`, `blockNumber`, `isSimulated` | Every landed `settle`/`settleBatch` entry |
| `mode` | `{ mode }` | On relay mode change (FR-REL-5) |
| `heartbeat` | `{ ts }` | Every ~15 s, so a silent-but-alive connection is distinguishable from a dead one |

**Reconnect (IF-6, FR-DASH-8):** every event carries an `id:` field, a monotonic counter. On reconnect the
client sends `Last-Event-ID`; the relay replays any events after that ID from a short in-memory ring buffer
(**TBD** buffer depth — owner: M5 implementer, size it to a few seconds of peak throughput). The dashboard MUST
NOT reload the page and MUST NOT show a frozen state as live on drop (FR-DASH-8, NFR-R-3) — render a visible
"reconnecting" state instead.

`isSimulated` on every `settlement` event is what lets the dashboard honour FR-DASH-6/IF-7 — every rendered
figure traces to either a real on-chain event or an explicit simulation flag, never silently to both.

**A nuance this doc's first draft missed, from ARCHITECTURE.md §7.2:** the wall reads chain state at
`"latest"`/Proposed, not finalized, to fit NFR-P-3's ≤1 s budget (finality alone costs 600 ms, which alone would
blow the budget). The honest cost, quoted from Monad's own docs there: "Proposed blocks undergo speculative
execution. In rare cases, apps consuming real-time data may see data from blocks that don't become canonical."
A `settlement` event on this stream, in rare cases, could describe a tick that is later reorganised away. This
belongs in the README's simplifications list (NFR-M-1) — it is not something this doc's SSE schema itself needs
to change to accommodate, since the schema already carries `blockNumber`/`txHash` for anyone who wants to
re-check finality independently.

---

## 5. Booth app ↔ game server (M10)

**REWRITTEN 2026-08-08 for REQUIREMENTS.md §16 (the demo/backend split) — commit `0e63afe`. Everything this
section said about booth sessions settling on-chain is withdrawn. Do not build the previous version.**

> **FR-SPLIT-1..6 — read this block before writing any code against §5. It is the whole reason this section
> looks the way it does.**
>
> - **FR-SPLIT-1** — the booth app makes **zero chain calls** and holds **no key material**. No wallet, no
>   RPC, no signing, anywhere in this section.
> - **FR-SPLIT-2** — no response below may contain anything that looks verifiable: no transaction hashes, no
>   block numbers, no addresses, no explorer-styled links — nothing shaped like on-chain proof. Simulated
>   MON/kWh figures are fine; nobody mistakes a plain number for a receipt. This is a room of developers — one
>   paste into a block explorer ends the project's credibility. Every schema below is audited against this
>   rule; none of the original six carried a chain artifact, so the fix here is what's *added* (labels, score
>   authority), not fields removed.
> - **FR-SPLIT-3** — scoring is **server-authoritative**: the game server computes score from tap events, the
>   client renders only. `POST /api/session/end` does not accept a client-reported score.
> - **FR-SPLIT-4** — the game server rate-caps taps per connection at **30/s** (FR-BOOTH-13's own number),
>   independent of whatever the client reports.
> - **FR-SPLIT-5** — every response below carries the label `SIMULATION — same engine, nothing on-chain`,
>   permanently and visibly. (The dashboard's symmetric counterpart, `LIVE — Monad testnet` + contract address,
>   comes from `/relay/mode`, §3.2 — not from anything in this section.)
> - **FR-SPLIT-6** — player count is unbounded by the chain. Any cap that exists is the game server's own
>   resource limit and must be stated if one exists (none is set by this doc — TBD #13).

Base shapes carried forward from `docs/specs/2026-08-08-booth-frontend-design.md` §8 (not redesigned) — the
backend behind them is now named **the game server (M10)**, not "the wall backend" or "the relay." It holds no
wallet, makes no RPC call, and signs nothing (FR-SPLIT-1).

```http
POST /api/session
  →  { deviceId, nickname, carId }
  ←  { sessionId, startAt, serverNow,
       surgeWindows: [[8000,11000],[19000,22000]],
       priceMonPerKwh: 0.12, v2gMonPerKwh: 0.30,
       label: "SIMULATION — same engine, nothing on-chain" }     # FR-SPLIT-5, verbatim, every response

POST /api/tick                          # ~1/s, batched, fire-and-forget — unchanged shape
  →  { sessionId, seq, ticks: [ { t, kW, whDelta, taps } ] }
  ←  204
# Server independently tallies taps and energy from this stream — see FR-SPLIT-3/4 below. Nothing here
# is trusted as a final number; /api/session/end is what turns it into one.

POST /api/session/end                   # CHANGED — no client-reported score (FR-SPLIT-3)
  →  { sessionId }
  ←  { score, whCharged, whDischarged, tapCount, rank, top: [ { rank, nick, score } ] }
# The server computes score/whCharged/whDischarged/tapCount itself from the /api/tick history it already
# has for this sessionId — the request no longer carries any of them. A client that reports its own score
# is an open leaderboard-forgery endpoint with cash attached; removed, not hardened.

GET /api/wall                           # polled 1/s by the projector only — unchanged shape + one field
  ←  { players: [ { id, nick, hue, kW, soc, phase } ],
       totalKW, totalWh, totalMon, count, surgeAt,
       label: "SIMULATION — same engine, nothing on-chain" }     # FR-SPLIT-5
# players[].id is a game-server-issued opaque id — MUST NOT be formatted as a 0x-prefixed address (FR-SPLIT-2).

GET /api/leaderboard?n=10
  ←  { entries: [ { rank, nick, score, carName } ], updatedAt }

POST /api/surge                         # presenter only, shared secret header — unchanged
  →  { atEpochMs }
```

`priceMonPerKwh`/`v2gMonPerKwh`/`kW`/`totalMon`/`totalKW`/`totalWh` stay **decimal floats**, unchanged from the
existing booth design —§0's "wei string" rule doesn't apply here because none of this JSON ever reaches a
contract. There is no wall→relay forwarding hop anymore (§3, §9) — this is now the *entire* wire surface
between the phone and anything server-side, full stop.

**FR-SPLIT-4, server-side:** the game server rate-caps taps per connection at 30/s (FR-BOOTH-13's own number)
independently of whatever the client reports in `ticks[].taps` — the client-side cap is UX, not the security
boundary; the server-side cap is. Both use the same number so a well-behaved client never notices the
difference.

**FR-SPLIT-6, player count:** unbounded by anything chain-related — there is no chain in this path at all
anymore. Any cap that exists is the game server's own resource limit and **MUST be stated wherever it's
configured** (this doc doesn't set one; note it here if one is added).

**IF-8** (fire-and-forget) and **IF-9** (idempotent on `(sessionId, seq)`) still apply — same dedup, same
"never blocks the render loop" client behaviour already specified in booth's own "Client queue behaviour"
(in-memory queue, cap 50, backoff 250 ms/1 s/4 s, drop oldest). **IF-10** (burst tolerance, ~60 sessions in
20 s) now describes the **game server's** capacity, not the relay's — the relay never sees booth traffic at all.

### The bridge — the only chain interaction this path has

See §9 for the full explanation. In one line: at the end of the pitch, the game server hands its running
totals to the operator, who fires `settleRoomAggregate` (§1.2, §3.3) exactly once. Nothing above this line
changes because of that call — the phone and the game server are already done by the time it happens.

---

## 6. Requirement traceability

Every function, endpoint, and event above, mapped to the requirement IDs it satisfies. IDs not listed anywhere
below either carry no `MUST`/`should` obligation for the API doc per the coverage ledger, or are explicitly
noted as deferred/not-built.

| API surface | Requirement IDs |
|---|---|
| `registerIdentity`, `getIdentity` | FR-ID-1, FR-ID-3, FR-ID-4, FR-ID-6, FR-SIM-6, DR-5 |
| Handshake framing (docs/comments touching identity+session open) | FR-ID-2 |
| `openSession` | FR-SET-1, DR-1, UC-1 |
| `settle` | FR-REL-1, FR-SET-2, FR-SET-3, FR-SET-6, FR-SET-7, FR-SET-9, IF-2, IF-4, DR-2, DR-3, NFR-S-1, NFR-S-2 |
| `settleBatch` | FR-REL-2, IF-4, IF-5 |
| `closeSession`, `isFinal` flag | FR-SET-4, FR-SET-5 |
| `setRate`, `getRate` | FR-PR-1, FR-PR-2, FR-PR-4, DR (Rate entity, §6) |
| `deposit`, `reserveOf`, `InsufficientReserve` | FR-SET-8 |
| `getSession`, `getNetworkSnapshot` | FR-SET-10 |
| `Settled` event | FR-SET-6, FR-DASH-3, FR-DASH-4 |
| No on-chain signature check (design note) | ASM-6, NFR-M-4 |
| §2 metering payload struct + signing | IF-1, IF-2, IF-3, FR-MET-2, FR-MET-3, FR-MET-6, DR-4 |
| Off-chain signature verification in relay | IF-1, ASM-6, FR-MET-3 |
| Replay/stale-seq rejection | FR-MET-7, FR-SET-9, DR-2, NFR-S-3 |
| `POST /relay/tick` idempotency | IF-9, DR-2 |
| `GET /relay/mode` | FR-REL-5 |
| `/relay/ops/network/start`, `/spawn` | FR-OPS-1, FR-SIM-1, IF-11 |
| `/relay/ops/surge` | FR-OPS-2 |
| `/relay/ops/degrade` | FR-OPS-3 |
| `/relay/ops/malformed-settlement` | FR-OPS-7, UC-7, AC-7 |
| `settleRoomAggregate` (the bridge) | FR-SPLIT-7, FR-SPLIT-8, §16.4 |
| Booth app makes zero chain calls | FR-SPLIT-1, FR-SPLIT-6 |
| No verifiable-looking artifacts in booth responses | FR-SPLIT-2 |
| Server-authoritative scoring | FR-SPLIT-3, FR-SPLIT-4 |
| Permanent `SIMULATION` / `LIVE` labels | FR-SPLIT-5 |
| Relay degrade-not-drop (429, FR-REL-4) | FR-REL-4, NFR-R-2, NFR-R-3 |
| RPC throughput numbers cited throughout | FR-REL-9, NFR-P-2, CON-5 |
| `GET /relay/stream` (SSE) | IF-6, FR-DASH-8, FR-DASH-9 |
| `isSimulated` field on stream events | FR-DASH-6, IF-7, NFR-M-1 |
| Booth endpoints (§5, rewritten for §16) | FR-BOOTH-13, FR-BOOTH-14, IF-8, IF-9, IF-10 (now against M10, not the relay) |
| FR-BOOTH-3 / FR-BOOTH-9 — tension, not silently resolved | FR-BOOTH-3, FR-BOOTH-9 — see §9 |
| ~~Staggered settlement schedule~~ | ~~FR-BOOTH-15~~ — **withdrawn**, REQUIREMENTS.md:438 |
| Zero chain calls, no wallet, no key material in booth app | FR-SPLIT-1 |
| No private key ever transmitted or stored server-side beyond relay's own hot wallet | FR-REL-7, NFR-S-4, NFR-S-5, NFR-S-6, DR-5 |
| Gas limit table (§1.5) | project `CLAUDE.md` gas hard rule, `monad-facts.md` Q6, ARCHITECTURE.md §6.3 |
| `eth_sendRawTransactionSync` usage note | `monad-facts.md` Q7, ARCHITECTURE.md ADR-3 |
| Trust-boundary cross-reference (TB-1..TB-5) | ARCHITECTURE.md §2.3 — reference only, not a new obligation |
| Wallet pool size = 10 (`/relay/mode`'s `walletPoolSize`) | ARCHITECTURE.md ADR-2, §5.5 |
| **Deferred, no API surface in this build** | FR-SET-11 (W, rate-based streaming — a live oracle or streaming-balance model would replace `setRate`/`settle`'s discrete math, not add new endpoints), FR-ID-7 (C, cert-derived session keys — would replace `registerIdentity`'s key source, not its shape), FR-MET-8 (C, real hardware — same §2 payload shape, no API change), FR-PR-5 (C, live oracle — would call the existing `setRate`, not a new function), FR-SIM-4/5 (S — spawner behaviour, not an API surface) |
| **Not an API-doc obligation** (UX/rendering/process, owned by Design or Arch doc) | FR-BOOTH-1, FR-BOOTH-2, FR-BOOTH-4, FR-BOOTH-5, FR-BOOTH-6, FR-BOOTH-7, FR-BOOTH-8, FR-BOOTH-10, FR-BOOTH-11, FR-BOOTH-12, FR-DASH-1, FR-DASH-2, FR-DASH-5, FR-DASH-7, FR-DASH-10, FR-MET-1, FR-MET-4, FR-MET-5, FR-SIM-2, FR-SIM-3, FR-OPS-4, FR-OPS-5, FR-OPS-6, NFR-P-1, NFR-P-3, NFR-P-4, NFR-P-5, NFR-P-6, NFR-R-1, NFR-U-1, NFR-U-2, NFR-U-3, NFR-U-4, NFR-M-3, CON-1..CON-7 |

---

## 7. Open TBDs and unknowns

| # | TBD | Owner |
|---|---|---|
| 1 | Gas limits — §1.5 now cites ARCHITECTURE.md §6.3's method (measured × 1.15 for `settle`, × 1.25 elsewhere) and matching budget figures, but every figure is still `TO MEASURE` — no real measurement has run yet | Whoever deploys M4 first — measure once in W1, hardcode, before freeze |
| 2 | Batch size N for `settleBatch` (FR-REL-2 fallback) — ADR-1 suggests this path may not be needed at all at the target 10 tx/s load | M5 implementer, only if the FR-REL-1 primary path proves RPC-insufficient |
| 3 | `withdrawUnused`/full funding-lifecycle UX for `deposit` — still unspecified. **Not the same "reserve" as ARCHITECTURE.md §5's "reserve balance"** — that's Monad's own protocol mechanic sizing the relay's hot-wallet gas funding; this is payer session-funding accounting, a different concern that happens to share a word | DESIGN.md author |
| 4 | Exact shared-secret header name/scheme for `/api/surge` and every `/relay/ops/*` call — TB-4 confirms the mechanism (shared secret; physical laptop control is the security model) but not a header name | M9 implementer — must not be committed to the repo (NFR-S-4) |
| 5 | EIP-712 domain `name`/`version` strings, and `PlugNPay`'s deployed address (needed for the domain separator) | M4 implementer, fixed at deploy time |
| 6 | Whether `registerIdentity` should be `RELAY_ROLE`-gated, `OPERATOR_ROLE`-gated, or both (this doc grants both — §1.2) — ARCHITECTURE.md doesn't resolve this either, still genuinely open | Whoever builds M1, confirm or narrow |
| 7 | SSE reconnect ring-buffer depth (§4) | M5 implementer, size from measured peak throughput |
| 8 | ~~Single-contract-vs-split-contracts call~~ — **CLOSED.** Confirmed single contract, `PlugNPay.sol` (ARCHITECTURE.md §2.1, "one contract") | — |
| 9 | **New:** does `settle()` genuinely take no `timestampMs`/`isFinal`, or were ARCHITECTURE.md's three renderings just abbreviated for the point each was making? This doc kept `isFinal` (§8) rather than guess | ARCHITECTURE.md's author, or whoever builds M4 first — one line closes this |
| 10 | **New:** exact paths for `/relay/mode`, `/relay/ops/*`, `/relay/stream` are this doc's own naming convention, extrapolated from the one ARCHITECTURE-confirmed path (`/relay/tick`) — not independently verified | Whoever builds M5, confirm or rename before other code depends on them |
| 11 | **New (§9):** how long a pre-signed `settleRoomAggregate` rehearsal transaction stays valid before its nonce/gas price go stale — FR-SPLIT-8 requires it usable up to ~10 minutes after signing | M9/relay implementer — a stuck nonce here fails the pitch's climax moment |
| 12 | **New (§9):** whether `settleRoomAggregate`'s `totalMonWei` should be cross-checked on-chain against `totalWhMwh × rateAt(...)`, or trusted as-supplied from the game server. This doc trusts it as-supplied (§9) — low stakes, no real payer/payee balance at risk | M4 implementer, revisit if time allows; not worth blocking the freeze over |
| 13 | **New:** the game server's (M10) own player-count cap, if any (FR-SPLIT-6 requires stating one if it exists) — this doc doesn't set one | M10 implementer |

---

*Sources: `docs/specs/REQUIREMENTS.md` §5–§8 (M1–M9 functional requirements, data requirements, interface
requirements, non-functional requirements); `docs/specs/2026-08-08-booth-frontend-design.md` §8;
`docs/dispatch/2026-08-08-plug-n-pay-downstream-specs/monad-facts.md` Q6/Q7; project `CLAUDE.md` (gas hard
rule, honesty constraints, document hierarchy); `docs/specs/ARCHITECTURE.md` §0, §2, §3, §4, §6, §7 (§8 below).*

---

## 8. Reconciliation against ARCHITECTURE.md

Run after `docs/specs/ARCHITECTURE.md` (1,653 lines) landed — it did not exist when §0–§7 above were first
written. `docs/specs/DESIGN.md` still does not exist (checked via `ls docs/specs/` again at reconciliation
time) — skipped per instruction, nothing to reconcile against yet.

**Sections read directly for this pass:** §0 (document control / drift log), §2 (component/deployment view,
topology, trust boundaries), §3 (ASM-6 in full), §6 (gas model), §7 (data flow, one tick's life). §11's
fourteen contradiction resolutions and §13's ADRs were **not** read section-by-section — their load-bearing
content surfaced by citation inside §2/§6/§7 (ADR-1, ADR-2, ADR-3, ADR-5, ADR-6, ADR-7, TB-1..5 all appear and
are cited below), which covered everything this pass needed. Flagging this scoping choice rather than implying
a full read of both — a deeper pass through §11/§13 directly is still available if wanted.

**§0's three drifts, checked against this doc: none apply.** The coverage-ledger staleness (missing
FR-BOOTH-14/15/16) doesn't affect API.md — those three IDs are already in this doc's traceability table. The
booth-spec line-number shift doesn't affect API.md — this doc cites `booth-frontend-design.md` by section, not
line number. FR-REL-9-is-DONE was already correctly treated as done here.

| # | Item | This doc said (first draft) | ARCHITECTURE.md says | Resolution | Winner |
|---|---|---|---|---|---|
| 1 | Contract name | `PlugNPaySettlement` | `PlugNPay.sol` (§2.1, §2.2) | Renamed throughout | ARCHITECTURE.md |
| 2 | Single vs. split contract | Guessed single, flagged TBD | "one contract" (§2.1) | TBD closed | ARCHITECTURE.md confirms this doc's guess |
| 3 | `settle()` timestamp param | `settle(sessionId, seq, whDelta, timestampMs, isFinal)` | `settle(sessionId, seq, whDelta)`; rate resolved via `rateAt(session, block.timestamp)` (§7.1 step ⑥) | Dropped `timestampMs` from the on-chain call; kept off-chain in the Reading (§2) | ARCHITECTURE.md — three independent citations plus DR-4 backing |
| 4 | `settle()` `isFinal` param | Present, folds the close into `settle()` (FR-SET-5, FR-BOOTH-16) | Absent from every rendering — but no close mechanism shown in the full §7.1 walkthrough either | **Kept** — flagged open (TBD #9), not silently resolved either way | This doc — closer to the literal requirement text; ARCHITECTURE.md has a genuine gap here |
| 5 | Relay ingest endpoint | `POST /v1/readings` | `POST /relay/tick`, explicit in the topology diagram | Renamed | ARCHITECTURE.md |
| 6 | Base path convention | `/v1/*` | `/relay/*` (only `/relay/tick` itself is verbatim-confirmed) | Renamed throughout; unconfirmed paths flagged (TBD #10) | ARCHITECTURE.md, partly by inference |
| 7 | Gas limits, 4 of 5 functions | `openSession` ~100–120k, `closeSession` ~60–80k, `registerIdentity` ~80k, `setRate` ~50k | `openSession` 180k, `closeSession` 80k, `registerIdentity` 100k, `setRate` 90k (§6.3); `settle` already matched at 150k | Updated to match; adopted the ×1.15/×1.25 hardcode formula | ARCHITECTURE.md |
| 8 | Booth on-chain settlement | Assumed always-on once forwarded to the relay | **Superseded by REQUIREMENTS.md §16: zero chain calls from the booth, ever.** FR-BOOTH-15/16 withdrawn; FR-SPLIT-1 makes a switch a violation by existing | Endpoint and switch **deleted**, not defaulted off. Crowd's only chain interaction is the `settleRoomAggregate` bridge | REQUIREMENTS.md §16 — supersedes both this doc and ARCHITECTURE.md ADR-6 |
| 9 | Wallet pool size | Left abstract ("a pool of funded wallets") | Exactly **10** (ADR-2, §5.5) | Made concrete in `/relay/mode`'s response | ARCHITECTURE.md |
| 10 | Signature-fail handling | "rejected... before it ever reaches settle()" | "discard, record discrepancy, no value moves" (UC-2 alt 2a) | Cited more precisely; no substantive change | Confirmed consistent |
| 11 | Metering `Reading` struct | `{ sessionId, seq, timestampMs, kW, whDelta, meterId, signature }` | Identical fields, signature separate (§7.1 step ①) | No change | Confirmed consistent |
| 12 | ASM-6 / "verifies" wording | "Say verifies, never trustlessly verifies on-chain" | Full required verbatim paragraph + forbidden-phrase list (§3.4) | No contradiction — this doc already complies. §3.4's exact paragraph is now the one to paste into the README/pitch, not a paraphrase | Confirmed consistent, citation strengthened |
| 13 | SSE-vs-booth-polling transport split | "self-hosted relay isn't subject to the 300 s cap" | ADR-5, ADR-7, explicit LAN-adjacency deployment precondition (§2.2) | No change; citations added | Confirmed consistent |

**Net:** 13 items checked. 7 were real conflicts, all resolved in ARCHITECTURE.md's favour (#1, #3, #5, #6, #7)
or filled a gap this doc didn't know it had (#8, #9). 1 was kept as this doc's own position against
ARCHITECTURE.md's apparent-but-unconfirmed shorthand (#4, `isFinal`) — flagged, not silently overridden either
way. 5 came back independently consistent (#2, #10, #11, #12, #13) — nothing to change, citations strengthened
where it was cheap to do so. TBD count went from 8 to 10: one closed outright (#8, contract split), one
genuinely new one opened by the reconciliation itself (#9, the `isFinal` question), one more opened by the
endpoint-naming inference (#10).

---

## 9. The booth/backend split (REQUIREMENTS.md §16, commit `0e63afe`) — supersedes parts of §5 and §8

**Trigger:** the write-path RPC measurement in §13.4 put a single wallet's clean ceiling at 10 tx/s — exactly
what 60 phones settling individually needed, with zero margin, on public infrastructure nobody controls. §16
moves the crowd off-chain instead of negotiating with that ceiling. Full rationale: REQUIREMENTS.md §16.1.
**Ignore any sub-2 tx/s write figure encountered elsewhere** — an early measurement run hardcoded
`maxFeePerGas` at 60 gwei against a 102 gwei base fee and reported a fabricated ceiling (§13.4).

**§8's row #8 is now itself superseded.** It correctly reconciled this doc against ARCHITECTURE.md's "booth
on-chain settlement behind a switch, default off" (ADR-6) — accurate when written, before §16 existed. §16
replaces the switch with a flat prohibition: **booth makes zero chain calls, ever — no switch exists.** §8 is
left as-is, a historical record rather than silently edited; this paragraph is the pointer forward.

**What changed in this doc, this pass:**

| Area | Before | After |
|---|---|---|
| §3 intro, §3.1 | Wall backend forwards booth ticks to `POST /relay/tick` | Deleted — booth never calls this API |
| §3.3 | `POST /relay/ops/booth-onchain` switch | Removed; replaced by `settleRoomAggregate`'s ops trigger |
| §5 | "Booth app ↔ relay" — settles via `settle()`, 6 s stagger, `isFinal` close | "Booth app ↔ game server (M10)" — zero chain calls, server-authoritative score, permanent `SIMULATION` label, unbounded player count |
| §1 | No aggregate function | `settleRoomAggregate(roundId, totalWhMwh, totalMonWei)` — full signature, event, error, gas entry |
| §6 | `settle`/`closeSession` rows cited `FR-BOOTH-15`/`FR-BOOTH-16` | Removed — both requirements withdrawn (REQUIREMENTS.md:438-439) |
| §7 | 10 TBDs | 13 — three new, about the bridge's transaction lifecycle (#11, #12) and the game server's own cap (#13) |

**Genuine tension, not silently resolved: FR-BOOTH-3 and FR-BOOTH-9.** REQUIREMENTS.md §16 explicitly withdraws
only FR-BOOTH-15 and FR-BOOTH-16 by name. It does not withdraw:

- **FR-BOOTH-3** — "The app MUST report energy deltas to the relay through the M5 interface." Under §16 there
  are no energy deltas reported to any relay from the booth app at all. Read literally, this requirement is now
  unsatisfiable by any implementation that also satisfies FR-SPLIT-1.
- **FR-BOOTH-9** — "On load, the app MUST generate an ephemeral session key client-side and silently register
  it... a participant MUST NOT be asked to hold or manage a key." A session key exists to make a metering
  Reading verifiable (IF-1) on a path that no longer exists. FR-SPLIT-1 ("hold no key material") makes
  FR-BOOTH-9 look not just unnecessary but actively contrary to the new requirement.

Both read as **artifacts of the pre-§16 design that §16 didn't clean up**, not as requirements this doc has any
authority to withdraw itself — REQUIREMENTS.md's own stable-ID rule means only that document's author can
strike them, the way FR-BOOTH-15/16 were struck. This doc builds to FR-SPLIT-1 (zero key material) and treats
FR-BOOTH-3/9 as **stale, pending an explicit withdrawal** — flagged rather than either silently implementing a
client-side key nobody needs, or silently pretending the tension isn't there.

**`settleRoomAggregate` design notes, not fully spelled out in §16.4 itself:**

- **Why it takes `totalMonWei` directly instead of deriving it on-chain from `totalWhMwh × rate`, unlike
  `settle()`.** FR-SPLIT-7's own wording is "expose the room aggregate (**total kWh, total MON**)" — both
  numbers, already computed by the game server's engine, which §16.2 requires to be "the literal same
  accounting module" the real contract uses. Re-deriving on-chain would be redundant given that constraint, and
  this call moves no real payer/payee funds — there is no real payer — so the security property IF-4 protects
  for `settle()` doesn't apply here. TBD #12 leaves room to add a consistency check later if there's time.
- **Why `roundId`, not a fixed key.** FR-SPLIT-8 needs a rehearsal transaction (minted ~10 minutes before the
  pitch) and a live one to exist as two independent, already-signed, individually valid transactions — a fixed
  key would make the second collide with the first. Different `roundId`s per call sidestep this without the
  contract needing to know "rehearsal" and "live" are related; that distinction is purely operational (which
  hash the presenter shows) and lives entirely in `/relay/ops/settle-room-aggregate` and its `/rehearse`
  counterpart (§3.3).
- **Access control:** `OPERATOR_ROLE`, not `RELAY_ROLE` — a ceremonial, once-per-demo, human-triggered action
  from the M9 control surface, not part of the automated per-tick settlement loop.

**Out of scope for this pass, unchanged:** `docs/specs/2026-08-08-booth-frontend-design.md` — owned by another
session fixing it directly, not edited here. M4/M5's on-chain design for the real ~10-session rail is
untouched; §13.4's measurement governs that rail only, exactly as REQUIREMENTS.md §16.1 now states.
