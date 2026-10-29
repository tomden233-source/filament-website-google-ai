"""Erzeugt rc522_holder.svg (Draufsicht + Schnitt mit Maßen). Aufruf: python3 build_drawing.py"""
S = 8.0
pcb_w, pcb_l, margin, plate_t, pocket, fit, hdr_w, hdr_d, r = 40, 60, 2, 2.4, 0.6, 0.4, 24, 9, 3
W, L = pcb_w + 2 * margin, pcb_l + 2 * margin
Wd, Hd = 1100, 640
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {Wd} {Hd}" width="{Wd}" height="{Hd}" font-family="Arial, sans-serif">',
     '<style>.p{fill:#e8eef5;stroke:#1d2b3a;stroke-width:1.5}.c{fill:#fff;stroke:#1d2b3a;stroke-width:1.5}.pcb{fill:#2e7d4f;stroke:#14402a;stroke-width:1;opacity:.35}.d{stroke:#c0392b;stroke-width:1;fill:none}.t{font-size:13px;fill:#c0392b}.h{font-size:16px;font-weight:bold;fill:#1d2b3a}.n{font-size:13px;fill:#1d2b3a}</style>',
     f'<rect width="{Wd}" height="{Hd}" fill="#fff"/>',
     '<text x="20" y="30" class="h">Flacher RC522-Halter, zum Kleben mit doppelseitigem Klebeband (Maße in mm)</text>']
a = o.append
cx, cy = 280, 330
X = lambda x: cx + x * S
Y = lambda y: cy - y * S
a(f'<text x="{cx-70}" y="70" class="h">Draufsicht</text>')
a(f'<rect x="{X(-W/2)}" y="{Y(L/2)}" width="{W*S}" height="{L*S}" rx="{r*S}" class="p"/>')
a(f'<rect x="{X(-(pcb_w+fit)/2)}" y="{Y((pcb_l+fit)/2)}" width="{(pcb_w+fit)*S}" height="{(pcb_l+fit)*S}" rx="8" class="c" stroke-dasharray="5 3"/>')
a(f'<rect x="{X(-pcb_w/2)}" y="{Y(pcb_l/2)}" width="{pcb_w*S}" height="{pcb_l*S}" class="pcb"/>')
a(f'<rect x="{X(-hdr_w/2)}" y="{Y(-pcb_l/2-0.2+hdr_d)}" width="{hdr_w*S}" height="{hdr_d*S}" class="c"/>')
a(f'<text x="{X(-hdr_w/2)+10}" y="{Y(-pcb_l/2)-30}" class="n">Fenster für Stiftleiste</text>')
a(f'<text x="{cx-95}" y="{Y(0)}" class="n">Mulde = Platine (40 × 60)</text>')
a(f'<line x1="{X(-W/2)}" y1="{Y(-L/2)+30}" x2="{X(W/2)}" y2="{Y(-L/2)+30}" class="d"/><text x="{cx-18}" y="{Y(-L/2)+48}" class="t">{W:.0f}</text>')
a(f'<line x1="{X(-W/2)-30}" y1="{Y(L/2)}" x2="{X(-W/2)-30}" y2="{Y(-L/2)}" class="d"/><text x="{X(-W/2)-62}" y="{cy}" class="t">{L:.0f}</text>')
qx, qb, S2 = 800, 300, 10
QX = lambda x: qx + x * S2
QZ = lambda z: qb - z * S2
a(f'<text x="{qx-30}" y="70" class="h">Schnitt</text>')
a(f'<rect x="{QX(-W/2)}" y="{QZ(plate_t)}" width="{W*S2}" height="{plate_t*S2}" class="p"/>')
a(f'<rect x="{QX(-(pcb_w+fit)/2)}" y="{QZ(plate_t)}" width="{(pcb_w+fit)*S2}" height="{pocket*S2}" class="c"/>')
a(f'<text x="{qx-215}" y="{QZ(plate_t)-60}" class="n">Mulde ({pocket} tief) = Platz für Platine und Klebeband.</text>')
a(f'<text x="{qx-215}" y="{QZ(plate_t)-40}" class="n">Platine mit der Rückseite aufkleben, Spulenseite zeigt zum Tag.</text>')
a(f'<line x1="{QX(W/2)+16}" y1="{QZ(0)}" x2="{QX(W/2)+16}" y2="{QZ(plate_t)}" class="d"/><text x="{QX(W/2)+22}" y="{QZ(plate_t/2)+4}" class="t">{plate_t}</text>')
a(f'<line x1="{QX(-W/2)}" y1="{QZ(0)+20}" x2="{QX(W/2)}" y2="{QZ(0)+20}" class="d"/><text x="{qx-10}" y="{QZ(0)+38}" class="t">{W:.0f}</text>')
a(f'<text x="{qx-215}" y="{QZ(0)+90}" class="n">Unterseite der Platte: zweites Klebeband zum AMS.</text>')
a(f'<text x="{qx-215}" y="{QZ(0)+112}" class="n">Druck: flach aufs Bett, PETG/ASA, 0,2 mm, 3 Wände, ohne Stützen.</text>')
a('</svg>')
open('rc522_holder.svg', 'w', encoding='utf-8').write('\n'.join(o))
print('ok')
