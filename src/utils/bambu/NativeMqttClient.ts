// MqttLike-Client für die Android-App: nutzt das native Plugin FilamentMqtt (Paho, TLS).
import type { MqttLike, MqttConnectOptions } from './BambuMqttCore';
import { getNativePlugin } from '../nativeBridge';

type Handler = (...args: any[]) => void;

const clients = new Map<string, NativeMqttClient>();
let listening = false;

function ensureListener() {
  if (listening) return;
  const plugin = getNativePlugin('FilamentMqtt');
  if (!plugin) return;
  listening = true;
  plugin.on('event', (e: any) => clients.get(e?.id)?.handle(e));
}

export class NativeMqttClient implements MqttLike {
  private handlers: Record<string, Handler[]> = {};
  private readonly id = 'c' + Math.random().toString(16).slice(2, 10);
  private ended = false;

  constructor(url: string, private options: MqttConnectOptions) {
    const plugin = getNativePlugin('FilamentMqtt');
    if (!plugin) {
      setTimeout(() => this.emit('error', new Error('Natives MQTT-Plugin nicht gefunden. Bitte die neueste App installieren.')), 0);
      return;
    }
    ensureListener();
    clients.set(this.id, this);
    // Paho erwartet ssl:// statt mqtts://
    const paho = url.replace(/^mqtts?:\/\//, 'ssl://').replace(/^(?!ssl:|tcp:)/, 'ssl://');
    plugin
      .call('connect', {
        id: this.id,
        url: paho,
        username: options.username,
        password: options.password,
        clientId: options.clientId,
        // LAN-Modus: der Drucker hat ein selbstsigniertes Zertifikat
        insecure: options.lan === true
      })
      .catch(err => this.emit('error', err));
  }

  handle(e: any) {
    if (this.ended) return;
    if (e.type === 'connect') this.emit('connect');
    else if (e.type === 'close') this.emit('close');
    else if (e.type === 'message') this.emit('message', e.topic, { toString: () => e.payload ?? '' });
    else if (e.type === 'error') this.emit('error', new Error(e.message || 'MQTT-Fehler' + (e.code != null ? ' (' + e.code + ')' : '')));
  }

  on(event: string, cb: Handler) {
    (this.handlers[event] ||= []).push(cb);
  }

  private emit(event: string, ...args: any[]) {
    for (const h of this.handlers[event] || []) {
      try {
        h(...args);
      } catch (err) {
        console.warn('MQTT-Handler Fehler:', err);
      }
    }
  }

  subscribe(topic: string, opts: { qos: 0 | 1 | 2 }, cb?: (err?: any) => void) {
    const plugin = getNativePlugin('FilamentMqtt');
    plugin?.call('subscribe', { id: this.id, topic, qos: opts?.qos ?? 0 }).then(() => cb?.(), err => cb?.(err));
  }

  publish(topic: string, payload: string, a?: any, b?: any) {
    const cb: ((err?: any) => void) | undefined = typeof a === 'function' ? a : b;
    const qos = a && typeof a === 'object' ? a.qos ?? 0 : 0;
    const plugin = getNativePlugin('FilamentMqtt');
    plugin?.call('publish', { id: this.id, topic, payload, qos }).then(() => cb?.(), err => cb?.(err));
  }

  end(_force?: boolean) {
    this.ended = true;
    clients.delete(this.id);
    getNativePlugin('FilamentMqtt')?.call('disconnect', { id: this.id }).catch(() => {});
  }
}
