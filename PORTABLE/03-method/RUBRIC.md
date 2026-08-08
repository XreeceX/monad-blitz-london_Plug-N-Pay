# FROZEN RUBRIC — Monad Blitz London idea scoring

**Frozen 2026-08-08 at round 0. Do not edit. Any change voids all prior rounds.**

## Event ground truth (this is what the rubric encodes)

- Peer vote, not a judge panel. Every team rates every other team. Cannot vote for self.
- Audience is ~fellow developers, tired, voting 18:30–20:30 after a full build day.
- **3 minutes per pitch.** Voting during pitches + 15 min after.
- Official criteria: Novelty & Originality · Innovative Mechanics · Problem-Solving · Learning & Experimentation.
- Organisers state explicitly: "not necessarily the most polished or complete application."
- Build window 11:30–18:00 (6h30m). Code freeze 18:00, submission 18:30.
- Max 4 per team (this team is 3). Fresh code only. Must deploy to Monad testnet.
- Prizes: 1st $1200, 2nd $800, 3rd/4th $500.

## The seven dimensions — total 80

Score each 0–10, then apply weight. Novelty is double-weighted because it is the
event's first-listed criterion.

| # | Dimension | Weight | Max | What 10 looks like | What 0 looks like |
|---|---|---|---|---|---|
| D1 | **Novelty** | ×2 | 20 | No prior Monad/ETH hackathon project has this shape; inverts or sidesteps a crowded theme | A known category with a new coat of paint |
| D2 | **Legible in 3 min** | ×1 | 10 | One sentence, no setup, a tired dev gets it instantly | Needs a diagram and two minutes of preamble |
| D3 | **Room participation** | ×1 | 10 | Every attendee physically does something | The room watches a dashboard |
| D4 | **Why-Monad honesty** | ×1 | 10 | The claim is true and checkable; breaks on a slow/expensive chain | Chain-agnostic, or a TPS counter the team controls |
| D5 | **Buildable 6h30m × 3 people** | ×1 | 10 | Comfortably done by 16:00 with slack for rehearsal | Needs 3 more people or 6 more hours |
| D6 | **Demo survivability** | ×1 | 10 | Cannot die on stage; no critical-path dependency on Wi-Fi, LLM latency, or public RPC | One 429 or one lighting problem kills the pitch |
| D7 | **Problem-solving** | ×1 | 10 | Addresses a real or genuinely interesting challenge | Pure toy with no idea underneath |

**Total = D1×2 + D2 + D3 + D4 + D5 + D6 + D7, max 80.**

## Hard scoring rules

1. **Bias correction is mandatory.** An idea's score is the mean over ONLY the judges
   who did not author it. A judge scoring its own idea is recorded but excluded.
2. **Score the idea as it would actually ship**, not the idea as described. If the
   described version needs a component that cannot be built in 6h30m, D5 and D6 take
   the hit — do not score the aspirational version.
3. **Simulated ≠ built.** If the demo shows synthetic/simulated data standing in for
   the real mechanism, D4 and D7 are capped at 5.
4. **A demo that depends on 100+ audience phones sending direct transactions caps D6
   at 3.** Public Monad testnet RPCs are rate-limited; this is verified, not assumed.
5. **No credit for stretch goals.** Score the Must-Ship slice only.

## Calibration anchors — round 0 (these are the fixed reference points)

| Idea | D1×2 | D2 | D3 | D4 | D5 | D6 | D7 | **Total** |
|---|---|---|---|---|---|---|---|---|
| **Reverse Turk** (champion to beat) | 16 | 10 | 10 | 8 | 6 | 6 | 5 | **61** |
| Athena-lite | 12 | 6 | 1 | 3 | 6 | 6 | 8 | **42** |
| SimCityL1 | 8 | 8 | 2 | 9 | 3 | 5 | 4 | **39** |
| Amber Current (EV streaming) | 8 | 6 | 1 | 5 | 5 | 3 | 9 | **37** |

**Drift check, every round:** re-score Reverse Turk cold against this rubric. It must
return **61 ± 2**. If it does not, the rubric has drifted and that round is void — the
scores moved, not the ideas.

## Verified dead-on-arrival constraints (do not propose these)

- iOS Safari has no `torch` MediaTrack constraint → camera-finger heart-rate is dead.
- 167 phones each sending direct transactions → public Monad RPC rate-limits. Dead.
- A live TPS counter fed by one batching relayer → theatre, not proof. Scores D4 ≤ 3.
- DeviceMotionEvent needs HTTPS + a per-device user gesture, and iOS support is
  partial → any whole-room motion mechanic caps D6 at 4.
