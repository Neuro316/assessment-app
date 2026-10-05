// ===== PACER SESSION =====
// Plays an exercise's PacerProgram and shows whatever the current phase needs:
//   paced           — the breathing circle, the cue word and route, and breaths or
//                     time remaining
//   freeform        — the instruction, a route reminder, elapsed time, and a button
//                     when the person ends it
//   self-paced-hold — the instruction and a release button. No timer, no target:
//                     the safety cap behind it is never shown.
//   media           — an uploaded audio or video track, an image, or a block of
//                     text, while the strap records. Position, play, pause, seek
//                     and end are reported through onEvent, sampled from the
//                     player element itself.
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

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

import BreathPacer from './BreathPacer';
import { CUE, playEndChime, playTone } from './audio';
import { breathSegments, cycleMs, manualEnd, pacedCue, pacedStateAt, routeOnlyText } from './pacer';
import type { BreathPart, MediaPhase, PacerPhase, PacerProgram, SessionEvent } from './types';
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
      const key = `f${index}:${unlocked ? 'unlocked' : 'start'}`;
      // A silent phase still advances its key, so nothing sounds late if a later
      // phase is audible.
      return { key, tone: phase.cue === 'none' ? null : CUE.soft };
    }
    case 'self-paced-hold':
      return { key: `h${index}:${Math.floor(elapsedMs / PRESENCE_MS)}`, tone: CUE.presence };
    case 'media':
      // One soft tone as the step begins. Nothing during a track: the track is
      // the stimulus, and a tone over it would be an event of its own.
      return { key: `m${index}`, tone: phase.cue === 'none' ? null : CUE.soft };
  }
}

// How often a playing track reports its position. One second resolves every
// passage boundary a facilitator could mark, without flooding the event log.
const POSITION_TICK_MS = 1000;

function MediaView({
  phase,
  index,
  onEvent,
  onEnded,
}: {
  phase: MediaPhase;
  index: number;
  onEvent?: (e: SessionEvent) => void;
  onEnded: () => void;
}) {
  const { asset } = phase;
  const lastTickRef = useRef(0);
  const posMs = (el: HTMLMediaElement) => Math.round(el.currentTime * 1000);
  const report = useCallback(
    (type: 'media-play' | 'media-pause' | 'media-seek' | 'media-ended', el: HTMLMediaElement) =>
      onEvent?.({ t: Date.now(), type, index, positionMs: posMs(el) }),
    [onEvent, index]
  );
  const onTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const now = Date.now();
      if (now - lastTickRef.current < POSITION_TICK_MS) return;
      lastTickRef.current = now;
      onEvent?.({ t: now, type: 'media-position', index, positionMs: posMs(e.currentTarget) });
    },
    [onEvent, index]
  );
  // The session was started by a tap, so playback is allowed to begin on its own.
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    el.play().catch(() => {
      /* the person can press play; the pause/play events still log */
    });
  }, [asset.src]);

  // Playing state for the one control a listener gets: pause and resume. No
  // scrubber, no volume strip; a narrated session should not look like a player.
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  };

  const mediaProps = {
    ref: mediaRef as never,
    src: asset.src,
    controls: false,
    preload: 'auto' as const,
    style: { width: '100%', maxWidth: 560, display: 'block', margin: '0 auto' },
    onTimeUpdate,
    onPlay: (e: React.SyntheticEvent<HTMLMediaElement>) => {
      setPlaying(true);
      report('media-play', e.currentTarget);
    },
    onPause: (e: React.SyntheticEvent<HTMLMediaElement>) => {
      setPlaying(false);
      // A pause fires at the natural end too; ended handles that one.
      if (!e.currentTarget.ended) report('media-pause', e.currentTarget);
    },
    onSeeked: (e: React.SyntheticEvent<HTMLMediaElement>) => report('media-seek', e.currentTarget),
    onEnded: (e: React.SyntheticEvent<HTMLMediaElement>) => {
      report('media-ended', e.currentTarget);
      onEnded();
    },
  };

  return (
    <div style={{ textAlign: 'center', padding: '12px 8px' }}>
      {phase.instruction ? (
        <p style={{ margin: '0 0 16px', fontSize: 16, lineHeight: 1.55, color: C.indigo }}>{phase.instruction}</p>
      ) : null}
      {asset.kind === 'audio' ? <audio {...mediaProps} style={{ display: 'none' }} /> : null}
      {asset.kind === 'video' ? <video {...mediaProps} playsInline /> : null}
      {asset.kind === 'audio' || asset.kind === 'video' ? (
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pause' : 'Resume'}
          style={{
            marginTop: 4,
            padding: '8px 18px',
            borderRadius: 999,
            border: `1px solid ${C.mist}`,
            background: '#fff',
            color: C.indigo,
            font: 'inherit',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {playing ? 'Pause' : 'Resume'}
        </button>
      ) : null}
      {asset.kind === 'image' ? (
        <img
          src={asset.src}
          alt={asset.title ?? ''}
          style={{ maxWidth: '100%', maxHeight: 420, borderRadius: 8, display: 'block', margin: '0 auto' }}
        />
      ) : null}
      {asset.kind === 'text' ? (
        <p style={{ margin: '0 auto', maxWidth: '52ch', fontSize: 18, lineHeight: 1.6, color: C.indigo, textAlign: 'left' }}>
          {asset.text}
        </p>
      ) : null}
    </div>
  );
}

export default function PacerSession({
  program,
  onComplete,
  onPhaseStart,
  onPhaseEnd,
  onEvent,
  audioEnabled = true,
}: {
  program: PacerProgram;
  onComplete: () => void;
  onPhaseStart?: (start: PhaseStart) => void;
  onPhaseEnd?: (end: PhaseEnd) => void;
  // Media events (position ticks, play, pause, seek, end), on the session clock.
  onEvent?: (e: SessionEvent) => void;
  audioEnabled?: boolean;
}) {
  // The chime marks the session's own end, not a phase change, and sounds before
  // the host is told, so an early tab switch still hears it.
  const complete = useCallback(() => {
    if (audioEnabled) playEndChime();
    onComplete();
  }, [audioEnabled, onComplete]);
  const playback = usePacerProgram(program, complete, { onPhaseStart, onPhaseEnd });
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
                {phase.hideTimer ? null : (
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
                )}
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
          {phase.hideTimer ? null : (
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
          )}
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

      {phase.mode === 'media' ? (
        <MediaView phase={phase} index={phaseIndex} onEvent={onEvent} onEnded={endPhase} />
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
