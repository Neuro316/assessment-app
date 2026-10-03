// ===== @neuroprogeny/practice =====

export { default as PracticeInstrument } from './PracticeInstrument';
export type { PracticeInstrumentProps } from './PracticeInstrument';

export { usePracticeStrap } from './usePracticeStrap';
export type {
  PracticeStrap,
  PracticeStrapState,
  UsePracticeStrapOptions,
} from './usePracticeStrap';
export type { HRDataPoint } from './bluetooth';

// For authoring exercise programs: repeats a group of phases as numbered rounds.
export { rounds } from './pacer';
// Wraps a program in the paced pre-roll and quiet post-roll the fluidity spec
// asks every event-locked (media) session to carry.
export { withBookends } from './pacer';

export { canUseExercise } from './types';

// The full library (38 exercises across breathing, visualization and
// mindfulness) and the purposes the library screen groups on.
export { PRACTICE_LIBRARY, PRACTICE_EXERCISES, PRACTICE_PURPOSES } from './library';
export type {
  BreathPart,
  EvidenceTier,
  PracticeAxis,
  PracticeFamily,
  PracticeKind,
  PracticePurpose,
  BreathRoute,
  FreeformPhase,
  MediaAsset,
  MediaPhase,
  RRSample,
  SessionEvent,
  PacedPhase,
  PacerPhase,
  PacerProgram,
  PracticeAccessArm,
  PracticeCategory,
  PracticeExercise,
  PracticeHoldRecord,
  PracticePerson,
  PracticeSamplesSummary,
  PracticeSessionMetrics,
  PracticeSessionRecord,
  PracticeTier,
  SelfPacedHoldPhase,
  SessionContext,
} from './types';
