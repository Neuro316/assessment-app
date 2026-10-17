'use client';

// ===== FRESH AIR =====
// The standalone practice product. The University opens this full page in the same
// embed as the assessment, gated the same way, and receives one practice-complete
// message per finished session. Launch params and the message: src/lib/fresh-air.ts.
//
// It stores nothing. The record goes to the platform on Done and nowhere else.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  PracticeInstrument,
  canUseExercise,
  narrationManifest,
  PRACTICE_EXERCISES,
  type PracticeExercise,
  type PracticePerson,
  type PracticeSessionRecord,
} from '@neuroprogeny/practice';

import FreshAirShell, { EndSessionDialog, ShellCard, U, panelId, tabId } from '@/components/FreshAirShell';
import GateScreen from '@/components/GateScreen';
import { launchAgeBand, type AgeBand } from '@/lib/age-band';
import {
  assessmentTabEnabled,
  buildPracticeComplete,
  freshAirAccess,
  freshAirTab,
  narrationUrl,
  oncePerRecord,
  pacePillText,
  parseFreshAirLaunch,
  searchWithTab,
  tabPress,
  welcomeLine,
  type FreshAirLaunch,
  type FreshAirTab,
} from '@/lib/fresh-air';
import { PLATFORM_URL } from '@/lib/platform-url';

const C = {
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

// The Assessment and Practice tabs. Off (anything but "1"), the page is the practice
// screen as it has always been, under the header and with no tab bar.
const ASSESSMENT_TAB = assessmentTabEnabled(process.env.NEXT_PUBLIC_FRESH_AIR_ASSESSMENT_TAB);

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
  // From the launch link; sent as the message's ageBand, and left off when absent.
  const ageBandRef = useRef<AgeBand | null>(null);
  // null while /api/verify-launch is deciding.
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tab, setTab] = useState<FreshAirTab>('assessment');
  // Told by the instrument. While a session runs, leaving Practice asks first.
  const [sessionRunning, setSessionRunning] = useState(false);
  // Bumped to have the instrument end the running session (End and switch).
  const [endSignal, setEndSignal] = useState(0);
  const [confirmingSwitch, setConfirmingSwitch] = useState<FreshAirTab | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const l = parseFreshAirLaunch(params);
    setLaunch(l);
    setTab(freshAirTab(params));
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
        const message = buildPracticeComplete(record, newCompletionId(), APP_SHA, ageBandRef.current);
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

  // The open tab lives in the URL next to the launch params, which all stay.
  const switchTab = useCallback((next: FreshAirTab) => {
    setTab(next);
    window.history.replaceState(window.history.state, '', searchWithTab(window.location.search, next));
  }, []);

  const selectTab = (next: FreshAirTab) => {
    const press = tabPress(tab, next, sessionRunning);
    if (press === 'switch') switchTab(next);
    if (press === 'confirm') setConfirmingSwitch(next);
  };

  // The instrument ends the session as End early does and posts the record once,
  // through onRecordSession, before the tab changes.
  const endAndSwitch = () => {
    if (!confirmingSwitch) return;
    setEndSignal((n) => n + 1);
    switchTab(confirmingSwitch);
    setConfirmingSwitch(null);
  };

  if (!launch) return <div className="min-h-screen" style={{ background: C.pale }} />;
  const access = freshAirAccess(launch, tokenValid);
  if (access === 'refused') return <GateScreen {...FRESH_AIR_GATE} />;
  if (access === 'checking') return <div className="min-h-screen" style={{ background: C.pale }} />;

  const pill = pacePillText(launch.pace, launch.paceSource);
  const welcome = welcomeLine(launch.name);
  const greeting = welcome ? (
    <p data-greeting style={{ margin: 0, fontSize: 14, color: U.muted }}>
      {welcome}
    </p>
  ) : null;

  const narrationNote = NARRATION_BASE ? null : (
    <p data-narration="unavailable" style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.7 }}>
      Narration is unavailable right now. Guided sessions show their words on screen instead.
    </p>
  );

  const instrument = (
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
      onActiveChange={setSessionRunning}
      endSignal={endSignal}
    />
  );

  if (!ASSESSMENT_TAB) {
    return (
      <FreshAirShell pill={pill} background={C.pale}>
        <div style={{ color: C.charcoal, padding: '32px 16px 48px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto 20px' }}>
            {greeting}
            {narrationNote}
          </div>
          {instrument}
        </div>
      </FreshAirShell>
    );
  }

  return (
    <FreshAirShell pill={pill} tabs={{ active: tab, onSelect: selectTab }}>
      <main className="px-4 sm:px-6" style={{ maxWidth: 1200, margin: '0 auto', paddingTop: 24, paddingBottom: 48, fontFamily: U.font }}>
        {greeting ? <div style={{ marginBottom: 16 }}>{greeting}</div> : null}
        {/* The instrument stays mounted behind the Assessment tab: unmounting it would
            drop a session in progress and flush a finished one before Done. */}
        <div role="tabpanel" id={panelId('practice')} aria-labelledby={tabId('practice')} hidden={tab !== 'practice'}>
          {narrationNote ? <div style={{ marginBottom: 16 }}>{narrationNote}</div> : null}
          {instrument}
        </div>
        {tab === 'assessment' ? (
          <div role="tabpanel" id={panelId('assessment')} aria-labelledby={tabId('assessment')}>
            <AssessmentPlaceholder />
          </div>
        ) : null}
      </main>
      {confirmingSwitch ? (
        <EndSessionDialog onKeep={() => setConfirmingSwitch(null)} onEnd={endAndSwitch} />
      ) : null}
    </FreshAirShell>
  );
}

// Stage 1 only: the sitting itself arrives in a later update.
function AssessmentPlaceholder() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <ShellCard>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: U.dark }}>Take your Capacity Assessment</h2>
        <p style={{ margin: '8px 0 20px', fontSize: 15, lineHeight: 1.5, color: U.muted }}>
          About 15 minutes, seated, with your armband on. It finds your breathing pace and sets the baseline every
          practice session is compared with.
        </p>
        <button
          type="button"
          disabled
          style={{
            minHeight: 44,
            padding: '0 20px',
            borderRadius: 8,
            border: 'none',
            background: U.blue,
            color: '#ffffff',
            fontSize: 15,
            fontWeight: 600,
            fontFamily: 'inherit',
            opacity: 0.5,
            cursor: 'not-allowed',
          }}
        >
          Take Capacity Assessment
        </button>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: U.muted }}>Coming in the next update.</p>
      </ShellCard>
    </div>
  );
}
