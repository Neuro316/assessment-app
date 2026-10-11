// ===== /fresh-air =====
// The standalone practice route: gated like the assessment (embedded=true) plus a
// required launch token, the pace from the link on the intro (or nothing), and exactly
// one practice-complete per finished session carrying { type, completionId, appSha, record },
// plus ageBand when the launch carried one.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  buildPracticeComplete,
  freshAirAccess,
  narrationUrl,
  oncePerRecord,
  parseFreshAirLaunch,
} from '../src/lib/fresh-air.ts';
import { launchAgeBand } from '../src/lib/age-band.ts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PRACTICE_EXERCISES, PracticeInstrument, narrationManifest, strapModeFor } from '../packages/practice/dist/index.js';

const launch = (q) => parseFreshAirLaunch(new URLSearchParams(q));
const page = readFileSync(new URL('../src/app/fresh-air/page.tsx', import.meta.url), 'utf8');
const instrument = readFileSync(new URL('../packages/practice/src/PracticeInstrument.tsx', import.meta.url), 'utf8');

// ----- one post per session, with exactly the agreed keys -----

test('a finished session posts exactly once, with type, completionId, appSha and record', () => {
  const posted = [];
  const post = oncePerRecord((record) => posted.push(buildPracticeComplete(record, `id-${posted.length}`, 'abc123')));
  const record = { exerciseId: 'B1' };
  assert.equal(post(record), true);
  // Done and then the unmount flush hand over the same record: still one post.
  assert.equal(post(record), false);
  assert.equal(posted.length, 1);
  assert.deepEqual(Object.keys(posted[0]), ['type', 'completionId', 'appSha', 'record']);
  assert.equal(posted[0].type, 'practice-complete');
  assert.equal(posted[0].record, record);
  // control: a second session is a second post, with its own id
  post({ exerciseId: 'V1' });
  assert.equal(posted.length, 2);
  assert.notEqual(posted[0].completionId, posted[1].completionId);
});

test('the page posts through the guard, to the platform origin only, with a fresh UUID each time', () => {
  assert.match(page, /oncePerRecord<PracticeSessionRecord>/);
  assert.match(page, /buildPracticeComplete\(record, newCompletionId\(\), APP_SHA, /);
  assert.match(page, /crypto\.randomUUID\(\)/);
  assert.match(page, /window\.parent\.postMessage\(message, targetOrigin\)/);
  assert.match(page, /new URL\(PLATFORM_URL\)\.origin/);
  assert.equal((page.match(/postMessage\(/g) || []).length, 1, 'one call site');
});

// ----- ageBand -----

const band = (q) => launchAgeBand(new URLSearchParams(q));

test('a launch with age_band=40s posts ageBand 40s; a launch without posts no ageBand key', () => {
  const withBand = buildPracticeComplete({ exerciseId: 'B1' }, 'id-1', 'sha', band('embedded=true&age_band=40s'));
  assert.equal(withBand.ageBand, '40s');
  assert.deepEqual(Object.keys(withBand), ['type', 'completionId', 'appSha', 'record', 'ageBand']);
  const without = buildPracticeComplete({ exerciseId: 'B1' }, 'id-2', 'sha', band('embedded=true'));
  assert.equal('ageBand' in without, false);
  assert.equal('ageBand' in JSON.parse(JSON.stringify(without)), false, 'not even as null on the wire');
  // control: a band that is not one of the assessment's is dropped, not sent
  assert.equal('ageBand' in buildPracticeComplete({}, 'id-3', 'sha', band('age_band=45')), false);
  for (const b of ['under30', '30s', '40s', '50s', '60plus']) assert.equal(buildPracticeComplete({}, 'i', null, band(`age_band=${b}`)).ageBand, b);
  assert.match(page, /buildPracticeComplete\(record, newCompletionId\(\), APP_SHA, ageBandRef\.current\)/);
  assert.match(page, /ageBandRef\.current = launchAgeBand\(params\)/);
});

// ----- strapMode -----

test('a sim session records strapMode sim; a pacer session still none; the HW9 still ble', () => {
  assert.equal(strapModeFor(127, true), 'sim');
  assert.equal(strapModeFor(0, true), 'none', 'sim offered but the pacer alone: no beats, none');
  assert.equal(strapModeFor(0, false), 'none');
  assert.equal(strapModeFor(583, false), 'ble', 'control: a real strap is unchanged');
  assert.match(instrument, /strapMode: strapModeFor\(rr\.length, simulateStrap\)/);
});

test('the strapMode type still refuses any other string', () => {
  const types = fileURLToPath(new URL('../packages/practice/src/types.ts', import.meta.url)).replace(/\\/g, '/');
  const tsc = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'strapmode-'));
  const check = (body) => {
    const file = join(dir, `c${Math.random().toString(36).slice(2)}.ts`);
    writeFileSync(file, `import type { PracticeSamplesSummary } from '${types.replace(/\.ts$/, '')}';\n${body}\n`);
    return spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck', '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler', file], { encoding: 'utf8' });
  };
  const ok = check(`const a: PracticeSamplesSummary['strapMode'][] = ['ble', 'sim', 'none'];`);
  assert.equal(ok.status, 0, ok.stdout);
  const bad = check(`const a: PracticeSamplesSummary['strapMode'] = 'usb';`);
  assert.notEqual(bad.status, 0, 'usb must not type-check');
  assert.match(bad.stdout, /'"usb"' is not assignable/);
  assert.notEqual(check(`const a: PracticeSamplesSummary['strapMode'] = 'Sim';`).status, 0, 'case matters');
});

// ----- the pace -----

// The intro as the page renders it, with the pace the launch link carried.
const intro = (q) =>
  renderToStaticMarkup(
    createElement(PracticeInstrument, {
      baseline: { resonanceFreq: launch(q).pace },
      exercises: PRACTICE_EXERCISES,
      canUseExercise: () => 'program',
      onRecordSession: () => {},
      onNeedsBaseline: () => {},
    })
  );

test('pace absent renders no pace line; a pace on the link is shown as the resonance pace', () => {
  assert.equal(/resonance rate/i.test(intro('embedded=true&token=t')), false);
  assert.equal(/Take the capacity assessment/.test(intro('embedded=true&token=t')), false, 'no prompt either');
  // control: the same render with a pace shows it
  assert.match(intro('embedded=true&token=t&pace=5.5'), /Your resonance rate: 5\.5 breaths \/ min/);
});

test('only the six swept paces are accepted; anything else shows nothing', () => {
  for (const p of ['4.5', '5', '5.5', '6', '6.5', '7']) assert.equal(launch(`pace=${p}`).pace, Number(p));
  for (const p of ['8', '5.25', '0', 'abc', '', '6.0.1', '-5']) assert.equal(launch(`pace=${p}`).pace, null, p);
  assert.equal(intro('pace=8').includes('resonance rate'), false);
  assert.match(page, /baseline=\{\{ resonanceFreq: launch\.pace \}\}/);
});

test('no biometrics param: the armband is the person\'s choice, never set by the link', () => {
  assert.equal(/biometrics/.test(page.replace(/\/\/.*$/gm, '')), false);
  assert.equal('biometricsEnabled' in launch('biometrics=0'), false);
  assert.match(page, /simulateStrap=\{launch\.simulateStrap\}/);
});

// ----- the token gate -----

test('a missing token is refused like the assessment refuses a launch outside the University', () => {
  assert.equal(freshAirAccess(launch('embedded=true'), null), 'refused');
  assert.equal(freshAirAccess(launch('embedded=true&token='), null), 'refused');
  assert.equal(freshAirAccess(launch('token=t'), true), 'refused', 'embedded=true still required');
  assert.equal(freshAirAccess(launch('embedded=true&token=t'), false), 'refused', 'a rejected token');
  assert.equal(freshAirAccess(launch('embedded=true&token=t'), null), 'checking');
  assert.equal(freshAirAccess(launch('embedded=true&token=t'), true), 'allowed', 'control');
  // Refused renders the same gate screen the assessment uses, and nothing else.
  assert.match(page, /if \(access === 'refused'\) return <GateScreen \{\.\.\.FRESH_AIR_GATE\} \/>;/);
  assert.match(page, /fetch\('\/api\/verify-launch'/);
});

test('the route is not behind the practice test page flag', () => {
  assert.equal(/isPracticeTestPageEnabled|PRACTICE_TEST_PAGE/.test(page), false);
});

// ----- narration -----

test('narration resolves to <base>/<role>/<segment>.mp3, and is silent without a base', () => {
  assert.equal(narrationUrl('https://cdn.example/n', 'interoceptive', 'V1-1'), 'https://cdn.example/n/interoceptive/V1-1.mp3');
  assert.equal(narrationUrl('https://cdn.example/n/', 'active', 'V2-3'), 'https://cdn.example/n/active/V2-3.mp3');
  assert.equal(narrationUrl(undefined, 'active', 'V2-3'), null);
  assert.equal(narrationUrl('', 'active', 'V2-3'), null);
  assert.equal(narrationManifest().length, 63, 'control: the 63 clips the base must hold');
  assert.match(page, /NEXT_PUBLIC_NARRATION_BASE/);
  assert.match(page, /Narration is unavailable right now\./);
});

test('appSha comes from the build: NEXT_PUBLIC_APP_SHA, else VERCEL_GIT_COMMIT_SHA', () => {
  const config = readFileSync(new URL('../next.config.js', import.meta.url), 'utf8');
  assert.match(config, /NEXT_PUBLIC_APP_SHA: process\.env\.NEXT_PUBLIC_APP_SHA \|\| process\.env\.VERCEL_GIT_COMMIT_SHA/);
  assert.match(page, /const APP_SHA = process\.env\.NEXT_PUBLIC_APP_SHA \|\| null/);
});

test('no em dashes in the copy Fresh Air shows', () => {
  const strings = page.match(/'[^'\n]*'/g).join('') + (page.match(/>[^<{]+</g) || []).join('');
  assert.equal(/—/.test(strings), false);
});
