# Plug-N-Pay — project rules for agents

Per-second machine-to-machine settlement for EV charging, on Monad testnet.
Built at Monad Blitz London, 8 August 2026. Code freeze 18:00, submission 18:30.

## MONSKILLS — use them, don't guess about Monad

Official Monad agent skills are installed in this repo at `.agents/skills/`
(symlinked for Claude Code). `skills-lock.json` at the root pins their versions.

**Always start with the `monskill` routing skill, then load only the topic skills it
names for your task.** Prefer these local skills over fetching
`skills.devnads.com` or `docs.monad.xyz` during a build.

| Skill | Load it when |
|---|---|
| `monskill` | First, every time. It routes to the rest |
| `concepts` | Async execution, reserve balance, block states, nonces, real-time event feeds, EIP-7702 |
| `gas` | Setting a gas limit, estimating cost, showing a fee in the UI |
| `addresses` | You need a canonical contract address on Monad |
| `tooling-and-infra` | Checking whether a provider (RPC, explorer, indexer, oracle) supports Monad |
| `indexer` | Any historical or activity feed that a single `eth_call` cannot serve |
| `scaffold` | Starting a new app from zero |
| `wallet-integration` | Adding wallet or auth to a frontend (Para) |
| `why-monad` | Pitch and positioning claims about the chain |

Reinstall (per machine, from the repo root): `npx skills add therealharpaljadeja/monskills`

Commit `skills-lock.json`. Never commit `.agents/`, `.claude/skills/`, or `agent/skills/`.

## Hard rules

- **Never invent a Monad contract address.** Use the `addresses` skill and verify the
  address has code on-chain before using it. A wrong address loses funds.
- **Monad charges gas on `gas_limit`, not gas used** (`.agents/skills/gas/SKILL.md`).
  Every transaction this system sends pays for the limit it declared. Measure each
  hot-path function's real cost once, then hardcode a tight limit. Do not call
  `eth_estimateGas` on a per-tick path.
- **Read the `concepts` skill before writing anything that submits transactions
  concurrently.** Reserve balance and async execution both change how many
  transactions per second a wallet can actually issue, and neither behaves like
  Ethereum.
- **Chain is Monad testnet, chain ID `10143` (`0x279f`).** Mainnet is `143` — a
  different chain. Network details live in `docs/monad_dev_resources.md`; treat that
  file as the reference and update it rather than restating figures inline.
- **Verify deployed contract source against the deployed address** (NFR-M-2).

## Document hierarchy

`docs/specs/REQUIREMENTS.md` is the baseline. Everything else in `docs/specs/` is
subordinate to it — if a subordinate document disagrees, the requirements win and the
subordinate document gets a superseded-note, not a silent edit.

| Path | What |
|---|---|
| `docs/specs/REQUIREMENTS.md` | **The** requirements. Stable IDs — never renumber |
| `docs/specs/ARCHITECTURE.md` | Topology, trust boundaries, RPC and gas budgets, failure modes |
| `docs/specs/DESIGN.md` | Module-by-module design, algorithms, state machines |
| `docs/specs/API.md` | Contract ABI, events, errors; relay and booth wire formats |
| `docs/specs/TEST-PLAN.md` | Verification matrix, one entry per requirement ID |
| `docs/specs/2026-08-08-booth-frontend-design.md` | Module M8 detailed design |
| `docs/idea/` | Product intent, the user story, open questions |
| `docs/monad_dev_resources.md` | Testnet RPC, faucet, Foundry, explorer, event cheat sheet |
| `docs/event_details/`, `PORTABLE/` | Event rules, judging criteria, submission process |

Requirement identifiers (`FR-*`, `NFR-*`, `IF-*`, `DR-*`, `AC-*`, `UC-*`) are stable.
Cite them by ID in code comments, commit messages, and tests.

## Honesty constraints — these are requirements, not style

The project's credibility with a room of developer-judges rests on these. They are
`MUST` requirements and a violation is a defect, not a rough edge.

- Simulated metering is **labelled as simulated** wherever a viewer could mistake it
  for hardware (FR-MET-5).
- The dashboard states whether a figure is on-chain or simulated, and never presents
  one as the other (FR-DASH-6).
- Degraded operation is **labelled, never disguised** (NFR-R-3). No frozen dashboard
  presented as a live one.
- The handshake is described as **modelled on** ISO 15118 Plug & Charge, never as a
  conformant implementation (FR-ID-2).
- Signature verification happens off-chain in the relay, which is a named trust
  boundary. Say "verifies", never "trustlessly verifies on-chain" (ASM-6, NFR-M-4).
- No private key is committed to this repository (NFR-S-4).

## Working style here

- The clock is the binding constraint. `REQUIREMENTS.md` §11 holds the build order and
  the honest cut of what ships; follow it rather than re-deriving priorities.
- Prove it ran. A settlement claim needs a transaction hash; a throughput claim needs a
  measured number, not a hoped-for one.
- When a measurement contradicts a document, the measurement wins and the document gets
  updated in the same change.
