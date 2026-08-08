# HARD CONSTRAINTS — verified technical facts for room-scale crypto demos

Every item below was checked against documentation or measured behaviour during research,
not assumed. Each one killed at least one otherwise-promising idea. Check any new concept
against this list before investing build time in it.

Project-agnostic. Applies to any live-audience blockchain demo, not just Monad.

---

## Dead on arrival — do not design around these

### 1. A room of phones cannot each send their own transaction

Public testnet RPC endpoints are rate-limited. A design where ~150+ attendees each submit
a transaction from their own device will hit HTTP 429 and stall, usually at the worst
moment. No amount of retry logic fixes a rate limit.

**Workarounds that do work:**
- Phones **sign** messages off-chain (EIP-191 / EIP-712) for free, and one authoritative
  signer batches them on-chain. Disclose this honestly — a technical audience will spot a
  claim of per-user transactions and hold it against you.
- A small fixed number of pre-funded signers (e.g. 12–16 "zone" wallets on one wired
  laptop) rather than one per person.
- Phones read state but never write it.

### 2. A live TPS counter fed by your own relayer is theatre

If one process is batching and submitting, the throughput number on screen measures your
batching loop, not the chain. A developer audience reads this as dishonest, and it damages
the pitch more than having no counter at all. Show something you don't control instead:
individual transaction hashes, block numbers, a verified contract link.

### 3. iOS Safari has no `torch` MediaTrack constraint

Any mechanic that programmatically controls the phone flashlight fails on roughly half the
room. Camera-based heart-rate detection (finger over lens + torch) is dead on iOS for this
reason. Asking people to turn their torch on **manually** is fine — that's a human action,
not an API call.

### 4. `DeviceMotionEvent` needs HTTPS plus a per-device user gesture

`DeviceMotionEvent.requestPermission()` must be triggered by a user gesture, over HTTPS,
and iOS support is partial. Any whole-room motion mechanic (shake, jump, wave detected by
the phone itself) loses a meaningful fraction of participants to a permission prompt they
never complete. Stage-camera motion detection avoids this entirely.

### 5. Loops over unbounded arrays revert

A contract function that iterates a roster which any user can grow is a denial-of-service
target. If joining is permissionless and free, someone can inflate the array until the
function exceeds the block gas limit. If that function is once-only — a settlement or
close-out — the revert is permanent and unrecoverable, live, in front of the room.

Bound the array with a constant, paginate the loop, or make the operation pull-based.

---

## Costly but survivable — design for these

### 6. Ephemeral browser wallets have no sybil resistance

`localStorage` keypairs generated client-side with a QR join and no gate mean one person
with `curl` can create arbitrarily many identities. This is acceptable for a two-minute
demo where the window is short and supervised. It is **not** acceptable for an all-day
mechanic involving a treasury: the attack window scales with the exposure time.

If the design pays out and the roster is open for hours, you need at minimum a cap on
total participants, a cap on payout per address, and a bounded settlement function.

### 7. Venue Wi-Fi is the most common cause of a dead demo

At a full hackathon every team demos simultaneously. Assume congestion.
- Keep the presenter's laptop tethered, not on venue Wi-Fi.
- Anything on the critical path renders from local authoritative state, with chain
  confirmations attaching asynchronously. A slow RPC should delay a badge, never the show.
- Load-test against real phones on the real network, not against localhost.

### 8. Camera-based stage oracles are lighting-dependent

Blink detection, brightness zoning and motion energy all work in rehearsal and fail under
stage wash, house lights, or a changed camera angle. If you use one:
- Fix exposure manually; don't let auto-exposure hunt.
- Use large zones and generous thresholds.
- Put a visible confidence meter on screen so a failure reads as honest rather than broken.
- Give the host a manual override that still settles on-chain.

### 9. LLM grading on the critical path will stall

Any design where a model must score N submissions before the demo can proceed carries a
latency dependency you do not control. Prefer mechanics where validity is binary and
computable — a tap is valid or it isn't. If you must grade, stream results as they arrive
and hard-timeout to a default outcome.

---

## Verified capability — these do work

- **MediaPipe Face Landmarker** exposes `eyeBlinkLeft` / `eyeBlinkRight` blendshapes.
  Blink detection as an oracle is genuinely feasible, subject to constraint 8.
- **`getUserMedia` camera access** works for stage-camera oracles across browsers.
- **Off-chain signatures** (EIP-191, EIP-712) cost nothing, need no gas, need no funded
  wallet, and verify on-chain later via `ecrecover`. This is the single most useful
  primitive for room-scale participation.
- **`ecrecover` is cheap enough to batch.** Roughly 3k gas each; ~150 recoveries plus
  ~10KB of calldata lands near 1.5M gas. Against a 150M-gas block that is under 1%.
  Batched signature verification is an operational risk, not a gas or latency one.

---

## The general lesson

Most room-scale demo ideas fail on one of three things: **the network** (RPC limits, venue
Wi-Fi), **the permission model** (iOS gestures, HTTPS, torch), or **an unbounded input**
(sybil rosters, gas-limited loops). Test a new idea against those three before anything
else. Novelty is worth nothing if the mechanism cannot run in the room.
