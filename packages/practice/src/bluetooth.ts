// ===== COOSPO HW9 BLUETOOTH PROTOCOL =====
// Adapted from the assessment app's src/lib/bluetooth.ts. Same connect paths and
// same parsing; differences:
//   - typed against @types/web-bluetooth rather than // @ts-nocheck
//   - every characteristicvaluechanged listener is removed on teardown
//   - the screen wake lock is held as a sentinel and released on teardown
//
// BLE Heart Rate Service 0x180D, Characteristic 0x2A37
// RR intervals at 1/1024 second resolution
// Battery Service 0x180F, Battery Level 0x2A19 (optional — not every strap has it)
// Re-pairing is avoided via getDevices(), which lists straps this origin already
// has permission for — so only the very first connection shows the native picker.

export interface HRDataPoint {
  heartRate: number;
  rrIntervals: number[];
  timestamp: number;
}

export type DataCallback = (data: HRDataPoint) => void;
export type DisconnectCallback = () => void;
export type BatteryCallback = (level: number) => void;

// Which route a connect attempt is taking, so the UI can say what is happening.
//   'reconnecting' — silently reattaching to a strap we already have permission for
//   'searching'    — falling back to the native picker
export type ConnectStage = 'reconnecting' | 'searching';
export type StageCallback = (stage: ConnectStage) => void;

export interface ConnectOptions {
  onBattery?: BatteryCallback;
  onStage?: StageCallback;
  // Skip the silent path and go straight to the picker. Worth setting once the
  // silent path has already failed: a slow failing GATT connect can outlast the
  // ~5s user-activation window that requestDevice() needs, so retrying it would
  // burn the gesture and get the picker refused again.
  skipKnownDevices?: boolean;
}

export interface HRConnection {
  // Tears the connection down deliberately — does NOT fire onDisconnect.
  disconnect: () => void;
  // Kept so the caller can reconnect later without going through the picker again.
  device: BluetoothDevice | null;
  // null when the device does not expose the Battery Service.
  battery: number | null;
}

const HR_SERVICE = 'heart_rate';
const BATTERY_SERVICE = 'battery_service';

// getDevices() is newer than the rest of Web Bluetooth and absent from Safari and
// older Chrome, so it is treated as optional rather than assumed.
type BluetoothWithGetDevices = Bluetooth & { getDevices?: () => Promise<BluetoothDevice[]> };

// Straps this origin already has permission for. Returns null when the browser
// lacks getDevices() (Safari, older Chrome), when permission was never granted,
// or when nothing matching is paired — every one of which is a normal state, not
// an error.
export async function findPairedHW9(): Promise<BluetoothDevice | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.bluetooth) return null;
    const bluetooth = navigator.bluetooth as BluetoothWithGetDevices;
    if (typeof bluetooth.getDevices !== 'function') return null;

    const devices = await bluetooth.getDevices();
    return devices.find((d) => (d.name || '').toUpperCase().includes('HW9')) ?? null;
  } catch {
    return null;
  }
}

// Real BLE connection to Coospo HW9.
//
// Tries the strap the person already paired first, so a returning person never
// sees the native picker. Only a first-ever connection — or a strap that is off,
// flat or out of range — falls through to requestDevice().
export async function connectHW9(
  onData: DataCallback,
  onDisconnect: DisconnectCallback,
  options: ConnectOptions = {}
): Promise<HRConnection> {
  const { onBattery, onStage, skipKnownDevices } = options;

  if (!skipKnownDevices) {
    const known = await findPairedHW9();
    if (known) {
      onStage?.('reconnecting');
      try {
        return await attachToDevice(known, onData, onDisconnect, onBattery);
      } catch {
        // Off, flat or out of range. Fall through and ask for it properly.
      }
    }
  }

  onStage?.('searching');
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [HR_SERVICE] }, { name: 'HW9' }],
    optionalServices: [HR_SERVICE, BATTERY_SERVICE],
  });

  return attachToDevice(device, onData, onDisconnect, onBattery);
}

// Reconnect to a device already paired in this session. No picker, no re-pairing.
// Throws if the strap has been out of range too long — the caller should then
// fall back to connectHW9().
export async function reconnectHW9(
  device: BluetoothDevice,
  onData: DataCallback,
  onDisconnect: DisconnectCallback,
  options: ConnectOptions = {}
): Promise<HRConnection> {
  return attachToDevice(device, onData, onDisconnect, options.onBattery);
}

// A characteristic and the listener attached to it, so teardown can detach it.
interface Subscription {
  characteristic: BluetoothRemoteGATTCharacteristic;
  listener: (event: Event) => void;
}

function subscribe(
  characteristic: BluetoothRemoteGATTCharacteristic,
  onValue: (value: DataView) => void
): Subscription {
  const listener = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (value) onValue(value);
  };
  characteristic.addEventListener('characteristicvaluechanged', listener);
  return { characteristic, listener };
}

async function attachToDevice(
  device: BluetoothDevice,
  onData: DataCallback,
  onDisconnect: DisconnectCallback,
  onBattery?: BatteryCallback
): Promise<HRConnection> {
  const gatt = device.gatt;
  if (!gatt) throw new Error('This device does not expose a GATT server.');

  const subscriptions: Subscription[] = [];
  let wakeLock: WakeLockSentinel | null = null;

  // Everything this connection attached, detached in one place. Runs on a
  // deliberate disconnect and on an unexpected drop alike, so neither path leaves
  // listeners or a wake lock behind.
  const release = () => {
    device.removeEventListener('gattserverdisconnected', onDrop);
    for (const { characteristic, listener } of subscriptions.splice(0)) {
      characteristic.removeEventListener('characteristicvaluechanged', listener);
    }
    if (wakeLock) {
      const sentinel = wakeLock;
      wakeLock = null;
      sentinel.release().catch(() => {});
    }
  };

  // One-shot handler: an unexpected drop fires onDisconnect once and unregisters
  // itself, so re-attaching to the same device object never stacks listeners.
  function onDrop() {
    release();
    onDisconnect();
  }
  device.addEventListener('gattserverdisconnected', onDrop);

  let server: BluetoothRemoteGATTServer;
  try {
    server = await gatt.connect();
    const service = await server.getPrimaryService(HR_SERVICE);
    const characteristic = await service.getCharacteristic('heart_rate_measurement');

    await characteristic.startNotifications();
    subscriptions.push(subscribe(characteristic, (value) => onData(parseHeartRateData(value))));
  } catch (e) {
    // Never leave a listener behind on a connection that failed to come up.
    release();
    throw e;
  }

  const battery = await readBattery(server, subscriptions, onBattery);

  // Keep the screen awake for the session. Held so disconnect can release it
  // rather than waiting for the browser to drop it when the tab is hidden.
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch {
    // Refused (no permission, hidden tab, or a frame without screen-wake-lock).
  }

  return {
    device,
    battery,
    disconnect: () => {
      release();
      if (gatt.connected) gatt.disconnect();
    },
  };
}

// Battery is best-effort. A strap without the service is not an error condition —
// the caller just gets null and shows nothing.
async function readBattery(
  server: BluetoothRemoteGATTServer,
  subscriptions: Subscription[],
  onBattery?: BatteryCallback
): Promise<number | null> {
  try {
    const service = await server.getPrimaryService(BATTERY_SERVICE);
    const characteristic = await service.getCharacteristic('battery_level');
    const level = (await characteristic.readValue()).getUint8(0);

    // Some straps push periodic updates; others only answer a direct read.
    try {
      await characteristic.startNotifications();
      subscriptions.push(subscribe(characteristic, (value) => onBattery?.(value.getUint8(0))));
    } catch {}

    onBattery?.(level);
    return level;
  } catch {
    return null;
  }
}

function parseHeartRateData(value: DataView): HRDataPoint {
  const flags = value.getUint8(0);

  // Heart rate: 8-bit (flag bit 0 = 0) or 16-bit (flag bit 0 = 1)
  const hrFormat = flags & 0x01;
  const heartRate = hrFormat === 0 ? value.getUint8(1) : value.getUint16(1, true);

  // RR intervals: present if flag bit 4 is set
  const rrIntervals: number[] = [];
  if (flags & 0x10) {
    let offset = hrFormat === 0 ? 2 : 3;
    // Skip Energy Expended field if present (flag bit 3)
    if (flags & 0x08) offset += 2;

    while (offset + 1 < value.byteLength) {
      const rr = value.getUint16(offset, true);
      const rrMs = (rr / 1024) * 1000; // Convert 1/1024s to ms
      // Artifact rejection: physiological range only
      if (rrMs > 200 && rrMs < 2000) {
        rrIntervals.push(Math.round(rrMs * 10) / 10);
      }
      offset += 2;
    }
  }

  return { heartRate, rrIntervals, timestamp: Date.now() };
}

// Simulated device for testing / demo / non-BLE browsers
export function connectSimulated(
  onData: DataCallback,
  _onDisconnect: DisconnectCallback,
  options: ConnectOptions = {}
): HRConnection {
  let prevRR = 830;

  const interval = setInterval(() => {
    const noise = (Math.random() - 0.5) * 80;
    const respiratory = Math.sin(Date.now() / 4000) * 35;
    let rr = 830 + noise + respiratory + (prevRR - 830) * 0.3;
    rr = Math.max(550, Math.min(1300, rr));
    prevRR = rr;

    onData({
      heartRate: Math.round(60000 / rr),
      rrIntervals: [Math.round(rr * 10) / 10],
      timestamp: Date.now(),
    });
  }, 950);

  // A simulated strap reports a simulated battery, so the whole UI is exercisable
  // without hardware.
  const battery = 78;
  options.onBattery?.(battery);

  return {
    device: null,
    battery,
    disconnect: () => clearInterval(interval),
  };
}

// Check if Web Bluetooth is available
export function isBLESupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}
