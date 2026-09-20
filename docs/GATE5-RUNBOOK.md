# Gate 5 — the three donated laptops

**Gate 5 is true when:** three donated laptops are imaged, and `hardware/compat.tsv` has three rows
**including at least one honest ✗.**

Spec §10 names Gates 1 and 5 as the two that slip, and gives the reason: *"Everything else is software
and compresses; hardware does not."* This runbook exists so that when the machines arrive, the only
remaining variable is the machines.

**Status:** blocked on hardware arriving (BLOCKED.md B5). Everything below is doable the hour they do.

---

## The point of the ✗

The gate does not say "three rows". It says three rows **and at least one honest ✗**, and that clause is
the whole test. Three green rows would mean one of two things: we got lucky, or we stopped looking. On
2012–2016 hardware, three machines with nothing wrong is not a plausible result — it is a reporting
failure.

So the ✗ is not a disappointment to be minimised. **It is the evidence that the table can be trusted.** A
compatibility table with no failures in it is a marketing document, and a school that finds the first ✗
themselves, on their own machines, after paying, will never believe the table again.

## Before the machines arrive

- [ ] Gate 1 passed: a signed base image exists and boots in a VM.
- [ ] An installable ISO exists from `bootc-image-builder`, written to a USB stick **by a Linux machine**
      — per D13 the Windows tool does not write boot media.
- [ ] A recipe for these three machines, built from an actual conversation about what they are for. Not a
      generic one. The pilot is the conversation; the recipe is its output.
- [ ] `tools/compat-lint.mjs` passing, so a dishonest row cannot be committed.

## Per machine

**1 — Identify it precisely, before touching anything.**
Model, exact year, and the *numeric* PCI/USB IDs. "Intel Wireless" is not a model, and a row that records
a marketing name is a row we cannot match against the next machine.
`lspci -nn`, `lsusb`, `dmidecode -t system`, from a live USB.

**2 — Record what Windows managed, as the baseline.**
If the machine still boots Windows, note what works *there* first. A webcam that was already broken is
not a finding about us, and without this step we would record it as one.

**3 — §4.1 applies even to a donated machine.** If there is any data on it, it gets copied off and
verified before anything is written. A donated laptop is exactly where someone's photographs turn up.

**4 — Install, then work the list in cost order.**
`wifi` → `trackpad` → `suspend` → `brightness` → `gpu` → `audio` → `webcam`.
Wi-Fi failing makes the machine useless; a webcam failing makes it slightly worse. Test in the order that
matches what it costs the school.

**5 — Write the row.** `source=physical`, tester, date. `partial` requires a note saying which half works:
*"associates on 2.4 GHz only"* is useful; *"mostly works"* is not a finding, it is a feeling.

**6 — Leave it running for a week.** Suspend/resume, battery and thermals are the three that pass a
ten-minute test and fail a ten-day one, and they are also the three most likely to make a school quietly
stop using the machines.

## What the VM already established, and what it cannot

The check matrix proves the *software* is sound: it boots, it updates, it rolls back, it refuses an
unsigned image, the locale is right, the policy is actually in force.

It cannot establish any of: real Wi-Fi association and roaming · trackpad gestures and palm rejection ·
brightness and volume keys · true firmware suspend · webcam · battery and thermals · GPU acceleration on
GMA-era integrated graphics · whether this vendor's firmware honours `BootNext`.

Those are exactly the columns `source=physical` exists to protect, and `tools/compat-lint.mjs` refuses to
let a `vm` row claim any of them.

## The checks that have been waiting for real hardware

Deferred here by D27, because a hosted Windows runner cannot do them and it would have been dishonest to
score them as passed:

- **BitLocker suspension on TPM 1.2.** `manage-bde -protectors -disable C: -rc 1` must survive one reboot
  with no recovery prompt. This is the one that strands a user at a recovery key **on the abort path**,
  which is the worst place this product can fail. The `tpm12` QEMU profile reproduces the risk; only a
  real machine proves the mitigation.
- **`BootNext`.** Whether this vendor's firmware honours it, or whether Fast Boot skips USB enumeration
  and the firmware rewrites `BootOrder` at POST.
- **Secure Boot.** Whether this firmware trusts Microsoft's *third-party* UEFI CA, which signs Fedora's
  shim and which some Lenovo and Dell business firmware ships disabled.
- **The full ARM phase**, end to end, on a machine we are allowed to destroy.

## The decision that is not ours

`verdict=unsupported` is **§9-reserved for the human.** This runbook may propose it, with evidence.
`compat-lint` refuses a `vm` row that declares it. Declaring a model unsupported decides what we will
refuse to sell, which is a business decision wearing a technical costume.
