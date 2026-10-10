// ===== RESTING BLOCK WITH GAPS =====
// The resting metrics refuse rather than guess when the block holds too little clean
// signal: a gapped block yields nulls, never a 0, NaN or fixed stand-in; an ungapped
// block yields the usual numbers.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { computeAllMetrics } from '../src/lib/hrv-metrics.ts';
import { cleanMs } from '../src/lib/resonance.ts';
import { buildCapacityMessage } from '../src/lib/completion-message.ts';

const rr = (n) => Array.from({ length: n }, (_, k) => Math.round((830 + 40 * Math.sin(k / 1.6) + ((k * 37) % 11) - 5) * 10) / 10);
const nulls = (m) => Object.entries(m).filter(([, v]) => v === null).map(([k]) => k).sort();
const bad = (m) => Object.entries(m).filter(([, v]) => typeof v === 'number' && !Number.isFinite(v)).map(([k]) => k);

test('ungapped 5 minute block: the usual numbers, nothing null', () => {
  const block = rr(360);
  assert.ok(cleanMs(block) > 290000);
  const m = computeAllMetrics(block);
  assert.deepEqual(nulls(m), []);
  assert.deepEqual(bad(m), []);
});

test('gapped block under 10 beats (about 8 s clean): every metric null, recoveryIndex null', () => {
  assert.equal(computeAllMetrics(rr(9)), null);
  const msg = buildCapacityMessage({
    completionId: 'c-gap', restingMetrics: null, recoveryIndex: null,
    resonance: { rate: null, scores: [], sufficiency: [] }, restingRR: rr(9), rfSegments: [], rfRR: [],
    deviceMode: 'ble', restingMs: 300000, rfSegmentMs: 120000, attempt: 1, phase: null,
    level: { key: 'high-conservation', label: 'High Conservation' },
  });
  assert.ok(Object.values(msg.metrics).every((v) => v === null), JSON.stringify(msg.metrics));
});

test('gapped block of 10 to 19 beats: sampEn, dfaA1, coherence and breathRate null', () => {
  for (const n of [10, 19]) {
    const m = computeAllMetrics(rr(n));
    assert.deepEqual(nulls(m), ['breathRate', 'coherence', 'dfaA1', 'sampEn'], `n=${n}`);
    assert.deepEqual(bad(m), []);
  }
});

test('gapped block of 20 to 30 beats: breathRate null (it used to read a fixed 14)', () => {
  for (const n of [20, 30]) {
    const m = computeAllMetrics(rr(n));
    assert.equal(m.breathRate, null, `n=${n}`);
    assert.equal(m.dfaA1 !== null && m.coherence !== null, true, `n=${n}`);
  }
  // control: one beat more and the breath rate is counted
  assert.equal(typeof computeAllMetrics(rr(31)).breathRate, 'number');
});

// ⚠ SOURCE GUARD: the page sends recoveryIndex null, not 0, with no resting metrics.
test('the page sends recoveryIndex null when the resting block produced no metrics', () => {
  const page = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /recoveryIndex: restingMetrics \? recovery : null/);
});

test('a card whose metric is null shows n/a, never an em dash', () => {
  const page = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  assert.equal(/: '—'\}/.test(page), false);
  assert.equal((page.match(/: NOT_MEASURED\}/g) || []).length, 6, 'control: all six cards use it');
});
