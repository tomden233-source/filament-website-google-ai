// RC522-Halter, flach: nur eine Grundplatte, keine Seitenwände. Platine und Platte werden mit doppelseitigem Klebeband geklebt.
// Platine mit der Rückseite aufkleben, Spulenseite zeigt vom Halter weg zum Tag. Fenster lässt die Stiftleiste durch.
// Druck: flach auf das Bett, PETG oder ASA, 0,2 mm, 3 Wände, ohne Stützen. Alle Maße in mm.
pcb_w = 40;  pcb_l = 60;
margin = 2;        // Rand um die Platine
plate_t = 2.4;     // Plattendicke
pocket = 0.6;      // flache Mulde als Positionshilfe (Platine liegt darin)
fit = 0.4;
hdr_w = 24; hdr_d = 9;   // Fenster für 8-Pin-Leiste an der Schmalseite (−Y)
r = 3;

W = pcb_w + 2*margin;  L = pcb_l + 2*margin;
module rrect(w, l, h, rad) {
  hull() for (sx=[-1,1], sy=[-1,1]) translate([sx*(w/2-rad), sy*(l/2-rad), 0]) cylinder(r = rad, h = h, $fn = 48);
}
difference() {
  rrect(W, L, plate_t, r);
  translate([0, 0, plate_t - pocket]) rrect(pcb_w + fit, pcb_l + fit, pocket + 1, 1);
  translate([-hdr_w/2, -pcb_l/2 - 0.2, -1]) cube([hdr_w, hdr_d, plate_t + 2]);
}
