// Bluetooth-Verbindungen zum Drucker: Android-App (eigenes Plugin) oder Web Bluetooth (Chrome).
import { getNativePlugin } from '../nativeBridge';

export type Logger = (msg: string) => void;

export interface Link {
  readonly name: string;
  readonly responseTimeoutMs: number;
  write(frame: Uint8Array): Promise<void>;
  onData: (bytes: Uint8Array) => void;
  onDisconnect: () => void;
  close(): Promise<void>;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64 || '');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

// --- Android-App ---------------------------------------------------------------
export interface ScanDevice {
  address: string;
  name: string;
  rssi: number;
  likely: boolean;
}

export const nativeBle = () => getNativePlugin('FilamentBle');

export class NativeLink implements Link {
  readonly responseTimeoutMs = 4000;
  onData: (bytes: Uint8Array) => void = () => {};
  onDisconnect: () => void = () => {};
  private static listening = false;
  private static current: NativeLink | null = null;

  constructor(readonly name: string) {}

  static async connect(address: string, name: string, log: Logger): Promise<NativeLink> {
    const plugin = nativeBle();
    if (!plugin) throw new Error('Bluetooth-Plugin fehlt. Bitte die neueste App (APK) installieren.');
    if (!NativeLink.listening) {
      NativeLink.listening = true;
      plugin.on('data', (ev: any) => NativeLink.current?.onData(b64ToBytes(ev.data)));
      plugin.on('disconnect', () => NativeLink.current?.onDisconnect());
    }
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await plugin.call<{ name?: string }>('connect', { address });
        log(`BLE verbunden: ${r.name || name}`);
        const link = new NativeLink(r.name || name);
        NativeLink.current = link;
        return link;
      } catch (e) {
        lastErr = e;
        log(`BLE Versuch ${attempt} fehlgeschlagen: ${(e as Error).message}`);
        await sleep(600);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Verbindung fehlgeschlagen');
  }

  async write(frame: Uint8Array): Promise<void> {
    await nativeBle()!.call('write', { data: bytesToB64(frame), delay: 10 });
  }

  async close(): Promise<void> {
    if (NativeLink.current === this) NativeLink.current = null;
    try {
      await nativeBle()?.call('disconnect');
    } catch {
      // schon getrennt
    }
  }
}

// --- Web Bluetooth (Chrome am Handy oder PC) -------------------------------------
const sig = (short: number) => `0000${short.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb`;
const LAYOUTS = [
  { service: sig(0xfee7), notify: sig(0xfec1), write: sig(0xfec1) },
  { service: '0000e0ff-3c17-d293-8e48-14fe2e4da212', notify: sig(0xffe1), write: sig(0xffe9) },
  { service: sig(0xff00), notify: sig(0xff01), write: sig(0xff02) }
];

export const webBleSupported = () => typeof navigator !== 'undefined' && 'bluetooth' in navigator;

export async function requestWebDevice(): Promise<any> {
  const services = LAYOUTS.map(l => l.service);
  return (navigator as any).bluetooth.requestDevice({
    filters: [
      ...services.map(s => ({ services: [s] })),
      { namePrefix: 'T0' },
      { namePrefix: 'E1' },
      { namePrefix: 'Supvan' },
      { namePrefix: 'SUPVAN' },
      { namePrefix: 'Katasymbol' }
    ],
    optionalServices: services
  });
}

export class WebLink implements Link {
  readonly responseTimeoutMs = 4000;
  onData: (bytes: Uint8Array) => void = () => {};
  onDisconnect: () => void = () => {};

  private constructor(private device: any, private writeChar: any, readonly name: string) {}

  static async connect(device: any, log: Logger): Promise<WebLink> {
    let server: any;
    let found: any[] = [];
    for (let attempt = 1; ; attempt++) {
      try {
        server = await device.gatt.connect();
        found = await server.getPrimaryServices();
        break;
      } catch (e) {
        if (attempt >= 3) throw e;
        log(`BLE Versuch ${attempt} fehlgeschlagen, neuer Versuch`);
        await sleep(500);
      }
    }
    for (const layout of LAYOUTS) {
      const service = found.find(s => s.uuid === layout.service);
      if (!service) continue;
      const notify = await service.getCharacteristic(layout.notify);
      const write = await service.getCharacteristic(layout.write);
      const link = new WebLink(device, write, device.name || 'Drucker');
      notify.addEventListener('characteristicvaluechanged', () => {
        const v = notify.value;
        link.onData(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
      });
      await notify.startNotifications();
      device.addEventListener('gattserverdisconnected', () => link.onDisconnect());
      return link;
    }
    server.disconnect();
    throw new Error('Kein bekannter Supvan-Bluetooth-Dienst gefunden.');
  }

  async write(frame: Uint8Array): Promise<void> {
    const withResponse = !!this.writeChar.properties.write;
    const chunk = 128;
    for (let off = 0; off < frame.length; off += chunk) {
      if (off > 0) await sleep(10);
      const part = frame.slice(off, off + chunk);
      if (withResponse) await this.writeChar.writeValueWithResponse(part);
      else await this.writeChar.writeValueWithoutResponse(part);
    }
  }

  async close(): Promise<void> {
    try {
      this.device.gatt?.disconnect();
    } catch {
      // schon getrennt
    }
  }
}
