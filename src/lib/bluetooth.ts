// @ts-nocheck
// ===== COOSPO HW9 BLUETOOTH PROTOCOL =====
// BLE Heart Rate Service 0x180D, Characteristic 0x2A37
// RR intervals at 1/1024 second resolution
// Battery Service 0x180F, Battery Level 0x2A19 (optional — not every strap has it)
// This module is the candidate for extraction to a shared package

export interface HRDataPoint {
  heartRate: number;
  rrIntervals: number[];
  timestamp: number;
}

export type DataCallback = (data: HRDataPoint) => void;
export type DisconnectCallback = () => void;
export type BatteryCallback = (level: number) => void;

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

// Real BLE connection to Coospo HW9 — shows the native device picker.
export async function connectHW9(
  onData: DataCallback,
  onDisconnect: DisconnectCallback,
  onBattery?: BatteryCallback
): Promise<HRConnection> {
  const device = await navigator.bluetooth.requestDevice({
    filters: [
      { services: [HR_SERVICE] },
      { name: 'HW9' },
    ],
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
  onBattery?: BatteryCallback
): Promise<HRConnection> {
  return attachToDevice(device, onData, onDisconnect, onBattery);
}

async function attachToDevice(
  device: BluetoothDevice,
  onData: DataCallback,
  onDisconnect: DisconnectCallback,
  onBattery?: BatteryCallback
): Promise<HRConnection> {
  // One-shot handler: an unexpected drop fires onDisconnect once and unregisters
  // itself, so re-attaching to the same device object never stacks listeners.
  const onDrop = () => {
    device.removeEventListener('gattserverdisconnected', onDrop);
    onDisconnect();
  };
  device.addEventListener('gattserverdisconnected', onDrop);

  let server;
  try {
    server = await device.gatt.connect();
    const service = await server.getPrimaryService(HR_SERVICE);
    const characteristic = await service.getCharacteristic('heart_rate_measurement');

    await characteristic.startNotifications();
    characteristic.addEventListener('characteristicvaluechanged', (event: Event) => {
      const value = (event.target as BluetoothRemoteGATTCharacteristic).value!;
      onData(parseHeartRateData(value));
    });
  } catch (e) {
    // Never leave a listener behind on a connection that failed to come up.
    device.removeEventListener('gattserverdisconnected', onDrop);
    throw e;
  }

  const battery = await readBattery(server, onBattery);

  // Request wake lock to prevent screen sleep during recording
  try {
    if ('wakeLock' in navigator) {
      await (navigator as any).wakeLock.request('screen');
    }
  } catch (e) {}

  return {
    device,
    battery,
    disconnect: () => {
      device.removeEventListener('gattserverdisconnected', onDrop);
      if (device.gatt?.connected) device.gatt.disconnect();
    },
  };
}

// Battery is best-effort. A strap without the service is not an error condition —
// the caller just gets null and shows nothing.
async function readBattery(
  server: BluetoothRemoteGATTServer,
  onBattery?: BatteryCallback
): Promise<number | null> {
  try {
    const service = await server.getPrimaryService(BATTERY_SERVICE);
    const characteristic = await service.getCharacteristic('battery_level');
    const level = (await characteristic.readValue()).getUint8(0);

    // Some straps push periodic updates; others only answer a direct read.
    try {
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', (event: Event) => {
        const value = (event.target as BluetoothRemoteGATTCharacteristic).value!;
        onBattery?.(value.getUint8(0));
      });
    } catch (e) {}

    onBattery?.(level);
    return level;
  } catch (e) {
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
  onBattery?: BatteryCallback
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
  onBattery?.(battery);

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
