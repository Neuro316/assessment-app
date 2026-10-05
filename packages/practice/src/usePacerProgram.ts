// ===== usePacerProgram =====
// Plays a PacerProgram: keeps the clock, moves to the next phase when the current
// one ends (on its own, by the person's button, or at a hold's safety cap), and
// calls onComplete once after the last phase.
//
// Time is wall-clock (Date.now), not frame counts, so a throttled or hidden tab
// picks up where the session actually is. Each phase starts when the previous one
// is seen to end, never back-dated, so returning to a tab after a long gap does not
// fast-forward through several phases at once.

import { useCallback, useEffect, useRef, useState } from 'react';

import { autoEndMs } from './pacer';
import type { PacerPhase, PacerProgram } from './types';

// How long the transition highlight lasts after a phase change.
const TRANSITION_MS = 900;

export interface PacerPlayback {
  phase: PacerPhase | null;
  phaseIndex: number;
  phaseCount: number;
  elapsedMs: number;
  // True briefly after a phase change, for a visual cue.
  transitioning: boolean;
  done: boolean;
  // Ends the current phase now: the person's Release / Finish / Next button.
  endPhase: () => void;
}

// How a phase came to an end. 'auto' on a self-paced hold is its safety cap.
export type PhaseEndedBy = 'auto' | 'person';

export interface PhaseEnd {
  phase: PacerPhase;
  index: number;
  // How long the phase actually lasted.
  elapsedMs: number;
  endedBy: PhaseEndedBy;
}

export interface PhaseStart {
  phase: PacerPhase;
  index: number;
  // Wall-clock ms (Date.now) when the phase began.
  startedAt: number;
}

export interface PacerCallbacks {
  onPhaseStart?: (start: PhaseStart) => void;
  onPhaseEnd?: (end: PhaseEnd) => void;
}

export function usePacerProgram(
  program: PacerProgram,
  onComplete: () => void,
  callbacks: PacerCallbacks = {}
): PacerPlayback {
  const phases = program.phases;
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phaseStartedAt, setPhaseStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [done, setDone] = useState(phases.length === 0);

  const onCompleteRef = useRef(onComplete);
  const onPhaseEndRef = useRef(callbacks.onPhaseEnd);
  const onPhaseStartRef = useRef(callbacks.onPhaseStart);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onPhaseEndRef.current = callbacks.onPhaseEnd;
    onPhaseStartRef.current = callbacks.onPhaseStart;
  });

  // Announce each phase as it begins, once.
  useEffect(() => {
    if (done) return;
    const started = phases[phaseIndex];
    if (started) onPhaseStartRef.current?.({ phase: started, index: phaseIndex, startedAt: phaseStartedAt });
    // phaseStartedAt changes together with phaseIndex; keying on the index alone
    // is what makes this fire exactly once per phase.
  }, [phaseIndex, done]);

  // Guards against advancing twice for one phase (a tick and a tap in the same frame).
  const advancedFromRef = useRef<number | null>(null);
  // Read inside advance, which must not depend on the per-frame clock.
  const phaseStartedAtRef = useRef(phaseStartedAt);
  phaseStartedAtRef.current = phaseStartedAt;

  const advance = useCallback(
    (fromIndex: number, endedBy: PhaseEndedBy) => {
      if (advancedFromRef.current === fromIndex) return;
      advancedFromRef.current = fromIndex;
      const t = Date.now();
      const ended = phases[fromIndex];
      if (ended) {
        // An automatic end is reported at the moment it was due, not when the tick
        // happened to notice it — so a capped hold reads as exactly the cap.
        const due = autoEndMs(ended);
        const actual = t - phaseStartedAtRef.current;
        const elapsedMs = endedBy === 'auto' && due !== null ? Math.min(actual, due) : actual;
        onPhaseEndRef.current?.({ phase: ended, index: fromIndex, elapsedMs, endedBy });
      }
      if (fromIndex >= phases.length - 1) {
        setDone(true);
        onCompleteRef.current();
        return;
      }
      setPhaseIndex(fromIndex + 1);
      setPhaseStartedAt(t);
      setNow(t);
    },
    [phases]
  );

  // The clock. A frame-rate tick drives the pacer animation while the tab is
  // visible. Browsers stop requestAnimationFrame entirely in a hidden tab, which
  // would freeze phase changes and cues the moment the person switches away, so
  // a coarse interval keeps the session moving underneath (throttled to about
  // once a second in the background, which is enough to end a phase and sound
  // its cue near its moment).
  useEffect(() => {
    if (done) return;
    let raf = 0;
    const loop = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
    };
  }, [done]);

  const phase = done ? null : phases[phaseIndex] ?? null;
  const elapsedMs = Math.max(0, now - phaseStartedAt);

  // Auto-end: a paced phase's last breath, a timed freeform phase, or a hold's
  // safety cap.
  useEffect(() => {
    if (!phase) return;
    const end = autoEndMs(phase);
    if (end !== null && elapsedMs >= end) advance(phaseIndex, 'auto');
  }, [phase, phaseIndex, elapsedMs, advance]);

  const endPhase = useCallback(() => {
    if (!done) advance(phaseIndex, 'person');
  }, [advance, done, phaseIndex]);

  return {
    phase,
    phaseIndex,
    phaseCount: phases.length,
    elapsedMs,
    transitioning: phaseIndex > 0 && elapsedMs < TRANSITION_MS,
    done,
    endPhase,
  };
}
