import React from 'react';
import { Bell, QrCode, Wrench, X } from 'lucide-react';
import type { Spool } from '../../types/filament';
import { NoticesTab } from './NoticesTab';
import { LabelsTab } from './LabelsTab';

export type WorkshopTab = 'notices' | 'labels';

const TABS: { id: WorkshopTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'notices', label: 'Meldungen', icon: Bell },
  { id: 'labels', label: 'Etiketten', icon: QrCode }
];

export interface WorkshopModalProps {
  isOpen: boolean;
  onClose: () => void;
  tab: WorkshopTab;
  onTabChange: (tab: WorkshopTab) => void;
  spools: Spool[];
  labelSpoolId?: string | null;
}

/** Werkstatt: ein Fenster für alle Zusatz-Funktionen (Meldungen, später Projekte, Statistik, Etiketten, Backup). */
export const WorkshopModal: React.FC<WorkshopModalProps> = ({ isOpen, onClose, tab, onTabChange, spools, labelSpoolId }) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-3xl rounded-t-2xl sm:rounded-2xl border shadow-2xl flex flex-col max-h-[92vh]"
        style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
      >
        <div className="flex items-center justify-between gap-3 p-4 border-b" style={{ borderColor: 'var(--app-border)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--app-accent-sub)', borderColor: 'var(--app-accent)', color: 'var(--app-accent-text)' }}
            >
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">Werkstatt</h3>
              <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                Warnungen und Helfer für deinen Druck-Alltag
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border cursor-pointer hover:opacity-80"
            style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}
            aria-label="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto px-4 pt-3">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className="px-3 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
                style={{
                  backgroundColor: active ? 'var(--app-accent)' : 'var(--app-card-sub)',
                  borderColor: active ? 'var(--app-accent)' : 'var(--app-border)',
                  color: active ? '#ffffff' : 'var(--app-text)'
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-4 overflow-y-auto">{tab === 'notices' && <NoticesTab />}
          {tab === 'labels' && <LabelsTab spools={spools} preselectId={labelSpoolId} />}</div>
      </div>
    </div>
  );
};
