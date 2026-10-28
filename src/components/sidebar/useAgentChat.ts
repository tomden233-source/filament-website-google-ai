import React, { useState } from 'react';
import type { SidebarProps as ParentProps } from '../Sidebar';

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
}

export interface useAgentChatParams {
  spools: ParentProps['spools'];
  onOpenCamera: ParentProps['onOpenCamera'];
  onSetViewMode: ParentProps['onSetViewMode'];
  versionProfiles: ParentProps['versionProfiles'];
  onSelectVersion: ParentProps['onSelectVersion'];
  setActiveTab: any;
  appSettings: ParentProps['appSettings'];
  onMarkDried: ParentProps['onMarkDried'];
  onDeductWeight: ParentProps['onDeductWeight'];
}

export function useAgentChat({ spools, onOpenCamera, onSetViewMode, versionProfiles, onSelectVersion, setActiveTab, appSettings, onMarkDried, onDeductWeight }: useAgentChatParams) {
  const [aiInput, setAiInput] = useState('');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      text: `Hallo! Ich kenne alle deine ${spools.length} Spulen und Standardwerte. Sag mir einfach, was ich abziehen, eintragen, trocknen oder berechnen soll!`,
      isUser: false,
      timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const handleAiSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = aiInput.trim();
    if (!prompt) return;

    const userMsg: ChatMessage = {
      id: 'usr-' + Date.now(),
      text: prompt,
      isUser: true,
      timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, userMsg]);
    setAiInput('');

    const lower = prompt.toLowerCase();
    let botReply = '';

    if (lower.includes('kamera') || lower.includes('foto') || lower.includes('scannen') || lower.includes('fotografieren')) {
      onOpenCamera();
      botReply = 'Ich habe den Kamera-Scanner für dich geöffnet!';
    } else if (lower.includes('vereinfacht') || lower.includes('kompakt')) {
      onSetViewMode('simple');
      botReply = 'Ich habe auf die vereinfachte Ansicht umgeschaltet.';
    } else if (lower.includes('vollständig') || lower.includes('trocknungsbalken')) {
      onSetViewMode('full');
      botReply = 'Ich habe auf die vollständige Ansicht umgeschaltet.';
    } else if (lower.includes('wechsle zu') || lower.includes('version')) {
      const targetV = versionProfiles.find(v => lower.includes(v.id.toLowerCase()));
      if (targetV) {
        onSelectVersion(targetV.id);
        botReply = `Ich habe zu Profil ${targetV.label} gewechselt!`;
      } else {
        botReply = `Verfügbare Versionen: ${versionProfiles.map(v => v.id).join(', ')}.`;
      }
    } else if (lower.includes('einstellung') || lower.includes('tara') || lower.includes('eibos')) {
      setActiveTab('settings');
      botReply = `Einstellungs-Hub geöffnet! Eibos-Tara ist derzeit auf ${appSettings.eibosBagTara} g eingestellt.`;
    } else if (lower.includes('trocknen') || lower.includes('getrocknet')) {
      const match = spools.filter(s =>
        lower.includes(s.brand.toLowerCase()) ||
        lower.includes(s.name.toLowerCase()) ||
        lower.includes(s.colorName.toLowerCase())
      );
      if (match.length > 0) {
        match.forEach(m => onMarkDried(m.id));
        botReply = `Ich habe ${match.length} Spule(n) als getrocknet markiert!`;
      } else {
        botReply = 'Nenne mir den Namen oder die Farbe der Spule.';
      }
    } else if (lower.includes('zieh') || lower.includes('minus') || lower.includes('abziehen')) {
      const gramMatch = prompt.match(/(\d+)\s*(?:g|gramm)?/i);
      if (gramMatch) {
        const grams = parseInt(gramMatch[1]);
        const target = spools.find(s =>
          lower.includes(s.name.toLowerCase()) ||
          (lower.includes(s.brand.toLowerCase()) && lower.includes(s.colorName.toLowerCase())) ||
          lower.includes(s.colorName.toLowerCase())
        );
        if (target) {
          onDeductWeight(target.id, grams);
          botReply = `${grams} g wurden von „${target.brand} ${target.name}“ abgezogen.`;
        } else {
          botReply = `Ich konnte ${grams} g abziehen, aber von welcher Spule?`;
        }
      } else {
        botReply = 'Wie viel Gramm soll ich abziehen? (z.B. „Zieh 45g von Bambu Weiß ab“)';
      }
    } else {
      botReply = 'Befehle: Spule fotografieren („Kamera öffnen“), Gewicht abziehen („Zieh 50g ab“), Trocknung („Markiere Eryone als getrocknet“), Einstellungen anpassen oder Theme wechseln.';
    }

    setTimeout(() => {
      setChatMessages(prev => [
        ...prev,
        {
          id: 'bot-' + Date.now(),
          text: botReply,
          isUser: false,
          timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }, 250);
  };

  return { setAiInput, chatMessages, handleAiSubmit, aiInput };
}
