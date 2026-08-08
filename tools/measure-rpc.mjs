#!/usr/bin/env node
// Measures the sustained request rate the Monad testnet public RPC will accept
// before it starts refusing. Satisfies FR-REL-9 in docs/specs/REQUIREMENTS.md,
// which requires the undocumented limit (CON-5) to become a measured number
// before build time is committed to the per-tick settlement path.
//
//   node tools/measure-rpc.mjs
//   node tools/measure-rpc.mjs --url https://other-endpoint --seconds 8
//
// LIMIT OF THIS MEASUREMENT: it sends read calls (eth_blockNumber), not
// transactions. It establishes the gateway's request ceiling, which is what
// returns HTTP 429 and freezes a dashboard mid-demo. Write throughput is bounded
// by this ceiling but also by nonce ordering and mempool acceptance, so the real
// settlement rate is at most what this reports and probably lower. Treat the
// result as an upper bound, not a promise.

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

const URL = args.url ?? 'https://testnet-rpc.monad.xyz';
const SECONDS = Number(args.seconds ?? 5);
const RATES = (args.rates ?? '5,10,20,40,80').split(',').map(Number);

const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] });

async function once() {
  const t0 = performance.now();
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    // A 200 carrying a JSON-RPC error is a refusal wearing a success code.
    let rpcError = false;
    if (res.status === 200) {
      const j = await res.json().catch(() => null);
      rpcError = Boolean(j?.error);
    }
    return { ms: performance.now() - t0, status: res.status, rpcError };
  } catch (e) {
    return { ms: performance.now() - t0, status: e.name === 'TimeoutError' ? 'timeout' : 'neterr' };
  }
}

// Fire `rate` requests per second for `SECONDS`, without waiting for replies —
// pacing by arrival time is the point; awaiting each one would measure latency
// instead of throughput.
async function phase(rate) {
  const inflight = [];
  const gap = 1000 / rate;
  const start = performance.now();
  for (let i = 0; i < rate * SECONDS; i++) {
    const due = start + i * gap;
    const wait = due - performance.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    inflight.push(once());
  }
  const results = await Promise.all(inflight);

  const ok = results.filter((r) => r.status === 200 && !r.rpcError).length;
  const rateLimited = results.filter((r) => r.status === 429).length;
  const serverErr = results.filter((r) => typeof r.status === 'number' && r.status >= 500).length;
  const other = results.length - ok - rateLimited - serverErr;
  const lat = results.filter((r) => r.status === 200).map((r) => r.ms).sort((a, b) => a - b);
  const p = (q) => (lat.length ? Math.round(lat[Math.floor(lat.length * q)] ?? lat.at(-1)) : 0);

  return { rate, sent: results.length, ok, rateLimited, serverErr, other, p50: p(0.5), p95: p(0.95) };
}

console.log(`endpoint : ${URL}`);
console.log(`plan     : ${RATES.join(', ')} req/s, ${SECONDS}s each\n`);
console.log('  req/s   sent     ok    429    5xx  other   p50ms   p95ms   verdict');
console.log('  ' + '-'.repeat(70));

let ceiling = null;
for (const rate of RATES) {
  const r = await phase(rate);
  const clean = r.ok === r.sent;
  if (clean) ceiling = rate;
  const verdict = clean ? 'clean' : r.rateLimited ? 'RATE LIMITED' : 'errors';
  console.log(
    `  ${String(r.rate).padStart(5)}  ${String(r.sent).padStart(5)}  ${String(r.ok).padStart(5)}` +
      `  ${String(r.rateLimited).padStart(5)}  ${String(r.serverErr).padStart(5)}` +
      `  ${String(r.other).padStart(5)}  ${String(r.p50).padStart(6)}  ${String(r.p95).padStart(6)}   ${verdict}`,
  );
  // Stop climbing once it breaks; hammering a public endpoint past its limit
  // proves nothing further and is rude.
  if (!clean && r.rateLimited > r.sent * 0.1) break;
}

console.log('\nRESULT');
console.log(`  highest clean rate observed : ${ceiling ?? '< ' + RATES[0]} req/s`);
console.log('  AC-5 needs (10 sessions)    : 10 tx/s');
console.log('  stretch target (50 sessions): 50 tx/s');
console.log('\n  Read calls only — this is an UPPER BOUND on settlement throughput,');
console.log('  not a measurement of it. Writes add nonce ordering and mempool limits.');
console.log('  Record the number in REQUIREMENTS.md FR-REL-9 either way.');
