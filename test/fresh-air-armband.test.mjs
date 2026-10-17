// ===== /fresh-air armband =====
// One armband connection owned by the shell (StrapProvider) and shared by both tabs:
// the state machine, the header pill's words, the unsupported path, and that the
// practice instrument keeps its own connection when it is not handed the shared one.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mock, test } from 'node:test';

import { STRAP_START, instrumentStrapState, strapEventFor, strapReducer } from '../packages/practice/src/strap-state.ts';
import { connectSimulated } from '../packages/practice/src/bluetooth.ts';
import { armbandPill, tabPress } from '../src/lib/fresh-air.ts';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const page = read('../src/app/fresh-air/page.tsx');
const sheet = read('../src/components/ArmbandSheet.tsx');
const provider = read('../packages/practice/src/StrapProvider.tsx');
const instrument = read('../packages/practice/src/PracticeInstrument.tsx');

const run = (events, from = STRAP_START) => events.reduce(strapReducer, from).state;
const ev = (type, stage) => (stage ? { type, stage } : { type });

// ----- the state machine -----

test('connecting through the picker: idle, connecting, connected', () => {
  assert.equal(STRAP_START.state, 'idle');
  assert.equal(run([ev('stage', 'searching')]), 'connecting');
  assert.equal(run([ev('stage', 'searching'), ev('stage', 'connecting')]), 'connecting');
  assert.equal(run([ev('stage', 'searching'), ev('stage', 'connecting'), ev('connected')]), 'connected');
});

test('a strap this origin knows reattaches silently: reconnecting, then connected', () => {
  assert.equal(run([ev('stage', 'reconnecting')]), 'reconnecting');
  assert.equal(run([ev('stage', 'reconnecting'), ev('connected')]), 'connected');
  // The silent route failed and the picker came up instead.
  assert.equal(run([ev('stage', 'reconnecting'), ev('stage', 'searching')]), 'connecting');
});

test('a dismissed or failed attempt goes back to idle', () => {
  assert.equal(run([ev('stage', 'searching'), ev('failed')]), 'idle');
  assert.equal(run([ev('stage', 'reconnecting'), ev('failed')]), 'idle');
});

test('a drop is lost, and stays lost through a failed retry, until it connects or is disconnected', () => {
  const dropped = [ev('stage', 'searching'), ev('connected'), ev('dropped')];
  assert.equal(run(dropped), 'lost');
  assert.equal(run([...dropped, ev('stage', 'reconnecting')]), 'reconnecting');
  assert.equal(run([...dropped, ev('stage', 'reconnecting'), ev('failed')]), 'lost');
  assert.equal(run([...dropped, ev('stage', 'searching'), ev('failed')]), 'lost');
  assert.equal(run([...dropped, ev('stage', 'reconnecting'), ev('connected')]), 'connected');
  assert.equal(run([...dropped, ev('stage', 'reconnecting'), ev('connected'), ev('stage', 'searching'), ev('failed')]), 'idle', 'a reconnect clears the drop');
  assert.equal(run([...dropped, ev('disconnected')]), 'idle');
});

test('a deliberate disconnect is idle, not lost', () => {
  assert.equal(run([ev('stage', 'searching'), ev('connected'), ev('disconnected')]), 'idle');
  assert.equal(run([ev('stage', 'searching'), ev('connected'), ev('disconnected'), ev('stage', 'searching'), ev('failed')]), 'idle');
});

test('unsupported is final', () => {
  const u = run([ev('unsupported')]);
  assert.equal(u, 'unsupported');
  for (const e of [ev('stage', 'searching'), ev('stage', 'reconnecting'), ev('connected'), ev('failed'), ev('dropped'), ev('disconnected')]) {
    assert.equal(run([ev('unsupported'), e]), 'unsupported', e.type);
  }
});

test("usePracticeStrap's states read as the reducer's events", () => {
  assert.deepEqual(strapEventFor('idle', 'unsupported'), { type: 'unsupported' });
  for (const s of ['reconnecting', 'searching', 'connecting']) assert.deepEqual(strapEventFor('idle', s), { type: 'stage', stage: s });
  assert.deepEqual(strapEventFor('connecting', 'connected'), { type: 'connected' });
  assert.deepEqual(strapEventFor('searching', 'error'), { type: 'failed' });
  // A dismissed picker lands on idle straight out of the attempt.
  assert.deepEqual(strapEventFor('searching', 'idle'), { type: 'failed' });
  assert.deepEqual(strapEventFor('reconnecting', 'idle'), { type: 'failed' });
  // Out of connected, idle is a drop or a disconnect, which the provider reports itself.
  assert.equal(strapEventFor('connected', 'idle'), null);
  assert.equal(strapEventFor('idle', 'idle'), null);
  assert.match(provider, /onDropped = useCallback\(\(\) => \{\s+dispatch\(\{ type: 'dropped' \}\);/);
  assert.match(provider, /disconnect = useCallback\(\(\) => \{\s+dispatch\(\{ type: 'disconnected' \}\);\s+hookDisconnect\(\);/);
});

test("the instrument's strap bar reads the shared state as it reads its own", () => {
  assert.equal(instrumentStrapState('connected', null), 'connected');
  assert.equal(instrumentStrapState('connecting', null), 'connecting');
  assert.equal(instrumentStrapState('reconnecting', null), 'reconnecting');
  assert.equal(instrumentStrapState('unsupported', null), 'unsupported');
  assert.equal(instrumentStrapState('idle', null), 'idle');
  assert.equal(instrumentStrapState('lost', null), 'idle', 'lost offers Connect');
  assert.equal(instrumentStrapState('idle', 'Tap Connect again to choose your armband.'), 'error');
  assert.equal(instrumentStrapState('lost', 'Could not connect to the armband.'), 'error');
});

// ----- the pill -----

test('the pill says what was agreed, in every state, at both widths', () => {
  for (const narrow of [false, true]) {
    assert.equal(armbandPill('idle', null, narrow).text, 'Connect armband');
    assert.equal(armbandPill('connecting', null, narrow).text, 'Connecting armband');
    assert.equal(armbandPill('reconnecting', null, narrow).text, 'Connecting armband');
    assert.equal(armbandPill('lost', 72, narrow).text, 'Armband disconnected');
    assert.equal(armbandPill('unsupported', null, narrow).text, 'Pacer only');
    for (const s of ['idle', 'connecting', 'reconnecting', 'lost', 'unsupported']) {
      assert.equal(armbandPill(s, 64, narrow).dot, false, s);
      assert.equal(armbandPill(s, 64, narrow).ariaLabel, null, s);
    }
  }
  assert.deepEqual(armbandPill('connected', 64, false), { text: 'Armband connected · 64 bpm', ariaLabel: null, dot: true });
  assert.deepEqual(armbandPill('connected', 64, true), {
    text: '64 bpm',
    ariaLabel: 'Armband connected, 64 beats per minute',
    dot: true,
  });
  // Connected before the first beat has arrived.
  assert.equal(armbandPill('connected', null, true).text, 'Armband connected');
});

test('the pill is a 44px button that opens the sheet, with an aria-hidden green dot, under 640px narrow', () => {
  assert.match(sheet, /<button\s+type="button"\s+data-armband-pill=\{strap\.state\}\s+onClick=\{onOpen\}/);
  assert.match(sheet, /aria-label=\{pill\.ariaLabel \?\? undefined\}/);
  assert.match(sheet, /minHeight: 44,/);
  assert.match(sheet, /const GREEN = '#2A9D8F';/);
  assert.match(sheet, /<span aria-hidden="true" style=\{\{ width: 8, height: 8, borderRadius: '50%', background: GREEN/);
  assert.match(sheet, /matchMedia\('\(max-width: 639px\)'\)/);
  assert.match(page, /armband=\{<ArmbandPill onOpen=\{\(\) => setArmbandOpen\(true\)\} \/>\}/);
});

// ----- the sheet -----

test('the sheet: a modal dialog, Escape closes, Tab stays inside, bottom sheet under 640px', () => {
  assert.match(sheet, /role="dialog"\s+aria-modal="true"/);
  assert.match(sheet, /if \(e\.key === 'Escape'\) \{\s+e\.preventDefault\(\);\s+onClose\(\);/);
  assert.match(sheet, /focusable\[next\]\.focus\(\);/);
  assert.match(sheet, /className="items-end sm:items-center sm:p-4"/);
  assert.match(sheet, /className="w-full rounded-t-2xl sm:max-w-\[440px\] sm:rounded-xl"/);
});

test('the sheet says what was agreed when not connected, and when connected', () => {
  assert.match(sheet, /Wet the strap pads, fasten it snug just below your chest, then tap Connect and choose your armband from the\s+list your browser shows\./);
  assert.match(sheet, /\{working \? 'Connecting armband' : 'Connect armband'\}/);
  assert.match(sheet, /onClick=\{\(\) => void strap\.connect\(\)\}/, 'connect runs straight from the tap');
  assert.match(sheet, />Signal clean\. Used by Practice and Assessment\.</);
  assert.match(sheet, /\{strap\.deviceName \?\? 'Armband'\}/);
  assert.match(sheet, /`\$\{strap\.heartRate\} bpm`/);
  assert.match(sheet, /<button type="button" onClick=\{strap\.disconnect\} style=\{secondary\}>\s+Disconnect\s+<\/button>/);
});

test('unsupported: Pacer only, the words for iPhone browsers, and a way to the pacer', () => {
  assert.equal(run([ev('unsupported')]), 'unsupported');
  assert.equal(armbandPill('unsupported', null, true).text, 'Pacer only');
  assert.match(
    sheet,
    /This browser cannot reach an armband\. You can still practice with the pacer and check in on how you feel\. To\s+measure, open Fresh Air in Chrome on a computer or an Android phone\./
  );
  assert.match(sheet, /onClick=\{onPracticeWithPacer\}[\s\S]*?Practice with the pacer/);
  // It closes the sheet and selects Practice, which never asks first.
  assert.match(page, /onPracticeWithPacer=\{\(\) => \{\s+setArmbandOpen\(false\);\s+selectTab\('practice'\);/);
  assert.equal(tabPress('assessment', 'practice', false), 'switch');
});

// ----- the instrument -----

test('without sharedStrap the instrument uses its own connection, exactly as before', () => {
  assert.match(instrument, /const internalStrap = usePracticeStrap\(\{ onData, onDropped, simulate: simulateStrap \}\);/);
  assert.match(instrument, /const strap: PracticeStrap = sharedStrap\s+\? \{[\s\S]*?\}\s+: internalStrap;/);
  // The shared connection feeds the same onData and onDropped, so rrSeries is stamped the same way.
  assert.match(instrument, /useEffect\(\(\) => subscribeShared\?\.\(\{ onData, onDropped \}\), \[subscribeShared, onData, onDropped\]\);/);
  assert.match(provider, /for \(const l of listenersRef\.current\) l\.onData\?\.\(data\);/);
});

test('flag off: no provider, no pill, no sheet, and the instrument is not handed a connection', () => {
  const off = page.slice(page.indexOf('if (!ASSESSMENT_TAB) {'), page.indexOf('// One armband connection, above both tabs'));
  assert.ok(off.length > 100);
  assert.equal(/StrapProvider|ArmbandPill|ArmbandSheet|armband=|sharedStrap/.test(off), false);
  assert.match(off, /\{instrument\(\)\}/);
  assert.match(page, /\{\.\.\.\(sharedStrap \? \{ sharedStrap \} : \{\}\)\}/, 'the prop is left off when there is none');
  const on = page.slice(page.indexOf('// One armband connection, above both tabs'));
  assert.match(on, /<StrapProvider simulate=\{launch\.simulateStrap\}>/);
});

// ----- what the package gained for the assessment -----

test('the simulated strap goes quiet while isMuted says so, and is unchanged without it', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const plain = [];
    const a = connectSimulated((d) => plain.push(d), () => {});
    mock.timers.tick(950 * 3);
    a.disconnect();
    assert.equal(plain.length, 3, 'practice passes no isMuted: a beat every 950ms');

    let muted = true;
    const got = [];
    const b = connectSimulated((d) => got.push(d), () => {}, { isMuted: () => muted });
    mock.timers.tick(950 * 3);
    assert.equal(got.length, 0);
    muted = false;
    mock.timers.tick(950 * 2);
    b.disconnect();
    assert.equal(got.length, 2);
    assert.equal(typeof got[0].timestamp, 'number');
    assert.equal(got[0].rrIntervals.length, 1);
  } finally {
    mock.timers.reset();
  }
});

test('no em dashes in the new copy or code', () => {
  for (const src of [sheet, provider, read('../packages/practice/src/strap-state.ts')]) assert.equal(/—/.test(src), false);
});
