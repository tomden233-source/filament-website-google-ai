"""Erzeugt rc522_holder.stl (gleiche Maße wie rc522_holder.scad). Aufruf: python3 build_holder.py"""
import trimesh

pcb_w, pcb_l = 40.0, 60.0
margin, plate_t, pocket, fit = 2.0, 2.4, 0.6, 0.4
hdr_w, hdr_d, r = 24.0, 9.0, 3.0
W, L = pcb_w + 2 * margin, pcb_l + 2 * margin

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

body = rrect(W, L, plate_t, r)
cuts = [
    rrect(pcb_w + fit, pcb_l + fit, pocket + 1, 1.0, z0=plate_t - pocket),
    box(-hdr_w / 2, -pcb_l / 2 - 0.2, -1, hdr_w, hdr_d, plate_t + 2),
]
body = trimesh.boolean.difference([body] + cuts, engine="manifold")
assert body.is_watertight, "Netz nicht geschlossen"
body.export("rc522_holder.stl")
print("ok", body.bounds.round(2).tolist(), "Volumen cm3:", round(body.volume / 1000, 2))
