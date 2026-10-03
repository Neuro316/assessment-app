// ===== PACER ENGINE (PURE) =====
// Everything about where a session is, worked out from elapsed time alone: which
// part of the breath, how far through it, how much is left, whether the phase is
// over. No React, no timers — usePacerProgram drives these with a clock, and they
// can be tested without one.

import type { BreathPart, BreathRoute, PacedPhase, PacerPhase } from './types';

// ----- authoring helper -----

// Repeats a group of phases, tagging each copy with its round number, e.g.
// rounds(4, [hold, recovery]) for four rounds of hold-then-recover.
export function rounds(total: number, phases: PacerPhase[]): PacerPhase[] {
  const out: PacerPhase[] = [];
  for (let current = 1; current <= total; current++) {
    for (const phase of phases) out.push({ ...phase, round: { current, total } });
  }
  return out;
}

// ----- paced -----

export interface BreathSegment {
  part: BreathPart;
  ms: number;
}

// One breath as its non-empty parts, in order.
export function breathSegments(phase: PacedPhase): BreathSegment[] {
  const parts: [BreathPart, number][] = [
    ['inhale', phase.inhaleSec],
    ['secondInhale', phase.secondInhaleSec ?? 0],
    ['holdIn', phase.holdAfterInhaleSec],
    ['exhale', phase.exhaleSec],
    ['holdOut', phase.holdAfterExhaleSec],
  ];
  return parts.filter(([, sec]) => sec > 0).map(([part, sec]) => ({ part, ms: sec * 1000 }));
}

export function cycleMs(phase: PacedPhase): number {
  return breathSegments(phase).reduce((sum, s) => sum + s.ms, 0);
}

// How many breaths the phase runs. durationSec is rounded up to whole breaths so a
// phase never stops mid-breath; with neither field set it runs one breath.
export function pacedCycles(phase: PacedPhase): number {
  const cycle = cycleMs(phase);
  if (cycle <= 0) return 0;
  if (phase.repCount !== undefined) return Math.max(0, Math.floor(phase.repCount));
  if (phase.durationSec !== undefined) return Math.max(1, Math.ceil((phase.durationSec * 1000) / cycle));
  return 1;
}

export function pacedTotalMs(phase: PacedPhase): number {
  return pacedCycles(phase) * cycleMs(phase);
}

// Where the pacer circle sits for each part: 0 = empty lungs, 1 = full. A second
// inhale tops up from SECOND_INHALE_FROM to full.
const SECOND_INHALE_FROM = 0.8;

const ease = (f: number) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, f)))) / 2;

function amplitudeFor(part: BreathPart, f: number, hasSecondInhale: boolean): number {
  switch (part) {
    case 'inhale':
      return ease(f) * (hasSecondInhale ? SECOND_INHALE_FROM : 1);
    case 'secondInhale':
      return SECOND_INHALE_FROM + ease(f) * (1 - SECOND_INHALE_FROM);
    case 'holdIn':
      return 1;
    case 'exhale':
      return 1 - ease(f);
    case 'holdOut':
      return 0;
  }
}

export interface PacedState {
  part: BreathPart;
  // 0-1 through the current part.
  partFraction: number;
  // 0-1, for the pacer circle.
  amplitude: number;
  // 1-based breath number, and how many there are.
  breath: number;
  breaths: number;
  remainingMs: number;
  done: boolean;
}

export function pacedStateAt(phase: PacedPhase, elapsedMs: number): PacedState {
  const segments = breathSegments(phase);
  const cycle = cycleMs(phase);
  const breaths = pacedCycles(phase);
  const total = breaths * cycle;
  const hasSecond = (phase.secondInhaleSec ?? 0) > 0;

  if (cycle <= 0 || breaths === 0 || elapsedMs >= total) {
    return { part: 'holdOut', partFraction: 1, amplitude: 0, breath: breaths, breaths, remainingMs: 0, done: true };
  }

  const t = Math.max(0, elapsedMs);
  const breathIndex = Math.floor(t / cycle);
  let within = t - breathIndex * cycle;
  for (const seg of segments) {
    if (within < seg.ms) {
      const f = within / seg.ms;
      return {
        part: seg.part,
        partFraction: f,
        amplitude: amplitudeFor(seg.part, f, hasSecond),
        breath: breathIndex + 1,
        breaths,
        remainingMs: total - t,
        done: false,
      };
    }
    within -= seg.ms;
  }
  // Floating-point edge at the very end of a breath.
  const last = segments[segments.length - 1];
  return {
    part: last.part,
    partFraction: 1,
    amplitude: amplitudeFor(last.part, 1, hasSecond),
    breath: breathIndex + 1,
    breaths,
    remainingMs: total - t,
    done: false,
  };
}

// ----- cues -----

const ROUTE_TEXT: Record<BreathRoute, { in: string; out: string; only: string }> = {
  nose: { in: 'in through the nose', out: 'out through the nose', only: 'nose only' },
  mouth: { in: 'in through the mouth', out: 'out through the mouth', only: 'mouth only' },
};

const DEFAULT_WORD: Record<BreathPart, string> = {
  inhale: 'Inhale',
  secondInhale: 'Inhale a little more',
  holdIn: 'Hold',
  exhale: 'Exhale',
  holdOut: 'Hold',
};

// The big word for this part of the breath, and the route line under it.
export function pacedCue(phase: PacedPhase, part: BreathPart): { word: string; route: string | null } {
  const word = phase.cues?.[part] ?? DEFAULT_WORD[part];
  const route =
    part === 'inhale' || part === 'secondInhale'
      ? ROUTE_TEXT[phase.inhaleRoute].in
      : part === 'exhale'
        ? ROUTE_TEXT[phase.exhaleRoute].out
        : null;
  return { word, route };
}

export function routeOnlyText(route: BreathRoute | undefined): string | null {
  return route ? ROUTE_TEXT[route].only : null;
}

// ----- phase ending -----

// The phase ends on its own at this point.
export function autoEndMs(phase: PacerPhase): number | null {
  switch (phase.mode) {
    case 'paced':
      return pacedTotalMs(phase);
    case 'freeform':
      return phase.durationSec !== undefined ? phase.durationSec * 1000 : null;
    case 'self-paced-hold':
      // The safety backstop. Never displayed.
      return phase.safetyCapSec * 1000;
  }
}

// Whether the person can end the phase themselves right now, and with what label.
export function manualEnd(phase: PacerPhase, elapsedMs: number): { label: string; enabled: boolean } | null {
  switch (phase.mode) {
    case 'paced':
      return null;
    case 'freeform': {
      if (phase.durationSec !== undefined) return null;
      const min = (phase.minDurationSec ?? 0) * 1000;
      return { label: phase.continueLabel ?? 'Finish', enabled: elapsedMs >= min };
    }
    case 'self-paced-hold':
      return { label: 'Release — breathe', enabled: true };
  }
}
