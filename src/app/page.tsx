'use client';

// ===== CAPACITY ASSESSMENT =====
// Single-page guided assessment. No navigation, no tabs, no report views.
// The participant opens this and walks it start to finish:
//   connect -> checklist -> resting intro -> resting (5 min)
//   -> resting done -> rf intro -> rf (6 rates x 2 min) -> rf done -> complete
//
// The app is a data collection instrument only. It records biometrics, computes
// metrics, and hands them to the embedding platform via postMessage. It stores
// nothing itself beyond a local crash-recovery draft.
//
// Launch params (URL): ?embedded=true&name=<participant>&attempt=<n>&phase=<pre|post>
// Without embedded=true the assessment does not render at all — see GateScreen.
// Dev flag: ?fast=1 shortens every recording segment so the flow can be walked in ~2 min.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  connectHW9,
  connectSimulated,
  findPairedHW9,
  isBLESupported,
  reconnectHW9,
  type ConnectStage,
  type HRConnection,
  type HRDataPoint,
} from '@/lib/bluetooth';
import { computeAllMetrics, type HRVMetrics } from '@/lib/hrv-metrics';
import { bell, cancelAudio, doubleBell, playAudio } from '@/lib/audio';
import {
  clearSession,
  formatSavedAt,
  loadSession,
  saveSession,
  type SessionState,
} from '@/lib/session';

// ===== BRAND =====
const C = {
  blue: '#386797',
  indigo: '#324C66',
  charcoal: '#393939',
  mist: '#E9EDF0',
  pale: '#F0F4F8',
  green: '#4A9B7F',
  amber: '#D4A843',
  red: '#C0625A',
};

// ===== PROTOCOL =====
const RESTING_MS = 5 * 60 * 1000;
const RF_SEGMENT_MS = 2 * 60 * 1000;
const RF_RATES = [4.5, 5.0, 5.5, 6.0, 6.5, 7.0];

// The recorded voice track in public/Audio, in protocol order. `rate` is indexed
// by RF_RATES, so 6.mp3 is 4.5 br/min through 11.mp3 at 7.0.
const AUDIO = {
  welcome: '1.mp3',
  checklist: '2.mp3',
  restingStart: '3.mp3',
  restingComplete: '4.mp3',
  rfIntro: '5.mp3',
  rate: ['6.mp3', '7.mp3', '8.mp3', '9.mp3', '10.mp3', '11.mp3'],
  rateComplete: '12.mp3',
  assessmentComplete: '13.mp3',
  disconnected: '14.mp3',
  reconnected: '15.mp3',
};

const PLATFORM_URL = process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://university.neuroprogeny.com';

// The coaching call the completion screen sends people to. It lives on the
// University, outside this iframe, so the link has to break out of the frame.
const COACHING_URL = 'https://university.neuroprogeny.com/programs/15-minute-coaching-session';

// Caps on what rides in the postMessage. A 20 minute recording is well under
// these, but a runaway buffer must not produce a message the parent cannot handle.
const MAX_RESTING_RR = 2000;
const MAX_RF_RR_PER_RATE = 500;

type Phase =
  | 'connect'
  | 'checklist'
  | 'resting-intro'
  | 'resting'
  | 'resting-done'
  | 'rf-intro'
  | 'rf'
  | 'rf-done'
  | 'complete';

const ACTIVE_PHASES: Phase[] = [
  'checklist',
  'resting-intro',
  'resting',
  'resting-done',
  'rf-intro',
  'rf',
  'rf-done',
];

interface RFSegment {
  rate: number;
  metrics: HRVMetrics | null;
  rrCount: number;
}

// ===== CAPACITY FRAMING =====
// Levels describe how the nervous system is currently allocating its resources.
// They are never a judgement and never a diagnosis.
interface CapacityLevel {
  key: string;
  label: string;
  color: string;
  description: string;
}

function capacityLevel(rmssd: number): CapacityLevel {
  if (rmssd >= 50) {
    return {
      key: 'expanded',
      label: 'Expanded Capacity',
      color: C.green,
      description:
        'Your system is running with resources to spare. Recovery, digestion and connection are all well funded right now — the signature of a nervous system that is not spending heavily on defence. This is a good window for challenge, learning and growth.',
    };
  }
  if (rmssd >= 30) {
    return {
      key: 'building',
      label: 'Building Capacity',
      color: C.blue,
      description:
        'Your system is investing in recovery while still holding a reserve back. Everyday demand is being met and capacity is being rebuilt in the background. This is an adaptive, forward-moving allocation — the reserve grows each time recovery gets funded.',
    };
  }
  if (rmssd >= 15) {
    return {
      key: 'conserving',
      label: 'Conserving Resources',
      color: C.amber,
      description:
        'Your system has decided that resources are better held than spent. This is an intelligent allocation, not a fault — it protects you when demand has been sustained or recovery has been short. Capacity returns as your system reads the environment as safe enough to reinvest.',
    };
  }
  return {
    key: 'high-conservation',
    label: 'High Conservation',
    color: C.red,
    description:
      'Your system is holding its resources close. This is a deeply protective allocation that prioritises immediate readiness over long-range recovery. It reflects the load your system is carrying, not a limitation in you. Capacity is built back by lowering demand and making recovery reliably available.',
  };
}

// Recovery Index: a 0-100 presentation of RMSSD, anchored to the capacity thresholds
// so the index and the level can never tell the participant two different stories.
function recoveryIndex(rmssd: number): number {
  const anchors: [number, number][] = [
    [0, 0],
    [15, 35],
    [30, 60],
    [50, 80],
    [100, 100],
  ];
  if (rmssd <= 0) return 0;
  if (rmssd >= 100) return 100;
  for (let i = 1; i < anchors.length; i++) {
    const [x1, y1] = anchors[i - 1];
    const [x2, y2] = anchors[i];
    if (rmssd <= x2) return Math.round(y1 + ((rmssd - x1) / (x2 - x1)) * (y2 - y1));
  }
  return 100;
}

// Resonance frequency = the paced rate at which the system produced the largest,
// most rhythmic cardiac oscillation. Amplitude (SDNN) leads; beat-to-beat change
// (RMSSD) and rhythm alignment (coherence) confirm it.
function pickResonance(segments: RFSegment[]): { rate: number; scores: number[] } {
  const valid = segments.filter((s) => s.metrics);
  if (!valid.length) return { rate: 5.5, scores: segments.map(() => 0) };

  const maxOf = (pick: (m: HRVMetrics) => number) =>
    Math.max(...valid.map((s) => pick(s.metrics as HRVMetrics)), 0.0001);

  const maxSdnn = maxOf((m) => m.sdnn);
  const maxRmssd = maxOf((m) => m.rmssd);
  const maxCoh = maxOf((m) => m.coherence);

  const scores = segments.map((s) =>
    s.metrics
      ? 0.4 * (s.metrics.sdnn / maxSdnn) +
        0.3 * (s.metrics.rmssd / maxRmssd) +
        0.3 * (s.metrics.coherence / maxCoh)
      : 0
  );

  let best = 0;
  scores.forEach((v, i) => {
    if (v > scores[best]) best = i;
  });
  return { rate: segments[best].rate, scores };
}

function formatTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ===== SMALL PIECES =====

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PulseDot({ hr }: { hr: number }) {
  const duration = hr > 30 ? 60 / hr : 1;
  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: 10,
        height: 10,
        background: C.blue,
        animation: `pulse-dot ${duration}s ease-in-out infinite`,
      }}
      aria-hidden
    />
  );
}

function RRTrace({ data }: { data: number[] }) {
  if (data.length < 4) return <div style={{ height: 44 }} />;
  const w = 280;
  const h = 44;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(max - min, 1);
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 6) - 3}`)
    .join(' ');
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="w-full max-w-xs mx-auto"
      style={{ opacity: 0.28 }}
      aria-hidden
    >
      <polyline points={pts} fill="none" stroke={C.blue} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function BreathPacer({ rate }: { rate: number }) {
  const [frac, setFrac] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const period = (60 / rate) * 1000;
    let raf = 0;
    const loop = (t: number) => {
      setFrac(((t - start) % period) / period);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [rate]);

  // Sinusoidal breath: 0 at the bottom of the exhale, 1 at the top of the inhale.
  const amp = (1 - Math.cos(2 * Math.PI * frac)) / 2;
  const scale = 0.4 + amp * 0.6;
  const inhaling = frac < 0.5;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 260, height: 260 }}>
      <div
        className="absolute rounded-full"
        style={{ width: 258, height: 258, border: `1px solid ${C.mist}` }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 240,
          height: 240,
          transform: `scale(${scale})`,
          background: `radial-gradient(circle, ${C.blue}22 0%, ${C.blue}0d 70%, transparent 100%)`,
          border: `2px solid ${C.blue}`,
          opacity: 0.35 + amp * 0.5,
          willChange: 'transform',
        }}
      />
      <div
        className="relative text-sm tracking-[0.28em] uppercase font-medium"
        style={{ color: C.indigo, opacity: 0.85 }}
      >
        {inhaling ? 'Inhale' : 'Exhale'}
      </div>
    </div>
  );
}

// Shown while Chrome's native device picker is being summoned, so the participant
// sees branded UI -> a brief system dialog -> branded UI, rather than the system
// dialog arriving out of nowhere over the welcome screen.
function BleSearchOverlay({ stage }: { stage: ConnectStage }) {
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center px-6"
      style={{ background: C.pale, animation: 'fade-in 0.3s ease-out' }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5 mb-16">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        <span
          className="text-xs font-semibold uppercase"
          style={{ color: C.indigo, letterSpacing: '0.18em' }}
        >
          Neuro Progeny
        </span>
      </div>

      <div className="relative flex items-center justify-center mb-10" style={{ width: 140, height: 140 }}>
        <span
          className="absolute rounded-full"
          style={{ width: 140, height: 140, border: `1px solid ${C.blue}`, animation: 'ble-ring 2s ease-out infinite' }}
        />
        <span
          className="absolute rounded-full"
          style={{ width: 140, height: 140, border: `1px solid ${C.blue}`, animation: 'ble-ring 2s ease-out 1s infinite' }}
        />
        <span
          className="relative flex items-center justify-center rounded-full"
          style={{
            width: 76,
            height: 76,
            background: '#fff',
            border: `1px solid ${C.mist}`,
            animation: 'ble-pulse 2s ease-in-out infinite',
          }}
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke={C.blue}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" />
          </svg>
        </span>
      </div>

      <h2 className="text-xl font-semibold mb-2 text-center" style={{ color: C.indigo }}>
        {stage === 'reconnecting'
          ? 'Reconnecting to your HW9 armband…'
          : 'Searching for your HW9 armband…'}
      </h2>
      <p className="text-sm text-center max-w-xs leading-relaxed" style={{ opacity: 0.6 }}>
        {stage === 'reconnecting'
          ? 'No dialog needed — this is the armband you paired before.'
          : 'A system dialog will appear — select your HW9 device to continue.'}
      </p>
    </div>
  );
}

function BatteryPill({ level }: { level: number }) {
  const low = level < 20;
  const color = low ? C.amber : C.charcoal;
  return (
    <span
      className="flex items-center gap-1.5 text-xs tabular-nums"
      style={{ color, opacity: low ? 1 : 0.6 }}
      title={`Armband battery ${level}%`}
    >
      <svg width="22" height="12" viewBox="0 0 26 14" fill="none" aria-hidden>
        <rect x="0.75" y="0.75" width="21.5" height="12.5" rx="2.75" stroke={color} strokeWidth="1.5" />
        <rect x="3" y="3" width={Math.max(1.5, (level / 100) * 17)} height="8" rx="1" fill={color} />
        <rect x="23.5" y="4.5" width="2" height="5" rx="1" fill={color} />
      </svg>
      {level}%
    </span>
  );
}

// Sits on top of whatever phase is running — the participant never navigates away,
// so a recording can pick up exactly where it froze.
function DisconnectOverlay({
  paused,
  resumed,
  reconnecting,
  error,
  onReconnect,
  onSimulate,
}: {
  paused: boolean;
  resumed: boolean;
  reconnecting: boolean;
  error: string | null;
  onReconnect: () => void;
  onSimulate: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
      style={{ background: 'rgba(240,244,248,0.97)', animation: 'fade-in 0.3s ease-out' }}
      role="alertdialog"
      aria-modal="true"
    >
      <div className="relative flex items-center justify-center mb-10" style={{ width: 140, height: 140 }}>
        <span
          className="absolute rounded-full"
          style={{ width: 140, height: 140, border: `1px solid ${C.red}`, animation: 'ble-ring 2s ease-out infinite' }}
        />
        <span
          className="absolute rounded-full"
          style={{ width: 140, height: 140, border: `1px solid ${C.red}`, animation: 'ble-ring 2s ease-out 1s infinite' }}
        />
        <span
          className="relative flex items-center justify-center rounded-full"
          style={{
            width: 76,
            height: 76,
            background: '#fff',
            border: `1px solid ${C.red}44`,
            animation: 'ble-pulse 2s ease-in-out infinite',
          }}
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke={C.red}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" />
          </svg>
        </span>
      </div>

      <h2 className="text-xl font-semibold mb-2 text-center" style={{ color: C.indigo }}>
        {resumed ? 'Reconnect Your Armband' : 'Armband Disconnected'}
      </h2>
      <p className="text-sm text-center max-w-sm leading-relaxed mb-8" style={{ opacity: 0.65 }}>
        {paused
          ? 'Your recording is paused. Reconnect your Coospo HW9 to resume from where you left off.'
          : 'Reconnect your Coospo HW9 to carry on with the assessment.'}
      </p>

      {error ? (
        <p className="text-xs text-center max-w-xs mb-4" style={{ color: C.red }}>
          {error}
        </p>
      ) : null}

      <div className="w-full max-w-xs">
        <button
          onClick={onReconnect}
          disabled={reconnecting}
          className="w-full rounded-xl px-6 py-4 text-white text-sm font-semibold tracking-wide disabled:opacity-40"
          style={{ background: C.blue }}
        >
          {reconnecting ? 'Reconnecting…' : 'Reconnect'}
        </button>
        <button
          onClick={onSimulate}
          disabled={reconnecting}
          className="w-full mt-3 text-xs font-medium underline underline-offset-4 disabled:opacity-40"
          style={{ color: C.charcoal, opacity: 0.55 }}
        >
          Use simulation instead
        </button>
      </div>
    </div>
  );
}

function ResumeOverlay({
  savedAt,
  onResume,
  onStartOver,
}: {
  savedAt: number;
  onResume: () => void;
  onStartOver: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
      style={{ background: 'rgba(240,244,248,0.97)', animation: 'fade-in 0.3s ease-out' }}
      role="alertdialog"
      aria-modal="true"
    >
      <div className="flex items-center gap-2.5 mb-12">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        <span
          className="text-xs font-semibold uppercase"
          style={{ color: C.indigo, letterSpacing: '0.18em' }}
        >
          Neuro Progeny
        </span>
      </div>

      <h2 className="text-xl font-semibold mb-3 text-center" style={{ color: C.indigo }}>
        You have an assessment in progress
      </h2>
      <p className="text-sm text-center max-w-sm leading-relaxed mb-8" style={{ opacity: 0.68 }}>
        We saved your place at {formatSavedAt(savedAt)}. Would you like to resume where you left
        off? Everything recorded so far is still here.
      </p>

      <div className="w-full max-w-xs">
        <button
          onClick={onResume}
          className="w-full rounded-xl px-6 py-4 text-white text-sm font-semibold tracking-wide"
          style={{ background: C.blue }}
        >
          Resume
        </button>
        <button
          onClick={onStartOver}
          className="w-full mt-3 text-xs font-medium underline underline-offset-4"
          style={{ color: C.charcoal, opacity: 0.55 }}
        >
          Start over
        </button>
      </div>
    </div>
  );
}

function Toast({ text }: { text: string }) {
  return (
    <div
      className="fixed left-1/2 z-50 rounded-full px-5 py-2.5 text-xs font-medium text-white shadow-lg"
      style={{
        bottom: 32,
        transform: 'translateX(-50%)',
        background: C.indigo,
        animation: 'fade-in 0.3s ease-out',
      }}
      role="status"
      aria-live="polite"
    >
      {text}
    </div>
  );
}


// What each headline number actually means, in the participant's language.
const METRIC_TIPS: Record<string, string> = {
  recovery:
    'Your Recovery Index is derived from RMSSD, which measures the variation in timing between consecutive heartbeats. Higher variation means your nervous system can shift fluidly between activation and rest. This is the single strongest short-term indicator of how much capacity your system has available right now.',
  heartRate:
    'Your resting heart rate reflects how hard your cardiovascular system is working just to keep you at baseline. A lower resting heart rate generally means your system is running more efficiently, requiring less effort to maintain normal function. This number is influenced by fitness, hydration, sleep, and current stress load.',
  breathRate:
    'Your natural breathing pace at rest reflects your baseline level of physiological activation. Slower resting breath rates are associated with greater parasympathetic tone, meaning your system is spending less energy on activation and has more available for recovery and adaptation.',
  coherence:
    'Coherence measures how organized your heart rhythm is around a single dominant pattern. When coherence is high, your heart, lungs, and autonomic nervous system are working in sync. This is not about being calm — it is about being synchronized, which can happen during focused effort as well as during rest.',
  complexity:
    'Complexity is measured using Sample Entropy, which quantifies how many different response patterns your nervous system has available. Moderate complexity is the signature of a healthy, adaptive system — not rigid and repetitive, but not random either. It means your system has options and can flexibly shift between them as demands change.',
  resonance:
    'Your resonance frequency is the breathing pace where your heart rate variability reaches its peak amplitude. At this rate, each breath cycle maximally amplifies the natural oscillation in your heart rhythm. Breathing at this pace during training sessions produces the strongest cardiovascular training signal. Most adults resonate between 4.5 and 7.0 breaths per minute.',
};

// Panel is fixed-positioned and measured against the viewport rather than the card,
// so it can never run off the edge of a narrow screen.
interface TipAnchor {
  left: number;
  top?: number;
  bottom?: number;
  width: number;
}

function InfoTip({
  tipId,
  label,
  openTip,
  onToggleTip,
}: {
  tipId: string;
  label: string;
  openTip: string | null;
  onToggleTip: (id: string | null) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<TipAnchor | null>(null);
  const open = openTip === tipId;

  useEffect(() => {
    if (!open) {
      setAnchor(null);
      return;
    }
    const el = btnRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const width = Math.min(280, vw - 24);
    // Right-align to the icon, then clamp both edges into the viewport.
    const left = Math.max(12, Math.min(r.right - width, vw - width - 12));

    // Flip above the icon when there is not enough room beneath it.
    const ESTIMATED_HEIGHT = 240;
    if (r.bottom + 8 + ESTIMATED_HEIGHT > vh && r.top > vh - r.bottom) {
      setAnchor({ left, bottom: vh - r.top + 8, width });
    } else {
      setAnchor({ left, top: r.bottom + 8, width });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      onToggleTip(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onToggleTip(null);
    };
    // The panel is anchored to a measured position, so it follows nothing once
    // the page moves underneath it.
    const dismiss = () => onToggleTip(null);

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [open, onToggleTip]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => onToggleTip(tipId)}
        // 16px glyph, but a comfortable tap target around it.
        className="absolute top-2.5 right-2.5 p-1.5 -m-1.5 leading-none"
        aria-label={`What ${label} means`}
        aria-expanded={open}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="7" stroke={C.blue} strokeWidth="1.25" fill="none" />
          <circle cx="8" cy="4.6" r="0.9" fill={C.blue} />
          <path d="M8 7.1v4.6" stroke={C.blue} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && anchor ? (
        <div
          ref={panelRef}
          role="tooltip"
          className="fixed z-50 rounded-xl bg-white p-4"
          style={{
            left: anchor.left,
            top: anchor.top,
            bottom: anchor.bottom,
            width: anchor.width,
            border: `1px solid ${C.mist}`,
            boxShadow: '0 8px 24px rgba(57,57,57,0.12)',
            animation: 'fade-in 0.16s ease-out',
          }}
        >
          <div
            className="text-[11px] uppercase tracking-[0.14em] font-medium mb-1.5"
            style={{ color: C.blue }}
          >
            {label}
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: C.charcoal, opacity: 0.78 }}>
            {METRIC_TIPS[tipId]}
          </p>
        </div>
      ) : null}
    </>
  );
}

function MetricCard({
  label,
  value,
  unit,
  note,
  accent,
  tipId,
  openTip,
  onToggleTip,
}: {
  label: string;
  value: string;
  unit?: string;
  note: string;
  accent?: string;
  tipId: string;
  openTip: string | null;
  onToggleTip: (id: string | null) => void;
}) {
  return (
    <div className="relative rounded-xl bg-white p-5 border" style={{ borderColor: C.mist }}>
      <InfoTip tipId={tipId} label={label} openTip={openTip} onToggleTip={onToggleTip} />
      <div
        className="text-[11px] uppercase tracking-[0.14em] font-medium pr-6"
        style={{ color: C.blue }}
      >
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-semibold" style={{ color: accent || C.indigo }}>
          {value}
        </span>
        {unit ? (
          <span className="text-xs font-medium" style={{ color: C.charcoal, opacity: 0.5 }}>
            {unit}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs leading-relaxed" style={{ color: C.charcoal, opacity: 0.62 }}>
        {note}
      </p>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl px-6 py-4 text-white text-sm font-semibold tracking-wide transition-opacity disabled:opacity-40"
      style={{ background: C.blue }}
    >
      {children}
    </button>
  );
}

// Shown to anyone who reaches the app outside the University. It is the entire
// page: no assessment state is created and nothing else renders behind it.
function GateScreen() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: C.pale, color: C.charcoal }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/neuroprogeny-logo.png"
        alt="Neuro Progeny"
        // The supplied PNG has a white background rather than transparency;
        // multiply drops it out against the pale ground. A transparent export
        // would let this style go.
        style={{ width: 200, height: 62, objectFit: 'cover', mixBlendMode: 'multiply' }}
      />

      <h1 className="text-2xl font-semibold mt-7 mb-3 text-center" style={{ color: C.indigo }}>
        Capacity Assessment
      </h1>
      <p
        className="text-sm text-center max-w-sm leading-relaxed mb-9"
        style={{ color: C.charcoal, opacity: 0.7 }}
      >
        This assessment is available through Neuro Progeny University. If you have purchased this
        assessment, log in to your University account and open it from your program.
      </p>

      <a
        href={PLATFORM_URL}
        className="rounded-xl px-7 py-4 text-white text-sm font-semibold tracking-wide"
        style={{ background: C.blue }}
      >
        Go to Neuro Progeny University
      </a>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="w-full max-w-md mx-auto rounded-2xl bg-white p-8 border"
      style={{ borderColor: C.mist, animation: 'fade-in 0.5s ease-out' }}
    >
      {children}
    </div>
  );
}

const CHECKLIST: [string, string][] = [
  ['No caffeine in the last 2 hours', 'Caffeine lifts heart rate and flattens variability'],
  ['No food in the last 2 hours', 'Digestion draws on the same resources we are measuring'],
  ['No hard exercise in the last 24 hours', 'Recovery from training masks your baseline'],
  ['Seated upright, feet flat, back supported', 'Posture shifts the signal more than anything else'],
];

// ===== MAIN =====

export default function AssessmentPage() {
  const [phase, setPhase] = useState<Phase>('connect');
  const [name, setName] = useState('');
  // null while the launch params are still being read, so the assessment never
  // flashes on screen before the gate has had a chance to block it.
  const [embedded, setEmbedded] = useState<boolean | null>(null);
  const [assessmentNumber, setAssessmentNumber] = useState(1);
  const [journeyPhase, setJourneyPhase] = useState<string | null>(null);
  const [fastMode, setFastMode] = useState(false);

  // Device
  const [connState, setConnState] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [connMode, setConnMode] = useState<'ble' | 'sim' | null>(null);
  const [connNotice, setConnNotice] = useState<{ text: string; tone: 'error' | 'muted' } | null>(null);
  const [blePrompt, setBlePrompt] = useState(false);
  const [bleStage, setBleStage] = useState<ConnectStage>('searching');
  const [bleSupported, setBleSupported] = useState(false);
  const [battery, setBattery] = useState<number | null>(null);
  const disconnectRef = useRef<(() => void) | null>(null);
  // Held so a reconnect can go straight back to the same strap, no picker.
  const deviceRef = useRef<HRConnection['device']>(null);
  // Set once a silent connect has failed — either reattaching to the in-session
  // device or to one getDevices() remembered. The next tap then goes straight to
  // the picker rather than burning the activation window on a slow retry.
  const skipSilentConnectRef = useRef(false);

  // Disconnect / resume
  const [showDisconnectOverlay, setShowDisconnectOverlay] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live signal
  const [hr, setHr] = useState(0);
  const [trace, setTrace] = useState<number[]>([]);
  const collectorRef = useRef<number[] | null>(null);
  const restingRRRef = useRef<number[]>([]);
  const rfRRRef = useRef<number[][]>(RF_RATES.map(() => []));

  // Checklist
  const [checks, setChecks] = useState<boolean[]>([false, false, false, false]);

  // Segment clock. pausedRef holds the frozen elapsed time while the strap is away;
  // null means the clock is running.
  const segStartRef = useRef(0);
  const segDoneRef = useRef(false);
  const pausedRef = useRef<number | null>(null);
  // Bumped on restart. Anything resumed after an await must check it still matches,
  // since cancelAudio settles pending clip promises rather than leaving them hanging.
  const runGenerationRef = useRef(0);
  // ⚠ IDENTITY FOR ONE COMPLETED SITTING, so the platform can tell a REDELIVERY of this
  // completion from a genuine SECOND assessment. Minted once in finalize and cleared on abort:
  // finalize running twice for one sitting reuses it (the platform drops the duplicate), while a
  // restarted run mints a new one (the platform accepts it). Before this the platform deduped on a
  // per-mount boolean, so a legitimate retake in the same page was silently discarded -- no submit,
  // no error, no row, and a 20-minute recording lost with nothing to find.
  const completionIdRef = useRef<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Results
  const [restingMetrics, setRestingMetrics] = useState<HRVMetrics | null>(null);
  const [rfSegments, setRfSegments] = useState<RFSegment[]>([]);
  const [rfIndex, setRfIndex] = useState(0);

  // Save
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Abort
  const [confirmAbort, setConfirmAbort] = useState(false);

  // Resume. resumePrompt holds a recovered session awaiting the participant's
  // decision; resumeInfo carries the partial-segment offset into the intro screen.
  const [resumePrompt, setResumePrompt] = useState<SessionState | null>(null);
  const [resumeInfo, setResumeInfo] = useState<{ section: 'resting' | 'rf'; carryMs: number } | null>(
    null
  );
  const [resumedFromSave, setResumedFromSave] = useState(false);

  // Which metric tooltip is open, if any. Held here so opening one closes the rest.
  const [openTip, setOpenTip] = useState<string | null>(null);
  const toggleTip = useCallback((id: string | null) => {
    setOpenTip((prev) => (id === null ? null : prev === id ? null : id));
  }, []);

  const restingMs = fastMode ? 25_000 : RESTING_MS;
  const rfSegmentMs = fastMode ? 15_000 : RF_SEGMENT_MS;

  // ----- launch params -----
  useEffect(() => {
    setBleSupported(isBLESupported());
    const params = new URLSearchParams(window.location.search);

    // Everything downstream hangs off this. The participant is authenticated by
    // the University; the assessment itself never asks who anyone is.
    const isEmbedded = params.get('embedded') === 'true';
    setEmbedded(isEmbedded);
    if (!isEmbedded) return;

    const nameParam = params.get('name');
    const n = Number(params.get('attempt'));

    if (nameParam) setName(nameParam);
    if (Number.isFinite(n) && n > 0) setAssessmentNumber(n);
    setJourneyPhase(params.get('phase'));
    if (params.get('fast') === '1') setFastMode(true);
  }, []);

  // ----- recover an interrupted assessment -----
  // Anything older than SESSION_MAX_AGE_MS is dropped inside loadSession without
  // ever being offered, so the participant is only asked about usable sessions.
  useEffect(() => {
    if (embedded !== true) return;
    let cancelled = false;

    (async () => {
      const saved = await loadSession();
      if (!cancelled && saved) setResumePrompt(saved);
    })();

    return () => {
      cancelled = true;
    };
  }, [embedded]);

  // handleDisconnect fires from a BLE event, so it reads the phase off a ref
  // rather than closing over stale state.
  const phaseRef = useRef<Phase>('connect');
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // ----- teardown -----
  useEffect(
    () => () => {
      cancelAudio();
      disconnectRef.current?.();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  // ----- session autosave -----
  const currentElapsedMs = useCallback(() => {
    if (pausedRef.current !== null) return pausedRef.current;
    if (!segStartRef.current) return 0;
    return Date.now() - segStartRef.current;
  }, []);

  const buildSession = useCallback(
    (): SessionState => ({
      version: 1,
      savedAt: Date.now(),
      phase:
        resumeInfo?.section === 'resting'
          ? 'resting'
          : resumeInfo?.section === 'rf'
            ? 'rf'
            : phase,
      checks,
      name,
      assessmentNumber,
      connMode,
      restingRR: restingRRRef.current,
      restingElapsedMs:
        phase === 'resting'
          ? currentElapsedMs()
          : resumeInfo?.section === 'resting'
            ? resumeInfo.carryMs
            : 0,
      restingMetrics,
      rfIndex,
      rfSegments,
      rfRR: rfRRRef.current,
      rfElapsedMs:
        phase === 'rf'
          ? currentElapsedMs()
          : resumeInfo?.section === 'rf'
            ? resumeInfo.carryMs
            : 0,
    }),
    [
      phase,
      checks,
      name,
      assessmentNumber,
      connMode,
      restingMetrics,
      rfIndex,
      rfSegments,
      resumeInfo,
      currentElapsedMs,
    ]
  );

  // Read through a ref so the save effects below can fire on phase changes alone
  // without re-subscribing every time any piece of state moves.
  const buildSessionRef = useRef(buildSession);
  useEffect(() => {
    buildSessionRef.current = buildSession;
  });

  const persist = useCallback(() => {
    saveSession(buildSessionRef.current());
  }, []);

  // Save on every phase transition (and on each RF rate change).
  useEffect(() => {
    if (!ACTIVE_PHASES.includes(phase)) return;
    persist();
  }, [phase, rfIndex, persist]);

  // ...and every 30s while a recording is actually running.
  useEffect(() => {
    if (phase !== 'resting' && phase !== 'rf') return;
    const id = setInterval(persist, 30_000);
    return () => clearInterval(id);
  }, [phase, rfIndex, persist]);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3400);
  }, []);

  // ----- streaming -----
  const handleData = useCallback((d: HRDataPoint) => {
    if (d.heartRate > 0) setHr(d.heartRate);
    if (d.rrIntervals.length) {
      // Paused mid-recording: hold on to everything already collected, take nothing new.
      if (pausedRef.current !== null) return;
      if (collectorRef.current) collectorRef.current.push(...d.rrIntervals);
      setTrace((prev) => [...prev, ...d.rrIntervals].slice(-80));
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    disconnectRef.current = null;
    setConnState('idle');
    setBattery(null);

    const p = phaseRef.current;
    // Freeze the countdown where it stands so the segment can resume intact.
    if ((p === 'resting' || p === 'rf') && pausedRef.current === null) {
      pausedRef.current = Date.now() - segStartRef.current;
    }
    if (p !== 'connect' && p !== 'complete') {
      setReconnectError(null);
      setShowDisconnectOverlay(true);
      playAudio(AUDIO.disconnected);
    }
  }, []);

  const adoptConnection = useCallback((conn: HRConnection, mode: 'ble' | 'sim') => {
    disconnectRef.current = conn.disconnect;
    deviceRef.current = conn.device;
    skipSilentConnectRef.current = false;
    setBattery(conn.battery);
    setConnMode(mode);
    setConnState('connected');
  }, []);

  // Dismiss the overlay and pick the recording back up exactly where it froze.
  const resumeAfterReconnect = useCallback(() => {
    setShowDisconnectOverlay(false);
    setReconnectError(null);

    const wasPaused = pausedRef.current !== null;
    if (wasPaused) {
      // Shift the segment start forward by the time spent disconnected.
      segStartRef.current = Date.now() - (pausedRef.current as number);
      pausedRef.current = null;
    }

    setResumedFromSave(false);
    bell();
    playAudio(AUDIO.reconnected);
    showToast(wasPaused ? 'Reconnected — recording resumed' : 'Reconnected');
  }, [showToast]);

  const reconnect = useCallback(async () => {
    setReconnecting(true);
    setReconnectError(null);
    try {
      let conn: HRConnection;
      if (deviceRef.current && !skipSilentConnectRef.current) {
        try {
          // Same strap, already paired — straight back in, no picker.
          conn = await reconnectHW9(deviceRef.current, handleData, handleDisconnect, {
            onBattery: setBattery,
          });
        } catch {
          // Out of range too long, or the pairing was dropped. A failed GATT connect
          // can outlast the ~5s user-activation window, so requestDevice() here may
          // be refused; the next tap skips straight to it with a fresh gesture.
          skipSilentConnectRef.current = true;
          conn = await connectHW9(handleData, handleDisconnect, {
            onBattery: setBattery,
            skipKnownDevices: true,
          });
        }
      } else {
        conn = await connectHW9(handleData, handleDisconnect, {
          onBattery: setBattery,
          onStage: (stage) => {
            if (stage === 'searching') skipSilentConnectRef.current = true;
          },
          skipKnownDevices: skipSilentConnectRef.current,
        });
      }
      adoptConnection(conn, 'ble');
      resumeAfterReconnect();
    } catch (e: any) {
      setReconnectError(
        e?.name === 'NotFoundError'
          ? 'No armband selected. Tap Reconnect to try again.'
          : e?.name === 'SecurityError' || e?.name === 'NotAllowedError'
            ? 'Tap Reconnect again to choose your armband.'
            : e?.message || 'Could not reconnect to the armband.'
      );
    } finally {
      setReconnecting(false);
    }
  }, [adoptConnection, handleData, handleDisconnect, resumeAfterReconnect]);

  const reconnectSimulated = useCallback(() => {
    adoptConnection(
      connectSimulated(handleData, handleDisconnect, { onBattery: setBattery }),
      'sim'
    );
    resumeAfterReconnect();
  }, [adoptConnection, handleData, handleDisconnect, resumeAfterReconnect]);

  const connectDevice = useCallback(
    async (mode: 'ble' | 'sim') => {
      setConnNotice(null);
      setShowDisconnectOverlay(false);
      setConnState('connecting');

      if (mode === 'sim') {
        try {
          adoptConnection(
            connectSimulated(handleData, handleDisconnect, { onBattery: setBattery }),
            'sim'
          );
          playAudio(AUDIO.welcome);
        } catch (e: any) {
          setConnState('idle');
          setConnNotice({ text: e?.message || 'Could not start simulation.', tone: 'error' });
        }
        return;
      }

      // Look up the remembered strap before the overlay paints, so its copy is
      // right from the first frame rather than flickering a moment later. This is
      // a local permission lookup, not a radio call — it costs milliseconds.
      const paired = skipSilentConnectRef.current ? null : await findPairedHW9();
      setBleStage(paired ? 'reconnecting' : 'searching');

      // Branded overlay first, so Chrome's picker reads as a brief system
      // confirmation rather than the main interaction.
      setBlePrompt(true);

      // Deliberately 1s: long enough for the branded screen to register, and well
      // inside the ~5s transient user activation window that requestDevice() needs.
      await new Promise((r) => setTimeout(r, 1000));

      try {
        adoptConnection(
          await connectHW9(handleData, handleDisconnect, {
            onBattery: setBattery,
            onStage: (stage) => {
              setBleStage(stage);
              // Falling through to the picker means the silent route just failed;
              // do not spend the next tap on it. Cleared again on a successful
              // connect in adoptConnection.
              if (stage === 'searching') skipSilentConnectRef.current = true;
            },
            skipKnownDevices: skipSilentConnectRef.current,
          }),
          'ble'
        );
        playAudio(AUDIO.welcome);
      } catch (e: any) {
        setConnState('idle');
        setConnNotice(
          // Chrome throws NotFoundError when the participant dismisses the picker.
          e?.name === 'NotFoundError'
            ? { text: 'Connection cancelled. Tap Connect to try again.', tone: 'muted' }
            : // A slow failing auto-reconnect can outlive the gesture that allows
              // requestDevice(). The next tap skips straight to the picker.
              e?.name === 'SecurityError' || e?.name === 'NotAllowedError'
              ? { text: 'Tap Connect again to choose your armband.', tone: 'muted' }
              : { text: e?.message || 'Could not connect to the armband.', tone: 'error' }
        );
      } finally {
        setBlePrompt(false);
      }
    },
    [adoptConnection, handleData, handleDisconnect]
  );

  // ===== PHASE TRANSITIONS =====

  // carryMs > 0 means we are picking a partial segment back up: keep the RR
  // already collected and only record the time that is left.
  const startResting = useCallback(
    (carryMs = 0) => {
      const carry = Math.max(0, Math.min(carryMs, restingMs));
      if (carry === 0) restingRRRef.current = [];
      collectorRef.current = restingRRRef.current;
      segStartRef.current = Date.now() - carry;
      segDoneRef.current = false;
      pausedRef.current = null;
      setElapsed(carry);
      setResumeInfo(null);
      setPhase('resting');
      bell();
      playAudio(AUDIO.restingStart);
    },
    [restingMs]
  );

  const finishResting = useCallback(() => {
    collectorRef.current = null;
    setRestingMetrics(computeAllMetrics(restingRRRef.current));
    setPhase('resting-done');
    doubleBell();
    playAudio(AUDIO.restingComplete);
  }, []);

  const startRFSegment = useCallback(
    (index: number, carryMs = 0) => {
      const carry = Math.max(0, Math.min(carryMs, rfSegmentMs));
      if (carry === 0) rfRRRef.current[index] = [];
      collectorRef.current = rfRRRef.current[index];
      segStartRef.current = Date.now() - carry;
      segDoneRef.current = false;
      pausedRef.current = null;
      setElapsed(carry);
      setRfIndex(index);
      setResumeInfo(null);
      setPhase('rf');
      bell();
      playAudio(AUDIO.rate[index]);
    },
    [rfSegmentMs]
  );

  const startRF = useCallback(() => {
    rfRRRef.current = RF_RATES.map(() => []);
    setRfSegments([]);
    startRFSegment(0);
  }, [startRFSegment]);

  const finishRFSegment = useCallback(() => {
    const index = rfIndex;
    const rr = rfRRRef.current[index];
    setRfSegments((prev) => [
      ...prev,
      { rate: RF_RATES[index], metrics: computeAllMetrics(rr), rrCount: rr.length },
    ]);

    if (index < RF_RATES.length - 1) {
      // Hold the next segment until the handoff cue finishes, so the recording
      // does not start while the participant is still hearing the previous rate.
      const gen = runGenerationRef.current;
      playAudio(AUDIO.rateComplete).then(() => {
        // A restart during the cue must not resurrect the run.
        if (runGenerationRef.current !== gen) return;
        startRFSegment(index + 1);
      });
    } else {
      collectorRef.current = null;
      setPhase('rf-done');
      doubleBell();
    }
  }, [rfIndex, startRFSegment]);

  // ----- segment clock -----
  useEffect(() => {
    if (phase !== 'resting' && phase !== 'rf') return;
    const duration = phase === 'resting' ? restingMs : rfSegmentMs;
    const id = setInterval(() => {
      // Strap is away: hold the countdown exactly where it froze.
      if (pausedRef.current !== null) return;
      const e = Date.now() - segStartRef.current;
      setElapsed(Math.min(e, duration));
      if (e >= duration && !segDoneRef.current) {
        segDoneRef.current = true;
        if (phase === 'resting') finishResting();
        else finishRFSegment();
      }
    }, 200);
    return () => clearInterval(id);
  }, [phase, rfIndex, restingMs, rfSegmentMs, finishResting, finishRFSegment]);

  // ===== ABORT / RESTART =====
  const abort = useCallback(() => {
    cancelAudio();
    runGenerationRef.current += 1;
    // A new sitting is a new completion. Clearing this is what lets the platform accept the next
    // result instead of mistaking it for a redelivery of the last one.
    completionIdRef.current = null;
    clearSession();
    collectorRef.current = null;
    restingRRRef.current = [];
    rfRRRef.current = RF_RATES.map(() => []);
    segDoneRef.current = true;
    pausedRef.current = null;
    skipSilentConnectRef.current = false;
    setConfirmAbort(false);
    setShowDisconnectOverlay(false);
    setReconnectError(null);
    setToast(null);
    setElapsed(0);
    setChecks([false, false, false, false]);
    setRestingMetrics(null);
    setRfSegments([]);
    setRfIndex(0);
    setTrace([]);
    setSaveError(null);
    setResumeInfo(null);
    setResumePrompt(null);
    setResumedFromSave(false);
    setPhase('connect');
  }, []);

  // ===== RESUME =====
  // Never auto-start a timer: a resumed recording lands on the intro screen so the
  // participant can get the armband back on before pressing Start.
  const applyResume = useCallback((saved: SessionState) => {
    setName(saved.name);
    setAssessmentNumber(saved.assessmentNumber);
    setChecks(saved.checks ?? [false, false, false, false]);
    setRestingMetrics(saved.restingMetrics);
    setRfSegments(saved.rfSegments);
    setRfIndex(saved.rfIndex);

    restingRRRef.current = saved.restingRR || [];
    rfRRRef.current = RF_RATES.map((_, i) => saved.rfRR?.[i] ?? []);

    collectorRef.current = null;
    pausedRef.current = null;
    segDoneRef.current = true;
    setElapsed(0);
    setTrace([]);

    if (saved.phase === 'resting') {
      setResumeInfo({ section: 'resting', carryMs: saved.restingElapsedMs });
      setPhase('resting-intro');
    } else if (saved.phase === 'rf') {
      setResumeInfo({ section: 'rf', carryMs: saved.rfElapsedMs });
      setPhase('rf-intro');
    } else {
      setResumeInfo(null);
      setPhase(saved.phase as Phase);
    }

    setResumePrompt(null);
    setResumedFromSave(true);

    // No armband after a page load, so reuse the reconnect overlay to get one back —
    // except at rf-done, which only needs the Save button and would otherwise trap
    // the participant behind a demand they cannot dismiss.
    setShowDisconnectOverlay(saved.phase !== 'rf-done');
  }, []);

  const discardResume = useCallback(() => {
    clearSession();
    setResumePrompt(null);
  }, []);

  // ===== RESULTS =====
  const resonance = useMemo(() => pickResonance(rfSegments), [rfSegments]);
  const level = useMemo(() => capacityLevel(restingMetrics?.rmssd ?? 0), [restingMetrics]);
  const recovery = useMemo(() => recoveryIndex(restingMetrics?.rmssd ?? 0), [restingMetrics]);

  const chartData = useMemo(
    () =>
      rfSegments.map((s, i) => ({
        rate: s.rate,
        sdnn: s.metrics ? Math.round(s.metrics.sdnn) : 0,
        rmssd: s.metrics ? Math.round(s.metrics.rmssd) : 0,
        coherence: s.metrics ? s.metrics.coherence : 0,
        score: Math.round((resonance.scores[i] ?? 0) * 100),
      })),
    [rfSegments, resonance]
  );

  // ===== FINALIZE =====
  const finalize = useCallback(async () => {
    setSaving(true);
    setSaveError(null);

    const m = restingMetrics;

    // Everything the platform needs to write the result and redraw the journey.
    // The assessment stores none of this itself.
    // ⚠ MINTED ONCE PER SITTING. `||=` rather than a fresh value: finalize can run again for the
    // SAME completion (a retry after a transient failure), and that must carry the SAME id so the
    // platform drops it. Only abort clears it, which is what makes a restart a new completion.
    if (!completionIdRef.current) {
      completionIdRef.current =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    const message = {
      type: 'assessment-complete',
      // Read by the platform's listener to distinguish a redelivery from a second assessment.
      // A platform build that predates this field falls back to accepting once per mount, which is
      // the behaviour that shipped before -- so an older parent is no worse off, never worse.
      completionId: completionIdRef.current,
      metrics: {
        recoveryIndex: recovery,
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
        resting_rr: restingRRRef.current.slice(0, MAX_RESTING_RR),
        rf_results: rfSegments.map((seg, i) => ({
          rate: seg.rate,
          amplitude: seg.metrics?.sdnn ?? null,
          coherence: seg.metrics?.coherence ?? null,
          rmssd: seg.metrics?.rmssd ?? null,
          rr_count: seg.rrCount,
          resonance_score: Math.round((resonance.scores[i] ?? 0) * 1000) / 1000,
        })),
        rf_rr_per_rate: rfRRRef.current.map((rr) => rr.slice(0, MAX_RF_RR_PER_RATE)),
        resonance_freq: resonance.rate,
        device_mode: connMode,
        // Time actually recorded, not wall clock — a paused or resumed run must
        // not inflate this.
        recording_duration_ms: restingMs + rfSegments.length * rfSegmentMs,
        // Echoed back so the platform's submit route does not have to correlate
        // the result with the launch it came from.
        attempt: assessmentNumber,
        phase: journeyPhase,
        capacity_level: level.key,
        capacity_label: level.label,
      },
    };

    try {
      // ⚠ DIAGNOSTIC, KEPT. When a completion does not reach the platform, the first question is
      // always "did the app send at all", and until now nothing on either side could answer it.
      // It logs the SHAPE and the identity, never the recording: rawData carries thousands of RR
      // intervals and putting those in a console is a different problem.
      console.log('[capacity-assessment] posting completion to parent', {
        type: message.type,
        completionId: message.completionId,
        metricKeys: Object.keys(message.metrics).length,
        recoveryIndex: message.metrics.recoveryIndex,
        isFramed: window.parent !== window,
      });

      // '*' is deliberate: the assessment does not know the platform's origin, and
      // the parent validates the sender on its end. Who may embed this app at all
      // is constrained by the frame-ancestors CSP in next.config.js.
      window.parent.postMessage(message, '*');
      await new Promise((r) => setTimeout(r, 600));

      // Finished and saved — the draft is no longer needed on any device.
      clearSession();

      // Nothing left to record — release the armband and its wake lock.
      disconnectRef.current?.();
      disconnectRef.current = null;
      deviceRef.current = null;
      setBattery(null);
      setConnState('idle');
      setPhase('complete');
      playAudio(AUDIO.assessmentComplete);
    } catch (e: any) {
      setSaveError(
        e?.message || 'Could not hand your results to the University. Your assessment is still on screen.'
      );
    } finally {
      setSaving(false);
    }
  }, [
    assessmentNumber,
    journeyPhase,
    connMode,
    restingMetrics,
    restingMs,
    rfSegments,
    rfSegmentMs,
    resonance,
    recovery,
    level,
  ]);

  // ===== RENDER =====
  // Nothing renders until the launch params have been read, so the assessment
  // cannot flash on screen ahead of the gate.
  if (embedded === null) return <div className="min-h-screen" style={{ background: C.pale }} />;
  if (!embedded) return <GateScreen />;

  const showAbort = ACTIVE_PHASES.includes(phase);
  const canStart = connState === 'connected';
  const allChecked = checks.every(Boolean);

  return (
    <div className="min-h-screen" style={{ background: C.pale, color: C.charcoal }}>
      {/* ===== HEADER ===== */}
      <header
        className="sticky top-0 z-20 border-b backdrop-blur"
        style={{ borderColor: C.mist, background: 'rgba(240,244,248,0.86)' }}
      >
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/neuroprogeny-logo.png"
              alt="Neuro Progeny"
              style={{ width: 140, height: 44, objectFit: 'cover', mixBlendMode: 'multiply' }}
            />
          </div>

          <div className="flex items-center gap-4">
            {connState === 'connected' && hr > 0 && phase !== 'connect' ? (
              <span className="flex items-center gap-2 text-xs" style={{ opacity: 0.6 }}>
                <PulseDot hr={hr} />
                {hr} bpm
              </span>
            ) : null}
            {connState === 'connected' && battery !== null ? <BatteryPill level={battery} /> : null}
            {showAbort ? (
              <button
                onClick={() => setConfirmAbort(true)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border"
                style={{ borderColor: C.mist, color: C.charcoal, opacity: 0.75 }}
              >
                Start over
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
        {/* ===== 1. CONNECT ===== */}
        {phase === 'connect' ? (
          <Panel>
            <p
              className="text-[11px] uppercase tracking-[0.14em] font-medium mb-2"
              style={{ color: C.blue }}
            >
              Assessment {assessmentNumber}
            </p>
            <h1 className="text-2xl font-semibold mb-2" style={{ color: C.indigo }}>
              {name ? `Welcome, ${name}` : 'Welcome'}
            </h1>
            <p className="text-sm leading-relaxed mb-6" style={{ opacity: 0.72 }}>
              This is a twenty minute measurement of how your nervous system is currently allocating
              its resources. You will rest quietly for five minutes, then breathe along with a circle
              at six different rates. Find somewhere you will not be interrupted.
            </p>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => connectDevice('ble')}
                disabled={!bleSupported || connState === 'connecting'}
                className="w-full rounded-xl px-5 py-4 text-sm font-semibold border-2 disabled:opacity-40 text-left flex items-center justify-between gap-3"
                style={{
                  borderColor: connMode === 'ble' ? C.blue : C.mist,
                  color: C.indigo,
                  background: connMode === 'ble' ? `${C.blue}0f` : '#fff',
                }}
              >
                <span>
                  Connect Coospo HW9
                  <span className="block text-xs font-normal mt-0.5" style={{ opacity: 0.6 }}>
                    {bleSupported
                      ? 'Wear the armband on your forearm, then pair over Bluetooth'
                      : 'Bluetooth is not available in this browser'}
                  </span>
                </span>
                {connMode === 'ble' && connState === 'connected' ? <Check /> : null}
              </button>

              <button
                onClick={() => connectDevice('sim')}
                disabled={connState === 'connecting'}
                className="w-full rounded-xl px-5 py-4 text-sm font-medium border disabled:opacity-40 text-left flex items-center justify-between gap-3"
                style={{
                  borderColor: connMode === 'sim' ? C.blue : C.mist,
                  color: C.charcoal,
                  background: connMode === 'sim' ? `${C.blue}0f` : '#fff',
                }}
              >
                <span>
                  Use simulation
                  <span className="block text-xs font-normal mt-0.5" style={{ opacity: 0.6 }}>
                    Walk through the assessment without an armband
                  </span>
                </span>
                {connMode === 'sim' && connState === 'connected' ? <Check /> : null}
              </button>
            </div>

            {connState === 'connecting' ? (
              <p className="text-xs mb-4" style={{ opacity: 0.6 }}>
                Connecting…
              </p>
            ) : null}

            {connState === 'connected' ? (
              <div
                className="rounded-xl px-4 py-3 mb-6 flex items-center gap-3 text-xs"
                style={{ background: `${C.green}14` }}
              >
                <PulseDot hr={hr || 60} />
                {hr > 0 ? `Signal received — ${hr} bpm` : 'Connected, waiting for the first beats…'}
              </div>
            ) : null}

            {connNotice ? (
              <p
                className="text-xs mb-4"
                style={
                  connNotice.tone === 'error'
                    ? { color: C.red }
                    : { color: C.charcoal, opacity: 0.55 }
                }
              >
                {connNotice.text}
              </p>
            ) : null}

            <PrimaryButton
              onClick={() => {
                setPhase('checklist');
                playAudio(AUDIO.checklist);
              }}
              disabled={!canStart}
            >
              Begin
            </PrimaryButton>
          </Panel>
        ) : null}

        {/* ===== 2. CHECKLIST ===== */}
        {phase === 'checklist' ? (
          <Panel>
            <h2 className="text-xl font-semibold mb-2" style={{ color: C.indigo }}>
              Before we start
            </h2>
            <p className="text-sm leading-relaxed mb-6" style={{ opacity: 0.72 }}>
              These four conditions keep this measurement comparable with the ones that come after it.
            </p>

            <div className="space-y-2 mb-7">
              {CHECKLIST.map(([label, why], i) => (
                <button
                  key={label}
                  onClick={() => setChecks((prev) => prev.map((c, j) => (j === i ? !c : c)))}
                  aria-pressed={checks[i]}
                  className="w-full text-left rounded-xl border px-4 py-3.5 flex items-start gap-3"
                  style={{
                    borderColor: checks[i] ? C.blue : C.mist,
                    background: checks[i] ? `${C.blue}0d` : '#fff',
                  }}
                >
                  <span
                    className="mt-0.5 shrink-0 rounded-md flex items-center justify-center"
                    style={{
                      width: 18,
                      height: 18,
                      border: `1.5px solid ${checks[i] ? C.blue : '#cbd5e0'}`,
                      background: checks[i] ? C.blue : 'transparent',
                    }}
                  >
                    {checks[i] ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : null}
                  </span>
                  <span>
                    <span className="block text-sm font-medium" style={{ color: C.indigo }}>
                      {label}
                    </span>
                    <span className="block text-xs mt-0.5" style={{ opacity: 0.55 }}>
                      {why}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <PrimaryButton onClick={() => setPhase('resting-intro')} disabled={!allChecked}>
              Continue
            </PrimaryButton>
          </Panel>
        ) : null}

        {/* ===== 3. RESTING INTRO ===== */}
        {phase === 'resting-intro' ? (
          <Panel>
            <h2 className="text-xl font-semibold mb-3" style={{ color: C.indigo }}>
              Resting measurement
            </h2>
            <p className="text-sm leading-relaxed mb-4" style={{ opacity: 0.72 }}>
              For the next five minutes you will sit still with your eyes closed and breathe however
              your body wants to breathe. Do not try to relax, slow down or control anything — we are
              reading the pattern your system chooses on its own.
            </p>
            <p className="text-sm leading-relaxed mb-7" style={{ opacity: 0.72 }}>
              A bell sounds when the recording begins and two bells when it is finished. There is
              nothing to watch, so let the screen go.
            </p>
            {resumeInfo?.section === 'resting' ? (
              <p
                className="text-xs leading-relaxed mb-5 rounded-xl px-4 py-3"
                style={{ background: `${C.blue}0d`, color: C.indigo }}
              >
                Picking up where you left off — {formatTime(restingMs - resumeInfo.carryMs)} left to
                record. The {restingRRRef.current.length} heartbeats already captured are kept.
              </p>
            ) : null}
            <PrimaryButton
              onClick={() =>
                startResting(resumeInfo?.section === 'resting' ? resumeInfo.carryMs : 0)
              }
            >
              {resumeInfo?.section === 'resting'
                ? 'Resume resting measurement'
                : 'Start resting measurement'}
            </PrimaryButton>
          </Panel>
        ) : null}

        {/* ===== 4. RESTING ===== */}
        {phase === 'resting' ? (
          <div className="text-center py-8" style={{ animation: 'fade-in 0.6s ease-out' }}>
            <p className="text-xs uppercase tracking-[0.28em] mb-10" style={{ color: C.blue, opacity: 0.7 }}>
              Eyes closed
            </p>

            <div className="text-6xl font-light tabular-nums mb-3" style={{ color: C.indigo }}>
              {formatTime(restingMs - elapsed)}
            </div>

            <div className="flex items-center justify-center gap-2 mb-12 text-xs" style={{ opacity: 0.5 }}>
              <PulseDot hr={hr || 60} />
              {hr > 0 ? `${hr} bpm` : 'listening'}
            </div>

            <RRTrace data={trace} />

            <div
              className="mx-auto mt-12 rounded-full overflow-hidden"
              style={{ width: 220, height: 2, background: C.mist }}
            >
              <div
                style={{
                  width: `${(elapsed / restingMs) * 100}%`,
                  height: '100%',
                  background: C.blue,
                  opacity: 0.45,
                  transition: 'width 0.2s linear',
                }}
              />
            </div>
          </div>
        ) : null}

        {/* ===== 5. RESTING DONE ===== */}
        {phase === 'resting-done' ? (
          <Panel>
            <h2 className="text-xl font-semibold mb-3" style={{ color: C.indigo }}>
              Resting measurement captured
            </h2>
            {restingMetrics ? (
              <>
                <p className="text-sm leading-relaxed mb-6" style={{ opacity: 0.72 }}>
                  Your baseline is recorded. Take a breath before the next section.
                </p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl p-4" style={{ background: C.pale }}>
                    <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: C.blue }}>
                      Heart rate
                    </div>
                    <div className="text-2xl font-semibold mt-1" style={{ color: C.indigo }}>
                      {Math.round(restingMetrics.meanHR)}
                      <span className="text-xs font-normal ml-1" style={{ opacity: 0.5 }}>
                        bpm
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: C.pale }}>
                    <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: C.blue }}>
                      RMSSD
                    </div>
                    <div className="text-2xl font-semibold mt-1" style={{ color: C.indigo }}>
                      {restingMetrics.rmssd.toFixed(1)}
                      <span className="text-xs font-normal ml-1" style={{ opacity: 0.5 }}>
                        ms
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs mb-7" style={{ opacity: 0.5 }}>
                  {restingMetrics.rrCount} heartbeats analysed
                </p>
              </>
            ) : (
              <p className="text-sm leading-relaxed mb-7" style={{ color: C.red }}>
                Not enough clean signal came through to compute your baseline. Check the armband fit
                and start over when you are ready.
              </p>
            )}
            <PrimaryButton
              onClick={() => {
                setPhase('rf-intro');
                playAudio(AUDIO.rfIntro);
              }}
            >
              Continue
            </PrimaryButton>
          </Panel>
        ) : null}

        {/* ===== 6. RF INTRO ===== */}
        {phase === 'rf-intro' ? (
          <Panel>
            <h2 className="text-xl font-semibold mb-3" style={{ color: C.indigo }}>
              Breathing measurement
            </h2>
            <p className="text-sm leading-relaxed mb-4" style={{ opacity: 0.72 }}>
              Every nervous system has one breathing rate where the heart and the breath swing
              together most strongly. Finding yours takes twelve minutes: six rates, two minutes each,
              from slow to slightly faster.
            </p>
            <p className="text-sm leading-relaxed mb-7" style={{ opacity: 0.72 }}>
              Keep your eyes open and follow the circle — inhale as it grows, exhale as it settles.
              Breathe gently through your nose. If a rate feels like effort, breathe more softly
              rather than deeper. A bell and a voice announce each change.
            </p>
            {resumeInfo?.section === 'rf' ? (
              <p
                className="text-xs leading-relaxed mb-5 rounded-xl px-4 py-3"
                style={{ background: `${C.blue}0d`, color: C.indigo }}
              >
                Picking up at {RF_RATES[rfIndex].toFixed(1)} breaths per minute — rate {rfIndex + 1}{' '}
                of {RF_RATES.length}, {formatTime(rfSegmentMs - resumeInfo.carryMs)} left at this
                rate.
                {/* Only worth mentioning once at least one rate is actually banked. */}
                {rfSegments.length > 0
                  ? ` The ${rfSegments.length} rate${rfSegments.length === 1 ? '' : 's'} already finished ${
                      rfSegments.length === 1 ? 'is' : 'are'
                    } kept.`
                  : ''}
              </p>
            ) : null}
            <PrimaryButton
              onClick={() =>
                resumeInfo?.section === 'rf' ? startRFSegment(rfIndex, resumeInfo.carryMs) : startRF()
              }
            >
              {resumeInfo?.section === 'rf'
                ? 'Resume breathing measurement'
                : 'Start breathing measurement'}
            </PrimaryButton>
          </Panel>
        ) : null}

        {/* ===== 7. RF ===== */}
        {phase === 'rf' ? (
          <div className="flex flex-col items-center py-4" style={{ animation: 'fade-in 0.6s ease-out' }}>
            <p className="text-xs uppercase tracking-[0.28em] mb-1" style={{ color: C.blue, opacity: 0.7 }}>
              Rate {rfIndex + 1} of {RF_RATES.length}
            </p>
            <div className="text-3xl font-semibold mb-1" style={{ color: C.indigo }}>
              {RF_RATES[rfIndex].toFixed(1)}
              <span className="text-sm font-normal ml-1.5" style={{ opacity: 0.5 }}>
                breaths / min
              </span>
            </div>
            <div className="text-sm tabular-nums mb-6" style={{ opacity: 0.5 }}>
              {formatTime(rfSegmentMs - elapsed)}
            </div>

            <BreathPacer rate={RF_RATES[rfIndex]} />

            <div className="flex items-center gap-2.5 mt-8">
              {RF_RATES.map((r, i) => (
                <span
                  key={r}
                  title={`${r.toFixed(1)} breaths / min`}
                  className="rounded-full"
                  style={{
                    width: i === rfIndex ? 11 : 9,
                    height: i === rfIndex ? 11 : 9,
                    background: i < rfIndex ? C.blue : i === rfIndex ? '#fff' : C.mist,
                    border: i === rfIndex ? `2px solid ${C.blue}` : 'none',
                    transition: 'all 0.3s',
                  }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 mt-6 text-xs" style={{ opacity: 0.45 }}>
              <PulseDot hr={hr || 60} />
              {hr > 0 ? `${hr} bpm` : 'listening'}
            </div>
          </div>
        ) : null}

        {/* ===== 8. RF DONE ===== */}
        {phase === 'rf-done' ? (
          <div className="w-full max-w-xl mx-auto" style={{ animation: 'fade-in 0.5s ease-out' }}>
            <div className="rounded-2xl bg-white p-7 border" style={{ borderColor: C.mist }}>
              <h2 className="text-xl font-semibold mb-2" style={{ color: C.indigo }}>
                Your resonance frequency
              </h2>
              <p className="text-sm leading-relaxed mb-6" style={{ opacity: 0.72 }}>
                Your heart responded most strongly at{' '}
                <strong style={{ color: C.blue }}>{resonance.rate.toFixed(1)} breaths per minute</strong>
                . That is the pace at which your breath and your heart rhythm reinforce each other.
              </p>

              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                    <CartesianGrid stroke={C.mist} vertical={false} />
                    <XAxis
                      dataKey="rate"
                      tick={{ fontSize: 11, fill: C.charcoal }}
                      stroke={C.mist}
                      tickFormatter={(v) => Number(v).toFixed(1)}
                    />
                    <YAxis tick={{ fontSize: 11, fill: C.charcoal }} stroke={C.mist} width={44} />
                    <Tooltip
                      contentStyle={{ borderRadius: 10, border: `1px solid ${C.mist}`, fontSize: 12 }}
                      labelFormatter={(v) => `${Number(v).toFixed(1)} breaths / min`}
                    />
                    <ReferenceLine x={resonance.rate} stroke={C.green} strokeDasharray="4 4" strokeWidth={2} />
                    <Line
                      type="monotone"
                      dataKey="sdnn"
                      name="Amplitude"
                      stroke={C.blue}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: C.blue }}
                    />
                    <Line
                      type="monotone"
                      dataKey="coherence"
                      name="Coherence"
                      stroke={C.amber}
                      strokeWidth={2}
                      dot={{ r: 3, fill: C.amber }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-center gap-5 mt-2 mb-7 text-[11px]" style={{ opacity: 0.6 }}>
                <span className="flex items-center gap-1.5">
                  <span style={{ width: 14, height: 2, background: C.blue, display: 'inline-block' }} />
                  Amplitude
                </span>
                <span className="flex items-center gap-1.5">
                  <span style={{ width: 14, height: 2, background: C.amber, display: 'inline-block' }} />
                  Coherence
                </span>
                <span className="flex items-center gap-1.5">
                  <span style={{ width: 14, height: 2, background: C.green, display: 'inline-block' }} />
                  Your resonance
                </span>
              </div>

              {saveError ? (
                <p className="text-xs mb-4" style={{ color: C.red }}>
                  {saveError}
                </p>
              ) : null}

              <PrimaryButton onClick={finalize} disabled={saving}>
                {saving ? 'Saving…' : 'Save my assessment'}
              </PrimaryButton>
            </div>
          </div>
        ) : null}

        {/* ===== 9. COMPLETE ===== */}
        {phase === 'complete' ? (
          <div className="w-full max-w-2xl mx-auto" style={{ animation: 'fade-in 0.5s ease-out' }}>
            <div className="flex flex-col items-center text-center mb-8">
              <span
                className="flex items-center justify-center rounded-full mb-5"
                style={{ width: 56, height: 56, background: `${C.green}1f` }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <h2 className="text-2xl font-semibold" style={{ color: C.indigo }}>
                Assessment Complete
              </h2>
              {name.trim() ? (
                <p className="text-sm mt-2" style={{ opacity: 0.6 }}>
                  Well done, {name.trim()}.
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
              <MetricCard
                label="Recovery Index"
                tipId="recovery"
                openTip={openTip}
                onToggleTip={toggleTip}
                value={String(recovery)}
                unit="/ 100"
                accent={level.color}
                note="How much resource your system currently has free for repair and adaptation."
              />
              <MetricCard
                label="Heart Rate"
                tipId="heartRate"
                openTip={openTip}
                onToggleTip={toggleTip}
                value={restingMetrics ? String(Math.round(restingMetrics.meanHR)) : '—'}
                unit="bpm"
                note="Your resting pace — the baseline cost of running your system right now."
              />
              <MetricCard
                label="Breath Rate"
                tipId="breathRate"
                openTip={openTip}
                onToggleTip={toggleTip}
                value={restingMetrics ? restingMetrics.breathRate.toFixed(1) : '—'}
                unit="br/min"
                note="How fast you breathe when nothing is being asked of you."
              />
              <MetricCard
                label="Coherence"
                tipId="coherence"
                openTip={openTip}
                onToggleTip={toggleTip}
                value={restingMetrics ? restingMetrics.coherence.toFixed(0) : '—'}
                unit="%"
                note="How closely your heart rhythm and your breath moved together at rest."
              />
              <MetricCard
                label="Complexity"
                tipId="complexity"
                openTip={openTip}
                onToggleTip={toggleTip}
                value={restingMetrics ? restingMetrics.sampEn.toFixed(2) : '—'}
                note="The adaptive range in your signal — room to respond to whatever comes next."
              />
              <MetricCard
                label="Resonance"
                tipId="resonance"
                openTip={openTip}
                onToggleTip={toggleTip}
                value={resonance.rate.toFixed(1)}
                unit="br/min"
                note="The breath rate your system amplifies most. This is where to practise."
              />
            </div>

            <div className="rounded-2xl p-7 mb-8 border bg-white" style={{ borderColor: `${level.color}55` }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="rounded-full" style={{ width: 12, height: 12, background: level.color }} />
                <h3 className="text-lg font-semibold" style={{ color: level.color }}>
                  {level.label}
                </h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ opacity: 0.78 }}>
                {level.description}
              </p>
            </div>

            {/* A finished assessment is the moment the numbers mean the most and the
                least — the participant has them, but not yet what they are for. */}
            <div className="rounded-2xl p-7 mb-8 text-center" style={{ background: C.indigo, color: '#ffffff' }}>
              <h3 className="text-lg font-semibold mb-3">Review your results with a coach</h3>
              <p className="text-sm leading-relaxed mb-6" style={{ opacity: 0.85 }}>
                A 15-minute coaching call to walk through your findings, understand what your
                system is protecting, and identify your most impactful next step. Use code
                CAPACITY when you book.
              </p>
              <a
                href={COACHING_URL}
                target="_parent"
                className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: '#ffffff', color: C.indigo }}
              >
                Book a review call
              </a>
              <p className="text-xs mt-4" style={{ opacity: 0.75 }}>
                Use code <span className="font-mono font-bold">CAPACITY</span> at checkout — complimentary with your assessment
              </p>
            </div>

            <p className="text-center text-sm" style={{ opacity: 0.62 }}>
              Your results have been saved to your journey.
            </p>
          </div>
        ) : null}
      </main>

      {/* ===== RESUME PROMPT ===== */}
      {resumePrompt ? (
        <ResumeOverlay
          savedAt={resumePrompt.savedAt}
          onResume={() => applyResume(resumePrompt)}
          onStartOver={discardResume}
        />
      ) : null}

      {/* ===== BLE SEARCH OVERLAY ===== */}
      {blePrompt ? <BleSearchOverlay stage={bleStage} /> : null}

      {/* ===== DISCONNECT / RESUME ===== */}
      {showDisconnectOverlay ? (
        <DisconnectOverlay
          paused={pausedRef.current !== null}
          resumed={resumedFromSave}
          reconnecting={reconnecting}
          error={reconnectError}
          onReconnect={reconnect}
          onSimulate={reconnectSimulated}
        />
      ) : null}

      {toast ? <Toast text={toast} /> : null}

      {/* ===== ABORT CONFIRMATION ===== */}
      {confirmAbort ? (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center px-5"
          style={{ background: 'rgba(57,57,57,0.45)' }}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-7">
            <h3 className="text-lg font-semibold mb-2" style={{ color: C.indigo }}>
              Start over?
            </h3>
            <p className="text-sm leading-relaxed mb-6" style={{ opacity: 0.7 }}>
              Everything recorded so far will be discarded and you will return to the beginning. This
              cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAbort(false)}
                className="flex-1 rounded-xl px-5 py-3 text-sm font-medium border"
                style={{ borderColor: C.mist, color: C.charcoal }}
              >
                Keep going
              </button>
              <button
                onClick={abort}
                className="flex-1 rounded-xl px-5 py-3 text-sm font-semibold text-white"
                style={{ background: C.red }}
              >
                Start over
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
