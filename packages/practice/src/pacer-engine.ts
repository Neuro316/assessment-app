// ===== PACER ENGINE =====
// Phase-based breath patterns and the tone-cue rule.
//
// RECONSTRUCTION NOTICE: an earlier version of this engine, plus a 16-exercise
// library built on it, a screen wake lock, and hold-session recording, was
// built and staged in a prior session but never committed — the session's
// container was reclaimed before it reached git, so the actual source is
// gone. What survives is a one-paragraph description of the tone-cue rule
// below and a table of per-exercise cue points. This file rebuilds that rule
// from that description; everything else from that prior work (the 16
// exercises' real phase structure, wake lock, hold recording) still needs to
// be rebuilt separately and verified against what Cameron actually had.

export type BreathPhaseKind = 'inhale' | 'hold' | 'exhale' | 'pause' | 'topUp';

export interface BreathPhase {
  kind: BreathPhaseKind;
  durationMs: number;
  // Shown to the user for this phase when it differs from a generic label
  // for its kind (e.g. "Final pause" rather than "Hold").
  label?: string;
}

export interface BreathPattern {
  phases: BreathPhase[];
}

export function breathDurationMs(pattern: BreathPattern): number {
  return pattern.phases.reduce((sum, p) => sum + p.durationMs, 0);
}

// A breath whose total duration is below this sounds a tone only once, as it
// begins. A breath at or above this length sounds a tone at the start of
// every phase. Below this threshold, cueing every phase turns into a buzz
// faster than a person can act on each tone — e.g. a 2s fast-pace breath
// cueing twice a second — so only the top-level breath boundary is marked;
// the other phases still run their full duration and are tracked silently,
// nothing sounds late relative to them.
export const MIN_FULLY_CUED_BREATH_MS = 3_500;

// Whether a tone should sound when `phaseIndex` of `pattern` begins.
export function cueFor(pattern: BreathPattern, phaseIndex: number): boolean {
  if (phaseIndex === 0) return true;
  return breathDurationMs(pattern) >= MIN_FULLY_CUED_BREATH_MS;
}
