'use client';

// ===== STRAP PROVIDER =====
// One armband connection owned by the host and shared by everything under it, so
// moving between screens never asks a person to pair again. Built on
// usePracticeStrap (same connect paths, timeout and silent reconnect); the state it
// shows comes from strapReducer (strap-state.ts).
//
// A consumer that needs every RR interval subscribes: several packets can land
// between two renders, and reading `latest` alone would miss some. Each packet is
// the HRDataPoint bluetooth.ts parsed, timestamp included, untouched.

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';

import type { HRDataPoint } from './bluetooth';
import { STRAP_START, strapEventFor, strapReducer, type SharedStrapState } from './strap-state';
import { usePracticeStrap } from './usePracticeStrap';

export interface StrapListener {
  onData?: (data: HRDataPoint) => void;
  // The strap dropped without being asked to.
  onDropped?: () => void;
}

export interface SharedStrap {
  state: SharedStrapState;
  deviceName: string | null;
  heartRate: number | null;
  latest: HRDataPoint | null;
  battery: number | null;
  // Why the last attempt failed, in words for the person; null otherwise.
  error: string | null;
  // Returns the unsubscribe.
  subscribe: (listener: StrapListener) => () => void;
  // Call straight from a tap: the native picker needs the tap's activation.
  connect: () => Promise<void>;
  disconnect: () => void;
}

const StrapContext = createContext<SharedStrap | null>(null);

// The connection the nearest StrapProvider owns, or null outside one.
export function useSharedStrap(): SharedStrap | null {
  return useContext(StrapContext);
}

export function StrapProvider({ simulate = false, children }: { simulate?: boolean; children: ReactNode }) {
  const listenersRef = useRef(new Set<StrapListener>());
  const [machine, dispatch] = useReducer(strapReducer, STRAP_START);

  const onData = useCallback((data: HRDataPoint) => {
    for (const l of listenersRef.current) l.onData?.(data);
  }, []);
  const onDropped = useCallback(() => {
    dispatch({ type: 'dropped' });
    for (const l of listenersRef.current) l.onDropped?.();
  }, []);

  const strap = usePracticeStrap({ onData, onDropped, simulate });

  // The hook's own states, read as the reducer's events.
  const prevRef = useRef(strap.state);
  useEffect(() => {
    const event = strapEventFor(prevRef.current, strap.state);
    prevRef.current = strap.state;
    if (event) dispatch(event);
  }, [strap.state]);

  const subscribe = useCallback((listener: StrapListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const { connect, disconnect: hookDisconnect } = strap;
  const disconnect = useCallback(() => {
    dispatch({ type: 'disconnected' });
    hookDisconnect();
  }, [hookDisconnect]);

  const value = useMemo<SharedStrap>(
    () => ({
      state: machine.state,
      deviceName: strap.deviceName,
      heartRate: strap.latest?.heartRate || null,
      latest: strap.latest,
      battery: strap.battery,
      error: strap.error,
      subscribe,
      connect,
      disconnect,
    }),
    [machine.state, strap.deviceName, strap.latest, strap.battery, strap.error, subscribe, connect, disconnect]
  );

  return <StrapContext.Provider value={value}>{children}</StrapContext.Provider>;
}
