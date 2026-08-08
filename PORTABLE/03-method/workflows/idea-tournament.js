export const meta = {
  name: 'rt-tournament',
  description: 'Beat Reverse Turk (61/80): free-model idea generation + 3-model champion improvement, bias-corrected scoring, loop until saturated',
  phases: [
    { title: 'Generate' },
    { title: 'Screen' },
    { title: 'Improve' },
    { title: 'Judge' },
    { title: 'RedTeam' },
  ],
}

const DIR = '/Users/supavichaussawaauschariyakul/dev/monadbliz-hackathon/tournament'
const SPEC = '/Users/supavichaussawaauschariyakul/dev/monadbliz-hackathon/SPEC-reverse-turk.md'

const CTX = `You are competing in an idea tournament for Monad Blitz London (Sat 8 Aug 2026).

READ THESE FILES FIRST (use the Read tool):
- ${DIR}/RUBRIC.md    -- the FROZEN 7-dimension /80 scoring rubric. It is law. Do not reinterpret it.
- ${DIR}/SEEN.md      -- ideas already invented. Re-proposing any of them scores 0.
- ${SPEC}             -- the reigning champion, "Reverse Turk", scoring 61/80.

Event reality: peer vote by ~167 tired developers, 3-minute pitches, voting 18:30-20:30.
Build window 11:30-18:00 (6h30m), team of 3. Must deploy to Monad testnet. Fresh code only.`

const IDEA_SCHEMA = {
  type: 'object',
  required: ['ideas'],
  properties: {
    ideas: {
      type: 'array', maxItems: 8,
      items: {
        type: 'object',
        required: ['name', 'one_liner', 'mechanic', 'why_monad', 'room_participation', 'build_6h30', 'biggest_risk', 'not_a_duplicate_because', 'self_score'],
        properties: {
          name: { type: 'string' },
          one_liner: { type: 'string' },
          mechanic: { type: 'string' },
          why_monad: { type: 'string' },
          room_participation: { type: 'string' },
          build_6h30: { type: 'string' },
          biggest_risk: { type: 'string' },
          not_a_duplicate_because: { type: 'string' },
          self_score: { type: 'number' },
        },
      },
    },
  },
}

const SCREEN_SCHEMA = {
  type: 'object',
  required: ['shortlist', 'rejected_count'],
  properties: {
    rejected_count: { type: 'number' },
    shortlist: {
      type: 'array', maxItems: 6,
      items: {
        type: 'object',
        required: ['name', 'one_liner', 'mechanic', 'why_monad', 'room_participation', 'build_6h30', 'biggest_risk', 'prescore'],
        properties: {
          name: { type: 'string' }, one_liner: { type: 'string' }, mechanic: { type: 'string' },
          why_monad: { type: 'string' }, room_participation: { type: 'string' },
          build_6h30: { type: 'string' }, biggest_risk: { type: 'string' }, prescore: { type: 'number' },
        },
      },
    },
  },
}

const UPGRADE_SCHEMA = {
  type: 'object',
  required: ['upgrades'],
  properties: {
    upgrades: {
      type: 'array', maxItems: 5,
      items: {
        type: 'object',
        required: ['change', 'target_dimension', 'predicted_delta', 'cost_to_other_dims', 'buildable_in_window'],
        properties: {
          change: { type: 'string' },
          target_dimension: { type: 'string' },
          predicted_delta: { type: 'number' },
          cost_to_other_dims: { type: 'string' },
          buildable_in_window: { type: 'boolean' },
        },
      },
    },
  },
}

const JUDGE_SCHEMA = {
  type: 'object',
  required: ['drift_check_reverse_turk_v1', 'scores'],
  properties: {
    drift_check_reverse_turk_v1: { type: 'number' },
    scores: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'D1_novelty', 'D2_legible', 'D3_participation', 'D4_why_monad', 'D5_buildable', 'D6_survivability', 'D7_problem', 'total', 'one_line_verdict'],
        properties: {
          name: { type: 'string' },
          D1_novelty: { type: 'number' }, D2_legible: { type: 'number' },
          D3_participation: { type: 'number' }, D4_why_monad: { type: 'number' },
          D5_buildable: { type: 'number' }, D6_survivability: { type: 'number' },
          D7_problem: { type: 'number' }, total: { type: 'number' },
          one_line_verdict: { type: 'string' },
        },
      },
    },
  },
}

// ---- champion state ----
let champ = { name: 'Reverse Turk', version: 1, score: 61, upgrades: [] }
const seenNames = []
const history = []
let dry = 0
let round = 0
const BUDGET_FLOOR = 80000

function upgradeText() {
  if (!champ.upgrades.length) return '(no upgrades applied yet -- this is the original spec)'
  return champ.upgrades.map((u, i) => `${i + 1}. [${u.target_dimension}] ${u.change}`).join('\n')
}

while (round < 10 && dry < 2 && budget.remaining() > BUDGET_FLOOR) {
  round++
  const R = round
  const fableGenRound = (R === 1 || R === 4 || R === 7)

  log(`Round ${R} starting -- champion ${champ.name} v${champ.version} @ ${champ.score}/80 -- ${Math.round(budget.remaining() / 1000)}k budget left`)

  // ---------- W1 generation + W3 improvement (independent, run together) ----------
  const framings = [
    { arm: 'glm-5.2:cloud', lens: 'Attack the WHY-MONAD dimension: invent mechanics that are literally impossible on a slow or expensive chain, where the impossibility is visible to the naked eye in 3 minutes.' },
    { arm: 'deepseek-v4-pro:cloud', lens: 'Attack ROOM PARTICIPATION: invent mechanics where all ~167 people physically act at once, WITHOUT any phone sending a transaction (RPC limits make that dead).' },
    { arm: 'qwen3.5:397b-cloud', lens: 'Attack NOVELTY: take a crowded hackathon category from SEEN.md and INVERT its power relationship, the way Reverse Turk inverted "human pays agent" into "agent pays human".' },
    { arm: 'gpt-oss:120b-cloud', lens: 'Attack DEMO SURVIVABILITY: invent mechanics with almost no moving parts that still make a room gasp -- maximum spectacle per unit of engineering risk.' },
  ]

  const genTasks = [
    () => agent(`${CTX}

You are the free-arm generation driver for round ${R}. Run FOUR Ollama Cloud models, at most TWO at a time (use Bash, and wait between pairs). For each, pipe the prompt in via stdin.

Command shape (run exactly this way, one arm at a time or two in parallel):
  cat <<'PROMPT' | ollama run <ARM>
  <prompt text>
  PROMPT

The four arms and the DISTINCT lens each one must use:
${framings.map(f => `- ${f.arm}\n    LENS: ${f.lens}`).join('\n')}

The prompt you send each arm must contain: the full 7-dimension rubric (paste it from RUBRIC.md), the SEEN.md duplicate list (paste the category list and the dead list at minimum), a one-paragraph description of Reverse Turk and its 61/80 score, that arm's specific LENS, and this instruction: "Propose 6 ideas that would score above 61/80. For each give: name, one_liner, mechanic, why_monad, room_participation, build_6h30, biggest_risk, not_a_duplicate_because, self_score."

Round ${R} additional constraint: ${R === 1 ? 'no extra constraint -- open field.' : `these names are already taken and score 0: ${seenNames.slice(-40).join(', ')}. Tell each arm to avoid them.`}

Give each arm a generous timeout (use \`timeout 600\`). If an arm errors or times out, note it and continue with the others -- do NOT let one dead arm kill the round.

Collect every idea from every arm that answered. Write the raw combined output to ${DIR}/rounds/r${R}-ollama-raw.md. Return the structured ideas. Report which arms answered and which failed.`,
      { label: `gen:ollama-4arm r${R}`, phase: 'Generate', model: 'sonnet', effort: 'medium', schema: IDEA_SCHEMA }),
  ]

  if (fableGenRound) {
    genTasks.push(() => agent(`${CTX}

You are an INDEPENDENT idea generator for round ${R}. You cannot see what any other model proposed this round. Do not try to guess.

Propose 6 ideas that would score ABOVE 61/80 on the frozen rubric, beating Reverse Turk.

You authored Reverse Turk. That is a conflict of interest, so your job here is specifically to BEAT YOUR OWN IDEA. Find the thing that does what Reverse Turk does -- total room participation, one-sentence legibility, an honest Monad claim -- but with fewer moving parts or a sharper novelty hook.

Where Reverse Turk is weak and a rival could win:
- D5 buildable = 6/10 (agent loop + contract + phone app + projector, all live)
- D6 survivability = 6/10 (join to task to pay to reveal inside one pitch)
- D7 problem-solving = 5/10 (it demos a mechanism, it does not solve anything)
- It depends on the room adopting DURING the pitch. Thin adoption, thin ticker.

An idea that matches its 10/10 participation and 10/10 legibility while scoring 8+ on buildable and survivability wins outright.

${R === 1 ? '' : `Already taken, scores 0: ${seenNames.slice(-40).join(', ')}`}

Be concrete and physical. Vague concepts score badly on legibility.`,
      { label: `gen:fable r${R}`, phase: 'Generate', model: 'fable', effort: 'high', schema: IDEA_SCHEMA }))
  }

  const improveTasks = [
    () => agent(`${CTX}

Round ${R}. Champion: Reverse Turk v${champ.version}, currently ${champ.score}/80.
Upgrades already applied:
${upgradeText()}

Use the Bash tool to consult GPT-5.6-sol. Run EXACTLY this shape (read-only, non-interactive), giving it a long timeout:

  timeout 900 cursor-agent --print --output-format text --mode ask --model gpt-5.6-sol-xhigh "<your prompt>"

Your prompt to sol must include: the full frozen rubric, the current Reverse Turk spec (paste the relevant parts), the upgrade list above, and this ask:

"Propose at most 5 concrete, specific upgrades to this project that raise its /80 score. For each: the change, which dimension it targets, the predicted point delta, what it COSTS on other dimensions, and whether it is genuinely buildable inside the remaining window by 3 people. Reverse Turk is already 10/10 on legibility and participation and 16/20 on novelty -- there is nothing to win there. The real headroom is buildable (6/10), survivability (6/10) and problem-solving (5/10). Do not propose anything that adds moving parts. Do not propose scope. Propose subtraction and de-risking wherever possible."

Return sol's upgrades in the schema. If cursor-agent fails or the model is unavailable, report the exact error in the first upgrade's "change" field prefixed with "ARM-FAILED:" and return an empty-ish result -- do not fabricate upgrades.`,
      { label: `improve:sol r${R}`, phase: 'Improve', model: 'sonnet', effort: 'medium', schema: UPGRADE_SCHEMA }),

    () => agent(`${CTX}

Round ${R}. Champion: Reverse Turk v${champ.version}, currently ${champ.score}/80.
Upgrades already applied:
${upgradeText()}

Use the Bash tool to consult Grok 4.5. Run EXACTLY this shape, long timeout:

  timeout 900 cursor-agent --print --output-format text --mode ask --model cursor-grok-4.5-high "<your prompt>"

Your prompt to Grok must include the full frozen rubric, the Reverse Turk spec essentials, the upgrade list above, and this ask:

"Propose at most 5 concrete upgrades that raise this project's /80 score. For each: the change, target dimension, predicted delta, cost to other dimensions, buildable-in-window yes/no. Be adversarial about arithmetic and physical reality -- check gas, latency, RPC limits, camera and lighting assumptions, and how long each change actually takes to build. If an upgrade sounds good but the numbers do not work, say so instead of proposing it. The vote-buying optic (we pay the people who then rate us) is an unsolved weakness -- a genuine fix for it is worth proposing."

Return Grok's upgrades in the schema. On CLI failure, prefix "ARM-FAILED:" as above and do not fabricate.`,
      { label: `improve:grok r${R}`, phase: 'Improve', model: 'sonnet', effort: 'medium', schema: UPGRADE_SCHEMA }),

    () => agent(`${CTX}

Round ${R}. You are improving Reverse Turk v${champ.version}, currently ${champ.score}/80. You wrote the original.
Upgrades already applied:
${upgradeText()}

Propose at most 5 concrete upgrades. Rules:
- The three near-max dimensions (novelty 16/20, legibility 10/10, participation 10/10) have no headroom. Ignore them.
- Real headroom: buildable 6/10, survivability 6/10, problem-solving 5/10.
- Every upgrade must be SUBTRACTION or DE-RISKING unless it demonstrably adds a point without adding a moving part.
- One upgrade should attack the vote-buying optic honestly. Framing alone did not fix it.
- One upgrade should attack the adoption dependency (if only 20 people scan, the ticker looks thin).
- No upgrade may push the build past 16:00 contract freeze.
- Note the pitch is 3 minutes, not 2 -- the original spec budgeted 2. That is real slack; spend it well.

For each: change, target dimension, predicted delta, cost to other dims, buildable yes/no.`,
      { label: `improve:fable r${R}`, phase: 'Improve', model: 'fable', effort: 'high', schema: UPGRADE_SCHEMA }),
  ]

  const [genResults, improveResults] = await parallel([
    () => parallel(genTasks),
    () => parallel(improveTasks),
  ])

  const rawIdeas = (genResults || []).filter(Boolean).flatMap(r => (r && r.ideas) || [])
  const upgradeSets = (improveResults || []).filter(Boolean)
  log(`R${R}: ${rawIdeas.length} raw ideas generated, ${upgradeSets.length}/3 improver arms returned`)

  // ---------- W2 screen ----------
  let shortlist = []
  if (rawIdeas.length) {
    const screened = await agent(`${CTX}

Round ${R} screening. Here are ${rawIdeas.length} freshly generated candidate ideas:

${JSON.stringify(rawIdeas, null, 1)}

Already seen (score 0 if re-proposed): ${seenNames.join(', ') || '(none yet beyond SEEN.md)'}

Your job, mechanically and without mercy:
1. Drop every duplicate of anything in SEEN.md or the already-seen list above. "Same mechanic, new theme" is a duplicate.
2. Drop everything that violates a verified-dead constraint in RUBRIC.md (phones sending direct txs, relayer-fed TPS counters, iOS torch, whole-room DeviceMotion).
3. Drop anything that plainly cannot be built by 3 people in the remaining window.
4. Pre-score every survivor against the frozen rubric. Be harsh: self-scores from generators are inflated by 10-20 points as a rule.
5. Return the top 6 by pre-score. If fewer than 6 survive, return fewer -- do not pad.

Report how many you rejected.`,
      { label: `screen r${R}`, phase: 'Screen', model: 'sonnet', effort: 'medium', schema: SCREEN_SCHEMA })
    shortlist = (screened && screened.shortlist) || []
    log(`R${R}: ${shortlist.length} survived screening, ${(screened && screened.rejected_count) || 0} rejected`)
  }

  // ---------- W4 merge upgrades into RT-v(N+1) ----------
  const allUpgrades = upgradeSets.flatMap(u => (u && u.upgrades) || [])
    .filter(u => u && u.change && !String(u.change).startsWith('ARM-FAILED:'))
  const armFailures = upgradeSets.flatMap(u => (u && u.upgrades) || [])
    .filter(u => u && String(u.change).startsWith('ARM-FAILED:'))
    .map(u => u.change)
  if (armFailures.length) log(`R${R} ARM FAILURES: ${armFailures.join(' | ')}`)

  let candidateChamp = champ
  if (allUpgrades.length) {
    const merged = await agent(`${CTX}

Round ${R} merge. Current champion: Reverse Turk v${champ.version} @ ${champ.score}/80.
Upgrades already applied in previous rounds:
${upgradeText()}

Three independent models each proposed upgrades this round, blind to each other:

${JSON.stringify(allUpgrades, null, 1)}

Your job:
1. Group upgrades that are the same idea in different words. Convergence across independent models is a signal -- note it.
2. Reject any upgrade that conflicts with another, adds a moving part, pushes past the 16:00 contract freeze, or is not genuinely buildable. Log every rejection with a one-line reason.
3. Merge the survivors into a coherent Reverse Turk v${champ.version + 1}.
4. Write the full updated spec to ${DIR}/rounds/r${R}-RT-v${champ.version + 1}.md -- same structure as the original SPEC-reverse-turk.md, with a "Changes from v${champ.version}" section at the top listing each accepted upgrade and which model proposed it.
5. Also write the rejection log to that same file at the bottom.

Do NOT score it. Judges do that. Return a 3-line summary: how many accepted, how many rejected, and the single biggest change.`,
      { label: `merge r${R}`, phase: 'Improve', model: 'sonnet', effort: 'high' })
    candidateChamp = {
      name: 'Reverse Turk',
      version: champ.version + 1,
      score: null,
      upgrades: champ.upgrades.concat(allUpgrades),
      specPath: `${DIR}/rounds/r${R}-RT-v${champ.version + 1}.md`,
      mergeSummary: merged,
    }
  }

  // ---------- W5 judge panel, bias-corrected ----------
  const packet = `CONTENDERS FOR ROUND ${R}

=== A. The reigning champion, unchanged (this is your DRIFT CHECK anchor) ===
Reverse Turk v1 -- read ${SPEC}. Its anchor score is 61/80. Score it cold; if you do not
land within 61 +/- 2 the rubric has drifted and you must recheck your own calibration
before scoring anything else.

=== B. The upgraded champion ===
${candidateChamp.specPath ? `Reverse Turk v${candidateChamp.version} -- read ${candidateChamp.specPath}` : '(no upgrades merged this round -- skip B)'}

=== C. Fresh challengers ===
${shortlist.length ? JSON.stringify(shortlist, null, 1) : '(no challengers survived screening this round)'}`

  const judgeAsk = `Score EVERY contender above on all 7 dimensions of the frozen rubric. Apply the hard
scoring rules -- especially rule 2 (score what actually ships, not the aspiration),
rule 3 (simulated caps why-monad and problem-solving at 5) and rule 5 (no credit for
stretch goals). Return the drift-check number for Reverse Turk v1 separately.
Be harsh. Most ideas are worse than they sound at 1am.`

  const judgeTasks = [
    () => agent(`${CTX}

Round ${R}. You are JUDGE SOL. Use Bash to run the actual model -- do not score it yourself:

  timeout 900 cursor-agent --print --output-format text --mode ask --model gpt-5.6-sol-xhigh "<prompt>"

Send it the full frozen rubric, the contender packet below, and the ask. Then transcribe
its scores faithfully into the schema. If the arm fails, set drift_check to -1 and return
an empty scores array -- never substitute your own judgement for the arm's.

${packet}

${judgeAsk}`,
      { label: `judge:sol r${R}`, phase: 'Judge', model: 'sonnet', effort: 'medium', schema: JUDGE_SCHEMA }),

    () => agent(`${CTX}

Round ${R}. You are JUDGE GROK. Use Bash to run the actual model -- do not score it yourself:

  timeout 900 cursor-agent --print --output-format text --mode ask --model cursor-grok-4.5-high "<prompt>"

Send it the full frozen rubric, the contender packet, and the ask. Transcribe faithfully.
If the arm fails, set drift_check to -1 and return an empty scores array.

${packet}

${judgeAsk}`,
      { label: `judge:grok r${R}`, phase: 'Judge', model: 'sonnet', effort: 'medium', schema: JUDGE_SCHEMA }),

    () => agent(`${CTX}

Round ${R}. You are JUDGE FABLE. Score directly, yourself.

CONFLICT OF INTEREST: you authored Reverse Turk. Score it anyway -- your vote on it will
be excluded from its final number by the bias-correction rule. Knowing that, score it
honestly rather than strategically. Do not under-score it to look unbiased either; that
is the same error with the opposite sign.

${packet}

${judgeAsk}`,
      { label: `judge:fable r${R}`, phase: 'Judge', model: 'fable', effort: 'high', schema: JUDGE_SCHEMA }),
  ]

  const judgements = (await parallel(judgeTasks)).filter(Boolean)
  const live = judgements.filter(j => j && j.drift_check_reverse_turk_v1 >= 0 && (j.scores || []).length)
  log(`R${R}: ${live.length}/3 judges returned. Drift checks: ${judgements.map(j => (j && j.drift_check_reverse_turk_v1) ?? 'x').join(', ')}`)

  // drift gate
  const drifts = live.map(j => j.drift_check_reverse_turk_v1).filter(n => typeof n === 'number')
  const meanDrift = drifts.length ? drifts.reduce((a, b) => a + b, 0) / drifts.length : null
  const driftOK = meanDrift !== null && Math.abs(meanDrift - 61) <= 2
  if (!driftOK) {
    log(`R${R} DRIFT GATE FAILED -- mean re-score of Reverse Turk v1 = ${meanDrift} (must be 61 +/- 2). Round results are suspect and flagged.`)
  }

  // bias-corrected aggregation. Fable authored Reverse Turk (v1 and vN) -> exclude fable's vote on those.
  const tally = {}
  live.forEach((j, ji) => {
    const who = ['sol', 'grok', 'fable'][judgements.indexOf(j)] || `j${ji}`
    ;(j.scores || []).forEach(s => {
      if (!s || !s.name) return
      const key = s.name.trim()
      tally[key] = tally[key] || { name: key, votes: [] }
      tally[key].votes.push({ who, total: s.total, dims: s })
    })
  })
  const ranked = Object.values(tally).map(t => {
    const isRT = /reverse\s*turk/i.test(t.name)
    const counted = isRT ? t.votes.filter(v => v.who !== 'fable') : t.votes
    const use = counted.length ? counted : t.votes
    const mean = use.reduce((a, v) => a + (v.total || 0), 0) / use.length
    return { name: t.name, corrected: Math.round(mean * 10) / 10, n: use.length, excludedAuthor: isRT && counted.length !== t.votes.length, allVotes: t.votes.map(v => `${v.who}:${v.total}`).join(' ') }
  }).sort((a, b) => b.corrected - a.corrected)

  log(`R${R} standings: ${ranked.slice(0, 6).map(r => `${r.name} ${r.corrected}`).join(' | ')}`)

  // ---------- W6 red team the leader ----------
  const leader = ranked[0]
  let redteam = null
  if (leader) {
    redteam = await agent(`${CTX}

Round ${R}. The current leader is "${leader.name}" at ${leader.corrected}/80 (bias-corrected, ${leader.n} judges).
Raw votes: ${leader.allVotes}

Full standings this round:
${ranked.map(r => `  ${r.corrected}  ${r.name}`).join('\n')}

Contender detail:
${packet}

YOU ARE THE RED TEAM. Your lens is NOT "is this a good idea". Your lens is:
**Why does a tired developer, at 20:15, having watched 30 pitches, give this a 3 instead of a 5?**

Attack in this order and be specific:
1. What breaks ON STAGE. Name the exact failure, the trigger, and the minute it happens.
2. What a cynical developer in row 4 says to the person next to them. Quote it.
3. Where the pitch runs out of the 3 minutes. Give the timing arithmetic.
4. What the team CANNOT finish by 16:00 contract freeze. Be concrete about hours.
5. Any claim in the spec that is false, unverifiable, or that this specific room will catch.

Then: can each finding be fixed inside the remaining build window? For each, either a
concrete fix or "unfixable, accept as risk".

Write the full kill-list to ${DIR}/rounds/r${R}-redteam.md. Return the 3 most dangerous
findings and whether the leader survives them.`,
      { label: `redteam r${R}`, phase: 'RedTeam', model: 'sonnet', effort: 'high' })
  }

  // ---------- W7 saturation ----------
  shortlist.forEach(s => { if (s && s.name) seenNames.push(s.name) })
  rawIdeas.forEach(s => { if (s && s.name) seenNames.push(s.name) })

  const rtRows = ranked.filter(r => /reverse\s*turk/i.test(r.name))
  const bestRT = rtRows.length ? Math.max(...rtRows.map(r => r.corrected)) : champ.score
  const bestChallenger = ranked.find(r => !/reverse\s*turk/i.test(r.name))
  const newBest = Math.max(bestRT, bestChallenger ? bestChallenger.corrected : 0)

  const improved = newBest > champ.score + 0.5
  if (improved) {
    dry = 0
    if (bestChallenger && bestChallenger.corrected > bestRT) {
      champ = { name: bestChallenger.name, version: 1, score: bestChallenger.corrected, upgrades: [] }
      log(`R${R}: NEW CHAMPION -- challenger "${bestChallenger.name}" at ${bestChallenger.corrected}/80 beats Reverse Turk`)
    } else {
      champ = { ...candidateChamp, score: bestRT }
      log(`R${R}: champion improved -- Reverse Turk v${champ.version} now ${bestRT}/80`)
    }
  } else {
    dry++
    log(`R${R}: no improvement (best ${newBest} vs champion ${champ.score}). Dry rounds: ${dry}/2`)
  }

  history.push({
    round: R, driftOK, meanDrift, judgesLive: live.length,
    armFailures, ideasGenerated: rawIdeas.length, shortlisted: shortlist.length,
    upgradesProposed: allUpgrades.length,
    standings: ranked, champion: { name: champ.name, version: champ.version, score: champ.score },
    redteam, budgetRemaining: Math.round(budget.remaining() / 1000) + 'k',
  })
}

const stopReason = dry >= 2 ? 'SATURATED (two consecutive rounds with no improvement)'
  : round >= 10 ? 'BOUNDED (round cap 10 reached)'
  : `BOUNDED (budget floor -- ${Math.round(budget.remaining() / 1000)}k remaining)`

log(`Tournament over after ${round} rounds. ${stopReason}. Champion: ${champ.name} v${champ.version} @ ${champ.score}/80`)

return { stopReason, rounds: round, champion: champ, history }
