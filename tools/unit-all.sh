#!/bin/sh
# unit-all.sh -- compile and run every C unit test in tools/*.c with the
# compile lines from tools/README.md, one transcript per test.
#
#   sh tools/unit-all.sh OUTDIR [NAME...]
#
# Each test's output goes to OUTDIR/NAME.txt, ending with "exit=N" and
# "seconds=N". A summary line per test goes to stdout. The script itself
# exits non-zero if any test did. Nothing here decides what a test
# asserts; it only builds and starts it.
set -u
cd "$(dirname "$0")/.."
ROOT=$PWD
OUT=${1:?usage: unit-all.sh OUTDIR [NAME...]}; shift
mkdir -p "$OUT"; OUT=$(cd "$OUT" && pwd)
B=$(mktemp -d); trap 'rm -rf "$B"' EXIT
CC=${CC:-cc}

SHELLSRC="src/aurshell/draw.c src/aurshell/shellcommon.c src/aurshell/anim.c src/aurshell/layouts/*.c src/common/theme.c src/common/font.c"

# Resolved shell.conf for every theme (tools/README.md, "Resolving a
# theme to a shell.conf"): the sheet tools and contrast read these,
# and a .theme handed to them silently falls back to defaults.
resolve_confs() {
    for t in themes/*.theme; do
        n=$(basename "$t" .theme)
        S=$(mktemp -d); printf '%s\n' "$n" > "$S/theme"
        tail -n +2 themes/templates/shell.conf.tpl | \
          AURORA_THEMES=themes AURORA_TEMPLATES=themes/templates \
          AURORA_STATE=$S AURORA_CACHE=$S/c ./src/aurora/aurora render > "$B/$n.conf" || return 1
        rm -rf "$S"
    done
}

wlgen() {
    mkdir -p build/gen
    for x in /usr/share/wayland-protocols/stable/xdg-shell/xdg-shell.xml \
             /usr/share/wayland-protocols/unstable/xdg-decoration/xdg-decoration-unstable-v1.xml \
             /usr/share/wayland-protocols/stable/viewporter/viewporter.xml \
             /usr/share/wayland-protocols/unstable/xdg-output/xdg-output-unstable-v1.xml; do
      n=$(basename "$x" .xml | sed s/-unstable-v1//)
      wayland-scanner server-header "$x" "build/gen/$n-server.h" || return 1
      wayland-scanner private-code  "$x" "build/gen/$n-protocol.c" || return 1
    done
    # wlhostile.c includes both client headers; tools/README.md used to
    # generate only the first.
    wayland-scanner client-header /usr/share/wayland-protocols/stable/xdg-shell/xdg-shell.xml \
      build/gen/xdg-shell-client.h || return 1
    wayland-scanner client-header /usr/share/wayland-protocols/stable/viewporter/viewporter.xml \
      build/gen/viewporter-client.h
}

t_recip_proof() { $CC -O2 -o $B/recip_proof tools/recip_proof.c && $B/recip_proof; }
t_blur_equiv()  { $CC -O2 -std=gnu11 -o $B/blur_equiv tools/blur_equiv.c src/aurshell/draw.c -lm && $B/blur_equiv; }
t_kerning() {
    $CC -O2 -std=gnu11 -I src/common -o $B/kerning tools/kerning.c src/common/font.c -lm && \
    $B/kerning 36 /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
}
t_contactsheet() {
    $CC -O2 -std=gnu11 -o $B/sheet tools/contactsheet.c $SHELLSRC src/common/wall.c src/common/png.c -lm && \
    $B/sheet $B/nocturne.conf $OUT/contactsheet-nocturne.png
}
t_launchtest() { $CC -O2 -std=gnu11 -o $B/launchtest tools/launchtest.c $SHELLSRC -lm && $B/launchtest; }
t_targets() {
    $CC -O2 -std=gnu11 -o $B/targets tools/targets.c src/aurshell/foot.c \
       src/aurshell/net.c src/aurshell/settings.c src/aurshell/bt.c \
       src/aurshell/welcome.c src/aurshell/run.c src/aurshell/power.c \
       $SHELLSRC -I src/aurshell -I src/common -lm && $B/targets
}
t_modaltest() {
    $CC -O2 -std=gnu11 -o $B/modaltest tools/modaltest.c src/aurshell/foot.c $SHELLSRC \
       -I src/aurshell -I src/common -lm && $B/modaltest
}
t_powertest() {
    $CC -O2 -std=gnu11 -o $B/powertest tools/powertest.c src/aurshell/power.c \
       src/aurshell/run.c -I src/aurshell -lm && $B/powertest
}
t_notifytest() {
    $CC -O2 -std=gnu11 -o $B/notifytest tools/notifytest.c src/aurshell/notify.c \
       src/aurshell/foot.c $SHELLSRC $(pkg-config --cflags --libs dbus-1) \
       -I src/aurshell -I src/common -lm && $B/notifytest
}
t_bttest() {
    $CC -O2 -std=gnu11 -o $B/bttest tools/bttest.c src/aurshell/bt.c src/aurshell/foot.c \
       $SHELLSRC -I src/aurshell -I src/common -lm && $B/bttest
}
t_welcometest() {
    W=$B/welcometest.d
    $CC -O2 -std=gnu11 -o $B/welcometest tools/welcometest.c \
       src/aurshell/welcome.c src/aurshell/foot.c $SHELLSRC -I src/aurshell -I src/common -lm \
       -DWELCOME_RUN="\"$W\"" -DWELCOME_ANSWER="\"$W/answer.d\"" \
       -DWELCOME_STATE="\"$W/first.state\"" -DWELCOME_FOUND="\"$W/found.json\"" && $B/welcometest
}
t_setsheet() {
    $CC -O2 -std=gnu11 -o $B/setsheet tools/setsheet.c src/aurshell/power.c \
       src/aurshell/run.c src/aurshell/foot.c $SHELLSRC src/common/png.c -lm && \
    mkdir -p $B/bl $B/ps && \
    AUROS_BACKLIGHT=$B/bl AUROS_POWER_SUPPLY=$B/ps AUROS_SHELLS=$ROOT/shells AUROS_THEME_DIR=$ROOT/themes \
      $B/setsheet $B/nocturne.conf $OUT/setsheet.png 1024 600 2.0
}
t_kiosktest() {
    $CC -O2 -std=gnu11 -o $B/kiosktest tools/kiosktest.c src/aurshell/apps.c $SHELLSRC -lm && $B/kiosktest
}
t_stridetest() { $CC -O2 -std=gnu11 -o $B/stridetest tools/stridetest.c $SHELLSRC -lm && $B/stridetest; }
t_contrast() { $CC -O2 -std=gnu11 -o $B/contrast tools/contrast.c src/common/theme.c -lm && $B/contrast $B/*.conf; }
t_padtest() { $CC -O2 -std=gnu11 -o $B/padtest tools/padtest.c src/aurshell/pad.c -lm && $B/padtest; }
t_hittest() { $CC -O2 -std=gnu11 -o $B/hittest tools/hittest.c $SHELLSRC -lm && $B/hittest; }
t_nettest() { $CC -O2 -std=gnu11 -o $B/nettest tools/nettest.c src/aurshell/net.c $SHELLSRC -lm && $B/nettest; }
t_netsheet() {
    $CC -O2 -std=gnu11 -o $B/netsheet tools/netsheet.c src/aurshell/foot.c $SHELLSRC src/common/png.c -lm && \
    $B/netsheet $B/nocturne.conf $OUT/netsheet.png 1024 600 2.0
}
WLLIBS='$(pkg-config --cflags --libs wayland-server xkbcommon)'
t_keytest() {
    $CC -O2 -std=gnu11 -o $B/keytest tools/keytest.c src/aurwl/aurwl.c src/aurshell/draw.c \
       build/gen/*-protocol.c -Ibuild/gen $(pkg-config --cflags --libs wayland-server xkbcommon) -lm && $B/keytest
}
t_wltest() {
    $CC -O2 -std=gnu11 -o $B/wltest tools/wltest.c src/aurwl/aurwl.c src/aurshell/draw.c src/common/png.c \
       build/gen/*-protocol.c -Ibuild/gen $(pkg-config --cflags --libs wayland-server xkbcommon) -lm && \
    XDG_RUNTIME_DIR=$B $B/wltest -s 8 -o $B/shm -- weston-simple-shm
}
t_wlstress() {
    $CC -O2 -std=gnu11 -o $B/wltest tools/wltest.c src/aurwl/aurwl.c src/aurshell/draw.c src/common/png.c \
       build/gen/*-protocol.c -Ibuild/gen $(pkg-config --cflags --libs wayland-server xkbcommon) -lm && \
    XDG_RUNTIME_DIR=$B sh tools/wlstress.sh $B/wltest
}
t_wlstress_asan() {
    $CC -g -O1 -fsanitize=address -std=gnu11 -o $B/wltest_asan tools/wltest.c src/aurwl/aurwl.c \
       src/aurshell/draw.c src/common/png.c build/gen/*-protocol.c -Ibuild/gen \
       $(pkg-config --cflags --libs wayland-server xkbcommon) -lm && \
    XDG_RUNTIME_DIR=$B sh tools/wlstress.sh $B/wltest_asan
}
t_wlhostile() {
    $CC -O2 -std=gnu11 -o $B/wlhostile tools/wlhostile.c src/aurwl/aurwl.c src/aurshell/draw.c \
       build/gen/*-protocol.c -Ibuild/gen \
       $(pkg-config --cflags --libs wayland-server wayland-client xkbcommon) -lm && \
    XDG_RUNTIME_DIR=$B $B/wlhostile
}

ALL="recip_proof blur_equiv kerning contactsheet launchtest targets modaltest powertest notifytest bttest welcometest setsheet kiosktest stridetest contrast padtest hittest nettest netsheet keytest wltest wlstress wlstress_asan wlhostile"
[ $# -gt 0 ] && ALL="$*"

resolve_confs || { echo "could not resolve theme confs (src/aurora/aurora)"; exit 1; }
wlgen || { echo "wayland-scanner failed"; exit 1; }
chmod 700 "$B"

fail=0
for n in $ALL; do
    s=$(date +%s)
    ( t_$n ) > "$OUT/$n.txt" 2>&1
    rc=$?
    d=$(( $(date +%s) - s ))
    printf 'exit=%s\nseconds=%s\n' "$rc" "$d" >> "$OUT/$n.txt"
    printf '%-16s exit=%-3s %4ss\n' "$n" "$rc" "$d"
    [ "$rc" = 0 ] || fail=1
done
exit $fail
