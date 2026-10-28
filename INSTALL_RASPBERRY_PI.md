# FilamentHub Studio - Raspberry Pi & Docker Self-Hosting Guide

Dieser Guide erklärt, wie du FilamentHub Studio dauerhaft, 24/7 und **völlig kostenlos ohne AI Studio Credits** auf deinem eigenen Raspberry Pi, Synology NAS, Home Assistant Server oder Linux/Windows PC betreibst.

---

## 🎯 Warum extern hosten?
1. **Kein Credit-Limit:** Die Webseite läuft ununterbrochen auf deiner eigenen Hardware.
2. **Dauerhafte Datenspeicherung:** Alle Spulen, Verbräuche und Einstellungen liegen in `/app/data/` auf deiner SSD / SD-Karte.
3. **Direktes Netzwerk:** Unmittelbare MQTTS-Verbindung (Port 8883) zu deinem Bambu Lab Drucker und Home Assistant im gleichen Heimnetzwerk (Latenz < 2 ms).

---

## 🚀 Option 1: 1-Klick Setup mit Docker Compose (Empfohlen)

### Voraussetzungen
- Docker und Docker Compose auf deinem Raspberry Pi / Server installiert.

### Schritt 1: Projektverzeichnis erstellen
```bash
git clone <dein-repo-url> filamenthub
cd filamenthub
```
*(Oder kopiere einfach diesen gesamten Projektordner auf deinen Raspberry Pi)*

### Schritt 2: Container starten
```bash
docker compose up -d
```

Fertig! FilamentHub läuft ab sofort dauerhaft im Hintergrund und startet bei jedem Neustart des Raspberry Pi automatisch.
- **Aufruf im Browser:** `http://<IP-DEINES-PI>:3000` (z.B. `http://192.168.68.50:3000`)

---

## 🛠️ Option 2: Direkt mit Node.js & PM2 auf Raspberry Pi OS

Falls du kein Docker verwendest, kannst du das mitgelieferte Skript `install-pi.sh` ausführen:

```bash
chmod +x install-pi.sh
./install-pi.sh
```

### Manuelle Schritte (falls bevorzugt):
```bash
# 1. Node.js 22 LTS installieren (falls noch nicht vorhanden)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Abhängigkeiten installieren & App bauen
npm install
npm run build

# 3. PM2 Process Manager für 24/7 Autostart
sudo npm install -g pm2
pm2 start server.ts --name filamenthub --interpreter tsx
pm2 save
pm2 startup
```

---

## 🔌 Home Assistant & LAN-Steckdose Anbindung
- **Bambu Lab X2D:**
  - IP: `192.168.68.53`
  - Port: `8883` (MQTTS TLS)
  - Zugriffscode: `DEIN_ZUGANGSCODE`
  - Seriennummer: `03909A511502473`
- **Home Assistant:**
  - Gib in den App-Einstellungen deine Home Assistant URL (z.B. `http://homeassistant.local:8123`) und deinen Long-Lived Access Token ein.
  - Kamera und Steckdosen-Entities werden automatisch synchronisiert.

---

## 💾 Datensicherungen & Backups
Alle dauerhaften Daten (verdrucktes Filament, Historie, Spulen, Trocknungszeiten) werden im Ordner `./data/` gespeichert. Du kannst diesen Ordner jederzeit sichern oder die integrierte 1-Klick JSON-Backup-Funktion im Menü nutzen.
