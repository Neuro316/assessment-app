'use client';

// ===== PRACTICE INSTRUMENT =====
// The exercise list, a running session, and the record a session produces. The
// host supplies who may do what and decides what happens to the record; this file
// and everything it imports make no network calls.
//
// Strap handling:
//   - Bluetooth unsupported: the pacer runs alone and the record carries
//     hrvAvailable: false with every metric null.
//   - Supported: connecting is offered but optional. RR is collected only while a
//     session is running, and metrics are computed once, when it ends.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { primeAudio } from './audio';
import type { HRDataPoint } from './bluetooth';
import { computeSessionMetrics, emptySessionMetrics } from './hrv-metrics';
import PacerSession from './PacerSession';
import type {
  PracticeAccessArm,
  PracticeExercise,
  PracticeHoldRecord,
  PracticeSessionMetrics,
  PracticeSessionRecord,
  PracticeTier,
  SessionContext,
} from './types';
import type { PhaseEnd, PhaseStart } from './usePacerProgram';
import { usePracticeStrap, type PracticeStrapState } from './usePracticeStrap';
import { useSessionWakeLock } from './useSessionWakeLock';

const C = {
  blue: '#386797',
  indigo: '#324C66',
  charcoal: '#393939',
  mist: '#E9EDF0',
  pale: '#F0F4F8',
  green: '#4A9B7F',
  red: '#C0625A',
};

const TIER_LABEL: Record<PracticeTier, string> = {
  insight: 'Insight',
  practice: 'Practice',
  mastery: 'Mastery',
};

export interface PracticeInstrumentProps {
  baseline: { resonanceFreq: number | null } | null;
  exercises: PracticeExercise[];
  // The arm that grants this person the exercise, or null when it is locked. Build
  // it from this package's canUseExercise; the arm is written into the record.
  canUseExercise: (exercise: PracticeExercise) => PracticeAccessArm | null;
  onRecordSession: (record: PracticeSessionRecord) => void;
  onNeedsBaseline: () => void;
  // The host's brand mark, shown spinning while the armband connects. A square image
  // of a round mark works best. The package ships no brand assets of its own, so
  // without this a plain spinner is shown instead.
  connectingLogoSrc?: string;
  // Tone cues during a session. Default true; false for a silent session.
  audioEnabled?: boolean;
}

// An exercise chosen from the list, on its intro screen and not yet started.
interface Chosen {
  exercise: PracticeExercise;
  // Taken when the exercise is chosen, so the record says what granted it then.
  accessArm: PracticeAccessArm;
}

interface RunningSession extends Chosen {
  startedAt: number;
}

// How to set up, by where the exercise happens. Framing only.
const CONTEXT_FRAMING: Record<SessionContext, string> = {
  seated: 'Find a comfortable seat where you can stay still for the whole session.',
  walking:
    'Find a safe place to walk at an easy pace — away from traffic, water and anything you need to watch closely.',
};

interface Finished {
  exercise: PracticeExercise;
  record: PracticeSessionRecord;
}

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const STRAP_LABEL: Record<PracticeStrapState, string> = {
  unsupported: 'Bluetooth is not available in this browser — the pacer runs on its own.',
  idle: 'Armband not connected',
  reconnecting: 'Reconnecting to your armband…',
  searching: 'Choose your armband in the dialog…',
  connecting: 'Connecting to your armband… this can take several seconds.',
  connected: 'Armband connected',
  error: 'Could not connect',
};

// The states where the link is coming up and the person can only wait. Without
// something moving on screen, a connect that takes several seconds reads as stuck.
const WORKING_STATES: PracticeStrapState[] = ['reconnecting', 'connecting'];

// ===== SMALL PIECES =====

// Keyframes cannot be declared in an inline style, and the package carries no
// stylesheet, so the spin is declared here and rendered with the logo. The names are
// prefixed so they cannot collide with anything in the host's CSS.
const LOGO_SPIN_CSS = `
@keyframes np-practice-logo-spin { to { transform: rotate(360deg); } }
.np-practice-logo-spin { animation: np-practice-logo-spin 1.3s linear infinite; }
@media (prefers-reduced-motion: reduce) {
  .np-practice-logo-spin { animation-duration: 4s; }
}
`;

// The host's brand mark, spinning. Expects a square image of a round mark; it is
// clipped to a circle and multiplied, so a white background drops out against the
// pale status bar.
function LogoSpinner({ src }: { src: string }) {
  return (
    <>
      <style>{LOGO_SPIN_CSS}</style>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden
        width={36}
        height={36}
        className="np-practice-logo-spin"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          objectFit: 'cover',
          mixBlendMode: 'multiply',
          flexShrink: 0,
        }}
      />
    </>
  );
}

// Fallback when the host passes no logo. Animated with SVG's own animateTransform,
// so it needs no CSS at all.
function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6.5" fill="none" stroke={C.mist} strokeWidth="2" />
      <path d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5" fill="none" stroke={C.blue} strokeWidth="2" strokeLinecap="round">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 8 8"
          to="360 8 8"
          dur="0.9s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}

function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const style: CSSProperties =
    variant === 'primary'
      ? { background: C.blue, color: '#fff', border: 'none' }
      : { background: '#fff', color: C.indigo, border: `1px solid ${C.mist}` };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...style,
        borderRadius: 12,
        padding: '12px 20px',
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

function StrapBar({
  state,
  hr,
  battery,
  error,
  onConnect,
  logoSrc,
}: {
  state: PracticeStrapState;
  hr: number | null;
  battery: number | null;
  error: string | null;
  onConnect: () => void;
  logoSrc?: string;
}) {
  const canConnect = state === 'idle' || state === 'error';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        padding: '12px 16px',
        borderRadius: 12,
        background: state === 'connected' ? `${C.green}14` : C.pale,
        fontSize: 13,
        color: C.charcoal,
      }}
    >
      <span
        style={{ display: 'flex', alignItems: 'center', gap: 10 }}
        role="status"
        aria-live="polite"
      >
        {WORKING_STATES.includes(state) ? (
          logoSrc ? <LogoSpinner src={logoSrc} /> : <Spinner />
        ) : null}
        <span>
          {state === 'connected' && hr ? `${STRAP_LABEL.connected} — ${hr} bpm` : STRAP_LABEL[state]}
          {state === 'connected' && battery !== null ? ` · battery ${battery}%` : ''}
          {state === 'error' && error ? ` — ${error}` : ''}
        </span>
      </span>
      {canConnect ? (
        <Button variant="secondary" onClick={onConnect}>
          Connect armband
        </Button>
      ) : null}
    </div>
  );
}

function MetricLine({ label, value, unit }: { label: string; value: number | null; unit?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
      <span style={{ opacity: 0.65 }}>{label}</span>
      <span style={{ color: C.indigo, fontWeight: 600 }}>
        {value === null ? '—' : `${value}${unit ? ` ${unit}` : ''}`}
      </span>
    </div>
  );
}

// ===== MAIN =====

export default function PracticeInstrument({
  baseline,
  exercises,
  canUseExercise,
  onRecordSession,
  onNeedsBaseline,
  connectingLogoSrc,
  audioEnabled = true,
}: PracticeInstrumentProps) {
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [running, setRunning] = useState<RunningSession | null>(null);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // The session's raw stream. Refs, not state: they change on every beat and
  // nothing renders from them until the session ends.
  const rrRef = useRef<number[]>([]);
  const collectingRef = useRef(false);
  const disconnectsRef = useRef(0);
  const holdsRef = useRef<PracticeHoldRecord[]>([]);
  // The self-paced hold in progress, if any — so ending the session early can still
  // record it as 'abandoned'.
  const openHoldRef = useRef<{ round: number | null; startedAt: number } | null>(null);

  // Screen stays awake for the whole session, strap or no strap.
  useSessionWakeLock(running !== null);

  const onPhaseStart = useCallback(({ phase, startedAt }: PhaseStart) => {
    openHoldRef.current =
      phase.mode === 'self-paced-hold' ? { round: phase.round?.current ?? null, startedAt } : null;
  }, []);

  const onPhaseEnd = useCallback(({ phase, elapsedMs, endedBy }: PhaseEnd) => {
    if (phase.mode !== 'self-paced-hold') return;
    // Closed properly, so it is no longer open. Cleared before anything else: when
    // a hold is the last phase, the session's end runs straight after this.
    openHoldRef.current = null;
    holdsRef.current.push({
      round: phase.round?.current ?? null,
      heldMs: Math.round(elapsedMs),
      endedBy: endedBy === 'person' ? 'person' : 'safety-cap',
    });
  }, []);

  const onData = useCallback((d: HRDataPoint) => {
    if (collectingRef.current && d.rrIntervals.length) rrRef.current.push(...d.rrIntervals);
  }, []);
  const onDropped = useCallback(() => {
    if (collectingRef.current) disconnectsRef.current += 1;
  }, []);

  const strap = usePracticeStrap({ onData, onDropped });

  // Session clock, for display only.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [running]);

  // Called from the Begin tap: that gesture is what lets the tone cues play.
  const start = useCallback((choice: Chosen) => {
    primeAudio();
    rrRef.current = [];
    disconnectsRef.current = 0;
    holdsRef.current = [];
    openHoldRef.current = null;
    collectingRef.current = true;
    setFinished(null);
    setChosen(null);
    setNow(Date.now());
    setRunning({ ...choice, startedAt: Date.now() });
  }, []);

  const cancel = useCallback(() => {
    collectingRef.current = false;
    rrRef.current = [];
    holdsRef.current = [];
    openHoldRef.current = null;
    setRunning(null);
  }, []);

  const end = useCallback(() => {
    if (!running) return;
    collectingRef.current = false;
    const endedAt = Date.now();
    const rr = rrRef.current;

    // Ended early mid-hold: record the hold as it stood, rather than drop it.
    const openHold = openHoldRef.current;
    if (openHold) {
      holdsRef.current.push({
        round: openHold.round,
        heldMs: Math.max(0, endedAt - openHold.startedAt),
        endedBy: 'abandoned',
      });
      openHoldRef.current = null;
    }

    // Computed once, here, over the whole session.
    const metrics: PracticeSessionMetrics =
      strap.state === 'unsupported' ? emptySessionMetrics() : computeSessionMetrics(rr);
    const hrvAvailable = metrics.rmssd !== null;

    const record: PracticeSessionRecord = {
      exerciseId: running.exercise.id,
      startedAt: new Date(running.startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      durationMs: endedAt - running.startedAt,
      hrvAvailable,
      metrics,
      samplesSummary: {
        rrCount: rr.length,
        minRR: rr.length ? Math.min(...rr) : null,
        maxRR: rr.length ? Math.max(...rr) : null,
        strapMode: rr.length ? 'ble' : 'none',
        disconnects: disconnectsRef.current,
      },
      // No narration plays yet, so no narrator is recorded.
      narratorId: null,
      accessArm: running.accessArm,
      holds: holdsRef.current,
    };

    rrRef.current = [];
    holdsRef.current = [];
    setRunning(null);
    setFinished({ exercise: running.exercise, record });
    onRecordSession(record);
  }, [running, strap.state, onRecordSession]);

  const container: CSSProperties = {
    width: '100%',
    maxWidth: 640,
    margin: '0 auto',
    color: C.charcoal,
    fontFamily: 'inherit',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  };

  const strapBar = (
    <StrapBar
      state={strap.state}
      hr={strap.latest?.heartRate || null}
      battery={strap.battery}
      error={strap.error}
      onConnect={() => void strap.connect()}
      logoSrc={connectingLogoSrc}
    />
  );

  // ----- running session -----
  if (running) {
    const { exercise } = running;
    return (
      <div style={container}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.blue }}>
            {exercise.title}
          </div>
          <div style={{ fontSize: 13, opacity: 0.5, fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(now - running.startedAt)}
          </div>
        </div>

        {/* The session ends itself after the program's last phase. */}
        <PacerSession
          program={exercise.program}
          onComplete={end}
          onPhaseStart={onPhaseStart}
          onPhaseEnd={onPhaseEnd}
          audioEnabled={audioEnabled}
        />

        {strapBar}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Button variant="secondary" onClick={cancel}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={end}>
            End early
          </Button>
        </div>
      </div>
    );
  }

  // ----- intro: set-up and safety, before anything starts -----
  if (chosen) {
    const { exercise } = chosen;
    return (
      <div style={container}>
        <div style={{ borderRadius: 16, background: '#fff', border: `1px solid ${C.mist}`, padding: 24 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, color: C.indigo }}>{exercise.title}</h2>
          <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.6, opacity: 0.75 }}>{exercise.description}</p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: C.indigo }}>
            {CONTEXT_FRAMING[exercise.sessionContext ?? 'seated']}
          </p>
        </div>

        {exercise.safetyNote ? (
          <div
            role="note"
            style={{
              borderRadius: 16,
              padding: 20,
              background: `${C.red}12`,
              border: `1px solid ${C.red}55`,
              color: C.charcoal,
            }}
          >
            <div
              style={{
                fontSize: 12,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontWeight: 600,
                color: C.red,
                marginBottom: 6,
              }}
            >
              Before you start
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{exercise.safetyNote}</p>
          </div>
        ) : null}

        {strapBar}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Button variant="secondary" onClick={() => setChosen(null)}>
            Back
          </Button>
          <Button onClick={() => start(chosen)}>Begin</Button>
        </div>
      </div>
    );
  }

  // ----- just finished -----
  if (finished) {
    const { record } = finished;
    return (
      <div style={container}>
        <div
          style={{ borderRadius: 16, background: '#fff', border: `1px solid ${C.mist}`, padding: 24 }}
        >
          <h2 style={{ margin: '0 0 4px', fontSize: 20, color: C.indigo }}>{finished.exercise.title}</h2>
          <p style={{ margin: '0 0 16px', fontSize: 13, opacity: 0.6 }}>
            Session complete — {formatTime(record.durationMs)}
          </p>
          {record.hrvAvailable ? (
            <>
              <MetricLine label="Heart rate" value={record.metrics.meanHR} unit="bpm" />
              <MetricLine label="RMSSD" value={record.metrics.rmssd} unit="ms" />
              <MetricLine label="SDNN" value={record.metrics.sdnn} unit="ms" />
              <MetricLine label="Coherence" value={record.metrics.coherence} unit="%" />
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 14, opacity: 0.65 }}>
              No heart data was recorded for this session.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Button onClick={() => setFinished(null)}>Done</Button>
        </div>
      </div>
    );
  }

  // ----- exercise list -----
  return (
    <div style={container}>
      {baseline === null ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            padding: 16,
            borderRadius: 12,
            background: `${C.blue}0f`,
            fontSize: 14,
            color: C.indigo,
          }}
        >
          <span>Take the capacity assessment to find your personal resonance rate.</span>
          <Button variant="secondary" onClick={onNeedsBaseline}>
            Take the assessment
          </Button>
        </div>
      ) : baseline.resonanceFreq !== null ? (
        <p style={{ margin: 0, fontSize: 13, opacity: 0.65 }}>
          Your resonance rate: {baseline.resonanceFreq.toFixed(1)} breaths / min
        </p>
      ) : null}

      {strapBar}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {exercises.map((exercise) => {
          const arm = canUseExercise(exercise);
          const unlocked = arm !== null;
          return (
            <li
              key={exercise.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: 16,
                borderRadius: 12,
                border: `1px solid ${C.mist}`,
                background: unlocked ? '#fff' : C.pale,
                opacity: unlocked ? 1 : 0.55,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.indigo }}>{exercise.title}</div>
                <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5, opacity: 0.7 }}>
                  {exercise.description}
                </div>
                {!unlocked ? (
                  <div
                    style={{
                      fontSize: 11,
                      marginTop: 6,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: C.blue,
                    }}
                  >
                    {TIER_LABEL[exercise.minTier]} tier
                  </div>
                ) : null}
              </div>
              <Button onClick={() => arm && setChosen({ exercise, accessArm: arm })} disabled={!unlocked}>
                {unlocked ? 'Start' : 'Locked'}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
