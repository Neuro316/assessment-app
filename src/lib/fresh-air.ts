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
//   age_band=<band> as for the assessment, read with launchAgeBand (age-band.ts). Sent
//                   as the message's top-level ageBand; absent from the message when
//                   the launch did not carry a valid band.
//   pace=<rate>     optional, the person's resonance pace from the Capacity Assessment:
//                   one of 4.5, 5, 5.5, 6, 6.5, 7. Shown on the intro when present and
//                   valid; anything else shows nothing.
//   pace_source=<s> optional, where the pace came from: lowercase letters, _ and -,
//                   at most 20 characters, else ignored. "measured" adds "· measured"
//                   to the pace pill.
//   tab=<tab>       assessment | practice, the open Fresh Air tab (only with
//                   NEXT_PUBLIC_FRESH_AIR_ASSESSMENT_TAB=1). Missing or anything else
//                   opens Assessment.
//   sim=1           test only: the armband is a simulated strap.
//   Test only, and ignored without sim=1 (each a whole number of ms, at most 6 digits):
//   sim_connect_ms=<n>   a connect takes n ms, so "connecting" shows
//   sim_drop_at_ms=<n>   with sim_drop_for_ms=<m>: the first connection drops n ms
//                        after it comes up and the strap is out of reach for m ms.
//                        Within the provider's retry window it reconnects by itself;
//                        past it, it stays lost. Either missing, no drop.
//   sim_nobt=1           the browser reports no Web Bluetooth, as an iPhone's would
//
// There is no biometrics param. Armband or pacer alone is the person's choice per
// session inside the app, as in the assessment.
//
// Pure, so the tests can load it directly.

import type { AgeBand } from './age-band';

export interface FreshAirLaunch {
  embedded: boolean;
  token: string | null;
  name: string | null;
  pace: number | null;
  paceSource: string | null;
  simulateStrap: boolean;
  // Test only; null without sim=1.
  simulation: FreshAirSimulation | null;
}

export interface FreshAirSimulation {
  connectDelayMs: number | null;
  dropAtMs: number | null;
  dropForMs: number | null;
  noBluetooth: boolean;
}

function simMs(raw: string | null): number | null {
  return raw !== null && /^\d{1,6}$/.test(raw) ? Number(raw) : null;
}

export function launchSimulation(params: URLSearchParams): FreshAirSimulation | null {
  if (params.get('sim') !== '1') return null;
  const dropAtMs = simMs(params.get('sim_drop_at_ms'));
  const dropForMs = simMs(params.get('sim_drop_for_ms'));
  const dropping = dropAtMs !== null && dropForMs !== null && dropForMs > 0;
  return {
    connectDelayMs: simMs(params.get('sim_connect_ms')),
    dropAtMs: dropping ? dropAtMs : null,
    dropForMs: dropping ? dropForMs : null,
    noBluetooth: params.get('sim_nobt') === '1',
  };
}

// The six paces the assessment sweeps; a pace from anywhere else is not one of ours.
export const FRESH_AIR_PACES = [4.5, 5, 5.5, 6, 6.5, 7] as const;

export function launchPace(raw: string | null): number | null {
  if (raw === null || !/^\d(\.\d)?$/.test(raw.trim())) return null;
  const n = Number(raw);
  return (FRESH_AIR_PACES as readonly number[]).includes(n) ? n : null;
}

export function launchPaceSource(raw: string | null): string | null {
  return raw !== null && /^[a-z_-]{1,20}$/.test(raw) ? raw : null;
}

// The pill at the right of the header. No pace, no pill.
export function pacePillText(pace: number | null, paceSource: string | null): string | null {
  if (pace === null) return null;
  return `Your pace ${pace} per min${paceSource === 'measured' ? ' · measured' : ''}`;
}

// The pace pill under 640px with the tabs on: short text, the full words as its label.
export function compactPacePill(pace: number | null, paceSource: string | null): { text: string; ariaLabel: string } | null {
  if (pace === null) return null;
  return {
    text: `Pace ${pace}`,
    ariaLabel: `Your pace ${pace} per minute${paceSource === 'measured' ? ', measured' : ''}`,
  };
}

// ----- the armband pill -----

// What the header's armband pill says, by the shared connection's state. Under
// 640px a connected pill shows only the rate, with the full words as its label.
export type ArmbandPillState = 'unsupported' | 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'lost';

export interface ArmbandPill {
  text: string;
  ariaLabel: string | null;
  dot: boolean;
}

export function armbandPill(state: ArmbandPillState, bpm: number | null, narrow: boolean): ArmbandPill {
  switch (state) {
    case 'connected':
      if (bpm === null) return { text: 'Armband connected', ariaLabel: null, dot: true };
      return narrow
        ? { text: `${bpm} bpm`, ariaLabel: `Armband connected, ${bpm} beats per minute`, dot: true }
        : { text: `Armband connected · ${bpm} bpm`, ariaLabel: null, dot: true };
    case 'idle':
      return narrow
        ? { text: 'Connect', ariaLabel: 'Connect armband', dot: false }
        : { text: 'Connect armband', ariaLabel: null, dot: false };
    case 'connecting':
    case 'reconnecting':
      return narrow
        ? { text: 'Connecting', ariaLabel: 'Connecting armband', dot: false }
        : { text: 'Connecting armband', ariaLabel: null, dot: false };
    case 'lost':
      return narrow
        ? { text: 'Reconnect', ariaLabel: 'Armband disconnected, tap to reconnect', dot: false }
        : { text: 'Armband disconnected', ariaLabel: null, dot: false };
    case 'unsupported':
      return { text: 'Pacer only', ariaLabel: null, dot: false };
  }
}

// ----- the shell's tabs -----

// Read at build, like the other NEXT_PUBLIC_ values. Anything but "1" keeps the
// tab bar (and the Assessment placeholder) away from live members.
export function assessmentTabEnabled(flag: string | undefined): boolean {
  return flag === '1';
}

export const FRESH_AIR_TABS = ['assessment', 'practice'] as const;
export type FreshAirTab = (typeof FRESH_AIR_TABS)[number];

export function freshAirTab(params: URLSearchParams): FreshAirTab {
  const raw = params.get('tab');
  return (FRESH_AIR_TABS as readonly string[]).includes(raw ?? '') ? (raw as FreshAirTab) : 'assessment';
}

// What pressing a tab does. Leaving Practice while a session runs asks first
// ("End this session?"); everything else switches at once.
export type TabPress = 'stay' | 'switch' | 'confirm';

export function tabPress(current: FreshAirTab, next: FreshAirTab, sessionRunning: boolean): TabPress {
  if (next === current) return 'stay';
  return current === 'practice' && sessionRunning ? 'confirm' : 'switch';
}

// The greeting at the top of the content, when the launch carried a name.
export function welcomeLine(name: string | null): string | null {
  return name ? `Welcome back, ${name}` : null;
}

// The query string with tab set and every launch param kept.
export function searchWithTab(search: string, tab: FreshAirTab): string {
  const params = new URLSearchParams(search);
  params.set('tab', tab);
  return `?${params.toString()}`;
}

export function parseFreshAirLaunch(params: URLSearchParams): FreshAirLaunch {
  return {
    embedded: params.get('embedded') === 'true',
    token: params.get('token') || null,
    name: params.get('name') || null,
    pace: launchPace(params.get('pace')),
    paceSource: launchPaceSource(params.get('pace_source')),
    simulateStrap: params.get('sim') === '1',
    simulation: launchSimulation(params),
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
  // Only when the launch carried age_band; the key is absent otherwise, never null.
  ageBand?: AgeBand;
}

export function buildPracticeComplete<R>(
  record: R,
  completionId: string,
  appSha: string | null,
  ageBand: AgeBand | null = null
): PracticeCompleteMessage<R> {
  const message: PracticeCompleteMessage<R> = { type: 'practice-complete', completionId, appSha, record };
  if (ageBand) message.ageBand = ageBand;
  return message;
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
