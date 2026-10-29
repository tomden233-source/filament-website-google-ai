import React, { useEffect, useRef, useState } from 'react';
import { BellOff, CheckCheck, CheckCircle2, ChevronDown, Droplets, Info, PackageMinus, Trash2, XCircle } from 'lucide-react';
import { clearInbox, markAllInboxRead, markInboxRead, removeInbox, useInbox, type InboxItem, type InboxKind } from '../../utils/inbox';
import { Card, buttonStyle } from './ui';

const KIND: Record<InboxKind, { icon: React.ComponentType<{ className?: string }>; tone: string; label: string }> = {
  'print-done': { icon: CheckCircle2, tone: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30', label: 'Druck' },
  'print-fail': { icon: XCircle, tone: 'text-rose-400 bg-rose-500/15 border-rose-500/30', label: 'Druck' },
  'dry-due': { icon: Droplets, tone: 'text-amber-400 bg-amber-500/15 border-amber-500/30', label: 'Trocknen' },
  'dry-done': { icon: Droplets, tone: 'text-sky-400 bg-sky-500/15 border-sky-500/30', label: 'Trocknen' },
  low: { icon: PackageMinus, tone: 'text-rose-400 bg-rose-500/15 border-rose-500/30', label: 'Bestand' },
  info: { icon: Info, tone: 'text-slate-400 bg-slate-500/15 border-slate-500/30', label: 'Info' }
};

function whenText(at: number): string {
  const d = new Date(at);
  const diff = Date.now() - at;
  if (diff < 60_000) return 'gerade eben';
  if (diff < 3_600_000) return `vor ${Math.floor(diff / 60_000)} min`;
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (new Date().toDateString() === d.toDateString()) return `heute ${time} Uhr`;
  return `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} ${time} Uhr`;
}

const Row: React.FC<{ item: InboxItem; open: boolean; onToggle: () => void; refEl?: React.Ref<HTMLDivElement> }> = ({ item, open, onToggle, refEl }) => {
  const k = KIND[item.kind] || KIND.info;
  const Icon = k.icon;
  return (
    <div
      ref={refEl}
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--app-card-sub)', borderColor: open ? 'var(--app-accent)' : 'var(--app-border)' }}
    >
      <button type="button" onClick={onToggle} className="w-full flex items-start gap-3 p-3 text-left cursor-pointer" aria-expanded={open}>
        <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${k.tone}`}>
          <Icon className="w-4.5 h-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-xs font-extrabold truncate" style={{ color: 'var(--app-text)' }}>
              {item.title}
            </span>
            {!item.read && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'var(--app-accent)' }} aria-label="ungelesen" />}
          </span>
          <span className={`text-[11px] leading-snug block ${open ? '' : 'line-clamp-2'}`} style={{ color: 'var(--app-text-muted)' }}>
            {item.text}
          </span>
          <span className="text-[10px] font-semibold block mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
            {whenText(item.at)}
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 mt-1 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--app-text-muted)' }} />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2.5 border-t pt-2.5" style={{ borderColor: 'var(--app-border)' }}>
          {item.facts && item.facts.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
              {item.facts.map(f => (
                <React.Fragment key={f.label}>
                  <dt className="font-bold" style={{ color: 'var(--app-text-muted)' }}>
                    {f.label}
                  </dt>
                  <dd className="font-semibold text-right" style={{ color: 'var(--app-text)' }}>
                    {f.value}
                  </dd>
                </React.Fragment>
              ))}
            </dl>
          )}
          {item.items && item.items.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: 'var(--app-text-muted)' }}>
                {item.kind === 'dry-done' ? 'Getrocknet wurden' : item.kind === 'dry-due' ? 'Müssen getrocknet werden' : 'Betrifft'}
              </div>
              {item.items.map((it, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5" style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)' }}>
                  <span className="w-3.5 h-3.5 rounded-full border shrink-0" style={{ backgroundColor: it.color || 'var(--app-border)', borderColor: 'var(--app-border)' }} />
                  <span className="min-w-0">
                    <span className="text-xs font-bold block truncate" style={{ color: 'var(--app-text)' }}>
                      {it.title}
                    </span>
                    {it.sub && (
                      <span className="text-[10px] block leading-snug" style={{ color: 'var(--app-text-muted)' }}>
                        {it.sub}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => removeInbox(item.id)}
            className="px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer flex items-center gap-1.5 text-rose-400"
            style={buttonStyle}
          >
            <Trash2 className="w-3 h-3" />
            Entfernen
          </button>
        </div>
      )}
    </div>
  );
};

/** Postfach: alle Mitteilungen mit Details. Ein Tipp auf eine Benachrichtigung öffnet hier genau diese Mitteilung. */
export const InboxTab: React.FC<{ focusId?: string }> = ({ focusId }) => {
  const items = useInbox();
  const [openId, setOpenId] = useState<string | null>(focusId || null);
  const focusRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (focusId) setOpenId(focusId);
  }, [focusId]);

  useEffect(() => {
    if (openId) markInboxRead(openId);
  }, [openId, items.length]);

  useEffect(() => {
    if (focusId) focusRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusId, items.length]);

  if (items.length === 0) {
    return (
      <Card className="text-center py-8">
        <BellOff className="w-7 h-7 mx-auto" style={{ color: 'var(--app-text-muted)' }} />
        <p className="text-xs font-bold">Noch keine Mitteilungen</p>
        <p className="text-[11px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
          Hier erscheinen „Druck fertig“, „Trocknung fertig“, „Trocknen fällig“ und „Spule fast leer“ mit allen Details.
        </p>
      </Card>
    );
  }

  const unread = items.filter(i => !i.read).length;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold" style={{ color: 'var(--app-text-muted)' }}>
          {unread > 0 ? `${unread} ungelesen` : 'Alles gelesen'} · {items.length} gesamt
        </span>
        <div className="flex gap-1.5">
          {unread > 0 && (
            <button onClick={markAllInboxRead} className="px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer flex items-center gap-1.5" style={buttonStyle}>
              <CheckCheck className="w-3 h-3" />
              Alle gelesen
            </button>
          )}
          <button
            onClick={() => {
              if (confirm('Alle Mitteilungen löschen?')) clearInbox();
            }}
            className="px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer flex items-center gap-1.5 text-rose-400"
            style={buttonStyle}
          >
            <Trash2 className="w-3 h-3" />
            Leeren
          </button>
        </div>
      </div>
      {items.map(item => (
        <Row key={item.id} item={item} open={openId === item.id} refEl={item.id === focusId ? focusRef : undefined} onToggle={() => setOpenId(openId === item.id ? null : item.id)} />
      ))}
    </div>
  );
};
