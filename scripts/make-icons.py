#!/usr/bin/env python3
"""Generate PWA icons (192/512 PNG) + favicon for Pharmacology Explorer.
Draws the signature dose-response curve mark on the brand dark background."""
from PIL import Image, ImageDraw
import math

BG = (10, 14, 19)
TEAL = (62, 217, 197)

def curve_points(w, h, pad=0.22):
    pts = []
    for i in range(61):
        t = i / 60
        # smooth dose-response-ish curve across the canvas
        y = h * (1 - pad - 0.56 * (t ** 2.2 / (t ** 2.2 + (1 - t) ** 2.2 + 1e-9)))
        x = w * (pad + t * (1 - 2 * pad))
        pts.append((x, y))
    return pts

def make_icon(size, path):
    img = Image.new('RGBA', (size, size), BG + (255,))
    d = ImageDraw.Draw(img)
    w = h = size
    # subtle glow ring
    r = int(size * 0.42)
    cx = cy = size // 2
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=TEAL + (60,), width=max(1, size // 96))
    # curve
    pts = curve_points(w, h)
    lw = max(2, size // 48)
    d.line(pts, fill=TEAL + (255,), width=lw, joint='curve')
    # endpoint dot
    px, py = pts[-1]
    dr = max(2, size // 40)
    d.ellipse([px - dr, py - dr, px + dr, py + dr], fill=TEAL + (255,))
    img.save(path)

make_icon(192, 'public/icons/icon-192.png')
make_icon(512, 'public/icons/icon-512.png')
print('icons written')
