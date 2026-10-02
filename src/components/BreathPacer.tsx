'use client';

// ===== BREATH PACER =====
// A circle that grows on the inhale and settles on the exhale. Used by the
// resonance frequency test and, later, by practice sessions.
//
// rate        — breaths per minute
// inhaleRatio — share of each breath cycle spent inhaling (0-1). 0.5 is the
//               even split the RF test has always used.

import { useEffect, useState } from 'react';

const C = {
  blue: '#386797',
  indigo: '#324C66',
  mist: '#E9EDF0',
};

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
