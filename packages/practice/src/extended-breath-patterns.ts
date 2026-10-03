// ===== BREATHING LIBRARY PATTERNS (B1-B12) =====
//
// Rebuilt directly from "The Breathing Library" (Breathing_library.pdf,
// Cameron's source document), not from the lost session's summary. That PDF
// is the authoritative source for B1-B12; where it conflicts with what
// survived from the lost session, the PDF wins and the conflict is called
// out explicitly below.
//
// B8 (Nasal Only Walking) and B9 (The Carbon Dioxide Tolerance Walk) are
// deliberately NOT included here — both require walking, and Cameron asked
// (2026-10-03) to remove walking-based exercises for now. B9 is notable
// because it's the exercise named in the lost session's hold-recording test
// ("Start B9, tap End early mid-hold...") — that test can't be re-run
// against the real B9 until walking exercises come back in scope, but the
// hold-recording mechanism itself still applies to B5's hold phases.
//
// The activating techniques (previously guessed at as B13-B16) are NOT in
// this PDF at all — confirmed: this is the original 12-technique library,
// and the activating set was a separate, later addition that was never
// reviewed by Cameron and has no surviving spec. They are being redesigned
// from scratch in activating-patterns.ts, not reconstructed here.

import type { BreathPattern } from './pacer-engine';

export interface ExerciseStage {
  pattern: BreathPattern;
  // Exactly one of durationMs / repeatCycles / openEndedHold should be set,
  // matching how the technique itself is specified.
  durationMs?: number;
  repeatCycles?: number;
  // A hold with no planned length — the person ends it themselves when
  // they feel the urge to breathe (e.g. Wim Hof-style retention). Distinct
  // from a fixed-duration hold ended early: there is no "early" here, so
  // this always resolves as hold-recording's endedBy: 'completed', whatever
  // the actual elapsed time, never 'abandoned'.
  openEndedHold?: boolean;
}

export interface PracticeBreathExercise {
  code: string;
  title: string;
  // One line, from the source's "Why it works" / "What it teaches", for
  // display — not the full paragraph.
  mechanism: string;
  stages: ExerciseStage[];
  // True for a technique that is one cued breath, not a loop (B6). Ignore
  // selectableDurationsMin/defaultDurationMin when this is true.
  singleBreath?: boolean;
  // Minutes the person can choose, per Cameron's 2026-10-03 instruction
  // that non-extremely-activating exercises should offer common session
  // lengths rather than one fixed duration. Only set on exercises whose
  // last stage is a simple loop (not a fixed multi-stage sequence like B11).
  selectableDurationsMin?: number[];
  defaultDurationMin?: number;
  // Per Cameron's 2026-10-03 instruction: extremely activating exercises
  // keep their own fixed round/rep structure rather than offering a
  // duration picker, and should be gated behind a person's recent
  // biometrics showing a balanced baseline (per prior project notes) —
  // that gating is a host/UI decision, this flag just marks eligibility.
  extremelyActivating?: boolean;
}

function sighStage(): BreathPattern {
  // The PDF gives no explicit seconds for the physiological sigh (just
  // "one full inhale, a second shorter inhale stacked on top, a long slow
  // exhale"). The 9s/2s-top-up/3s/9s-total timing is what survived from the
  // lost session's engine and isn't contradicted by the PDF, so it's kept,
  // marked as ASSUMED precision rather than a PDF-confirmed value.
  return {
    phases: [
      { kind: 'inhale', durationMs: 2_000 },
      { kind: 'topUp', durationMs: 1_000, label: 'Second inhale' },
      { kind: 'exhale', durationMs: 6_000 },
    ],
  };
}

export const BREATHING_LIBRARY: Record<string, PracticeBreathExercise> = {
  // CONFIRMED (PDF): ~5.5s in / ~5.5s out through the nose, ~6 breaths/min.
  // Matches what survived from the lost session exactly.
  B1: {
    code: 'B1',
    title: 'Resonance Breathing',
    mechanism: 'Breath rhythm and heart rhythm align near 6 br/min, raising HRV amplitude for most people.',
    stages: [{ pattern: { phases: [{ kind: 'inhale', durationMs: 5_500 }, { kind: 'exhale', durationMs: 5_500 }] } }],
    selectableDurationsMin: [3, 5, 10, 20],
    defaultDurationMin: 5,
  },

  // CONFIRMED (PDF): one full inhale, a second shorter inhale stacked on
  // top, then a long slow exhale to empty. "One to three cycles is usually
  // enough" — so this is short by nature, not duration-selectable.
  B2: {
    code: 'B2',
    title: 'The Physiological Sigh',
    mechanism: 'The second inhale reinflates collapsed air sacs; the long exhale clears more CO2 than a single breath, lowering arousal fast.',
    stages: [{ pattern: sighStage(), repeatCycles: 3 }],
  },

  // CONFIRMED (PDF): the physiological sigh repeated continuously for 5
  // minutes, exhale kept longer than the combined inhales throughout.
  B3: {
    code: 'B3',
    title: 'Cyclic Sighing',
    mechanism: 'Five minutes of repeated sighs outperforms equivalent passive meditation on mood and resting respiratory rate for many people.',
    stages: [{ pattern: sighStage() }], // looped for the selected duration
    selectableDurationsMin: [3, 5, 10, 20],
    defaultDurationMin: 5,
  },

  // CONFIRMED (PDF): inhale 4 counts, exhale 8 counts (start at 6 if 8 is a
  // strain — the app's fixed pacer uses the target 4:8, not the ramp-up).
  B4: {
    code: 'B4',
    title: 'The Extended Exhale',
    mechanism: 'A longer exhale lengthens the interval between heartbeats via vagal influence, settling the system without any change in thought.',
    stages: [{ pattern: { phases: [{ kind: 'inhale', durationMs: 4_000 }, { kind: 'exhale', durationMs: 8_000 }] } }],
    selectableDurationsMin: [3, 5, 10, 20],
    defaultDurationMin: 5,
  },

  // CONFIRMED (PDF + lost session, exact match): inhale 4, hold 4, exhale
  // 4, hold 4.
  B5: {
    code: 'B5',
    title: 'Box Breathing',
    mechanism: 'The equal ratio and the counting occupy working memory, leaving less bandwidth for rehearsing outcomes while the body settles.',
    stages: [
      {
        pattern: {
          phases: [
            { kind: 'inhale', durationMs: 4_000 },
            { kind: 'hold', durationMs: 4_000 },
            { kind: 'exhale', durationMs: 4_000 },
            { kind: 'pause', durationMs: 4_000, label: 'Hold (empty)' },
          ],
        },
      },
    ],
    selectableDurationsMin: [3, 5, 10, 20],
    defaultDurationMin: 5,
  },

  // CONFIRMED (PDF): ONE nasal inhale of ~4s, ONE exhale of ~6s. Not a
  // loop — it's a single cued breath meant to live inside a routine.
  B6: {
    code: 'B6',
    title: 'The One Breath Reset',
    mechanism: 'One breath is enough to interrupt an escalating prediction loop, especially paired with a fixed point in a routine.',
    stages: [{ pattern: { phases: [{ kind: 'inhale', durationMs: 4_000 }, { kind: 'exhale', durationMs: 6_000 }] } }],
    singleBreath: true,
  },

  // CONFLICT, NOT RESOLVED: the PDF's real B7 ("Breath to Tempo Coupling")
  // has no fixed duration at all — inhale completes during the last look at
  // the target, exhale begins as the swing starts and continues through
  // impact. It cannot be represented as a fixed-duration pacer pattern the
  // way the lost session's engine implies (8s: inhale 3s / pause 1s / exhale
  // 4s). That recovered pattern is kept below under a distinct key, clearly
  // NOT labeled as B7, pending Cameron confirming what it actually was
  // (possibly a training-mode stand-in for B7, or an unrelated exercise).
  //
  // B7_UNCONFIRMED_PATTERN: {
  //   phases: [
  //     { kind: 'inhale', durationMs: 3_000 },
  //     { kind: 'pause', durationMs: 1_000, label: 'Final pause' },
  //     { kind: 'exhale', durationMs: 4_000 },
  //   ],
  // },

  // CONFIRMED (PDF), multi-stage: 15-20 slightly-faster nasal inhales with
  // passive exhales, THEN one minute of resonance breathing (B1's pattern).
  // The lost session's "2.5s inhale-only cue" data is plausible as the fast
  // phase's pace (24 br/min, notably faster than 6 br/min resonance) and is
  // kept for that stage; the return-to-resonance stage was never in the
  // recovered data and is added here from the PDF directly.
  B10: {
    code: 'B10',
    title: 'Gentle Up Regulation',
    mechanism: 'Arousal is not the enemy of performance — this deliberately raises alertness rather than waiting for adrenaline to arrive uninvited.',
    stages: [
      {
        pattern: { phases: [{ kind: 'inhale', durationMs: 1_250 }, { kind: 'exhale', durationMs: 1_250 }] },
        repeatCycles: 18, // midpoint of the PDF's "fifteen to twenty"
      },
      {
        pattern: { phases: [{ kind: 'inhale', durationMs: 5_500 }, { kind: 'exhale', durationMs: 5_500 }] },
        durationMs: 60_000,
      },
    ],
  },

  // CONFIRMED (PDF), multi-stage: three one-minute stages at increasing
  // exhale ratios (4:4, 4:6, 4:8), to find which ratio settles a given
  // person best. Not duration-selectable — the three-minute structure is
  // the point of the technique.
  B11: {
    code: 'B11',
    title: 'The Ratio Ladder',
    mechanism: 'The exhale length that settles a person best differs between people and changes with fitness and fatigue — this finds theirs.',
    stages: [
      { pattern: { phases: [{ kind: 'inhale', durationMs: 4_000 }, { kind: 'exhale', durationMs: 4_000 }] }, durationMs: 60_000 },
      { pattern: { phases: [{ kind: 'inhale', durationMs: 4_000 }, { kind: 'exhale', durationMs: 6_000 }] }, durationMs: 60_000 },
      { pattern: { phases: [{ kind: 'inhale', durationMs: 4_000 }, { kind: 'exhale', durationMs: 8_000 }] }, durationMs: 60_000 },
    ],
  },

  // CONFIRMED (PDF): three physiological sighs. Same per-cycle pattern as
  // B2, fixed at 3 repeats (the PDF's "three" is the exercise's whole
  // definition, taken during the first 30 steps after a poor shot).
  B12: {
    code: 'B12',
    title: 'The Recovery Three',
    mechanism: 'Settling before analyzing keeps the lesson from a bad shot without encoding the emotion alongside the memory.',
    stages: [{ pattern: sighStage(), repeatCycles: 3 }],
  },
};
