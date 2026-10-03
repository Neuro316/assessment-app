'use client';

// ===== PRACTICE TEST PAGE =====
// A manual test harness for @neuroprogeny/practice. Separate from the assessment:
// it shares no state, components or code with src/app/page.tsx.
//
// ⚠ NO ACCESS GATE, DELIBERATELY. Everything on this page is a stub — a fake
// person, a fake baseline, placeholder exercises, and records that go only to the
// browser console — so there is no real data here to protect, and it is left open
// for manual testing. It MUST get its own access control before it goes live to
// real participants. The assessment already taught us this: an open route stays
// open long after the reason it was open has gone.
//
// Query params, so every path is testable without a redeploy:
//   ?asSuperadmin=true — unlock through the superadmin arm instead of the program arm
//   ?noBaseline=true   — pass a null baseline, to show the "take the assessment" banner

import { useEffect, useState } from 'react';

import {
  PracticeInstrument,
  canUseExercise,
  type PracticeExercise,
  type PracticePerson,
  type PracticeSessionRecord,
} from '@neuroprogeny/practice';

import { PRACTICE_EXERCISES } from '@/lib/practice/exercises';

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPerson({ ...STUB_PERSON, isSuperadmin: params.get('asSuperadmin') === 'true' });
    setBaseline(params.get('noBaseline') === 'true' ? null : STUB_BASELINE);
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
        {baseline ? `, baseline ${baseline.resonanceFreq} br/min` : ', no baseline'}.
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
        exercises={PRACTICE_EXERCISES}
        canUseExercise={(exercise: PracticeExercise) => canUseExercise(person, exercise)}
        onRecordSession={(record: PracticeSessionRecord) => {
          // Stub: nothing is persisted, there is no backend behind this yet.
          console.log('[stub] practice session record', record);
        }}
        onNeedsBaseline={() => {
          console.log('[stub] would route to assessment');
          setNeedsBaseline(true);
        }}
      />
    </div>
  );
}
