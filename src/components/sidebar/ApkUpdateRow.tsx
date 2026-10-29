import React, { useState } from 'react';
import { Download, ChevronRight } from 'lucide-react';
import { APK_URL, IS_NATIVE, APP_VERSION } from '../../utils/env';
import { installApkInApp } from '../../utils/liveUpdate';

// Immer sichtbarer Knopf im Menü: neueste APK laden und installieren (z. B. für neues App-Symbol oder neue Android-Funktionen).
// Die automatischen Oberflächen-Updates bleiben unverändert aktiv.
export const ApkUpdateRow: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const run = async () => {
    if (!IS_NATIVE) {
      window.location.href = APK_URL;
      return;
    }
    setBusy(true);
    setNote('Lade neueste App …');
    const r = await installApkInApp();
    setBusy(false);
    if (r === 'started') setNote('Fertig geladen. Bitte „Installieren“ bestätigen.');
    else if (r === 'needPermission') setNote('Erlaube „Installieren“ für FilamentHub, dann nochmal tippen.');
    else if (r === 'browser') {
      setNote('Download startet im Browser …');
      window.location.href = APK_URL;
    } else setNote('Download fehlgeschlagen. Bitte nochmal tippen.');
  };

  return (
    <div className="px-3 pt-2.5 pb-0 shrink-0" style={{ backgroundColor: 'var(--app-card-sub)' }}>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="w-full rounded-2xl border px-3 py-2 flex items-center gap-3 text-left cursor-pointer disabled:opacity-60 active:scale-[0.99] transition"
        style={{ backgroundColor: 'var(--app-accent-sub)', borderColor: 'var(--app-accent)', color: 'var(--app-text)' }}
      >
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white shadow"
          style={{ backgroundImage: 'var(--app-accent-gradient)' }}
        >
          <Download className={`w-5 h-5 ${busy ? 'animate-bounce' : ''}`} />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-xs font-extrabold">{busy ? 'Lade neueste App …' : 'App-Update holen'}</span>
          <span className="block text-[10px] truncate" style={{ color: 'var(--app-text-muted)' }}>
            {note || `Installiert: v${APP_VERSION} · Auto-Updates bleiben an`}
          </span>
        </span>
        <ChevronRight className="w-4 h-4 shrink-0 opacity-60" />
      </button>
    </div>
  );
};
