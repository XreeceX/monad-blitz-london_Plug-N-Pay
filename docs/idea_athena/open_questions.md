# Open Questions — Athena-lite

Status legend: 🔴 blocking · 🟡 shapes scope · 🟢 has a safe default

---

## 1. Resolution mechanism for the demo? 🔴

**Options:** admin/multisig resolve · optimistic challenge window · 2-of-3 human attestors · purely automatic script threshold

**Recommendation:** Admin resolve with published rubric for Blitz reliability; show optimistic challenge as the production path in the writeup.

---

## 2. Market shape: prize pot vs CONFIRM/REFUTE parimutuel? 🟡

**Recommendation:** Single prize pot claimable by first valid evidence on a side is simplest. Add dual-side staking if time allows — better theater, more contract surface.

---

## 3. Which forum sources on day one? 🟢

**Recommendation:** HN (reliable API) + r/MachineLearning. Add r/science only if filtering quality is good enough to avoid junk claims on stage.

---

## 4. Human-in-the-loop claim approval? 🟡

**Why it matters:** Bad extractions kill the pitch.

**Recommendation:** Yes for demo — “Approve & spawn bounty” button. Fully autonomous extraction is a stretch goal.

---

## 5. What counts as a “toy verification” agents can finish in minutes? 🔴

**Ideas:** recompute a CSV metric · run a fixed pytest suite · check a Solidity invariant · compare author-reported number to a local script output

**Recommendation:** Pre-seed 2–3 claims with known local reproducers so the live race never depends on a random broken GitHub repo mid-pitch.

---

## 6. Reddit API credentials / rate limits at the venue? 🟡

**Recommendation:** Prefer HN as the live hero source; use Reddit if credentials work; cache fixtures as fallback so the demo never dies offline.
