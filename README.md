# auros — two codebases, under triage

This repo currently holds **two different AurOS implementations** side by
side, on purpose, so a fresh agent (or Aaroh) can decide which one to build
on. Nothing has been deleted; both are preserved with history.

**→ Read [`HANDOFF-TRIAGE.md`](HANDOFF-TRIAGE.md) first.** It explains what
each codebase is, the honest state of each, and the one decision to make.

## The map

| Location | Codebase | One line | Full history |
|---|---|---|---|
| **repo root** (`build/`, `src/`, `rootfs/`, `website/`, `themes/`, …) | **from-scratch** (newer, 2026-10-04) | A hand-built Ubuntu image + the AurBridge Windows installer + the "page is the drive" website. A **working prototype**: builds a bootable image and a tested installer today. | `ComputerDude771/auros-from-scratch` @ `424ed96`, branch `claude/admiring-shannon-xm1g0e` |
| **[`lathe/`](lathe/)** | **LATHE** (existing, 2026-09-21) | The control repo for a 4-repo product (`auros-base`/`-recipes`/`-installer`/`-web`): reproducible bootc/ostree base, per-customer recipes, nightly rebuilds, a gate + honesty-test system. More rigorous and complete as a **product**; not yet running on real hardware. | this repo's own history (see `lathe/PROGRESS.md`) |

## What was changed to set this up

- LATHE moved into `lathe/` (history preserved). This also moved its
  `.github/` out of the repo root, which **deactivated its scheduled
  workflows** — `watchdog.yml` was the one emailing failed-run notices
  twice a day. That spam is now stopped.
- The from-scratch source was imported at the root (tracked files only,
  ~32 MB, no build artifacts).
- All workflows are **parked** (`.github/workflows.parked/`) so nothing
  auto-runs and re-starts the email spam. Re-enable deliberately by moving
  the chosen workflow file back to `.github/workflows/`.

## The decision

Which base do you build on? Short version of the handoff's recommendation:
**LATHE is the stronger foundation; the from-scratch work's unique value is
a working installer + bootable image + website *today*.** Keep LATHE, salvage
those two things, drop the rest — but it's a real call, so it's written up
for a fresh agent in `HANDOFF-TRIAGE.md`.
