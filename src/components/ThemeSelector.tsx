import React from 'react';
import {
  ThemeBrightness,
  ThemeAccent,
  BRIGHTNESS_OPTIONS,
  ACCENT_OPTIONS
} from '../types/theme';
import { Palette, Sun, Moon } from 'lucide-react';

interface ThemeSelectorProps {
  brightness: ThemeBrightness;
  accent: ThemeAccent;
  onSetBrightness: (b: ThemeBrightness) => void;
  onSetAccent: (a: ThemeAccent) => void;
  compact?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  brightness,
  accent,
  onSetBrightness,
  onSetAccent,
  compact = false
}) => {
  if (compact) {
    return (
      <div
        className="flex items-center gap-1.5 p-1 rounded-xl border transition-colors"
        style={{
          backgroundColor: 'var(--app-card-sub)',
          borderColor: 'var(--app-border)'
        }}
      >
        <span className="text-[10px] font-bold px-1 hidden md:inline" style={{ color: 'var(--app-text-muted)' }}>
          Theme:
        </span>
        <div className="flex items-center gap-1">
          {BRIGHTNESS_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onSetBrightness(opt.id)}
              title={`${opt.name}: ${opt.subtitle}`}
              className={`w-5 h-5 rounded-md border flex items-center justify-center transition cursor-pointer ${
                brightness === opt.id
                  ? 'ring-2 scale-110'
                  : 'hover:scale-105'
              }`}
              style={{
                backgroundColor: opt.bgHex,
                borderColor: brightness === opt.id ? 'var(--app-accent)' : 'var(--app-border)'
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: opt.cardHex }}
              />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-3.5 p-3.5 rounded-xl border text-xs transition-colors"
      style={{
        backgroundColor: 'var(--app-card-sub)',
        borderColor: 'var(--app-border)',
        color: 'var(--app-text)'
      }}
    >
      {/* 5 Helligkeitsstufen */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between" style={{ color: 'var(--app-text-muted)' }}>
          <span className="font-bold flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>5 Helligkeits-Themes</span>
          </span>
          <span className="text-[10px] font-semibold font-mono-num" style={{ color: 'var(--app-accent)' }}>
            {BRIGHTNESS_OPTIONS.find((b) => b.id === brightness)?.name}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {BRIGHTNESS_OPTIONS.map((opt) => {
            const isActive = brightness === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onSetBrightness(opt.id)}
                className={`p-2 rounded-xl border flex flex-col items-center gap-1 text-center transition cursor-pointer ${
                  isActive
                    ? 'ring-2'
                    : 'hover:opacity-90'
                }`}
                style={{
                  backgroundColor: isActive ? 'var(--app-accent-sub)' : 'var(--app-card)',
                  borderColor: isActive ? 'var(--app-accent)' : 'var(--app-border)'
                }}
                title={opt.subtitle}
              >
                <div
                  className="w-6 h-6 rounded-lg border flex items-center justify-center shadow-inner"
                  style={{
                    backgroundColor: opt.bgHex,
                    borderColor: 'var(--app-border)'
                  }}
                >
                  <span
                    className="w-3 h-3 rounded-md"
                    style={{ backgroundColor: opt.cardHex }}
                  />
                </div>
                <span
                  className="text-[10px] font-bold truncate w-full"
                  style={{ color: isActive ? 'var(--app-accent)' : 'var(--app-text)' }}
                >
                  {opt.name.split('. ')[1]?.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Akzentfarben */}
      <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: 'var(--app-border)' }}>
        <span className="font-bold flex items-center gap-1.5 uppercase text-[10px] tracking-wider" style={{ color: 'var(--app-text-muted)' }}>
          <Palette className="w-3.5 h-3.5 text-sky-400" />
          <span>Akzent-Farbschema</span>
        </span>
        <div className="grid grid-cols-5 gap-1.5">
          {ACCENT_OPTIONS.map((acc) => {
            const isActive = accent === acc.id;
            return (
              <button
                key={acc.id}
                onClick={() => onSetAccent(acc.id)}
                className="py-1.5 px-2 rounded-xl border flex items-center justify-center gap-1.5 text-center transition cursor-pointer"
                style={{
                  backgroundColor: isActive ? 'var(--app-accent-sub)' : 'var(--app-card)',
                  borderColor: isActive ? 'var(--app-accent)' : 'var(--app-border)',
                  color: isActive ? 'var(--app-accent)' : 'var(--app-text)'
                }}
                title={acc.name}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0 shadow"
                  style={{ backgroundColor: acc.colorHex }}
                />
                <span className="text-[10px] font-semibold hidden sm:inline truncate">
                  {acc.name.split('-')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
