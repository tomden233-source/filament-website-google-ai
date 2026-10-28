import { getSpoolProfile } from '../../utils/spoolProfile';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Nfc, Check, Loader2 } from 'lucide-react';
import { printerApi } from '../../api/printerApi';
import type { Spool } from '../../types/filament';
import { isWebNfcSupported, parseNfcContent, openTag3dToJsonText, playNfcSuccessChime, triggerNfcHaptic } from '../../utils/nfcManager';
import { OPENTAG3D_MIME } from '../../utils/openTag3d';

// NFC → AMS-Slot: Spule ans Handy halten, Slot wählen, Farbe/Material/Temperatur gehen per Befehl an den Drucker.
// (Der AMS liest keine NFC-Tags, deshalb setzt die App die Slot-Daten selbst.)

interface Props {
  spools: Spool[];
  onClose: () => void;
}

interface Picked {
  temps?: [number, number];
  material: string;
  colorHex: string;
  label: string;
}

const TEMPS: Record<string, [number, number]> = {
  PLA: [190, 230],
  PETG: [220, 260],
  ABS: [240, 270],
  ASA: [240, 270],
  TPU: [200, 230],
  PA: [260, 290],
  PC: [250, 280],
  PVA: [190, 220]
};

const tempsFor = (material: string): [number, number] => {
  const key = Object.keys(TEMPS).find(k => material.toUpperCase().startsWith(k));
  return key ? TEMPS[key] : [190, 250];
};

function decodeRecords(records: any[]): string {
  for (const r of records) {
    try {
      if (r.recordType === 'mime' && r.mediaType === OPENTAG3D_MIME) {
        const dv: DataView = r.data;
        return openTag3dToJsonText(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength));
      }
      if (r.recordType === 'text' || r.recordType === 'mime') {
        const dv: DataView = r.data;
        return new TextDecoder(r.encoding || 'utf-8').decode(dv);
      }
    } catch {
      // nächsten Record versuchen
    }
  }
  return '';
}

export const NfcSlotModal: React.FC<Props> = ({ spools, onClose }) => {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [slot, setSlot] = useState(0);
  const [minT, setMinT] = useState(190);
  const [maxT, setMaxT] = useState(230);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const supported = isWebNfcSupported();

  const choose = useCallback((p: Picked) => {
    setPicked(p);
    const [a, b] = p.temps || tempsFor(p.material);
    setMinT(a);
    setMaxT(b);
    setResult(null);
  }, []);

  const fromSpool = useCallback(
    (s: Spool) => {
      // Gespeichertes Profil der Spule (eigene Temperaturen) hat Vorrang vor dem Standard
      const prof = getSpoolProfile(s);
      choose({
        material: s.material,
        colorHex: s.colorHex || '#888888',
        label: `${s.brand} ${s.name}`,
        temps: [prof.minTemp, prof.maxTemp]
      });
    },
    [choose]
  );

  useEffect(() => {
    if (!supported) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    (async () => {
      try {
        const reader = new (window as any).NDEFReader();
        reader.onreading = (ev: any) => {
          const text = decodeRecords(ev.message?.records || []);
          const parsed = parseNfcContent(text, ev.serialNumber, spools);
          const spool = parsed.matchedSpool;
          if (spool) {
            fromSpool(spool);
          } else if (parsed.payload?.material) {
            choose({
              material: parsed.payload.material,
              colorHex: parsed.payload.colorHex || '#888888',
              label: `${parsed.payload.brand || ''} ${parsed.payload.name || parsed.payload.material}`.trim()
            });
          } else {
            setScanError('Dieser Tag enthält keine Spulendaten. Bitte unten eine Spule wählen.');
            return;
          }
          setScanError(null);
          triggerNfcHaptic();
          playNfcSuccessChime();
        };
        reader.onreadingerror = () => setScanError('Tag konnte nicht gelesen werden. Bitte näher halten.');
        await reader.scan({ signal: ctrl.signal });
      } catch (err: any) {
        if (err?.name !== 'AbortError') setScanError(err?.message || 'NFC konnte nicht gestartet werden.');
      }
    })();
    return () => ctrl.abort();
  }, [supported, spools, fromSpool, choose]);

  const send = async () => {
    if (!picked) return;
    setSending(true);
    setResult(null);
    try {
      const res = await printerApi.amsFilament({
        slotIdx: slot,
        colorHex: picked.colorHex,
        material: picked.material,
        minTemp: minT,
        maxTemp: maxT
      });
      if (res.ok && res.data?.success !== false) {
        setResult({ ok: true, text: res.data?.message || `Slot ${slot + 1} ist gesetzt.` });
      } else {
        setResult({ ok: false, text: res.data?.error || 'Drucker hat den Befehl abgelehnt (Entwicklermodus nötig?).' });
      }
    } catch {
      setResult({ ok: false, text: 'Verbindungsfehler zum Drucker.' });
    }
    setSending(false);
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
      <div
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border p-4 space-y-3"
        style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm flex items-center gap-2">
            <Nfc className="w-4 h-4" style={{ color: 'var(--app-accent)' }} />
            NFC → AMS-Slot
          </h3>
          <button onClick={onClose} aria-label="Schließen" className="p-1.5 rounded-lg border cursor-pointer" style={{ borderColor: 'var(--app-border)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {supported ? (
          <div className="rounded-xl border p-3 text-xs flex items-center gap-2" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}>
            <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: 'var(--app-accent)' }} />
            <span>Spule mit NFC-Tag ans Handy halten …</span>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500">
            NFC ist hier nicht verfügbar. Wähle die Spule unten aus der Liste.
          </div>
        )}
        {scanError && <div className="text-[11px] text-rose-400">{scanError}</div>}

        <select
          value=""
          onChange={e => {
            const s = spools.find(x => x.id === e.target.value);
            if (s) fromSpool(s);
          }}
          className="w-full px-2 py-2 rounded-lg text-xs border outline-none"
          style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
        >
          <option value="">Oder Spule aus der Liste wählen …</option>
          {spools.map(s => (
            <option key={s.id} value={s.id}>
              {s.brand} {s.name} ({s.material})
            </option>
          ))}
        </select>

        {picked && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl border p-3" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}>
              <span className="w-6 h-6 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: picked.colorHex }} />
              <div className="min-w-0">
                <div className="text-xs font-extrabold break-words">{picked.label}</div>
                <div className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>{picked.material}</div>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold mb-1">AMS-Slot</div>
              <div className="grid grid-cols-4 gap-1.5">
                {[0, 1, 2, 3].map(i => (
                  <button
                    key={i}
                    onClick={() => setSlot(i)}
                    className="py-2 rounded-lg border text-xs font-bold cursor-pointer transition"
                    style={{
                      backgroundColor: slot === i ? 'var(--app-accent)' : 'var(--app-card-sub)',
                      borderColor: slot === i ? 'var(--app-accent)' : 'var(--app-border)',
                      color: slot === i ? '#fff' : 'var(--app-text)'
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                ['Düse min °C', minT, setMinT],
                ['Düse max °C', maxT, setMaxT]
              ].map(([label, value, setter]: any) => (
                <label key={label} className="text-[11px] font-bold space-y-1 block">
                  <span>{label}</span>
                  <input
                    type="number"
                    value={value}
                    onChange={e => setter(Number(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 rounded-lg text-xs font-mono-num border outline-none"
                    style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                  />
                </label>
              ))}
            </div>

            <button
              onClick={send}
              disabled={sending}
              className="w-full py-2.5 rounded-xl text-xs font-extrabold text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              style={{ backgroundColor: 'var(--app-accent)' }}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              In Slot {slot + 1} übertragen
            </button>
          </div>
        )}

        {result && (
          <div className={`rounded-xl border p-3 text-xs ${result.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-rose-500/30 bg-rose-500/10 text-rose-400'}`}>
            {result.text}
          </div>
        )}
      </div>
    </div>
  );
};
