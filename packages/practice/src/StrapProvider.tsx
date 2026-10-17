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
import { usePracticeStrap, type StrapSimulation } from './usePracticeStrap';

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

// After a drop, the strap is tried again silently (no picker, so no tap needed)
// every RETRY_EVERY_MS for RETRY_WINDOW_MS. Past the window it stays lost until
// the person taps Connect.
export const RETRY_EVERY_MS = 2_000;
export const RETRY_WINDOW_MS = 20_000;

export function StrapProvider({
  simulate = false,
  simulation,
  children,
}: {
  simulate?: boolean;
  // ⚠ TEST ONLY, and only with simulate.
  simulation?: StrapSimulation | null;
  children: ReactNode;
}) {
  const listenersRef = useRef(new Set<StrapListener>());
  const [machine, dispatch] = useReducer(strapReducer, STRAP_START);
  const machineRef = useRef(machine);
  machineRef.current = machine;
  const reconnectRef = useRef<() => Promise<boolean>>(async () => false);
  const unmountedRef = useRef(false);
  useEffect(
    () => () => {
      unmountedRef.current = true;
    },
    []
  );

  const retryAfterDrop = useCallback(async () => {
    const started = Date.now();
    while (Date.now() - started < RETRY_WINDOW_MS) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_EVERY_MS));
      // No attempt starts past the window, even after the wait.
      if (Date.now() - started >= RETRY_WINDOW_MS) return;
      // Connected, disconnected or being connected by a tap: nothing left to do.
      if (unmountedRef.current || machineRef.current.state !== 'lost') return;
      if (await reconnectRef.current()) return;
    }
  }, []);

  const onData = useCallback((data: HRDataPoint) => {
    for (const l of listenersRef.current) l.onData?.(data);
  }, []);
  const onDropped = useCallback(() => {
    dispatch({ type: 'dropped' });
    for (const l of listenersRef.current) l.onDropped?.();
    void retryAfterDrop();
  }, [retryAfterDrop]);

  const sim = simulate ? simulation ?? undefined : undefined;
  const strap = usePracticeStrap({ onData, onDropped, simulate, simulation: sim });
  reconnectRef.current = strap.reconnectSilently;

  // Test only: report no Web Bluetooth, as an iPhone browser would.
  const noBluetooth = !!sim?.noBluetooth;
  useEffect(() => {
    if (noBluetooth) dispatch({ type: 'unsupported' });
  }, [noBluetooth]);

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

  const { connect: hookConnect, disconnect: hookDisconnect } = strap;
  const connect = useCallback(async () => {
    if (machineRef.current.state === 'unsupported') return;
    await hookConnect();
  }, [hookConnect]);
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
