'use client';

// Main entry point for the capacity assessment app
// In production, this reads launch params (JWT, participant ID, assessment number, phase)
// from URL search params or postMessage (if iframe-embedded)
//
// The full assessment component will be built here with Claude Code
// using the lib modules (bluetooth, hrv-metrics, audio, supabase)

export default function AssessmentPage() {
  return (
    <div className="min-h-screen bg-pale-blue flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 rounded-full bg-neuro-blue/10 flex items-center justify-center mx-auto mb-6">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#386797" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-aurora-indigo mb-3">Capacity Assessment</h1>
        <p className="text-gray-500 text-sm mb-8">
          Scaffold deployed. Assessment component will be built with Claude Code
          using the lib modules in this project.
        </p>
        <div className="text-xs text-gray-400 space-y-1">
          <p>✓ src/lib/bluetooth.ts — Coospo HW9 BLE protocol</p>
          <p>✓ src/lib/hrv-metrics.ts — Full metrics engine (SampEn, DFA, coherence, SI)</p>
          <p>✓ src/lib/audio.ts — TTS voice guidance + bell tones</p>
          <p>✓ src/lib/supabase.ts — Auth + database client</p>
          <p>✓ tailwind.config.js — Neuro Progeny brand tokens</p>
          <p>✓ next.config.js — iframe embedding headers</p>
        </div>
      </div>
    </div>
  );
}
