'use client';

// ===== FRESH AIR =====
// The standalone practice product. The University opens this full page in the same
// embed as the assessment, gated the same way, and receives one practice-complete
// message per finished session. Launch params and the message: src/lib/fresh-air.ts.
//
// It stores nothing. The record goes to the platform on Done and nowhere else.

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  PracticeInstrument,
  canUseExercise,
  narrationManifest,
  PRACTICE_EXERCISES,
  type PracticeExercise,
  type PracticePerson,
  type PracticeSessionRecord,
} from '@neuroprogeny/practice';

import GateScreen from '@/components/GateScreen';
import { launchAgeBand, type AgeBand } from '@/lib/age-band';
import {
  buildPracticeComplete,
  freshAirAccess,
  narrationUrl,
  oncePerRecord,
  parseFreshAirLaunch,
  type FreshAirLaunch,
} from '@/lib/fresh-air';
import { PLATFORM_URL } from '@/lib/platform-url';

const C = {
  indigo: '#324C66',
  charcoal: '#393939',
  pale: '#F0F4F8',
};

const FRESH_AIR_GATE = {
  title: 'Fresh Air',
  body:
    'Fresh Air is available through Neuro Progeny University. Log in to your University account ' +
    'and open it from your program.',
};

// Set at build from NEXT_PUBLIC_APP_SHA or VERCEL_GIT_COMMIT_SHA (next.config.js).
const APP_SHA = process.env.NEXT_PUBLIC_APP_SHA || null;

// Where the narration clips live: <base>/<role>/<segment>.mp3. Unset, narration is silent.
const NARRATION_BASE = process.env.NEXT_PUBLIC_NARRATION_BASE || null;

// Segment id to narrator role, for the clip path.
const ROLE_OF = new Map(narrationManifest().map((m) => [m.id, m.narrator]));

// Everyone the launch token admits may open every exercise. Armband or pacer alone
// is the person's choice per session, inside the instrument.
const PERSON: PracticePerson = { isSuperadmin: false, enrolledPracticePrograms: ['fresh-air'] };

function newCompletionId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function FreshAirPage() {
  const [launch, setLaunch] = useState<FreshAirLaunch | null>(null);
  // Read for when the message carries it; the current shape sends the record only.
  const ageBandRef = useRef<AgeBand | null>(null);
  // null while /api/verify-launch is deciding.
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const l = parseFreshAirLaunch(params);
    setLaunch(l);
    ageBandRef.current = launchAgeBand(params);
    if (!l.embedded || !l.token) return;
    (async () => {
      try {
        const res = await fetch('/api/verify-launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: l.token }),
        });
        if (!res.ok) console.warn('launch token rejected');
        setTokenValid(res.ok);
      } catch {
        console.warn('launch token rejected');
        setTokenValid(false);
      }
    })();
  }, []);

  // One practice-complete per finished session, to the University only. Standalone
  // (no parent frame) there is nobody to hand it to, so nothing is sent.
  const post = useMemo(
    () =>
      oncePerRecord<PracticeSessionRecord>((record) => {
        const message = buildPracticeComplete(record, newCompletionId(), APP_SHA);
        const isFramed = window.parent !== window;
        const targetOrigin = new URL(PLATFORM_URL).origin;
        // Shape and identity only, never the beats.
        console.log('[fresh-air] posting completion to parent', {
          type: message.type,
          completionId: message.completionId,
          exerciseId: record.exerciseId,
          rrCount: record.samplesSummary.rrCount,
          isFramed,
          targetOrigin,
        });
        if (isFramed) window.parent.postMessage(message, targetOrigin);
      }),
    []
  );

  if (!launch) return <div className="min-h-screen" style={{ background: C.pale }} />;
  const access = freshAirAccess(launch, tokenValid);
  if (access === 'refused') return <GateScreen {...FRESH_AIR_GATE} />;
  if (access === 'checking') return <div className="min-h-screen" style={{ background: C.pale }} />;

  return (
    <div className="min-h-screen" style={{ background: C.pale, color: C.charcoal, padding: '32px 16px 48px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto 20px' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: C.indigo }}>
          {launch.name ? `Fresh Air, ${launch.name}` : 'Fresh Air'}
        </h1>
        {NARRATION_BASE ? null : (
          <p data-narration="unavailable" style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.7 }}>
            Narration is unavailable right now. Guided sessions show their words on screen instead.
          </p>
        )}
      </div>

      <PracticeInstrument
        // The pace from the launch link, shown on the intro; without one, nothing. Never
        // null: null shows a "take the assessment" prompt this page has nowhere to send.
        baseline={{ resonanceFreq: launch.pace }}
        exercises={PRACTICE_EXERCISES}
        canUseExercise={(exercise: PracticeExercise) => canUseExercise(PERSON, exercise)}
        onRecordSession={(record: PracticeSessionRecord) => {
          post(record);
        }}
        onNeedsBaseline={() => {}}
        connectingLogoSrc="/apple-touch-icon.png"
        simulateStrap={launch.simulateStrap}
        resolveNarration={
          NARRATION_BASE ? (id) => narrationUrl(NARRATION_BASE, ROLE_OF.get(id), id) : undefined
        }
      />
    </div>
  );
}
