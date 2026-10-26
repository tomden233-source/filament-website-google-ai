import React from 'react';
import { X, Undo2 } from 'lucide-react';
import { HistoryEntry } from '../types/filament';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  onUndoEntry: (id: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onUndoEntry
}) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-3 shadow-2xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
          <div>
            <h3 className="text-base font-bold text-white">Druck-Verlauf & Rückgängig</h3>
            <p className="text-[11px] text-slate-400">
              Protokoll aller abgezogenen Druckmengen
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {history.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">
              Noch keine Druck-Abzüge protokolliert.
            </p>
          ) : (
            history.map(item => (
              <div
                key={item.id}
                className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs flex justify-between items-center gap-2"
              >
                <div className="min-w-0">
                  <p className="font-bold text-white truncate">{item.spoolLabel}</p>
                  <p className="text-[10px] text-slate-400">
                    {new Date(item.timestamp).toLocaleString('de-DE')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-orange-400 font-mono-num font-bold">
                    -{item.grams}g
                  </span>
                  <button
                    onClick={() => onUndoEntry(item.id)}
                    title="Diesen Abzug rückgängig machen"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5 text-sky-400" />
                    <span>Zurück</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
