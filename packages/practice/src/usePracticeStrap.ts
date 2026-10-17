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
  connectSimulated,
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
  // ⚠ TEST ONLY. A fake strap (connectSimulated) in place of the HW9: no Bluetooth
  // call is made and the browser's Bluetooth support does not matter. Read once,
  // on mount. Hosts pass it only on a test launch, never on a real one.
  simulate?: boolean;
  // ⚠ TEST ONLY, and only with simulate: timings that let every state be seen.
  simulation?: StrapSimulation;
}

// ⚠ TEST ONLY. How the simulated strap behaves (launch params sim_connect_ms,
// sim_drop_at_ms, sim_drop_for_ms, sim_nobt). Every field is optional; without
// one the simulated strap connects at once and never drops.
export interface StrapSimulation {
  // A connect takes this long, so 'connecting' shows.
  connectDelayMs?: number | null;
  // The first connection drops this long after it comes up...
  dropAtMs?: number | null;
  // ...and the strap stays out of reach this long, so a silent reconnect fails
  // until it has passed.
  dropForMs?: number | null;
  // Report no Web Bluetooth, as an iPhone browser would (read by StrapProvider).
  noBluetooth?: boolean;
}

// A simulated silent reconnect takes this long, so 'reconnecting' shows.
const SIM_RECONNECT_MS = 1000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface PracticeStrap {
  state: PracticeStrapState;
  // The connected strap's advertised name ("Simulated armband" for the fake one),
  // or null before the first connection.
  deviceName: string | null;
  latest: HRDataPoint | null;
  battery: number | null;
  error: string | null;
  connect: () => Promise<void>;
  // Reattach to the strap this hook last had, without the picker, so it needs no
  // tap: a known device for the HW9, or the simulated strap once its drop window
  // has passed. Resolves true when connected. Nothing is tried while another
  // attempt is running, or with no strap to go back to.
  reconnectSilently: () => Promise<boolean>;
  disconnect: () => void;
}

export function usePracticeStrap(options: UsePracticeStrapOptions = {}): PracticeStrap {
  const [state, setState] = useState<PracticeStrapState>('idle');
  const [latest, setLatest] = useState<HRDataPoint | null>(null);
  const [battery, setBattery] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);

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
    if (!optionsRef.current.simulate && !isBLESupported()) {
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

  // A connect or silent reconnect is running.
  const attemptingRef = useRef(false);
  // Simulation: the scheduled drop happens once, and until simDownUntilRef the
  // simulated strap cannot be reached silently.
  const simDroppedRef = useRef(false);
  const simDownUntilRef = useRef(0);

  // The simulated strap, with its drop scheduled when the launch asked for one.
  const connectSim = useCallback((): HRConnection => {
    const conn = connectSimulated(handleData, handleDrop, { onBattery: setBattery });
    const sim = optionsRef.current.simulation;
    if (!sim?.dropAtMs || !sim.dropForMs || simDroppedRef.current) return conn;
    const dropForMs = sim.dropForMs;
    const timer = setTimeout(() => {
      simDroppedRef.current = true;
      simDownUntilRef.current = Date.now() + dropForMs;
      conn.disconnect();
      handleDrop();
    }, sim.dropAtMs);
    return {
      ...conn,
      disconnect: () => {
        clearTimeout(timer);
        conn.disconnect();
      },
    };
  }, [handleData, handleDrop]);

  const connect = useCallback(async () => {
    if (unsupportedRef.current || connectionRef.current) return;
    setError(null);

    const skipSilent = skipSilentRef.current;
    strapLog('connect: tapped', { hasSessionDevice: !!deviceRef.current, skipSilent });

    attemptingRef.current = true;
    try {
      let conn: HRConnection | null = null;
      if (optionsRef.current.simulate) {
        const delay = optionsRef.current.simulation?.connectDelayMs;
        if (delay) {
          setState('connecting');
          await sleep(delay);
        }
        conn = connectSim();
        strapLog('connect: simulated strap');
      }
      if (!conn && deviceRef.current && !skipSilent) {
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
      if (conn.device) deviceRef.current = conn.device;
      setDeviceName(conn.device ? conn.device.name ?? 'Armband' : 'Simulated armband');
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
    } finally {
      attemptingRef.current = false;
    }
  }, [handleData, handleDrop, connectSim]);

  const reconnectSilently = useCallback(async (): Promise<boolean> => {
    if (unsupportedRef.current || connectionRef.current || attemptingRef.current) return false;
    const simulate = !!optionsRef.current.simulate;
    const device = deviceRef.current;
    if (!simulate && !device) return false;
    attemptingRef.current = true;
    setError(null);
    setState('reconnecting');
    strapLog('silent reconnect: attempting');
    try {
      let conn: HRConnection;
      if (simulate) {
        await sleep(SIM_RECONNECT_MS);
        if (Date.now() < simDownUntilRef.current) throw new Error('The simulated armband is out of reach.');
        conn = connectSim();
      } else {
        conn = await reconnectHW9(device!, handleData, handleDrop, { onBattery: setBattery });
      }
      connectionRef.current = conn;
      setBattery(conn.battery);
      setState('connected');
      strapLog('silent reconnect: succeeded');
      return true;
    } catch (e) {
      // Out of range still. Back to idle; the next tap or retry tries again. The
      // tap's picker rule (skipSilentRef) is left alone: no tap was spent here.
      strapLog('silent reconnect: failed', errorDetail(e));
      setState('idle');
      return false;
    } finally {
      attemptingRef.current = false;
    }
  }, [handleData, handleDrop, connectSim]);

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

  return { state, deviceName, latest, battery, error, connect, reconnectSilently, disconnect };
}
