// ===== METRIC COPY TESTS =====
// The card tips and notes: no em dashes, and the complexity tip says what lower and
// higher readings tend to mean.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { CARD_NOTES, METRIC_TIPS, keysWithEmDash } from '../src/lib/metric-copy.ts';

test('no em dash remains in METRIC_TIPS', () => {
  assert.deepEqual(keysWithEmDash(METRIC_TIPS), []);
});

test('no em dash remains in the card notes', () => {
  assert.deepEqual(keysWithEmDash(CARD_NOTES), []);
});

test('control: a planted em dash fails the check', () => {
  assert.deepEqual(keysWithEmDash({ ...METRIC_TIPS, coherence: 'calm — synchronized' }), ['coherence']);
});

test('the complexity tip covers lower and higher readings, and noise above about 2.0', () => {
  const t = METRIC_TIPS.complexity;
  assert.match(t, /Lower readings tend to mean/);
  assert.match(t, /Higher readings tend to mean/);
  assert.match(t, /above about 2\.0 .*noise or missed beats rather than greater adaptability/);
});

test('every card has a tip and a note', () => {
  const ids = ['recovery', 'heartRate', 'breathRate', 'coherence', 'complexity', 'resonance'];
  assert.deepEqual(Object.keys(METRIC_TIPS).sort(), [...ids].sort());
  assert.deepEqual(Object.keys(CARD_NOTES).sort(), [...ids].sort());
});

// ⚠ A SOURCE GUARD: the page takes its notes from CARD_NOTES, so no note can be written
// inline (where the em dash check would not see it). Control: the CARD_NOTES form is found.
test('the page writes no card note inline', () => {
  const page = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  assert.equal(/note="/.test(page), false);
  assert.equal((page.match(/note=\{CARD_NOTES\./g) || []).length, 6, 'control');
});
