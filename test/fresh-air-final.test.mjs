// ===== /fresh-air, stage 2 final follow-up =====
// Every armband state fits beside the pace pill on a phone; a missing metric says
// "Not recorded"; and the sheet tells people how to wear an optical armband, not a
// chest strap.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { armbandPill } from '../src/lib/fresh-air.ts';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const sheet = read('../src/components/ArmbandSheet.tsx');
const instrument = read('../packages/practice/src/PracticeInstrument.tsx');

// ----- 1. phone labels -----

test('under 640px connecting and reconnecting read "Connecting", with the full words as the label', () => {
  for (const s of ['connecting', 'reconnecting']) {
    assert.deepEqual(armbandPill(s, null, true), { text: 'Connecting', ariaLabel: 'Connecting armband', dot: false }, s);
    assert.deepEqual(armbandPill(s, null, false), { text: 'Connecting armband', ariaLabel: null, dot: false }, s);
  }
});

test('under 640px lost reads "Reconnect", labelled as disconnected and tappable', () => {
  assert.deepEqual(armbandPill('lost', 70, true), {
    text: 'Reconnect',
    ariaLabel: 'Armband disconnected, tap to reconnect',
    dot: false,
  });
  assert.deepEqual(armbandPill('lost', 70, false), { text: 'Armband disconnected', ariaLabel: null, dot: false });
});

test('connected before the first beat reads "Connected" under 640px', () => {
  assert.deepEqual(armbandPill('connected', null, true), { text: 'Connected', ariaLabel: 'Armband connected', dot: true });
  assert.deepEqual(armbandPill('connected', null, false), { text: 'Armband connected', ariaLabel: null, dot: true });
});

test('every narrow pill is short: at most 10 characters', () => {
  for (const s of ['idle', 'connecting', 'reconnecting', 'lost', 'unsupported', 'connected']) {
    for (const bpm of [188, null]) {
      const t = armbandPill(s, bpm, true).text;
      assert.ok(t.length <= 10, `${s}: "${t}"`);
    }
  }
});

// ----- 2. missing metric -----

test('a metric the session did not record says "Not recorded", in the value\'s own style', () => {
  assert.match(
    instrument,
    /<span style=\{\{ color: C\.indigo, fontWeight: 600 \}\}>\s+\{value === null \? 'Not recorded' : `\$\{value\}\$\{unit \? ` \$\{unit\}` : ''\}`\}/
  );
  assert.equal(/value === null \? '·'/.test(instrument), false);
});

// ----- 3. armband copy -----

test('the sheet tells people how to wear the optical armband', () => {
  assert.match(
    sheet,
    /Put the armband on your forearm or upper arm, snug against bare skin with the sensor facing in, then tap\s+Connect and choose it from the list your browser shows\./
  );
});

test('no copy in the app or the practice package tells people to wet pads or wear a chest strap', () => {
  const roots = ['../src', '../packages/practice/src'].map((p) => fileURLToPath(new URL(p, import.meta.url)));
  const files = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f)) files.push(p);
    }
  };
  roots.forEach(walk);
  const offenders = [];
  for (const f of files) {
    readFileSync(f, 'utf8')
      .split(/\r?\n/)
      .forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        if (/wet the|strap pads|chest strap|below your chest|around your chest/i.test(line)) offenders.push(`${f}:${i + 1}`);
      });
  }
  assert.deepEqual(offenders, []);
});
