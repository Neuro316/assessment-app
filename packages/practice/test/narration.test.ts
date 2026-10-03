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
