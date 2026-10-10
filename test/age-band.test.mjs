// ===== AGE BAND TESTS =====
// An age range from the launch link or the welcome question. `ageBand` leaves the app
// only when the person answered; `context.age_band` rides on the scored result whenever
// a band is known.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  AGE_BANDS,
  ageFields,
  ageQuestionNeeded,
  knownAgeBand,
  launchAgeBand,
} from '../src/lib/age-band.ts';

const p = (q) => new URLSearchParams(q);

test('the five bands, exactly', () => {
  assert.deepEqual([...AGE_BANDS], ['under30', '30s', '40s', '50s', '60plus']);
});

test('the launch param is read when valid, ignored otherwise', () => {
  for (const b of AGE_BANDS) assert.equal(launchAgeBand(p(`embedded=true&age_band=${b}`)), b);
  for (const bad of ['40', 'forties', '70plus', '']) {
    assert.equal(launchAgeBand(p(`embedded=true&age_band=${bad}`)), null, JSON.stringify(bad));
  }
  assert.equal(launchAgeBand(p('embedded=true')), null);
});

test('the question is asked only when the launch supplied no band', () => {
  assert.equal(ageQuestionNeeded(null), true);
  assert.equal(ageQuestionNeeded('40s'), false);
});

test('answered: ageBand in the message, and context.age_band on the scored result', () => {
  assert.deepEqual(ageFields(null, '40s', true), { ageBand: '40s', context: { age_band: '40s' } });
});

test('control: launch-supplied band: no ageBand, but context.age_band is present', () => {
  const f = ageFields('50s', null, true);
  assert.equal('ageBand' in f, false);
  assert.deepEqual(f, { context: { age_band: '50s' } });
});

test('control: skipped: no ageBand and no context', () => {
  assert.deepEqual(ageFields(null, 'skip', true), {});
  assert.deepEqual(ageFields(null, null, true), {});
  assert.equal(knownAgeBand(null, 'skip'), null);
});

test('the launch band wins over any stored answer, and is never echoed as ageBand', () => {
  assert.deepEqual(ageFields('60plus', '30s', true), { context: { age_band: '60plus' } });
  assert.equal(knownAgeBand('60plus', '30s'), '60plus');
});

test('no scored result (pace finder): ageBand when answered, never a context', () => {
  assert.deepEqual(ageFields(null, 'under30', false), { ageBand: 'under30' });
  assert.deepEqual(ageFields('30s', null, false), {});
});

// ⚠ A SOURCE GUARD: only a range is ever asked for or carried.
test('nothing about a date of birth anywhere in the app source', () => {
  const files = ['src/app/page.tsx', 'src/lib/age-band.ts', 'src/lib/session.ts', 'src/lib/completion-message.ts'];
  for (const f of files) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.equal(/birth|\bdob\b|birthday/i.test(src), false, f);
  }
  // control: the guard can see the age wording that IS there
  const page = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  assert.equal(/Your age range/.test(page), true);
});
