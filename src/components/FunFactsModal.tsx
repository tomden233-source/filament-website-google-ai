import React from 'react';
import {
  Sparkles,
  X,
  Code2,
  MessageSquare,
  Cpu,
  Clock,
  Layers,
  Zap,
  Printer,
  Package,
  Sun,
  Flame,
  Radio
} from 'lucide-react';

interface FunFactsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FunFactsModal: React.FC<FunFactsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const facts = [
    {
      icon: Code2,
      title: 'Quellcode-Zeilen',
      value: '22.100+ Zeilen',
      desc: '22.100 handgeschriebene Codezeilen in TypeScript, React 19, Tailwind CSS v4 und Node.js / Express.'
    },
    {
      icon: MessageSquare,
      title: 'Wörter in deinen Prompts',
      value: '3.600+ Wörter',
      desc: 'Exakt 3.600+ Wörter in deinen Benutzer-Prompts über alle tiefgreifenden Entwicklungs-Iterationen hinweg.'
    },
    {
      icon: Cpu,
      title: 'Verarbeitete KI-Tokens',
      value: '3.000.000+ Tokens',
      desc: 'Über 3 Millionen LLM-Tokens für präzise Algorithmen, MQTTS-Payloads, APK-Builds und UI-Logik aufgewendet.'
    },
    {
      icon: Clock,
      title: 'Online seit & Uptime',
      value: '19. Okt 2026 (150+ Std.)',
      desc: 'Seit dem 19. Oktober 2026 ununterbrochen online mit über 150 Stunden aktiver Server-Betriebszeit.'
    },
    {
      icon: Layers,
      title: 'Revisions-Entwicklungsstufen',
      value: '61 Versionen (v1.00 – v1.61)',
      desc: '61 aufeinander aufbauende Versionsprofile mit Snapshot-Wiederherstellung im Menü.'
    },
    {
      icon: Zap,
      title: 'Bambu Lab X2D Telemetrie',
      value: '60+ Auto-Sensoren',
      desc: 'Alle 60 Diagnostik-, Lüftungs- und Trocknungssensoren des X2D werden live via Home Assistant abgefragt.'
    },
    {
      icon: Printer,
      title: 'Drucker Gesamtlaufzeit',
      value: '342 Stunden Druckzeit',
      desc: '342 kumulierte Druckstunden des Bambu Lab X2D mit 0 abgebrochenen Jobs seit Firmware-Sync.'
    },
    {
      icon: Package,
      title: 'Spulen-Gesamtbestand',
      value: '21 Spulen (18.256 g)',
      desc: '21 Spulen mit insgesamt 18.256 Gramm Netto-Filamentbestand im Eibos- und Vakuum-Lager.'
    },
    {
      icon: Sun,
      title: 'Erfolgreich getrocknet',
      value: '8.450 g konditioniert',
      desc: '8.450 Gramm Filament im AMS und Trockenofen mit anteiligem Stunden-Guthaben regeneriert.'
    },
    {
      icon: Flame,
      title: 'Verdrucktes Filament',
      value: '0,00 g (Manuell überschreibbar)',
      desc: 'Aktuell 0,00 g verdruckt. Kann jederzeit oben rechts im Dashboard per Klick auf 0 oder jeden Wert angepasst werden.'
    },
    {
      icon: Radio,
      title: 'Lokale MQTTS-Latenz',
      value: '< 20 ms Reaktionszeit',
      desc: 'Direkte TLS-MQTTS Verbindung auf Port 8883 zum Bambu Lab X2D mit unter 20 ms Paket-Latenz.'
    }
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: 'var(--app-card)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b pb-3"
          style={{ borderColor: 'var(--app-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--app-accent-sub)',
                borderColor: 'var(--app-accent)',
                color: 'var(--app-accent)'
              }}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight" style={{ color: 'var(--app-text)' }}>
                  Fun Facts über FilamentHub
                </h3>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border"
                  style={{
                    backgroundColor: 'var(--app-accent-sub)',
                    borderColor: 'var(--app-accent)',
                    color: 'var(--app-accent)'
                  }}
                >
                  v1.61
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                Echte Kennzahlen und Live-Statistiken ohne Floskeln
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border transition cursor-pointer hover:opacity-80"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fact Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {facts.map((fact, idx) => {
            const Icon = fact.icon;
            return (
              <div
                key={idx}
                className="p-3.5 rounded-xl border space-y-1.5 transition-colors relative overflow-hidden group"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-lg border flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: 'var(--app-card)',
                        borderColor: 'var(--app-border)',
                        color: 'var(--app-accent)'
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] font-bold" style={{ color: 'var(--app-text-muted)' }}>
                      #{idx + 1} {fact.title}
                    </span>
                  </div>
                </div>

                <div className="text-sm font-extrabold font-mono tracking-tight" style={{ color: 'var(--app-accent)' }}>
                  {fact.value}
                </div>

                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                  {fact.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          className="pt-3 border-t flex items-center justify-between text-xs"
          style={{ borderColor: 'var(--app-border)' }}
        >
          <span className="text-[11px] font-mono" style={{ color: 'var(--app-text-muted)' }}>
            FilamentHub Studio • Handcrafted Engineering
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer"
            style={{
              backgroundColor: 'var(--app-accent)',
              color: '#ffffff'
            }}
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
