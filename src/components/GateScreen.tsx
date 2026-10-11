// ===== GATE SCREEN =====
// Shown to anyone who reaches the app outside the University. It is the entire
// page: nothing else renders behind it. Shared by the assessment and Fresh Air,
// each with its own title and line.

import { PLATFORM_URL } from '@/lib/platform-url';

const C = {
  blue: '#386797',
  indigo: '#324C66',
  charcoal: '#393939',
  pale: '#F0F4F8',
};

export default function GateScreen({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: C.pale, color: C.charcoal }}
      data-gate="refused"
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
        {title}
      </h1>
      <p
        className="text-sm text-center max-w-sm leading-relaxed mb-9"
        style={{ color: C.charcoal, opacity: 0.7 }}
      >
        {body}
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
