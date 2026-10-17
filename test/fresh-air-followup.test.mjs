// ===== /fresh-air, stage 2 follow-up =====
// End and switch asks for the after-session ratings and posts once whichever way
// they end; the header fits one row on a phone; no em dashes in the practice
// package's copy; and the simulated strap can show every armband state.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { armbandPill, compactPacePill, launchSimulation, oncePerRecord, parseFreshAirLaunch, pacePillText } from '../src/lib/fresh-air.ts';
import { handOverPending } from '../packages/practice/src/hand-over.ts';
import { NO_RATINGS, withAfterRatings } from '../packages/practice/dist/index.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const page = read('../src/app/fresh-air/page.tsx');
const shell = read('../src/components/FreshAirShell.tsx');
const instrument = read('../packages/practice/src/PracticeInstrument.tsx');
const provider = read('../packages/practice/src/StrapProvider.tsx');
const hook = read('../packages/practice/src/usePracticeStrap.ts');

// ----- 1. End and switch asks for ratings -----

const ended = () => ({
  exerciseId: 'B1',
  endedBy: 'abandoned',
  ratingsBefore: null,
  ratingsAfter: null,
  ratingNote: null,
  samplesSummary: { rrCount: 13 },
});

// The slot and settle exactly as the instrument builds them (checked against its source below).
function session() {
  const posted = [];
  const post = oncePerRecord((r) => posted.push(r));
  const slot = { current: ended() };
  const record = slot.current;
  const settle = (final) => handOverPending(slot, (r) => post(final ?? r));
  const unmountFlush = () => handOverPending(slot, (r) => post(r));
  return { posted, record, settle, unmountFlush };
}

test('Save and switch posts once, with the ratings, and endedBy stays abandoned', () => {
  const s = session();
  const rated = withAfterRatings(s.record, { grounded: 4, focused: 3, energy: null, presence: 5 }, ' calmer ');
  assert.equal(s.settle(rated), true);
  assert.equal(s.settle(null), false, 'a later hide finds nothing to post');
  assert.equal(s.unmountFlush(), false);
  assert.equal(s.posted.length, 1);
  assert.deepEqual(s.posted[0].ratingsAfter, { grounded: 4, focused: 3, energy: null, presence: 5 });
  assert.equal(s.posted[0].ratingNote, 'calmer');
  assert.equal(s.posted[0].endedBy, 'abandoned');
});

test('Skip posts once without ratings; hidden first posts once without them, and Save then posts nothing', () => {
  const skip = session();
  skip.settle(withAfterRatings(skip.record, NO_RATINGS, ''));
  skip.unmountFlush();
  assert.equal(skip.posted.length, 1);
  assert.equal(skip.posted[0].ratingsAfter, null);
  assert.equal(skip.posted[0].ratingNote, null);
  assert.equal(skip.posted[0].endedBy, 'abandoned');

  const hidden = session();
  assert.equal(hidden.settle(null), true, 'page hidden while the ratings show');
  assert.equal(hidden.settle(withAfterRatings(hidden.record, { ...NO_RATINGS, grounded: 2 }, '')), false);
  assert.equal(hidden.posted.length, 1);
  assert.equal(hidden.posted[0], hidden.record, 'as it ended, through the same slot as the unmount flush');
});

test('the instrument hands the ended record back unposted and settles through the one slot', () => {
  assert.match(
    instrument,
    /const record = pendingRef\.current;\s+hostEnded\(record, \(final\) => handOverPending\(pendingRef, \(r\) => onRecordRef\.current\(final \?\? r\)\)\);/
  );
  // The unmount flush empties the same slot.
  assert.match(instrument, /useEffect\(\s+\(\) => \(\) => \{\s+handOverPending\(pendingRef, \(record\) => onRecordRef\.current\(record\)\);/);
  // Done builds its record with the same helper, so every path has the same shape.
  assert.match(instrument, /const out = withAfterRatings\(\s+record,\s+ratingsAfter,\s+ratingNote,/);
  assert.match(instrument, /<AfterSessionRatings\s+ratings=\{ratingsAfter\}/);
});

test('the record shape is what Done has always sent', () => {
  const r = withAfterRatings(ended(), NO_RATINGS, '  ');
  assert.deepEqual(Object.keys(r), ['exerciseId', 'endedBy', 'ratingsBefore', 'ratingsAfter', 'ratingNote', 'samplesSummary', 'note']);
  assert.equal(r.note, null);
  assert.equal(withAfterRatings({ ...ended(), note: 'walked' }, NO_RATINGS, '').note, 'walked');
  assert.equal(withAfterRatings(ended(), NO_RATINGS, '', 'field note').note, 'field note');
});

test('the dialog asks "How do you feel now?" with Save and switch and Skip; Escape and Close skip; focus on the first rating', () => {
  assert.match(shell, />\s*How do you feel now\?\s*</);
  assert.match(shell, /onClick=\{\(\) => rating\.onSave\(ratingsAfter, ratingNote\)\}[\s\S]*?Save and switch/);
  assert.match(shell, /onClick=\{rating\.onSkip\}[\s\S]*?>\s*Skip\s*</);
  assert.match(shell, /onClick=\{rating\.onSkip\}\s+aria-label="Close"/);
  assert.match(shell, /if \(rating\) rating\.onSkip\(\);/);
  assert.match(shell, /querySelector<HTMLButtonElement>\('\[data-after-ratings\] button'\)\?\.focus\(\)/);
  assert.match(shell, /<AfterSessionRatings\s+ratings=\{ratingsAfter\}/);
  assert.match(shell, /role="dialog"\s+aria-modal="true"/);
  // Save is the primary button: the blue one.
  assert.match(shell, /rating\.onSave\(ratingsAfter, ratingNote\)\}\s+style=\{\{ \.\.\.button, background: U\.blue/);
});

test('the page: Save posts the rated record, Skip the unrated one, a hidden page posts it as it ended', () => {
  assert.match(page, /onSave: \(ratingsAfter, ratingNote\) =>\s+finishAfterEnd\(withAfterRatings\(afterEnd\.record, ratingsAfter, ratingNote\)\)/);
  assert.match(page, /onSkip: \(\) => finishAfterEnd\(withAfterRatings\(afterEnd\.record, NO_RATINGS, ''\)\)/);
  assert.match(page, /afterEnd\.settle\(final\);\s+switchTab\(afterEnd\.target\);/);
  assert.match(page, /if \(document\.visibilityState === 'hidden'\) finishAfterEnd\(null\);/);
  assert.match(page, /window\.addEventListener\('pagehide', onPageHide\);/);
});

// ----- 2. one header row on a phone -----

test('under 640px the pace pill reads "Pace 5.5", with the full words as its label', () => {
  assert.deepEqual(compactPacePill(5.5, 'measured'), { text: 'Pace 5.5', ariaLabel: 'Your pace 5.5 per minute, measured' });
  assert.deepEqual(compactPacePill(6, 'default'), { text: 'Pace 6', ariaLabel: 'Your pace 6 per minute' });
  assert.deepEqual(compactPacePill(4.5, null), { text: 'Pace 4.5', ariaLabel: 'Your pace 4.5 per minute' });
  assert.equal(compactPacePill(null, 'measured'), null);
  assert.equal(pacePillText(5.5, 'measured'), 'Your pace 5.5 per min · measured', 'wide is unchanged');
});

test('under 640px the idle armband pill reads "Connect"', () => {
  assert.deepEqual(armbandPill('idle', null, true), { text: 'Connect', ariaLabel: 'Connect armband', dot: false });
  assert.equal(armbandPill('idle', null, false).text, 'Connect armband');
  assert.equal(armbandPill('unsupported', null, true).text, 'Pacer only');
});

test('the short pace pill is used only narrow and only with the tabs; flag off keeps the long one', () => {
  assert.match(shell, /const shortPill = narrow && compactPill \? compactPill : null;/);
  assert.match(shell, /role=\{shortPill \? 'img' : undefined\}\s+aria-label=\{shortPill\?\.ariaLabel\}/);
  assert.match(shell, /\{shortPill \? shortPill\.text : pill\}/);
  const off = page.slice(page.indexOf('if (!ASSESSMENT_TAB) {'), page.indexOf('// One armband connection, above both tabs'));
  assert.equal(/compactPill/.test(off), false);
  assert.match(page, /compactPill=\{compactPacePill\(launch\.pace, launch\.paceSource\)\}/);
});

// ----- 3. no em dashes in the package's copy -----

test('no em dash in any string or JSX text in packages/practice/src (comments aside)', () => {
  const dir = new URL('../packages/practice/src/', import.meta.url);
  const offenders = [];
  for (const f of readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f))) {
    readFileSync(new URL(f, dir), 'utf8')
      .split(/\r?\n/)
      .forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        if (line.replace(/\/\/.*$/, '').includes('—')) offenders.push(`${f}:${i + 1}`);
      });
  }
  assert.deepEqual(offenders, []);
  assert.match(instrument, /`\$\{STRAP_LABEL\.connected\} · \$\{hr\} bpm`/);
  assert.match(instrument, /Session complete · \{formatTime\(record\.durationMs\)\}/);
  assert.match(read('../packages/practice/src/pacer.ts'), /label: 'Release · breathe'/);
});

// ----- 4. the simulated strap's timings -----

const sim = (q) => launchSimulation(new URLSearchParams(q));

test('sim_connect_ms, sim_drop_at_ms with sim_drop_for_ms, and sim_nobt are read with sim=1', () => {
  assert.deepEqual(sim('sim=1&sim_connect_ms=3000'), { connectDelayMs: 3000, dropAtMs: null, dropForMs: null, noBluetooth: false });
  assert.deepEqual(sim('sim=1&sim_drop_at_ms=8000&sim_drop_for_ms=5000'), {
    connectDelayMs: null,
    dropAtMs: 8000,
    dropForMs: 5000,
    noBluetooth: false,
  });
  assert.equal(sim('sim=1&sim_nobt=1').noBluetooth, true);
  assert.deepEqual(sim('sim=1'), { connectDelayMs: null, dropAtMs: null, dropForMs: null, noBluetooth: false });
  assert.deepEqual(parseFreshAirLaunch(new URLSearchParams('sim=1&sim_connect_ms=500')).simulation.connectDelayMs, 500);
});

test('every sim_ param is ignored without sim=1', () => {
  const all = 'sim_connect_ms=3000&sim_drop_at_ms=8000&sim_drop_for_ms=5000&sim_nobt=1';
  for (const q of [all, `sim=0&${all}`, `sim=true&${all}`, `sim=&${all}`]) {
    assert.equal(sim(q), null, q);
    assert.equal(parseFreshAirLaunch(new URLSearchParams(q)).simulation, null, q);
  }
});

test('bad values are dropped, and a drop needs both its params', () => {
  for (const v of ['-5', '1.5', 'abc', '', '1234567', ' 30', '1e3']) {
    assert.equal(sim(`sim=1&sim_connect_ms=${encodeURIComponent(v)}`).connectDelayMs, null, v);
  }
  assert.equal(sim('sim=1&sim_drop_at_ms=8000').dropAtMs, null, 'no drop without a duration');
  assert.equal(sim('sim=1&sim_drop_for_ms=5000').dropForMs, null, 'no drop without a time');
  assert.equal(sim('sim=1&sim_drop_at_ms=8000&sim_drop_for_ms=0').dropAtMs, null, 'a zero-length drop is no drop');
  assert.equal(sim('sim=1&sim_nobt=true').noBluetooth, false);
});

test('the provider retries silently after a drop, within its window, and reports no Bluetooth on sim_nobt', () => {
  assert.match(provider, /export const RETRY_EVERY_MS = 2_000;/);
  assert.match(provider, /export const RETRY_WINDOW_MS = 20_000;/);
  assert.match(provider, /while \(Date\.now\(\) - started < RETRY_WINDOW_MS\)/);
  assert.match(provider, /if \(unmountedRef\.current \|\| machineRef\.current\.state !== 'lost'\) return;\s+if \(await reconnectRef\.current\(\)\) return;/);
  assert.match(provider, /dispatch\(\{ type: 'dropped' \}\);\s+for \(const l of listenersRef\.current\) l\.onDropped\?\.\(\);\s+void retryAfterDrop\(\);/);
  assert.match(provider, /const sim = simulate \? simulation \?\? undefined : undefined;/, 'only with the simulated strap');
  assert.match(provider, /if \(noBluetooth\) dispatch\(\{ type: 'unsupported' \}\);/);
  assert.match(page, /<StrapProvider simulate=\{launch\.simulateStrap\} simulation=\{launch\.simulation\}>/);
});

test('the simulated strap: a delayed connect shows connecting, the drop happens once, reconnect waits out the drop', () => {
  assert.match(hook, /if \(delay\) \{\s+setState\('connecting'\);\s+await sleep\(delay\);/);
  assert.match(hook, /if \(!sim\?\.dropAtMs \|\| !sim\.dropForMs \|\| simDroppedRef\.current\) return conn;/);
  assert.match(hook, /simDownUntilRef\.current = Date\.now\(\) \+ dropForMs;\s+conn\.disconnect\(\);\s+handleDrop\(\);/);
  assert.match(hook, /if \(Date\.now\(\) < simDownUntilRef\.current\) throw/);
  // A silent reconnect never opens the picker and leaves the tap rule alone.
  const silent = hook.slice(hook.indexOf('const reconnectSilently'), hook.indexOf('const disconnect = useCallback'));
  assert.ok(silent.length > 200);
  assert.equal(/\bconnectHW9\(|requestDevice|skipSilentRef\.current = /.test(silent), false);
});
