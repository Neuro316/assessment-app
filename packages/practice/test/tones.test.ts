// ===== TONE CUE TESTS =====
// Drives the real cueFor (PacerSession.tsx) through library phases on a 10ms clock,
// the way PacerSession's effect does, and checks when tones actually sound under
// the breath-length rule: a breath under 3.5s sounds once, as it begins; a longer
// breath sounds on every part.
//
// Ported unchanged from the checks run during development.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PRACTICE_EXERCISES } from '../src/library';
import { CUE } from '../src/audio';
import { pacedTotalMs } from '../src/pacer';
import { cueFor } from '../src/PacerSession';

const toneName = (t: unknown) => Object.entries(CUE).find(([, v]) => v === t)?.[0] ?? '?';

function tonesFor(id: string, phaseIdx: number, windowMs = 12_000) {
  const exercise = PRACTICE_EXERCISES.find((e) => e.id === id);
  assert.ok(exercise, `exercise ${id} exists`);
  const phase = exercise.program.phases.at(phaseIdx);
  assert.ok(phase, `${id} has phase ${phaseIdx}`);
  const end = phase.mode === 'paced' ? Math.min(windowMs, pacedTotalMs(phase)) : windowMs;
  let last: string | null = null;
  const fired: { at: number; tone: string }[] = [];
  for (let t = 0; t < end; t += 10) {
    const cue = cueFor(phase, phaseIdx, t);
    if (!cue || cue.key === last) continue;
    last = cue.key;
    if (cue.tone) fired.push({ at: t / 1000, tone: toneName(cue.tone) });
  }
  const gaps = fired.slice(1).map((f, i) => +(f.at - fired[i].at).toFixed(2));
  return { fired, gaps };
}

// ----- fast breaths: one tone per breath -----

test('tones: B13 sounds every 3s', () => {
  const { gaps } = tonesFor('B13', 0);
  assert.ok(gaps.length > 0);
  assert.ok(gaps.every((g) => g === 3), JSON.stringify(gaps));
});

test('tones: every B13 tone is the inhale', () => {
  assert.ok(tonesFor('B13', 0).fired.every((f) => f.tone === 'inhale'));
});

test('tones: B16 Fast sounds every 2s', () => {
  const { gaps } = tonesFor('B16', 2);
  assert.ok(gaps.length > 0);
  assert.ok(gaps.every((g) => g === 2), JSON.stringify(gaps));
});

test('tones: B16 Medium sounds every 3s', () => {
  assert.ok(tonesFor('B16', 1).gaps.every((g) => g === 3));
});

test('tones: B14 Pulses sound every 2s', () => {
  assert.ok(tonesFor('B14', 0).gaps.every((g) => g === 2));
});

test('tones: B10 Brisk sounds every 2.5s', () => {
  assert.ok(tonesFor('B10', 0).gaps.every((g) => g === 2.5));
});

// ----- long breaths: every part -----

test('tones: B2 sigh sounds inhale, top-up, exhale', () => {
  assert.deepEqual(
    tonesFor('B2', 0).fired.slice(0, 3).map((f) => f.tone),
    ['inhale', 'secondInhale', 'exhale']
  );
});

test('tones: B2 top-up sounds at 2s', () => {
  const second = tonesFor('B2', 0).fired.at(1);
  assert.equal(second?.at, 2);
  assert.equal(second?.tone, 'secondInhale');
});

test('tones: B7 sounds inhale, final pause, exhale', () => {
  assert.deepEqual(
    tonesFor('B7', 0).fired.slice(0, 3).map((f) => f.tone),
    ['inhale', 'hold', 'exhale']
  );
});

test('tones: B7 final pause sounds at 3s', () => {
  const second = tonesFor('B7', 0).fired.at(1);
  assert.equal(second?.at, 3);
  assert.equal(second?.tone, 'hold');
});

test('tones: B5 box sounds all four parts, every 4s', () => {
  const { fired, gaps } = tonesFor('B5', 0, 17_000);
  assert.deepEqual(fired.slice(0, 4).map((f) => f.tone), ['inhale', 'hold', 'exhale', 'hold']);
  assert.ok(gaps.slice(0, 4).every((g) => g === 4));
});

test('tones: B1 sounds inhale and exhale every 5.5s', () => {
  assert.ok(tonesFor('B1', 0).gaps.every((g) => g === 5.5));
});
