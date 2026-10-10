// ===== REFERENCE BANDS =====
// The thin three-zone bar on each Assessment Complete card: lower, typical, higher, in
// one neutral tone, with a marker at this person's value. No colours, no arrows, no
// state names: it shows where a number sits, not what it means.
//
// ⚠ TUNE THE NUMBERS IN REFERENCE_BANDS ONLY. Nothing below it holds a range.
//
// recoveryIndex lives here too, moved verbatim from page.tsx, so the Recovery card's
// typical range is drawn through the very mapping the index uses.
//
// Pure, so the tests can load it directly.

import type { AgeBand } from './age-band';

// Recovery Index: a 0-100 presentation of RMSSD, anchored to the capacity thresholds
// so the index and the level can never tell the participant two different stories.
export function recoveryIndex(rmssd: number): number {
  const anchors: [number, number][] = [
    [0, 0],
    [15, 35],
    [30, 60],
    [50, 80],
    [100, 100],
  ];
  if (rmssd <= 0) return 0;
  if (rmssd >= 100) return 100;
  for (let i = 1; i < anchors.length; i++) {
    const [x1, y1] = anchors[i - 1];
    const [x2, y2] = anchors[i];
    if (rmssd <= x2) return Math.round(y1 + ((rmssd - x1) / (x2 - x1)) * (y2 - y1));
  }
  return 100;
}

type Range = readonly [number, number];
type ByAge = Record<AgeBand | 'all', Range>;

// Starting values, for Cameron to confirm. `all` is used when no age band is known.
export const REFERENCE_BANDS = {
  // Recovery is entered as RMSSD (ms) and drawn on the card's /100 scale through
  // recoveryIndex(), the same mapping the index uses.
  recoveryRmssd: {
    under30: [30, 65],
    '30s': [25, 55],
    '40s': [20, 45],
    '50s': [17, 38],
    '60plus': [14, 32],
    all: [20, 50],
  } as ByAge,
  recoveryBar: [0, 100] as Range,

  // Sample entropy.
  complexity: {
    under30: [1.1, 1.9],
    '30s': [1.0, 1.8],
    '40s': [0.95, 1.7],
    '50s': [0.9, 1.6],
    '60plus': [0.8, 1.5],
    all: [0.9, 1.8],
  } as ByAge,
  complexityBar: [0, 2.5] as Range,

  // All ages.
  heartRate: { typical: [55, 80] as Range, bar: [40, 110] as Range },
  breathRate: { typical: [8, 16] as Range, bar: [4, 24] as Range },
  // The middle of the platform's existing coherence design: below 25 "not working on the
  // same timing", 25 to 50 "partly synchronised", above 50 "well synchronised"
  // (npu-platform-v2 src/lib/assessments/capacity-interpretation.ts).
  coherence: { typical: [25, 50] as Range, bar: [0, 100] as Range },
  resonance: { typical: [4.5, 7.0] as Range, bar: [4, 8] as Range },
} as const;

export type BandMetric = 'recovery' | 'heartRate' | 'breathRate' | 'coherence' | 'complexity' | 'resonance';

export interface Reference {
  low: number;
  high: number;
  barMin: number;
  barMax: number;
  unit: string;
  // True for Recovery and Complexity, whose typical range depends on age.
  ageDependent: boolean;
  // The age band the range was chosen for; null means all adults.
  ageBand: AgeBand | null;
}

export function referenceFor(metric: BandMetric, ageBand: AgeBand | null): Reference {
  const B = REFERENCE_BANDS;
  const key = ageBand ?? 'all';
  switch (metric) {
    case 'recovery': {
      const [lo, hi] = B.recoveryRmssd[key];
      return {
        low: recoveryIndex(lo),
        high: recoveryIndex(hi),
        barMin: B.recoveryBar[0],
        barMax: B.recoveryBar[1],
        unit: '/ 100',
        ageDependent: true,
        ageBand,
      };
    }
    case 'complexity': {
      const [lo, hi] = B.complexity[key];
      return { low: lo, high: hi, barMin: B.complexityBar[0], barMax: B.complexityBar[1], unit: '', ageDependent: true, ageBand };
    }
    case 'heartRate':
      return fixed(B.heartRate, 'bpm');
    case 'breathRate':
      return fixed(B.breathRate, 'br/min');
    case 'coherence':
      return fixed(B.coherence, '%');
    case 'resonance':
      return fixed(B.resonance, 'br/min');
  }
}

function fixed(b: { typical: Range; bar: Range }, unit: string): Reference {
  return { low: b.typical[0], high: b.typical[1], barMin: b.bar[0], barMax: b.bar[1], unit, ageDependent: false, ageBand: null };
}

export interface MarkerPlacement {
  // 0 to 100 along the bar, after clamping.
  pct: number;
  // Set when the value lies beyond the bar and the marker sits at that edge.
  clamped: 'below' | 'above' | null;
  // Which of the three zones the value falls in. For tests and layout only; never shown.
  zone: 'lower' | 'typical' | 'higher';
}

export function placeMarker(value: number, ref: Reference): MarkerPlacement {
  const span = ref.barMax - ref.barMin;
  const clamped = value < ref.barMin ? 'below' : value > ref.barMax ? 'above' : null;
  const v = Math.min(ref.barMax, Math.max(ref.barMin, value));
  const zone = value < ref.low ? 'lower' : value > ref.high ? 'higher' : 'typical';
  return { pct: span > 0 ? ((v - ref.barMin) / span) * 100 : 0, clamped, zone };
}

// Where the typical zone starts and ends along the bar, in percent.
export function zoneEdges(ref: Reference): { lowPct: number; highPct: number } {
  return { lowPct: placeMarker(ref.low, ref).pct, highPct: placeMarker(ref.high, ref).pct };
}

export const ALL_ADULTS_LINE =
  'Typical at rest, all adults. Add your age range in your profile for a closer comparison.';

export function referenceLine(metric: BandMetric, ref: Reference): string {
  if (ref.ageDependent && ref.ageBand === null) return ALL_ADULTS_LINE;
  const f = (n: number) => (metric === 'resonance' ? n.toFixed(1) : String(n));
  return `Typical at rest: ${f(ref.low)} to ${f(ref.high)}${ref.unit ? ` ${ref.unit}` : ''}`;
}
