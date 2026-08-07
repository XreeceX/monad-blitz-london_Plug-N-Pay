# Open Questions — SimCityL1

Status legend: 🔴 blocking · 🟡 shapes scope · 🟢 has a safe default

---

## 1. Rule-based agents first, or LLM agents from minute one? 🟡

**Why it matters:** LLMs make the pitch sexier; rule-based agents make the demo reliable under time pressure.

**Recommendation:** Ship rule-based drives (worker / buyer / migrator) as the primary path. Add 1–3 LLM agents as a stretch for gossip / mayor debate color.

---

## 2. How much state is on-chain vs indexed off-chain? 🔴

**Why it matters:** Full grid + inventories for 100 agents every tick can blow gas and RPC limits.

**Recommendation:** On-chain for authoritative balances, locations, prices, tax. Off-chain indexer for map rendering and gossip. Commit periodic world hash if you want a verifiability flex.

---

## 3. Public Monad RPC headroom for agent spam? 🔴

**Why it matters:** Same risk as the EV idea — demo dies if RPC 429s.

**Recommendation:** Cap agents (30–50) for live demo; batch non-critical updates if needed; pre-fund wallets; consider Alchemy/QuickNode free tier as backup. Document TPS claims honestly (observed demo TPS, not theoretical max).

---

## 4. Market design: fixed prices, bonding curve, or tiny AMM? 🟡

**Recommendation:** Start with admin-set prices + inventory stocks that shock events mutate. Upgrade to a minimal constant-product pool only if time remains.

---

## 5. Do we keep this as the primary build, or an alternative to Amber Current (EV streaming)? 🔴

**Why it matters:** Team focus.

**Status:** Unresolved. This folder exists so SimCityL1 is fully written up either way.
