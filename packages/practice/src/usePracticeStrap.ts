// ===== usePracticeStrap =====
// The HW9 strap as React state. Wraps this package's bluetooth.ts.
//
//   'unsupported'  — no Web Bluetooth in this browser; nothing is ever attempted
//   'idle'         — supported, not connected (initially, after a deliberate
//                    disconnect, after a cancelled picker, or after the strap dropped)
//   'reconnecting' — silently reattaching to a strap this origin already knows
//   'searching'    — the native picker is up
//   'connected'    — data is flowing
//   'error'        — the last connect attempt failed; see `error`
//
// `latest` is the most recent data point, for display. A caller that needs every
// RR interval passes onData: several points can land between two renders, and
// reading `latest` alone would miss some.

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  connectHW9,
  isBLESupported,
  reconnectHW9,
  type HRConnection,
  type HRDataPoint,
} from './bluetooth';

export type PracticeStrapState =
  | 'unsupported'
  | 'idle'
  | 'reconnecting'
  | 'searching'
  | 'connected'
  | 'error';

export interface UsePracticeStrapOptions {
  // Every data point, as it arrives.
  onData?: (data: HRDataPoint) => void;
  // The strap dropped without being asked to.
  onDropped?: () => void;
}

export interface PracticeStrap {
  state: PracticeStrapState;
  latest: HRDataPoint | null;
  battery: number | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export function usePracticeStrap(options: UsePracticeStrapOptions = {}): PracticeStrap {
  const [state, setState] = useState<PracticeStrapState>('idle');
  const [latest, setLatest] = useState<HRDataPoint | null>(null);
  const [battery, setBattery] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connectionRef = useRef<HRConnection | null>(null);
  // Held so a later connect can go straight back to the same strap, no picker.
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const unsupportedRef = useRef(false);

  // Read through a ref so a caller passing fresh callbacks each render does not
  // tear the connection down.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!isBLESupported()) {
      unsupportedRef.current = true;
      setState('unsupported');
    }
  }, []);

  const handleData = useCallback((data: HRDataPoint) => {
    setLatest(data);
    optionsRef.current.onData?.(data);
  }, []);

  const handleDrop = useCallback(() => {
    connectionRef.current = null;
    setBattery(null);
    setState('idle');
    optionsRef.current.onDropped?.();
  }, []);

  const connect = useCallback(async () => {
    if (unsupportedRef.current || connectionRef.current) return;
    setError(null);

    try {
      let conn: HRConnection | null = null;
      if (deviceRef.current) {
        setState('reconnecting');
        try {
          conn = await reconnectHW9(deviceRef.current, handleData, handleDrop, {
            onBattery: setBattery,
          });
        } catch {
          // Out of range too long or no longer paired; ask properly below.
        }
      }
      if (!conn) {
        conn = await connectHW9(handleData, handleDrop, {
          onBattery: setBattery,
          onStage: setState,
          // Already tried the remembered device above.
          skipKnownDevices: !!deviceRef.current,
        });
      }

      connectionRef.current = conn;
      deviceRef.current = conn.device;
      setBattery(conn.battery);
      setState('connected');
    } catch (e) {
      const err = e as { name?: string; message?: string } | undefined;
      // Dismissing the picker is a choice, not a failure.
      if (err?.name === 'NotFoundError') {
        setState('idle');
        return;
      }
      setError(
        err?.name === 'SecurityError' || err?.name === 'NotAllowedError'
          ? 'Tap Connect again to choose your armband.'
          : err?.message || 'Could not connect to the armband.'
      );
      setState('error');
    }
  }, [handleData, handleDrop]);

  const disconnect = useCallback(() => {
    connectionRef.current?.disconnect();
    connectionRef.current = null;
    setBattery(null);
    if (!unsupportedRef.current) setState('idle');
  }, []);

  // Release the strap and its wake lock when the host unmounts us.
  useEffect(
    () => () => {
      connectionRef.current?.disconnect();
      connectionRef.current = null;
    },
    []
  );

  return { state, latest, battery, error, connect, disconnect };
}
