# Open Questions — Reverse Turk

Status legend: 🔴 blocking · 🟡 shapes scope · 🟢 has a safe default

---

## 1. How do worker votes get onto the chain without worker gas? 🔴

**Options:** backend relayer signs/`submitVote` · EIP-712 vote digests verified in `payBatch` only (votes off-chain, payments on-chain) · account-abstraction sponsored UserOps

**Recommendation for Blitz:** Keep **votes off-chain** (server collects choices), settle truth on-chain via `payBatch` + events. Simplest, fastest, still “real MON to real addresses.” Mention full on-chain vote attestations as the production path.

---

## 2. One `payBatch` vs many transfers? 🟢

**Recommendation:** One contract call that loops transfers / uses a pull pattern — matches the “one payroll tick” theater and reduces RPC pain.

---

## 3. Throwaway wallet UX — ethers/viem in browser? 🟢

**Recommendation:** Generate key in page, persist encrypted or plaintext in localStorage for demo (plaintext OK for throwaway hackathon wallets with tiny balances). Never ask for seed backup.

---

## 4. What if Wi-Fi / QR join is slow? 🔴

**Mitigations:** Pre-open URL on team phones; short link backup; start Task 1 only when N≥threshold or after fixed 15s; rehearse with 30+ devices.

---

## 5. Vote-buying optics? 🟡

**Recommendation:** Say it out loud: “Yes, we’re paying the people who rate us — that’s the product, not a bribe. Rate us on whether the idea is good.” Humor disarms it.

---

## 6. Logo generation on the critical path? 🟢

**Recommendation:** **Never.** Pre-bake 4–6 variants before the pitch. Agent only selects/pays.

---

## 7. Primary build vs SimCityL1 / Athena / Amber Current? 🔴

**Status for team decision:** Reverse Turk maximizes room participation for community voting; SimCityL1 maximizes visual Monad flex with lower live-coordination risk. Pick one primary; don’t split the day.
