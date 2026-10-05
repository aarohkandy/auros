#!/bin/sh
# container-deps.sh -- install what building and testing AurOS needs on
# a fresh Ubuntu 24.04 host (root). Idempotent: apt skips what is there.
#
# The list was derived from the scripts, not guessed: every command the
# build (build/*) and the tests (tools/*.sh, tools/*.c) call, mapped to
# the Ubuntu package that ships it. Grouped by who needs it.
#
#   sh tools/container-deps.sh            # install
#   sh tools/container-deps.sh --list     # print the package list only
set -eu

PKGS="
build-essential pkg-config make gcc
debootstrap zstd xz-utils gzip cpio file binutils
gdisk dosfstools mtools ntfs-3g e2fsprogs fdisk util-linux squashfs-tools
qemu-system-x86 qemu-utils ovmf
mingw-w64 osslsigncode sbsigntool efitools openssl
python3 python3-cryptography
libwayland-dev wayland-protocols libxkbcommon-dev libdbus-1-dev libdrm-dev libglib2.0-bin dbus
weston
grub-common
curl ca-certificates expect gawk mawk
"
#  qemu-system-x86, ovmf      every end-to-end test (TCG when there is no /dev/kvm)
#  gdisk                      sgdisk: every synthetic disk and the GPT tests
#  dosfstools, mtools         mkfs.vfat, mcopy/mmd/mdir/mtype: EFI partitions
#  ntfs-3g                    mkntfs/ntfsresize/ntfsinfo: synthetic Windows
#  mingw-w64                  build/aurbridge (the Windows installer)
#  osslsigncode, sbsigntool   signtest, bootchaintest, build/shimpick, build/aurbridge
#  efitools                   EFI signature lists (bootchaintest fixtures)
#  python3-cryptography       rootfs/usr/lib/auros/bootchain run on the host by bootchaintest
#  libwayland-dev, wayland-protocols, libxkbcommon-dev   aurwl + wltest/wlhostile/keytest
#  libdbus-1-dev, libglib2.0-bin (gdbus), dbus           notifytest
#  libdrm-dev                 aurshell's DRM headers
#  weston                     weston-simple-shm / weston-terminal clients for wltest/wlstress
#  grub-common                grub-editenv on the host (putback/firstboot fixtures)
#  expect                     interactive serial checks in the QEMU tests
#  gawk, mawk                 theme-test runs the theme engine under both awks
#
# Not installed: wine. Only build/aurbridge's optional "selftest under
# wine" note uses it, and the project's own rule is that Wine is not
# Windows (docs/handoff/TRAPS.md); the real check is windows.yml.

if [ "${1:-}" = --list ]; then echo $PKGS; exit 0; fi
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive
missing=""
for p in $PKGS; do
    dpkg-query -W -f='${Status}' "$p" 2>/dev/null | grep -q "install ok installed" \
        || missing="$missing $p"
done
if [ -z "$missing" ]; then echo "all $(echo $PKGS | wc -w) packages already installed"; exit 0; fi
echo "installing:$missing"
apt-get update -qq
# shellcheck disable=SC2086
apt-get install -y -qq --no-install-recommends $missing
echo "done"
