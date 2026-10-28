# FilamentHub

Filament-Verwaltung mit Bambu-Lab-Anbindung (MQTT), Home-Assistant-Integration, NFC-Tags und Cloud-Sync. Frontend mit React und Vite, Server mit Express.

## Starten

```bash
npm install
cp .env.example .env     # Werte anpassen
npm run dev              # Entwicklung (Server + Vite) auf http://localhost:3000
npm run build && npm start   # Produktion (NODE_ENV=production)
```

## GitHub Pages

Die Seite https://tomden234.github.io/filament-website-google-ai/ wird bei jedem Push auf `main` per GitHub Action gebaut (`.github/workflows/pages.yml`, Vite, Ordner `dist`). Einmalig unter *Settings → Pages* die Quelle auf *GitHub Actions* stellen.

- Auf Pages läuft nur das Frontend (`VITE_STATIC=true`, Basispfad = Repo-Name). Spulen und Einstellungen liegen im Browser.
- Drucker-Livedaten, Git-Push und Foto-Erkennung brauchen den Server (`server.ts`), den du lokal mit `npm run dev` startest. Home Assistant lässt sich direkt aus dem Browser anbinden.
- Lokal testen: `VITE_BASE=/filament-website-google-ai/ VITE_STATIC=true npm run build && npm run preview`

## Android-App (APK)

Der Workflow `.github/workflows/apk.yml` baut bei jedem Push auf `main` eine signierte APK (Capacitor) und veröffentlicht sie im Release `apk-latest`. Fester Download-Link, auf den der QR-Code in der App zeigt: `https://github.com/tomden234/filament-website-google-ai/releases/latest/download/FilamentHub.apk`.

- Signiert wird mit `android-signing/filamenthub.keystore` (nur für diese Sideload-App). Eigenen Schlüssel nutzen: Passwort als Secret `ANDROID_KEYSTORE_PASSWORD` hinterlegen und die Keystore-Datei ersetzen.
- Das Repository muss öffentlich sein, damit der Download ohne Login am Handy klappt.
- Der E-Mail-Login im Bambu-Fenster läuft in der App direkt gegen Bambu (CapacitorHttp in `capacitor.config.json`, kein Server nötig). Im normalen Browser blockiert Bambu das (CORS), dort das Token manuell holen oder den lokalen Server nutzen. Die Live-Verbindung zum Drucker (MQTT) braucht weiterhin den Server.

## Umgebungsvariablen

| Variable | Zweck |
|---|---|
| `PORT` | Port des Servers (Standard 3000) |
| `GEMINI_API_KEY` | Optional: KI-Bilderkennung (Google Gemini) |
| `BAMBU_HOST`, `BAMBU_SERIAL` | Drucker (IP im LAN, Seriennummer) |
| `BAMBU_ACCESS_CODE` | LAN-Zugangscode (für den RTSP-Kamera-Link) |
| `BAMBU_USER_ID`, `BAMBU_ACCESS_TOKEN`, `BAMBU_ADMIN_PIN` | Bambu-Cloud-Zugang und PIN für Steuerbefehle |
| `BAMBU_TLS_VERIFY` | `true` prüft das MQTT-Zertifikat (Standard aus) |
| `APP_API_KEY` | Optional: schützt alle `/api`-Routen, Header `x-api-key` |
| `CORS_ORIGIN` | Erlaubte Ursprünge für Cross-Origin-Zugriffe (kommagetrennt) |
| `GIT_AUTHOR_EMAIL` | E-Mail für Commits, die der Server erzeugt |

Alle Werte stehen als Vorlage in `.env.example`.

## Zugangsdaten und Sicherheit

- Echte Zugangsdaten gehören nie ins Repository: `.env`, `.git-credentials.json`, `.bambu-config.json` und `.ha-config.json` stehen in der `.gitignore`. Vorlagen heißen `*.example.json`.
- Der Server speichert eingegebene Tokens in diesen Dateien (bzw. in `data/`).
- Ist die Seite von außen erreichbar, setze `APP_API_KEY`. Im Browser einmalig: `localStorage.setItem('app_api_key', 'DEIN_KEY')`.
- Wurde ein Token je öffentlich, gilt es als kompromittiert: bei GitHub bzw. am Drucker erneuern.

## Projektstruktur

- `src/`: Frontend
  - `components/`: Hauptfenster; Unterordner `sidebar/`, `bambu/`, `nfc/`, `app/` enthalten die Tabs, Panels und Hooks der großen Fenster
  - `hooks/`, `utils/`, `api/` (zentrale Server-Aufrufe), `types/`, `data/`
  - `utils/openTag3d.ts`: Encoder und Decoder für OpenTag3D-NFC-Tags
- `server.ts`: Einstieg des Express-Servers (Middleware, Routen einhängen, Vite/Static)
- `server/routes/`: Routen nach Thema (Drucker, Kamera, Home Assistant, Git, Speicher, Erkennung)
- `server/bambuMqtt.ts`: MQTT-Anbindung an den Bambu-Drucker, `server/bambuCloudApi.ts`: Bambu-Cloud-HTTP-Aufrufe
- `android-signing/`, `capacitor.config.json`: Signatur und Konfiguration der Android-App
- `scripts/`: Hilfsskripte (PWA-Icons)

## Prüfen

```bash
npm run lint    # Typprüfung (tsc --noEmit)
npm run build   # Produktions-Build
```

Beides läuft auch automatisch als GitHub Action bei jedem Pull Request.
