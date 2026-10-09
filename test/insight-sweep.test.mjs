// ===== INSIGHT SWEEP TESTS =====
// The sweep envelope against §K and §K.7 (docs/plans/instrument-envelope.md on
// Neuro316/npu-platform-v2 main). Every refusal test has a control that passes, so
// a refusal proves the check fired rather than that the fixture was broken.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  SWEEP_SEGMENTS,
  SWEEP_SCALES,
  buildSweepEnvelope,
  segmentForRate,
  selfReportPick,
  validateSweepEnvelope,
} from '../src/lib/insight-sweep.ts';

const ID = 'c-test-0001';
const EXPECTED_SEGMENTS = ['pre', 'rate_4.5', 'rate_5', 'rate_5.5', 'rate_6', 'rate_6.5', 'rate_7'];
const clone = (x) => JSON.parse(JSON.stringify(x));

// A fully answered sweep, every value legal.
function fullRatings() {
  const r = {};
  for (const seg of EXPECTED_SEGMENTS) r[seg] = { grounded: 3, focused: 3, energy: 3, presence: 3 };
  return r;
}

test('segments: exactly the seven of §K.2, in order', () => {
  assert.deepEqual([...SWEEP_SEGMENTS], EXPECTED_SEGMENTS);
});

test('segments: 5.0 becomes rate_5, never rate_5.0', () => {
  assert.equal(segmentForRate(5.0), 'rate_5');
  assert.equal(segmentForRate(6.0), 'rate_6');
  assert.equal(segmentForRate(7.0), 'rate_7');
  assert.equal(segmentForRate(4.5), 'rate_4.5');
  // Built from the assessment's own RF_RATES spelling, which writes 5.0, 6.0, 7.0.
  assert.deepEqual([4.5, 5.0, 5.5, 6.0, 6.5, 7.0].map(segmentForRate), EXPECTED_SEGMENTS.slice(1));
});

test('items: 28 = 4 keys x 7 segments, each key once per segment', () => {
  const env = buildSweepEnvelope(fullRatings(), ID);
  assert.equal(env.items.length, 28);
  for (const scale of SWEEP_SCALES) {
    assert.deepEqual(
      env.items.filter((i) => i.key === scale.key).map((i) => i.segment),
      EXPECTED_SEGMENTS,
      `${scale.key} appears once in every segment`
    );
  }
});

test('items: the shape of one item matches §K.3', () => {
  const r = fullRatings();
  r['rate_5.5'].grounded = 4;
  const item = buildSweepEnvelope(r, ID).items.find((i) => i.key === 'grounded' && i.segment === 'rate_5.5');
  assert.deepEqual(item, { key: 'grounded', type: 'scale', value: 4, label: 'Grounded', segment: 'rate_5.5' });
});

test('envelope: §K.7 constants, and a full sweep passes its own check', () => {
  const env = buildSweepEnvelope(fullRatings(), ID);
  assert.equal(env.instrument_id, 'insight-sweep');
  assert.equal(env.kind, 'reflective');
  assert.deepEqual(env.context, { session_id: ID });
  assert.deepEqual(validateSweepEnvelope(env, ID), []);
});

test('version: the STRING "1", not the number 1', () => {
  const env = buildSweepEnvelope(fullRatings(), ID);
  assert.equal(env.version, '1');
  assert.equal(typeof env.version, 'string');
  assert.equal(JSON.stringify(env).includes('"version":"1"'), true);
  // Planted defect: the number 1 is refused by name. Control above: the string passes.
  const planted = clone(env);
  planted.version = 1;
  assert.ok(validateSweepEnvelope(planted, ID).includes('version must be a string'));
});

test('planted rate_5.0 is REFUSED by our own check (control: rate_5 passes)', () => {
  const env = buildSweepEnvelope(fullRatings(), ID);
  assert.deepEqual(validateSweepEnvelope(env, ID), [], 'control');
  const planted = clone(env);
  const victim = planted.items.find((i) => i.key === 'focused' && i.segment === 'rate_5');
  victim.segment = 'rate_5.0';
  const errors = validateSweepEnvelope(planted, ID);
  assert.ok(errors.includes('segment "rate_5.0" is not declared'), errors.join('; '));
  assert.ok(errors.includes('focused@rate_5: missing'), 'and the real segment is reported missing');
});

test('blank: an unanswered rating serialises as null, never 0, and the sweep still passes', () => {
  const r = fullRatings();
  r.pre.energy = null; // cleared
  delete r['rate_6'].presence; // never given
  const env = buildSweepEnvelope(r, ID);
  const energyPre = env.items.find((i) => i.key === 'energy' && i.segment === 'pre');
  const presence6 = env.items.find((i) => i.key === 'presence' && i.segment === 'rate_6');
  assert.equal(energyPre.value, null);
  assert.equal(presence6.value, null);
  assert.ok(JSON.stringify(energyPre).includes('"value":null'));
  assert.deepEqual(validateSweepEnvelope(env, ID), []);
});

test('blank: 0 is REFUSED as out of range (control: null passes, above)', () => {
  const env = buildSweepEnvelope(fullRatings(), ID);
  const planted = clone(env);
  planted.items.find((i) => i.key === 'energy' && i.segment === 'pre').value = 0;
  const errors = validateSweepEnvelope(planted, ID);
  assert.ok(errors.some((e) => e.startsWith('energy@pre: value must be null or an integer 1 to 5, got 0')), errors.join('; '));
  // And the other out-of-range shapes.
  for (const bad of [6, 2.5, '3']) {
    const p = clone(env);
    p.items[0].value = bad;
    assert.ok(validateSweepEnvelope(p, ID).length > 0, `refuses ${JSON.stringify(bad)}`);
  }
});

test('all 7 segments are present even when every answer is blank', () => {
  const env = buildSweepEnvelope({}, ID);
  assert.equal(env.items.length, 28);
  assert.ok(env.items.every((i) => i.value === null));
  assert.deepEqual([...new Set(env.items.map((i) => i.segment))], EXPECTED_SEGMENTS);
  assert.deepEqual(validateSweepEnvelope(env, ID), []);
});

test('a missing segment is refused (control: complete sweep passes)', () => {
  const env = buildSweepEnvelope(fullRatings(), ID);
  const planted = clone(env);
  planted.items = planted.items.filter((i) => i.segment !== 'rate_7');
  const errors = validateSweepEnvelope(planted, ID);
  assert.ok(errors.includes('expected 28 items, got 24'));
  assert.ok(errors.includes('grounded@rate_7: missing'));
});

test('context.session_id must equal the completionId (§K.7 join)', () => {
  const env = buildSweepEnvelope(fullRatings(), ID);
  assert.deepEqual(validateSweepEnvelope(env, ID), [], 'control');
  assert.ok(validateSweepEnvelope(env, 'c-other-sitting').includes('context.session_id must equal the completionId'));
});

test('self-report pick: the rate rated best, labelled self-reported', () => {
  const r = fullRatings();
  r['rate_5.5'] = { grounded: 5, focused: 4, energy: 4, presence: 5 }; // mean 4.5, the best
  assert.deepEqual(selfReportPick(r), { rate: 5.5, source: 'self_report' });
});

test('self-report pick: blanks are skipped, not counted as 0', () => {
  const r = fullRatings(); // every rate means 3
  r['rate_6.5'] = { grounded: 4, focused: null, energy: null, presence: null }; // mean 4 over one answer
  assert.equal(selfReportPick(r).rate, 6.5);
});

test('self-report pick: a tie goes to the slower rate', () => {
  assert.equal(selfReportPick(fullRatings()).rate, 4.5);
});

test('self-report pick: nothing answered means no pick', () => {
  assert.deepEqual(selfReportPick({}), { rate: null, source: 'self_report' });
  // The pre ratings alone are not a rate, so they cannot produce a pick either.
  assert.equal(selfReportPick({ pre: { grounded: 5, focused: 5, energy: 5, presence: 5 } }).rate, null);
});
