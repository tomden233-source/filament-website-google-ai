import React, { useState, useRef } from 'react';
import { printerApi } from '../../api';

export interface useGcodeUploadParams {
  setActionToast: any;
  handleRefreshLiveState: any;
}

export function useGcodeUpload({ setActionToast, handleRefreshLiveState }: useGcodeUploadParams) {
  const [showGcodeModal, setShowGcodeModal] = useState<boolean>(false);

  const [selectedGcodeFile, setSelectedGcodeFile] = useState<File | null>(null);

  const [gcodeFileInfo, setGcodeFileInfo] = useState<{
    name: string;
    sizeKb: number;
    layerCount?: number;
    estTimeMin?: number;
  } | null>(null);

  const [isUploadingGcode, setIsUploadingGcode] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGcodeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedGcodeFile(file);
    const sizeKb = Math.round(file.size / 1024);

    const reader = new FileReader();
    reader.onload = event => {
      const text = (event.target?.result as string) || '';
      const lines = text.slice(0, 15000).split('\n');
      let totalLayers = 0;
      let estMin = 0;

      for (const line of lines) {
        if (line.includes('total layer number') || line.includes('total_layer_count')) {
          const m = line.match(/\d+/);
          if (m) totalLayers = parseInt(m[0], 10);
        }
        if (line.includes('estimated printing time') || line.includes('print_time')) {
          const m = line.match(/(\d+)m/);
          if (m) estMin = parseInt(m[1], 10);
        }
      }

      setGcodeFileInfo({
        name: file.name,
        sizeKb,
        layerCount: totalLayers > 0 ? totalLayers : undefined,
        estTimeMin: estMin > 0 ? estMin : undefined
      });
    };
    reader.readAsText(file.slice(0, 25000));
  };

  const handleUploadGcode = async (startPrint: boolean) => {
    if (!selectedGcodeFile) return;

    setIsUploadingGcode(true);
    try {
      const reader = new FileReader();
      reader.onload = async event => {
        const content = event.target?.result as string;
        try {
          const res = await printerApi.uploadGcode({
            fileName: selectedGcodeFile.name,
            fileContent: content,
            startPrint
          });
          const data = res.data;
          if (res.ok && data.success) {
            setActionToast({
              text: data.message || `Datei "${selectedGcodeFile.name}" erfolgreich übertragen!`,
              ok: true
            });
            setSelectedGcodeFile(null);
            setGcodeFileInfo(null);
            setShowGcodeModal(false);
            handleRefreshLiveState();
          } else {
            setActionToast({ text: data.error || 'Fehler beim Übertragen der G-Code Datei.', ok: false });
          }
        } catch {
          setActionToast({ text: 'Verbindungsfehler beim Übertragen der Datei.', ok: false });
        }
        setIsUploadingGcode(false);
      };
      reader.readAsDataURL(selectedGcodeFile);
    } catch {
      setActionToast({ text: 'Verbindungsfehler beim Übertragen der Datei.', ok: false });
      setIsUploadingGcode(false);
    }
  };

  return { setShowGcodeModal, showGcodeModal, fileInputRef, handleGcodeFileSelect, selectedGcodeFile, gcodeFileInfo, setSelectedGcodeFile, setGcodeFileInfo, handleUploadGcode, isUploadingGcode };
}
