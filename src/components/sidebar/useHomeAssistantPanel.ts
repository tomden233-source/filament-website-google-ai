import { useState, useEffect } from 'react';
import { safeStorage } from '../../utils/safeStorage';
import { getHaCredentials, DEFAULT_NABU_URL, saveHaCredentials, triggerHaAutomation, testHaConnection, toggleHaLight } from '../../utils/haClient';
import { homeAssistantApi } from '../../api';
import { addSystemLog } from '../../utils/logService';

export interface useHomeAssistantPanelParams {
  activeTab: any;
  settingsSubTab: any;
}

export function useHomeAssistantPanel({ activeTab, settingsSubTab }: useHomeAssistantPanelParams) {
  const [haTelemetry, setHaTelemetry] = useState<any>(null);

  const [haLoading, setHaLoading] = useState<boolean>(false);

  const [haLightActive, setHaLightActive] = useState<boolean>(false);

  const [haActionToast, setHaActionToast] = useState<string | null>(null);

  const [ventilationDryerPath, setVentilationDryerPath] = useState<string>(() => {
    return safeStorage.getItem('ha_path_ventilation_dryer') || 'Sensor.X2D.Allowed.Settings.Ventilation.And.Dryer';
  });

  const [sensorSearchQuery, setSensorSearchQuery] = useState<string>('');

  const [sensorCategoryFilter, setSensorCategoryFilter] = useState<'all' | 'ventilation_dryer' | 'sensor' | 'diagnostic' | 'switch'>('all');

  const [copiedEntityId, setCopiedEntityId] = useState<string | null>(null);

  const [isNabuVaultOpen, setIsNabuVaultOpen] = useState<boolean>(() => {
    return safeStorage.getItem('ha_vault_open') !== 'false';
  });

  const [nabuUrlInput, setNabuUrlInput] = useState<string>(() => {
    const creds = getHaCredentials();
    return creds.url || DEFAULT_NABU_URL;
  });

  const [nabuTokenInput, setNabuTokenInput] = useState<string>(() => {
    const creds = getHaCredentials();
    return creds.token || '';
  });

  const [showNabuToken, setShowNabuToken] = useState<boolean>(false);

  const [nabuSavedSuccess, setNabuSavedSuccess] = useState<boolean>(false);

  const [nabuTesting, setNabuTesting] = useState<boolean>(false);

  const [nabuTestResult, setNabuTestResult] = useState<{ success: boolean; message: string; isUnauthorized?: boolean } | null>(null);

  const [haTriggering, setHaTriggering] = useState<boolean>(false);

  const [haTriggerResult, setHaTriggerResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!haActionToast) return;
    const t = setTimeout(() => setHaActionToast(null), 10000);
    return () => clearTimeout(t);
  }, [haActionToast]);

  useEffect(() => {
    if (!nabuTestResult) return;
    const t = setTimeout(() => setNabuTestResult(null), 10000);
    return () => clearTimeout(t);
  }, [nabuTestResult]);

  useEffect(() => {
    if (!haTriggerResult) return;
    const t = setTimeout(() => setHaTriggerResult(null), 10000);
    return () => clearTimeout(t);
  }, [haTriggerResult]);

  useEffect(() => {
    const creds = getHaCredentials();
    if (creds.url && !creds.url.includes('xxxxxxxxxxxx')) {
      setNabuUrlInput(creds.url);
    }
    if (creds.token) {
      setNabuTokenInput(creds.token);
    }

    homeAssistantApi
      .getConfig()
      .then(res => {
        const data = res.ok && res.isJson ? res.data : null;
        if (data?.haUrl && !data.haUrl.includes('xxxxxxxxxxxx')) {
          setNabuUrlInput(data.haUrl);
          saveHaCredentials({ url: data.haUrl });
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveNabuVault = async () => {
    try {
      const cleanUrl = nabuUrlInput.trim();
      const cleanToken = nabuTokenInput.trim();
      saveHaCredentials({ url: cleanUrl, token: cleanToken });

      setNabuSavedSuccess(true);
      setTimeout(() => setNabuSavedSuccess(false), 10000);
      setHaActionToast('Nabu Casa URL & Token dauerhaft gesichert & im Tresor synchronisiert!');
      addSystemLog('system', 'Home Assistant Nabu Casa URL & Token dauerhaft gespeichert', 'Nabu Casa Vault', 'success');
      fetchHaTelemetry();
    } catch {
      setHaActionToast('Fehler beim Speichern im Tresor');
    }
  };

  const handleTriggerHaPullAutomation = async (entityId = 'automation.filament_website_auto_pull_github') => {
    setHaTriggering(true);
    setHaTriggerResult(null);
    try {
      // Vorab sichern
      saveHaCredentials({
        url: nabuUrlInput.trim(),
        token: nabuTokenInput.trim()
      });

      const res = await triggerHaAutomation(entityId);
      if (res.success) {
        setHaTriggerResult({
          success: true,
          message: `Erfolg! Automation „${entityId}“ in Home Assistant ausgelöst. Dein HA zieht jetzt das neueste Git-Release!`
        });
        setHaActionToast(`Automation ${entityId} erfolgreich in HA getriggert!`);
        addSystemLog('system', `HA Automation ${entityId} erfolgreich ausgelöst: ${res.message}`, 'HA Automation', 'success');
      } else {
        setHaTriggerResult({
          success: false,
          message: res.message || 'Konnte Automation in HA nicht auslösen. Bitte Token & URL prüfen.'
        });
        addSystemLog('system', `Konnte HA Automation ${entityId} nicht auslösen: ${res.message}`, 'HA Automation', 'error');
      }
    } catch (err: any) {
      setHaTriggerResult({
        success: false,
        message: 'Verbindungsfehler beim Auslösen der HA Automation: ' + (err?.message || err)
      });
      addSystemLog('system', `Verbindungsfehler beim Auslösen von ${entityId}: ${err?.message || err}`, 'HA Automation', 'error');
    } finally {
      setHaTriggering(false);
    }
  };

  const handleTestNabuConnection = async () => {
    setNabuTesting(true);
    setNabuTestResult(null);
    try {
      saveHaCredentials({
        url: nabuUrlInput.trim(),
        token: nabuTokenInput.trim()
      });

      const res = await testHaConnection(nabuUrlInput.trim(), nabuTokenInput.trim());
      const isAuthErr = Boolean((res as any).isUnauthorized || res.message?.includes('401'));
      setNabuTestResult({
        success: res.success,
        message: res.message,
        isUnauthorized: isAuthErr
      });
      addSystemLog('system', res.message, 'HA Test', res.success ? 'success' : 'warn');
    } catch (err: any) {
      const msg = err?.message || String(err);
      setNabuTestResult({
        success: false,
        message: 'Konnte Verbindung zu Home Assistant nicht aufbauen: ' + msg,
        isUnauthorized: msg.includes('401')
      });
      addSystemLog('system', `HA Verbindungstest fehlgeschlagen: ${msg}`, 'HA Test', 'error');
    } finally {
      setNabuTesting(false);
    }
  };

  const fetchHaTelemetry = async () => {
    setHaLoading(true);
    try {
      const res = await homeAssistantApi.telemetry();
      const data = res.data;
      if (data && data.success) {
        setHaTelemetry(data);
        const devData = data.bambuX2d || data.bambuX1c;
        if (devData?.isLightOn !== null && devData?.isLightOn !== undefined) {
          setHaLightActive(Boolean(devData.isLightOn));
        }
      }
    } catch {}
    finally {
      setHaLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'settings' && settingsSubTab === 'connections') {
      fetchHaTelemetry();
      const interval = setInterval(fetchHaTelemetry, 4000);
      return () => clearInterval(interval);
    }
  }, [activeTab, settingsSubTab]);

  const handleToggleHaLight = async () => {
    const nextMode = haLightActive ? 'off' : 'on';
    try {
      const res = await toggleHaLight(nextMode);
      if (res.success) {
        setHaLightActive(!haLightActive);
        setHaActionToast(`Bauraum-Licht ${nextMode === 'on' ? 'eingeschaltet' : 'ausgeschaltet'}!`);
        addSystemLog('licht', `Home Assistant: Bauraum-Licht ${nextMode === 'on' ? 'eingeschaltet' : 'ausgeschaltet'}`, 'X1C / X2D', 'info');
        fetchHaTelemetry();
      } else {
        setHaActionToast(res.message || 'Fehler beim Schalten des Lichts.');
      }
    } catch {
      setHaActionToast('Verbindungsfehler zu Home Assistant.');
    }
  };

  return { setHaActionToast, haTelemetry, sensorCategoryFilter, sensorSearchQuery, isNabuVaultOpen, setIsNabuVaultOpen, nabuUrlInput, setNabuUrlInput, showNabuToken, nabuTokenInput, setNabuTokenInput, setShowNabuToken, nabuTestResult, haTriggerResult, handleSaveNabuVault, nabuSavedSuccess, handleTestNabuConnection, nabuTesting, handleTriggerHaPullAutomation, haTriggering, fetchHaTelemetry, haLoading, haActionToast, haLightActive, handleToggleHaLight, ventilationDryerPath, setVentilationDryerPath, setCopiedEntityId, copiedEntityId, setSensorSearchQuery, setSensorCategoryFilter };
}
