"""Erzeugt rc522_holder.stl (gleiche Maße wie rc522_holder.scad). Aufruf: python3 build_holder.py"""
import trimesh

pcb_w, pcb_l, pcb_t = 40.0, 60.0, 1.6
fit, wall, front, comp_h = 0.4, 2.4, 1.2, 3.6
groove, slot_t, hdr_w = 1.0, pcb_t + 0.15, 22.0
ear_d, ear_t, ear_hole = 11.0, 2.4, 3.4

in_w, in_l = pcb_w + fit, pcb_l + fit
out_w, out_l = in_w + 2 * wall, in_l + 2 * wall
z_slot = front + comp_h
h = z_slot + slot_t + 1.6

def box(x0, y0, z0, dx, dy, dz):
    m = trimesh.creation.box(extents=[dx, dy, dz])
    m.apply_translation([x0 + dx / 2, y0 + dy / 2, z0 + dz / 2])
    return m

def cyl(x, y, z0, d, hh):
    m = trimesh.creation.cylinder(radius=d / 2, height=hh, sections=48)
    m.apply_translation([x, y, z0 + hh / 2])
    return m

union = lambda ms: trimesh.boolean.union(ms, engine="manifold")
diff = lambda a, bs: trimesh.boolean.difference([a] + bs, engine="manifold")

ears = [(sx * (out_w / 2 + ear_d / 2 - 1), sy * (out_l / 2 - 9)) for sx in (-1, 1) for sy in (-1, 1)]
body = union([box(-out_w / 2, -out_l / 2, 0, out_w, out_l, h)] + [cyl(x, y, 0, ear_d, ear_t) for x, y in ears])
body = diff(body, [
    box(-in_w / 2, -in_l / 2, front, in_w, in_l, h),                       # Innenraum
    box(-in_w / 2, in_l / 2 - 0.01, front, in_w, wall + 1, h),             # +Y offen (Einschub)
    box(-hdr_w / 2, -out_l / 2 - 1, front + 0.8, hdr_w, wall + 2, h),      # Stiftleiste / Kabel
] + [cyl(x, y, -1, ear_hole, ear_t + 2) for x, y in ears])

rails = []
for sx in (-1, 1):
    x0 = in_w / 2 - groove if sx > 0 else -in_w / 2
    rails.append(box(x0, -in_l / 2, front, groove, in_l, comp_h))
    rails.append(box(x0, -in_l / 2, z_slot + slot_t, groove, in_l, h - z_slot - slot_t))
body = union([body] + rails)

assert body.is_watertight, "Netz nicht geschlossen"
body.export("rc522_holder.stl")
print("ok", body.bounds.round(2).tolist(), "Volumen cm3:", round(body.volume / 1000, 2))
