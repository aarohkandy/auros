# AUROS — TESTING

> What is tested, how well, and what is not. Written to be trusted, which means it has to be
> uncomfortable in places. If a number here is flattering, check it: every one of them came from a
> run, and the command that produced it is printed beside it.

**Measured on 2026-09-20/21**, against meta-repo commit `0a1aad5` with three files dirty
(`DECISIONS.md`, `tools/gate.mjs`, `verify` — other agents were mid-edit). Product-repo working
trees as they stood at 18:04 PDT.

**Read this caveat first.** The workspace was being edited by other agents while these suites ran.
Two suites changed size under me inside forty minutes (`auros-recipes` went 441 → 536 tests;
`auros-base/tests/capture-compat.test.sh` went 2-failing → 112-passing). So every aggregate below
was taken against a **frozen `rsync` snapshot** of the tree, not the live directory, and the
snapshot commit is named above. Per-suite numbers are stable and meaningful. The one number that is
*not* a stable property of the codebase is `./verify`'s aggregate: it was **18 pass / 7 fail** on
the snapshot and **24 pass / 3 fail** on the live tree forty minutes later, because four gates had
named a problem and somebody had fixed it. §6 gives both readings and the reason for each failure.

---

## 1. How to reproduce every number in this document

```bash
# recipes — TypeScript toolchain + Python validator
cd auros-recipes && pnpm test && python3 schema/refusals.test.py

# base — shell build scripts, policy, update agent, desktop
bash auros-base/tests/run-all.sh
bash auros-base/tests/prove-red.sh          # the mutation harness

# recipes mutation harnesses
cd auros-recipes && node scripts/prove-red.mjs && node scripts/prove-red-differ.mjs

# web — site invariants, and the order Worker
cd auros-web && pnpm test && node tools/prove-red.mjs
cd auros-web/worker && node --test 'test/*.test.js'   # NOT `node --test test/` — see §5.4

# installer — Go. Needs a Go toolchain; there is none on the operator's Mac (§4.1).
cd auros-installer && go vet ./... && go test ./... -count=1
cd auros-installer/testharness && go vet ./... && go test ./... -count=1

# meta repo tools. `node --test tools/` DOES NOT WORK on Node 22 — it resolves `tools/`
# as a module path and dies with MODULE_NOT_FOUND before running anything (§5.4).
cd /Users/aaroh/auros && for f in tools/*.test.mjs; do node --test "$f"; done

# everything, as CI runs it
./verify
```

**Environment matters more than it should, and the suites do not all say so.** §4.4 lists the
undeclared dependencies and what each one does when it is missing.

---

## 2. What is covered

Counting units differ between components and are not interchangeable. A bash "assertion" in
`auros-base` is one `ok` line; a Go "test" is one `func Test`; a Node "test" is one `test()` call
including subtests. **There is no honest single grand total**, so this table does not print one.

### 2.1 `auros-recipes` — the recipe toolchain

| Suite | Count | Result |
|---|---|---|
| `pnpm test` (`node --test test/*.test.ts`, 18 files) | **536** | **536 pass / 0 fail / 0 skip** on a fully-provisioned Linux container |
| same, on the operator's macOS | 536 | 529 pass / **7 skipped** — macOS bash 3.2 has no `mapfile` |
| `python3 schema/refusals.test.py` | **65 refusals + 3 valid recipes** | OK |

Per file, from individual runs:

```
refusals.test.ts        277     adversarial.test.ts      29     compile.test.ts     26
explain.test.ts          25     cli.test.ts              22     differ.test.ts      22
yaml.test.ts             21     determinism.test.ts      14     golden.test.ts      14
happy.test.ts            12     recipe.test.ts            9     workflows.test.ts    9
catalogue.test.ts         8     compare-images.test.ts    8     licence.test.ts      6
schema-strict.test.ts     4     parity.test.ts            3     prune.test.ts       27
```

What these actually assert, rather than what their names suggest:

- **`refusals.test.ts` (277)** is the largest single body of tests in the project and it is almost
  entirely *negative*: every way a `recipe.yaml` can try to change the `FROM` line, pin a package
  version, reach a reserved key by a different spelling, nest a reserved key under an unknown block,
  or name a hardware model a human marked unsupported. Spec §6B says the rejection is the feature;
  this is that rejection, enumerated.
- **`prune.test.ts` (27)** is the only suite that **executes the shipped prune runner** against stub
  `rpm` and `dnf` binaries rather than reading it. 7 of its 27 need bash ≥ 4 and `python3`. Those 7
  are the ones that catch mutations P04–P08 (§3.2), so on macOS the most important tests in the
  repository do not run. The skip is loud — the suite prints `# SKIPPED (local)` and the same guard
  **fails hard** in CI rather than skipping.
- **`determinism.test.ts` (14)** builds the same recipe twice in one run and compares, which is the
  property the spec settled on after "byte-identical" was abandoned (SPEC §6B, PLAN §3.3).
- **`parity.test.ts` (3)** asserts the TypeScript/ajv validator and the Python/jsonschema validator
  return the same verdict on every case. It **skips** unless `python3` has `jsonschema` and `pyyaml`.
- **`licence.test.ts` (6)** exists because the licence reversed mid-build (D30/D31).

### 2.2 `auros-base` — the image build scripts

`bash tests/run-all.sh` — **14 suites, 932 assertions, 14/14 pass locally.**

```
30-update-agent.test.sh    180      10-hardening.test.sh      152
capture-compat.test.sh     112      00-common.test.sh         107
update-agent/run-tests.sh   89      20-policy.test.sh          74
40-windows-feel.test.sh     65      90-cleanup.test.sh         53
kargs-check.test.sh         28      policy/assert-lib          26
desktop/b12-modes           18      policy/policy-lib          10
shell-idioms.test.sh         9      units.test.sh               9
```

Plus `auros-base/tools/quote-from-compat.test.mjs` — **52 tests** — which `run-all.sh` does not
invoke; `./verify` does.

**In CI this is 13/14, not 14/14.** `capture-compat.test.sh` scores 106 pass / 1 fail on
ubuntu-24.04 (`an unreadable Secure Boot state is recorded as unknown, with what WAS there`) while
scoring 112/112 on macOS. Run `35549997994`. The base `unit-tests` workflow is **red right now**
because of it.

The mechanism worth knowing about: `tests/lib/harness.sh` runs a **direction audit**. It records,
per check id, whether that check was seen going green *and* seen going red, and **fails the suite**
for any check observed in only one direction. Exemptions require `t_exempt <id> <reason>` and the
reason is printed in the run output. Those printed exemptions are the honest part — for example,
`capture-compat.sh`'s end-to-end lint assertion is **exempted in CI**, because `hardware/compat.tsv`
and `tools/compat-lint.mjs` live in the meta repo (D6) and are not checked out beside `auros-base`.
That is a check which passes locally and does not exist in the only place that gates a merge.

### 2.3 `auros-installer` — the Windows migration tool

`grep -rh '^func Test' --include='*_test.go' | wc -l` → **330**, plus 4 `func Fuzz`, across 32 test
files. Executed (there is no Go toolchain on the operator's Mac; this was run in
`golang:1.25.14-alpine` on the `homebase` box, Go 1.25.14 per D35):

| Module | Top-level | Subtests | Pass | Skip | Fail |
|---|---|---|---|---|---|
| root (`internal/…`, `cmd/…`) | 238 | 301 | 535 | 4 | 0 |
| `testharness/` (nested module) | 96 | 12 | 108 | 0 | 0 |

`go vet ./...` is clean for `linux/amd64`, `windows/amd64` and `windows/386`.

The 4 skips are permission-dependent and skip because the container runs as root
(`locked_test.go:103: running as root: permissions are not enforced`).

**The abort path really is tested more than the happy path**, which SAFETY.md rule 2 demands:
**220 of 332** distinct test-function names match the abort-path pattern — 66%, a ratio of about
2:1. CI asserts this and fails if it drops below 1:1, with the instruction *"Add abort tests. Do not
widen the pattern."*

What the suite actually protects:

- **`internal/safety`** — the wall. `TestWall_ForbiddenImports` parses the import graph and fails if
  any package outside `internal/safety` can reach the system disk; `TestWall_SyscallIsConstantsOnly`
  confines `unsafe` to `internal/winenv`. `forge_test.go` demonstrates that the `VerifiedArchive`
  proof type *can* be forged through two `unsafe` pointer writes — which is why SAFETY.md says "a
  value that cannot be constructed by any **safe-Go** path" rather than "a value that cannot exist".
  A guarantee overstated by one word is the one people stop re-checking; this test is what keeps
  that word in.
- **`internal/copyengine`** — 6 files including `diskfull_test.go`, `hostile_test.go`,
  `locked_test.go`, `resume_test.go`. This is the 59-second package; it is doing real I/O.
- **`internal/manifest`** — including `property_test.go` and the 4 fuzz targets.

### 2.4 `auros-web` — the site and the order Worker

| Suite | Count | Result |
|---|---|---|
| `worker/test/*.test.js` (11 files) | **244** | 244 pass / 0 fail |
| `tools/configurator-a11y.test.mjs` | 16 | pass |
| `tools/build-console.test.mjs` | 15 | pass |
| `src/terrain/terrain.test.ts` | **27** (see below) | pass |

Worker, per file: `validate` 58 · `routes` 43 · `stripe` 28 · `refusals` 25 · `explain` 24 ·
`yaml` 21 · `rules-parity` 17 · `github` 10 · `console` 9 · `client-contract` 7 ·
`schema-provenance` 2.

`schema-provenance.test.js` is two tests and is the one that matters most: it asserts the Worker
validates against a schema **byte-identical** to the one `auros-recipes` uses in CI. It is the
assertion behind the sentence a refused visitor is shown at the moment they are most inclined to
believe us.

**`terrain.test.ts` reports as ONE test to `node --test`.** It defines its own `test()` collector
and runner rather than importing `node:test`, so the runner sees a single file-level test. I broke
one of its assertions on purpose to check this is not a silent hole: `node --test` exited **1**, and
`0` again once restored. So the 27 are real and they do gate — but the number `node --test` prints
is 1, and anybody counting tests from runner output will undercount this file by 26.

### 2.5 Meta repo `tools/` — the gates that gate the gates

**8 test files. 334 tests at 17:40 PDT, 473 at 18:40 PDT** — the same eight files, measured twice,
an hour apart, while other agents were adding cases. Both columns are real; neither is "the"
number. This is the clearest illustration in the document of why the caveat at the top exists.

| File | 17:40 | 18:40 | What it asserts |
|---|---|---|---|
| `gate.refusals.test.mjs` | 55 | **165** | The §4.3 publish gate on a **filesystem**: line endings, padding, byte-identical duplication, symlinks, permissions, `matrix_version` shape. Plus: that no flag or env var turns a refusal into an allow. |
| `gate.test.mjs` | 64 | **76** | The gate's core refusal catalogue: a digest with no complete, current, unambiguous ledger row is refused. |
| `honesty-gate.corpus.test.mjs` | 66 | 66 | ~45 real-looking marketing sentences, half of which must fire and half must not. The quiet half is the expensive one: a gate with false positives gets annotated past, and `auros-allow` reached for reflexively is the end of the gate. |
| `verify-meta.test.mjs` | 49 | **59** | See §3.4 — this is a mutation harness, not a test file. |
| `compat-lint.test.mjs` | 30 | **37** | Both directions on `hardware/compat.tsv`. |
| `workflow-lint.test.mjs` | 30 | 30 | Both directions on the workflow linter. |
| `honesty-regressions.test.mjs` | 31 | 31 | One named test per fatal/major finding of the 2026-09-20 honesty audit. |
| `honesty-gate.crossfile.test.mjs` | 9 | 9 | The two checks that read something other than the sentence: a cited workflow's real triggers, and whether `CLAIMS.md` has been re-read since the latest `DECISIONS.md` entry. |

**Two tools in this directory have no test file at all:** `tools/licence-consistency.mjs` — which
`verify` runs as a gate, added in commit `804950d` — and `tools/content-commands.mjs`, which checks
that a command published on the website resolves against a real filesystem. Both are gates. Neither
has ever been watched failing by anything except `verify-meta`'s sandbox, and `licence-consistency`
does not even have that (§6).

---

## 3. Mutation scores

Mutation testing here means: reintroduce a **specific, named bug** into a scratch copy, run the
suite that is supposed to notice, and require it to go red **for the stated reason**. A mutation
that reddens the suite for an unrelated reason is scored a miss, not a catch — because a suite that
fails for the wrong reason will not tell the next person what broke.

Five harnesses exist. Here is what each scored when run for this document.

| Harness | Mutations | Caught | Missed |
|---|---|---|---|
| `auros-base/tests/prove-red.sh` | 61 | **60** | 1 (`H11`, scored a miss by the strict rule — §3.1) |
| `auros-recipes/scripts/prove-red.mjs` | 32 | **32** on Linux · 27 on macOS | 0 · 5 on macOS, all of them the skipped prune tests |
| `auros-recipes/scripts/prove-red-differ.mjs` | 7 | **7** | 0 |
| `auros-web/tools/prove-red.mjs` | 13 (+3 green controls) | **13** | 0 |
| `tools/verify-meta.test.mjs` | every gate `verify` runs, × 2 directions | see §6 | the harness is currently **red**, and what it is red about is worth more than a score |

**113 mutations across four components. Four components have none at all** — §3.6 names them.

### 3.1 `auros-base/tests/prove-red.sh`

**61 mutations. 60 caught, 1 scored NOT CAUGHT.**

Sample of what it proves the suite can still see: `enable_unit`'s fallback symlink pointing at
itself; `pkg_ensure` returning early so nothing is ever installed;
`--setopt=install_weak_deps=False` being dropped; the D21 mirror-name check losing its anchor so
`ghcr.io/attacker/auros-upstream-mirror-evil` reads as our mirror; sshd `disabled` being accepted
where `masked` is required; a signing policy whose global default is `insecureAcceptAnything` (the
D8 failure); a policy pointing at a `keyPath` that is not there. Two of the 61 mutate **the harness
itself** — one stops an extraction from matching and requires the suite to *abort* rather than
quietly test an empty program, and one exercises a check in only one direction and requires the
direction audit to fail the whole suite.

**The one miss is worth reading, because it is a miss by the strict rule and not by the loose one.**

```
WRONG RED H11: bootc is dropped from the end-of-hardening spot-check
      the suite failed, but not on [bootc was removed] — it may be failing for an unrelated reason
      HARNESS ABORT: extract_between: empty extraction ... between
      [^for c in bootc systemctl; do] and [^did "protected set spot-check]
      — the block moved or was deleted, so this test is vacuous.
```

Deleting `bootc` from the spot-check loop *did* turn the suite red — but by emptying the block the
test extracts, which makes the harness abort as vacuous, not by the assertion that owns the bug. A
looser harness would have counted that as a catch and been wrong: the same mutation applied where
the extraction still matched would sail through. `60/61` is the honest score and the missing one is
a real hole.

### 3.2 `auros-recipes/scripts/prove-red.mjs`

**32 mutations. 32/32 caught on Linux. 27/32 on macOS.**

The five macOS misses are P04, P05, P06, P07, P08 — every one of them a prune-runner bug, and every
one of them owned by a test that **skips** on macOS for want of `mapfile`. The harness reported
them honestly:

```
NOT CAUGHT  P04  THE SELINUX BUG, in the shipped runner: the package list collapses to one
                 element and nothing is removed
            no test matching /removes exactly the planned packages/ failed.
            0 other test(s) did: (none at all)
```

**This is the single most useful thing in this document.** On the operator's own machine, the suite
is green, and the mutation harness says five of the worst bugs in the repository would ship. The
green and the hole are the same fact seen twice. On Linux with bash 5 and `python3` present, the
same harness reports `32/32 mutations caught, each by the test that owns it.`

### 3.3 `auros-recipes/scripts/prove-red-differ.mjs`

**7 mutations, 7/7 caught.** All seven are bugs that existed in this repository today or are one
edit away — the compiler dropping `hardware.also_test`, the `updates.install_between` disclosure
disappearing, `prune.also_keep` being accepted with nothing to keep from, `SOURCE_DATE_EPOCH` being
derived from something not in the recipe, the keep-only sweep stopping when a group list is present,
the kiosk config file not being written so every `kiosk.*` field goes inert, and a kiosk keeping
something the school removes.

### 3.4 `tools/verify-meta.test.mjs` — `verify` itself, mutated

**59 tests** (49 when first measured an hour earlier): for each gate `verify` runs, a sandbox where
that gate is **broken** — which must make `verify` exit non-zero — and a sandbox where it is
**whole**, which must not. Plus 5 tests on the aggregation
arithmetic — an all-skip sandbox exits 0; two simultaneous failures are both counted; a SKIP is
never counted as a pass; a gate whose command does not exist is a FAILURE, not a skip — and 4
structural tests, including one that reads `verify`'s own source and fails if any pipeline inside a
`bash -c` runs without `pipefail`.

This is the harness that found D37. It is also the harness that is **failing right now**, and for a
reason worth reading: §6.

### 3.5 `auros-web/tools/prove-red.mjs`

**16 checks on the live tree, all passing** — 13 mutations plus 3 green controls; with
`--quick` (no Chrome) it is 13. Seven no-JS mutations (an argument that only exists inside a
`<template>`; the `mailto:` fallback deleted; the wrong address; `<noscript>` stripped; an
undisclosed placeholder), four content-JS mutations (a framework in a bundle, a render-blocking
script, a canvas in the document, over budget), and two Lighthouse mutations — `lh-accessibility`
and `lh-performance` — which each cost a real Chrome run and were executed for this document.

**On the frozen snapshot, this harness was RED in the other direction** — its *green control*
failed, because `tools/nojs-floors.json` had never been committed, so the no-JS gate could not
report a pass on any input at all. That file landed in the live tree while this document was being
written. Recorded because "permanently red" and "permanently green" are the same defect wearing
different clothes, and only a harness that runs both directions distinguishes them.

### 3.6 **Components that have never been mutation-tested at all**

Named, because a coverage number for a component with no mutation score is a number nobody has
checked:

1. **`auros-installer` — the entire Go codebase.** 330 test functions, 647 test executions, and
   **zero mutation testing**. This is the most dangerous code in the company: it runs on a
   stranger's ten-year-old laptop against the only copy of somebody's work. The `unsafe`-forge test
   and the import-graph wall are strong *structural* guarantees, and `gate3/gate3_test.go` drives
   the Gate 3 harness's own checks into failure — but nobody has reintroduced a bug into
   `internal/copyengine`, `internal/verify` or `internal/manifest` and watched the suite notice.
   The `mutate_source` scenarios in `testharness/gate3` are **fault injection against a corpus**,
   not mutation of our code, and must not be counted as mutation testing.
2. **`auros-web/worker` — 244 tests, no mutation harness.** This is the only endpoint a stranger on
   the internet can reach, and the only code that opens pull requests in a public repository under
   our name.
3. **`auros-recipes/schema/validate.py` and `refusals.test.py`** — the Python half of the validator.
   `parity.test.ts` asserts it agrees with the TypeScript half, which means a bug present in *both*
   is invisible; nothing mutates either one. 65 refusals asserted, 0 mutations tried.
4. **The meta repo's own tools.** `honesty-gate.mjs`, `gate.mjs`, `compat-lint.mjs` and
   `workflow-lint.mjs` each have a both-directions test file, which is weaker than mutation
   testing: it proves the tool says no to inputs somebody thought of, not that the tool would
   disagree with a wrong *implementation*. `verify` is mutated (§3.4); the tools it calls are not.
   **`licence-consistency.mjs` and `content-commands.mjs` have no test file at all** — and
   `licence-consistency` is a gate `verify` runs on every invocation.
5. **The Astro site itself**, beyond the no-JS, content-JS, Lighthouse and contrast gates. Page
   content is covered by the honesty gate as a classifier, not by mutation.

---

## 4. What is NOT tested, and why

### 4.1 Nothing has touched real hardware. Nothing.

`hardware/compat.tsv` has **a header row and zero data rows.** `attest/passed-digests.tsv` has
**a header and zero recorded passes.** No laptop has been imaged. No physical machine has booted an
Auros image. Gate 5 is blocked on three donated laptops that are not in hand (B5).

The honesty gate mechanically forbids the website from claiming hands-on experience until
`compat.tsv` has physical rows. That gate is the reason this section can be trusted: it is not a
promise to be careful, it is a build failure.

Specifically untestable until hardware exists: BitLocker suspension, firmware boot order and
`BootNext`, real suspend/resume, brightness keys, wifi on actual chipsets, trackpad quirks, and
whether a 2012 laptop with 4 GB RAM is usable rather than merely bootable.

### 4.2 Gate 3 has never passed. The number is 0/100 and 0/20, not 100/100.

SPEC §6C's exit condition is 100 consecutive clean migrations against a Windows VM with 18,000
synthetic files, plus 20 induced-failure runs with clean aborts. D27 moved that onto ephemeral
`windows-latest` runners, 10 shards.

**Every `gate3` workflow run to date has failed**, except one probe run (`35546645175`, "gate3
probe: keep the push trigger the harness already had") which did not execute the matrix. The nine
runs after it — `35548468001` through `35550318373` — are all `failure`, and their titles are a
compile-error diary. A tenth was queued while this was written.

So: the Windows tool's *unit* behaviour is well covered (§2.3). Its **end-to-end behaviour on a
Windows machine has never been observed once.** Nothing in `go test` runs on Windows: CI's four
jobs are all `runs-on: ubuntu-latest`, and the Windows coverage is `GOOS=windows go build` and
`go vet` — compilation, not execution.

**14 files in `auros-installer` are `//go:build windows`. Zero test files are.** So
`probe_windows.go`, `env_windows.go`, `nospace_windows.go`, `exec_windows_armed.go`,
`inject_windows.go`, `usn_windows.go` and eight others are compiled by vet and **executed by no
test on any platform.** That includes the code that talks to `SHGetKnownFolderPath`, which
SAFETY.md's INVENTORY phase singles out as the thing a school laptop gets wrong — *"never by
string-concatenating `%USERPROFILE%`"*.

### 4.3 The VM check matrix has never recorded a pass

`auros-base/matrix/checks.yaml` defines **28 checks** — S1–S10 static, B1–B12 boot, U1–U5 update,
R1 restore. `tools/gate.mjs` refuses any digest without a complete, current, unambiguous row for
every one of them, on every bound profile.

There are **zero rows in the ledger.** Gate 1 is not passed: the hardened image builds end to end,
and then **S7 (determinism) fails** — two builds from identical inputs produce different content
digests. The most recent `probe-matrix` run reports "six checks failed".

Consequently `gate.mjs` is very well tested (**241 tests across two files**) as *a program that
refuses things*, and its allow path is exercised only against **synthetic** ledger rows the tests
write themselves — `allows a digest with a complete, current, unambiguous recorded pass`. No real
image has ever qualified, so the gate has never once said yes to something a machine produced.
That is the correct state for it to be in today; it is not the same as the gate being proven
end to end.

### 4.4 Undeclared environment dependencies — measured, one at a time

Running `auros-recipes` in containers with dependencies removed one at a time:

| Environment | Result |
|---|---|
| Fully provisioned Linux (bash 5, python3, jsonschema, pyyaml, git) | **536 pass, 0 fail, 0 skip** |
| macOS (bash 3.2, python3 + deps, git) | 529 pass, 0 fail, **7 skip** |
| Linux, no `python3` | **7 FAIL** — the prune runner refuses to run without it, and the tests report the refusal as a failure rather than skipping |
| Linux, no `git` | **10 FAIL** — the `floor-ratchet` tests shell out to git |
| Linux, no `jsonschema`/`pyyaml` | 3 skip — `parity.test.ts` |

Only one of those five is declared: the `mapfile` guard, which skips loudly and **fails hard in CI**
so the skip cannot become permanent. The other four are discovered by the suite going red or quiet
somewhere new. That is a real gap and it is the reason §1 tells you the environment matters.

`go` is not installed on the operator's Mac at all, so `./verify` prints
`SKIP  go not installed locally — this runs in CI` for the installer, every run, on the machine
where most development happens.

### 4.5 Deferred, or only possible in CI

- **The production signing key** (B10). A development ECDSA P-256 key (D32, fingerprint
  `1495cbe4…2500b`) builds, boots and passes the matrix, and is **refused at the publish step** by
  reading the key kind back out of the image. Nothing has been signed with a key anyone is
  accountable for.
- **A live registry.** Nothing has been published to GHCR under `:hardened`. The D21 upstream-mirror
  mechanism is built and has never mirrored anything a customer depends on.
- **Cross-repo propagation** (Gate 2, B2). `propagate.yml` exists; `repository_dispatch` needs a
  credential `GITHUB_TOKEN` cannot supply (D18), so the scheduled-poll fallback stands and has never
  been timed against the 20-minute window.
- **The nightly rebuild loop** — the thing SPEC §1.1 calls the actual product — has never completed
  a full cycle.
- **Lighthouse ≥ 95 on mobile** (SPEC §6D). The Lighthouse gate and its two mutations exist and run; the
  score on a deployed site is untested because the site is not deployed (B14).
- **The site itself is not published** (B12/B14), so no gate has ever run against a real origin.
- **`replaceable.yml`** is deliberately paused: there is no wind-down handover artefact to execute
  against yet (D31, B12). A CI job that asserts a promise nobody can execute is worse than no job.

### 4.6 The CI runner is not pinned everywhere D23 says it should be

D23 pins runners to `ubuntu-24.04` because `ubuntu-latest` migrates to 26.04 between 2026-10-19 and
2026-11-19, and an OS migration under a build that boots VMs is a week we do not have. It is applied
in `auros-base/unit-tests.yml` and `auros-recipes/pull-request.yml`. It is **not** applied in the
meta repo's `.github/workflows/gates.yml:40` or in any of `auros-installer/ci.yml`'s four jobs
(lines 57, 117, 187, 223), which are all `runs-on: ubuntu-latest`. Every installer test result in
this document therefore rests on a runner image that will change under us on a date we do not
control. (`auros-installer/gate3.yml` is correctly pinned, and its Windows jobs are
`windows-latest` by necessity.)

### 4.7 Not tested because we decided not to build it

- **Writing boot media from Windows** (D13). Dropped. There is no code and therefore no test, and
  that is the point: it removed the single most destructive path in the company.
- **A Chrome/Edge credential decryptor** (D15). Not built. Every published technique is malware
  behaviour.
- **An automated `.exe` compatibility checker** (D16). Not built; there is no WineHQ API and
  building one would mean circumventing an anti-bot control.

---

## 5. The bugs that justify all of this

Four failures in detail, and three more in short at the end. **Every one of them looked fine and
reported success. Not one was found by re-reading.** That is the entire argument for the machinery
in §3.

### 5.1 The SELinux check that was permanently GREEN

`auros-base/build/10-hardening.sh` asserts no kernel argument disables SELinux. It gathered the
effective kargs, normalised whitespace, and matched `^selinux=0$`.

The normalisation was `tr -d '[:space:]'`. That character class includes `\n`. So the newlines were
deleted along with the spaces, every argument collapsed onto **one line**, and a line-anchored
pattern could never match anything again. The check passed on every input, including
`kargs = ["selinux=0"]`.

A security check that cannot fail is worse than no check, because it is also reassuring.

It gets worse, and the worse part is the lesson. That same check had **three** lives:

1. **Permanently RED** first — the pattern matched the explanatory comment in its own kargs file,
   the one documenting that `enforcing=0` at the GRUB prompt is a technician's only recovery path.
2. **Permanently GREEN** — the `tr` bug above.
3. **Permanently GREEN again, differently** — it read `kargs.d/*.toml` **line by line**, so
   `kargs = [` on one line and `"selinux=0"` on the next was invisible. That is valid TOML and bootc
   accepts it. Same shape, different mechanism, found by writing `tests/` *around* the file rather
   than by reading the file. Fixed by joining before splitting on commas, never after (D34).

And a fourth thing, found later: `kargs-check.test.sh` used to extract the helper function from the
shipping script but keep its **own hand-written copy of the caller** — the
`tr … | grep -E '^(selinux=0|enforcing=0)$'` line. A mutation run changed the *shipping* caller back
to the newline-eating original and **every case in the test still passed**, because the copy in the
test file was still correct. The test was green about code nobody runs. Both halves are now
extracted from the shipping file, and the test aborts if the line changes shape.

### 5.2 `grep -c … || echo 0` — the idiom that fails on a perfect image

`grep -c` always prints a count, including `0`, and exits **1** when that count is zero. So
`x=$(grep -c PATTERN file || echo 0)` on the zero case prints the count `0`, sees exit 1, and then
prints `0` again. The variable holds `"0\n0"`, and every integer test that consumes it errors out.

Which checks used it decides how bad this is. The check matrix counted **SELinux denials (B11),
kernel oopses (B11) and compositor crashes (B8)** this way. A clean image has zero of each.

**So B8 and B11 would have failed on every perfect image.** The bug fires on exactly the outcome we
are hoping for. Gate 1 would have sat red on a correct build while somebody debugged a graphics
crash that never happened. The correct idiom is `|| true`, which yields exactly one `0`.

`auros-base/tests/shell-idioms.test.sh` now scans for the idiom **and** proves it really
misbehaves — `[ "$bad" = "$(printf '0\n0')" ]` — so the test is defending a measured bug rather
than a style preference.

### 5.3 `verify` reported PASS on failing suites (D37)

The aggregate gate — the one whose whole job is to be the thing you trust when you are not reading
every suite yourself — ran two of its gates as:

```bash
run "…" bash -c 'cd auros-recipes && (pnpm test 2>&1 | tail -30)'
```

`set -o pipefail` at the top of `verify` applies to *that* shell. `bash -c '…'` starts a **new**
shell with default options. So the pipeline's exit status was `tail`'s, which is always 0, and
`verify` reported **PASS for the recipe suite and the site build whatever their real state was** —
as did the `gates` CI workflow, which calls exactly this script.

The author of that line had found the identical bug in the boot probe that same morning, written it
up as **D19** ("a step that cannot fail is not a check"), and made `set -o pipefail` a standing rule
across every Auros workflow. Then wrote it into the aggregate gate, hours later.

Some green `verify` results reported earlier that day were not evidence for those two suites. Both
were re-run directly and passed, so nothing shipped behind a false green — **but that is luck, not
the gate working.**

The lesson is sharper than D19's, and it is the reason §3 exists: **knowing a rule is not the same
as having applied it everywhere.** What protects against that is not the rule. It is a test that
breaks the thing on purpose and watches the aggregate go red. `tools/verify-meta.test.mjs` is that
test, it found this, and until it existed nobody had ever watched `verify` fail.

### 5.4 Guards whose own canaries came back clean

Two, on the same day, both reporting "clean" while the bug was present.

**Anchored at line start.** `verify-meta.test.mjs` asserts every gate `verify` runs has a
propagation case. It found them with `/^\s*run "…"/`. But `verify` writes several gates as
`if [ -f … ]; then run "…" …` — all on one line — so an anchored pattern **silently missed three of
them**, and the guard said "every gate is covered" while three gates could have been added and gone
for ever without a case. The pattern is now
`/(?:^|;|\bthen\b|\belse\b|&&)\s*run\s+"([^"]+)"/gm`.

**Stopped at `|`.** The first attempt to fix the `grep -c` idiom (§5.2) used a regex that stopped at
a pipe character, which skipped every `grep` whose pattern contained an alternation. The *check*
written afterwards to confirm the fix used the **same regex**, and reported "none left" while three
remained. `shell-idioms.test.sh` now uses a plain substring test and says why in a comment: *a check
that shares the bug it is looking for cannot find it.*

**A third of the same family, still live and worth knowing:** `worker/package.json`'s own `test`
script was `node --test test/`. On Node 22 that resolves `test/` as a **module path** and dies with
`MODULE_NOT_FOUND` before a single test executes. **Every test in the Worker was unreachable by its
own package script** — 233 of them when it was found, 244 today — including
`schema-provenance.test.js`. Nothing else ran them either: `auros-web` has one
workflow and it snapshots the build console, `pnpm build` runs the terrain and a11y tests and not
these, and `./verify` did not mention the Worker at all. The glob is load-bearing:
`node --test 'test/*.test.js'`. **The same trap is in this document's own task description** — `node
--test tools/` fails the identical way in the meta repo, which is why §1 spells out the loop.

### 5.5 The through-line

Re-reading found none of these. Every one of them had the same surface: a green line, a passing
suite, a PASS in a summary. A bug that announces itself is cheap. These are the other kind, and the
only thing that catches them is a mechanism that **breaks the thing on purpose and requires it to
go red** — the direction audit in §2.2, and the five harnesses in §3.

Two of them are worse than a bug, and this is the part to carry: §5.1 and §5.3 were both written by
somebody who had just written the rule down. The SELinux check was fixed once and reintroduced the
same shape twice. `verify` got D19's bug hours after D19 was recorded, by D19's author, in the one
place where being wrong would hide everything else. **A rule in a document is not a control.** The
control is a harness that reintroduces the bug and demands red.

Three more from the same campaign, kept short because they are the same shape:

- **`build/90-cleanup.sh`'s `check_one()` ended in `*) return 0`**, so a typo in the KIND column of
  `hardening/protected.list` printed `PROTECTED ok` for a row that checked nothing. The protected
  set — the thing that makes an unpatchable machine unshippable — was one typo away from silently
  weaker. An unknown kind is now fatal.
- **`build/40-windows-feel.sh` asserted double-click with `grep -qx 'SingleClick=false'`.**
  `kdeglobals` is INI and KConfig reads that key from `[KDE]` only, so the key under any other group
  passed the check while the machine still opened files on one click. Now group-aware.
- **`govulncheck` had been in `auros-installer/ci.yml` from the start and had never executed** — the
  action installs a version needing Go 1.26 while the workflow pinned Go 1.23, so the step failed
  before scanning anything, inside a job already red for other reasons. Once it ran it found
  **GO-2026-4602, a path escape in `os` reached through the phase-1 folder walk** — the inventory of
  a user's files. The step now requires a positive "No vulnerabilities found" signal rather than the
  absence of an error (D35).

---

## 6. Right now, this tree is red — and that is the honest reading

`./verify` was run twice, forty minutes apart, while other agents were landing commits.

|  | frozen snapshot, commit `0a1aad5` + 3 dirty | live tree, 40 min later |
|---|---|---|
| gates run | 26 | 28 |
| result | **18 pass · 7 fail · 1 skip**, exit 1 | **24 pass · 3 fail · 1 skip**, exit 1 |

Four of the seven failures in the first run were gone by the second, because the gates worked and
somebody fixed what they named. That is the right way to read the difference, and it is also why a
single `./verify` number is not a property of this codebase — the caveat at the top of this
document, restated with evidence.

**The four that were fixed between the two runs:** the honesty gate, the honesty regressions and
the cross-file check all failed because `CLAIMS.md` recorded that it had been reviewed against
**D35** while `DECISIONS.md` stood at **D37** — two decisions landed and nobody re-read the claims
against them, which is precisely the D30/D31 shape the check was built for. The fourth was
`publish gate refusals`, 13 subtests on `matrix_version` shape, failing against an uncommitted
mid-edit `tools/gate.mjs`.

**The three that remain, as of the live run:**

| Gate | Why |
|---|---|
| `workflow lint` | 4 real problems across 37 workflows. `auros-base/build.yml:559` and `auros-installer/gate3.yml` build a matrix from `fromJSON()` with **no fallback**. If the expression yields an empty list, null, or a non-array, GitHub *rejects the workflow at startup*: zero jobs, the run listed by file path, and `--log-failed` shows nothing because nothing ran. This rule was added in commit `3b615d7` after that exact failure was observed; the two workflows it names have not been fixed. |
| `workflow lint, both directions` | The linter's own suite, failing on the same four. |
| `verify propagates every failure (meta)` | Two separate causes, below. |

The meta-test's failure is the most instructive thing in this document, so it gets spelled out.

**Cause 1 — gates added to `verify` without a propagation case.** The structural assertion says it
plainly:

```
these gates are run by verify but no case here proves that their failure reaches verify's
exit status: "no-JS path: argument survives, mailto reachable (spec §6D)",
"no framework, no blocking script, JS budget (spec §6D)".
Add a case to CASES with a green and a red population.
Do not delete this assertion — it is the only thing keeping the list current.
```

Earlier the same day, commit `804950d` did the same thing with a `licence consistency (README vs
LICENSE)` gate: added to `verify`, no case in `verify-meta.test.mjs`. Every sandbox then ran a gate
it could not satisfy, and **21 GREEN cases failed at once.** Both were caught within one commit by
the assertion above. **Without it, a new gate could be added to `verify`, report PASS for ever, and
nothing would notice** — which is D37 with the numbers changed.

**Cause 2 — a fix for one gate silently disarmed the proof for another, and it is the most
safety-critical one.** Four sandbox cases fail with:

```
EEXIST: file already exists,
        symlink '/Users/aaroh/auros/auros-base' -> '/var/.../auros-verify-meta-qlkbct/s-6/auros-base'
        at Object.link (tools/verify-meta.test.mjs:132:32)
```

Tracing it: the `licence consistency` gate is deliberately unconditional and fails closed
(`checked 0 repos` exits 2), because *a public repository that states no terms is the defect it
exists to catch*. Correct. To let sandboxes satisfy it, `sandbox()` now creates five real
directories — `.`, `auros-base`, `auros-recipes`, `auros-installer`, `auros-web` — each with a
`LICENSE` and a `README.md`. But the two cases that exercise the **§4.3 publish gate** call
`.link('.claude', 'auros-base')`, and `link()` is a bare `symlinkSync`. The directory is already
there, so it throws.

The consequence is not cosmetic. `RED: publish gate`, `GREEN: publish gate`,
`RED: publish gate refusals` and `GREEN: publish gate refusals` all fail in setup, which means
**there is currently no proof that a failure of the publish gate reaches `verify`'s exit status —
in either direction.** That is the gate enforcing SPEC §4.3, *never publish an image that has not
booted in a VM and passed the full check matrix*. The gate's own 241 tests pass; what is unproven
is that the aggregate everybody reads would go red if it did not. Commit `0df29e4` — *"R8:
verify-meta cannot prove the §4.3 publish gate propagates"* — is somebody already on it.

The shape is familiar enough to be the fifth entry in §5: **a correct fix to one check made another
check stop being a check, and both files still looked right.**

**Elsewhere, as of 2026-09-21 01:22 UTC:** the `gates`, `unit-tests` and `gate3` CI workflows were
all red. `gate3` has never produced a passing matrix at all (§4.2).

**A document that reported this tree as green would be the exact failure it is about.**

---

## 7. How to add a test here

**The standard is one sentence: a test must have a demonstrated red state, and you must have watched
it.**

Not "it would fail if…". Not a reviewer agreeing it looks right. You break the thing on purpose,
you run the test, you see red, you put it back, you see green. If you cannot make it go red, you
have not written a check — you have written decoration, and decoration in a test file is worse than
an empty file because it is reassuring.

Concretely:

1. **Write the assertion.**
2. **Break the code it watches** — not the test, the code. Run it. It must fail, and the failure
   message must *name what is wrong* and *print what IS there*. `expected true, got false` is not
   good enough; `expected [uefi-sb] got [uefi]` is.
3. **Put the code back.** Run it. It must pass.
4. **Record the mutation** in the harness that owns that component, so step 2 happens again for
   free every time somebody else changes the code:
   - `auros-base/tests/prove-red.sh`
   - `auros-recipes/scripts/prove-red.mjs` (or `prove-red-differ.mjs` for the differ)
   - `auros-web/tools/prove-red.mjs`
   - `tools/verify-meta.test.mjs` — **required** for every new line in `./verify`. The
     structural test fails if you skip it, which is how §6's last row got found.
   - There is no harness yet for `auros-installer`, `auros-web/worker` or
     `auros-recipes/schema/*.py`. Adding one is worth more than adding tests to them (§3.6).
5. **If a check genuinely has only one direction, say so out loud.** `auros-base` has
   `t_exempt <id> <reason>`, and the reason is printed on every run. An exemption in the open is
   fine. A one-directional check that nobody declared is what §5.1 looks like.

**A worked example, done while writing this document.** `auros-web/src/terrain/terrain.test.ts`
defines its own `test()` collector instead of importing `node:test`, so `node --test` sees one test
where there are 27 (§2.4). That is exactly the shape of a suite that reports success without
gating anything, so it does not get the benefit of the doubt:

```bash
# 1. break it on purpose — one assertion, in the code the test watches
#    (here: inject `ok(false, "MUTATION")` into "ore is under 2% of pixels")
node --experimental-strip-types --test src/terrain/terrain.test.ts; echo $?   # → 1   RED
# 2. put it back
node --experimental-strip-types --test src/terrain/terrain.test.ts; echo $?   # → 0   GREEN
```

Exit 1 then exit 0. Now the 27 are evidence. Before that they were a number in a log.

**`prove-red.mjs` has a `--baseline` mode** that applies a mutation against the suite *as it stood
at git HEAD* and reports whether it survived. That is how each row in that harness was shown to be
a real hole **before** the test closing it was written — which is the difference between a
regression test and a test written to match code that already passes it.

Three rules that came from real damage:

- **Never guess a path, unit name or flag.** Four build cycles of roughly fifty minutes each were
  lost to a remembered greenboot layout and a CLI that did not exist. Read the artifact, or probe
  it. When an assertion fails, it must print what IS there.
- **`set -o pipefail`, always — and remember `bash -c` does not inherit it** (D19, D37). Use
  `bash -euo pipefail -c`.
- **Do not widen a rule to make a finding disappear.** If a finding is genuinely fine, annotate the
  line (`auros-allow: <reason>`) so it shows up in the diff. Both the honesty gate and the installer
  CI's abort-ratio check say this in their own failure output, because widening is the easy move and
  it silently converts a gate into decoration.
