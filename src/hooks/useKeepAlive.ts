import { useEffect } from 'react';
import { IS_NATIVE } from '../utils/env';
import { setKeepAlive } from '../utils/notify';
import { isPrinterConfigured } from '../utils/printerLive';
import { useWorkshopSettings } from '../utils/workshopSettings';

/** Android-App: Hintergrund-Dienst läuft, solange ein Drucker eingerichtet ist und der Schalter in den Mitteilungs-Einstellungen an ist. */
export function useKeepAlive(): void {
  const [settings] = useWorkshopSettings();
  const anyAlert = settings.alertPrintStart || settings.alertPrintDone || settings.alertPrintFail || settings.alertDryDone || settings.alertDryStop;
  const want = settings.keepAlive && anyAlert && settings.systemPush;
  useEffect(() => {
    if (!IS_NATIVE) return;
    const apply = () => void setKeepAlive(want && isPrinterConfigured());
    apply();
    // Drucker kann erst später eingerichtet werden: beim Zurückkehren in die App erneut prüfen
    const onVisible = () => {
      if (document.visibilityState === 'visible') apply();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [want]);
}
