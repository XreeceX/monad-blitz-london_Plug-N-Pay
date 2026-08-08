# Monad Testnet Facts Sheet — for Plug-N-Pay architecture

Scope: answers Q1–Q14 as assigned. System modeled (task-brief parameters, not independently sourced claims): 1 tx per charging session per second, from a pool of funded relay wallets, 10 sessions rehearsed / 50 sessions stretch, 180 s demo, chain 10143 (Monad Testnet, confirmed live via `eth_chainId` — see Q12). Every numeric/factual claim below carries its citation on the same line — `path:LINE` for local files, full URL for web sources. Local sources read 2026-08-08 (session start); web sources fetched live 2026-08-08 as noted per-claim.

---

## Q1 — RPC rate limits, per endpoint

Three public Monad Testnet RPC endpoints are documented, per `docs/monad_dev_resources.md:141-143`:

| Provider | HTTP / WS | rps limit | eth_call / eth_estimateGas | Batch limit | Archive |
|---|---|---|---|---|---|
| QuickNode | `https://testnet-rpc.monad.xyz` / `wss://testnet-rpc.monad.xyz` | **50 rps** (`docs/monad_dev_resources.md:141`) | **25 rps**, half the general limit (`docs/monad_dev_resources.md:141`) | 100 (`docs/monad_dev_resources.md:141`) | Yes (`docs/monad_dev_resources.md:141`) |
| Ankr | `https://rpc.ankr.com/monad_testnet` | **300 req / 10 s** (≈30 rps average) (`docs/monad_dev_resources.md:142`) | not separately limited beyond the 300/10s and 12,000/10min caps (`docs/monad_dev_resources.md:142`) | 100 (`docs/monad_dev_resources.md:142`) | No, and no `debug_*` (`docs/monad_dev_resources.md:142`) |
| Monad Foundation | `https://rpc-testnet.monadinfra.com` / `wss://rpc-testnet.monadinfra.com` | **20 rps** (`docs/monad_dev_resources.md:143`) | not separately limited | Not allowed (`docs/monad_dev_resources.md:143`) | Yes (`docs/monad_dev_resources.md:143`) |

**Verification against the live docs, as instructed:** fetched `https://docs.monad.xyz/developer-essentials/testnets` on 2026-08-08 — it reproduces the exact same three providers with the exact same numbers: QuickNode 50 rps / 25 rps for eth_call & eth_estimateGas / batch 100 / archive yes; Ankr 300 req/10s + 12,000 req/10min / batch 100 / no archive; Monad Foundation 20 rps / batch not allowed / archive yes (https://docs.monad.xyz/developer-essentials/testnets, fetched 2026-08-08). **The numbers in `docs/monad_dev_resources.md:141-143` are correct.**

**Mismatch found, as instructed to check:** `docs/monad_dev_resources.md:145` cites `https://docs.monad.xyz/reference/rpc-limits` as the source for these testnet figures. That exact URL was fetched twice on 2026-08-08 and currently documents **mainnet-only** content — gas-limit caps (not rps) for `eth_call`/`eth_estimateGas` (200M gas for QuickNode/Monad Foundation, 1B gas for Ankr) and `eth_getLogs` block-range caps (100 blocks QuickNode/Monad Foundation; 1,000 blocks / 10,000 logs Alchemy), for mainnet URLs `rpc.monad.xyz`, `rpc1.monad.xyz` (Alchemy), `rpc3.monad.xyz` (Ankr), `rpc-mainnet.monadinfra.com` (https://docs.monad.xyz/reference/rpc-limits, fetched 2026-08-08, twice, with an explicit prompt hunting for "testnet" and "10143" — neither string appears on that page). **So: the cheat sheet's numbers are right, its citation URL is wrong** — the correct current source for testnet rps figures is `https://docs.monad.xyz/developer-essentials/testnets` (fetched 2026-08-08), not `/reference/rpc-limits`.

**eth_sendRawTransaction:** no separate rate limit is documented for it on any provider — it falls under each provider's general rps figure above (https://docs.monad.xyz/developer-essentials/testnets and https://docs.monad.xyz/reference/rpc-limits, both fetched 2026-08-08, neither lists a distinct figure for it).

---

## Q2 — Per-IP, per-API-key, or global?

**Undocumented — stated explicitly, not assumed.** Both pages that publish the testnet rps numbers were fetched on 2026-08-08 with a prompt asking specifically whether limits are per-IP, per-key, or global: `https://docs.monad.xyz/developer-essentials/testnets` returned "Scope: Not specified (assumed global or per-endpoint)" for every one of the 3 providers, and `https://docs.monad.xyz/reference/rpc-limits` returned "The documentation does not specify whether limits are per-IP address, per-API-key, or globally shared across users" (both fetched 2026-08-08). No public Monad doc found in this session states the scope.

A related note already exists locally: `docs/specs/2026-08-08-booth-frontend-design.md:39` logs "Public testnet RPC rate limit | **Undocumented.** No published req/s or req/day figure" — that note is about whether a number is published at all, and is now superseded on the *number* (the testnets page does publish 50/25/20 rps etc., confirmed above in Q1) — but it is correct, and reinforced by this session's own fetches, on the *scope* question: nothing says per-IP vs per-key vs global.

**Risk (my inference, not documented):** if the limit is per-IP and the venue Wi-Fi NATs the room behind one public IP, every team sharing that IP would be splitting the same 50/25/20 rps ceiling (figures per Q1 above, `docs/monad_dev_resources.md:141-143`), not each getting it individually. Plan for that worst case rather than assuming per-team headroom.

---

## Q3 — Reserve balance

**The floor:** 10 MON per EOA (`.agents/skills/concepts/references/reserve-balance.md:3`). A transaction reverts if the account's ending balance (before gas refunds) drops below `min(starting_balance, 10 MON)` (`.agents/skills/concepts/references/reserve-balance.md:8`, quoted verbatim).

**The throttle — precisely who it applies to:** "**Low-balance accounts** (below 10 MON) can only send one transaction every 3 blocks (~1.2 seconds)" (`.agents/skills/concepts/references/reserve-balance.md:9`, quoted verbatim). This is explicitly scoped to accounts **below** the 10 MON floor. A wallet kept funded **above** 10 MON is not described as subject to this 1-tx-per-1.2s cap.

**What a well-funded account is subject to instead:** "For transaction senders, consensus enforces a cumulative gas budget across all inflight transactions (past 3 blocks): `min(10 MON, lagged_state_balance)`" (`.agents/skills/concepts/references/reserve-balance.md:12`, quoted verbatim). For a wallet with `lagged_state_balance > 10 MON`, that cap is a flat 10 MON of gas spend per rolling 3-block (~1.2 s) window — not a 1-tx cap.

**Applies to a normal EOA doing native-MON contract calls?** Yes — the rule is stated generically for "transaction senders" and for "an EOA," with no carve-out for plain transfers vs. contract calls (`.agents/skills/concepts/references/reserve-balance.md:3,8,12`).

**Does this decide whether the relay pool can hit 50 tx/s?** No, provided every relay wallet is kept funded above 10 MON: the binding rule then is the 10 MON per-1.2s cumulative gas budget (`.agents/skills/concepts/references/reserve-balance.md:12`), and Q6 below computes actual per-tx gas spend around 0.006–0.015 MON — three orders of magnitude under that 10 MON budget — so reserve balance is not what would stop 50 tx/s. **If any relay wallet is allowed to drop below 10 MON, it is capped at ~0.83 tx/s (1 tx / 1.2 s) individually** (`.agents/skills/concepts/references/reserve-balance.md:9`), which would break the per-second-per-session design for that wallet.

Two exceptions, not directly load-bearing here but worth recording: an **emptying transaction** lets an undelegated account with no other tx in the past 3 blocks spend below the reserve (`.agents/skills/concepts/references/reserve-balance.md:10`); **EIP-7702 delegated accounts cannot use that exception** (`.agents/skills/concepts/references/reserve-balance.md:11`).

Reference: `https://docs.monad.xyz/developer-essentials/reserve-balance` (`.agents/skills/concepts/references/reserve-balance.md:14`).

---

## Q4 — Async execution / newly funded accounts

**The exact delay:** consensus runs on a **3-block delayed state view, `D=3`** — "The state root included in a block is from 3 blocks prior" (`.agents/skills/concepts/references/async-execution.md:7`, quoted). "**Newly funded accounts cannot send transactions until their funding transfer is `D` blocks old** (~1.2 seconds after the transaction is included). This is because consensus validates gas budgets against the delayed state, and the funding won't be visible yet" (`.agents/skills/concepts/references/async-execution.md:8`, quoted verbatim).

**Workaround documented:** use a smart contract to atomically combine funding and spending in a single transaction, bypassing the delay (`.agents/skills/concepts/references/async-execution.md:9`).

**What a client sees querying balance/nonce right after funding — UNVERIFIED for the exact RPC read behaviour.** The reference explicitly states only that `eth_call` and `eth_estimateGas` "simulate against speculatively executed state, so they return accurate results even though execution technically lags consensus" (`.agents/skills/concepts/references/async-execution.md:11`, quoted) — it does not say what `eth_getBalance` or `eth_getTransactionCount` return in that same window. **Inference, clearly labelled as inference, not fact:** since `"latest"` maps to the speculatively-executed Proposed state (`.agents/skills/concepts/references/block-states.md:7`), a balance/nonce read at `"latest"` right after funding may show the new funds/incremented nonce immediately, even though the funds are not yet admissible for spending by consensus for another ~1.2 s (`.agents/skills/concepts/references/async-execution.md:8`) — i.e., a naive "poll balance until it updates, then spend" bring-up script could see the new balance and still get the spend rejected. Logged in `## Unverified` below.

**Implication (a) — bringing a wallet pool online:** fund every relay wallet at least 3 blocks (~1.2 s) before it needs to send, and in practice build in minutes of margin ahead of the demo window rather than fund-then-immediately-spend in the same script (`.agents/skills/concepts/references/async-execution.md:8`).

**Implication (b) — nonce management:** because the visibility gap between "readable via RPC" and "admissible to spend" is not documented as identical, don't treat `eth_getTransactionCount` read immediately after funding/sending as a trustworthy "ready" signal — track nonces locally in the relay's own application state, incrementing only after each successful submit, rather than re-querying live per tx.

Reference: `https://docs.monad.xyz/monad-arch/consensus/asynchronous-execution` (`.agents/skills/concepts/references/async-execution.md:13`).

---

## Q5 — Nonce management under parallel submission

**Parallel execution does not change per-account nonce ordering:** "Monad executes transactions in parallel using optimistic concurrency control, but the final result is identical to sequential Ethereum execution. Transaction ordering within a block is preserved" (`.agents/skills/concepts/references/parallel-execution.md:3`, quoted).

**No global mempool — verified and expanded, as instructed.** `docs/monad_dev_resources.md:238` states: "**No global mempool** | Tx forwarded to upcoming leaders only; odd timing under load is possible." Fetched `https://docs.monad.xyz/developer-essentials/differences` on 2026-08-08 to verify: the page states, verbatim, "There is no global mempool. For efficiency, transactions are forwarded to the next few leaders" (https://docs.monad.xyz/developer-essentials/differences, fetched 2026-08-08) — confirms the cheat sheet's claim exactly.

**What happens to a transaction submitted with a nonce gap — UNVERIFIED.** I checked `.agents/skills/concepts/references/parallel-execution.md`, `async-execution.md`, and `reserve-balance.md` in full — none address nonce-gap handling. I then fetched `https://docs.monad.xyz/developer-essentials/differences` on 2026-08-08 with an explicit prompt asking about nonce-gap behaviour — the page does not address it. Logged in `## Unverified` below. **Labelled inference only:** combining the two documented facts above (strict per-account nonce ordering + no persistent global mempool, only forwarding to "the next few leaders"), a gapped transaction likely has a much narrower window to ever be picked up than on Ethereum, where a persistent broadcast mempool can hold a gapped tx indefinitely — this is my reasoning, not a quoted Monad claim.

**Implication for N tx/s from M wallets:** each relay wallet must submit its own transactions strictly in nonce order, one in-flight transaction at a time, never getting ahead of a pending nonce — the pool's N tx/s throughput should come from parallel *independent* nonce sequences (M wallets each doing ≤1 in-flight tx), not from pipelining multiple sequential nonces from a single wallet without confirmation. This matches the system's own design of a wallet pool (`docs/specs/REQUIREMENTS.md:110`, "Run many sessions concurrently").

---

## Q6 — Gas cost model

**Formula:** `gas_paid = gas_limit × price_per_gas` — Monad bills the limit the sender sets, not gas actually consumed (`.agents/skills/gas/SKILL.md:13`). `price_per_gas = min(base_price_per_gas + priority_price_per_gas, max_price_per_gas)` (`.agents/skills/gas/SKILL.md:29`).

**Block gas limit:** 200,000,000 gas (`.agents/skills/gas/SKILL.md:42`). **Transaction gas limit:** 30,000,000 gas (`.agents/skills/gas/SKILL.md:43`). **Minimum base fee:** 100 MON-gwei = 100 × 10⁻⁹ MON per gas unit (`.agents/skills/gas/SKILL.md:44`).

**Cold vs warm access costs:** account access (`BALANCE`, `CALL`, etc.) cold = 10,100 gas, warm = 100 gas (`.agents/skills/gas/SKILL.md:115,117`). Storage access (`SLOAD`, `SSTORE`) cold = 8,100 gas, warm = 100 gas (`.agents/skills/gas/SKILL.md:116,118`). A standalone native-MON transfer (no contract logic) is a fixed 21,000 gas (`.agents/skills/gas/SKILL.md:22`).

**Worked burn estimate (task-brief parameters, not independently sourced) — settle() touching 4 cold storage slots + 1 native-MON transfer, 1×/s/session, 180 s, at 10 and 50 sessions:**

Assumptions stated explicitly (none of these 4 are a Monad-specific documented figure for a *contract call*, only for a plain transfer):
- **A1:** 21,000 gas is used as the base intrinsic cost of the settle transaction itself, extrapolating the only base-cost figure the skill gives — the plain-transfer figure (`.agents/skills/gas/SKILL.md:22`) — to a contract-calling tx, consistent with Monad's stated Ethereum/EIP-1559 compatibility but not itself quoted for contract calls.
- **A2:** the internal native-MON transfer is a `CALL` with value to a cold (first-touched) recipient in that tx = 1 × 10,100 gas (`.agents/skills/gas/SKILL.md:115,121`).
- **A3:** "4 cold storage slots" = 4 cold `SLOAD`/`SSTORE` ops = 4 × 8,100 = 32,400 gas (`.agents/skills/gas/SKILL.md:116`).
- **A4:** control flow, `require` checks, event emission (needed for the dashboard, see Q9), and memory expansion are not covered by A1–A3 and have no Monad-specific figure in the skill — rather than invent one, two bounds are shown below: a **documented floor** (A1+A2+A3 only) and my own **assumed practical limit**, explicitly flagged as an assumption, not a sourced number.

Documented floor per tx = 21,000 + 10,100 + 32,400 = **63,500 gas** (`.agents/skills/gas/SKILL.md:22,115,116,121`, summed).
My assumed practical gas limit per tx (≈2.4× the floor, covering what A1–A3 don't) = **150,000 gas — my assumption, not sourced.**

Cost per tx at the minimum base fee, 100 × 10⁻⁹ MON/gas (`.agents/skills/gas/SKILL.md:44`), zero priority fee:
- Documented floor: 63,500 gas × 0.0000001 MON/gas (100×10⁻⁹ MON/gas minimum base fee, `.agents/skills/gas/SKILL.md:44`) = **0.00635 MON/tx**.
- Assumed practical: 150,000 gas × 0.0000001 MON/gas (100×10⁻⁹ MON/gas minimum base fee, `.agents/skills/gas/SKILL.md:44`) = **0.015 MON/tx**.

Total transactions over the 180 s window, at 1 tx/s/session (task-brief parameters, not independently sourced):
- 10 sessions (task-brief parameter): 10 × 180 s = **1,800 tx**.
- 50 sessions (task-brief parameter): 50 × 180 s = **9,000 tx**.

Total MON burned at the minimum base fee:

| Scenario | Documented floor (63,500 gas/tx, per `.agents/skills/gas/SKILL.md:22,115,116,121` above) | My assumed practical (150,000 gas/tx, my assumption, not sourced) |
|---|---|---|
| 10 sessions, 1,800 tx (task-brief params above) | 1,800 × 0.00635 MON = **11.43 MON** | 1,800 × 0.015 MON = **27 MON** |
| 50 sessions, 9,000 tx (task-brief params above) | 9,000 × 0.00635 MON = **57.15 MON** | 9,000 × 0.015 MON = **135 MON** |

**Conclusion: gas is not the binding constraint.** Even the padded high estimate (135 MON for the 50-session stretch) is small change relative to fractions-of-a-cent-per-tx economics already claimed for the chain (`.agents/skills/why-monad/SKILL.md:49-52`) — the ceiling this system will hit first is the RPC rate limit (Q1, Q7), not MON supply.

**Reserve-balance cross-check (ties to Q3):** the per-3-block cumulative gas budget cap is `min(10 MON, lagged_state_balance)` (`.agents/skills/concepts/references/reserve-balance.md:12`). At 0.015 MON/tx (my assumed practical figure), even 3 in-flight tx from one wallet inside the same 1.2 s window costs only 0.045 MON — far under the 10 MON cap — so that cap does not bind at this system's scale either, as long as every relay wallet stays funded above 10 MON.

---

## Q7 — eth_sendRawTransactionSync

**What it does:** submits a signed transaction and blocks until its execution completes, rather than returning immediately like standard `eth_sendRawTransaction` (https://docs.monad.xyz/reference/json-rpc/api, fetched 2026-08-08). Flagged locally at `.agents/skills/monskill/SKILL.md:31` and `.agents/skills/why-monad/SKILL.md:35-37` ("allows getting the transaction receipt in the same request that is sending them").

**What it returns:** a full transaction receipt object — status, gas used, logs, block info — the same shape `eth_getTransactionReceipt` returns (https://docs.monad.xyz/reference/json-rpc/api, fetched 2026-08-08).

**Timeout behaviour:** accepts a `timeout_ms` parameter and blocks until the receipt is available or that timeout expires (https://docs.monad.xyz/reference/json-rpc/api, fetched 2026-08-08).

**Removes the separate receipt poll?** Yes, confirmed explicitly: it "eliminates the need for separate `eth_getTransactionReceipt` polling. Applications receive confirmation in a single synchronous call" (https://docs.monad.xyz/reference/json-rpc/api, fetched 2026-08-08).

**Quantified — RPC calls per settled tick:**
- **With it:** exactly **1 RPC call/tick** (send+receipt combined) (https://docs.monad.xyz/reference/json-rpc/api, fetched 2026-08-08).
- **Without it:** 1 call to `eth_sendRawTransaction` + a null-until-mined poll to `eth_getTransactionReceipt`, needing roughly 1 attempt per ~300 ms block (current block time — see Q10, https://docs.monad.xyz/, fetched 2026-08-08) until inclusion — a conservative **2–4 RPC calls/tick**.
- **At the 50-session stretch (50 ticks/s, task brief figure):** with the sync method, **50 RPC calls/s** for settlement — exactly the QuickNode endpoint's published 50 rps ceiling (`docs/monad_dev_resources.md:141`; https://docs.monad.xyz/developer-essentials/testnets, fetched 2026-08-08), leaving **zero headroom** on that key for the dashboard (Q9), nonce/balance checks, or retries. Without the sync method, **≈100–200 RPC calls/s** for settlement alone — already over every single published endpoint's cap (50/30-avg/20 rps, Q1) before the dashboard adds anything.

---

## Q8 — Block states and finality

Four states, each mapped to a JSON-RPC tag (`.agents/skills/concepts/references/block-states.md:5-10`):

| State | Meaning | JSON-RPC tag |
|---|---|---|
| Proposed | leader proposed, no votes yet, speculatively executed | `"latest"` (`.agents/skills/concepts/references/block-states.md:7`) |
| Voted | supermajority Quorum Certificate | `"safe"` (`.agents/skills/concepts/references/block-states.md:8`) |
| Finalized | QC-squared, irreversible without a hard fork | `"finalized"` (`.agents/skills/concepts/references/block-states.md:9`) |
| Verified | delayed merkle root finalized | no tag (`.agents/skills/concepts/references/block-states.md:10`) |

**Which tag for a dashboard needing to show a settlement within 1 second:** `"latest"` (Proposed). At the current authoritative 300 ms block time / 600 ms finality (see Q10, https://docs.monad.xyz/, fetched 2026-08-08), waiting for `"finalized"` means at minimum ~300 ms (average wait for the next block to include the tx) + 600 ms (finality) ≈ **900 ms–1.2 s+** before a settlement is finalized — already at or past the 1-second budget before any RPC/network latency is added. Reading `"latest"`/Proposed-state data (see Q9) is the only tag realistically fast enough.

**Correctness cost of that choice:** "Proposed blocks undergo speculative execution. In rare cases, apps consuming real-time data may see data from blocks that don't become canonical" (`.agents/skills/concepts/references/block-states.md:17`, quoted) — and execution events at Proposed state are explicitly "speculative — the block they belong to might not become canonical" (`.agents/skills/concepts/references/execution-events.md:11`, quoted). So: what the dashboard displays at 1-second latency can, in rare cases, later be reorganised away and be wrong.

Reference: `https://docs.monad.xyz/monad-arch/consensus/block-states` (`.agents/skills/concepts/references/block-states.md:20`).

---

## Q9 — Real-time event consumption

Three sources documented (`.agents/skills/concepts/references/realtime-data.md:5-21`):
1. **Geth-compatible WebSocket** — standard `eth_subscribe` `newHeads`/`logs`, publishes at Proposed state, via third-party RPC providers (`.agents/skills/concepts/references/realtime-data.md:5-9`).
2. **Monad Extended WebSocket** — `monadNewHeads`/`monadLogs`, also Proposed state but earlier, includes consensus progression (`.agents/skills/concepts/references/realtime-data.md:11-15`).
3. **Execution Events SDK** (C/C++/Rust) — fastest, requires running a program on the same host as a Monad node (`.agents/skills/concepts/references/realtime-data.md:17-21`).

**Which source for a dashboard needing every settlement across up to 50 concurrent sessions within 1 s:** Source 1, per the skill's own guidance — "Most app developers should use Source 1 (Geth-compatible) via their RPC provider" (`.agents/skills/concepts/references/realtime-data.md:24`, quoted); Source 3 needs self-hosting a node, out of scope for a 3-minute hackathon build.

**Public WebSocket endpoint limits:** `wss://testnet-rpc.monad.xyz` (QuickNode) is listed under the same provider entry as the HTTP endpoint, sharing one published figure — **50 rps (25 rps for `eth_call`/`eth_estimateGas`)** (`docs/monad_dev_resources.md:141`; https://docs.monad.xyz/developer-essentials/testnets, fetched 2026-08-08).

**Does subscribing to logs count against the same rate limit as HTTP calls? UNVERIFIED.** The docs list one combined rps figure per provider covering both the HTTP and WS URL, which suggests but does not explicitly state a shared budget (https://docs.monad.xyz/developer-essentials/testnets, fetched 2026-08-08 — no separate WS quota is published anywhere found in this session). Logged in `## Unverified` below.

---

## Q10 — Block time and finality, authoritative figure

**The conflict, as flagged:** `.agents/skills/monskill/SKILL.md:30` — "Ethereum compatible, 10,000 tps, 400ms block time, 800ms finality." Also stale at 400 ms/800 ms: `.agents/skills/why-monad/SKILL.md:6`, `.agents/skills/why-monad/SKILL.md:25`, `.agents/skills/concepts/SKILL.md:25`, `.agents/skills/concepts/references/block-states.md:18`. Versus `docs/monad_dev_resources.md:95` ("**300ms** block frequency") and `docs/monad_dev_resources.md:96` ("**600ms** finality"), citing docs.monad.xyz.

**Resolved by live fetch, 2026-08-08:** `https://docs.monad.xyz/` states, verbatim: "The result is an Ethereum-compatible Layer-1 blockchain with 10,000 tps of throughput, 300ms block frequency, and 600ms finality." (https://docs.monad.xyz/, fetched 2026-08-08). The architecture index page `https://docs.monad.xyz/monad-arch/` (fetched 2026-08-08) is a navigation hub only and states no timing figures of its own.

**Current authoritative figure, use this on stage: 300 ms block time / 600 ms finality**, per https://docs.monad.xyz/ (fetched 2026-08-08). The `monskill`, `why-monad`, and `concepts` local skill files are stale on this specific number.

---

## Q11 — Monad brand purple

**Already flagged as unresolved locally:** `docs/specs/2026-08-08-booth-frontend-design.md:40` — "Monad brand purple | **UNRESOLVED.** Live brand kit shows `#6E54FF`; `#836EF9` is widely used across the ecosystem," sourced there to https://www.monad.xyz/brand-and-media-kit.

**Resolved by live fetch, 2026-08-08:** `https://www.monad.xyz/brand-and-media-kit` publishes "Primary Brand Purple ... #6E54FF" (https://www.monad.xyz/brand-and-media-kit, fetched 2026-08-08). Full palette read off the page on the same fetch: #6E54FF (Primary Purple), #DDD7FE (Light Purple), #0E091C (Dark Navy), #000000 (Black), #FFFFFF (White), #85E6FF (Cyan), #B9E3F9 (Light Blue), #FF8EE4 (Pink), #FFAE45 (Orange) — all per https://www.monad.xyz/brand-and-media-kit, fetched 2026-08-08. `#836EF9` does not appear anywhere on the page as fetched.

**Answer: the brand kit publishes `#6E54FF` as of 2026-08-08**, per https://www.monad.xyz/brand-and-media-kit (fetched 2026-08-08). `#836EF9` is ecosystem/community convention, not the vendor's current published value — picking between them for the booth frontend is a design call for whoever owns that spec, not a further fact question.

---

## Q12 — Canonical testnet addresses

**Important caveat found while answering this — flag prominently:** `.agents/skills/addresses/SKILL.md:38` headers its address table "Canonical contracts (**on Monad mainnet**)." Its Wrapped MON entry, `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A` (`.agents/skills/addresses/SKILL.md:42`), is a **mainnet** address. The correct **testnet** Wrapped MON address is different: `0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541` (`docs/monad_dev_resources.md:159`). This is exactly the mainnet/testnet mixup the addresses skill itself warns against — "do not provide mainnet address when a testnet address was asked for" (`.agents/skills/addresses/SKILL.md:15`). An architect reading only the addresses skill's default table would ship the wrong WMON address for this testnet-only build.

**Testnet addresses (never inventing — every one below is quoted from a local skill/doc, then live-verified):**
- **Multicall3:** `0xcA11bde05977b3631167028862bE2a173976CA11` — same on testnet and mainnet (`.agents/skills/addresses/SKILL.md:52`; `docs/monad_dev_resources.md:160`).
- **Wrapped MON (testnet):** `0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541` — testnet-specific, differs from mainnet (`docs/monad_dev_resources.md:159`); do **not** use the mainnet address `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A` (`.agents/skills/addresses/SKILL.md:42`) on testnet.
- **CreateX:** `0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed` — same on testnet and mainnet (`.agents/skills/addresses/SKILL.md:44`; `docs/monad_dev_resources.md:162`).
- **Foundry Deterministic Deployer:** `0x4e59b44847b379578588920ca78fbf26c0b4956c` — same on testnet and mainnet (`.agents/skills/addresses/SKILL.md:51`; `docs/monad_dev_resources.md:163`).

**Skill's instructions for verifying an address has code on testnet:** if Foundry is installed, `cast code [address] --rpc-url https://testnet-rpc.monad.xyz`; if not, call the `eth_getCode` JSON-RPC method against the testnet RPC endpoint and check the response is non-empty (`.agents/skills/addresses/SKILL.md:28-35`).

**I executed that verification myself, live, 2026-08-08**, via `eth_getCode` against `https://testnet-rpc.monad.xyz`: all 4 addresses above returned non-empty bytecode — Multicall3 → `0x608060...` (https://testnet-rpc.monad.xyz, eth_getCode, executed 2026-08-08), Wrapped MON testnet → `0x608060...` (https://testnet-rpc.monad.xyz, eth_getCode, executed 2026-08-08), CreateX → `0x608060...` (https://testnet-rpc.monad.xyz, eth_getCode, executed 2026-08-08), Foundry Deterministic Deployer → `0x7fffff...` (the known "Nick's method" presigned-deploy bytecode pattern) (https://testnet-rpc.monad.xyz, eth_getCode, executed 2026-08-08). Also confirmed `eth_chainId` → `0x279f` = **10143 decimal**, matching the documented testnet chain ID (`docs/monad_dev_resources.md:113`) (https://testnet-rpc.monad.xyz, eth_chainId, executed 2026-08-08).

---

## Q13 — Contract verification

**Preferred method — the verification API, not `forge verify-contract` directly:** "**ALWAYS use the verification API.** It verifies on all 3 explorers (MonadVision, Socialscan, Monadscan) with one call. Do NOT use `forge verify-contract` as your first choice" (`.agents/skills/scaffold/SKILL.md:97`, quoted).

**Invocation (2 steps), quoted from the skill:**
1. Generate the standard JSON input and Foundry metadata: `forge verify-contract <ADDR> <CONTRACT> --chain 10143 --show-standard-json-input > /tmp/standard-input.json`, plus `.metadata` pulled from the compiled `out/<Contract>.sol/<Contract>.json` (`.agents/skills/scaffold/SKILL.md:105-110`).
2. POST to `https://agents.devnads.com/v1/verify` with a JSON body of `chainId` (10143 for testnet), `contractAddress`, `contractName` (`path/File.sol:ContractName` format), `compilerVersion`, `standardJsonInput`, `foundryMetadata`, and optional `constructorArgs` (ABI-encoded, no `0x` prefix) (`.agents/skills/scaffold/SKILL.md:113-161`).

**Fallback only if the API fails:** `forge verify-contract <ADDR> <CONTRACT> --chain 10143 --verifier sourcify --verifier-url "https://sourcify-api-monad.blockvision.org/"` (`.agents/skills/scaffold/SKILL.md:169-172`).

**Which explorer do the official docs prefer for linking — no single one is named.** The verification API itself verifies on all three explorers at once — MonadVision, Socialscan, Monadscan (`.agents/skills/scaffold/SKILL.md:97`). Separately, `.agents/skills/addresses/SKILL.md:13` lists `testnet.monadscan.com` as *the* explorer in its network table for Monad Testnet. This exact ambiguity is already logged locally: `docs/specs/2026-08-08-booth-frontend-design.md:38` — "Testnet explorer | No single canonical one. Docs list `testnet.monadscan.com` and `testnet.monadvision.com`," citing `https://docs.monad.xyz/tooling-and-infra/block-explorers`. I did not re-fetch that page myself — it is outside my 3 assigned web-verification gaps (Q7/Q10/Q11) and a teammate has already logged the same finding from that exact source.

**Satisfies NFR-M-2** ("Contract source is verifiable against the deployed address," `docs/specs/REQUIREMENTS.md:561`) — the verification-API flow above is the documented path to that.

---

## Q14 — Other risks that would break a per-second-settlement demo

- **EIP-7702 restrictions, if the relay or session wallets ever get delegated:** delegated EOAs cannot have any transaction reduce their balance below 10 MON, with **no** emptying-transaction exception (`.agents/skills/concepts/references/eip-7702.md:13`; cross-referenced `.agents/skills/concepts/references/reserve-balance.md:11`), and contract code running *inside* a delegated EOA's call frame cannot use `CREATE`/`CREATE2` — the call frame reverts (`.agents/skills/concepts/references/eip-7702.md:14`). **Correction to the question's framing:** the local reserve-balance reference (`.agents/skills/concepts/references/reserve-balance.md`) does not itself mention `CREATE` — the `CREATE` ban is specifically an EIP-7702-delegated-context rule (`.agents/skills/concepts/references/eip-7702.md:14`), not a general reserve-balance rule. If this build's relay wallets are plain (non-delegated) EOAs, neither the `CREATE` ban nor the loss of the emptying exception applies to them.
- **Historical state limits affecting dashboard backfill:** "full nodes don't provide arbitrary historic state access due to high throughput requirements" (https://docs.monad.xyz/developer-essentials/differences, fetched 2026-08-08) — matches `docs/monad_dev_resources.md:240`, "Historical state limited | Don't build dashboards on deep historic `eth_call` / old logs via full nodes — use events + indexer." No exact retention window (block count / time) is published in anything fetched this session — logged in `## Unverified` below. Implication: a late-joining dashboard or "replay a past session" feature needs the indexer (`.agents/skills/indexer/SKILL.md`), not raw `eth_getLogs` against old ranges.
- **Memory pricing:** linear, not quadratic, capped at 8 MB/tx (https://docs.monad.xyz/developer-essentials/differences, fetched 2026-08-08; matches `docs/monad_dev_resources.md:242`) — not a binding risk for a small `settle()` function, noted for completeness.
- **Contract size limit:** 128 KB max code size (`.agents/skills/why-monad/SKILL.md:29`; `docs/monad_dev_resources.md:241`), 256 KB max init code size (https://docs.monad.xyz/developer-essentials/differences, fetched 2026-08-08) — ample headroom for this system, not a risk.
- **No EIP-4844 blob transactions** (`docs/monad_dev_resources.md:239`) — irrelevant unless blob-carrying txs were ever considered; a one-line "don't" from the local docs.
- **Priority Gas Auction ordering:** transactions within a block are ordered by descending total gas price (base + priority fee), not by arrival/submission time (`.agents/skills/gas/SKILL.md:64`) — if many relay wallets submit near-simultaneously at the same tip, relative on-chain ordering is not guaranteed to match submission order; a design that implies strict chronological settlement ordering across sessions should account for this.

---

## Hard constraints for the architect

1. Fund every relay wallet above the 10 MON reserve-balance floor before the demo — below it, that wallet is capped at ~1 tx per 1.2 s (`.agents/skills/concepts/references/reserve-balance.md:3,9`).
2. A newly funded wallet cannot have a transaction admitted until its funding transfer is 3 blocks (~1.2 s) old — fund the whole wallet pool minutes ahead, never fund-and-immediately-spend (`.agents/skills/concepts/references/async-execution.md:8`).
3. There is no global mempool — transactions are forwarded only to the next few leaders, so each relay wallet must submit strictly in nonce order with no gaps, one in-flight tx at a time (`docs/monad_dev_resources.md:238`; https://docs.monad.xyz/developer-essentials/differences, fetched 2026-08-08).
4. Gas burn is not the binding constraint: the worked 50-session/180 s estimate is 57–135 MON total at the minimum base fee (Q6 arithmetic above, `.agents/skills/gas/SKILL.md:22,44,115,116`).
5. The QuickNode public testnet endpoint caps at 50 requests/second; using `eth_sendRawTransactionSync` for every tick, the 50-session stretch needs exactly 50 RPC calls/second, saturating that endpoint's entire quota with zero headroom left for the dashboard or nonce checks (`docs/monad_dev_resources.md:141`; https://docs.monad.xyz/developer-essentials/testnets, fetched 2026-08-08).
6. Without `eth_sendRawTransactionSync`, 50 sessions need roughly 100–200 RPC calls/second for settlement alone, which exceeds every published public-endpoint cap outright (Q7 arithmetic; https://docs.monad.xyz/reference/json-rpc/api, fetched 2026-08-08).
7. Whether the RPC rate limit is per-IP, per-key, or global is undocumented — design for the worst case (shared venue IP) rather than assuming per-team headroom (https://docs.monad.xyz/developer-essentials/testnets and https://docs.monad.xyz/reference/rpc-limits, both fetched 2026-08-08, neither states scope).
8. The correct Wrapped MON address for this testnet build is `0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541`, not the mainnet address `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A` that appears in the local addresses skill's default table (`docs/monad_dev_resources.md:159` vs `.agents/skills/addresses/SKILL.md:42`).
9. A live settlement dashboard should read at the `"latest"` (Proposed) tag via Geth-compatible WS logs to land within 1 second, accepting that a small fraction of what it shows could later be reorganised away (`.agents/skills/concepts/references/block-states.md:7,17`; `.agents/skills/concepts/references/realtime-data.md:5-9,24`).
10. Quote 300 ms block time / 600 ms finality on stage, not the 400 ms/800 ms figure in the local `monskill`/`why-monad`/`concepts` skill files — the live docs.monad.xyz homepage is current at 300 ms/600 ms (https://docs.monad.xyz/, fetched 2026-08-08).
11. Spreading submissions across all 3 independent public endpoints (QuickNode 50 rps + Ankr ~30 rps avg + Monad Foundation 20 rps ≈ 100 rps combined) is a mathematically available mitigation if a single endpoint's 50 rps proves too tight — my own synthesis from the Q1 figures, not a documented Monad recommendation (`docs/monad_dev_resources.md:141-143`).

---

## Unverified

1. Whether Monad testnet RPC rate limits are scoped per-IP, per-API-key, or globally shared. Tried: WebFetch `https://docs.monad.xyz/developer-essentials/testnets` and `https://docs.monad.xyz/reference/rpc-limits`, both 2026-08-08, with an explicit prompt asking for this; neither page states scope.
2. Exact behaviour of a transaction submitted with a nonce gap on Monad testnet (dropped vs. held pending). Tried: read `.agents/skills/concepts/references/parallel-execution.md`, `async-execution.md`, `reserve-balance.md` in full; none address it. WebFetch `https://docs.monad.xyz/developer-essentials/differences` (2026-08-08) with an explicit prompt asking about nonce gaps — not addressed there either.
3. Whether `eth_getBalance`/`eth_getTransactionCount` immediately reflect a just-received funding transfer even though the funds aren't yet admissible to spend for ~1.2 s (`.agents/skills/concepts/references/async-execution.md:8`). Tried: read `.agents/skills/concepts/references/async-execution.md` in full — only `eth_call`/`eth_estimateGas` are explicitly called out as using speculative (immediate) state; balance/nonce reads are not mentioned either way.
4. Whether the WebSocket subscription on `wss://testnet-rpc.monad.xyz` shares the same 50 rps quota as HTTP calls on that endpoint, or has a separate budget. Tried: WebFetch `https://docs.monad.xyz/developer-essentials/testnets` (2026-08-08) — HTTP and WS are listed under one combined provider entry with one rps figure; no explicit statement that they share the bucket.
5. Exact historical-state retention window (how many blocks/how much time a full node keeps queryable). Tried: WebFetch `https://docs.monad.xyz/developer-essentials/differences` (2026-08-08) — states full nodes don't serve arbitrary historic state, gives no specific number.
6. Which single explorer, if any, the official docs name as *the* preferred one for linking (beyond "all three get verified"). Not independently re-fetched — outside my 3 assigned web gaps (Q7/Q10/Q11); relying on the existing local finding at `docs/specs/2026-08-08-booth-frontend-design.md:38`, itself sourced to `https://docs.monad.xyz/tooling-and-infra/block-explorers`.
7. Real-world (non-minimum) gas price the relay wallets will actually pay. The Q6 burn estimate uses the documented minimum base fee only, as the question specified; the actual base fee rises under load per the base-fee controller (`.agents/skills/gas/SKILL.md:52-58`) and any priority fee is additive on top — not computed here since Q6 asked specifically for the minimum-base-fee figure.

---

## Q15 — Independent review of §13.4

Independent code-and-arithmetic review of `tools/measure-rpc.mjs` and `docs/specs/REQUIREMENTS.md` §13.4 (commit `92eff05`, confirmed real via `git show --stat 92eff05`, run 2026-08-08). Not re-run against the network, as instructed — this is a static review of the code and the numbers already recorded. This measurement empirically refines this file's own Q1/Q7 findings (documented-but-scope-unverified 50 rps, `docs/monad_dev_resources.md:141`, this file's Q1/Q7 sections above) and Hard constraints #5/#11 above — see the synthesis at the end of point 6 below.

**1. Does the tool measure what §13.4 claims it measures?** Yes, on the core claim: the tool sends `eth_blockNumber` (`tools/measure-rpc.mjs:28`), matching "Read calls (`eth_blockNumber`)" (`docs/specs/REQUIREMENTS.md:704`), against the default endpoint `https://testnet-rpc.monad.xyz` (`tools/measure-rpc.mjs:24`), matching `docs/specs/REQUIREMENTS.md:704`. But "five to six seconds per rate" (`docs/specs/REQUIREMENTS.md:704`) hides something worth stating plainly: `SECONDS` is one fixed value applied to every rate inside a single run (`tools/measure-rpc.mjs:25,58`), so one invocation cannot itself produce some rows at 5 s and others at 6 s. Back-solving `sent ÷ rate` from the published table (`docs/specs/REQUIREMENTS.md:706-715`) gives exactly 5 s for 5, 10, 20 and 40 req/s (25/5, 50/10, 100/20, 200/40) and exactly 6 s for 45, 50, 60 and 70 req/s (270/45, 300/50, 360/60, 420/70) — a clean split with zero remainder on all 8 rows. That means §13.4's table is a merge of at least two separate script runs (one at `--seconds 5`, one at `--seconds 6`), not the console output of one `node tools/measure-rpc.mjs` call — not a defect, but a different and undisclosed provenance than "ran it once."

**2. Is the pacing sound?** Yes — open-loop, correctly implemented, no coordinated omission. `phase()` schedules request `i` at a fixed offset from the phase start (`due = start + i * gap`, `tools/measure-rpc.mjs:59`), waits only for that schedule (`tools/measure-rpc.mjs:60-61`), then fires the request and pushes its *promise* onto `inflight` without awaiting the response (`tools/measure-rpc.mjs:62`) — every request for a given rate is scheduled up front regardless of how earlier ones resolve, and results are only collected afterward via `Promise.all` (`tools/measure-rpc.mjs:64`). The code's own comment states the reasoning directly: "without waiting for replies — pacing by arrival time is the point; awaiting each one would measure latency instead of throughput" (`tools/measure-rpc.mjs:51-53`). This is exactly the correct methodology to expose queueing rather than hide it.

**3. Are the reported numbers internally consistent?** Yes, on every one of the 8 rows. `sent = rate × duration` holds exactly for all 8 rows (see point 1's 5 s/6 s split), and `ok + 429 = sent` holds for every row with refusals (`docs/specs/REQUIREMENTS.md:706-715` against `tools/measure-rpc.mjs:66-67,73`): 45 req/s → 267 + 3 = 270; 50 req/s → 296 + 4 = 300; 60 req/s → 350 + 10 = 360; 70 req/s → 416 + 4 = 420. No row fails this check.

**4. Does the conclusion follow from the data?** Partially — the headline is narrower than it reads. "The knee is between 40 and 45 req/s" (`docs/specs/REQUIREMENTS.md:717`) is accurate for *refusal onset*: 0/200 refused at 40 req/s, 3/270 refused at 45 req/s (`docs/specs/REQUIREMENTS.md:711-712`). But the very same sentence in the source document already concedes more than the headline implies — "Latency is flat to about 20 req/s, rises by 40" (`docs/specs/REQUIREMENTS.md:717`) — meaning the rise has already happened *by* 40, not between 40 and 45. The table backs that: p50 is 21 ms at 20 req/s and 81 ms at 40 req/s, a ~4× jump (`docs/specs/REQUIREMENTS.md:710-711`), yet §13.4 still counts 40 req/s as inside the safe "flat-latency band" when using it to justify AC-5's headroom (`docs/specs/REQUIREMENTS.md:721`). **"40–45" is the honest reading for refusal onset; it is an optimistic reading for degradation onset, which the data — and the document's own line 717 — place earlier, around 20–40.**

**5. The write-path gap — a reasoned bound, explicitly not a measurement.** Direction is solid and well-supported: a write costs strictly more server-side work per call than `eth_blockNumber`, for three compounding, independently documented reasons — signature recovery (`docs/specs/REQUIREMENTS.md:722`; this file's Q6 above already recorded Monad pricing `ecRecover` at 6,000 gas vs Ethereum's 3,000, `.agents/skills/gas/SKILL.md:136`, evidence that verification is real added work, even though that figure prices EVM execution, not RPC-gateway admission, so it is supporting context, not a direct measurement of gateway cost), nonce/balance admission against the 3-block-lagged state (this file's Q3/Q4 above; `.agents/skills/concepts/references/reserve-balance.md:12`, `async-execution.md:8`), and no persistent mempool to absorb arrival bursts — forwarding only to the next few leaders (this file's Q5 above; `docs/monad_dev_resources.md:238`). `tools/measure-rpc.mjs:10-15` and `docs/specs/REQUIREMENTS.md:722,725` all independently state the same qualitative conclusion: write ceiling below 40 req/s, unmeasured. **I will not manufacture a specific percentage for this** — there is no documented benchmark in anything read this session comparing `eth_sendRawTransaction(Sync)` throughput to `eth_blockNumber` throughput on this endpoint, and producing one because a number "is worth a lot right now" is the exact failure mode this review exists to catch. The one real, citable anchor is indirect and weak: on this same QuickNode endpoint, execution-adjacent calls are already documented at half the general rate — `eth_call`/`eth_estimateGas` at 25 rps vs. the general 50 rps (`docs/monad_dev_resources.md:141`). If that 2× discount were analogous it would suggest a write ceiling near 20 req/s, but `eth_sendRawTransaction` is not itself in that documented halved bucket (this file's Q1 above found no published limit for it specifically), and a real write carries more added work than `eth_call` (nonce/state admission and leader-forwarding on top of execution), so 20 req/s is not a defensible floor either — it is only the nearest documented number available. **Bound stated honestly: write ceiling is somewhere under 40 req/s, direction only, no defensible percentage — the write-path run §13.4 itself calls for (`docs/specs/REQUIREMENTS.md:725`) is the only way to turn this into a number.**

**6. Does 10 tx/s actually have the headroom §13.4 claims?** No, not as stated, though the arithmetic on its own terms is correct. "Roughly four times headroom" (`docs/specs/REQUIREMENTS.md:721`) is 40 req/s ÷ 10 tx/s — but it divides a write workload (10 tx/s of settlement) by a *read-only* ceiling, which §13.4's own next lines already flag as provisional: "the write ceiling is strictly lower than 40" (`docs/specs/REQUIREMENTS.md:722`), and "before trusting 10 tx/s of settlement... only that number tells you whether AC-5 is safe" (`docs/specs/REQUIREMENTS.md:725`) — the source document questions its own headline two paragraphs later. Two more draws on the same budget are also uncounted: the dashboard's own concurrent read/WS traffic against the identical endpoint (this file's Q9 above), and the fact that 40 req/s is where latency has already risen ~4× rather than still being flat (point 4 above). **Four times is not a real safety margin — it is an upper bound computed against the wrong (read) ceiling. The true margin is thinner, direction only; only the deferred write-path measurement turns this bound into an actual number.** This converges with, and empirically sharpens, this file's own earlier Q1/Q7 findings and Hard constraints #5 and #11: the documented-but-scope-unverified 50 rps ceiling this file worked from turns out to be optimistic even for reads — real degradation starts by 40 req/s, below the documented figure, not above it.

**Bonus observation, not one of the six asked, cheap to record:** the script's early-stop condition only watches outright refusals, not latency — `if (!clean && r.rateLimited > r.sent * 0.1) break;` (`tools/measure-rpc.mjs:94`) — so at 70 req/s, with p50 = 1,960 ms and only 4/420 (0.95%) refused (`docs/specs/REQUIREMENTS.md:715`), the loop would not have broken on that condition; 70 req/s reads as the last rate someone chose to test, not a rate the tool itself judged unsafe and stopped at. A dashboard could be timing out well before the tool would ever tell it to stop.
