// ===== INSIGHT SWEEP =====
// The Insight sitting's self-report ratings as an envelope, built to the platform's
// published contract: docs/plans/instrument-envelope.md §K and §K.7 on
// Neuro316/npu-platform-v2 main (merged 90d30d7). The names below are decided
// there, not here. Change them there first.
//
// Pure: no React, no browser APIs, no runtime imports, so the tests can load it
// directly.

// §K.7, spelled. `version` is a STRING and is matched exactly, never range-compared
// ("10" sorts before "9"). It bumps only when an item key, a segment or min/max
// changes, never on a label change.
export const SWEEP_INSTRUMENT_ID = 'insight-sweep';
export const SWEEP_VERSION = '1';
export const SWEEP_KIND = 'reflective';

// §K.1: four scales, each 1 to 5, type `scale` (not `likert`). The label is what
// the person sees, and it travels with every answer.
export const SWEEP_SCALES = [
  { key: 'grounded', label: 'Grounded' },
  { key: 'focused', label: 'Focused' },
  { key: 'energy', label: 'Energy' },
  { key: 'presence', label: 'Presence' },
] as const;
export type SweepScaleKey = (typeof SWEEP_SCALES)[number]['key'];
export const SWEEP_MIN = 1;
export const SWEEP_MAX = 5;

// The paced rates, ascending, in breaths per minute.
export const SWEEP_RATES = [4.5, 5, 5.5, 6, 6.5, 7] as const;

// §K.2: the segment for one rate. ⚠ `String(5.0)` is "5", so 5.0 becomes `rate_5`,
// never `rate_5.0`. The decimal point is part of the name where there is one.
export function segmentForRate(rate: number): string {
  return `rate_${String(rate)}`;
}

// §K.2, verbatim and in order: the baseline before any paced breathing, then one
// segment per rate. A sweep has no `post`.
export const SWEEP_SEGMENTS: readonly string[] = ['pre', ...SWEEP_RATES.map(segmentForRate)];

// One segment's four answers. null means not given ("not recorded"), never 0.
export type SweepRatingSet = Record<SweepScaleKey, number | null>;
// Ratings collected so far, keyed by segment.
export type SweepRatings = Partial<Record<string, Partial<SweepRatingSet>>>;

export function emptyRatingSet(): SweepRatingSet {
  return { grounded: null, focused: null, energy: null, presence: null };
}

export type SweepItem = {
  key: SweepScaleKey;
  type: 'scale';
  value: number | null;
  label: string;
  segment: string;
};

export type SweepEnvelope = {
  instrument_id: typeof SWEEP_INSTRUMENT_ID;
  version: typeof SWEEP_VERSION;
  kind: typeof SWEEP_KIND;
  // §K.7: session_id is REQUIRED for this instrument and equals the sitting's
  // completionId, which is how the platform joins the sweep to its sitting.
  context: { session_id: string };
  items: SweepItem[];
};

// §K.3: 4 scales x 7 segments = 28 items, the same key repeating once per segment.
// Every segment is present even when all of its answers are blank: "every rate must
// run" is a presence rule, and a blank answer is null, never left out and never 0.
// Items carry `type` and `label` as well as key/segment/value: §K.3 and the
// platform's EnvelopeItem type require both, although §K.7's abbreviated example
// omits them.
export function buildSweepEnvelope(ratings: SweepRatings, completionId: string): SweepEnvelope {
  const items: SweepItem[] = [];
  for (const segment of SWEEP_SEGMENTS) {
    for (const scale of SWEEP_SCALES) {
      const raw = ratings[segment]?.[scale.key];
      items.push({
        key: scale.key,
        type: 'scale',
        value: raw === undefined ? null : raw,
        label: scale.label,
        segment,
      });
    }
  }
  return {
    instrument_id: SWEEP_INSTRUMENT_ID,
    version: SWEEP_VERSION,
    kind: SWEEP_KIND,
    context: { session_id: completionId },
    items,
  };
}

// Our own check before anything is posted, mirroring what the platform will refuse.
// Returns every problem found (empty when valid), so a test can assert WHICH refusal.
export function validateSweepEnvelope(env: unknown, completionId: string): string[] {
  const errors: string[] = [];
  const e = env as Partial<SweepEnvelope> | null;
  if (!e || typeof e !== 'object') return ['sweep is not an object'];

  if (e.instrument_id !== SWEEP_INSTRUMENT_ID) errors.push(`instrument_id must be "${SWEEP_INSTRUMENT_ID}"`);
  if (typeof e.version !== 'string') errors.push('version must be a string');
  else if (e.version !== SWEEP_VERSION) errors.push(`version must be "${SWEEP_VERSION}"`);
  if (e.kind !== SWEEP_KIND) errors.push(`kind must be "${SWEEP_KIND}"`);
  if (!e.context || e.context.session_id !== completionId) {
    errors.push('context.session_id must equal the completionId');
  }

  const items = Array.isArray(e.items) ? e.items : null;
  if (!items) return [...errors, 'items must be an array'];
  if (items.length !== SWEEP_SEGMENTS.length * SWEEP_SCALES.length) {
    errors.push(`expected ${SWEEP_SEGMENTS.length * SWEEP_SCALES.length} items, got ${items.length}`);
  }

  const seen = new Set<string>();
  for (const item of items) {
    const where = `${item?.key}@${item?.segment}`;
    if (!SWEEP_SEGMENTS.includes(item?.segment)) errors.push(`segment "${item?.segment}" is not declared`);
    const scale = SWEEP_SCALES.find((s) => s.key === item?.key);
    if (!scale) errors.push(`key "${item?.key}" is not declared`);
    else if (item.label !== scale.label) errors.push(`${where}: label must be "${scale.label}"`);
    if (item?.type !== 'scale') errors.push(`${where}: type must be "scale"`);
    const v = item?.value;
    if (v !== null && !(Number.isInteger(v) && v >= SWEEP_MIN && v <= SWEEP_MAX)) {
      errors.push(`${where}: value must be null or an integer ${SWEEP_MIN} to ${SWEEP_MAX}, got ${JSON.stringify(v)}`);
    }
    if (seen.has(where)) errors.push(`${where}: duplicate answer`);
    seen.add(where);
  }
  for (const segment of SWEEP_SEGMENTS) {
    for (const scale of SWEEP_SCALES) {
      if (!seen.has(`${scale.key}@${segment}`)) errors.push(`${scale.key}@${segment}: missing`);
    }
  }
  return errors;
}

// The pick when there is no armband: the rate the person rated best, as SELF-REPORT.
// It is never a measured resonance frequency and must never be presented as one.
//
// "Rated best" = the highest mean of that rate's non-blank answers across the four
// scales. A tie goes to the slower rate (the first in ascending order). A rate with
// every answer blank has no mean and cannot be picked. If no rate has an answer,
// there is no pick (null).
export function selfReportPick(ratings: SweepRatings): { rate: number | null; source: 'self_report' } {
  let best: { rate: number; mean: number } | null = null;
  for (const rate of SWEEP_RATES) {
    const set = ratings[segmentForRate(rate)];
    const values = SWEEP_SCALES.map((s) => set?.[s.key]).filter((v): v is number => typeof v === 'number');
    if (!values.length) continue;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (!best || mean > best.mean) best = { rate, mean };
  }
  return { rate: best ? best.rate : null, source: 'self_report' };
}
