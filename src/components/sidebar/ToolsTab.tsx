import React from 'react';
import { Wrench, RefreshCw, Download, Upload, Database } from 'lucide-react';
import type { SidebarProps as ParentProps } from '../Sidebar';

export interface ToolsTabProps {
  onSyncCloud: ParentProps['onSyncCloud'];
  onExportBackup: ParentProps['onExportBackup'];
  onImportBackup: ParentProps['onImportBackup'];
  onRestoreDefaultSpools: ParentProps['onRestoreDefaultSpools'];
}

export const ToolsTab: React.FC<ToolsTabProps> = ({
  onSyncCloud,
  onExportBackup,
  onImportBackup,
  onRestoreDefaultSpools
}) => {
  return (
<div className="space-y-3">
              <div
                className="rounded-xl border p-3 space-y-2 transition-colors"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                  <Wrench className="w-4 h-4 text-orange-400" />
                  <span>Cloud & Backup-Tools</span>
                </span>

                <div className="space-y-1.5 pt-1">
                  <button
                    onClick={onSyncCloud}
                    className="w-full py-2 px-3 rounded-lg border text-xs font-semibold transition cursor-pointer flex items-center justify-between"
                    style={{
                      backgroundColor: 'var(--app-card)',
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-text)'
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-sky-400" />
                      <span>Jetzt mit Cloud synchronisieren</span>
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>npoint.io</span>
                  </button>

                  <button
                    onClick={onExportBackup}
                    className="w-full py-2 px-3 rounded-lg border text-xs font-semibold transition cursor-pointer flex items-center gap-2"
                    style={{
                      backgroundColor: 'var(--app-card)',
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-text)'
                    }}
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>JSON-Backup herunterladen</span>
                  </button>

                  <label
                    className="w-full py-2 px-3 rounded-lg border text-xs font-semibold transition cursor-pointer flex items-center gap-2"
                    style={{
                      backgroundColor: 'var(--app-card)',
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-text)'
                    }}
                  >
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span>JSON-Backup wiederherstellen</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) onImportBackup(f);
                      }}
                      className="hidden"
                    />
                  </label>

                  <button
                    onClick={() => {
                      if (confirm('Möchtest du wirklich alle 21 Standard-Spulen wiederherstellen?')) {
                        onRestoreDefaultSpools();
                      }
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 border border-rose-800/40 text-xs font-semibold text-rose-300 transition cursor-pointer flex items-center gap-2"
                  >
                    <Database className="w-4 h-4" />
                    <span>Auf 21 Standard-Spulen zurücksetzen</span>
                  </button>
                </div>
              </div>
            </div>
  );
};
