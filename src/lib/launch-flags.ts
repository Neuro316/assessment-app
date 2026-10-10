// ===== LAUNCH FLAGS =====
// Test-only switches read from the launch URL. Real sittings never carry them.
//
// sim=1  offers "Use simulation" (a fake armband) on the welcome screen and on the
//        disconnect screen. Without it the simulation is not offered at all, so a
//        participant cannot take a sitting on made-up heartbeats by mistake.
//
// Pure, so the tests can load it directly.

export function simulationEnabled(params: URLSearchParams): boolean {
  return params.get('sim') === '1';
}

// drop=<s>:<s>,<s>:<s>  (only with sim=1) windows of recording time, in seconds from the
//        start of the recording, during which the simulated strap emits nothing. A
//        test-only way to reproduce an armband that lost the signal. Recording time is
//        the resting block (0 to its length) followed by the paces back to back, and
//        excludes everything between them (ratings, intros). Malformed windows are
//        ignored; without sim=1 the whole flag is ignored.
export interface DropWindow {
  startMs: number;
  endMs: number;
}

export function simDropWindows(params: URLSearchParams): DropWindow[] {
  if (!simulationEnabled(params)) return [];
  const raw = params.get('drop');
  if (!raw) return [];
  const out: DropWindow[] = [];
  for (const part of raw.split(',')) {
    const m = /^\s*(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\s*$/.exec(part);
    if (!m) continue;
    const start = Number(m[1]) * 1000;
    const end = Number(m[2]) * 1000;
    if (end > start) out.push({ startMs: start, endMs: end });
  }
  return out;
}

export function inDropWindow(windows: DropWindow[], recordingMs: number): boolean {
  return windows.some((w) => recordingMs >= w.startMs && recordingMs < w.endMs);
}
