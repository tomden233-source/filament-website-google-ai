import type { Spool } from '../types/filament';

// Deine Spulenliste, von Claude nach deinem Diktat gepflegt.
//
// So funktioniert es:
//  - stamp = 0  → nichts passiert, die App nutzt den Bestand, den sie schon hat.
//  - stamp = Zeitpunkt (Millisekunden), spools = deine Liste → beim nächsten Start ersetzt jedes Gerät seinen Bestand einmal
//    durch diese Liste (die alte Liste bleibt als Notfall-Kopie im Gerät). Eine leere Liste bedeutet „alles raus“.
//  - Der Zeitstempel zählt wie eine Änderung zu dieser Zeit: Hat ein anderes Gerät später etwas geändert (z. B. Gramm abgezogen),
//    gewinnt dessen Stand. So überschreibt die Liste nie neuere Änderungen.
//
// Felder je Spule siehe src/types/filament.ts (onSpool, sealed, inEibos, needsDrying, location, …).
export const MY_SPOOLS_SEED: { stamp: number; spools: Spool[] } = {
  stamp: 0,
  spools: []
};
