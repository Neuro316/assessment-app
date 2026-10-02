// ===== PRACTICE ACCESS =====
// Whether a person may open a given exercise. Three arms, checked in order; any
// one of them is enough.

import type { PracticeExercise } from './types';

export interface PracticePerson {
  isSuperadmin: boolean;
  enrolledPracticePrograms: string[];
}

export function canUseExercise(person: PracticePerson, exercise: PracticeExercise): boolean {
  // Arm 1: superadmins see everything.
  if (person.isSuperadmin) return true;

  // Arm 2: an enrolled program covers the exercise's tier.
  // STUB: any enrollment counts as covering every tier. The real program-to-tier
  // mapping lands with the tier system, and will compare against exercise.minTier.
  if (person.enrolledPracticePrograms.length > 0) return true;

  // Arm 3: membership tier.
  // waits on membership-tier system, see npu-platform-v2
  return false;
}
