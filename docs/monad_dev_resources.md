# Monad Blitz London — Dev Resources Cheat Sheet

One-stop reference for building at **Monad Blitz London** (8 Aug 2026).  
Sources: [Blitz London Notion](https://monad-foundation.notion.site/Monad-Blitz-London-cde6367594f282c4b69a0183ad05b9d9), [Blitz Resources Notion](https://monad-foundation.notion.site/Blitz-resources-3036367594f2802a92c6f2d063f832ef), official docs at [`docs.monad.xyz`](https://docs.monad.xyz/), and this repo’s `docs/event_details/`.

Last refreshed: 2026-08-07.

---

## 1. Event quick facts

| Item | Detail |
|---|---|
| Event | Monad Blitz London |
| Date | **Saturday 8 August 2026** |
| Time | 9:00 AM – 9:00 PM |
| Venue (reported) | Encode Hub, 41 Pitfield St, London N1 6DA |
| Format | 1-day sprint; innovate freely; no tracks |
| Official page | https://monad-foundation.notion.site/Monad-Blitz-London-cde6367594f282c4b69a0183ad05b9d9 |
| Blitz resources | https://monad-foundation.notion.site/Blitz-resources-3036367594f2802a92c6f2d063f832ef |
| Submission / voting portal | Blitz / Devnads portal (open from event page — see `docs/event_details/submission_process.md`) |
| Team size | **Max 4** |
| Must deploy on | **Monad Testnet** |
| Must be public | Public GitHub repo |

### Schedule

| Time | Activity |
|---|---|
| 9:00 – 10:00 | Registration & breakfast |
| 10:00 – 10:15 | Opening & briefing |
| 10:15 – 11:30 | Monad101 & Monskills workshop |
| 11:30 – 18:00 | Hacking |
| 18:00 | Code freeze |
| 18:30 | Submission deadline |
| 18:30 – 20:30 | Pitches (3 min each) |
| 20:30 – 21:00 | Prizes |

### Prizes

| Place | Amount |
|---|---|
| 1st | $1,200 USD |
| 2nd | $800 USD |
| 3rd & 4th | $500 USD each |

### Rules (critical)

- **Fresh ideas only** — no pre-built projects / continuing old personal apps. Planning & research before the day is encouraged; coding starts at the Blitz.
- **Innovate, don’t clone** — clones without a Monad-specific twist are discouraged.
- **Public + testnet** — public GitHub + live Monad Testnet deployment required.
- Details: [`docs/event_details/rules.md`](event_details/rules.md)

### Judging = community vote (on-screen demos)

- Peers vote on a platform during presentations + **15 minutes after the last demo**.
- Teams **cannot vote for themselves**.
- Criteria to optimize for:
  1. **Novelty & originality**
  2. **Innovative mechanics** (esp. leveraging Monad)
  3. **Problem-solving** for interesting consumer challenges
  4. **Learning & experimentation** (polish is secondary)
  5. Spirit: what **excited** voters most
- Full text: [`docs/event_details/judging_criteria.md`](event_details/judging_criteria.md)

### Demo tips (3 minutes)

- Live testnet demo is the core — get to it fast.
- Slides optional; peers are fellow developers.
- Backup: screenshots + short recorded video if RPC dies.
- Details: [`docs/event_details/project_demo.md`](event_details/project_demo.md)

### Submission checklist

1. Fork the Blitz starter / `monad-blitz-london` style repo (or use this team repo).
2. Put code + README in your **public** fork.
3. Deploy contracts to **Monad Testnet**; verify if time allows.
4. Submit on the Blitz portal: GitHub URL (+ Demo URL, or GitHub again if no separate demo host).
5. You can edit submission until voting starts.
- Details: [`docs/event_details/submission_process.md`](event_details/submission_process.md)

### What to bring

Laptop + charger, mouse/headphones, IDE + Foundry/Node/Git, adapters, water bottle, idea notes.  
Venue: Wi-Fi, power, food, mentors.  
Details: [`docs/event_details/what_to_bring.md`](event_details/what_to_bring.md)

---

## 2. Monad performance pitch numbers (official docs)

From [`docs.monad.xyz`](https://docs.monad.xyz/):

- **~10,000 TPS** design throughput
- **300ms** block frequency
- **600ms** finality
- Full **EVM bytecode** + Ethereum-compatible **JSON-RPC**
- Parallel execution, async execution, MonadBFT, MonadDb

Use these in the pitch; show them visually (e.g. live TPS / City GDP) rather than only citing slides.

---

## 3. Monad Testnet — primary network for Blitz

Official: https://docs.monad.xyz/developer-essentials/testnets

> Testnet was **reset from genesis on 2025-12-16**. Don’t rely on very old testnet state or addresses from before that.

| Item | Value |
|---|---|
| Network name | `Monad Testnet` |
| Chain ID | `10143` (`0x279F`) |
| Currency | `MON` (18 decimals) |
| Public RPC | `https://testnet-rpc.monad.xyz` |
| Public WS | `wss://testnet-rpc.monad.xyz` |
| Explorer (MonadVision) | https://testnet.monadvision.com |
| Explorer (Monadscan) | https://testnet.monadscan.com |
| Network viz | https://www.gmonads.com/?network=testnet |
| App hub | https://testnet.monad.xyz/ |
| Faucet | https://faucet.monad.xyz |
| Add to wallet guide | https://docs.monad.xyz/guides/add-monad-to-wallet/testnet |
| Current version (docs) | `v0.15.2` / `MONAD_NINE` |

### Wallet add (manual)

```
Network Name: Monad Testnet
RPC URL:      https://testnet-rpc.monad.xyz
Chain ID:     10143
Currency:     MON
Explorer:     https://testnet.monadvision.com
```

Faucet “add network” page also lists explorer `https://testnet.monadexplorer.com/` — prefer **MonadVision** from official docs when linking in README/demo.

### Testnet public RPCs + limits (official)

| RPC | Provider | Limits | Notes |
|---|---|---|---|
| `https://testnet-rpc.monad.xyz` / `wss://…` | QuickNode | **50 rps** (25 rps for `eth_call` / `eth_estimateGas`); batch 100 | Archive ✅ |
| `https://rpc.ankr.com/monad_testnet` | Ankr | 300 / 10s ; 12k / 10 min; batch 100 | No archive; no `debug_*` |
| `https://rpc-testnet.monadinfra.com` / `wss://…` | Monad Foundation | **20 rps**; batch not allowed | Archive ✅ |

More detail: https://docs.monad.xyz/reference/rpc-limits

**Blitz note:** No hackathon-specific premium RPC was found on Blitz resources. Assume public endpoints. Pre-register Alchemy / QuickNode / Ankr free tiers as backup before the event. Cap concurrent agent spam if you hit 429s.

### Faucet

- Primary: https://faucet.monad.xyz
- Hub: https://testnet.monad.xyz/
- Expect rate limits / 429 under load — claim early; keep backup wallets funded for agent bots.

### Testnet canonical contracts (selected)

| Name | Address |
|---|---|
| Wrapped MON | `0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| Permit2 | `0x000000000022d473030f116ddee9f6b43ac78ba3` |
| CreateX | `0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed` |
| Foundry Deterministic Deployer | `0x4e59b44847b379578588920ca78fbf26c0b4956c` |
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| EntryPoint v0.8 | `0x4337084d9e255fF0702461CF8895cE9E3b5Ff108` |
| x402 ExactPermit2Proxy | `0x402085c248EeA27D92E8b30b2C58ed07f9E20001` |
| x402 UptoPermit2Proxy | `0x4020A4f3b7b90ccA423B9fabCc0CE57C6C240002` |

Full list + Safe contracts: https://docs.monad.xyz/developer-essentials/testnets  
Testnet tokens: https://github.com/monad-crypto/token-list/blob/main/tokenlist-testnet.json

---

## 4. Monad Mainnet (reference — not required for Blitz)

Official: https://docs.monad.xyz/developer-essentials/network-information

| Item | Value |
|---|---|
| Network name | `Monad Mainnet` |
| Chain ID | `143` (`0x8F`) |
| Currency | `MON` |
| Public RPC examples | `https://rpc.monad.xyz`, `https://rpc1.monad.xyz`, `https://rpc2.monad.xyz`, `https://rpc3.monad.xyz`, `https://rpc-mainnet.monadinfra.com` |
| Explorer | https://monadvision.com · https://monadscan.com |
| App hub | https://app.monad.xyz |
| Network viz | https://gmonads.com |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` (same as testnet) |

Mainnet launched **24 Nov 2025** (docs). Blitz submissions must be on **testnet**.

---

## 5. Deploy fast (Monad Foundry — recommended)

Docs: https://docs.monad.xyz/guides/deploy-smart-contract/foundry

```bash
# Install Monad Foundry (WSL required on Windows)
curl -L https://foundry.category.xyz | bash
foundryup --network monad

# Scaffold (official template)
forge init --template monad-developers/foundry-monad [project_name]

# foundry.toml essentials
# eth-rpc-url = "https://testnet-rpc.monad.xyz"
# chain_id = 10143

forge compile

# Fund wallet via https://testnet.monad.xyz/ or https://faucet.monad.xyz

# Prefer keystore over raw private key
cast wallet import monad-deployer --interactive
cast wallet address --account monad-deployer
forge create src/Counter.sol:Counter --account monad-deployer --broadcast
```

Also supported: [Hardhat](https://docs.monad.xyz/guides/deploy-smart-contract/hardhat), [Remix](https://docs.monad.xyz/guides/deploy-smart-contract/remix).  
Verify: [Foundry verify](https://docs.monad.xyz/guides/verify-smart-contract/foundry) · [Hardhat verify](https://docs.monad.xyz/guides/verify-smart-contract/hardhat).

**Local:** [Monad Solonet](https://docs.monad.xyz/tooling-and-infra/toolkits/monad-solonet) — full local Monad in Docker for debugging before burning faucet/RPC.

**Frontend templates:** Scaffold-ETH, Reown AppKit, Next/Privy templates — see https://docs.monad.xyz/guides/ and https://docs.monad.xyz/templates/

---

## 6. Monad vs Ethereum — gotchas that break demos

Official: https://docs.monad.xyz/developer-essentials/differences

Use **Monad Foundry** so local behavior matches chain.

| Topic | What it means for Blitz |
|---|---|
| **Gas charged on `gas_limit`, not usage** | Over-estimating gas on every agent tx burns MON. Set tight limits once measured. |
| **Reserve balance** | Tx can be included, pay gas, still **revert**. Always check receipts — don’t assume inclusion = success. |
| **No global mempool** | Tx forwarded to upcoming leaders only; odd timing under load is possible. |
| **No EIP-4844 blob txs** | Don’t use type-3 blob transactions. |
| **Historical state limited** | Don’t build dashboards on deep historic `eth_call` / old logs via full nodes — use events + indexer. |
| **Max contract size 128 KB** | More headroom than ETH 24 KB. |
| **Memory pricing linear, max 8 MB/tx** | Fine for most hackathon contracts. |
| **secp256r1 / P256 precompile** | Passkeys/WebAuthn possible; optional stretch. |
| **EIP-7702** | Delegated EOAs can’t dip below **10 MON**; `CREATE`/`CREATE2` banned when called as contract. |

Gas pricing deeper dive: https://docs.monad.xyz/developer-essentials/gas-pricing

---

## 7. High-performance app practices (for agent / city demos)

Official: https://docs.monad.xyz/developer-essentials/best-practices

Especially relevant to SimCityL1-style spam:

1. **Hardcode gas** when usage is static — skip `eth_estimateGas` per tick.
2. **Batch / parallelize reads** — `Promise.all` RPC batches; Multicall3 at `0xcA11…CA11` (serial inside contract — don’t stuff huge expensive batches).
3. **Use an indexer** for event-heavy UIs instead of polling `eth_getLogs` forever — see https://docs.monad.xyz/guides/indexers/ (Envio, QuickNode Streams, GhostGraph, etc.).
4. Prefer websockets where available for live feeds.

---

## 7b. MONSKILLS (team agents)

Install once per machine from repo root:

```bash
npx skills add therealharpaljadeja/monskills
```

Then tell your agent to use local MONSKILLS and start with the `monskill` routing skill.

| Resource | URL |
|---|---|
| Full team guide | [`docs/MONSKILLS.md`](MONSKILLS.md) |
| Install instructions | https://skills.devnads.com/install.md |
| Prompt library | https://skills.devnads.com/prompts |
| Skill package | https://github.com/therealharpaljadeja/monskills |

`skills-lock.json` at the repo root pins skill versions — commit it; do not commit `.agents/` / `.claude/` / `agent/` skill copies (see `.gitignore`).

## 8. Tooling & infra index

| Topic | URL |
|---|---|
| Docs home | https://docs.monad.xyz/ |
| Docs LLM index | https://docs.monad.xyz/llms.txt |
| Developer portal | https://developers.monad.xyz/ |
| Network info (mainnet) | https://docs.monad.xyz/developer-essentials/network-information |
| Network info (testnet) | https://docs.monad.xyz/developer-essentials/testnets |
| Deployment summary | https://docs.monad.xyz/developer-essentials/summary |
| RPC providers | https://docs.monad.xyz/tooling-and-infra/rpc-providers |
| Toolkits | https://docs.monad.xyz/tooling-and-infra/toolkits |
| Indexers | https://docs.monad.xyz/guides/indexers/ |
| Block explorers | https://docs.monad.xyz/tooling-and-infra/block-explorers |
| Architecture | https://docs.monad.xyz/monad-arch/ |
| JSON-RPC reference | https://docs.monad.xyz/reference/json-rpc/overview |
| Tokens & bridges | https://docs.monad.xyz/developer-essentials/network-information/tokens-and-bridges |
| Protocols / addresses | https://github.com/monad-crypto/protocols |
| Token lists | https://github.com/monad-crypto/token-list |
| Foundry-Monad template | https://github.com/monad-developers/foundry-monad |
| monad-developers org | https://github.com/monad-developers |

### Guides often linked from Blitz resources

| Guide | URL |
|---|---|
| x402 on Monad | https://docs.monad.xyz/guides/x402 |
| ERC-8004 (trustless agents) | https://docs.monad.xyz/guides/erc-8004 |
| Kuru Flow (swaps) | https://docs.monad.xyz/guides/kuru-flow |
| Scaffold-ETH | https://docs.monad.xyz/guides/scaffold-eth |
| Reown AppKit wallet connect | https://docs.monad.xyz/guides/reown |
| MCP server for Monad Testnet | https://docs.monad.xyz/guides/monad-mcp |

---

## 9. Official community / support

From https://docs.monad.xyz/official-links

| Channel | Link |
|---|---|
| Developer Discord | https://discord.gg/monaddev |
| Community Discord | https://discord.gg/monad |
| Dev announcements Telegram | https://t.me/monad_devs |
| Announcement Telegram | https://t.me/monad_xyz |
| Research forum | https://forum.monad.xyz |
| DevNads on X | https://x.com/monad_dev |
| Monad on X | https://x.com/monad |
| Website | https://monad.xyz |
| Blog | https://blog.monad.xyz |
| DeltaV founders | https://deltav.monad.xyz/ |

Ask at venue check-in for any **Blitz-specific** mentor Discord / staff channel (not always listed on Notion).

---

## 10. Ideas in this repo

| Folder | Idea |
|---|---|
| [`docs/idea/`](idea/) | Plug-N-Pay — per-second EV / V2G streaming payments |
| [`docs/idea_simCity/`](idea_simCity/) | SimCityL1 — civic agent city; GDP = TPS |
| [`docs/idea_athena/`](idea_athena/) | Athena-lite — forum claims → replication bounties |
| [`docs/idea_reverseTurk/`](idea_reverseTurk/) | Reverse Turk — AI agent hires the room, pays MON to phones |

---

## 11. Day-of checklist (print / pin)

- [ ] `npx skills add therealharpaljadeja/monskills` run (see [`MONSKILLS.md`](MONSKILLS.md))
- [ ] Wallet on Monad Testnet (`10143`)
- [ ] Faucet MON claimed (deployer + agent wallets)
- [ ] Backup RPC key ready (Ankr / Alchemy / QuickNode)
- [ ] Monad Foundry installed (`foundryup --network monad`)
- [ ] Contracts deploy + verified (or at least explorer link)
- [ ] Frontend live demo URL (Vercel/etc.) or local + ngrok
- [ ] Public GitHub README with one-liner + how Monad is required
- [ ] 3-minute demo rehearsed: open alive → one wow beat → Monad line
- [ ] Screenshots + 30s backup video
- [ ] Portal submission before **18:30**

---

## 12. Still ask staff if unclear

1. Any Blitz-only RPC / faucet allowance
2. Exact Devnads / voting portal URL once unlocked
3. Mentor Discord for the London room
4. Whether contract verification is expected vs optional for votes

---

## Link dump (Blitz Notion → docs)

| Topic | URL |
|---|---|
| Blitz London hub | https://monad-foundation.notion.site/Monad-Blitz-London-cde6367594f282c4b69a0183ad05b9d9 |
| Blitz resources | https://monad-foundation.notion.site/Blitz-resources-3036367594f2802a92c6f2d063f832ef |
| Network information | https://docs.monad.xyz/developer-essentials/network-information |
| Testnets | https://docs.monad.xyz/developer-essentials/testnets |
| Add Monad to wallet | https://docs.monad.xyz/guides/add-monad-to-wallet/ |
| Deploy (Foundry / Hardhat / Remix) | https://docs.monad.xyz/guides/deploy-smart-contract/ |
| Verify | https://docs.monad.xyz/guides/verify-smart-contract/ |
| Differences vs Ethereum | https://docs.monad.xyz/developer-essentials/differences |
| Best practices | https://docs.monad.xyz/developer-essentials/best-practices |
| RPC providers | https://docs.monad.xyz/tooling-and-infra/rpc-providers |
| Toolkits | https://docs.monad.xyz/tooling-and-infra/toolkits |
| Indexers | https://docs.monad.xyz/guides/indexers/ |
| Architecture | https://docs.monad.xyz/monad-arch/ |
| Official links | https://docs.monad.xyz/official-links |
