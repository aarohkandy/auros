# TASKS

The queue. Re-read at the start of every work session (spec §8).
`[x]` done · `[~]` in progress · `[ ]` queued · `[B]` blocked (BLOCKED.md) · `[H]` needs the owner.

Last reconciled against reality: 2026-09-20, late. The previous version still described the morning's
plan; a task list nobody updates is a second PLAN.md that is wrong.

## W0 — Foundations
- [x] Namespace fixed in one file (`auros.config.json`) — D1
- [x] State files, `hardware/compat.tsv` with the `source` column
- [x] Five repos live; four public product repos + control repo; **all rights reserved** (D30/D31)
- [x] `auros_private` for anything with no public benefit (D36)
- [x] Publish gate: ledger, `tools/gate.mjs`, PreToolUse hook — refusal tested, `--force` rejected
- [x] Honesty gate — licence grants, fabricated experience (conditional on compat.tsv), social proof,
      savings, unqualified "one restart", blanket .exe claims, claims freshness vs DECISIONS
- [x] Workflow lint, compat lint, units guard, shell-idiom traps, `verify` + meta-test that it goes red
- [x] Skills: `recipe-compile`, `vm-check-matrix`, `driver-triage`, `theme-generate`
- [B] Purge `advertising/` from public history — B13, when the repo is quiet

## W-A — auros-base (Gate 1 → Gate 2)
- [x] Containerfile on the pinned digest; mirrored upstream so the pin survives upstream GC (D21)
- [x] Hardening, four policy modes with assertions that genuinely attempt the forbidden thing
- [x] Update agent: greenboot 0.16.4 (capabilities asserted, checks in /usr), rollback wired (D9/D10/D22)
- [x] Signature enforcement inside the image (D8); development key that cannot publish (D32)
- [x] Windows-shaped desktop and guided first boot (D4) — installs in the build
- [x] Check-matrix harness; boot path proven on free CI (KVM, ~30 s to running)
- [~] **The hardened image builds.** Flatten (D11) fixed to ublue's verified invocation; rebuilding
- [ ] Static checks S1–S10 on the hardened image
- [ ] Boot checks B1–B12 per profile
- [ ] Update/rollback U1–U5 — `gate1-exit.yml`, run-scoped key, never touches `:hardened`
- [H] Production signing key before any customer — B10

## W-B — auros-recipes (Gate 2)
- [x] Schema a non-engineer can read; FROM/pin/protected refused by shape, not policy
- [x] Compiler, deterministic; generated Containerfile committed with a drift check (D28)
- [x] Prune engine with a measured floor and a ratchet; `explain` becomes the PR body
- [x] 433 node tests + 65 Python refusals; PR gate with read-only permissions
- [x] Propagation: poll fallback until a dispatch credential exists (B2)
- [x] Three example recipes COMPILED and DIFFED — `test/differ.test.ts`, 7 red-state mutations.
      Found three fields that reached the image as nothing and one that changes the report and not
      the machine (D38). Prune sets measured: 57/52/8, **nested** workstation ⊂ school ⊂ kiosk.
- [x] `examples.yml` — `workflow_dispatch -f base_image=…` builds all three and compares their
      package databases. One command the moment the hardened base publishes.
- [ ] Three example recipes BUILT and BOOTED — needs the hardened base first
- [H] **§9: does a customer's `updates.install_between` window win, or does U1's twenty-minute
      propagation deadline?** They are in direct tension and the field is disclosed as not applied
      until somebody decides (D38).

## W-C — auros-installer (Gate 3)
- [x] Safety core: `VerifiedArchive` unforgeable, the wall enforced by an import-graph test
- [x] CI green on branch `fix/installer-build-green`: 304 tests, 194 on abort paths, govulncheck
      clean after it was found never to have run (D35)
- [H] **Owner pushes `main`** — chose to do this personally
- [~] Gate 3 harness rebuilt against the real CLI, on branch `fix/gate3-real-cli`
- [ ] 100 clean runs + 20 induced failures, C: diffed before and after every run (D27)
- [B] BitLocker / BootNext / ARM on real firmware — Gate 5 physical machines
- [B] Code-signing certificate — B3, spends money

## W-D — auros-web (Gate 4)
- [x] Design system, terrain renderer, content, configurator, order Worker (205 tests)
- [x] Voice pass (D29); fabricated lab and notes removed; 1,554 contrast pairs measured
- [x] Licence claims rewritten to D31 — 105 files, honesty gate clean
- [x] Turnstile exemption ratified (D33)
- [H] Wind-down terms document — B12. **Blocks publishing.** Draft exists; needs a lawyer.
- [H] Cloudflare account + explicit go-ahead to publish — B14
- [H] $0 self-serve tier — B9, pricing is §9

## Gates 5 and 6
- [B] Three donated laptops — B5. Runbook ready (`docs/GATE5-RUNBOOK.md`).
- [H] A nonprofit pilot — B4. Outreach drafted, not sent.

## W-E — auros-console
Not built. Spec §6E: last, and only after a real customer exists.
