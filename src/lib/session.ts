// ===== SESSION PERSISTENCE =====
// Keeps an in-progress assessment recoverable across browser crashes, accidental
// tab closes and app shutdowns.
//
// Two layers, deliberately kept separate:
//   Layer 1 (live)  — localStorage. Synchronous, always available, per-device.
//   Layer 2 (TODO)  — Supabase nr_assessment_sessions. Cross-device resume.
//
// Nothing here writes final results; that stays with nr_assessment_results.

import type { HRVMetrics } from './hrv-metrics';

export const SESSION_KEY = 'xreg-session';

// Past two hours the physiological conditions no longer match the ones the
// participant was told to meet (caffeine, food, exercise), so a resumed
// recording would not be comparable with the first half.
export const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000;

const SESSION_VERSION = 1;

export interface SessionRFSegment {
  rate: number;
  metrics: HRVMetrics | null;
  rrCount: number;
}

export interface SessionState {
  version: number;
  savedAt: number;

  // Where they were
  phase: string;
  checks: boolean[];

  // Who they are, as supplied by the platform at launch. The assessment never
  // establishes identity itself.
  name: string;
  assessmentNumber: number;
  connMode: 'ble' | 'sim' | null;

  // Resting block. elapsed, never remaining — so the value does not depend on
  // knowing what time it was when we saved.
  restingRR: number[];
  restingElapsedMs: number;
  restingMetrics: HRVMetrics | null;

  // Resonance frequency block
  rfIndex: number;
  rfSegments: SessionRFSegment[];
  rfRR: number[][];
  rfElapsedMs: number;
}

// ===========================================================================
// LAYER 1 — LOCAL (localStorage)
// ===========================================================================

export function saveLocalSession(state: SessionState): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...state, version: SESSION_VERSION }));
  } catch {
    // Private mode, quota exceeded, or storage disabled. Losing the autosave is
    // never worth interrupting a recording over.
  }
}

// Returns null for missing, unreadable, wrong-version or stale sessions.
// A stale session is cleared as a side effect so it cannot be offered again.
export function loadLocalSession(): SessionState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as SessionState;
    if (!parsed || parsed.version !== SESSION_VERSION || typeof parsed.savedAt !== 'number') {
      clearLocalSession();
      return null;
    }
    if (Date.now() - parsed.savedAt > SESSION_MAX_AGE_MS) {
      clearLocalSession();
      return null;
    }
    return parsed;
  } catch {
    clearLocalSession();
    return null;
  }
}

export function clearLocalSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}
}

// ===========================================================================
// LAYER 2 — SERVER (Supabase nr_assessment_sessions)
// ===========================================================================
// TODO: not built yet — the nr_assessment_sessions migration has not been run.
// Note: the app no longer carries a Supabase client (src/lib/supabase.ts was
// removed once the platform took over every write), so enabling this means
// bringing @supabase/supabase-js back as a dependency.
//
// Shape when it lands:
//   nr_assessment_sessions (
//     participant_id uuid references auth.users,
//     assessment_number int,
//     state jsonb,          -- a SessionState
//     saved_at timestamptz,
//     primary key (participant_id, assessment_number)
//   )
//
// This is draft/in-progress state only. Final results still go to
// nr_assessment_results on finalize, and the draft row is deleted at that point.
//
// Why it is worth having: a participant who starts on a laptop that dies can
// resume on their phone. localStorage alone cannot cross devices.

const REMOTE_DEBOUNCE_MS = 5000;
let remoteTimer: ReturnType<typeof setTimeout> | null = null;

// TODO: upsert `state` into nr_assessment_sessions keyed on
// (participant_id, assessment_number). Debounced by scheduleRemoteSave below so
// a 30s autosave loop plus phase transitions cannot hammer the API.
export async function saveRemoteSession(
  _state: SessionState,
  _accessToken: string
): Promise<void> {
  // const client = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } });
  // await client.from('nr_assessment_sessions').upsert({
  //   // From the authenticated caller — the assessment app carries no identity
  //   // of its own, so the draft cannot supply one.
  //   participant_id: <from JWT>,
  //   assessment_number: state.assessmentNumber,
  //   state,
  //   saved_at: new Date(state.savedAt).toISOString(),
  // }, { onConflict: 'participant_id,assessment_number' });
}

// TODO: select the most recent in-progress row for this participant and return
// its `state` column, applying the same SESSION_MAX_AGE_MS staleness rule.
export async function loadRemoteSession(_accessToken: string): Promise<SessionState | null> {
  // const client = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } });
  // const { data } = await client.from('nr_assessment_sessions')
  //   .select('state, saved_at').order('saved_at', { ascending: false }).limit(1).single();
  // ...staleness check, then return data.state as SessionState
  return null;
}

// TODO: delete the draft row for this participant/assessment.
export async function clearRemoteSession(_accessToken: string): Promise<void> {
  // const client = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } });
  // await client.from('nr_assessment_sessions').delete().eq(...);
}

function scheduleRemoteSave(state: SessionState, accessToken: string): void {
  if (remoteTimer) clearTimeout(remoteTimer);
  remoteTimer = setTimeout(() => {
    remoteTimer = null;
    void saveRemoteSession(state, accessToken).catch(() => {
      // A failed draft save must never surface to the participant — the local
      // copy is the one that matters for this device.
    });
  }, REMOTE_DEBOUNCE_MS);
}

// ===========================================================================
// ORCHESTRATION — what the app calls
// ===========================================================================

// Local write is synchronous and authoritative for this device; the server copy
// trails behind on a debounce.
export function saveSession(state: SessionState, accessToken?: string | null): void {
  saveLocalSession(state);
  if (accessToken) scheduleRemoteSave(state, accessToken);
}

// Server wins when both exist and the server copy is newer — that is the case
// where the participant moved to a different device.
export async function loadSession(accessToken?: string | null): Promise<SessionState | null> {
  const local = loadLocalSession();
  if (!accessToken) return local;

  let remote: SessionState | null = null;
  try {
    remote = await loadRemoteSession(accessToken);
  } catch {
    return local;
  }

  if (!remote) return local;
  if (!local) return remote;
  return remote.savedAt > local.savedAt ? remote : local;
}

export function clearSession(accessToken?: string | null): void {
  if (remoteTimer) {
    clearTimeout(remoteTimer);
    remoteTimer = null;
  }
  clearLocalSession();
  if (accessToken) {
    void clearRemoteSession(accessToken).catch(() => {});
  }
}

// "3:42 pm" — what the resume prompt shows the participant.
export function formatSavedAt(savedAt: number): string {
  try {
    return new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return 'earlier';
  }
}
