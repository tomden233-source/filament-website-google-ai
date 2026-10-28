// Meldungen aufs Gerät (Benachrichtigung). Funktioniert im Browser und in der installierten Web-App.
// In der Android-App gibt es die Web-Benachrichtigung nicht, dort bleibt die Meldung in der App.

export type NotifyPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function notifyPermission(): NotifyPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotifyPermission;
}

export async function requestNotifyPermission(): Promise<NotifyPermission> {
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
