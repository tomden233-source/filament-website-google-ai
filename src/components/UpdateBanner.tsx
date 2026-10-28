import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { APK_URL, IS_NATIVE } from '../utils/env';
import { applyLiveUpdate, installApkInApp, subscribeLive, type LiveState } from '../utils/liveUpdate';

// Hinweis in der Android-App:
//  - Neue Oberfläche geladen (Live-Update): ein Tipp auf "Neu laden" startet sie sofort, sonst beim nächsten Start.
//  - Nur wenn sich der Android-Teil ändert, ist eine neue APK nötig (Download, dann "Installieren" bestätigen).

export const UpdateBanner: React.FC = () => {
  const [live, setLive] = useState<LiveState>({ status: 'idle' });
  const [hidden, setHidden] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!IS_NATIVE) return;
    return subscribeLive(setLive);
  }, []);

  if (hidden || (live.status !== 'ready' && live.status !== 'needApk')) return null;

  const needApk = live.status === 'needApk';

  return (
    <div
      role="status"
      className="px-3 py-2 flex items-center gap-2 text-white text-xs font-bold shadow-md"
      style={{ backgroundColor: 'var(--app-accent)' }}
    >
      {needApk ? <Download className="w-4 h-4 shrink-0" /> : <RefreshCw className="w-4 h-4 shrink-0" />}
      <span className="flex-1 min-w-0">
        {note ?? (needApk ? `Große Neuerung v${live.version}: neue App nötig` : `Update v${live.version} ist geladen`)}
      </span>
      <button
        disabled={busy}
        onClick={async () => {
          if (!needApk) {
            applyLiveUpdate().catch(() => setHidden(true));
            return;
          }
          // Direkt in der App laden und installieren, ohne Browser
          setBusy(true);
          setNote('Lade neue App …');
          const r = await installApkInApp();
          setBusy(false);
          if (r === 'started') setNote('Bitte „Installieren“ bestätigen');
          else if (r === 'needPermission') setNote('Erlaube „Installieren“ für FilamentHub, dann nochmal tippen');
          else if (r === 'browser') window.location.href = APK_URL;
          else setNote('Download fehlgeschlagen, bitte nochmal tippen');
        }}
        className="px-3 py-1 rounded-lg bg-white/25 hover:bg-white/35 transition cursor-pointer"
      >
        {needApk ? (busy ? '…' : 'Installieren') : 'Neu laden'}
      </button>
      <button onClick={() => setHidden(true)} aria-label="Später" className="p-1 rounded-lg hover:bg-white/20 cursor-pointer">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
