"""Mini-Gehäuse für den Feuchte-Sensor SHT31-D (4 Pins: VIN, GND, SCL, SDA).
Erzeugt sensor_box_base.stl, sensor_box_lid.stl und sensor_box_preview.png.
Aufruf: python3 build_sensor_box.py   (pip install trimesh manifold3d matplotlib)

Idee: Board liegt auf einer Kante im Unterteil, Kabel (4 Litzen) gehen durch einen Schlitz an der Pin-Seite raus.
Viele Schlitze in Deckel und Seiten, damit die Luft gut an den Sensor kommt (sonst misst er zu langsam).
Der Deckel klemmt (Rand innen), das Board wird von zwei Rippen am Deckel festgehalten. Befestigen: doppelseitiges
Klebeband unter dem Boden oder die Lasche mit Loch (M3 / Kabelbinder).

Koordinaten: X = Breite, Y = Länge (Pin-/Kabel-Seite bei −Y), Z = Höhe, Mitte = 0/0.
"""
import trimesh

# ---- Maße (mm). Board VOR dem Drucken mit dem Messschieber prüfen und hier eintragen! ----
bw, bl = 13.0, 16.0     # Board: Breite (Pin-Seite) × Länge. Lieber etwas zu groß, die Rippen halten es fest.
clear = 0.4             # Luft ums Board
pcbt = 1.6              # Board-Dicke
under = 1.2             # Abstand unter dem Board (Lötstellen der Kabel)
above = 3.0             # Platz über dem Board (Sensor-Chip, Bauteile)
wall, floor_t = 1.2, 1.2
lid_t, lip_h, lip_w = 1.2, 1.4, 0.9
R = 2.0                 # Eckenradius außen
cable_w, cable_h = 7.0, 2.6   # Schlitz für 4 Litzen (26 AWG ≈ 1,1–1,4 mm)
tab_l, tab_hole = 7.0, 3.4    # Lasche zum Anschrauben / Kabelbinder

iw, il = bw + 2 * clear, bl + 2 * clear
ow, ol = iw + 2 * wall, il + 2 * wall
H = floor_t + under + pcbt + above        # Höhe Unterteil (bis Oberkante)
pcb_bot = floor_t + under
pcb_top = pcb_bot + pcbt


def box(x0, y0, z0, dx, dy, dz):
    m = trimesh.creation.box(extents=[dx, dy, dz])
    m.apply_translation([x0 + dx / 2, y0 + dy / 2, z0 + dz / 2])
    return m


def cyl(x, y, z0, d, h):
    c = trimesh.creation.cylinder(radius=d / 2, height=h, sections=32)
    c.apply_translation([x, y, z0 + h / 2])
    return c


def union(parts):
    return trimesh.boolean.union(parts, engine="manifold")


def diff(parts):
    return trimesh.boolean.difference(parts, engine="manifold")


def rrect(w, l, h, rad, z0=0.0):
    """Quader mit runden senkrechten Kanten (zwei Kreuz-Quader + vier Eckzylinder)."""
    parts = [box(-w / 2 + rad, -l / 2, z0, w - 2 * rad, l, h), box(-w / 2, -l / 2 + rad, z0, w, l - 2 * rad, h)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(cyl(sx * (w / 2 - rad), sy * (l / 2 - rad), z0, 2 * rad, h))
    return union(parts)


# ---------------- Unterteil ----------------
body = rrect(ow, ol, H, R)
# Lasche an der Rückseite (+Y) mit Loch
tab = rrect(ow * 0.7, tab_l + 2 * R, 1.6, R)
tab.apply_translation([0, ol / 2 + tab_l / 2 - R, 0])
# Auflage-Leisten an den Längsseiten (Board liegt darauf, Lötstellen haben unten Platz)
ledges = [box(sx * (iw / 2 - 0.6) - 0.6, -il / 2, floor_t - 0.1, 1.2, il, under + 0.1) for sx in (-1, 1)]

cuts = [rrect(iw, il, H, 0.6, z0=floor_t)]
# Kabelschlitz an der Pin-Seite (−Y), oben offen: Kabel einlegen, Deckel drauf
cuts.append(box(-cable_w / 2, -ol / 2 - 1, pcb_bot - 0.6, cable_w, wall + 2, H))
# Lüftungsschlitze in beiden Längsseiten (über dem Board, damit Luft durchzieht)
for sx in (-1, 1):
    for i in range(3):
        y = -il / 2 + 3.5 + i * 4.0
        cuts.append(box(sx * (ow / 2) - (wall + 1) / 2, y, pcb_top + 0.2, wall + 1, 2.0, above - lip_h - 0.4))
# Schlitze im Boden (Luft von unten)
for i in range(3):
    cuts.append(box(-iw / 2 + 2.2, -il / 2 + 4 + i * 4.0, -1, iw - 4.4, 1.4, floor_t + 2))
# Loch in der Lasche
cuts.append(cyl(0, ol / 2 + tab_l / 2, -1, tab_hole, 4))

base = union([body, tab] + ledges)
base = diff([base] + cuts)
assert base.is_watertight, "Unterteil nicht geschlossen"
base.export("sensor_box_base.stl")

# ---------------- Deckel (zum Drucken: flache Seite aufs Bett, Rand und Rippen zeigen nach oben) ----------------
lid = rrect(ow, ol, lid_t, R)
adds = []
# Rand innen, klemmt in der Öffnung (0,15 mm Spiel je Seite)
g = 0.15
rim_o = rrect(iw - 2 * g, il - 2 * g, lip_h, 0.5, z0=lid_t - 0.05)
rim_i = rrect(iw - 2 * g - 2 * lip_w, il - 2 * g - 2 * lip_w, lip_h + 1, 0.3, z0=lid_t - 0.5)
rim = diff([rim_o, rim_i])
# Beim Aufsetzen wird der Deckel um X gedreht: +Y im Deckel liegt dann über −Y (Kabelseite) des Unterteils.
# Am Kabelschlitz keinen Rand, dafür füllt ein Steg den Schlitz bis auf Kabelhöhe
rim = diff([rim, box(-cable_w / 2 + 0.2, il / 2 - 2, lid_t - 1, cable_w - 0.4, 3, lip_h + 2)])
adds.append(rim)
plug_h = H - (pcb_bot - 0.6) - cable_h  # Steg von oben in den Schlitz, lässt unten cable_h für die Kabel
adds.append(box(-cable_w / 2 + 0.2, ol / 2 - wall, lid_t - 0.05, cable_w - 0.4, wall, plug_h + 0.05))
# zwei Rippen drücken das Board auf die Leisten (an den Längsseiten, weg vom Sensor in der Mitte)
rib_h = above - 0.1  # liegt 0,1 mm über dem Board: hält es fest, ohne zu drücken
for sx in (-1, 1):
    adds.append(box(sx * (iw / 2 - 1.0) - 0.5, -il / 2 + 2, lid_t - 0.05, 1.0, il - 4, rib_h))
lid = union([lid] + adds)
# Lüftungsschlitze im Deckel (mittig über dem Sensor)
lcuts = []
for i in range(4):
    lcuts.append(box(-iw / 2 + 2.6, -il / 2 + 2.5 + i * 3.6, -1, iw - 5.2, 1.4, lid_t + 2))
lid = diff([lid] + lcuts)
assert lid.is_watertight, "Deckel nicht geschlossen"
lid.export("sensor_box_lid.stl")

# ---------------- Passprobe ----------------
board = box(-bw / 2, -bl / 2, pcb_bot, bw, bl, pcbt)
chip_space = box(-bw / 2 + 2, -bl / 2 + 2, pcb_top, bw - 4, bl - 4, above - 0.3)
hit = trimesh.boolean.intersection([base, board], engine="manifold")
v = 0.0 if hit is None or len(hit.faces) == 0 else hit.volume
print(f"Board im Unterteil: Überschneidung {v:.3f} mm3", "OK" if v < 0.01 else "PROBLEM")
assert v < 0.01
# Deckel in Einbaulage (umgedreht auf das Unterteil)
lid_on = lid.copy()
lid_on.apply_transform(trimesh.transformations.rotation_matrix(3.14159265, [1, 0, 0]))
lid_on.apply_translation([0, 0, H + lid_t])
for name, m in [("Board", board), ("Platz über dem Sensor", chip_space)]:
    hit = trimesh.boolean.intersection([lid_on, m], engine="manifold")
    v = 0.0 if hit is None or len(hit.faces) == 0 else hit.volume
    print(f"{name} gegen Deckel: Überschneidung {v:.3f} mm3", "OK" if v < 0.01 else "PROBLEM")
    assert v < 0.01, name
# Rippen berühren das Board (drücken es fest): Abstand Rippe ↔ Board-Oberseite
rib_bottom = H - rib_h
print(f"Rippen-Unterkante {rib_bottom:.2f} mm, Board-Oberseite {pcb_top:.2f} mm (Rippe liegt auf)")
hit = trimesh.boolean.intersection([lid_on, base], engine="manifold")
v = 0.0 if hit is None or len(hit.faces) == 0 else hit.volume
print(f"Deckel gegen Unterteil: Überschneidung {v:.3f} mm3", "OK" if v < 0.05 else "PROBLEM")
assert v < 0.05

print("Außenmaß Unterteil (mit Lasche):", [round(float(x), 1) for x in base.bounds[1] - base.bounds[0]])
print("Außenmaß Deckel:", [round(float(x), 1) for x in lid.bounds[1] - lid.bounds[0]])
print("Gesamthöhe zu:", round(H + lid_t, 1), "mm")

# ---------------- Vorschau ----------------
try:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection

    fig = plt.figure(figsize=(9, 4.5))
    for k, (mesh, title, elev) in enumerate([(base, "Unterteil", 35), (lid, "Deckel (Druckseite unten)", 35)]):
        ax = fig.add_subplot(1, 2, k + 1, projection="3d")
        pc = Poly3DCollection(mesh.triangles, alpha=1.0, facecolor="#2e7d5b", edgecolor="#1b4d37", linewidths=0.05)
        ax.add_collection3d(pc)
        lo, hi = mesh.bounds
        c = (lo + hi) / 2
        r = max(hi - lo) / 2
        ax.set_xlim(c[0] - r, c[0] + r)
        ax.set_ylim(c[1] - r, c[1] + r)
        ax.set_zlim(c[2] - r, c[2] + r)
        ax.view_init(elev=elev, azim=-60)
        ax.set_title(title)
        ax.set_axis_off()
    plt.tight_layout()
    plt.savefig("sensor_box_preview.png", dpi=130)
    print("Vorschau: sensor_box_preview.png")
except Exception as e:  # Vorschau ist nur Zusatz
    print("Keine Vorschau:", e)
