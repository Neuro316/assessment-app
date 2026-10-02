// ===== SESSION HRV METRICS =====
// Ported from the assessment app's src/lib/hrv-metrics.ts: the same formulas and
// the same rounding, cut down to what a practice record carries. Sample entropy,
// DFA, stress index and the placeholder frequency-domain values are left out —
// nothing in a practice record uses them.
//
// Run once, at session end, over the session's full RR stream. Not per heartbeat.

import type { PracticeSessionMetrics } from './types';

// Below this the assessment's engine returns no metrics at all; kept identical.
const MIN_RR = 10;

const EMPTY: PracticeSessionMetrics = {
  rmssd: null,
  sdnn: null,
  meanHR: null,
  meanRR: null,
  breathRate: null,
  coherence: null,
  resonanceFreq: null,
};

export function emptySessionMetrics(): PracticeSessionMetrics {
  return { ...EMPTY };
}

// Organisation of the rhythm around one dominant pattern, 0-100. Autocorrelation
// proxy over lags of 3-30 beats, verbatim from the assessment.
export function coherenceRatio(rr: number[]): number {
  const n = rr.length;
  if (n < 20) return 50;
  const mean = rr.reduce((a, b) => a + b, 0) / n;
  const totalVar = rr.map((r) => (r - mean) ** 2).reduce((a, b) => a + b, 0) / n;
  if (totalVar === 0) return 0;

  let maxCorr = 0;
  for (let lag = 3; lag < Math.min(n / 2, 30); lag++) {
    let corr = 0;
    for (let i = 0; i < n - lag; i++) corr += (rr[i] - mean) * (rr[i + lag] - mean);
    corr /= n - lag;
    if (corr > maxCorr) maxCorr = corr;
  }
  return Math.round(Math.max(0, Math.min(100, (maxCorr / totalVar) * 100)) * 10) / 10;
}

// Zero-crossing breath estimate, verbatim from the assessment, including its
// 6-25 br/min clamp. See the note on breathRate in types.ts.
function estimateBreathRate(rr: number[], meanRR: number): number {
  let breathRate = 14;
  if (rr.length > 30) {
    let zeroCrossings = 0;
    const detrended = rr.map((r) => r - meanRR);
    for (let i = 1; i < detrended.length; i++) {
      if (
        (detrended[i] >= 0 && detrended[i - 1] < 0) ||
        (detrended[i] < 0 && detrended[i - 1] >= 0)
      )
        zeroCrossings++;
    }
    breathRate = Math.max(
      6,
      Math.min(25, zeroCrossings / 2 / (rr.reduce((a, b) => a + b, 0) / 60000))
    );
  }
  return breathRate;
}

// Every metric is null when there are too few beats to say anything, matching the
// assessment's computeAllMetrics returning null. resonanceFreq is always null; see
// types.ts for why.
export function computeSessionMetrics(rr: number[]): PracticeSessionMetrics {
  if (!rr || rr.length < MIN_RR) return emptySessionMetrics();

  const meanRR = rr.reduce((a, b) => a + b, 0) / rr.length;
  const meanHR = 60000 / meanRR;
  const diffs: number[] = [];
  for (let i = 1; i < rr.length; i++) diffs.push(rr[i] - rr[i - 1]);

  const rmssd = Math.sqrt(diffs.map((d) => d * d).reduce((a, b) => a + b, 0) / diffs.length);
  const sdnn = Math.sqrt(rr.map((r) => (r - meanRR) ** 2).reduce((a, b) => a + b, 0) / rr.length);

  return {
    rmssd: Math.round(rmssd * 10) / 10,
    sdnn: Math.round(sdnn * 10) / 10,
    meanHR: Math.round(meanHR * 10) / 10,
    meanRR: Math.round(meanRR),
    breathRate: Math.round(estimateBreathRate(rr, meanRR) * 10) / 10,
    coherence: coherenceRatio(rr),
    resonanceFreq: null,
  };
}
