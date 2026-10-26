"""Zeichnet das App-Icon für iOS: weißer Haken auf Verlauf Blau → Violett.

    python3 make-icons.py

Erzeugt res/ios/icon-1024.png (1024 × 1024, ohne Alphakanal). iOS rundet die
Ecken selbst ab – das Bild muss deshalb randlos und eckig sein; ein
Alphakanal führt beim Upload zur Ablehnung. Farben und Hakenform wie die
Wortmarke in der App (.brand-mark) und das Play-Store-Icon.
"""
from PIL import Image, ImageDraw

N = 1024
S = 4                      # Überabtastung für glatte Kanten
W = N * S
STOPS = [(0.00, (0x25, 0x63, 0xEB)), (0.55, (0x4F, 0x46, 0xE5)), (1.00, (0x7C, 0x3A, 0xED))]


def farbe(t):
    for (t0, c0), (t1, c1) in zip(STOPS, STOPS[1:]):
        if t <= t1:
            f = (t - t0) / (t1 - t0)
            return tuple(round(a + (b - a) * f) for a, b in zip(c0, c1))
    return STOPS[-1][1]


# Verlauf unter 135° (oben links → unten rechts), klein berechnet, dann skaliert
k = 256
klein = Image.new("RGB", (k, k))
px = klein.load()
for y in range(k):
    for x in range(k):
        px[x, y] = farbe((x + y) / (2 * (k - 1)))
bild = klein.resize((W, W), Image.BICUBIC)

# Haken: Pfad M4 12.5 9 17.5 20 6.5 im 24er-Raster, Strichstärke 2.4,
# auf 62 % der Kantenlänge verkleinert und mittig gesetzt
d = ImageDraw.Draw(bild)
skala = W * 0.62 / 16          # der Haken ist 16 Einheiten breit (4 … 20)
ox = W / 2 - 12 * skala
oy = W / 2 - 12 * skala
punkte = [(ox + x * skala, oy + y * skala) for x, y in [(4, 12.5), (9, 17.5), (20, 6.5)]]
breite = round(2.4 * skala)
d.line(punkte, fill="white", width=breite, joint="curve")
r = breite / 2
for x, y in (punkte[0], punkte[-1]):
    d.ellipse([x - r, y - r, x + r, y + r], fill="white")

bild = bild.resize((N, N), Image.LANCZOS).convert("RGB")
bild.save("res/ios/icon-1024.png", optimize=True)
print("res/ios/icon-1024.png", bild.size, bild.mode)
