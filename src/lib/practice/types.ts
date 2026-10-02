// ===== PRACTICE TYPES =====
// Shapes for guided practice sessions. Nothing in the app uses these yet.

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

// Handed to the embedding platform when a practice session ends, the same way the
// assessment's finalize() hands over 'assessment-complete': a type, a completion
// identity the platform dedupes on, and a metrics block. The metrics are the subset
// of the assessment's that mean something over a practice session; null when the
// session had no strap or too few beats to compute them.
export interface PracticeSessionPayload {
  type: 'practice-complete';
  completionId: string;
  metrics: {
    rmssd: number | null;
    sdnn: number | null;
    meanHR: number | null;
    meanRR: number | null;
    breathRate: number | null;
    coherence: number | null;
  };
  personId: string;
  exerciseId: string;
  narratorId: string | null;
  durationMs: number;
  accessArm: PracticeAccessArm;
  // The resonance frequency from the person's most recent assessment, if any.
  baselineResonanceFreq: number | null;
  // ISO 8601
  startedAt: string;
}
