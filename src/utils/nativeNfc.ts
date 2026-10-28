// NDEFReader-Ersatz für die Android-App. Die WebView kennt Web NFC nicht, daher übernimmt das native Plugin
// FilamentNfc das Lesen und Beschreiben. Die Web-App nutzt weiter dieselbe NDEFReader-Schnittstelle.
import { IS_NATIVE } from './env';
import { getNativePlugin } from './nativeBridge';

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

function toBytes(data: any): Uint8Array {
  if (typeof data === 'string') return new TextEncoder().encode(data);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return new Uint8Array();
}

class NativeNDEFReader {
  onreading: ((ev: any) => void) | null = null;
  onreadingerror: ((ev: any) => void) | null = null;
  private stop: (() => void) | null = null;

  async scan(options?: { signal?: AbortSignal }) {
    const plugin = getNativePlugin('FilamentNfc');
    if (!plugin) throw new Error('NFC-Plugin nicht gefunden. Bitte die neueste App installieren.');
    const state = await plugin.call<{ available: boolean; enabled: boolean }>('isAvailable');
    if (!state.available) throw new Error('Dieses Gerät hat kein NFC.');
    if (!state.enabled) throw new Error('NFC ist ausgeschaltet. Bitte in den Android-Einstellungen aktivieren.');

    plugin.on('tag', (ev: any) => {
      const records = (ev.records || []).map((r: any) => {
        const bytes = b64ToBytes(r.data);
        return {
          recordType: r.recordType,
          mediaType: r.mediaType,
          encoding: r.encoding || 'utf-8',
          data: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        };
      });
      this.onreading?.({ serialNumber: ev.serialNumber, message: { records } });
    });
    plugin.on('tagError', () => this.onreadingerror?.({}));

    await plugin.call('startScan');
    const end = () => {
      plugin.call('stopScan').catch(() => {});
    };
    this.stop = end;
    options?.signal?.addEventListener('abort', end, { once: true });
  }

  async write(message: any, options?: { signal?: AbortSignal }) {
    const plugin = getNativePlugin('FilamentNfc');
    if (!plugin) throw new Error('NFC-Plugin nicht gefunden. Bitte die neueste App installieren.');
    const state = await plugin.call<{ available: boolean; enabled: boolean }>('isAvailable');
    if (!state.available) throw new Error('Dieses Gerät hat kein NFC.');
    if (!state.enabled) throw new Error('NFC ist ausgeschaltet. Bitte in den Android-Einstellungen aktivieren.');

    const records = (message?.records || []).map((r: any) => {
      if (r.recordType === 'mime') {
        return { recordType: 'mime', mediaType: r.mediaType || 'application/octet-stream', data: bytesToB64(toBytes(r.data)) };
      }
      const text = typeof r.data === 'string' ? r.data : new TextDecoder().decode(toBytes(r.data));
      return { recordType: r.recordType === 'url' ? 'url' : 'text', data: text };
    });
    options?.signal?.addEventListener('abort', () => plugin.call('cancelWrite').catch(() => {}), { once: true });
    await plugin.call('write', { records });
  }
}

/** In der Android-App den fehlenden NDEFReader durch die native Variante ersetzen */
export function installNativeNfc() {
  if (!IS_NATIVE || typeof window === 'undefined') return;
  if ('NDEFReader' in window) return;
  (window as any).NDEFReader = NativeNDEFReader;
}
