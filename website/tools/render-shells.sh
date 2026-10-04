#!/bin/sh
# render-shells.sh — every picture of the desktop on the website, made
# from the desktop's own code. Nothing here is drawn by hand.
#
#   sh website/tools/render-shells.sh  [workdir]      (from the repo root)
#
# Needs: cc, ImageMagick (convert), cwebp, avifenc, and Inter 4.x TTF
# (rsms/inter release zip; OFL) -- the image ships Ubuntu's fonts-inter,
# which forge links as /usr/share/auros/fonts/Inter.ttf. Set INTER_TTF
# to its Inter-Regular.ttf.
#
# 1. src/aurora/aurora resolves each theme's shell.conf exactly as
#    `aurora set` does on a real machine (AURORA_ONLY=shell.conf).
# 2. website/tools/render-shell.c paints one archetype through the real
#    layout code (src/aurshell/layouts/*.c), the real wallpaper
#    (src/common/wall.c) and the real rasteriser (src/common/font.c).
# 3. Rendered at 1366x768 -- the panel most of these laptops have --
#    and enlarged 2x with nearest-neighbour, so the big versions are the
#    same pixels, not a re-imagined high-DPI desktop. (The layouts size
#    many things in fixed pixels; a native 2560-wide render is a
#    differently-proportioned desktop that no 2014 laptop shows.)
set -eu
ROOT=$(pwd)
[ -f src/aurshell/shellpreview.c ] || { echo "run from the repo root"; exit 2; }
W=${1:-$(mktemp -d)}
OUT=website/assets/renders
INTER_TTF=${INTER_TTF:?set INTER_TTF to Inter-Regular.ttf}
mkdir -p "$W" "$OUT"

SRC="src/aurshell/draw.c src/aurshell/shellcommon.c src/aurshell/anim.c \
     src/aurshell/layouts/*.c src/common/theme.c src/common/wall.c \
     src/common/font.c src/common/png.c"
# shellcheck disable=SC2086
cc -O2 -std=gnu11 -o "$W/render-shell" website/tools/render-shell.c $SRC -lm
mkdir -p "$W/wel"
printf 'phase=asking\n' > "$W/wel/state"
printf '{"windows": {"found": 1}, "device": "sda"}\n' > "$W/wel/found.json"
# shellcheck disable=SC2086
cc -O2 -std=gnu11 -DWITH_WELCOME -I src/aurshell -I src/common \
   -DWELCOME_RUN="\"$W/wel\"" -DWELCOME_ANSWER="\"$W/wel\"" \
   -DWELCOME_STATE="\"$W/wel/state\"" -DWELCOME_FOUND="\"$W/wel/found.json\"" \
   -o "$W/render-welcome" website/tools/render-shell.c \
   src/aurshell/welcome.c src/aurshell/foot.c $SRC -lm

for t in nocturne synthwave sandstone moss ember slate; do
    mkdir -p "$W/$t"
    AURORA_THEMES="$ROOT/themes" AURORA_TEMPLATES="$ROOT/themes/templates" \
    AURORA_STATE="$W/$t/state" AURORA_CACHE="$W/$t/cache" \
    AURORA_OUTDIR="$W/$t" AURORA_ONLY=shell.conf \
        sh src/aurora/aurora set "$t" >/dev/null
    sed "s#/usr/share/auros/fonts/Inter.ttf#$INTER_TTF#" "$W/$t/shell.conf" > "$W/$t.conf"
done

enc() { # name  -> 2732 (2x nearest), 1366, 683 in avif + webp
    n=$1
    convert "$W/$n.png" -filter point -resize 200% "$W/$n-2732.png"
    convert "$W/$n.png" -filter Lanczos -resize 50% "$W/$n-683.png"
    cp "$W/$n.png" "$W/$n-1366.png"
    for s in 2732 1366 683; do
        cwebp -quiet -q 86 -m 6 "$W/$n-$s.png" -o "$OUT/$n-$s.webp"
        avifenc -q 70 -s 4 "$W/$n-$s.png" "$OUT/$n-$s.avif" >/dev/null
    done
}

# the six looks, on the default archetype (rail, profiles/desktop.profile)
for t in nocturne synthwave sandstone moss ember slate; do
    "$W/render-shell" "$W/$t.conf" shells/rail.shell "$W/theme-$t.png" 1366 768 1 0
    enc "theme-$t"
done
# the six archetypes, in the default look, with three things open
for l in rail taskbar dock tiles workbench locked; do
    "$W/render-shell" "$W/nocturne.conf" "shells/$l.shell" "$W/shell-$l.png" 1366 768 1 3
    enc "shell-$l"
done
# the first-start question (src/aurshell/welcome.c), over the default desktop
"$W/render-welcome" "$W/nocturne.conf" shells/rail.shell "$W/welcome.png" 1366 768 1 0
enc welcome
ls -la "$OUT"
