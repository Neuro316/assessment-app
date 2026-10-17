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
  oncePerRecord,
  searchWithTab,
  tabPress,
  welcomeLine,
} from '../src/lib/fresh-air.ts';
import { handOverPending } from '../packages/practice/dist/index.js';

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
  assert.equal((page.match(/\{instrument\(\)\}/g) || []).length, 1, 'flag off');
  assert.equal((page.match(/instrument\(strap\)/g) || []).length, 1, 'the Practice tab');
});

// ----- one greeting -----

const flagOff = page.slice(page.indexOf('if (!ASSESSMENT_TAB) {'), page.indexOf('tabs={{ active: tab'));
const flagOn = page.slice(page.indexOf('tabs={{ active: tab'));

test('the greeting is "Welcome back, {name}", and nothing without a name', () => {
  assert.equal(welcomeLine(launch('name=Ana').name), 'Welcome back, Ana');
  assert.equal(welcomeLine(launch('').name), null);
  assert.equal(welcomeLine(launch('name=').name), null);
  assert.match(page, /<p data-greeting style=\{\{ margin: 0, fontSize: 14, color: U\.muted \}\}>/);
  assert.match(shell, /muted: '#6b7280'/);
});

test('one greeting on screen with the flag off, above the narration note', () => {
  assert.equal((flagOff.match(/\{greeting\}/g) || []).length, 1);
  assert.ok(flagOff.indexOf('{greeting}') < flagOff.indexOf('{narrationNote}'));
  assert.equal(/<h1|Fresh Air, \$\{/.test(page), false, 'the old "Fresh Air, {name}" heading is gone');
});

test('one greeting on screen with the flag on, at the top of the content and outside the panels', () => {
  assert.equal((flagOn.match(/\{greeting \?/g) || []).length, 1);
  assert.ok(flagOn.indexOf('greeting ?') < flagOn.indexOf('role="tabpanel"'));
  assert.equal(/<h1/.test(flagOn), false);
  assert.equal((page.match(/greeting/g) || []).length, 5, 'declared once, used once per branch');
});

// ----- leaving a running session -----

test('a tab press while a session runs asks first; idle, it switches at once', () => {
  assert.equal(tabPress('practice', 'assessment', true), 'confirm');
  assert.equal(tabPress('practice', 'assessment', false), 'switch');
  assert.equal(tabPress('assessment', 'practice', false), 'switch');
  assert.equal(tabPress('assessment', 'practice', true), 'switch', 'going to Practice never asks');
  assert.equal(tabPress('practice', 'practice', true), 'stay');
  assert.equal(tabPress('assessment', 'assessment', false), 'stay');
  assert.match(page, /const press = tabPress\(tab, next, sessionRunning\);/);
  assert.match(page, /onActiveChange=\{setSessionRunning\}/);
});

test('End and switch posts the session exactly once, whatever comes after it', () => {
  const posted = [];
  const post = oncePerRecord((record) => posted.push(record));
  // end('abandoned') leaves the record in the slot; End and switch hands it over now.
  const slot = { current: { exerciseId: 'B1', endedBy: 'abandoned' } };
  assert.equal(handOverPending(slot, post), true);
  // The unmount flush finds the slot empty, and the finished screen (and its Done) is gone.
  assert.equal(handOverPending(slot, post), false);
  assert.equal(posted.length, 1);
  assert.equal(posted[0].endedBy, 'abandoned');
  // The instrument takes End early's own path and leaves the finished screen. Without
  // onHostEnded it hands over at once; with it, the host settles the slot later.
  const instrument = readFileSync(new URL('../packages/practice/src/PracticeInstrument.tsx', import.meta.url), 'utf8');
  assert.match(
    instrument,
    /end\('abandoned'\);\s+setFinished\(null\);\s+if \(!hostEnded\) \{\s+handOverPending\(pendingRef, \(record\) => onRecordRef\.current\(record\)\);/
  );
  assert.match(page, /const endAndSwitch = \(\) => \{\s+if \(!confirmingSwitch\) return;\s+setEndSignal\(\(n\) => n \+ 1\);\s+\};/);
});

test('the dialog: its words, aria-modal, Keep practicing focused and on Escape', () => {
  assert.match(shell, /role="dialog"\s+aria-modal="true"/);
  assert.match(shell, />\s*End this session\?\s*</);
  assert.match(shell, />\s*Your session is still running\. Switching now ends it\.\s*</);
  assert.match(shell, />\s*Keep practicing\s*</);
  assert.match(shell, />\s*End and switch\s*</);
  assert.match(shell, /keepRef\.current\?\.focus\(\);/);
  assert.match(shell, /if \(e\.key === 'Escape'\) \{\s+e\.preventDefault\(\);\s+if \(rating\) rating\.onSkip\(\);\s+else if \(!ending\) onKeep\(\);/);
  assert.match(page, /<EndSessionDialog\s+onKeep=\{\(\) => setConfirmingSwitch\(null\)\}\s+onEnd=\{endAndSwitch\}/);
});

test('no em dashes in the shell or the page', () => {
  assert.equal(/—/.test(shell), false);
  assert.equal(/—/.test(page), false);
});
