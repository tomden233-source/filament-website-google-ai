import React from 'react';
import type { NfcWriteFormat } from '../../utils/nfcManager';

export interface NfcFormatPickerProps {
  writeFormat: NfcWriteFormat;
  setWriteFormat: (format: NfcWriteFormat) => void;
}

const OPTIONS: { id: NfcWriteFormat; title: string; hint: string }[] = [
  { id: 'filamenthub', title: 'FilamentHub', hint: 'Eigenes Format, nur diese App' },
  { id: 'opentag3d', title: 'OpenTag3D', hint: 'Offener Standard, auch andere Programme lesen es' }
];

/** Auswahl des Tag-Formats beim Schreiben */
export const NfcFormatPicker: React.FC<NfcFormatPickerProps> = ({ writeFormat, setWriteFormat }) => {
  return (
    <div className="space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tag-Format</span>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map(opt => {
          const active = writeFormat === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setWriteFormat(opt.id)}
              className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                active ? 'bg-orange-500/15 border-orange-500/60' : 'bg-slate-900 border-slate-800 hover:border-slate-600'
              }`}
            >
              <span className={`block text-[11px] font-extrabold ${active ? 'text-orange-400' : 'text-white'}`}>{opt.title}</span>
              <span className="block text-[10px] text-slate-400">{opt.hint}</span>
            </button>
          );
        })}
      </div>
      {writeFormat === 'opentag3d' && (
        <p className="text-[10px] text-slate-400">
          OpenTag3D braucht mindestens einen NTAG215-Tag. Temperaturen und Dichte sind typische Werte des Materials.
        </p>
      )}
    </div>
  );
};
