// ===== /practice GATE TESTS =====
// The flag decision itself. The route's real 404 / 200 behaviour is checked against a
// production build with the flag off and on (see the merge report).

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isPracticeTestPageEnabled } from '../src/lib/practice-test-gate.ts';

test('production with the flag unset: OFF (the default)', () => {
  assert.equal(isPracticeTestPageEnabled({ NODE_ENV: 'production' }), false);
});

test('production with PRACTICE_TEST_PAGE=1: ON (control)', () => {
  assert.equal(isPracticeTestPageEnabled({ NODE_ENV: 'production', PRACTICE_TEST_PAGE: '1' }), true);
});

test('only "1" turns it on', () => {
  for (const v of ['0', 'true', 'yes', '', ' 1']) {
    assert.equal(isPracticeTestPageEnabled({ NODE_ENV: 'production', PRACTICE_TEST_PAGE: v }), false, JSON.stringify(v));
  }
});

test('next dev: on without setup', () => {
  assert.equal(isPracticeTestPageEnabled({ NODE_ENV: 'development' }), true);
});
