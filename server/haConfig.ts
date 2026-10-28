import path from 'path';
import fs from 'fs';
import { rootDir, dataDir } from './paths.js';

// --- HOME ASSISTANT INTEGRATION (Raspberry Pi / Lokales Netzwerk / Nabu Casa) ---
const haConfigPath = path.resolve(rootDir, '.ha-config.json');
const haDataConfigPath = path.join(dataDir, 'ha-config.json');

export function loadHaConfig(): { haUrl: string; haToken: string; cameraEntity: string; switchEntity: string; isConfigured: boolean } {
  try {
    if (fs.existsSync(haDataConfigPath)) {
      const data = JSON.parse(fs.readFileSync(haDataConfigPath, 'utf8'));
      if (data && (data.haUrl || data.haToken)) {
        return {
          haUrl: data.haUrl || '',
          haToken: data.haToken || '',
          cameraEntity: data.cameraEntity || 'camera.bambu_x2d',
          switchEntity: data.switchEntity || 'switch.3d_drucker_steckdose',
          isConfigured: true
        };
      }
    }
    if (fs.existsSync(haConfigPath)) {
      const data = JSON.parse(fs.readFileSync(haConfigPath, 'utf8'));
      if (data && (data.haUrl || data.haToken)) {
        return {
          haUrl: data.haUrl || '',
          haToken: data.haToken || '',
          cameraEntity: data.cameraEntity || 'camera.bambu_x2d',
          switchEntity: data.switchEntity || 'switch.3d_drucker_steckdose',
          isConfigured: true
        };
      }
    }
  } catch {}
  return {
    haUrl: process.env.HA_URL || '',
    haToken: process.env.HA_TOKEN || '',
    cameraEntity: process.env.HA_CAMERA_ENTITY || 'camera.bambu_x2d',
    switchEntity: process.env.HA_SWITCH_ENTITY || 'switch.3d_drucker_steckdose',
    isConfigured: Boolean(process.env.HA_URL || process.env.HA_TOKEN)
  };
}

export function saveHaConfig(config: { haUrl: string; haToken: string; cameraEntity: string; switchEntity: string }) {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(haConfigPath, JSON.stringify(config, null, 2), 'utf8');
    fs.writeFileSync(haDataConfigPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Fehler beim Speichern der HA-Konfiguration:', err);
  }
}

// HA Automation triggern (z.B. automation.filament_website_auto_pull_github)
export async function triggerHaAutomation(entityId = 'automation.filament_website_auto_pull_github', haUrlOverride?: string, haTokenOverride?: string) {
  try {
    const config = loadHaConfig();
    const url = (haUrlOverride || config.haUrl || '').trim().replace(/\/+$/, '');
    const token = (haTokenOverride || config.haToken || '').trim();

    if (!url || !token) {
      console.log(`[HA Automation Trigger] Übersprungen: Keine HA URL oder kein Token konfiguriert für ${entityId}`);
      return {
        success: false,
        triggered: false,
        message: 'Keine Home Assistant URL / Token hinterlegt. Bitte zuerst im Menü unter Home Assistant eintragen.'
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const resp = await fetch(`${url}/api/services/automation/trigger`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ entity_id: entityId }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (resp.ok) {
      console.log(`[HA Automation Trigger] ✅ Erfolgreich ausgelöst: ${entityId}`);
      return {
        success: true,
        triggered: true,
        entity_id: entityId,
        status: resp.status,
        message: `Home Assistant Automation „${entityId}“ erfolgreich ausgelöst!`
      };
    } else {
      const errText = await resp.text();
      console.warn(`[HA Automation Trigger] ⚠️ HTTP ${resp.status}: ${errText}`);
      let hint = '';
      if (resp.status === 401) {
        hint = ' (HTTP 401 Unauthorized: Dein Home Assistant Long-Lived Token ist abgelaufen oder wurde widerrufen. Bitte unter Profil → Langlebige Zugangs-Token ein neues Token generieren!)';
      }
      return {
        success: false,
        triggered: false,
        entity_id: entityId,
        status: resp.status,
        error: `Home Assistant antwortete mit HTTP ${resp.status}: ${errText}${hint}`
      };
    }
  } catch (err: any) {
    console.error(`[HA Automation Trigger] ❌ Fehler:`, err?.message || err);
    return {
      success: false,
      triggered: false,
      entity_id: entityId,
      error: `Verbindungsfehler zu Home Assistant: ${err?.message || String(err)}`
    };
  }
}
