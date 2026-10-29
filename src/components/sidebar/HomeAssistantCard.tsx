import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Check, Loader2 } from 'lucide-react';
import { DEFAULT_NABU_URL, getHaCredentials, saveHaCredentials, testHaConnection } from '../../utils/haClient';
import { homeAssistantApi } from '../../api';
import { IS_NATIVE, IS_STATIC } from '../../utils/env';
import { addSystemLog } from '../../utils/logService';

interface Entity {
  entity_id: string;
  name: string;
}

const inputCls = 'w-full px-2.5 py-2 rounded-lg border text-xs outline-none';
const inputStyle: React.CSSProperties = { backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' };
const label = 'text-[11px] font-bold block mb-1';

/** Home Assistant: Adresse, Token, Kamera und Steckdose. Mehr braucht die App nicht. */
export const HomeAssistantCard: React.FC<{ onSaved?: () => void }> = ({ onSaved }) => {
  const creds = getHaCredentials();
  const [url, setUrl] = useState(creds.url || DEFAULT_NABU_URL);
  const [token, setToken] = useState(creds.token);
  const [camera, setCamera] = useState(creds.cameraEntity);
  const [plug, setPlug] = useState(creds.switchEntity);
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [cameras, setCameras] = useState<Entity[]>([]);
  const [switches, setSwitches] = useState<Entity[]>([]);

  // Lokaler Server (nur Browser mit Server): gespeicherte Adresse übernehmen
  useEffect(() => {
    if (IS_NATIVE || IS_STATIC || getHaCredentials().token) return;
    homeAssistantApi
      .getConfig()
      .then(res => {
        const data = res.ok && res.isJson ? res.data : null;
        if (data?.haUrl && !String(data.haUrl).includes('xxxxxxxxxxxx')) setUrl(String(data.haUrl));
      })
      .catch(() => {});
  }, []);

  const save = () => {
    saveHaCredentials({ url: url.trim(), token: token.trim(), cameraEntity: camera.trim(), switchEntity: plug.trim() });
    addSystemLog('system', 'Home Assistant gespeichert', url.trim(), 'success');
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    onSaved?.();
  };

  const test = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await testHaConnection(url.trim(), token.trim());
      setResult({ ok: r.success, text: r.message });
      if (r.success) {
        setCameras((r.cameras as Entity[]) || []);
        setSwitches((r.switches as Entity[]) || []);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className={label} style={{ color: 'var(--app-text)' }}>
          Adresse
        </label>
        <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…ui.nabu.casa" className={inputCls} style={inputStyle} autoComplete="off" />
      </div>
      <div>
        <label className={label} style={{ color: 'var(--app-text)' }}>
          Langzeit-Zugriffstoken
        </label>
        <div className="relative">
          <input
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="In Home Assistant: Profil → Sicherheit → Token erstellen"
            className={`${inputCls} pr-9`}
            style={inputStyle}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowToken(v => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
            style={{ color: 'var(--app-text-muted)' }}
            aria-label={showToken ? 'Token verbergen' : 'Token anzeigen'}
          >
            {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={label} style={{ color: 'var(--app-text)' }}>
            Kamera
          </label>
          {cameras.length > 0 ? (
            <select value={camera} onChange={e => setCamera(e.target.value)} className={inputCls} style={inputStyle}>
              {!cameras.some(c => c.entity_id === camera) && <option value={camera}>{camera}</option>}
              {cameras.map(c => (
                <option key={c.entity_id} value={c.entity_id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <input value={camera} onChange={e => setCamera(e.target.value)} className={`${inputCls} font-mono`} style={inputStyle} autoComplete="off" />
          )}
        </div>
        <div>
          <label className={label} style={{ color: 'var(--app-text)' }}>
            Steckdose
          </label>
          {switches.length > 0 ? (
            <select value={plug} onChange={e => setPlug(e.target.value)} className={inputCls} style={inputStyle}>
              {!switches.some(c => c.entity_id === plug) && <option value={plug}>{plug}</option>}
              {switches.map(c => (
                <option key={c.entity_id} value={c.entity_id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <input value={plug} onChange={e => setPlug(e.target.value)} className={`${inputCls} font-mono`} style={inputStyle} autoComplete="off" />
          )}
        </div>
      </div>
      <p className="text-[10px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
        Nach „Testen“ kannst du Kamera und Steckdose aus einer Liste wählen.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={test}
          disabled={busy || !url.trim() || !token.trim()}
          className="flex-1 py-2 rounded-xl border text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
          style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Testen
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!url.trim() || !token.trim()}
          className="flex-1 py-2 rounded-xl text-white text-xs font-extrabold cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
          style={{ backgroundColor: 'var(--app-accent)' }}
        >
          {saved ? <Check className="w-3.5 h-3.5" /> : null}
          {saved ? 'Gespeichert' : 'Speichern'}
        </button>
      </div>
      {result && <p className={`text-[11px] font-bold leading-snug break-words ${result.ok ? 'text-emerald-400' : 'text-amber-400'}`}>{result.text}</p>}
    </div>
  );
};
