import { useEffect } from 'react';
import { syncDevices, getSyncPass } from '../utils/deviceSync';

// Gleicht Drucker-Zugang und Einstellungen regelmäßig mit der Cloud ab (beim Start, alle 45 s, wenn die App wieder sichtbar wird)
export function useDeviceSync(cloudUrl: string, onApplied: (text: string) => void) {
  useEffect(() => {
    if (!getSyncPass()) return;
    let stop = false;
    const run = async () => {
      if (stop || !getSyncPass()) return;
      const r = await syncDevices(cloudUrl);
      if (r === 'applied') onApplied('Drucker-Zugang und Einstellungen vom anderen Gerät übernommen.');
    };
    const first = setTimeout(run, 3000);
    const iv = setInterval(run, 45000);
    const vis = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', vis);
    const onChange = () => run();
    window.addEventListener('filamenthub:sync-now', onChange);
    return () => {
      stop = true;
      clearTimeout(first);
      clearInterval(iv);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('filamenthub:sync-now', onChange);
    };
  }, [cloudUrl]);
}
