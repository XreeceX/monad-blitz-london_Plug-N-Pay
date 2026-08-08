# PORTABLE — reusable material, no project attached

Everything in this folder survives the choice of project. Copy the whole directory into a
new repo and delete what does not apply.

Nothing here recommends a specific product. Where a past project is named, it is evidence
for a scoring claim, not a proposal.

---

## What is here

### `01-event/` — Monad Blitz London, organiser documents

Verbatim from the organisers. Keep if you are still doing this event; delete otherwise.

| File | Why it matters |
|---|---|
| `judging_criteria.md` | **The most important file for any Blitz project.** Peer vote, not a judge panel; criteria are novelty, innovative mechanics, problem-solving, experimentation; organisers state explicitly they are *not* rewarding polish |
| `rules.md` | Max 4 per team, fresh code only, must deploy to testnet, pre-event planning encouraged |
| `project_demo.md` | 3 minutes per pitch, audience is fellow developers, slides optional, have a fallback recording |
| `about.md` | Schedule and prizes: hacking 11:30–18:00, freeze 18:00, submit 18:30, pitches 18:30–20:30 |
| `submission_process.md`, `what_to_bring.md`, `blitz_resources.md` | Logistics |

### `02-intel/` — research that took real time to gather

| File | Why it matters |
|---|---|
| `BLITZ-LONDON-INTEL.md` | 66 past winners indexed, peer-voting mechanics mapped, category win-rates. The "what has already won and what is saturated" reference |
| `monad_dev_resources.md` | Monad developer resources, RPC and tooling notes |

### MONSKILLS (agents) — see repo root docs

For Cursor / Claude agents building on Monad, teammates should run:

```bash
npx skills add therealharpaljadeja/monskills
```

Full guide + prompt library links live in the project at [`../docs/MONSKILLS.md`](../docs/MONSKILLS.md) (not under PORTABLE — project-attached). Sources: https://skills.devnads.com/install.md · https://skills.devnads.com/prompts

### `03-method/` — process, fully project-agnostic

| File | Why it matters |
|---|---|
| **`HARD-CONSTRAINTS.md`** | Verified technical facts that kill demo ideas: RPC rate limits, iOS torch, DeviceMotion permissions, unbounded-loop reverts, sybil exposure, camera-oracle lighting. **Read before designing anything** |
| **`MULTI-MODEL-JUDGING.md`** | Protocol for choosing between ideas with several LLMs without authorship deciding the winner. Measured self-preference bias ran +3.8 to +13.9 out of 80 |
| `RUBRIC.md` | A 7-dimension /80 scoring rubric with weights, hard rules and calibration anchors. Swap the anchors for your own candidates and it works unchanged |
| `SEEN.md` | Saturated categories and already-invented ideas — the duplicate blocklist |
| `workflows/idea-tournament.js` | Runnable Claude Code Workflow: generate rivals, screen, improve the champion, score bias-corrected, loop until saturated |
| `workflows/product-spec-panel.js` | Runnable Workflow: 5 coordinated rounds of multi-model debate, then specialists, then SPEC / DESIGN / PREFLIGHT / BUILD |

Both workflow scripts contain hardcoded paths and prompts referring to the previous
project. They are templates — edit the constants at the top before reuse.

### `04-idea-bank/` — 57 scored ideas

| File | Why it matters |
|---|---|
| **`IDEA-BANK.md`** | Every idea from both runs, ranked, plus what the scores taught. If you still need a project, start here |
| `all-ideas-v2.json` | Raw records: mechanic, why-chain, room participation, build plan, biggest risk, novelty-vs-corpus |

---

## The four things worth knowing, if you read nothing else

**1. Participation is the dominant variable in a peer vote.** Every idea that scored above
62 puts the whole room in motion. Everything below 50 asks them to watch a screen. That
separated the field more than novelty did.

**2. The room cannot each send a transaction.** Public testnet RPCs rate-limit. Any design
assuming ~150 phones each submitting will stall on stage. Off-chain signatures plus one
batching signer is the working pattern — and you must disclose it, because a developer
audience catches an inflated claim and marks you down for it.

**3. Self-preference bias is large and varies by model.** Measured at +3.8, +12.3 and
+13.9 out of 80 across three judges. It exceeded the gap between first and fifth place.
Exclude each author's vote from their own idea, and re-score fixed anchors every round to
catch rubric drift.

**4. Iterating on a good idea buys less than you would expect.** Four rounds of three
models trying to improve the leading design produced +2 points out of 80, converging by
round 2. Meanwhile 36 fresh challengers all failed to beat it. The value of that exercise
was *confirming the choice*, not improving it. Budget accordingly.

---

## Known gaps

- The workflow scripts were launched without an enforced token ceiling; the parameter used
  did not arm the runtime budget. Bound reuse by a fixed stage list, not by a token cap.
- The judging protocol assumes three independent model seats. One seat was unavailable for
  an entire run and the panel silently degraded to two. Health-check every arm first.
- `BLITZ-LONDON-INTEL.md` contains figures (attendee count, corpus size) that were not
  independently re-verified. Treat them as approximate.
