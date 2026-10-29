// Zentrale Stelle für alle Mitteilungen: prüft die Einstellung, speichert sie im Postfach und zeigt (wenn erlaubt)
// eine Benachrichtigung aufs Gerät. Ein Tipp auf die Benachrichtigung öffnet die Mitteilung in der App.
import { addInbox, type InboxItem, type InboxKind } from './inbox';
import { localNotify } from './notify';
import { addSystemLog } from './logService';
import { getWorkshopSettings, type WorkshopSettings } from './workshopSettings';

const KIND_SETTING: Record<InboxKind, keyof WorkshopSettings | null> = {
  'print-done': 'alertPrintDone',
  'print-fail': 'alertPrintFail',
  'dry-due': 'alertDryDue',
  'dry-done': 'alertDryDone',
  low: 'alertLow',
  info: null
};

export interface AlertInput {
  kind: InboxKind;
  title: string;
  text: string;
  key?: string;
  facts?: InboxItem['facts'];
  items?: InboxItem['items'];
  /** Kurzer Text für das Einblend-Fenster in der App (Standard: der Text) */
  toast?: string;
}

/** Meldet ein Ereignis. Gibt die ID im Postfach zurück, oder null, wenn die Meldung abgeschaltet oder schon bekannt ist. */
export async function raiseAlert(input: AlertInput, showToast?: (text: string) => void): Promise<string | null> {
  const settings = getWorkshopSettings();
  const flag = KIND_SETTING[input.kind];
  if (flag && settings[flag] === false) return null;

  const { id, isNew } = addInbox({ kind: input.kind, title: input.title, text: input.text, key: input.key, facts: input.facts, items: input.items });
  if (!isNew) return null;

  showToast?.(input.toast || input.text);
  addSystemLog('system', input.title, input.text, input.kind === 'print-fail' || input.kind === 'dry-due' || input.kind === 'low' ? 'warn' : 'success');
  if (settings.systemPush) {
    void localNotify(input.title, input.text, { tag: input.key || input.kind, inboxId: id });
  }
  return id;
}
