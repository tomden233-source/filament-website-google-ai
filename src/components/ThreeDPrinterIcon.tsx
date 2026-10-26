import React from 'react';

interface ThreeDPrinterIconProps {
  className?: string;
}

/**
 * Dediziertes 3D-Drucker Icon für Bambu Lab X2D
 * Zeigt ein geschlossenes CoreXY-Gehäuse mit Z-Achsen, X-Gantry, Druckkopf/Düse und Druckbett
 */
export const ThreeDPrinterIcon: React.FC<ThreeDPrinterIconProps> = ({ className = 'w-4 h-4' }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* 1. Geschlossenes CoreXY-Gehäuse mit Sichtfenster */}
      <rect x="3" y="2.5" width="18" height="19" rx="2.5" strokeWidth="1.8" />
      
      {/* 2. Vertikale Z-Führungsschienen */}
      <line x1="5.5" y1="5.5" x2="5.5" y2="18.5" strokeWidth="1.2" strokeOpacity="0.5" />
      <line x1="18.5" y1="5.5" x2="18.5" y2="18.5" strokeWidth="1.2" strokeOpacity="0.5" />

      {/* 3. Horizontale X-Achsen Traverse / Gantry */}
      <line x1="3.5" y1="8" x2="20.5" y2="8" strokeWidth="1.8" />

      {/* 4. Bambu Toolhead / Extruder mit Nozzle-Spitze */}
      <rect x="10" y="6.5" width="4" height="3" rx="0.5" fill="currentColor" stroke="none" />
      <path d="M11 9.5 L12 11.5 L13 9.5 Z" fill="currentColor" stroke="none" />

      {/* 5. Beheiztes Druckbett (Platform) */}
      <line x1="5" y1="16.5" x2="19" y2="16.5" strokeWidth="2.2" stroke="currentColor" />

      {/* 6. Gedrucktes 3D-Modell (Schichtkörper auf dem Bett) */}
      <path
        d="M9.5 16.5 L9.5 13.5 L14.5 13.5 L14.5 16.5"
        strokeWidth="1.6"
        fill="currentColor"
        fillOpacity="0.25"
      />
    </svg>
  );
};
