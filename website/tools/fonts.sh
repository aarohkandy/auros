#!/bin/sh
# fonts.sh — how the self-hosted fonts in website/assets/fonts were cut.
# Needs: pip install fonttools brotli; npm (for `npm pack`); fonts-dejavu-core.
set -eu
D=website/assets/fonts; W=$(mktemp -d)
U="U+0020-007E,U+00A0-00FF,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2026,U+2022,U+00D7,U+2192,U+2190,U+2212,U+2009,U+202F,U+2044"
( cd "$W" && npm pack @fontsource-variable/newsreader@5.3.0 >/dev/null && tar xzf ./*.tgz )
for st in normal italic; do
  python3 - "$W/package/files/newsreader-latin-opsz-$st.woff2" "$W/nr-$st.ttf" <<'PY'
import sys
from fontTools.ttLib import TTFont
f = TTFont(sys.argv[1]); f.flavor = None; f.save(sys.argv[2])
PY
  python3 -m fontTools.varLib.instancer "$W/nr-$st.ttf" wght=300:400 opsz=72 -o "$W/nr-$st-i.ttf" -q
  pyftsubset "$W/nr-$st-i.ttf" --unicodes="$U" --layout-features='kern,liga,calt,onum,lnum,tnum' \
    --flavor=woff2 --output-file="$D/newsreader-$st.woff2"
done
pyftsubset /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf --unicodes="$U,U+2500" --flavor=woff2 --output-file="$D/dejavu-sans.woff2"
pyftsubset /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf --unicodes="$U,U+2500" --flavor=woff2 --output-file="$D/dejavu-sans-bold.woff2"
