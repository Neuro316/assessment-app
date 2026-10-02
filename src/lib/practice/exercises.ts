// ===== PRACTICE EXERCISES =====
// PLACEHOLDER — Cameron supplies the real 36
//
// Four stand-ins, one per tier/category combination worth exercising, so access
// and UI work can proceed. Titles, rates, audio keys and descriptions are all
// provisional and should not ship to participants.

import type { PracticeExercise } from './types';

export const PRACTICE_EXERCISES: PracticeExercise[] = [
  {
    id: 'placeholder-resonance-breathing',
    title: 'Resonance Breathing',
    category: 'downregulate',
    minTier: 'insight',
    pacerRate: 6.0,
    narratorAudioKey: 'placeholder-resonance-breathing',
    description:
      'PLACEHOLDER. Breathe along with the circle at a slow, even pace. Final copy to come.',
  },
  {
    id: 'placeholder-energizing-breath',
    title: 'Energizing Breath',
    category: 'upregulate',
    minTier: 'practice',
    pacerRate: 9.0,
    narratorAudioKey: 'placeholder-energizing-breath',
    description:
      'PLACEHOLDER. A brisker rhythm with a longer inhale, for lifting energy. Final copy to come.',
  },
  {
    id: 'placeholder-steady-focus',
    title: 'Steady Focus',
    category: 'steady',
    minTier: 'practice',
    pacerRate: 7.0,
    narratorAudioKey: 'placeholder-steady-focus',
    description:
      'PLACEHOLDER. An even, moderate pace for holding attention steady. Final copy to come.',
  },
  {
    id: 'placeholder-guided-visualization',
    title: 'Guided Visualization',
    category: 'downregulate',
    minTier: 'mastery',
    narratorAudioKey: 'placeholder-guided-visualization',
    description:
      'PLACEHOLDER. A narrated visualization with no pacer. Final copy to come.',
  },
];
