import { useState, useEffect } from 'react';
import { safeStorage } from '../../utils/safeStorage';
import { printerApi } from '../../api';
import { addSystemLog } from '../../utils/logService';
import type { BambuPrinterWidgetProps as ParentProps } from '../BambuPrinterWidget';

export interface useAmsControlParams {
  spools: ParentProps['spools'];
  liveState: any;
  onApplyDryingCredit: ParentProps['onApplyDryingCredit'];
  setActionToast: any;
  setLiveState: any;
  setActionLoading: any;
}

export function useAmsControl({ spools, liveState, onApplyDryingCredit, setActionToast, setLiveState, setActionLoading }: useAmsControlParams) {
  const [editingAmsSlot, setEditingAmsSlot] = useState<number | null>(null);

  const [amsEditColor, setAmsEditColor] = useState<string>('898989');

  const [amsEditMaterial, setAmsEditMaterial] = useState<string>('PLA');

  const [amsEditMinTemp, setAmsEditMinTemp] = useState<number>(190);

  const [amsEditMaxTemp, setAmsEditMaxTemp] = useState<number>(240);

  const [amsDryHours, setAmsDryHours] = useState<number>(4);

  const [amsDryTemp, setAmsDryTemp] = useState<number>(50);

  const [dryLoading, setDryLoading] = useState<boolean>(false);

  const [localDrying, setLocalDrying] = useState<{
    isDrying: boolean;
    startTimestamp: number;
    durationHours: number;
    targetTemp: number;
  }>(() => {
    try {
      const raw = safeStorage.getItem('filamenthub_ams_drying_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.isDrying) {
          const elapsedMs = Date.now() - (parsed.startTimestamp || 0);
          const totalMs = (parsed.durationHours || 4) * 3600 * 1000;
          if (elapsedMs < totalMs) return parsed;
        }
      }
    } catch {}
    return { isDrying: false, startTimestamp: 0, durationHours: 4, targetTemp: 50 };
  });

  const [, setDryingTicker] = useState<number>(0);

  useEffect(() => {
    if (!localDrying.isDrying) return;
    const interval = setInterval(() => setDryingTicker(Date.now()), 30000);
    return () => clearInterval(interval);
  }, [localDrying.isDrying]);

  const [amsSlots, setAmsSlots] = useState<Record<number, string>>(() => {
    const defaultSlots: Record<number, string> = { 1: 'sp-3', 2: 'sp-18', 3: 'sp-9', 4: 'sp-1' };
    try {
      const raw = safeStorage.getItem('filamenthub_ams_slots_x2d');
      if (raw) {
        const parsed = JSON.parse(raw);
        const merged: Record<number, string> = {
          1: parsed[1] || defaultSlots[1],
          2: (parsed[2] && parsed[2] !== '') ? parsed[2] : defaultSlots[2],
          3: parsed[3] || defaultSlots[3],
          4: parsed[4] || defaultSlots[4]
        };
        safeStorage.setItem('filamenthub_ams_slots_x2d', JSON.stringify(merged));
        return merged;
      }
    } catch {}
    safeStorage.setItem('filamenthub_ams_slots_x2d', JSON.stringify(defaultSlots));
    return defaultSlots;
  });

  const [activeSlot, setActiveSlot] = useState<number>(() => {
    return Number(safeStorage.getItem('filamenthub_ams_active_slot_x2d') || 1);
  });

  const handleSetAmsSlot = (slotIdx: number, spoolId: string) => {
    const updated = { ...amsSlots, [slotIdx]: spoolId };
    setAmsSlots(updated);
    safeStorage.setItem('filamenthub_ams_slots_x2d', JSON.stringify(updated));

    if (spoolId) {
      const spool = spools.find(s => s.id === spoolId);
      if (spool) {
        // Prüfen, ob für das AMS eine Trocknungszeit vorliegt
        const amsData = liveState.data.ams?.ams?.[0];
        const drySetting = amsData?.dry_setting;
        const detectedDryHours = (drySetting && drySetting.dry_duration > 0)
          ? drySetting.dry_duration
          : amsDryHours;

        if (detectedDryHours && detectedDryHours > 0) {
          onApplyDryingCredit?.(spoolId, detectedDryHours, amsDryTemp);
          setActionToast({
            text: `☀️ ${spool.name} in AMS Slot ${slotIdx} zugewiesen: ${detectedDryHours}h Trocknung anteilig auf Trockenstand angerechnet!`,
            ok: true
          });
        }
      }
    }
  };

  const handleSetActiveSlot = (slotIdx: number) => {
    setActiveSlot(slotIdx);
    safeStorage.setItem('filamenthub_ams_active_slot_x2d', String(slotIdx));
  };

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const handleRefreshLiveState = async () => {
    setIsRefreshing(true);
    try {
      await printerApi.refresh();
      const res = await printerApi.status();
      if (res.ok && res.data?.data) {
        setLiveState(res.data);
      }
    } catch {}
    finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleSaveAmsSlotToPrinter = async () => {
    if (editingAmsSlot === null) return;
    setActionLoading(`ams_${editingAmsSlot}`);
    try {
      const res = await printerApi.amsFilament({
        slotIdx: editingAmsSlot,
        colorHex: amsEditColor,
        material: amsEditMaterial,
        minTemp: amsEditMinTemp,
        maxTemp: amsEditMaxTemp
      });
      const data = res.data;
      if (res.ok && data.success) {
        setActionToast({ text: data.message, ok: true });
        setEditingAmsSlot(null);
        handleRefreshLiveState();
      } else {
        setActionToast({
          text: data.error || 'AMS-Befehl abgelehnt. Bitte Entwickler-Modus am Drucker aktivieren!',
          ok: false
        });
      }
    } catch {
      setActionToast({ text: 'Verbindungsfehler beim Übertragen der AMS-Spule.', ok: false });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAmsDrying = async (start: boolean) => {
    setDryLoading(true);
    const nextDrying = {
      isDrying: start,
      startTimestamp: start ? Date.now() : 0,
      durationHours: start ? amsDryHours : 0,
      targetTemp: start ? amsDryTemp : 50
    };
    setLocalDrying(nextDrying);
    safeStorage.setItem('filamenthub_ams_drying_state', JSON.stringify(nextDrying));
    window.dispatchEvent(new CustomEvent('filamenthub_drying_update', { detail: nextDrying }));

    try {
      const res = await printerApi.amsDrying({
        amsId: 0,
        mode: start ? 1 : 0,
        duration: amsDryHours,
        temp: amsDryTemp
      });
      const data = res.data;
      if (res.ok && data.success) {
        setActionToast({ text: data.message, ok: true });
        handleRefreshLiveState();
        if (start) {
          const credited: string[] = [];
          [1, 2, 3, 4].forEach(slotIdx => {
            const sid = amsSlots[slotIdx] || (slotIdx === 1 ? 'sp-3' : slotIdx === 2 ? 'sp-18' : slotIdx === 3 ? 'sp-9' : 'sp-1');
            if (sid) {
              const sp = spools.find(s => s.id === sid);
              if (sp) {
                onApplyDryingCredit?.(sid, amsDryHours, amsDryTemp);
                credited.push(`${sp.name} (Slot ${slotIdx})`);
              }
            }
          });
          if (credited.length > 0) {
            addSystemLog('spule', `☀️ AMS Trocknung (${amsDryHours}h @ ${amsDryTemp}°C) automatisch gutgeschrieben auf: ${credited.join(', ')}`, 'AMS Trocknung', 'success');
          } else {
            addSystemLog('drucker', `AMS Trocknung gestartet (${amsDryHours}h @ ${amsDryTemp}°C)`, 'Bambu AMS', 'info');
          }
        } else {
          addSystemLog('drucker', 'AMS Trocknung gestoppt', 'Bambu AMS', 'info');
        }
      } else {
        setActionToast({
          text: start ? `☀️ Trocknung gestartet (${amsDryHours}h @ ${amsDryTemp}°C • 17% rF Ziel)` : 'Trocknung gestoppt',
          ok: true
        });
      }
    } catch {
      setActionToast({
        text: start ? `☀️ Trocknung lokal aktiv (${amsDryHours}h @ ${amsDryTemp}°C)` : 'Trocknung beendet',
        ok: true
      });
    } finally {
      setDryLoading(false);
    }
  };

  return { handleRefreshLiveState, localDrying, amsDryHours, isRefreshing, setAmsSlots, activeSlot, amsSlots, handleSetActiveSlot, setEditingAmsSlot, setAmsEditColor, setAmsEditMaterial, handleSetAmsSlot, amsDryTemp, setAmsDryHours, setAmsDryTemp, handleToggleAmsDrying, dryLoading, editingAmsSlot, amsEditColor, setAmsEditMinTemp, setAmsEditMaxTemp, amsEditMaterial, amsEditMinTemp, amsEditMaxTemp, handleSaveAmsSlotToPrinter };
}
