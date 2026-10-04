# GATE — current position

**Current gate: 1** · **Plan approved:** 2026-09-20, §9 decisions D1–D5 answered.

A gate is marked passed only when its evidence column names a CI run, a digest, or a `results.json`
anyone can reopen. **"It should work" is not evidence** (spec §4.3).

| Gate | Criterion (binary) | Status | Evidence |
|---|---|---|---|
| 1 | `auros-base:hardened` builds in CI and boots in a VM | **IN PROGRESS — S7 GREEN (honest, uncached); boot matrix running** | S7 passed in run [35566336512](https://github.com/aarohkandy/auros-base/actions/runs/35566336512): two `--no-cache` builds, zero cache hits, identical content digest `c42806ae…f436` (D41). Static phase: S1 S2 S3 S4 S9 S11 pass; **S5, S6, S10 fail on three owner decisions** (BLOCKED B21). Then: `sign` (dev key, D32) → `update` U1–U5 → `record`. `record` needs `AUROS_DISPATCH_TOKEN` (B2) and the gate refuses every digest until `tools/gate.mjs` knows S11 (B21). |
| 2 | A recipe inherits from it; a base change propagates to it and to a running VM with no human action | pending | propagation built (`auros-recipes/.github/workflows/propagate.yml`); needs Gate 1 first |
| 3 | 100/100 clean migrations and 20/20 clean aborts | **UNBLOCKED** | harness built (`auros-installer/.github/workflows/gate3.yml`); needs the tool to compile |
| 4 | Site live; a stranger's configuration opens a valid PR | pending | content + schema done; configurator and Worker in build. **§6D's three unmeasured sentences are now measured** (D40), on a GitHub runner: the no-JS path and "no client-side framework" PASS; Lighthouse mobile ≥ 95 passes on **8 of 9 pages** — `/` measures **91** and the gate is red on it (BLOCKED.md B20) |
| 5 | Three laptops imaged; `compat.tsv` has three rows and one honest ✗ | **blocked — hardware** | runbook ready (`docs/GATE5-RUNBOOK.md`) |
| 6 | A nonprofit has three working laptops they did not have last week | **blocked — human** | outreach drafted, not sent (`docs/outreach/`) |

## What is actually proven, as of now

**Measured, with a run anyone can reopen:**
- A free runner has 145 G of disk, 110 G free after cleanup, and a usable `/dev/kvm`
  ([run](https://github.com/aarohkandy/auros-base/actions/runs/35538612202)).
- The upstream base resolves to `sha256:911281f2…d0d2f1`, is **3.5 GB compressed**, and pulls in ~58 s.
- A derived image builds, and `bootc container lint` passes on it.
- `bootc-image-builder` produces a **4.4 GB** qcow2 from it in **~7 min**, given a ≥20 GiB root (D26).
- **That qcow2 boots in QEMU under KVM and reaches a running system in ~30 seconds**, including
  `bootc-status-update.target` — the mechanism check U1 reads
  ([run](https://github.com/aarohkandy/auros-base/actions/runs/35539867513)).

**Enforced mechanically, and each verified able to go red:**
- §4.3 — no untested image publishes (`tools/gate.mjs`, fails closed).
- §4.4 — no fabricated social proof (`tools/honesty-gate.mjs`, 9 rules, fails closed).
- `compat.tsv` — a `vm` row cannot claim a physical-only column (`tools/compat-lint.mjs`).
- The installer's wall — a Go test parses the import graph and fails if any package outside
  `internal/safety` can reach the system disk, and asserts it is not vacuous.
- §6D — Lighthouse mobile ≥ 95 on every built page (**currently red on `/`, 91** — B20), the
  no-JavaScript path, and the absence of a client-side framework on content pages (`auros-web/.github/workflows/lighthouse.yml`, Lighthouse
  pinned at 12.8.2). `auros-web/tools/prove-red.mjs` breaks thirteen specific things and requires
  each gate to go red **for the stated reason**; red-by-accident is scored as a failure of the
  prover, not as a catch.

**Not proven, and not claimed:**
- That **our hardened base** boots. The probe booted a *minimal derivative* — one marker file. Gate 1
  needs `auros-base:hardened`, with policy modes, update agent and signing, through the full matrix.
- That a base change propagates unattended within 20 minutes. Built, untested.
- Anything about real hardware. No physical machine has been touched.

## The honest read

Gate 1 is late against the spec's "end of day 1", and the reason is worth keeping: four upstream
assumptions in PLAN.md were wrong, and two of them (D8 signature enforcement, D21 upstream deleting our
pinned digest) would have produced a green build that was not actually safe. Finding them cost hours.
Not finding them would have cost a customer.
