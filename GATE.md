# GATE — current position

**Current gate: 1** (`auros-base` builds in CI and boots in a VM)
**Started:** 2026-09-20
**Plan approved:** 2026-09-20 by human, with §9 decisions D1–D5 answered.

| Gate | Criterion (binary) | Status | Evidence |
|---|---|---|---|
| 1 | `auros-base:hardened` builds in CI and boots in a VM | **IN PROGRESS** | — |
| 2 | A customer recipe inherits from it; a base change propagates to it and to a running VM with no human action | pending | — |
| 3 | 100/100 clean migrations and 20/20 clean aborts against a Windows VM | pending | — |
| 4 | Site live; a stranger's configuration opens a valid PR | pending | — |
| 5 | Three donated laptops imaged; `compat.tsv` has three rows and at least one honest ✗ | pending | **hardware not yet received** |
| 6 | A nonprofit has three working laptops they did not have last week | pending | **needs human: outreach** |

A gate is marked passed only when its evidence column names a CI run ID, a digest, or a `results.json`
that anyone can re-open. "It should work" is not evidence (spec §4.3).
