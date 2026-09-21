---
name: driver-triage
description: Diagnose hardware that does not work on an Auros machine — wifi, trackpad, suspend, brightness, gpu, audio, webcam — and record an honest row in hardware/compat.tsv. Use when a physical laptop misbehaves, when quoting a customer's fleet, or when deciding whether a model is supportable.
---

# driver-triage

Turns "the wifi doesn't work on this ThinkPad" into a row in `hardware/compat.tsv` that we can quote from
four years from now — and turns "we have 62 Latitudes, can you do it?" into an answer with evidence
behind every word of it.

Two tools do the mechanical half. **Neither of them will answer a question a person has to answer.**

| | |
|---|---|
| `auros-base/tools/capture-compat.sh --ask` | runs **on the booted machine**; fills the observable columns from sysfs and asks the seven questions it refuses to answer |
| `auros-base/tools/quote-from-compat.mjs` | reads the table back; says **tested and works** / **tested, caveat** / **never seen** / **unsupported** |
| `tools/compat-lint.mjs` (meta repo) | refuses a dishonest row before it can be committed |

## The rule that makes this file worth anything

**`source=vm` rows leave the physical-only columns EMPTY.** Not `?`, not `ok` — empty, because empty means
"we did not test this", which is the truth. A QEMU profile has no real Wi-Fi chipset, no trackpad, no
backlight and no webcam.

**No customer quote is ever generated from a `vm` row.** Filling those columns from VM runs would
manufacture exactly the unearned confidence spec §4 exists to prevent, and we would then quote a real
school from it.

Both halves are mechanical now, not remembered: `compat-lint` refuses the row, and
`quote-from-compat.mjs` refuses the whole file it appears in.

## Procedure on a physical machine

### 1 — Capture what the machine can tell you about itself

```bash
auros-base/tools/capture-compat.sh --facts-out ~/t440s.facts
```

It reads DMI, `/proc/cpuinfo`, `/proc/meminfo`, `/sys/firmware/efi`, `/sys/class/tpm` and the PCI/USB
trees, and prints a partial row with `source=physical` plus a **facts file naming the path behind every
single value**. It does not need `lspci`, `dmidecode` or root, and it does not need the network.
(`--ask` does all of this and then puts the seven questions — see step 5.)

The identifying columns are numeric by construction: `wifi=pci:8086:08b1;gpu=pci:8086:0a16`. **"Intel
Wireless" is not a model** — two laptops five years apart carry that string and different silicon, and a
row recording it matches nothing the next time we are asked to quote.

If DMI is full of placeholders (`System manufacturer` / `System Product Name`), the tool refuses and
prints what it actually found. Read the label on the bottom of the machine and pass `--model`.

`uefi+csm` is a legal value of the `firmware` column that **no tool will ever write.** Whether a
UEFI-capable firmware booted through a compatibility module is not observable from inside a running
Linux system. A human who looked at the firmware setup screen may write it; a probe may not.

### 2 — Record what Windows managed, as the baseline

If the machine still boots Windows, note what works *there* first. A webcam that was already broken is
not a finding about us, and without this step we record it as one.

### 3 — §4.1 applies even to a donated machine

If there is any data on it, it gets copied off and verified before anything is written. A donated laptop
is exactly where somebody's photographs turn up.

### 4 — Answer the seven, in cost order

`wifi` → `trackpad` → `suspend` → `brightness` → `gpu` → `audio` → `webcam`.
Wi-Fi failing makes the machine useless; a webcam failing makes it slightly worse. Test in the order that
matches what it costs the school.

`capture-compat.sh --print-prompts` prints the exact question for each one — *"associate on 5 GHz, then
2.4 GHz, stay up 60 seconds, walk to the far end of the building"*, not *"does the wifi work"*. The two
produce different rows and only the second is worth quoting from.

When something is broken, before writing `fail`: `journalctl -b -p warning`, the relevant kernel module
(`modinfo`, `dmesg | grep -i firmware`), and whether the fix is firmware Fedora ships, firmware it does
not, or nothing.

### 5 — Write the row

```bash
auros-base/tools/capture-compat.sh --ask --tester aaroh --row-out row.tsv
```

`--ask` puts the seven questions one at a time and offers SKIP explicitly, because "nobody tried this"
has to be an easy answer to give — otherwise somebody gives a wrong one instead, and a wrong one is the
only kind of row that costs us anything. The flag form is there for a second pass and for scripts:

```bash
auros-base/tools/capture-compat.sh \
  --wifi partial --note-wifi "associates on 2.4 GHz only, 5 GHz radio not seen by iwlwifi" \
  --trackpad ok --suspend ok --brightness ok --gpu ok --audio ok --webcam fail \
  --tester aaroh --row-out row.tsv
```

`partial` **requires** a note. "associates on 2.4 GHz only" is a finding; "mostly works" is a feeling, and
a feeling in this file is what makes the next quote wrong. The tool refuses without one.

Then, in the meta repo: `cat row.tsv >> hardware/compat.tsv && node tools/compat-lint.mjs`.

### 6 — Leave it running for a week

Suspend/resume, battery and thermals are the three that pass a ten-minute test and fail a ten-day one,
and they are also the three most likely to make a school quietly stop using the machines. Update the row.

## Quoting a fleet

```bash
auros-base/tools/quote-from-compat.mjs "ThinkPad T440s" "Latitude E6430"
auros-base/tools/quote-from-compat.mjs --models-file fleet.txt --json
```

Four answers, and exactly four:

- **TESTED · WORKS** — a physical row, every one of the seven observed `ok`, verdict `supported`.
- **TESTED · CAVEAT** — something `partial`, something `fail`, **something empty**, or a human caveat.
- **NEVER SEEN** — no physical row. *This is the common answer today, and it is the one the tool exists
  to protect.* There is always pressure to round it up to the first one. The honest quote from an
  all-unknown fleet is a pilot: take three machines, image them, fill in the table.
- **UNSUPPORTED** — a human said so. Never inferred.

An empty cell **never** becomes a verdict. A model with no row **says so** rather than going quiet.
`--require-quotable` exits 3 rather than 0 when anything on the list is not TESTED · WORKS, which is what
to put in front of a CI job or a pricing script.

## The decision you are not allowed to make

`verdict=unsupported` is **§9-reserved for the human.** The tooling and this procedure may *propose* it,
with evidence — `capture-compat.sh` does exactly that, in words, when `wifi=fail` — but only a person may
write it, because declaring a model unsupported decides what we will refuse to sell, and that is a
business decision wearing a technical costume.

## What a fix may not be

If the only way to make a model work is to pin a kernel, patch a driver, or hold back a package version in
that customer's recipe — **stop.** That is a second base (see `recipe-compile`), and a second base breaks
the one-rebuild CVE promise for everyone. The honest outcomes are: fix it in `auros-base` for everybody,
or mark the model `supported-with-caveat`, or propose `unsupported` to the human.

## If you change either tool

Both are tested in both directions and the suites will tell you if you have broken that:

```bash
bash auros-base/tests/capture-compat.test.sh        # 132 assertions, incl. mutating the script
node --test auros-base/tools/quote-from-compat.test.mjs
node --test tools/compat-lint.test.mjs              # meta repo
```

`capture-compat.test.sh` mutates the shipping script — inserting a probe that fills `wifi` — and requires
the guard to refuse the row. A guard nobody has watched fire is a comment with an `if` around it (D34).
