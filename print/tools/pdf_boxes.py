#!/usr/bin/env python3
"""Crop a Chrome-rendered PDF to an exact page size and write print boxes.

Chrome rounds @page sizes to whole points (94 mm -> 93.81 mm), so the HTML is
rendered on a slightly larger canvas with the artwork anchored top-left. This
script moves the artwork to the origin, sets MediaBox/CropBox/BleedBox to the
exact size and TrimBox to the size minus bleed.

usage: pdf_boxes.py IN.pdf OUT.pdf --size 94x54 --bleed 2 [--title "..."]
requires: pypdf  (pip install pypdf)
"""
import argparse
from pypdf import PdfReader, PdfWriter, Transformation
from pypdf.generic import RectangleObject

PT_PER_MM = 72 / 25.4

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("dst")
ap.add_argument("--size", required=True, help="WxH in mm, incl. bleed")
ap.add_argument("--bleed", type=float, required=True, help="bleed in mm")
ap.add_argument("--title", default="")
a = ap.parse_args()

w_mm, h_mm = (float(v) for v in a.size.lower().split("x"))
W, H, B = w_mm * PT_PER_MM, h_mm * PT_PER_MM, a.bleed * PT_PER_MM

reader = PdfReader(a.src)
writer = PdfWriter()
for page in reader.pages:
    pw, ph = float(page.mediabox.width), float(page.mediabox.height)
    if pw + 0.01 < W or ph + 0.01 < H:
        raise SystemExit(f"render canvas {pw:.2f}x{ph:.2f}pt is smaller than {W:.2f}x{H:.2f}pt")
    page.add_transformation(Transformation().translate(0, -(ph - H)))
    full = RectangleObject([0, 0, W, H])
    page.mediabox = full
    page.cropbox = full
    page.bleedbox = full
    page.trimbox = RectangleObject([B, B, W - B, H - B])
    writer.add_page(page)

writer.add_metadata({"/Title": a.title, "/Author": "JR Motors", "/Subject": "print-ready, RGB, bleed %.0f mm" % a.bleed})
with open(a.dst, "wb") as fh:
    writer.write(fh)
print(f"{a.dst}: {len(reader.pages)} page(s), {W:.3f} x {H:.3f} pt, trim inset {B:.3f} pt")
