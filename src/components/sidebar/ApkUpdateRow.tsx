import React, { useState } from 'react';
import { Download } from 'lucide-react';
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
    <div className="px-1.5 pb-1.5 space-y-1">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-extrabold text-xs shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 active:scale-[0.98] transition"
      >
        <Download className="w-4 h-4" />
        <span>{busy ? 'Lade …' : 'Neueste APK herunterladen'}</span>
        <span className="text-[10px] font-mono-num opacity-80">(jetzt v{APP_VERSION})</span>
      </button>
      <p className="text-[10px] text-center leading-tight" style={{ color: 'var(--app-text-muted)' }}>
        {note || 'Automatische Updates bleiben an. Dieser Knopf holt zusätzlich die komplette App (Logo, neue Android-Funktionen).'}
      </p>
    </div>
  );
};
