// ===== PRACTICE TYPES =====
// The exercise catalogue's shape, who may use an exercise, and the record a
// finished practice session produces. Moved here from the assessment app's
// src/lib/practice/ so the package and its hosts share one definition.

export type PracticeCategory = 'downregulate' | 'upregulate' | 'steady';

// Ordered lowest to highest: a person with access to a tier has access to every
// tier before it.
export type PracticeTier = 'insight' | 'practice' | 'mastery';

export interface PracticeExercise {
  id: string;
  title: string;
  category: PracticeCategory;
  minTier: PracticeTier;
  // Breaths per minute for the pacer. Absent for exercises with no pacer.
  pacerRate?: number;
  narratorAudioKey?: string;
  description: string;
}

// Which arm of canUseExercise granted the session.
export type PracticeAccessArm = 'program' | 'superadmin' | 'tier';

export interface PracticePerson {
  isSuperadmin: boolean;
  enrolledPracticePrograms: string[];
}

// Whether a person may open a given exercise, and on what grounds: the arm that
// granted access, or null for no access. Three arms, checked in order; the first
// that applies wins. Exported so a host builds the function it hands to
// PracticeInstrument from this, rather than reimplementing the arms.
export function canUseExercise(
  person: PracticePerson,
  exercise: PracticeExercise
): PracticeAccessArm | null {
  // Arm 1: superadmins see everything.
  if (person.isSuperadmin) return 'superadmin';

  // Arm 2: an enrolled program covers the exercise's tier.
  // STUB: any enrollment counts as covering every tier. The real program-to-tier
  // mapping lands with the tier system, and will compare against exercise.minTier.
  if (person.enrolledPracticePrograms.length > 0) return 'program';

  // Arm 3: membership tier.
  // waits on membership-tier system, see npu-platform-v2
  return null;
}

export interface PracticeSessionMetrics {
  rmssd: number | null;
  sdnn: number | null;
  meanHR: number | null;
  meanRR: number | null;
  // An ESTIMATE from zero crossings of the detrended RR series, not a measured
  // breath rate. Clamped to 6-25 br/min, so anything breathed below 6 br/min —
  // which includes most slow paced practice — reads as 6. Do not treat it as exact.
  breathRate: number | null;
  coherence: number | null;
  // ALWAYS null. Practice exercises run at a prescribed rate rather than searching
  // for one, so there is nothing to measure here the way the assessment's
  // six-segment sweep does: that compares several paced rates against each other,
  // and one session has nothing to compare against. A real per-session resonance
  // reading would need actual spectral analysis of the RR stream (Lomb-Scargle, or
  // resampling plus FFT), which does not exist anywhere in this repo yet and is
  // future work.
  resonanceFreq: number | null;
}

// What happened in a session's RR stream, without shipping every beat.
//   rrCount       — RR intervals recorded (after the strap's 200-2000 ms artifact filter)
//   minRR, maxRR  — extremes in ms; null when no beats were recorded
//   strapMode     — 'ble' for a real strap, 'none' when Bluetooth was unavailable
//                   or never connected (the pacer ran alone)
//   disconnects   — unexpected strap drops during the session
export interface PracticeSamplesSummary {
  rrCount: number;
  minRR: number | null;
  maxRR: number | null;
  strapMode: 'ble' | 'none';
  disconnects: number;
}

// Handed to the host's onRecordSession when a session ends. The host decides what
// to do with it; the package makes no network calls.
export interface PracticeSessionRecord {
  exerciseId: string;
  // ISO 8601
  startedAt: string;
  endedAt: string;
  durationMs: number;
  // false when no strap data was recorded; every metric is then null.
  hrvAvailable: boolean;
  metrics: PracticeSessionMetrics;
  samplesSummary: PracticeSamplesSummary;
  narratorId: string | null;
  accessArm: PracticeAccessArm;
}
