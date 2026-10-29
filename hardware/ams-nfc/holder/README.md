# RC522-Halter (AMS 2 Pro)

Allgemeiner Halter für ein RC522-Modul (40 × 60 mm). Die genaue Innenform des AMS 2 Pro ist nicht vermessen, deshalb sitzt der Halter über vier M3-Ohren, Doppelklebeband oder Kabelbinder an der Stelle, die du wählst.

| Datei | Zweck |
|---|---|
| `rc522_holder.stl` | Druckfertig (Slicer direkt öffnen) |
| `rc522_holder.scad` | Parametrisch (OpenSCAD), Maße oben in der Datei anpassen |
| `rc522_holder.svg` | Zeichnung mit Maßen (Draufsicht und Schnitt) |
| `build_holder.py` / `build_drawing.py` | Erzeugen STL und SVG neu (`pip install trimesh manifold3d`) |

## Druck

- Material: PETG oder ASA (PLA wird im warmen AMS weich)
- **Vorderseite (dünne Wand) liegt auf dem Druckbett**, keine Stützen
- 0,2 mm Layer, 4 Wände, 25 % Füllung
- Vorderwand ist 1,2 mm: Lesedistanz zum Tag bleibt unter 3 mm

## Einbau

1. Platine von der offenen Schmalseite in die beiden Nuten schieben, Bauteilseite nach vorn (zur dünnen Wand).
2. Der Ausschnitt an der Gegenseite lässt Stiftleiste und Dupont-Kabel durch.
3. Mit M3-Schrauben an den Ohren oder mit Klebeband am AMS befestigen.
4. Das Tag (NTAG215 auf der Spule) muss vor der dünnen Wand liegen, Abstand unter 3 mm.

Passt die Platine zu locker oder zu stramm: `fit` in der SCAD-Datei (und in `build_holder.py`) um 0,1 ändern.
