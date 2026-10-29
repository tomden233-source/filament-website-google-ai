import React, { useState } from 'react';
import { Pencil, Trash2, Tag, Sun, ShoppingCart, ChevronDown, Minus, Plus } from 'lucide-react';
import type { AppSettings, Spool } from '../types/filament';
import { getDryingStatus, getSpoolLink } from '../utils/shopLinks';
import { useSpoolAms } from '../hooks/useSpoolAms';
import { SpoolBadges } from './workshop/SpoolBadges';
import { isLowSpool } from '../utils/spoolAlerts';
import { useWorkshopSettings } from '../utils/workshopSettings';
import { LabelPrintButton } from './LabelPrintButton';

// Minimalistische Spulen-Kachel: Farbe, Name, Gewicht, ein dünner Füllstand. Antippen klappt die Aktionen auf.

export interface SpoolTileProps {
  spool: Spool;
  now: number;
  appSettings?: AppSettings;
  onDeduct: (id: string, grams: number) => void;
  onAdd?: (id: string, grams: number) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onWriteNfc?: (id: string) => void;
  onMarkDried?: (id: string) => void;
}

/** Spule von oben: Farbring, Nabe in der Hintergrundfarbe */
export const SpoolDisc: React.FC<{ color: string; size?: number }> = ({ color, size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 44 44" className="shrink-0" aria-hidden="true">
    <circle cx="22" cy="22" r="21" fill={color} />
    <circle cx="22" cy="22" r="21" fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
    <circle cx="22" cy="22" r="15" fill="none" stroke="rgba(0,0,0,0.16)" strokeWidth="2.5" />
    <circle cx="22" cy="22" r="9" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" />
    <circle cx="22" cy="22" r="5.2" fill="var(--app-card)" stroke="rgba(0,0,0,0.3)" strokeWidth="1" />
  </svg>
);

const quick = [10, 25, 50, 100];

export const SpoolTile: React.FC<SpoolTileProps> = ({ spool, now, appSettings, onDeduct, onAdd, onEdit, onDelete, onWriteNfc, onMarkDried }) => {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const ams = useSpoolAms(spool.id);
  const [ws] = useWorkshopSettings();
  const low = ws.lowWarning && isLowSpool(spool, ws.lowWeightG);
  const link = getSpoolLink(spool);
  const dry = getDryingStatus(spool, now);

  const initW = Number(spool.initialWeight) || 1000;
  const remW = Number(spool.remainingWeight) || 0;
  const pct = Math.max(0, Math.min(100, Math.round((remW / initW) * 100)));
  const barColor = pct <= 15 ? '#ef4444' : pct <= 30 ? '#f59e0b' : 'var(--app-accent-bar, var(--app-accent))';
  const hex = spool.colorHex || '#94a3b8';
  void appSettings;

  const add = (g: number) => (onAdd ? onAdd(spool.id, g) : onDeduct(spool.id, -g));
  const customG = parseInt(custom, 10);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <article
      className={`rounded-2xl border transition-colors ${dry.isOverdue ? 'border-rose-500/60' : ''}`}
      style={{ backgroundColor: 'var(--app-card)', borderColor: dry.isOverdue ? undefined : 'var(--app-border)', color: 'var(--app-text)' }}
    >
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full text-left p-3.5 flex items-center gap-3 cursor-pointer" aria-expanded={open}>
        <SpoolDisc color={hex} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-bold text-[13px] leading-tight truncate">{spool.name}</span>
            <span className="font-mono-num font-extrabold text-sm shrink-0" style={{ color: pct <= 15 ? 'var(--app-danger-text)' : 'var(--app-text)' }}>
              {remW} g
            </span>
          </span>
          <span className="flex items-baseline justify-between gap-3 mt-0.5">
            <span className="text-[11px] truncate" style={{ color: 'var(--app-text-muted)' }}>
              {spool.brand} · {spool.material}
              {spool.colorName ? ` · ${spool.colorName}` : ''}
            </span>
            <span className="text-[11px] font-mono-num shrink-0" style={{ color: 'var(--app-text-muted)' }}>
              {pct} %
            </span>
          </span>
          <span className="block h-1 rounded-full overflow-hidden mt-2" style={{ backgroundColor: 'var(--app-card-sub)' }}>
            <span className="block h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--app-text-muted)' }} />
      </button>

      {(ams.slot !== null || ams.isDrying || dry.isOverdue || spool.needsDrying || low) && !open && (
        <div className="px-3.5 pb-3 -mt-1 flex flex-wrap items-center gap-1">
          {ams.slot !== null && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-[#00AE42]/20 text-[#00AE42] border border-[#00AE42]/30">AMS {ams.slot}</span>}
          {ams.isDrying && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-sky-500/20 text-sky-400 border border-sky-500/40 inline-flex items-center gap-1">
              <Sun className="w-2.5 h-2.5" />
              Trocknet {ams.remainingTime ? `(${ams.remainingTime})` : ''}
            </span>
          )}
          {(dry.isOverdue || spool.needsDrying) && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-500/15 text-rose-400 border border-rose-500/40">Trocknen fällig</span>}
          {low && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-500/15 text-amber-400 border border-amber-500/40">{remW <= 0 ? 'Leer' : 'Fast leer'}</span>}
        </div>
      )}

      {open && (
        <div className="px-3.5 pb-3.5 space-y-2.5 border-t pt-3" style={{ borderColor: 'var(--app-border)' }} onClick={stop}>
          <div className="flex flex-wrap items-center gap-1 empty:hidden">
            {ams.slot !== null && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-[#00AE42]/20 text-[#00AE42] border border-[#00AE42]/30">AMS {ams.slot}</span>}
            <SpoolBadges spool={spool} />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {quick.map(g => (
              <button key={`m${g}`} onClick={() => onDeduct(spool.id, g)} className="py-1.5 rounded-lg border text-[11px] font-mono-num font-bold cursor-pointer active:scale-95 text-rose-400 bg-rose-500/10 border-rose-500/30">
                −{g}
              </button>
            ))}
            {quick.map(g => (
              <button key={`p${g}`} onClick={() => add(g)} className="py-1.5 rounded-lg border text-[11px] font-mono-num font-bold cursor-pointer active:scale-95 text-emerald-500 bg-emerald-500/10 border-emerald-500/30">
                +{g}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              inputMode="numeric"
              placeholder="Gramm"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              className="min-w-0 flex-1 px-2.5 py-1.5 rounded-lg border text-xs font-mono-num outline-none"
              style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
            />
            <button
              disabled={!(customG > 0)}
              onClick={() => {
                onDeduct(spool.id, customG);
                setCustom('');
              }}
              className="p-2 rounded-lg border cursor-pointer disabled:opacity-40 text-rose-400 bg-rose-500/10 border-rose-500/30"
              aria-label="Gramm abziehen"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              disabled={!(customG > 0)}
              onClick={() => {
                add(customG);
                setCustom('');
              }}
              className="p-2 rounded-lg border cursor-pointer disabled:opacity-40 text-emerald-500 bg-emerald-500/10 border-emerald-500/30"
              aria-label="Gramm hinzufügen"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {onMarkDried && (
              <button onClick={() => onMarkDried(spool.id)} className="px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer flex items-center gap-1" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                Getrocknet
              </button>
            )}
            {onWriteNfc && (
              <button
                onClick={() => onWriteNfc(spool.id)}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer flex items-center gap-1 ${spool.nfcWritten ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' : 'text-rose-400 bg-rose-500/10 border-rose-500/30'}`}
                title={spool.nfcWritten ? 'NFC beschrieben (Details, Löschen)' : 'NFC noch nicht beschrieben'}
              >
                <Tag className="w-3.5 h-3.5" />
                NFC
              </button>
            )}
            <LabelPrintButton spool={spool} className="py-1.5" />
            <a href={link.url} target="_blank" rel="noopener noreferrer" title={link.label} className="px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 text-cyan-500 bg-cyan-500/10 border-cyan-500/30">
              <ShoppingCart className="w-3.5 h-3.5" />
              Shop
            </a>
            <span className="flex-1" />
            <button onClick={() => onEdit(spool.id)} className="px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer flex items-center gap-1" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>
              <Pencil className="w-3.5 h-3.5" />
              Ändern
            </button>
            <button onClick={() => onDelete(spool.id)} className="p-1.5 rounded-lg border cursor-pointer text-rose-500 bg-rose-500/10 border-rose-500/30" aria-label="Spule löschen" title="Löschen">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </article>
  );
};
