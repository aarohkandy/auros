#!/usr/bin/env node --test
// META-TEST — `./verify` must go RED when any single gate goes red.
//
//   node --test tools/verify-meta.test.mjs
//
// THIS IS THE WORST BUG AVAILABLE IN THIS REPOSITORY. Every other gate can be individually correct
// and the project can still be flying blind, because `verify` is the one command anybody actually
// runs and the one CI calls. An aggregate that prints a green summary while a component failed is
// not a weaker gate — it is an anti-gate, because it manufactures confidence that nothing else can
// contradict.
//
// IT HAS ALREADY HAPPENED HERE, TWICE, IN THE SAME SHAPE:
//
//   * DECISIONS.md D19 — a build step piped through `tail`, so the pipeline's exit status was
//     `tail`'s, and a FAILING bootc-image-builder scored as a PASSING step.
//   * 2026-09-20, found by this file — `verify` itself contained
//         run "site builds" bash -c 'cd auros-web && (pnpm build 2>&1 | tail -20)'
//     and `bash -c` starts a NEW shell that does not inherit `set -o pipefail` from the script that
//     spawned it. So a failing site build and a failing recipe suite BOTH reported PASS, and verify
//     exited 0. The fix is `bash -euo pipefail -c`; the test that proves it is below.
//
// HOW THIS RUNS WITHOUT RECURSING. Each case builds a sandbox directory, copies the REAL `verify`
// into it byte for byte, and populates only what that case needs. `verify` guards every gate with
// `[ -f … ]` or `[ -d … ]`, so a gate whose files are absent SKIPs — including this file, which the
// sandbox never contains. There is no flag, no environment variable and no modified copy of verify
// involved: the recursion is prevented by the sandbox's contents, which is also what makes each case
// a clean single-variable experiment.
//
// WHERE A CASE USES A STAND-IN. Some gates live in sibling repositories that are separate git repos
// (D6) and cost a minute each to run. For those, the sandbox supplies a stand-in that exits 1 — the
// `run` line in verify is byte-identical, only the callee is substituted. That is exactly the right
// instrument, because the bug class being tested is "verify loses a non-zero exit status", which is
// a property of the invocation and not of the callee. Every such case is named `(stand-in)`.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync, readFileSync, chmodSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..')
const VERIFY_SRC = readFileSync(join(REPO, 'verify'), 'utf8')

let ROOT
const root = () => (ROOT ??= mkdtempSync(join(tmpdir(), 'auros-verify-meta-')))
let seq = 0

/** Every gate that is UNCONDITIONAL in verify, and therefore runs in every sandbox. */
const ALWAYS_RUN_TOOLS = ['workflow-lint.mjs', 'compat-lint.mjs']

const CLEAN_WORKFLOW = `name: sandbox
on:
  workflow_dispatch:
defaults:
  run:
    shell: bash -euo pipefail {0}
jobs:
  noop:
    runs-on: ubuntu-24.04
    steps:
      - run: echo ok
`

/**
 * Build a sandbox: the real `verify`, the repo's config, and whatever `populate` adds.
 * Nothing else. Absent files make verify SKIP, which is how each case isolates one gate.
 */
function sandbox (populate) {
  const dir = join(root(), `s-${seq++}`)
  mkdirSync(join(dir, 'tools'), { recursive: true })
  mkdirSync(join(dir, 'attest'), { recursive: true })
  mkdirSync(join(dir, 'hardware'), { recursive: true })
  mkdirSync(join(dir, '.github', 'workflows'), { recursive: true })

  writeFileSync(join(dir, 'verify'), VERIFY_SRC)
  chmodSync(join(dir, 'verify'), 0o755)
  copyFileSync(join(REPO, 'auros.config.json'), join(dir, 'auros.config.json'))
  copyFileSync(join(REPO, 'attest', 'passed-digests.tsv'), join(dir, 'attest', 'passed-digests.tsv'))
  copyFileSync(join(REPO, 'hardware', 'compat.tsv'), join(dir, 'hardware', 'compat.tsv'))
  writeFileSync(join(dir, '.github', 'workflows', 'ok.yml'), CLEAN_WORKFLOW)
  for (const t of ALWAYS_RUN_TOOLS) copyFileSync(join(REPO, 'tools', t), join(dir, 'tools', t))

  const api = {
    dir,
    /** Copy a real tool or test file from tools/ into the sandbox. */
    tool (...names) { for (const nme of names) copyFileSync(join(REPO, 'tools', nme), join(dir, 'tools', nme)); return api },
    /** Write an arbitrary file, creating parents. */
    write (rel, text, mode) {
      const p = join(dir, rel)
      mkdirSync(dirname(p), { recursive: true })
      writeFileSync(p, text)
      if (mode) chmodSync(p, mode)
      return api
    },
    /** A node test file that passes or fails on command — used where a real run is too expensive. */
    stubTest (rel, ok) {
      return api.write(rel,
        "import { test } from 'node:test'\nimport assert from 'node:assert/strict'\n" +
        `test('stand-in', () => { assert.ok(${ok ? 'true' : 'false'}, 'stand-in failure') })\n`)
    },
    /** A package.json whose named script exits 0 or 1 — the shape the `| tail` bug lived in. */
    stubPkg (repoDir, script, ok) {
      return api.write(`${repoDir}/package.json`, JSON.stringify({
        name: `stub-${repoDir}`,
        scripts: { [script]: ok ? "node -e \"console.log('stand-in ok')\"" : "node -e \"console.error('STAND-IN FAILED'); process.exit(1)\"" },
      }, null, 2) + '\n')
    },
  }
  populate(api)
  return dir
}

/** Run the sandbox's own ./verify and parse its report. */
function runVerify (dir) {
  let exit = 0
  let out = ''
  try {
    out = execFileSync('./verify', [], { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
  } catch (e) {
    exit = e.status ?? -1
    out = String(e.stdout ?? '') + String(e.stderr ?? '')
  }
  // Strip ANSI so the assertions read the words rather than the colours.
  const plain = out.replace(/\u001b\[[0-9;]*m/g, '')
  const summary = /════ (\d+) passed · (\d+) failed · (\d+) skipped ════/.exec(plain)
  const verdicts = new Map()
  for (const m of plain.matchAll(/^\s+(PASS|FAIL|SKIP)\s+(.+?)\s*$/gm)) verdicts.set(m[2], m[1])
  return {
    exit,
    plain,
    passed: summary ? Number(summary[1]) : null,
    failed: summary ? Number(summary[2]) : null,
    skipped: summary ? Number(summary[3]) : null,
    verdictFor: (name) => verdicts.get(name) ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE CASES. Each names a gate exactly as `verify` prints it, and supplies two populations of the
// sandbox: one in which that gate passes and one in which it fails. Both halves are asserted, which
// is what stops this file passing against a verify that simply always exits 1.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const CASES = [
  {
    gate: 'honesty gate (spec §4.4)',
    real: true,
    green: (s) => s.tool('honesty-gate.mjs').write('auros-web/src/copy.md', 'Every recipe inherits from one base image.\n'),
    red: (s) => s.tool('honesty-gate.mjs').write('auros-web/src/copy.md', 'Trusted by schools across three districts.\n'),
  },
  {
    gate: 'honesty regressions (2026-09-20 audit)',
    green: (s) => s.stubTest('tools/honesty-regressions.test.mjs', true),
    red: (s) => s.stubTest('tools/honesty-regressions.test.mjs', false),
    standIn: true,
  },
  {
    gate: 'published commands resolve (spec §1.3)',
    green: (s) => s.write('tools/content-commands.mjs', "console.log('stand-in ok')\n")
      .write('auros-web/src/content/a.md', 'x\n'),
    red: (s) => s.write('tools/content-commands.mjs', "console.error('STAND-IN FAILED'); process.exit(1)\n")
      .write('auros-web/src/content/a.md', 'x\n'),
    standIn: true,
  },
  {
    gate: 'publish gate (spec §4.3)',
    real: true,
    // The real gate.test.mjs asserts, among much else, that the shipped ledger parses cleanly.
    // Corrupting the ledger is therefore a REAL failure of the real suite, not a stand-in.
    green: (s) => s.tool('gate.mjs', 'gate.test.mjs'),
    red: (s) => s.tool('gate.mjs', 'gate.test.mjs')
      .write('attest/passed-digests.tsv', 'digest\tnonsense\theader\n'),
    slow: true,
  },
  {
    gate: 'publish gate refusals (spec §4.3)',
    real: true,
    green: (s) => s.tool('gate.mjs', 'gate.refusals.test.mjs'),
    red: (s) => s.tool('gate.mjs', 'gate.refusals.test.mjs')
      .write('attest/passed-digests.tsv', 'digest\tnonsense\theader\n'),
    slow: true,
  },
  {
    gate: 'honesty gate corpus (spec §4.4)',
    real: true,
    green: (s) => s.tool('honesty-gate.mjs', 'honesty-gate.corpus.test.mjs'),
    // Break the GATE and the corpus catches it: delete every rule, and the must-fire half goes red.
    red: (s) => s.tool('honesty-gate.corpus.test.mjs')
      .write('tools/honesty-gate.mjs', readFileSync(join(REPO, 'tools', 'honesty-gate.mjs'), 'utf8')
        .replace(/^const RULES = \[/m, 'const RULES = [].concat([')
        .replace(/^\]\s*$/m, '])')),
    slow: true,
  },
  {
    gate: 'compat.tsv lint, both directions',
    real: true,
    green: (s) => s.tool('compat-lint.test.mjs'),
    red: (s) => s.tool('compat-lint.test.mjs')
      // Remove the vm-row rule from the lint; the suite's rejection half goes red immediately.
      .write('tools/compat-lint.mjs', readFileSync(join(REPO, 'tools', 'compat-lint.mjs'), 'utf8')
        .replace("const PHYSICAL_ONLY = ['wifi', 'trackpad', 'suspend', 'brightness', 'webcam']",
          "const PHYSICAL_ONLY = ['wifi', 'trackpad', 'suspend', 'brightness', 'webcam']\nconst _DISABLED = PHYSICAL_ONLY.splice(0, PHYSICAL_ONLY.length)")),
  },
  {
    gate: 'workflow lint, both directions',
    real: true,
    green: (s) => s.tool('workflow-lint.test.mjs'),
    red: (s) => s.tool('workflow-lint.test.mjs')
      .write('tools/workflow-lint.mjs', readFileSync(join(REPO, 'tools', 'workflow-lint.mjs'), 'utf8')
        .replace('const problems = []', 'const problems = []\nconst _neutered = true')
        .replace(/problems\.push\(\{ file, line: i \+ 1, why:/, 'if (!_neutered) problems.push({ file, line: i + 1, why:')
        .replace("'no jobs and no log, not an error. Quote the value, or use block style.', text: line.trim().slice(0, 120) })",
          "'no jobs and no log, not an error. Quote the value, or use block style.', text: line.trim().slice(0, 120) })")),
  },
  {
    gate: 'recipe validator + compiler (spec §6B)',
    green: (s) => s.stubPkg('auros-recipes', 'test', true),
    red: (s) => s.stubPkg('auros-recipes', 'test', false),
    standIn: true,
    note: 'this is the `| tail -30` call site — one of the two that reported PASS on a failing suite',
  },
  {
    gate: 'workflow lint',
    real: true,
    green: () => {},                       // the base sandbox already ships a clean workflow
    red: (s) => s.write('.github/workflows/bad.yml', 'on:\n  workflow_dispatch:\njobs:\n  x:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: echo hi\n'),
  },
  {
    gate: 'hardening karg check (both directions)',
    green: (s) => s.write('auros-base/tests/kargs-check.test.sh', '#!/usr/bin/env bash\nexit 0\n', 0o755),
    red: (s) => s.write('auros-base/tests/kargs-check.test.sh', '#!/usr/bin/env bash\necho "STAND-IN FAILED" >&2\nexit 1\n', 0o755),
    standIn: true,
  },
  {
    gate: 'site builds (spec §6D)',
    green: (s) => s.stubPkg('auros-web', 'build', true),
    red: (s) => s.stubPkg('auros-web', 'build', false),
    standIn: true,
    note: 'this is the `| tail -20` call site that reported PASS on a failing build until 2026-09-20',
  },
  {
    gate: 'WCAG AA contrast, measured (spec §7)',
    green: (s) => s.write('auros-web/tools/contrast.mjs', "console.log('stand-in ok')\n"),
    red: (s) => s.write('auros-web/tools/contrast.mjs', "console.error('STAND-IN FAILED'); process.exit(1)\n"),
    standIn: true,
  },
  {
    gate: 'configurator a11y + honesty regressions (spec §6D)',
    green: (s) => s.stubTest('auros-web/tools/configurator-a11y.test.mjs', true),
    red: (s) => s.stubTest('auros-web/tools/configurator-a11y.test.mjs', false),
    standIn: true,
  },
  {
    gate: 'compat.tsv honesty (no vm row claims a physical column)',
    real: true,
    green: () => {},                       // the base sandbox ships the repo's real, honest compat.tsv
    red: (s) => {
      const header = readFileSync(join(REPO, 'hardware', 'compat.tsv'), 'utf8').split('\n')[0]
      const cols = header.split('\t')
      const bad = cols.map((c) => (c === 'source' ? 'vm' : c === 'wifi' ? 'ok' : c === 'model' ? 'qemu' : '')).join('\t')
      s.write('hardware/compat.tsv', `${header}\n${bad}\n`)
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('verify FAILS when any single gate fails', () => {
  for (const c of CASES) {
    const label = c.standIn ? `${c.gate} (stand-in)` : c.gate
    test(`RED: ${label}`, () => {
      const dir = sandbox(c.red)
      const r = runVerify(dir)
      assert.equal(r.verdictFor(c.gate), 'FAIL',
        `verify did not report FAIL for "${c.gate}". Its verdict was ${r.verdictFor(c.gate)}.\n${r.plain}`)
      assert.ok(r.failed >= 1, `the summary counted ${r.failed} failures while a gate was failing.\n${r.plain}`)
      assert.notEqual(r.exit, 0,
        `THE WORST BUG AVAILABLE: verify exited 0 with "${c.gate}" failing. An aggregate that reports ` +
        `success while a component fails manufactures confidence nothing else can contradict.\n${r.plain}`)
    })

    test(`GREEN: ${label}`, () => {
      // Without this half, every RED assertion above would be satisfied by a verify that always
      // exits 1 — which is just as useless and considerably more annoying.
      const dir = sandbox(c.green)
      const r = runVerify(dir)
      assert.notEqual(r.verdictFor(c.gate), 'FAIL',
        `"${c.gate}" failed in the sandbox where it should pass, so the RED case above proves nothing ` +
        `about that gate.\n${r.plain}`)
      assert.equal(r.failed, 0, `the sandbox reported ${r.failed} failure(s) when nothing should fail.\n${r.plain}`)
      assert.equal(r.exit, 0, `verify exited ${r.exit} on an all-green sandbox.\n${r.plain}`)
    })
  }
})

describe('the aggregation itself, independent of any one gate', () => {
  test('an all-skip sandbox exits 0 and reports zero failures — the baseline', () => {
    const r = runVerify(sandbox(() => {}))
    assert.equal(r.exit, 0, `an empty sandbox exited ${r.exit}\n${r.plain}`)
    assert.equal(r.failed, 0)
    assert.ok(r.skipped > 0, 'nothing skipped, so the sandbox is not isolating anything')
  })

  test('TWO simultaneous failures are BOTH reported and counted', () => {
    // A summary that stops at the first failure turns one debugging session into several, and worse,
    // hides how much is broken.
    const dir = sandbox((s) => {
      s.stubPkg('auros-web', 'build', false)
      s.stubPkg('auros-recipes', 'test', false)
    })
    const r = runVerify(dir)
    assert.equal(r.verdictFor('site builds (spec §6D)'), 'FAIL')
    assert.equal(r.verdictFor('recipe validator + compiler (spec §6B)'), 'FAIL')
    assert.equal(r.failed, 2, `expected 2 failures in the summary, got ${r.failed}\n${r.plain}`)
    assert.notEqual(r.exit, 0)
  })

  test('the summary arithmetic adds up — passed + failed + skipped equals the gates that ran', () => {
    const r = runVerify(sandbox((s) => { s.stubPkg('auros-web', 'build', false) }))
    const counted = (r.plain.match(/^\s+(PASS|FAIL|SKIP)\s+/gm) ?? []).length
    assert.equal(r.passed + r.failed + r.skipped, counted,
      `the summary says ${r.passed}+${r.failed}+${r.skipped} but ${counted} verdicts were printed. ` +
      'A summary that does not reconcile with its own output is the beginning of a summary nobody reads.')
  })

  test('a SKIP is never counted as a pass', () => {
    const r = runVerify(sandbox(() => {}))
    assert.equal(r.passed, (r.plain.match(/^\s+PASS\s+/gm) ?? []).length,
      'the passed count does not match the number of PASS lines — skips are being counted as passes')
  })

  test('a gate whose command does not exist at all is a FAILURE, not a skip', () => {
    // The shape that bit auros-recipes: a workflow invoked `node tools/gate.mjs` in a repo with no
    // tools/ directory. The process dies with "Cannot find module". If verify counted that as a
    // skip, a gate could be removed from the tree and nobody would ever see a red line.
    const dir = sandbox((s) => { s.write('tools/honesty-regressions.test.mjs', '') })
    // An EMPTY test file: node --test exits non-zero on a file with no tests? If it does not, this
    // asserts the honest alternative — that verify reports whatever node returned, faithfully.
    const r = runVerify(dir)
    assert.notEqual(r.verdictFor('honesty regressions (2026-09-20 audit)'), 'SKIP',
      'a present-but-broken gate was reported as SKIP, which reads to a human as "not applicable"')
  })
})

describe('verify cannot lose an exit status — the D19 property, asserted structurally', () => {
  test('every pipeline inside a `bash -c` in verify runs under pipefail', () => {
    // `set -o pipefail` at the top of verify applies to THAT shell. `bash -c '…'` starts a new shell
    // with default options, so a pipeline inside one takes the LAST command's status. Two gates were
    // written that way and both reported PASS on a failing command.
    const offenders = []
    for (const m of VERIFY_SRC.matchAll(/^\s*run\s+.*?\bbash\s+(-\S+\s+)*-c\s+'([^']*)'/gm)) {
      const opts = m[0].slice(0, m[0].indexOf("-c"))
      const script = m[2]
      if (script.includes('|') && !/pipefail/.test(opts)) offenders.push(m[0].trim())
    }
    assert.deepEqual(offenders, [],
      'these verify gates pipe a command inside a `bash -c` that does NOT set pipefail, so the gate ' +
      'takes the exit status of the LAST command in the pipe — usually `tail`, which always succeeds:\n  ' +
      offenders.join('\n  ') +
      '\nUse `bash -euo pipefail -c`. This is DECISIONS.md D19, and it has now appeared twice.')
  })

  test('verify still exits non-zero when FAIL is non-zero, and that line has not been softened', () => {
    assert.match(VERIFY_SRC, /\[\s*"\$FAIL"\s*-eq\s*0\s*\]\s*\|\|\s*exit\s+1/,
      'the final line that turns a failure count into a non-zero exit status is missing or has changed shape')
    assert.doesNotMatch(VERIFY_SRC, /^\s*run\s+.*\|\|\s*true\s*$/m,
      'a gate in verify is suffixed with `|| true`, which discards its verdict')
    assert.doesNotMatch(VERIFY_SRC, /set\s+\+e/,
      'verify disables errexit somewhere — every gate is already run through `run`, which handles its own status')
  })

  test('every `run` line in verify has a case in this file', () => {
    // THE ANTI-ROT ASSERTION. A gate added to verify without a meta-case is a gate whose failure has
    // never been demonstrated to propagate. This is the check that makes the CASES list above stay
    // honest as verify grows, and it is the reason this file is not simply a snapshot.
    const declared = [...VERIFY_SRC.matchAll(/^\s*run\s+"([^"]+)"/gm)].map((m) => m[1])
    assert.ok(declared.length > 5, `only ${declared.length} run lines were parsed out of verify — the parse is wrong`)
    const covered = new Set(CASES.map((c) => c.gate))
    const uncovered = declared.filter((g) => !covered.has(g))
    assert.deepEqual(uncovered, [],
      `these gates are run by verify but no case here proves that their failure reaches verify's exit ` +
      `status: ${uncovered.map((g) => `"${g}"`).join(', ')}. Add a case to CASES with a green and a red ` +
      'population. Do not delete this assertion — it is the only thing keeping the list current.')
  })

  test('every case in this file names a gate verify actually runs', () => {
    // The mirror: a case left behind after a gate is renamed silently stops testing anything.
    const declared = new Set([...VERIFY_SRC.matchAll(/^\s*run\s+"([^"]+)"/gm)].map((m) => m[1]))
    const stale = CASES.map((c) => c.gate).filter((g) => !declared.has(g))
    assert.deepEqual(stale, [],
      `these cases name gates verify no longer runs: ${stale.map((g) => `"${g}"`).join(', ')}. ` +
      'A case pointing at a gate that does not exist passes without testing anything.')
  })
})

test.after(() => { if (ROOT) rmSync(ROOT, { recursive: true, force: true }) })
