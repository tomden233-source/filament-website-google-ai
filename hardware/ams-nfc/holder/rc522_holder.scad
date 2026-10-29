// RC522-Halter für das FilamentHub-AMS-Lesemodul (PETG / ASA, ohne Stützen)
// Platine wird von der offenen Schmalseite (+Y) in zwei seitliche Nuten geschoben. Kein Kleber nötig.
// Druck: Vorderseite (dünne Wand, Leseseite) liegt auf dem Druckbett. Layer 0,2 mm, 4 Wände, 25 % Füllung.
// Alle Maße in mm. Platine RC522: 40 x 60 x 1,6. Spulenseite zeigt zur dünnen Vorderwand (Lesedistanz < 3 mm).
pcb_w = 40;   pcb_l = 60;  pcb_t = 1.6;
fit   = 0.4;                // Spiel rundum
wall  = 2.4;                // Seitenwand
front = 1.2;                // Vorderwand (Leseseite) – dünn lassen!
comp_h= 3.6;                // Platz für Bauteile vor der Platine
groove= 1.0;                // Nut-Tiefe an den Längskanten
slot_t= pcb_t + 0.15;       // Nut-Höhe (saugend)
hdr_w = 22;                 // Ausschnitt für Stiftleiste + Kabel (−Y-Seite)
ear_d = 11;  ear_t = 2.4;  ear_hole = 3.4;   // Ohren für M3

in_w = pcb_w + fit;  in_l = pcb_l + fit;
out_w = in_w + 2*wall;  out_l = in_l + 2*wall;
z_slot = front + comp_h;                   // Unterkante der Nut
h = z_slot + slot_t + 1.6;                 // Gesamthöhe

ears = [for (sx=[-1,1], sy=[-1,1]) [sx*(out_w/2 + ear_d/2 - 1), sy*(out_l/2 - 9)]];

difference() {
  union() {
    translate([-out_w/2, -out_l/2, 0]) cube([out_w, out_l, h]);
    for (p = ears) translate([p[0], p[1], 0]) cylinder(d = ear_d, h = ear_t, $fn = 48);
  }
  // Innenraum
  translate([-in_w/2, -in_l/2, front]) cube([in_w, in_l, h]);
  // +Y-Seite komplett offen (Einschub)
  translate([-in_w/2, in_l/2 - 0.01, front]) cube([in_w, wall + 1, h]);
  // Stiftleiste / Kabel auf der −Y-Seite
  translate([-hdr_w/2, -out_l/2 - 1, front + 0.8]) cube([hdr_w, wall + 2, h]);
  // Ohr-Löcher
  for (p = ears) translate([p[0], p[1], -1]) cylinder(d = ear_hole, h = ear_t + 2, $fn = 32);
}
// Auflageleisten (unter der Platine) und Halteleisten (über der Platine) entlang der Längskanten
for (sx = [-1, 1]) {
  translate([sx > 0 ? in_w/2 - groove : -in_w/2, -in_l/2, front])  cube([groove, in_l, comp_h]);
  translate([sx > 0 ? in_w/2 - groove : -in_w/2, -in_l/2, z_slot + slot_t]) cube([groove, in_l, h - z_slot - slot_t]);
}
