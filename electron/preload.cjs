// Brücke zwischen App-Oberfläche und Hauptprogramm (nur für Update-Knopf)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  cloudFetch: req => ipcRenderer.invoke('cloud:fetch', req),
  cloudCertInfo: () => ipcRenderer.invoke('cloud:cert-info'),
  cloudTrustCert: fp => ipcRenderer.invoke('cloud:trust-cert', fp),
  installNow: () => ipcRenderer.invoke('update:install'),
  onStatus: cb => {
    const h = (_e, s) => cb(s);
    ipcRenderer.on('update:status', h);
    return () => ipcRenderer.removeListener('update:status', h);
  }
});
