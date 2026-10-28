#!/usr/bin/env bash
# Build print-ready PDFs and PNG previews for JR Motors print materials.
#   PYTHON=/path/to/python-with-pypdf ./build.sh
# Output: pdf/*.pdf (print), preview/*.png (review; *-guides.png show trim/safe/folds)
set -euo pipefail
cd "$(dirname "$0")"
HERE="$PWD"
PY="${PYTHON:-python3}"
CHROME="${CHROME:-google-chrome}"
# intermediate PDFs go to $BUILD_TMP (default: a fresh mktemp dir). Do not point
# TMPDIR elsewhere: Chrome uses it for its own profile/shared memory.
TMP="$(mktemp -d "${BUILD_TMP:-${TMPDIR:-/tmp}}/jrprint.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

render() {  # render <html-with-query> <out.pdf>
  "$CHROME" --headless=new --no-sandbox --disable-gpu --no-pdf-header-footer \
    --run-all-compositor-stages-before-draw --virtual-time-budget=8000 \
    --print-to-pdf="$2" "file://$HERE/$1" 2>/dev/null
}

# outside-page photos are pre-baked RGBA PNGs (crop + darkening + alpha fades);
# re-bake when a source photo or a layer box changes (needs pillow + numpy)
if [[ "${BAKE:-0}" == 1 || ! -f img/bk-cover.png || ! -f img/bk-back.png || ! -f img/bk-flap.png ]]; then
  "$PY" tools/bake_photos.py
fi

render "business-card.html"        "$TMP/card.pdf"
render "business-card.html?guides" "$TMP/card-guides.pdf"
render "eurobooklet.html"          "$TMP/booklet.pdf"
render "eurobooklet.html?guides"   "$TMP/booklet-guides.pdf"

mkdir -p pdf preview
"$PY" tools/pdf_boxes.py "$TMP/card.pdf"           pdf/jrmotors-vizitka-90x50.pdf    --size 94x54  --bleed 2 --title "JR Motors — визитка 90×50 мм, вылет 2 мм"
"$PY" tools/pdf_boxes.py "$TMP/booklet.pdf"        pdf/jrmotors-evrobuklet-A4.pdf    --size 303x216 --bleed 3 --title "JR Motors — евробуклет A4, вылет 3 мм"
"$PY" tools/pdf_boxes.py "$TMP/card-guides.pdf"    "$TMP/card-guides-exact.pdf"      --size 94x54  --bleed 2
"$PY" tools/pdf_boxes.py "$TMP/booklet-guides.pdf" "$TMP/booklet-guides-exact.pdf"   --size 303x216 --bleed 3

rm -f preview/*.png
pdftoppm -r 600 -png pdf/jrmotors-vizitka-90x50.pdf     preview/vizitka
pdftoppm -r 600 -png "$TMP/card-guides-exact.pdf"       preview/vizitka-guides
pdftoppm -r 150 -png pdf/jrmotors-evrobuklet-A4.pdf     preview/evrobuklet
pdftoppm -r 150 -png "$TMP/booklet-guides-exact.pdf"    preview/evrobuklet-guides
# friendlier names
mv preview/vizitka-1.png           preview/vizitka-1-front.png
mv preview/vizitka-2.png           preview/vizitka-2-back.png
mv preview/vizitka-guides-1.png    preview/vizitka-1-front-guides.png
mv preview/vizitka-guides-2.png    preview/vizitka-2-back-guides.png
mv preview/evrobuklet-1.png        preview/evrobuklet-1-outside.png
mv preview/evrobuklet-2.png        preview/evrobuklet-2-inside.png
mv preview/evrobuklet-guides-1.png preview/evrobuklet-1-outside-guides.png
mv preview/evrobuklet-guides-2.png preview/evrobuklet-2-inside-guides.png

pdfinfo -box pdf/jrmotors-vizitka-90x50.pdf | grep -E 'Pages|Page size|TrimBox|BleedBox'
pdfinfo -box pdf/jrmotors-evrobuklet-A4.pdf | grep -E 'Pages|Page size|TrimBox|BleedBox'
