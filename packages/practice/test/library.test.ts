// ===== EXERCISE LIBRARY TESTS =====
// The package's exercise library (src/library.ts) checked against the
// engine: every exercise has a finite program, and the shapes that matter most
// (the sigh, the box, B13's hold cap) are what they claim to be.
//
// Ported from the checks run during development, updated for the current library
// of 14 (B8 and B9 were removed).

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PRACTICE_EXERCISES } from '../src/library';
import { autoEndMs, pacedCue, pacedStateAt, pacedTotalMs } from '../src/pacer';

const ex = (id: string) => {
  const found = PRACTICE_EXERCISES.find((e) => e.id === id);
  assert.ok(found, `exercise ${id} exists`);
  return found;
};

const BREATHING_IDS = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16'];
const V_IDS = Array.from({ length: 12 }, (_, i) => `V${i + 1}`);
const M_IDS = Array.from({ length: 12 }, (_, i) => `M${i + 1}`);
const EXPECTED_IDS = [...BREATHING_IDS, ...V_IDS, ...M_IDS];

test('library: 38 exercises, the expected ids', () => {
  assert.deepEqual(
    PRACTICE_EXERCISES.map((e) => e.id).sort(),
    [...EXPECTED_IDS].sort()
  );
});

test('library: 14 paced breathing, 12 guided visualization, 12 field mindfulness', () => {
  const by = (k: string) => PRACTICE_EXERCISES.filter((e) => e.kind === k).map((e) => e.id).sort();
  assert.deepEqual(by('paced'), [...BREATHING_IDS].sort());
  assert.deepEqual(by('guided'), [...V_IDS].sort());
  assert.deepEqual(by('field'), [...M_IDS].sort());
  for (const e of PRACTICE_EXERCISES) {
    const fam = e.id[0] === 'B' ? 'breathing' : e.id[0] === 'V' ? 'visualization' : 'mindfulness';
    assert.equal(e.family, fam, `${e.id} family`);
  }
});

test('library: every entry carries purpose, axis, moment and evidence tier', () => {
  const purposes = new Set(['settle', 'steady', 'energize', 'recover', 'prepare', 'train']);
  for (const e of PRACTICE_EXERCISES) {
    assert.ok(e.purpose && purposes.has(e.purpose), `${e.id} purpose`);
    assert.ok(e.axis && e.axis.length > 0, `${e.id} axis`);
    assert.ok(e.moment && e.moment.length > 0, `${e.id} moment`);
    assert.ok([1, 2, 3].includes(e.evidenceTier as number), `${e.id} evidence tier`);
  }
});

test('library: guided and field entries carry the source text and a runnable program', () => {
  for (const e of PRACTICE_EXERCISES.filter((x) => x.kind !== 'paced')) {
    assert.ok(e.how && e.how.length > 20, `${e.id} how`);
    assert.ok(e.where && e.where.length > 10, `${e.id} where`);
    assert.ok(e.program.phases.length >= 1, `${e.id} has a program`);
  }
});

test('library: ids are unique', () => {
  assert.equal(new Set(PRACTICE_EXERCISES.map((e) => e.id)).size, PRACTICE_EXERCISES.length);
});

// One test per exercise: every paced phase has a length, every hold a cap.
for (const e of PRACTICE_EXERCISES) {
  test(`library: ${e.id} ${e.title} has a finite, well-formed program`, () => {
    assert.ok(e.program.phases.length > 0);
    for (const p of e.program.phases) {
      if (p.mode === 'paced') {
        assert.ok((p.durationSec ?? 0) > 0 || (p.repCount ?? 0) > 0, 'paced phase has a duration or rep count');
        assert.ok(pacedTotalMs(p) > 0, 'paced phase has a positive length');
      } else if (p.mode === 'self-paced-hold') {
        assert.ok(p.safetyCapSec > 0, 'hold has a safety cap');
      }
    }
  });
}

test('library: sigh is 2s / 1s / 6s, nose-nose-mouth, second inhale tops up from 0.8', () => {
  const sigh = ex('B2').program.phases[0];
  assert.ok(sigh.mode === 'paced');
  assert.equal(sigh.inhaleSec, 2);
  assert.equal(sigh.secondInhaleSec, 1);
  assert.equal(sigh.exhaleSec, 6);
  const atTop = pacedStateAt(sigh, 1_999).amplitude;
  assert.ok(atTop > 0.79 && atTop <= 0.8);
  assert.equal(pacedStateAt(sigh, 2_500).part, 'secondInhale');
  assert.equal(pacedCue(sigh, 'secondInhale').route, 'in through the nose');
  assert.equal(pacedCue(sigh, 'exhale').route, 'out through the mouth');
});

test('library: B13 hold cap is 75s', () => {
  const hold = ex('B13').program.phases.find((p) => p.mode === 'self-paced-hold');
  assert.ok(hold);
  assert.equal(autoEndMs(hold), 75_000);
});

test('library: B5 box runs its four 4s parts in order', () => {
  const box = ex('B5').program.phases[0];
  assert.ok(box.mode === 'paced');
  ['inhale', 'holdIn', 'exhale', 'holdOut'].forEach((part, i) =>
    assert.equal(pacedStateAt(box, i * 4_000 + 100).part, part)
  );
});

test('library: requiresBalancedBaseline is set on B13, B14, B16 only', () => {
  assert.deepEqual(
    PRACTICE_EXERCISES.filter((e) => e.requiresBalancedBaseline).map((e) => e.id).sort(),
    ['B13', 'B14', 'B16']
  );
});
