# PROGRESS

Newest first. One entry per meaningful step, with evidence. Re-read at session start (spec §8).

---

### 2026-09-20 · Gate 1 in progress · four repos live · gates are mechanical

**Decisions closed by the human:** Auros (D1) · flatten at publish (D2) · Aurora/KDE (D3) · the
*personalized Windows, never a terminal* directive (D4) · real public repos and real CI (D5).

**Five repos live and public** under `aarohkandy`: the meta/control repo plus base, recipes, installer,
web.

**Measured rather than assumed** (`docs/evidence/2026-09-20-runner-probe.md`). PLAN.md's CI section
rested on research claims; two of them were wrong in our favour and one was the most important number
nobody had:
- Runner disk: plan feared ~14 GB and called it a possible hard blocker. **Measured 145 G total, 110 G
  free after cleanup.** Not a blocker, not close.
- `/dev/kvm`: present, `kvm-ok` confirms acceleration, writable after `chmod 666`. Gates 1–2 cost nothing.
- **The Aurora base is 3.5 GB compressed.** So a nightly base change is a 3.5 GB pull per machine and a
  180-machine school is a ~630 GB event. That makes flattening a requirement rather than an optimisation,
  and it constrains what we may *claim* about nightly updates until we have measured a real delta
  (BLOCKED.md B6).
- Upstream digest pinned: `sha256:911281f2…d0d2f1`, Fedora 44, Plasma 6.7.5, bootc 1.16.10, x86_64 only.

**Eight-way live research produced 225 facts and 37 blockers** (`docs/DECISION-SHEET.md`), and overturned
five plan assumptions. Recorded as D8–D25. The three that mattered:
- **D8** — deriving from Aurora does *not* give signature enforcement. Its `policy.json` ends in an
  `insecureAcceptAnything` catch-all, so `--enforce-container-sigpolicy` succeeds while verifying
  nothing. Check U4 would have passed vacuously. We ship our own key, `registries.d` and sigstoreSigned
  transport inside the image.
- **D21** — upstream **garbage-collects the digest we pin** (weekly cleanup, 90 days, keep 7 tags).
  Pinning protects against a tag moving, not against the blob being deleted. We now mirror the pinned
  digest into our own namespace and resolve `FROM` against the mirror, which is what keeps a customer's
  fork buildable — and the replaceability claim true — after upstream forgets.
- **D22** — `uupd`, not `bootc-fetch-apply-updates`, is the real update driver on this base. PLAN.md named
  the wrong unit, which would have produced an update agent that looked configured and never ran.

**Two prohibitions are now mechanical, not aspirational.** `tools/gate.mjs` for §4.3 (no untested image
publishes) and `tools/honesty-gate.mjs` for §4.4 (no fabricated social proof). Both fail closed. Each was
verified able to go **red** — a gate that cannot fail is not a gate. `./verify` runs every gate and CI
calls the same script, so local and CI cannot drift.

**Two bugs of our own worth keeping:** a probe piped a build through `tail`, so a *failing*
`bootc-image-builder` scored as a *passing* step — the exact failure the check matrix exists to prevent,
appearing in our own code within an hour of writing the matrix (D19, `pipefail` everywhere). And
`ostree container commit` is obsolete on this base and fails confusingly (D20) — every pre-2024 tutorial
ends with that line.

**In flight:** base image layers (hardening, four policy modes, update agent + signing, Windows-feel,
matrix harness, nightly CI), recipe schema and compiler, installer safety core and fault harness, site
foundation and terrain renderer. The boot probe is testing the literal Gate 1 exit path end to end:
image → qcow2 → QEMU → login prompt.

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
