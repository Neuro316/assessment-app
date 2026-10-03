// ===== ACTIVATING BREATHING PATTERNS =====
//
// These are NEW designs, not reconstructed. The lost session had apparently
// built activating exercises (previously guessed at under the codes B13-B16
// in an earlier pass of this rebuild), but per Cameron (2026-10-03): he had
// never reviewed or approved that work, and nothing about its actual design
// survives anywhere checked (git, Vercel, Claude Docs, this chat). So rather
// than keep guessing at B13-B16's structure, this file designs the
// activating set fresh, directly from real technique research, per Cameron's
// 2026-10-02 request to add Tummo breath and Wim Hof-style breathing by
// name.
//
// Deliberately coded A1/A2 rather than B13/B16 etc. — these are not in "The
// Breathing Library" PDF (which is B1-B12 only) and don't belong in that
// numbering; using fresh codes avoids implying continuity with the
// unreviewed, unrecoverable earlier design.
//
// Sourcing: both techniques have no single canonical timing — practice
// guides vary, and even official sources invite customization ("play around
// with the number of breaths, the tempo... until you find a routine that
// works best for you" — wimhofmethod.com). The structures below are the
// commonly-taught baseline from those sources, not a single fixed standard.
// Read mechanism-of-effect claims as hypothesized, per Cameron's 2026-10-02
// instruction, not proven.
//
// Sources:
//   - Wim Hof Method, official breathing exercise guide:
//     https://www.wimhofmethod.com/breathing-exercises
//   - Tummo breathing structure (rapid-breath + retention protocol):
//     https://www.coherencebreath.com/breathwork/tummo
//
// Both are EXTREMELY ACTIVATING. Per Cameron's 2026-10-03 instruction, they
// keep their own fixed round structure (no duration picker) and — per
// earlier project notes — should be gated behind a person's recent
// biometrics showing a balanced baseline before they're offered, not by
// membership tier alone. That gating is a host-side decision; this file
// only marks `extremelyActivating: true`.

import type { PracticeBreathExercise } from './extended-breath-patterns';

export const ACTIVATING_PATTERNS: Record<string, PracticeBreathExercise> = {
  // Wim Hof-style breathing. Source: wimhofmethod.com/breathing-exercises.
  // Round: 30 full, unforced breaths (nasal or mouth inhale, passive
  // exhale), then a retention held until the urge to breathe returns (no
  // fixed length — openEndedHold), then one large recovery inhale held 15s.
  // The source gives no exact per-breath pace; 1.5s in / 1.5s out (3s per
  // breath, ~90s for 30 breaths) is a commonly-taught baseline tempo, not a
  // value the source itself specifies — flagged as ASSUMED precision, same
  // as the physiological sigh's internal timing in extended-breath-patterns.
  A1: {
    code: 'A1',
    title: 'Wim Hof-Style Breathing',
    mechanism: 'Hyperventilation followed by breath retention under hypocapnia is hypothesized to shift autonomic balance and build tolerance to controlled physiological stress.',
    stages: [
      {
        pattern: { phases: [{ kind: 'inhale', durationMs: 1_500 }, { kind: 'exhale', durationMs: 1_500 }] },
        repeatCycles: 30,
      },
      {
        pattern: { phases: [{ kind: 'hold', durationMs: 0, label: 'Retention — hold until the urge to breathe' }] },
        openEndedHold: true,
      },
      {
        pattern: { phases: [{ kind: 'inhale', durationMs: 3_000, label: 'Recovery breath' }, { kind: 'hold', durationMs: 15_000 }] },
      },
    ],
    extremelyActivating: true,
  },

  // Tummo-style rapid breathing. Source: coherencebreath.com/breathwork/tummo
  // ("basic" protocol: 15 rapid breaths at 1.5s in / 1.5s out, then a fixed
  // 60s retention, then a 6s deep inhale and 15s hold). Unlike A1's
  // retention, this source specifies a fixed hold length rather than
  // "until the urge returns," so it's modeled as a fixed-duration stage,
  // not openEndedHold — ending it early is a genuine abandonment, so this
  // is the one activating exercise where hold-recording's 'abandoned'
  // outcome actually applies the way it was described in the lost session.
  A2: {
    code: 'A2',
    title: 'Tummo-Style Breathing',
    mechanism: 'Traditionally paired with inner-fire visualization; the rapid-breath-plus-retention structure is hypothesized to drive a similar hypocapnic/hyperoxic shift to Wim Hof-style breathing.',
    stages: [
      {
        pattern: { phases: [{ kind: 'inhale', durationMs: 1_500 }, { kind: 'exhale', durationMs: 1_500 }] },
        repeatCycles: 15,
      },
      {
        pattern: { phases: [{ kind: 'hold', durationMs: 60_000, label: 'Retention' }] },
      },
      {
        pattern: { phases: [{ kind: 'inhale', durationMs: 6_000, label: 'Deep recovery breath' }, { kind: 'hold', durationMs: 15_000 }] },
      },
    ],
    extremelyActivating: true,
  },
};
