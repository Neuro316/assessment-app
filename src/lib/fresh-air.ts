// ===== FRESH AIR =====
// The launch and hand-off rules for /fresh-air, the standalone practice product.
// The platform opens it full page in the same embed as the assessment and receives
// one practice-complete message per finished session.
//
// Launch params (URL):
//   embedded=true   required, as for the assessment
//   token=<jwt>     required: a valid launch token (verified by /api/verify-launch).
//                   Missing or rejected, the page is refused with the gate screen.
//   name=<text>     the participant's first name, for the greeting
//   age_band=<band> as for the assessment, read with launchAgeBand (age-band.ts). Not
//                   yet sent anywhere: the message carries the record only.
//   pace=<rate>     optional, the person's resonance pace from the Capacity Assessment:
//                   one of 4.5, 5, 5.5, 6, 6.5, 7. Shown on the intro when present and
//                   valid; anything else shows nothing.
//   sim=1           test only: the armband is a simulated strap.
//
// There is no biometrics param. Armband or pacer alone is the person's choice per
// session inside the app, as in the assessment.
//
// Pure, so the tests can load it directly.

export interface FreshAirLaunch {
  embedded: boolean;
  token: string | null;
  name: string | null;
  pace: number | null;
  simulateStrap: boolean;
}

// The six paces the assessment sweeps; a pace from anywhere else is not one of ours.
export const FRESH_AIR_PACES = [4.5, 5, 5.5, 6, 6.5, 7] as const;

export function launchPace(raw: string | null): number | null {
  if (raw === null || !/^\d(\.\d)?$/.test(raw.trim())) return null;
  const n = Number(raw);
  return (FRESH_AIR_PACES as readonly number[]).includes(n) ? n : null;
}

export function parseFreshAirLaunch(params: URLSearchParams): FreshAirLaunch {
  return {
    embedded: params.get('embedded') === 'true',
    token: params.get('token') || null,
    name: params.get('name') || null,
    pace: launchPace(params.get('pace')),
    simulateStrap: params.get('sim') === '1',
  };
}

// 'checking' while the token is with /api/verify-launch. A launch without
// embedded=true or without a token is refused outright, without asking the server.
export type FreshAirAccess = 'checking' | 'allowed' | 'refused';

export function freshAirAccess(launch: FreshAirLaunch, tokenValid: boolean | null): FreshAirAccess {
  if (!launch.embedded || !launch.token) return 'refused';
  if (tokenValid === null) return 'checking';
  return tokenValid ? 'allowed' : 'refused';
}

// ⚠ MESSAGE SHAPE. The platform validates this; change it only once the platform
// has accepted the new shape.
export interface PracticeCompleteMessage<R> {
  type: 'practice-complete';
  completionId: string;
  appSha: string | null;
  record: R;
}

export function buildPracticeComplete<R>(record: R, completionId: string, appSha: string | null): PracticeCompleteMessage<R> {
  return { type: 'practice-complete', completionId, appSha, record };
}

// Posts each record once. The instrument hands a record over on Done, and again on
// unmount only if Done never ran, so a guard per record object keeps a session from
// reaching the platform twice.
export function oncePerRecord<R extends object>(send: (record: R) => void): (record: R) => boolean {
  const sent = new WeakSet<R>();
  return (record) => {
    if (sent.has(record)) return false;
    sent.add(record);
    send(record);
    return true;
  };
}

// <base>/<role>/<segment>.mp3, or null without a base (narration is then silent and
// every guided session runs on its on-screen text).
export function narrationUrl(base: string | undefined | null, role: string | undefined, segment: string): string | null {
  if (!base || !role) return null;
  return `${base.replace(/\/+$/, '')}/${role}/${segment}.mp3`;
}
