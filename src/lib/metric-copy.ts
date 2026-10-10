// ===== METRIC COPY =====
// The words on the Assessment Complete cards: each card's info-tip and its one-line note.
// Kept apart from the layout so the copy can be checked (no em dashes) and tuned alone.
//
// Pure, so the tests can load it directly.

// What each headline number actually means, in the participant's language.
export const METRIC_TIPS: Record<string, string> = {
  recovery:
    'Your Recovery Index is derived from RMSSD, which measures the variation in timing between consecutive heartbeats. Higher variation means your nervous system can shift fluidly between activation and rest. This is the single strongest short-term indicator of how much capacity your system has available right now.',
  heartRate:
    'Your resting heart rate reflects how hard your cardiovascular system is working just to keep you at baseline. A lower resting heart rate generally means your system is running more efficiently, requiring less effort to maintain normal function. This number is influenced by fitness, hydration, sleep, and current stress load.',
  breathRate:
    'Your natural breathing pace at rest reflects your baseline level of physiological activation. Slower resting breath rates are associated with greater parasympathetic tone, meaning your system is spending less energy on activation and has more available for recovery and adaptation.',
  coherence:
    'Coherence measures how organized your heart rhythm is around a single dominant pattern. When coherence is high, your heart, lungs, and autonomic nervous system are working in sync. This is not about being calm. It is about being synchronized, which can happen during focused effort as well as during rest.',
  complexity:
    'Complexity is measured using Sample Entropy, which quantifies how many different response patterns your nervous system has available. Moderate complexity is the signature of a healthy, adaptive system: not rigid and repetitive, but not random either. It means your system has options and can flexibly shift between them as demands change. Lower readings tend to mean a more repetitive rhythm, a system drawing on fewer patterns, which is common under sustained load, fatigue or illness. Higher readings tend to mean more varied responses, but above about 2.0 the number usually reflects noise or missed beats rather than greater adaptability.',
  resonance:
    'Your resonance frequency is the breathing pace where your heart rate variability reaches its peak amplitude. At this rate, each breath cycle maximally amplifies the natural oscillation in your heart rhythm. Breathing at this pace during training sessions produces the strongest cardiovascular training signal. Most adults resonate between 4.5 and 7.0 breaths per minute.',
};

// The one line under each card's number.
export const CARD_NOTES: Record<string, string> = {
  recovery: 'How much resource your system currently has free for repair and adaptation.',
  heartRate: 'Your resting pace, the baseline cost of running your system right now.',
  breathRate: 'How fast you breathe when nothing is being asked of you.',
  coherence: 'How closely your heart rhythm and your breath moved together at rest.',
  complexity: 'The adaptive range in your signal: room to respond to whatever comes next.',
  resonance: 'The breath rate your system amplifies most. This is where to practise.',
};

// The keys whose text holds an em dash (U+2014). Empty means clean.
// The resonance card's note when the armband lost the signal and the pace shown is the
// one the person rated best (resonance.ts: fewer than two rates had enough beats).
export const RATED_PACE_NOTE = 'The pace you rated best. The armband signal was lost, so it was not measured.';

export function keysWithEmDash(copy: Record<string, string>): string[] {
  return Object.keys(copy).filter((k) => copy[k].includes('—'));
}
