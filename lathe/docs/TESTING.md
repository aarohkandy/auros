# AUROS — TESTING

> What is tested, how well, and what is not. Every number below came from a run made for this
> revision, and the command is printed next to it. Where a number comes from somebody else's
> earlier run and was not repeated, it says so. If a number here looks flattering, check it.

**Measured 2026-09-20, evening PDT.** Meta repo at commit `b4edec2` with a clean working tree.
`auros-base` had five files left uncommitted by another agent that was still editing
(`tests/10-hardening.test.sh`, `tests/capture-compat.test.sh`, `tests/prove-red.sh`,
`tools/capture-compat.sh`, `tools/quote-from-compat.mjs`), so its numbers describe that
in-progress tree.

**Where things ran.** Two places:

- **The operator's Mac**: macOS, bash 3.2.57, Node 22.23.1, no Go, no bash 4, no container runtime.
- **The `homebase` Linux box**: Ubuntu 24.04, bash 5.2.21, Node 22.23.2, Python 3.12.3. Go ran
  in the `golang:1.25.14-alpine` image that was already cached there, with `--network none`, so
  nothing was downloaded. It ran as uid 1000, not root, so tests that depend on file permissions
  really executed. The scratch copy was deleted afterwards.

**One caveat before the numbers.** Other agents were committing to these repos the whole time,
and the suites grew while they were being measured. For example, `tools/*.test.mjs` went from
334 tests to 473 in about an hour. Per-suite numbers are accurate for the moment they were
taken. `./verify`'s aggregate is not a fixed property of the codebase, because it moves every
time somebody fixes what a gate named.

```bash
# Reproduce everything below
cd auros-recipes && pnpm test && python3 schema/refusals.test.py
cd auros-recipes && node scripts/prove-red.mjs && node scripts/prove-red-differ.mjs
bash auros-base/tests/run-all.sh && bash auros-base/tests/prove-red.sh
node --test auros-base/tools/quote-from-compat.test.mjs
cd auros-web/worker && node --test 'test/*.test.js'     # the glob is required, see §4
cd auros-web && node tools/prove-red.mjs                 # --quick skips the two Chrome runs
cd auros-installer && gofmt -l . && go vet ./... && go test ./... -race -count=1
cd auros-installer/testharness && go vet ./... && go test ./... -count=1
for f in tools/*.test.mjs; do node --test "$f"; done     # `node --test tools/` fails on Node 22
./verify
```

---

## What is covered

The components count tests in different units, and the units cannot be added together. In
`auros-base`, a bash "assertion" is one `ok` line. In Go, a "test" is one `func Test`. In Node, a
"test" is one `test()` call. **This document gives no grand total, because no honest one exists.**

### auros-recipes: the recipe toolchain (validate / compile / explain / prune)

| Suite | Count | Result |
|---|---|---|
| `pnpm test` (18 files), **Linux** (homebase) | **536** | **536 pass · 0 fail · 0 skip** |
| same, **macOS** | 536 | 529 pass · 0 fail · **7 skip** (bash 3.2 has no `mapfile`) |
| `python3 schema/refusals.test.py` | 65 refusals + 3 valid recipes | OK on both machines |

```
refusals.test.ts     277    adversarial.test.ts   29    prune.test.ts        27
compile.test.ts       26    explain.test.ts       25    cli.test.ts          22
differ.test.ts        22    yaml.test.ts          21    determinism.test.ts  14
golden.test.ts        14    happy.test.ts         12    recipe.test.ts        9
workflows.test.ts      9    catalogue.test.ts      8    compare-images.test.ts 8
licence.test.ts        6    schema-strict.test.ts  4    parity.test.ts        3
```

What the tests assert, as opposed to what their names suggest:

- **`refusals.test.ts` (277)** is the largest body of tests in the company, and nearly all of it
  is negative. It covers every way a `recipe.yaml` can try to change the `FROM` line, pin a
  version, reach a reserved key under another spelling or inside an unknown block, lower the
  removal floor without a stated reason, or name hardware a human marked unsupported. Spec §6B
  says the rejection is the feature, and this file is that rejection spelled out case by case.
- **`prune.test.ts` (27)** is the only suite that **runs the shipped prune runner**, against stub
  `rpm` and `dnf`, instead of string-matching it. 7 of its 27 tests need bash 4 or later plus
  `python3`, and those 7 are the only thing that catches mutations P04–P08 (next section). On the
  operator's Mac they skip. The skip is announced (`# SKIPPED (local)`), and the same guard fails
  hard in CI, so the skip cannot quietly become permanent.
- **`determinism.test.ts` (14)** builds the same recipe twice in one run and compares the results.
  This is the property spec §6B settled on: same recipe plus same pinned base digest gives the same
  content digest. It was hardened today after shuffling every list in a recipe 100 times found
  that `windows_apps.tested` changed the Containerfile when two rows were swapped.
- **`adversarial.test.ts` (29)** runs `scripts/floor-ratchet.mjs` against real git fixtures. It
  covers lowering the floor by one, a permission slip with no `REASON=`, a merge-base that cannot
  be resolved (must exit 2, not 0), and a run that checked no fleets at all (must exit 2).
- **`parity.test.ts` (3)** checks that the TypeScript/ajv validator and the Python/jsonschema
  validator give the same verdict. It covers about 28 cases, **not** the 277. The claim that "two
  independent validators agree" holds only for that cross-section.
- **`licence.test.ts` (6)** searches this one repository for text that grants redistribution
  rights. It also asserts `package.json` declares a non-permissive licence and `private: true`.

### auros-base: the image build scripts

`bash tests/run-all.sh` ran **14 suites, 1,002 assertions, 14/14 green on macOS.**

```
30-update-agent.test.sh     180     10-hardening.test.sh    152
capture-compat.test.sh      132     00-common.test.sh       107
update-agent/run-tests.sh    89     40-windows-feel.test.sh  86
20-policy.test.sh            85     90-cleanup.test.sh       71
kargs-check.test.sh          28     policy/assert-lib        26
desktop/b12-modes            18     policy/policy-lib        10
shell-idioms.test.sh          9     units.test.sh             9
```

There is also `tools/quote-from-compat.test.mjs`, with **62 tests, all passing**. `run-all.sh`
does not run it; `./verify` does.

The mechanism worth knowing about is the **direction audit** in `tests/lib/harness.sh`. For each
check id, it records whether the check was seen passing **and** seen failing, and it fails the
whole suite if any check was only ever seen one way. An exemption needs
`t_exempt <id> <reason>`, and the reason is printed on every run.

**The suites test logic, not tools.** `chown`, offline `systemctl`, `visudo`, `dnf`, `rpm` and
`firewall-cmd` are all stubbed. On macOS the harness supplies a GNU `sed -i` shim, and every
suite header says so.

### auros-installer: the Windows migration tool (Go)

Static: **334** `func Test`, **4** `func Fuzz`, **34** test files.

Executed today on homebase (offline container, uid 1000):

| Module | Top-level tests | Including subtests | Skip | Fail |
|---|---|---|---|---|
| root (`internal/…`, `cmd/…`) | 238 pass | **539 pass** | 0 | 0 |
| `testharness/` | 100 pass | **112 pass** | 0 | 0 |

`gofmt -l .` printed nothing. `go vet ./...` is clean for `linux/amd64` and for `GOOS=windows`.
**`-race` was not run**: the alpine image has no C compiler, and `-race` needs cgo. CI runs
`go test ./... -race -count=1 -v`, so a data race would show up only there.

This run includes the 74 installer tests added earlier today. The agent that wrote them had no
Go available and never saw one pass or fail. They pass here, offline, as a non-root user, which
means the 4 permission tests that skip as root also ran.

The abort path is tested more than the happy path. CI's own pattern, run here, matches **222 of
334** distinct test names (66%), and CI fails if that drops below half. Be clear about what this
measures: **it matches names**. A test called `…Refuses…` counts whatever it asserts. It is a
floor on intent, not proof of what the tests check.

What the suite protects:

- **`internal/safety`**, the wall. `TestWall_ForbiddenImports` parses the import graph and fails
  if any package outside `internal/safety` can reach the system disk. `forge_test.go` scans the
  source to show that `valid:` is set in exactly one composite literal in the whole program. The
  `unsafe` forgery route cannot be tested at runtime, because the wall forbids `unsafe` in the
  package that would have to do the forging. So it is a static check, and the document says so.
- **`internal/copyengine`** is the 55-second package, doing real I/O. It covers disk full,
  hostile names, locked files, resume, 18,000 files, 8 MiB through a 13-byte buffer, cancellation
  at every file boundary, and two concurrent runs on one destination.
- **`internal/manifest`** includes exhaustive property tests and 4 fuzz targets (see the next
  section for what the fuzzer found).

### auros-web: the site and the order Worker

| Suite | Count | Result |
|---|---|---|
| `worker/test/*.test.js` (11 files) | **244** | 244 pass |
| `tools/configurator-a11y.test.mjs` | 16 | pass |
| `tools/build-console.test.mjs` | 15 | pass |
| `src/terrain/terrain.test.ts` | 27 (reported as **1**) | pass |

`worker/test/schema-provenance.test.js` is only two tests, but it matters most. It asserts that
the Worker validates orders against a schema **byte-identical** to the one `auros-recipes` uses in
CI. That identity is what backs the sentence a refused visitor sees.

`terrain.test.ts` has its own `test()` collector, so `node --test` reports **one** test where
there are 27. This was checked earlier by breaking one of its assertions: the exit code went to 1,
then back to 0 when restored. So the 27 do gate the build. But anyone counting from the runner's
output undercounts this file by 26.

### Meta repo: the gates (`tools/`) and `./verify`

**8 files, 473 tests. 467 pass, 6 fail.**

| File | Tests | Result | What it asserts |
|---|---|---|---|
| `gate.refusals.test.mjs` | 165 | pass | The §4.3 publish gate against a real filesystem: line endings, padding, symlinked ledger, FIFO ledger, mode-000 ledger, `matrix_version` shape, every required check removed one at a time, both sides of every count boundary, one malformed row poisoning the whole ledger. No flag or env var turns a refusal into an allow. |
| `gate.test.mjs` | 76 | pass | The core refusal list (a digest with no complete, current, unambiguous row is refused) and the PreToolUse hook's publish shapes. |
| `honesty-gate.corpus.test.mjs` | 66 | pass | About 45 realistic marketing sentences: half must trip the gate and half must not. The half that must not trip is the expensive half, because a gate with false positives gets annotated past. |
| `verify-meta.test.mjs` | 59 | **5 fail** | A mutation harness for `verify`, covered below. |
| `compat-lint.test.mjs` | 37 | pass | Both directions on `hardware/compat.tsv`. |
| `honesty-regressions.test.mjs` | 31 | pass | One named test for each fatal or major finding in the 2026-09-20 honesty audit. |
| `workflow-lint.test.mjs` | 30 | **1 fail** | Both directions on the workflow linter, plus a run over the real workflows. |
| `honesty-gate.crossfile.test.mjs` | 9 | pass | A cited workflow's real triggers, and whether `CLAIMS.md` has been re-read since the latest decision. |

The suites added today pair each rejection with a control: the same input without the one
defect, which must be **accepted**. That way a tool that always says no cannot pass.

**`./verify` today: 24 passed · 3 failed · 1 skipped, exit 1.** The skip is the Go suite, because
there is no Go on the Mac. The three failures are covered under *What is NOT tested*. They are
real, and a document that called this tree green would be committing the exact failure it is
about.

---

## Mutation score

Mutation testing here means: put a **specific, named bug** into a scratch copy, run the suite
that should notice, and require it to go red **for the stated reason**. If the suite goes red for
some unrelated reason, that counts as a miss, because a suite that fails for the wrong reason will
not tell the next person what broke.

**Two different measurements exist, and mixing them up would make the whole section a lie:**

1. **Independent campaigns.** Someone who did not write the tests invents plausible bugs and
   counts how many survive. This is the only real estimate of how strong a suite is. Three were
   run today.
2. **In-tree harnesses** (`prove-red.sh`, `prove-red.mjs`, …). These are regression locks. A
   mutation usually gets into the harness *after* the test that kills it exists, so **these score
   close to 100% by construction.** A 61/61 here means the known holes stay closed. It does not
   mean the suite catches 100% of bugs.

### Independent campaigns: the real scores

| Component | Tried | Caught | Survived | Score at the time | Status of the named survivors now |
|---|---|---|---|---|---|
| `auros-recipes` (src + floor-ratchet), 433-test baseline | 76 | 41 by a behavioural test, +8 only by the golden byte-compare | 27 (3 equivalent mutants excluded) | **54%** (65% counting golden-only catches) | All named survivors now have tests and entries in `prove-red.mjs`. **32/32 caught on Linux.** Spot-checked V31 myself (see below) |
| `tools/gate.mjs` (§4.3 publish gate), 334-test baseline | 50 | 32 | 18 (16 fail-open, 2 diagnostic-only) | **64%** | **I re-ran all 18 today against the 241-test suite, with a clean control: 18/18 caught**, each by a test named for the behaviour |
| `auros-base` build scripts, 13-suite baseline | 56 | 23 | 33 | **41%** | The named survivors now make up most of `prove-red.sh`'s 61 mutations: **61/61 caught** |
| `auros-installer` (Go) | **0** | — | — | **never mutation-tested** | see below |
| `auros-web/worker` | **0** | — | — | **never mutation-tested** | — |
| `auros-recipes/schema/*.py` | **0** | — | — | **never mutation-tested** | — |

**Every component that got an independent campaign failed the 80% bar on the first try.** That
is the most important sentence in this section. All three suites were green, and all three had authors who
thought they were thorough. Their real scores were 41%, 54% and 64%.

The survivors had a pattern, and the pattern is more useful than the scores:

- **The check's own correctness was assumed, not demonstrated.** Examples: the column index into
  `compat.tsv` (V28 read the webcam column as the verdict), a regex anchor (M10 accepted `1.0` as
  matrix version 1), a bash pipeline (P04 is the SELinux newline collapse, sitting in the shipped
  prune runner), a default value (R03 gave terminal access to a recipe with no desktop block).
- **Boundaries were tested on one side only.** A declared check count that was too low was
  tested, but never one that was too high (M35). "Fewer profiles than declared" was tested, but
  never "more" (M32). Lowering the floor by one was never tested (V30, F01).
- **Every "incomplete set" test dropped the LAST element.** So with S1 (the *first* required
  check) removed, the gate published a 27-of-28 partial pass (M36).
- **Fail-closed guards had no tests.** The CLI catch-all could return 0 (M42). `floor-ratchet`
  could report a pass after checking zero fleets (F05), or exit 0 on a shallow clone (F06).
- **Golden-file comparisons are not tests of behaviour.** Eight recipe mutations, including the
  SELinux newline collapse and a refusal changed to `exit 0`, were caught **only** by the
  byte-for-byte Containerfile comparison. That comparison's failure message tells you to
  regenerate the golden file. **When the goldens were regenerated from the mutated compiler, 8 of
  the 11 mutations that involved goldens went green.** A golden file catches a change, not a bug.
- **The worst one, in `auros-base`**: the independent campaign found that the SELinux
  newline-collapse bug could be put back into the **shipping** line of `build/10-hardening.sh`
  and every suite stayed green. `kargs-check.test.sh` had extracted the helper function but then
  run its *own hand-copied* caller line. It is fixed now: both halves are extracted from the
  shipping file, the test aborts if the line changes shape, and `prove-red.sh` mutates the
  shipping line.

**What the suites were genuinely good at:** refusals that a customer sees. In the recipe schema,
deleting a refusal broke 36 or 28 tests at once. Command substitution in free text, the
reserved-key families, font coverage for named scripts, CLI exit codes, YAML duplicate keys, and
the non-canonical `schema: 1.0` rule were all caught fast, by tests named for the behaviour.
**The principle held wherever tests were written against refusals. It failed wherever a check was
trusted without being watched fail.**

**Two spot-checks I ran myself** on the closed survivors, so this table is not just passing along
someone else's report:

- **V31** (the floor lock accepts a permission slip with no `REASON=`): I dropped
  `&& reason !== ''` from `src/validate.ts:573` in a scratch copy. The suite went **536 → 1
  failing**, at `cli.test.ts:264` *"a lock that grants permission but states no reason does not
  grant permission"*, with the message "the floor fell from 240 to 235 with no stated reason".
  So it is closed.
- **All 18 gate survivors** (M01, M08, M09, M10, M15, M18, M19, M20, M22, M23, M25, M32, M35,
  M36, M38, M40, M42, M44), each applied as an exact one-match string edit to a fresh copy. **My
  first run was contaminated.** The scratch copy lacked `.claude/`, so the unmutated control
  already had 16 failing hook tests, and every mutation would have looked "caught". Only the
  control run exposed that. On the re-run the control was green (0 failures) and **all 18 turned
  the suite red, each with a named test**: `a skipped check is a failed check — every id in the
  matrix, individually`, `REFUSES an image in an org whose name merely STARTS WITH ours`, `the CLI
  fails CLOSED when the gate itself fails`, and so on. Harness:
  `scratchpad/testdoc-verify/gate/run.py`, results in `results.json`.

**What I did NOT do**: run a *new* independent campaign. The named holes are closed. But no one
has measured the suites' **current** score against bugs no one has thought of yet. That is the
next number worth producing, and nobody should read "61/61" or "18/18" as if it were that number.

### In-tree harnesses: regression locks, measured today

| Harness | Result |
|---|---|
| `auros-base/tests/prove-red.sh` | **61/61 caught**, each by the suite that owns it. Includes two mutations of the harness itself: an extraction that stops matching must make the suite *abort*, and a check exercised in only one direction must fail the direction audit. |
| `auros-recipes/scripts/prove-red.mjs` | **32/32 on Linux · 27/32 on macOS.** The 5 misses are P04–P08, the prune-runner bugs, and every one is owned by a test that skips without bash 4. It reports them correctly: `NOT CAUGHT P04 THE SELINUX BUG, in the shipped runner`. |
| `auros-recipes/scripts/prove-red-differ.mjs` | **7/7** on both machines. |
| `auros-web/tools/prove-red.mjs --quick` | **13/13**, plus green controls. The two Lighthouse mutations need Chrome and were skipped with `--quick`. |
| `tools/verify-meta.test.mjs` | 59 tests: for each gate `verify` runs, one sandbox where the gate is broken (verify must exit non-zero) and one where it is whole (verify must not). **Currently 5 failing**, see below. |

**On the operator's own Mac, the recipe suite is green while its mutation harness reports that
five of the worst bugs in the repository would ship.** The green result and the hole are the same
fact, seen twice.

### The installer: fuzzing found a bug in 1.4 seconds

The Go code has never been mutation-tested. It is the most dangerous code in the company: it runs
on a stranger's ten-year-old laptop, against the only copy of somebody's work. I ran its four fuzz
targets today, which nobody had done before:

| Target | Time | Execs | Result |
|---|---|---|---|
| `FuzzManifestBody` | **1.4 s** | — | **FAIL** |
| `FuzzManifestRead` | 60 s | 8.9 M | pass |
| `FuzzPathSanitiser` | 60 s | 4.5 M | pass |
| `FuzzUnsanitize` | 60 s | 7.1 M | pass |

```
an accepted manifest does not re-serialise to itself, so two byte sequences describe one archive under two digests
  in:  "…\t1\t0\t0\t\x18\nend\t1\t1\t19db07d2…"
  out: "…\t1\t0\t0\t%18\nend\t1\t1\t0e5283d0…"
```

`manifest.Read` **accepts a raw control byte (0x18) in a path**, but `Bytes()` writes that byte as
`%18`. So the parser is looser than the writer, and one archive can carry two digests. The
installer campaign had already recorded that the format is not canonical, with three causes: a
leading zero, a leading `+`, and a non-minimal `%41`. The fuzz test's own comment lists those
three. **This is a fourth cause, and neither the comment nor the Python model it was checked
against had predicted it.** As that campaign concluded, this is not data loss, because phase 5
verifies against entries, not the digest. But `Manifest.Digest()` is documented as identifying
"one exact archive", and it does not.

**Why nobody saw it: CI never fuzzes.** `ci.yml` runs `go test`, which only replays each target's
seed corpus. The target was written to find exactly this, and it had never been given the chance.
The crasher is saved at
`scratchpad/testdoc-verify/fuzz/df9baae52481f772`. I did **not** add it to
`internal/manifest/testdata/`, because that would turn installer CI red in a repo other agents are
committing to. That call belongs to whoever owns the fix. The fix is a strict round-trip check in
`parseEntryLine`: refuse any line whose re-rendering differs from its input.

---

## What is NOT tested, and why

### Nothing has touched real hardware

`hardware/compat.tsv` has **a header and zero data rows.** `attest/passed-digests.tsv` has **a
header and zero recorded passes.** No laptop has been imaged, and no physical machine has booted an
Auros image. Gate 5 is blocked on three donated laptops that are not in hand (B5). All of these
remain untestable until then: BitLocker suspension, `BootNext`, real suspend/resume, brightness
keys, wifi on real chipsets, trackpads, and whether a 4 GB 2012 laptop is *usable* rather than
merely bootable. The honesty gate forbids the site from claiming hands-on experience until
`compat.tsv` has physical rows. That is a build failure, not a promise.

### Nothing here builds, boots or updates an image

- Every `auros-recipes` assertion is about **Containerfile text**. None produces an OCI image,
  runs a `dnf` transaction or boots anything. Post-conditions P1–P6 are asserted as shapes, never
  as results.
- `must_remove_at_least` is checked against the build's **measured** removal count, and nothing
  in this repository measures anything. So the floor itself is still unexercised. The tests only
  prove that the plan alone does not meet it, which is what keeps the check from being vacuous.
- The `auros-base` tests prove that **the assertions deciding whether an image ships can say
  no.** They do not prove that SELinux enforces on a booted machine, that a bad image rolls back
  (U3), or that sshd is unreachable. The only proof of those is the QEMU matrix (U1–U5, B1–B12),
  and there is no podman or QEMU on the Mac.
- **The VM check matrix has never recorded a pass.** Gate 1 is not passed: the hardened image
  builds, then S7 (determinism) fails. `gate.mjs` is very well tested as *a program that refuses
  things* (241 tests, 18/18 re-verified above). But its allow path has only ever run on synthetic
  rows the tests write themselves. **It has never said yes to anything a machine produced.**
- **B17: the ledger is an unsigned TSV.** A row typed by hand and a row written after a real VM
  boot are the same evidence to `gate.mjs`. The gate's tests prove it parses the ledger strictly.
  Nothing proves a row came from a run. **B16**: the PreToolUse hook is installed for `Bash` only,
  so a `Write` to the ledger is not intercepted. (A separate **B16 FATAL** in BLOCKED.md: the only
  code path that moves the upstream pin does not exist, so the nightly rebuild cannot actually
  pick up a patched upstream.)

### The Windows tool has never run on Windows

- **Gate 3 is 0/100 and 0/20, not 100/100.** No `gate3` matrix run has ever passed.
- **14 files in `auros-installer` are `//go:build windows`, and none of the test files are.**
  `GOOS=windows go vet` compiles them, and no test on any platform runs them. That includes the
  `SHGetKnownFolderPath` code, which SAFETY.md's inventory phase singles out as the thing school
  laptops get wrong.
- Real NTFS junctions, reparse points, alternate data streams, OneDrive
  `RECALL_ON_DATA_ACCESS` placeholders, `MAX_PATH`, BitLocker, `manage-bde` and `bcdedit` are all
  unreachable here. POSIX symlinks stand in for junctions. An ADS is tested only as a filename
  shape. `MAX_PATH` is tested as a string length, not as an API limit.
- `internal/sysdisk`'s real implementation is behind `-tags auros_arm_enabled` and compiled out of
  every ordinary build. So the arm tests exercise **the plan and the refusals, never the actions
  or their reversals**, and SAFETY.md's "the reversal is tested more than the action" is untested
  for the actions themselves.

### Known safety gaps in the installer, documented and NOT fixed

These are written as tests of the behaviour **as it is**, so a fix turns them red on purpose:

- **`safety.Arm` never re-checks that the second copy still exists.** There is no
  `Destination.Reassert()` between `Verify` (`main.go:255`) and `Arm` (`main.go:288`). A USB
  stick pulled after verification and before the reboot goes unnoticed. The tool suspends
  BitLocker, points the firmware at the install media and restarts, and the user boots a machine
  whose only backup is gone. `TestArm_DoesNotRecheckThatTheSecondCopyIsStillThere` records this.
  **Of everything in this section, this is the one I would fix first.**
- **`writeManifest` uses a fixed `path + ".tmp"`.** Two runs sharing one destination race on it.
  The trailer digest makes the result *detectable*, not silent, and that is what the test asserts.
- **`Result.Cancelled` is false for a cancellation during `plan()`** and true for every later one,
  so the user-facing summary differs between the two cases.
- **The manifest format is not canonical** (four known causes, one of them found by the fuzzer
  today).

### Things only CI can run, and CI is not running them cleanly

- **`go test -race`** runs only in CI. It was not reproduced here (no C compiler in the image).
  `TestCopy_EighteenThousandFiles` is guarded by `testing.Short()`, CI runs without `-short`, and
  Go's per-package timeout is 10 minutes. If `internal/copyengine` times out under `-race`, that is
  the first place to look.
- **Fuzzing runs nowhere in CI** (see above).
- **`auros-base/.github/workflows/unit-tests.yml`** was written today and I have not seen it run.
  An earlier run (`35549997994`, reported and not repeated here) had `capture-compat.test.sh` at
  106 pass / 1 fail on ubuntu-24.04 while it passed on macOS. `capture-compat`'s end-to-end lint
  assertion is **exempted in CI** with a printed reason, because `hardware/compat.tsv` lives in
  the meta repo (D6). So a check that passes locally does not exist in the one place that gates a
  merge.
- **`build-recipe.yml`'s publish-gate path** was fixed today and checked **statically** only (the
  gate path now resolves to a real file). It has never run on a runner, and publishing cannot
  succeed until the B2 credential exists.
- **Lighthouse mobile ≥ 95** runs on a GitHub runner and is **red on `/` at 91** (B20). 8 of 9
  pages pass.
- **Runner pinning (D23) is incomplete.** These still use `runs-on: ubuntu-latest`, which moves to
  26.04 between 2026-10-19 and 2026-11-19: `.github/workflows/gates.yml:40`, all four jobs in
  `auros-installer/ci.yml` (lines 57, 117, 187, 223), `auros-recipes/propagate.yml:52` (the
  Gate 2 path), and `auros-base/probe.yml` / `probe-boot.yml`. Every installer CI result rests on a
  runner image that will change on a date we do not control.

### Things that need a real registry, a real key, or a real person

- **Nothing has been published to GHCR** under `:hardened`. The D21 upstream mirror has never
  mirrored anything a customer depends on. Cosign signing and install-time signature enforcement
  are untested against a real registry.
- **The production signing key does not exist** (B10). The development key builds and boots, and
  the publish step refuses it by reading the key kind back out of the image.
- **Cross-repo propagation (Gate 2)** needs a credential `GITHUB_TOKEN` cannot provide (B2). The
  cron fallback has never been timed against the 20-minute window.
- **The nightly rebuild loop**, which the spec calls the actual product, has never completed a
  cycle.
- **The site is not deployed** (B14), so no gate has run against a real origin, and no stranger's
  order has opened a real pull request (Gate 4).

### Environment dependencies the suites do not declare

- **macOS bash 3.2** skips the 7 prune-runner tests and hides P04–P08. This one *is* declared: it
  skips loudly and fails hard in CI.
- **`auros-recipes` cannot run its own suite from a checkout of `auros-recipes` alone.** I found
  this by getting it wrong twice today on homebase. The first Linux run gave **429 tests, 12
  failing**, because `auros.config.json` lives in the meta repo one level up. The first differ
  harness run crashed on a missing `../hardware`. **Neither failure counted as a finding against
  the code.** Both were my harness, not the product. CI supplies both by checking the meta repo
  out as `.auros-meta`. Nothing in `package.json` or the README says so.
- An earlier measurement, reported and not repeated here, found these on Linux: without `python3`,
  7 tests **fail** instead of skipping; without `git`, 10 fail (the floor-ratchet fixtures);
  without `jsonschema`/`pyyaml`, `parity.test.ts` skips 3.
- `node --test test/` and `node --test tools/` both die with `MODULE_NOT_FOUND` on Node 22 before
  running anything. The Worker's own `package.json` script had this bug, so **all 244 Worker
  tests were unreachable from their own package script** until the glob was fixed.

### Licensing: which surfaces are checked, and one found today

The owner's instruction is that nobody may redistribute this, and that is D30/D31. Here is what
checks it:

| Surface | Checked by | Not checked |
|---|---|---|
| Every repo's `README.md` vs its `LICENSE` | `tools/licence-consistency.mjs` (a `verify` gate) | anything that isn't a README |
| All text in `auros-recipes`, including the PR body `explain` writes | `auros-recipes/test/licence.test.ts` | other repos |
| `auros-recipes/package.json` `license` + `private` | `licence.test.ts` | `auros-web/package.json` and `worker/package.json` **declare no `license` at all**. They are `private: true`, so they cannot be published by accident, but nothing asserts even that. |
| Site copy | `tools/honesty-gate.mjs` over `auros-web/src` only | `docs/`, the Worker's emails, `auros-base`, `auros-installer` |
| **Machine-readable licence fields in shipped packages** | **nothing** | see below |

**Found and fixed today:** `auros-base/desktop/lookandfeel/org.auros.windows.desktop/metadata.json`
declared `"License": "Apache-2.0"`. That is our own Plasma look-and-feel package. It ships inside
every image, where anyone who inspects the image or the theme's details can read it. It was a redistribution grant in a
machine-readable field, the same class of bug `auros-recipes/package.json` had. **Every licence
check was green while it was there.** I ran `licence-consistency.mjs` before fixing it and got
`5 repo(s), README and LICENSE agree`, exit 0. The field now reads `LicenseRef-Proprietary`, and
the desktop suites still pass (40-windows-feel 86/86, b12-modes 18/18). This is not committed
(`auros-base` had another agent's uncommitted work in it). **No test prevents it coming back.** The
missing test is a walk over every repo's `package.json` `license`, every KPackage `metadata.json`
`KPlugin.License`, and any SPDX header. It should fail on a permissive identifier, and it needs a
demonstrated red run against this exact field.

A related gap, left open on purpose: the honesty gate's list of negation words does not include
"nothing" or "nobody". So a sentence that negates a fork claim that way still trips the gate. A
test records this behaviour, because widening a negation list weakens the gate.

### Two gates with no test file of their own

`tools/licence-consistency.mjs` and `tools/content-commands.mjs` are both gates `verify` runs on
every invocation, and neither has a test file. They are exercised only inside `verify-meta`'s
sandboxes, as black boxes.

### Currently red, and therefore currently unproven

| Gate | Why |
|---|---|
| `workflow lint` | `auros-base/.github/workflows/build.yml:559` and `auros-installer/.github/workflows/gate3.yml:180` build a matrix from `fromJSON()` with **no fallback**. If that yields an empty list or null, GitHub rejects the workflow at startup with zero jobs and no log. The linter prints "4 problem(s)", but **there are 2 distinct problems, each reported twice**: `verify` passes both `auros-base` and `.` as roots, and `.` walks the sibling repos again. The linter double-counts. |
| `workflow lint, both directions` | The linter's own suite, failing on the same two problems. |
| `verify propagates every failure (meta)` | **Two causes.** (1) Two §6D gates (no-JS, content-JS) were added to `verify` with no propagation case, and the structural assertion named them within one commit. That is the assertion doing its job. (2) Four sandbox cases die in setup with `EEXIST … symlink auros-base` (`verify-meta.test.mjs:132`). The licence gate's fix made every sandbox create a real `auros-base/` directory, and the publish-gate cases then try to symlink over it. As a result, **nothing currently proves that a failure of the §4.3 publish gate reaches `verify`'s exit status, in either direction.** The gate's own 241 tests pass. What is unproven is the aggregate everyone reads. Commit `0df29e4` (R8) records it. |

### Flaky

`desktop/tests/b12-modes.test.sh` failed once under parallel load in the base campaign
(`printf: write error: Broken pipe`). That made one mutation look caught when it was not. Four
identical unmutated copies run the same way were all green. A flaky test can hide a real failure
or fake one, and this one did both in the same run.

### Not tested because we decided not to build it

Writing boot media from Windows (D13), a Chrome/Edge credential decryptor (D15), and an automated
`.exe` compatibility checker (D16). There is no code, so there is no test. Dropping D13 removed
the most destructive code path in the company.

---

## The two bugs that justify all of this

Neither announced itself. Both showed a green line in the place where someone would look for
trouble. Neither was found by re-reading code.

### 1. The SELinux kernel-argument check that was permanently GREEN

`auros-base/build/10-hardening.sh` asserts that no kernel argument shipped in the image disables
SELinux. It collects the effective kargs, normalises whitespace, and matches
`^(selinux=0|enforcing=0)$` line by line.

The normalisation was `tr -d '[:space:]'`, and that character class **includes `\n`**. The
newlines went along with the spaces, every argument collapsed onto one line, and a line-anchored
pattern could never match anything again. The check passed on every input, including
`kargs = ["selinux=0"]`, **for about an hour**, and printed that it had inspected the kargs.

That check had four lives, and the lesson is in the list:

1. **Permanently RED.** The pattern matched its own kargs file's explanatory comment, the one
   explaining that `enforcing=0` at the GRUB prompt is a technician's last recovery path.
2. **Permanently GREEN.** The `tr -d '[:space:]'` bug.
3. **Permanently GREEN, a different way.** It read `kargs.d/*.toml` **line by line**, so a
   multi-line array (`kargs = [` then `"selinux=0"` on the next line, which is valid TOML that
   bootc accepts) was invisible. It was found by writing a fake-root harness *around* the file, and
   fixed by joining before splitting on commas (D34). Putting the old reader back turns three
   multi-line cases red.
4. **Green about code nobody runs.** `kargs-check.test.sh` extracted the helper from the shipping
   script, then ran its **own hand-written copy** of the `tr … | grep` caller line. An independent
   mutation run put the newline-eating `tr` back into the *shipping* line, and every test still
   passed, because the test's private copy was still correct. Both halves are now extracted from
   the shipping file. The test aborts if there is not exactly one `_auros_bad_kargs=` line.
   `prove-red.sh` mutates the shipping line, and it is caught today (61/61).

The shipping line now reads:

```bash
_auros_bad_kargs=$(_auros_effective_kargs | tr -d ' \t' | grep -E '^(selinux=0|enforcing=0)$' || true)
```

### 2. The pipe through `tail` that scored a failing build as passing

`./verify` is the aggregate gate: the one line people trust when they are not reading every suite
themselves. Two of its gates were written like this:

```bash
run "site builds (spec §6D)" bash -c 'cd auros-web && (pnpm build 2>&1 | tail -20)'
```

`set -o pipefail` at the top of `verify` applies to *that* shell. `bash -c` starts a **new**
shell, which has default options. So the pipeline's exit status was `tail`'s, and `tail` returns
0. In a sandbox, a build script that printed `BUILD EXPLODED` and exited 1 was reported as
**`PASS site builds`**, and `verify` exited 0. The recipe suite had the same wiring. So did the
`gates` CI workflow, which calls this script.

The person who wrote that line had found the identical bug in the boot probe that same morning.
They wrote it up as **D19** ("a step that cannot fail is not a check") and made `pipefail` a
standing rule. Then, a few hours later, they wrote the bug into the aggregate gate. Some green
`verify` results reported that day were not evidence for those two suites. Both suites were re-run
directly and passed, so nothing shipped behind a false green. **That was luck, not the gate
working.**

The fix is `bash -euo pipefail -c` at every call site (there are ten today). There is also
`tools/verify-meta.test.mjs`, which breaks each gate on purpose, requires `verify` to go red, and
reads `verify`'s own source to fail on any `bash -c` pipeline without `pipefail`. Until that file
existed, nobody had ever watched `verify` fail.

### The same lesson, twice

**A check that cannot fail is not a check.** Both of these were written by someone who knew the
rule. The SELinux check was fixed once and came back in the same shape three more times. `verify`
got D19's bug hours after D19 was written, by D19's author, in the one place where a false green
hides every other result. **A rule written in a document is not a control.** The control is a
harness that puts the bug back and demands red.

The same shape keeps turning up, and today it turned up in my own work. My first gate mutation run
would have scored 18/18 against a control that was already failing 16 tests. The Apache-2.0 field
sat in `metadata.json` while every licence check said "agree". `FuzzManifestBody` could fail, and
nobody had ever let it run.

---

## How to add a test here

**The standard is one sentence: a test needs a demonstrated red state, and you must have watched
it go red.**

"It would fail if…" does not count, and neither does a reviewer agreeing it looks right. Break the
thing on purpose, run the test, see red, put it back, see green. If you cannot make it go red, you
have written decoration, not a check. Decoration in a test file is worse than an empty file,
because it reassures people.

1. **Write the assertion. Test the refusal before the acceptance.** For every rejection, add the
   control: the same input minus the one defect, which must be accepted. Without the control, a
   tool that refuses everything passes.
2. **Break the code the test watches**: the code, not the test. The test must fail, and the
   failure message must name what is wrong **and print what is actually there**
   (`expected [uefi-sb] got [uefi]`, not `expected true`).
3. **Test both sides of every boundary.** Test "one too many" as well as "one too few". Test
   removing the first element as well as the last. Test `= N` as well as `< N`. Half the gate
   survivors were a boundary tested from one side.
4. **Put the code back.** Run again. It must pass.
5. **Record the mutation** in the harness that owns the component, so step 2 happens again for
   free every time someone changes the code:
   - `auros-base/tests/prove-red.sh`
   - `auros-recipes/scripts/prove-red.mjs` (`prove-red-differ.mjs` for the differ). Its
     `--baseline` mode applies a mutation to the suite *as it stood at HEAD*, which proves the
     hole was real **before** your test closed it.
   - `auros-web/tools/prove-red.mjs`
   - `tools/verify-meta.test.mjs`: **required** for every new line in `./verify`. A structural
     test fails if you skip it.
   - **There is no harness for `auros-installer`, `auros-web/worker`, `tools/gate.mjs` or
     `auros-recipes/schema/*.py`.** For those, keep the mutation script next to the test and name
     it in the commit. Building a real harness for the installer is worth more than adding tests
     to it.
6. **Run the control before you trust the result.** Before counting a single catch, run the
   harness against the **unmutated** copy and confirm it is green. Today's gate run showed why: a
   scratch copy missing one directory gave a control with 16 failures, and every mutation would
   have looked "caught". The same goes for environment. A run that fails because a file is missing
   is a failure of your harness, not a finding.
7. **Do not let a golden file be the only thing that catches a bug.** If only the byte-compare goes
   red, write the behavioural test. A golden-file failure tells the developer to regenerate the
   file, and the bug then ships.
8. **If a check really does have only one direction, say so openly.** `auros-base` has
   `t_exempt <id> <reason>`, printed on every run. A declared exemption is fine. An undeclared
   one-direction check is what the SELinux bug looked like.
9. **If a fuzz target exists, run it.** `go test` replays seeds only. Before claiming a fuzz target
   covers something, run `go test -run='^$' -fuzz='^FuzzX$' -fuzztime=60s`.

Three rules that came from real damage:

- **Never guess a path, unit name or flag.** Four build cycles of about fifty minutes each were
  lost to a remembered greenboot layout and a CLI that did not exist. Read the artifact or probe
  it. When an assertion fails, it must print what is there.
- **`set -o pipefail`, always, and remember that `bash -c` does not inherit it.** Use
  `bash -euo pipefail -c`.
- **Do not widen a rule to make a finding go away.** If a finding really is fine, annotate the
  line (`auros-allow: <reason>`) so it shows up in the diff. The honesty gate and the installer's
  abort-ratio check both say this in their own failure output, because widening is the easy move,
  and it quietly turns a gate into decoration.
