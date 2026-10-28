import React, { useState } from 'react';
import { GCodeAnalysis } from '../../types/filament';
import { printerApi } from '../../api';
import { addSystemLog } from '../../utils/logService';
import { parseGCodeContent } from '../../utils/gcodeParser';
import type { SidebarProps as ParentProps } from '../Sidebar';

export interface useGcodeImportParams {
  setCalcGrams: any;
  setCalcPrintHours: any;
  setHaActionToast: any;
  spools: ParentProps['spools'];
  setCalcSpoolId: any;
  setCalcPricePerKg: any;
  setActiveTab: any;
}

export function useGcodeImport({ setCalcGrams, setCalcPrintHours, setHaActionToast, spools, setCalcSpoolId, setCalcPricePerKg, setActiveTab }: useGcodeImportParams) {
  const [gcodeData, setGcodeData] = useState<GCodeAnalysis | null>(null);

  const [printerFetchLoading, setPrinterFetchLoading] = useState<boolean>(false);

  const handlePullGcodeFromPrinter = async () => {
    setPrinterFetchLoading(true);
    try {
      const res = await printerApi.bambuStatus();
      const data = res.data;
      if (data && data.success) {
        const fileName = data.printName || data.subtask_name || 'FilamentHub_X2D.gcode';
        const weightGrams = data.printGrams || 42;
        const timeHours = data.totalSeconds ? Number((data.totalSeconds / 3600).toFixed(1)) : 2.5;
        setGcodeData({
          fileName,
          weightGrams,
          timeHours,
          material: 'PLA'
        });
        setCalcGrams(weightGrams);
        setCalcPrintHours(timeHours);
        setHaActionToast(`G-Code "${fileName}" (${weightGrams}g) vom X2D geladen!`);
        addSystemLog('drucker', `G-Code "${fileName}" (${weightGrams}g, ${timeHours}h) vom X2D in Rechner übernommen`, 'Auto-Sync', 'info');
      }
    } catch {
      setHaActionToast('Konnte Druckdatei nicht vom X2D abrufen.');
    } finally {
      setPrinterFetchLoading(false);
    }
  };

  const handleGcodeFileChange = (e: React.ChangeEvent<HTMLInputElement>, forCalc = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = (ev.target?.result as string) || '';
      const parsed = parseGCodeContent(text, file.name);
      setGcodeData(parsed);

      setCalcGrams(parsed.weightGrams);
      setCalcPrintHours(parsed.timeHours);

      const matched = spools.find(s => s.material.toUpperCase() === parsed.material.toUpperCase());
      if (matched) {
        setCalcSpoolId(matched.id);
        setCalcPricePerKg(matched.pricePerKg);
      }

      if (!forCalc) {
        setActiveTab('gcode');
      }
    };
    reader.readAsText(file);
  };

  return { handlePullGcodeFromPrinter, printerFetchLoading, handleGcodeFileChange, gcodeData };
}
