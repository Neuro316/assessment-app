// ===== BREATH PACER =====
// Adapted from the assessment app's src/components/BreathPacer.tsx: same props and
// same easing, but it fills its container (square, capped at MAX_SIZE) and is
// styled inline, so it renders correctly without the host's Tailwind.
//
// rate        — breaths per minute
// inhaleRatio — share of each breath cycle spent inhaling (0-1), default 0.5

import { useEffect, useState } from 'react';

const C = {
  blue: '#386797',
  indigo: '#324C66',
  mist: '#E9EDF0',
};

const MAX_SIZE = 360;

// Keeps both halves of the breath long enough to be visible, and avoids a
// divide by zero at the extremes.
const MIN_RATIO = 0.05;
const MAX_RATIO = 0.95;

export default function BreathPacer({
  rate,
  inhaleRatio = 0.5,
}: {
  rate: number;
  inhaleRatio?: number;
}) {
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

  const ratio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, inhaleRatio));
  const inhaling = frac < ratio;

  // Sinusoidal breath: 0 at the bottom of the exhale, 1 at the top of the inhale.
  // Each half is its own half-cosine, so an uneven split still eases in and out
  // of both turns. At ratio 0.5 this is exactly (1 - cos(2π·frac)) / 2.
  const amp = inhaling
    ? (1 - Math.cos((Math.PI * frac) / ratio)) / 2
    : (1 + Math.cos((Math.PI * (frac - ratio)) / (1 - ratio))) / 2;
  const scale = 0.4 + amp * 0.6;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: MAX_SIZE,
        aspectRatio: '1 / 1',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Outer guide ring. The original was 258 of 260px. */}
      <div
        style={{
          position: 'absolute',
          inset: '0.4%',
          borderRadius: '50%',
          border: `1px solid ${C.mist}`,
        }}
      />
      {/* Breathing circle. The original was 240 of 260px. */}
      <div
        style={{
          position: 'absolute',
          inset: '3.85%',
          borderRadius: '50%',
          transform: `scale(${scale})`,
          background: `radial-gradient(circle, ${C.blue}22 0%, ${C.blue}0d 70%, transparent 100%)`,
          border: `2px solid ${C.blue}`,
          opacity: 0.35 + amp * 0.5,
          willChange: 'transform',
        }}
      />
      <div
        style={{
          position: 'relative',
          fontSize: 14,
          lineHeight: '20px',
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          fontWeight: 500,
          color: C.indigo,
          opacity: 0.85,
        }}
      >
        {inhaling ? 'Inhale' : 'Exhale'}
      </div>
    </div>
  );
}
