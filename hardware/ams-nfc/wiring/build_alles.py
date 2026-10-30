"""Ein Bild für alles: 5 Leser (oben) + 2 Sensoren (unten, mit deinen Kabelfarben Rot/Orange/Gelb/Grün).
Aufruf: python3 build_alles.py  (braucht matplotlib und pillow, build_wiring.py liegt daneben)
"""
import build_wiring as bw
from PIL import Image

out = {}
bw.save = lambda fig, name: (fig.savefig(f"_tmp_{name}.png", dpi=100), out.__setitem__(name, f"_tmp_{name}.png"))
bw.fig_all()
# Sensor-Kabel in den Farben des Nutzers: Rot = VIN, Orange = GND, Gelb = SCL, Grün = SDA
bw.C.update({"3V3": "#d62828", "GND": "#f08a24", "SCL": "#e0b400", "SDA": "#2a9d4a"})
bw.fig_sensor()
a = Image.open(out["2_alle_leser"]).convert("RGB")
b = Image.open(out["3_sensor"]).convert("RGB")
w = max(a.width, b.width)
img = Image.new("RGB", (w, a.height + b.height + 30), "white")
img.paste(a, (0, 0))
img.paste(b, (0, a.height + 30))
img.save("5_alles_reader_sensor.png")
import os
for f in out.values():
    os.remove(f)
print(img.size)
