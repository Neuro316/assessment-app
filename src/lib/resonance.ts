// ===== RESONANCE PICK =====
// Moved verbatim from src/app/page.tsx so the completion messages and their tests
// share one implementation. Since then: a rate is scored only when its window holds
// enough clean signal (rateSufficiency below), and with fewer than two such rates
// there is no measured pick at all.

import type { HRVMetrics } from './hrv-metrics';

export interface RFSegment {
  rate: number;
  metrics: HRVMetrics | null;
  rrCount: number;
  // Clean signal time in this rate's window (cleanMs below).
  cleanMs: number;
}

// The artifact bounds every RR interval must fall inside to be accepted. The strap
// parser (bluetooth.ts parseHeartRateData) rejects anything outside them; cleanMs
// applies them again so a stored or simulated series is held to the same rule.
export const RR_ARTIFACT_MIN_MS = 200;
export const RR_ARTIFACT_MAX_MS = 2000;

// Clean time = the sum of the accepted RR intervals. A dropout contributes nothing:
// while the stream is stopped no interval arrives, and an interval at or past the
// artifact ceiling is rejected, so no time is ever counted across a gap.
export function cleanMs(rr: number[]): number {
  let sum = 0;
  for (const x of rr) if (x > RR_ARTIFACT_MIN_MS && x < RR_ARTIFACT_MAX_MS) sum += x;
  return Math.round(sum);
}

// ⚠ THE SUFFICIENCY RULE. A rate is sufficient when BOTH hold:
//   1. clean time >= MIN_CLEAN_FRACTION of its window: 0.75 x 120 s = 90 000 ms on the
//      full assessment. (A fraction rather than a fixed 90 000 so the pace finder's 90 s
//      window, which shares this helper, is held to the same proportion.)
//   2. clean time >= MIN_BREATH_CYCLES full breath cycles at that pace:
//      4 x 60 000 / rate ms, 53 333 ms at 4.5 and 34 286 ms at 7.0.
export const MIN_CLEAN_FRACTION = 0.75;
export const MIN_BREATH_CYCLES = 4;
// Fewer sufficient rates than this and there is nothing to compare: no measured pick.
export const MIN_SUFFICIENT_RATES = 2;

export function minCleanMs(rate: number, windowMs: number): number {
  return Math.max(MIN_CLEAN_FRACTION * windowMs, (MIN_BREATH_CYCLES * 60_000) / rate);
}

export interface RateSufficiency {
  sufficient: boolean;
  clean_ms: number;
}

export function rateSufficiency(seg: RFSegment, windowMs: number): RateSufficiency {
  const clean = seg.cleanMs ?? 0;
  return { sufficient: clean >= minCleanMs(seg.rate, windowMs), clean_ms: clean };
}

export interface ResonanceResult {
  // null when fewer than MIN_SUFFICIENT_RATES rates can be compared.
  rate: number | null;
  scores: number[];
  sufficiency: RateSufficiency[];
}

// A rate the pick may choose: sufficient, with metrics, and with a non-zero amplitude.
// A flat rate (amplitude 0) passes the time test but has no oscillation to compare.
function pickable(seg: RFSegment, s: RateSufficiency): boolean {
  return s.sufficient && !!seg.metrics && seg.metrics.sdnn > 0;
}

// Resonance frequency = the paced rate at which the system produced the largest,
// most rhythmic cardiac oscillation. Amplitude (SDNN) leads; beat-to-beat change
// (RMSSD) and rhythm alignment (coherence) confirm it. Only pickable rates are
// scored; every other rate scores 0.
export function pickResonance(segments: RFSegment[], windowMs: number): ResonanceResult {
  const sufficiency = segments.map((s) => rateSufficiency(s, windowMs));
  const ok = segments.map((s, i) => pickable(s, sufficiency[i]));
  const valid = segments.filter((_, i) => ok[i]);
  // ⚠ Never a default rate. This used to return 5.5 when nothing was valid, which the
  // result screen then announced as a measurement.
  if (valid.length < MIN_SUFFICIENT_RATES) {
    return { rate: null, scores: segments.map(() => 0), sufficiency };
  }

  const maxOf = (pick: (m: HRVMetrics) => number) =>
    Math.max(...valid.map((s) => pick(s.metrics as HRVMetrics)), 0.0001);

  const maxSdnn = maxOf((m) => m.sdnn);
  const maxRmssd = maxOf((m) => m.rmssd);
  // Coherence is null on a segment too short to compute it. Such a segment
  // gets no coherence credit rather than the old sentinel's arbitrary 50.
  const maxCoh = maxOf((m) => m.coherence ?? 0);

  const scores = segments.map((s, i) =>
    ok[i] && s.metrics
      ? 0.4 * (s.metrics.sdnn / maxSdnn) +
        0.3 * (s.metrics.rmssd / maxRmssd) +
        0.3 * ((s.metrics.coherence ?? 0) / maxCoh)
      : 0
  );

  let best = segments.findIndex((_, i) => ok[i]);
  scores.forEach((v, i) => {
    if (ok[i] && v > scores[best]) best = i;
  });
  return { rate: segments[best].rate, scores, sufficiency };
}
