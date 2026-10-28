#!/usr/bin/env python3
"""Bake the outside-page photos of the eurobooklet into faded RGBA PNGs.

Why: every photo edge that is not a bleed edge must dissolve into the textured
page background. CSS can't do that reliably in Chrome's PDF output (mask-image
on <img> is dropped, nested masks keep only the outermost, an overlay ending in
solid ink leaves a seam, and box edges are pixel-snapped). So each photo is
pre-cropped to its layer box (object-fit: cover math, native resolution, no
resampling), pre-darkened with the legibility gradient, and given an alpha
channel that fades to 0 on the non-bleed edges. Chrome embeds the result as
an ordinary image + SMask.

The box sizes below MUST match the .flap-photo / .back-photo / .cover-photo
rules in eurobooklet.html.

usage: bake_photos.py            (writes print/img/bk-*.png)
requires: pillow, numpy
"""
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent.parent          # print/
SRC = HERE.parent / "assets" / "img"
OUT = HERE / "img"
INK = np.array([10, 10, 11], dtype=np.float64)

# stops: (position, value) — position in 0..1 of the box, or "<n>mm"
SPECS = {
    # cover: bleeds top + right; fades out at the bottom and towards the fold (left)
    "bk-cover.png": dict(
        src="hero.webp", box=(103.6, 168.0), pos=(0.50, 0.58),
        dark=[(0, .94), (.17, .62), (.34, 0), (.60, 0), (.84, .60), (1, .80)],
        alpha_v=[(0, 1), (.64, 1), (1, 0)],
        alpha_h=[(0, 0), ("9mm", 1), (1, 1)],
    ),
    # back panel: bleeds top only; fades at the bottom and towards both folds
    "bk-back.png": dict(
        src="truck-dusk.webp", box=(100.0, 104.0), pos=(0.52, 0.50),
        dark=[(0, .55), (.28, .05), (.58, .30), (1, .75)],
        alpha_v=[(0, 1), (.58, 1), (1, 0)],
        alpha_h=[(0, 0), ("9mm", 1), ("-9mm", 1), (1, 0)],
    ),
    # flap: bleeds left + bottom; fades in at the top and towards the fold (right); 50 % strength
    "bk-flap.png": dict(
        src="history.webp", box=(100.0, 96.0), pos=(0.50, 0.60),
        dark=[(0, .55), (.60, .35), (1, .75)],
        alpha_v=[(0, 0), ("34mm", 1), (1, 1)],
        alpha_h=[(0, 1), ("-10mm", 1), (1, 0)],
        strength=0.5,
    ),
}


def ramp(stops, n, mm_len):
    """Piecewise-linear ramp sampled at n pixel centres along a box of mm_len mm."""
    xs, ys = [], []
    for p, v in stops:
        if isinstance(p, str):
            mm = float(p[:-2])
            p = (mm_len + mm if mm < 0 else mm) / mm_len
        xs.append(p)
        ys.append(v)
    t = (np.arange(n) + 0.5) / n
    return np.interp(t, xs, ys)


def bake(name, src, box, pos, dark, alpha_v, alpha_h, strength=1.0):
    im = Image.open(SRC / src).convert("RGB")
    W, H = im.size
    bw, bh = box
    # object-fit: cover at native resolution
    if W / H > bw / bh:
        ch, cw = H, round(H * bw / bh)
    else:
        cw, ch = W, round(W * bh / bw)
    x0 = round((W - cw) * pos[0])
    y0 = round((H - ch) * pos[1])
    a = np.asarray(im.crop((x0, y0, x0 + cw, y0 + ch)), dtype=np.float64)

    d = ramp(dark, ch, bh)[:, None, None]                       # legibility darkening
    rgb = a * (1 - d) + INK * d
    alpha = np.outer(ramp(alpha_v, ch, bh), ramp(alpha_h, cw, bw)) * strength

    out = np.dstack([np.clip(rgb, 0, 255), np.clip(alpha * 255, 0, 255)]).round().astype(np.uint8)
    Image.fromarray(out, "RGBA").save(OUT / name, optimize=True)
    ppi = ch / (bh / 25.4)
    print(f"{name}: {cw}x{ch}px from {src} ({ppi:.0f} ppi at {bw}x{bh} mm)")


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for name, spec in SPECS.items():
        bake(name, **spec)
