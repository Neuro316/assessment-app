// ===== COOSPO HW9 BLUETOOTH PROTOCOL =====
// BLE Heart Rate Service 0x180D, Characteristic 0x2A37
// RR intervals at 1/1024 second resolution
// This module is the candidate for extraction to a shared package

export interface HRDataPoint {
  heartRate: number;
  rrIntervals: number[];
  timestamp: number;
}

export type DataCallback = (data: HRDataPoint) => void;
export type DisconnectCallback = () => void;

// Real BLE connection to Coospo HW9
export async function connectHW9(
  onData: DataCallback,
  onDisconnect: DisconnectCallback
): Promise<() => void> {
  const device = await navigator.bluetooth.requestDevice({
    filters: [
      { services: ['heart_rate'] },
      { name: 'HW9' },
    ],
    optionalServices: ['heart_rate'],
  });

  device.addEventListener('gattserverdisconnected', onDisconnect);

  const server = await device.gatt!.connect();
  const service = await server.getPrimaryService('heart_rate');
  const characteristic = await service.getCharacteristic('heart_rate_measurement');

  await characteristic.startNotifications();
  characteristic.addEventListener('characteristicvaluechanged', (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value!;
    onData(parseHeartRateData(value));
  });

  // Request wake lock to prevent screen sleep during recording
  try {
    if ('wakeLock' in navigator) {
      await (navigator as any).wakeLock.request('screen');
    }
  } catch (e) {}

  // Return disconnect function
  return () => {
    if (device.gatt?.connected) device.gatt.disconnect();
  };
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
  onDisconnect: DisconnectCallback
): () => void {
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

  return () => {
    clearInterval(interval);
    onDisconnect();
  };
}

// Check if Web Bluetooth is available
export function isBLESupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}
