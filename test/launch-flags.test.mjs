// ===== LAUNCH FLAG TESTS =====
// "Use simulation" is offered only on a test launch carrying sim=1.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { simulationEnabled } from '../src/lib/launch-flags.ts';

const p = (q) => new URLSearchParams(q);

test('a real launch never offers the simulation', () => {
  assert.equal(simulationEnabled(p('embedded=true&name=Cameron&attempt=2&phase=pre')), false);
});

test('sim=1 offers it (control)', () => {
  assert.equal(simulationEnabled(p('embedded=true&sim=1')), true);
});

test('only "1" turns it on', () => {
  for (const v of ['0', 'true', 'yes', '']) {
    assert.equal(simulationEnabled(p(`embedded=true&sim=${v}`)), false, JSON.stringify(v));
  }
});

test('the retired mode param does not turn it on', () => {
  assert.equal(simulationEnabled(p('embedded=true&mode=insight&fast=1')), false);
});
