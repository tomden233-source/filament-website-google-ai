import React, { useState, useEffect } from 'react';
import {
  Server,
  X,
  Copy,
  Check,
  Terminal,
  Cpu,
  HardDrive,
  Download,
  ShieldCheck,
  Radio,
  GitBranch,
  Home,
  Cloud,
  Send,
  RefreshCw,
  Eye,
  EyeOff,
  AlertTriangle,
  FolderArchive,
  ChevronDown
} from 'lucide-react';
import { safeStorage } from '../utils/safeStorage';
import { getHaCredentials, saveHaCredentials } from '../utils/haClient';

interface SelfHostModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion?: string;
}

export const SelfHostModal: React.FC<SelfHostModalProps> = ({ isOpen, onClose, currentVersion = 'v1.54' }) => {
  const versionNum = currentVersion ? currentVersion.replace(/^v/, '') : '1.54';
  const versionTag = currentVersion ? (currentVersion.startsWith('v') ? currentVersion : `v${currentVersion}`) : 'v1.54';

  // Standardmäßig IMMER "Zu Git posten" als aktiver Tab
  const [activeTab, setActiveTab] = useState<'git' | 'haos' | 'docker' | 'pm2' | 'data'>('git');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [showWhyOldVersion, setShowWhyOldVersion] = useState<boolean>(() => {
    return safeStorage.getItem('hide_why_old_version') !== 'true';
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Git Push State
  const [gitRepoUrl, setGitRepoUrl] = useState<string>(() => safeStorage.getItem('git_repo_url') || 'https://github.com/tomden233-source/filament-website-google-ai.git');
  const [gitToken, setGitToken] = useState<string>(() => safeStorage.getItem('git_pat_token') || '');
  const [showGitToken, setShowGitToken] = useState<boolean>(false);
  const [gitPushing, setGitPushing] = useState<boolean>(false);
  const [gitPushResult, setGitPushResult] = useState<{ success: boolean; message: string; hint?: string } | null>(null);
  const [gitTesting, setGitTesting] = useState<boolean>(false);
  const [gitTestResult, setGitTestResult] = useState<{ success: boolean; message: string; hint?: string } | null>(null);

  // Gespeicherte Git-Konfiguration vom Server laden (überdauert Browser-Cache & Neustarts)
  useEffect(() => {
    fetch('/api/git/config')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.repoUrl && !gitRepoUrl) {
          setGitRepoUrl(data.repoUrl);
        }
      })
      .catch(() => {});
  }, []);

  if (!isOpen) return null;

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {}
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTestGitToken = async () => {
    const tokenToTest = gitToken.trim();
    if (!tokenToTest) {
      setGitTestResult({
        success: false,
        message: 'Bitte zuerst dein GitHub Personal Access Token eingeben.'
      });
      return;
    }
    setGitTesting(true);
    setGitTestResult(null);
    try {
      safeStorage.setItem('git_pat_token', tokenToTest);
      safeStorage.setItem('git_repo_url', gitRepoUrl.trim());

      const res = await fetch('/api/git/test-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenToTest, repoUrl: gitRepoUrl.trim() })
      });
      const data = await res.json();
      if (data.valid) {
        setGitTestResult({
          success: true,
          message: data.message
        });
      } else {
        setGitTestResult({
          success: false,
          message: data.error || 'Token ungültig.',
          hint: data.hint
        });
      }
    } catch (err: any) {
      setGitTestResult({
        success: false,
        message: 'Netzwerkfehler beim Prüfen des GitHub-Tokens: ' + (err?.message || err)
      });
    } finally {
      setGitTesting(false);
    }
  };

  const handleGitPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gitRepoUrl.trim()) return;
    setGitPushing(true);
    setGitPushResult(null);
    try {
      safeStorage.setItem('git_repo_url', gitRepoUrl.trim());
      if (gitToken.trim()) safeStorage.setItem('git_pat_token', gitToken.trim());
      
      // HA Zugangsdaten über getHaCredentials laden
      const haCreds = getHaCredentials();

      const res = await fetch('/api/git/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: gitRepoUrl.trim(),
          token: gitToken.trim() || undefined,
          branch: 'main',
          commitMsg: `FilamentHub ${versionTag} (Token Diagnostics & Vault Persistence, Git Credential Store, Auto-Recover & HA 401 Guidance)`,
          haUrl: haCreds.url,
          haToken: haCreds.token
        })
      });
      const data = await res.json();
      setGitPushResult(data);
    } catch (e: any) {
      setGitPushResult({ success: false, message: 'Netzwerkfehler beim Git Push: ' + (e?.message || 'Server nicht erreichbar') });
    } finally {
      setGitPushing(false);
    }
  };

  const haosConfigYaml = `name: "FilamentHub Studio"
description: "Autarker 3D-Druck Filament-Manager & Bambu Lab X2D Telemetrie für Home Assistant OS"
version: "${versionNum}.0"
slug: "filamenthub"
init: false
arch:
  - aarch64
  - amd64
  - armv7
  - armhf
startup: services
boot: auto
ingress: true
ingress_port: 3000
panel_icon: "mdi:printer-3d"
panel_title: "FilamentHub"
homeassistant_api: true
environment:
  NODE_ENV: "production"
  PORT: "3000"
  BAMBU_HOST: "192.168.68.53"
  BAMBU_ACCESS_CODE: "DEIN_ZUGANGSCODE"
  BAMBU_SERIAL: "03909A511502473"`;

  const dockerComposeCode = `services:
  filamenthub:
    build: .
    container_name: filamenthub
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - NODE_ENV=production
      - BAMBU_HOST=192.168.68.53
      - BAMBU_ACCESS_CODE=DEIN_ZUGANGSCODE
      - BAMBU_SERIAL=03909A511502473
    volumes:
      - ./data:/app/data`;

  const gitBashCode = `# 1. Git Repository auf den neuesten Stand bringen
git add -A
git commit -m "FilamentHub ${versionTag} Update"
git branch -M main
git remote add origin https://github.com/tomden233-source/filament-website-google-ai.git
git push -u origin main --force`;

  const pm2Code = `# 1. Abhängigkeiten installieren & App bauen
npm install
npm run build

# 2. PM2 installieren & dauerhaft starten
sudo npm install -g pm2
pm2 start server.ts --name filamenthub --interpreter tsx
pm2 save
pm2 startup`;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-3xl rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
        style={{
          backgroundColor: 'var(--app-card)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b pb-3"
          style={{ borderColor: 'var(--app-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base tracking-tight" style={{ color: 'var(--app-text)' }}>
                  Externes Hosting &amp; Selbstbetrieb (0 Credits)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {versionTag} Ready
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                Home Assistant OS auf dem Pi, 1-Klick ZIP-Download, Git Auto-Push &amp; Render.com – 100% ohne Credits!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border transition cursor-pointer hover:opacity-80"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ⚠️ HINWEISFENSTER MIT SCHLIESSEN-KNOPF */}
        {showWhyOldVersion && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs relative animate-fadeIn">
            <div className="flex items-center justify-between font-bold text-amber-400">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Warum hatte dein Home Assistant noch Version 1.22?</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowWhyOldVersion(false);
                  safeStorage.setItem('hide_why_old_version', 'true');
                }}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                title="Hinweisfenster schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-200 leading-relaxed text-[11.5px]">
              <strong>Hier ist die genaue Ursache:</strong> Docker-Container in Home Assistant OS aktualisieren sich <strong>nicht automatisch</strong> von selbst beim Git-Push. Um das neue Release zu laden, muss entweder die Home Assistant Automation <code className="text-emerald-400 font-mono">automation.filament_website_auto_pull_github</code> ausgeführt werden (geschieht jetzt automatisch nach jedem Push!) oder du klickst in HA unter <em>Einstellungen → Add-ons → FilamentHub</em> auf <strong>Neu erstellen (Rebuild)</strong>.
            </p>
            <div className="pt-1 flex flex-col sm:flex-row gap-2">
              <a
                href="/api/export-project.zip"
                download={`FilamentHub_${versionTag}_HAOS_Addon.zip`}
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-xs transition flex items-center justify-center gap-2 shadow-md cursor-pointer text-center"
              >
                <FolderArchive className="w-4 h-4" />
                <span>📥 Projekt {versionTag} als ZIP herunterladen</span>
              </a>
              <button
                type="button"
                onClick={() => setActiveTab('git')}
                className="py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <GitBranch className="w-4 h-4" />
                <span>🚀 Zu GitHub pushen &amp; HA triggern</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab Selection: Standard "Zu Git posten" + Dropdown-Menü für HAOS, Docker & Linux */}
        <div
          className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl border text-xs font-bold"
          style={{
            backgroundColor: 'var(--app-card-sub)',
            borderColor: 'var(--app-border)'
          }}
        >
          {/* 1. Haupt-Button: Zu Git posten (immer standardmäßig aktiv) */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('git');
              setIsDropdownOpen(false);
            }}
            className={`py-2 px-3.5 rounded-xl transition cursor-pointer flex items-center gap-2 shadow-xs ${
              activeTab === 'git'
                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30'
                : 'text-slate-300 hover:text-white hover:bg-white/5 border border-white/10'
            }`}
          >
            <GitBranch className="w-4 h-4 text-purple-300" />
            <span>🐙 Zu Git posten &amp; Cloud (Standard)</span>
          </button>

          {/* 2. Dropdown Menü für HAOS, Docker, Linux & Daten */}
          <div className="relative flex-1 min-w-[220px]">
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`w-full py-2 px-3.5 rounded-xl transition cursor-pointer flex items-center justify-between gap-2 shadow-xs border ${
                activeTab !== 'git'
                  ? 'bg-[#00AE42] hover:bg-[#009237] text-white border-[#00AE42] shadow-[#00AE42]/20'
                  : 'border-white/10 text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                {activeTab === 'haos' && <Home className="w-4 h-4 text-white" />}
                {activeTab === 'docker' && <Cpu className="w-4 h-4 text-white" />}
                {activeTab === 'pm2' && <Terminal className="w-4 h-4 text-white" />}
                {activeTab === 'data' && <HardDrive className="w-4 h-4 text-white" />}
                {activeTab === 'git' && <Server className="w-4 h-4 text-emerald-400" />}

                <span className="truncate">
                  {activeTab === 'haos' && '🍓 Home Assistant OS (HAOS Add-on)'}
                  {activeTab === 'docker' && '🐳 Docker Compose (Raspberry Pi)'}
                  {activeTab === 'pm2' && '🐧 Linux Server / PM2 Service'}
                  {activeTab === 'data' && '💾 Persistente Daten (./data)'}
                  {activeTab === 'git' && 'Host-Methode wählen (HAOS, Docker, Linux)'}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <div
                className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl border p-1.5 shadow-2xl space-y-1 animate-in fade-in slide-in-from-top-1 duration-150"
                style={{
                  backgroundColor: 'var(--app-card)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('haos');
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                    activeTab === 'haos' ? 'bg-[#00AE42] text-white' : 'hover:bg-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Home className="w-4 h-4 text-emerald-400" />
                    <span>🍓 Home Assistant OS (HAOS Add-on)</span>
                  </span>
                  {activeTab === 'haos' && <Check className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('docker');
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                    activeTab === 'docker' ? 'bg-[#00AE42] text-white' : 'hover:bg-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-sky-400" />
                    <span>🐳 Docker Compose (Raspberry Pi / NAS)</span>
                  </span>
                  {activeTab === 'docker' && <Check className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('pm2');
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                    activeTab === 'pm2' ? 'bg-[#00AE42] text-white' : 'hover:bg-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-amber-400" />
                    <span>🐧 Linux Server / PM2 Systemd-Dienst</span>
                  </span>
                  {activeTab === 'pm2' && <Check className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('data');
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                    activeTab === 'data' ? 'bg-[#00AE42] text-white' : 'hover:bg-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-purple-400" />
                    <span>💾 Persistente Daten (./data)</span>
                  </span>
                  {activeTab === 'data' && <Check className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab 1: Home Assistant OS (HAOS) */}
        {activeTab === 'haos' && (
          <div className="space-y-3.5 text-xs">
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 space-y-1.5">
              <div className="font-extrabold text-sky-300 flex items-center gap-2">
                <span>So bringst du {versionTag} in 2 Minuten auf deinen Home Assistant OS Pi:</span>
              </div>
              <p className="text-slate-200 leading-relaxed text-[11.5px]">
                Weil HAOS ein abgesichertes Container-System ist, läuft FilamentHub als <strong>Lokales Add-on</strong> mit nativer Ingress-Einbindung direkt in deiner HA-Seitenleiste!
              </p>
            </div>

            {/* Schritt-für-Schritt Anleitung */}
            <div className="space-y-2">
              <span className="font-bold text-slate-200 block">3 einfache Schritte zur Aktualisierung:</span>
              <ol className="space-y-2 list-decimal list-inside text-slate-300 text-[11.5px] leading-relaxed">
                <li className="p-2.5 rounded-lg bg-black/30 border border-white/5 space-y-1.5">
                  <strong>1. Komplettes ZIP herunterladen:</strong>
                  <div>
                    Lade die fertige ZIP-Datei herunter:
                  </div>
                  <a
                    href="/api/export-project.zip"
                    download={`FilamentHub_${versionTag}_HAOS_Addon.zip`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>FilamentHub_{versionTag}_HAOS_Addon.zip (ca. 1.8 MB)</span>
                  </a>
                </li>
                <li className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                  <strong>2. Auf dem Pi entpacken:</strong> Öffne deinen Home Assistant Samba-Share (oder das Terminal-Add-on) und kopiere den Inhalt der ZIP-Datei in den Ordner <code className="text-emerald-400 font-mono">/addons/local/filamenthub</code>.
                </li>
                <li className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                  <strong>3. Add-on neu bauen &amp; starten:</strong> Öffne Home Assistant: <em>Einstellungen → Add-ons → FilamentHub</em> und klicke auf <strong>Neu erstellen (Rebuild)</strong> oder <strong>Neustarten</strong>. Fertig – du bist sofort auf {versionTag} mit allen neuen Funktionen!
                </li>
              </ol>
            </div>

            {/* Config.yaml Code */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between font-bold text-slate-300">
                <span>HAOS Add-on Manifest (addon/config.yaml):</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => downloadFile('config.yaml', haosConfigYaml)}
                    className="px-2 py-1 rounded-lg border border-white/10 hover:bg-white/10 text-[11px] flex items-center gap-1 text-slate-300"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </button>
                  <button
                    onClick={() => copyToClipboard(haosConfigYaml, 'haos-yaml')}
                    className="px-2 py-1 rounded-lg border border-white/10 hover:bg-white/10 text-[11px] flex items-center gap-1 text-slate-300"
                  >
                    {copiedKey === 'haos-yaml' ? <Check className="w-3 h-3 text-[#00AE42]" /> : <Copy className="w-3 h-3" />}
                    <span>Kopieren</span>
                  </button>
                </div>
              </div>
              <pre className="p-3 rounded-xl bg-black/60 border border-white/10 font-mono text-[11px] text-emerald-400 overflow-x-auto select-all max-h-40 leading-relaxed">
                {haosConfigYaml}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 2: Git Auto-Push & Cloud */}
        {activeTab === 'git' && (
          <div className="space-y-3.5 text-xs">
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-1 text-slate-200">
              <div className="font-extrabold text-purple-300 flex items-center gap-2">
                <Cloud className="w-4 h-4" />
                <span>1-Klick GitHub Push: Bringe dein GitHub-Repository sofort auf {versionTag}</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-slate-300">
                Hier kannst du alle aktuellen Dateien direkt von diesem Server in dein GitHub-Repository pushen. Danach wird deine Home Assistant Automation <code className="text-emerald-300 font-mono">automation.filament_website_auto_pull_github</code> automatisch getriggert, um das Update sofort in HA OS zu laden!
              </p>
            </div>

            {/* 1-Klick GitHub Push Formular */}
            <form onSubmit={handleGitPush} className="p-3.5 rounded-xl border space-y-3" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}>
              <div className="font-extrabold text-xs" style={{ color: 'var(--app-text)' }}>
                Direkt zu deinem GitHub Repository pushen:
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold block" style={{ color: 'var(--app-text-muted)' }}>
                  GitHub Repository URL:
                </label>
                <input
                  type="text"
                  value={gitRepoUrl}
                  onChange={e => setGitRepoUrl(e.target.value)}
                  placeholder="https://github.com/dein-nutzername/filamenthub.git"
                  required
                  className="w-full px-3 py-1.5 rounded-lg border font-mono text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--app-input-bg)',
                    borderColor: 'var(--app-border)',
                    color: 'var(--app-text)'
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold block flex items-center justify-between" style={{ color: 'var(--app-text-muted)' }}>
                  <span>GitHub Personal Access Token (PAT):</span>
                  <span className="text-[9px] text-slate-400">GitHub → Settings → Developer settings → PAT (classic)</span>
                </label>
                <div className="relative">
                  <input
                    type={showGitToken ? 'text' : 'password'}
                    value={gitToken}
                    onChange={e => setGitToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full pl-3 pr-9 py-1.5 rounded-lg border font-mono text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--app-input-bg)',
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-text)'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowGitToken(!showGitToken)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showGitToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleTestGitToken}
                    disabled={gitTesting || !gitToken.trim()}
                    className="px-2.5 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer hover:bg-white/10 disabled:opacity-40"
                    style={{
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-text)'
                    }}
                  >
                    <RefreshCw className={`w-3 h-3 ${gitTesting ? 'animate-spin text-purple-400' : ''}`} />
                    <span>{gitTesting ? 'Token wird verifiziert...' : 'GitHub Token prüfen'}</span>
                  </button>
                  <span className="text-[9px] text-slate-400">
                    Wichtig: Häkchen bei <span className="text-purple-300 font-mono">[x] repo</span> setzen
                  </span>
                </div>

                {gitTestResult && (
                  <div className={`p-2 rounded-lg border text-[11px] font-medium mt-1 ${
                    gitTestResult.success ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  }`}>
                    <div>{gitTestResult.message}</div>
                    {gitTestResult.hint && <div className="text-[10px] mt-0.5 opacity-90">{gitTestResult.hint}</div>}
                  </div>
                )}
              </div>

              {gitPushResult && (
                <div className={`p-2.5 rounded-xl border text-xs font-bold ${
                  gitPushResult.success ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                }`}>
                  <div>{gitPushResult.message}</div>
                  {gitPushResult.hint && <div className="text-[10px] font-normal mt-1 opacity-90">{gitPushResult.hint}</div>}
                </div>
              )}

              <button
                type="submit"
                disabled={gitPushing || !gitRepoUrl.trim()}
                className="w-full py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {gitPushing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{gitPushing ? `Pushe aktuellen Stand (${versionTag}) zu GitHub & triggere HA...` : `🚀 Jetzt ${versionTag} zu GitHub pushen & HA triggern`}</span>
              </button>
            </form>

            {/* HILFE & FAQ: Git Token finden & Home Assistant Setup */}
            <div className="p-3.5 rounded-xl border border-sky-500/30 bg-sky-500/10 space-y-2.5 text-slate-200">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                <AlertTriangle className="w-4 h-4 text-sky-400" />
                <span>Wichtige Fragen zu Git-Token &amp; Home Assistant:</span>
              </div>

              <div className="space-y-2 text-[11px] leading-relaxed">
                <div className="p-2 rounded-lg bg-black/30 border border-white/5 space-y-1">
                  <div className="font-bold text-sky-200">
                    ❓ Muss ich das Git-Token in Home Assistant neu eingeben, wenn ich den Code neu pushe?
                  </div>
                  <p className="text-slate-300">
                    <strong>Nein!</strong> In Home Assistant musst du das Git-Token <strong>nicht</strong> jedes Mal neu eingeben. Sobald der Code auf GitHub gepusht ist, zieht Home Assistant sich den aktuellen Stand über die Automation <code className="text-emerald-400 font-mono">automation.filament_website_auto_pull_github</code> oder über dein FilamentHub Add-on (Neu erstellen / Rebuild). Das Git-Token wird ausschließlich hier für den Upload zu GitHub benötigt und bleibt dauerhaft auf deinem Server/Pi in <code className="text-purple-300 font-mono">.git-credentials.json</code> gesichert.
                  </p>
                </div>

                <div className="p-2 rounded-lg bg-black/30 border border-white/5 space-y-1">
                  <div className="font-bold text-sky-200">
                    🔍 Wie finde ich mein GitHub Token (PAT) heraus?
                  </div>
                  <p className="text-slate-300">
                    GitHub zeigt ein Token aus Sicherheitsgründen nach dem ersten Erstellen nie wieder im Klartext an. Du kannst dir aber in <strong>1 Minute ein neues Token erstellen</strong>:
                  </p>
                  <ol className="list-decimal list-inside space-y-0.5 text-slate-300 pl-1 font-mono text-[10.5px]">
                    <li>Gehe auf <strong>github.com</strong> ➔ oben rechts auf dein Profilbild ➔ <strong>Settings</strong></li>
                    <li>Ganz unten links auf <strong>Developer Settings</strong> klicken</li>
                    <li>Links auf <strong>Personal access tokens</strong> ➔ <strong>Tokens (classic)</strong></li>
                    <li>Klicke auf <strong>Generate new token (classic)</strong></li>
                    <li>Gib als Name z.B. <em>FilamentHub Pi</em> ein und setze den Haken bei <strong>[x] repo</strong></li>
                    <li>Ganz unten auf <strong>Generate token</strong> klicken und den Code kopieren (beginnt mit <em>ghp_...</em>)</li>
                    <li>Hier oben einfügen und auf <strong>„GitHub Token prüfen“</strong> klicken – fertig!</li>
                  </ol>
                </div>

                <div className="p-2 rounded-lg bg-black/30 border border-white/5 space-y-1">
                  <div className="font-bold text-sky-200">
                    ⏱️ Warum ändert GitHub nur bei manchen Dateien die Zeitstempel (z. B. manche „8 minutes ago“, andere „2 hours ago“)?
                  </div>
                  <p className="text-slate-300">
                    <strong>Das ist das fundamentale Prinzip von Git:</strong> Wenn du Änderungen pushst, aktualisiert GitHub die Anzeige und Zeitangabe <em>nur für jene Dateien, an denen sich tatsächlich Code geändert hat</em>! Alle Dateien, die in diesem Commit unberührt blieben, behalten ihren früheren Zeitstempel (z. B. „2 hours ago“), als sie das letzte Mal geändert wurden. So siehst du auf einen Blick exakt, welche Dateien neu sind und welche unverändert blieben.
                  </p>
                </div>
              </div>
            </div>

            {/* Manuelle Befehle */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between font-bold text-slate-300">
                <span>Oder manuell in deinem lokalen Terminal:</span>
                <button
                  onClick={() => copyToClipboard(gitBashCode, 'git-bash')}
                  className="px-2 py-1 rounded-lg border border-white/10 hover:bg-white/10 text-[11px] flex items-center gap-1 text-slate-300"
                >
                  {copiedKey === 'git-bash' ? <Check className="w-3 h-3 text-[#00AE42]" /> : <Copy className="w-3 h-3" />}
                  <span>Kopieren</span>
                </button>
              </div>
              <pre className="p-3 rounded-xl bg-black/60 border border-white/10 font-mono text-[11px] text-purple-300 overflow-x-auto select-all leading-relaxed">
                {gitBashCode}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 3: Docker Compose */}
        {activeTab === 'docker' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span>Befehl zum Starten im Projektordner:</span>
              <button
                onClick={() => copyToClipboard('docker compose up -d', 'cmd-docker')}
                className="px-2 py-1 rounded-lg border border-white/10 hover:bg-white/10 text-[11px] flex items-center gap-1 text-slate-300"
              >
                {copiedKey === 'cmd-docker' ? <Check className="w-3 h-3 text-[#00AE42]" /> : <Copy className="w-3 h-3" />}
                <span>Kopieren</span>
              </button>
            </div>
            <pre className="p-3 rounded-xl bg-black/60 border border-white/10 font-mono text-xs text-emerald-400 overflow-x-auto select-all">
              docker compose up -d
            </pre>

            <div className="flex items-center justify-between text-xs font-bold text-slate-300 pt-2">
              <span>docker-compose.yml Konfiguration:</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => downloadFile('docker-compose.yml', dockerComposeCode)}
                  className="px-2 py-1 rounded-lg border border-white/10 hover:bg-white/10 text-[11px] flex items-center gap-1 text-slate-300"
                >
                  <Download className="w-3 h-3" />
                  <span>Download .yml</span>
                </button>
                <button
                  onClick={() => copyToClipboard(dockerComposeCode, 'docker-compose')}
                  className="px-2 py-1 rounded-lg border border-white/10 hover:bg-white/10 text-[11px] flex items-center gap-1 text-slate-300"
                >
                  {copiedKey === 'docker-compose' ? <Check className="w-3 h-3 text-[#00AE42]" /> : <Copy className="w-3 h-3" />}
                  <span>Kopieren</span>
                </button>
              </div>
            </div>
            <pre className="p-3 rounded-xl bg-black/60 border border-white/10 font-mono text-[11px] text-slate-300 overflow-x-auto select-all max-h-48 leading-relaxed">
              {dockerComposeCode}
            </pre>
          </div>
        )}

        {/* Tab 4: PM2 Linux */}
        {activeTab === 'pm2' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-300">
              Falls du ein normales Raspberry Pi OS (Debian) ohne HAOS nutzt, richtet das Skript <code className="text-emerald-400 bg-black/40 px-1 py-0.5 rounded">install-pi.sh</code> FilamentHub automatisch als Systemdienst ein:
            </div>
            <pre className="p-3 rounded-xl bg-black/60 border border-white/10 font-mono text-xs text-emerald-400 overflow-x-auto select-all">
              chmod +x install-pi.sh &amp;&amp; ./install-pi.sh
            </pre>

            <div className="flex items-center justify-between text-xs font-bold text-slate-300 pt-2">
              <span>Manuelle Befehle:</span>
              <button
                onClick={() => copyToClipboard(pm2Code, 'pm2-code')}
                className="px-2 py-1 rounded-lg border border-white/10 hover:bg-white/10 text-[11px] flex items-center gap-1 text-slate-300"
              >
                {copiedKey === 'pm2-code' ? <Check className="w-3 h-3 text-[#00AE42]" /> : <Copy className="w-3 h-3" />}
                <span>Kopieren</span>
              </button>
            </div>
            <pre className="p-3 rounded-xl bg-black/60 border border-white/10 font-mono text-[11px] text-slate-300 overflow-x-auto select-all max-h-44 leading-relaxed">
              {pm2Code}
            </pre>
          </div>
        )}

        {/* Tab 5: Persistente Daten */}
        {activeTab === 'data' && (
          <div className="space-y-2.5 text-xs text-slate-300">
            <p>
              FilamentHub legt alle persistenten Daten (verdrucktes Filament, Historie, Spulen &amp; AMS-Zuweisungen) im Verzeichnis <strong className="text-emerald-400">./data/</strong> ab:
            </p>
            <div className="p-3 rounded-xl bg-black/40 border border-white/10 font-mono text-[11px] space-y-1.5">
              <div>📁 <span className="text-emerald-400">./data/ha-config.json</span> – Nabu Casa Remote URL &amp; Long-Lived Token Tresor</div>
              <div>📁 <span className="text-emerald-400">./data/filamenthub-storage.json</span> – Verdruckte Gramm, Druckstunden &amp; Statistiken</div>
              <div>📁 <span className="text-emerald-400">./data/backup-auto.json</span> – Automatisches Spulen-Snapshot</div>
            </div>
            <p className="text-[11px] text-slate-400">
              💡 Wenn du Docker oder das HAOS Add-on nutzt, sorgt das Volume <code className="text-emerald-300">- ./data:/app/data</code> dafür, dass bei Container-Updates niemals Daten verloren gehen.
            </p>
          </div>
        )}

        {/* Footer */}
        <div
          className="pt-3 border-t flex items-center justify-between text-xs flex-wrap gap-2"
          style={{ borderColor: 'var(--app-border)' }}
        >
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-[#00AE42] animate-pulse" />
            <span>Port 3000 • MQTTS 8883 • Ingress HAOS • 0 Credits</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer bg-[#00AE42] hover:bg-[#009237] text-white"
          >
            Verstanden &amp; Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
