// ===== BREATH PATTERN RUNNER =====
// Advances a BreathPattern's phases on a clock while a session is running,
// looping back to phase 0 at the end of each breath, and reports when each
// phase begins so the caller can decide whether to sound a cue (via cueFor)
// and whether the person is mid-hold when they end the session (for
// hold-recording's `abandoned` outcome).
//
// RECONSTRUCTION NOTICE: new code. Nothing about the original runner's
// implementation survived — only the cue-timing rule it must respect
// (pacer-engine.ts) and that a hold-recording feature existed alongside it.

import { useEffect, useRef, useState } from 'react';

import { cueFor, type BreathPattern } from './pacer-engine';

export interface BreathPatternState {
  phaseIndex: number;
  cycleCount: number;
  // Elapsed time within the current phase, for driving a progress ring etc.
  elapsedInPhaseMs: number;
}

export interface UseBreathPatternOptions {
  running: boolean;
  // Called the instant a phase begins (including phase 0 of every new
  // cycle), before state updates — this is where a tone should play, gated
  // by cueFor so short breaths don't buzz on every phase.
  onPhaseStart?: (phaseIndex: number, cycleCount: number) => void;
}

const TICK_MS = 100;

export function useBreathPattern(
  pattern: BreathPattern,
  { running, onPhaseStart }: UseBreathPatternOptions
): BreathPatternState {
  const [state, setState] = useState<BreathPatternState>({
    phaseIndex: 0,
    cycleCount: 0,
    elapsedInPhaseMs: 0,
  });

  // Mutable clock state, so the interval callback always sees current
  // phase/cycle without re-subscribing on every tick.
  const phaseIndexRef = useRef(0);
  const cycleCountRef = useRef(0);
  const phaseStartedAtRef = useRef(0);
  const firedStartRef = useRef(false);

  useEffect(() => {
    if (!running || pattern.phases.length === 0) return;

    phaseIndexRef.current = 0;
    cycleCountRef.current = 0;
    phaseStartedAtRef.current = Date.now();
    setState({ phaseIndex: 0, cycleCount: 0, elapsedInPhaseMs: 0 });

    if (cueFor(pattern, 0)) onPhaseStart?.(0, 0);

    const id = setInterval(() => {
      const elapsed = Date.now() - phaseStartedAtRef.current;
      const currentPhase = pattern.phases[phaseIndexRef.current];

      if (elapsed >= currentPhase.durationMs) {
        let nextIndex = phaseIndexRef.current + 1;
        let nextCycle = cycleCountRef.current;
        if (nextIndex >= pattern.phases.length) {
          nextIndex = 0;
          nextCycle += 1;
        }
        phaseIndexRef.current = nextIndex;
        cycleCountRef.current = nextCycle;
        phaseStartedAtRef.current = Date.now();

        if (cueFor(pattern, nextIndex)) onPhaseStart?.(nextIndex, nextCycle);

        setState({ phaseIndex: nextIndex, cycleCount: nextCycle, elapsedInPhaseMs: 0 });
      } else {
        setState({
          phaseIndex: phaseIndexRef.current,
          cycleCount: cycleCountRef.current,
          elapsedInPhaseMs: elapsed,
        });
      }
    }, TICK_MS);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pattern identity is treated as stable per exercise selection, not per render
  }, [running, pattern]);

  return state;
}

// Whether the current phase counts as "mid-hold" for abandonment purposes —
// kept separate from the hook so a caller ending the session can check it
// against the last known state without needing a fresh render.
export function isHoldPhase(pattern: BreathPattern, phaseIndex: number): boolean {
  const phase = pattern.phases[phaseIndex];
  return phase?.kind === 'hold';
}
