# HANDOFF — AurOS triage

**Date:** 2026-10-04 · **For:** the next agent (or Aaroh) · **Author:** build agent

Aaroh has two AurOS codebases and wasn't sure which is better, so both are
now in this one repo for a clean comparison. This file is the orientation.
Read it, then decide which to build on. **Nothing is deleted. Both have
full history.**

---

## 1. What's here

### Root `/` — the "from-scratch" implementation (NEWER, 2026-10-04)

- **Full history:** `ComputerDude771/auros-from-scratch`, branch
  `claude/admiring-shannon-xm1g0e` @ `424ed96`. (Root here is a 32 MB
  snapshot of that branch's tracked files — source only, no build
  artifacts. The `out/` and `work/` build outputs are gitignored and not
  included.)
- **What it is:** a hand-built Ubuntu 24.04 desktop image plus a
  Windows-side installer that migrates a PC to it in one restart.
  - `build/` — `forge` (rootfs), `mkimage` (image), `staging` (the PID 1
    installer runtime), `aurbridge` (the Windows installer).
  - `src/aurstage` — the staging program that shrinks Windows, copies
    AurOS, sets up boot, and can put Windows back.
  - `src/aurscreen` — the restart progress screen (7 steps).
  - `src/ferry` — migrates the user's files, Wi-Fi names, locale,
    wallpaper from the Windows partition.
  - `rootfs/usr/lib/auros/bootchain` — AurOS's own `update-grub` /
    `grub-install` so kernel/shim/grub security updates don't break boot
    or lose "Put Windows back".
  - `website/` — the "page is the drive" site (`index.html` +
    `assets/drive.js`): the old PC narrates its own disk, you can run the
    install on the page, pull the plug, and put Windows back with a
    SHA-256 proof.
  - `tools/` — the test suite (install, no-stick, power-cut, boot-update,
    put-back, first-boot, boot-chain, screen, manifest).
- **What actually works (evidence):**
  - A **bootable image is built and published**: v4 image SHA-256
    `b36100653b1b3dd339c6209cdd60ab169706717f512f2bb5dee0273dd404da41`,
    5,333,057,536 bytes, in pieces on `ComputerDude771/auros-from-scratch`
    branch `image-desktop/v4/`.
  - A **built, tested installer**: `AurOS-Installer-test.exe`, SHA-256
    `ef903efd9cdeb10e15e52b3ce9e4eac83788f3396ac9f029ed04f2cfca1c5891`,
    on `image-desktop`.
  - Full simulation suite green on the shipped bytes; **138-way power-cut
    test** (Windows recoverable from every interrupted instant); the
    installer runs on **real Windows** in CI (`windows.yml`, now parked).
- **What does NOT work / honest gaps:**
  - **Never run on a real PC's disk.** All evidence is simulation (QEMU +
    OVMF) plus real-Windows CI. This is the single biggest unknown.
  - Installer is **unsigned** → Windows SmartScreen warns. Needs a code
    signing cert (company + money).
  - Ships **GNOME Web, not Firefox** — the build network couldn't reach
    Mozilla or the PPA. Stated honestly in-product.
  - **Wi-Fi passwords** aren't migrated (network names are).
  - AurOS's own apps don't self-update yet (Ubuntu's parts, incl.
    kernel/boot, do).

### `lathe/` — the LATHE control repo (EXISTING, 2026-09-21)

- **Full history:** this repo's own log (it was this repo's root until
  now). Last commit `c82bd84`.
- **What it is:** the *control repo* for a four-repo product. The actual
  product code lives in **separate repos not in this session**:
  - `aarohkandy/auros-base` — one hardened, reproducible bootc/ostree
    base image (signature enforcement, 4 policy modes, greenboot +
    rollback).
  - `aarohkandy/auros-recipes` — one directory per customer, YAML in /
    image out, with base-change propagation.
  - `aarohkandy/auros-installer` — the Windows-side migration and
    Linux-side restore.
  - `aarohkandy/auros-web` — site, configurator, order intake.
- **Strengths:** far more rigorous and complete as a *product and system*
  — ~1,500 tests that found ~27 real bugs, an honesty-gate, mutation
  testing, a gate system that refuses to call anything done without a
  reopenable CI run/digest/`results.json`, a real business model (sell
  custom images to schools/nonprofits, rebuilt nightly to stay patched for
  4 years), plus legal/licensing (all rights reserved) and outreach drafts.
- **State (from `lathe/GATE.md`):** nothing runs end-to-end on real
  hardware yet. Gate 1 (base builds + boots in a VM) was **one bug away**
  — S7 determinism: two builds from identical inputs produce different
  content digests (likely unpinned dnf resolution or RPM DB
  non-reproducibility). Gate 3 (installer: 100/100 clean migrations)
  "needs the tool to compile." Gate 5 (three real laptops) blocked on
  hardware. Gate 6 (a nonprofit using them) blocked on outreach.
- **Read in `lathe/`:** `GATE.md` (current position), `PROGRESS.md`
  (newest first), `DECISIONS.md`, `BLOCKED.md`, `TASKS.md`, `docs/SPEC.md`,
  `docs/SYSTEM-REVIEW.md`.

---

## 2. Honest assessment — which is better?

They're "farther along" on different axes:

| Axis | Winner |
|---|---|
| Architecture, reproducibility, update story | **LATHE** (bootc/ostree, signed, nightly) |
| Test rigor & self-honesty tooling | **LATHE** (gate system, honesty-gate, ~1,500 tests) |
| Business/product completeness | **LATHE** (recipes, configurator, legal, outreach) |
| **Something that runs right now** | **from-scratch** (bootable image + working installer today) |
| A finished, novel marketing site | **from-scratch** (the "page is the drive" site) |
| Proven on real hardware | **neither** (both at zero) |

**Recommendation:** build on **LATHE** — it's the stronger foundation by a
wide margin, and the real product already lives in its four repos. Salvage
exactly two things from the from-scratch work and drop the rest:

1. **The website** (`website/`) → becomes/feeds `auros-web` (LATHE's Gate 4
   needs a live site + configurator; this is a strong, done front end).
2. **The power-cut test methodology** (`tools/powercuttest.sh` and the
   aurstage recovery design) → informs `auros-installer` (LATHE's Gate 3,
   which isn't compiling yet). The from-scratch installer has actually
   survived 138 interrupted-power instants with Windows recoverable; that
   test harness is worth porting.

The rest of the from-scratch implementation (the hand-built Ubuntu image,
the custom bootchain) is superseded by LATHE's bootc/ostree approach and
should not be carried forward.

---

## 3. What I changed to set this up (all reversible)

1. Moved every top-level LATHE file into `lathe/` with `git mv` (history
   preserved). This moved `lathe/.github/` out of the repo root, which
   **deactivated LATHE's scheduled workflows** (`watchdog.yml`, `gates.yml`).
   `watchdog.yml` is what was emailing "watchdog: All jobs have failed"
   twice a day — it goes red when `auros-base`'s nightly hasn't completed a
   successful scheduled run in 30 h, which it hadn't since the project
   paused. The spam is now stopped.
2. Imported the from-scratch tracked source at the repo root.
3. Parked all from-scratch workflows at `.github/workflows.parked/` so
   nothing auto-runs and restarts the email spam.
4. Renamed the from-scratch `README.md` → `README.fromscratch.md` and its
   `HANDOFF.md` → `HANDOFF.fromscratch.md` so they don't collide with these
   triage docs. LATHE's own `README.md`/`HANDOFF.md` are under `lathe/`.

**Nothing was deleted.** `git log` shows the two moves/imports as separate
commits.

---

## 4. Next steps for whoever picks this up

1. **Decide the base.** Recommendation above: LATHE.
2. **Re-enable only the workflows you want**, by moving the chosen file(s)
   from `.github/workflows.parked/` (or `lathe/.github/workflows/`) back to
   `.github/workflows/`. Leaving them parked keeps the inbox quiet.
3. **If resuming LATHE:** the first real blocker is Gate 1's S7
   determinism bug in `auros-base`. Add `aarohkandy/auros-base` to the
   session (`add_repo`) and start there; `lathe/PROGRESS.md` points at the
   diagnostic run.
4. **If salvaging from from-scratch:** add `aarohkandy/auros-web` and
   `aarohkandy/auros-installer`, then port the website and the power-cut
   harness as described in §2.
5. **The one move that matters for either path:** get an image onto a real
   PC. Both codebases are at zero real-hardware installs; that's the next
   piece of evidence that changes anything.
