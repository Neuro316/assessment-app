// ===== PRACTICE EXERCISES =====
// The exercise library: Cameron's 16 (of a planned 36).
//
// Numbers confirmed in the brief are used as given. Where the brief gave a range or
// no figure, the value is marked "PROVISIONAL" below, with the reasoning — those
// need confirming before participants use them.
//
// Imported from the built package like the /practice page itself; the root build
// script builds the package before the app.
import { rounds, type PacedPhase, type PracticeExercise } from '@neuroprogeny/practice';

// ----- shared building blocks -----

// The physiological sigh: full nose inhale, a shorter nose inhale stacked on top,
// then a long, slow mouth exhale until empty. 2s / 1s / 6s.
const SIGH: Omit<PacedPhase, 'durationSec' | 'repCount'> = {
  mode: 'paced',
  inhaleSec: 2,
  secondInhaleSec: 1,
  holdAfterInhaleSec: 0,
  exhaleSec: 6,
  holdAfterExhaleSec: 0,
  inhaleRoute: 'nose',
  exhaleRoute: 'mouth',
  cues: { secondInhale: 'Top up', exhale: 'Long, slow exhale' },
};

// Resonance pace, 5.5s in / 5.5s out through the nose.
const RESONANCE: Omit<PacedPhase, 'durationSec' | 'repCount'> = {
  mode: 'paced',
  inhaleSec: 5.5,
  holdAfterInhaleSec: 0,
  exhaleSec: 5.5,
  holdAfterExhaleSec: 0,
  inhaleRoute: 'nose',
  exhaleRoute: 'nose',
};

const LIGHTHEADED_NOTE =
  'Fast breathing can bring on lightheadedness or tingling, even within safe limits. Practise seated, never standing or near water, and stop and breathe normally the moment you feel dizzy.';

export const PRACTICE_EXERCISES: PracticeExercise[] = [
  // ===== Paced, continuous rate =====
  {
    id: 'B1',
    title: 'Resonance Breathing',
    category: 'calming',
    minTier: 'insight',
    description:
      'Breath and heart rhythm align near six breaths a minute, where heart rate variability peaks for most people. The default pace for any unstructured settling moment.',
    program: { phases: [{ ...RESONANCE, durationSec: 300 }] },
  },
  {
    id: 'B4',
    title: 'Extended Exhale',
    category: 'calming',
    minTier: 'insight',
    description:
      'A longer exhale lengthens the interval between heartbeats through vagal influence. A quick, reliable settle before anything that needs precision. If an 8-second exhale is a strain, let it be shorter — around 6 seconds is fine.',
    program: {
      phases: [
        {
          mode: 'paced',
          inhaleSec: 4,
          holdAfterInhaleSec: 0,
          exhaleSec: 8,
          holdAfterExhaleSec: 0,
          inhaleRoute: 'nose',
          exhaleRoute: 'nose',
          // PROVISIONAL: no duration in the brief. Two minutes suits a "quick settle".
          durationSec: 120,
        },
      ],
    },
  },
  {
    id: 'B5',
    title: 'Box Breathing',
    category: 'steady',
    minTier: 'practice',
    description:
      'An equal ratio and the counting occupy working memory, leaving less room for rehearsing outcomes while the body settles. For waiting periods, or any moment the mind has room to wander.',
    safetyNote:
      'Stop if the holds create tension in your jaw or shoulders, and go back to easy breathing.',
    program: {
      phases: [
        {
          mode: 'paced',
          inhaleSec: 4,
          holdAfterInhaleSec: 4,
          exhaleSec: 4,
          holdAfterExhaleSec: 4,
          inhaleRoute: 'nose',
          exhaleRoute: 'nose',
          // PROVISIONAL: no duration in the brief. Four minutes, fifteen boxes.
          durationSec: 240,
        },
      ],
    },
  },

  // ===== Paced, rep-based =====
  {
    id: 'B2',
    title: 'Physiological Sigh',
    category: 'calming',
    minTier: 'insight',
    description:
      'Reinflates collapsed air sacs in the lungs and maximises CO2 release — the fastest known voluntary route to lowering arousal in real time. The single most useful technique right after anything stressful.',
    program: { phases: [{ ...SIGH, repCount: 2 }] },
  },
  {
    id: 'B6',
    title: 'One Breath Reset',
    category: 'calming',
    minTier: 'insight',
    description:
      'One breath is enough to interrupt an escalating prediction loop. Meant to become automatic, anchored to a moment that recurs in your day.',
    program: {
      phases: [
        {
          mode: 'paced',
          inhaleSec: 4,
          holdAfterInhaleSec: 0,
          exhaleSec: 6,
          holdAfterExhaleSec: 0,
          inhaleRoute: 'nose',
          exhaleRoute: 'nose',
          repCount: 1,
        },
      ],
    },
  },
  {
    id: 'B7',
    title: 'Breath-Tempo Coupling',
    category: 'steady',
    minTier: 'practice',
    description:
      'Motor sequences run more smoothly hung on an existing rhythm, and exhaling slightly reduces muscular guarding. Pair it with a brief recurring action — a serve toss, a key press, stepping to a mic: finish the inhale in the final pause, and let the exhale begin as the action starts and carry through it. Here you practise the timing alone; no action needed.',
    program: {
      phases: [
        {
          mode: 'paced',
          // PROVISIONAL timing: the brief gives the shape, not seconds.
          inhaleSec: 3,
          holdAfterInhaleSec: 1,
          exhaleSec: 4,
          holdAfterExhaleSec: 0,
          inhaleRoute: 'nose',
          exhaleRoute: 'nose',
          cues: { inhale: 'Inhale…', holdIn: 'Final pause', exhale: 'Now begin — on the exhale' },
          // PROVISIONAL: the brief says 8-10.
          repCount: 8,
        },
      ],
    },
  },
  {
    id: 'B12',
    title: 'Recovery Three',
    category: 'calming',
    minTier: 'insight',
    description:
      'Settling before analysing prevents encoding the emotion alongside the memory. Right after any setback.',
    program: { phases: [{ ...SIGH, repCount: 3 }] },
  },
  {
    id: 'B10',
    title: 'Gentle Up-Regulation',
    category: 'activating',
    minTier: 'practice',
    description:
      'Arousal is not the enemy of performance — this raises alertness on purpose. Brisk nose inhales with a relaxed, passive exhale, then a minute of resonance breathing. For low-energy moments.',
    safetyNote: LIGHTHEADED_NOTE,
    program: {
      phases: [
        {
          mode: 'paced',
          // PROVISIONAL timing: "brisk" in, "relaxed passive" out.
          inhaleSec: 1,
          holdAfterInhaleSec: 0,
          exhaleSec: 1.5,
          holdAfterExhaleSec: 0,
          inhaleRoute: 'nose',
          exhaleRoute: 'nose',
          label: 'Brisk',
          cues: { inhale: 'Brisk inhale', exhale: 'Let it fall out' },
          repCount: 18,
        },
        // 60s rounds up to six whole breaths (66s).
        { ...RESONANCE, label: 'Settle', durationSec: 60 },
      ],
    },
  },
  {
    id: 'B15',
    title: "Lion's Breath",
    category: 'activating',
    minTier: 'practice',
    description:
      'Mild-to-moderate activation with a release quality — the gentlest on-ramp into the activating set. In through the nose, then a forceful open-mouth exhale.',
    program: {
      phases: [
        {
          mode: 'paced',
          // PROVISIONAL timing: the brief gives the shape, not seconds.
          inhaleSec: 3,
          holdAfterInhaleSec: 0,
          exhaleSec: 2,
          holdAfterExhaleSec: 0,
          inhaleRoute: 'nose',
          exhaleRoute: 'mouth',
          cues: { exhale: 'Open-mouth exhale' },
          repCount: 4,
        },
      ],
    },
  },

  // ===== Paced, phased / multi-segment =====
  {
    id: 'B3',
    title: 'Cyclic Sighing',
    category: 'calming',
    minTier: 'practice',
    description:
      'Five continuous minutes of the physiological sigh, the exhale always longer than both inhales together. Shown to produce larger mood improvement and a lower resting breathing rate than the same time in passive meditation.',
    // 300s rounds up to 34 whole sighs (306s).
    program: { phases: [{ ...SIGH, durationSec: 300 }] },
  },
  {
    id: 'B11',
    title: 'Ratio Ladder',
    category: 'steady',
    minTier: 'practice',
    description:
      'The exhale ratio that settles you best is personal, and it shifts with fitness and fatigue. One minute at each of three ratios, all through the nose — notice which one lands.',
    program: {
      phases: [
        // 60s rounds up to whole breaths: 64s, 60s, 60s.
        {
          mode: 'paced',
          inhaleSec: 4,
          holdAfterInhaleSec: 0,
          exhaleSec: 4,
          holdAfterExhaleSec: 0,
          inhaleRoute: 'nose',
          exhaleRoute: 'nose',
          label: '4 in · 4 out',
          durationSec: 60,
        },
        {
          mode: 'paced',
          inhaleSec: 4,
          holdAfterInhaleSec: 0,
          exhaleSec: 6,
          holdAfterExhaleSec: 0,
          inhaleRoute: 'nose',
          exhaleRoute: 'nose',
          label: '4 in · 6 out',
          durationSec: 60,
        },
        {
          mode: 'paced',
          inhaleSec: 4,
          holdAfterInhaleSec: 0,
          exhaleSec: 8,
          holdAfterExhaleSec: 0,
          inhaleRoute: 'nose',
          exhaleRoute: 'nose',
          label: '4 in · 8 out',
          durationSec: 60,
        },
      ],
    },
  },
  {
    id: 'B16',
    title: 'Rhythmic Cycling',
    category: 'activating',
    minTier: 'mastery',
    requiresBalancedBaseline: true,
    description:
      'Inspired by Sudarshan Kriya. Ninety seconds each of slow, medium and fast breathing, all through the nose. Hypothesised to train fast transitions between activation and calm, rather than aiming for one state.',
    safetyNote: LIGHTHEADED_NOTE,
    program: {
      phases: [
        // ~4 breaths/min: 15s breaths, six of them.
        {
          mode: 'paced',
          inhaleSec: 6,
          holdAfterInhaleSec: 0,
          exhaleSec: 9,
          holdAfterExhaleSec: 0,
          inhaleRoute: 'nose',
          exhaleRoute: 'nose',
          label: 'Slow',
          durationSec: 90,
        },
        // ~20 breaths/min: 3s breaths, thirty of them.
        {
          mode: 'paced',
          inhaleSec: 1.5,
          holdAfterInhaleSec: 0,
          exhaleSec: 1.5,
          holdAfterExhaleSec: 0,
          inhaleRoute: 'nose',
          exhaleRoute: 'nose',
          label: 'Medium',
          durationSec: 90,
        },
        // ~30 breaths/min: 2s breaths, forty-five of them.
        {
          mode: 'paced',
          inhaleSec: 1,
          holdAfterInhaleSec: 0,
          exhaleSec: 1,
          holdAfterExhaleSec: 0,
          inhaleRoute: 'nose',
          exhaleRoute: 'nose',
          label: 'Fast',
          durationSec: 90,
        },
      ],
    },
  },

  // ===== Round-based, higher caution =====
  {
    id: 'B13',
    title: 'Wim Hof-Style Cyclic Breathing',
    category: 'activating',
    minTier: 'mastery',
    requiresBalancedBaseline: true,
    description:
      'Quick deep breaths, then a hold you end yourself, then one held recovery breath. The strongest trial evidence in the set for voluntarily activating the sympathetic system.',
    safetyNote:
      'Lightheadedness is common, even within safe limits. Practise seated or lying down only — never standing, never near or in water. Stop immediately if you feel dizzy.',
    program: {
      // PROVISIONAL: the brief says 2-3 rounds; two, the safer end.
      phases: rounds(2, [
        {
          mode: 'paced',
          // PROVISIONAL timing for "quick deep breaths".
          inhaleSec: 1.5,
          holdAfterInhaleSec: 0,
          exhaleSec: 1.5,
          holdAfterExhaleSec: 0,
          inhaleRoute: 'nose',
          exhaleRoute: 'mouth',
          label: 'Breathe',
          cues: { inhale: 'Deep in', exhale: 'Let go' },
          // PROVISIONAL: the brief says 25-30; 25, the safer end.
          repCount: 25,
        },
        {
          mode: 'self-paced-hold',
          holdOn: 'exhale',
          label: 'Hold',
          instruction:
            'Let the last breath go and hold with relaxed lungs. Breathe in whenever you want to.',
          // Backstop only, never shown.
          safetyCapSec: 75,
        },
        {
          mode: 'paced',
          inhaleSec: 2,
          // PROVISIONAL: the brief says "held-inhale release" without a length.
          holdAfterInhaleSec: 15,
          exhaleSec: 3,
          holdAfterExhaleSec: 0,
          inhaleRoute: 'nose',
          exhaleRoute: 'mouth',
          label: 'Recovery breath',
          cues: { inhale: 'Breathe in fully', holdIn: 'Hold', exhale: 'Release' },
          repCount: 1,
        },
      ]),
    },
  },
  {
    id: 'B14',
    title: 'Tummo-Inspired Breath',
    category: 'activating',
    minTier: 'mastery',
    requiresBalancedBaseline: true,
    description:
      'Short, forceful "vase" breathing pulses through the nose, a brief retention, then a controlled release. Explicitly hypothesised, not measured: a greatly simplified version of a practice traditionally taught over years.',
    safetyNote:
      'Of everything here, this carries the strongest caution for dissociation. Practise seated only. If you feel detached, unreal or disoriented, stop and breathe normally, and do not continue the session.',
    program: {
      // PROVISIONAL: the brief gives no round count; two, each about 55s, inside the
      // 1-2 minute per-round cap.
      phases: rounds(2, [
        {
          mode: 'paced',
          // PROVISIONAL timing for "short forceful pulses".
          inhaleSec: 1,
          holdAfterInhaleSec: 0,
          exhaleSec: 1,
          holdAfterExhaleSec: 0,
          inhaleRoute: 'nose',
          exhaleRoute: 'nose',
          label: 'Pulses',
          cues: { inhale: 'Pulse in', exhale: 'Pulse out' },
          repCount: 20,
        },
        {
          mode: 'paced',
          inhaleSec: 2,
          // PROVISIONAL: "brief retention" as a fixed 5s, not a self-paced hold.
          holdAfterInhaleSec: 5,
          exhaleSec: 6,
          holdAfterExhaleSec: 0,
          inhaleRoute: 'nose',
          exhaleRoute: 'nose',
          label: 'Retain and release',
          cues: { holdIn: 'Brief hold', exhale: 'Controlled release' },
          repCount: 1,
        },
      ]),
    },
  },

  // B8 (Nasal-Only Sustained Breathing) and B9 (Breath-Hold Walking Practice)
  // deliberately removed per Cameron's later ruling pulling walking-based
  // exercises out of the app for now. They were here in the real backup
  // branch (backup/practice-pacer-2026-10-03, commit c8bf32f) as part of the
  // real 16-exercise library; removing them is a product decision, not a
  // correction of that branch's content.
];
