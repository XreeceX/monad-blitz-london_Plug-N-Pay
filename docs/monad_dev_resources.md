# Monad Dev Resources — extracted from Blitz Resources page

Source: [Monad Blitz Resources (Notion)](https://monad-foundation.notion.site/Blitz-resources-3036367594f2802a92c6f2d063f832ef)

Compiled by fanning out from the Blitz resources page into Monad's official docs (`docs.monad.xyz`) and cross-checking with web search where the docs page itself couldn't be fetched directly. Every item below is marked **confirmed** (verified on an official page) or **reported** (consistent third-party sources, not independently verified on a Monad Foundation-controlled page) — treat "reported" items as needing a live sanity-check at the event, not as hard fact.

---

## ⚠️ Most important finding: no hackathon-specific RPC found

**No dedicated/premium RPC offer, partnership, or allowance for Monad Blitz specifically was found anywhere** — not on the Blitz resources page, not in linked docs, not via web search. This directly bears on [open_questions.md](idea/open_questions.md) Question 1 (RPC access) and Question 2 (per-tick vs. batched settlement) — it does **not** resolve those questions, but it removes "maybe there's an event RPC we don't know about yet" as a reason to delay deciding. Plan should assume **public RPC only, unless confirmed otherwise by Monad staff at the venue.**

Also **no Discord/Telegram/mentor-support channel link** was found on the resources page or anywhere linked from it — worth asking about at check-in, since it's a real gap in what's documented.

---

## Network basics

| Item | Value | Status |
|---|---|---|
| Testnet chain ID | `10143` | confirmed |
| Testnet RPC URL | `https://testnet-rpc.monad.xyz` | reported (couldn't load the official docs Testnet tab directly to re-confirm the exact string) |
| Testnet faucet hub | `https://testnet.monad.xyz/` | confirmed to exist |
| Testnet faucet (direct) | `https://faucet.monad.xyz` | confirmed to exist, was returning HTTP 429 during research (i.e. real and actively rate-limited) |
| Faucet claim amount | ~10 MON (wallet holds ≥0.001 ETH on mainnet) or 0.5 MON (new/unverified wallet); 1 claim per address / 24h | reported, not on an official page |
| Block explorer | `https://testnet.monadexplorer.com` | reported |
| Docs home | `https://docs.monad.xyz/` | confirmed |
| Developer portal | `https://developers.monad.xyz/` | confirmed |

**Backup faucets** if the official one is congested during the event: Alchemy, QuickNode, Chainstack, Morkie, Faucet.Trade faucets — smaller drips (0.05–1 MON / 12–24h) but useful as a fallback.

## RPC providers (from `docs.monad.xyz/tooling-and-infra/rpc-providers`)

Both mainnet and testnet supported by: Alchemy, Ankr, Blockdaemon, BlockPI, Chainstack, dRPC, NodeCloud, Dwellir, Envio (free read-only), GetBlock, OnFinality, QuickNode, Spectrum, Tatum, thirdweb (RPC Edge), Validation Cloud (50M free compute units, no credit card).

No testnet-specific rate limits are published. (Mainnet limits are published, e.g. QuickNode 25 rps, Alchemy 15 rps — listed here only as a rough proxy for what "generous" vs "tight" free tiers look like, not as testnet truth.)

**Recommendation:** default to `https://testnet-rpc.monad.xyz`; register a free-tier key with Alchemy or QuickNode as a fallback *before* the event so it's ready if the public endpoint gets congested during a 10–50-concurrent-session demo.

## Monad vs. Ethereum — confirmed gotchas (`docs.monad.xyz/developer-essentials/differences`)

Relevant to contract and simulator design for this project:

- **Gas is charged on declared gas *limit*, not actual usage** — a DoS-mitigation quirk. Setting an overly generous gas limit on the per-tick `ingestTick` calls costs real MON even if unused. Tune gas limits tightly once the contract is stable, especially since we're sending many small transactions per second.
- **`eth_maxPriorityFeePerGas` is hardcoded to 2 gwei; `eth_feeHistory` returns hardcoded/default values on testnet.** Do not build dynamic fee-estimation logic into the simulator — it won't reflect real network conditions on testnet anyway. Just use a fixed/simple fee strategy.
- **No global mempool** — transactions are forwarded locally to upcoming leaders only. Worth knowing if the simulator sees odd propagation behavior under load.
- **"Reserve balance" mechanism** — a transaction can be included and pay gas, then still revert. Don't assume inclusion = success; check receipts.
- Max contract code size 128 KB (vs 24 KB on Ethereum) — irrelevant at our scale, just headroom.
- Memory pricing is linear (not quadratic), capped at 8 MB/tx — favorable for any per-tick contract logic.
- secp256r1 precompile supported (on-chain WebAuthn/passkey verification) — not needed for the hackathon scope, but relevant if a future version wants passkey-based car/station identity instead of raw private keys.
- Full nodes don't retain arbitrary historic state — if the dashboard ever needs to query historical session data rather than live events, plan for an indexer (see below), not raw `eth_getLogs` over old ranges.

(Commonly-cited "~1s block time / ~10,000 TPS" figures are third-party, not verified directly against an official Monad page in this pass — usable in the pitch as "commonly cited," not as a sourced official claim.)

## Toolkits (`docs.monad.xyz/tooling-and-infra/toolkits`)

- **Monad Foundry** — Monad's own fork of Foundry (`forge`/`cast`/`anvil`/`chisel`) with native Monad EVM + staking-precompile support and human-readable trace decoding. **This is Monad's recommended path for Solidity dev** — use this over vanilla Foundry.
- **Hardhat** — also supported, JS-based.
- **Monad Solonet** — run a local Monad network for dev/testing before touching testnet at all; worth using early to avoid burning faucet MON and RPC calls on debugging.

viem/ethers/wagmi/thirdweb SDK are **not named** on the toolkits page, but Monad is EVM-equivalent so they should work over standard RPC — no Monad-specific guidance was found for them.

## Deployment (Foundry path, from `docs.monad.xyz/guides/deploy-smart-contract/foundry`)

```bash
# 1. Get testnet funds first: https://testnet.monad.xyz/

# 2. Recommended: keystore, not raw private key
cast wallet import monad-deployer --interactive
forge create --rpc-url <testnet-rpc-url> --account monad-deployer --sender <address>

# Discouraged (docs explicitly call this less safe) but faster to script:
forge create --rpc-url <testnet-rpc-url> --private-key <key>
```

Docs' own words: *"Using a keystore is much safer than using a private key because keystore encrypts the private key."* Verification is documented separately for [Foundry](https://docs.monad.xyz/guides/verify-smart-contract/foundry) and [Hardhat](https://docs.monad.xyz/guides/verify-smart-contract/hardhat) — exact commands weren't extractable in this pass, open those pages directly when it's time to deploy.

## No starter kits / boilerplates found

The Blitz resources page has no scaffolding repo, template, or boilerplate links. The only GitHub link surfaced anywhere in this research was `github.com/monad-crypto/protocols` — a list of canonical deployed contract addresses, not a starter kit. **Plan to scaffold from scratch** (or from Monad Foundry's own project init, if it has one — check `forge init` behavior under the Monad Foundry fork).

## Other docs worth knowing about (not core to this project, but linked from the same resources page)

- [Using Indexers](https://docs.monad.xyz/guides/indexers/) — relevant if the dashboard ever needs to query historical settlement events beyond what's cheap to pull live (ties to the "no historic state on full nodes" gotcha above).
- [x402 on Monad](https://docs.monad.xyz/guides/x402-guide), [ERC-8004 on Monad](https://docs.monad.xyz/guides/erc-8004-guide) — payments/agent-identity related guides, worth a skim in case either is directly reusable for the car/station identity or metering-attestation piece.
- [Kuru Flow](https://docs.monad.xyz/guides/kuru-flow) (swaps), [Blinks](https://docs.monad.xyz/guides/blinks-guide) — not relevant to this project's scope.

## Full link index (all confirmed, linked directly from the Blitz resources page)

| Topic | URL |
|---|---|
| Network information | https://docs.monad.xyz/developer-essentials/network-information |
| Add Monad to Wallet | https://docs.monad.xyz/guides/add-monad-to-wallet/ |
| Deploy a smart contract (index) | https://docs.monad.xyz/guides/deploy-smart-contract/ |
| — via Foundry | https://docs.monad.xyz/guides/deploy-smart-contract/foundry |
| — via Hardhat | https://docs.monad.xyz/guides/deploy-smart-contract/hardhat |
| — via Remix | https://docs.monad.xyz/guides/deploy-smart-contract/remix |
| Verify a smart contract (index) | https://docs.monad.xyz/guides/verify-smart-contract/ |
| — via Foundry | https://docs.monad.xyz/guides/verify-smart-contract/foundry |
| — via Hardhat | https://docs.monad.xyz/guides/verify-smart-contract/hardhat |
| Tokens & Bridges | https://docs.monad.xyz/developer-essentials/network-information/tokens-and-bridges |
| Differences between Monad and Ethereum | https://docs.monad.xyz/developer-essentials/differences |
| Tooling and Infrastructure (index) | https://docs.monad.xyz/tooling-and-infra/ |
| RPC Providers | https://docs.monad.xyz/tooling-and-infra/rpc-providers |
| Toolkits | https://docs.monad.xyz/tooling-and-infra/toolkits |
| Using Indexers | https://docs.monad.xyz/guides/indexers/ |
| x402 on Monad | https://docs.monad.xyz/guides/x402-guide |
| ERC-8004 on Monad | https://docs.monad.xyz/guides/erc-8004-guide |
| Kuru Flow (swaps) | https://docs.monad.xyz/guides/kuru-flow |
| Blinks | https://docs.monad.xyz/guides/blinks-guide |
| Monad Architecture | https://docs.monad.xyz/monad-arch/ |

---

## What's still unconfirmed / worth asking at the venue

1. Whether Monad Foundation is offering any dedicated/higher-limit RPC for Blitz participants (nothing found — worth just asking staff directly rather than assuming).
2. Discord/Telegram/mentor-support channel for the event (not found on this page — check the event registration/Luma page instead).
3. Exact testnet RPC rate limits (only mainnet limits are published).
4. Exact faucet claim amount/cooldown (only third-party-reported figures found).
5. Exact `forge`/`hardhat` contract-verification command syntax on Monad (pages exist, weren't extractable in this pass — open directly when needed).
