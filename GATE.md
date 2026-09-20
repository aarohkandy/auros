# GATE — current position

**Current gate: 1** · **Plan approved:** 2026-09-20, §9 decisions D1–D5 answered.

A gate is marked passed only when its evidence column names a CI run, a digest, or a `results.json`
anyone can reopen. **"It should work" is not evidence** (spec §4.3).

| Gate | Criterion (binary) | Status | Evidence |
|---|---|---|---|
| 1 | `auros-base:hardened` builds in CI and boots in a VM | **IN PROGRESS** | pipeline proven as far as a qcow2; boot under test |
| 2 | A recipe inherits from it; a base change propagates to it and to a running VM with no human action | pending | propagation built (`auros-recipes/.github/workflows/propagate.yml`); needs Gate 1 first |
| 3 | 100/100 clean migrations and 20/20 clean aborts | **UNBLOCKED** | harness built (`auros-installer/.github/workflows/gate3.yml`); needs the tool to compile |
| 4 | Site live; a stranger's configuration opens a valid PR | pending | content + schema done; configurator and Worker in build |
| 5 | Three laptops imaged; `compat.tsv` has three rows and one honest ✗ | **blocked — hardware** | runbook ready (`docs/GATE5-RUNBOOK.md`) |
| 6 | A nonprofit has three working laptops they did not have last week | **blocked — human** | outreach drafted, not sent (`docs/outreach/`) |

## What is actually proven, as of now

**Measured, with a run anyone can reopen:**
- A free runner has 145 G of disk, 110 G free after cleanup, and a usable `/dev/kvm`
  ([run](https://github.com/aarohkandy/auros-base/actions/runs/35538612202)).
- The upstream base resolves to `sha256:911281f2…d0d2f1`, is **3.5 GB compressed**, and pulls in ~58 s.
- A derived image builds, and `bootc container lint` passes on it.
- `bootc-image-builder` produces a qcow2 from it, given a **≥20 GiB** root filesystem (D26).

**Enforced mechanically, and each verified able to go red:**
- §4.3 — no untested image publishes (`tools/gate.mjs`, fails closed).
- §4.4 — no fabricated social proof (`tools/honesty-gate.mjs`, 9 rules, fails closed).
- `compat.tsv` — a `vm` row cannot claim a physical-only column (`tools/compat-lint.mjs`).
- The installer's wall — a Go test parses the import graph and fails if any package outside
  `internal/safety` can reach the system disk, and asserts it is not vacuous.

**Not proven, and not claimed:**
- That the base image boots to a login prompt. Under test.
- That a base change propagates unattended within 20 minutes. Built, untested.
- Anything about real hardware. No physical machine has been touched.

## The honest read

Gate 1 is late against the spec's "end of day 1", and the reason is worth keeping: four upstream
assumptions in PLAN.md were wrong, and two of them (D8 signature enforcement, D21 upstream deleting our
pinned digest) would have produced a green build that was not actually safe. Finding them cost hours.
Not finding them would have cost a customer.
