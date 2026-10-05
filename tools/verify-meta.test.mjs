#!/usr/bin/env node --test
// VERIFY, VERIFIED — ./verify must go red when any suite does.
//
// LATHE D37: `verify` reported PASS over a failing recipe suite and a failing site build for most of a
// day, because both were run as `bash -c '… | tail -30'` and a pipeline's status is tail's. It was
// written by the author who had recorded that exact rule as D19 hours earlier. Knowing the rule did
// not protect against it; a test that breaks a suite on purpose and watches the aggregate is what
// found it. This is that test, for this repository's ./verify.
//
// Each case builds a sandbox — a copy of the parts of this repository the fast suites read, with a
// small honest website — breaks ONE thing, runs the real ./verify there, and asserts a non-zero exit
// and a FAIL line for that suite. The sandbox has no tools/unit-all.sh (the C suites skip) and no copy
// of this file (so verify does not recurse).
import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const TMP = mkdtempSync(join(tmpdir(), 'auros-verify-meta-'))
after(() => rmSync(TMP, { recursive: true, force: true }))
let seq = 0

function sandbox () {
  const d = join(TMP, `s${seq++}`)
  mkdirSync(d)
  for (const f of ['verify', 'LICENSE']) cpSync(join(REPO, f), join(d, f))
  for (const dir of ['recipes', 'hardware', 'profiles', 'build']) cpSync(join(REPO, dir), join(d, dir), { recursive: true, filter: (p) => !p.includes(`${join(REPO, 'build', 'gen')}`) })
  mkdirSync(join(d, 'tools'))
  for (const f of ['honesty-gate.mjs', 'honesty-gate.test.mjs', 'compat-lint.mjs', 'compat-lint.test.mjs']) cpSync(join(REPO, 'tools', f), join(d, 'tools', f))
  for (const dir of ['themes', 'shells', 'src', 'rootfs']) symlinkSync(join(REPO, dir), join(d, dir))
  mkdirSync(join(d, 'website'))
  writeFileSync(join(d, 'website', 'index.html'), '<!doctype html>\n<title>AurOS</title>\n<p>A desktop for an old Windows PC. Nothing here has been installed on a real PC yet.</p>\n')
  mkdirSync(join(d, 'docs'))
  writeFileSync(join(d, 'docs', 'TRY-IT.md'), '# Try it\n\nBoot the image in QEMU.\n')
  writeFileSync(join(d, 'README.md'), '# AurOS\n\nSee LICENSE.\n')
  return d
}
function verify (dir, only, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv }
  delete env.VERIFY_SLOW
  if (only === undefined) delete env.VERIFY_ONLY; else env.VERIFY_ONLY = only
  const r = spawnSync('bash', ['verify'], { cwd: dir, env, encoding: 'utf8', timeout: 600_000 })
  return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') }
}
const red = (r, suite) => {
  assert.notEqual(r.code, 0, `verify exited 0 with "${suite}" broken:\n${r.out.slice(-3000)}`)
  assert.match(r.out, new RegExp(`FAIL\\S*\\s+${suite.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `no FAIL line for ${suite}`)
}

describe('the script itself', () => {
  test('no `run` line pipes its command (D37): a pipeline\'s status is its last command\'s', () => {
    const lines = readFileSync(join(REPO, 'verify'), 'utf8').split('\n')
    const runs = []
    for (let i = 0; i < lines.length; i++) {
      if (!/^\s*run\s/.test(lines[i])) continue
      let s = lines[i]
      while (s.endsWith('\\') && i + 1 < lines.length) s = s.slice(0, -1) + lines[++i]
      runs.push(s)
    }
    assert.ok(runs.length >= 8, `only ${runs.length} run lines found — the parse is wrong`)
    for (const r of runs) assert.doesNotMatch(r.replace(/"[^"]*"/g, '""'), /\|/, `a run line pipes its command:\n  ${r}`)
  })
  test('pipefail is on', () => {
    assert.match(readFileSync(join(REPO, 'verify'), 'utf8'), /^set -uo pipefail$/m)
  })
})

describe('the control: an unbroken sandbox is green', () => {
  test('every suite the breakages below use passes before anything is broken', () => {
    const r = verify(sandbox(), 'recipes forge-resolve honesty-corpus honesty compat compat-test syntax')
    assert.equal(r.code, 0, r.out.slice(-4000))
    assert.match(r.out, / 7 passed · 0 failed/)
  })
})

describe('one thing broken, verify red', () => {
  test('a recipe test fails (node --test)', () => {
    const d = sandbox()
    const p = join(d, 'recipes', 'lib', 'recipe.mjs')
    writeFileSync(p, readFileSync(p, 'utf8').replace("  if ('screen_off_minutes' in desk) set(", '  if (false) set('))
    const r = verify(d, 'recipes compat')
    red(r, 'recipes:')
    assert.match(r.out, /PASS\S*\s+compat\.tsv honesty/, 'the other suite should still pass — one red line, not all')
  })
  test('the honesty gate finds a claim on the website (a script exiting 1)', () => {
    const d = sandbox()
    appendFileSync(join(d, 'website', 'index.html'), '<p>Trusted by schools across the county.</p>\n')
    red(verify(d, 'honesty'), 'honesty gate: website/')
  })
  test('the honesty gate cannot run at all (exit 2 is a failure too, not a skip)', () => {
    const d = sandbox()
    rmSync(join(d, 'LICENSE'))
    red(verify(d, 'honesty'), 'honesty gate: website/')
  })
  test('compat.tsv gets a vm row claiming wifi', () => {
    const d = sandbox()
    const header = readFileSync(join(d, 'hardware', 'compat.tsv'), 'utf8').split('\n')[0].split('\t')
    appendFileSync(join(d, 'hardware', 'compat.tsv'), header.map((c) => ({ model: 'qemu', source: 'vm', wifi: 'ok', tpm: '2.0' }[c] ?? '')).join('\t') + '\n')
    red(verify(d, 'compat'), 'compat.tsv honesty')
  })
  test('a build script stops parsing (a shell function suite)', () => {
    const d = sandbox()
    appendFileSync(join(d, 'build', 'mkimage'), '\nif then fi\n')
    red(verify(d, 'syntax'), 'bash -n / sh -n')
  })
  test('a profile stops resolving through forge', () => {
    const d = sandbox()
    writeFileSync(join(d, 'profiles', 'broken.profile'), 'inherit="no-such-parent"\nprofile_id="broken"\n')
    red(verify(d, 'forge-resolve'), 'build/forge resolve')
  })
  // Found by the adversarial review: two ways a suite went green over nothing, or never answered.
  test('a test file that runs no tests is not a pass (node --test reports it as one passing "test")', () => {
    const d = sandbox()
    writeFileSync(join(d, 'recipes', 'test', 'cli.test.mjs'), '// every test in this file was deleted\n')
    const r = verify(d, 'recipes')
    red(r, 'recipes:')
    assert.match(r.out, /ran no tests/)
  })
  test('a suite that hangs is a failure with a reason, not a verify that never ends', () => {
    const d = sandbox()
    writeFileSync(join(d, 'tools', 'compat-lint.mjs'), 'setInterval(() => {}, 1000)\n')
    const r = verify(d, 'compat', { VERIFY_TIMEOUT: '5' })
    red(r, 'compat.tsv honesty')
    assert.match(r.out, /timed out after 5s/)
  })
  test('nothing ran is not a pass: only skips, or an unknown suite id', () => {
    const d = sandbox()
    const r = verify(d, 'c-unit')
    assert.notEqual(r.code, 0, r.out)
    assert.match(r.out, /nothing ran/)
  })
  test('THE D37 BUG, REPRODUCED: the same broken suite piped through tail reports PASS — which is why the first test in this file exists', () => {
    const d = sandbox()
    const header = readFileSync(join(d, 'hardware', 'compat.tsv'), 'utf8').split('\n')[0].split('\t')
    appendFileSync(join(d, 'hardware', 'compat.tsv'), header.map((c) => ({ model: 'qemu', source: 'vm', wifi: 'ok', tpm: '2.0' }[c] ?? '')).join('\t') + '\n')
    const v = join(d, 'verify')
    const text = readFileSync(v, 'utf8')
    const piped = text.replace('run compat "compat.tsv honesty (no vm row claims a physical column)" node tools/compat-lint.mjs',
      `run compat "compat.tsv honesty (no vm row claims a physical column)" bash -c 'node tools/compat-lint.mjs 2>&1 | tail -3'`)
    assert.notEqual(piped, text, 'the compat run line moved; update this test')
    writeFileSync(v, piped)
    const r = verify(d, 'compat')
    assert.equal(r.code, 0, 'expected the piped form to hide the failure (that is the bug being demonstrated)')
    assert.match(r.out, /PASS\S*\s+compat\.tsv honesty/)
  })
})

describe('a node --test inside a node --test runs nothing and says it passed', () => {
  test('THE TRAP ITSELF, REPRODUCED: node --test inside node --test runs nothing and exits 0', () => {
    // This file runs under `node --test`, which sets NODE_TEST_CONTEXT for its children. A child
    // `node --test` that inherits it prints "run() is being called recursively", runs ZERO tests and
    // exits 0 — even over a test that fails. The first version of this meta-test passed its "a
    // recipe test fails" case for that reason alone. Shown here directly, against a failing test
    // file, so the demonstration does not depend on what verify does about it.
    assert.ok(process.env.NODE_TEST_CONTEXT, 'this test only means something when run by node --test')
    const d = join(TMP, `trap-${seq++}`)
    mkdirSync(d)
    writeFileSync(join(d, 'red.test.mjs'), "import { test } from 'node:test'\ntest('red', () => { throw new Error('red') })\n")
    const r = spawnSync(process.execPath, ['--test', 'red.test.mjs'], { cwd: d, env: process.env, encoding: 'utf8' })
    const out = (r.stdout ?? '') + (r.stderr ?? '')
    if (r.status !== 0) {
      // A node that no longer has the trap. Then there is nothing to demonstrate here — and the
      // guards below must still hold, so this is recorded, not passed vacuously.
      assert.doesNotMatch(out, /recursively/, `node exited ${r.status} but still reports recursion:\n${out}`)
      return
    }
    assert.match(out, /recursively/, `node --test exited 0 over a failing test without the recursion message:\n${out}`)
  })
  test('and verify is red over it TWICE: `unset NODE_TEST_CONTEXT`, and node_suite refusing a run in which nothing passed', () => {
    // Two independent guards. Each is removed in turn; the other must still turn verify red.
    const broken = () => {
      const d = sandbox()
      const p = join(d, 'recipes', 'lib', 'recipe.mjs')
      writeFileSync(p, readFileSync(p, 'utf8').replace("  if ('screen_off_minutes' in desk) set(", '  if (false) set('))
      return d
    }
    // 1. without the unset: node runs nothing (when the trap exists), and node_suite says so
    {
      const d = broken()
      const v = join(d, 'verify')
      const text = readFileSync(v, 'utf8')
      assert.match(text, /^unset NODE_TEST_CONTEXT$/m)
      writeFileSync(v, text.replace(/^unset NODE_TEST_CONTEXT$/m, ': unset removed'))
      const r = verify(d, 'recipes')
      red(r, 'recipes:')
      if (/recursively/.test(r.out)) assert.match(r.out, /no test passed/, 'the trap hid the tests and node_suite did not say so')
    }
    // 2. without node_suite's checks (plain node --test), the unset alone still lets the failure through
    {
      const d = broken()
      const v = join(d, 'verify')
      const text = readFileSync(v, 'utf8')
      const plain = text.replace(/^node_suite \(\) \{$/m, 'node_suite () { node --test --test-reporter=dot "$@"; return; }\nnode_suite_checked () {')
      assert.notEqual(plain, text, 'node_suite moved; update this test')
      writeFileSync(v, plain)
      red(verify(d, 'recipes'), 'recipes:')
    }
  })
})

describe('the whole script, end to end', () => {
  test('a full ./verify in a sandbox with one break exits non-zero and names it in the summary', () => {
    const d = sandbox()
    appendFileSync(join(d, 'website', 'index.html'), '<p>AurOS works on every PC.</p>\n')
    const r = verify(d)
    assert.notEqual(r.code, 0, r.out.slice(-3000))
    assert.match(r.out, /════ \d+ passed · 1 failed · \d+ skipped ════/)
    assert.match(r.out, /FAILED\S*\s+honesty gate: website\//)
    assert.match(r.out, /SKIP:\S*\s+needs tools\/unit-all\.sh/)
  })
})
