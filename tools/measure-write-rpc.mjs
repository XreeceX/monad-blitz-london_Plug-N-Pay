#!/usr/bin/env node
// Measures how many TRANSACTIONS per second Monad testnet will actually accept.
// This is the number the whole 60-player design rests on, and the one FR-REL-9
// still calls untested: tools/measure-rpc.mjs measured reads, and the write
// ceiling is strictly lower.
//
// It also answers FR-REL-8's sizing question by measuring one wallet against a
// pool. A single account's transactions are processed in nonce order, so one
// wallet cannot issue many per second in parallel — that claim is the whole
// reason the relay needs a pool, and this proves or refutes it rather than
// assuming it.
//
//   PRIVATE_KEY=0x... node tools/measure-write-rpc.mjs            # dry run, spends nothing
//   PRIVATE_KEY=0x... node tools/measure-write-rpc.mjs --send     # actually sends
//   PRIVATE_KEY=0x..,0x..,0x.. node tools/measure-write-rpc.mjs --send   # pool of 3
//
// SAFETY
//   - The key is read from the environment only. It is never logged, never
//     written to disk, and must never be pasted into a file in this repo.
//   - Transactions are 0-value transfers to the sender's own address, so nothing
//     moves except gas.
//   - Nothing is sent without --send.

import { createWalletClient, createPublicClient, http, parseGwei } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { monadTestnet } from 'viem/chains';

const argv = process.argv.slice(2);
const SEND = argv.includes('--send');
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? dflt : argv[i + 1];
};
const RATES = String(arg('rates', '2,5,10,15,20,30')).split(',').map(Number);
const SECONDS = Number(arg('seconds', 4));

const keys = (process.env.PRIVATE_KEY ?? '').split(',').map((k) => k.trim()).filter(Boolean);
if (!keys.length) {
  console.error('Set PRIVATE_KEY (one key, or several comma-separated for a pool).');
  console.error('Never paste a key into a file in this repo — env var only.');
  process.exit(1);
}

const accounts = keys.map((k) => privateKeyToAccount(k));
const transport = http(monadTestnet.rpcUrls.default.http[0]);
const pub = createPublicClient({ chain: monadTestnet, transport });
const wallets = accounts.map((account) =>
  createWalletClient({ account, chain: monadTestnet, transport }),
);

// Masked — enough to confirm the right wallet is in use, not enough to identify it.
console.log(`chain    : ${monadTestnet.name} (${monadTestnet.id})`);
console.log(`rpc      : ${monadTestnet.rpcUrls.default.http[0]}`);
console.log(`wallets  : ${accounts.length}`);
for (const a of accounts) console.log(`           ${a.address.slice(0, 6)}…${a.address.slice(-4)}`);

const balances = await Promise.all(accounts.map((a) => pub.getBalance({ address: a.address })));
balances.forEach((b) => console.log(`           balance ${Number(b) / 1e18} MON`));
if (balances.some((b) => b === 0n)) {
  console.error('\nAt least one wallet has zero balance. Fund it at faucet.monad.xyz first.');
  process.exit(1);
}

const totalTx = RATES.reduce((s, r) => s + r * SECONDS, 0);
console.log(`\nplan     : ${RATES.join(', ')} tx/s, ${SECONDS}s each = ${totalTx} transactions`);
console.log('           0-value self-transfers; only gas is spent');
if (!SEND) {
  console.log('\nDRY RUN — nothing sent. Re-run with --send to measure for real.');
  process.exit(0);
}

// Nonces are fetched ONCE and incremented locally. Fetching per transaction would
// serialise every send behind a round trip and measure latency, not capacity.
const nonces = await Promise.all(
  accounts.map((a) => pub.getTransactionCount({ address: a.address, blockTag: 'pending' })),
);

let cursor = 0;
function nextSender() {
  const i = cursor++ % wallets.length;
  return { wallet: wallets[i], account: accounts[i], nonce: nonces[i]++ };
}

async function sendOne() {
  const { wallet, account, nonce } = nextSender();
  const t0 = performance.now();
  try {
    await wallet.sendTransaction({
      to: account.address,
      value: 0n,
      nonce,
      gas: 21_000n,
      maxFeePerGas: parseGwei('60'),
      maxPriorityFeePerGas: parseGwei('2'),
    });
    return { ms: performance.now() - t0, ok: true };
  } catch (e) {
    const m = (e?.shortMessage ?? e?.message ?? '').toLowerCase();
    const kind = m.includes('rate') || m.includes('429') || m.includes('too many')
      ? 'ratelimit'
      : m.includes('nonce')
        ? 'nonce'
        : m.includes('underpriced') || m.includes('mempool') || m.includes('full')
          ? 'mempool'
          : 'other';
    return { ms: performance.now() - t0, ok: false, kind };
  }
}

// Open-loop: pace by arrival time, do not await each send before issuing the next.
async function phase(rate) {
  const inflight = [];
  const gap = 1000 / rate;
  const start = performance.now();
  for (let i = 0; i < rate * SECONDS; i++) {
    const wait = start + i * gap - performance.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    inflight.push(sendOne());
  }
  const res = await Promise.all(inflight);
  const ok = res.filter((r) => r.ok).length;
  const by = (k) => res.filter((r) => r.kind === k).length;
  const lat = res.filter((r) => r.ok).map((r) => r.ms).sort((a, b) => a - b);
  return {
    rate, sent: res.length, ok,
    ratelimit: by('ratelimit'), nonce: by('nonce'), mempool: by('mempool'), other: by('other'),
    p50: lat.length ? Math.round(lat[Math.floor(lat.length / 2)]) : 0,
  };
}

console.log('\n  tx/s   sent     ok   rate   nonce   mempl   other   p50ms   verdict');
console.log('  ' + '-'.repeat(72));
let ceiling = null;
for (const rate of RATES) {
  const r = await phase(rate);
  const clean = r.ok === r.sent;
  if (clean) ceiling = rate;
  console.log(
    `  ${String(r.rate).padStart(4)}  ${String(r.sent).padStart(5)}  ${String(r.ok).padStart(5)}` +
      `  ${String(r.ratelimit).padStart(5)}  ${String(r.nonce).padStart(6)}  ${String(r.mempool).padStart(6)}` +
      `  ${String(r.other).padStart(6)}  ${String(r.p50).padStart(6)}   ${clean ? 'clean' : 'REFUSED'}`,
  );
  if (!clean && r.sent - r.ok > r.sent * 0.1) break;
}

console.log('\nRESULT');
console.log(`  highest clean WRITE rate : ${ceiling ?? '< ' + RATES[0]} tx/s  (${accounts.length} wallet${accounts.length > 1 ? 's' : ''})`);
console.log('  60 booth players at 6s   : needs 10 tx/s');
console.log('  10 simulated at 1 Hz     : needs 10 tx/s');
console.log('\n  If this is below 10, the 6-second interval must widen or settlement must batch');
console.log('  (FR-REL-2). Record the number in REQUIREMENTS.md §13.4 either way.');
console.log('  Re-run with a comma-separated pool to see whether more wallets raise the ceiling —');
console.log('  if they do, FR-REL-8 is proven; if not, the bottleneck is the node, not nonces.');
