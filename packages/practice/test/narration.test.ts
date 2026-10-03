// The narration scripts and how they become a guided session.
import assert from 'node:assert/strict';
import test from 'node:test';

import { NARRATION, guidedProgram, narrationManifest, spokenSec } from '../src/narration';
import { PRACTICE_LIBRARY } from '../src/library';
import { autoEndMs, withBookends } from '../src/pacer';

test('narration: every guided exercise has a script, and every script names a guided exercise', () => {
  const guided = PRACTICE_LIBRARY.filter((e) => e.kind === 'guided').map((e) => e.id).sort();
  assert.deepEqual(Object.keys(NARRATION).sort(), guided);
  for (const [id, s] of Object.entries(NARRATION)) assert.equal(s.exerciseId, id);
});

test('narration: segment ids are unique and prefixed by their exercise; no em dashes anywhere', () => {
  const ids = narrationManifest().map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const m of narrationManifest()) {
    assert.ok(m.id.startsWith(m.exerciseId + '-'), m.id);
    assert.ok(!m.text.includes('—'), `${m.id} has an em dash`);
    assert.ok(m.text.length > 40, `${m.id} is too short to be a segment`);
  }
});

test('narration: a resolved script becomes media phases with quiet between; an unresolved one falls back to timed text', () => {
  const script = NARRATION.V1;
  const withClips = guidedProgram(script, (id) => `https://media.test/${id}.mp3`);
  const textOnly = guidedProgram(script, () => null);
  // segment, quiet, segment, quiet ... last segment, quiet
  assert.equal(withClips.phases.length, script.segments.length * 2);
  assert.equal(withClips.phases[0].mode, 'media');
  assert.equal(withClips.phases[1].mode, 'freeform');
  assert.equal(autoEndMs(withClips.phases[1]), script.segments[0].pauseAfterSec * 1000);
  assert.equal(textOnly.phases[0].mode, 'freeform');
  assert.equal(autoEndMs(textOnly.phases[0]), spokenSec(script.segments[0].text) * 1000);
});

test('narration: a full guided session with bookends runs a few minutes, not seconds', () => {
  for (const script of Object.values(NARRATION)) {
    const program = withBookends(guidedProgram(script, () => null));
    const total = program.phases.reduce((s, p) => s + (autoEndMs(p) ?? 0), 0) / 1000;
    assert.ok(total >= 300 && total <= 900, `${script.exerciseId}: ${Math.round(total)} s`);
  }
});

// ----- programFor / narratorIdFor: what the instrument runs and records -----
import { NARRATOR_VOICES, narratorIdFor, programFor, PRACTICE_LIBRARY } from '@neuroprogeny/practice';

const V1 = PRACTICE_LIBRARY.find((e) => e.id === 'V1')!;
const B1 = PRACTICE_LIBRARY.find((e) => e.id === 'B1')!;
const allClips = (id: string) => `https://cdn.example/narration/${id}.mp3`;
const noClips = () => null;

test('programFor: a guided exercise with clips runs the narrated program inside bookends', () => {
  const p = programFor(V1, allClips);
  assert.notStrictEqual(p, V1.program);
  assert.strictEqual(p.phases[0].mode, 'paced', 'pre-roll first');
  assert.ok(p.phases.some((ph) => ph.mode === 'media'), 'clips as media phases');
  const last = p.phases[p.phases.length - 1];
  assert.strictEqual(last.mode, 'freeform', 'quiet post-roll last');
});

test('programFor: no resolver, or a resolver with no clips, leaves the exercise program alone', () => {
  assert.strictEqual(programFor(V1, undefined), V1.program);
  assert.strictEqual(programFor(V1, noClips), V1.program);
});

test('programFor: a breathing exercise is never narrated, resolver or not', () => {
  assert.strictEqual(programFor(B1, allClips), B1.program);
  assert.strictEqual(narratorIdFor(B1, allClips), null);
});

test('narratorIdFor: the voice of the script that played, null when nothing played', () => {
  assert.strictEqual(narratorIdFor(V1, allClips), NARRATOR_VOICES.interoceptive.voiceId);
  assert.strictEqual(narratorIdFor(V1, noClips), null);
  assert.strictEqual(narratorIdFor(V1, undefined), null);
});
