// ===== usePracticeStrap =====
// The HW9 strap as React state. Wraps this package's bluetooth.ts.
//
//   'unsupported'  — no Web Bluetooth in this browser; nothing is ever attempted
//   'idle'         — supported, not connected (initially, after a deliberate
//                    disconnect, after a cancelled picker, or after the strap dropped)
//   'reconnecting' — silently reattaching to a strap this origin already knows
//   'searching'    — the native picker is up
//   'connecting'   — a device was chosen in the picker and the link is coming up;
//                    can take several seconds
//   'connected'    — data is flowing
//   'error'        — the last connect attempt failed; see `error`
//
// `latest` is the most recent data point, for display. A caller that needs every
// RR interval passes onData: several points can land between two renders, and
// reading `latest` alone would miss some.

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  connectHW9,
  errorDetail,
  isBLESupported,
  reconnectHW9,
  strapLog,
  type HRConnection,
  type HRDataPoint,
} from './bluetooth';

export type PracticeStrapState =
  | 'unsupported'
  | 'idle'
  | 'reconnecting'
  | 'searching'
  | 'connecting'
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
  // Set once a silent connect has failed — the in-session device or one
  // getDevices() remembered. A failing GATT connect can outlast the ~5s activation
  // window requestDevice() needs, so the next tap skips straight to the picker
  // rather than repeating the slow attempt and getting the picker refused again.
  // Cleared on a successful connect. Same rule as the assessment's
  // skipSilentConnectRef.
  const skipSilentRef = useRef(false);

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
    strapLog('strap dropped unexpectedly');
    connectionRef.current = null;
    setBattery(null);
    setState('idle');
    optionsRef.current.onDropped?.();
  }, []);

  const connect = useCallback(async () => {
    if (unsupportedRef.current || connectionRef.current) return;
    setError(null);

    const skipSilent = skipSilentRef.current;
    strapLog('connect: tapped', { hasSessionDevice: !!deviceRef.current, skipSilent });

    try {
      let conn: HRConnection | null = null;
      if (deviceRef.current && !skipSilent) {
        setState('reconnecting');
        strapLog('session reconnect: attempting', { device: deviceRef.current.name ?? '(unnamed)' });
        try {
          conn = await reconnectHW9(deviceRef.current, handleData, handleDrop, {
            onBattery: setBattery,
          });
          strapLog('session reconnect: succeeded');
        } catch (e) {
          // Out of range too long or no longer paired; ask properly below. That
          // attempt may have used up the tap's activation window, so the next tap
          // must not repeat it.
          strapLog('session reconnect: failed', errorDetail(e));
          skipSilentRef.current = true;
        }
      }
      if (!conn) {
        conn = await connectHW9(handleData, handleDrop, {
          onBattery: setBattery,
          onStage: (stage) => {
            setState(stage);
            // Reaching the picker means the silent route has already failed, or
            // there was none. Either way the next tap goes straight to the picker.
            if (stage === 'searching') skipSilentRef.current = true;
          },
          // Skip the silent route when it already failed on an earlier tap, or when
          // the session device above was just tried.
          skipKnownDevices: skipSilent || !!deviceRef.current,
        });
      }

      connectionRef.current = conn;
      deviceRef.current = conn.device;
      skipSilentRef.current = false;
      setBattery(conn.battery);
      setState('connected');
      strapLog('connect: connected');
    } catch (e) {
      strapLog('connect: gave up', { ...errorDetail(e), skipSilentNext: skipSilentRef.current });
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

  // Release the strap when the host unmounts us.
  useEffect(
    () => () => {
      connectionRef.current?.disconnect();
      connectionRef.current = null;
    },
    []
  );

  return { state, latest, battery, error, connect, disconnect };
}
