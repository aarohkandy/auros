#!/bin/sh
# e2e-all.sh -- run the end-to-end (QEMU) tests one after another, with
# out/ frozen: every file in out/ is hashed before the first test and
# after the last, and a difference is reported, because a test reading
# an artifact that was rebuilt under it has been blamed on real bugs
# here before (docs/handoff/TRAPS.md).
#
#   sh tools/e2e-all.sh OUTDIR [TEST...]
#
# Each test's transcript is OUTDIR/NAME.txt (tools/logrun.sh). Needs
# out/ built first: build/forge, build/staging, AURSTAGE_FAULT=1
# build/staging, build/mkimage, build/aurbridge.
set -u
cd "$(dirname "$0")/.."
OUT=${1:?usage: e2e-all.sh OUTDIR [TEST...]}; shift
mkdir -p "$OUT"
ALL="stagetest installtest nosticktest loadertest matrixtest choicesboottest putbacktest firstboottest bootupdatetest failtest powercuttest"
[ $# -gt 0 ] && ALL="$*"

if [ -d /tmp/installtest.lock ]; then
    echo "/tmp/installtest.lock exists: another end-to-end test is running, or one was killed"
    exit 2
fi

( cd out && sha256sum -- * ) > "$OUT/out-sha256.before"
fail=0
for t in $ALL; do
    case "$t" in
        firstboottest) sh tools/logrun.sh "$OUT" "$t" sh tools/firstboottest.sh desktop ;;
        *)             sh tools/logrun.sh "$OUT" "$t" sh "tools/$t.sh" ;;
    esac || fail=1
    rmdir /tmp/installtest.lock 2>/dev/null && echo "  (removed a lock $t left behind)"
done
( cd out && sha256sum -- * ) > "$OUT/out-sha256.after"
if cmp -s "$OUT/out-sha256.before" "$OUT/out-sha256.after"; then
    echo "out/ unchanged during the run"
else
    echo "out/ CHANGED during the run:"; diff "$OUT/out-sha256.before" "$OUT/out-sha256.after"
    fail=1
fi
exit $fail
