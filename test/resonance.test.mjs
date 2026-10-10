// ===== RESONANCE SUFFICIENCY TESTS =====
// A rate is sufficient when its window holds at least 75% clean signal (90 s of the 120 s
// window) and at least four full breath cycles at its pace. With fewer than two sufficient
// rates there is no measured pick: resonance_freq and resonanceFreq are null and the pick
// is the self-reported one, labelled so. Every rate carries `sufficient` and `clean_ms`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  MIN_BREATH_CYCLES,
  MIN_CLEAN_FRACTION,
  cleanMs,
  minCleanMs,
  pickResonance,
  rateSufficiency,
} from '../src/lib/resonance.ts';
import { buildFullMessage, buildPaceFinderMessage } from '../src/lib/completion-message.ts';
import { buildSweepEnvelope, selfReportPick } from '../src/lib/insight-sweep.ts';
import { computeAllMetrics } from '../src/lib/hrv-metrics.ts';

const WINDOW = 2 * 60 * 1000;
const RATES = [4.5, 5.0, 5.5, 6.0, 6.5, 7.0];

// A paced oscillation sampled once a beat, `seconds` of clean signal long.
function paced(seconds, rate, amp) {
  const out = [];
  let t = 0;
  let k = 0;
  while (t < seconds * 1000) {
    const rr = 830 + amp * Math.sin(2 * Math.PI * (rate / 60) * (t / 1000)) + ((k * 37) % 11) - 5;
    out.push(Math.round(rr * 10) / 10);
    t += rr;
    k++;
  }
  return out;
}
const seg = (rate, seconds, amp = 40) => {
  const rr = paced(seconds, rate, amp);
  return { rate, metrics: computeAllMetrics(rr), rrCount: rr.length, cleanMs: cleanMs(rr), rr };
};
const strip = (segments) => segments.map(({ rr, ...s }) => s);

// Rated best at 6.0, so the self-report pick is known and differs from any measured one.
const ratings = { 'rate_6': { grounded: 5, focused: 5, energy: 3, presence: 5 }, 'rate_5': { grounded: 2, focused: 2, energy: 2, presence: 2 } };

function fullInput(segments) {
  return {
    completionId: 'c-suff',
    restingMetrics: null,
    recoveryIndex: null,
    resonance: pickResonance(strip(segments), WINDOW),
    restingRR: [],
    rfSegments: strip(segments),
    rfRR: segments.map((s) => s.rr),
    deviceMode: 'ble',
    restingMs: 300000,
    rfSegmentMs: WINDOW,
    attempt: 1,
    phase: null,
    level: { key: 'conserving', label: 'Conserving Resources' },
  };
}
const full = (segments, r = ratings) => {
  const input = fullInput(segments);
  return buildFullMessage(input, buildSweepEnvelope(r, input.completionId), selfReportPick(r));
};

// ----- clean time and the threshold -----

test('the constants: 75% of the window, and four breath cycles', () => {
  assert.equal(MIN_CLEAN_FRACTION, 0.75);
  assert.equal(MIN_BREATH_CYCLES, 4);
  // On the 120 s window the 90 s floor governs at every pace (4 cycles is 53.3 s at 4.5, 34.3 s at 7).
  for (const r of RATES) assert.equal(minCleanMs(r, WINDOW), 90000);
  assert.equal(Math.round((4 * 60000) / 4.5), 53333);
  assert.equal(Math.round((4 * 60000) / 7), 34286);
  // control: the breath-cycle term governs when the window is short
  assert.equal(Math.round(minCleanMs(4.5, 60000)), 53333);
});

test('clean time sums accepted intervals only: nothing past the artifact ceiling, nothing across a stop', () => {
  assert.equal(cleanMs([800, 800, 800]), 2400);
  assert.equal(cleanMs([800, 2400, 800]), 1600, 'an interval past 2000 ms (a dropout) counts nothing');
  assert.equal(cleanMs([800, 150, 800]), 1600, 'below the artifact floor counts nothing');
  assert.equal(cleanMs([]), 0);
});

test('sufficient at 90 s of clean signal, not one beat less (control)', () => {
  const at = { rate: 6, metrics: null, rrCount: 0, cleanMs: 90000 };
  const below = { ...at, cleanMs: 89999 };
  assert.deepEqual(rateSufficiency(at, WINDOW), { sufficient: true, clean_ms: 90000 });
  assert.deepEqual(rateSufficiency(below, WINDOW), { sufficient: false, clean_ms: 89999 });
});

// ----- all six insufficient (the dropped-armband sitting) -----

test('all six insufficient: resonance_freq null, source self_report, never a default 5.5', () => {
  const segments = RATES.map((r) => seg(r, 20));
  const res = pickResonance(strip(segments), WINDOW);
  assert.equal(res.rate, null);
  assert.deepEqual(res.scores, [0, 0, 0, 0, 0, 0]);
  const msg = full(segments);
  assert.equal(msg.rawData.resonance_freq, null);
  assert.equal(msg.metrics.resonanceFreq, null);
  assert.deepStrictEqual(msg.rawData.resonance_pick, { rate: 6, source: 'self_report' });
  assert.deepStrictEqual(msg.rawData.self_report_pick, { rate: 6 }, 'self_report_pick as it was');
  assert.ok(msg.rawData.rf_results.every((r) => r.sufficient === false && r.clean_ms < 90000));
  assert.ok(msg.rawData.rf_results.every((r) => r.rr_count > 0), 'rr_count kept');
});

test('all six insufficient and nothing rated: source self_report with rate null', () => {
  const msg = full(RATES.map((r) => seg(r, 0)), {});
  assert.deepStrictEqual(msg.rawData.resonance_pick, { rate: null, source: 'self_report' });
  assert.equal(msg.rawData.resonance_freq, null);
});

// ----- exactly one sufficient -----

test('exactly one sufficient: the same, no measured pick from a single rate', () => {
  const segments = RATES.map((r) => (r === 5.5 ? seg(r, 118, 80) : seg(r, 30)));
  assert.equal(pickResonance(strip(segments), WINDOW).rate, null);
  const msg = full(segments);
  assert.equal(msg.rawData.resonance_freq, null);
  assert.equal(msg.metrics.resonanceFreq, null);
  assert.deepStrictEqual(msg.rawData.resonance_pick, { rate: 6, source: 'self_report' });
  assert.deepEqual(msg.rawData.rf_results.map((r) => r.sufficient), [false, false, true, false, false, false]);
});

// ----- two sufficient -----

test('two sufficient: a measured pick from those two only', () => {
  // 7.0 is insufficient but has by far the biggest swing; it must score 0 and lose.
  const segments = RATES.map((r) =>
    r === 5.5 ? seg(r, 118, 60) : r === 6.5 ? seg(r, 118, 30) : r === 7.0 ? seg(r, 80, 150) : seg(r, 30)
  );
  const res = pickResonance(strip(segments), WINDOW);
  assert.equal(res.rate, 5.5);
  assert.deepEqual(res.scores.map((v) => v > 0), [false, false, true, false, true, false]);
  assert.ok(segments[5].metrics.sdnn > segments[2].metrics.sdnn, 'control: 7.0 really has the bigger swing');
  const msg = full(segments);
  assert.deepStrictEqual(msg.rawData.resonance_pick, { rate: 5.5, source: 'measured' });
  assert.equal(msg.rawData.resonance_freq, 5.5);
});

test('a rate with amplitude 0 is never picked, even when its clean time passes', () => {
  const flatRR = Array(140).fill(850);
  const flat = { rate: 4.5, metrics: computeAllMetrics(flatRR), rrCount: 140, cleanMs: cleanMs(flatRR), rr: flatRR };
  assert.equal(flat.metrics.sdnn, 0);
  assert.equal(rateSufficiency(flat, WINDOW).sufficient, true, 'control: it passes the time test');
  // With two others pickable, the flat one scores 0 and the pick comes from the others.
  const segments = [flat, seg(5, 118, 30), seg(5.5, 118, 50), ...[6, 6.5, 7].map((r) => seg(r, 30))];
  const res = pickResonance(strip(segments), WINDOW);
  assert.equal(res.rate, 5.5);
  assert.equal(res.scores[0], 0);
  // With only one other pickable rate, there is nothing to compare: no measured pick.
  const lone = [flat, seg(5, 118, 30), ...[5.5, 6, 6.5, 7].map((r) => seg(r, 30))];
  assert.equal(pickResonance(strip(lone), WINDOW).rate, null);
});

// ----- normal -----

test('normal: every rate sufficient, measured pick as before, source measured', () => {
  const segments = RATES.map((r) => seg(r, 118, r === 5 ? 70 : 35));
  const res = pickResonance(strip(segments), WINDOW);
  assert.equal(res.rate, 5);
  const msg = full(segments);
  assert.equal(msg.rawData.resonance_freq, 5);
  assert.equal(msg.metrics.resonanceFreq, 5);
  assert.deepStrictEqual(msg.rawData.resonance_pick, { rate: 5, source: 'measured' });
  assert.deepStrictEqual(msg.rawData.self_report_pick, { rate: 6 }, 'the rated pick still rides beside it');
  assert.ok(msg.rawData.rf_results.every((r) => r.sufficient === true && r.clean_ms >= 90000));
  const keys = Object.keys(msg.rawData);
  assert.deepEqual(keys.slice(-2), ['self_report_pick', 'resonance_pick']);
});

// ----- the pace finder shares the helper -----

test('pace finder: the same helper on its 90 s window (75% = 67.5 s), pick rule otherwise unchanged', () => {
  assert.equal(minCleanMs(4.5, 90000), 67500);
  const segments = RATES.map((r) => seg(r, 88, r === 6.5 ? 70 : 35));
  const res = pickResonance(strip(segments), 90000);
  assert.equal(res.rate, 6.5, 'a normal pace-finder sitting still gets its measured pick');
  const msg = buildPaceFinderMessage({
    completionId: 'c-pf', sweep: buildSweepEnvelope(ratings, 'c-pf'), pick: { rate: res.rate, source: 'measured' },
    rfSegments: strip(segments), rfRR: segments.map((s) => s.rr), resonanceScores: res.scores,
    rfSufficiency: res.sufficiency, deviceMode: 'ble', rfSegmentMs: 90000, attempt: 1, phase: null,
  });
  assert.ok(msg.rawData.rf_results.every((r) => r.sufficient === true && typeof r.clean_ms === 'number'));
});

// ⚠ SOURCE GUARDS on the page.
test('the page passes the window, guards the pick, keeps the exact wording, and mutes insufficient rates', () => {
  const page = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /pickResonance\(rfSegments, rfSegmentMs\)/);
  assert.match(page, /measured && resonance\.rate !== null/);
  assert.match(page, /The armband signal was lost during the paces\. The pace shown is from your ratings\./);
  assert.match(page, /The armband signal was lost during the paces and no pace could be chosen\./);
  // insufficient rates are gaps, not zeros
  assert.match(page, /sdnn: ok && s\.metrics \? Math\.round\(s\.metrics\.sdnn\) : null/);
  assert.match(page, /data-insufficient/);
  // control: the measured wording is still there for a sitting with a signal
  assert.match(page, /Your heart responded most strongly at/);
  assert.equal(/—/.test(page.match(/The armband signal was lost[^<]*/g).join('')), false, 'no em dash');
});
