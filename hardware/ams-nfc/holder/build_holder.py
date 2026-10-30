"""Erzeugt rc522_holder.stl (5 mm, mit Ferrit-Mulde) und rc522_holder_flach.stl (2,4 mm). Aufruf: python3 build_holder.py"""
import trimesh

pcb_w, pcb_l = 40.0, 60.0
margin, pocket, fit = 2.0, 0.6, 0.4
ferrit_t = 0.5   # Mulde auf der Wandseite für Ferrit-Folie (Folie ca. 0,2-0,3 mm + Klebeband)
hdr_w, hdr_d, r = 24.0, 9.0, 3.0
W, L = pcb_w + 2 * margin, pcb_l + 2 * margin

def box(x0, y0, z0, dx, dy, dz):
    m = trimesh.creation.box(extents=[dx, dy, dz])
    m.apply_translation([x0 + dx / 2, y0 + dy / 2, z0 + dz / 2])
    return m

def rrect(w, l, h, rad, z0=0.0):
    """Quader mit runden Kanten aus Boxen und Zylindern (ohne scipy)."""
    ms = [box(-w / 2 + rad, -l / 2, z0, w - 2 * rad, l, h), box(-w / 2, -l / 2 + rad, z0, w, l - 2 * rad, h)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            c = trimesh.creation.cylinder(radius=rad, height=h, sections=48)
            c.apply_translation([sx * (w / 2 - rad), sy * (l / 2 - rad), z0 + h / 2])
            ms.append(c)
    return trimesh.boolean.union(ms, engine="manifold")


def build(plate_t, ferrit, name):
    body = rrect(W, L, plate_t, r)
    cuts = [
        rrect(pcb_w + fit, pcb_l + fit, pocket + 1, 1.0, z0=plate_t - pocket),
        box(-hdr_w / 2, -pcb_l / 2 - 0.2, -1, hdr_w, hdr_d, plate_t + 2),
    ]
    if ferrit:
        cuts.append(box(-(pcb_w + fit) / 2, -(pcb_l + fit) / 2, -1, pcb_w + fit, pcb_l + fit, 1 + ferrit_t))
    body = trimesh.boolean.difference([body] + cuts, engine="manifold")
    assert body.is_watertight, "Netz nicht geschlossen"
    body.export(name)
    print(name, "ok", body.bounds.round(2).tolist(), "Volumen cm3:", round(body.volume / 1000, 2))


build(5.0, True, "rc522_holder.stl")        # Standard: 5 mm Abstand zur Wand, Ferrit-Mulde unten
build(2.4, False, "rc522_holder_flach.stl")  # dünn, ohne Abstand (alte Version)
