"""Erzeugt rc522_holder.svg (Draufsicht + Querschnitt mit Maßen). Aufruf: python3 build_drawing.py"""
S = 6.0  # px pro mm
pcb_w, pcb_l, pcb_t, fit, wall, front, comp_h = 40, 60, 1.6, 0.4, 2.4, 1.2, 3.6
groove, slot_t, hdr_w, ear_d, ear_hole = 1.0, 1.75, 22, 11, 3.4
in_w, in_l = pcb_w + fit, pcb_l + fit
out_w, out_l = in_w + 2 * wall, in_l + 2 * wall
z_slot = front + comp_h
h = z_slot + slot_t + 1.6
ears = [(sx * (out_w / 2 + ear_d / 2 - 1), sy * (out_l / 2 - 9)) for sx in (-1, 1) for sy in (-1, 1)]

W, H = 1200, 600
o = []
a = o.append
a(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Arial, sans-serif">')
a('<style>.p{fill:#e8eef5;stroke:#1d2b3a;stroke-width:1.5}.c{fill:#fff;stroke:#1d2b3a;stroke-width:1.5}.r{fill:#9db4cc;stroke:#1d2b3a;stroke-width:1}'
  '.pcb{fill:#2e7d4f;stroke:#14402a;stroke-width:1}.d{stroke:#c0392b;stroke-width:1;fill:none}.t{font-size:12px;fill:#c0392b}.h{font-size:15px;font-weight:bold;fill:#1d2b3a}.n{font-size:12px;fill:#1d2b3a}</style>')
a(f'<rect width="{W}" height="{H}" fill="#fff"/>')
a(f'<text x="20" y="28" class="h">RC522-Halter für das AMS-Lesemodul (Maße in mm)</text>')

# --- Draufsicht (Blick auf die Rückseite, offene Seite +Y oben) ---
cx, cy = 230, 310
X = lambda x: cx + x * S
Y = lambda y: cy - y * S
a(f'<text x="{cx-80}" y="62" class="h">Draufsicht (Rückseite)</text>')
for ex, ey in ears:
    a(f'<circle cx="{X(ex)}" cy="{Y(ey)}" r="{ear_d/2*S}" class="p"/>')
a(f'<rect x="{X(-out_w/2)}" y="{Y(out_l/2)}" width="{out_w*S}" height="{out_l*S}" class="p"/>')
a(f'<rect x="{X(-in_w/2)}" y="{Y(in_l/2+wall)}" width="{in_w*S}" height="{(in_l+wall)*S}" class="c"/>')   # Innenraum + offene Seite
for sx in (-1, 1):
    x0 = in_w / 2 - groove if sx > 0 else -in_w / 2
    a(f'<rect x="{X(x0)}" y="{Y(in_l/2)}" width="{groove*S}" height="{in_l*S}" class="r"/>')
a(f'<rect x="{X(-pcb_w/2)}" y="{Y(pcb_l/2-0.5)}" width="{pcb_w*S}" height="{pcb_l*S}" class="pcb" opacity="0.35"/>')
a(f'<rect x="{X(-hdr_w/2)}" y="{Y(-in_l/2)}" width="{hdr_w*S}" height="{wall*S}" class="c"/>')  # Kabelausschnitt
for ex, ey in ears:
    a(f'<circle cx="{X(ex)}" cy="{Y(ey)}" r="{ear_hole/2*S}" class="c"/>')
a(f'<text x="{X(-hdr_w/2)}" y="{Y(-out_l/2)+16}" class="n">Kabel / 8-Pin-Leiste ({hdr_w})</text>')
a(f'<text x="{cx-70}" y="{Y(out_l/2)-8}" class="n">offen: Platine hier einschieben</text>')
# Maße
a(f'<line x1="{X(-out_w/2)}" y1="{Y(-out_l/2)+34}" x2="{X(out_w/2)}" y2="{Y(-out_l/2)+34}" class="d"/>')
a(f'<text x="{cx-18}" y="{Y(-out_l/2)+50}" class="t">{out_w:.1f}</text>')
a(f'<line x1="{X(-out_w/2)-75}" y1="{Y(out_l/2)}" x2="{X(-out_w/2)-75}" y2="{Y(-out_l/2)}" class="d"/>')
a(f'<text x="24" y="{cy}" class="t">{out_l:.1f}</text>')

# --- Querschnitt (X–Z bei Y=0), Vorderwand unten, 2x vergrößert ---
S2 = 12.0
qx, qb = 850, 420
QX = lambda x: qx + x * S2
QZ = lambda z: qb - z * S2
a(f'<text x="{qx-150}" y="62" class="h">Schnitt (Vorderwand unten = Leseseite)</text>')
a(f'<rect x="{QX(-out_w/2)}" y="{QZ(h)}" width="{out_w*S2}" height="{h*S2}" class="p"/>')
a(f'<rect x="{QX(-in_w/2)}" y="{QZ(h)}" width="{in_w*S2}" height="{(h-front)*S2}" class="c"/>')
for sx in (-1, 1):
    x0 = in_w / 2 - groove if sx > 0 else -in_w / 2
    a(f'<rect x="{QX(x0)}" y="{QZ(front+comp_h)}" width="{groove*S2}" height="{comp_h*S2}" class="r"/>')
    a(f'<rect x="{QX(x0)}" y="{QZ(h)}" width="{groove*S2}" height="{(h-z_slot-slot_t)*S2}" class="r"/>')
a(f'<rect x="{QX(-pcb_w/2)}" y="{QZ(z_slot+pcb_t)}" width="{pcb_w*S2}" height="{pcb_t*S2}" class="pcb"/>')
a(f'<text x="{qx-95}" y="{QZ(h)-14}" class="n">Halteleiste oben, RC522-Platine in der Nut</text>')
a(f'<text x="{qx-95}" y="{QZ(front+comp_h/2)+4}" class="n">Platz für Bauteile ({comp_h})</text>')
a(f'<text x="{qx-95}" y="{QZ(front/2)+4}" class="n">Vorderwand ({front}) = Leseseite</text>')
a(f'<line x1="{QX(out_w/2)+20}" y1="{QZ(0)}" x2="{QX(out_w/2)+20}" y2="{QZ(h)}" class="d"/>')
a(f'<text x="{QX(out_w/2)+28}" y="{QZ(h/2)}" class="t">Höhe {h:.1f}</text>')
a(f'<line x1="{QX(-out_w/2)}" y1="{QZ(0)+20}" x2="{QX(out_w/2)}" y2="{QZ(0)+20}" class="d"/>')
a(f'<text x="{qx-18}" y="{QZ(0)+38}" class="t">{out_w:.1f}</text>')
a(f'<text x="{qx-250}" y="{QZ(0)+80}" class="n">Druck: Vorderseite auf das Bett, PETG oder ASA, 0,2 mm, 4 Wände, ohne Stützen.</text>')
a(f'<text x="{qx-250}" y="{QZ(0)+98}" class="n">Befestigung: 4 Ohren mit je M3 (Loch {ear_hole}). Kabel kommt unten aus dem Ausschnitt.</text>')
a('</svg>')
open('rc522_holder.svg', 'w', encoding='utf-8').write('\n'.join(o))
print('ok')
