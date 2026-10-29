# NFC-Leser im AMS 2 Pro

Fünf RC522-Leser erkennen die NFC-Tags deiner Spulen direkt im AMS. Die FilamentHub-App ordnet dann jede Spule automatisch ihrem Slot zu und meldet Material und Farbe an den Drucker.

Slot 1–4 sind die AMS-Slots, Slot 5 ist die externe Spule.

## Pin-Plan

Gilt für ESP32-Boards mit 30 und mit 38 Pins (WROOM-32, DevKitC / NodeMCU).

| RC522-Pin | ESP32-Pin | Gemeinsam? |
|---|---|---|
| 3.3V | 3V3 | alle 5 Leser |
| GND | GND | alle 5 Leser |
| SCK | GPIO18 | alle 5 Leser |
| MOSI | GPIO23 | alle 5 Leser |
| MISO | GPIO19 | alle 5 Leser |
| RST | GPIO22 | alle 5 Leser |
| IRQ | frei lassen | – |
| SDA (= CS) Leser 1 / Slot 1 | GPIO5 | einzeln |
| SDA (= CS) Leser 2 / Slot 2 | GPIO17 | einzeln |
| SDA (= CS) Leser 3 / Slot 3 | GPIO16 | einzeln |
| SDA (= CS) Leser 4 / Slot 4 | GPIO4 | einzeln |
| SDA (= CS) Leser 5 / Extern | GPIO13 | einzeln |

**Wichtig:**
- RC522 **nur an 3,3 V**, nie an 5 V oder VIN.
- Gemeinsame Leitungen sternförmig oder als Kette verlöten, Lötstellen mit Schrumpfschlauch sichern.
- Erst **einen** Leser anschließen und testen, dann die anderen dazu.

## Einbau im AMS 2 Pro

- ESP32 **außen** montieren. Innen wird es beim Trocknen bis 65 °C warm.
- Innen nur die flachen RC522-Platinen, in gedruckten Haltern aus **PETG oder ASA** (kein PLA). Isolierband und normales Doppelklebeband lösen sich bei Hitze.
- Leser auf Höhe der **Spulen-Nabe**, Abstand zum Tag höchstens 2–3 cm.
- Den NFC-Tag mittig auf die Spulen-Seite kleben, nahe der Nabe. So bleibt er beim Drehen vor dem Leser.
- Halter zum Drucken: Ordner `holder/` (STL, SCAD und Zeichnung, Anleitung dort).
- Nicht bohren, lieber klemmen oder kleben (Garantie).

## Aufspielen (ESPHome)

1. In Home Assistant das Add-on **ESPHome Device Builder** installieren und öffnen.
2. **New Device** → Name `filament-ams` → ESP32 auswählen.
3. Den Inhalt von `filament-ams.yaml` in die neue Datei kopieren.
4. Unter **Secrets** eintragen: `wifi_ssid`, `wifi_password`, `filament_ams_api_key` (32 Byte Base64, ESPHome erzeugt beim Anlegen einen) und `filament_ams_ota` (beliebiges Passwort).
5. ESP32 per USB-C an den PC → **Install** → **Plug into this computer**.
   - Das Board hat einen CH340-Chip. Erkennt Windows es nicht, den CH340-Treiber installieren.
6. Danach erscheint das Gerät in Home Assistant unter **Einstellungen → Geräte → ESPHome**. Auf **Hinzufügen** klicken.

## Was die App macht

- Sie findet die Sensoren `sensor.filament_ams_slot_1_tag` … `slot_5_tag` automatisch über deine Home-Assistant-Verbindung.
- **Bekannter Tag** (von der App beschrieben): Die Spule wird dem Slot zugeordnet. Passt der Slot im Drucker nicht, schickt die App Material und Farbe an den Drucker (Entwickler-Modus nötig).
- **Unbekannter Tag:** Die App meldet „Unbekannter Tag in Slot X“. Wähl im Slot einmal die Spule aus, dann merkt sie sich den Tag.
- Der Slot gilt erst nach 10 Minuten ohne Tag als leer, weil sich die Spule beim Drucken dreht. Einstellbar mit `remove_after`.

## Testen

- In Home Assistant unter **Entwicklerwerkzeuge → Zustände** nach `filament_ams` suchen.
- Spule mit Tag vor einen Leser halten. Der Sensor zeigt die Tag-Nummer, z. B. `04-A1-B2-C3-D4-E5-F6`.
- Kommt nichts an: Verkabelung prüfen (MISO/MOSI vertauscht?), Abstand verkleinern, ESPHome-Log ansehen.
