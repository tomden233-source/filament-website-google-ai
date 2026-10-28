import { useEffect, useRef } from 'react';

// Esc schließt immer nur das oberste offene Fenster (z. B. erst die Spulen-Suche, dann das Slot-Fenster darunter).
// Die Fenster der App selbst (Menü, Spule, NFC …) schließt weiterhin App.tsx – aber nur, wenn hier keins offen ist.

type Entry = { close: () => void };
const stack: Entry[] = [];
let installed = false;

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || stack.length === 0) return;
  e.stopPropagation();
  e.preventDefault();
  stack[stack.length - 1].close();
}

export function useEscapeClose(onClose: () => void, enabled = true) {
  const latest = useRef(onClose);
  latest.current = onClose;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    if (!installed) {
      // Capture-Phase: läuft vor dem allgemeinen Esc-Handler in App.tsx
      window.addEventListener('keydown', onKeyDown, true);
      installed = true;
    }
    const entry: Entry = { close: () => latest.current() };
    stack.push(entry);
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [enabled]);
}
