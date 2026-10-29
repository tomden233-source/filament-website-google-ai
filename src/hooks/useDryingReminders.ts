import { useEffect, useRef } from 'react';
import type { Spool } from '../types/filament';
import { getDryingStatus } from '../utils/shopLinks';
import { safeStorage } from '../utils/safeStorage';
import { raiseAlert } from '../utils/alerts';
import { getHumidityInfo } from '../utils/materialInfo';
import { useWorkshopSettings } from '../utils/workshopSettings';

// Erinnert an fällige Trocknung (höchstens einmal pro Tag und Spule) und meldet, wenn die AMS-Trocknung fertig ist.

const DUE_KEY = 'filamenthub_dry_due_notified';
const DONE_KEY = 'filamenthub_dry_done_notified';
const AMS_STATE_KEY = 'filamenthub_ams_drying_state';
const AMS_SLOTS_KEY = 'filamenthub_ams_slots_x2d';

interface Params {
  spools: Spool[];
  showToast: (text: string) => void;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useDryingReminders({ spools, showToast }: Params) {
  const [settings] = useWorkshopSettings();
  const latest = useRef({ spools, showToast });
  latest.current = { spools, showToast };

  useEffect(() => {
    if (!settings.alertDryDue && !settings.alertDryDone) return;

    const check = () => {
      const { spools: list, showToast: toast } = latest.current;

      // 1) Trocknen fällig
      let notified: Record<string, string> = {};
      try {
        notified = JSON.parse(safeStorage.getItem(DUE_KEY) || '{}') || {};
      } catch {
        notified = {};
      }
      const today = todayKey();
      const due = settings.alertDryDue ? list.filter(s => getDryingStatus(s).statusLevel === 'overdue' && notified[s.id] !== today) : [];
      if (due.length > 0) {
        due.forEach(s => {
          notified[s.id] = today;
        });
        safeStorage.setItem(DUE_KEY, JSON.stringify(notified));
        let text: string;
        if (due.length === 1) {
          const s = due[0];
          text = `Trocknen fällig: ${s.brand} ${s.name} (${s.dryTemp} °C, ${s.dryHours} h). ${getHumidityInfo(s.material).tip}`;
        } else {
          const names = due
            .slice(0, 3)
            .map(s => `${s.brand} ${s.name}`)
            .join(', ');
          text = `${due.length} Spulen müssen getrocknet werden: ${names}${due.length > 3 ? ` und ${due.length - 3} weitere` : ''}.`;
        }
        void raiseAlert(
          {
            kind: 'dry-due',
            title: 'Trocknen fällig',
            text,
            toast: `☀️ ${text}`,
            items: due.map(s => ({
              title: `${s.brand} ${s.name}`,
              sub: `${s.material} · ${s.dryTemp} °C · ${s.dryHours} h · ${getHumidityInfo(s.material).tip}`,
              color: s.colorHex
            }))
          },
          toast
        );
      }

      // 2) AMS-Trocknung fertig
      try {
        const raw = safeStorage.getItem(AMS_STATE_KEY);
        if (raw) {
          const st = JSON.parse(raw);
          const start = Number(st?.startTimestamp) || 0;
          const hours = Number(st?.durationHours) || 0;
          if (settings.alertDryDone && st?.isDrying && start > 0 && hours > 0 && Date.now() >= start + hours * 3600000) {
            if (safeStorage.getItem(DONE_KEY) !== String(start)) {
              safeStorage.setItem(DONE_KEY, String(start));
              const temp = Number(st?.targetTemp) || 50;
              let dried: Spool[] = [];
              const slotOf: Record<string, string> = {};
              try {
                const slots: Record<string, string> = JSON.parse(safeStorage.getItem(AMS_SLOTS_KEY) || '{}');
                Object.entries(slots).forEach(([slot, id]) => {
                  const sp = list.find(x => x.id === id);
                  if (sp) {
                    dried.push(sp);
                    slotOf[sp.id] = slot;
                  }
                });
              } catch {
                dried = [];
              }
              const text = `AMS-Trocknung fertig (${hours} h bei ${temp} °C).${dried.length ? ` Im AMS: ${dried.map(x => x.name).join(', ')}.` : ''}`;
              void raiseAlert(
                {
                  kind: 'dry-done',
                  title: 'Trocknung fertig',
                  text,
                  toast: `✅ ${text}`,
                  facts: [
                    { label: 'Dauer', value: `${hours} h` },
                    { label: 'Temperatur', value: `${temp} °C` },
                    { label: 'Fertig seit', value: new Date(start + hours * 3600000).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' Uhr' }
                  ],
                  items: dried.map(x => ({ title: `${x.brand} ${x.name}`, sub: `Slot ${slotOf[x.id]} · ${x.material}`, color: x.colorHex }))
                },
                toast
              );
            }
          }
        }
      } catch {
        // kaputter Trocknungsstand: ignorieren
      }
    };

    const first = setTimeout(check, 5000);
    const interval = setInterval(check, 60000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [settings.alertDryDue, settings.alertDryDone]);
}
