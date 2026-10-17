// ===== SHARED STRAP STATE =====
// The state a host-owned armband connection shows, as a pure reducer, so the
// transitions can be tested without Bluetooth. StrapProvider feeds it from
// usePracticeStrap.
//
//   'unsupported'  no Web Bluetooth in this browser; nothing leaves it
//   'idle'         not connected, and not because the strap dropped
//   'connecting'   the native picker is up, or a chosen strap's link is coming up
//   'connected'    data is flowing
//   'reconnecting' silently reattaching to a strap this origin already knows
//   'lost'         the strap dropped without being asked to; stays until it
//                  connects again or is deliberately disconnected
//
// Import-free, so tests can load it directly.

export type SharedStrapState = 'unsupported' | 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'lost';

export interface StrapMachine {
  state: SharedStrapState;
  // A drop has happened and nothing has replaced it yet: a failed retry goes back
  // to 'lost', not 'idle'.
  lost: boolean;
}

export type StrapEvent =
  | { type: 'unsupported' }
  // A connect attempt's route, as usePracticeStrap reports it.
  | { type: 'stage'; stage: 'reconnecting' | 'searching' | 'connecting' }
  | { type: 'connected' }
  // The attempt ended without a connection: the picker dismissed, refused, or the
  // link failed or timed out.
  | { type: 'failed' }
  | { type: 'dropped' }
  // Deliberate: the person tapped Disconnect.
  | { type: 'disconnected' };

export const STRAP_START: StrapMachine = { state: 'idle', lost: false };

export function strapReducer(s: StrapMachine, e: StrapEvent): StrapMachine {
  if (s.state === 'unsupported') return s;
  switch (e.type) {
    case 'unsupported':
      return { state: 'unsupported', lost: false };
    case 'stage':
      return { ...s, state: e.stage === 'reconnecting' ? 'reconnecting' : 'connecting' };
    case 'connected':
      return { state: 'connected', lost: false };
    case 'failed':
      return { ...s, state: s.lost ? 'lost' : 'idle' };
    case 'dropped':
      return { state: 'lost', lost: true };
    case 'disconnected':
      return { state: 'idle', lost: false };
  }
}

// usePracticeStrap's state, read as an event for the reducer. `prev` is the state
// before it. A move to 'idle' out of an attempt is a failed attempt (a dismissed
// picker); out of 'connected' it is a drop or a disconnect, which the provider
// reports itself, so null.
export function strapEventFor(prev: string, next: string): StrapEvent | null {
  if (next === prev) return null;
  switch (next) {
    case 'unsupported':
      return { type: 'unsupported' };
    case 'reconnecting':
    case 'searching':
    case 'connecting':
      return { type: 'stage', stage: next };
    case 'connected':
      return { type: 'connected' };
    case 'error':
      return { type: 'failed' };
    case 'idle':
      return prev === 'reconnecting' || prev === 'searching' || prev === 'connecting' ? { type: 'failed' } : null;
    default:
      return null;
  }
}

// The shared state as the instrument's own strap bar reads it (its
// PracticeStrapState), so a shared connection renders exactly as an internal one.
// Lost and idle both offer Connect; with an error message they show it.
export function instrumentStrapState(
  state: SharedStrapState,
  error: string | null
): 'unsupported' | 'idle' | 'reconnecting' | 'connecting' | 'connected' | 'error' {
  if (state === 'idle' || state === 'lost') return error ? 'error' : 'idle';
  return state;
}
