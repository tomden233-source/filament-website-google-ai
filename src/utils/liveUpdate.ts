// Live-Update der Android-App: neue Oberfläche kommt aus dem GitHub-Release, ohne neue APK (Plugin FilamentLive).
// Nur wenn sich der Android-Teil ändert (nativeApi steigt), ist wieder eine neue APK nötig.
import { APP_VERSION, IS_NATIVE, REPO } from './env';
import { getNativePlugin } from './nativeBridge';

export interface LiveState {
  status: 'idle' | 'downloading' | 'ready' | 'needApk';
  version?: string;
}

const BASE = `https://github.com/${REPO}/releases/download/apk-latest`;
const parts = (v: string) => (v.match(/\d+/g) || []).map(Number);

export function isNewer(a: string, b: string): boolean {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

let state: LiveState = { status: 'idle' };
const listeners = new Set<(s: LiveState) => void>();

function set(next: LiveState) {
  state = next;
  listeners.forEach(l => l(state));
}

export function subscribeLive(cb: (s: LiveState) => void): () => void {
  listeners.add(cb);
  cb(state);
  return () => listeners.delete(cb);
}

let busy = false;

export async function checkLiveUpdate(): Promise<void> {
  const plugin = getNativePlugin('FilamentLive');
  if (!plugin || busy || state.status === 'ready') return;
  busy = true;
  try {
    const info = await plugin.call<{ liveVersion: string; nativeApi: number }>('info');
    const res = await fetch(`${BASE}/live-version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const remote = await res.json();
    const version = String(remote.version || '');
    if (!version) return;
    const current = info.liveVersion && isNewer(info.liveVersion, APP_VERSION) ? info.liveVersion : APP_VERSION;
    if (!isNewer(version, current)) return;
    if ((remote.nativeApi || 1) > info.nativeApi) {
      set({ status: 'needApk', version });
      return;
    }
    set({ status: 'downloading', version });
    await plugin.call('download', { url: `${BASE}/live-bundle.zip`, version });
    set({ status: 'ready', version });
  } catch {
    // offline oder GitHub nicht erreichbar: beim nächsten Start erneut prüfen
    if (state.status === 'downloading') set({ status: 'idle' });
  } finally {
    busy = false;
  }
}

/** Heruntergeladene Version jetzt laden (lädt die Oberfläche neu) */
export async function applyLiveUpdate(): Promise<void> {
  await getNativePlugin('FilamentLive')?.call('apply');
}

/** In der App einmal beim Start aufrufen: meldet den erfolgreichen Start und sucht regelmäßig nach Updates */
export function startLiveUpdate() {
  if (!IS_NATIVE) return;
  const plugin = getNativePlugin('FilamentLive');
  if (!plugin) return;
  setTimeout(() => plugin.call('markGood').catch(() => {}), 4000);
  setTimeout(checkLiveUpdate, 2500);
  setInterval(checkLiveUpdate, 15 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkLiveUpdate();
  });
}
