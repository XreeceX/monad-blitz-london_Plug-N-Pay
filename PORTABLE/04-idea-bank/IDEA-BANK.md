# IDEA BANK — 57 scored ideas for a peer-voted crypto hackathon

Every idea generated across two separate runs, with its score. Nothing here is asserted;
all of it was scored blind against the rubric in `../03-method/RUBRIC.md`, with each
author's vote excluded from its own idea.

**Use this to pick a project, or to check that a new idea is not a rediscovery.**

Raw records with full detail (mechanic, build plan, why-Monad, risk) are in
`all-ideas-v2.json`, keyed by `_id`.

---

## Round A — 34 ideas, 7 generator models, 3 judges

Scores are bias-corrected: the mean over judges who did not author the idea. Max 80.

| Score | # | Idea | By | One line |
|---|---|---|---|---|
| **67.5** | 7 | Reverse Turk | fable5 | An AI agent with its own budget hires the room as gig workers and pays real MON to their phone within a second |
| **65.5** | 19 | NADSASSIN | fable5 | All-day game of Assassin refereed by chain: stake 1 MON, get a secret target, log kills by scanning your victim's QR |
| **64.5** | 25 | BlinkOff | grok4.5 | Two volunteers stare on stage; MediaPipe detects the first blink; the room's left/right bet settles in one block |
| **64.0** | 2 | Overheard at Blitz | fable5 | Yik Yak for the hackathon — anonymous confessions living entirely on-chain, tip to push gossip to the top |
| **64.0** | 22 | FlashPoll | grok4.5 | Democracy by flashlight: the room votes YES by torching the ceiling, stage cameras tally zones on-chain |
| **63.0** | 26 | Hivemind Snake | fable5 | Twitch Plays Pokémon live: every phone is a D-pad, each 2-second move a majority vote of signed ballots |
| **62.0** | 16 | ClapCeiling | grok4.5 | Over/under on how loud the room can clap; stage mic measures peak dB, chain settles the pot |
| **62.0** | 23 | Roshambo Royale | fable5 | 167 players, 8 rounds, 2 minutes, 1 champion — knockout rock-paper-scissors, every throw signature-verified |
| **59.5** | 34 | HotPotatoMON | grok4.5 | One phone is the potato: pass it before the on-chain fuse hits finality or your seat burns MON |
| **57.5** | 3 | Proof of Jump | gpt-5.6-sol | Mining powered by the room doing jumping jacks; camera-detected bursts fill an on-chain block |
| **56.0** | 29 | BlockRelay | grok4.5 | Two human relay lines race; each runner needs an on-chain PASS confirmed before the next can run |
| **54.3** | 5 | Finality Bet | qwen3.5 | Binary prediction market on a physical event resolving inside the finality window |
| **53.5** | 14 | ParallelScore | fable5 | Lighthouse for contracts: paste what you deployed today, we fire real load and score its parallel execution 0–100 |

Ideas 1, 4, 6, 8–13, 15, 17, 18, 20, 21, 24, 27, 28 and 30–33 scored between 33 and 50.5
and are in the JSON. Lowest were HeartChain (33 — killed by the iOS torch constraint) and
Mini Agent Marketplace (34.3).

---

## Round B — 36 challengers, 4 tournament rounds, 4 free generator models

Generated specifically to beat the round-A winner, under four attack lenses (why-Monad,
room participation, novelty inversion, spectacle-per-risk). **None beat it.** The best
reached 60. Recorded here because the near-misses are still good ideas.

| Score | Idea | Round |
|---|---|---|
| **60** | Hard Cash | 4 |
| 56 | Liar's Bond | 4 |
| 56 | Cut the Line | 4 |
| 53.5 | The Commons | 1 |
| 52 | Tammany Hall | 4 |
| 51.5 | Split or Steal | 1 |
| 49.5 | Collateral | 4 |
| 49 | BlockStep Sequencer | 2 |
| 48 | Turing Testnet | 1 |
| 47.5 | Front-Run | 1 |
| 46.5 | Sealed | 1 |
| 46 | CO2racle · ShieldWall | 2 |
| 45.5 | Two-Thirds | 1 |
| 45 | SLA-Stake | 3 |
| 43.5 | Recount | 4 |
| 41 | Threshold Treasure · BlockDrop Auction | 2, 3 |
| 39 | SyncLock | 3 |
| 37.5 | Block-Hash-Predictor | 3 |
| 37 | Doppelganger | 2 |
| 36 | RipChain | 3 |
| 32.5 | ValidatorBid | 3 |

Full text for round-B ideas lives in the tournament round artifacts, not in the JSON.

---

## What the scores actually taught

**Participation dominates.** Every idea above 62 puts the whole room in motion — voting,
playing, moving, betting. Every idea below 50 asks the room to watch a screen. In a
peer-voted format that single factor separates the field more than novelty does.

**The top ideas cluster into four mechanisms**, worth knowing before inventing a fifth:

1. **Agent pays humans** — inverts the crowded "human pays agent" theme (Reverse Turk)
2. **All-day game, pitch is the finale** — accumulates a story no 3-minute demo can fake
   (NADSASSIN, Overheard at Blitz)
3. **Stage-camera oracle, room votes physically** — no phone transactions at all, so RPC
   limits cannot bite (FlashPoll, BlinkOff, ClapCeiling)
4. **Signed ballots, one batching keeper** — mass participation without mass transactions
   (Hivemind Snake, Roshambo Royale)

**The highest-floor design is category 3.** No wallet, no onboarding, no audience network
traffic. It reliably lands a 4 and rarely a 5. Category 1 has the highest ceiling and the
most moving parts.

**Novelty is the hardest dimension to move.** These categories are saturated in the
hackathon corpus and need a genuine inversion rather than a new theme: agentic payments
where the human pays, prediction markets, move-to-earn, identity and attestation
registries, NFT mints, TPS dashboards, pixel canvases, on-chain agent towns. Full list in
`../03-method/SEEN.md`.

**Check any new idea against `../03-method/HARD-CONSTRAINTS.md` first.** Several ideas here
scored badly purely because the mechanism cannot physically run in a room — that document
lists what is verified dead and why.
