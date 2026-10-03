// ===== PACER SESSION =====
// Plays an exercise's PacerProgram and shows whatever the current phase needs:
//   paced           — the breathing circle, the cue word and route, and breaths or
//                     time remaining
//   freeform        — the instruction, a route reminder, elapsed time, and a button
//                     when the person ends it
//   self-paced-hold — the instruction and a release button. No timer, no target:
//                     the safety cap behind it is never shown.
// Calls onComplete once the last phase ends.
//
// Tone cues (unless audioEnabled is false):
//   paced           — a tone as each part of the breath begins: inhale (higher),
//                     second inhale, hold, exhale (lower). A hold's end is marked by
//                     the tone of the part that follows it. A breath shorter than
//                     MIN_FULLY_CUED_BREATH_MS sounds only as it begins.
//   freeform        — a soft tone as the phase begins, and again when its button
//                     becomes available after a minimum duration.
//   self-paced-hold — a very soft, low tone at the start and every PRESENCE_MS
//                     after: company, not a count. Nothing rises or speeds up.

import { useEffect, useRef, type CSSProperties } from 'react';

import BreathPacer from './BreathPacer';
import { CUE, playTone } from './audio';
import { breathSegments, cycleMs, manualEnd, pacedCue, pacedStateAt, routeOnlyText } from './pacer';
import type { BreathPart, PacerPhase, PacerProgram } from './types';
import { usePacerProgram, type PhaseEnd, type PhaseStart } from './usePacerProgram';

// Spacing of the presence tone during a self-paced hold. Long and even on purpose:
// frequent enough to be company, too sparse to count by.
const PRESENCE_MS = 20_000;

// A whole breath (every part, holds included) shorter than this sounds only once,
// as it begins, rather than on every part — so fast phases (B13's breaths, B16's
// Medium and Fast, B14's pulses, B10's brisk breaths) get one tone per breath
// instead of one every second. Longer breaths cue every part, short ones included:
// the sigh's 1s top-up and B7's 1s final pause are the moments those exercises are
// about. The exercise timings themselves are untouched.
const MIN_FULLY_CUED_BREATH_MS = 3_500;

const PART_CUE: Record<BreathPart, (typeof CUE)[keyof typeof CUE]> = {
  inhale: CUE.inhale,
  secondInhale: CUE.secondInhale,
  holdIn: CUE.hold,
  exhale: CUE.exhale,
  holdOut: CUE.hold,
};

const C = {
  blue: '#386797',
  indigo: '#324C66',
  charcoal: '#393939',
  mist: '#E9EDF0',
  pale: '#F0F4F8',
};

function formatTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const bigButton: CSSProperties = {
  width: '100%',
  maxWidth: 360,
  borderRadius: 16,
  padding: '18px 24px',
  fontSize: 17,
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
};

// The phase's name line: its label and round, e.g. "Slow · Round 2 of 4".
function PhaseHeading({ phase, highlight }: { phase: PacerPhase; highlight: boolean }) {
  const parts = [phase.label, phase.round ? `Round ${phase.round.current} of ${phase.round.total}` : null].filter(
    Boolean
  );
  if (!parts.length) return null;
  return (
    <div
      style={{
        alignSelf: 'center',
        fontSize: 12,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: C.blue,
        padding: '4px 12px',
        borderRadius: 999,
        // The transition cue: the heading lights up briefly when a phase begins.
        background: highlight ? `${C.blue}1f` : 'transparent',
        transition: 'background 0.4s ease-out',
      }}
    >
      {parts.join(' · ')}
    </div>
  );
}

// Which cue the current moment calls for, keyed so each one sounds exactly once.
// Exported for testing; not part of the package's public API.
export function cueFor(
  phase: PacerPhase,
  index: number,
  elapsedMs: number
): { key: string; tone: (typeof CUE)[keyof typeof CUE] | null } | null {
  switch (phase.mode) {
    case 'paced': {
      const state = pacedStateAt(phase, elapsedMs);
      if (state.done) return null;
      const key = `p${index}:${state.breath}:${state.part}`;
      const opensBreath = state.part === breathSegments(phase)[0]?.part;
      // A short breath cues only its opening part. The other parts' keys still
      // advance (so nothing sounds late), silently.
      if (cycleMs(phase) < MIN_FULLY_CUED_BREATH_MS && !opensBreath) return { key, tone: null };
      return { key, tone: PART_CUE[state.part] };
    }
    case 'freeform': {
      const unlocked = (phase.minDurationSec ?? 0) > 0 && manualEnd(phase, elapsedMs)?.enabled === true;
      return { key: `f${index}:${unlocked ? 'unlocked' : 'start'}`, tone: CUE.soft };
    }
    case 'self-paced-hold':
      return { key: `h${index}:${Math.floor(elapsedMs / PRESENCE_MS)}`, tone: CUE.presence };
  }
}

export default function PacerSession({
  program,
  onComplete,
  onPhaseStart,
  onPhaseEnd,
  audioEnabled = true,
}: {
  program: PacerProgram;
  onComplete: () => void;
  onPhaseStart?: (start: PhaseStart) => void;
  onPhaseEnd?: (end: PhaseEnd) => void;
  audioEnabled?: boolean;
}) {
  const playback = usePacerProgram(program, onComplete, { onPhaseStart, onPhaseEnd });
  const { phase, phaseIndex, elapsedMs, transitioning, endPhase } = playback;

  // Sounds each cue once, as its moment arrives. Keys are tracked even while muted,
  // so unmuting mid-session does not replay a cue that already passed.
  const lastCueRef = useRef<string | null>(null);
  useEffect(() => {
    if (!phase) return;
    const cue = cueFor(phase, phaseIndex, elapsedMs);
    if (!cue || cue.key === lastCueRef.current) return;
    lastCueRef.current = cue.key;
    if (audioEnabled && cue.tone) playTone(cue.tone);
  }, [phase, phaseIndex, elapsedMs, audioEnabled]);

  if (!phase) return null;

  const manual = manualEnd(phase, elapsedMs);
  // A freeform phase that ends the whole session says so, whatever its own label
  // ("Next round" on the last round would point at nothing).
  const isLast = playback.phaseIndex === playback.phaseCount - 1;
  const manualLabel = manual && phase.mode === 'freeform' && isLast ? 'Finish' : manual?.label;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'stretch' }}>
      <PhaseHeading phase={phase} highlight={transitioning} />

      {phase.mode === 'paced'
        ? (() => {
            const state = pacedStateAt(phase, elapsedMs);
            const cue = pacedCue(phase, state.part);
            return (
              <>
                <BreathPacer amplitude={state.amplitude} word={cue.word} route={cue.route} />
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: 14,
                    color: C.charcoal,
                    opacity: 0.6,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {phase.repCount !== undefined
                    ? `Breath ${state.breath} of ${state.breaths}`
                    : `${formatTime(state.remainingMs)} left`}
                </div>
              </>
            );
          })()
        : null}

      {phase.mode === 'freeform' ? (
        <div style={{ textAlign: 'center', padding: '24px 8px' }}>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.55, color: C.indigo }}>{phase.instruction}</p>
          {routeOnlyText(phase.route) ? (
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: C.blue,
              }}
            >
              {routeOnlyText(phase.route)}
            </div>
          ) : null}
          <div
            style={{
              marginTop: 24,
              fontSize: 40,
              fontWeight: 300,
              color: C.indigo,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatElapsed(elapsedMs)}
          </div>
        </div>
      ) : null}

      {phase.mode === 'self-paced-hold' ? (
        <div style={{ textAlign: 'center', padding: '24px 8px' }}>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.55, color: C.indigo }}>{phase.instruction}</p>
          <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.5, color: C.charcoal, opacity: 0.7 }}>
            Release whenever you want to. Breathing again early is always the right call — there is no
            time to beat.
          </p>
        </div>
      ) : null}

      {manual ? (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={endPhase}
            disabled={!manual.enabled}
            style={{
              ...bigButton,
              background: C.blue,
              color: '#fff',
              opacity: manual.enabled ? 1 : 0.4,
              cursor: manual.enabled ? 'pointer' : 'default',
            }}
          >
            {manualLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
