"""Erzeugt public/icon.ico (Windows-App, Taskleiste, Installer) und public/favicon.ico aus public/icon.svg.
Große Größen: das volle Logo. Kleine Größen (16 bis 32 px): vereinfachtes Logo (dicker Ring), sonst wird das Bild zu Matsch.
Aufruf: python3 scripts/make-desktop-icon.py   (braucht Playwright mit Chromium)"""
import base64, os, struct, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FULL = open(os.path.join(ROOT, 'public', 'icon.svg'), encoding='utf-8').read()
SMALL = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs><radialGradient id="bg" cx="35%" cy="25%" r="95%"><stop offset="0" stop-color="#0f3d26"/><stop offset="1" stop-color="#020d08"/></radialGradient>
<linearGradient id="r" x1="15%" y1="0" x2="85%" y2="100%"><stop offset="0" stop-color="#6ee7a8"/><stop offset=".5" stop-color="#10b981"/><stop offset="1" stop-color="#047857"/></linearGradient></defs>
<rect width="512" height="512" rx="104" fill="url(#bg)"/>
<circle cx="256" cy="256" r="214" fill="url(#r)"/>
<circle cx="256" cy="256" r="146" fill="#053b27"/>
<circle cx="256" cy="256" r="92" fill="url(#r)"/>
<circle cx="256" cy="256" r="46" fill="#010604"/>
</svg>'''
SIZES = [16, 24, 32, 48, 64, 128, 256]

def render(page, svg, px):
    page.set_viewport_size({'width': px, 'height': px})
    page.set_content(f'<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,{base64.b64encode(svg.encode()).decode()}" width="{px}" height="{px}" style="display:block"></body></html>')
    return page.screenshot(omit_background=True, clip={'x': 0, 'y': 0, 'width': px, 'height': px})

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page()
    pngs = [(px, render(page, SMALL if px <= 32 else FULL, px)) for px in SIZES]
    b.close()

out = bytearray(struct.pack('<HHH', 0, 1, len(pngs)))
offset = 6 + 16 * len(pngs)
blobs = b''
for px, data in pngs:
    out += struct.pack('<BBBBHHII', px % 256, px % 256, 0, 0, 1, 32, len(data), offset + len(blobs))
    blobs += data
out += blobs
for name in ('icon.ico', 'favicon.ico'):
    open(os.path.join(ROOT, 'public', name), 'wb').write(out)
print('ok', len(out), 'Bytes', SIZES)
