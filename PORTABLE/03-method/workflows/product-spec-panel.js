export const meta = {
  name: 'rt-product-spec',
  description: 'Reverse Turk v3 full product spec + design: 5 coordinated rounds (Cursor Auto, Grok 4.5, Fable 5, Ollama breadth), then SPEC/DESIGN/PREFLIGHT/BUILD',
  phases: [
    { title: 'R1 Diverge' }, { title: 'R2 Critique' }, { title: 'R3 Requirements' },
    { title: 'R4 Sell+Gaps' }, { title: 'R5 Settle' },
    { title: 'Specialists' }, { title: 'Assemble' }, { title: 'Verify' },
  ],
}

const BASE = '/Users/supavichaussawaauschariyakul/dev/monadbliz-hackathon'
const T = `${BASE}/tournament`
const OUT = `${T}/spec`

const CTX = `You are on the product-spec panel for Reverse Turk v3, a Monad Blitz London hackathon project.

READ THESE FIRST with the Read tool. They are the anchor:
- ${T}/BRIEF.md                  -- THE ASK, verbatim, as checklist C1-C13. This is law.
- ${T}/rounds/r2-RT-v3.md        -- the champion spec you are specifying
- ${T}/RUBRIC.md                 -- scoring rubric + event ground truth
- ${T}/rounds/r4-redteam.md      -- the kill-list incl. the UNRESOLVED sybil finding

Hard rules from BRIEF.md section 5: no TBDs (decide or escalate as a forced decision);
numbers not adjectives; score what ships in 6h30m with 3 people; every surface needs a
failure state; disagree explicitly rather than averaging.

The user's central insight, which organises everything: "a main function without good
surrounding additional functionality and dashboard and stuff will never win."`

const CLI_AUTO = `timeout 900 cursor-agent --print --output-format text --mode ask --trust --model auto`
const CLI_GROK = `timeout 900 cursor-agent --print --output-format text --mode ask --trust --model cursor-grok-4.5-high`

const POS_SCHEMA = {
  type: 'object', required: ['positions', 'disagreements', 'arm_status'],
  properties: {
    arm_status: { type: 'string' },
    positions: { type: 'array', items: { type: 'object', required: ['topic', 'position', 'reason'],
      properties: { topic: { type: 'string' }, position: { type: 'string' }, reason: { type: 'string' } } } },
    disagreements: { type: 'array', items: { type: 'string' } },
  },
}

const RECON_SCHEMA = {
  type: 'object', required: ['decisions', 'open_contradictions', 'checklist_gaps', 'next_round_agenda'],
  properties: {
    decisions: { type: 'array', items: { type: 'object', required: ['topic', 'decided', 'why', 'dissent'],
      properties: { topic: { type: 'string' }, decided: { type: 'string' }, why: { type: 'string' }, dissent: { type: 'string' } } } },
    open_contradictions: { type: 'array', items: { type: 'string' } },
    checklist_gaps: { type: 'array', items: { type: 'string' } },
    next_round_agenda: { type: 'string' },
  },
}

const ROUNDS = [
  { n: 1, phase: 'R1 Diverge', title: 'WHO AND WHAT',
    ask: `Settle two things, independently, before anyone else influences you.

(A) WHO IS THIS FOR. Checklist C3 and C4. There are several candidate humans in play: the
in-room developer who is simultaneously worker, voter and judge; the team of 3 building it;
the agent's operator; and whoever might buy this after the event. Name the ONE primary user
and defend the choice. A list is a failure. Then name the secondary personas and say
explicitly what each one needs that the primary does not.

(B) WHAT SURFACES MUST EXIST. Checklist C8. The core payroll mechanic alone loses. Enumerate
every surface the product needs, what each is FOR, and rank them by how much each one moves
a peer vote from 4 to 5. Be concrete about what is on screen. Argue for anything the brief's
list of six is missing, and argue against anything on it that does not earn its place.` },

  { n: 2, phase: 'R2 Critique', title: 'CROSS-ATTACK',
    ask: `You now see what the other panellists said in round 1. You have NOT seen their critiques
of you, and they have not seen yours. Do not soften.

Attack the other positions specifically: where is the primary-user choice wrong, which
surfaces are vanity, which are missing, which will not survive 6h30m of build time. Then
defend or abandon your own round-1 position, and say which it is. Abandoning a position you
now think is wrong is worth more than defending it.

Also: the sybil hole in the all-day payroll is still unresolved. Whoever has the cheapest
correct fix, state it with the actual Solidity shape and the gas argument.` },

  { n: 3, phase: 'R3 Requirements', title: 'REQUIREMENTS',
    ask: `Build the requirements on the settled base. Checklist C1, C2, C5, C6, C7.

(A) FUNCTIONAL REQUIREMENTS. Numbered FR-1..n. Each testable, each traceable to a user story.
Cover every surface, not just payroll.
(B) NON-FUNCTIONAL REQUIREMENTS. Numbered NFR-1..n, with NUMBERS: latency budgets, concurrent
worker capacity, RPC call ceilings, failure/degradation behaviour, security (sybil, replay,
key handling), accessibility (this is read on phones in a dim room and on a projector from
15 metres), and what happens on venue Wi-Fi congestion.
(C) USER STORIES. "As a <persona>, I want <x>, so that <y>", each with acceptance criteria.
(D) USER JOURNEY. Timestamped against the real day: 11:30 build start through 13:00 roster
open, 18:00 freeze, the 3-minute pitch, and the 15-minute post-pitch voting window.
(E) USE CASES. Actor, precondition, main flow, alternate flows, failure flows.` },

  { n: 4, phase: 'R4 Sell+Gaps', title: 'SELL AND GAPS',
    ask: `(A) THE SELL STORY. Checklist C10. The user said: "an actual story is where this sells."
Write the narrative. Name a SPECIFIC buyer who would pay for this after the hackathon and say
why -- human preference data is the obvious thread (this is literally what RLHF pays for, with
provenance and on-chain payment receipts attached), but argue for the best buyer, do not just
accept the obvious one. Include the objection bank: what a sceptic says, and the answer.

(B) PROOF. Checklist C11. For every claim the pitch makes, what makes it checkable by a
sceptical developer in the room, in under 30 seconds, on their own phone.

(C) WHAT IS MISSING. Checklist C12. Sweep the whole thing against BRIEF.md section 2 and name
what nobody has specified yet. Be greedy here -- this is the round where omissions get caught.` },

  { n: 5, phase: 'R5 Settle', title: 'SETTLE',
    ask: `Final round. Every open contradiction from rounds 1-4 must die here.

For each one: state it, state the resolution, state the reason, and state who was overruled.
Do not average. Do not defer. If two positions are genuinely both viable, pick one on the
grounds of what a team of 3 can finish by 16:00 and say that is why.

Then: read the whole settled picture back and answer one question honestly. Does this hang
together as ONE product, or is it a core mechanic with accessories bolted on? If the latter,
say what the unifying idea actually is. The user asked for "a few that work together" -- the
surfaces must compose, not merely coexist.` },
]

const OLLAMA_LENSES = [
  { arm: 'glm-5.2:cloud', lens: 'the security and failure-mode lens: what breaks, what gets abused, what has no failure state' },
  { arm: 'deepseek-v4-pro:cloud', lens: 'the systems and data lens: architecture, data model, what state lives where, what the API surface is' },
  { arm: 'qwen3.5:397b-cloud', lens: 'the product and user lens: personas, journeys, what a real person actually experiences minute to minute' },
  { arm: 'gpt-oss:120b-cloud', lens: 'the visual and dashboard lens: what is on the projector, what the phone shows, what reads from 15 metres' },
]

function seatPrompt(round, priorText, who, cli) {
  const external = !!cli
  return `${CTX}

=== ROUND ${round.n}: ${round.title} ===

${priorText}

${round.ask}

${external
  ? `You are the driver for seat "${who}". Do NOT answer yourself. Run the model via Bash:

  ${cli} "<your full prompt>"

Your prompt must be self-contained -- the model cannot read files. Paste into it: the checklist
C1-C13 from BRIEF.md, the relevant parts of the RT-v3 spec, the round question above, and the
prior-round material. Then transcribe its answer faithfully into the schema.

If the CLI fails, set arm_status to "ARM-FAILED: <exact error>" and return empty arrays.
Never substitute your own opinion for the arm's. Never fabricate.`
  : `You are seat "${who}", answering directly. You authored Reverse Turk, so you are the most
likely to defend it out of habit -- do the opposite. Set arm_status to "ok".`}`
}

async function runRound(round, priorText) {
  const tasks = [
    () => agent(`${CTX}

=== ROUND ${round.n} BREADTH SWEEP ===

${priorText}

${round.ask}

You drive FOUR free Ollama Cloud arms, at most TWO concurrently. For each, pipe the prompt via
stdin and give it room:

  cat <<'PROMPT' | timeout 600 ollama run <ARM>
  <prompt>
  PROMPT

Arms and their distinct lenses:
${OLLAMA_LENSES.map(l => `- ${l.arm}\n    LENS: ${l.lens}`).join('\n')}

Each prompt must be self-contained (these models read no files): paste the checklist C1-C13,
the RT-v3 essentials, the round question, the prior-round material, and that arm's lens.

Collect everything. Write raw output to ${OUT}/r${round.n}-breadth-raw.md. Return the distinct
positions the paid seats are LIKELY TO MISS -- your value is coverage, not consensus. If an arm
fails, note it and continue.`,
      { label: `breadth r${round.n}`, phase: round.phase, model: 'sonnet', effort: 'medium', schema: POS_SCHEMA }),

    () => agent(seatPrompt(round, priorText, 'Cursor Auto', CLI_AUTO),
      { label: `seat:auto r${round.n}`, phase: round.phase, model: 'sonnet', effort: 'medium', schema: POS_SCHEMA }),

    () => agent(seatPrompt(round, priorText, 'Grok 4.5', CLI_GROK),
      { label: `seat:grok r${round.n}`, phase: round.phase, model: 'sonnet', effort: 'medium', schema: POS_SCHEMA }),

    () => agent(seatPrompt(round, priorText, 'Fable 5', null),
      { label: `seat:fable r${round.n}`, phase: round.phase, model: 'fable', effort: 'high', schema: POS_SCHEMA }),
  ]

  let results = (await parallel(tasks)).filter(Boolean)
  const failed = results.filter(r => r && r.arm_status && r.arm_status.startsWith('ARM-FAILED'))

  // ---- REPAIR LOOP: user's standing instruction ----
  if (failed.length) {
    log(`R${round.n}: ${failed.length} arm(s) failed -- convening repair loop`)
    const repair = await agent(`${CTX}

REPAIR LOOP -- round ${round.n}. Standing instruction from the user: when anything fails,
Fable 5 and Cursor Auto work with the orchestrator to communicate, cooperate, coordinate and
reboot until solved. Any skill or tool is permitted.

Failures this round:
${failed.map(f => '- ' + f.arm_status).join('\n')}

Up to THREE attempts, in this order, stopping at the first success:
1. Diagnose the exact cause. If it is a model usage limit, try a sibling model on the same
   CLI (cursor-grok-4.5-medium, composer-2.5, gpt-5.3-codex-high). If it is a timeout, cut the
   prompt down and retry with a shorter one.
2. If the CLI is unusable, route the SAME question to a free Ollama Cloud arm
   (qwen3.5:397b-cloud is the strongest reasoner available) and label the source honestly.
3. If both fail, answer the round question yourself at high effort and label it clearly as
   orchestrator-substituted, not as the failed seat's output.

Round question being repaired:
${round.ask}

${priorText}

Return the recovered positions. arm_status MUST state exactly which route succeeded and on
which attempt. Never present substituted output as the original seat's.`,
      { label: `repair r${round.n}`, phase: round.phase, model: 'fable', effort: 'high', schema: POS_SCHEMA })
    if (repair) { results.push(repair); log(`R${round.n} repair: ${repair.arm_status}`) }
  }

  const recon = await agent(`${CTX}

=== ROUND ${round.n} RECONCILIATION: ${round.title} ===

Four sources answered this round (breadth sweep, Cursor Auto, Grok 4.5, Fable 5${failed.length ? ', plus a repair pass' : ''}):

${JSON.stringify(results, null, 1)}

Your job:
1. DECIDE every topic. Not summarise -- decide. Each decision needs a reason and, where a
   panellist was overruled, the dissent recorded. Convergence between independent seats is a
   signal worth naming.
2. Name every contradiction that is still open, for the next round to kill.
3. Run the COMPLETENESS CRITIC before you finish. Use Bash to get an independent free check:

     cat <<'PROMPT' | timeout 600 ollama run qwen3.5:397b-cloud
     <paste checklist C1-C13 from BRIEF.md verbatim, then paste your decisions, then ask:>
     Which checklist items are still unaddressed or only shallowly addressed? Be specific
     and harsh. List item IDs.
     PROMPT

   Put whatever it flags into checklist_gaps. Do not filter its findings to protect your work.
4. Write the full reconciliation to ${OUT}/r${round.n}-reconciled.md.
5. Set next_round_agenda: the single most important thing the next round must resolve.`,
    { label: `reconcile r${round.n}`, phase: round.phase, model: 'sonnet', effort: 'high', schema: RECON_SCHEMA })

  log(`R${round.n}: ${(recon && recon.decisions || []).length} decisions, ${(recon && recon.open_contradictions || []).length} open, ${(recon && recon.checklist_gaps || []).length} gaps`)
  return recon
}

// ================= ROUNDS =================
const recons = []
let prior = 'This is round 1. No prior material -- form your own view first.'
for (const round of ROUNDS) {
  const r = await runRound(round, prior)
  recons.push({ round: round.n, title: round.title, ...(r || {}) })
  prior = `=== SETTLED SO FAR (rounds 1-${round.n}) ===
Decisions:
${(r && r.decisions || []).map(d => `- [${d.topic}] ${d.decided}  (why: ${d.why}${d.dissent ? '; dissent: ' + d.dissent : ''})`).join('\n')}

STILL OPEN -- your round must help kill these:
${(r && r.open_contradictions || []).map(c => '- ' + c).join('\n') || '- (none)'}

CHECKLIST GAPS flagged by the independent critic:
${(r && r.checklist_gaps || []).map(g => '- ' + g).join('\n') || '- (none)'}

AGENDA FOR THIS ROUND: ${(r && r.next_round_agenda) || 'continue'}`
}

const SETTLED = `=== FULLY SETTLED PANEL OUTPUT (5 rounds) ===
${recons.map(r => `--- Round ${r.round}: ${r.title} ---
${(r.decisions || []).map(d => `* [${d.topic}] ${d.decided}\n    why: ${d.why}${d.dissent ? `\n    dissent: ${d.dissent}` : ''}`).join('\n')}
${(r.open_contradictions || []).length ? 'left open: ' + r.open_contradictions.join('; ') : ''}`).join('\n\n')}`

// ================= SPECIALISTS =================
phase('Specialists')
const specs = await parallel([
  () => agent(`${CTX}\n\n${SETTLED}\n\nYou own PERSONAS AND USERS (checklist C3-C7). Invoke the product-lens skill.

Produce, at publication quality:
- The ONE primary user, named, with a defence of why them and not the alternatives the panel considered.
- Secondary personas, each with what they need that the primary does not.
- Full user stories per persona, "As a X I want Y so that Z", each with acceptance criteria.
- The user journey, timestamped against the real day: 11:30 / 13:00 roster opens / afternoon
  / 18:00 freeze / the 3-minute pitch / the 15-minute voting window after.
- Use cases: actor, precondition, main flow, alternate flows, failure flows.

Write to ${OUT}/part-users.md. Return a 5-line summary only.`,
    { label: 'spec:users', phase: 'Specialists', model: 'sonnet', effort: 'high' }),

  () => agent(`${CTX}\n\n${SETTLED}\n\nYou own ARCHITECTURE AND DATA (checklist C1, C2, C8). Invoke the system-design skill.

Produce: component architecture, the data model (every entity, every field, types), state
ownership (what lives on-chain vs in the agent's memory vs localStorage vs disk), the full API
surface, the Payroll.sol interface at function-signature level, the sybil fix with its gas
argument, and the sequence for the critical path from tap to visible balance.

Numbers not adjectives. Include the NFR table with real latency and capacity budgets.
Write to ${OUT}/part-architecture.md. Return a 5-line summary only.`,
    { label: 'spec:arch', phase: 'Specialists', model: 'sonnet', effort: 'high' }),

  () => agent(`${CTX}\n\n${SETTLED}\n\nYou own THE SURFACES (checklist C8, C9) -- the user's central insight, and the highest-value
document here. Invoke the dataviz, ui-ux-pro-max and design-taste-frontend skills.

For EACH of the six surfaces (worker phone, projector dashboard, verification page, agent
console, reveal screen, post-event artifact): purpose, who looks at it and from how far, every
state including empty/loading/error/degraded, the exact information hierarchy, and a concrete
visual direction (type scale, colour roles, density) that does not look AI-generated.

The projector dashboard gets the most detail. It must read from 15 metres in a dim room.
Specify what is on it and defend every element -- anything that does not move a vote comes off.
Write to ${OUT}/part-surfaces.md. Return a 5-line summary only.`,
    { label: 'spec:surfaces', phase: 'Specialists', model: 'sonnet', effort: 'high' }),

  () => agent(`${CTX}\n\n${SETTLED}\n\nYou own DASHBOARD METRIC DESIGN. Invoke north-star-metric-design and dataviz.

The question is not "what can we display" but "which numbers make a tired developer vote 5".
Define the one north-star number for the projector, its supporting metrics, why each is
honest and checkable, and which tempting numbers are vanity and must NOT be shown (a TPS
counter we control is theatre and the room will catch it). Specify chart forms and update
cadence. Write to ${OUT}/part-metrics.md. Return a 5-line summary only.`,
    { label: 'spec:metrics', phase: 'Specialists', model: 'sonnet', effort: 'high' }),

  () => agent(`${CTX}\n\n${SETTLED}\n\nYou own THE SELL STORY (checklist C10, C11). Invoke pitch-script and humanizer.

Write the narrative that sells this. Name the specific buyer and why they pay. Write the
3-minute pitch beat by beat with timings. Write the objection bank: what the sceptic says,
what the answer is, and what makes the answer checkable in under 30 seconds on their own phone.
Prose must not read as machine-generated -- run the humanizer checks.
Write to ${OUT}/part-story.md. Return a 5-line summary only.`,
    { label: 'spec:story', phase: 'Specialists', model: 'fable', effort: 'high' }),

  () => agent(`${CTX}\n\n${SETTLED}\n\nYou own DEMO HARDENING. Invoke demo-polish and hackathon-playbook.

The golden path is join -> task -> pay -> visible balance -> reveal, inside 3 minutes on venue
Wi-Fi. Specify: what is on the golden path and what gets safely stubbed, seed data, the named
wow moment, every loading/empty/error state on the path, the fallback video plan, and the
rehearsal schedule. Then the failure playbook: for each way it can die on stage, the trigger,
the tell, and the recovery the presenter performs live.
Write to ${OUT}/part-demo.md. Return a 5-line summary only.`,
    { label: 'spec:demo', phase: 'Specialists', model: 'sonnet', effort: 'high' }),
])
log(`Specialists done: ${specs.filter(Boolean).length}/6`)

// ================= ASSEMBLE =================
phase('Assemble')
const assembled = await parallel([
  () => agent(`${CTX}\n\n${SETTLED}\n\nAssemble SPEC.md. Invoke the gstack-spec skill.

Read every ${OUT}/part-*.md and merge into ONE document in ONE voice, no seams, no repetition.
Must contain, clearly sectioned: primary user and audience (C3, C4); personas; user stories
with acceptance criteria (C5); the timestamped user journey (C6); use cases with failure flows
(C7); numbered functional requirements traceable to stories (C1); numbered non-functional
requirements with real numbers (C2); the sell story with its named buyer (C10); and the proof
table (C11).

Every requirement gets an ID. No TBDs -- decide, or list it under Forced Decisions.
Write to ${BASE}/SPEC.md. Return a 6-line summary.`,
    { label: 'assemble:SPEC', phase: 'Assemble', model: 'sonnet', effort: 'high' }),

  () => agent(`${CTX}\n\n${SETTLED}\n\nAssemble DESIGN.md. Invoke system-design and artifact-diagramming.

Read every ${OUT}/part-*.md and merge into ONE design document: architecture with a diagram
(mermaid), data model, state ownership, API surface, Payroll.sol interface, the sybil fix,
then ALL SIX SURFACES in full with states, failure behaviour and visual direction, then the
dashboard metric design, then the demo hardening plan.

This document carries checklist C8 and C9, which the user identified as the difference between
winning and losing. Give the surfaces more room than the core mechanic.
Write to ${BASE}/DESIGN.md. Return a 6-line summary.`,
    { label: 'assemble:DESIGN', phase: 'Assemble', model: 'sonnet', effort: 'high' }),
])

// ================= BUILD-READY =================
const buildready = await parallel([
  () => agent(`${CTX}\n\nRead ${BASE}/SPEC.md and ${BASE}/DESIGN.md.

Invoke the build-preflight skill and run it properly against this project. Produce PREFLIGHT.md
with all 8 invariant classes plus the forced-decision list that the NEXT /dispatch answers at
its plan gate. Every unresolved choice becomes an explicit forced decision with the options and
a recommendation -- never a blank.
Write to ${BASE}/PREFLIGHT.md. Return the forced-decision list only.`,
    { label: 'PREFLIGHT', phase: 'Assemble', model: 'sonnet', effort: 'high' }),

  () => agent(`${CTX}\n\nRead ${BASE}/SPEC.md and ${BASE}/DESIGN.md.

Invoke writing-plans and tdd-workflow. Produce BUILD.md so a LATER /dispatch can build this
with cold worker agents and nothing else.

Must contain: the atomic task DAG (each task single-capability, with explicit inputs, outputs
and dependencies, sized so one agent finishes it); the exact tech stack with versions, no
choices left open; repo and file layout; Payroll.sol interface; per-task acceptance tests that
a worker runs itself; the hour-by-hour timeline 11:30-18:00 mapped onto the DAG with the 16:00
contract freeze; env and RPC configuration requirements; and definition-of-done per surface.

A cold agent must never have to guess. Write to ${BASE}/BUILD.md. Return the task DAG summary.`,
    { label: 'BUILD', phase: 'Assemble', model: 'sonnet', effort: 'high' }),
])

// ================= VERIFY =================
phase('Verify')
const audit = await agent(`${CTX}

Read ALL FOUR: ${BASE}/SPEC.md, ${BASE}/DESIGN.md, ${BASE}/PREFLIGHT.md, ${BASE}/BUILD.md.

You are the final gate. Two jobs, both adversarial.

1. NO-TBD AUDIT. Grep for TBD, TODO, "to be decided", "we could", "either/or", "depends",
   and any requirement without a number where one is needed. Every hit is a defect -- an
   unresolved decision is what makes an agent build fail. List them with file and line.

2. COMPLETENESS vs the user's literal ask. Open ${T}/BRIEF.md section 2 and score C1 through
   C13 individually: ADDRESSED (with where) / SHALLOW / MISSING. Be harsh. The user asked for
   this to be complete and to be buildable by a later dispatch from these documents alone.
   Test that claim: could a cold agent build it? What would it have to guess?

Also get an independent second opinion via Bash, and report what it says even if it
contradicts you:
  ${CLI_AUTO} "<paste the checklist and your findings; ask what is still missing>"

Write the full audit to ${OUT}/AUDIT.md. Return: the per-item C1-C13 verdicts, the TBD list,
and a single overall verdict of PASS or the specific work still required.`,
  { label: 'no-TBD + completeness audit', phase: 'Verify', model: 'fable', effort: 'high' })

return {
  rounds: recons,
  specialists: specs.filter(Boolean).length,
  assembled: assembled.filter(Boolean),
  buildready: buildready.filter(Boolean),
  audit,
  files: [`${BASE}/SPEC.md`, `${BASE}/DESIGN.md`, `${BASE}/PREFLIGHT.md`, `${BASE}/BUILD.md`, `${OUT}/AUDIT.md`],
}
