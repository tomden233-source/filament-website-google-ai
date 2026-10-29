// Meldungen aufs Gerät (Benachrichtigung). Funktioniert im Browser und in der installierten Web-App.
// In der Android-App läuft es über das eigene Plugin FilamentNotify (braucht die APK ab v1.82), sonst bleibt die Meldung in der App.
import { IS_NATIVE } from './env';

export type NotifyPermission = 'granted' | 'denied' | 'default' | 'unsupported';

// --- Android-App ---
let nativePerm: NotifyPermission = 'default';
let nativeAvailable = true;

function nativeCall<T = any>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  const cap = (window as any).Capacitor;
  if (typeof cap?.nativePromise === 'function') return cap.nativePromise('FilamentNotify', method, args);
  const fn = cap?.Plugins?.FilamentNotify?.[method];
  if (typeof fn === 'function') return fn(args);
  return Promise.reject(new Error('FilamentNotify fehlt (alte App-Version)'));
}

/** Aktuellen Stand in der Android-App lesen (async, danach liefert notifyPermission() den Wert) */
export async function refreshNotifyPermission(): Promise<NotifyPermission> {
  if (!IS_NATIVE) return notifyPermission();
  try {
    const r = await nativeCall<{ granted: boolean }>('status');
    nativeAvailable = true;
    nativePerm = r.granted ? 'granted' : nativePerm === 'granted' ? 'default' : nativePerm;
  } catch {
    nativeAvailable = false; // alte APK ohne Plugin
  }
  return notifyPermission();
}

/** Android-Meldungseinstellungen der App öffnen (wenn blockiert) */
export async function openNotifySettings(): Promise<void> {
  try {
    await nativeCall('openSettings');
  } catch {
    /* alte APK */
  }
}

export function notifyNeedsNewApk(): boolean {
  return IS_NATIVE && !nativeAvailable;
}

export function notifyPermission(): NotifyPermission {
  if (IS_NATIVE) return nativeAvailable ? nativePerm : 'unsupported';
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotifyPermission;
}

export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (IS_NATIVE) {
    try {
      const r = await nativeCall<{ granted: boolean }>('request');
      nativeAvailable = true;
      nativePerm = r.granted ? 'granted' : 'denied';
    } catch {
      nativeAvailable = false;
    }
    return notifyPermission();
  }
  if (notifyPermission() === 'unsupported') return 'unsupported';
  try {
    const res = await Notification.requestPermission();
    return res as NotifyPermission;
  } catch {
    return notifyPermission();
  }
}

export interface LocalNotifyOptions {
  tag?: string;
  /** Adresse eines Bildes (z. B. Kamerabild), wird wenn möglich angezeigt */
  image?: string;
}

/** Zeigt eine Benachrichtigung. Gibt false zurück, wenn das nicht möglich oder nicht erlaubt ist. */
export async function localNotify(title: string, body: string, opts: LocalNotifyOptions = {}): Promise<boolean> {
  if (IS_NATIVE) {
    try {
      const r = await nativeCall<{ shown: boolean }>('show', { title, body, tag: opts.tag || 'fh' });
      return Boolean(r?.shown);
    } catch {
      return false;
    }
  }
  if (notifyPermission() !== 'granted') return false;
  const icon = `${import.meta.env.BASE_URL || '/'}pwa-192x192.png`;
  const options = { body, tag: opts.tag, icon, badge: icon, image: opts.image } as NotificationOptions;
  try {
    // Android-Chrome erlaubt "new Notification" nicht, dort geht es nur über den Service Worker
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(title, options);
      return true;
    }
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
