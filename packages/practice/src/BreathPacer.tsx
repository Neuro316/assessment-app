// ===== BREATH PACER =====
// The circle that grows on the inhale and settles on the exhale. Adapted from the
// assessment app's src/components/BreathPacer.tsx — same look — but it no longer
// keeps its own clock: the pacer engine (pacer.ts / usePacerProgram) works out
// where the breath is, including holds and a stacked second inhale, and this just
// draws it. Fills its container (square, capped at MAX_SIZE), styled inline so it
// renders without the host's Tailwind.
//
// amplitude — 0 = empty lungs (smallest), 1 = full (largest)
// word      — the cue in the middle, e.g. 'Inhale' / 'Hold'
// route     — optional line under it, e.g. 'in through the nose'

const C = {
  blue: '#386797',
  indigo: '#324C66',
  mist: '#E9EDF0',
};

const MAX_SIZE = 360;

export default function BreathPacer({
  amplitude,
  word,
  route,
}: {
  amplitude: number;
  word: string;
  route?: string | null;
}) {
  const amp = Math.min(1, Math.max(0, amplitude));
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
      <div style={{ position: 'relative', textAlign: 'center', padding: '0 12%' }}>
        <div
          style={{
            fontSize: 14,
            lineHeight: '20px',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            fontWeight: 500,
            color: C.indigo,
            opacity: 0.85,
          }}
        >
          {word}
        </div>
        {route ? (
          <div style={{ fontSize: 13, marginTop: 6, color: C.indigo, opacity: 0.6 }}>{route}</div>
        ) : null}
      </div>
    </div>
  );
}
