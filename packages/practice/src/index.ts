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

export { canUseExercise } from './types';
export type {
  PracticeAccessArm,
  PracticeCategory,
  PracticeExercise,
  PracticePerson,
  PracticeSamplesSummary,
  PracticeSessionMetrics,
  PracticeSessionRecord,
  PracticeTier,
} from './types';

export { breathDurationMs, cueFor, MIN_FULLY_CUED_BREATH_MS } from './pacer-engine';
export type { BreathPhase, BreathPhaseKind, BreathPattern } from './pacer-engine';

export { EXTENDED_BREATH_PATTERNS } from './extended-breath-patterns';

export { useBreathPattern, isHoldPhase } from './use-breath-pattern';
export type { BreathPatternState, UseBreathPatternOptions } from './use-breath-pattern';

export { useWakeLock } from './use-wake-lock';

export { recordHoldOutcome } from './hold-recording';
export type { HoldEndedBy, HoldRecord } from './hold-recording';
