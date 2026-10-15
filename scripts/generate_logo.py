"""Programmatically render the MilestonePulse logo as a crisp 512x512 PNG.

Draws an electric-cyan pulse waveform crossing a translucent verification prism
over a dark navy-to-indigo radial background, and writes the asset to both
frontend/public/logo.png and docs/logo.png (well under the 500 KB budget).
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SIZE = 512


def radial_background():
    img = Image.new("RGB", (SIZE, SIZE))
    px = img.load()
    cx = cy = SIZE / 2
    maxd = math.dist((0, 0), (cx, cy))
    deep_navy = (10, 14, 34)
    indigo = (28, 30, 74)
    for y in range(SIZE):
        for x in range(SIZE):
            d = math.dist((x, y), (cx, cy)) / maxd
            d = min(1.0, max(0.0, d))
            r = int(indigo[0] + (deep_navy[0] - indigo[0]) * d)
            g = int(indigo[1] + (deep_navy[1] - indigo[1]) * d)
            b = int(indigo[2] + (deep_navy[2] - indigo[2]) * d)
            px[x, y] = (r, g, b)
    return img


def draw_prism(draw):
    cx, cy = SIZE / 2, SIZE / 2
    tri = [(cx, cy - 150), (cx - 130, cy + 95), (cx + 130, cy + 95)]
    draw.polygon(tri, outline=(120, 220, 255), width=4)
    # inner facet lines to suggest refraction
    draw.line([(cx, cy - 150), (cx - 40, cy + 95)], fill=(120, 200, 255), width=2)
    draw.line([(cx, cy - 150), (cx + 40, cy + 95)], fill=(120, 200, 255), width=2)
    draw.line([(cx - 130, cy + 95), (cx + 130, cy + 95)], fill=(90, 170, 235), width=2)


def pulse_points():
    pts = []
    baseline = SIZE / 2 + 10
    # a heartbeat with a sharp systolic spike near the prism center
    for x in range(30, SIZE - 30):
        t = (x - 30) / (SIZE - 60)
        y = baseline + 18 * math.sin(t * math.pi * 4)
        # add a tall beat spike around x ~ center
        spike = 130 * math.exp(-((x - SIZE * 0.5) ** 2) / (2 * 16 ** 2))
        spike -= 70 * math.exp(-((x - SIZE * 0.62) ** 2) / (2 * 10 ** 2))
        y -= spike
        pts.append((x, y))
    return pts


def main():
    base = radial_background()

    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    draw_prism(gd)
    pts = pulse_points()
    gd.line(pts, fill=(140, 235, 255, 200), width=10, joint="curve")
    glow = glow.filter(ImageFilter.GaussianBlur(6))

    img = base.convert("RGBA")
    img = Image.alpha_composite(img, glow)

    sharp = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sharp)
    draw_prism(sd)
    sd.line(pts, fill=(190, 245, 255, 255), width=4, joint="curve")
    # verification node dot at the spike apex
    apex_x = SIZE * 0.5
    apex_y = min(y for x, y in pts if abs(x - apex_x) < 12)
    sd.ellipse([apex_x - 9, apex_y - 9, apex_x + 9, apex_y + 9], fill=(255, 255, 255, 255))

    img = Image.alpha_composite(img, sharp)
    final = img.convert("RGB")

    for rel in ("frontend/public/logo.png", "docs/logo.png"):
        out = ROOT / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        final.save(out, "PNG", optimize=True)
        size_kb = out.stat().st_size / 1024
        print(f"wrote {rel} ({final.size[0]}x{final.size[1]}, {size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
