# Idea: Athena-lite — Replication Bounties from Forums (on Monad)

## 1. One-line pitch

Forum drama becomes deal-flow for science: pull controversial claims from r/science, r/MachineLearning, and Hacker News, spawn on-chain confirm/refute bounties, let agents fetch papers/code/evidence, and settle payouts on Monad — so peer review becomes a market that pays you to be right, and pays you more to prove someone else wrong.

## 2. The problem this solves

Scientific and technical discourse on the open web is high-volume and low-accountability:

- **Claims outrun verification.** A viral HN comment or Reddit thread can assert “X beats Y,” “paper Z is unreproducible,” or “this benchmark is fake” long before anyone runs a check.
- **Peer review is slow and closed.** Traditional review does not price urgency, does not pay replicators, and does not leave a public, composable trail of evidence.
- **DeSci / science DAOs** mostly fund *intent* (grants, tokens, communities) rather than a continuous market for *falsification* of specific claims mined from live discourse.
- **Prediction markets** price outcomes, but rarely attach a structured evidence vault (paper hash, code hash, run receipt) that agents can race to produce.
- **Forum data is wasted as sentiment.** Most crypto uses of Reddit/HN stop at vibes. The useful object is the **falsifiable claim**, not the upvote count.

Athena-lite treats forums as a **claim firehose** and Monad as the **bounty + settlement rail**.

## 3. The core idea

1. **Ingest** new/hot posts from curated sources (r/science, r/MachineLearning, HN front page / newest).
2. **Extract** falsifiable claims with an LLM (claim text, entities, stance, suggested verification method, confidence).
3. **Filter** for computable checks first (code repos, benchmarks, numeric results, “does Figure 3 reproduce?”) — skip wet-lab cosplay for the hackathon.
4. **Spawn a bounty market** on Monad: stake on CONFIRM vs REFUTE (or post a prize pot either side can claim with evidence).
5. **Agents compete** to submit evidence packs: dataset CID / paper URL, code hash, run logs hash, short reasoning.
6. **Resolve** via optimistic challenge window, simple attestor panel, or demo admin resolve with published rubric.
7. **Pay + reputation**: winner takes bounty; submitters accrue on-chain reputation for good evidence; bad-faith spam gets slashed / ignored.

Forum threads are not stored wholesale on-chain — only **claim hashes, evidence hashes, stakes, and resolutions**.

## 4. Why Monad specifically

Claim markets are high-frequency micro-economics:

- Many claims/day × many evidence submissions × many stake updates.
- Individual bounties can be tiny (attention markets) or larger (replication prizes).
- Agents need cheap, fast settlement when they submit competing evidence within minutes of a viral thread.

A slow/expensive chain turns “race to verify” into “race to afford gas.” Monad makes continuous replication markets economically real.

## 5. System components

1. **Ingest worker** — poll Reddit (official API / public JSON) + HN Algolia/Firebase API on an interval.
2. **Claim extractor** — LLM prompt → structured JSON `{claim, sourceUrl, sourceHash, method, tags}`.
3. **Claim registry contract** — register claimId, contentHash, sourceUrl, status, deadlines.
4. **Bounty / market contract** — CONFIRM/REFUTE stakes or prize escrow; claimEvidence(); resolve().
5. **Evidence vault** — store IPFS/HTTP URLs + keccak hashes of code, logs, and summaries; emit events.
6. **Agent runners** — fetch arXiv/GitHub, run a tiny reproducible check (unit test, metric recompute, script), submit evidence tx.
7. **Dashboard** — live claim feed from forums → open bounties → evidence races → settlements / reputation leaderboard.

## 6. End-to-end flow

1. HN post: “We reproduced Paper X; AUC is 0.91 not 0.97.”
2. Extractor emits claim: `Paper X reported AUC 0.97 is not reproducible; true AUC ≤ 0.91 on dataset D.`
3. Contract opens bounty with e.g. 10 MON pot + deadline T.
4. Agent A clones repo, runs eval script, posts `evidenceHash` + CONFIRM.
5. Agent B posts counter-evidence REFUTE (different seed / data split).
6. Resolution rule fires (optimistic period / attestor / demo judge).
7. Payout + reputation update on Monad; dashboard shows the full evidence tree linked back to the forum URL.

## 7. Hackathon scope (Blitz slice)

### Must ship
- Ingest from **HN + one subreddit** (r/MachineLearning *or* r/science)
- LLM claim extraction into a queue (human approve button OK for demo quality)
- On-chain: registerClaim, fundBounty, submitEvidence, resolve, payout
- 2–3 agents (even scripted) that attempt a **toy verification** (e.g. re-run a fixed local benchmark / assert a numeric claim)
- Dashboard: forum → claim → bounty → evidence → settle

### Nice
- Dual CONFIRM/REFUTE AMM or simple parimutuel pool
- Reputation NFT / score per agent wallet
- arXiv ID detection + auto paper abstract fetch
- Optimistic challenge window (not only admin resolve)

### Skip for Blitz
- Full zkML proofs of training runs
- Wet-lab / human subject claims
- Exhaustive Reddit historical torrents
- Production anti-manipulation oracle networks

## 8. On-chain surface (suggested minimal API)

```text
registerClaim(contentHash, sourceUrl, methodTag)
fundBounty(claimId, side)              // CONFIRM | REFUTE | UNSPECIFIED pot
submitEvidence(claimId, side, evidenceHash, uri)
challenge(claimId, evidenceId)         // optional optimistic path
resolve(claimId, winningSide, reasonHash)
getClaim(claimId) / getReputation(agent)
```

Keep full text off-chain; pin evidence payloads to IPFS or a demo server; put hashes on Monad.

## 9. Data sources (practical)

| Source | Use |
|---|---|
| Hacker News API | Clean, free, great for tech/science claims |
| r/MachineLearning | Papers, benchmarks, reproducibility fights |
| r/science | Broader claims; filter hard for computable ones |
| arXiv / OpenAlex | Paper metadata for evidence agents |
| GitHub | Code to actually run |

**Caveats:** respect API ToS/rate limits; don’t dox users; treat forum text as noisy and gameable; prefer claims with links to papers/code.

## 10. Why this is a strong hackathon idea

- **Useful, not just fun:** turns wasted discourse into verification markets.
- **Clear Monad hook:** many small stakes/evidence txs around breaking threads.
- **Agent-native:** LLMs extract claims; other agents race to prove them.
- **Demo theater:** show a live HN/Reddit item → bounty opens → agents submit → payout in one pitch.
- **Complements Athena full vision** while staying Blitz-sized (computational claims only).

## 11. Pitch line

> Peer review is a market. Athena pays you to be right — and pays you more to prove someone else wrong. Forums are just where the claims are born.

## 12. Naming

Working name: **Athena-lite** (hackathon slice of the broader Athena science-market vision). Alternates: **Falsify**, **ClaimBounty**, **ReproMarket**, **Forum→Fact**.

## 13. Relationship to other ideas in this repo

- Parallel to EV streaming payments in [`docs/idea/`](../idea/)
- Parallel to civic sim in [`docs/idea_simCity/`](../idea_simCity/)
- Shared infra theme with both: **Monad as high-frequency settlement for many tiny economically meaningful events** — here the events are scientific claims and evidence, not kWh ticks or city moves.
