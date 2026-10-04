#!/bin/sh
# fonts.sh — how the self-hosted fonts in website/assets/fonts were cut.
# Needs: pip install fonttools brotli; npm (for `npm pack`); fonts-dejavu-core.
set -eu
D=website/assets/fonts; W=$(mktemp -d)
U="U+0020-007E,U+00A0-00FF,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2026,U+2022,U+00D7,U+2192,U+2190,U+2212,U+2009,U+202F,U+2044"
( cd "$W" && npm pack @fontsource-variable/archivo@5.3.0 >/dev/null && tar xzf ./*.tgz )
python3 - "$W/package/files/archivo-latin-wdth-normal.woff2" "$W/ar.ttf" <<'PY'
import sys
from fontTools.ttLib import TTFont
f = TTFont(sys.argv[1]); f.flavor = None; f.save(sys.argv[2])
PY
python3 -m fontTools.varLib.instancer "$W/ar.ttf" wght=200:600 wdth=100:125 -o "$W/ar-i.ttf" -q
pyftsubset "$W/ar-i.ttf" --unicodes="$U" --layout-features='kern,liga,calt,lnum,tnum' \
  --flavor=woff2 --output-file="$D/archivo.woff2"
pyftsubset /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf --unicodes="$U,U+2500" --flavor=woff2 --output-file="$D/dejavu-sans.woff2"
pyftsubset /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf --unicodes="$U,U+2500" --flavor=woff2 --output-file="$D/dejavu-sans-bold.woff2"
