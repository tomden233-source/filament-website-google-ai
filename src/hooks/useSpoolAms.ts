import { useEffect, useState } from 'react';

// AMS-Platz und laufende Trocknung einer Spule (aus dem Gerätespeicher, wird alle 15 s und bei Änderung neu gelesen)

export interface SpoolAmsInfo {
  slot: number | null;
  isDrying: boolean;
  dryTemp: number;
  remainingTime: string | null;
}

function readInfo(spoolId: string): SpoolAmsInfo {
  try {
    const slotsRaw = localStorage.getItem('filamenthub_ams_slots_x2d');
    const slots: Record<string, string> = slotsRaw ? JSON.parse(slotsRaw) : {};
    let slot: number | null = null;
    for (const [k, v] of Object.entries(slots)) {
      if (v === spoolId) {
        slot = parseInt(k, 10);
        break;
      }
    }
    let isDrying = false;
    let dryTemp = 50;
    let remainingTime: string | null = null;
    const dryRaw = localStorage.getItem('filamenthub_ams_drying_state');
    if (dryRaw && slot !== null) {
      const p = JSON.parse(dryRaw);
      if (p && p.isDrying) {
        const totalMs = (p.durationHours || 4) * 3600 * 1000;
        const elapsed = Date.now() - (p.startTimestamp || 0);
        if (elapsed < totalMs) {
          isDrying = true;
          dryTemp = p.targetTemp || 50;
          const rem = totalMs - elapsed;
          remainingTime = `${Math.floor(rem / 3600000)}h ${Math.floor((rem % 3600000) / 60000)}m`;
        }
      }
    }
    return { slot, isDrying, dryTemp, remainingTime };
  } catch {
    return { slot: null, isDrying: false, dryTemp: 50, remainingTime: null };
  }
}

export function useSpoolAms(spoolId: string): SpoolAmsInfo {
  const [info, setInfo] = useState<SpoolAmsInfo>(() => readInfo(spoolId));
  useEffect(() => {
    const update = () => setInfo(prev => {
      const next = readInfo(spoolId);
      return prev.slot === next.slot && prev.isDrying === next.isDrying && prev.remainingTime === next.remainingTime && prev.dryTemp === next.dryTemp ? prev : next;
    });
    update();
    window.addEventListener('filamenthub_drying_update', update);
    const t = setInterval(update, 15000);
    return () => {
      window.removeEventListener('filamenthub_drying_update', update);
      clearInterval(t);
    };
  }, [spoolId]);
  return info;
}
