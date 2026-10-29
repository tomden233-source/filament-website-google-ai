import React, { useEffect, useState } from 'react';
import { Bell, BellRing, Droplets, PackageMinus } from 'lucide-react';
import { notifyPermission, localNotify, requestNotifyPermission, refreshNotifyPermission, openNotifySettings, notifyNeedsNewApk, type NotifyPermission } from '../../utils/notify';
import { useWorkshopSettings } from '../../utils/workshopSettings';
import { Card, Toggle, buttonStyle, inputStyle } from './ui';

const PRESETS = [50, 100, 150, 200];

const PERMISSION_TEXT: Record<NotifyPermission, string> = {
  granted: 'Erlaubt',
  denied: 'Blockiert (im Browser oder in den Android-Einstellungen freigeben)',
  default: 'Noch nicht gefragt',
  unsupported: 'Nicht verfügbar (die Meldungen erscheinen dann in der App)'
};

export const NoticesTab: React.FC<{ extra?: React.ReactNode }> = ({ extra }) => {
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

  const askPermission = async () => {
    setPerm(await requestNotifyPermission());
  };

  const sendTest = async () => {
    const ok = await localNotify('FilamentHub', 'Test: So sieht eine Meldung aus.', { tag: 'test' });
    setTestInfo(ok ? 'Test gesendet.' : 'Keine Benachrichtigung möglich. Erlaube sie zuerst.');
    setTimeout(() => setTestInfo(''), 5000);
  };

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <PackageMinus className="w-4 h-4 text-rose-400" />
          <span>Rest-Warnung</span>
        </div>
        <Toggle
          on={s.lowWarning}
          onChange={v => update({ lowWarning: v })}
          label="Warnen, wenn eine Spule fast leer ist"
          hint="Banner oben, Abzeichen auf der Karte und eine Meldung beim Abziehen."
        />
        {s.lowWarning && (
          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] font-bold" style={{ color: 'var(--app-text-muted)' }}>
              Warnung ab Restgewicht (Gramm)
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
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
              />
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <Droplets className="w-4 h-4 text-sky-400" />
          <span>Trocknungs-Erinnerung</span>
        </div>
        <Toggle
          on={s.dryReminder}
          onChange={v => update({ dryReminder: v })}
          label="Erinnern, wenn Trocknen fällig ist"
          hint="Einmal pro Tag und Spule. Meldet auch, wenn die AMS-Trocknung fertig ist. PETG, TPU und Nylon haben einen Feuchte-Hinweis auf der Karte."
        />
      </Card>

      <Card>
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <Bell className="w-4 h-4 text-orange-400" />
          <span>Benachrichtigung aufs Gerät</span>
        </div>
        <p className="text-[11px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
          Status: <strong style={{ color: 'var(--app-text)' }}>{PERMISSION_TEXT[perm]}</strong>
        </p>
        {notifyNeedsNewApk() && (
          <p className="text-[11px] leading-snug text-amber-400">
            Deine installierte App ist zu alt für Meldungen. Bitte die neueste APK (ab v1.82) installieren.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {perm !== 'granted' && perm !== 'unsupported' && (
            <button
              onClick={askPermission}
              className="px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer flex items-center gap-1.5"
              style={buttonStyle}
            >
              <BellRing className="w-3.5 h-3.5 text-orange-400" />
              <span>Erlauben</span>
            </button>
          )}
          {perm !== 'granted' && notifyPermission() !== 'unsupported' && (
            <button
              onClick={() => void openNotifySettings()}
              className="px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer"
              style={buttonStyle}
            >
              Android-Einstellungen öffnen
            </button>
          )}
          {perm === 'granted' && (
            <button
              onClick={sendTest}
              className="px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer"
              style={buttonStyle}
            >
              Test senden
            </button>
          )}
          {testInfo && <span className="text-[11px] self-center text-emerald-400">{testInfo}</span>}
        </div>
      </Card>

      {extra}
    </div>
  );
};
