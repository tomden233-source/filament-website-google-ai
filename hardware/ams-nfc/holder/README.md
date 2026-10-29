# RC522-Halter (AMS 2 Pro), flach zum Kleben

Eine flache Platte ohne Seitenteile. Platine und Platte werden mit doppelseitigem Klebeband geklebt, die Platte genauso am AMS. Die Innenform des AMS 2 Pro ist nicht vermessen, deshalb passt die Platte überall, wo eine ebene Fläche ist.

| Datei | Zweck |
|---|---|
| `rc522_holder.stl` | Druckfertig (Slicer direkt öffnen), 44 × 64 × 2,4 mm |
| `rc522_holder.scad` | Parametrisch (OpenSCAD), Maße oben in der Datei |
| `rc522_holder.svg` | Zeichnung mit Maßen |
| `build_holder.py` / `build_drawing.py` | Erzeugen STL und SVG neu (`pip install trimesh manifold3d`) |

## Druck

- PETG oder ASA (PLA wird im warmen AMS weich)
- Flach aufs Bett, 0,2 mm Layer, 3 Wände, ohne Stützen

## Einbau

1. Doppelseitiges Klebeband in die flache Mulde (0,6 mm tief) kleben, die Platine mit der **Rückseite** aufkleben. Die Spulenseite (Chip, Antenne) zeigt vom Halter weg zum Tag.
2. Das Fenster am Rand lässt die Stiftleiste und das Dupont-Kabel durch.
3. Zweites Klebeband auf die Unterseite der Platte und ans AMS kleben. Für die Hitze beim Trocknen (bis 65 °C) Klebeband für hohe Temperaturen nehmen, z. B. 3M VHB.
4. Abstand zwischen Platine und NFC-Tag der Spule unter 3 cm.
