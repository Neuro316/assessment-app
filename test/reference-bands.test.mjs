// ===== REFERENCE BAND TESTS =====
// The three-zone bar on each Assessment Complete card: where the marker sits, when it
// clamps, which range each age band selects, and the one line under the bar.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  ALL_ADULTS_LINE,
  REFERENCE_BANDS,
  placeMarker,
  recoveryIndex,
  referenceFor,
  referenceLine,
  zoneEdges,
} from '../src/lib/reference-bands.ts';
import { AGE_BANDS } from '../src/lib/age-band.ts';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

// ----- marker placement -----

// Heart rate: typical 55 to 80, bar 40 to 110 (a 70 bpm span).
const hr = referenceFor('heartRate', null);

test('marker inside the band: typical zone, placed proportionally', () => {
  const m = placeMarker(70, hr);
  assert.equal(m.zone, 'typical');
  close(m.pct, (30 / 70) * 100);
});

test('marker below the band: lower zone, left of the typical zone', () => {
  const m = placeMarker(50, hr);
  assert.equal(m.zone, 'lower');
  close(m.pct, (10 / 70) * 100);
  assert.ok(m.pct < zoneEdges(hr).lowPct);
});

test('marker above the band: higher zone, right of the typical zone', () => {
  const m = placeMarker(95, hr);
  assert.equal(m.zone, 'higher');
  close(m.pct, (55 / 70) * 100);
  assert.ok(m.pct > zoneEdges(hr).highPct);
});

test('the band edges themselves count as typical', () => {
  assert.equal(placeMarker(55, hr).zone, 'typical');
  assert.equal(placeMarker(80, hr).zone, 'typical');
});

// ----- clamping -----

test('a value beyond the bar clamps to that edge, and says which', () => {
  const above = placeMarker(130, hr);
  assert.equal(above.pct, 100);
  assert.equal(above.clamped, 'above');
  assert.equal(above.zone, 'higher');
  const below = placeMarker(30, hr);
  assert.equal(below.pct, 0);
  assert.equal(below.clamped, 'below');
  assert.equal(below.zone, 'lower');
});

test('complexity above 2.5 clamps at the right edge', () => {
  const m = placeMarker(3.1, referenceFor('complexity', null));
  assert.equal(m.pct, 100);
  assert.equal(m.clamped, 'above');
});

test('control: in-range values do not clamp, the bar ends included', () => {
  for (const v of [40, 70, 110]) assert.equal(placeMarker(v, hr).clamped, null, String(v));
  assert.equal(placeMarker(40, hr).pct, 0);
  assert.equal(placeMarker(110, hr).pct, 100);
});

// ----- age bands -----

test('Recovery: each band is its RMSSD range drawn through recoveryIndex', () => {
  for (const band of [...AGE_BANDS, 'all']) {
    const [lo, hi] = REFERENCE_BANDS.recoveryRmssd[band];
    const ref = referenceFor('recovery', band === 'all' ? null : band);
    assert.equal(ref.low, recoveryIndex(lo), band);
    assert.equal(ref.high, recoveryIndex(hi), band);
    assert.deepEqual([ref.barMin, ref.barMax], [0, 100]);
  }
});

test('Recovery: the converted values, written out', () => {
  const got = Object.fromEntries(
    [...AGE_BANDS, null].map((b) => {
      const r = referenceFor('recovery', b);
      return [b ?? 'all', [r.low, r.high]];
    })
  );
  assert.deepEqual(got, {
    under30: [60, 86],
    '30s': [52, 82],
    '40s': [43, 75],
    '50s': [38, 68],
    '60plus': [33, 62],
    all: [43, 80],
  });
});

test('each age band selects its own range; unknown selects all adults', () => {
  for (const metric of ['recovery', 'complexity']) {
    const ranges = AGE_BANDS.map((b) => {
      const r = referenceFor(metric, b);
      return `${r.low}-${r.high}`;
    });
    assert.equal(new Set(ranges).size, AGE_BANDS.length, `${metric}: five distinct ranges`);
  }
  const c = referenceFor('complexity', '40s');
  assert.deepEqual([c.low, c.high, c.barMin, c.barMax], [0.95, 1.7, 0, 2.5]);
  const u = referenceFor('complexity', null);
  assert.deepEqual([u.low, u.high], [0.9, 1.8]);
  assert.equal(u.ageBand, null);
});

test('the all-ages metrics ignore the age band', () => {
  for (const metric of ['heartRate', 'breathRate', 'coherence', 'resonance']) {
    assert.deepEqual(referenceFor(metric, '60plus'), referenceFor(metric, null), metric);
  }
  const ranges = Object.fromEntries(
    ['heartRate', 'breathRate', 'coherence', 'resonance'].map((m) => {
      const r = referenceFor(m, null);
      return [m, [r.low, r.high, r.barMin, r.barMax]];
    })
  );
  assert.deepEqual(ranges, {
    heartRate: [55, 80, 40, 110],
    breathRate: [8, 16, 4, 24],
    coherence: [25, 50, 0, 100],
    resonance: [4.5, 7, 4, 8],
  });
});

// ----- the line under the bar -----

test('the line with a band known', () => {
  assert.equal(referenceLine('recovery', referenceFor('recovery', '40s')), 'Typical at rest: 43 to 75 / 100');
  assert.equal(referenceLine('complexity', referenceFor('complexity', '40s')), 'Typical at rest: 0.95 to 1.7');
  assert.equal(referenceLine('heartRate', hr), 'Typical at rest: 55 to 80 bpm');
  assert.equal(referenceLine('breathRate', referenceFor('breathRate', null)), 'Typical at rest: 8 to 16 br/min');
  assert.equal(referenceLine('resonance', referenceFor('resonance', null)), 'Typical at rest: 4.5 to 7.0 br/min');
});

test('with no band, Recovery and Complexity read the all-adults line; the rest are unchanged', () => {
  assert.equal(referenceLine('recovery', referenceFor('recovery', null)), ALL_ADULTS_LINE);
  assert.equal(referenceLine('complexity', referenceFor('complexity', null)), ALL_ADULTS_LINE);
  assert.equal(
    ALL_ADULTS_LINE,
    'Typical at rest, all adults. Add your age range in your profile for a closer comparison.'
  );
  // control: a metric with no age range keeps its numbers when no band is known
  assert.equal(referenceLine('coherence', referenceFor('coherence', null)), 'Typical at rest: 25 to 50 %');
});

// ⚠ A SOURCE GUARD: the ranges live in REFERENCE_BANDS, and the page draws every card's bar
// from them, so the page must hold no range literal of its own. Control: it does use the module.
test('the page holds no ranges of its own and gives every card a band', () => {
  const page = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  assert.equal((page.match(/band=\{\{ metric: '/g) || []).length, 6);
  assert.equal(/Typical at rest/.test(page), false);
  assert.equal(/from '@\/lib\/reference-bands'/.test(page), true, 'control');
});

// ⚠ A VERBATIM COPY of recoveryIndex as it stood in page.tsx before the move (a654e9f).
// The moved function must reproduce it exactly, since the score on the card depends on it.
function legacyRecoveryIndex(rmssd) {
  const anchors = [[0, 0], [15, 35], [30, 60], [50, 80], [100, 100]];
  if (rmssd <= 0) return 0;
  if (rmssd >= 100) return 100;
  for (let i = 1; i < anchors.length; i++) {
    const [x1, y1] = anchors[i - 1];
    const [x2, y2] = anchors[i];
    if (rmssd <= x2) return Math.round(y1 + ((rmssd - x1) / (x2 - x1)) * (y2 - y1));
  }
  return 100;
}

test('the moved recoveryIndex is unchanged, every 0.25 ms from -5 to 120', () => {
  for (let r = -5; r <= 120; r += 0.25) assert.equal(recoveryIndex(r), legacyRecoveryIndex(r), String(r));
});
