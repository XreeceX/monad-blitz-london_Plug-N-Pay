# MULTI-MODEL JUDGING — a protocol for picking between ideas

A reusable method for choosing among many candidate ideas using several LLMs, without the
result being decided by whichever model happened to write the winner.

Used twice: once over 34 ideas from 7 generator models, once over 36 challengers across 4
tournament rounds. Both times it changed the answer relative to a naive vote.

Project-agnostic. Works for product ideas, architecture options, naming, strategy — any
decision with many candidates and no ground truth.

---

## The problem it solves

Ask a model to generate ideas and then judge them, and it will favour its own. This is
measurable, and it is large. Measured across three judges who had each also authored ideas,
with authorship hidden during scoring:

| Judge | Mean score, own ideas | Mean score, others' | Bias | Own ideas in own top 5 |
|---|---|---|---|---|
| A | 55.8 | 52.0 | **+3.8** | 1 of 5 |
| B | 60.5 | 48.2 | **+12.3** | 3 of 5 |
| C | 63.8 | 49.9 | **+13.9** | 3 of 5 |

Two of the three crowned their own idea in the blind first round. A +13.9 bias is larger
than the gap between first and fifth place, meaning an unadjusted vote measures authorship
rather than quality.

Note the biases differ by more than 3× between models. You cannot apply a fixed correction;
you have to measure it per run.

---

## The protocol

### 1. Freeze the rubric before anyone generates anything

Write the scoring dimensions, their weights and the hard rules to a file. Include
**calibration anchors** — two or three reference items with their scores already fixed.

Rubric drift is the main failure mode of iterative improvement: scores creep upward across
rounds and you mistake inflation for progress. The anchors are what let you detect it.

### 2. Hide authorship during scoring

Strip every attribution before the judging packet goes out. Judges must not be able to
infer who wrote what. This is what makes the bias measurement in step 5 meaningful — if
judges know, you are measuring stated preference rather than revealed preference.

### 3. Judge independently first, no cross-talk

Each judge scores the full set alone. Collect all results before any judge sees another's.
Anchoring destroys the value of a panel; a judge who reads another's reasoning first tends
to converge on it regardless of merit.

### 4. Re-score the anchors every round — the drift gate

Each round, judges re-score the calibration anchors cold. If an anchor does not come back
within tolerance (±2 on an 80-point scale worked well), **the round is void**. The rubric
moved, not the ideas.

This gate is what separates real improvement from score inflation. Over four tournament
rounds it passed every time, which is the only reason the small gain that run produced can
be believed at all.

### 5. Measure bias, then correct by exclusion

After scoring, reveal authorship and compute each judge's own-vs-others delta. Then compute
every idea's final score as the **mean over only the judges who did not author it**.

Exclusion beats subtracting an estimated bias term: it needs no model of the bias, and it
cannot be gamed by a judge that strategically under-scores its own work to appear neutral.

With three judges this leaves two votes per idea, which is thin but workable. With two
judges it collapses to a single vote on any authored idea — a real weakness, worth naming
in the writeup rather than hiding.

### 6. Coordination rounds — show judges the bias, then let them revise

Give each judge its own measured bias, the other judges' rankings, and ask what it concedes
and what it holds. Two rounds is usually enough.

This is where the method earns its cost. In the observed run, both judges who had crowned
their own idea dropped it in round 1 once shown their bias; one wrote *"I over-rated my own
#3 … its story is mostly stage-relayed theatre."* Round 0 produced three different winners.
Round 2 produced unanimity.

Require each judge to state **conceded** and **held** separately. A judge that concedes
everything is agreeing, not reasoning.

### 7. Adversarial pass on the leader, with a different lens

Once a winner exists, attack it. Not "is this good" — that just re-runs the scoring. Use a
lens the rubric cannot express. For a peer-voted contest the useful one was: *why does a
tired person give this a 3 instead of a 5?*

This is where the observed run discovered that its own highest-scoring improvement had
opened a five-hour sybil window the original design did not have. Scoring never surfaces
that, because scoring asks whether something is appealing, not how it fails.

### 8. Stop on saturation, not on a round count

Run rounds until two consecutive rounds produce nothing that beats the incumbent. Dedupe
candidates against everything **seen**, including rejected ones — dedupe against accepted
ones only and the rejects resurface every round, so the loop never converges.

Report honestly which stop fired: `SATURATED`, or `BOUNDED (budget | round cap)` naming
what went unexamined. Both are legitimate; only mislabelling a bounded run as saturated is
a false record.

---

## What it costs, and what it is worth

The two observed runs cost roughly 80 agents and several hours. That is expensive for a
decision, and justified only when the decision is expensive to get wrong.

**What it bought:**
- Round 0 had three different winners; the final was 3–0. The naive answer was wrong.
- The eventual winner was scored *lowest* by its own author (60, against a 67.5 non-author
  mean), so the win survives the bias check from both directions.
- 36 independently generated challengers failed to beat the incumbent. That negative result
  was worth more than the improvement itself — it is the evidence that the incumbent was
  genuinely the right pick.

**What it did not buy:** much improvement. Four rounds of three models actively trying to
upgrade the leader produced +2 points out of 80, and convergence happened by round 2.
Expect the value to be in *confirming or overturning the choice*, not in polishing it.

---

## Failure modes seen in practice

| Failure | What happened | Fix |
|---|---|---|
| **Name-format drift** | Judges returned `"A. Idea One"` vs `"Idea One"`, so the tally split and every entry showed a single vote | Force exact names via schema, or normalise before tallying |
| **Arm unavailable mid-run** | One model hit a usage limit and was absent for all four rounds; the panel silently ran with two seats | Health-check every arm before starting; report degraded panels loudly |
| **Fabrication pressure** | An agent whose model call fails is tempted to answer in its place | Instruct explicitly: on failure return the error, never substitute. Label any substituted output as substituted |
| **Budget not enforced** | A ceiling passed as a parameter the runtime ignored left the run with no mechanical stop | Verify the ceiling actually arms; otherwise bound the run by a fixed stage list |

---

## Minimum viable version

If the full protocol is too heavy: **freeze a rubric with anchors, score blind with two or
three models, exclude each author's vote from their own idea, and re-check the anchors.**
That is most of the value for a fraction of the cost. The coordination rounds and the
adversarial pass are the expensive additions, and they matter most when the decision is
hard to reverse.
