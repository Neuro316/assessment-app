// ===== RESONANCE PICK =====
// Moved verbatim from src/app/page.tsx so the completion messages and their tests
// share one implementation. Behaviour unchanged.

import type { HRVMetrics } from './hrv-metrics';

export interface RFSegment {
  rate: number;
  metrics: HRVMetrics | null;
  rrCount: number;
}

// Resonance frequency = the paced rate at which the system produced the largest,
// most rhythmic cardiac oscillation. Amplitude (SDNN) leads; beat-to-beat change
// (RMSSD) and rhythm alignment (coherence) confirm it.
export function pickResonance(segments: RFSegment[]): { rate: number; scores: number[] } {
  const valid = segments.filter((s) => s.metrics);
  if (!valid.length) return { rate: 5.5, scores: segments.map(() => 0) };

  const maxOf = (pick: (m: HRVMetrics) => number) =>
    Math.max(...valid.map((s) => pick(s.metrics as HRVMetrics)), 0.0001);

  const maxSdnn = maxOf((m) => m.sdnn);
  const maxRmssd = maxOf((m) => m.rmssd);
  // Coherence is null on a segment too short to compute it. Such a segment
  // gets no coherence credit rather than the old sentinel's arbitrary 50.
  const maxCoh = maxOf((m) => m.coherence ?? 0);

  const scores = segments.map((s) =>
    s.metrics
      ? 0.4 * (s.metrics.sdnn / maxSdnn) +
        0.3 * (s.metrics.rmssd / maxRmssd) +
        0.3 * ((s.metrics.coherence ?? 0) / maxCoh)
      : 0
  );

  let best = 0;
  scores.forEach((v, i) => {
    if (v > scores[best]) best = i;
  });
  return { rate: segments[best].rate, scores };
}
