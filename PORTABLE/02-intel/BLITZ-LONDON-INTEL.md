# Monad Blitz London — Phase 0 Intelligence

Compiled 2026-08-07. Event is **tomorrow, Sat 8 August 2026**.
Raw data: `blitz-intel-raw.json` (London event record + all 66 historical Blitz winners).

---

## 1. Hard facts

| Item | Value | Source |
|---|---|---|
| Date | Saturday 8 August 2026, 09:00–21:00 BST | [Luma](https://luma.com/blitz-lon-aug-2026) |
| Venue | Encode Hub, 41 Pitfield St, London N1 6DA (Shoreditch) | Luma |
| Hosts | Encode Club + Monad Foundation + AI Builders | Luma |
| Prize pool | **$3,000 USD** (split not published) | Luma / [Encode X](https://x.com/encodeclub/status/2082164259841261737) |
| Registered attendees | **167** (event full, waitlist only) | `blitz.devnads.com/api/events/monad-blitz-london` |
| Team size | Solo or team, formed on site. **No cap set** for London (`max_team_size: null`) | Portal API |
| Chain | Monad. Portal drops **50 testnet MON** per attendee (`token_amount: "50"`) | Portal API |
| Status | `registration_open: true`, `submissions_open: false` (opens on the day) | Portal API |

### Schedule (BST)
```
09:00  Registration & breakfast
10:00  Welcome & Blitz intro
10:15  Monad 101 workshop
11:15  HACKING BEGINS          <- submission_start_time = 12:00 BST per portal
13:00  Lunch
18:00  CODE FREEZE             <- 6h45m of actual build time
18:30  Submission deadline + dinner
19:00  Pitches
20:30  Prizes, networking, closing
```
**Real build window: 11:15 → 18:00 = 6h45m.** Not 7h. Lunch eats into it.

---

## 2. How you actually win — this is the whole game

The Blitz Portal frontend bundle states the judging model verbatim:

> **"Rate projects on a 1 to 5 scale. Top-voted projects win recognition and prizes."**

Monad's own builder blog confirms: Blitz demos close *"with cash prizes for top performers **decided by live audience vote**"* ([monad.xyz/blog/home-for-builders](https://www.monad.xyz/blog/home-for-builders)). The ETHDenver edition said it outright: *"Peer-Judged: No black-box judging panels. Winners are decided entirely by the people building alongside you."*

**Consequence: this is not a judge-panel hackathon. ~167 tired developers each rate every project 1–5 after watching a short pitch.** Optimise for the median rating across a whole room, not for one expert's approval.

What that changes:
- **Legibility beats depth.** A project nobody understands in 90 seconds gets 3/5 from everyone. Rank is decided in the 4-vs-5 margin.
- **Deep infra/quant work is penalised.** The room can't verify it, so it defaults to a safe middle score.
- **Audience participation is the cheat code.** Get the room to pull out phones and *use* your thing during the pitch (QR code → they're in). People rate what they touched higher. Hunch (Shanghai) built its entire product around this; MojoMan (Denver, 1st) had the room doing press-ups on camera.
- **Recognisable format wins.** Every winner below is "X, but on Monad" — Pokémon Go, poker, Steam, Airbnb, Minecraft. Zero explanation overhead.
- **Pitch order matters.** With ~30–50 projects and 90 min of demos, late slots are remembered. If slot choice is offered, don't go first.

### The two live unknowns — confirm on the day, in the first 30 minutes
1. **Prize split of the $3,000.** Not published anywhere. Other Blitz editions with $2,000 use 1000/600/400 (50/30/20). Expect roughly 1500/900/600. Ask at registration.
2. **Portal voting window is set to `2026-08-09 17:30–19:30 UTC` — that is Sunday, a day after the event.** Every other edition (e.g. Toronto) has voting inside the event day. Almost certainly an off-by-one config slip that gets fixed, but if it isn't, voting happens the next day and your *submitted README/demo link* carries all the weight, not your live pitch. **Verify this with an organiser early.**

Also unpublished: pitch length (assume 2–3 min, plan for 2), whether Monad Foundation staff score alongside the room.

---

## 3. Submission mechanism — free points, most teams fumble this

Official process ([monad-developers/monad-blitz-london](https://github.com/monad-developers/monad-blitz-london)):
1. **Fork** `monad-developers/monad-blitz-london` from `main`.
2. Rename the fork to your project name, add a **one-liner description** on the fork.
3. Push all your code + fill in the `README.md`.
4. Submit at **[blitz.devnads.com](https://blitz.devnads.com)** (email OTP login, team invites supported).

Portal collects per project: `title`, `description`, `category` (**free text — not a fixed enum**), `github_url`, `demo_url`, `tweet_url`, `image_url`, `team_members`. `collect_tweet_url: true` and `collect_category: true` are both on for London — **a tweet URL is a required field, so write the tweet before 18:30.**

Submission mode is `live`, no demo video required for London (`video_instructions: null`).

**Do this at 12:00, not 18:25:** fork the repo and submit a placeholder immediately when submissions open, then keep editing. A blank submission at the deadline is the single most common way to lose here.

---

## 4. What has actually won (66 winners, all Blitz editions)

Theme frequency across all winning descriptions: **AI 176 mentions, payments 43, agent 34, gaming 36, betting/prediction 37, DeFi 23, NFT 17.**

### Western editions — closest analogues to London
| # | Project | Edition | What it was |
|---|---|---|---|
| 1 | **Mojoman** | Denver | Bet on other attendees' exercise. AI webcam pose-detection counts reps, WebRTC livestream, sessions + bets settled on Monad. |
| 2 | **BLUFF** | Denver | Agentic poker tournament — you create AI agents with custom personalities, they play each other. |
| 1 | **Monacle** | SF (x402) | Live AI assistant that sees through your phone camera, talks, and pays real x402 payments on Monad — no wallet popups. Demoed by buying plush toys and snacks in the room. |
| 2 | **MallRat 8004** | SF (x402) | A "proto-rodent lifeform" that survives on-chain via buy-now-pay-later credit against staked MON. |
| — | **FALLBACK AI** | SF (x402) | Broadcast messages over Meshtastic mesh radio, charged per message via x402 on Monad. |
| 2 | **AgentMarket** | NYC | Marketplace of specialist AI design agents with on-chain reputation (ERC-8004); an orchestrator agent hires by track record and the winner's page builds itself live. |
| 3 | **Monad Arcade** | NYC | Fully on-chain game portal — "Steam's distribution + economy layer", permissionless game launch with tokens and stakes. |
| 1 | **Promptmon** | Buenos Aires | One prompt generates your fighter, mint as NFT, battle other players' NFTs. Loser's NFT transfers permanently. |
| 2 | **KNTX** | Buenos Aires | "Airbnb for gaming PCs" — P2P compute rental, streamed gameplay, paid on Monad. |
| 3 | **SILK MONAD** | Buenos Aires | Silk Road sim inside a live Minecraft server where autonomous AI agents trade real tokens and NFTs. Judges could join the server. |
| 3 | **SendrPay** | Lagos | AI agent remittance into NGN/GHS/XOF/XAF. |

### Other notable firsts
- **MON Go** (Bangalore) — Pokémon Go for MON tokens IRL-dropped at events; pitched as a replacement for event swag.
- **T-MON** (Seoul) — fair-queue ticketing exploiting Monad's TPS, MEV-resistant.
- **WICK** (Ankara) — AI market maker fighting LVR (loss-versus-rebalancing).
- **AgMON** (New Delhi) — drag-and-drop canvas + NL prompts for non-custodial portfolio automation.
- **Hunch** (Shanghai) — timed YES/NO prediction game played by the audience *during* presentations, prize pool settled on Monad. Purpose-built to hijack a demo-day room.

### The pattern
1. **Instantly recognisable consumer format.** Not a protocol. A *game* or a *toy*.
2. **AI agent inside it.** Nearly every recent winner has agents doing something autonomously. AI Builders co-hosting London strengthens this.
3. **A visible "why Monad" moment** — many small transactions happening fast and live on screen. Winners show throughput, they don't describe it.
4. **The room is in the demo.** Camera, live server, QR code, everyone's phone.
5. **Ships as a URL.** Deployed, phone-openable, no install.

---

## 5. Monad technical brief

Monad is an EVM-equivalent L1 — **existing Solidity deploys unchanged.** Mainnet went live 24 Nov 2025.

- **Testnet:** chain ID `10143`, RPC `https://testnet-rpc.monad.xyz`, explorer `testnet.monadscan.com`, faucet `faucet.monad.xyz`. The Blitz Portal gives you 50 MON directly — use that, skip the public faucet queue.
- **Mainnet:** explorers MonadVision + Monadscan; public RPC incl. `https://rpc-mainnet.monadinfra.com` (+ wss). Canonical contracts already deployed: Multicall3, Permit2, Safe, CreateX, ERC-4337 EntryPoint v0.6/0.7/0.8, **x402 ExactPermit2Proxy and UptoPermit2Proxy**.
- **Performance claims to quote on stage:** 10,000 TPS, 400ms blocks, 800ms finality, MonadBFT single-slot finality, optimistic parallel execution, MonadDb.
- **Docs:** `docs.monad.xyz`, full page index at `docs.monad.xyz/llms.txt` (feed this to your coding agent). Read `developer-essentials/best-practices` and `developer-essentials/differences` before writing contracts.
- **Templates worth forking now:** `monad-developers/foundry-monad` (preconfigured Foundry), `monad-developers/monad-miniapp-template` (Next.js + Farcaster miniapp), `monad-developers/monad-mcp-tutorial` (MCP server against Monad), `monad-developers/monode` (Execution Events SDK).
- **Infra available:** Envio + GhostGraph + QuickNode Streams for indexing, thirdweb / Privy / Sequence / Para for embedded wallets and gasless UX, 0x for swaps, Zerion API for portfolio data.

**Note the x402 proxies are canonical on Monad.** Two of the three SF winners were x402 projects, and Monad's Rain-hosted NYC hackathon the same weekend is explicitly agentic-commerce themed. Agentic payments is the house theme of this ecosystem right now.

---

## 6. Framing for idea selection

No stated theme for London — "build whatever, on Monad". The tagline is *"the longest running **vibe-coding** web3 hackathon"*, which tells you the organisers expect AI-assisted shipping and will not punish it.

Filters to run any candidate idea through:
1. Can a tired developer understand it from one sentence and one screen?
2. Does the room get to *use* it during the 2-minute pitch?
3. Does it visibly need Monad's speed — many tiny transactions live on screen — or would Ethereum do fine? ("Why Monad" is the question the room asks.)
4. Can the golden path be built in **6h45m** by your team, with everything off that path stubbed?
5. Is there one screenshot that makes the point without narration?

Anti-patterns given the peer-rating format: pure infrastructure, indexers, dev tooling, quant/LVR math, anything needing a whitepaper, anything where the demo is a terminal.

---

## 7. Open items to resolve at 09:00 tomorrow
- [ ] Prize split of the $3,000
- [ ] Voting window — is it Aug 8 evening or genuinely Aug 9? (portal says Aug 9)
- [ ] Pitch length and whether slot order is chosen or assigned
- [ ] Does the Monad Foundation team score alongside the room, or is it pure peer vote?
- [ ] Any surprise sponsor bounty announced in the 10:00 welcome (SF had a thirdweb x402 bounty, Denver had a PizzaDAO track)
- [ ] Testnet vs mainnet expectation — every prior Blitz used testnet, but mainnet is live now
- [ ] Wi-Fi details (`wifi_name`/`wifi_password` are null in the portal; tether as backup)
