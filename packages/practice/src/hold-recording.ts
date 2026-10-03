// ===== HOLD RECORDING =====
// Records how a hold-phase segment of a session actually ended: completed on
// its own, or abandoned early (the person pressed End while mid-hold).
// Separate from PracticeSessionRecord in types.ts, which summarizes the
// whole session's HRV metrics — this is about one phase's outcome, logged as
// it happens rather than assembled at session end.
//
// RECONSTRUCTION NOTICE: the `endedBy: 'abandoned'` outcome and a console
// [stub] record are the two concrete details that survived about this
// feature. Everything else here (field names beyond endedBy, the stub
// function's shape) is rebuilt to match that description, not recovered.
// The host should replace recordHoldOutcome's console.log with a real sink
// (network call, analytics event) once one exists.

export type HoldEndedBy = 'completed' | 'abandoned';

export interface HoldRecord {
  exerciseId: string;
  // Which hold this was within the session, 0-indexed, in case a pattern
  // has more than one hold phase per cycle (e.g. box breathing's two holds).
  holdIndex: number;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  // The hold's prescribed length, so a caller can tell "abandoned at 2s of a
  // planned 4s" from the record alone.
  plannedDurationMs: number;
  endedBy: HoldEndedBy;
}

// STUB: logs to the console until a real recording sink exists. Kept as its
// own function (rather than inlined at call sites) so swapping in a real
// sink later is a one-place change.
export function recordHoldOutcome(record: HoldRecord): void {
  // eslint-disable-next-line no-console
  console.log('[stub] hold record', record);
}
