// ===== PACER ENGINE TESTS =====
// The engine (pacer.ts) on a simulated clock: breath timing and shape, route cues,
// phase endings, and the self-paced hold's release and safety cap.
//
// Ported from the checks run during development. The freeform and self-paced-hold
// cases used exercises B8 and B9, since removed from the library; their phase data
// is kept below verbatim as fixtures, because both modes are still live (B13 uses
// the hold).

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { autoEndMs, manualEnd, pacedCue, pacedStateAt, pacedTotalMs, rounds, routeOnlyText } from '../src/pacer';
import type { PacedPhase, PacerPhase } from '../src/types';

// Plays a program the way usePacerProgram does: each phase ends at autoEndMs, or
// when the person taps an enabled button first. tapAt returns ms after the phase
// starts, or null for never.
function play(phases: PacerPhase[], tapAt: (p: PacerPhase, i: number) => number | null) {
  return phases.map((p, i) => {
    const auto = autoEndMs(p);
    const tap = tapAt(p, i);
    const tapValid = tap !== null && manualEnd(p, tap)?.enabled === true;
    if (tapValid && (auto === null || tap! < auto)) return { mode: p.mode, endedAt: tap!, by: 'person' };
    if (auto !== null)
      return { mode: p.mode, endedAt: auto, by: p.mode === 'self-paced-hold' ? 'safety-cap' : 'auto' };
    return { mode: p.mode, endedAt: NaN, by: 'never ends' };
  });
}

// ----- fixtures -----

// B1 Resonance Breathing, as in the library.
const RESONANCE_5MIN: PacedPhase = {
  mode: 'paced',
  inhaleSec: 5.5,
  holdAfterInhaleSec: 0,
  exhaleSec: 5.5,
  holdAfterExhaleSec: 0,
  inhaleRoute: 'nose',
  exhaleRoute: 'nose',
  durationSec: 300,
};

// Formerly B8 (Nasal-Only Sustained): open-ended freeform.
const OPEN_FREEFORM: PacerPhase = {
  mode: 'freeform',
  instruction:
    'Breathe through your nose only as you walk. If you need more air, slow down or ease off rather than opening your mouth.',
  route: 'nose',
  continueLabel: 'Finish',
};

// Formerly B9 (Breath-Hold Walking): four rounds of a self-paced hold (45s cap)
// and a recovery whose button unlocks after 30s.
const HOLD_ROUNDS: PacerPhase[] = rounds(4, [
  {
    mode: 'self-paced-hold',
    holdOn: 'exhale',
    label: 'Hold',
    instruction:
      'Breathe out fully, then hold with empty lungs as you keep walking. Breathe again as soon as you feel a clear urge to.',
    safetyCapSec: 45,
  },
  {
    mode: 'freeform',
    label: 'Recover',
    instruction:
      'Breathe easily through your nose as you keep walking. Take at least 30 seconds — longer is fine — and go on only when your breathing has settled.',
    route: 'nose',
    minDurationSec: 30,
    continueLabel: 'Next round',
  },
]);

// ----- paced -----

test('paced: 300s rounds up to whole 11s breaths (28 breaths = 308s)', () => {
  assert.equal(pacedTotalMs(RESONANCE_5MIN), 308_000);
});

test('paced: t=0 is the start of an inhale, lungs empty, breath 1', () => {
  const s = pacedStateAt(RESONANCE_5MIN, 0);
  assert.equal(s.part, 'inhale');
  assert.ok(s.amplitude < 0.01);
  assert.equal(s.breath, 1);
});

test('paced: mid-inhale amplitude is 0.5', () => {
  const s = pacedStateAt(RESONANCE_5MIN, 2_750);
  assert.equal(s.part, 'inhale');
  assert.ok(Math.abs(s.amplitude - 0.5) < 0.01);
});

test('paced: top of the inhale is ~1', () => {
  assert.ok(pacedStateAt(RESONANCE_5MIN, 5_499).amplitude > 0.99);
});

test('paced: mid-exhale amplitude is 0.5', () => {
  const s = pacedStateAt(RESONANCE_5MIN, 8_250);
  assert.equal(s.part, 'exhale');
  assert.ok(Math.abs(s.amplitude - 0.5) < 0.01);
});

test('paced: breath 2 starts at 11s', () => {
  const s = pacedStateAt(RESONANCE_5MIN, 11_000);
  assert.equal(s.part, 'inhale');
  assert.equal(s.breath, 2);
});

test('paced: route cue on the inhale', () => {
  assert.equal(pacedCue(RESONANCE_5MIN, 'inhale').route, 'in through the nose');
});

test('paced: route cue on the exhale', () => {
  assert.equal(pacedCue(RESONANCE_5MIN, 'exhale').route, 'out through the nose');
});

test('paced: done at exactly 308s, not before', () => {
  assert.ok(pacedStateAt(RESONANCE_5MIN, 308_000).done);
  assert.ok(!pacedStateAt(RESONANCE_5MIN, 307_999).done);
});

test('paced: remaining at t=0 is the full 5:08', () => {
  assert.equal(pacedStateAt(RESONANCE_5MIN, 0).remainingMs, 308_000);
});

test('paced: no manual end on a paced phase', () => {
  assert.equal(manualEnd(RESONANCE_5MIN, 1_000), null);
});

test('paced: the program ends on its own at 308s', () => {
  const [run] = play([RESONANCE_5MIN], () => null);
  assert.equal(run.by, 'auto');
  assert.equal(run.endedAt, 308_000);
});

// ----- freeform -----

test('freeform: open-ended phase has no automatic end', () => {
  assert.equal(autoEndMs(OPEN_FREEFORM), null);
});

test('freeform: Finish is enabled immediately', () => {
  assert.equal(manualEnd(OPEN_FREEFORM, 0)?.enabled, true);
});

test('freeform: route cue reads "nose only"', () => {
  assert.ok(OPEN_FREEFORM.mode === 'freeform');
  assert.equal(routeOnlyText(OPEN_FREEFORM.route), 'nose only');
});

test('freeform: ends when the person finishes (15 min)', () => {
  const [run] = play([OPEN_FREEFORM], () => 15 * 60_000);
  assert.equal(run.by, 'person');
  assert.equal(run.endedAt, 900_000);
});

test('freeform: without a tap it keeps going', () => {
  const [run] = play([OPEN_FREEFORM], () => null);
  assert.equal(run.by, 'never ends');
});

// ----- self-paced hold, in rounds -----

test('rounds: 4 rounds x (hold, recover) = 8 phases', () => {
  assert.equal(HOLD_ROUNDS.length, 8);
  assert.deepEqual(
    HOLD_ROUNDS.map((p) => p.round?.current),
    [1, 1, 2, 2, 3, 3, 4, 4]
  );
});

test('rounds: phases alternate hold / freeform', () => {
  assert.ok(HOLD_ROUNDS.every((p, i) => p.mode === (i % 2 === 0 ? 'self-paced-hold' : 'freeform')));
});

test('hold: release button is always enabled', () => {
  const m = manualEnd(HOLD_ROUNDS[0], 0);
  assert.equal(m?.enabled, true);
  assert.equal(m?.label, 'Release — breathe');
});

test('hold: the safety cap is the automatic end (45s)', () => {
  assert.equal(autoEndMs(HOLD_ROUNDS[0]), 45_000);
});

test('recover: button locked before the 30s minimum', () => {
  assert.equal(manualEnd(HOLD_ROUNDS[1], 29_999)?.enabled, false);
});

test('recover: button unlocks at 30s', () => {
  assert.equal(manualEnd(HOLD_ROUNDS[1], 30_000)?.enabled, true);
});

test('recover: no automatic end (the person decides when to go on)', () => {
  assert.equal(autoEndMs(HOLD_ROUNDS[1]), null);
});

test('hold: in a normal run every hold is ended by the person', () => {
  const releaseAt = [18_000, 22_000, 25_000, 20_000];
  const run = play(HOLD_ROUNDS, (p, i) => (p.mode === 'self-paced-hold' ? releaseAt.at(i / 2)! : 40_000));
  assert.ok(run.filter((r) => r.mode === 'self-paced-hold').every((r) => r.by === 'person'));
});

test('hold: an unreleased hold ends itself at the 45s cap', () => {
  const run = play(HOLD_ROUNDS, (p, i) => (p.mode === 'self-paced-hold' ? (i === 2 ? null : 15_000) : 35_000));
  assert.equal(run[2].by, 'safety-cap');
  assert.equal(run[2].endedAt, 45_000);
});

test('hold: after the cap, the session carries on into recovery', () => {
  const run = play(HOLD_ROUNDS, (p, i) => (p.mode === 'self-paced-hold' ? (i === 2 ? null : 15_000) : 35_000));
  assert.equal(run[3].mode, 'freeform');
  assert.equal(run[3].by, 'person');
});

test('recover: a tap at 5s does not end it', () => {
  const run = play(HOLD_ROUNDS, (p) => (p.mode === 'self-paced-hold' ? 10_000 : 5_000));
  assert.equal(run[1].by, 'never ends');
});
