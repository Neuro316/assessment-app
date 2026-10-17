// ===== /fresh-air shell =====
// The header and tabs around the practice screen: the tab from ?tab= (Assessment
// by default), pace_source from the launch link, the pace pill's words, and the
// flag that keeps the tab bar away from live members.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  assessmentTabEnabled,
  freshAirTab,
  launchPaceSource,
  pacePillText,
  parseFreshAirLaunch,
  searchWithTab,
} from '../src/lib/fresh-air.ts';

const params = (q) => new URLSearchParams(q);
const launch = (q) => parseFreshAirLaunch(params(q));
const page = readFileSync(new URL('../src/app/fresh-air/page.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../src/components/FreshAirShell.tsx', import.meta.url), 'utf8');

// ----- the tab -----

test('?tab=assessment and ?tab=practice open that tab', () => {
  assert.equal(freshAirTab(params('embedded=true&token=t&tab=assessment')), 'assessment');
  assert.equal(freshAirTab(params('embedded=true&token=t&tab=practice')), 'practice');
});

test('a missing or invalid tab opens Assessment', () => {
  for (const q of ['', 'embedded=true&token=t', 'tab=', 'tab=Practice', 'tab=results', 'tab=practice%20', 'tab=__proto__']) {
    assert.equal(freshAirTab(params(q)), 'assessment', q);
  }
});

test('choosing a tab keeps every launch param', () => {
  const q = '?embedded=true&token=a.b.c&name=Ana&pace=5.5&pace_source=measured&age_band=adult&sim=1';
  const next = params(searchWithTab(q, 'practice'));
  for (const [k, v] of params(q)) assert.equal(next.get(k), v, k);
  assert.equal(next.get('tab'), 'practice');
  // and replaces the tab rather than adding a second one
  const back = params(searchWithTab(`${q}&tab=practice`, 'assessment'));
  assert.deepEqual(back.getAll('tab'), ['assessment']);
  assert.equal(params(searchWithTab('', 'practice')).get('tab'), 'practice');
});

// ----- pace_source -----

test('pace_source is kept when it is 1 to 20 lowercase letters, _ or -', () => {
  for (const s of ['measured', 'default', 'self_reported', 'from-platform', 'a', 'abcdefghijklmnopqrst']) {
    assert.equal(launch(`pace_source=${s}`).paceSource, s, s);
  }
});

test('any other pace_source is null', () => {
  const rejected = ['', 'Measured', 'MEASURED', 'measured1', 'measured ', ' measured', 'abcdefghijklmnopqrstu', 'a.b', 'a%2Fb', '<script>', 'mésuré'];
  for (const s of rejected) assert.equal(launch(`pace_source=${encodeURIComponent(s)}`).paceSource, null, JSON.stringify(s));
  assert.equal(launch('pace=5.5').paceSource, null, 'absent');
  assert.equal(launchPaceSource(null), null);
});

// ----- the pace pill -----

test('the pill shows the pace, adds "· measured" only for pace_source=measured, and is absent without a pace', () => {
  const pill = (q) => {
    const l = launch(q);
    return pacePillText(l.pace, l.paceSource);
  };
  assert.equal(pill('pace=5.5'), 'Your pace 5.5 per min');
  assert.equal(pill('pace=5.5&pace_source=measured'), 'Your pace 5.5 per min · measured');
  assert.equal(pill('pace=6&pace_source=default'), 'Your pace 6 per min');
  assert.equal(pill('pace=4.5&pace_source=Measured'), 'Your pace 4.5 per min', 'case matters');
  assert.equal(pill('pace=4.5&pace_source=measured_x'), 'Your pace 4.5 per min', 'exactly "measured"');
  assert.equal(pill(''), null);
  assert.equal(pill('pace_source=measured'), null, 'a source alone is no pace');
  assert.equal(pill('pace=8&pace_source=measured'), null, 'an invalid pace is no pace');
  assert.match(shell, /\{pill \? \(/, 'no pill element without text');
});

// ----- the flag -----

test('the tab bar is on only when NEXT_PUBLIC_FRESH_AIR_ASSESSMENT_TAB is exactly "1"', () => {
  assert.equal(assessmentTabEnabled('1'), true);
  for (const v of [undefined, '', '0', 'true', '1 ', 'yes']) assert.equal(assessmentTabEnabled(v), false, String(v));
  // Read at build, by its literal name, so Next inlines it.
  assert.match(page, /assessmentTabEnabled\(process\.env\.NEXT_PUBLIC_FRESH_AIR_ASSESSMENT_TAB\)/);
  // Flag off: the shell gets no tabs, and the placeholder is not in that branch.
  const off = page.slice(page.indexOf('if (!ASSESSMENT_TAB) {'), page.indexOf('tabs={{ active: tab'));
  assert.match(off, /<FreshAirShell pill=\{pill\} background=\{C\.pale\}>/);
  assert.equal(/tabs=|AssessmentPlaceholder/.test(off), false);
});

// ----- the shell -----

test('the tabs are real buttons, Assessment then Practice, with role="tab", aria-selected and 44px', () => {
  assert.match(readFileSync(new URL('../src/lib/fresh-air.ts', import.meta.url), 'utf8'), /FRESH_AIR_TABS = \['assessment', 'practice'\] as const/);
  assert.match(shell, /<button[\s\S]*?role="tab"[\s\S]*?aria-selected=\{selected\}/);
  assert.match(shell, /minHeight: 44/);
  assert.match(shell, /role="tablist"/);
});

test('the Assessment placeholder says what was agreed, with the button disabled', () => {
  assert.match(page, />Take your Capacity Assessment</);
  assert.match(page, /About 15 minutes, seated, with your armband on\. It finds your breathing pace and sets the baseline every\s+practice session is compared with\./);
  assert.match(page, /disabled\s[\s\S]*?Take Capacity Assessment\s*<\/button>/);
  assert.match(page, /Coming in the next update\./);
});

test('the practice screen is the same instrument in both branches, mounted once', () => {
  assert.equal((page.match(/<PracticeInstrument/g) || []).length, 1);
  assert.equal((page.match(/\{instrument\}/g) || []).length, 2, 'flag off and the Practice tab');
});

test('no em dashes in the shell or the page', () => {
  assert.equal(/—/.test(shell), false);
  assert.equal(/—/.test(page), false);
});
