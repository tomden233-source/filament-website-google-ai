// Server-Anbindung an den gemeinsamen MQTT-Kern (src/utils/bambu/BambuMqttCore.ts):
// Verbindung über das Node-Paket "mqtt", Zugangsdaten in .bambu-config.json, Live-Status per Server-Sent Events.
import mqtt from 'mqtt';
import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import {
  BambuMqttCore,
  type MqttLike,
  type MqttConnectOptions,
  type SavedBambuConfig
} from '../src/utils/bambu/BambuMqttCore.js';

export type { BambuPrinterData, BambuPrinterStatusResponse } from '../src/utils/bambu/BambuMqttCore.js';

class BambuMqttService extends BambuMqttCore {
  private sseClients: Response[] = [];
  private readonly configFilePath: string = path.resolve(process.cwd(), '.bambu-config.json');

  protected createClient(url: string, options: MqttConnectOptions): MqttLike {
    const client = mqtt.connect(url, {
      username: options.username,
      password: options.password,
      // Standard aus, weil Bambu-Drucker im LAN selbstsignierte Zertifikate nutzen.
      // Mit BAMBU_TLS_VERIFY=true wird das Zertifikat geprüft (sinnvoll für die Bambu Cloud).
      rejectUnauthorized: options.tlsVerify,
      port: 8883,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 6000,
      clientId: options.clientId
    });
    return client as unknown as MqttLike;
  }

  protected tlsVerify(): boolean {
    return process.env.BAMBU_TLS_VERIFY === 'true';
  }

  protected loadConfig(): SavedBambuConfig | null {
    if (!fs.existsSync(this.configFilePath)) return null;
    return JSON.parse(fs.readFileSync(this.configFilePath, 'utf-8'));
  }

  protected saveConfig(config: Required<SavedBambuConfig>): void {
    fs.writeFileSync(this.configFilePath, JSON.stringify(config, null, 2), 'utf-8');
  }

  protected envOverrides(): SavedBambuConfig {
    return {
      serialNumber: process.env.BAMBU_SERIAL,
      userId: process.env.BAMBU_USER_ID,
      accessToken: process.env.BAMBU_ACCESS_TOKEN,
      adminPin: process.env.BAMBU_ADMIN_PIN
    };
  }

  public registerSseClient(res: Response) {
    this.sseClients.push(res);
    // Sofort ersten Status senden
    res.write(`data: ${JSON.stringify(this.getStatus())}\n\n`);

    res.on('close', () => {
      this.sseClients = this.sseClients.filter(c => c !== res);
    });
  }

  protected notifyChange(): void {
    const payload = `data: ${JSON.stringify(this.getStatus())}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(payload);
      } catch {
        // Fehler ignorieren
      }
    }
  }
}

export const bambuService = new BambuMqttService();
bambuService.init();
