# ESP32-Gehäuse (FilamentHub NFC-Leser)

Zweiteiliges Gehäuse für das ESP32-DevKit, mit Dupont-Steckern auf den Pins. Der ESP32 wird **außen** am AMS montiert (innen wird es beim Trocknen bis 65 °C heiß).

| Datei | Zweck |
|---|---|
| `esp32_case_base.stl` | Unterteil, druckfertig. Außen ca. 50,7 × 72,2 × 23,1 mm (mit Ohren) |
| `esp32_case_lid.stl` | Deckel mit Lüftungsschlitzen, ca. 33,7 × 72,2 × 4 mm |
| `esp32_case.scad` | Parametrisch (OpenSCAD), Maße oben in der Datei |
| `build_case.py` | Erzeugt beide STL neu und prüft, dass Board und Stecker nirgends anstoßen (`pip install trimesh manifold3d`) |
| `esp32_case_preview.png` | Vorschau |

## Erst messen

Die Maße gelten für ein DevKit mit **28,5 × 55 mm** (38 Pin). Hast du das 30-Pin-Board (ca. 28 × 52 mm) oder eine andere Größe, miss Breite und Länge mit dem Messschieber und ändere `bw` und `bl` oben in `build_case.py` oder `esp32_case.scad`. Dann STL neu erzeugen. Etwas Luft ist eingerechnet (0,4 mm ringsum).

## Aufbau

- Board liegt mit den Stiftleisten über einer mittleren Auflage (4,5 mm Platz darunter).
- **USB-Öffnung** an der einen Schmalseite, mittig am Board (14 mm breit).
- **Kabelausgang** an der anderen Schmalseite, oben offen (26 × 9 mm). Der Deckel schließt ihn. Hier laufen die Leitungen zu den RC522-Lesern raus.
- **Zwei Schlitze im Boden** davor für Kabelbinder (Zugentlastung): Bündel mit einem Kabelbinder festzurren.
- **4 Schraubdome in den Ecken** hinter den Board-Enden, Deckel mit 4 × M3 × 8 mm Schrauben (selbstschneidend, Loch 2,6 mm).
- **2 Ohren** mit je einem 4,2-mm-Loch zum Anschrauben, oder statt dessen doppelseitiges Klebeband auf den Boden.
- Über dem Board sind 15 mm Platz für Dupont-Stecker.

## Druck

- PETG oder ASA, 0,2 mm Layer, 3 Wände, ohne Stützen.
- Unterteil: Boden aufs Bett.
- Deckel: Außenseite aufs Bett, der Rand zeigt nach oben.

## Einbau

1. Kabel an die Pins stecken (Pin-Plan: `../README.md`), Bündel durch den Kabelausgang führen.
2. Board in den Innenraum legen, USB-Seite zur Öffnung.
3. Kabelbinder durch die Bodenschlitze ziehen, Bündel festzurren.
4. Deckel auflegen (Rand nach unten, in die Wand) und mit 4 Schrauben festziehen.
5. ESP32 per USB flashen: Deckel ab, USB-Kabel durch die Öffnung stecken.
