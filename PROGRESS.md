# PROGRESS

Newest first. One entry per meaningful step, with evidence. Re-read at session start (spec §8).

---

### 2026-09-20 · Foundations laid, upstream research running
- PLAN.md approved by human. §9 blockers D1–D5 answered (see DECISIONS.md).
- Verified local environment first-hand rather than trusting the plan: macOS 27 / **arm64**, Node 22 +
  pnpm present, **no docker, no podman, no qemu, no cosign, no Go.** `gh` authenticated as `aarohkandy`
  with scopes `gist, read:org, repo, workflow` — notably **no `write:packages`, no `admin:org`.**
  Consequence: nothing bootc-related can build or boot on this machine, and no org can be created.
  Every build and every VM boot happens in GitHub Actions. This is decided, not discovered later.
- `aarohkandy/auros` confirmed to exist, public, empty.
- Created workspace + `auros.config.json` (single source of truth for the namespace).
- `hardware/compat.tsv` created hour one with its header and the `source` column that keeps VM rows from
  ever being mistaken for hardware evidence.
- Launched 8-way parallel upstream research (Aurora digest/tags, bootc lifecycle + greenboot + signature
  enforcement, rechunk + real pruning, GH Actions KVM/disk/dispatch limits, Windows migration APIs, web
  stack, KDE Windows-feel, honest .exe compatibility) → one decision sheet the code gets written from.
