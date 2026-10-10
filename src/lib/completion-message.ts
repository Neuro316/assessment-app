// ===== COMPLETION MESSAGES =====
// What the assessment hands the University when a sitting ends, over the existing
// origin-checked `assessment-complete` message.
//
// buildCapacityMessage is the full assessment's scored result, extracted UNCHANGED
// from the inline object that used to live in page.tsx's finalize().
//
// buildFullMessage is what a full-assessment sitting sends: that scored result plus
// the sweep envelope under `sweep`, in ONE assessment-complete message, joined by
// sweep.context.session_id === completionId (§K.7: the platform stores two rows).
//
// buildPaceFinderMessage is what a pace-finder sitting sends: the sweep alone, with
// NO `metrics`, because the pace finder has no resting block and so no scored result.
//
// Pure: no React, no browser APIs, no runtime imports.

import type { HRVMetrics } from './hrv-metrics';
import type { RFSegment } from './resonance';
import type { SweepEnvelope } from './insight-sweep';
import type { ageFields } from './age-band';

// The age band's fields (age-band.ts), added after everything else when present.
export type AgeFields = ReturnType<typeof ageFields>;

export const COMPLETE_MESSAGE = 'assessment-complete';

// Caps on what rides in the postMessage. A 20 minute recording is well under
// these, but a runaway buffer must not produce a message the parent cannot handle.
export const MAX_RESTING_RR = 2000;
export const MAX_RF_RR_PER_RATE = 500;

export type DeviceMode = 'ble' | 'sim' | 'none' | null;

export interface CapacityMessageInput {
  completionId: string;
  restingMetrics: HRVMetrics | null;
  recoveryIndex: number;
  resonance: { rate: number; scores: number[] };
  restingRR: number[];
  rfSegments: RFSegment[];
  rfRR: number[][];
  deviceMode: DeviceMode;
  restingMs: number;
  rfSegmentMs: number;
  attempt: number;
  phase: string | null;
  level: { key: string; label: string };
}

export function buildCapacityMessage(input: CapacityMessageInput) {
  const m = input.restingMetrics;
  const resonance = input.resonance;
  return {
    type: COMPLETE_MESSAGE,
    // Read by the platform's listener to distinguish a redelivery from a second assessment.
    // A platform build that predates this field falls back to accepting once per mount, which is
    // the behaviour that shipped before -- so an older parent is no worse off, never worse.
    completionId: input.completionId,
    metrics: {
      recoveryIndex: input.recoveryIndex,
      rmssd: m?.rmssd ?? null,
      sdnn: m?.sdnn ?? null,
      pnn50: m?.pnn50 ?? null,
      nn50: m?.nn50 ?? null,
      meanHR: m?.meanHR ?? null,
      meanRR: m?.meanRR ?? null,
      totalPower: m?.totalPower ?? null,
      lfPower: m?.lfPower ?? null,
      hfPower: m?.hfPower ?? null,
      vlfPower: m?.vlfPower ?? null,
      lfHfRatio: m?.lfHfRatio ?? null,
      lfNu: m?.lfNu ?? null,
      hfNu: m?.hfNu ?? null,
      breathRate: m?.breathRate ?? null,
      sampEn: m?.sampEn ?? null,
      dfaA1: m?.dfaA1 ?? null,
      coherence: m?.coherence ?? null,
      stressIdx: m?.stressIdx ?? null,
      resonanceFreq: resonance.rate,
    },
    rawData: {
      // Capped so a runaway buffer cannot produce a message the parent chokes on.
      resting_rr: input.restingRR.slice(0, MAX_RESTING_RR),
      rf_results: input.rfSegments.map((seg, i) => ({
        rate: seg.rate,
        amplitude: seg.metrics?.sdnn ?? null,
        coherence: seg.metrics?.coherence ?? null,
        rmssd: seg.metrics?.rmssd ?? null,
        rr_count: seg.rrCount,
        resonance_score: Math.round((resonance.scores[i] ?? 0) * 1000) / 1000,
      })),
      rf_rr_per_rate: input.rfRR.map((rr) => rr.slice(0, MAX_RF_RR_PER_RATE)),
      resonance_freq: resonance.rate,
      device_mode: input.deviceMode,
      // Time actually recorded, not wall clock — a paused or resumed run must
      // not inflate this.
      recording_duration_ms: input.restingMs + input.rfSegments.length * input.rfSegmentMs,
      // Echoed back so the platform's submit route does not have to correlate
      // the result with the launch it came from.
      attempt: input.attempt,
      phase: input.phase,
      capacity_level: input.level.key,
      capacity_label: input.level.label,
    },
  };
}

// A full-assessment sitting: the scored result exactly as before, plus the sweep, plus
// the age band's fields when there are any (`ageBand`, `context.age_band`).
//
// rawData also gains `self_report_pick`: the pace the person RATED best (insight-sweep.ts
// selfReportPick: grounded, focused and presence averaged, ties to the slower rate; null
// with nothing to compare). It sits beside the MEASURED pick (`resonance_freq`) and may
// differ from it. It is never written into a measured field.
export function buildFullMessage(
  input: CapacityMessageInput,
  sweep: SweepEnvelope,
  selfReport: { rate: number | null },
  age: AgeFields = {}
) {
  const scored = buildCapacityMessage(input);
  return {
    ...scored,
    rawData: { ...scored.rawData, self_report_pick: { rate: selfReport.rate } },
    sweep,
    ...age,
  };
}

// The pace-finder pick, with where it came from. A self-reported pick is the rate the
// person rated best, and is NEVER a measured resonance frequency.
export type ResonancePick =
  | { rate: number; source: 'measured' }
  | { rate: number | null; source: 'self_report' };

export interface PaceFinderMessageInput {
  completionId: string;
  sweep: SweepEnvelope;
  pick: ResonancePick;
  // Only with an armband (or the simulation); empty without one.
  rfSegments: RFSegment[];
  rfRR: number[][];
  resonanceScores: number[];
  deviceMode: DeviceMode;
  rfSegmentMs: number;
  attempt: number;
  phase: string | null;
}

// `age` carries `ageBand` only: there is no scored result here for a context to belong to.
export function buildPaceFinderMessage(input: PaceFinderMessageInput, age: Pick<AgeFields, 'ageBand'> = {}) {
  const measured = input.pick.source === 'measured';
  return {
    type: COMPLETE_MESSAGE,
    completionId: input.completionId,
    rawData: {
      mode: 'pace-finder' as const,
      // ⚠ Self-report and measurement are kept apart by name. `resonance_freq`, which the
      // full assessment uses for the measured rate, is set ONLY when the pick was measured.
      resonance_pick: input.pick,
      resonance_freq: measured ? input.pick.rate : null,
      rf_results: input.rfSegments.map((seg, i) => ({
        rate: seg.rate,
        amplitude: seg.metrics?.sdnn ?? null,
        coherence: seg.metrics?.coherence ?? null,
        rmssd: seg.metrics?.rmssd ?? null,
        rr_count: seg.rrCount,
        resonance_score: Math.round((input.resonanceScores[i] ?? 0) * 1000) / 1000,
      })),
      rf_rr_per_rate: input.rfRR.map((rr) => rr.slice(0, MAX_RF_RR_PER_RATE)),
      device_mode: input.deviceMode,
      recording_duration_ms: input.rfSegments.length * input.rfSegmentMs,
      attempt: input.attempt,
      phase: input.phase,
    },
    sweep: input.sweep,
    ...(age.ageBand ? { ageBand: age.ageBand } : {}),
  };
}
