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
- Drucker, Git-Push, Home Assistant und Foto-Erkennung brauchen den Server (`server.ts`) auf dem Raspberry Pi oder in Docker.
- Lokal testen: `VITE_BASE=/filament-website-google-ai/ VITE_STATIC=true npm run build && npm run preview`

Docker: `docker compose up -d` (siehe `docker-compose.yml`). Installation auf dem Raspberry Pi: [INSTALL_RASPBERRY_PI.md](INSTALL_RASPBERRY_PI.md).

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
- Der Server speichert eingegebene Tokens in diesen Dateien (bzw. in `data/`). Der ZIP-Export und das Docker-Image schließen sie aus.
- Ist die Seite von außen erreichbar, setze `APP_API_KEY`. Im Browser einmalig: `localStorage.setItem('app_api_key', 'DEIN_KEY')`.
- Wurde ein Token je öffentlich, gilt es als kompromittiert: bei GitHub bzw. am Drucker erneuern.

## Projektstruktur

- `src/`: Frontend (Komponenten, Hilfsfunktionen, Typen, Daten)
- `server.ts`: Express-Server (Drucker, Home Assistant, Git, Speicher)
- `server/bambuMqtt.ts`: MQTT-Anbindung an den Bambu-Drucker
- `addon/`, `config.yaml`, `repository.yaml`: Home-Assistant-Add-on
- `scripts/`: Hilfsskripte (ZIP-Export, PWA-Icons)

## Prüfen

```bash
npm run lint    # Typprüfung (tsc --noEmit)
npm run build   # Produktions-Build
```

Beides läuft auch automatisch als GitHub Action bei jedem Pull Request.
