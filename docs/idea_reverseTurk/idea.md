# Idea: Reverse Turk — An AI Hires the Room (on Monad)

## 1. One-line pitch

Mechanical Turk, inverted: an AI agent with its own crypto wallet hires the whole room as gig workers and pays each person real MON on their phone in under a second.

## 2. The problem this solves / the insight

Almost every “agentic payments” demo still has the human paying the agent (tips, API calls, x402). The interesting inversion is missing:

- Agents that can **hire humans** for taste, counting, judgment, and other non-automatable micro-tasks
- Instant **sub-cent payroll** to many people at once, without apps, gas, or faucets for workers
- A demo where the audience doesn’t watch a ticker — they **are** the ticker

Reverse Turk makes Monad’s fee/finality profile emotionally real: ~150 people paid fractions of a penny each, settled in ~800ms, with every voter able to open Monadscan and find their own transfer.

## 3. The core idea

1. Everyone scans a QR → mobile web creates a throwaway browser wallet (localStorage). No install, no seed UX, no “connect wallet.”
2. An agent holds a funded wallet and a budgeted goal (e.g. “choose my logo”).
3. Agent posts short tasks the room can do with taste (A/B logo, count something in the room).
4. Workers tap answers on phones. **Workers never send a tx** — no gas, no faucet needed for the audience.
5. Agent grades / tallies and calls `payBatch` — one on-chain call that pays every participant individually.
6. Phones update: balance ticks up + Monadscan link. Projector shows payroll ticker + reveal.

## 4. Why Monad specifically

The pitch is **instant sub-cent payroll**, not a fake TPS counter.

- Paying ~150 humans a fraction of a penny each only makes economic sense at Monad’s fees.
- Sub-second finality makes “check your phone” land inside a 2-minute pitch.
- Anyone can verify their own payment on an explorer — peer voters are developers; they will click the link.

On a slow/expensive EVM, this demo is either fake (off-chain balances) or economically absurd.

## 5. Why it can win Blitz London specifically

Judging is **community voting** after short pitches (~2–3 min), not a VC panel. Tired peers rate what excited them.

- Room **does** something instead of watching slides.
- Personal payment creates a retellable story: “an AI hired me and paid me.”
- Agentic payments are a crowded theme; flipping payer/payee is the novelty wedge.
- Frontend is the product — perfect for on-screen voting culture.

## 6. Demo script (~2 minutes on stage)

| Time | Beat |
|---|---|
| 0:00 | QR fills projector: “Scan this.” |
| 0:10 | Phones open Welcome — “You’ve been hired.” Wallet created silently. Workers online counter climbs. |
| 0:25 | Task 1: two logo options, 5–20s. Live A/B bars on projector. |
| 0:50 | “Check your phone.” Balances tick; payroll ticker + tx hashes on big screen. |
| 1:10 | Task 2 (different flavour): e.g. “How many [X] in the room?” — room looks up together (laugh beat). Pays again. |
| 1:35 | Reveal: winning logo + total wage bill + “no human touched the wallet.” |
| 1:50 | Close on payslip / Monadscan proof. |

## 7. User story (audience — Sam, row 4)

Sam is tired at pitch #22. Scans QR like a restaurant menu. No MetaMask popup. Sees “You’ve been hired,” taps a logo, then — without signing anything — balance becomes `0.020 MON` with a real explorer link. Later Sam rates projects: twenty-one were recordings; one paid Sam and showed the thing Sam helped make.

## 8. Screens to build (5 phone + 1 projector)

| # | Phone screen | State |
|---|---|---|
| 1 | Welcome / wallet created | idle, waiting |
| 2 | Task card — image A/B or multiple choice | active, countdown |
| 3 | Submitted | pending payment |
| 4 | Paid — balance + tx link | success |
| 5 | Payslip / reveal | end of session |

**Projector:** live vote bars, workers online, payroll ticker (total wages, top earners, live tx hashes), final reveal.

That’s the entire frontend. Nothing else gets built.

## 9. Agent loop

1. Wake with funded wallet + goal: choose visual identity.
2. Load **pre-generated** logo variants (made before pitch — never on the critical path).
3. Post task batch; open short window (e.g. 20s).
4. Collect signed/attested votes as they arrive; tally continuously (no end-of-round freeze).
5. Call `payBatch` for everyone who submitted — one tx, individual transfers, one `Paid` event each.
6. Repeat for round two.
7. Pick winner from tally; render reveal + total wage bill.

## 10. What to build in ~6h45m (team of 3)

| Owner focus | Deliverable |
|---|---|
| Contracts | Small Solidity: escrow + `payBatch` that pays everyone in one call |
| Mobile web | QR join, throwaway browser wallet, tap-to-vote (workers never send txs) |
| Agent + projector | Agent loop + payroll ticker / reveal screen |

## 11. On-chain surface (suggested)

```text
fund(agent) / deposit budget
openRound(roundId, taskHash, deadline)
submitVote(roundId, worker, choice, sig)   // relayed by backend — worker pays $0 gas
payBatch(roundId, workers[], amounts[])    // one call, many recipients
event Paid(worker, amount, roundId, tx context)
```

Workers’ wallets are funded **to** them; they never need MON to participate.

## 12. Edge cases the demo must survive

| Situation | Behaviour |
|---|---|
| Joins mid-task | Next round; “next job in Xs” — never empty dead screen |
| Never scans | Still sees projector; still sees room get paid |
| Submits at last millisecond | Hard timeout pays all pending; never block on stragglers |
| Refresh page | Wallet persists in localStorage; balance remains |
| Phone offline mid-round | Vote fails silently; next round still works |
| Only ~20 scanners | Ticker still honest — smaller numbers, still real |

## 13. Honest risks

- Many live parts must work together: agent, contract, phone app, projector.
- 2-minute join → task → pay → reveal needs **real rehearsal**.
- Thin room scan rate makes the ticker look weak — seed staff/friends to scan first.
- Paying voters can read as charming **or** vote-buying — **joke about it on stage before someone else does**.
- Higher ceiling than “safe” demos; also higher stall risk.

## 14. Why not something safer

A “phone flashlight vote counted by stage camera” is easier and almost can’t fail — but tops out at “nice.” Reverse Turk can get a 5/5 or stall. Higher ceiling, harder build.

## 15. Pitch line

> Every agent demo this year has you paying the AI. We flipped it — the AI hired this room, and just paid you.

## 16. Naming

Working name: **Reverse Turk**. Alternates: **HireHuman**, **AgentPayroll**, **TurkFlip**, **RoomAsAPI**.

## 17. Relationship to other ideas in this repo

| Idea | Relation |
|---|---|
| [`docs/idea/`](../idea/) Amber Current | Same Monad thesis (micro-settlement), different surface (infra vs room) |
| [`docs/idea_simCity/`](../idea_simCity/) SimCityL1 | Strong visual TPS story; audience watches. Reverse Turk makes audience **participants**. |
| [`docs/idea_athena/`](../idea_athena/) Athena-lite | Intellectual depth; weaker 2-min room energy |

Shared stack theme: Monad as the only sensible rail for many tiny payments — here the payees are humans in the seats.
