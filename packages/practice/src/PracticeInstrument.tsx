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
import type { PracticePurpose, RRSample, SessionEvent } from './types';
import { autoEndMs } from './pacer';
import { PRACTICE_PURPOSES } from './library';
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

// The platform's tokens (npu-platform-v2 tailwind config): np-blue for actions,
// teal for progress and the pacer, gold for locks, fire for the balanced-baseline
// gate. The package carries no stylesheet, so they are inline.
const C = {
  blue: '#386797',
  indigo: '#324C66',
  charcoal: '#393939',
  mist: '#E9EDF0',
  pale: '#F0F4F8',
  green: '#4A9B7F',
  teal: '#2A9D8F',
  tealDark: '#1e7a6f',
  tealLight: '#e6f5f3',
  gold: '#d4a54a',
  goldInk: '#b08429',
  fire: '#c4704b',
  text2: '#6b7280',
  text3: '#9ca3af',
  border: '#e5e2de',
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
  // How many times this person has done the chosen exercise before, plus one,
  // when the host knows. Written into the record as listenNumber.
  listenNumber?: number;
  // Exercises the host recommends from this person's baseline, shown first with a
  // Recommended mark. The package does not decide this; the host does.
  recommendedIds?: string[];
  // Why an exercise beyond the tier gate is held back, when the host knows: the
  // activating set waits for a balanced recent baseline. Return null when open.
  heldBackReason?: (exercise: PracticeExercise) => string | null;
}

// An exercise chosen from the list, on its intro screen and not yet started.
interface Chosen {
  exercise: PracticeExercise;
  // Taken when the exercise is chosen, so the record says what granted it then.
  accessArm: PracticeAccessArm;
  // With the armband, or the pacer alone. Framing and the connect prompt only;
  // the record says what actually happened.
  mode: 'armband' | 'pacer';
}

const FAMILY_LABEL = { breathing: 'Breathing', visualization: 'Visualization', mindfulness: 'Field experiments' } as const;

// How long an exercise runs, from its program. Holds the person ends themselves
// are counted separately.
function exerciseLength(ex: PracticeExercise): string {
  if (ex.kind === 'field') return 'logged after';
  const phases = ex.program.phases;
  const fixed = phases.reduce((sum, ph) => sum + (autoEndMs(ph) ?? 0), 0);
  const openHolds = phases.filter((ph) => ph.mode === 'self-paced-hold').length;
  const openEnded = phases.some((ph) => ph.mode !== 'self-paced-hold' && autoEndMs(ph) === null);
  const base = openEnded ? 'open-ended' : formatTime(fixed);
  return openHolds ? `${base} + ${openHolds} hold${openHolds > 1 ? 's' : ''}` : base;
}

function Pill({ children, tone }: { children: ReactNode; tone: 'teal' | 'gold' | 'fire' | 'fog' | 'blue' }) {
  const bg = { teal: `${C.teal}1f`, gold: `${C.gold}24`, fire: `${C.fire}1f`, fog: C.pale, blue: `${C.blue}18` }[tone];
  const fg = { teal: C.tealDark, gold: C.goldInk, fire: C.fire, fog: C.text2, blue: C.blue }[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 10,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        background: bg,
        color: fg,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
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
  listenNumber,
  recommendedIds,
  heldBackReason,
  onNeedsBaseline,
  connectingLogoSrc,
  audioEnabled = true,
}: PracticeInstrumentProps) {
  const [chosen, setChosen] = useState<Chosen | null>(null);
  // Where the person is in the library: the purpose cards, or one purpose's list.
  const [purpose, setPurpose] = useState<PracticePurpose | 'custom' | null>(null);
  const [family, setFamily] = useState<'all' | 'breathing' | 'visualization' | 'mindfulness'>('all');
  // A field experiment's note, written on the finished screen before the record
  // is handed to the host.
  const [note, setNote] = useState('');
  const [running, setRunning] = useState<RunningSession | null>(null);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // The session's raw stream. Refs, not state: they change on every beat and
  // nothing renders from them until the session ends.
  const rrRef = useRef<number[]>([]);
  // The same beats with per-beat timestamps, for the record's rrSeries.
  const seriesRef = useRef<RRSample[]>([]);
  const eventsRef = useRef<SessionEvent[]>([]);
  const collectingRef = useRef(false);
  const disconnectsRef = useRef(0);
  const holdsRef = useRef<PracticeHoldRecord[]>([]);
  // The self-paced hold in progress, if any — so ending the session early can still
  // record it as 'abandoned'.
  const openHoldRef = useRef<{ round: number | null; startedAt: number } | null>(null);

  // Screen stays awake for the whole session, strap or no strap.
  useSessionWakeLock(running !== null);

  const logEvent = useCallback((e: SessionEvent) => {
    if (collectingRef.current) eventsRef.current.push(e);
  }, []);

  const onPhaseStart = useCallback(({ phase, index, startedAt }: PhaseStart) => {
    eventsRef.current.push({ t: startedAt, type: 'phase-start', index, mode: phase.mode, label: phase.label });
    openHoldRef.current =
      phase.mode === 'self-paced-hold' ? { round: phase.round?.current ?? null, startedAt } : null;
  }, []);

  const onPhaseEnd = useCallback(({ phase, index, elapsedMs, endedBy }: PhaseEnd) => {
    const t = Date.now();
    eventsRef.current.push({ t, type: 'phase-end', index, endedBy });
    if (phase.mode !== 'self-paced-hold') return;
    if (endedBy === 'person') eventsRef.current.push({ t, type: 'hold-release', index });
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
    if (!collectingRef.current || !d.rrIntervals.length) return;
    rrRef.current.push(...d.rrIntervals);
    // A packet can carry two or three intervals describing beats that already
    // happened. The last beat gets the packet's arrival time; each earlier one
    // sits one interval further back, so none is stamped late.
    let t = d.timestamp;
    const stamped: RRSample[] = [];
    for (let i = d.rrIntervals.length - 1; i >= 0; i--) {
      stamped.unshift({ t, rr: d.rrIntervals[i] });
      t -= d.rrIntervals[i];
    }
    seriesRef.current.push(...stamped);
  }, []);
  const onDropped = useCallback(() => {
    if (!collectingRef.current) return;
    disconnectsRef.current += 1;
    eventsRef.current.push({ t: Date.now(), type: 'strap-drop' });
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
    seriesRef.current = [];
    disconnectsRef.current = 0;
    holdsRef.current = [];
    openHoldRef.current = null;
    collectingRef.current = true;
    eventsRef.current = [{ t: Date.now(), type: 'session-start' }];
    setFinished(null);
    setChosen(null);
    setNow(Date.now());
    setRunning({ ...choice, startedAt: Date.now() });
  }, []);

  const cancel = useCallback(() => {
    collectingRef.current = false;
    rrRef.current = [];
    seriesRef.current = [];
    eventsRef.current = [];
    holdsRef.current = [];
    openHoldRef.current = null;
    setRunning(null);
  }, []);

  const end = useCallback((endedBy: 'completed' | 'abandoned' = 'completed') => {
    if (!running) return;
    const endedAt = Date.now();
    eventsRef.current.push({ t: endedAt, type: 'session-end', endedBy });
    collectingRef.current = false;
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
      rrSeries: seriesRef.current,
      events: eventsRef.current,
      listenNumber: listenNumber ?? null,
    };

    rrRef.current = [];
    seriesRef.current = [];
    eventsRef.current = [];
    holdsRef.current = [];
    setRunning(null);
    setNote('');
    setFinished({ exercise: running.exercise, record });
    // A field experiment's record waits for the note on the finished screen;
    // everything else is handed over now.
    if (running.exercise.kind !== 'field') onRecordSession(record);
  }, [running, strap.state, onRecordSession, listenNumber]);

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

        {exercise.kind === 'guided' && exercise.how ? (
          <div style={{ borderRadius: 12, background: '#fff', border: `1px solid ${C.mist}`, padding: '16px 20px' }}>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: C.indigo }}>{exercise.how}</p>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: C.text3 }}>
              Narration for this visualization is coming. For now, read it, then settle into the pacer below.
            </p>
          </div>
        ) : null}

        {/* The session ends itself after the program's last phase. */}
        <PacerSession
          program={exercise.program}
          onComplete={() => end('completed')}
          onPhaseStart={onPhaseStart}
          onPhaseEnd={onPhaseEnd}
          onEvent={logEvent}
          audioEnabled={audioEnabled}
        />

        {strapBar}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Button variant="secondary" onClick={cancel}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => end('abandoned')}>
            End early
          </Button>
        </div>
      </div>
    );
  }

  // ----- intro: set-up and safety, before anything starts -----
  if (chosen) {
    const { exercise } = chosen;
    const setMode = (mode: Chosen['mode']) => {
      setChosen({ ...chosen, mode });
      if (mode === 'armband' && (strap.state === 'idle' || strap.state === 'error')) void strap.connect();
    };
    const chipStyle = (on: boolean): CSSProperties => ({
      padding: '8px 14px',
      borderRadius: 8,
      fontSize: 12.5,
      fontWeight: 500,
      cursor: 'pointer',
      border: `1px solid ${on ? C.blue : C.border}`,
      background: on ? C.blue : '#fff',
      color: on ? '#fff' : C.indigo,
    });
    return (
      <div style={container}>
        <div style={{ borderRadius: 16, background: '#fff', border: `1px solid ${C.mist}`, padding: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.teal, letterSpacing: '0.04em' }}>
            {exercise.id} · {FAMILY_LABEL[exercise.family ?? 'breathing']}
            {exercise.category ? ` · ${exercise.category}` : ''}
          </div>
          <h2 style={{ margin: '4px 0 8px', fontSize: 20, color: C.indigo }}>{exercise.title}</h2>
          <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.6, opacity: 0.75 }}>{exercise.description}</p>
          {exercise.kind !== 'paced' && exercise.how ? (
            <p style={{ margin: '0 0 12px', fontSize: 15, lineHeight: 1.6, color: C.indigo }}>{exercise.how}</p>
          ) : null}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: C.text2 }}>
            <span>{exerciseLength(exercise)}</span>
            {exercise.moment ? <span>{exercise.moment}</span> : null}
            {exercise.axis ? <span>Trains {exercise.axis.toLowerCase()}</span> : null}
          </div>
          {exercise.kind === 'paced' ? (
            <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.6, color: C.indigo }}>
              {CONTEXT_FRAMING[exercise.sessionContext ?? 'seated']}
            </p>
          ) : null}
          {exercise.kind === 'field' ? (
            <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.6, color: C.text2 }}>
              This one happens during an ordinary day, not here. Begin keeps the time; Done is where you write
              what you noticed. It produces information, not biometrics.
            </p>
          ) : null}
        </div>

        {exercise.safetyNote ? (
          <div
            role="note"
            style={{
              borderRadius: 16,
              padding: 20,
              background: `${C.gold}1a`,
              border: `1px solid ${C.gold}`,
              color: C.charcoal,
            }}
          >
            <div
              style={{
                fontSize: 12,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontWeight: 600,
                color: C.goldInk,
                marginBottom: 6,
              }}
            >
              Before you start
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{exercise.safetyNote}</p>
          </div>
        ) : null}

        {exercise.kind !== 'field' && strap.state !== 'unsupported' ? (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: C.text3,
                marginBottom: 8,
              }}
            >
              How are you practicing today?
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" style={chipStyle(chosen.mode === 'armband')} onClick={() => setMode('armband')}>
                With my armband
              </button>
              <button type="button" style={chipStyle(chosen.mode === 'pacer')} onClick={() => setMode('pacer')}>
                Just the pacer
              </button>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 11.5, color: C.text3 }}>
              {chosen.mode === 'armband'
                ? 'Your session is recorded and compared against your baseline.'
                : 'No biometrics this session. Elapsed time and the pacer only.'}
            </p>
          </div>
        ) : null}

        {exercise.kind !== 'field' && chosen.mode === 'armband' ? strapBar : null}

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
          {finished.exercise.kind === 'field' ? (
            <>
              <label htmlFor="np-practice-note" style={{ display: 'block', fontSize: 13, color: C.indigo, marginBottom: 6 }}>
                What did you notice?
              </label>
              <textarea
                id="np-practice-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  font: 'inherit',
                  fontSize: 14,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  color: C.charcoal,
                }}
              />
            </>
          ) : record.hrvAvailable ? (
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
          <Button
            onClick={() => {
              if (finished.exercise.kind === 'field') onRecordSession({ ...record, note: note.trim() || null });
              setFinished(null);
            }}
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  // ----- library: purpose cards, then one purpose's sessions -----
  const recommended = new Set(recommendedIds ?? []);
  const access = (ex: PracticeExercise): { arm: PracticeAccessArm | null; held: string | null } => {
    const arm = canUseExercise(ex);
    if (arm === null) return { arm, held: null };
    return { arm, held: heldBackReason?.(ex) ?? null };
  };
  const groups = new Map<PracticePurpose | 'custom', PracticeExercise[]>();
  for (const ex of exercises) {
    const key = ex.purpose ?? 'custom';
    groups.set(key, [...(groups.get(key) ?? []), ex]);
  }
  const purposeCards: { id: PracticePurpose | 'custom'; title: string; line: string; trains: string }[] = [
    ...PRACTICE_PURPOSES.filter((p) => groups.has(p.id)),
    ...(groups.has('custom')
      ? [{ id: 'custom' as const, title: 'From your facilitator', line: 'Sessions made for you or your program.', trains: 'Varies' }]
      : []),
  ];

  const baselineBanner =
    baseline === null ? (
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
    ) : null;

  if (purpose === null) {
    return (
      <div style={{ ...container, maxWidth: 900 }}>
        {baselineBanner}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.text3 }}>
            What do you need right now?
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.text2 }}>
            Pick a purpose. Each card shows what it trains and how many of its sessions are open to you.
          </p>
        </div>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {purposeCards.map((p) => {
            const items = groups.get(p.id) ?? [];
            const open = items.filter((ex) => access(ex).arm !== null && access(ex).held === null).length;
            const rec = items.some((ex) => recommended.has(ex.id));
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPurpose(p.id);
                  setFamily('all');
                }}
                style={{
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: 18,
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  background: '#fff',
                  color: C.charcoal,
                  cursor: 'pointer',
                  font: 'inherit',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: C.tealLight,
                      color: C.tealDark,
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                    aria-hidden
                  >
                    {p.title[0]}
                  </span>
                  {rec ? <Pill tone="teal">Recommended</Pill> : null}
                </div>
                <div style={{ fontSize: 17, fontWeight: 600, color: C.indigo }}>{p.title}</div>
                <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.5 }}>{p.line}</div>
                <div style={{ fontSize: 11.5, color: C.text2 }}>
                  <b style={{ color: C.charcoal }}>Trains</b> {p.trains}
                </div>
                <div style={{ fontSize: 11.5, color: C.text3, marginTop: 'auto' }}>
                  {items.length} session{items.length === 1 ? '' : 's'} · {open} open to you
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const card = purposeCards.find((p) => p.id === purpose);
  const items = (groups.get(purpose) ?? []).filter((ex) => family === 'all' || (ex.family ?? 'breathing') === family);
  const sorted = [...items].sort((x, y) => Number(recommended.has(y.id)) - Number(recommended.has(x.id)));
  const famCounts = (f: 'all' | 'breathing' | 'visualization' | 'mindfulness') =>
    (groups.get(purpose) ?? []).filter((ex) => f === 'all' || (ex.family ?? 'breathing') === f).length;
  const chip = (on: boolean): CSSProperties => ({
    fontSize: 11,
    fontWeight: 500,
    padding: '4px 10px',
    borderRadius: 999,
    border: `1px solid ${on ? C.blue : C.border}`,
    background: on ? C.blue : '#fff',
    color: on ? '#fff' : C.text2,
    cursor: 'pointer',
    font: 'inherit',
  });

  return (
    <div style={{ ...container, maxWidth: 900 }}>
      <div>
        <Button variant="secondary" onClick={() => setPurpose(null)}>
          ← All purposes
        </Button>
      </div>
      {card ? (
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: C.indigo }}>{card.title}</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.text2 }}>
            {card.line} <span style={{ color: C.text3 }}>Trains {card.trains.toLowerCase()}.</span>
          </p>
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['all', 'breathing', 'visualization', 'mindfulness'] as const).map((f) => (
          <button key={f} type="button" style={chip(family === f)} onClick={() => setFamily(f)}>
            {f === 'all' ? 'All' : FAMILY_LABEL[f]} ({famCounts(f)})
          </button>
        ))}
      </div>

      {strapBar}

      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          background: '#fff',
          overflow: 'hidden',
        }}
      >
        {sorted.length === 0 ? (
          <li style={{ padding: 16, fontSize: 13, color: C.text3 }}>Nothing in this family serves this purpose.</li>
        ) : null}
        {sorted.map((exercise, i) => {
          const { arm, held } = access(exercise);
          const unlocked = arm !== null && held === null;
          return (
            <li
              key={exercise.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '44px minmax(0, 1fr) auto',
                gap: 12,
                alignItems: 'center',
                padding: '12px 16px',
                borderTop: i === 0 ? 'none' : `1px solid ${C.mist}`,
                opacity: unlocked ? 1 : 0.6,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: C.teal }}>{exercise.id}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.indigo }}>{exercise.title}</div>
                <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2 }}>
                  {FAMILY_LABEL[exercise.family ?? 'breathing']} · {exerciseLength(exercise)}
                  {exercise.moment ? ` · ${exercise.moment}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {recommended.has(exercise.id) && unlocked ? <Pill tone="teal">Recommended</Pill> : null}
                {exercise.axis ? <Pill tone="fog">{exercise.axis}</Pill> : null}
                {arm === null ? <Pill tone="gold">{TIER_LABEL[exercise.minTier]}</Pill> : null}
                {arm !== null && held ? <Pill tone="fire">{held}</Pill> : null}
                <Button
                  onClick={() => arm && !held && setChosen({ exercise, accessArm: arm, mode: 'armband' })}
                  disabled={!unlocked}
                >
                  {unlocked ? 'Open' : arm === null ? `Included in ${TIER_LABEL[exercise.minTier]}` : 'Held'}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
