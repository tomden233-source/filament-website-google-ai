# FilamentHub

Filament-Verwaltung für den Bambu Lab X2D mit AMS 2 Pro: Spulenbestand, Waage, Trocknen, Druckverlauf, Home Assistant, NFC-Tags und Cloud-Sync. Läuft als Webseite, Android-App und Windows-App. Frontend mit React und Vite, Server mit Express.

Aktuelle Version: **1.99 (Spulen-Zustand, Gist-Cloud & Neustart)**. Alle Versionen stehen im Revisionsmenü der App und lassen sich dort auswählen.

## Inhalt

1. [Starten](#starten)
2. [Spulen verwalten](#spulen-verwalten)
3. [NFC-Leser im AMS](#nfc-leser-im-ams)
4. [Cloud-Speicher (privater GitHub-Gist)](#cloud-speicher-privater-github-gist)
5. [Webseite, Android, Windows](#webseite-android-windows)
6. [Umgebungsvariablen](#umgebungsvariablen)
7. [Zugangsdaten und Sicherheit](#zugangsdaten-und-sicherheit)
8. [Projektstruktur](#projektstruktur)
9. [Prüfen](#prüfen)

## Starten

```bash
npm install
cp .env.example .env     # Werte anpassen
npm run dev              # Entwicklung (Server + Vite) auf http://localhost:3000
npm run build && npm start   # Produktion (NODE_ENV=production)
```

## Spulen verwalten

Jede Spule hat diese Zustände (Spule bearbeiten → Kasten „Zustand der Spule“). Auf der Karte erscheinen passende Abzeichen.

| Zustand | Bedeutung |
|---|---|
| Auf Spule / ohne Spule | Ohne Spule (Refill) zählt die Leerspule als 0 g |
| Original verschweißt | Gilt als frisch, kein Trocknen nötig |
| Im Eibos-Beutel | Beutelgewicht (Standard 35 g) wird beim Wiegen abgezogen |
| Muss trocknen | Sofort fällig, bis du „getrocknet“ drückst |

**Waage:** Nettogewicht = Waage − Leerspule − Beutel. Die Leerspule kommt von der Spule selbst, sonst aus der Marke (z. B. Bambu 250 g).

**Alles neu eintragen:**

1. Tools-Tab → **Alle Spulen entfernen (Neustart)**. Vorher wird eine Backup-Datei geladen und eine Kopie im Gerät gesichert. Verlauf bleibt, AMS- und Tag-Zuordnungen werden geleert. Oben auf „Zurück“ stellt alles wieder her.
2. Spulen diktieren: pro Spule Marke, Material und Farbe, auf Spule oder nicht, original verschweißt oder nicht, muss trocknen, im Eibos-Beutel, Waagengewicht.
3. Claude trägt sie in `src/data/mySpools.ts` ein (Startliste `MY_SPOOLS_SEED`), erhöht die Revision und pusht. Die App übernimmt die Liste einmal als neuesten Stand.

Ein Revisionswechsel löscht keine Spulen und keinen Verlauf mehr.

## NFC-Leser im AMS

Fünf RC522-Leser erkennen die NFC-Tags der Spulen direkt im AMS 2 Pro. Die App ordnet jede Spule dem Slot zu und setzt Material und Farbe am Drucker, wenn der Slot nicht passt. Slot 1–4 sind die AMS-Slots, Slot 5 ist die externe Spule.

Ordner `hardware/ams-nfc/`:

| Datei | Inhalt |
|---|---|
| `README.md` | Pin-Plan, Einbau, Aufspielen, Testen |
| `filament-ams.yaml` | ESPHome-Konfiguration (mit `esphome config` geprüft: gültig) |
| `holder/` | RC522-Halter für PETG/ASA: `rc522_holder.stl` (Druck), `.scad` (anpassbar), `.svg` (Zeichnung mit Maßen) |

**Teile:** ESP32 (30 oder 38 Pins), 5× RC522, NTAG215-Tags, Dupont-Kabel, M3-Schrauben.

**Pin-Plan:**

| RC522 | ESP32 | |
|---|---|---|
| 3.3V, GND | 3V3, GND | alle 5 Leser, **nur 3,3 V** |
| SCK / MOSI / MISO | GPIO18 / 23 / 19 | alle 5 Leser |
| RST | GPIO22 | alle 5 Leser |
| SDA (CS) Slot 1 / 2 / 3 / 4 / extern | GPIO5 / 17 / 16 / 4 / 13 | je Leser einzeln |
| IRQ | frei | |

**Ablauf:**

1. Halter drucken (Vorderseite aufs Druckbett, PETG oder ASA, 0,2 mm, 4 Wände), Platinen einschieben.
2. ESPHome Device Builder in Home Assistant, neues Gerät `filament-ams`, `filament-ams.yaml` einfügen, Secrets eintragen (`wifi_ssid`, `wifi_password`, `filament_ams_api_key`, `filament_ams_ota`), per USB-C aufspielen.
3. Das Gerät in Home Assistant hinzufügen. Es liefert `sensor.filament_ams_slot_1_tag` bis `slot_5_tag`.
4. In der App: Home-Assistant-Zugang eintragen, im Meldungen-Tab „NFC-Leser“ einschalten. Die App findet die Sensoren selbst.
5. **Tags in einer Reihe beschreiben:** NFC-Fenster → Tab **Alle Spulen beschreiben**. Eine Spule nach der anderen an das Handy halten, die App schreibt den Tag und merkt ihn sich.

**Verhalten:**

- Bekannter Tag: Spule wird dem Slot zugeordnet, bei Abweichung geht Material/Farbe an den Drucker (Entwickler-Modus nötig, abschaltbar).
- Unbekannter Tag: Hinweis „Unbekannter Tag in Slot X“, einmal die Spule wählen, dann ist der Tag gemerkt.
- Slot gilt erst nach 10 Minuten ohne Tag als leer (`remove_after`), weil sich die Spule beim Drucken dreht.
- Die App fragt Home Assistant nur ab, solange der Tab sichtbar ist.

**Einbau:** ESP32 außen montieren (innen bis 65 °C beim Trocknen), nur die flachen RC522-Platinen ins AMS, Abstand zum Tag unter 3 cm, nicht bohren. Die genaue Innenform des AMS 2 Pro ist nicht vermessen, der Halter ist deshalb allgemein gehalten (M3-Ohren, Klebeband oder Kabelbinder).

## Cloud-Speicher (privater GitHub-Gist)

npoint.io wird in manchen Schul- und Firmennetzen gesperrt und ist öffentlich lesbar. Deshalb speichert FilamentHub jetzt in einem **privaten GitHub-Gist**.

1. Token erstellen: https://github.com/settings/tokens/new?scopes=gist (klassisch, nur Haken „gist“).
2. Einstellungen → Verbindungen → **Cloud-Speicher** → Token eintragen → „Privaten Gist anlegen und Daten übernehmen“.
3. Zweites Gerät: „Handy & App“ → QR-Code scannen. Gist-ID und Token stehen im Link nach dem `#` und gehen nie an einen Server.
4. Alten npoint-Speicher erst leeren, wenn alle Geräte umgestellt sind (Knopf in derselben Karte).

Es gewinnt immer der neueste Stand. Der Zugang zu Drucker und Home Assistant bleibt zusätzlich mit deinem Sync-Passwort verschlüsselt (AES-GCM).

Hinweis: Die Verbindung zu `api.github.com` muss im Netz erlaubt sein. Ein Test gegen die echte GitHub-API steht noch aus.

## Webseite, Android, Windows

**GitHub Pages:** https://tomden234.github.io/filament-website-google-ai/ wird bei jedem Push auf `main` per GitHub Action gebaut (`.github/workflows/pages.yml`). Einmalig unter *Settings → Pages* die Quelle auf *GitHub Actions* stellen.

- Auf Pages läuft nur das Frontend (`VITE_STATIC=true`). Spulen und Einstellungen liegen im Browser.
- Drucker-Livedaten, Git-Push und Foto-Erkennung brauchen den Server (`server.ts`). Home Assistant lässt sich direkt aus dem Browser anbinden.
- Lokal testen: `VITE_BASE=/filament-website-google-ai/ VITE_STATIC=true npm run build && npm run preview`

**Android-App (APK):** `.github/workflows/apk.yml` baut bei jedem Push auf `main` eine signierte APK (Capacitor) im Release `apk-latest`. Download: `https://github.com/tomden234/filament-website-google-ai/releases/latest/download/FilamentHub.apk`

- Signatur: `android-signing/filamenthub.keystore`. Eigener Schlüssel: Secret `ANDROID_KEYSTORE_PASSWORD` setzen und Datei ersetzen.
- Das Repository muss öffentlich sein, damit der Download ohne Login klappt.
- Seit 1.62 spricht die App selbst mit dem Drucker (natives MQTT) und liest/beschreibt NFC-Tags (`android-native/`).
- Seit 1.63 aktualisiert sie sich live (Plugin `FilamentLive`, `live-bundle.zip`). Nur bei Änderungen am Java-Teil `NATIVE_API` (FilamentLivePlugin.java) und `nativeApi` (apk.yml) erhöhen, dann ist eine neue APK nötig.
- Seit 1.65 lädt sie neue APKs selbst und öffnet den Installer (`NATIVE_API` = 2). Beim ersten Mal „Installieren erlauben“ bestätigen.
- Der Bambu-E-Mail-Login läuft in der App direkt (CapacitorHttp). Im Browser blockiert Bambu das (CORS): Token manuell holen oder den Server nutzen.

**Windows-App:** `.github/workflows/desktop.yml` (Electron, `electron/`). Zertifikate der Firewall (z. B. FortiGate) lassen sich in der App per Fingerabdruck bestätigen.

## Umgebungsvariablen

| Variable | Zweck |
|---|---|
| `PORT` | Port des Servers (Standard 3000) |
| `GEMINI_API_KEY` | Optional: KI-Bilderkennung (Google Gemini) |
| `BAMBU_HOST`, `BAMBU_SERIAL` | Drucker (IP im LAN, Seriennummer) |
| `BAMBU_ACCESS_CODE` | LAN-Zugangscode (RTSP-Kamera-Link) |
| `BAMBU_USER_ID`, `BAMBU_ACCESS_TOKEN`, `BAMBU_ADMIN_PIN` | Bambu-Cloud-Zugang und PIN für Steuerbefehle |
| `BAMBU_TLS_VERIFY` | `true` prüft das MQTT-Zertifikat (Standard aus) |
| `APP_API_KEY` | Optional: schützt alle `/api`-Routen, Header `x-api-key` |
| `CORS_ORIGIN` | Erlaubte Ursprünge (kommagetrennt) |
| `GIT_AUTHOR_EMAIL` | E-Mail für Commits, die der Server erzeugt |

Vorlage: `.env.example`.

## Zugangsdaten und Sicherheit

- Echte Zugangsdaten gehören nie ins Repository: `.env`, `.git-credentials.json`, `.bambu-config.json`, `.ha-config.json` stehen in der `.gitignore`. Vorlagen heißen `*.example.json`.
- Der Server speichert eingegebene Tokens in diesen Dateien (bzw. in `data/`). Das Gist-Token bleibt nur im Gerät.
- Ist die Seite von außen erreichbar, setze `APP_API_KEY`. Im Browser einmalig: `localStorage.setItem('app_api_key', 'DEIN_KEY')`.
- Wurde ein Token je öffentlich, gilt es als kompromittiert: bei GitHub bzw. am Drucker erneuern.

## Projektstruktur

- `src/`: Frontend
  - `components/`: Hauptfenster; Unterordner `sidebar/`, `bambu/`, `nfc/`, `app/`, `workshop/`
  - `hooks/`: u. a. `useAmsNfcReaders.ts` (NFC-Leser über Home Assistant)
  - `utils/`: u. a. `spoolState.ts` (Spulen-Zustand), `gistStore.ts` und `cloudFetch.ts` (Cloud), `deviceSync.ts` (verschlüsselter Geräte-Sync), `openTag3d.ts` (NFC-Tag-Format)
  - `data/`: `defaultSpools.ts` (Revisionen, Marken), `mySpools.ts` (deine Startliste)
  - `api/`, `types/`
- `server.ts`, `server/routes/`: Express-Server (Drucker, Kamera, Home Assistant, Git, Speicher, Erkennung); `server/bambuMqtt.ts`, `server/bambuCloudApi.ts`
- `hardware/ams-nfc/`: NFC-Leser (ESPHome, Pin-Plan, Halter)
- `android-native/`, `android-signing/`, `capacitor.config.json`: Android-App
- `electron/`: Windows-App
- `scripts/`: Hilfsskripte (PWA-Icons)

## Prüfen

```bash
npm run lint    # Typprüfung (tsc --noEmit)
npm run build   # Produktions-Build
```

Beides läuft auch als GitHub Action bei jedem Pull Request.
