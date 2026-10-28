import React, { useState } from 'react';
import { Printer, Home, Cloud, CheckCircle2, Circle, ChevronDown, ChevronUp, Info, Settings2 } from 'lucide-react';
import { safeStorage } from '../../utils/safeStorage';
import { IS_STATIC } from '../../utils/env';

export interface SettingsConnectionsPanelProps {
  /** Bereits vorhandenes Home-Assistant-Panel (URL, Token, Sensoren) */
  haPanel: React.ReactNode;
  /** Gespeicherte Home-Assistant-URL (leer = nicht eingerichtet) */
  haUrl: string;
  /** Öffnet das Bambu-Lab-Verbindungsfenster */
  onOpenBambu: () => void;
  /** Wechselt zum Tab „Handy & App“ */
  onOpenApp: () => void;
  cloudDbUrl: string;
}

const card: React.CSSProperties = { backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' };
const muted: React.CSSProperties = { color: 'var(--app-text-muted)' };

const Status: React.FC<{ ok: boolean; okText: string; noText: string }> = ({ ok, okText, noText }) => (
  <span
    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
      ok
        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
        : 'bg-slate-500/10 border-slate-500/30'
    }`}
    style={ok ? undefined : muted}
  >
    {ok ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
    {ok ? okText : noText}
  </span>
);

const Steps: React.FC<{ items: string[] }> = ({ items }) => (
  <ol className="space-y-1.5 text-[11px] leading-relaxed" style={muted}>
    {items.map((t, i) => (
      <li key={i} className="flex gap-2">
        <span
          className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[9px] font-extrabold text-white"
          style={{ backgroundColor: 'var(--app-accent)' }}
        >
          {i + 1}
        </span>
        <span>{t}</span>
      </li>
    ))}
  </ol>
);

export const SettingsConnectionsPanel: React.FC<SettingsConnectionsPanelProps> = ({
  haPanel,
  haUrl,
  onOpenBambu,
  onOpenApp,
  cloudDbUrl
}) => {
  const [haOpen, setHaOpen] = useState(true);
  const bambuOk = !!safeStorage.getItem('bambu_access_token');
  const haOk = !!haUrl?.trim();

  return (
    <div className="space-y-3.5">
      {/* Einleitung */}
      <div className="rounded-2xl border p-3.5 flex gap-2.5" style={card}>
        <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--app-accent)' }} />
        <p className="text-[11px] leading-relaxed" style={muted}>
          Hier verbindest du FilamentHub mit deinen Geräten. Alle Angaben sind freiwillig und werden nur auf diesem
          Gerät gespeichert. Ohne Verbindung funktioniert die Filament-Verwaltung ganz normal.
        </p>
      </div>

      {IS_STATIC && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-300">
          <strong>Hinweis:</strong> Du nutzt die Web-/App-Version ohne eigenen Server. Home Assistant geht direkt aus
          dem Browser. Live-Daten vom Bambu-Drucker brauchen einen lokal laufenden Server (<code>npm run dev</code>).
        </div>
      )}

      {/* 1. Bambu Lab */}
      <section className="rounded-2xl border p-4 space-y-3" style={card}>
        <header className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Printer className="w-4.5 h-4.5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm" style={{ color: 'var(--app-text)' }}>
                Bambu Lab Drucker
              </h4>
              <p className="text-[10px]" style={muted}>Live-Status, AMS, Temperaturen, Steuerung</p>
            </div>
          </div>
          <Status ok={bambuOk} okText="Eingerichtet" noText="Nicht verbunden" />
        </header>

        <p className="text-[11px] leading-relaxed" style={muted}>
          Verbindet die App über die Bambu Cloud mit deinem Drucker. Du brauchst deinen <strong>Access-Token</strong>,
          die <strong>Seriennummer</strong> (steht am Drucker unter Einstellungen → Gerät) und optional eine
          <strong> PIN</strong> für Stopp-Befehle.
        </p>
        <Steps
          items={[
            'Auf „Verbindung einrichten“ tippen.',
            'Token einfügen oder per E-Mail-Login holen – die User-ID wird automatisch erkannt.',
            'Seriennummer eintragen und „Verbinden“ drücken.'
          ]}
        />
        <button
          type="button"
          onClick={onOpenBambu}
          className="w-full py-2.5 rounded-xl text-white font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer hover:opacity-90 active:scale-[0.99] transition"
          style={{ backgroundColor: 'var(--app-accent)' }}
        >
          <Settings2 className="w-4 h-4" />
          {bambuOk ? 'Verbindung ändern' : 'Verbindung einrichten'}
        </button>
      </section>

      {/* 2. Home Assistant */}
      <section className="rounded-2xl border p-4 space-y-3" style={card}>
        <header className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Home className="w-4.5 h-4.5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm" style={{ color: 'var(--app-text)' }}>
                Home Assistant
              </h4>
              <p className="text-[10px]" style={muted}>Steckdose, Licht, Kamera, Sensoren</p>
            </div>
          </div>
          <Status ok={haOk} okText="Eingerichtet" noText="Nicht verbunden" />
        </header>

        <p className="text-[11px] leading-relaxed" style={muted}>
          Zeigt Sensoren deines Druckers an und schaltet Steckdose oder Licht. Du brauchst die
          <strong> Adresse</strong> deines Home Assistant (z. B. Nabu-Casa-Link) und einen
          <strong> Langzeit-Zugriffstoken</strong>.
        </p>
        <Steps
          items={[
            'In Home Assistant: Profil (links unten) → Sicherheit → „Langlebige Zugriffstoken“ → Token erstellen.',
            'Unten die Adresse (https://…ui.nabu.casa) und den Token eintragen.',
            '„Speichern“ und „Verbindung testen“ drücken.'
          ]}
        />
        <button
          type="button"
          onClick={() => setHaOpen(o => !o)}
          className="w-full py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
        >
          {haOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {haOpen ? 'Einstellungen ausblenden' : 'Einstellungen anzeigen'}
        </button>
        {haOpen && <div>{haPanel}</div>}
      </section>

      {/* 3. Sync & Handy */}
      <section className="rounded-2xl border p-4 space-y-3" style={card}>
        <header className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Cloud className="w-4.5 h-4.5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm" style={{ color: 'var(--app-text)' }}>
                Handy & Cloud-Sync
              </h4>
              <p className="text-[10px]" style={muted}>Daten zwischen Geräten abgleichen</p>
            </div>
          </div>
          <Status ok={!!cloudDbUrl} okText="Aktiv" noText="Aus" />
        </header>
        <p className="text-[11px] leading-relaxed" style={muted}>
          Installiere die App auf dem Handy (QR-Code) und gleiche deine Spulen automatisch ab. Der Sync-Link wird beim
          Koppeln per QR-Code übertragen.
        </p>
        <button
          type="button"
          onClick={onOpenApp}
          className="w-full py-2 rounded-xl border text-xs font-bold cursor-pointer"
          style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
        >
          📱 Zur App & QR-Code
        </button>
      </section>
    </div>
  );
};
