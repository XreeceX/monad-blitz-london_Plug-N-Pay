# Open Questions

Decisions still pending before scope/spec docs can be finalized. Each entry: the question, why it matters, the options on the table, and any recommendation surfaced so far (from the 7-pass Gemini refinement in `docs/idea/` scratch history — not yet a team decision).

Status legend: 🔴 blocking (architecture depends on the answer) · 🟡 shapes scope but has a safe default.

---

## 1. Do we have a dedicated/premium Monad testnet RPC endpoint for the day? 🔴

**Why it matters:** The demo's core proof point is concurrent, real-time, per-second on-chain settlement across many simultaneous sessions (see `idea.md` §11b). A standard public testnet RPC endpoint is likely to rate-limit (HTTP 429) once simulated traffic reaches double digits of transactions per second. If the RPC chokes mid-demo, the dashboard freezes on stage — the single worst failure mode identified across the refinement passes.

**Options:**
- Source a dedicated/premium Monad testnet RPC endpoint ahead of the event (via Monad team contacts, blitz_resources, or a paid provider) — removes the risk outright if obtainable in time.
- Run our own lightweight RPC/relay in front of a public endpoint with request batching/caching — more engineering, not guaranteed to help if the bottleneck is the underlying node itself.
- Accept the public RPC and design around its limits (see Question 2) rather than trying to out-provision it.

**Status:** Unresolved, but narrowed — a pass through the official Blitz resources page and Monad's docs (see [`docs/monad_dev_resources.md`](../monad_dev_resources.md)) found **no evidence of a hackathon-specific dedicated/premium RPC offer anywhere**, and no Discord/support channel to ask in. Recommend treating "public RPC only" as the working assumption unless this is confirmed otherwise by Monad staff in person at the venue, and registering a free-tier fallback key (Alchemy or QuickNode both support Monad testnet) ahead of time as cheap insurance either way.

---

## 2. Primary settlement design: literal per-session L1 calls at N concurrency, or multicall/batched settlement as the *primary* architecture (not a fallback)? 🔴

**Why it matters:** This is a architecture-defining choice, not a tweak — it affects the contract's function signatures, the event schema the dashboard consumes, and the simulator's transaction-submission pattern. Deciding it under time pressure mid-hackathon (i.e., discovering the public RPC can't keep up and scrambling to retrofit batching) is exactly the failure mode flagged as highest-risk in the refinement passes. Answering Question 1 first materially changes the right answer here: with a premium RPC, literal per-tick-per-session L1 calls are viable and are the more literal, more legible proof of "brute L1 throughput, only possible on Monad." Without one, a `TickBatcher`-style multicall (many sessions' ticks aggregated into one transaction per block) is very likely necessary to survive the demo, while still proving materially the same point (many state updates settled per second) if framed correctly.

**Options:**
- **Primary = literal per-tick per-session calls.** Simplest mental model, most direct "1Hz L1 spam, no tricks" narrative. Viable only with sufficient RPC headroom (→ depends on Q1).
- **Primary = multicall/batch aggregation.** One aggregator transaction per tick-interval bundling all active sessions' deltas. More resilient to RPC limits at higher concurrency, slightly more contract/simulator complexity, still demonstrates high-frequency multi-session settlement, arguably closer to how a real high-throughput implementation would actually behave.
- **Hybrid:** build literal-per-tick first (simplest, gets a working end-to-end demo fastest), keep multicall as a documented fallback path only invoked if RPC problems appear during testing — this was the original Pass 2/6 suggestion, but Pass 7 pushed back on treating it as an afterthought given how central concurrency now is to the demo.

**Status:** Unresolved — recommend deciding this *before* any contract code is written, since it's expensive to change direction mid-build. Directly gated on Question 1's answer.

---

## 3. What is the actual target concurrency number for the demo — 10, 50, or something else? 🟡

**Why it matters:** "10–50 concurrent sessions" was floated as a range, not a committed number (`idea.md` §11b). The exact target affects: how much RPC headroom is needed (feeds Question 1/2), how much stress-testing time is needed before the live demo, and how ambitious the dashboard's visual design needs to be (a node-graph with 10 nodes vs. 50 nodes reads very differently on a projector). Committing to a specific number lets the concurrency spawner, RPC/batching decision, and dashboard layout all be built against one fixed target instead of a moving one.

**Options:**
- **~10 concurrent sessions:** Safer, still visually reads as "clearly not one transaction," easier to keep reliable under public RPC constraints, less impressive as a raw scale claim.
- **~50 concurrent sessions:** Stronger "wow" and scale claim, meaningfully raises the bar on Questions 1 and 2, more can go wrong live on stage.
- **Tiered/adjustable target:** Build the spawner parameterized (`spinUpNetwork(N)`), rehearse at a conservative number for the live demo, but be able to show a higher number was tested/possible (e.g., in a backup recording) — hedges the risk without giving up the scale claim entirely.

**Status:** Unresolved — recommend picking a number (or the tiered approach) at the same time as Questions 1 and 2, since all three are coupled.
