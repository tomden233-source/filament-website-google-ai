// Drucker-Ablauf: Befehl senden, Antwort abwarten, Etikett übertragen (nach dem Ablauf der Hersteller-App).
import type { Link, Logger } from './links';
import {
  CMD,
  FrameReader,
  buildDataFrames,
  makeCmd,
  parseDeviceName,
  parseMaterial,
  parseStatus,
  statusError,
  type MaterialInfo,
  type PrinterStatus
} from './protocol';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export interface PrinterInfo {
  name: string | null;
  material: MaterialInfo | null;
  status: PrinterStatus | null;
}

export class PrinterError extends Error {}

type Waiter = { accept: (f: Uint8Array) => boolean; resolve: (f: Uint8Array | null) => void };

export class Printer {
  private reader = new FrameReader();
  private waiters: Waiter[] = [];
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(readonly link: Link, private log: Logger) {
    link.onData = bytes => this.receive(bytes);
  }

  private receive(bytes: Uint8Array) {
    for (const f of this.reader.push(bytes)) this.dispatch(f);
    clearTimeout(this.idleTimer);
    if (this.reader.pending > 0) {
      this.idleTimer = setTimeout(() => {
        const partial = this.reader.flush();
        if (partial) this.dispatch(partial);
      }, 150);
    }
  }

  private dispatch(frame: Uint8Array) {
    const i = this.waiters.findIndex(w => w.accept(frame));
    if (i >= 0) this.waiters.splice(i, 1)[0].resolve(frame);
  }

  private waitFor(accept: (f: Uint8Array) => boolean, ms: number): Promise<Uint8Array | null> {
    return new Promise(resolve => {
      const waiter: Waiter = {
        accept,
        resolve: f => {
          clearTimeout(timer);
          resolve(f);
        }
      };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter(w => w !== waiter);
        resolve(null);
      }, ms);
      this.waiters.push(waiter);
    });
  }

  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {});
    return run;
  }

  async command(cmd: number, p1 = 0, p2 = 0): Promise<Uint8Array | null> {
    const reply = this.waitFor(f => f[7] === cmd, this.link.responseTimeoutMs);
    await this.link.write(makeCmd(cmd, p1, p2));
    return reply;
  }

  async status(): Promise<PrinterStatus | null> {
    const r = await this.command(CMD.INQUIRY_STA);
    return r ? parseStatus(r) : null;
  }

  info(): Promise<PrinterInfo> {
    return this.exclusive(async () => {
      if (!(await this.command(CMD.CHECK_DEVICE))) {
        throw new PrinterError('Der Drucker antwortet nicht. Ist er eingeschaltet?');
      }
      const name = await this.command(CMD.RD_DEV_NAME);
      const mat = await this.command(CMD.RETURN_MAT);
      const status = await this.status();
      return {
        name: name ? parseDeviceName(name) : null,
        material: mat ? parseMaterial(mat) : null,
        status
      };
    });
  }

  private async poll(attempts: number, ms: number, until: (s: PrinterStatus) => boolean) {
    for (let i = 0; i < attempts; i++) {
      const s = await this.status();
      if (s && until(s)) return s;
      await sleep(ms);
    }
    return null;
  }

  private throwOnError(s: PrinterStatus) {
    const e = statusError(s);
    if (e) throw new PrinterError(e + '.');
  }

  /** Ein Etikett drucken. onProgress liefert 0..1. */
  print(blocks: Uint8Array[], speed: number, onProgress: (p: number) => void): Promise<void> {
    return this.exclusive(async () => {
      if (!(await this.command(CMD.CHECK_DEVICE))) {
        throw new PrinterError('Der Drucker antwortet nicht. Ist er eingeschaltet?');
      }
      const ready = await this.poll(60, 100, s => !s.busy && !s.printing);
      if (!ready) throw new PrinterError('Der Drucker ist beschäftigt.');
      this.throwOnError(ready);

      await this.command(CMD.START_PRINT);
      const started = await this.poll(60, 100, s => s.printing || statusError(s) !== null);
      if (started) this.throwOnError(started);

      for (const [i, block] of blocks.entries()) {
        const room = await this.poll(200, 20, s => !s.bufFull || statusError(s) !== null);
        if (!room) throw new PrinterError('Zeitüberschreitung beim Warten auf Pufferplatz.');
        if (statusError(room)) {
          await this.command(CMD.STOP_PRINT);
          this.throwOnError(room);
        }
        await this.transfer(block, speed);
        onProgress((i + 1) / blocks.length);
      }

      const done = await this.poll(300, 100, s => (!s.printing && !s.busy && !s.bufFull) || statusError(s) !== null);
      if (!done) throw new PrinterError('Der Drucker hat das Etikett nicht fertig gedruckt.');
      this.throwOnError(done);
    });
  }

  private async transfer(block: Uint8Array, speed: number) {
    const frames = buildDataFrames(block);
    if (!(await this.command(CMD.NEXT_ZIPPEDBULK, 512, frames.length))) {
      throw new PrinterError('Der Drucker nimmt die Bilddaten nicht an.');
    }
    for (const frame of frames) await this.link.write(frame);
    await sleep(100);
    await this.command(CMD.BUF_FULL, block.length, speed);
    await sleep(100);
  }

  feed(): Promise<void> {
    return this.exclusive(async () => {
      if (!(await this.command(CMD.PAPER_SKIP))) throw new PrinterError('Der Drucker antwortet nicht.');
    });
  }

  close() {
    this.log('Drucker getrennt');
    return this.link.close();
  }
}
