# Plug-N-Pay — Architecture

**Subordinate to `docs/specs/REQUIREMENTS.md`.** Where this document disagrees with the
requirements, the requirements win and this document is wrong.

| | |
|---|---|
| **System** | Plug-N-Pay — per-second machine-to-machine settlement for EV charging on Monad testnet |
| **Version** | 1.0 |
| **Date** | 2026-08-08 |
| **Chain** | Monad testnet, chain ID `10143` (`0x279F`) (`docs/monad_dev_resources.md:113`) |
| **Audience** | A developer building this today; a reviewer attacking it in three minutes |
| **Companion** | `docs/specs/DESIGN.md` (module-level how), `API.md`, `TEST-PLAN.md` |

**Freeze markers.** `▶ FREEZE SLICE` marks what must exist by 18:00 today (CON-3,
`REQUIREMENTS.md:139`). Everything unmarked is the production path, documented so a
reviewer can see the boundary was chosen rather than missed.

**Citation rule applied throughout.** Every Monad platform number carries a
`file:line` or URL. Numbers with neither are labelled a guess. Arithmetic is shown, not
asserted.

---

## 0. Document control — three source drifts found while writing this

Recorded here because a later reader will otherwise trip on them.

| Drift | Detail | Handling |
|---|---|---|
| **Coverage ledger is stale by 3 IDs** | `docs/dispatch/2026-08-08-plug-n-pay-downstream-specs/coverage-ledger.md` indexes 183 identifiers and 76 `FR-*` IDs. `REQUIREMENTS.md` now defines **79** `FR-*` IDs — `FR-BOOTH-14`, `FR-BOOTH-15`, `FR-BOOTH-16` (`REQUIREMENTS.md:437-439`) postdate the ledger. Verified by set-difference over both files. | This document covers all 79. The ledger remains the completeness checklist for the other 180 IDs. |
| **Booth spec line numbers shifted ~5** | `2026-08-08-booth-frontend-design.md` is **626** lines, not 620. Citations in this document are against the current file and were each re-read. | Cite current lines only. |
| **`FR-REL-9` is DONE** | The RPC measurement was run and recorded at `REQUIREMENTS.md:702-725`. It is no longer "the first task of the build." | §12 names its replacement: the **write-path** probe, which `REQUIREMENTS.md:725` explicitly says was not run. |

---

## 1. Context and the contribution

Plug-N-Pay invents neither identity nor metering. It wires the output of two solved
problems into a ledger fast enough to keep up with them (`idea.md:121`).

```
     ISO 15118 Plug & Charge                    OCMF-style signed metering
     identity — already solved                  measurement — already solved
     (CON-7: full stack out of budget,          (FR-MET-3: every reading signed;
      FR-ID-2: "modelled on", never              FR-MET-5: simulated is labelled
      "conformant")                              as simulated)
              │                                              │
              │  verified identity → wallet                  │  signed (seq, whDelta, kW)
              ▼                                              ▼
     ┌────────────────────────────────────────────────────────────────┐
     │                      P L U G - N - P A Y                       │
     │                                                                │
     │   M1 registry     M5 relay  ◄── the named trust boundary        │
     │   binds identity   verifies signatures OFF-CHAIN (ASM-6)        │
     │   to wallet        attests to the contract that it did          │
     │        │                        │                              │
     │        └────────────┬───────────┘                              │
     │                     ▼                                          │
     │              M4 settlement contract                            │
     │              computes whDelta × price ON-CHAIN (IF-4)          │
     └────────────────────────────────────────────────────────────────┘
                                    ▼
                    Monad testnet — 300 ms blocks, 600 ms finality
                    (https://docs.monad.xyz/, fetched 2026-08-08)

              economic ONLY at this cost profile — the whole claim
                        (idea.md:30, RSK-5 mitigation)
```

**The contribution in one sentence.** Payment obligation exists only where signed
metering exists, it moves once per tick rather than once per invoice, and the mechanism
for charging and discharging is one code path with a sign flip (FR-SET-7).

**What the project is not** (`REQUIREMENTS.md:29`, `idea.md:66`): a consumer
application. Actor A6, the driver, owns no user interface in this system. The live
ticking number in `story.md:5` is what a downstream app builds on this rail.

**Why the chain matters, stated so it survives RSK-5.** The primitive — streaming
value — is not new. What is new is that per-tick *discrete on-chain settlement* is
affordable at all. At the documented minimum base fee of 100 MON-gwei
(`.agents/skills/gas/SKILL.md:44`), a settlement tick costs on the order of
0.006–0.015 MON (§6). Do not claim the primitive is new. Claim the cost profile is what
makes the literal version buildable.

---

## 2. Component and deployment view

### 2.1 The processes that actually exist

Nine modules (`REQUIREMENTS.md:177-187`) collapse onto **five running processes** plus
one contract. Modules are a decomposition of responsibility; they are not a
decomposition of deployment, and conflating the two is how a four-hour build acquires
five servers it does not need.

| Process | Runtime | Hosts modules | Trust boundary? | ▶ Freeze |
|---|---|---|---|---|
| **`relay`** | Node.js, one process, operator's laptop | **M5** relay, **M1** registry client, **M2** metering simulator, **M3** rate source, **M6** spawner, **M9** control API | **YES — the trust boundary** (ASM-6) | ▶ |
| **`wall`** | Browser, fullscreen, projector 1920×1080 | **M7** dashboard | No — render only | ▶ |
| **`ops`** | Browser, operator's second screen (or a panel on `wall`) | **M9** operator surface | No — authenticated to `relay` by shared secret | ▶ |
| **`booth-fn`** | Vercel serverless functions + Upstash Redis | **M8** backend | No | — |
| **`booth-app`** | Mobile browser, portrait | **M8** frontend | No — holds an ephemeral key only (FR-BOOTH-9) | — |
| **`PlugNPay.sol`** | Monad testnet, chain 10143 | **M4** contracts | On-chain — trusts `relay`'s attestation | ▶ |

**Why M1, M2, M3, M6 and M9 live inside the `relay` process.** They share the tick
loop, the rate table and the identity pool. Splitting them across processes buys
isolation nobody needs today and costs inter-process latency inside NFR-P-3's 1-second
budget. They stay separate **modules** with separate files and separate interfaces
(`DESIGN.md` §M1–M9), so the split is a refactor, not a rewrite.

**Reversal trigger for the single-process choice.** If the metering simulator's CPU
cost starves the relay's submission loop at N=10 — observable as submission jitter
above 100 ms in the relay's own timing log — move M2 and M6 to a child process
communicating over a Unix socket. Nothing above the metering interface changes
(FR-MET-8, `REQUIREMENTS.md:348`).

### 2.2 Topology

```
┌─ VENUE LAN ─────────────────────────────────────────────────────────────┐
│                                                                          │
│   ┌──────────────────────────── relay (Node.js) ──────────────────────┐  │
│   │                                                                    │  │
│   │  M2 metering  ──signed Reading──►  M5 relay core                   │  │
│   │  M6 spawner   ──open/close────►      ├─ verify sig (ASM-6, IF-1)   │  │
│   │  M3 rates     ──price─────────►      ├─ replay guard (FR-MET-7)    │  │
│   │  M1 registry  ──id→wallet─────►      ├─ wallet pool (FR-REL-8)     │  │
│   │  M9 control API ◄──ops────────►      ├─ nonce ledger (FR-REL-3)    │  │
│   │                                      └─ mode state (FR-REL-5)      │  │
│   │                                            │            │           │  │
│   └────────────────────────────────────────────┼────────────┼──────────┘  │
│                          SSE (FD-3, FR-DASH-8) │            │             │
│                                                ▼            │             │
│                                       ┌──────────────┐      │             │
│   ops (browser) ──HTTP POST──────────►│ wall (browser)│     │             │
│                                       │  M7 dashboard │      │             │
│                                       └──────────────┘      │             │
└─────────────────────────────────────────────────────────────┼─────────────┘
                                                              │
                            eth_sendRawTransactionSync (§4, ADR-3)
                                                              ▼
                                            ╔═════════════════════════════╗
                                            ║  Monad testnet · 10143      ║
                                            ║  PlugNPay.sol (M4)          ║
                                            ║  https://testnet-rpc        ║
                                            ║       .monad.xyz            ║
                                            ╚═════════════════════════════╝
                                                              ▲
┌─ PUBLIC INTERNET ───────────────────────────────────────────┼─────────────┐
│                                                             │             │
│  booth-app (phone) ──polling──► M10 game-server (cloud)                   │
│   M8 frontend        (FD-3)       in-memory engine + Upstash              │
│   ZERO chain calls                                                        │
│   no key material                      ╳  NO PATH TO THE CHAIN            │
│   (FR-SPLIT-1)                            (FR-SPLIT-1 — see §16.4)        │
│                                                                            │
│                    the ONLY crowd→chain line, once, at the close:          │
│                    GET /game/aggregate ──► relay ──► settleRoomAggregate   │
│                                            (FR-SPLIT-7/8, ADR-9)           │
└──────────────────────────────────────────────────────────────────────────┘

**⚠ Superseded topology above.** The `relay`/`wall` half of this diagram is current; the
booth half was redrawn here after `REQUIREMENTS.md` §16. **§17.1 carries the authoritative
deployment topology**, including the game server's hosting constraint.
```

**Deployment precondition for FD-3's SSE hop.** `wall` must reach `relay` directly —
same laptop or same LAN. No Vercel function sits in that path, which is precisely why
the 300 s Hobby streaming cap (`2026-08-08-booth-frontend-design.md:32`) does not apply
to it. **Reversal trigger:** if `wall` has to be served from Vercel for any reason,
SSE dies on that hop and the wall reverts to 1 Hz polling of `relay` — which the relay
can serve trivially at one client. Decide this when the wall's URL is decided, not on
stage.

### 2.3 Trust boundaries, marked

| # | Boundary | Crossed by | What is trusted across it |
|---|---|---|---|
| **TB-1** | **Meter → relay** | signed `Reading` (IF-1) | Nothing. The relay verifies the signature against the registered `meterId` key before any value moves. |
| **TB-2** | **Relay → contract** | `settle(sessionId, seq, whDelta)` | **Everything.** The contract trusts that the relay checked the signature (ASM-6, `REQUIREMENTS.md:154`). This is the boundary. §3. |
| **TB-3** | **Booth app → relay** | `POST /relay/tick` | Nothing structurally — but the booth's ephemeral key (FR-BOOTH-9) is generated client-side and registered by the relay, so a booth "meter" is only as trustworthy as the game engine that drives it. §10. |
| **TB-4** | **Ops → relay** | shared-secret header | The operator. Physical control of the laptop is the security model, and that is adequate for a demo (NFR-S-5). |
| **TB-5** | **Relay → wall** | SSE event stream | The wall renders what the relay sends and labels its provenance (FR-DASH-6, IF-7). The wall never asserts a figure is on-chain unless the event carries a `txHash`. |

---

## 3. The trust boundary — ASM-6 in full

This section is the one a hostile reviewer reads first. It is written to be quoted.

### 3.1 What is true

Signature verification against the metering key happens **off-chain, in the relay
(M5)**, not per-signature in the M4 contract (ASM-6, `REQUIREMENTS.md:154`; IF-1,
`REQUIREMENTS.md:486`). The contract trusts the relay's submission as an attestation
that the check already happened.

**Why.** On-chain verification of every tick from every concurrent session is a
secp256k1 recovery per tick inside the settle path. At the 10 tx/s design budget (§4)
that is 10 recoveries per second paid for at `gas_limit` pricing
(`.agents/skills/gas/SKILL.md:13`), on top of an RPC budget that has no room for the
larger transactions. The requirements reached the same conclusion
(`REQUIREMENTS.md:678`).

### 3.2 The attack this admits — stated precisely, with its blast radius

**A compromised or malicious relay can fabricate an energy delta for a session that is
already open, and the contract will settle it.** The contract has no means to establish
that a signed reading ever existed.

The blast radius is bounded, and the bounds are worth stating because they are what
makes this a boundary rather than a hole:

| The relay **can** | The relay **cannot** | Why not |
|---|---|---|
| Overstate `whDelta` on an open session | Open a session between parties that are not registered | Sessions are opened against registry-bound identities (FR-ID-3/4, `REQUIREMENTS.md:331-332`) |
| Settle a tick that no meter produced | Redirect payment to an address of its choosing | `payer`/`payee` are fixed in storage at session open (FR-SET-1) and `settle()` takes **no address parameter** (§10.2) |
| Drain a payer up to its funded balance | Drain a payer beyond its funded balance | FR-SET-8 (`REQUIREMENTS.md:371`) — the contract's own guard, not the relay's |
| Suppress a tick (censor) | Invent MON out of nothing | Value moves between the session's two existing balances only |

**One sentence for the pitch:** *the relay can lie about how much energy flowed inside a
session that already exists, up to the payer's funded balance; it cannot invent a
counterparty, redirect a payment, or exceed the payer's funding.*

### 3.3 The production path that closes it

Named in NFR-M-4 (`REQUIREMENTS.md:566`): a **ZK proof of the verified batch**. The
relay produces a succinct proof of the statement *"I checked K signatures against
registered meter public keys, and the whDeltas of those K readings sum to X"*, and the
contract verifies the proof instead of trusting an attestation. TB-2 then carries a
proof rather than a promise.

Not built today. It sits in §14 out-of-scope territory (`REQUIREMENTS.md:729`) and is
described as the production path rather than dropped in silence.

### 3.4 The exact wording the pitch and the README must use (NFR-M-4)

**Required — copy this verbatim:**

> Meter signatures are verified by the relay, off-chain. The contract settles on the
> relay's attestation that it checked them. That is a trust boundary and we are naming
> it: we **verify** signatures, we do not verify them trustlessly on-chain. Closing it
> needs a ZK proof of the verified batch submitted with each settlement, which is the
> production path and is not built today.

**Forbidden — every one of these is a defect, not a rough edge**
(`CLAUDE.md`, honesty constraints; FR-SET-2, `REQUIREMENTS.md:365`):

- ❌ "trustlessly verifies on-chain"
- ❌ "trustless settlement"
- ❌ "the chain verifies every meter signature"
- ❌ "no trusted party"
- ❌ any sentence where "verify" appears without an off-chain/on-chain qualifier nearby

**Permitted:** "verifies", "checks", "validates off-chain", "attests".

---

## 4. The RPC budget

> ### 🔴 BOTH RPC CEILINGS RETRACTED — no number in this section is a capacity limit
>
> **Retracted at source**, commit `d47a36c`, `REQUIREMENTS.md:726-740`. **Neither
> "40–45 req/s" nor "10 tx/s" may be quoted as a capacity limit anywhere, by anyone.**
>
> A re-test from the same wallet returned **25 tx/s: 75/75 clean · 40 tx/s: 109/120 ·
> 60 tx/s: 180/180 clean**. **A failure rate that does not rise with load is not a
> ceiling.** The 40 tx/s losses were all `The request timed out`, and the same wallet
> then ran 60 tx/s without a single failure. The read measurement has the identical
> defect — 3 refusals in 270 at 45 req/s called a knee on the same reasoning. Every run
> used the shared public key `0x…0001`, whose nonce moved 20 → 89 between runs, so
> strangers were transacting from it and contention was never ruled out.
>
> **Use instead: at least 60 tx/s single-wallet, ceiling unknown, expect ~1–3% transient
> timeouts at any rate.**
>
> Three claims below are void: the **"knee"** in §4.1, the **"26% / 4× headroom"** in
> §4.2, and §4.3's reasoning about N=50 (its *conclusion* survives on other grounds —
> see §16.10). The booth rows are moot for a separate reason (FR-SPLIT-1).
>
> **The one durable finding: transient timeouts occur at a low single-digit rate at every
> load tested, so the relay needs retry** — which it needed anyway (§8, §M5.9).
>
> **§16.10 carries the corrected position.** Kept rather than deleted because three
> decisions were made on these numbers and the record should show why.

The bottleneck. Everything else in this document is downstream of this table.

### 4.1 The ceiling — measured, not assumed

`FR-REL-9` is complete. `tools/measure-rpc.mjs` was run against
`https://testnet-rpc.monad.xyz` on 2026-08-08 (`REQUIREMENTS.md:702-717`):

| req/s | ok | 429 | p50 ms | p95 ms |
|---|---|---|---|---|
| 20 | 100/100 | 0 | 21 | 108 |
| 40 | 200/200 | 0 | 81 | 162 |
| **45** | 267/270 | **3** | 99 | 147 |
| **50** | 296/300 | **4** | **456** | 731 |
| 70 | 416/420 | 4 | 1,960 | 3,815 |

**The knee is between 40 and 45 req/s** (`REQUIREMENTS.md:717`).

Three qualifications that the number does not carry on its face:

1. **These are reads** (`eth_blockNumber`). Writes add signature recovery, nonce
   ordering and admission. The write ceiling is **strictly lower than 40**
   (`REQUIREMENTS.md:722`). Nobody has measured it — §12 W0.
2. **The published figure is 50 rps** (`docs/monad_dev_resources.md:141`; corroborated
   against https://docs.monad.xyz/developer-essentials/testnets, fetched 2026-08-08).
   Measurement came in under it. Measurement wins.
3. **Scope is undocumented** — per-IP, per-key or global is not published anywhere
   (https://docs.monad.xyz/developer-essentials/testnets and
   https://docs.monad.xyz/reference/rpc-limits, both fetched 2026-08-08, neither states
   scope). §11 C3.

**Design ceiling adopted: 40 req/s. Design budget adopted: 10 req/s.** The 4× gap is
not spare capacity. It is the margin against a shared venue IP, against writes costing
more than reads, and against the p95 tail.

### 4.2 Every RPC call the system makes, per second

Assumes `eth_sendRawTransactionSync` (ADR-3), local nonce tracking (ADR-2), and the
relay-sourced wall feed (ADR-7). Booth traffic terminates at Vercel and the relay, not
at the RPC, under the default configuration (ADR-6).

| Source | Call | N=10 @ 1 Hz (AC-5) | N=60 @ 6 s (NFR-P-2) | N=50 @ 1 Hz (dead stretch) |
|---|---|---|---|---|
| M5 settlement | `eth_sendRawTransactionSync` | **10.0** | **10.0** | **50.0** |
| M5 receipts | `eth_getTransactionReceipt` | **0** — folded into the send | **0** | **0** |
| M5 nonces | `eth_getTransactionCount` | **0** steady-state — tracked locally | **0** | **0** |
| M5 health | `eth_getBalance`, 1 wallet / 5 s | 0.2 | 0.2 | 0.2 |
| M7 wall | chain log subscription | **0** — fed by relay (ADR-7) | **0** | **0** |
| M8 booth | — | 0 (terminates at Vercel) | 0 | 0 |
| M6 opens/closes | `settle`-path opens | amortised <0.3 | amortised <0.3 | amortised <0.3 |
| **TOTAL** | | **≈10.5** | **≈10.5** | **≈50.5** |
| **Against the 40 req/s ceiling** | | **26%** ✅ | **26%** ✅ | **126%** ❌ |

### 4.3 Does N=50 fit? No.

**Stated plainly, as required.**

**N=50 at 1 Hz does not fit and must not be attempted live.** 50 tx/s is 50 RPC
calls/s at best. The measured knee is 40–45 req/s for *reads*, and writes are dearer.
At 50 req/s the measurement already shows p50 latency collapsing from 81 ms to 456 ms
(`REQUIREMENTS.md:712-713`) — a 5.6× degradation that would put NFR-P-3's 1-second
wall-visibility budget in jeopardy before a single 429 was returned. Attempting it live
walks directly into RSK-1, the worst identified failure mode
(`REQUIREMENTS.md:633`). `REQUIREMENTS.md:722` reached this conclusion independently.

**What the pitch says instead.** The claim moved from *concurrency at 1 Hz* to
*concurrency at a stated cadence*, and the requirements were already amended to match
(NFR-P-2, `REQUIREMENTS.md:522`):

> **Sixty concurrent sessions, settling on-chain every six seconds — ten separate
> transactions every second, each one its own transaction hash you can click.**

That is true, it is measured, and it is a bigger concurrency number than the 50 that
was dropped. **Sixty sessions is a stronger claim than fifty; the honest part is the
cadence, and stating the cadence costs the pitch nothing.**

**⚠ A presenter line in the booth spec is now factually wrong.**
`2026-08-08-booth-frontend-design.md:600` reads *"That number is sixty payment streams
settling per second on Monad."* At the 6-second cadence mandated by FR-BOOTH-15
(`REQUIREMENTS.md:438`), sixty streams produce **ten** settlements per second, not
sixty. The line overstates by 6× and violates CON-6 in front of the exact audience
CON-6 names (`REQUIREMENTS.md:142`). Per FD-5 this document annotates rather than
rewrites the booth spec. **Replacement line, same length, same beat:**

> *"That number is sixty payment streams settling on Monad — ten transactions every
> second, live, right now."*

### 4.4 The 50-session stretch, if it is wanted at all

Two honest routes, both already sanctioned by `REQUIREMENTS.md:722` ("Run the stretch
from a recording, or drop the claim"):

- **Recording** (FR-OPS-5, `REQUIREMENTS.md:449`) with an on-screen caption naming it a
  recording. Labelled, never disguised (NFR-R-3).
- **50 sessions at 5 s = 10 tx/s.** Fits the budget exactly. Delivers "fifty concurrent
  sessions" truthfully. Requires no new capacity, only the cadence sentence.

### 4.5 Multi-endpoint sharding — the mitigation, with its caveat

Three independent public endpoints exist (`docs/monad_dev_resources.md:141-143`):

| Endpoint | Published limit | Batch | Archive |
|---|---|---|---|
| `https://testnet-rpc.monad.xyz` (QuickNode) | 50 rps; 25 rps for `eth_call`/`eth_estimateGas` | 100 | Yes |
| `https://rpc.ankr.com/monad_testnet` (Ankr) | 300 / 10 s ≈ 30 rps avg; 12k / 10 min | 100 | No; no `debug_*` |
| `https://rpc-testnet.monadinfra.com` (Monad Foundation) | 20 rps | **not allowed** | Yes |

Round-robining the wallet pool across all three gives a combined ceiling of roughly
**100 rps**.

**The caveat, stated as loudly as the number.** This is a synthesis from three
separately-published figures. **No Monad document recommends it, and no Monad document
states that the three limits are independent** (`monad-facts.md` hard constraint 11).
If they share a backend quota the combined figure is fiction. Two further risks: Ankr
serves no archive data, so any explorer-style backfill must not land there; and the
three endpoints may disagree on head block by a block or two, which would make
settlement ordering look non-monotonic on the wall.

**Verdict: build the endpoint list as configuration, ship with one endpoint, shard only
if the venue measurement in §12 W0 comes back below 15 req/s.** Sharding is a
five-minute config change and a real risk; it should be a decision made on a number,
not a default.

---

## 5. The wallet pool model

> ### 🔴 THE WALLET POOL IS NOT SUPPORTED BY EVIDENCE — do not build it before freeze
>
> **`REQUIREMENTS.md:737`:** *"FR-REL-8's wallet pool is not supported by evidence. A
> single wallet sustained 60 tx/s… the pool should not be built on this measurement."*
>
> Every sizing in this section is void. It derived 6–10 wallets from a 600 ms occupancy
> model, then §16.8 re-derived 2–3 from a 10 tx/s measurement. **Both inputs are gone:**
> the occupancy model was wrong (§16.8 explains how), and the measurement it was corrected
> against has been retracted.
>
> **Current position: one wallet, and FR-REL-8 downgraded to optional-unproven.** A single
> wallet ran 60 tx/s clean — six times the entire rail load. Ten sessions at 1 Hz is
> nowhere near any observed limit.
>
> **What survives and still matters:** §5.1's nonce-ordering argument (unproven at demo
> rates, not disproven), §5.3's **10 MON reserve floor** — a real documented rule with a
> real throttle below it — and §5.5's bring-up procedure with the 3-block funding delay.
> Funding one wallet above the floor is ~12–15 MON: **one faucet claim, no consolidation
> exercise.**
>
> **§16.10 carries the corrected position and names the measurement that would settle it.**

### 5.1 Why a pool exists at all

Three documented facts force it:

1. **No global mempool.** "There is no global mempool. For efficiency, transactions are
   forwarded to the next few leaders" (https://docs.monad.xyz/developer-essentials/differences,
   fetched 2026-08-08; matches `docs/monad_dev_resources.md:238`).
2. **Strict per-account nonce order.** Parallel execution does not relax it — "the
   final result is identical to sequential Ethereum execution"
   (`.agents/skills/concepts/references/parallel-execution.md:3`).
3. **Nonce-gap behaviour is undocumented** (`monad-facts.md` Unverified #2 — three local
   reference files and https://docs.monad.xyz/developer-essentials/differences checked,
   none address it). Combined with (1), a gapped transaction has a much narrower window
   to be picked up than on Ethereum, where a persistent mempool can hold it.

Together: **one wallet, one in-flight transaction at a time.** Throughput comes from
parallel *independent* nonce sequences, which is FR-REL-8 (`REQUIREMENTS.md:387`).

### 5.2 Sizing from first principles

A wallet is occupied from submit until the `eth_sendRawTransactionSync` call returns.

```
occupancy = wait_for_next_block + speculative_execution + rpc_round_trip

  wait_for_next_block      = 300 ms / 2      = 150 ms   (block time 300 ms:
                                                          https://docs.monad.xyz/,
                                                          fetched 2026-08-08;
                                                          docs/monad_dev_resources.md:95)
  speculative_execution    ≈                   150 ms   (receipt available at Proposed
                                                          state: block-states.md:7)
  rpc_round_trip p50       =                    24 ms   (REQUIREMENTS.md:710, at 10 req/s)
                                               ───────
  occupancy p50            ≈                   324 ms
  occupancy, 2× margin     =                   600 ms   ← size against this
```

```
wallets_needed = throughput × occupancy
               = 10 tx/s × 0.6 s
               = 6 wallets                          ← HARD FLOOR
```

| Target | Arithmetic | Wallets | Verdict |
|---|---|---|---|
| **10 tx/s (AC-5 and NFR-P-2 both)** | 10 × 0.6 | **6 floor, 10 shipped** | ✅ 4 spare for retries and one wallet out of rotation |
| 20 tx/s | 20 × 0.6 | 12 | Possible; over the 10 tx/s design budget, so moot |
| 50 tx/s (dead stretch) | 50 × 0.6 | **30, plus margin = 40** | ❌ Funding alone kills it — §5.4 |

**Ship 10 wallets.** Six is the floor; ten leaves room for a retry storm and for
removing a wallet that drifts below the reserve floor without dropping under six.

### 5.3 Two funding regimes — the reserve balance decides which

`.agents/skills/concepts/references/reserve-balance.md` defines a 10 MON floor per EOA
(line 3). The behaviour on each side of it is different enough to be two designs.

**Regime A — every wallet above 10 MON. This is the design.**

The binding rule is a cumulative gas budget of `min(10 MON, lagged_state_balance)`
across all in-flight transactions in the past 3 blocks
(`.agents/skills/concepts/references/reserve-balance.md:12`). At ~0.015 MON per
settlement (§6), a wallet would need **~666 transactions inside one 1.2 s window** to
touch that cap. It never binds here. Occupancy (§5.2) is the only limit.

**Regime B — wallets below 10 MON. Cheaper to fund, and unverified.**

"Low-balance accounts (below 10 MON) can only send one transaction every 3 blocks
(~1.2 seconds)" (`.agents/skills/concepts/references/reserve-balance.md:9`, quoted).

```
per-wallet rate  = 1 tx / 1.2 s = 0.833 tx/s
wallets needed   = 10 ÷ 0.833   = 12 wallets
```

Twelve wallets at ~2 MON each is **~24 MON total** against Regime A's 150 MON (§5.4) —
six times cheaper to fund, which matters a great deal if the faucet is stingy.

**⚠ Regime B carries an unresolved question and must not be relied on until it is
tested.** The same reference states a transaction reverts if the ending balance drops
below `min(starting_balance, 10 MON)`
(`.agents/skills/concepts/references/reserve-balance.md:8`). Read literally, a wallet
holding 2 MON has a guard of `min(2, 10) = 2 MON`, and paying any gas at all takes it
under. That reading contradicts line 9, which says such accounts *can* send one
transaction per 3 blocks. **The two lines cannot both be literally true and the
reference does not disambiguate them.** Labelled unverified rather than guessed.

**The test is five minutes and it is in the build order (§12 W0):** fund one throwaway
wallet with 2 MON, send one `settle()`, read the receipt. If it succeeds, Regime B is
available as the cheap fallback. If it reverts, Regime B does not exist and the only
lever left is fewer sessions.

### 5.4 Total MON to acquire — the hard number

Gas is not the constraint. **The reserve floor is.**

```
Per-wallet funding, Regime A:
  reserve floor to stay above                                     10.00 MON
  gas burn per wallet for one 180 s run
     (1,800 tx ÷ 10 wallets) × 0.015 MON                           2.70 MON
  margin for 2 rehearsals at the same rate                         5.40 MON
                                                                  ──────────
  per wallet                                                      18.10 MON
  ship (round down to a claimable number, top up between runs)    15.00 MON  ← per wallet

POOL TOTAL, Regime A:  10 wallets × 15 MON            =          150 MON
  of which permanently resident (never spendable)     =          100 MON
  of which actually burned across run + 2 rehearsals  ≈           35 MON
```

Supporting arithmetic, sourced:

| Quantity | Value | Source |
|---|---|---|
| Minimum base fee | 100 MON-gwei = 1×10⁻⁷ MON/gas | `.agents/skills/gas/SKILL.md:44` |
| Documented gas floor for `settle()` | 63,500 gas (21,000 + 10,100 + 4×8,100) | `.agents/skills/gas/SKILL.md:22,115,116,121`, summed |
| Assumed practical gas limit | **150,000 gas — a guess**, ≈2.4× the floor, covering control flow, `require`s and event emission that carry no Monad-specific figure | `monad-facts.md` Q6 A4, explicitly not sourced |
| Cost per tick, floor / assumed | 0.00635 / **0.015 MON** | 63,500 × 1e-7 / 150,000 × 1e-7 |
| Ticks in one 180 s run at 10 tx/s | 1,800 | 180 × 10 |
| Burn per run, floor / assumed | 11.43 / **27.0 MON** | 1,800 × cost |
| Identity pool registration, 60 identities | ~0.6 MON | 60 × ~100,000 gas × 1e-7 |

**Two comparisons that make the priority obvious:**

- Burn for the whole demo (27 MON) is **less than two wallets' reserve floor** (20 MON).
- The 50-session stretch would need 40 wallets × 15 MON = **600 MON**, which is a
  funding problem before it is an RPC problem. §4.3's verdict is over-determined.

### 5.5 ⚠ Pre-demo funding checklist — ASM-1 and RSK-4, made concrete

ASM-1 (`REQUIREMENTS.md:149`) assumes the faucet supplies enough MON and states its
per-request limits are unverified. RSK-4 (`REQUIREMENTS.md:636`) says size to ten
rather than fifty. Neither names a number. **The number is 150 MON.**

**The problem, named plainly.** The booth spec records the faucet's amount and rate
limit as **UNVERIFIED**, with circulating figures of 0.5–10 MON once per 24 h tracing
only to third-party aggregators
(`2026-08-08-booth-frontend-design.md:41`). If the real figure is 10 MON per address
per 24 h, then **the faucet cannot by itself put any wallet above the 10 MON floor** —
a wallet funded to exactly 10 MON drops below it on its first transaction and is
throttled to 0.833 tx/s from that moment.

**Therefore the pool must be funded by consolidation, not by direct claim.** Claim to
many throwaway addresses, sweep into the ten pool wallets. That is one extra
transaction per claim and it is the difference between Regime A and Regime B.

| ☐ | Item | Gate | Owner |
|---|---|---|---|
| ☐ | Verify the faucet's actual per-address amount and interval — replaces the UNVERIFIED note | **T-4h**, first thing | Relay |
| ☐ | Claim + consolidate to **≥100 MON** across ≥6 wallets | T-3h | Relay |
| ☐ | Every pool wallet reads **≥ 12 MON** via `eth_getBalance` | T-2h | Relay |
| ☐ | Funding transfers are **≥3 blocks / minutes old** before first use (§5.5.1) | T-2h | Relay |
| ☐ | Regime B probe: 2 MON wallet sends one `settle()` — succeeds or reverts | T-3h | Relay |
| ☐ | Identity pool (60) registered and confirmed — FR-SIM-6 | T-2h | Relay |
| ☐ | **If total < 100 MON at T-2h:** cut N to `floor(pool_MON / 15)` sessions and say the number out loud | T-2h | Lead |

**The last row is the honest fallback and it is cheap to execute.** Concurrency is a
runtime parameter (FR-SIM-1, IF-11). Reducing it costs one number in a config file and
one sentence in the pitch.

#### 5.5.1 Bring-up sequence — the 3-block funding delay

"Newly funded accounts cannot send transactions until their funding transfer is `D`
blocks old (~1.2 seconds after the transaction is included). This is because consensus
validates gas budgets against the delayed state, and the funding won't be visible yet"
(`.agents/skills/concepts/references/async-execution.md:8`, quoted verbatim; `D=3`,
line 7).

```
T-3h00  claim faucet → throwaway addresses
T-2h50  sweep → 10 pool wallets                      ┐
T-2h49  ... 3 blocks elapse (~1.2 s)                 │  in practice, minutes of margin —
T-2h45  verify every balance ≥ 12 MON                │  never fund-and-spend in one script
T-2h40  register 60 identities from pool wallet #1   ┘
T-2h30  smoke test: one settle() from every wallet, all 10 receipts confirmed
```

**Do not poll balance as a readiness signal.** The reference states only that `eth_call`
and `eth_estimateGas` simulate against speculative state
(`.agents/skills/concepts/references/async-execution.md:11`); it does not say what
`eth_getBalance` returns in that window (`monad-facts.md` Unverified #3). A naive
"poll until the balance updates, then spend" script can see the new balance and still
have the spend rejected. **Readiness is a successful test transaction, not a balance
read.** That is what the T-2h30 smoke test is for.

**Live registration is unaffected.** FR-BOOTH-9's ephemeral booth keys
(`REQUIREMENTS.md:432`) hold no MON — the relay pays for their registration from an
already-funded pool wallet. The 3-block delay applies to funding transfers, and there
is no funding transfer in that path.

### 5.6 Nonce management — the two modes of FR-REL-3

FR-REL-3 (`REQUIREMENTS.md:382`) explicitly covers two modes and says to build for the
one in play. Both are specified because the reversal trigger in §13/ADR-1 can fire.

**Mode 1 — per-tick, FR-REL-1 primary. Parallel nonce sequences across the pool.**

- Each wallet owns an in-memory `nextNonce`, seeded **once** at bring-up from
  `eth_getTransactionCount(addr, "pending")`, then incremented locally on every
  successful submit. Never re-read on the hot path — `monad-facts.md` Q4 implication (b)
  warns that a read taken right after a submit is not a trustworthy readiness signal,
  and it would also double the RPC cost per tick.
- Exactly one in-flight transaction per wallet. A wallet is `BUSY` from submit until the
  sync call returns, and is not re-allocated while `BUSY`.
- **On failure, do not increment.** A rejected transaction consumed no nonce. Re-arm the
  same nonce on the same wallet. Incrementing past a failure creates the gap that §5.1
  fact (3) says may never be picked up.
- **Resynchronise on drift.** If a wallet returns "nonce too low" or "nonce too high",
  mark it `DRAINING`, let its in-flight call settle, re-read
  `eth_getTransactionCount(addr, "pending")` once, and return it to the pool. Budget
  ≤1 resync/s across the whole pool so a systemic problem cannot itself become a
  request storm.

**Mode 2 — batched, FR-REL-2 fallback. One serialised pipeline.**

- One wallet, one nonce counter, strictly serial: batch *n+1* is not submitted until
  batch *n* confirms or is abandoned. Nothing more is built
  (`REQUIREMENTS.md:685`).
- The pool still exists but only one wallet is active; the rest idle. This keeps the
  reversal a configuration change rather than a rewrite.

### 5.7 Transaction ordering — a caveat the wall must not contradict

Transactions inside a block are ordered by descending total gas price, not by arrival
time (`.agents/skills/gas/SKILL.md:64`). Ten wallets submitting near-simultaneously at
the same tip have **no guaranteed relative on-chain order**.

Consequence for M7: the wall's feed is ordered by *arrival at the relay*, and must not
claim to be a chain-ordered ledger. Per-session ordering is guaranteed by the `seq`
monotonicity rule (IF-2) and by one-in-flight-per-wallet; cross-session ordering is not.
No requirement depends on cross-session ordering, and none should be added.

---

## 6. Gas model

### 6.1 The charging rule that changes the design

**Monad charges on `gas_limit`, not on gas used**
(`.agents/skills/gas/SKILL.md:13`; `docs/monad_dev_resources.md:236`). Every transaction
pays for the limit it declared.

`gas_paid = gas_limit × price_per_gas`, where
`price_per_gas = min(base + priority, max)` (`.agents/skills/gas/SKILL.md:29`).

Two consequences that would otherwise be missed:

- A generous limit is not free insurance. It is a direct cost multiplier on every one of
  1,800 transactions.
- Ceiling values are not free either: transaction gas limit is 30,000,000
  (`.agents/skills/gas/SKILL.md:43`) and block gas limit is 200,000,000
  (`.agents/skills/gas/SKILL.md:42`). Declaring the transaction ceiling on a tick would
  cost 3 MON per tick at the minimum base fee — 5,400 MON for one demo run.

### 6.2 `eth_estimateGas` must never be on the per-tick path

Three independent reasons, any one sufficient:

1. **It doubles the RPC cost per tick** — 10 tx/s becomes 20 req/s, half the measured
   ceiling, for a number that does not change between ticks.
2. **It is rate-limited at half the general limit** — 25 rps for
   `eth_call`/`eth_estimateGas` against 50 rps general
   (`docs/monad_dev_resources.md:141`; https://docs.monad.xyz/developer-essentials/testnets,
   fetched 2026-08-08). It is the *first* thing to start refusing.
3. **It adds latency inside NFR-P-3's budget** for no information gain.

**Rule: measure once during W1, hardcode the constant, assert against it in CI.**
(`CLAUDE.md`: "Measure each hot-path function's real cost once, then hardcode a tight
limit. Do not call `eth_estimateGas` on a per-tick path.")

### 6.3 Per-function limits — measure, then hardcode

Every value below is `TO MEASURE` in W1. The "budget" column is a **guess** used for
funding arithmetic only, derived from the documented opcode costs in §5.4; it is not a
Monad-published figure for these functions.

| Function | Cold storage touched | Budget (guess) | Measured | Hardcoded limit |
|---|---|---|---|---|
| `registerIdentity` | 2 slots | 100,000 | `TO MEASURE` | measured × 1.25 |
| `openSession` | 5 slots | 180,000 | `TO MEASURE` | measured × 1.25 |
| `settle` **(hot path)** | 4 slots + 1 value transfer | **150,000** | `TO MEASURE` | **measured × 1.15** |
| `closeSession` | 2 slots | 80,000 | `TO MEASURE` | measured × 1.25 |
| `setRate` | 2 slots | 90,000 | `TO MEASURE` | measured × 1.25 |

**Why `settle` gets a tighter 1.15× multiplier than everything else.** It runs 1,800
times per demo; the others run tens of times. A 10-point difference in margin is worth
about 2 MON per run on `settle` and nothing measurable elsewhere. The margin is not
zero because the base fee rises under load via the base-fee controller
(`.agents/skills/gas/SKILL.md:52-58`) and a limit that is too tight reverts the
transaction outright.

Underlying opcode costs, for whoever checks the arithmetic:

| Access | Cold | Warm | Source |
|---|---|---|---|
| Account (`BALANCE`, `CALL`) | 10,100 | 100 | `.agents/skills/gas/SKILL.md:115,117` |
| Storage (`SLOAD`, `SSTORE`) | 8,100 | 100 | `.agents/skills/gas/SKILL.md:116,118` |
| Plain native transfer | 21,000 | — | `.agents/skills/gas/SKILL.md:22` |

**Design note that pays for itself.** Cold storage at 8,100 gas against warm at 100 is
an 81× difference. `settle()` packs its hot session fields into as few slots as possible
(`DESIGN.md` §M4.2) precisely because of this ratio — the storage layout is a gas
decision, not a style decision.

### 6.4 Burn estimate

| Scenario | Ticks | At 63,500 gas (documented floor) | At 150,000 gas (guess) |
|---|---|---|---|
| One 180 s run at 10 tx/s | 1,800 | 11.43 MON | **27.0 MON** |
| Run + 2 rehearsals | 5,400 | 34.3 MON | **81.0 MON** |
| 50-session, 1 Hz, 180 s *(not built)* | 9,000 | 57.2 MON | 135 MON |

Computed at the documented minimum base fee (`.agents/skills/gas/SKILL.md:44`) with
zero priority fee. **The real base fee rises under load** via the base-fee controller
(`.agents/skills/gas/SKILL.md:52-58`) and any tip is additive — so these are floors, not
forecasts (`monad-facts.md` Unverified #7). The §5.4 funding number carries margin for
exactly this.

**Conclusion, unchanged from `monad-facts.md` hard constraint 4: gas is not the binding
constraint.** RPC is (§4), and funding the reserve floor is (§5.4).

---

## 7. Data flow, end to end — one tick's life

### 7.1 The path

```
 ①  M2 metering: charge curve advances, emits Reading
        { sessionId, seq, timestampMs, kW, whDelta, meterId }
        signs it with the meter key                                    (FR-MET-2/3)
                    │
                    ▼
 ②  M5 verify: ecrecover against registry-bound meterId key            (IF-1, TB-1)
        replay guard: (sessionId, seq) unseen and seq > lastSeq        (FR-MET-7, IF-2)
        FAIL → discard, record discrepancy, no value moves             (UC-2 alt 2a)
                    │
                    ▼
 ③  M5 allocate: pop an IDLE wallet from the pool                      (FR-REL-8)
        none available → coalesce into next tick, raise queue depth    (§8)
                    │
                    ▼
 ④  M5 sign: settle(sessionId, seq, whDelta) with the wallet's local
        nonce and the hardcoded gas limit                              (§6.3)
                    │
                    ▼
 ⑤  eth_sendRawTransactionSync ─────────────────────────────────────►  RPC
                    │                                                  (ADR-3)
                    │  ⑥  M4 contract executes:
                    │       require session OPEN
                    │       require (sessionId, seq) unsettled          (FR-SET-9, DR-2)
                    │       rate ← rateAt(session, block.timestamp)     (FR-PR-4)
                    │       monDelta ← whDelta × rate       ON-CHAIN    (IF-4)
                    │       require payer funded ≥ monDelta             (FR-SET-8)
                    │       move value, sign by direction               (FR-SET-7)
                    │       emit Settled(...)                           (FR-SET-6)
                    │
                    ◄── receipt { status, txHash, blockNumber, logs }
                    │
                    ▼
 ⑦  M5 → wall: SSE event carrying the receipt's txHash + blockNumber   (FD-3, IF-6)
                    │
                    ▼
 ⑧  M7 render on the next animation frame: feed row, node pulse,
        counters, split bar; labelled ON-CHAIN because txHash present  (FR-DASH-1..4/6)
```

### 7.2 The latency budget against NFR-P-3 (≤ 1 s)

| Step | Budget | Source |
|---|---|---|
| ① sign a Reading (secp256k1) | 1 ms | local CPU |
| ② verify + replay guard | 1 ms | local CPU |
| ③ allocate wallet | <1 ms | in-memory |
| ④ sign transaction | 1 ms | local CPU |
| ⑤ wait for next block | 150 ms | 300 ms block time ÷ 2 (https://docs.monad.xyz/, fetched 2026-08-08) |
| ⑤ speculative execution → receipt | 150 ms | receipt available at Proposed state (`block-states.md:7`) |
| ⑤ RPC round trip | 103 ms | measured p95 at 10 req/s (`REQUIREMENTS.md:710`) |
| ⑦ relay → wall SSE over LAN | 20 ms | LAN, **estimate** |
| ⑧ next animation frame | 17 ms | 60 fps |
| **TOTAL** | **≈ 444 ms** | |
| **Budget (NFR-P-3)** | **1,000 ms** | `REQUIREMENTS.md:523` |
| **Slack** | **≈ 556 ms** | |

**Why the wall reads Proposed state, and what it costs.** Waiting for `"finalized"`
would add 600 ms of finality (https://docs.monad.xyz/, fetched 2026-08-08) on top of
inclusion, landing at ~1.1 s — over budget before network latency. So the wall shows
data at Proposed (`"latest"`) state (`block-states.md:7`).

The honest cost: "Proposed blocks undergo speculative execution. In rare cases, apps
consuming real-time data may see data from blocks that don't become canonical"
(`.agents/skills/concepts/references/block-states.md:17`, quoted). **A small fraction of
what the wall displays could later be reorganised away.** This is a deliberate trade of
correctness for latency, it is required to meet NFR-P-3, and it belongs in the README's
simplifications list (NFR-M-1, AC-11).

### 7.3 Where the settlement events come from — and why not from the chain

The wall is fed by the **relay**, not by an independent chain subscription (ADR-7).

The relay already holds the receipt: `eth_sendRawTransactionSync` returns the full
receipt object including status, logs and block info
(https://docs.monad.xyz/reference/json-rpc/api, fetched 2026-08-08). Subscribing
separately would re-fetch information the relay is already holding.

| | Relay-sourced (chosen) | Independent chain subscription |
|---|---|---|
| Extra RPC cost | **0** | 1 subscription, plus an unverified quota question — whether WS shares the HTTP bucket is undocumented (`monad-facts.md` Unverified #4) |
| Latency | receipt → SSE, ~20 ms | receipt → chain → WS → wall, one extra hop |
| FR-DASH-6 honesty | **Satisfied.** The event carries `txHash` + `blockNumber`, so "on-chain" is provable, not asserted | Satisfied |
| FR-DASH-9 explorer link | `txHash` straight from the receipt | Same |
| Independence from the relay | **None — the relay is a single point of truth** | Yes |

The independence column is the real cost, and it is accepted: the relay is already the
trust boundary (§3), so making it also the event source adds no *new* trust. A judge who
distrusts the feed clicks the `txHash` and reads the explorer — which is exactly the
independent verification path, available on demand rather than running constantly.

**Reversal trigger:** if a reviewer challenges the feed's independence and there is
time, add a read-only chain subscription that reconciles against the relay's stream and
displays a mismatch count. That is the P1 version. It is a display feature, not a
correction to the architecture.

---

## 8. Failure modes and the degradation ladder

**The governing rule is NFR-R-3 (`REQUIREMENTS.md:536`): degraded operation is
labelled, never disguised.** Every row below ends in something the audience can read.
No frozen dashboard is ever presented as a live one (UC-8, `REQUIREMENTS.md:284`).

### 8.1 The ladder

| Failure | Detection | Automatic response | Wall shows | Demo survives? |
|---|---|---|---|---|
*Palette note: the accent is **cyan** on a near-black ground; degradation reads as a
dimmed or outlined chip, not a second hue. Any "amber" below is stale wording.*

| **RPC 429** | HTTP 429 on submit | Cadence ladder: 1 Hz → 2 s → 6 s. Still failing after 10 s → batching (FR-REL-2, ADR-1 reversal) | `DEGRADED · CADENCE 2s` chip | ✅ |
| **RPC timeout** (>2 s on the sync call) | call timeout | Retry once on a *different* wallet; then drop the tick, coalesce its `whDelta` forward, record a discrepancy | `DEGRADED · RPC SLOW` amber | ✅ |
| **Wallet pool exhausted** | queue depth > 2 × pool size | Shed load: skip the lowest-priority session this tick and coalesce its `whDelta` into its next tick — **lossless**, see §8.2 | `DEGRADED · QUEUE 14` amber | ✅ |
| **Wallet below reserve floor** | `eth_getBalance` every 5 s | Remove from rotation; continue on the remainder; alert ops | `POOL 9/10` small, persistent | ✅ while ≥6 remain (§5.2) |
| **Pool below 6 wallets** | derived | Reduce N to `6 × (1/occupancy)` sessions and state N on the wall | `SESSIONS REDUCED TO 6` | ✅ at lower N |
| **Faucet dry pre-demo** | §5.5 checklist, T-2h | Cut N to `floor(pool_MON / 15)`; say the number in the pitch | actual N, no asterisk | ✅ at lower N |
| **Chain unreachable** (all sends fail 10 s) | consecutive failures | Metering and the wall keep running; **every MON figure flips to `simulated`** | `SIMULATED · CHAIN UNREACHABLE` full-width banner | ✅ — the beat survives, the claim is downgraded honestly |
| **Relay down** | wall's SSE heartbeat lost >3 s | Wall runs its own simulated nodes; all figures `simulated` | `SIMULATED · RELAY UNREACHABLE` | ✅ |
| **Venue wifi down** | same as above | Same as above; booth phones go fully local (FR-BOOTH-4) | `SIMULATED · OFFLINE` | ✅ — FR-OPS-4 zero-phone beat |
| **Everything down before load** | nothing loads | **Recorded fallback** (FR-OPS-5, NFR-R-4, AC-10) | n/a — the recording plays | ✅ from recording |

### 8.2 Coalescing is lossless, with one exception that matters

When a tick is shed, its `whDelta` is added to the next tick's `whDelta` for that
session rather than discarded. Cumulative settled energy still equals cumulative metered
energy, so DR-3 (`REQUIREMENTS.md:470`) and FR-SET-3 hold exactly.

**The exception: a rate change must not be crossed.** If a rate change takes effect
between the shed tick and the carrying tick, coalescing would settle the older energy at
the newer rate — retroactive repricing, which FR-PR-4 (`REQUIREMENTS.md:357`) forbids
and which UC-12 exists to prevent (`story.md:13`, "the rate changed mid-session and no
one told you").

**Rule: coalesce only within a single rate epoch. If a rate change intervenes, flush the
pending delta at the old rate before applying the new one.** Implemented in `DESIGN.md`
§M5.6.

### 8.3 Reconciliation with the booth spec's L0–L3 ladder

The booth ladder (`2026-08-08-booth-frontend-design.md:451-456`) describes the same
failures from the phone's point of view. The two are consistent; this table is the map,
so nobody has to hold both in their head.

| Booth level | Booth condition | System row above | Consistent? |
|---|---|---|---|
| **L0** relay up, chain up | Full; live nodes, live MON, on-chain | Nominal | ✅ |
| **L1** relay up, chain down | Full; MON labelled `simulated` | **Chain unreachable** | ✅ Identical response — MON flips to `simulated`, everything else continues |
| **L2** relay down | Fully local; wall runs its own simulated nodes | **Relay down** | ✅ Identical |
| **L3** wifi dead before load | Nothing loads; presenter narrates | **Everything down before load** | ✅ Identical, and both name the recorded fallback as the mitigation (booth line 458; FR-OPS-5) |

**One addition the booth ladder does not have,** because it describes only the phone:
the three *partial* rows above — 429, wallet-pool exhaustion, and pool depletion. Those
are relay-internal, invisible to a phone, and they are where the demo is most likely to
actually degrade. They degrade **cadence**, never **truth**: a slower wall is acceptable,
a wrong wall is not.

---

## 9. Concurrency and the surge

### 9.1 The control law

UC-10 (`REQUIREMENTS.md:296-308`) requires the surge to be a **substitution** of load,
not an addition, so peak concurrency never exceeds the rehearsed ceiling. FR-OPS-2
(`REQUIREMENTS.md:446`) makes it an operator obligation.

The budget is a rate, and both populations consume it:

```
budget:            B = 10 tx/s                                  (§4)
simulated:         each session at 1 Hz consumes  1/1 = 1.000 tx/s   (NFR-P-1)
booth on-chain:    each session at 6 s consumes   1/6 = 0.167 tx/s   (FR-BOOTH-15)

constraint:        N_sim × 1.0  +  N_booth × (1/6)  ≤  10
```

**Solve for the simulated population:**

```
                          ┌            ┐
        N_sim  =  10  −   │  N_booth    │
                          │  ─────────  │
                          │      6      │
                          └            ┘  (ceiling)
```

**One simulated session is displaced by every six booth players.** The numbers were
chosen to close exactly:

| Booth players connected | Booth load | Simulated sessions | Simulated load | **Total** |
|---|---|---|---|---|
| 0 *(FR-OPS-4, zero-phone beat)* | 0.0 | 10 | 10.0 | **10.0** ✅ |
| 12 | 2.0 | 8 | 8.0 | **10.0** ✅ |
| 30 | 5.0 | 5 | 5.0 | **10.0** ✅ |
| **60** *(the full room, NFR-P-2)* | **10.0** | **0** | 0.0 | **10.0** ✅ |
| 78 *(over-subscribed)* | 13.0 → **capped at 60** | 0 | 0.0 | **10.0** ✅ |

**The budget is flat at 10 tx/s across the entire range.** This is the property that
makes UC-10's peak safe, and it is why NFR-P-2 landed on sixty at six seconds
(`REQUIREMENTS.md:522`).

### 9.2 The control loop

```
every 1000 ms:
    n_booth     = count(booth sessions with lastSeen < 5s)      # booth §8 `live` zset
    n_sim_target = max(0, 10 - ceil(n_booth / 6))
    n_sim_target = min(n_sim_target, N_SIM_MAX)                 # FR-SIM-1 runtime param

    if n_sim_live > n_sim_target:
        close (n_sim_live - n_sim_target) sessions, oldest first,
        at a maximum of 2 per second                            # FR-SIM-5, no self-spike
    else if n_sim_live < n_sim_target:
        open  (n_sim_target - n_sim_live) sessions from the pre-registered pool,
        at a maximum of 2 per second, staggered                 # FR-SIM-5, FR-SIM-6

    if n_booth > 60:
        refuse the excess with a queued state; publish the refusal to the wall
        # UC-10 alt 3a: NEVER spawn simulated sessions to compensate, and never
        # silently push concurrency past the rehearsed limit
```

Three rules the loop enforces that are easy to get wrong:

- **Ramp at ≤2 sessions/s.** Closing ten sessions at once is itself an RPC spike, which
  is the problem the loop exists to prevent (FR-SIM-5, `REQUIREMENTS.md:398`).
- **Never spawn to compensate.** UC-10 alt 3a (`REQUIREMENTS.md:305`) is explicit: excess
  audience is capped and labelled, not absorbed by adding simulated load.
- **Zero phones is the nominal case, not the degraded one.** At `n_booth = 0` the loop
  settles at ten simulated sessions and the full beat runs (UC-10 alt 2a, FR-OPS-4,
  `REQUIREMENTS.md:448`). The presenter's script does not change
  (`2026-08-08-booth-frontend-design.md:604`).

### 9.3 IF-10's sixty-session burst

IF-10 (`REQUIREMENTS.md:506`) requires tolerating ~60 new sessions within 20 seconds.

FR-BOOTH-16 (`REQUIREMENTS.md:439`) already handles it: session opens complete **during
the join window, before the round starts**, and the final settlement doubles as the
close. So the 60 opens are spread across the join window rather than landing as a spike,
and there are no separate closes at all.

```
60 opens ÷ 20 s = 3 tx/s of opens
```

That 3 tx/s lands *before* steady settlement begins, not on top of it. If a join window
shorter than 20 s is ever configured, the opens must be rate-limited to 3/s and the
window stretched — the burst is bounded by the rate limiter, not by the window.

### 9.4 ⚠ FD-1 versus FR-BOOTH-15/16 — a genuine conflict, resolved by a switch

**The conflict.** Plan-gate decision **FD-1** ruled booth sessions **wall-only**: they
report energy to the relay and appear on the wall, but do not settle on-chain, and the
wall labels their MON figure `simulated`. That closes OD-1 (`REQUIREMENTS.md:671`) in the
negative.

`REQUIREMENTS.md` was then amended in the opposite direction. FR-BOOTH-15
(`REQUIREMENTS.md:438`) states each booth session **MUST settle** on a 6-second
interval, and NFR-P-2 (`REQUIREMENTS.md:522`) sets the headline concurrency at 60 live
sessions on that basis. Those amendments postdate FD-1 and answer OD-1 in the
affirmative.

> ### ⚠ THIS SUBSECTION IS OBSOLETE — the conflict dissolved. See §16.4 and ADR-6.
>
> It described a runtime switch, `BOOTH_ONCHAIN`, chosen to satisfy both FD-1 and
> FR-BOOTH-15/16 at once. **Both inputs are now gone:** FR-BOOTH-15/16 are withdrawn
> (`REQUIREMENTS.md:438-439`) and §16 removes the crowd from the chain entirely.
>
> **There is no switch.** `BOOTH_ONCHAIN` is **deleted, not defaulted off** — FR-SPLIT-1
> is verified by Inspection, and a flag capable of enabling booth chain-writes fails that
> inspection by existing. Booth-on-chain is out of scope with §16 as the reason.
>
> The resolution: **booth makes zero chain calls; the crowd reaches the chain only as one
> `settleRoomAggregate` at the close** (ADR-9). Kept as a record of the reasoning, since
> ADR-6 now tells the full three-position arc.

---

## 10. Security architecture

### 10.1 NFR-S-1..6 realised

| ID | Requirement | Mechanism | Enforced where |
|---|---|---|---|
| **NFR-S-1** | No value moves without a valid signed metering event | ecrecover against the registry-bound `meterId` key before a transaction is built; the contract additionally refuses a duplicate `(sessionId, seq)` | Relay (TB-1) + contract (FR-SET-9) |
| **NFR-S-2** | Identity spoofing must not redirect payment | §10.2 | Contract storage |
| **NFR-S-3** | Replayed readings rejected | `seq` strictly increasing per session (IF-2) + relay seen-set + on-chain `settled[sessionId][seq]` (DR-2) | Both, independently |
| **NFR-S-4** | No private key committed | Keys from `.env` / OS keystore only; `.env*` in `.gitignore`; pre-commit secret scan; **CI job that greps the diff for `0x[0-9a-f]{64}`** | Repository |
| **NFR-S-5** | Hot wallet holds demo funds only, exposure stated in README | 150 MON of testnet MON, zero mainnet value; README section required | README (NFR-M-1) |
| **NFR-S-6** | Booth collects no credential, key or payment detail | FR-BOOTH-5; the only key is generated client-side and never leaves except as a public key (FR-BOOTH-9); claiming collects a handle and one contact method only (`2026-08-08-booth-frontend-design.md:376`) | Booth app |

### 10.2 Why spoofing cannot redirect payment (FR-ID-5, NFR-S-2, UC-11)

The mechanism is structural, not a check that could be forgotten:

1. `registerIdentity(id, role, pubKey, wallet)` binds one identity to **exactly one**
   wallet, and rejects a duplicate registration (FR-ID-3, UC-11 alt 1a).
2. `openSession` resolves both parties through the registry and writes `payer` and
   `payee` into session storage **once**, at open (FR-SET-1).
3. **`settle(sessionId, seq, whDelta)` takes no address parameter.**

There is no address in the settle call, so **there is nothing to spoof.** An attacker who
perfectly impersonates a station still causes value to move to the wallet the registry
bound to that station's identity — which is the real station's wallet, not theirs. This
is the property UC-11 exists to establish (`REQUIREMENTS.md:313`).

### 10.3 What each hostile actor can and cannot do

| Actor | Can | Cannot | Why not |
|---|---|---|---|
| **Hostile station (A2, UC-7)** | Claim energy it did not deliver, in its own reporting | Get paid for it | The `Reading` must be signed by the **meter** key, which is a distinct identity from the station's (`Reading.meterId`, `REQUIREMENTS.md:461`). A station that does not hold the meter key produces nothing the relay will accept. |
| **Hostile vehicle (A1)** | Underfund itself | Charge for free | FR-SET-8 force-closes at the last funded tick (UC-2 alt 4a, `REQUIREMENTS.md:220`). Energy delivered past that point is unpaid — a real-world credit risk, correctly out of scope for a settlement rail. |
| **Hostile booth player (A8)** | Tap faster than physically plausible; script the page | Distort the on-chain record **at all** | Effective tap rate is capped at **30/s** — above any human rate, since five fingers reaches ~25/s (FR-BOOTH-13, `REQUIREMENTS.md:436`; the earlier 20/s figure sat *inside* the human range and reintroduced ties at prize positions — §16.2). Up to 5 pointers accepted and declared (FR-BOOTH-14). Scoring is server-authoritative (FR-SPLIT-3). **The booth makes zero chain calls (FR-SPLIT-1), so there is no on-chain record for a player to reach.** |
| **Unregistered party** | Send anything it likes to the relay | Open a session | FR-ID-4 (`REQUIREMENTS.md:332`) — registry lookup fails, session refused (UC-1 alt 2a). |
| **Network observer** | Read everything; testnet is public | Forge a reading | Signatures are over the whole struct (`REQUIREMENTS.md:461`, `IF-1`). |
| **Compromised relay** | Overstate `whDelta` within an open session, up to the payer's funded balance | Invent a counterparty, redirect payment, or exceed funding | §3.2 — **this is TB-2, the accepted boundary** |

### 10.4 Proving UC-7 live — FR-OPS-7, and a stronger version of it

AC-7 is deliberately verified by **Demonstration**, not Test: no adversarial harness is
realistically buildable today, and claiming one would be a verification method nobody
can run (`REQUIREMENTS.md:603`). FR-OPS-7 (`REQUIREMENTS.md:451`) provides the operator
control.

**Ship two buttons, not one.** They prove different things, and the second is the one
that survives a sceptical reviewer.

| Button | What it submits | What happens | What it proves |
|---|---|---|---|
| **`INJECT BAD SIGNATURE`** | A `Reading` whose signature does not recover to the registered `meterId` key | The relay rejects it. **No transaction is ever built.** Wall shows `REJECTED · BAD SIGNATURE` in red, with the session id | The relay-side check (IF-1, TB-1) is real and runs before any value moves |
| **`INJECT REPLAY`** | A duplicate `(sessionId, seq)`, forced past the relay's own seen-set | The **contract** reverts. A real transaction hash exists, on-chain, with `status: 0` | The on-chain guard (FR-SET-9, DR-2) is real and independent of the relay — **a judge can click the hash and read the revert on the explorer** |

**The second button is the better demo** precisely because it produces an artifact on a
public explorer. The first proves the relay behaves; the second proves the contract does
not depend on the relay behaving. Given that §3 concedes the relay is trusted for
signature validity, showing what the contract enforces *anyway* is the strongest three
seconds available.

Both must be operable without typing (IF-12, `REQUIREMENTS.md:511`).

### 10.5 Key inventory

| Key | Held by | Purpose | Committed? |
|---|---|---|---|
| Relay pool keys × 10 | `relay` process, from `.env` | Sign settlement transactions | **Never** (NFR-S-4) |
| Meter keys × 60 | `relay` process, from `.env` or derived at setup | Sign readings (FR-MET-3) | **Never** |
| Booth ephemeral keys | The phone's memory, one per session | Sign booth readings (FR-BOOTH-9) | **Never** — generated client-side, only the public key is transmitted |
| Contract deployer key | Deploy machine only | One-time deploy | **Never** |

FR-REL-7 (`REQUIREMENTS.md:386`) holds: the relay holds its own pool keys and the
simulated meter keys — which are the keys of simulated devices it *is* — and no
participant's key beyond that. DR-5 (`REQUIREMENTS.md:472`) holds for the same reason: a
booth participant's key never reaches the relay.

---

## 11. The fourteen contradiction resolutions

Each: the conflict, the resolution, the consequence of choosing it.

### C1 — Is the public RPC limit documented?

**Conflict.** CON-5 (`REQUIREMENTS.md:141`), ASM-4 (`REQUIREMENTS.md:152`) and the
original FR-REL-9 call the limit undocumented. `docs/monad_dev_resources.md:141`
documents it as 50 rps, 25 for `eth_call`, batch 100.

**Resolution.** Three states, in order: the limit *was* undocumented in the sense that
no figure had been found; a figure *is* published (50 rps, verified against
https://docs.monad.xyz/developer-essentials/testnets, fetched 2026-08-08); and the limit
is now **measured at 40–45 req/s** (`REQUIREMENTS.md:717`). The measurement is lower
than the publication and the measurement wins, per the project's own rule
(`CLAUDE.md`: "When a measurement contradicts a document, the measurement wins").
CON-5 is closed (`REQUIREMENTS.md:723`).

**Consequence.** Design ceiling is 40 req/s, not 50. FD-2 directed adopting the
documented 50 rps *and* running the measurement first; the measurement has run and
returned a lower number, so adopting 40 follows FD-2's intent (design for the worst
case) rather than departing from it. **Also flagged for correction outside this
document's scope:** `docs/monad_dev_resources.md:145` cites
`https://docs.monad.xyz/reference/rpc-limits` as its source, but that page currently
documents **mainnet-only** gas-limit caps and contains neither "testnet" nor "10143"
(fetched twice, 2026-08-08, per `monad-facts.md` Q1). The numbers are right; the
citation is wrong.

### C2 — 50 sessions × 1 Hz = 100% of the quota

**Conflict.** NFR-P-2's original 50-session stretch at 1 Hz is 50 tx/s, which saturates
the endpoint with nothing left for anything else.

**Resolution.** Confirmed and already acted on. NFR-P-2 has been rewritten
(`REQUIREMENTS.md:522`) to **60 live sessions at a 6-second interval = 10 tx/s**, and
§13.4 states the 50-at-1-Hz stretch "is not achievable live"
(`REQUIREMENTS.md:722`). §4.3 of this document confirms the arithmetic independently.

**Consequence.** The claim improved. Concurrency rose from 50 to 60; cadence fell from
1 s to 6 s; the RPC budget stayed at 10 tx/s. **The pitch must state the cadence**, and
`2026-08-08-booth-frontend-design.md:600`'s "sixty payment streams settling per second"
is now wrong by 6× and must be replaced (§4.3 gives the replacement line).

### C3 — Per-IP limits and a NAT'd venue

**Conflict.** The limit is likely per-IP; the venue may NAT the whole room behind one
address (`REQUIREMENTS.md:132`). Scope is undocumented.

**Resolution.** Undocumented, confirmed by direct fetch of both pages that publish the
figures — neither states per-IP, per-key or global
(https://docs.monad.xyz/developer-essentials/testnets and
https://docs.monad.xyz/reference/rpc-limits, both fetched 2026-08-08). Design for the
worst case: assume one shared bucket for the entire room.

**Consequence.** Three concrete effects. **(a)** The 4× gap between the 40 req/s ceiling
and the 10 req/s budget is reserved as contention margin and must not be spent on
features. **(b)** `tools/measure-rpc.mjs` is re-run **from the venue at T-30min**; a
result below 15 req/s triggers the sharding decision in §4.5. **(c)** The measured 40–45
figure was taken from one laptop at one moment and already includes whatever contention
existed then — it is not a guarantee about a full room.

### C4 — The reserve balance floor is absent from the requirements

**Conflict.** A 10 MON floor per EOA, below which a wallet is capped at ~1 tx/1.2 s
(`.agents/skills/concepts/references/reserve-balance.md:3,9`), directly constrains
FR-REL-8's pool and appears nowhere in `REQUIREMENTS.md`.

**Resolution.** Added as an architectural constraint in §5.3. FR-REL-8 as written
(`REQUIREMENTS.md:387`) requires the pool be "sized so the target transactions per
second can be issued in parallel." **That is necessary and not sufficient.** The missing
half: *every wallet in the pool must hold more than 10 MON, or the pool must be sized
for the throttled rate instead.*

**Consequence.** The pool is 10 wallets at 15 MON = **150 MON** (§5.4), and 100 MON of
that is permanently resident rather than spendable. A cheaper Regime B exists (12
wallets at ~2 MON ≈ 24 MON) but rests on an ambiguity between lines 8 and 9 of the
reserve-balance reference that the reference does not resolve — so it is **labelled
unverified** and gated behind a five-minute test in §12 W0. If Regime B fails the test,
the only remaining lever is fewer sessions.

### C5 — Newly funded accounts cannot transact for 3 blocks

**Conflict.** "Newly funded accounts cannot send transactions until their funding
transfer is `D` blocks old (~1.2 seconds)"
(`.agents/skills/concepts/references/async-execution.md:8`, `D=3` at line 7). Affects
pool bring-up and live registration.

**Resolution.** §5.5.1 specifies the bring-up sequence with minutes of margin rather
than the 1.2 s minimum. **Readiness is a successful test transaction, not a balance
read** — because whether `eth_getBalance` reflects funds that are not yet spendable is
undocumented (`monad-facts.md` Unverified #3), so a poll-until-balance-updates script
can see the money and still have the spend rejected.

**Consequence.** Pool funding becomes a **T-2h30 checklist item with a smoke test**,
not a startup step. Live registration is unaffected: FR-BOOTH-9's ephemeral keys hold no
MON and their registration is paid for by an already-funded pool wallet, so no funding
transfer sits in that path.

### C6 — SSE is dead / SSE is required

**Conflict.** `2026-08-08-booth-frontend-design.md:45` and `:386` state the Vercel Hobby
300 s streaming cap (`:32`) killed SSE and the wall polls instead. FR-DASH-8
(`REQUIREMENTS.md:412`) and IF-6 (`REQUIREMENTS.md:497`), both amended later, mandate a
reconnect-safe stream with SSE recommended.

**Resolution — FD-3, split by hop.** The cap applies to Vercel functions. Both documents
are right about their own hop:

| Hop | Vercel function in the path? | Transport | Verdict |
|---|---|---|---|
| `relay` (self-hosted Node) → `wall` | **No** | **SSE** | 300 s cap does not apply. FR-DASH-8 and IF-6 satisfied. |
| `booth-app` → `booth-fn` (Vercel) → Upstash | **Yes** | **Polling, 1 Hz** | Booth spec is correct. |

**Consequence.** FR-DASH-8 is satisfied without weakening, and the booth spec needs no
change — its statement is true of the hop it describes and superseded only as a claim
about the wall. The wall is served by the relay, not by a Vercel function.
**Deployment precondition:** the wall must reach the relay directly (same laptop or LAN).
**Reversal trigger:** if the wall must be served from Vercel, SSE dies on that hop and
the wall falls back to 1 Hz polling of the relay — trivial at one client.

### C7 — Single hot wallet versus a pool

**Conflict.** `2026-08-08-booth-frontend-design.md:443` specifies "one wallet to fund and
one place to manage nonces." FR-REL-8 (`REQUIREMENTS.md:387`) mandates a pool.

**Resolution.** **Requirements win.** The booth spec predates the per-tick decision — its
own text says so, describing "the multicall design already under discussion in
`docs/idea/open_questions.md` Q2", and Q2 has since resolved to per-tick
(`REQUIREMENTS.md:650`). A single wallet cannot issue 10 tx/s: at the 600 ms occupancy of
§5.2 one wallet delivers 1.67 tx/s, six times short.

**Consequence.** Per FD-5, `2026-08-08-booth-frontend-design.md:443` is **annotated as
superseded, not rewritten**. Superseding text: *"Superseded 2026-08-08 by FR-REL-8 and
the per-tick decision (§13.3). Settlement submits from a pool of 10 funded wallets; see
ARCHITECTURE.md §5."*

### C8 — The booth reward is decided / unresolved

**Conflict.** `2026-08-08-booth-frontend-design.md:613` lists the reward as unresolved
and says "§7 recommends unconditional." `:346` records it **decided** as the conditional
20% share, with the unconditional pot explicitly declined, and `REQUIREMENTS.md:662`
corroborates.

**Resolution.** Decided: **20% of any cash prize, top 10, conditional on the team
placing, table A.** The §15 entry is stale *and* backwards — it reports the recommendation
as the opposite of what §7 actually chose.

**Consequence.** No design impact. The terms panel copy is final
(`2026-08-08-booth-frontend-design.md:352`) and satisfies FR-BOOTH-7 and the amended
FR-BOOTH-8 (`REQUIREMENTS.md:431`), which requires stating the placement dependency as
fact. Per FD-5, annotate §15 item 2 as resolved-by-§7 and leave it in place as the
record.

### C9 — Nobody has computed the MON burn or sized the funding

**Conflict.** Monad charges on `gas_limit` (`.agents/skills/gas/SKILL.md:13`) and no
requirement computes the burn or sizes the pool.

**Resolution.** Computed in §5.4 and §6.4. **Gas is not the binding constraint; the
reserve floor is.**

```
burn, one 180 s run at 10 tx/s   =  11–27 MON
reserve floor, 10 wallets        = 100 MON        ← 4× the burn
POOL TOTAL to acquire            = 150 MON
```

**Consequence.** ASM-1 (`REQUIREMENTS.md:149`) and RSK-4 (`REQUIREMENTS.md:636`) now have
a number instead of an adjective, and §5.5 turns it into a timed checklist. The
uncomfortable finding: if the faucet dispenses 10 MON per address per 24 h
(`2026-08-08-booth-frontend-design.md:41`, itself UNVERIFIED), **it cannot put any single
wallet above the floor**, so the pool must be built by consolidating many claims. That is
the single most likely way this demo fails for a reason nobody predicted, and it is the
first checklist row.

### C10 — 400 ms/800 ms versus 300 ms/600 ms

**Conflict.** `.agents/skills/monskill/SKILL.md:30` says 400 ms block time / 800 ms
finality. `docs/monad_dev_resources.md:95-96` says 300 ms / 600 ms.

**Resolution.** **300 ms / 600 ms is current.** https://docs.monad.xyz/ states verbatim
"an Ethereum-compatible Layer-1 blockchain with 10,000 tps of throughput, 300ms block
frequency, and 600ms finality" (fetched 2026-08-08). The local skill files are stale on
this number — `monskill/SKILL.md:30`, `why-monad/SKILL.md:6`, `why-monad/SKILL.md:25`,
`concepts/SKILL.md:25`, `concepts/references/block-states.md:18`.

**Consequence.** **Quote 300 ms / 600 ms on stage.** It is the better number and the
correct one; quoting 400/800 would understate the chain by a third to an audience likely
to know the right figure. The §5.2 occupancy calculation and the §7.2 latency budget both
use 300 ms. The stale skill files are vendored third-party content and are not edited by
this project — the correction lives here.

### C11 — `eth_sendRawTransactionSync` appears in no specification

**Conflict.** The method exists, removes the per-tick receipt poll, and no specification
mentions it.

**Resolution.** **Mandatory for the per-tick architecture.** It "eliminates the need for
separate `eth_getTransactionReceipt` polling. Applications receive confirmation in a
single synchronous call" (https://docs.monad.xyz/reference/json-rpc/api, fetched
2026-08-08), returns a full receipt, and accepts a `timeout_ms`.

**The arithmetic both ways, at the 10 tx/s design budget:**

| | RPC calls per tick | At 10 tx/s | Against the 40 req/s ceiling |
|---|---|---|---|
| **With** `eth_sendRawTransactionSync` | **1** | **10 req/s** | **25% — 4× headroom** ✅ |
| **Without** — send + receipt poll (~1 attempt per 300 ms block) | 2–4 | **20–40 req/s** | **50–100% — on the knee** ⚠ |

And at the dead 50-session stretch: 50 req/s with it, 100–200 req/s without — the latter
exceeding every published endpoint cap outright.

**Consequence.** **The sync method is what makes the *rehearsed* bar safe, not merely the
stretch.** Without it, even AC-5's ten sessions consume 20–40 req/s and sit on the
measured knee. This reframes it from an optimisation to a load-bearing dependency, which
in turn makes verifying it item zero of the build (§12 W0) — because `monad-facts.md`
sourced it from documentation and **nobody has called it against
`https://testnet-rpc.monad.xyz`.**

**Reversal trigger:** if the method is unavailable or unreliable on the public endpoint,
fall back to send + poll **and simultaneously halve the settlement rate** to 5 tx/s
(5 sessions at 1 Hz, or 60 at 12 s) to stay under 20 req/s. Halving the rate is not
optional in that branch — the fallback costs 2–4× the RPC per tick.

### C12 — OD-1 and OD-2 are listed open but effectively answered

**Conflict.** OD-1 and OD-2 (`REQUIREMENTS.md:671-672`) are listed as open decisions, but
FR-SIM-6 (`REQUIREMENTS.md:399`) and FR-BOOTH-9 (`REQUIREMENTS.md:432`) have already
answered OD-2.

**Resolution — both close.**

**OD-2 (pre-provisioned wallets or live-derived identities): closed as pre-provisioned,
with one live exception.** FR-SIM-6 mandates simulated identities be drawn from a pool
registered before code freeze. FR-BOOTH-9 mandates booth sessions generate an ephemeral
key client-side and register it silently. Both are already normative `MUST`s, so the
decision was made in the requirements and only the tracking entry lagged. FR-ID-7 (live
key derivation from certificates) remains `C` and explicitly not today
(`REQUIREMENTS.md:623`).

**OD-1 (do booth sessions settle on-chain): closed by FD-1 as wall-only, implemented as
a runtime switch.** See §9.4 — `REQUIREMENTS.md` was amended after FD-1 in the opposite
direction, so the switch honours FD-1's default while satisfying FR-BOOTH-15/16.

**Consequence.** §13's open-decisions table goes to zero entries. The remaining Q1
(dedicated RPC endpoint, `REQUIREMENTS.md:649`) is answered in practice: no
hackathon-specific premium RPC exists on the Blitz resources
(`open_questions.md:18`), so public endpoints are the working assumption and §4.5 is the
mitigation.

### C13 — The freeze slice omits M3 and M9

**Conflict.** §11's must-exist-by-freeze list names M1, M2, M4, M5, M6, M7
(`REQUIREMENTS.md:615`) and omits **M3 (Pricing)** and **M9 (Demo control)**, both of
which carry `M`-priority requirements: FR-PR-1/2/4 and FR-OPS-1/4/5.

**Resolution — the slice is wrong; the priorities are right. Both modules are in.**

The evidence is inside the requirements themselves:

- **M3 is on UC-1's critical path.** UC-1 step 3 reads price per kWh from M3
  (`REQUIREMENTS.md:201`) and alternate 3a refuses the session outright if the price
  source is unavailable (`REQUIREMENTS.md:207`). **Without M3, no session opens, so
  AC-1 and AC-2 do not ship.** M3 cannot be omitted from a slice that includes M4.
- **M9 owns the demo's opening action.** FR-OPS-1 is one deterministic action to start
  the network (`REQUIREMENTS.md:445`), and `idea.md:96` names it the opening beat:
  "hitting 'Spin Up Network' and watching the dashboard go from idle to live."
  FR-OPS-5's recorded fallback is also M9's and is a `MUST` by freeze.
- **Neither is expensive.** M3 is a rate struct with an `effectiveFrom` field and a
  lookup — tens of lines, and it lives inside the M4 contract rather than as a separate
  service. M9 is four buttons and two POST handlers.

This is the same class of defect the requirements already caught and fixed for M5, where
the omission is described as "a serious defect" (`REQUIREMENTS.md:617`). The same
correction applies here.

**Consequence.** **The freeze slice is M1, M2, M3, M4, M5, M6, M7, M9 — every module
except M8.** M8 keeps its §11 position as the module "whose absence costs nothing on
stage" (`REQUIREMENTS.md:625`). §12's build order is sequenced against the corrected
slice.

### C14 — §9's traceability under-reports its own gap by 31 requirements

**Conflict.** §9 claims exactly two requirements serve no use case — FR-SET-8 and
FR-REL-3 (`REQUIREMENTS.md:587`). The coverage ledger's programmatic diff finds **33**,
leaving 31 undisclosed, including two `M`-priority ones: **FR-REL-1** (the per-tick
architecture, the project's central claim) and **FR-DASH-8** (the transport).

**Resolution.** A `MUST` with no demo beat is a `MUST` that quietly does not get built.
Both get one.

**FR-REL-1 gets the strongest beat in the demo, and it costs nothing to add.** The wall's
feed already shows one row per settlement (FR-DASH-1). Give each row its own `txHash` and
make it clickable (FR-DASH-9, `REQUIREMENTS.md:413`). *One row, one transaction, one hash
on a public explorer* **is** FR-REL-1 — separate transactions, no aggregation, nothing
hidden (`REQUIREMENTS.md:690`). A judge clicking any row and landing on a distinct
transaction verifies the project's central architectural claim in three seconds, without
the presenter saying a word. **Add to UC-6's demo beat.**

**FR-DASH-8 gets a beat through FR-OPS-3.** The operator already needs a force-degraded
control to rehearse (`REQUIREMENTS.md:447`). Extend it to drop the SSE connection: the
wall shows `RECONNECTING`, then recovers and resumes without a page reload. That is
FR-DASH-8 demonstrated in five seconds, using a control that has to exist anyway. **Add
to UC-8's demo beat.**

**The remaining 29.** Mapped in `DESIGN.md` §11 to the module that owns each. Most are
M8/M9 machinery that §9's use-case list under-represents, plus `S`/`C`/`W` items whose
absence from a flow is lower-stakes. Every `M`-priority one is assigned to a module
section with an explicit verification method, so none can be lost by omission.

**Consequence.** Two demo beats added at approximately zero build cost, both attached to
controls or displays already required. §9's table is under-reporting and should be
regenerated from the ledger's diff rather than hand-maintained — noted for whoever owns
`REQUIREMENTS.md`, since this document does not edit it.

---

## 12. Build order and the freeze slice

**Now: 13:48. Freeze: 18:00 (CON-3). Remaining: 4 h 12 m.**

### 12.1 What changed about "measure first"

§11 says FR-REL-9's measurement is the first task of the build
(`REQUIREMENTS.md:619`). **It is done** (`REQUIREMENTS.md:702-725`). Its successor is
named in the same section: *"These are reads. A write-path measurement needs a funded
wallet and was not run. Before trusting 10 tx/s of settlement, repeat this against
`eth_sendRawTransaction` with the relay's wallet pool — the number will be lower, and
only that number tells you whether AC-5 is safe"* (`REQUIREMENTS.md:725`).

**W0 is that measurement, plus the two other unknowns that gate the design.** It is
twenty minutes and it decides three things that are expensive to discover late.

### 12.2 The sequence

| Wave | Clock | Work | Decides / delivers | Freeze |
|---|---|---|---|---|
| **W0** | 13:50–14:10 | **The probe.** ① faucet claim started in parallel (§5.5). ② Does `eth_sendRawTransactionSync` work on `testnet-rpc.monad.xyz`? (C11) ③ Write-path tx/s from 2 wallets. ④ Regime B: does a 2 MON wallet's `settle()` succeed or revert? (C4) | **Gates ADR-1, ADR-3 and the funding regime.** Anything built before this may be built against the wrong number | ▶ |
| **W1** | 14:10–15:10 | **M4 contract + M3 rates**, deployed and verified. Gas limits measured and hardcoded (§6.3) | AC-9, FR-SET-1..9, FR-PR-1/2/4, NFR-M-2 | ▶ |
| **W2** | 14:10–15:10 *(parallel)* | **M2 metering + M1 registry client.** Charge curve, signing, replay guard | FR-MET-1..7, FR-ID-1..5 | ▶ |
| **W3** | 15:10–16:10 | **M5 relay.** Queue, verification, pool, nonce ledger, sync submission, degraded-mode machine | FR-REL-1/3/4/5/7/8, AC-2 | ▶ |
| **W4** | 15:10–16:40 *(parallel)* | **M7 wall.** Feed, counters, node grid, split, idle→live, labels, SSE client with auto-reconnect | FR-DASH-1..6/8/10, AC-6 | ▶ |
| **W5** | 16:10–16:40 | **M6 spawner + M9 controls.** Identity pool registration, staggered starts, the four operator buttons, both FR-OPS-7 injectors | FR-SIM-1..6, FR-OPS-1/3/4/7, AC-5 | ▶ |
| **W6** | 16:40–17:20 | **Integration + rehearsal at N=10.** Full beat, twice. Force degraded once (AC-8). Fire both injectors (AC-7) | AC-1..AC-8 end to end | ▶ |
| **W7** | **17:20–17:40** | **🔴 RECORD THE FALLBACK.** Hard gate — nothing else runs until this is on disk | **FR-OPS-5, NFR-R-4, AC-10** | ▶ |
| **W8** | 17:40–18:00 | Buffer. M8 relay integration only if W0–W7 all closed. README simplifications list (NFR-M-1, AC-11) | FR-BOOTH-3, NFR-M-1/4 | — |

### 12.3 Three rules about this schedule

**W0 gates everything and cannot be skipped for time.** Its four questions each change
what gets built: whether the sync method exists (ADR-3), what the write ceiling is
(ADR-1's reversal trigger), whether Regime B is available (§5.3), and whether the faucet
can fund the pool at all (§5.5). Twenty minutes spent here is cheaper than any of the
four discovered at 17:00.

**W7 is a hard gate at 17:20, not a task at the end.** The recorded fallback is a `MUST`
three times over — FR-OPS-5, NFR-R-4, AC-10 — and it is the single item most likely to be
sacrificed to a build that is nearly finished. It is scheduled with 20 minutes of buffer
after it. **If W6 overruns, W7 still starts at 17:20 and records whatever works.** A
recording of a partial system beats no recording of a complete one.

**M8 is genuinely last** (`REQUIREMENTS.md:625`) and its own spec budgets 105 minutes for
P0 against a 120-minute allowance
(`2026-08-08-booth-frontend-design.md:560`). There is no room for it inside the corrected
freeze slice unless the core finishes early. Its absence costs nothing on stage, which is
exactly why it is here.

### 12.4 The corrected freeze slice

Per C13: **M1, M2, M3, M4, M5, M6, M7, M9.** M8 excluded.

Acceptance criteria in the slice: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-9, AC-10
(`REQUIREMENTS.md:615`), plus **AC-7 and AC-8**, which W5 and W6 deliver at near-zero
marginal cost once FR-OPS-3 and FR-OPS-7 exist.

Explicitly not today, unchanged (`REQUIREMENTS.md:623`): FR-SET-11 rate-based streaming,
FR-ID-7 live key derivation, FR-MET-8 real hardware, FR-PR-5 live oracle. Each is the
production path and is described as such.

---

## 13. Architecture decision records

Each ADR: the decision, why, what it costs, and **what would make us reverse it**.

### ADR-1 · Per-tick settlement, not batching

**Decision.** One transaction per session per tick (FR-REL-1, `REQUIREMENTS.md:380`).
Batching (FR-REL-2) is implemented as a fallback mode, not the primary path.

**Why.** The claim is stronger: separate transactions, no aggregation, nothing hidden
(`REQUIREMENTS.md:690`). It is also the version `idea.md:129` recommends for exactly this
reason — it "most directly and legibly proves the 'only possible at Monad's speed' claim
to judges."

**Cost.** A wallet pool (ADR-2), 150 MON of funding (§5.4), and consumption of the entire
10 tx/s budget at 10 sessions.

**Reversal trigger.** If W0's write-path measurement cannot sustain **10 tx/s with 429s
below 1% for 60 seconds**, switch to FR-REL-2 batching and collapse FR-REL-3 to its
serialised form (§5.6 Mode 2). **Make the call on the measurement, at 14:10, not on
stage** (`REQUIREMENTS.md:700`).

### ADR-2 · A pool of ten wallets, not one

**Decision.** Ten funded wallets, six the hard floor, local nonce tracking, one in-flight
transaction each (FR-REL-8).

**Why.** No global mempool + strict nonce ordering (§5.1) means one wallet delivers
1.67 tx/s at the measured occupancy — six times short of 10 tx/s.

**Cost.** 150 MON instead of 15. A bring-up sequence with a 3-block funding delay
(§5.5.1). Allocation and nonce-drift logic that a single wallet would not need.
Supersedes `2026-08-08-booth-frontend-design.md:443` (C7).

**Reversal trigger.** If the faucet cannot fund six wallets above the reserve floor by
T-2h, **do not fall back to one wallet — fall back to fewer sessions.** One wallet and
per-tick are incompatible; ASM-1 says so directly ("Falling back to a single relay wallet
means falling back to batching... the two are the same decision", `REQUIREMENTS.md:149`).

### ADR-3 · `eth_sendRawTransactionSync` for every settlement

**Decision.** Every settlement uses the sync method with an explicit `timeout_ms`. No
separate receipt poll exists anywhere in the codebase.

**Why.** It halves-to-quarters the RPC cost per tick (§11 C11): 10 req/s instead of
20–40 at the 10 tx/s budget. It is the difference between 4× headroom and sitting on the
measured knee.

**Cost.** A hard dependency on a Monad-specific RPC extension. The relay's submission
path blocks per wallet for the full inclusion time, which is what sets the 600 ms
occupancy in §5.2 and therefore the pool size.

**Reversal trigger.** If W0 finds the method unavailable or unreliable on
`https://testnet-rpc.monad.xyz`, fall back to `eth_sendRawTransaction` plus a receipt
poll **and halve the settlement rate to 5 tx/s in the same change.** The rate cut is not
optional — the fallback costs 2–4× the RPC per tick.

### ADR-4 · Signature verification off-chain, in the relay

**Decision.** ASM-6. The relay verifies; the contract trusts the attestation and
enforces its own independent guards (idempotency, funding, session state).

**Why.** Per-tick on-chain recovery does not fit the gas or RPC budget at target
concurrency (§3.1).

**Cost.** TB-2, a real trust boundary, with the blast radius stated in §3.2 and the
required wording in §3.4.

**Reversal trigger.** Add on-chain verification when a settlement can carry a ZK proof of
the verified batch (NFR-M-4) — which is a production project, not a today project. A
narrower reversal is available and worth naming: **if the design ever drops to ~1 tx/s
total**, per-tick on-chain `ecrecover` becomes affordable and TB-2 disappears. That is a
real option for a low-concurrency variant and it is worth saying out loud, because it
shows the boundary is a throughput trade rather than a limitation of the chain.

### ADR-5 · SSE relay→wall, polling phone→Vercel

**Decision.** FD-3. Transport is chosen per hop, by whether a Vercel function sits in the
path (§11 C6).

**Why.** The 300 s Hobby streaming cap
(`2026-08-08-booth-frontend-design.md:32`) constrains Vercel functions, not a
self-hosted Node process. Polling the relay at the frequency FR-DASH-8's intent requires
would load the relay for no benefit (`REQUIREMENTS.md:412`).

**Cost.** Two transports in one system. The wall must reach the relay directly.

**Reversal trigger.** If the wall has to be served from Vercel, drop to 1 Hz polling on
that hop. FR-DASH-8's reconnect-safety requirement is satisfied either way — polling
reconnects by definition.

### ADR-6 · The booth makes zero chain calls — **no switch, no flag**

**Decision.** The booth app makes **zero chain calls** and holds **no key material**
(FR-SPLIT-1, `REQUIREMENTS.md:793`). `BOOTH_ONCHAIN` is **deleted, not defaulted off**.
Booth-on-chain is out of scope; §16 is the reason.

**Why the flag had to go rather than be set false.** FR-SPLIT-1 is priority `M`, verified
by **Inspection**. A runtime switch capable of enabling booth chain-writes **fails that
inspection by existing** — an inspector opening the code finds a path that puts wallets
into a phone app, and "it defaults to off" is not an answer. A switch is also an
operational hazard: one wrong environment variable at 17:55 would do the thing the
requirement forbids.

**The full arc, because this is the most instructive decision in the project.**

| # | Position | Basis | What killed it |
|---|---|---|---|
| 1 | **FD-1** — booth wall-only | Plan-gate judgement, **no measurement** | FR-BOOTH-15/16 overrode it |
| 2 | **FR-BOOTH-15/16** — booth settles on-chain at 6 s, phase-staggered | The **read** knee of 40–45 req/s made 10 tx/s look like 26% of budget | The **write** measurement |
| 3 | **§16** — the crowd leaves the chain entirely | **10 tx/s clean from one wallet; refusals from 15; latency 50 ms → 1,677 ms by 30 tx/s** (`REQUIREMENTS.md:727-734`). Sixty phones at 6 s is 10 tx/s — *exactly* the whole budget, zero margin, on infrastructure the team neither controls nor can provision | **Current** |

**The conclusion landed back where FD-1 started, and that is the point.** Position 1 was
a guess that happened to be right. Position 3 is the same answer *earned* — and it is
strictly stronger, because FD-1 still allowed a phone to hold a key and talk to a relay,
while §16 removes chain capability from the booth by construction. Every intermediate
attempt to keep the crowd on-chain — capping players, widening the interval to 8 s,
pooling wallets — traded away either audience size or safety
(`REQUIREMENTS.md:773`). **Moving the crowd off-chain removed the constraint instead of
negotiating with it.**

**Cost.** A new module (M10, the game server) and a new component boundary. The crowd's
only chain interaction is one `settleRoomAggregate` at the close (ADR-9).

**Reversal trigger.** None at demo scale. Booth-on-chain becomes reasonable only with a
provisioned RPC endpoint the team controls — not a public one — and that is a different
project, not a flag.

### ADR-9 · One aggregate transaction as the bridge

**Decision.** The room's combined simulated energy settles as a **single real
transaction**, `settleRoomAggregate`, from the team's funded wallet at the close of the
pitch (FR-SPLIT-7/8, `REQUIREMENTS.md:800`).

**Why.** It is what makes the split honest rather than a retreat. One transaction is
trivially safe at any observed rate — a single wallet has run **60 tx/s clean**
(`REQUIREMENTS.md:728`) — it confirms inside a second, and it is genuinely
explorer-verifiable. Netting off-chain metering into one on-chain settlement is an
established pattern. *(The baseline first argued this as "tenfold margin against a 10 tx/s
ceiling"; that ceiling was retracted and the argument only got stronger.)*

**Cost.** One contract entry point, a pre-signed transaction with retry, and a rehearsal
aggregate minted at T-10min. If the live send stalls past five seconds the rehearsal hash
is shown **and named as the rehearsal one** — a fallback artefact that must never be
passed off as live (NFR-R-3).

**Rejected alternatives** (`REQUIREMENTS.md:811`): an offline queue settling after the
pitch is invisible at the moment people vote, and "it'll settle later" is the sound of an
overclaim. A pre-recorded replay is discounted to zero by a developer audience and
contaminates trust in the live dashboard beside it.

**Reversal trigger.** If the aggregate cannot be made to confirm reliably in rehearsal,
fall back to showing a single *simulated-session* settlement from the rail — which is
real, on-chain and already running — and drop the room-aggregate claim rather than
weaken it.

### ADR-7 · The wall is fed by the relay, not by a chain subscription

**Decision.** Settlement events reach the wall over SSE from the relay, carrying the
`txHash` and `blockNumber` from the receipt the relay already holds (§7.3).

**Why.** Zero additional RPC cost, one less hop of latency, and it sidesteps the
undocumented question of whether WebSocket subscriptions share the HTTP quota
(`monad-facts.md` Unverified #4). FR-DASH-6 stays honest because the `txHash` makes
"on-chain" provable rather than asserted.

**Cost.** The relay is a single point of truth for the feed. Mitigated by every row being
independently checkable on a public explorer via FR-DASH-9.

**Reversal trigger.** If a reviewer challenges the feed's independence and time exists,
add a read-only chain subscription that reconciles against the relay's stream and shows a
mismatch count. Display feature, not an architectural correction.

### ADR-8 · A fixed 10 tx/s settlement budget, with cadence and concurrency trading against it

**Decision.** The rail runs **~10 simulated sessions at 1 Hz ≈ 10 tx/s**, plus one
aggregate at the close. `N ÷ T` remains the shape, but **10 tx/s is a design target, not
a ceiling** — see §16.10.

**⚠ The original rationale is void.** This ADR was written to convert "the project's most
dangerous unknown" into one budgeted number, and it justified 10 tx/s as 26% of a measured
40 req/s knee. **Both measurements were retracted** (`REQUIREMENTS.md:726-740`): the knee
was noise, and a single wallet has since run **60 tx/s clean**. The substitution law it
also justified is separately moot — §16 removed the crowd from the chain.

**Why 10 tx/s anyway.** It is what AC-5's ten concurrent sessions at NFR-P-1's 1 Hz
produce (`REQUIREMENTS.md:598`, `:521`). The number now follows from the requirements
rather than from a capacity constraint, which is the right direction of causation and was
not true before.

**Cost.** None that binds. Under 17% of observed single-wallet throughput.

**Reversal trigger.** None needed for headroom. **Reduce** the session count only if a
venue-network measurement close to the pitch shows sustained failures that *rise with
load* — the test the retracted measurements failed to apply to themselves. A flat
single-digit timeout rate is not a reason to reduce anything; it is a reason to retry
(§16.10).

---

## 14. Open items this document could not close

Stated rather than smoothed over, matching the requirements' own standard: "Anything
unmet is stated plainly rather than presented as met" (`REQUIREMENTS.md:593`).

| # | Item | Why it is open | Resolution path |
|---|---|---|---|
| 1 | **Write-path RPC ceiling** | Only reads were measured (`REQUIREMENTS.md:725`). Every capacity number here assumes writes ≤ reads and applies a 4× margin | §12 W0, 20 minutes |
| 2 | **`eth_sendRawTransactionSync` on this endpoint** | Sourced from documentation (https://docs.monad.xyz/reference/json-rpc/api, fetched 2026-08-08); never called against `testnet-rpc.monad.xyz`. ADR-3 depends on it | §12 W0 |
| 3 | **Regime B viability** | Lines 8 and 9 of `.agents/skills/concepts/references/reserve-balance.md` cannot both be literally true and the reference does not disambiguate (§5.3) | §12 W0, one 2 MON wallet |
| 4 | **Faucet amount and interval** | UNVERIFIED (`2026-08-08-booth-frontend-design.md:41`). Determines whether the 150 MON pool is reachable at all | §5.5, T-4h |
| 5 | **RPC limit scope (per-IP / per-key / global)** | Undocumented on both pages that publish the figures, fetched 2026-08-08 | Cannot be closed from documentation. Mitigated by the 4× margin and the T-30min venue re-measurement |
| 6 | **WebSocket quota sharing** | Undocumented (`monad-facts.md` Unverified #4). Moot under ADR-7, which uses no subscription | Only matters if ADR-7 is reversed |
| 7 | **Nonce-gap behaviour** | Undocumented (`monad-facts.md` Unverified #2) | Avoided by design: never increment past a failure (§5.6) |
| 8 | **Real base fee under load** | §6.4 computes at the documented minimum; the controller raises it under load (`.agents/skills/gas/SKILL.md:52-58`) | §5.4 carries margin; observe during W6 rehearsal |

### One requirement that cannot be met as written

**NFR-P-2's original 50-sessions-at-1-Hz form is not achievable live and has already
been superseded in the requirements themselves** (`REQUIREMENTS.md:522`, and the
finding at `:722`). This document confirms the arithmetic independently in §4.3. The
current form — 60 sessions at a 6-second interval — **is** achievable at the measured
ceiling with 4× margin. No other requirement in the 79-item `FR-*` set was found
unachievable as written.

---

## 15. Requirement index for this document

Every identifier the coverage ledger marks `MUST` or `should` for the architecture
document, and where it is discharged. Ledger-stale IDs (FR-BOOTH-14/15/16) included.

| Where | Identifiers |
|---|---|
| §1 Context | CON-6, CON-7, ASM-2, ASM-5, FR-ID-2, RSK-5, RSK-6, A9 |
| §2 Components | M1–M9, A1–A8, CON-1, CON-2, CON-3, ASM-3, NFR-M-3 |
| §3 Trust boundary | **ASM-6**, FR-SET-2, IF-1, NFR-M-4, NFR-S-1, FR-MET-3, FR-SET-8 |
| §4 RPC budget | **CON-5**, **ASM-4**, **FR-REL-9**, **NFR-P-2**, AC-5, Q1, Q2, Q3, RSK-1, IF-10, FR-SIM-4, FR-BOOTH-15 |
| §5 Wallet pool | **FR-REL-8**, **FR-REL-3**, **ASM-1**, **RSK-4**, FR-REL-7, FR-SIM-6, FR-REL-1, FR-REL-2 |
| §6 Gas | FR-SET-3, NFR-M-2, FR-SET-11 |
| §7 Data flow | NFR-P-1, NFR-P-3, IF-4, IF-6, IF-7, FR-DASH-6, FR-DASH-8, FR-DASH-9, DR-3, DR-4, FR-MET-7 |
| §7 Data flow — signed values | **FR-MET-6** and **IF-3**: `whDelta` is signed end to end, negative denoting discharge, so step ⑥'s value movement follows the sign with no second path (FR-SET-7). **IF-5**: `settleBatch` is atomic — a partial failure settles no entry. **FR-PR-2**: the charge and V2G rates are separate contexts, resolved independently at step ⑥. **FR-SET-10**: `Settled` carries `cumWh`/`cumMon`, so the wall's running totals cost no extra RPC (§4.2) |
| §9 Concurrency — booth hop | **UC-9**: an audience session appears on the wall indistinguishable from a simulated one because it is the same kind of activity (§9.4). **IF-8** and **IF-9**: booth calls are fire-and-forget and idempotent on `(sessionId, seq)`, which is why booth traffic adds no retry load to the budget. **FR-BOOTH-10**: the booth's own leaderboard screen is served by `booth-fn`, never by the relay, so it sits outside the 10 tx/s budget entirely |
| §8 Failure | **UC-8**, **NFR-R-1**, **NFR-R-2**, NFR-R-3, NFR-R-4, FR-REL-4, FR-REL-5, FR-OPS-3, FR-OPS-5, FR-OPS-6, AC-8, AC-10, RSK-1, RSK-3, FR-BOOTH-2, FR-BOOTH-4, FR-PR-4 |
| §9 Concurrency | **UC-10**, **UC-5**, FR-OPS-2, FR-OPS-4, IF-10, NFR-P-2, FR-SIM-5, FR-BOOTH-15, FR-BOOTH-16, FR-REL-6, OD-1 |
| §10 Security | **UC-7**, **UC-11**, NFR-S-1..6, FR-ID-4, FR-ID-5, FR-OPS-7, FR-BOOTH-5, FR-BOOTH-13, FR-BOOTH-14, DR-5, IF-12, AC-7 |
| §11 Contradictions | All fourteen; closes OD-1, OD-2, Q1, Q2, Q3, CON-5 |
| §12 Build order | CON-3, CON-1, FR-REL-9, FR-OPS-5, NFR-R-4, AC-9, AC-11, NFR-M-1, RSK-7, RSK-2 |
| §13 ADRs | FR-REL-1, FR-REL-2, FR-REL-8, ASM-6, FR-DASH-8, IF-6, FR-MET-8, FR-PR-5 |
| §14 Open items | ASM-1, ASM-4, CON-5, NFR-P-2 |
| §16–17 Part II | **FR-SPLIT-1..8**, **M10**, NFR-P-1, NFR-P-2, FR-BOOTH-13, FR-BOOTH-14, FR-BOOTH-15 (withdrawn), FR-BOOTH-16 (withdrawn), FR-REL-8, NFR-S-4, NFR-S-5, NFR-M-2, AC-9, AC-10, FR-OPS-5, RSK-3 |
| Not owned by any technical document | **CON-4** (team size ≤ 4) is an organisational constraint — the coverage ledger classifies it an orphan, and nothing in topology, deployment, payload or module behaviour turns on it. Recorded here so its absence is a decision rather than an oversight |

**Module-level requirements (design-doc `MUST`s) are discharged in `docs/specs/DESIGN.md`,
one section per module M1–M9, plus the §6 data model and the DR-1..5 integrity rules.**

---

# PART II — written after the baseline moved

Sections 1–15 above were written against `REQUIREMENTS.md` at 717 lines. The baseline is
now **824 lines** across six further commits. Rather than silently editing the reasoning
above, the changes are recorded here with what they supersede — the same discipline
`CLAUDE.md` requires of any subordinate document.

---

## 16. The baseline changes, and what they overturn

| Commit | Change | What it supersedes above |
|---|---|---|
| `4818705` | Tap cap moved **20/s → 30/s**; NFR-P-1 cadence split by module | §10.3, `DESIGN.md` §M8.5 |
| `0361cc0` | `tools/measure-write-rpc.mjs` added | §12.2 W0 — partly done |
| `4da3fee` | **Write ceiling measured: 10 tx/s, one wallet** | §4.2, §4.3, §5.2 |
| `0e63afe` | **§16: booth split from the chain entirely** | §9, ADR-6 |
| `15d2117` | Booth interface contract marked superseded | §M8.1 in `DESIGN.md` |

### 16.1 C15 — NFR-P-1's 1 Hz against NFR-P-2's 6 s

**Resolved at source, not by me.** NFR-P-1 (`REQUIREMENTS.md:521`) now splits cadence by
module: **1 Hz for simulated sessions (M6), which is where the per-second product claim
is proven**, and 6 s for booth sessions. The two never run at full load together because
UC-10 ramps simulated down as phones connect.

**Consequence:** my §9.1 substitution law derived the same relationship independently and
still holds arithmetically — but it is now **moot**, because §16.2 below removes booth
chain load to zero. FR-OPS-4's zero-phone case was always the 1 Hz mode and is unaffected.

### 16.2 C16 — the tap cap

**FR-BOOTH-13 is now 30/s, not 20/s** (`REQUIREMENTS.md:436`). A cap inside the human
range was the defect: at 20/s a four-finger player and a script both score 5,732,
reintroducing exactly the prize-position tie that soft saturation exists to prevent. At
30/s a script's edge over the best plausible human is 2%. The real defence is the
review-before-reveal of runs averaging >18/s.

**Consequence:** every "20/s" in §10.3 of this document and §M8.5 of `DESIGN.md` reads
**30/s**. The earlier 4,200 score ceiling is doubly dead — it sat above the curve's own
asymptote of 4,040.

### 16.3 C17 — withdrawn

The claimed conflict between FR-BOOTH-14 and booth spec §6 does not exist. Booth spec
line 321 already reads "Allowed, up to 5 concurrent pointers". No supersession needed.

### 16.4 C18 — the booth/chain split retires ADR-6 and FD-1 both

`REQUIREMENTS.md` §16 (`:767`) states it flatly: **"The booth app makes no chain calls.
Not one."** FR-BOOTH-15 and FR-BOOTH-16 are **withdrawn** (`:438-439`). New
FR-SPLIT-1..8 govern.

**This is the third position OD-1 has occupied in one day**, and the sequence is worth
recording because it is the strongest evidence in the project that the team followed
measurements rather than preferences:

| Position | Basis | Fate |
|---|---|---|
| FD-1: booth wall-only | Plan-gate decision, pre-measurement | Overtaken by FR-BOOTH-15/16 |
| FR-BOOTH-15/16: booth settles at 6 s | Read-path knee of 40–45 req/s | Overtaken by the write measurement |
| **§16: booth makes zero chain calls** | **Write ceiling of 10 tx/s, one wallet** | **Current** |

**Why the last one is right.** Sixty phones at 6 s is 10 tx/s exactly — the measured
ceiling, zero margin, on public infrastructure the team neither controls nor can
provision. Widening to 8 s buys 25% headroom and still leaves the crowd on a shared
resource. Moving the crowd off-chain **removes the constraint instead of negotiating with
it** (`REQUIREMENTS.md:773`).

**Consequence for this document:** §9's substitution control law is retired. It solved a
problem that no longer exists. ADR-6 is superseded by ADR-9 below.

### 16.5 The corrected budget

```
MEASURED WRITE CEILING          10 tx/s, single wallet, PROVISIONAL   (REQUIREMENTS.md:731)
  ├─ simulated sessions (M6)    ~10 at 1 Hz          = 10 tx/s        (NFR-P-2, :522)
  ├─ booth sessions (M8)        unbounded            =  0 tx/s        (FR-SPLIT-1)
  └─ aggregate bridge (§16.6)   1 tx, once           ≈  0 tx/s        (FR-SPLIT-7)
                                                       ─────────
                                TOTAL                  10 tx/s = 100% of ceiling
```

**Say this plainly: the design now sits at 100% of the measured write ceiling, not 26%.**
The margin did not come from the RPC budget — it came from removing sixty phones from it.
Two mitigations, both real:

- **`REQUIREMENTS.md:522` calls it "~10", not exactly 10.** Run nine. One session of slack
  costs nothing on stage and buys 10% margin.
- **The ceiling is single-wallet.** If FR-REL-8's pool raises it, the margin returns —
  §16.7.

### 16.6 The aggregate bridge (FR-SPLIT-7, FR-SPLIT-8)

At the close of the pitch the room's combined simulated energy settles as **one real
transaction** from the team's funded wallet, and the presenter shows the hash
(`REQUIREMENTS.md:800-809`).

This is the architecturally elegant part of the split. One transaction against a 10 tx/s
ceiling is **tenfold margin**, confirms inside a second, and is genuinely
explorer-verifiable. Netting off-chain metering into one on-chain settlement is an
established pattern, not a dodge.

Design obligations:

| Item | Requirement |
|---|---|
| `settleRoomAggregate(totalWh, totalMon)` on M4 | New contract entry point. Same `whDelta × rate` on-chain computation as `settle()` (IF-4) — the aggregate is not a special case that bypasses the pricing rule |
| Pre-signed with automatic retry | FR-SPLIT-8 |
| **Rehearsal aggregate minted T-10min** | FR-SPLIT-8. If the live send stalls past 5 s, show the rehearsal hash **and say plainly what it is** |

The last row is the honesty constraint doing real work: a fallback hash exists, and
presenting it as the live one would be the exact failure NFR-R-3 forbids.

### 16.7 ⚠ The single most important open number

**Everything in §16.5 rests on one provisional measurement that has not been repeated.**
`REQUIREMENTS.md:738-740` is explicit about why it is provisional:

1. It ran from the **well-known public test key `0x…0001`**, which other teams also use —
   contention may have depressed the result.
2. Failures above 10 tx/s classified as **"other"**, not rate-limit, nonce or mempool, so
   **the mechanism of refusal is unidentified**.
3. **FR-REL-8 remains unproven.** Whether 10 tx/s is the node's limit or one account's
   nonce ordering is precisely what decides whether the wallet pool of §5 is essential
   infrastructure or wasted work — and it cannot be answered without more funded wallets.

**The re-run is one command and it is the highest-value twenty minutes left in the
build:**

```
PRIVATE_KEY=k1,k2,k3 node tools/measure-write-rpc.mjs --send
```

If the ceiling rises with the pool, FR-REL-8 is proven, §5's ten wallets are justified,
and the margin problem in §16.5 disappears. If it does not rise, 10 tx/s is the node's
limit, the pool is largely decorative, and **the correct response is to run nine
simulated sessions rather than ten.**

**One bug worth not repeating** (`REQUIREMENTS.md:742`): the first write run hardcoded
`maxFeePerGas` at 60 gwei against a base fee of 102, so every send failed "Transaction
fee too low" and the tool reported a fabricated ceiling below 2 tx/s. **Read fees from
the chain per run.** A measurement tool that reports a capacity limit which is actually a
client-side fee bug is worse than no measurement.

---

## 16.10 🔴 Both RPC measurements retracted — the corrected position

**This supersedes §4's budget, §5's pool sizing, §16.5's zero-margin alarm, §16.7's
"single most important number", and §16.8's re-derivation.** Retracted at source, commit
`d47a36c`, `REQUIREMENTS.md:726-740`.

### What was wrong

| Claimed | Actually |
|---|---|
| Read knee at **40–45 req/s** | 3 refusals in 270 at 45, 4 in 300 at 50 — **noise read as a knee** |
| Write ceiling at **10 tx/s** | 30/30 clean at 10, 43/45 at 15 — **a 4% loss read as rate limiting** |
| The design sits at **100% of ceiling** | **False alarm.** Ten sessions at 1 Hz is nowhere near any observed limit |

**The re-test that broke it:** 25 tx/s → 75/75 clean · 40 tx/s → 109/120 · **60 tx/s →
180/180 clean**. A failure rate that does not rise with load is not a ceiling. The 40 tx/s
losses were all `The request timed out`, and the *same wallet* then ran 60 tx/s
flawlessly.

**The methodological error, worth naming because it is easy to repeat:** a small
single-digit failure count at one rate was treated as the onset of throttling without
checking whether it *rose* with load. It did not. Both runs also used the shared public
key `0x…0001`, whose nonce moved **20 → 89 between runs** — strangers were actively
transacting from it, and contention was never ruled out.

### The corrected numbers

> **Write capacity: at least 60 tx/s single-wallet. Ceiling unknown. Expect ~1–3%
> transient timeouts at any rate.**

Against that, the whole rail — ~10 simulated sessions at 1 Hz plus one aggregate — uses
**under 17% of what one wallet has been observed to sustain**, with the true ceiling
higher and unmeasured.

### Three consequences

**1. Run ten sessions, not nine.** My earlier recommendation to drop to nine for margin is
withdrawn — it was mitigating a limit that does not exist. **AC-5 requires at least ten**
(`REQUIREMENTS.md:598`), and ten is comfortable.

**2. FR-REL-8's wallet pool: optional, unproven, do not build it before freeze.** One
wallet sustained 60 tx/s. The nonce-serialisation argument in §5.1 rests on documented
behaviour — no global mempool, strict per-account ordering — and **may still hold at some
higher rate**, but nothing measured demonstrates it at demo rates. The analysis is kept,
not deleted, because it is sound reasoning about a real constraint that simply does not
bind here.

> **The measurement that would prove it** (`REQUIREMENTS.md:740`): several **own funded**
> wallets, from the **venue network**, close to the pitch — comparing single-wallet
> against pooled throughput at rising rates. Until someone runs that, FR-REL-8 is
> unproven in both directions. **It is not worth the hours before freeze.** One funded
> wallet above the 10 MON reserve floor is the plan.

**3. The one durable finding is retry.** Transient timeouts appeared at a low single-digit
rate at *every* load tested, including rates that were otherwise clean. The relay must
retry — which §8's ladder and §M5.9 already required for other reasons. **A finding that
survives the retraction of the measurement that produced it is worth more than the
measurement was.**

### Why §16's split is not reopening

Part of §16's justification was these numbers, and that part is void. The baseline says so
explicitly rather than hiding it (`REQUIREMENTS.md:738`). It stands on the reasons that
never depended on them:

- The crowd path no longer relies on public infrastructure the team does not control.
- **The demo cannot be taken down by someone else's traffic** — which the `0x…0001` nonce
  moving 20 → 89 mid-measurement demonstrates is a live hazard, not a hypothetical.
- Player count is unbounded.

Those were the owner's reasons and they are unaffected. **Reopening a specced, agreed
architecture this late on a corrected number would cost more than it could win.** Recorded
because deciding well under uncertainty is a different skill from deciding correctly with
good data, and this is an example of the former.

### What this does to the earlier sections

| Section | Status |
|---|---|
| §4.1 "the knee is between 40 and 45" | **Void.** Table retained; the interpretation is withdrawn |
| §4.2 "26% of ceiling, 4× headroom" | **Void** — both numerator and denominator were unsound |
| §4.3 N=50 verdict | **Conclusion survives, reasoning replaced.** N=50 at 1 Hz is moot regardless: §16 removed the crowd from the chain, so nothing proposes 50 on-chain sessions. NFR-P-2 is now ~10 simulated |
| §5.2 / §5.4 pool sizing and 150 MON | **Void** — see the §5 banner |
| §16.5 zero-margin budget | **Void** — false alarm |
| §16.7 "single most important number" | **Void as framed.** The re-run is now a nice-to-have, not a gate |
| §16.8 re-derivation to 2–3 wallets | **Void as a conclusion.** Its diagnosis of *my* occupancy error stands and is still worth reading |
| §16.9 `eth_sendRawTransactionSync` unverified | **Stands.** Untouched by this retraction — still never called against this endpoint |
| §8 degradation ladder | **Strengthened.** Retry and the cadence ladder are now the *primary* justified mitigations |

---

## 17. Deployment and live operation

What it takes to run this, test it, put it on a server, and let people use it — with an
honest account of what "ready for people to use" does and does not mean here.

> Operator commands live in `docs/specs/RUNBOOK.md` (owned by `test-author`). This section
> is topology and reasoning; it deliberately does not duplicate the command list.

### 17.1 Hosting topology

| Process | Runs on | Why there | Public? |
|---|---|---|---|
| **`relay`** (M1–M6, M9) | **Render** — decided 2026-08-08 | **Must not have a function-duration cap.** FD-3/ADR-5 puts SSE on this hop, and a serverless platform that kills connections at 300 s would break FR-DASH-8 mid-pitch. That property is the whole basis of the choice. Render is **already chosen for the game server**, so using it for both removes a moving part rather than adding one. Railway, Fly.io or a plain VPS satisfy the same constraint if Render fails | Yes — the wall and game server reach it |
| **`wall`** (M7) | Static build; **served from the relay host**, or run from `file://` on the presenting laptop | Same-origin with the relay removes CORS and one failure mode. Running it locally is the more robust choice on venue wifi and is the recommended default | No — projector only |
| **`ops`** (M9 surface) | Same origin as the wall | Shared-secret header; physical laptop control is the security model (TB-4) | No |
| **`booth-app`** (M8) | **Vercel**, per its own spec | Static React build; the 300 s cap is irrelevant because ADR-5 already puts this hop on polling | **Yes — QR code** |
| **`game-server`** (M10) | **Cloud, not the venue laptop** | `REQUIREMENTS.md:823` — phones must be able to fall back to cellular when venue wifi degrades. A laptop-hosted game server dies with the wifi | Yes |
| **`PlugNPay.sol`** (M3, M4) | Monad testnet, chain **10143** | — | Public by nature |

```
   PUBLIC INTERNET                          │        VENUE / LOCAL
                                            │
  phone ──QR──► booth-app (Vercel)          │   wall (browser, projector)
                     │  polling             │        ▲
                     ▼                      │        │ SSE  (no Vercel in path)
              game-server (cloud) ──────────┼────────┤
                     │                      │        │
                     │ room aggregate       │   relay (long-lived Node host)
                     │ at pitch close       │        │
                     └──────────────────────┼────────┘
                                            │        │ eth_sendRawTransactionSync
                                            │        ▼
                                            │   Monad testnet 10143
```

**Zero chain calls cross from the booth side.** The only line from the crowd to the chain
is the single aggregate at the close, and it is submitted by the relay from a
team-controlled wallet — never by a phone (FR-SPLIT-1).

### 17.2 Configuration and secrets

| Process | Variable | Shape | Source |
|---|---|---|---|
| relay | `RPC_URLS` | comma-separated URLs | Config. `https://testnet-rpc.monad.xyz` (`docs/monad_dev_resources.md:141`) |
| relay | `CHAIN_ID` | `10143` | Config (`docs/monad_dev_resources.md:113`) |
| relay | `CONTRACT_ADDRESS` | `0x…` | Deploy output |
| relay | **`POOL_PRIVATE_KEYS`** | comma-separated 32-byte hex | **Secret — §17.3** |
| relay | **`METER_PRIVATE_KEYS`** | comma-separated 32-byte hex | **Secret** |
| relay | `OPS_SHARED_SECRET` | random 32-byte hex | **Secret**; generated per event |
| relay | `N_SIM_MAX` | integer, **9 recommended** (§16.5) | Config |
| wall | `RELAY_URL` | URL | Config |
| booth-app | `GAME_SERVER_URL` | URL | Vercel env, public |
| game-server | `TAP_CAP_PER_SEC` | `30` (FR-BOOTH-13) | Config |
| game-server | `UPSTASH_REDIS_REST_URL` / `_TOKEN` | URL + token | **Secret** — Vercel Marketplace (`2026-08-08-booth-frontend-design.md:36`) |

**Note the booth column has no key material at all.** FR-SPLIT-1 makes that structural
rather than a policy someone has to remember.

### 17.3 How the private keys reach the process without touching the repository

**NFR-S-4 is absolute: no private key is committed.** Four layers, because one is a
policy and four is a control:

1. **Runtime injection only** — keys arrive as environment variables set in the host's
   secret manager (Railway/Render/Fly secrets, or `systemd` `EnvironmentFile` with mode
   `600` on a VPS). They are never written to a file in the working tree.
2. **`.gitignore` carries `.env*`** before the first key exists, not after.
3. **A pre-commit hook** rejecting `0x[0-9a-fA-F]{64}` in the staged diff.
4. **A CI job** running the same grep over the whole history, so a bypassed hook is still
   caught.

Local development uses a `.env` file that is gitignored; production uses the host's
secret store. **The `.env.example` committed to the repo carries variable names and empty
values only.**

**⚠ Do not reuse the public test key `0x…0001`** that the write measurement ran from
(`REQUIREMENTS.md:738`). It is well known, other teams use it, and anything it holds is
shared with strangers.

**What the README must disclose (NFR-S-5), verbatim-ready:**

> **Hot wallet exposure.** The relay holds the private keys for a small pool of wallets
> (2–3) funded with Monad **testnet** MON only — approximately **36 MON**, which has no
> mainnet value and cannot be exchanged for anything. The keys live in the host's secret store
> and are not in this repository. There is no mainnet deployment and no production key
> management; both are explicitly out of scope (`REQUIREMENTS.md` §14). If you fork this,
> generate your own keys — do not reuse any address referenced in the docs.

### 17.4 Contract deployment and verification (NFR-M-2, AC-9, CON-2)

```bash
forge script script/Deploy.s.sol \
  --rpc-url https://testnet-rpc.monad.xyz --chain 10143 --broadcast
```

Then **the verification API, not `forge verify-contract` directly** — it verifies on
MonadVision, Socialscan and Monadscan in one call
(`.agents/skills/scaffold/SKILL.md:97`):

```bash
forge verify-contract <ADDR> PlugNPay --chain 10143 --show-standard-json-input \
  > /tmp/standard-input.json
# POST → https://agents.devnads.com/v1/verify
#   { chainId: 10143, contractAddress, contractName: "contracts/PlugNPay.sol:PlugNPay",
#     compilerVersion, standardJsonInput, foundryMetadata }
```
(`.agents/skills/scaffold/SKILL.md:105-161`.) Fallback only on API failure:
`--verifier sourcify --verifier-url "https://sourcify-api-monad.blockvision.org/"`
(`:169-172`).

**AC-9 is satisfied when a stranger can open the contract address on
`https://testnet.monadvision.com` and read the source.** Verification that has not been
checked from a logged-out browser has not been checked — do that once, before freeze.

### 17.5 What "ready for people to use" honestly means

This deserves a straight answer, because a reviewer will ask and a vague answer costs
more than the limitation does.

**What a member of the public can actually do:** scan the QR, play the booth game on
their phone with no install, no login and no wallet, see their score on a public
leaderboard, and watch the projector show real settlements landing on Monad testnet.

**What they cannot do, by design:** use this to charge a car. **There is no driver-facing
product and there was never going to be one** (`idea.md:66`; actor A6 owns no UI
requirement, `REQUIREMENTS.md:120`). Plug-N-Pay is a settlement rail. The consumer
experience in `story.md` is what a downstream app — a carmaker's dashboard, a charging
network's app — would build *on top of* this.

**Under unattended public load:** the booth app is the only public surface, it makes zero
chain calls, and its limit is the game server's, not the chain's (FR-SPLIT-6). It scales
like any static site plus a small Redis-backed API. **Nothing a member of the public does
can consume RPC budget or move real value.** That property is the whole point of the §16
split.

**What is NOT production-ready — state these before being asked:**

| | Why |
|---|---|
| **The relay is a trusted party** | It verifies meter signatures off-chain and the contract settles on its attestation (ASM-6, §3). A compromised relay can overstate energy within an open session. Closing it needs a ZK proof of the verified batch |
| **Testnet only** | Chain 10143. MON here has no value. Mainnet deployment, audits and production key management are out of scope (`REQUIREMENTS.md` §14) |
| **Demo-funded hot wallets** | ~150 MON of testnet MON in keys held by one process on one host. Adequate for a demo, nowhere near adequate for custody |
| **The handshake is modelled on ISO 15118, not conformant** | No certificate chain, no revocation, no provisioning (CON-7, FR-ID-2) |
| **Metering is simulated** | Labelled as such everywhere (FR-MET-5). Real legal-for-trade metering is out of scope |
| **No audit, no formal verification** | Four hours of build |
| **The write ceiling is one provisional measurement** | §16.7 |

**This list is an asset, not a liability.** `REQUIREMENTS.md:819` puts it exactly right:
a peer vote punishes perceived overclaiming far harder than it punishes modest scope.

### 17.6 Pre-flight checklist for going live

Ordered. Each row is checkable by someone other than the person who built it.

| # | Check | Gate | Requirement |
|---|---|---|---|
| **1** | 🔴 **Probe `eth_sendRawTransactionSync`** against `testnet-rpc.monad.xyz`. Two minutes, one curl. **ADR-3 assumes it exists and it has never been called** — the write runs used async `eth_sendRawTransaction`. This is now the top unknown, the RPC-ceiling one having been retracted | **T-4h, first** | §16.9 |
| 2 | Faucet's real per-address amount and interval established (replaces the UNVERIFIED note) | T-4h | ASM-1 |
| 3 | **One wallet** funded **above the 10 MON reserve floor** — reads ≥12 MON. One faucet claim; no pool, no consolidation (§16.10) | T-3h | §5.3, §16.10 |
| 3b | *Optional, only with spare time:* multi-wallet throughput comparison from the **venue network** with **own** funded keys. Settles FR-REL-8 either way. **Not a gate** — a single wallet has run 60 tx/s clean | — | §16.10 |
| 4 | Funding transfers **≥3 blocks old**; readiness proven by a **successful test transaction**, never a balance read | T-2h30 | §5.5.1 |
| 5 | Identity pool of 60 registered and confirmed | T-2h30 | FR-SIM-6 |
| 6 | Contracts deployed **and verified** — checked from a logged-out browser | T-2h | NFR-M-2, AC-9 |
| 7 | Read-path rate re-measured **from the venue** — `node tools/measure-rpc.mjs`. Below 15 req/s triggers the §4.5 sharding decision | T-30min | CON-5, §11 C3 |
| 8 | All RPC endpoints reachable from the venue network | T-30min | ASM-3 |
| 9 | Degraded mode **rehearsed**, not just implemented — force it, watch the wall label it, watch it recover | T-1h | FR-OPS-3, AC-8, NFR-R-3 |
| 10 | Both FR-OPS-7 injectors fired and visibly refused | T-1h | AC-7, UC-7 |
| 11 | **Rehearsal aggregate minted**, hash saved | **T-10min** | FR-SPLIT-8 |
| 12 | 🔴 **Recorded fallback exists on the presenting laptop**, plays full-screen offline | **T-40min, hard gate** | FR-OPS-5, NFR-R-4, AC-10 |
| 13 | Full beat rehearsed **with zero phones connected** | T-1h | FR-OPS-4, RSK-3 |
| 14 | Game server reachable **over cellular**, not just venue wifi | T-30min | `REQUIREMENTS.md:823` |

**Rows 1 and 12 are the two that must not slip.** Row 1 because every capacity claim in
this document depends on it; row 12 because it is the only thing that survives total
infrastructure failure, and it is always the first casualty of a build running late.

### 17.7 Residual risk after the split

The write-ceiling risk has moved rather than vanished, and it is worth naming where it
went. With the crowd off-chain, **the binding risk is now venue wifi**
(`REQUIREMENTS.md:823`), which is mitigated by hosting the game server in the cloud so
phones fall back to cellular, and by running the wall and relay locally behind a hotspot.

One stale item, flagged not investigated: **`REQUIREMENTS.md:665` (§13.1) still records
the booth cheat defence as a "plausibility ceiling of 4,200"**, which FR-BOOTH-13's 30/s
tap cap superseded. The §13.1 entry is the stale one.

---

## 16.8 The wallet pool, re-derived — measurement against model

**This supersedes §5.2's count and §5.4's MON total. The reasoning in both is kept
because a reviewer will attack the reconciliation, not the number.**

### The two models disagree

| | Model (my §5.2) | Measurement (`REQUIREMENTS.md:731`) |
|---|---|---|
| Claim | 1 wallet ≈ 1.67 tx/s | **1 wallet = 10 tx/s clean** |
| Basis | 600 ms occupancy × one in-flight tx per wallet | Observed: 30/30 sends OK at 10 tx/s, p50 50 ms; refusals from 15 up |
| Implies | 6 wallets minimum for 10 tx/s | **1 wallet carries the whole load** |

**The measurement governs.** `CLAUDE.md`: *"When a measurement contradicts a document,
the measurement wins."*

### Where my model was wrong

I conflated **latency** with **serialisation**. The 600 ms figure is the time from submit
to receipt for *one* transaction — and I treated it as though a wallet were held under a
mutex for that whole period. It is not.

**Per-account nonce ordering constrains the order transactions execute in; it does not
constrain how many may be pending.** A wallet can have several transactions in flight
with sequential nonces, and the node accepts and orders them. "No global mempool"
(`docs/monad_dev_resources.md:238`) limits *propagation between leaders* — it is not a
statement about per-account pipelining, and I over-read it.

**What the 600 ms figure is actually good for:** it is the **latency** input to NFR-P-3's
one-second wall-visibility budget (§7.2), where it remains correct and load-bearing. It
was never a throughput bound.

### The load also shrank

```
BEFORE §16:  60 booth @ 6 s  = 10.0 tx/s
             + 10 sim @ 1 Hz  (substituted, so not additive)
             --------------------------------
                              = 10.0 tx/s   at the measured ceiling, zero margin

AFTER  §16:  booth            =  0.0 tx/s   (FR-SPLIT-1 — zero, structurally)
             ~10 sim @ 1 Hz   = 10.0 tx/s
             1 aggregate      ≈  0.0 tx/s   (one transaction, once)
             --------------------------------
                              = 10.0 tx/s   still at the ceiling — but from ONE wallet
```

### The corrected sizing

**2–3 wallets, ~30 MON.** The pool exists for **margin**, not capacity — a single wallet
measured at exactly the ceiling has none, and the measurement is provisional (§16.7).

| Option | Wallets | MON | Trade-off |
|---|---|---|---|
| **A — fund 2–3 wallets** *(recommended)* | 3 | 3 × ~12 = **~36 MON** | One or two faucet claims even at a 10 MON/24h limit. **No consolidation exercise.** Spreads 10 tx/s across three accounts, so any single-account limit has 3× headroom |
| **B — drop to 6–8 simulated sessions** | 1–2 | ~24 MON | ~7 tx/s against a measured 10 is comfortable on one wallet. AC-5's bar is *ten concurrent sessions* — and the aggregate plus a live V2G session can count toward it |
| ~~C — 10 wallets, 150 MON~~ | ~~10~~ | ~~150~~ | **Superseded.** Sized for a load that no longer exists, from a model the measurement contradicts |

**Recommendation: A, and consider A+B together.** Three wallets running eight sessions is
~7 tx/s across three accounts — comfortable on every axis, and it costs two faucet claims.

### What survives from §5.4, and what it is worth

**The 10 MON reserve-floor finding stands and still matters.** Below 10 MON a wallet is
throttled to ~1 tx per 1.2 s
(`.agents/skills/concepts/references/reserve-balance.md:9`), which would break the design
outright. So each wallet still needs **>10 MON resident plus burn**, and the floor still
dominates the 11–27 MON gas figure.

**What changed is its severity.** At 10 wallets the floor demanded 100 MON resident and,
against a possible 10 MON/24h faucet, a consolidation exercise — **a blocker**. At three
wallets it demands ~30 MON, which is one or two claims — **a checklist item**. Same
finding, an order of magnitude less dangerous, because the fix was to need fewer wallets
rather than to find more MON.

### FR-REL-8's status

FR-REL-8 mandates a pool "sized so the target transactions per second can be issued in
parallel". At 2–3 wallets it is **satisfied but no longer load-bearing** — and
`REQUIREMENTS.md:740` is explicit that whether the ceiling is the node's or one account's
is still unproven. The multi-wallet re-run in §16.7 answers it and is still the
highest-value twenty minutes available: if the ceiling rises with the pool, option A gains
real headroom; if it does not, 10 tx/s is the node's and option B is the safer bet.

## 16.9 `eth_sendRawTransactionSync` — unverified, and ADR-3 depends on it

**The write measurement did not use it.** `REQUIREMENTS.md` §13.4's run used viem's
standard `sendTransaction` — async `eth_sendRawTransaction`. **The sync variant has never
been called against `https://testnet-rpc.monad.xyz`**; ADR-3 rests on documentation alone
(https://docs.monad.xyz/reference/json-rpc/api, fetched 2026-08-08).

Two consequences worth stating plainly:

- The measured 10 tx/s is for the **async** path. §4.2's one-call-per-tick budget is
  therefore **unproven on this endpoint**, not merely unmeasured.
- If the method is absent, each tick costs 2–4 RPC calls instead of 1. Against a 10 tx/s
  ceiling already at 100%, that is not survivable at ten sessions.

**Fallback, to be applied as one change:** set `USE_SYNC_SEND=false`, use
`eth_sendRawTransaction` plus a receipt poll, **and cut simulated sessions to 5–6 in the
same commit.** The session cut is not optional in that branch.

**Probe cost: two minutes.** One `curl` with a signed raw transaction against the
endpoint, checking whether the method exists at all. It belongs in the same twenty
minutes as §16.7's multi-wallet run.
