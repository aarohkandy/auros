# TASKS

The queue. Re-read at the start of every work session (spec §8). `[x]` done · `[~]` in progress ·
`[ ]` queued · `[B]` blocked (see BLOCKED.md) · `[H]` needs a human.

## W0 — Foundations
- [x] 0.1 Name + namespace fixed (`auros.config.json`) — D1
- [x] 0.3 Root state files: PROGRESS / TASKS / GATE / BLOCKED / DECISIONS
- [x] 0.4 `hardware/compat.tsv` with header + `source` column, hour one
- [x] 0.2 Create 4 public repos, licences, CODEOWNERS
- [ ] 0.5 Publish-gate hook + `attest/passed-digests.tsv` ledger — must land BEFORE anything can build
- [x] 0.6 Skills: `recipe-compile`, `vm-check-matrix`, `driver-triage`, `theme-generate`

## W-A — auros-base (Gate 1 → Gate 2)
- [ ] A1 Containerfile FROM pinned digest; `base.lock`
- [ ] A2 Hardening layer
- [ ] A3 Policy modes open/managed/locked/kiosk + runtime assertion scripts
- [ ] A4 Update agent: bootc timer + greenboot + auto-rollback
- [ ] A5 cosign keyless signing (legacy bundle format) + install-time enforcement
- [ ] A6 rechunk as final publish step
- [ ] A7 Nightly workflow: rebase → build → matrix → sign → publish on full pass only
- [ ] A8 VM check matrix harness → `results.json` keyed by digest
- [ ] A9 Gate 1 exit test, then Gate 2 propagation
- [ ] A10 **Windows-familiarity layer** (D4): Plasma layout, double-click, Discover/Flathub only,
      first-boot guided setup, no-terminal-required audit

## W-B — auros-recipes (Gate 2)
- [ ] B1 `recipe.yaml` JSON Schema + validator that REJECTS FROM override / kernel pin / version pin
- [ ] B2 Deterministic compiler YAML → Containerfile
- [ ] B3 Prune engine + `removal-report.json` + post-condition assertions
- [ ] B4 Hardware profiles → QEMU machine definitions
- [ ] B5 Three reference recipes (Marathi school 180 · English kiosk 40 · dev desktop 1)
- [ ] B6 Per-recipe CI fan-out

## W-C — auros-installer (Gate 3) — starts day 1, abort path first
- [ ] C1 Static Go exe scaffold, UAC manifest
- [ ] C2 Inventory incl. KNOWNFOLDERID + OneDrive placeholder detection
- [ ] C3 Cannot-migrate report from the real installed-programs list + acknowledgement
- [ ] C4 Destination selection + free-space check; refuses if none
- [ ] C5 Copy + SHA-256 manifest
- [ ] C6 Verify + abort semantics
- [ ] C7 Image write + one-time boot — BUILT LAST
- [ ] C8 Linux first-boot restore + re-verify + desktop report
- [ ] C9 Harness: 18,000 synthetic files × 100 runs
- [ ] C10 Fault injection × 20
- [ ] C11 Dual-boot only after verified archive exists (PLAN §3.7 option a)

## W-D — auros-web (Gate 4)
- [ ] D1 Astro scaffold, design tokens, self-hosted woff2 subsets
- [ ] D2 Canvas terrain renderer (seeded, 4px blocks, parallax by transform only)
- [ ] D3 Content pages + *what doesn't come across* above the fold
- [ ] D4 Configurator → live recipe.yaml that passes B1's validator
- [ ] D5 Build console streaming genuine pipeline output
- [ ] D6 Worker: /order → PR, /build-result → charge, /stripe-webhook
- [ ] D7 [H] Stripe — needs human, touches a real card
- [ ] D8 Lighthouse ≥95 mobile, keyboard-complete, measured WCAG AA, no-JS mailto

## W-E — auros-console
Not built. Spec §6E: last, and only after a real customer exists.
