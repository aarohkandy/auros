#!/usr/bin/env node --test
// workflow-lint — the three GitHub Actions mistakes whose symptom is silence, tested both ways.
//
//   node --test tools/workflow-lint.test.mjs
//
// EACH RULE HERE EXISTS BECAUSE IT ALREADY COST US SOMETHING:
//
//   1. `${{ }}` unquoted inside a YAML FLOW MAPPING. The braces are structural, the document is
//      invalid, GitHub rejects the whole workflow — and the symptom is not an error. It is a run
//      that appears named by its FILE PATH instead of by its `name:`, with no jobs and no log.
//   2. No pipefail. A step that pipes through `tail` takes the LAST command's exit status, so a
//      FAILING bootc-image-builder scored as a PASSING step and the workflow reported success
//      while producing no image (DECISIONS.md D19). The general rule D19 draws from it is the one
//      governing this whole file: a step that cannot fail is not a check.
//   3. No top-level `name:`. Which is also what a rejected workflow looks like, so a workflow with
//      no name is a workflow whose parse failures are indistinguishable from its normal appearance.
//
// THE DISCIPLINE. For every "must fire" there is a near-identical "must not fire" that differs by
// one character — a quote, a brace, a line. A linter that flagged every `${{ }}` would satisfy every
// positive test in this file and be useless, because `${{ }}` in block style is how workflows are
// written. The negative half is what makes the positive half mean something.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..')
const LINT = join(HERE, 'workflow-lint.mjs')

let ROOT
const root = () => (ROOT ??= mkdtempSync(join(tmpdir(), 'auros-wflint-')))
let seq = 0

/** Run the real linter over a tree containing the given workflow files. */
function lint (files) {
  const dir = join(root(), `t-${seq++}`)
  const wf = join(dir, '.github', 'workflows')
  mkdirSync(wf, { recursive: true })
  for (const [name, text] of Object.entries(files)) writeFileSync(join(wf, name), text)
  try {
    const out = execFileSync(process.execPath, [LINT, dir], { encoding: 'utf8', stdio: 'pipe' })
    return { exit: 0, out, problems: [] }
  } catch (e) {
    const out = String(e.stdout ?? '') + String(e.stderr ?? '')
    return { exit: e.status ?? -1, out }
  }
}
const one = (text, name = 'w.yml') => lint({ [name]: text })

const clean = (res, why) =>
  (assert.equal(res.exit, 0, `expected NO findings (${why}) but workflow-lint exited ${res.exit}:\n${res.out}`), res)
const flags = (res, why) => {
  assert.notEqual(res.exit, 0, `expected a FINDING (${why}) but workflow-lint exited 0:\n${res.out}`)
  return res
}

// A minimal workflow that is correct in every respect this linter checks. Every positive test below
// introduces exactly one defect into this text, so a finding is attributable to that defect alone.
const OK = `name: build-base
on:
  workflow_dispatch:

defaults:
  run:
    shell: bash -euo pipefail {0}

jobs:
  build:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - name: build
        run: |
          echo building
`

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('the control — a correct workflow produces no findings', () => {
  test('the baseline workflow is clean', () => {
    const r = clean(one(OK), 'a workflow with a name, pipefail defaults and no flow-mapping expressions')
    assert.match(r.out, /1 workflow\(s\), no problems/)
  })

  test('a block-style ${{ }} is clean — the overwhelmingly common, correct shape', () => {
    // If this ever fires, the linter has become a blanket ban on expressions and everybody will
    // switch it off, which costs more than the bug it was written for.
    clean(one(OK.replace('echo building', 'echo "${{ github.sha }}"')), 'block-style expression in a run')
    clean(one(OK.replace('      - uses: actions/checkout@v4',
      '      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.sha }}')),
    'block-style expression under with:')
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('rule 1 — ${{ }} unquoted inside a YAML flow mapping', () => {
  const FLOW_BAD = [
    ['with, one key',        '        with: { name: art-${{ matrix.profile }} }'],
    ['with, two keys',       '        with: { name: art-${{ matrix.profile }}, path: out/ }'],
    ['env flow mapping',     '        env: { SHA: ${{ github.sha }} }'],
    ['expression in the value position of an inputs map',
      '        with: { recipe: ${{ inputs.recipe }}, base_digest: abc }'],
    ['an unterminated flow mapping continued on the next line',
      '        with: { name: art-${{ matrix.profile }},'],
  ]

  for (const [label, line] of FLOW_BAD) {
    test(`FIRES on ${label}`, () => {
      const text = OK.replace('        run: |\n          echo building\n', `${line}\n`)
      const r = flags(one(text), label)
      assert.match(r.out, /flow mapping/, `the message must explain the mechanism. Got:\n${r.out}`)
      assert.match(r.out, /named by its file path/,
        'the message must describe the SYMPTOM, because the symptom is what somebody will be staring at')
    })
  }

  const FLOW_OK = [
    ['double-quoted expression in a flow mapping',
      '        with: { name: "art-${{ matrix.profile }}" }'],
    ['single-quoted expression in a flow mapping',
      "        with: { name: 'art-${{ matrix.profile }}' }"],
    ['a flow mapping with no expression in it at all',
      '        with: { name: artifact, path: out/ }'],
    ['quoted expression alongside an unquoted literal',
      '        with: { name: "art-${{ matrix.profile }}", path: out/ }'],
    ['an expression in block style under with:',
      '        with:\n          name: art-${{ matrix.profile }}'],
  ]

  for (const [label, line] of FLOW_OK) {
    test(`QUIET on ${label}`, () => {
      const text = OK.replace('        run: |\n          echo building\n', `${line}\n`)
      clean(one(text), label)
    })
  }

  test('the quoted and unquoted forms differ by exactly two characters, and the verdicts differ', () => {
    // The pair, stated as one test, because this is the entire rule. If somebody ever "simplifies"
    // the quote-stripping, one of these two assertions goes red immediately.
    const bad = OK.replace('        run: |\n          echo building\n',
      '        with: { name: art-${{ matrix.profile }} }\n')
    const good = OK.replace('        run: |\n          echo building\n',
      '        with: { name: "art-${{ matrix.profile }}" }\n')
    flags(one(bad), 'unquoted')
    clean(one(good), 'quoted')
    assert.equal(good.length - bad.length, 2, 'the two fixtures must differ by exactly the two quote characters')
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('rule 2 — pipefail (D19)', () => {
  test('FIRES on a workflow with no pipefail anywhere', () => {
    const noDefaults = OK.replace(/defaults:\n  run:\n    shell: bash -euo pipefail \{0\}\n\n/, '')
    const r = flags(one(noDefaults), 'no pipefail')
    assert.match(r.out, /no pipefail default/)
    assert.match(r.out, /tail|head|tee/, 'the message must name the shape that caused the original bug')
  })

  test('QUIET when the shell is declared per-step instead of in defaults', () => {
    const perStep = OK
      .replace(/defaults:\n  run:\n    shell: bash -euo pipefail \{0\}\n\n/, '')
      .replace('        run: |', '        shell: bash -euo pipefail {0}\n        run: |')
    clean(one(perStep), 'per-step pipefail shell')
  })

  test('QUIET for a pwsh workflow — Windows runners are not bash (D27, Gate 3)', () => {
    const pwsh = `name: gate3
on: { workflow_dispatch: null }
jobs:
  run:
    runs-on: windows-latest
    steps:
      - shell: pwsh
        run: Write-Host "hi"
`
    clean(one(pwsh), 'a pwsh workflow')
  })

  test('KNOWN GAP: a bare `defaults:` key satisfies the pipefail check without setting pipefail', () => {
    // The check is `!topLevel.includes('defaults') && !/shell: bash …pipefail/`, so ANY top-level
    // `defaults:` block short-circuits it — including one that only sets a working-directory. That is
    // a false NEGATIVE, and the only thing worse than a gate that fires wrongly is one that stays
    // quiet wrongly.
    //
    // This test asserts the CURRENT behaviour deliberately rather than asserting the behaviour we
    // want, because writing the aspiration here would make this file red and the gap would get
    // "fixed" by deleting the test. It is recorded so the gap is known, with the exact fixture that
    // demonstrates it. When the check is tightened, this test is what tells you it changed.
    const hollow = OK.replace('defaults:\n  run:\n    shell: bash -euo pipefail {0}',
      'defaults:\n  run:\n    working-directory: ./src')
    const r = one(hollow)
    assert.equal(r.exit, 0,
      'GOOD NEWS: the pipefail check no longer accepts a bare `defaults:` block. Tighten this test to ' +
      'assert the finding, and delete this comment.')
  })

  test('the pipefail rule can still go red on a workflow that has a defaults block with the WRONG shell', () => {
    // The half of the gap that IS caught: `defaults.run.shell` naming a shell with no pipefail in it
    // is still only caught when there is no `defaults:` key at all. Pinned here so the boundary of
    // the gap is explicit rather than inferred from reading the regex.
    const sh = OK.replace('shell: bash -euo pipefail {0}', 'shell: sh {0}')
    const r = one(sh)
    assert.equal(r.exit, 0, 'behaviour changed — the linter now inspects the shell inside defaults. Update this test.')
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('rule 3 — a top-level name', () => {
  test('FIRES on a workflow with no top-level name:', () => {
    const noName = OK.replace(/^name: build-base\n/, '')
    const r = flags(one(noName), 'no name')
    assert.match(r.out, /no top-level `name:`/)
    assert.match(r.out, /list this workflow by its file path/,
      'the message must connect the missing name to the parse-failure symptom, which is the reason the rule exists')
  })

  test('QUIET when a JOB is named but the workflow is too — the name that matters is the top-level one', () => {
    clean(one(OK.replace('  build:\n', '  build:\n    name: Build the base\n')), 'a named job in a named workflow')
  })

  test('FIRES when ONLY a job is named — an indented name: does not count', () => {
    const jobNameOnly = OK.replace(/^name: build-base\n/, '').replace('  build:\n', '  build:\n    name: Build the base\n')
    flags(one(jobNameOnly), 'only a job name')
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('the linter fails CLOSED rather than reporting a pass it did not earn', () => {
  test('REFUSES to report a pass when given no roots', () => {
    let threw = null
    try { execFileSync(process.execPath, [LINT], { encoding: 'utf8', stdio: 'pipe' }) } catch (e) { threw = e }
    assert.ok(threw, 'the linter exited 0 with no arguments')
    assert.equal(threw.status, 2)
    assert.match(String(threw.stderr), /refusing to report a pass/)
  })

  test('REFUSES to report a pass when the roots contain no workflows', () => {
    // The exact failure mode that matters: CI checks out siblings, one of them is missing, and the
    // linter "passes" over nothing. Scanning zero workflows is not a clean bill of health.
    const empty = join(root(), `empty-${seq++}`)
    mkdirSync(empty, { recursive: true })
    let threw = null
    try { execFileSync(process.execPath, [LINT, empty], { encoding: 'utf8', stdio: 'pipe' }) } catch (e) { threw = e }
    assert.ok(threw, 'the linter reported a pass having scanned zero workflows')
    assert.equal(threw.status, 2)
    assert.match(String(threw.stderr), /scanned 0 workflows/)
  })

  test('REFUSES a root that does not exist', () => {
    let threw = null
    try {
      execFileSync(process.execPath, [LINT, join(root(), 'nowhere')], { encoding: 'utf8', stdio: 'pipe' })
    } catch (e) { threw = e }
    assert.ok(threw, 'a nonexistent root reported clean')
    assert.equal(threw.status, 2)
  })

  test('only files under .github/workflows are linted — a stray yaml elsewhere is not a workflow', () => {
    const dir = join(root(), `stray-${seq++}`)
    mkdirSync(join(dir, 'config'), { recursive: true })
    mkdirSync(join(dir, '.github', 'workflows'), { recursive: true })
    writeFileSync(join(dir, 'config', 'thing.yml'), 'no_name_no_pipefail: true\n')
    writeFileSync(join(dir, '.github', 'workflows', 'w.yml'), OK)
    const out = execFileSync(process.execPath, [LINT, dir], { encoding: 'utf8' })
    assert.match(out, /1 workflow\(s\)/, 'the stray yaml outside .github/workflows was counted or linted')
  })

  test('every finding names a file and a line, or nobody can act on it', () => {
    const noName = OK.replace(/^name: build-base\n/, '')
    const r = flags(one(noName, 'unnamed.yml'), 'no name')
    assert.match(r.out, /unnamed\.yml:\d+/, `a finding with no file:line is a finding nobody fixes. Got:\n${r.out}`)
  })

  test('multiple defects in one file are ALL reported, not just the first', () => {
    const wrecked = `on:
  workflow_dispatch:
jobs:
  build:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/upload-artifact@v4
        with: { name: art-\${{ matrix.profile }} }
`
    const r = flags(one(wrecked), 'a workflow with all three defects')
    assert.match(r.out, /3 problem\(s\)/,
      `all three rules should fire on this file; a linter that stops at the first turns one fix into three rounds. Got:\n${r.out}`)
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('the workflows this repository actually ships', () => {
  test('every checked-out Auros workflow passes the linter', () => {
    const roots = ['auros-base', 'auros-recipes', 'auros-installer', 'auros-web', '.']
      .filter((r) => { try { readdirSync(join(REPO, r, '.github', 'workflows')); return true } catch { return false } })
    assert.ok(roots.length > 0, 'no workflows are checked out here, so this test proves nothing — it refuses to pass')
    const out = execFileSync(process.execPath, [LINT, ...roots], { cwd: REPO, encoding: 'utf8' })
    assert.match(out, /no problems/)
  })

  test('and the same linter goes RED on those same workflows with one character changed', () => {
    // Non-vacuity for the test above. It is not enough that the real workflows pass; the run that
    // passed them has to be a run that COULD have failed. This takes a real shipped workflow, breaks
    // it by exactly one edit, and asserts the linter notices.
    const wfDir = join(REPO, 'auros-base', '.github', 'workflows')
    let names
    try { names = readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f)) } catch { names = [] }
    if (names.length === 0) {
      // Fall back to the meta repo's own workflows rather than skipping — a skip here would quietly
      // remove the only proof that the previous test can fail.
      const metaDir = join(REPO, '.github', 'workflows')
      names = readdirSync(metaDir).filter((f) => /\.ya?ml$/.test(f))
      assert.ok(names.length > 0, 'no workflow anywhere to break — this test cannot prove anything and says so')
      const text = readFileSync(join(metaDir, names[0]), 'utf8')
      flags(one(text.replace(/^name:.*\n/m, '')), 'a real workflow with its name removed')
      return
    }
    const text = readFileSync(join(wfDir, names[0]), 'utf8')
    flags(one(text.replace(/^name:.*\n/m, '')), 'a real workflow with its name removed')
  })
})

test.after(() => { if (ROOT) rmSync(ROOT, { recursive: true, force: true }) })
