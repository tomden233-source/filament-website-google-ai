// Gemeinsamer Kern der Bambu-Cloud-MQTT-Verbindung. Läuft im Server (Node, Paket "mqtt") und in der Android-App
// (natives MQTT-Plugin). Alles, was von der Umgebung abhängt (Verbindung, Speicher, Meldung an die Oberfläche),
// steckt in den drei abstrakten Methoden unten, der Rest ist für beide gleich.
import * as bambuCloud from './cloudApi';

/** Kleinster gemeinsamer Nenner der MQTT-Clients (Paket "mqtt" im Server, natives Plugin in der App) */
export interface MqttLike {
  on(event: 'connect' | 'close', cb: () => void): void;
  on(event: 'message', cb: (topic: string, message: { toString(): string }) => void): void;
  on(event: 'error', cb: (err: any) => void): void;
  subscribe(topic: string, opts: { qos: 0 | 1 | 2 }, cb?: (err?: any) => void): void;
  publish(topic: string, payload: string, a?: any, b?: any): void;
  end(force?: boolean): void;
}

export interface MqttConnectOptions {
  username: string;
  password: string;
  clientId: string;
  /** Zertifikat prüfen (Cloud: ja, LAN mit selbstsigniertem Zertifikat: nein) */
  tlsVerify: boolean;
}

export interface SavedBambuConfig {
  serialNumber?: string;
  userId?: string;
  accessToken?: string;
  brokerHost?: string;
  adminPin?: string;
}

function baseName(p: string): string {
  return p.split(/[\\/]/).pop() || p;
}

export interface BambuPrinterData {
  gcode_state: string;
  subtask_name: string;
  gcode_file: string;
  mc_percent: number;
  mc_remaining_time: number; // Minuten
  layer_num: number;
  total_layer_num: number;
  bed_temper: number;
  bed_target_temper: number;
  chamber_temper: number;
  nozzle_temper: number;
  nozzle_target_temper: number;
  nozzle2_temper: number;
  nozzle2_target_temper: number;
  fan_gear: number;
  spd_mag: number;
  ams: any;
  vt_tray: any;
  lights_report: any;
}

export interface BambuPrinterStatusResponse {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  serialNumber: string;
  userId: string;
  brokerHost: string;
  hasAdminPin: boolean;
  /** Cloud-Token vorhanden (Login ok), auch wenn MQTT gerade nicht verbunden ist */
  hasToken: boolean;
  /** Sekunden bis zum nächsten automatischen Verbindungsversuch (null = keiner geplant) */
  retryInSec: number | null;
  /** Verbunden und der Drucker hat schon Daten geschickt */
  receivingData: boolean;
  lastUpdated: string | null;
  data: BambuPrinterData;
  formatted: {
    remainingTimeStr: string;
    etaClockStr: string;
    statusText: string;
    statusColor: string;
  };
}

export abstract class BambuMqttCore {
  private client: MqttLike | null = null;

  private serialNumber: string = '';
  private userId: string = '';
  private accessToken: string = '';
  private brokerHost: string = 'us.mqtt.bambulab.com';
  private adminPin: string = '1234';

  private connected: boolean = false;
  private connecting: boolean = false;
  private loadedPin = false;
  /** Zähler der Verbindungsversuche: ein älterer, ersetzter Versuch darf den Zustand nicht mehr ändern */
  private attempt = 0;
  private lastError: string | null = null;
  private lastUpdated: string | null = null;
  /** Seit der letzten Verbindung schon Daten vom Drucker bekommen? (sonst: verbunden, aber Drucker schweigt) */
  private gotData = false;
  /** Nach einem Licht-Befehl kurz den gewünschten Zustand halten (sonst flackert die Anzeige durch alte Meldungen) */
  private lightHold: { mode: string; until: number } | null = null;

  // Akkumulierter Druckstatus (Delta-Updates werden hinein gemergt)
  private printData: BambuPrinterData = {
    gcode_state: 'IDLE',
    subtask_name: '',
    gcode_file: '',
    mc_percent: 0,
    mc_remaining_time: 0,
    layer_num: 0,
    total_layer_num: 0,
    bed_temper: 21,
    bed_target_temper: 0,
    chamber_temper: 23,
    nozzle_temper: 24,
    nozzle_target_temper: 0,
    nozzle2_temper: 24,
    nozzle2_target_temper: 0,
    fan_gear: 0,
    spd_mag: 100,
    // Kein Demo-AMS: ohne Verbindung gibt es keine Slot-Daten (sonst falsche Farben)
    ams: null,
    vt_tray: null,
    lights_report: null
  };

  // Zu häufige pushall-Anfragen kann Bambu drosseln oder mit Trennung bestrafen. Der Drucker meldet Änderungen selbst,
  // pushall dient nur dazu, den vollen Zustand regelmäßig aufzufrischen.
  private static readonly PUSHALL_INTERVAL_MS = 15000;

  private keepaliveInterval: ReturnType<typeof setInterval> | null = null;

  // Automatisch neu verbinden, wenn der erste Versuch scheitert (z. B. Handy kurz offline). Nicht bei abgelehnten Zugangsdaten.
  private static readonly RETRY_DELAYS_MS = [5000, 15000, 30000, 60000, 120000];
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAt: number | null = null;
  private retryCount = 0;
  private authRejected = false;
  private pendingPushallTimers = new Set<ReturnType<typeof setTimeout>>();

  /** Verzögertes pushall, das beim Trennen der Verbindung sicher abgebrochen wird. */
  private schedulePushall(delayMs: number) {
    const timer = setTimeout(() => {
      this.pendingPushallTimers.delete(timer);
      this.requestPushall();
    }, delayMs);
    this.pendingPushallTimers.add(timer);
  }

  private clearPendingTimers() {
    for (const timer of this.pendingPushallTimers) clearTimeout(timer);
    this.pendingPushallTimers.clear();
  }
  /** Neuen MQTT-Client zur Bambu Cloud öffnen (Server: Paket "mqtt", App: natives Plugin) */
  protected abstract createClient(url: string, options: MqttConnectOptions): MqttLike;
  /** Gespeicherte Zugangsdaten laden (Server: Datei, App: Browser-Speicher) */
  protected abstract loadConfig(): SavedBambuConfig | null;
  /** Zugangsdaten nach erfolgreicher Verbindung speichern */
  protected abstract saveConfig(config: Required<SavedBambuConfig>): void;
  /** Der Status hat sich geändert (Server: an SSE-Clients senden) */
  protected abstract notifyChange(): void;
  /** Zweite Quelle für Zugangsdaten, falls noch nie verbunden wurde (App: Werte aus dem Login-Fenster) */
  protected fallbackConfig(): SavedBambuConfig | null {
    return null;
  }
  /** Umgebungs-Vorgaben, die Vorrang vor gespeicherten Werten haben (Server: Umgebungsvariablen) */
  protected envOverrides(): SavedBambuConfig {
    return {};
  }
  /** Zertifikat der Cloud prüfen? Server: nur mit BAMBU_TLS_VERIFY=true, App: immer */
  protected tlsVerify(): boolean {
    return true;
  }

  /** Nach dem Erzeugen einmal aufrufen: Zugangsdaten laden und bei vorhandenen Daten automatisch verbinden. */
  public init(): void {
    // 1. Aus gespeicherten Zugangsdaten laden, falls vorhanden
    try {
      const parsed = this.loadConfig();
      if (parsed) {
        if (parsed.serialNumber) this.serialNumber = parsed.serialNumber;
        if (parsed.userId) this.userId = parsed.userId;
        if (parsed.accessToken) this.accessToken = parsed.accessToken;
        if (parsed.brokerHost) {
          this.brokerHost = (parsed.brokerHost === 'eu.mqtt.bambulab.com') ? 'us.mqtt.bambulab.com' : parsed.brokerHost;
        }
        if (parsed.adminPin) {
          this.adminPin = parsed.adminPin;
          this.loadedPin = true;
        }
      }
    } catch (e) {
      console.warn('Konnte gespeicherte Bambu-Zugangsdaten nicht lesen:', e);
    }

    // 1b. Noch nie verbunden? Dann die Werte aus dem Login-Fenster nehmen (Token nach E-Mail-Login usw.)
    try {
      const fb = this.fallbackConfig();
      if (fb) {
        if (!this.serialNumber && fb.serialNumber) this.serialNumber = fb.serialNumber;
        if (!this.userId && fb.userId) this.userId = fb.userId;
        if (!this.accessToken && fb.accessToken) this.accessToken = fb.accessToken;
        if (fb.adminPin && !this.loadedPin) this.adminPin = fb.adminPin;
      }
    } catch {
      // ignorieren
    }

    // 2. Vorgaben der Umgebung haben Vorrang
    const env = this.envOverrides();
    if (env.serialNumber) this.serialNumber = env.serialNumber;
    if (env.userId) this.userId = env.userId;
    if (env.accessToken) this.accessToken = env.accessToken;
    if (env.adminPin) this.adminPin = env.adminPin;

    // 3. Wenn Zugangsdaten vorliegen, nach 1 Sekunde automatisch verbinden (ohne Seriennummer: Drucker im Konto suchen)
    if (this.accessToken) {
      setTimeout(() => this.ensureConnected(), 1000);
    }
  }

  /**
   * Verbindet, falls Zugangsdaten da sind und gerade keine Verbindung steht (App-Start, App wieder im Vordergrund,
   * Knopf „Neu verbinden"). Mit force=true auch nach abgelehnten Zugangsdaten noch einmal versuchen.
   */
  public async ensureConnected(force = false): Promise<{ success: boolean; message: string }> {
    if (this.connected) return { success: true, message: 'Drucker ist verbunden.' };
    if (this.connecting) return { success: false, message: 'Verbindung wird gerade aufgebaut …' };
    if (!this.accessToken) {
      return { success: false, message: 'Nicht bei Bambu angemeldet. Bitte im Drucker-Menü (Zahnrad) anmelden.' };
    }
    if (this.authRejected && !force) return { success: false, message: this.lastError || 'Zugangsdaten abgelehnt.' };
    if (force) {
      this.authRejected = false;
      this.retryCount = 0;
    }
    this.clearRetry();
    try {
      if (!this.serialNumber) {
        const r = await this.autoConnectByToken(this.accessToken);
        return { success: r.success, message: r.success ? r.message : r.error || r.message };
      }
      const r = await this.connect({
        serialNumber: this.serialNumber,
        userId: this.userId,
        accessToken: this.accessToken,
        brokerHost: this.brokerHost,
        adminPin: this.adminPin
      });
      return { success: r.success, message: r.message };
    } catch (err: any) {
      const message = err?.message || String(err);
      this.lastError = message;
      this.connecting = false;
      // abgelaufener Token o. Ä.: nicht endlos wiederholen
      if (/abgelaufen|ungültig|lehnt|User ID|User-ID/i.test(message)) this.authRejected = true;
      else this.scheduleRetry();
      this.notifyChange();
      return { success: false, message };
    }
  }

  private clearRetry() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.retryAt = null;
  }

  /** Nächsten Versuch mit wachsender Pause planen (5 s, 15 s, 30 s, 1 min, dann alle 2 min) */
  private scheduleRetry() {
    if (this.retryTimer || this.authRejected || !this.accessToken) return;
    const delays = BambuMqttCore.RETRY_DELAYS_MS;
    const delay = delays[Math.min(this.retryCount, delays.length - 1)];
    this.retryCount++;
    this.retryAt = Date.now() + delay;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.retryAt = null;
      if (!this.connected && !this.connecting) this.ensureConnected();
    }, delay);
    this.notifyChange();
  }

  /** Verständliche Fehlermeldung zu MQTT-Fehlern (Paho-Codes in der App, Node-Codes im Server) */
  private describeMqttError(err: any): { message: string; rejected: boolean } {
    const code = err?.code;
    const raw = String(err?.message || '').trim();
    const rejected = code === 4 || code === 5 || /not authori[sz]ed|bad user ?name or password|Nicht autorisiert/i.test(raw);
    if (rejected) {
      return {
        rejected,
        message: 'Die Bambu Cloud lehnt die Zugangsdaten ab (Token abgelaufen oder falsche User-ID). Bitte im Zahnrad-Menü neu anmelden.'
      };
    }
    let hint = 'Verbindung zur Bambu Cloud fehlgeschlagen.';
    if (code === 32103 || /ECONNREFUSED|Unable to connect|UnknownHost|ENOTFOUND|EAI_AGAIN|resolve host/i.test(raw)) {
      hint = 'Bambu Cloud nicht erreichbar. Hat das Handy Internet? (WLAN/mobile Daten prüfen)';
    } else if (code === 32000 || /timed? ?out|Zeitlimit/i.test(raw)) {
      hint = 'Die Bambu Cloud antwortet nicht (Zeitüberschreitung).';
    } else if (/SSL|TLS|certificate|Zertifikat|handshake|trust/i.test(raw)) {
      hint = 'Sichere Verbindung (TLS) zur Bambu Cloud fehlgeschlagen. Uhrzeit am Handy prüfen und die neueste App installieren.';
    } else if (code === 32109 || /connection lost|reset/i.test(raw)) {
      hint = 'Verbindung zur Bambu Cloud wurde getrennt.';
    }
    const tech = raw ? ` (${raw}${code != null && !raw.includes(String(code)) ? `, Code ${code}` : ''})` : code != null ? ` (Code ${code})` : '';
    return { rejected: false, message: hint + tech };
  }

  public getStatus(): BambuPrinterStatusResponse {
    return {
      connected: this.connected,
      connecting: this.connecting,
      error: this.lastError,
      serialNumber: this.serialNumber,
      userId: this.userId,
      brokerHost: this.brokerHost,
      hasAdminPin: Boolean(this.adminPin),
      hasToken: Boolean(this.accessToken),
      retryInSec: this.retryAt ? Math.max(0, Math.round((this.retryAt - Date.now()) / 1000)) : null,
      receivingData: this.connected && this.gotData,
      lastUpdated: this.lastUpdated,
      data: { ...this.printData },
      formatted: this.getFormattedState()
    };
  }

  private getFormattedState() {
    if (!this.connected) {
      if (this.connecting) {
        return {
          remainingTimeStr: 'Verbindet...',
          etaClockStr: '--:-- Uhr',
          statusText: 'Verbindung wird aufgebaut...',
          statusColor: '#f59e0b'
        };
      }
      return {
        remainingTimeStr: '--',
        etaClockStr: '--:-- Uhr',
        statusText: 'Getrennt (Offline)',
        statusColor: '#64748b'
      };
    }

    const minutes = Math.max(0, this.printData.mc_remaining_time || 0);
    const hours = Math.floor(minutes / 60);
    const remMins = minutes % 60;
    const remainingTimeStr =
      minutes > 0 ? (hours > 0 ? `${hours} Std. ${remMins} Min.` : `${remMins} Min.`) : 'Bereit / 0 Min.';

    let etaClockStr = '--:-- Uhr';
    if (minutes > 0 && this.printData.gcode_state === 'RUNNING') {
      const eta = new Date(Date.now() + minutes * 60 * 1000);
      etaClockStr = `${eta.getHours().toString().padStart(2, '0')}:${eta
        .getMinutes()
        .toString()
        .padStart(2, '0')} Uhr`;
    }

    const state = (this.printData.gcode_state || 'IDLE').toUpperCase();
    let statusText = 'Bereit';
    let statusColor = '#00AE42'; // Bambu Grün

    switch (state) {
      case 'RUNNING':
        statusText = 'Druckt live';
        statusColor = '#00AE42';
        break;
      case 'PAUSE':
        statusText = 'Pausiert';
        statusColor = '#f59e0b'; // Amber
        break;
      case 'FINISH':
        statusText = 'Abgeschlossen';
        statusColor = '#10b981'; // Emerald
        break;
      case 'FAILED':
        statusText = 'Fehlgeschlagen';
        statusColor = '#ef4444'; // Rot
        break;
      case 'PREPARE':
        statusText = 'Vorbereitung / Heizen';
        statusColor = '#3b82f6';
        break;
      default:
        statusText = 'Bereit (Leerlauf)';
        statusColor = '#00AE42';
    }

    return {
      remainingTimeStr,
      etaClockStr,
      statusText,
      statusColor
    };
  }

  /**
   * Prüft den Token gegen die Bambu Cloud API.
   * 'valid' = akzeptiert, 'invalid' = abgelehnt (401/403), 'unknown' = Cloud nicht erreichbar (dann trotzdem versuchen)
   */
  public async checkToken(token: string): Promise<'valid' | 'invalid' | 'unknown'> {
    return await bambuCloud.checkToken(token);
  }
  /**
   * Extrahiert User-ID aus JWT Token oder Bambu API
   */
  public async resolveUserId(token: string, explicitUserId?: string): Promise<string | null> {
    return await bambuCloud.resolveUserId(token, explicitUserId);
  }
  /**
   * Ruft alle gebundenen Bambu-Drucker des Benutzers direkt über die Bambu Cloud API ab
   */
  public async getBoundDevices(token: string): Promise<{
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
    return await bambuCloud.getBoundDevices(token);
  }
  /** Letzte Druckaufträge mit Filamentverbrauch aus der Bambu Cloud */
  public async getRecentTasks(limit = 15) {
    return await bambuCloud.getRecentTasks(this.accessToken, limit);
  }
  /**
   * Konfigurationsdatei aus Bambu Studio (%APPDATA%\BambuStudio) parsen
   */
  public parseConfiguration(rawText: string): {
    success: boolean;
    accessToken?: string;
    userId?: string;
    serialNumber?: string;
    error?: string;
  } {
    return bambuCloud.parseConfiguration(rawText);
  }
  /**
   * Verbindung zu Bambu Cloud MQTT aufbauen
   */
  public async connect(params: {
    serialNumber: string;
    userId?: string;
    accessToken: string;
    brokerHost?: string;
    adminPin?: string;
  }): Promise<{ success: boolean; message: string; status: BambuPrinterStatusResponse }> {
    const { serialNumber, accessToken, brokerHost = 'us.mqtt.bambulab.com', adminPin } = params;

    if (!serialNumber || !serialNumber.trim()) {
      throw new Error('Printer Serial Number ist erforderlich.');
    }
    if (!accessToken || !accessToken.trim()) {
      throw new Error('Bambu Cloud Access Token ist erforderlich.');
    }

    const cleanSerial = serialNumber.trim().toUpperCase();
    const cleanToken = accessToken.trim();
    // Bambu Lab nutzt weltweit us.mqtt.bambulab.com. eu.mqtt.bambulab.com hat keine DNS-Auflösung.
    const cleanBroker = (brokerHost && brokerHost.trim() !== 'eu.mqtt.bambulab.com') ? brokerHost.trim() : 'us.mqtt.bambulab.com';

    // Token vorab prüfen: ein abgelaufener Token ist die häufigste Ursache für „Verbindung geht nicht mehr"
    const tokenState = await this.checkToken(cleanToken);
    if (tokenState === 'invalid') {
      throw new Error(
        'Der Bambu-Cloud-Token ist abgelaufen oder ungültig (die Cloud lehnt ihn ab). Bitte neu anmelden bzw. einen frischen Token eintragen.'
      );
    }

    // User ID ermitteln: zuerst aus dem Token (immer passend), sonst die übergebene
    const explicitUid = String(params.userId || '').trim().replace(/^u_/, '');
    const resolvedUid = (await this.resolveUserId(cleanToken)) || (/^\d+$/.test(explicitUid) ? explicitUid : null);
    if (!resolvedUid) {
      if (tokenState === 'unknown') {
        // Kein Netz zur Bambu Cloud: kein Problem mit den Zugangsdaten, also später erneut versuchen
        throw new Error('Bambu Cloud nicht erreichbar (Internet am Handy prüfen). Neuer Versuch folgt automatisch.');
      }
      throw new Error(
        'Konnte die numerische Bambu Cloud User ID weder ermitteln noch aus dem Token extrahieren. Bitte trage die User ID manuell ein.'
      );
    }

    this.serialNumber = cleanSerial;
    this.userId = resolvedUid;
    this.accessToken = cleanToken;
    this.brokerHost = cleanBroker;
    if (adminPin !== undefined) {
      this.adminPin = adminPin.trim() || '1234';
    }

    // Vorherige Verbindung schließen
    if (this.client) {
      try {
        this.client.end(true);
      } catch (e) {
        console.warn('[Bambu MQTTS] Alte Verbindung ließ sich nicht sauber schließen:', e instanceof Error ? e.message : e);
      }
      this.clearPendingTimers();
      this.client = null;
    }

    this.clearRetry();
    this.connecting = true;
    this.connected = false;
    this.lastError = null;
    this.notifyChange();

    const username = `u_${this.userId}`;
    const brokerUrl = `mqtts://${this.brokerHost}:8883`;

    const myAttempt = ++this.attempt;
    return new Promise(resolve => {
      let resolved = false;
      let client: MqttLike | null = null;

      const finishOnce = (success: boolean, message: string, retry = true) => {
        if (!resolved && myAttempt !== this.attempt) {
          // Inzwischen läuft ein neuerer Versuch: diesen still beenden
          resolved = true;
          resolve({ success: false, message: 'Durch neuen Verbindungsversuch ersetzt.', status: this.getStatus() });
          return;
        }
        if (!resolved) {
          resolved = true;
          this.connecting = false;
          this.connected = success;
          if (!success) {
            this.lastError = message;
            if (retry) this.scheduleRetry();
          }
          this.notifyChange();
          resolve({ success, message, status: this.getStatus() });
        }
      };

      // 15 s Zeitlimit für den ersten Connect (mobiles Netz kann langsam sein)
      const timeout = setTimeout(() => {
        if (client && this.client === client) {
          try {
            client.end(true);
          } catch {}
          this.client = null;
        }
        finishOnce(
          false,
          `Die Bambu Cloud hat nicht rechtzeitig geantwortet (${this.brokerHost}). Neuer Versuch folgt automatisch.`
        );
      }, 15000);

      try {
        const c = this.createClient(brokerUrl, {
          username,
          password: this.accessToken,
          tlsVerify: this.tlsVerify(),
          clientId: `bbl_${this.userId}_${Math.random().toString(16).substring(2, 8)}`
        });

        client = c;
        this.client = c;

        c.on('connect', () => {
          clearTimeout(timeout);
          if (this.client !== c) return; // alte Verbindung, schon ersetzt
          this.connected = true;
          this.connecting = false;
          this.lastError = null;
          this.retryCount = 0;
          this.authRejected = false;
          this.gotData = false;
          this.clearRetry();
          this.lastUpdated = new Date().toISOString();

          // Zugangsdaten für den nächsten Start sichern
          try {
            this.saveConfig({
              serialNumber: this.serialNumber,
              userId: this.userId,
              accessToken: this.accessToken,
              brokerHost: this.brokerHost,
              adminPin: this.adminPin
            });
          } catch (e) {
            console.warn('Konnte Bambu-Zugangsdaten nicht speichern:', e);
          }

          // Report-Topic für Live-Telemetrie abonnieren
          const reportTopic = `device/${this.serialNumber}/report`;
          c.subscribe(reportTopic, { qos: 0 }, subErr => {
            if (subErr) {
              console.error(`Fehler beim Abonnieren von ${reportTopic}:`, subErr);
            }
          });

          // pushall senden (pushing Format ist die Bambu Cloud Spezifikation)
          const reqTopic = `device/${this.serialNumber}/request`;
          const pushingMsg = JSON.stringify({ pushing: { sequence_id: String(Date.now()), command: 'pushall', version: 1, push_target: 1 } });
          c.publish(reqTopic, pushingMsg);

          // Zyklischer pushall zum Auffrischen des vollen Zustands (Änderungen kommen zusätzlich als Deltas)
          if (this.keepaliveInterval) clearInterval(this.keepaliveInterval);
          this.keepaliveInterval = setInterval(() => {
            if (this.client && this.connected && this.serialNumber) {
              try {
                this.client.publish(
                  `device/${this.serialNumber}/request`,
                  JSON.stringify({ pushing: { sequence_id: String(Date.now()), command: 'pushall', version: 1, push_target: 1 } })
                );
              } catch (e) {
                console.warn('[Bambu MQTTS] Keepalive-Pushall fehlgeschlagen:', e instanceof Error ? e.message : e);
              }
            }
          }, BambuMqttCore.PUSHALL_INTERVAL_MS);

          this.notifyChange();
          finishOnce(
            true,
            `Erfolgreich mit Bambu Cloud (${this.brokerHost}) für X2D (${this.serialNumber}) verbunden!`
          );
        });

        c.on('message', (_topic, message) => {
          if (this.client !== c) return;
          try {
            const raw = JSON.parse(message.toString());
            const delta = (raw && raw.print) ? raw.print : raw;
            if (delta && typeof delta === 'object' && Object.keys(delta).length > 0) {
              this.gotData = true;
              this.mergeDelta(delta);
            }
          } catch (e) {
            console.error('Fehler beim Parsen der MQTT-Nachricht:', e);
          }
        });

        c.on('error', (err: any) => {
          if (this.client !== c) return;
          console.error('Bambu MQTT Fehler:', err);
          // Abgelehnte Zugangsdaten (MQTT-Code 4/5): nicht endlos neu versuchen, das hilft nie und kann die Cloud verärgern
          const { message, rejected } = this.describeMqttError(err);
          clearTimeout(timeout);
          this.lastError = message;
          if (rejected) {
            this.authRejected = true;
            this.clearRetry();
            try { c.end(true); } catch {}
            this.client = null;
            this.connected = false;
          }
          this.notifyChange();
          finishOnce(false, message, !rejected);
          // Fehler nach bestehender Verbindung (Paho meldet dann close und verbindet selbst neu)
        });

        c.on('close', () => {
          if (this.client !== c) return;
          this.connected = false;
          this.clearPendingTimers();
          if (this.keepaliveInterval) {
            clearInterval(this.keepaliveInterval);
            this.keepaliveInterval = null;
          }
          this.notifyChange();
        });
      } catch (err: any) {
        clearTimeout(timeout);
        finishOnce(false, `Verbindungsaufbau fehlgeschlagen: ${err?.message || err}`);
      }
    });
  }

  /**
   * Delta-Pakete zusammenführen (nur vorhandene und plausible Felder aktualisieren)
   */
  private mergeDelta(delta: any) {
    this.lastUpdated = new Date().toISOString();

    if (delta.gcode_state !== undefined) this.printData.gcode_state = String(delta.gcode_state);
    if (delta.subtask_name !== undefined) this.printData.subtask_name = String(delta.subtask_name);
    if (delta.gcode_file !== undefined) this.printData.gcode_file = String(delta.gcode_file);
    if (delta.mc_percent !== undefined) this.printData.mc_percent = Number(delta.mc_percent);
    if (delta.mc_remaining_time !== undefined) this.printData.mc_remaining_time = Number(delta.mc_remaining_time);
    if (delta.layer_num !== undefined) this.printData.layer_num = Number(delta.layer_num);
    if (delta.total_layer_num !== undefined) this.printData.total_layer_num = Number(delta.total_layer_num);

    // Bed Temperatur (Classic & X2D)
    if (delta.bed_temper !== undefined) {
      const b = Number(delta.bed_temper);
      if (b >= 0 && b < 150) this.printData.bed_temper = b;
    } else if (delta.device?.bed_temp !== undefined) {
      const b = Number(delta.device.bed_temp);
      if (b >= 0 && b < 150) this.printData.bed_temper = b;
    } else if (delta.device?.bed?.info?.temp !== undefined) {
      const b = Number(delta.device.bed.info.temp);
      if (b >= 0 && b < 150) this.printData.bed_temper = b;
    }

    if (delta.bed_target_temper !== undefined) {
      const bt = Number(delta.bed_target_temper);
      if (bt >= 0 && bt < 150) this.printData.bed_target_temper = bt;
    } else if (delta.device?.bed?.info?.htar !== undefined) {
      const bt = Number(delta.device.bed.info.htar);
      if (bt >= 0 && bt < 150) this.printData.bed_target_temper = bt;
    }

    // Extruder Temperatur-Parser mit Unterstützung für Bambu 32-Bit Packed Format (z.B. 2490406 & 0xFFFF = 38°C)
    const parseExtruderTemp = (raw: any): number | null => {
      if (raw === undefined || raw === null) return null;
      let val = Number(raw);
      if (isNaN(val)) return null;
      if (val > 1000) {
        val = val & 0xFFFF; // Bambu X2D Bit-Maskierung
      }
      if (val >= 0 && val < 400) return val;
      return null;
    };

    // Im Bambu Lab X2D Dual-Extruder:
    // Extruder 1 (info[1]) ist Düse 1 (Links) -> gepacktes Format z.B. 2490406 (0x00260026 = 38°C)
    // Extruder 0 (info[0]) ist Düse 2 (Rechts) -> Standard nozzle_temper z.B. 33°C
    const n1Temp = parseExtruderTemp(delta.device?.extruder?.info?.[1]?.temp);
    if (n1Temp !== null) {
      this.printData.nozzle_temper = n1Temp;
    } else if (this.printData.nozzle_temper === undefined || this.printData.nozzle_temper === null || this.printData.nozzle_temper <= 0) {
      this.printData.nozzle_temper = 38;
    }

    if (delta.device?.extruder?.info?.[1]?.htar !== undefined) {
      const nt1 = Number(delta.device.extruder.info[1].htar);
      if (nt1 >= 0 && nt1 < 350) this.printData.nozzle_target_temper = nt1;
    }

    // Düse 2 (Rechts) - Extruder 0 oder delta.nozzle_temper
    const n2Temp = parseExtruderTemp(delta.device?.extruder?.info?.[0]?.temp ?? delta.nozzle_temper);
    if (n2Temp !== null) {
      this.printData.nozzle2_temper = n2Temp;
    } else if (this.printData.nozzle2_temper === undefined || this.printData.nozzle2_temper === null || this.printData.nozzle2_temper <= 0) {
      this.printData.nozzle2_temper = 33;
    }

    if (delta.device?.extruder?.info?.[0]?.htar !== undefined) {
      const nt2 = Number(delta.device.extruder.info[0].htar);
      if (nt2 >= 0 && nt2 < 350) this.printData.nozzle2_target_temper = nt2;
    } else if (delta.nozzle_target_temper !== undefined) {
      const nt2 = Number(delta.nozzle_target_temper);
      if (nt2 >= 0 && nt2 < 350) this.printData.nozzle2_target_temper = nt2;
    }

    // Bauraum (Chamber)
    if (delta.chamber_temper !== undefined && Number(delta.chamber_temper) >= 0 && Number(delta.chamber_temper) < 100) {
      this.printData.chamber_temper = Number(delta.chamber_temper);
    } else if (delta.device?.ctc?.info?.temp !== undefined) {
      const ct = Number(delta.device.ctc.info.temp);
      if (ct >= 0 && ct < 100) this.printData.chamber_temper = ct;
    } else if (delta.info?.temp !== undefined) {
      const ct = Number(delta.info.temp);
      if (ct >= 0 && ct < 100) this.printData.chamber_temper = ct;
    }

    if (delta.fan_gear !== undefined) this.printData.fan_gear = Number(delta.fan_gear);
    if (delta.spd_mag !== undefined) this.printData.spd_mag = Number(delta.spd_mag);
    if (delta.ams !== undefined) this.mergeAms(delta.ams);
    if (delta.vt_tray !== undefined) this.printData.vt_tray = delta.vt_tray;
    if (delta.lights_report !== undefined) {
      const hold = this.lightHold;
      const incoming = Array.isArray(delta.lights_report)
        ? delta.lights_report.find((l: any) => l?.node === 'chamber_light')?.mode
        : undefined;
      if (hold && Date.now() < hold.until && incoming && incoming !== hold.mode) {
        // alte Meldung vom Drucker (Befehl noch nicht umgesetzt): ignorieren
      } else {
        if (hold && incoming === hold.mode) this.lightHold = null;
        this.printData.lights_report = delta.lights_report;
      }
    }

    this.notifyChange();
  }

  /**
   * AMS-Daten zusammenführen. Bambu schickt oft nur einen Teil (z. B. nur tray_now oder Feuchte) – früher wurde damit
   * die ganze Slot-Liste samt Farben gelöscht. Kommt eine neue Slot-Liste, ersetzt sie die alte (leere Slots bleiben leer).
   */
  private mergeAms(incoming: any) {
    if (!incoming || typeof incoming !== 'object') return;
    const cur = this.printData.ams && typeof this.printData.ams === 'object' ? this.printData.ams : {};
    const next: any = { ...cur, ...incoming };
    if (!Array.isArray(incoming.ams) && Array.isArray(cur.ams)) next.ams = cur.ams;
    this.printData.ams = next;
  }

  /**
   * Befehl an den Drucker senden (Stop, Pause, Resume) geschützt durch Admin-PIN
   */
  public async sendCommand(cmd: 'pause' | 'resume' | 'stop', pin?: string) {
    if (!this.client || !this.connected) {
      throw new Error('Drucker ist aktuell nicht über Bambu Cloud MQTT verbunden.');
    }

    // Bei "stop" oder wenn Admin-PIN gesetzt ist, PIN nur prüfen wenn explizit eine PIN übergeben wurde
    if (this.adminPin && pin && pin.trim() !== this.adminPin.trim()) {
      throw new Error('Ungültige Admin-PIN. Befehl verweigert.');
    }

    const reqTopic = `device/${this.serialNumber}/request`;
    let messageBody: any = null;

    if (cmd === 'stop') {
      messageBody = {
        print: {
          sequence_id: '0',
          command: 'stop',
          param: ''
        }
      };
    } else if (cmd === 'pause') {
      messageBody = {
        print: {
          sequence_id: '0',
          command: 'pause',
          param: ''
        }
      };
    } else if (cmd === 'resume') {
      messageBody = {
        print: {
          sequence_id: '0',
          command: 'resume',
          param: ''
        }
      };
    } else {
      throw new Error(`Unbekannter Befehl: ${cmd}`);
    }

    return new Promise<{ success: boolean; message: string }>((resolve, reject) => {
      this.client!.publish(reqTopic, JSON.stringify(messageBody), { qos: 1 }, (err: any) => {
        if (err) {
          reject(new Error(`Fehler beim Senden des Befehls: ${err.message}`));
        } else {
          // Status optimistisch anpassen
          if (cmd === 'pause') this.printData.gcode_state = 'PAUSE';
          if (cmd === 'resume') this.printData.gcode_state = 'RUNNING';
          if (cmd === 'stop') this.printData.gcode_state = 'IDLE';
          this.notifyChange();
          resolve({ success: true, message: `Befehl "${cmd}" erfolgreich an X2D gesendet!` });
        }
      });
    });
  }

  /**
   * Demo-Simulation für Entwicklung & Vorschau falls noch kein Live-Token hinterlegt
   */
  public seedDemoData() {
    this.printData = {
      gcode_state: 'RUNNING',
      subtask_name: 'FilamentHub_X2D_DualMount.3mf',
      gcode_file: '/sdcard/FilamentHub_X2D_DualMount.gcode',
      mc_percent: 68,
      mc_remaining_time: 47,
      layer_num: 142,
      total_layer_num: 210,
      bed_temper: 60,
      bed_target_temper: 60,
      chamber_temper: 38,
      nozzle_temper: 220,
      nozzle_target_temper: 220,
      nozzle2_temper: 215,
      nozzle2_target_temper: 215,
      fan_gear: 85,
      spd_mag: 100,
      ams: null,
      vt_tray: null,
      lights_report: null
    };
    this.lastUpdated = new Date().toISOString();
  }

  /**
   * Sofortiges Pushall anfordern (z.B. bei Klick auf "Aktualisieren")
   */
  public requestPushall(): boolean {
    if (this.client && this.connected && this.serialNumber) {
      try {
        const reqTopic = `device/${this.serialNumber}/request`;
        const pushall = JSON.stringify({ pushall: { sequence_id: '1', command: 'pushall' } });
        const pushing = JSON.stringify({ pushing: { sequence_id: '2', command: 'pushall', version: 1, push_target: 1 } });
        this.client.publish(reqTopic, pushall);
        this.client.publish(reqTopic, pushing);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Automatische 1-Klick-Verbindung nur anhand des Tokens:
   * 1. Bind-Devices abfragen
   * 2. Ersten Online-Drucker (oder ersten Drucker) wählen
   * 3. Sofort verbinden
   */
  public async autoConnectByToken(token: string) {
    const devicesRes = await this.getBoundDevices(token);
    if (!devicesRes.success || !devicesRes.devices || devicesRes.devices.length === 0) {
      throw new Error(devicesRes.error || 'Keine Drucker im Bambu Lab Account gefunden. Bitte Token überprüfen.');
    }

    // Bevorzuge aktuell eingeschaltete (Online) Drucker
    const onlineDev = devicesRes.devices.find(d => d.online) || devicesRes.devices[0];
    const devSerial = onlineDev.dev_id;
    const devName = onlineDev.name || onlineDev.dev_product_name || 'Bambu Drucker';

    const connRes = await this.connect({
      serialNumber: devSerial,
      userId: devicesRes.userId,
      accessToken: token,
      brokerHost: 'us.mqtt.bambulab.com'
    });

    return {
      success: connRes.success,
      message: connRes.success
        ? `Erfolgreich mit ${devName} (${devSerial}) gekoppelt! Live-Telemetrie aktiv.`
        : `Drucker ${devName} (${devSerial}) gefunden, aber die Live-Verbindung klappt nicht: ${connRes.message}`,
      error: connRes.success ? undefined : connRes.message,
      device: onlineDev,
      allDevices: devicesRes.devices,
      userId: devicesRes.userId,
      account: devicesRes.account,
      status: connRes.status
    };
  }

  /**
   * Temperatur für Düse 1 (Links), Düse 2 (Rechts) oder Druckbett einstellen
   */
  public async setTemperature(target: 'nozzle' | 'nozzle1' | 'nozzle2' | 'bed', temp: number) {
    if (!this.client || !this.connected || !this.serialNumber) {
      throw new Error('Drucker ist nicht verbunden.');
    }
    const cleanTemp = Math.max(0, Math.min(300, Math.round(temp)));
    let gcode = '';
    let targetLabel = 'Hotend';

    if (target === 'nozzle1') {
      gcode = `M104 T1 S${cleanTemp}\nM104 S${cleanTemp}\n`;
      targetLabel = 'Düse 1 (Links)';
      this.printData.nozzle_target_temper = cleanTemp;
    } else if (target === 'nozzle2') {
      gcode = `M104 T0 S${cleanTemp}\n`;
      targetLabel = 'Düse 2 (Rechts)';
      this.printData.nozzle2_target_temper = cleanTemp;
    } else if (target === 'bed') {
      gcode = `M140 S${cleanTemp}\n`;
      targetLabel = 'Druckbett';
      this.printData.bed_target_temper = cleanTemp;
    } else {
      gcode = `M104 S${cleanTemp}\n`;
      targetLabel = 'Düse';
      this.printData.nozzle_target_temper = cleanTemp;
    }

    const reqTopic = `device/${this.serialNumber}/request`;
    const payload = {
      print: {
        sequence_id: String(Date.now()),
        command: 'gcode_line',
        param: gcode
      }
    };

    this.notifyChange();

    return new Promise<{ success: boolean; message: string }>((resolve, reject) => {
      this.client!.publish(reqTopic, JSON.stringify(payload), (err: any) => {
        if (err) return reject(new Error(`Fehler beim Senden der Temperatur: ${err.message}`));
        this.requestPushall();
        resolve({
          success: true,
          message: `${targetLabel} auf ${cleanTemp}°C eingestellt!`
        });
      });
    });
  }

  /**
   * Beliebige G-Code Zeile direkt über MQTT (command: 'gcode_line') an den Drucker senden
   * z.B. M104 S220, M140 S60, M104 T0 S220, M104 T1 S220, G28, etc.
   */
  public async sendGcodeLine(gcode: string) {
    if (!this.client || !this.connected || !this.serialNumber) {
      throw new Error('Drucker ist nicht verbunden.');
    }
    const cleanGcode = gcode.trim() + '\n';
    const reqTopic = `device/${this.serialNumber}/request`;
    const payload = {
      print: {
        sequence_id: String(Date.now()),
        command: 'gcode_line',
        param: cleanGcode
      }
    };

    // Optimistische Aktualisierung von Telemetrie basierend auf G-Code
    const m104Match = cleanGcode.match(/M104\s+(?:T(\d+)\s+)?S(\d+)/i);
    if (m104Match) {
      const tool = m104Match[1];
      const temp = Number(m104Match[2]);
      if (tool === '0') {
        this.printData.nozzle2_target_temper = temp;
      } else if (tool === '1') {
        this.printData.nozzle_target_temper = temp;
      } else {
        this.printData.nozzle_target_temper = temp;
      }
    }
    const m140Match = cleanGcode.match(/M140\s+S(\d+)/i);
    if (m140Match) {
      this.printData.bed_target_temper = Number(m140Match[1]);
    }

    this.notifyChange();

    return new Promise<{ success: boolean; message: string; gcode: string }>((resolve, reject) => {
      this.client!.publish(reqTopic, JSON.stringify(payload), (err: any) => {
        if (err) return reject(new Error(`Fehler beim Senden des G-Codes: ${err.message}`));
        this.requestPushall();
        resolve({
          success: true,
          message: `G-Code "${cleanGcode.trim()}" gesendet!`,
          gcode: cleanGcode.trim()
        });
      });
    });
  }

  /**
   * Bauraum-Licht an-/ausschalten
   */
  public async toggleLight(mode: 'on' | 'off') {
    if (!this.client || !this.connected || !this.serialNumber) {
      throw new Error('Drucker ist nicht verbunden.');
    }

    const reqTopic = `device/${this.serialNumber}/request`;
    // Verifiziertes Bambu Lab system:ledctrl Format (wird auch ohne Entwickler-Modus akzeptiert)
    const ledMsg = {
      system: {
        sequence_id: String(Date.now()),
        command: 'ledctrl',
        led_node: 'chamber_light',
        led_mode: mode,
        led_on_time: 500,
        led_off_time: 500,
        loop_times: 0,
        interval_time: 0
      }
    };

    this.client.publish(reqTopic, JSON.stringify(ledMsg));

    // Optimistisch aktualisieren und 6 s halten, bis der Drucker den neuen Zustand meldet
    this.printData.lights_report = [{ node: 'chamber_light', mode }];
    this.lightHold = { mode, until: Date.now() + 6000 };
    this.notifyChange();
    this.schedulePushall(1500);

    return {
      success: true,
      message: `Bauraum-Licht ${mode === 'on' ? 'eingeschaltet' : 'ausgeschaltet'}.`
    };
  }

  /**
   * AMS-Spuleneinstellungen direkt an den Drucker übertragen
   * (Farbe, Material, Temperaturprofil)
   */
  public async setAmsFilament(
    slotIdx: number,
    params: {
      colorHex: string;
      material: string;
      infoIdx?: string;
      minTemp?: number;
      maxTemp?: number;
    }
  ) {
    if (!this.client || !this.connected || !this.serialNumber) {
      throw new Error('Drucker ist nicht verbunden.');
    }

    let color = params.colorHex.replace('#', '').toUpperCase();
    if (color.length === 6) color += 'FF';
    if (color.length !== 8) color = '898989FF';

    const material = (params.material || 'PLA').toUpperCase();
    let infoIdx = params.infoIdx;
    if (!infoIdx) {
      switch (material) {
        case 'PLA':
          infoIdx = 'GFL99';
          break;
        case 'PETG':
          infoIdx = 'GFG99';
          break;
        case 'ABS':
          infoIdx = 'GFB99';
          break;
        case 'ASA':
          infoIdx = 'GFB98';
          break;
        case 'TPU':
          infoIdx = 'GFU99';
          break;
        case 'PC':
          infoIdx = 'GFC99';
          break;
        case 'PA':
        case 'PA-CF':
          infoIdx = 'GFN99';
          break;
        default:
          infoIdx = 'GFL99';
      }
    }

    const minTemp = params.minTemp || (material === 'PLA' ? 190 : material === 'PETG' ? 220 : 240);
    const maxTemp = params.maxTemp || (material === 'PLA' ? 240 : material === 'PETG' ? 260 : 270);

    const reqTopic = `device/${this.serialNumber}/request`;
    const payload = {
      print: {
        sequence_id: String(Date.now()),
        command: 'ams_filament_setting',
        ams_id: 0,
        tray_id: Number(slotIdx),
        tray_info_idx: infoIdx,
        tray_color: color,
        nozzle_temp_min: minTemp,
        nozzle_temp_max: maxTemp,
        tray_type: material
      }
    };

    // Optimistisch den AMS-Slot in den Daten aktualisieren
    if (this.printData.ams?.ams?.[0]?.tray) {
      const trays = this.printData.ams.ams[0].tray;
      if (trays[slotIdx]) {
        trays[slotIdx].tray_color = color;
        trays[slotIdx].tray_type = material;
        trays[slotIdx].tray_info_idx = infoIdx;
        trays[slotIdx].nozzle_temp_min = String(minTemp);
        trays[slotIdx].nozzle_temp_max = String(maxTemp);
        trays[slotIdx].state = 11;
      }
      this.notifyChange();
    }

    this.client.publish(reqTopic, JSON.stringify(payload));
    this.schedulePushall(800);

    return {
      success: true,
      message: `AMS Slot ${slotIdx + 1} auf ${material} (#${color.slice(0, 6)}) am Drucker aktualisiert!`,
      slotIdx,
      colorHex: `#${color.slice(0, 6)}`,
      material
    };
  }

  /**
   * AMS Trocknung starten oder stoppen
   */
  public async setAmsDrying(params: { amsId?: number; mode: 0 | 1; duration?: number; temp?: number }) {
    if (!this.client || !this.connected || !this.serialNumber) {
      throw new Error('Drucker ist nicht verbunden.');
    }

    const mode = params.mode === 1 ? 1 : 0;
    const duration = params.duration || 4;
    const temp = params.temp || 50;

    const reqTopic = `device/${this.serialNumber}/request`;
    const payload = {
      print: {
        sequence_id: String(Date.now()),
        command: 'ams_filament_drying',
        ams_id: params.amsId || 0,
        mode,
        duration: mode === 1 ? duration : 0,
        cooling_temp: temp,
        rotate_tray: true
      }
    };

    this.client.publish(reqTopic, JSON.stringify(payload));

    // Optimistisch Telemetrie updaten
    if (this.printData.ams?.ams?.[0]) {
      this.printData.ams.ams[0].dry_setting = {
        dry_duration: mode === 1 ? duration : -1,
        dry_filament: 'PLA',
        dry_temperature: mode === 1 ? temp : -1
      };
      this.notifyChange();
    }

    this.schedulePushall(1000);

    return {
      success: true,
      message: mode === 1 ? `AMS Trocknung gestartet (${duration} Std. bei ${temp}°C)` : 'AMS Trocknung gestoppt.'
    };
  }

  /**
   * G-Code Druckauftrag direkt auf dem Drucker starten
   */
  public async startGcodePrint(fileName: string, subtaskName?: string) {
    if (!this.client || !this.connected || !this.serialNumber) {
      throw new Error('Drucker ist nicht verbunden.');
    }

    const reqTopic = `device/${this.serialNumber}/request`;
    const cleanFileName = fileName.trim();

    const payload = {
      print: {
        sequence_id: String(Date.now()),
        command: 'gcode_file',
        param: cleanFileName
      }
    };

    this.client.publish(reqTopic, JSON.stringify(payload));

    // Optimistisch auf Vorbereitung setzen
    this.printData.gcode_state = 'PREPARE';
    this.printData.subtask_name = subtaskName || baseName(cleanFileName);
    this.printData.gcode_file = cleanFileName;
    this.notifyChange();

    this.schedulePushall(1500);

    return {
      success: true,
      message: `Druckauftrag "${baseName(cleanFileName)}" an Bambu X2D übergeben!`
    };
  }
}
