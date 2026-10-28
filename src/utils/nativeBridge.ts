// Dünne Brücke zu den eigenen Android-Plugins (ohne @capacitor/core zu importieren, das gibt es nur im APK-Build).
import { IS_NATIVE } from './env';

type Listener = (data: any) => void;

export interface NativePlugin {
  call<T = any>(method: string, options?: Record<string, unknown>): Promise<T>;
  on(event: string, cb: Listener): void;
}

const cache: Record<string, NativePlugin> = {};

export function getNativePlugin(name: string): NativePlugin | null {
  if (!IS_NATIVE || typeof window === 'undefined') return null;
  const cap = (window as any).Capacitor;
  if (!cap) return null;
  if (cache[name]) return cache[name];
  let plugin: any = null;
  try {
    plugin = cap.Plugins?.[name] ?? (typeof cap.registerPlugin === 'function' ? cap.registerPlugin(name) : null);
  } catch {
    plugin = null;
  }
  if (!plugin) return null;
  const wrapper: NativePlugin = {
    call: (method, options = {}) => {
      if (typeof plugin[method] === 'function') return plugin[method](options);
      if (typeof cap.nativePromise === 'function') return cap.nativePromise(name, method, options);
      return Promise.reject(new Error('Plugin ' + name + '.' + method + ' fehlt'));
    },
    on: (event, cb) => {
      try {
        plugin.addListener?.(event, cb);
      } catch {
        // ohne Listener keine Ereignisse
      }
    }
  };
  cache[name] = wrapper;
  return wrapper;
}
