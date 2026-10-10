// ===== COMPLETION MESSAGE TESTS =====
// The full assessment's scored result must be exactly what it was before the sweep
// existed. A full-assessment sitting sends that result PLUS the sweep in one
// assessment-complete, joined by session_id. A pace-finder sitting sends the sweep
// alone, with no scored result, and keeps a measured pick and a self-reported pick
// apart by name.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildCapacityMessage,
  buildFullMessage,
  buildPaceFinderMessage,
} from '../src/lib/completion-message.ts';
import { pickResonance } from '../src/lib/resonance.ts';
import { buildSweepEnvelope, selfReportPick } from '../src/lib/insight-sweep.ts';

// ----- the full assessment, before Insight -----

// ⚠ A VERBATIM COPY of the object finalize() built inline before this change (assessment-app
// e309e09, src/app/page.tsx). It is the reference the extracted builder must reproduce exactly.
// Do not "tidy" it: it is the old payload, frozen.
function legacyCapacityMessage(completionId, i) {
  const m = i.restingMetrics;
  const resonance = i.resonance;
  const MAX_RESTING_RR = 2000;
  const MAX_RF_RR_PER_RATE = 500;
  return {
    type: 'assessment-complete',
    completionId,
    metrics: {
      recoveryIndex: i.recoveryIndex,
      rmssd: m?.rmssd ?? null,
      sdnn: m?.sdnn ?? null,
      pnn50: m?.pnn50 ?? null,
      nn50: m?.nn50 ?? null,
      meanHR: m?.meanHR ?? null,
      meanRR: m?.meanRR ?? null,
      totalPower: m?.totalPower ?? null,
      lfPower: m?.lfPower ?? null,
      hfPower: m?.hfPower ?? null,
      vlfPower: m?.vlfPower ?? null,
      lfHfRatio: m?.lfHfRatio ?? null,
      lfNu: m?.lfNu ?? null,
      hfNu: m?.hfNu ?? null,
      breathRate: m?.breathRate ?? null,
      sampEn: m?.sampEn ?? null,
      dfaA1: m?.dfaA1 ?? null,
      coherence: m?.coherence ?? null,
      stressIdx: m?.stressIdx ?? null,
      resonanceFreq: resonance.rate,
    },
    rawData: {
      resting_rr: i.restingRR.slice(0, MAX_RESTING_RR),
      rf_results: i.rfSegments.map((seg, idx) => ({
        rate: seg.rate,
        amplitude: seg.metrics?.sdnn ?? null,
        coherence: seg.metrics?.coherence ?? null,
        rmssd: seg.metrics?.rmssd ?? null,
        rr_count: seg.rrCount,
        resonance_score: Math.round((resonance.scores[idx] ?? 0) * 1000) / 1000,
      })),
      rf_rr_per_rate: i.rfRR.map((rr) => rr.slice(0, MAX_RF_RR_PER_RATE)),
      resonance_freq: resonance.rate,
      device_mode: i.deviceMode,
      recording_duration_ms: i.restingMs + i.rfSegments.length * i.rfSegmentMs,
      attempt: i.attempt,
      phase: i.phase,
      capacity_level: i.level.key,
      capacity_label: i.level.label,
    },
  };
}

const metrics = (sdnn, rmssd, coherence) => ({
  meanRR: 800, meanHR: 75, rmssd, sdnn, pnn50: 20, nn50: 40, totalPower: 1000, lfPower: 300,
  hfPower: 200, vlfPower: 500, lfHfRatio: 1.5, lfNu: 60, hfNu: 40, breathRate: 6, sampEn: 1.4,
  dfaA1: 1.0, coherence, stressIdx: 90, rrCount: 300,
});

const RATES = [4.5, 5.0, 5.5, 6.0, 6.5, 7.0];
const rfSegments = RATES.map((rate, i) => ({
  rate,
  metrics: i === 4 ? null : metrics(40 + i * 5, 30 + i * 3, i === 2 ? null : 50 + i),
  rrCount: 100 + i,
}));
const rfRR = RATES.map((_, i) => Array.from({ length: 600 + i }, (_, k) => 800 + (k % 7)));

function capacityInput(overrides = {}) {
  return {
    completionId: 'c-full-0001',
    restingMetrics: metrics(60, 45, 55),
    recoveryIndex: 72,
    resonance: pickResonance(rfSegments),
    restingRR: Array.from({ length: 2500 }, (_, k) => 790 + (k % 11)), // over the 2000 cap
    rfSegments,
    rfRR,
    deviceMode: 'ble',
    restingMs: 300000,
    rfSegmentMs: 120000,
    attempt: 2,
    phase: 'pre',
    level: { key: 'expanded', label: 'Expanded Capacity' },
    ...overrides,
  };
}

test('full assessment: payload identical to the pre-Insight inline object', () => {
  const input = capacityInput();
  assert.deepStrictEqual(buildCapacityMessage(input), legacyCapacityMessage(input.completionId, input));
});

test('full assessment: identical with no resting metrics and a simulated strap too', () => {
  const input = capacityInput({ restingMetrics: null, deviceMode: 'sim', phase: null });
  assert.deepStrictEqual(buildCapacityMessage(input), legacyCapacityMessage(input.completionId, input));
});

test('full sitting: ONE message, the unchanged scored result plus the sweep, joined by session_id', () => {
  const input = capacityInput();
  const sweep = buildSweepEnvelope(ratings, input.completionId);
  const msg = buildFullMessage(input, sweep);
  // The scored result is exactly the old payload; the only addition is `sweep`.
  assert.deepStrictEqual(msg, { ...legacyCapacityMessage(input.completionId, input), sweep });
  assert.deepEqual(Object.keys(msg), ['type', 'completionId', 'metrics', 'rawData', 'sweep']);
  assert.equal(msg.type, 'assessment-complete');
  assert.equal(msg.sweep.context.session_id, msg.completionId);
  assert.equal(msg.sweep.items.length, 28);
});

test('full sitting: the scored result alone still carries no sweep (control)', () => {
  // buildCapacityMessage is the scored half; the sweep is added only by buildFullMessage.
  assert.equal('sweep' in buildCapacityMessage(capacityInput()), false);
});

test('full assessment: caps still apply (2000 resting, 500 per rate)', () => {
  const msg = buildCapacityMessage(capacityInput());
  assert.equal(msg.rawData.resting_rr.length, 2000);
  assert.ok(msg.rawData.rf_rr_per_rate.every((rr) => rr.length === 500));
});

// ----- the pace finder (the sweep alone) -----

const ratings = {
  pre: { grounded: 2, focused: 3, energy: 2, presence: 3 },
  'rate_5.5': { grounded: 5, focused: 4, energy: 4, presence: 5 },
  'rate_6': { grounded: null, focused: 4, energy: null, presence: null },
};

test('pace finder with an armband: sweep present, pick from pickResonance, no scored result', () => {
  const completionId = 'c-pace-ble';
  const resonance = pickResonance(rfSegments);
  const msg = buildPaceFinderMessage({
    completionId,
    sweep: buildSweepEnvelope(ratings, completionId),
    pick: { rate: resonance.rate, source: 'measured' },
    rfSegments,
    rfRR,
    resonanceScores: resonance.scores,
    deviceMode: 'ble',
    rfSegmentMs: 90000,
    attempt: 1,
    phase: 'pre',
  });
  assert.equal(msg.type, 'assessment-complete');
  assert.equal(msg.completionId, completionId);
  assert.equal('metrics' in msg, false, 'no scored result');
  assert.equal(msg.rawData.mode, 'pace-finder');
  assert.equal(msg.sweep.instrument_id, 'insight-sweep');
  assert.equal(msg.sweep.items.length, 28);
  assert.equal(msg.sweep.context.session_id, completionId);
  assert.deepEqual(msg.rawData.resonance_pick, { rate: resonance.rate, source: 'measured' });
  assert.equal(msg.rawData.resonance_freq, resonance.rate);
  assert.equal(msg.rawData.rf_results.length, 6);
  assert.equal(msg.rawData.recording_duration_ms, 6 * 90000);
});

test('pace finder without an armband: sweep present, pick labelled self-reported, nothing measured', () => {
  const completionId = 'c-pace-none';
  const pick = selfReportPick(ratings);
  const msg = buildPaceFinderMessage({
    completionId,
    sweep: buildSweepEnvelope(ratings, completionId),
    pick,
    rfSegments: [],
    rfRR: [],
    resonanceScores: [],
    deviceMode: 'none',
    rfSegmentMs: 90000,
    attempt: 1,
    phase: null,
  });
  assert.equal('metrics' in msg, false, 'no scored result');
  assert.equal(msg.sweep.items.length, 28);
  assert.deepEqual(msg.rawData.resonance_pick, { rate: 5.5, source: 'self_report' });
  // ⚠ The self-reported rate must never sit where a measured frequency is read from.
  assert.equal(msg.rawData.resonance_freq, null);
  assert.deepEqual(msg.rawData.rf_results, []);
  assert.deepEqual(msg.rawData.rf_rr_per_rate, []);
  assert.equal(msg.rawData.device_mode, 'none');
  assert.equal(msg.rawData.recording_duration_ms, 0);
});

test('pace finder: version travels as the string "1"', () => {
  const msg = buildPaceFinderMessage({
    completionId: 'c-v', sweep: buildSweepEnvelope({}, 'c-v'), pick: selfReportPick({}),
    rfSegments: [], rfRR: [], resonanceScores: [], deviceMode: 'none', rfSegmentMs: 90000, attempt: 1, phase: null,
  });
  assert.equal(typeof msg.sweep.version, 'string');
  assert.ok(JSON.stringify(msg).includes('"version":"1"'));
  assert.equal(JSON.stringify(msg).includes('"version":1'), false);
});
