import React from 'react';
import { Wrench, RefreshCw, Download, Upload, Database, Trash2 } from 'lucide-react';
import type { SidebarProps as ParentProps } from '../Sidebar';
import { safeStorage } from '../../utils/safeStorage';
import { isGistUrl } from '../../utils/gistStore';
import { STORAGE_KEY_CLOUD_URL } from '../../utils/storageKeys';

export interface ToolsTabProps {
  onSyncCloud: ParentProps['onSyncCloud'];
  onExportBackup: ParentProps['onExportBackup'];
  onImportBackup: ParentProps['onImportBackup'];
  onRestoreDefaultSpools: ParentProps['onRestoreDefaultSpools'];
  onClearAllSpools: ParentProps['onClearAllSpools'];
}

export const ToolsTab: React.FC<ToolsTabProps> = ({
  onSyncCloud,
  onExportBackup,
  onImportBackup,
  onRestoreDefaultSpools,
  onClearAllSpools
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
                    <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>{isGistUrl(safeStorage.getItem(STORAGE_KEY_CLOUD_URL) || '') ? 'GitHub-Gist' : 'npoint.io'}</span>
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
                      if (confirm('21 Beispiel-Spulen laden? Deine jetzige Liste wird ersetzt (oben auf „Zurück“ bringt sie wieder).')) {
                        onRestoreDefaultSpools();
                      }
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 border border-rose-800/40 text-xs font-semibold text-rose-300 transition cursor-pointer flex items-center gap-2"
                  >
                    <Database className="w-4 h-4" />
                    <span>21 Beispiel-Spulen laden</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm('ALLE Spulen entfernen?\n\nVorher wird eine Backup-Datei geladen und eine Kopie im Gerät gesichert. Verlauf bleibt. AMS- und Tag-Zuordnungen werden geleert. Oben auf „Zurück“ stellt alles wieder her.')) {
                        onClearAllSpools();
                      }
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 border border-rose-800/40 text-xs font-semibold text-rose-300 transition cursor-pointer flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Alle Spulen entfernen (Neustart)</span>
                  </button>
                </div>
              </div>
            </div>
  );
};
