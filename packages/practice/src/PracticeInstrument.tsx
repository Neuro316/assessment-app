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

import BreathPacer from './BreathPacer';
import type { HRDataPoint } from './bluetooth';
import { computeSessionMetrics, emptySessionMetrics } from './hrv-metrics';
import type {
  PracticeAccessArm,
  PracticeExercise,
  PracticeSessionMetrics,
  PracticeSessionRecord,
  PracticeTier,
} from './types';
import { usePracticeStrap, type PracticeStrapState } from './usePracticeStrap';

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
}

interface RunningSession {
  exercise: PracticeExercise;
  startedAt: number;
  // Taken when the session starts, so the record says what granted it then.
  accessArm: PracticeAccessArm;
}

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
  connected: 'Armband connected',
  error: 'Could not connect',
};

// ===== SMALL PIECES =====

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
}: {
  state: PracticeStrapState;
  hr: number | null;
  battery: number | null;
  error: string | null;
  onConnect: () => void;
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
      <span>
        {state === 'connected' && hr ? `${STRAP_LABEL.connected} — ${hr} bpm` : STRAP_LABEL[state]}
        {state === 'connected' && battery !== null ? ` · battery ${battery}%` : ''}
        {state === 'error' && error ? ` — ${error}` : ''}
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
}: PracticeInstrumentProps) {
  const [running, setRunning] = useState<RunningSession | null>(null);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // The session's raw stream. Refs, not state: they change on every beat and
  // nothing renders from them until the session ends.
  const rrRef = useRef<number[]>([]);
  const collectingRef = useRef(false);
  const disconnectsRef = useRef(0);

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

  const start = useCallback((exercise: PracticeExercise, accessArm: PracticeAccessArm) => {
    rrRef.current = [];
    disconnectsRef.current = 0;
    collectingRef.current = true;
    setFinished(null);
    setNow(Date.now());
    setRunning({ exercise, startedAt: Date.now(), accessArm });
  }, []);

  const cancel = useCallback(() => {
    collectingRef.current = false;
    rrRef.current = [];
    setRunning(null);
  }, []);

  const end = useCallback(() => {
    if (!running) return;
    collectingRef.current = false;
    const endedAt = Date.now();
    const rr = rrRef.current;

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
    };

    rrRef.current = [];
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
          <div style={{ fontSize: 40, fontWeight: 300, color: C.indigo, fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(now - running.startedAt)}
          </div>
          {exercise.pacerRate ? (
            <div style={{ fontSize: 13, opacity: 0.55 }}>{exercise.pacerRate.toFixed(1)} breaths / min</div>
          ) : null}
        </div>

        {exercise.pacerRate ? (
          <BreathPacer rate={exercise.pacerRate} />
        ) : (
          <p style={{ textAlign: 'center', fontSize: 14, lineHeight: 1.6, opacity: 0.72 }}>
            {exercise.description}
          </p>
        )}

        {strapBar}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Button variant="secondary" onClick={cancel}>
            Cancel
          </Button>
          <Button onClick={end}>End session</Button>
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
              <Button onClick={() => arm && start(exercise, arm)} disabled={!unlocked}>
                {unlocked ? 'Start' : 'Locked'}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
