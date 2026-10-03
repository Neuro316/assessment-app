// The media phase mode, the bookend wrapper, and the per-beat timestamp rule.
// Pure functions only; the player element itself is exercised in a browser.
import assert from 'node:assert/strict';
import test from 'node:test';

import { autoEndMs, manualEnd, withBookends } from '../src/pacer';
import type { MediaPhase, PacerProgram } from '../src/types';

const track: MediaPhase = { mode: 'media', asset: { kind: 'audio', src: 'https://example.test/t.mp3' } };
const cappedTrack: MediaPhase = { ...track, durationSec: 522 };
const slide: MediaPhase = { mode: 'media', asset: { kind: 'image', src: 'https://example.test/i.png' }, durationSec: 20 };
const page: MediaPhase = { mode: 'media', asset: { kind: 'text', text: 'Read this slowly.' }, minDurationSec: 10 };

test('media: a track with no duration never ends on its own; the player ends it', () => {
  assert.equal(autoEndMs(track), null);
});

test('media: durationSec caps a track and times an image step', () => {
  assert.equal(autoEndMs(cappedTrack), 522_000);
  assert.equal(autoEndMs(slide), 20_000);
});

test('media: a track offers Skip; a timed image step offers no button; an untimed text step unlocks after its minimum', () => {
  assert.deepEqual(manualEnd(track, 0), { label: 'Skip', enabled: true });
  assert.equal(manualEnd(slide, 5_000), null);
  assert.deepEqual(manualEnd(page, 4_000), { label: 'Continue', enabled: false });
  assert.deepEqual(manualEnd(page, 10_000), { label: 'Continue', enabled: true });
});

test('bookends: paced 90 s resonance before, quiet 180 s after, by default', () => {
  const inner: PacerProgram = { phases: [track] };
  const wrapped = withBookends(inner);
  assert.equal(wrapped.phases.length, 3);
  const [pre, mid, post] = wrapped.phases;
  assert.equal(pre.mode, 'paced');
  assert.equal(autoEndMs(pre), 90_000 - (90_000 % 11_000) + (90_000 % 11_000 ? 11_000 : 0)); // rounded up to whole 11 s breaths
  assert.equal(mid, track);
  assert.equal(post.mode, 'freeform');
  assert.equal(autoEndMs(post), 180_000);
});

test('bookends: zero disables a side; custom lengths are honoured', () => {
  const inner: PacerProgram = { phases: [track] };
  assert.equal(withBookends(inner, { preRollSec: 0 }).phases.length, 2);
  assert.equal(withBookends(inner, { postRollSec: 0 }).phases[1], track);
  assert.equal(autoEndMs(withBookends(inner, { postRollSec: 300 }).phases[2]), 300_000);
});

// The reconstruction rule the instrument applies to each packet, stated as a
// function here so it is pinned: last beat at arrival, earlier beats one interval
// further back each.
function stamp(arrival: number, rr: number[]): { t: number; rr: number }[] {
  let t = arrival;
  const out: { t: number; rr: number }[] = [];
  for (let i = rr.length - 1; i >= 0; i--) {
    out.unshift({ t, rr: rr[i] });
    t -= rr[i];
  }
  return out;
}

test('rr series: a three-interval packet is not stamped with one time', () => {
  const beats = stamp(10_000, [800, 820, 790]);
  assert.deepEqual(beats, [
    { t: 10_000 - 790 - 820, rr: 800 },
    { t: 10_000 - 790, rr: 820 },
    { t: 10_000, rr: 790 },
  ]);
  // Consecutive beats are exactly one interval apart.
  assert.equal(beats[1].t - beats[0].t, 820);
  assert.equal(beats[2].t - beats[1].t, 790);
});
