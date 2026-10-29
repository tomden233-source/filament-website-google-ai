"""Erzeugt esp32_case_base.stl und esp32_case_lid.stl (gleiche Maße wie esp32_case.scad).
Aufruf: python3 build_case.py   (pip install trimesh manifold3d)

Koordinaten: X = Breite, Y = Länge (USB-Ende bei −Y, Kabelausgang bei +Y), Z = Höhe, Mitte = 0/0.
"""
import trimesh

# ---- Maße (mm). Board VOR dem Drucken mit dem Messschieber prüfen! ----
bw, bl = 28.5, 55.0     # Board: Breite × Länge (30-Pin ca. 28 × 52, 38-Pin ca. 28,5 × 55)
clear = 0.4             # Luft ums Board
wall, floor_t = 2.2, 2.0
boss = 6.0              # Schraubdom in den Ecken (liegt hinter den Board-Enden)
under = 4.5             # Platz unter dem Board (Stiftleisten)
pcbt = 1.6              # Board-Dicke
above = 15.0            # Platz über dem Board (Dupont-Stecker)
lid_t, lip_h, lip_w = 2.4, 1.6, 1.2
screw_d, lid_hole_d = 2.6, 3.4   # M3 selbstschneidend in den Dom, Lochmaß im Deckel
usb_w = 14.0
cable_w, cable_depth = 26.0, 9.0
R = 3.0

iw, il = bw + 2 * clear, bl + 2 * (boss + clear)
ow, ol = iw + 2 * wall, il + 2 * wall
H = floor_t + under + pcbt + above
pcb_top = floor_t + under + pcbt


def rrect(w, l, h, rad, z0=0.0):
    ms = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            c = trimesh.creation.cylinder(radius=rad, height=h, sections=48)
            c.apply_translation([sx * (w / 2 - rad), sy * (l / 2 - rad), z0 + h / 2])
            ms.append(c)
    return trimesh.convex.convex_hull(trimesh.util.concatenate(ms))


def box(x0, y0, z0, dx, dy, dz):
    m = trimesh.creation.box(extents=[dx, dy, dz])
    m.apply_translation([x0 + dx / 2, y0 + dy / 2, z0 + dz / 2])
    return m


def cyl(x, y, z0, d, h):
    c = trimesh.creation.cylinder(radius=d / 2, height=h, sections=40)
    c.apply_translation([x, y, z0 + h / 2])
    return c


def union(parts):
    return trimesh.boolean.union(parts, engine="manifold")


def diff(parts):
    return trimesh.boolean.difference(parts, engine="manifold")


boss_xy = [(sx * (iw / 2 - boss / 2), sy * (il / 2 - boss / 2)) for sx in (-1, 1) for sy in (-1, 1)]

# ---------------- Unterteil ----------------
body = rrect(ow, ol, H, R)
adds = []
# mittlere Auflage unter dem Board (zwischen den Stiftleisten)
adds.append(box(-5, -bl / 2 + 6, floor_t - 0.1, 10, bl - 12, under + 0.1))
# Schraubdome in den Ecken (hinter den Board-Enden)
for x, y in boss_xy:
    adds.append(box(x - boss / 2, y - boss / 2, floor_t - 0.1, boss, boss, H - floor_t + 0.1))
# Ohren zum Anschrauben (Mitte der Langseiten)
ears = []
for sx in (-1, 1):
    ear = rrect(13, 14, 3.0, 3.0)
    ear.apply_translation([sx * (ow / 2 + 2.0), 0, 0])
    ears.append(ear)

cavity = rrect(iw, il, H, 1.0, z0=floor_t)
cuts = [cavity]
# USB-Öffnung (−Y-Seite), mittig am Board
cuts.append(box(-usb_w / 2, -ol / 2 - 1, pcb_top - 2.5, usb_w, wall + 2, 9.5))
# Kabelausgang oben offen (+Y-Seite), der Deckel schließt ihn
cuts.append(box(-cable_w / 2, il / 2 - 0.1, H - cable_depth, cable_w, wall + 1.2, cable_depth + 1))
# Kabelbinder-Schlitze im Boden vor dem Kabelausgang
for sx in (-1, 1):
    cuts.append(box(sx * 6 - 2, il / 2 - 4.5, -1, 4, 1.8, floor_t + 2))
# Schraublöcher in den Domen
for x, y in boss_xy:
    cuts.append(cyl(x, y, H - 12, screw_d, 13))
# Löcher in den Ohren
for sx in (-1, 1):
    cuts.append(cyl(sx * (ow / 2 + 5.2), 0, -1, 4.2, 5))

base = union([body] + adds + ears)
base = diff([base] + cuts)
assert base.is_watertight, "Unterteil nicht geschlossen"
base.export("esp32_case_base.stl")

# ---------------- Deckel (zum Drucken: Außenseite auf dem Bett, Rand zeigt nach oben) ----------------
lid = rrect(ow, ol, lid_t, R)
lips = []
for sx in (-1, 1):
    x_out = iw / 2 - 0.3
    lips.append(box(sx * (x_out - lip_w / 2) - lip_w / 2, -bl / 2 + 1, lid_t - 0.1, lip_w, bl - 2, lip_h + 0.1))
lid = union([lid] + lips)
lcuts = []
for x, y in boss_xy:
    lcuts.append(cyl(x, y, -1, lid_hole_d, lid_t + 2))
# Lüftungsschlitze
for i in range(-3, 3):
    lcuts.append(box(-8, i * 5 + 1.25, -1, 16, 1.8, lid_t + 2))
lid = diff([lid] + lcuts)
assert lid.is_watertight, "Deckel nicht geschlossen"
lid.export("esp32_case_lid.stl")

# ---------------- Passprobe: Board und Dupont-Stecker dürfen nirgends anstoßen ----------------
board = box(-bw / 2, -bl / 2, floor_t + under, bw, bl, pcbt)
plugs = [box(sx * (bw / 2 - 3.5) - 1.3, -bl / 2 + 3, pcb_top, 2.6, bl - 6, above - 1) for sx in (-1, 1)]
usb = box(-4.5, -bl / 2 - 6, pcb_top, 9, 12, 3.4)
for name, m in [("Board", board)] + [("Stecker", p) for p in plugs] + [("USB-Stecker", usb)]:
    hit = trimesh.boolean.intersection([base, m], engine="manifold")
    v = 0.0 if hit is None or len(hit.faces) == 0 else hit.volume
    print(f"{name}: Überschneidung {v:.3f} mm3", "OK" if v < 0.01 else "PROBLEM")
    assert v < 0.01, name

print("Außenmaß Unterteil:", [round(x, 1) for x in base.bounds[1] - base.bounds[0]])
print("Außenmaß Deckel:", [round(x, 1) for x in lid.bounds[1] - lid.bounds[0]])
