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
