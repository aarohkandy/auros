---
name: driver-triage
description: Diagnose hardware that does not work on an Auros machine — wifi, trackpad, suspend, brightness, gpu, audio, webcam — and record an honest row in hardware/compat.tsv. Use when a physical laptop misbehaves, when quoting a customer's fleet, or when deciding whether a model is supportable.
---

# driver-triage

Turns "the wifi doesn't work on this ThinkPad" into a row in `hardware/compat.tsv` that we can quote from
four years from now.

## The rule that makes this file worth anything

**`source=vm` rows leave the physical-only columns EMPTY.** Not `?`, not `ok` — empty, because empty means
"we did not test this", which is the truth. A QEMU profile has no real Wi-Fi chipset, no trackpad, no
backlight and no webcam.

**No customer quote is ever generated from a `vm` row.** Filling those columns from VM runs would
manufacture exactly the unearned confidence spec §4 exists to prevent, and we would then quote a real
school from it.

## Procedure on a physical machine

1. **Identify precisely.** `lspci -nn`, `lsusb`, `dmidecode -t system`. Record the numeric PCI/USB IDs,
   not the marketing name — "Intel Wireless" is not a model.
2. **Work the list in this order**, because each one costs the customer differently:
   `wifi` → `trackpad` → `suspend` → `brightness` → `gpu` → `audio` → `webcam`.
   Wi-Fi failing makes the machine useless. A webcam failing makes it slightly worse.
3. **For each:** `journalctl -b -p warning`, the relevant kernel module (`modinfo`, `dmesg | grep -i
   firmware`), and whether the fix is firmware that Fedora ships, firmware it does not, or nothing.
4. **Classify honestly:** `ok` / `partial` / `fail`. `partial` needs a note saying what half works —
   "associates on 2.4 GHz only" is useful; "mostly works" is not.
5. **Write the row** with `source=physical`, the tester and the date.

## The decision you are not allowed to make

`verdict=unsupported` is **§9-reserved for the human.** The tooling and this procedure may *propose* it,
with evidence. Only a person may write it, because declaring a model unsupported decides what we will
refuse to sell, and that is a business decision wearing a technical costume.

## What a fix may not be

If the only way to make a model work is to pin a kernel, patch a driver, or hold back a package version in
that customer's recipe — **stop.** That is a second base (see `recipe-compile`), and a second base breaks
the one-rebuild CVE promise for everyone. The honest outcomes are: fix it in `auros-base` for everybody,
or mark the model `supported-with-caveat`, or propose `unsupported` to the human.
