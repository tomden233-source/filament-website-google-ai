import React, { useEffect, useState } from 'react';
import { Bell, BellRing, CheckCircle2, PackageMinus } from 'lucide-react';
import { notifyPermission, localNotify, requestNotifyPermission, refreshNotifyPermission, openNotifySettings, notifyNeedsNewApk, type NotifyPermission } from '../../utils/notify';
import { useWorkshopSettings } from '../../utils/workshopSettings';
import { Card, Toggle, buttonStyle, inputStyle } from './ui';

const PRESETS = [50, 100, 150, 200];

const PERMISSION_TEXT: Record<NotifyPermission, string> = {
  granted: 'Erlaubt',
  denied: 'Blockiert (im Browser oder in den Android-Einstellungen freigeben)',
  default: 'Noch nicht gefragt',
  unsupported: 'Nicht verfügbar (die Mitteilungen erscheinen dann nur in der App)'
};

/** Einstellungen: welche Mitteilungen kommen, und ob sie zusätzlich als Benachrichtigung aufs Gerät gehen. */
export const NoticesTab: React.FC = () => {
  const [s, update] = useWorkshopSettings();
  const [perm, setPerm] = useState<NotifyPermission>(notifyPermission());
  const [testInfo, setTestInfo] = useState('');
  useEffect(() => {
    const refresh = () => void refreshNotifyPermission().then(setPerm);
    refresh();
    // Zurück aus den Android-Einstellungen: Stand neu lesen
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

  const sendTest = async () => {
    const ok = await localNotify('FilamentHub', 'Test: So sieht eine Meldung aus.', { tag: 'test' });
    setTestInfo(ok ? 'Test gesendet.' : 'Keine Benachrichtigung möglich. Erlaube sie zuerst.');
    setTimeout(() => setTestInfo(''), 5000);
  };

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <BellRing className="w-4 h-4 text-orange-400" />
          <span>Welche Mitteilungen willst du?</span>
        </div>
        <div className="space-y-3">
          <Toggle on={s.alertPrintDone} onChange={v => update({ alertPrintDone: v })} label="Druck fertig" hint="Sobald der Drucker das Ende meldet." />
          <Toggle on={s.alertPrintFail} onChange={v => update({ alertPrintFail: v })} label="Druck fehlgeschlagen oder abgebrochen" />
          <Toggle on={s.alertDryDone} onChange={v => update({ alertDryDone: v })} label="Trocknung fertig" hint="Mit Dauer, Temperatur und den getrockneten Spulen." />
          <Toggle on={s.alertDryDue} onChange={v => update({ alertDryDue: v })} label="Trocknen fällig" hint="Einmal pro Tag und Spule, mit Temperatur und Zeit." />
          <Toggle on={s.alertLow} onChange={v => update({ alertLow: v })} label="Spule fast leer" hint="Kommt, wenn der Rest unter die Grenze fällt." />
        </div>
        <p className="text-[11px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
          Mitteilungen kommen, solange die App läuft oder im Hintergrund offen ist und mit dem Drucker verbunden bleibt. Alle landen im Postfach (Reiter „Mitteilungen“).
        </p>
      </Card>

      <Card>
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <PackageMinus className="w-4 h-4 text-rose-400" />
          <span>Grenze für „fast leer“</span>
        </div>
        <Toggle on={s.lowWarning} onChange={v => update({ lowWarning: v })} label="Fast leere Spulen markieren" hint="Banner oben und Abzeichen auf der Karte." />
        {s.lowWarning && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {PRESETS.map(p => (
              <button
                key={p}
                onClick={() => update({ lowWeightG: p })}
                className="px-2.5 py-1 rounded-lg border text-[11px] font-mono-num font-bold cursor-pointer"
                style={{
                  backgroundColor: s.lowWeightG === p ? 'var(--app-accent)' : 'var(--app-card)',
                  borderColor: s.lowWeightG === p ? 'var(--app-accent)' : 'var(--app-border)',
                  color: s.lowWeightG === p ? '#fff' : 'var(--app-text)'
                }}
              >
                {p} g
              </button>
            ))}
            <input
              type="number"
              min={0}
              max={1000}
              value={s.lowWeightG}
              onChange={e => update({ lowWeightG: parseInt(e.target.value, 10) || 0 })}
              className="w-20 px-2 py-1 rounded-lg border text-xs font-mono-num outline-none"
              style={inputStyle}
              aria-label="Grenze in Gramm"
            />
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <Bell className="w-4 h-4 text-orange-400" />
          <span>Benachrichtigung aufs Gerät</span>
        </div>
        <Toggle
          on={s.systemPush}
          onChange={v => update({ systemPush: v })}
          label="Zusätzlich als Benachrichtigung anzeigen"
          hint="Ein Tipp darauf öffnet die App direkt bei der Mitteilung."
        />
        <p className="text-[11px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
          Status: <strong style={{ color: 'var(--app-text)' }}>{PERMISSION_TEXT[perm]}</strong>
        </p>
        {notifyNeedsNewApk() && (
          <p className="text-[11px] leading-snug text-amber-400">Deine installierte App ist zu alt für Benachrichtigungen. Bitte die neueste APK installieren.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {perm !== 'granted' && perm !== 'unsupported' && (
            <button
              onClick={async () => setPerm(await requestNotifyPermission())}
              className="px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer flex items-center gap-1.5"
              style={buttonStyle}
            >
              <BellRing className="w-3.5 h-3.5 text-orange-400" />
              <span>Erlauben</span>
            </button>
          )}
          {perm !== 'granted' && notifyPermission() !== 'unsupported' && (
            <button onClick={() => void openNotifySettings()} className="px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer" style={buttonStyle}>
              Android-Einstellungen öffnen
            </button>
          )}
          {perm === 'granted' && (
            <button onClick={sendTest} className="px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer flex items-center gap-1.5" style={buttonStyle}>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Test senden
            </button>
          )}
          {testInfo && <span className="text-[11px] self-center text-emerald-400">{testInfo}</span>}
        </div>
      </Card>
    </div>
  );
};
