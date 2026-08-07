# Idea: SimCityL1 — A City Whose GDP Is Chain Throughput (on Monad)

## 1. One-line pitch

A persistent city simulation where every meaningful action is a Monad transaction and most citizens are AI agents with wallets — humans are mayors, capitalists, and tourists — so the chain is not a game backend, it *is* the city's physics and economy, and City GDP is literally measured in TPS and settled value.

## 2. The problem this solves

Most "onchain games" still cheat on the interesting part:

- **Hybrid worlds** keep combat, movement, and economy off-chain and only mint the loot. The chain is a trophy case, not a living system.
- **Fully onchain strategy games** exist, but they are usually turn-based, sparse, or dungeon-shaped — not dense civic sims with continuous micro-actions.
- **Agent towns** are appearing (reefs, multi-city economies, fantasy worlds), but few treat **urban institutions** (tax, rent, wages, zoning, fines) as first-class on-chain primitives whose throughput *is* the product.
- **Demo failure mode for high-performance L1s**: judges hear "10k TPS" and see another mint button. There is no visceral proof that cheap, sub-second settlement enables a new *genre* of world.

SimCityL1 makes Monad's performance claim visible: if the city feels alive, it is because thousands of tiny economic acts can settle continuously. If you moved the same design to a slow/expensive EVM, the city would freeze.

## 3. The core idea

Build a tiny but complete city whose rules live in smart contracts:

1. **World grid** — an N×N map of districts/tiles (housing, industry, park, empty).
2. **Citizens** — identities bound to wallets (human or AI agent). Stats are light: location, energy/hunger, cash, optional reputation.
3. **Firms & jobs** — workplaces post wage rates; agents take jobs and get paid on-chain for work ticks.
4. **Markets** — food, energy, housing trade at on-chain prices (simple AMM or order-posting is enough for a hackathon).
5. **Governance** — a mayor (human) can change tax rate / zoning; agents react (migrate, riot, speculate).
6. **Law (optional stretch)** — fines and timed lockups for theft/crime, so risk has a price.
7. **Agent runtime (off-chain brains, on-chain bodies)** — LLMs or rule-based loops decide; every committed act is a Monad tx.
8. **Observability dashboard** — map + gossip feed + TPS ticker + City GDP. This is the demo surface.

The emotional proof is not "we shipped a game." It is watching a living economy whose pulse is the chain.

## 4. Why Monad specifically

A civic agent sim is a high-frequency settlement problem disguised as entertainment:

- 50–200 agents × several actions per minute already produces continuous load.
- Housing bids, wage payments, food buys, and tax remittances are individually tiny — gas must be near-dust or the economy dies.
- Sub-second finality keeps the map feeling real-time instead of turn-based.

This is the same performance thesis as high-frequency finance, applied to a city. Monad is not a nice-to-have skin; it is what makes "every action is a tx" playable.

## 5. System components

1. **World contract** — grid state, tile types, occupancy.
2. **Citizen registry** — wallet ↔ citizen binding; spawn/despawn.
3. **Economy contracts** — wages, markets (food/energy/housing), treasury/tax sink.
4. **Governance module** — mayor role, tax parameter, optional zoning updates.
5. **Agent runner** — TypeScript/Python loop: read chain state → decide → submit txs (session keys / funded bot wallets for demo smoothness).
6. **Indexer / event tail** — feeds the dashboard without hammering RPC for full state every frame.
7. **Dashboard** — top-down map, agent dots, scrolling settlement feed, GDP/TPS counters, mayor controls, shock buttons.

## 6. Agent drives (keep them dumb and legible)

Agents do not need deep personalities for a strong demo. Give each a simple utility:

- **Worker**: maximize `wage - rent - food`, move toward jobs.
- **Speculator**: buy/sell housing when prices move.
- **Scarcity panic**: if food stock low, overpay / migrate.
- **Optional criminal**: steal if expected loot > fine risk (stretch).

Humans inject drama via **god buttons**: raise tax, trigger blackout, flood a district, drop a celebrity (demand spike).

## 7. End-to-end demo flow

1. Spin up city: fund N agent wallets, seed markets, spawn citizens on the grid.
2. Agents autonomously work → buy → move; dashboard shows live txs and GDP climbing.
3. Human mayor raises tax → some agents migrate / stop working; treasury fills.
4. Shock: blackout cuts energy supply → prices spike → agents reshuffle jobs/housing.
5. Pitch close on the ticker: "City GDP today is Monad throughput."

## 8. Hackathon scope (6-hour Blitz slice)

### Must ship
- 8×8 (or smaller) grid with 3 resources: food, energy, housing
- 30–100 agents with rule-based or light-LLM policies
- On-chain: move, work/pay wage, buy resource, update tax
- Dashboard: map + settlement feed + TPS + City GDP
- One mayor control + one shock event

### Nice
- Simple housing NFT / deed per tile
- Gossip feed ("Agent 17 left District B after tax hike") derived from events
- Crime + fine path

### Skip for Blitz
- Full LLM society with long memory
- Photoreal 3D city
- Perfect AMM microstructure
- Mainnet production hardening

## 9. On-chain surface (suggested minimal API)

```text
spawnCitizen(agent)
move(citizenId, x, y)
work(citizenId, firmId)          // pays wage from firm escrow
buy(citizenId, resource, qty)    // market purchase
setTaxBps(bps)                   // mayor only
triggerShock(shockType)          // optional: encoded as param change
getCityStats()                   // GDP window, population, treasury
```

Store hashes/ids on-chain; keep heavy narrative text off-chain. Emit rich events for the dashboard.

## 10. Optional forum/oracle extension (not required)

Live discourse (Reddit/HN weather, transit, crypto fear) can drive shocks instead of random RNG — e.g. rain-related threads → food demand spike. Nice narrative add-on; do not block the core loop on scrapers.

## 11. Why this is a strong hackathon idea

- **Visceral Monad proof**: judges *see* throughput as a living city, not a benchmark slide.
- **Differentiated from dungeon/agent-MMO clones**: civic institutions + GDP=TPS framing.
- **Demoable in minutes**: map motion + ticker + one tax/blackout beat.
- **Composable future**: same substrate can host NightMarket, Parliament of Goblins, or pizza-delivery chaos as skins.

## 12. Pitch line

> We didn't put a game on Monad. We put a city on Monad — and its economy is the chain.

## 13. Naming

Working name: **SimCityL1**. Alternates if needed: **CivicChain**, **Metropolis Monad**, **BlockBorough**. Final name can wait until the pitch deck; the architecture does not depend on it.

## 14. Relationship to other ideas in this repo

This document is an **alternative / parallel idea** to the EV streaming-payment concept in [`docs/idea/`](../idea/). It is filed under `docs/idea_simCity/` so both can coexist while the team decides what to build.
