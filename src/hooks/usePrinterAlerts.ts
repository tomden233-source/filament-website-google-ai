import { useEffect, useRef } from 'react';
import type { Spool } from '../types/filament';
import { raiseAlert } from '../utils/alerts';
import { safeStorage } from '../utils/safeStorage';
import { useWorkshopSettings } from '../utils/workshopSettings';

// Mitteilungen, wenn der Drucker selbst etwas Wichtiges meldet:
//  - AMS-Trocknung fertig oder gestoppt (Restzeit dry_time geht von >0 auf 0)
// Nur echte Wechsel nach dem ersten Datenpaket zählen, damit beim App-Start keine alte Meldung kommt.

interface Params {
  connected: boolean;
  dryMinutesLeft: number;
  spools?: Spool[];
  showToast: (text: string) => void;
}

const AMS_SLOTS_KEY = 'filamenthub_ams_slots_x2d';

const nowText = () => new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' Uhr';

export function usePrinterAlerts({ connected, dryMinutesLeft, spools, showToast }: Params) {
  const [settings] = useWorkshopSettings();
  const prevDry = useRef<number | null>(null);
  const latest = useRef({ spools, showToast });
  latest.current = { spools, showToast };

  // Druck gestartet / fertig / fehlgeschlagen: siehe usePrintWatch + utils/printAlerts (klappt auch, wenn die App zu war)

  // Trocknung: Restzeit geht auf 0. War sie kurz vor dem Ende, ist sie fertig, sonst wurde sie gestoppt.
  // Erst nach 20 s melden (kurze Aussetzer in den Daten des Druckers sollen keine falsche Meldung auslösen).
  const dryNow = useRef(dryMinutesLeft);
  dryNow.current = dryMinutesLeft;
  const lastDry = useRef<{ minutes: number; at: number } | null>(null);
  const dryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!connected) {
      if (dryTimer.current) clearTimeout(dryTimer.current);
      dryTimer.current = null;
      prevDry.current = null;
      return;
    }
    prevDry.current = dryMinutesLeft;
    if (dryMinutesLeft > 0) {
      if (dryTimer.current) clearTimeout(dryTimer.current);
      dryTimer.current = null;
      const prevPeak = lastDry.current;
      lastDry.current = { minutes: dryMinutesLeft, at: prevPeak?.at ?? Date.now() };
      return;
    }
    if (!lastDry.current || dryTimer.current) return;
    dryTimer.current = setTimeout(() => {
      dryTimer.current = null;
      const last = lastDry.current;
      if (!last || dryNow.current > 0) return;
      lastDry.current = null;

      const dried: { title: string; sub: string; color?: string }[] = [];
      try {
        const slots: Record<string, string> = JSON.parse(safeStorage.getItem(AMS_SLOTS_KEY) || '{}');
        Object.entries(slots).forEach(([slot, id]) => {
          const sp = latest.current.spools?.find(x => x.id === id);
          if (sp) dried.push({ title: `${sp.brand} ${sp.name}`, sub: `Slot ${slot} · ${sp.material}`, color: sp.colorHex });
        });
      } catch {
        /* keine Zuordnung */
      }
      const ranMin = Math.max(1, Math.round((Date.now() - last.at) / 60000));
      const fmt = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);

      if (last.minutes <= 5) {
        const text = 'Die AMS-Trocknung ist fertig. Filament kann entnommen oder gedruckt werden.';
        void raiseAlert(
          { kind: 'dry-done', title: 'Trocknung fertig', text, toast: `✅ ${text}`, facts: [{ label: 'Fertig seit', value: nowText() }], items: dried },
          latest.current.showToast
        );
      } else {
        // Die zeitgesteuerte Fertig-Meldung der App soll für diesen Lauf nicht mehr kommen
        try {
          const st = JSON.parse(safeStorage.getItem('filamenthub_ams_drying_state') || 'null');
          if (st?.startTimestamp) safeStorage.setItem('filamenthub_dry_done_notified', String(st.startTimestamp));
        } catch {
          /* egal */
        }
        const text = `Die AMS-Trocknung wurde gestoppt. Es fehlten noch ${fmt(last.minutes)}.`;
        void raiseAlert(
          {
            kind: 'dry-stop',
            title: 'Trocknung gestoppt',
            text,
            toast: `⏹️ ${text}`,
            facts: [
              { label: 'Gestoppt', value: nowText() },
              { label: 'Es fehlten noch', value: fmt(last.minutes) },
              { label: 'Gesehen seit', value: fmt(ranMin) }
            ],
            items: dried
          },
          latest.current.showToast
        );
      }
    }, 20000);
  }, [connected, dryMinutesLeft]);

  useEffect(
    () => () => {
      if (dryTimer.current) clearTimeout(dryTimer.current);
    },
    []
  );

  // Einstellungen werden in raiseAlert geprüft; hier nur, damit der Hook bei Änderungen neu rendert
  void settings;
}
