// Kleine Fenster-Ereignisse, damit Menü, Benachrichtigungen und Hauptfenster sich ohne viele Props verständigen.
export type WorkshopTabId = 'inbox' | 'notices' | 'labels';

export const OPEN_WORKSHOP_EVENT = 'filamenthub:open-workshop';

export interface OpenWorkshopDetail {
  tab: WorkshopTabId;
  /** Mitteilung, die aufgeklappt gezeigt werden soll */
  focusId?: string;
}

/** Öffnet die Werkstatt (Mitteilungen, Einstellungen, Etiketten) von überall aus */
export function openWorkshop(tab: WorkshopTabId, focusId?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenWorkshopDetail>(OPEN_WORKSHOP_EVENT, { detail: { tab, focusId } }));
}
