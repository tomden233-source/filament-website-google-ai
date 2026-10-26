import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function getHaConfig() {
  const dataConfigPath = path.join(rootDir, 'data', 'ha-config.json');
  const dotConfigPath = path.join(rootDir, '.ha-config.json');

  let haUrl = process.env.HA_URL || '';
  let haToken = process.env.HA_TOKEN || '';

  if (fs.existsSync(dataConfigPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(dataConfigPath, 'utf8'));
      if (cfg.haUrl) haUrl = cfg.haUrl;
      if (cfg.haToken) haToken = cfg.haToken;
    } catch {}
  } else if (fs.existsSync(dotConfigPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(dotConfigPath, 'utf8'));
      if (cfg.haUrl) haUrl = cfg.haUrl;
      if (cfg.haToken) haToken = cfg.haToken;
    } catch {}
  }

  return { haUrl, haToken };
}

export async function triggerAutomation(entityId = 'automation.filament_website_auto_pull_github', customUrl, customToken) {
  const { haUrl: savedUrl, haToken: savedToken } = getHaConfig();
  const haUrl = (customUrl || savedUrl || '').trim().replace(/\/+$/, '');
  const haToken = (customToken || savedToken || '').trim();

  if (!haUrl || !haToken) {
    console.log(`[HA Trigger] Übersprungen: Keine HA URL oder kein Token konfiguriert (haUrl: "${haUrl ? 'vorhanden' : 'fehlt'}", haToken: "${haToken ? 'vorhanden' : 'fehlt'}").`);
    return {
      success: false,
      reason: 'Keine Home Assistant Zugangsdaten im Tresor hinterlegt.'
    };
  }

  const targetEndpoint = `${haUrl}/api/services/automation/trigger`;
  console.log(`[HA Trigger] Sende POST an: ${targetEndpoint} für "${entityId}"...`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(targetEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${haToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ entity_id: entityId }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (response.ok) {
      console.log(`[HA Trigger] ✅ ERFOLG: Home Assistant Automation "${entityId}" wurde erfolgreich getriggert!`);
      return {
        success: true,
        status: response.status,
        message: `Automation "${entityId}" erfolgreich in Home Assistant ausgelöst!`
      };
    } else {
      const errText = await response.text();
      console.warn(`[HA Trigger] ⚠️ HA Fehler ${response.status}: ${errText}`);
      return {
        success: false,
        status: response.status,
        error: `HA HTTP ${response.status}: ${errText}`
      };
    }
  } catch (err) {
    console.error(`[HA Trigger] ❌ Verbindungsfehler:`, err?.message || err);
    return {
      success: false,
      error: `Verbindungsfehler: ${err?.message || String(err)}`
    };
  }
}

// Direkte CLI-Ausführung
if (process.argv[1] && process.argv[1].endsWith('trigger-ha-automation.js')) {
  const entity = process.argv[2] || 'automation.filament_website_auto_pull_github';
  triggerAutomation(entity).then(res => {
    console.log(JSON.stringify(res, null, 2));
  });
}
