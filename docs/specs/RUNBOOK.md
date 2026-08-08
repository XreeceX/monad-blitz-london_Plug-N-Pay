# Plug-N-Pay — Runbook

| | |
|---|---|
| **System** | Plug-N-Pay — per-second machine-to-machine settlement for EV charging on Monad testnet |
| **Order** | Run it → test it → push to a live server → ready for people to use (the user's ask, verbatim) |
| **Companion** | `docs/specs/TEST-PLAN.md` — what "test it" means in detail |
| **Chain** | Monad testnet, chain ID `10143` (`0x279f`). Mainnet is `143` — do not confuse them |

## 0. Document status

> ### ⚠️ Read this before treating any RPC number below as a gate
>
> **Both measured RPC ceilings have been retracted** (`REQUIREMENTS.md` §13.4, commit `d47a36c`). A re-test
> returned **25 tx/s clean · 40 tx/s with 10 timeouts · 60 tx/s clean, same wallet**. A failure rate that does
> not rise with load is not a ceiling — it was transient noise read as rate limiting. The read knee
> (40–45 req/s) has the identical defect: 3 refusals in 270 called a limit on the same reasoning. Every run
> also used the **shared public key `0x…0001`**, whose nonce moved from 20 to 89 between runs, so contention
> was never ruled out.
>
> **Wherever this document still shows `10 tx/s` or `40–45 req/s` as a target, bar, or expected result, it is
> stale.** Do not fail a build wave against them. Current honest statement of write capacity:
> **at least 60 tx/s single-wallet, ceiling unknown, expect ~1–3% transient timeouts at any load.**
>
> Two consequences that save real time today: **the zero-margin alarm was false** — run the full ten sessions
> AC-5 asks for, not nine — and **FR-REL-8's wallet pool is unproven**, so fund one or two wallets and do not
> spend the afternoon assembling a pool. The one durable finding across every run is that **the relay needs
> retry**, which it needed anyway.


Drafted before `docs/specs/ARCHITECTURE.md`, `API.md`, or `DESIGN.md` existed, patched against each as it landed, then **corrected again 2026-08-08 for REQUIREMENTS.md §16 — the demo/backend split.** Everything this document said about a `BOOTH_ONCHAIN` flag gating booth settlement is now moot, not merely outdated: the booth app makes **zero chain calls**, full stop (§16.1). It runs the settlement engine in memory against a game server (M10), and the room's combined energy settles once, at the end, as a single real `settleRoomAggregate` transaction (§16.4, FR-SPLIT-7/8) — not per-player, not behind a flag. `DESIGN.md` §0.1's repo layout otherwise stands (`contracts/`, `relay/`, `wall/`, `ops/`, `booth/`, `tools/`), with the game server (M10) added as a new deployable surface (§5.3 below). Wallet-pool sizing in §5.4/§6 reflects the actual single-wallet write measurement (10 tx/s clean, REQUIREMENTS.md §13.4) rather than an earlier 10-wallet/150-MON estimate that sized a pre-§16 world where 60 booth players each settled individually on-chain.

---

## 1. Prerequisites

| Tool | Version / how to get it | Verify | Source |
|---|---|---|---|
| Monad Foundry | `curl -L https://foundry.category.xyz \| bash` then `foundryup --network monad` | `forge --version` | docs/monad_dev_resources.md §5 |
| Node.js | **Not pinned in any source document — unverified minimum.** Use current LTS; `npm create vite@latest` (booth's own scaffold command, booth spec §13) will tell you if it needs newer | `node --version` | — |
| npm | Ships with Node. Used throughout (booth spec's scaffold command is `npm create vite@latest`) | `npm --version` | booth spec §13 |
| git | Any recent version | `git --version` | — |
| MONSKILLS (for agent-assisted work) | `npx skills add therealharpaljadeja/monskills`, run from repo root | `.agents/skills/monskill/` exists | `CLAUDE.md`, docs/monad_dev_resources.md §7b |
| A funded testnet wallet | `https://faucet.monad.xyz` | `cast balance <addr> --rpc-url https://testnet-rpc.monad.xyz` returns nonzero | docs/monad_dev_resources.md §3 |

**On the faucet:** its per-request amount and rate limit are **unverified** — no published figure exists (booth spec constraint #10; monad-facts.md §"Unverified" doesn't resolve it either). Claim early, before other teams at the venue put it under load, and claim for every wallet you'll need — the relay's whole pool (FR-REL-8), not just one deployer key. `docs/monad_dev_resources.md` §3's own faucet section says the same: "Expect rate limits / 429 under load — claim early; keep backup wallets funded for agent bots."

---

## 2. First run, from a clean clone

1. **Clone and enter the repo.**
   ```
   git clone <repo-url> && cd monad-blitz-london_Plug-N-Pay
   ```
   Expected: `README.md`, `CLAUDE.md`, `docs/` present.

2. **Install MONSKILLS.**
   ```
   npx skills add therealharpaljadeja/monskills
   ```
   Expected: `.agents/skills/` populated, versions matching `skills-lock.json` at repo root. `.agents/`, `.claude/skills/`, `agent/skills/` are gitignored (`CLAUDE.md`) — a fresh clone never has them; this step is not optional on a new machine.
   If it fails: check `npx --version` works at all; this needs network access to fetch the skill package.

3. **Set up a deployer wallet, via keystore, not a raw key.**
   ```
   cast wallet import monad-deployer --interactive
   cast wallet address --account monad-deployer
   ```
   Expected: an address printed. Prefer this over a raw private key in an env var (`docs/monad_dev_resources.md` §5's own stated preference).

4. **Fund it.** Visit `https://faucet.monad.xyz`, request MON for the printed address.
   ```
   cast balance <address> --rpc-url https://testnet-rpc.monad.xyz
   ```
   Expected: nonzero after a short wait. If it reads zero immediately, that's expected — a funding transfer isn't spendable for ~3 blocks / ~1.2s (monad-facts.md Q4); in practice, wait a minute, not milliseconds, before trusting a zero balance as a real failure.

5. **Compile contracts**, from `contracts/` (`DESIGN.md` §0.1's fixed layout: one file, `contracts/PlugNPay.sol`, containing the `PlugNPaySettlement` contract per `API.md`).
   ```
   cd contracts && forge compile
   ```
   Expected: `Compiler run successful`.

6. **Install Node dependencies** for each service directory — `relay/`, `wall/`, `ops/`, `booth/` (`DESIGN.md` §0.1 — note `ops/` is its own directory, separate from `wall/`: the M9 operator surface is not part of the projector dashboard).
   ```
   npm install
   ```
   run in each. Expected: `node_modules/` populated, no unresolved peer-dependency errors.

7. **Sanity-check the RPC ceiling on your network.**
   ```
   node tools/measure-rpc.mjs
   ```
   Expected: a table shaped like `REQUIREMENTS.md` §13.4's recorded run — clean to roughly 40 req/s, first refusals mid-40s. If your numbers are dramatically lower, you may be behind a busier shared connection (monad-facts.md Q2 — the per-IP-vs-global scope is undocumented; a congested venue Wi-Fi NAT could mean you're sharing the ceiling with every other team). This is the read-path check only, already recorded — `tools/probe-write.mjs` (step 8 below) is the one that actually gates the build.

8. **Run build wave W0** — the write-path probe and wallet-pool funding, named and sequenced first in `DESIGN.md` §12 and `ARCHITECTURE.md` §12, before any contract exists.
   ```
   node tools/probe-write.mjs
   node tools/fund-pool.mjs
   ```
   Expected: `probe-write.mjs` reports a sustained write tx/s number (target: ≥10 tx/s, <1% 429s over 60s — `ARCHITECTURE.md` ADR-1) and answers whether `eth_sendRawTransactionSync` works on this endpoint (`DESIGN.md` §12 W0, `ARCHITECTURE.md` §14 open item 2 — unverified until this runs). `fund-pool.mjs` claims from the faucet and funds the **2–3 wallet** pool to ~30 MON combined, each wallet ending **above** the 10 MON reserve floor. Run the probe with real keys — `PRIVATE_KEY=k1,k2,k3 node tools/measure-write-rpc.mjs --send` — because the recorded 10 tx/s ceiling came from the shared public test key `0x…0001` and may be measuring that key's contention rather than a real limit.

**Observably working, at this point:** contracts compile, dependencies install, your wallet is funded, and wave W0 has told you the real write-path number the rest of the build depends on — all before a single contract is deployed. That's the honest "it built" checkpoint before §5's deploy, and it's also the point `ARCHITECTURE.md`/`DESIGN.md` both insist you not skip: every gas figure, wallet-pool size, and tx budget elsewhere in this repo is a placeholder until W0 (and W1's gas measurement, §5.1) replace the guesses.

---

## 3. Local development loop

Four surfaces, per `DESIGN.md` §0.1's fixed layout — note `ops/` (the M9 operator controls) is separate from `wall/` (the M7 projector dashboard), not the same app:

| Service | Directory | Start command | What to expect |
|---|---|---|---|
| Relay | `relay/` (entry: `index.mjs`, config: `config.mjs`) | `node index.mjs` or `npm run dev` [PENDING: confirm which once `package.json` exists] | Logs a listening port and mode `NORMAL` (`GET /v1/mode`). No sessions yet — waiting for `CFG.CONTRACT` and a spin-up call |
| Wall | `wall/` (`index.html`, `wall.mjs`) | Static — serve `wall/` with any dev server, or `npm run dev` | Opens idle (FR-DASH-10) — no live data until an operator start action fires (`DESIGN.md` §M7.4). Deliberate, not a bug |
| Ops | `ops/` (`index.html`, `ops.mjs`) | Static — serve `ops/` alongside `wall/` | The M9 operator surface: start/spin-up/surge/degrade controls and the two FR-OPS-7 injectors (`DESIGN.md` §M9.2–§M9.3) |
| Booth | `booth/` | `npm run dev` (Vite's own dev server, per booth spec §13's scaffold) | Boot → reveal → garage flow at `localhost:5173` (Vite default) or whatever port Vite prints |

Run relay first (wall, ops, and booth all expect it reachable, though booth degrades gracefully if it isn't — FR-BOOTH-4), then wall + ops, then booth. Use the ops surface's start control to bring the network from idle to live — it's the one place FR-OPS-1's "one deterministic action" actually lives, not a wall button.

---

## 4. Running the tests

Full case list and rationale: `TEST-PLAN.md`. Grouped fast → slow, and which need a funded wallet:

| Speed | Command | Needs a funded wallet? | Needs testnet reachability? |
|---|---|---|---|
| Fast, offline | `forge test --match-path 'contracts/test/*.t.sol' -vv` | No (local EVM) | No |
| Fast, offline | `npm run test:relay` (mocked chain client) | No | No |
| Fast, offline | `npm run test:booth` | No | No |
| Read-path RPC check | `node tools/measure-rpc.mjs` | No | Yes |
| Write-path load harness (build wave W0) | `node tools/probe-write.mjs` + `node tools/fund-pool.mjs` (`DESIGN.md` §0.1/§12; see `TEST-PLAN.md` §6) | **Yes — the 2–3 wallet relay pool, real keys not the shared test key** | Yes |
| End-to-end on testnet | Open a session, feed signed readings, watch it settle, check the receipt on the explorer | **Yes** | Yes |
| Manual / device | Booth 60fps check, QR-to-playable timing, 10m wall legibility (`TEST-PLAN.md` NFR rows) | No | Depends on step |

Run the offline suite on every change. Run the RPC/load/E2E checks before every deploy, not on every commit — they cost real MON and real RPC budget (monad-facts.md Q6: ~0.006–0.015 MON/tx).

---

## 5. Deploy to live

### 5.1 Contracts, to Monad testnet 10143

`DESIGN.md` §0.1 fixes both the source and the deploy script — use the repo's own script rather than a raw `forge create`, so verification metadata comes out consistent:

```
cd contracts
forge script script/Deploy.s.sol --account monad-deployer --broadcast --rpc-url https://testnet-rpc.monad.xyz
```

Source: `contracts/PlugNPay.sol`, containing the `PlugNPaySettlement` contract (single deployed contract covering identity registry + rate registry + session/settlement — `API.md` §intro's DECISION, confirmed by `DESIGN.md`'s M4+M3+M1-registry module split landing in one file). Copy the deployed address into `relay/config.mjs`'s `CFG.CONTRACT` (§5.4) immediately — nothing else works until every service points at the same address.

**Verify — prefer the verification API over `forge verify-contract` directly** (`.agents/skills/scaffold/SKILL.md:97`, quoted in monad-facts.md Q13: "ALWAYS use the verification API... Do NOT use `forge verify-contract` as your first choice"):

1. `forge verify-contract <ADDR> <CONTRACT> --chain 10143 --show-standard-json-input > /tmp/standard-input.json`, plus the compiled metadata from `out/<Contract>.sol/<Contract>.json`.
2. `POST https://agents.devnads.com/v1/verify` with `chainId: 10143`, `contractAddress`, `contractName` (`path/File.sol:ContractName`), `compilerVersion`, `standardJsonInput`, `foundryMetadata`.

Fallback only if the API fails: `forge verify-contract <ADDR> <CONTRACT> --chain 10143 --verifier sourcify --verifier-url "https://sourcify-api-monad.blockvision.org/"`.

Expected: a verified badge on `testnet.monadvision.com` or `testnet.monadscan.com` — satisfies NFR-M-2. No single explorer is canonical (monad-facts.md Q13); the verification API posts to all three at once, so pick either for the README link.

### 5.2 Relay — must be self-hosted, not a serverless function

This isn't a preference. The wall needs a long-lived SSE connection from the relay (FD-3), and the relay's wallet-pool submission loop is itself a long-running process. Vercel-style functions are exactly what already broke this once for the booth app: "A single SSE connection feeding the projector dies after five minutes on Hobby, mid-pitch" (`2026-08-08-booth-frontend-design.md:45`). **[ASSUMED, reversible]**: deploy the relay to a host that runs a persistent process — a small always-on VPS, or a platform like Fly.io/Railway/Render. Set env vars per §5.4 below.

### 5.3 Wall and booth

Booth's target is fixed by its own spec, not assumed: Vite + React + TypeScript, **deployed to Vercel** (`2026-08-08-booth-frontend-design.md` header table). Its `/api/*` endpoints are Vercel functions, which is fine — booth's own wall-facing transport is 1s polling, not SSE (booth spec §8), so the five-minute function cap never applies to it.

The wall's hosting is **[PENDING ARCH]**. If it's a static frontend whose browser opens a client-side `EventSource` directly at the self-hosted relay's public URL, Vercel works fine for the wall itself — the function-duration cap only bites a Vercel *function* holding the stream open, not a browser doing so directly. If instead the wall proxies SSE through its own serverless function, it inherits the exact failure constraint #1 already named. Whoever builds M7 needs to pick direct-connection, not proxy.

### 5.4 Configuration and secrets

Most configuration is **not** environment variables here — `DESIGN.md` §0.2 puts every non-secret constant in one committed file, `relay/config.mjs`'s `CFG` object (`CHAIN_ID: 10143`, `RPC_URLS: [...]`, `TX_BUDGET_PER_SEC: 10`, `POOL_SIZE: 3`, and everything else in §0.2's list). Edit that file directly for anything non-secret; there is no separate `.env` for it. There is no `BOOTH_ONCHAIN` key — see the secrets table below.

| Value | Lives in | Comes from | Secret? |
|---|---|---|---|
| `CFG.CONTRACT` | `relay/config.mjs` | Output of §5.1's deploy — the one field in the file that starts as a placeholder (`'0x…'`) | No, but wrong-address-here is the single most common "nothing works" bug — double check it after every redeploy |
| ~~`CFG.BOOTH_ONCHAIN`~~ | **removed** | **Deleted 2026-08-08 — `REQUIREMENTS.md` §16.** FR-SPLIT-1 (`M`, inspection) requires the booth app to make zero chain calls and hold no key material. A config key that can switch booth chain-writes on violates that by existing, so it is deleted rather than defaulted to `false`. Booth sessions never settle on-chain; the crowd's only chain interaction is the `settleRoomAggregate` bridge | — |
| `CFG.GAS_*` (five fields) | `relay/config.mjs` | `(guess)` values from `monad-facts.md` Q6 until build wave **W1** measures real gas usage and replaces them (`DESIGN.md` §12) | No |
| Relay wallet pool private keys (×2–3, `POOL_SIZE`) | **Not in `config.mjs`** — a separate untracked file or secrets manager | Generated + funded per §6's checklist — **2–3 wallets**, ~15 MON each, sized for margin rather than capacity since one wallet measured 10 tx/s clean | **Yes — never commit, never log, never paste into chat, never put in `config.mjs`** (NFR-S-4) |
| Ops-surface shared secret (`/v1/ops/*` header) | env var only | Generated once by whoever builds M9; exact header name is `API.md` §7 TBD #4 | **Yes** |
| Upstash Redis URL/token, if the booth leaderboard uses it (booth spec §8) | Vercel env var | Vercel Marketplace "Upstash for Redis" (Vercel KV is retired, booth spec constraint #5) | **Yes** |

No key above is ever a literal value in a committed file, `config.mjs` included. If you're unsure whether something is secret, treat it as secret.

---

## 6. Go-live checklist

- [ ] 🔴 **ROW 1 — run the multi-key write probe. Twenty minutes, and it decides three things at once.**
      ```
      PRIVATE_KEY=k1,k2,k3 node tools/measure-write-rpc.mjs --send
      ```
      **No trustworthy write-capacity number exists yet.** Every measurement so far ran from a home network on the **shared public key `0x…0001`**, whose nonce moved from 20 to 89 between runs — strangers are actively transacting from it, so contention was never ruled out. Both the 10 tx/s write ceiling and the 40–45 req/s read knee have been **retracted** (`REQUIREMENTS.md` §13.4). This command, run with **your own funded keys from the venue network close to the pitch**, is the only thing that would settle it. It is worth doing, but nothing below is blocked on it — the design has ample room against *at least 60 tx/s single-wallet*
- [ ] **One funded relay wallet is enough. Do not build a wallet pool today.** FR-REL-8's pool is **not supported by evidence** — a single wallet sustained 60 tx/s (`REQUIREMENTS.md` §13.4). The nonce-serialisation argument may hold at some higher rate, but nothing measured demonstrates it, and assembling a pool is time nobody has before the freeze. Fund **one wallet, or two for redundancy**, each **above** the 10 MON reserve floor (monad-facts.md Q3 — at or below it, that wallet caps at ~1 tx/1.2s and silently breaks settlement for itself). **~15–30 MON total.** Note the shape: the resident reserve floor dominates, while actual gas burn across the whole demo is only 11–27 MON — **gas was never the constraint.** Two earlier revisions of this row said 10 wallets / 150 MON and then 2–3 wallets; both were sized against ceilings that turned out not to exist
- [ ] **The relay retries transient failures.** This is the one durable finding from all the RPC measurement: ~1–3% of requests time out at *every* load tested, independent of rate. Retry was needed regardless of any capacity question
- [ ] **Run ten simulated sessions. AC-5 says at least ten and there is no reason to shave it.** An earlier revision of this checklist said nine, to buy margin against a 10 tx/s write ceiling. **That ceiling was retracted** (`REQUIREMENTS.md` §13.4, commit `d47a36c`): a re-test returned 25 tx/s clean, 40 tx/s with ten timeouts, then **60 tx/s clean from the same wallet**. A failure rate that does not rise with load is not a ceiling — it was transient noise read as rate limiting. **The zero-margin alarm was false.** Treat write capacity as *at least 60 tx/s single-wallet, ceiling unknown, with ~1–3% transient timeouts at any rate*
- [ ] Every relay wallet funded **at least 3 blocks (~1.2s, in practice minutes of margin) before first use** (monad-facts.md Q4)
- [ ] Pre-registered identity pool (FR-SIM-6) registered, sized to rehearsed-plus-stretch concurrency, done **before** freeze — not during spin-up
- [ ] **Build wave W0 run** (`node tools/probe-write.mjs && node tools/fund-pool.mjs`): write-path measured against the bar **10 tx/s sustained, 429s <1% over 60s**. Decide per-tick-vs-batching (ADR-1) as soon as the number lands, not on stage. There is no booth on-chain decision to make — §16 settled it; the booth never touches the chain
- [ ] **Build wave W1's gas measurement done**: the five `CFG.GAS_*` values in `relay/config.mjs` are real measurements, not the `(guess)` placeholders (`DESIGN.md` §12) — a stale guess doesn't break the demo, it just risks over- or under-paying on every single transaction all day
- [ ] Contracts deployed to `10143` and verified (§5.1); address wired into every service's `CONTRACT_ADDRESS`
- [ ] Relay deployed to a persistent host; SSE-to-wall confirmed working end-to-end, not just locally
- [ ] Wall and booth deployed; the booth's QR code points at the **deployed** booth URL, not `localhost`
- [ ] **Game server deployed** (module M10) and reachable from the booth app. The booth app talks only to this — it holds no wallet, makes no RPC call, and needs no chain configuration (FR-SPLIT-1)
- [ ] **Booth bundle inspected for chain code** — grep the built booth bundle for any wallet library, RPC URL, chain client or key material. Expected: zero hits (FR-SPLIT-1, verified by inspection)
- [ ] **Booth surfaces inspected for fake-verifiable artifacts** — no transaction hash, block number, address or explorer-styled link anywhere in the booth UI or its API responses (FR-SPLIT-2). Simulated MON and kWh figures are fine; a hash-shaped string is not. This is the check that protects the project's credibility in a room of sixty developers
- [ ] **Both labels live and permanent** — phone reads `SIMULATION — same engine, nothing on-chain`, wall reads `LIVE — Monad testnet` with the contract address (FR-SPLIT-5). The symmetry is what makes the honesty structural rather than a disclaimer
- [ ] **Rehearsal aggregate minted at T-10 minutes** — the `settleRoomAggregate` bridge is pre-signed with automatic retry (FR-SPLIT-7/8). If the live send stalls beyond five seconds during the pitch, show the rehearsal hash **and say plainly what it is**. Rehearse saying that sentence out loud; it is the one moment where an honest recovery beats a smooth failure
- [ ] Degraded mode rehearsed at least once live (FR-OPS-3 drill)
- [ ] Recorded fallback captured (FR-OPS-5) — a real screen recording of a real working run, dated before the 18:00 freeze
- [ ] Honesty-inspection checklist (`TEST-PLAN.md` §9) run once fully, and again in the final hour before submission
- [ ] Zero-phones full rehearsal (FR-OPS-4) completed successfully
- [ ] Submission drafted early on the Blitz portal (`docs/event_details/submission_process.md`) — editable until voting starts, so a draft costs nothing and a missed 18:30 cutoff costs everything

---

## 7. Operating it live

All operator actions below live on the `ops/` surface (`DESIGN.md` §M9.1-§M9.2), not the wall — the wall is for the audience, `ops/` is for you, on a second screen or the operator's own laptop.

- **Start:** FR-OPS-1's one deterministic action, `POST /v1/ops/network/start`. Same result every rehearsal, or it isn't rehearsed.
- **Trigger the room surge:** FR-OPS-2's control, `POST /v1/ops/surge { atEpochMs }` — a timestamp ~2s in the future (booth spec §14). Connected phones schedule locally against their own measured clock offset and fire within roughly ±50ms of each other. This is a **different** surge from booth's own in-game `POST /api/surge` — `API.md:352-356` is explicit that conflating the two is an easy mistake: this one ramps M6 simulated sessions *down* as phones connect, the booth one is an in-match multiplier.
- **Force degraded mode:** FR-OPS-3's control, `POST /v1/ops/degrade { force: true|false }` — for rehearsal, or for real if RPC actually degrades. Confirm `GET /v1/mode` changes when you press it.
- **The two FR-OPS-7 injectors** (`DESIGN.md` §M9.3): the deliberately-malformed-settlement control described in `TEST-PLAN.md` §8 — press either on request from a skeptical judge, not only on the rehearsed cue.
- **Read the mode indicator continuously during the pitch:** `GET /v1/mode`'s `mode` field and the wall's on-chain-vs-simulated labelling (FR-DASH-6) are the two things worth glancing at throughout — everything else on the wall is for the audience, this pair is for you.
- **The §16.4 bridge, and its stall procedure (FR-SPLIT-8) — rehearse this specifically.** At close, trigger `settleRoomAggregate` (pre-signed, auto-retrying). If it hasn't confirmed within **5 seconds**, switch to the rehearsal aggregate hash (minted T-10 minutes, §6 checklist) and **say plainly what it is**: "this is the rehearsal figure from ten minutes ago, the live one is still confirming." Per §16.5, volunteering a limitation before anyone asks reads as rigour.

---

## 8. Troubleshooting

| Symptom | Real cause | Fix |
|---|---|---|
| RPC returning 429 | Past the measured ~40–45 req/s knee (`REQUIREMENTS.md` §13.4), or sharing a venue IP with other teams (monad-facts.md Q2 — per-IP scope is undocumented) | Drop to degraded mode (FR-REL-4 / FR-OPS-3); consider spreading submissions across the other two public endpoints (Ankr ~30 rps avg, Monad Foundation 20 rps — monad-facts.md "Hard constraints" #11) |
| One wallet stuck, not submitting | Balance dropped under the 10 MON reserve floor, now capped at ~1 tx per 1.2s (monad-facts.md Q3) | Top it up from the faucet or a funded sibling wallet, back above 10 MON, and wait ~3 blocks before resuming submissions from it |
| Nonce errors / stalled transactions | No global mempool on Monad (monad-facts.md Q5) — a gapped or out-of-order send from one wallet blocks that wallet's own queue | Track nonces locally in the relay's application state; never re-query `eth_getTransactionCount` as a "ready" signal mid-run; never let two in-flight sends race from the same wallet |
| Wall looks live but nothing is moving | SSE connection dropped and isn't auto-reconnecting | This is exactly what FR-DASH-8 exists to prevent — check the wall's reconnect logic; in the meantime, force degraded-mode labelling (NFR-R-3) rather than leave it silently stale |
| Booth app can't reach the game server | Stale game-server URL baked into the booth build after a redeploy | Booth has nothing to fall back to on the chain — there is no chain path (§16.1). Fix the URL and redeploy; a player mid-round should keep playing from local state, not see an error |
| `settleRoomAggregate` stalls past 5 seconds during the pitch | Ordinary RPC variance, at the worst possible moment | Rehearsed, not a surprise — follow §7's stall procedure: rehearsal hash, say plainly what it is, keep going |
| Transaction landed but no value moved | **Inclusion is not success on Monad** — a tx can be included, pay gas, and still revert (`docs/monad_dev_resources.md:237`) | Always read the receipt's status field. Never infer success from a returned tx hash alone |
| Faucet gives nothing, or 429s | Amount and rate limit are unverified and unpublished (booth spec constraint #10) | Claim earlier next time; keep a backup wallet funded from earlier in the day rather than funding under time pressure |
| Booth score/leaderboard looks wrong for one player | **Should not happen — a real bug, not an expected gap.** FR-SPLIT-3 makes server-side scoring a firm `M` requirement now, replacing the booth spec's older "P1, nice to have" framing | Check the game server's own tap-event computation, not the client. A client-submitted score reaching the leaderboard is exactly what FR-SPLIT-3 exists to prevent |

---

## 9. Rollback and the fallback

If the live deploy misbehaves during the pitch window: **cut to the recorded fallback (FR-OPS-5) rather than debug live.** `CON-3`'s three minutes has no slack for on-stage debugging. Decide the cut-line in rehearsal, not on stage — e.g. "if the wall isn't live by the end of beat 1 (`TEST-PLAN.md` §7), the operator says so and starts the recording." One artefact (the recording) satisfies FR-OPS-5, NFR-R-4, and AC-10 at once — make it once, properly, well before 18:00.

There is no production traffic to protect, so "rollback" here means redeploy: push the last known-good relay/wall/booth build, re-point env vars at it, and re-run only the deployed-and-verified rows of §6's checklist — not the whole thing. **Avoid redeploying the contract itself after freeze unless the alternative is worse:** a new deployment means a new address, which means updating `CONTRACT_ADDRESS` in every other service and losing whatever state (open sessions, settlement history) the old address had.
