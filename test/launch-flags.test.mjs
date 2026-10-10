// ===== LAUNCH FLAG TESTS =====
// "Use simulation" is offered only on a test launch carrying sim=1.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { inDropWindow, simDropWindows, simulationEnabled } from '../src/lib/launch-flags.ts';

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

// ----- &drop= (simulated dropouts) -----

test('drop windows are read with sim=1, in seconds of recording time', () => {
  const w = simDropWindows(new URLSearchParams('sim=1&drop=60:150,300:900'));
  assert.deepEqual(w, [{ startMs: 60000, endMs: 150000 }, { startMs: 300000, endMs: 900000 }]);
  assert.equal(inDropWindow(w, 59999), false);
  assert.equal(inDropWindow(w, 60000), true);
  assert.equal(inDropWindow(w, 150000), false);
  assert.equal(inDropWindow(w, 899999), true);
});

test('control: without sim=1 the drop flag is ignored', () => {
  assert.deepEqual(simDropWindows(new URLSearchParams('drop=60:150')), []);
  assert.deepEqual(simDropWindows(new URLSearchParams('sim=0&drop=60:150')), []);
});

test('malformed or empty windows are ignored', () => {
  assert.deepEqual(simDropWindows(new URLSearchParams('sim=1&drop=abc,90:30,5:10')), [{ startMs: 5000, endMs: 10000 }]);
});
