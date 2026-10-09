'use client';

// ===== PRACTICE TEST PAGE =====
// A manual test harness for @neuroprogeny/practice. Separate from the assessment:
// it shares no state, components or code with src/app/page.tsx.
//
// ⚠ GATED BY AN ENVIRONMENT FLAG, NOT BY WHO IS ASKING. Everything on this page is
// a stub — a fake person, a fake baseline, placeholder exercises, and records that
// go only to the browser console — so there is no real data here to protect. The
// route (./page.tsx) answers 404 unless PRACTICE_TEST_PAGE=1, or under `next dev`,
// so it is off by default in production (src/lib/practice-test-gate.ts). It still
// has no per-person access control, and must not be switched on where real
// participants could reach it.
//
// Query params, so every path is testable without a redeploy:
//   ?asSuperadmin=true — unlock through the superadmin arm instead of the program arm
//   ?noBaseline=true   — pass a null baseline, to show the "take the assessment" banner
//   ?unbalanced=true   — hold back the activating set (B13, B14, B16) as the host
//                        would when the recent baseline is not balanced
//   ?media=<url>       — add a custom media exercise playing that audio URL, with
//                        bookends, to test the media mode and the event log
//   ?noBio=true        — biometricsEnabled false: no armband offered, pacer only,
//                        as the host passes for Insight without the bundle
//   ?narration=<base>  — resolve narration clips at <base>/<role>/<segment>.mp3,
//                        e.g. ?narration=/narration with the clips copied into
//                        public/narration (gitignored)

import { useEffect, useState } from 'react';

import {
  PracticeInstrument,
  canUseExercise,
  withBookends,
  type PracticeExercise,
  type PracticePerson,
  type PracticeSessionRecord,
  PRACTICE_EXERCISES,
  narrationManifest,
} from '@neuroprogeny/practice';

// Segment id to role, so a narration base URL resolves to <base>/<role>/<id>.mp3.
const ROLE_OF = new Map(narrationManifest().map((m) => [m.id, m.narrator]));

// Stand-in for the host's recommendation from the baseline. The package does not
// decide this.
const STUB_RECOMMENDED = ['B1', 'B4'];

// A custom media exercise, the shape a facilitator's upload will take once the
// platform stores them. Only added when ?media= names a track.
function customMedia(src: string): PracticeExercise {
  return {
    id: 'custom-test-track',
    title: 'Test track',
    category: 'calming',
    minTier: 'insight',
    family: 'visualization',
    kind: 'guided',
    purpose: 'settle',
    axis: 'Vagal magnitude',
    moment: 'Test harness only',
    evidenceTier: 3,
    description: 'A custom upload, with the spec\'s pre-roll and post-roll around it.',
    program: withBookends(
      { phases: [{ mode: 'media', asset: { kind: 'audio', src }, instruction: 'Listen with your eyes closed.' }] },
      { preRollSec: 30, postRollSec: 30 }
    ),
  };
}

// ===== STUB DATA — TEMPORARY, NOT REAL =====
// None of this comes from a database or an authenticated person. It exists only so
// the instrument has something to render.

// One enrollment, so the program arm unlocks everything (the arm is a stub that
// treats any enrollment as covering every tier).
const STUB_PERSON: PracticePerson = {
  isSuperadmin: false,
  enrolledPracticePrograms: ['stub-program'],
};

const STUB_BASELINE = { resonanceFreq: 6.0 };

export default function PracticeTestPage() {
  // null until the query params are read, so the instrument does not render once
  // with the defaults and then again with the overrides.
  const [person, setPerson] = useState<PracticePerson | null>(null);
  const [baseline, setBaseline] = useState<{ resonanceFreq: number | null } | null>(null);
  const [needsBaseline, setNeedsBaseline] = useState(false);
  const [unbalanced, setUnbalanced] = useState(false);
  const [exercises, setExercises] = useState<PracticeExercise[]>(PRACTICE_EXERCISES);
  const [bio, setBio] = useState(true);
  const [narrationBase, setNarrationBase] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPerson({ ...STUB_PERSON, isSuperadmin: params.get('asSuperadmin') === 'true' });
    setBaseline(params.get('noBaseline') === 'true' ? null : STUB_BASELINE);
    setUnbalanced(params.get('unbalanced') === 'true');
    const media = params.get('media');
    if (media) setExercises([...PRACTICE_EXERCISES, customMedia(media)]);
    setBio(params.get('noBio') !== 'true');
    setNarrationBase(params.get('narration'));
  }, []);

  if (!person) return <div style={{ minHeight: '100vh', background: '#F0F4F8' }} />;

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', padding: '40px 16px' }}>
      <p
        style={{
          maxWidth: 640,
          margin: '0 auto 24px',
          fontSize: 12,
          color: '#393939',
          opacity: 0.6,
        }}
      >
        Practice test page — stub data, nothing is saved. Unlocking via{' '}
        {person.isSuperadmin ? 'superadmin' : 'program'} arm
        {baseline ? `, baseline ${baseline.resonanceFreq} br/min` : ', no baseline'}
        {bio ? '' : ', armband off'}
        {narrationBase ? `, narration from ${narrationBase}` : ', no narration'}.
      </p>

      {needsBaseline ? (
        <p
          style={{
            maxWidth: 640,
            margin: '0 auto 24px',
            padding: 12,
            borderRadius: 12,
            background: '#fff',
            fontSize: 14,
            color: '#324C66',
          }}
        >
          [stub] Here the participant would be sent to the assessment. Not wired up.
        </p>
      ) : null}

      <PracticeInstrument
        baseline={baseline}
        exercises={exercises}
        canUseExercise={(exercise: PracticeExercise) => canUseExercise(person, exercise)}
        recommendedIds={STUB_RECOMMENDED}
        heldBackReason={(exercise: PracticeExercise) =>
          unbalanced && exercise.requiresBalancedBaseline ? 'Balanced baseline' : null
        }
        onRecordSession={(record: PracticeSessionRecord) => {
          // Stub: nothing is persisted, there is no backend behind this yet.
          // Logged twice: the live object for a person in DevTools, and JSON
          // text for a reader that only sees console strings.
          console.log('[stub] practice session record', record);
          console.log('[stub] practice session record json ' + JSON.stringify(record));
        }}
        onNeedsBaseline={() => {
          console.log('[stub] would route to assessment');
          setNeedsBaseline(true);
        }}
        // The round brand mark on its own. neuroprogeny-logo.png includes the
        // wordmark, which would spin along with it.
        connectingLogoSrc="/apple-touch-icon.png"
        biometricsEnabled={bio}
        resolveNarration={
          narrationBase
            ? (id) => {
                const role = ROLE_OF.get(id);
                return role ? `${narrationBase}/${role}/${id}.mp3` : null;
              }
            : undefined
        }
      />
    </div>
  );
}
