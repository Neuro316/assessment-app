// ===== SITTING MODE =====
// Which protocol a sitting runs, chosen per sitting on the welcome screen (ruled by
// Cameron after the first real Insight sitting). The launch URL plays no part: an
// `&mode=insight` on the link is ignored.
//
//   armband connected (or the simulation): the person chooses
//     'full'        -> the resting block, then the sweep          (the default)
//     'pace-finder' -> the sweep only
//   no armband: the pace finder, on self-report, with no choice shown
//
// Both modes rate the four scales before the sweep and after every rate, so both send
// the sweep envelope. The full assessment sends it alongside its scored result in one
// assessment-complete message; the pace finder sends it alone.
//
// Pure, so the tests can load it directly.

export type SittingMode = 'full' | 'pace-finder';
export type ConnMode = 'ble' | 'sim' | 'none' | null;

export const DEFAULT_CHOICE: SittingMode = 'full';

// The choice is shown only when there is a signal to measure.
export function modeChoiceOffered(connMode: ConnMode): boolean {
  return connMode === 'ble' || connMode === 'sim';
}

// The mode this sitting runs. null until an armband is connected or declined.
export function sittingModeFor(connMode: ConnMode, chosen: SittingMode): SittingMode | null {
  if (connMode === 'none') return 'pace-finder';
  if (connMode === 'ble' || connMode === 'sim') return chosen;
  return null;
}

// The mode a saved draft belongs to. Drafts saved before this ruling used
// 'capacity' (full) and 'insight' (sweep only); a draft with no mode was a full
// assessment.
export function draftModeOf(saved: string | undefined): SittingMode {
  if (saved === 'pace-finder' || saved === 'insight') return 'pace-finder';
  return 'full';
}
