# hardware/compat.tsv

One row per machine AurOS has actually been observed on. It is only worth anything if every row is
true, and today it has **no rows**: nothing has been installed on a real PC yet
(`README.fromscratch.md`, "Not proven yet"). The empty file is the honest state, not a broken one.

Adopted from LATHE (`lathe/hardware/`); the rules are LATHE's. Two tools that lived in LATHE's other
repositories — `capture-compat.sh`, which read a row off a booted machine, and `quote-from-compat.mjs`,
which answered "has this model been tested?" — were not carried over (`lathe/ADOPTED.md`). Until they
are rebuilt on this engine, rows are written by hand by the person who tested the machine, and
`node tools/compat-lint.mjs` (part of `./verify`) checks them.

**This file decides what the website may say.** `tools/honesty-gate.mjs` refuses first-person claims
of hands-on experience ("we have tested", "our lab", "machines we have imaged") while this file has
zero `physical` rows, and stops refusing them, by itself, the day it has one. The evidence file
decides whether we have experience; the gate does not.

## The `source` column is load-bearing

`source` is `vm` or `physical`. A QEMU machine has no real Wi-Fi chipset, no trackpad, no backlight
and no webcam — it cannot produce an honest verdict for those columns. So:

- `source=vm` rows **leave `wifi`, `trackpad`, `brightness`, `webcam` and `suspend` empty.** Not `?`,
  not `ok` — empty. An empty cell means "we did not test this", which is the truth.
- A `vm` row may not declare a model `unsupported`. That is a human's decision, made on physical
  evidence.

## A physical row is signed and dated

A `physical` row must carry a `tester` and a `tested_on` (`YYYY-MM-DD`). An observation with nobody's
name on it cannot be followed up, and one with no date cannot be weighed against a newer kernel.
`vm` rows are exempt.

## Values

| Column | Values |
|---|---|
| `wifi`,`trackpad`,`suspend`,`brightness`,`gpu`,`audio`,`webcam` | `ok` \| `partial` \| `fail` \| *(empty = untested)* |
| `firmware` | `uefi` \| `uefi-sb` \| `bios` \| `uefi+csm` |
| `ids` | `role=bus:vvvv:dddd`, roles separated by `;`, several devices in one role by `,` |
| `tpm` | `2.0` \| `1.2` \| `none` \| *(empty = a TPM is present, version unreadable)* |
| `verdict` | `supported` \| `supported-with-caveat` \| `unsupported` \| `untested` |

## `ids` — why a marketing name is refused

"Intel Wireless" is not a model. Two laptops five years apart carry that string on the box and
different silicon inside, and a row that records it matches nothing the next time somebody asks. So
`ids` holds the numeric vendor:device pairs straight out of sysfs —
`wifi=pci:8086:08b1;gpu=pci:8086:0a16;webcam=usb:04f2:b39a` — and the lint enforces the shape, which a
marketing name cannot satisfy. A **physical** row must have one; a `vm` row has no hardware to
identify and must not invent one.

On the machine being tested:

```
for d in /sys/bus/pci/devices/*; do echo "pci:$(cut -c3- $d/vendor):$(cut -c3- $d/device) $(cat $d/class)"; done
for d in /sys/bus/usb/devices/*; do [ -f $d/idVendor ] && echo "usb:$(cat $d/idVendor):$(cat $d/idProduct)"; done
```

## `uefi+csm` is the one value no probe may write

Whether a UEFI firmware booted the machine through a compatibility module is not observable from
inside a running Linux system. A human who has looked at the firmware setup screen may write
`uefi+csm`; a probe may not, because that would be a guess wearing the costume of an observation.

## Adding a row

```
# append one tab-separated line, then:
node tools/compat-lint.mjs
node --test tools/compat-lint.test.mjs   # its last test pins the physical-row count; update it in the same commit
```
