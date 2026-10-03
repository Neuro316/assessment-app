// ===== EXTENDED BREATH PATTERNS (B1-B16) =====
//
// RECONSTRUCTION NOTICE — read before trusting any value in this file.
//
// The real 16-exercise library (names, mechanisms, and per-exercise phase
// timings) was built and tested in a prior session but never committed, and
// that session's container was reclaimed before the work reached git. The
// only thing that survived is a prose summary of one later change, which
// happened to include a table of cue points for some exercises. This file
// reconstructs ONLY the patterns that table actually specified. Everything
// else is either omitted (if nothing at all survived) or marked ASSUMED (if
// only the total breath length survived, not how it's split into phases).
//
// Do not treat anything below as restored. Confirm every pattern against
// what Cameron actually had before this ships to a participant.
//
// Confirmed totals + cue points, from the recovered summary:
//   B13            3s   inhale-only cue (was every 1.5s before the fix)
//   B16 Fast       2s   inhale-only cue
//   B16 Medium     3s   inhale-only cue
//   B14 "Pulses"   2s   inhale-only cue
//   B10 "Brisk"    2.5s inhale-only cue
//   B2, B3, B12    9s   cue at 0s (inhale), 2s (top-up), 3s (exhale start)
//   B7             8s   cue at 0s (inhale), 3s (final pause), 4s (exhale start)
//   B5 "box"       16s  cue at every 4s boundary (4 equal parts)
//   B1             11s  cue at 0s (inhale) and 5.5s (exhale) — even split
//
// NOT reconstructed at all (no data survived): B4, B6, B8, B9, B11, B15, and
// any B16 variant besides Fast/Medium (e.g. a possible "Slow"). B4 in
// particular is notable because it exists in Cameron's original 12-technique
// library (see /areas/practice-app.md) but its pacer timing wasn't in what
// survived — don't assume it's missing from the real library, only that this
// file doesn't have its numbers.

import type { BreathPattern } from './pacer-engine';

function sighPattern(): BreathPattern {
  // 9s total: short inhale, a brief top-up (a second inhale pulse), long
  // exhale. CONFIRMED total + cue points (0s / 2s / 3s); the exact split of
  // the remaining 6s exhale vs. where the top-up ends is the simplest
  // reading of those three cue points, not independently confirmed.
  return {
    phases: [
      { kind: 'inhale', durationMs: 2_000 },
      { kind: 'topUp', durationMs: 1_000, label: 'Top-up' },
      { kind: 'exhale', durationMs: 6_000 },
    ],
  };
}

export const EXTENDED_BREATH_PATTERNS: Record<string, BreathPattern> = {
  // CONFIRMED: 11s total, cue at 0s and 5.5s. The even inhale/exhale split
  // is the natural reading of two cue points 5.5s apart on an 11s breath.
  B1: {
    phases: [
      { kind: 'inhale', durationMs: 5_500 },
      { kind: 'exhale', durationMs: 5_500 },
    ],
  },

  // CONFIRMED pattern (see sighPattern above). Same pattern used for all
  // three sigh-family exercises per the recovered table.
  B2: sighPattern(),
  B3: sighPattern(),
  B12: sighPattern(),

  // CONFIRMED: 16s total, four equal 4s parts, cued at every boundary —
  // standard box breathing (inhale / hold / exhale / hold-empty).
  B5: {
    phases: [
      { kind: 'inhale', durationMs: 4_000 },
      { kind: 'hold', durationMs: 4_000 },
      { kind: 'exhale', durationMs: 4_000 },
      { kind: 'pause', durationMs: 4_000, label: 'Hold (empty)' },
    ],
  },

  // CONFIRMED: 8s total, cue at 0s / 3s / 4s — inhale, a pause just before
  // exhaling, then the exhale.
  B7: {
    phases: [
      { kind: 'inhale', durationMs: 3_000 },
      { kind: 'pause', durationMs: 1_000, label: 'Final pause' },
      { kind: 'exhale', durationMs: 4_000 },
    ],
  },

  // CONFIRMED total only (2.5s, inhale-cue-only). ASSUMED even inhale/exhale
  // split — the recovered table gives no internal phase breakdown.
  B10: {
    phases: [
      { kind: 'inhale', durationMs: 1_250 },
      { kind: 'exhale', durationMs: 1_250 },
    ],
  },

  // CONFIRMED total only (3s, inhale-cue-only). ASSUMED even split. Name and
  // mechanism for B13 did not survive at all.
  B13: {
    phases: [
      { kind: 'inhale', durationMs: 1_500 },
      { kind: 'exhale', durationMs: 1_500 },
    ],
  },

  // CONFIRMED total + name only (2s, "Pulses", inhale-cue-only). ASSUMED
  // even split — "Pulses" strongly suggests this is NOT a plain
  // inhale/exhale breath (more likely a Tummo-style rapid pulsed pattern per
  // Cameron's 2026-10-02 request to add Tummo/Wim-Hof-style techniques), so
  // this placeholder split is likely wrong in shape, not just in numbers.
  B14: {
    phases: [
      { kind: 'inhale', durationMs: 1_000 },
      { kind: 'exhale', durationMs: 1_000 },
    ],
  },

  // CONFIRMED total only (2s, inhale-cue-only). ASSUMED even split.
  B16_FAST: {
    phases: [
      { kind: 'inhale', durationMs: 1_000 },
      { kind: 'exhale', durationMs: 1_000 },
    ],
  },

  // CONFIRMED total only (3s, inhale-cue-only). ASSUMED even split.
  B16_MEDIUM: {
    phases: [
      { kind: 'inhale', durationMs: 1_500 },
      { kind: 'exhale', durationMs: 1_500 },
    ],
  },
};
