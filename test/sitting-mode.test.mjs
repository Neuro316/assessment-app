// ===== SITTING MODE TESTS =====
// Ruled by Cameron after the first real Insight sitting: the mode is chosen per
// sitting on the welcome screen, not by the launch URL. With an armband the person
// chooses "Full assessment" (default) or "Pace finder only"; with no armband the pace
// finder runs on self-report with no choice shown.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  DEFAULT_CHOICE,
  draftModeOf,
  modeChoiceOffered,
  sittingModeFor,
} from '../src/lib/sitting-mode.ts';

test('the default choice is the full assessment', () => {
  assert.equal(DEFAULT_CHOICE, 'full');
});

test('with an armband (or the simulation), the person\'s choice decides', () => {
  for (const conn of ['ble', 'sim']) {
    assert.equal(sittingModeFor(conn, 'full'), 'full', conn);
    assert.equal(sittingModeFor(conn, 'pace-finder'), 'pace-finder', conn);
    assert.equal(sittingModeFor(conn, DEFAULT_CHOICE), 'full', `${conn} default`);
  }
});

test('with no armband it is the pace finder, whatever was chosen', () => {
  assert.equal(sittingModeFor('none', 'full'), 'pace-finder');
  assert.equal(sittingModeFor('none', 'pace-finder'), 'pace-finder');
});

test('before an armband is connected or declined there is no mode yet', () => {
  assert.equal(sittingModeFor(null, 'full'), null);
});

test('the choice is offered only with an armband; none is shown without one', () => {
  assert.equal(modeChoiceOffered('ble'), true);
  assert.equal(modeChoiceOffered('sim'), true);
  assert.equal(modeChoiceOffered('none'), false);
  assert.equal(modeChoiceOffered(null), false);
});

test('drafts: the new names and the pre-ruling ones both resolve', () => {
  assert.equal(draftModeOf('full'), 'full');
  assert.equal(draftModeOf('pace-finder'), 'pace-finder');
  assert.equal(draftModeOf('capacity'), 'full');
  assert.equal(draftModeOf('insight'), 'pace-finder');
  assert.equal(draftModeOf(undefined), 'full');
});

// ⚠ A SOURCE GUARD, not a behaviour test: the mode decision above takes no URL input,
// and this pins that the page does not read one either. `&mode=insight` on a launch
// link must have no effect. Control: the same check finds a param the page DOES read.
test('the launch URL plays no part: the page never reads a `mode` param', () => {
  const page = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  assert.equal(/params\.get\(\s*['"]mode['"]\s*\)/.test(page), false);
  assert.equal(/params\.get\(\s*['"]fast['"]\s*\)/.test(page), true, 'control: the guard can see a read param');
});
