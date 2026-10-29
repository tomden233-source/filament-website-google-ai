// Gehäuse für ESP32-DevKit (FilamentHub NFC-Leser). Unterteil + Deckel, alle Maße in mm.
// Gleiche Maße wie build_case.py. Board vor dem Drucken mit dem Messschieber prüfen!
// Druck: PETG (oder ASA), 0,2 mm, 3 Wände, ohne Stützen. Unterteil: Boden aufs Bett.
// Deckel: Außenseite aufs Bett, der Rand zeigt nach oben.
part = "both";   // "base", "lid" oder "both" (both = nebeneinander)

bw = 28.5;  bl = 55;      // Board: Breite × Länge (30-Pin ca. 28 × 52, 38-Pin ca. 28,5 × 55)
clear = 0.4;
wall = 2.2;  floor_t = 2;
boss = 6;                 // Schraubdom in den Ecken
under = 4.5;              // Platz unter dem Board (Stiftleisten)
pcbt = 1.6;
above = 15;               // Platz über dem Board (Dupont-Stecker)
lid_t = 2.4;  lip_h = 1.6;  lip_w = 1.2;
screw_d = 2.6;  lid_hole_d = 3.4;   // M3 selbstschneidend
usb_w = 14;
cable_w = 26;  cable_depth = 9;
R = 3;

iw = bw + 2*clear;  il = bl + 2*(boss + clear);
ow = iw + 2*wall;   ol = il + 2*wall;
H = floor_t + under + pcbt + above;
pcb_top = floor_t + under + pcbt;
$fn = 48;

module rrect(w, l, h, rad) {
  hull() for (sx=[-1,1], sy=[-1,1]) translate([sx*(w/2-rad), sy*(l/2-rad), 0]) cylinder(r=rad, h=h);
}
bosses = [for (sx=[-1,1], sy=[-1,1]) [sx*(iw/2-boss/2), sy*(il/2-boss/2)]];

module base() {
  difference() {
    union() {
      rrect(ow, ol, H, R);
      translate([-5, -bl/2+6, floor_t-0.1]) cube([10, bl-12, under+0.1]);                 // Auflage unter dem Board
      for (b = bosses) translate([b[0]-boss/2, b[1]-boss/2, floor_t-0.1]) cube([boss, boss, H-floor_t+0.1]);
      for (sx=[-1,1]) translate([sx*(ow/2+2), 0, 0]) rrect(13, 14, 3, 3);                 // Ohren
    }
    translate([0, 0, floor_t]) rrect(iw, il, H, 1);                                       // Innenraum
    translate([-usb_w/2, -ol/2-1, pcb_top-2.5]) cube([usb_w, wall+2, 9.5]);              // USB-Öffnung
    translate([-cable_w/2, il/2-0.1, H-cable_depth]) cube([cable_w, wall+1.2, cable_depth+1]); // Kabelausgang
    for (sx=[-1,1]) translate([sx*6-2, il/2-4.5, -1]) cube([4, 1.8, floor_t+2]);          // Kabelbinder
    for (b = bosses) translate([b[0], b[1], H-12]) cylinder(d=screw_d, h=13);
    for (sx=[-1,1]) translate([sx*(ow/2+5.2), 0, -1]) cylinder(d=4.2, h=5);
  }
}

module lid() {
  difference() {
    union() {
      rrect(ow, ol, lid_t, R);
      for (sx=[-1,1]) translate([sx*(iw/2-0.3-lip_w/2)-lip_w/2, -bl/2+1, lid_t-0.1]) cube([lip_w, bl-2, lip_h+0.1]);
    }
    for (b = bosses) translate([b[0], b[1], -1]) cylinder(d=lid_hole_d, h=lid_t+2);
    for (i=[-3:2]) translate([-8, i*5+1.25, -1]) cube([16, 1.8, lid_t+2]);                // Lüftung
  }
}

if (part == "base" || part == "both") base();
if (part == "lid"  || part == "both") translate([ow/2 + 24, 0, 0]) lid();
