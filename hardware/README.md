# hardware/compat.tsv

One row per machine we have actually observed. This file is the asset competitors cannot copy quickly
(spec §8). It is only worth that if every row is true.

## The `source` column is load-bearing

`source` is `vm` or `physical`. A QEMU profile has no real Wi-Fi chipset, no trackpad, no backlight and
no webcam — it cannot produce an honest verdict for those columns. So:

- `source=vm` rows **leave `wifi`, `trackpad`, `brightness`, `webcam` and `suspend` empty.** Not `?`, not
  `ok` — empty. An empty cell means "we did not test this", which is the truth.
- **No customer quote is ever generated from a `vm` row.** The quoting tool filters on `source=physical`.

Filling a VM row's physical columns would manufacture exactly the unearned confidence that spec §4 exists
to prevent, and we would then quote customers from it.

## Values

| Column | Values |
|---|---|
| `wifi`,`trackpad`,`suspend`,`brightness`,`gpu`,`audio`,`webcam` | `ok` \| `partial` \| `fail` \| *(empty = untested)* |
| `firmware` | `uefi` \| `uefi-sb` \| `bios` \| `uefi+csm` |
| `ids` | `role=bus:vvvv:dddd`, roles separated by `;`, several devices in one role by `,` |
| `tpm` | `2.0` \| `1.2` \| `none` \| *(empty = a TPM is present, version unreadable)* |
| `verdict` | `supported` \| `supported-with-caveat` \| `unsupported` \| `untested` |

## `ids` — why a marketing name is refused

`GATE5-RUNBOOK.md` step 1 and the `driver-triage` skill both say it: **"Intel Wireless" is not a
model.** Two laptops five years apart carry that string on the box and different silicon inside, and a
row that records it matches nothing the next time we are asked to quote. So `ids` holds the numeric
vendor:device pairs straight out of sysfs — `wifi=pci:8086:08b1;gpu=pci:8086:0a16;webcam=usb:04f2:b39a`
— and `tools/compat-lint.mjs` enforces the shape, which a marketing name cannot satisfy.

A **physical** row must have one; a `vm` row has no hardware to identify and must not invent one.

`auros-base/tools/capture-compat.sh` reads them off a booted machine, along with the rest of the
observable columns. `lspci` is not required and is not used: it is not installed on a minimal bootc
image, and depending on a CLI that may not be there is how four build cycles were lost.

## `uefi+csm` is the one value no tool will write

Whether a UEFI-capable firmware booted the machine through a compatibility module is not observable
from inside a running Linux system. `capture-compat.sh` emits `uefi`, `uefi-sb` or `bios` and stops
there. A human who has looked at the firmware setup screen may write `uefi+csm`; a probe may not,
because that would be a guess wearing the costume of an observation.

## Filling a row

```
# on the machine, as the person testing it
auros-base/tools/capture-compat.sh --ask --tester aaroh --row-out row.tsv

# back here
cat row.tsv >> hardware/compat.tsv && node tools/compat-lint.mjs
```

`--ask` probes the machine, then puts the seven questions one at a time, with SKIP offered explicitly
because *"nobody tried this"* has to be an easy answer to give or people give a wrong one instead. The
flag form is there for scripting and for a second pass:

```
auros-base/tools/capture-compat.sh \
  --wifi ok --trackpad ok --suspend ok \
  --brightness partial --note-brightness "keys work, lowest step is still bright" \
  --gpu ok --audio ok --webcam fail --tester aaroh --row-out row.tsv
```

## Reading a row back

```
auros-base/tools/quote-from-compat.mjs "ThinkPad T440s" "Latitude E6430"
```

It answers with exactly one of **tested and works**, **tested, with a caveat**, **never seen**, or
**unsupported** (a human's §9 decision), and it refuses to derive any of them from a `vm` row or from
an empty cell.

`verdict=unsupported` is a **§9 decision reserved for the human.** The tooling may propose it; only a
person may write it.
