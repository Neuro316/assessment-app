// ===== PRACTICE LIBRARY =====
// The full library: 14 breathing exercises paced by the engine (B1-B7, B10-B16;
// B8 and B9, the walking ones, were pulled per Cameron's ruling), 12 guided
// visualizations (V1-V12) and 12 mindfulness field experiments (M1-M12), from
// "The Breathing Library", "The Visualization Library" and "The Mindfulness
// Experiments" in Cameron's source document.
//
// Numbers confirmed in the brief are used as given. Where the brief gave a range or
// no figure, the value is marked "PROVISIONAL" below, with the reasoning; those
// need confirming before participants use them.
//
// Every entry carries purpose (what the person wants right now), axis (what it
// trains, from the fluidity spec's six), moment (when it belongs, in the source's
// words) and evidence tier. The library screen groups on purpose.
//
// This file lives in the package, not the app, so the platform can import the
// library for its lesson-block picker and the Practice screen.
import { rounds } from './pacer';
import type { PacedPhase, PracticeExercise, PracticePurpose } from './types';

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

const BREATHING: PracticeExercise[] = [
  // ===== Paced, continuous rate =====
  {
    id: 'B1',
    title: 'Resonance Breathing',
    category: 'calming',
    minTier: 'insight',
    family: 'breathing',
    kind: 'paced',
    purpose: 'settle',
    axis: 'Baroreflex loop',
    moment: 'Between demands; the default pace',
    evidenceTier: 1,
    description:
      'Breath and heart rhythm align near six breaths a minute, where heart rate variability peaks for most people. The default pace for any unstructured settling moment.',
    program: { phases: [{ ...RESONANCE, durationSec: 300 }] },
  },
  {
    id: 'B4',
    title: 'Extended Exhale',
    category: 'calming',
    minTier: 'insight',
    family: 'breathing',
    kind: 'paced',
    purpose: 'steady',
    axis: 'Vagal magnitude',
    moment: 'Before anything that needs a steady hand',
    evidenceTier: 1,
    description:
      'A longer exhale lengthens the interval between heartbeats through vagal influence. A quick, reliable settle before anything that needs precision. If an 8-second exhale is a strain, let it be shorter; around 6 seconds is fine.',
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
    family: 'breathing',
    kind: 'paced',
    purpose: 'steady',
    axis: 'Concentration',
    moment: 'Waiting, when there is nothing to do but wait',
    evidenceTier: 1,
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
    family: 'breathing',
    kind: 'paced',
    purpose: 'recover',
    axis: 'Vagal magnitude',
    moment: 'Between a setback and the next thing',
    evidenceTier: 1,
    description:
      'Reinflates collapsed air sacs in the lungs and maximises CO2 release, the fastest known voluntary route to lowering arousal in real time. The single most useful technique right after anything stressful.',
    program: { phases: [{ ...SIGH, repCount: 2 }] },
  },
  {
    id: 'B6',
    title: 'One Breath Reset',
    category: 'calming',
    minTier: 'insight',
    family: 'breathing',
    kind: 'paced',
    purpose: 'prepare',
    axis: 'Arousal level',
    moment: 'Inside your pre-start routine',
    evidenceTier: 2,
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
    family: 'breathing',
    kind: 'paced',
    purpose: 'prepare',
    axis: 'Arousal level',
    moment: 'Rehearsal first, then the real thing',
    evidenceTier: 2,
    description:
      'Motor sequences run more smoothly hung on an existing rhythm, and exhaling slightly reduces muscular guarding. Pair it with a brief recurring action (a serve toss, a key press, stepping to a mic): finish the inhale in the final pause, and let the exhale begin as the action starts and carry through it. Here you practise the timing alone; no action needed.',
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
          cues: { inhale: 'Inhale…', holdIn: 'Final pause', exhale: 'Now begin, on the exhale' },
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
    family: 'breathing',
    kind: 'paced',
    purpose: 'recover',
    axis: 'Recovery time',
    moment: 'The first thirty steps after a setback',
    evidenceTier: 1,
    description:
      'Settling before analysing prevents encoding the emotion alongside the memory. Right after any setback.',
    program: { phases: [{ ...SIGH, repCount: 3 }] },
  },
  {
    id: 'B10',
    title: 'Gentle Up-Regulation',
    category: 'activating',
    minTier: 'practice',
    family: 'breathing',
    kind: 'paced',
    purpose: 'energize',
    axis: 'Arousal level',
    moment: 'Low mornings, flat afternoons',
    evidenceTier: 2,
    description:
      'Arousal is not the enemy of performance; this raises alertness on purpose. Brisk nose inhales with a relaxed, passive exhale, then a minute of resonance breathing. For low-energy moments.',
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
    family: 'breathing',
    kind: 'paced',
    purpose: 'energize',
    axis: 'Arousal level',
    moment: 'Gentle on-ramp to the activating set',
    evidenceTier: 2,
    description:
      'Mild-to-moderate activation with a release quality, the gentlest on-ramp into the activating set. In through the nose, then a forceful open-mouth exhale.',
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
    family: 'breathing',
    kind: 'paced',
    purpose: 'settle',
    axis: 'Vagal magnitude',
    moment: 'Before and after a demanding block',
    evidenceTier: 1,
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
    family: 'breathing',
    kind: 'paced',
    purpose: 'train',
    axis: 'Vagal magnitude',
    moment: 'Weekly, with the armband',
    evidenceTier: 1,
    description:
      'The exhale ratio that settles you best is personal, and it shifts with fitness and fatigue. One minute at each of three ratios, all through the nose. Notice which one lands.',
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
    family: 'breathing',
    kind: 'paced',
    purpose: 'train',
    axis: 'Transition speed',
    moment: 'Away from the demand, seated',
    evidenceTier: 3,
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
    family: 'breathing',
    kind: 'paced',
    purpose: 'energize',
    axis: 'Arousal level, recovery slope',
    moment: 'Away from the demand, seated',
    evidenceTier: 2,
    requiresBalancedBaseline: true,
    description:
      'Quick deep breaths, then a hold you end yourself, then one held recovery breath. The strongest trial evidence in the set for voluntarily activating the sympathetic system.',
    safetyNote:
      'Lightheadedness is common, even within safe limits. Practise seated or lying down only, never standing, never near or in water. Stop immediately if you feel dizzy.',
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
    family: 'breathing',
    kind: 'paced',
    purpose: 'energize',
    axis: 'Arousal level',
    moment: 'Away from the demand, seated',
    evidenceTier: 3,
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

// ===== Visualization (V1-V12), guided =====
// Narration is stage two (ElevenLabs). Until it lands, a guided exercise runs as
// its own text with a two-minute resonance underlay, which doubles as the
// lag-calibration segment the fluidity spec asks every event-locked session to
// carry. The description shown on the card is the source's "Where it is used".
const VISUALIZATION: PracticeExercise[] = [
  {
    id: 'V1',
    title: 'Ground Contact Scan',
    category: 'calming',
    minTier: 'mastery',
    family: 'visualization',
    kind: 'guided',
    purpose: 'settle',
    axis: 'Interoception',
    moment: 'At the start of most sessions',
    evidenceTier: 2,
    description: 'The opening practice for most sessions and the first thing to reach for when you have gone entirely into your head.',
    how: 'With eyes closed, move attention from the soles of the feet upward, noticing pressure, temperature and contact with whatever is under you, taking a few minutes to reach the top of the head.',
    where: 'The opening practice for most sessions and the first thing to reach for when you have gone entirely into your head.',
    program: { phases: [{ ...RESONANCE, label: 'Resonance underlay', durationSec: 120 }] },
  },
  {
    id: 'V2',
    title: 'Inside-View Rehearsal',
    category: 'steady',
    minTier: 'mastery',
    family: 'visualization',
    kind: 'guided',
    purpose: 'prepare',
    axis: 'Anticipatory regulation',
    moment: 'Any moment you intend to meet well',
    evidenceTier: 2,
    description: 'The primary rehearsal method for a moment you intend to meet well, because the first-person view recruits the body more directly than watching from outside.',
    how: 'See the moment from inside your own eyes, looking out at what will be in front of you, feeling the chair or the ground and the temperature of the room, and run it through once at real speed.',
    where: 'The primary rehearsal method for a moment you intend to meet well, because the first-person view recruits the body more directly than watching from outside.',
    program: { phases: [{ ...RESONANCE, label: 'Resonance underlay', durationSec: 120 }] },
  },
  {
    id: 'V3',
    title: 'Dissociated Review',
    category: 'steady',
    minTier: 'mastery',
    family: 'visualization',
    kind: 'guided',
    purpose: 'train',
    axis: 'Complexity',
    moment: 'Learning and review only',
    evidenceTier: 3,
    description: 'Learning and review only. This view is deliberately used for study and never for rehearsal, because distance is useful for analysis and unhelpful for execution.',
    how: 'Watch yourself from ten feet away as if on video, without commentary, purely observing what the body did and in what order.',
    where: 'Learning and review only. This view is deliberately used for study and never for rehearsal, because distance is useful for analysis and unhelpful for execution.',
    program: { phases: [{ ...RESONANCE, label: 'Resonance underlay', durationSec: 120 }] },
  },
  {
    id: 'V4',
    title: 'The Whole Arc',
    category: 'steady',
    minTier: 'mastery',
    family: 'visualization',
    kind: 'guided',
    purpose: 'prepare',
    axis: 'Anticipatory regulation',
    moment: 'Before anything with a clear start and finish',
    evidenceTier: 2,
    description: 'Before anything with a clear start and finish, until the whole of it is seen before it begins.',
    how: 'Rehearse the full arc, the start, the middle where the effort is, the turn toward finishing, the finish and the moment after, in that order and at real speed.',
    where: 'Before anything with a clear start and finish, until the whole of it is seen before it begins.',
    program: { phases: [{ ...RESONANCE, label: 'Resonance underlay', durationSec: 120 }] },
  },
  {
    id: 'V5',
    title: 'The Quiet Eye Anchor',
    category: 'steady',
    minTier: 'mastery',
    family: 'visualization',
    kind: 'guided',
    purpose: 'steady',
    axis: 'Concentration',
    moment: 'The two seconds before anything that matters',
    evidenceTier: 1,
    description: 'Small tasks first, then larger ones. A stable gaze steadies the whole system.',
    how: 'Fix the gaze on a single small point in front of you, a mark on the wall or the edge of something, and hold it steady for two to three seconds before you begin.',
    where: 'Small tasks first, then larger ones. A stable gaze steadies the whole system.',
    program: { phases: [{ ...RESONANCE, label: 'Resonance underlay', durationSec: 120 }] },
  },
  {
    id: 'V6',
    title: 'The Drop and the Return',
    category: 'calming',
    minTier: 'mastery',
    family: 'visualization',
    kind: 'guided',
    purpose: 'recover',
    axis: 'Recovery time',
    moment: 'Stress inoculation, with the armband',
    evidenceTier: 2,
    description: 'Stress inoculation. Practiced with the armband where the recording shows the drop and the return, so recovery becomes a trained skill rather than a hope.',
    how: 'Deliberately recall a moment that did not go your way, feel the drop in the chest honestly, then rehearse the recovery breath and moving toward the next thing settled enough to meet it.',
    where: 'Stress inoculation. Practiced with the armband where the recording shows the drop and the return, so recovery becomes a trained skill rather than a hope.',
    program: { phases: [{ ...RESONANCE, label: 'Resonance underlay', durationSec: 120 }] },
  },
  {
    id: 'V7',
    title: 'The Gallery',
    category: 'steady',
    minTier: 'mastery',
    family: 'visualization',
    kind: 'guided',
    purpose: 'train',
    axis: 'Anticipatory regulation',
    moment: 'Exposure practice, once settling is familiar',
    evidenceTier: 2,
    description: 'The core exposure practice, introduced once settling is familiar and revisited as the work deepens.',
    how: 'Populate the imagined moment with the specific people whose watching matters to you, and rehearse going through it while they are present.',
    where: 'The core exposure practice, introduced once settling is familiar and revisited as the work deepens.',
    program: { phases: [{ ...RESONANCE, label: 'Resonance underlay', durationSec: 120 }] },
  },
  {
    id: 'V8',
    title: 'The Highlight Reel',
    category: 'steady',
    minTier: 'mastery',
    family: 'visualization',
    kind: 'guided',
    purpose: 'prepare',
    axis: 'Arousal level',
    moment: 'Priming before, repair after',
    evidenceTier: 2,
    description: 'Priming before a demanding stretch, and the repair practice after a difficult one.',
    how: 'Replay three real moments from your own life that went exactly as you intended, with as much sensory detail as you can recover.',
    where: 'Priming before a demanding stretch, and the repair practice after a difficult one.',
    program: { phases: [{ ...RESONANCE, label: 'Resonance underlay', durationSec: 120 }] },
  },
  {
    id: 'V9',
    title: 'The Minute After',
    category: 'calming',
    minTier: 'mastery',
    family: 'visualization',
    kind: 'guided',
    purpose: 'recover',
    axis: 'Recovery time',
    moment: 'The recovery between efforts',
    evidenceTier: 2,
    description: 'Teaching that most of a demanding day is recovery between efforts, and that recovery is the trainable part.',
    how: 'Rehearse the minute after an effort rather than the effort itself, seeing the shoulders drop, the eyes lift, the breath lengthen and the mind quieting on its own.',
    where: 'Teaching that most of a demanding day is recovery between efforts, and that recovery is the trainable part.',
    program: { phases: [{ ...RESONANCE, label: 'Resonance underlay', durationSec: 120 }] },
  },
  {
    id: 'V10',
    title: 'Sanctuary',
    category: 'calming',
    minTier: 'mastery',
    family: 'visualization',
    kind: 'guided',
    purpose: 'settle',
    axis: 'Vagal magnitude',
    moment: 'Between demands, and the night before',
    evidenceTier: 2,
    description: 'Between the halves of a long day, and on the night before something that matters when sleep is hard to find.',
    how: 'Build one detailed internal place of settling and return to it until it can be reached in three breaths, anywhere, with your eyes open.',
    where: 'Between the halves of a long day, and on the night before something that matters when sleep is hard to find.',
    program: { phases: [{ ...RESONANCE, label: 'Resonance underlay', durationSec: 120 }] },
  },
  {
    id: 'V11',
    title: 'Wide Lens and Narrow Lens',
    category: 'steady',
    minTier: 'mastery',
    family: 'visualization',
    kind: 'guided',
    purpose: 'steady',
    axis: 'Concentration',
    moment: 'Attention width as a control',
    evidenceTier: 2,
    description: 'Teaching that attention width is a control you operate rather than a condition that happens to you.',
    how: 'Deliberately widen attention to take in the whole room and the sounds outside it, then narrow to a single close point, then widen again, three cycles.',
    where: 'Teaching that attention width is a control you operate rather than a condition that happens to you.',
    program: { phases: [{ ...RESONANCE, label: 'Resonance underlay', durationSec: 120 }] },
  },
  {
    id: 'V12',
    title: 'The Finish',
    category: 'steady',
    minTier: 'mastery',
    family: 'visualization',
    kind: 'guided',
    purpose: 'prepare',
    axis: 'Identity anchor',
    moment: 'Closing a stage of the work',
    evidenceTier: 3,
    description: 'The closing visualization of a stage of the work and the identity anchor for the whole practice.',
    how: 'See yourself finishing something that mattered in the manner you intend to become known for, regardless of the outcome, so the finish looks the same after a good result or a poor one.',
    where: 'The closing visualization of a stage of the work and the identity anchor for the whole practice.',
    program: { phases: [{ ...RESONANCE, label: 'Resonance underlay', durationSec: 120 }] },
  },
];

// ===== Mindfulness experiments (M1-M12), field =====
// Not paced. Done during an ordinary day and written up afterward, so the
// session is one open freeform phase the person ends with Done; the host records
// the note. They produce information, not biometrics.
const MINDFULNESS: PracticeExercise[] = [
  {
    id: 'M1',
    title: 'Body or Commentary',
    category: 'steady',
    minTier: 'practice',
    family: 'mindfulness',
    kind: 'field',
    purpose: 'train',
    axis: 'Baseline measure',
    moment: 'Three times a day',
    evidenceTier: 2,
    description: 'The baseline measurement of the whole practice. People are usually surprised by the ratio, and the surprise is the point.',
    how: 'Three times a day, ask a single question with no follow-up analysis. Where was my attention just now, in the body or in the commentary?',
    where: 'The baseline measurement of the whole practice. People are usually surprised by the ratio, and the surprise is the point.',
    program: { phases: [{ mode: 'freeform', instruction: 'Three times a day, ask a single question with no follow-up analysis. Where was my attention just now, in the body or in the commentary?', continueLabel: 'Done' }] },
  },
  {
    id: 'M2',
    title: 'Thought Counting',
    category: 'steady',
    minTier: 'practice',
    family: 'mindfulness',
    kind: 'field',
    purpose: 'train',
    axis: 'Concentration',
    moment: 'During one short task',
    evidenceTier: 2,
    description: 'That thoughts are events rather than instructions, and that counting them changes their grip without any effort to stop them.',
    how: 'From the moment you begin one short task to the moment you finish it, count how many separate thoughts arrive, without trying to have fewer.',
    where: 'That thoughts are events rather than instructions, and that counting them changes their grip without any effort to stop them.',
    program: { phases: [{ mode: 'freeform', instruction: 'From the moment you begin one short task to the moment you finish it, count how many separate thoughts arrive, without trying to have fewer.', continueLabel: 'Done' }] },
  },
  {
    id: 'M3',
    title: 'Labeling',
    category: 'steady',
    minTier: 'practice',
    family: 'mindfulness',
    kind: 'field',
    purpose: 'steady',
    axis: 'Concentration',
    moment: 'Any arriving thought',
    evidenceTier: 1,
    description: 'Naming an internal state reduces its intensity measurably, and four categories cover almost everything that arrives in a demanding day.',
    how: 'Give each arriving thought a single quiet word. Planning. Judging. Remembering. Rehearsing. Then return to what you were doing.',
    where: 'Naming an internal state reduces its intensity measurably, and four categories cover almost everything that arrives in a demanding day.',
    program: { phases: [{ mode: 'freeform', instruction: 'Give each arriving thought a single quiet word. Planning. Judging. Remembering. Rehearsing. Then return to what you were doing.', continueLabel: 'Done' }] },
  },
  {
    id: 'M4',
    title: 'The Tension Readout',
    category: 'steady',
    minTier: 'practice',
    family: 'mindfulness',
    kind: 'field',
    purpose: 'train',
    axis: 'Interoception',
    moment: 'Three checks a day',
    evidenceTier: 2,
    description: 'That the body reports the internal state before the mind admits it. Jaw, shoulders and hands are the cheapest biofeedback there is.',
    how: 'Rate the tension in your jaw, shoulders and hands from one to ten at three points in the day, and record it next to what you were doing.',
    where: 'That the body reports the internal state before the mind admits it. Jaw, shoulders and hands are the cheapest biofeedback there is.',
    program: { phases: [{ mode: 'freeform', instruction: 'Rate the tension in your jaw, shoulders and hands from one to ten at three points in the day, and record it next to what you were doing.', continueLabel: 'Done' }] },
  },
  {
    id: 'M5',
    title: 'The Sound Anchor',
    category: 'steady',
    minTier: 'practice',
    family: 'mindfulness',
    kind: 'field',
    purpose: 'steady',
    axis: 'Concentration',
    moment: 'Before focused work',
    evidenceTier: 2,
    description: 'That attention can be placed somewhere other than the task while the task still happens, which is the foundation of not overthinking.',
    how: 'Before focused work, close the eyes and rest attention entirely on sound for two minutes, then begin while keeping a thread of attention on sound.',
    where: 'That attention can be placed somewhere other than the task while the task still happens, which is the foundation of not overthinking.',
    program: { phases: [{ mode: 'freeform', instruction: 'Before focused work, close the eyes and rest attention entirely on sound for two minutes, then begin while keeping a thread of attention on sound.', continueLabel: 'Done' }] },
  },
  {
    id: 'M6',
    title: 'The Trigger Inventory',
    category: 'steady',
    minTier: 'practice',
    family: 'mindfulness',
    kind: 'field',
    purpose: 'train',
    axis: 'Trigger map',
    moment: 'One week',
    evidenceTier: 2,
    description: 'That overthinking is preceded by reliable and personal triggers, most often a specific place, a specific person or a specific kind of stakes.',
    how: 'For one week, write down what was happening in the ninety seconds before every episode of overthinking. Not the thought itself, the context around it.',
    where: 'That overthinking is preceded by reliable and personal triggers, most often a specific place, a specific person or a specific kind of stakes.',
    program: { phases: [{ mode: 'freeform', instruction: 'For one week, write down what was happening in the ninety seconds before every episode of overthinking. Not the thought itself, the context around it.', continueLabel: 'Done' }] },
  },
  {
    id: 'M7',
    title: 'The Three Second Rule',
    category: 'calming',
    minTier: 'practice',
    family: 'mindfulness',
    kind: 'field',
    purpose: 'recover',
    axis: 'Recovery time',
    moment: 'After a setback',
    evidenceTier: 2,
    description: 'That suppressed reactions last longer than expressed ones, and that a container is more effective than a prohibition.',
    how: 'After a setback, allow the reaction completely and without editing for three full seconds, then begin the Recovery Three and move on.',
    where: 'That suppressed reactions last longer than expressed ones, and that a container is more effective than a prohibition.',
    program: { phases: [{ mode: 'freeform', instruction: 'After a setback, allow the reaction completely and without editing for three full seconds, then begin the Recovery Three and move on.', continueLabel: 'Done' }] },
  },
  {
    id: 'M8',
    title: 'The Open Awareness Walk',
    category: 'calming',
    minTier: 'practice',
    family: 'mindfulness',
    kind: 'field',
    purpose: 'settle',
    axis: 'Complexity',
    moment: 'One walk a day',
    evidenceTier: 3,
    description: 'Resting attention, which is what makes the narrowing available when it is needed.',
    how: 'For one walk a day, hold no object of attention at all. Let sound, sight, air and sensation arrive without choosing among them.',
    where: 'Resting attention, which is what makes the narrowing available when it is needed.',
    program: { phases: [{ mode: 'freeform', instruction: 'For one walk a day, hold no object of attention at all. Let sound, sight, air and sensation arrive without choosing among them.', continueLabel: 'Done' }] },
  },
  {
    id: 'M9',
    title: 'Deliberate Imperfection',
    category: 'steady',
    minTier: 'practice',
    family: 'mindfulness',
    kind: 'field',
    purpose: 'train',
    axis: 'Routine audit',
    moment: 'While practicing any skill',
    evidenceTier: 3,
    description: 'How much of your routine is preparation and how much is superstition, which is worth knowing before a day when the routine gets interrupted.',
    how: 'While practicing any skill, do ten attempts with no preparatory routine at all, then ten with the full routine, and notice the difference in the mind rather than the difference in the result.',
    where: 'How much of your routine is preparation and how much is superstition, which is worth knowing before a day when the routine gets interrupted.',
    program: { phases: [{ mode: 'freeform', instruction: 'While practicing any skill, do ten attempts with no preparatory routine at all, then ten with the full routine, and notice the difference in the mind rather than the difference in the result.', continueLabel: 'Done' }] },
  },
  {
    id: 'M10',
    title: 'Watched Practice',
    category: 'steady',
    minTier: 'practice',
    family: 'mindfulness',
    kind: 'field',
    purpose: 'train',
    axis: 'Anticipatory regulation',
    moment: 'Twenty watched attempts',
    evidenceTier: 2,
    description: 'That observation changes physiology before it changes thought, and that this can be rehearsed until it is familiar rather than threatening.',
    how: 'Ask someone to stand and watch you make twenty attempts at something without commenting. Notice the first change that happens in the body.',
    where: 'That observation changes physiology before it changes thought, and that this can be rehearsed until it is familiar rather than threatening.',
    program: { phases: [{ mode: 'freeform', instruction: 'Ask someone to stand and watch you make twenty attempts at something without commenting. Notice the first change that happens in the body.', continueLabel: 'Done' }] },
  },
  {
    id: 'M11',
    title: 'The Scoreless Hour',
    category: 'steady',
    minTier: 'practice',
    family: 'mindfulness',
    kind: 'field',
    purpose: 'train',
    axis: 'Score dependence',
    moment: 'One hour, nothing measured',
    evidenceTier: 3,
    description: 'What your attention does when the number is removed, which reveals how much of the fog was score-generated.',
    how: 'Spend one hour on something you usually measure without keeping any score, without counting in your head, and without reconstructing it afterward.',
    where: 'What your attention does when the number is removed, which reveals how much of the fog was score-generated.',
    program: { phases: [{ mode: 'freeform', instruction: 'Spend one hour on something you usually measure without keeping any score, without counting in your head, and without reconstructing it afterward.', continueLabel: 'Done' }] },
  },
  {
    id: 'M12',
    title: 'The Mirror Debrief',
    category: 'steady',
    minTier: 'practice',
    family: 'mindfulness',
    kind: 'field',
    purpose: 'train',
    axis: 'Reflection',
    moment: 'End of day',
    evidenceTier: 2,
    description: 'That the day is a mirror rather than a verdict, which is the central reframe of the entire practice.',
    how: 'At the end of the day, answer one question in writing. What did today show me about how I am currently spending and recovering?',
    where: 'That the day is a mirror rather than a verdict, which is the central reframe of the entire practice.',
    program: { phases: [{ mode: 'freeform', instruction: 'At the end of the day, answer one question in writing. What did today show me about how I am currently spending and recovering?', continueLabel: 'Done' }] },
  },
];

export const PRACTICE_LIBRARY: PracticeExercise[] = [...BREATHING, ...VISUALIZATION, ...MINDFULNESS];
// Earlier name, kept so existing imports and tests keep working.
export const PRACTICE_EXERCISES = PRACTICE_LIBRARY;

// The purposes the library screen groups on, with what each trains (the
// fluidity spec's axes) in the order they are shown.
export const PRACTICE_PURPOSES: { id: PracticePurpose; title: string; line: string; trains: string }[] = [
  { id: 'settle', title: 'Settle', line: 'Bring arousal down and let the system land.', trains: 'Vagal magnitude, baroreflex loop' },
  { id: 'steady', title: 'Steady', line: 'Hold attention and keep the body quiet while you work.', trains: 'Concentration, complexity preserved' },
  { id: 'energize', title: 'Energize', line: 'Raise alertness on purpose, then come back down.', trains: 'Arousal level, recovery slope' },
  { id: 'recover', title: 'Recover', line: 'Right after a setback, before any analysis.', trains: 'Recovery time' },
  { id: 'prepare', title: 'Prepare', line: 'Rehearse the moment before it arrives.', trains: 'Anticipatory regulation' },
  { id: 'train', title: 'Train and measure', line: 'Find your own numbers, and build range between states.', trains: 'Transition speed, interoception, complexity' },
];
