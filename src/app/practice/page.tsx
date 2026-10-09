// ===== /practice =====
// The gate in front of the practice test harness (PracticeTestPage). Server-side, so
// a disabled page is a plain 404 and none of the harness reaches the browser.
// See src/lib/practice-test-gate.ts for when it is on.

import { notFound } from 'next/navigation';

import { isPracticeTestPageEnabled } from '@/lib/practice-test-gate';

import PracticeTestPage from './PracticeTestPage';

// Read the flag per request, not once at build time.
export const dynamic = 'force-dynamic';

export default function PracticePage() {
  if (!isPracticeTestPageEnabled(process.env)) notFound();
  return <PracticeTestPage />;
}
