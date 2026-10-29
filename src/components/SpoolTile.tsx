import React, { useState } from 'react';
import { Pencil, Trash2, Tag, Sun, ShoppingCart, ChevronDown, Minus, Plus } from 'lucide-react';
import type { AppSettings, Spool } from '../types/filament';
import { getDryingStatus, getSpoolLink } from '../utils/shopLinks';
import { useSpoolAms } from '../hooks/useSpoolAms';
import { SpoolBadges } from './workshop/SpoolBadges';
import { isLowSpool } from '../utils/spoolAlerts';
import { useWorkshopSettings } from '../utils/workshopSettings';
import { LabelPrintButton } from './LabelPrintButton';

// Minimalistische Spulen-Kachel: Farbstreifen links, Name, großes Gewicht, 10-Segment-Füllstand. Antippen klappt die Aktionen auf.

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

/** Füllstand in 10 Segmenten: ruhig, gut lesbar, ohne Kreis */
const LevelMeter: React.FC<{ pct: number; color: string }> = ({ pct, color }) => {
  const full = Math.floor(pct / 10);
  const part = (pct % 10) / 10;
  return (
    <span className="flex gap-[3px] w-full" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => {
        const fill = i < full ? 1 : i === full ? part : 0;
        return (
          <span key={i} className="relative h-1.5 flex-1 rounded-[3px] overflow-hidden" style={{ backgroundColor: 'var(--app-card-sub)' }}>
            <span className="absolute inset-y-0 left-0" style={{ width: `${fill * 100}%`, background: color }} />
          </span>
        );
      })}
    </span>
  );
};

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
      className={`relative overflow-hidden rounded-2xl border transition-colors ${dry.isOverdue ? 'border-rose-500/60' : ''}`}
      style={{
        backgroundColor: 'var(--app-card)',
        backgroundImage: `linear-gradient(90deg, color-mix(in srgb, ${hex} 14%, transparent), transparent 38%)`,
        borderColor: dry.isOverdue ? undefined : 'var(--app-border)',
        color: 'var(--app-text)'
      }}
    >
      <span className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: hex }} aria-hidden="true" />
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full text-left pl-5 pr-3.5 py-3 flex items-center gap-3 cursor-pointer" aria-expanded={open}>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-bold text-[13px] leading-tight truncate">{spool.name}</span>
          </span>
          <span className="block text-[11px] truncate mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
            {spool.brand} · {spool.material}
            {spool.colorName ? ` · ${spool.colorName}` : ''}
          </span>
          <span className="flex items-end justify-between gap-3 mt-2">
            <span className="font-mono-num font-extrabold text-xl leading-none" style={{ color: pct <= 15 ? 'var(--app-danger-text)' : 'var(--app-text)' }}>
              {remW}
              <span className="text-xs font-bold ml-0.5" style={{ color: 'var(--app-text-muted)' }}>g</span>
            </span>
            <span className="text-[11px] font-mono-num" style={{ color: 'var(--app-text-muted)' }}>
              {pct} % von {initW} g
            </span>
          </span>
          <span className="block mt-2">
            <LevelMeter pct={pct} color={barColor} />
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--app-text-muted)' }} />
      </button>

      {(ams.slot !== null || ams.isDrying || dry.isOverdue || spool.needsDrying || low) && !open && (
        <div className="pl-5 pr-3.5 pb-3 -mt-0.5 flex flex-wrap items-center gap-1">
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
        <div className="pl-5 pr-3.5 pb-3.5 space-y-2.5 border-t pt-3" style={{ borderColor: 'var(--app-border)' }} onClick={stop}>
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
