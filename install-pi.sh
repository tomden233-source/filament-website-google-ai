#!/bin/bash
# ==============================================================================
# FilamentHub Studio - Raspberry Pi 1-Click Installer
# Hoste FilamentHub 24/7 autark auf deinem Raspberry Pi (ohne AI Studio Credits!)
# ==============================================================================

set -e

echo "🚀 Starte FilamentHub Studio Setup auf Raspberry Pi..."

# 1. Node.js & npm prüfen
if ! command -v node &> /dev/null; then
    echo "📦 Installiere Node.js 22 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "✅ Node.js Version: $(node -v)"
echo "✅ NPM Version: $(npm -v)"

# 2. Abhängigkeiten installieren
echo "📥 Installiere Node-Module..."
npm install

# 3. Frontend erstellen
echo "🏗️ Baue Frontend..."
npm run build

# 4. Datenverzeichnis vorbereiten
mkdir -p ./data

# 5. PM2 Process Manager für automatischen 24/7 Autostart
if ! command -v pm2 &> /dev/null; then
    echo "⚙️ Installiere PM2 Process Manager..."
    sudo npm install -g pm2
fi

echo "🚀 Starte FilamentHub Studio mit PM2..."
pm2 delete filamenthub 2>/dev/null || true
pm2 start server.ts --name filamenthub --interpreter tsx

echo "💾 Speichere PM2 Autostart-Konfiguration..."
pm2 save

IP_ADDR=$(hostname -I | awk '{print $1}')

echo "=============================================================================="
echo "🎉 FilamentHub Studio läuft jetzt dauerhaft auf deinem Raspberry Pi!"
echo "👉 Öffne im Browser: http://${IP_ADDR}:3000"
echo "👉 Oder lokal:       http://localhost:3000"
echo "=============================================================================="
