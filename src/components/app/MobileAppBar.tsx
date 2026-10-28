import React from 'react';
import { Zap, Camera, Tag, Minus } from 'lucide-react';

export interface MobileAppBarProps {
  setIsCameraModalOpen: any;
  setNfcSpoolId: any;
  setNfcModalMode: any;
  setIsNfcModalOpen: any;
  setIsQuickDeductOpen: any;
  setIsSidebarOpen: any;
}

export const MobileAppBar: React.FC<MobileAppBarProps> = ({
  setIsCameraModalOpen,
  setNfcSpoolId,
  setNfcModalMode,
  setIsNfcModalOpen,
  setIsQuickDeductOpen,
  setIsSidebarOpen
}) => {
  return (
<nav
          aria-label="Mobile Schnellzugriff"
          className="fixed bottom-0 left-0 right-0 z-40 border-t px-2 py-2 flex items-center justify-between gap-1 shadow-2xl backdrop-blur-md transition-colors"
          style={{
            paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))',
            backgroundColor: 'var(--app-card)',
            borderColor: 'var(--app-border)',
            color: 'var(--app-text)'
          }}
        >
          <button
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex-1 py-1.5 px-1 rounded-xl border font-bold text-[10px] flex flex-col items-center justify-center gap-0.5 active:scale-95 transition cursor-pointer"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <Zap className="w-3.5 h-3.5 text-orange-400" />
            <span>Spulen</span>
          </button>

          <button
            onClick={() => setIsCameraModalOpen(true)}
            className="flex-1 py-1.5 px-1 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 text-white font-bold text-[10px] flex flex-col items-center justify-center gap-0.5 shadow-md shadow-orange-500/20 active:scale-95 transition cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Foto</span>
          </button>

          <button
            onClick={() => {
              setNfcSpoolId(undefined);
              setNfcModalMode('read');
              setIsNfcModalOpen(true);
            }}
            className="flex-1 py-1.5 px-1 rounded-xl border font-bold text-[10px] flex flex-col items-center justify-center gap-0.5 active:scale-95 transition cursor-pointer"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <Tag className="w-3.5 h-3.5 text-emerald-400" />
            <span>NFC</span>
          </button>

          <button
            onClick={() => setIsQuickDeductOpen(true)}
            className="flex-1 py-1.5 px-1 rounded-xl border font-bold text-[10px] flex flex-col items-center justify-center gap-0.5 active:scale-95 transition cursor-pointer"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <Minus className="w-3.5 h-3.5 text-rose-400" />
            <span>Abzug</span>
          </button>

          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex-1 py-1.5 px-1 rounded-xl border font-bold text-[10px] flex flex-col items-center justify-center gap-0.5 active:scale-95 transition cursor-pointer"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text-muted)'
            }}
          >
            <span className="text-xs leading-none">☰</span>
            <span>Menü</span>
          </button>
        </nav>
  );
};
