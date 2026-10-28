// Bambu-Cloud-HTTP-Schnittstelle (Login, Profil, gebundene Drucker, Token-Prüfung). Ohne Zustand, daher als reine Funktionen.

/**
 * Prüft den Token gegen die Bambu Cloud API.
 * 'valid' = akzeptiert, 'invalid' = abgelehnt (401/403), 'unknown' = Cloud nicht erreichbar (dann trotzdem versuchen)
 */
export async function checkToken(token: string): Promise<'valid' | 'invalid' | 'unknown'> {
  try {
    const res = await fetch('https://api.bambulab.com/v1/user-service/my/profile', {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'BambuStudio/01.09.05.51' },
      signal: AbortSignal.timeout(6000)
    });
    if (res.status === 401 || res.status === 403) return 'invalid';
    return res.ok ? 'valid' : 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Extrahiert User-ID aus JWT Token oder Bambu API
 */
export async function resolveUserId(token: string, explicitUserId?: string): Promise<string | null> {
  if (explicitUserId && explicitUserId.trim()) {
    return explicitUserId.trim().replace(/^u_/, '');
  }

  if (!token) return null;

  // 1. JWT Payload Dekodierung
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
      const payload = JSON.parse(payloadStr);
      const candidate = payload.uid || payload.userId || payload.user_id || payload.sub;
      if (candidate && /^\d+$/.test(String(candidate).trim())) {
        return String(candidate).trim();
      }
    }
  } catch {
    // Weiter mit API Request
  }

  // 2. GET Request an Bambu Lab Profile API
  try {
    const res = await fetch('https://api.bambulab.com/v1/user-service/my/profile', {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        'User-Agent': 'BambuStudio/01.09.00.00'
      }
    });
    if (res.ok) {
      const json = await res.json();
      const uid = json.uid || json.userId || json.user_id || (json.profile && json.profile.uid);
      if (uid) return String(uid).trim();
    }
  } catch (e) {
    console.warn('Konnte User-ID nicht über Bambu Profile API auflösen:', e);
  }
  return null;
}

/**
 * Ruft alle gebundenen Bambu-Drucker des Benutzers direkt über die Bambu Cloud API ab
 */
export async function getBoundDevices(token: string): Promise<{
  success: boolean;
  userId?: string;
  account?: string;
  devices?: Array<{
    dev_id: string;
    name: string;
    online: boolean;
    print_status: string;
    dev_product_name: string;
    dev_access_code: string;
  }>;
  error?: string;
}> {
  if (!token || !token.trim()) {
    return { success: false, error: 'Kein Token übergeben.' };
  }

  const cleanToken = token.trim();

  try {
    let userId: string | undefined;
    let account: string | undefined;

    // 1. Profil abrufen
    try {
      const profRes = await fetch('https://api.bambulab.com/v1/user-service/my/profile', {
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          'User-Agent': 'BambuStudio/01.09.05.51'
        }
      });
      if (profRes.ok) {
        const profJson = await profRes.json();
        userId = String(profJson.uid || profJson.userId || '');
        account = profJson.account || profJson.name;
      }
    } catch (e) {
      console.warn('Fehler beim Profilabruf:', e);
    }

    // 2. Drucker abrufen
    const devRes = await fetch('https://api.bambulab.com/v1/iot-service/api/user/bind', {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        'User-Agent': 'BambuStudio/01.09.05.51'
      }
    });

    if (!devRes.ok) {
      return {
        success: false,
        error: `Bambu API Fehler (HTTP ${devRes.status}). Bitte Token prüfen.`
      };
    }

    const devJson = await devRes.json();
    const devices = Array.isArray(devJson.devices)
      ? devJson.devices.map((d: any) => ({
          dev_id: d.dev_id,
          name: d.name || d.dev_product_name || 'Bambu Drucker',
          online: Boolean(d.online),
          print_status: d.print_status || 'UNKNOWN',
          dev_product_name: d.dev_product_name || 'Bambu Lab',
          dev_access_code: d.dev_access_code || ''
        }))
      : [];

    return {
      success: true,
      userId,
      account,
      devices
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Netzwerkfehler beim Abrufen der Druckerliste.'
    };
  }
}

/**
 * Konfigurationsdatei aus Bambu Studio (%APPDATA%\BambuStudio) parsen
 */
export function parseConfiguration(rawText: string): {
  success: boolean;
  accessToken?: string;
  userId?: string;
  serialNumber?: string;
  error?: string;
} {
  let foundToken = '';
  let foundUid = '';
  let foundSerial = '';

  // 1. JSON-Parsing (bambu_network.json)
  try {
    const json = JSON.parse(rawText);
    foundToken = json.access_token || json.token || json.user?.token || '';
    foundUid = json.user_id || json.uid || json.user?.uid || '';

    if (Array.isArray(json.devices) && json.devices.length > 0) {
      foundSerial = json.devices[0].dev_id || json.devices[0].serial || '';
    }
  } catch {
    // 2. INI / Text-Parsing (BambuStudio.conf)
    const tokenMatch = rawText.match(/access_token\s*[:=]\s*"?([^"\r\n]+)"?/);
    if (tokenMatch) foundToken = tokenMatch[1].trim();

    const uidMatch = rawText.match(/user_id\s*[:=]\s*"?([^"\r\n]+)"?/);
    if (uidMatch) foundUid = uidMatch[1].trim();

    const devMatch = rawText.match(/dev_id\s*[:=]\s*"?([^"\r\n]+)"?/);
    if (devMatch) foundSerial = devMatch[1].trim();
  }

  if (!foundToken && !foundUid && !foundSerial) {
    return {
      success: false,
      error: 'Keine Zugangsdaten in der Datei gefunden. Bitte sicherstellen, dass Bambu Studio auf dem PC eingeloggt ist.'
    };
  }

  return {
    success: true,
    accessToken: foundToken,
    userId: foundUid ? String(foundUid).replace(/^u_/, '') : undefined,
    serialNumber: foundSerial ? foundSerial.toUpperCase() : undefined
  };
}
