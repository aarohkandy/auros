#!/bin/sh
# logrun.sh -- run one test command and keep its transcript.
#
#   sh tools/logrun.sh OUTDIR NAME COMMAND [ARGS...]
#
# Writes OUTDIR/NAME.txt: the command line, the UTC start time, the
# command's stdout+stderr as it ran, then "exit=N" and "seconds=N".
# Prints one summary line. Exits with the command's own status.
set -u
OUT=${1:?OUTDIR}; NAME=${2:?NAME}; shift 2
mkdir -p "$OUT"
F="$OUT/$NAME.txt"
s=$(date +%s)
{ printf '$ %s\n# started %s\n' "$*" "$(date -u +%FT%TZ)"; } > "$F"
"$@" >> "$F" 2>&1 < /dev/null
rc=$?
d=$(( $(date +%s) - s ))
printf 'exit=%s\nseconds=%s\n' "$rc" "$d" >> "$F"
printf '%-18s exit=%-3s %6ss\n' "$NAME" "$rc" "$d"
exit $rc
