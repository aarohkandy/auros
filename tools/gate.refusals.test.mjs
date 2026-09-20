#!/usr/bin/env node --test
// PUBLISH GATE — the refusal paths that `tools/gate.test.mjs` does not already cover.
//
//   node --test tools/gate.refusals.test.mjs
//
// WHY A SECOND FILE. gate.test.mjs owns the refusal catalogue and the PreToolUse hook. This file owns
// the *shapes a ledger can take on a filesystem* — line endings, padding, byte-identical duplication,
// symlinks, permissions, encoding — plus the two meta-properties that make the catalogue mean
// anything: that no argument or environment variable can relax a verdict, and that every path this
// suite asserts is REACHABLE (a refusal nothing can trigger is indistinguishable from a refusal that
// does not exist).
//
// THE BIAS, restated because it is the point: spec §6C says the abort path is tested more than the
// happy path, and a gate is nothing but abort paths. There are 2 allow assertions in this file and
// they exist only so the refusals cannot pass vacuously — a gate that refuses a genuine full pass
// satisfies every refusal test here while being exactly as useless as one that allows everything.
//
// EVERY TEST HERE ANSWERS "WHAT WOULD MAKE THIS GO RED?". Where a test asserts a refusal, it also
// asserts that the SAME fixture minus the one defect ALLOWS. That pairing is the whole discipline:
// it is not possible for these to pass because the gate refuses unconditionally.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtempSync, writeFileSync, mkdirSync, symlinkSync, chmodSync, rmSync, readFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

import {
  decide, main, parseLedger,
  MATRIX_VERSION, REQUIRED_CHECKS, KNOWN_PROFILES, HEADER, DEFAULT_PATHS, DIGEST_RE,
} from './gate.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GATE = join(HERE, 'gate.mjs')

const CONFIG = JSON.parse(readFileSync(DEFAULT_PATHS.config, 'utf8'))
const BASE_IMAGE = `${CONFIG.registry}/${CONFIG.org}/${CONFIG.product}-base`

const DIGEST = 'sha256:' + 'ab12'.repeat(16)
const ALL_CHECKS = `${REQUIRED_CHECKS.join(',')}/${REQUIRED_CHECKS.length}`
const ALL_PROFILES = `${KNOWN_PROFILES.join(',')}/${KNOWN_PROFILES.length}`
const NOW = new Date(Date.now() - 60_000).toISOString().replace(/\.\d+Z$/, 'Z')

let TMP
const tmp = () => (TMP ??= mkdtempSync(join(tmpdir(), 'auros-gate-refusals-')))
let n = 0
const scratch = (name = 'ledger') => join(tmp(), `${name}-${n++}.tsv`)

const headerLine = () => HEADER.join('\t')
function rowLine (over = {}) {
  const r = {
    digest: DIGEST, image: BASE_IMAGE, recipe: '-', matrix_version: String(MATRIX_VERSION),
    profiles_passed: ALL_PROFILES, checks_passed: ALL_CHECKS,
    run_url: 'https://github.com/aarohkandy/auros-base/actions/runs/1234567890',
    recorded_at: NOW, recorded_by: 'github-actions[bot]', ...over,
  }
  return HEADER.map((h) => r[h]).join('\t')
}
/** A ledger whose ONLY content is a full, valid, current pass for DIGEST. The control for every
 *  test below: each defect is introduced into exactly this text, so a refusal can only be caused by
 *  the defect and never by the fixture being broken in some other way. */
const GOOD = `${headerLine()}\n${rowLine()}\n`

/** Write `text` to a fresh path and hand back the paths object `decide` should read. */
function at (text, name) {
  const p = scratch(name)
  writeFileSync(p, text)
  return { ...DEFAULT_PATHS, ledger: p }
}

function refuses (paths, why, query = { digest: DIGEST }) {
  const d = decide(query, paths)
  assert.equal(d.allowed, false, `expected a REFUSAL (${why}) but the gate ALLOWED: ${d.reason}`)
  assert.ok(typeof d.code === 'string' && d.code.length > 0, 'every refusal must carry a machine-readable code')
  assert.ok(typeof d.reason === 'string' && d.reason.length > 20,
    `a refusal must explain itself to the person who meets it at 2am, or they route around it; got "${d.reason}"`)
  return d
}
function allows (paths, why, query = { digest: DIGEST }) {
  const d = decide(query, paths)
  assert.equal(d.allowed, true, `expected an ALLOW (${why}) but the gate refused [${d.code}]: ${d.reason}`)
  return d
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 0. NON-VACUITY. If this block fails, nothing else in this file means anything: every refusal
//    assertion below would be satisfied by a gate that simply never allows.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('the control: the gate CAN go green, so the refusals below are not vacuous', () => {
  test('the unmodified control ledger ALLOWS its digest', () => {
    const d = allows(at(GOOD), 'a complete, current, unambiguous recorded pass')
    assert.match(d.reason, /\d+\/\d+ profiles/)
    assert.match(d.reason, /matrix v1/)
  })

  test('the control ledger still REFUSES a digest it does not name', () => {
    // Green for the right digest is not the same as green for anything. Both halves, one fixture.
    refuses(at(GOOD), 'a digest with no row', { digest: 'sha256:' + 'ff00'.repeat(16) })
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 1. LINE ENDINGS AND WHITESPACE. A ledger is edited by humans, written by CI on two operating
//    systems, and round-tripped through editors. Every one of those can introduce a byte that is
//    invisible in a diff. The gate must treat "invisible" as "malformed", never as "close enough" —
//    a gate that trims its way to a match is a gate that can be made to match.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('line endings and padding', () => {
  test('REFUSES a row with a trailing CR (a CRLF ledger)', () => {
    // The CR lands on the LAST field, recorded_by, so the row parses structurally and dies on the
    // whitespace check. This is the exact shape a Windows editor or a PowerShell redirect produces.
    const d = refuses(at(`${headerLine()}\n${rowLine()}\r\n`), 'CRLF row')
    assert.equal(d.code, 'malformed-ledger')
    assert.match(d.reason, /recorded_by/, 'the refusal must name the field the invisible byte landed on')
  })

  test('REFUSES a header with a trailing CR', () => {
    const d = refuses(at(`${headerLine()}\r\n${rowLine()}\n`), 'CRLF header')
    assert.equal(d.code, 'malformed-ledger')
    assert.match(d.reason, /header must be exactly/)
  })

  test('REFUSES a whole ledger written with CRLF throughout', () => {
    refuses(at(`${headerLine()}\r\n${rowLine()}\r\n`), 'CRLF everywhere')
  })

  test('REFUSES a digest padded with spaces inside its field', () => {
    // The dangerous version of this bug is the one that "helpfully" trims: ` sha256:ab12… ` would
    // then match the digest under test, and a ledger row nobody can see would be a passing row.
    const d = refuses(at(`${headerLine()}\n${rowLine({ digest: ` ${DIGEST} ` })}\n`), 'padded digest')
    assert.equal(d.code, 'malformed-ledger')
  })

  test('REFUSES a whitespace-padded field in EVERY column, one at a time', () => {
    // Exhaustive rather than representative: the padding check is one line of code and a later
    // refactor that skips a single column would be invisible to a spot check.
    for (const col of HEADER) {
      const base = Object.fromEntries(HEADER.map((h) => [h, undefined]))
      const line = rowLine()
      const fields = line.split('\t')
      const i = HEADER.indexOf(col)
      fields[i] = ` ${fields[i]}`
      const d = decide({ digest: DIGEST }, at(`${headerLine()}\n${fields.join('\t')}\n`))
      assert.equal(d.allowed, false, `a leading space in "${col}" was accepted — the gate trimmed its way to a match`)
      assert.equal(d.code, 'malformed-ledger', `padding in "${col}" must be a malformed ledger, got ${d.code}`)
      assert.ok(base, '')
    }
  })

  test('REFUSES a row whose fields are separated by SPACES instead of tabs', () => {
    const d = refuses(at(`${headerLine()}\n${rowLine().replace(/\t/g, ' ')}\n`), 'space-separated row')
    assert.equal(d.code, 'malformed-ledger')
  })

  test('REFUSES a ledger with a UTF-8 BOM on the header', () => {
    // A BOM makes the first header cell "﻿digest", which is not "digest". The gate must notice.
    refuses(at(`﻿${headerLine()}\n${rowLine()}\n`), 'BOM')
  })

  test('a trailing newline and a blank line between rows are NOT defects', () => {
    // The mirror of the tests above, and it is here on purpose: a gate so strict that ordinary,
    // harmless file hygiene trips it gets switched off. Blank lines are skipped by design.
    allows(at(`${headerLine()}\n\n${rowLine()}\n\n`), 'blank lines around a valid row')
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 2. DUPLICATION. Two claims about the same bytes is a ledger that cannot be trusted, whether the
//    two rows agree or not. Especially when they agree: a byte-identical duplicate is what an
//    append that ran twice looks like, and "it is the same row so it is fine" is how a ledger stops
//    being a record of what happened.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('duplicate rows', () => {
  test('REFUSES a BYTE-IDENTICAL duplicated row', () => {
    const d = refuses(at(`${headerLine()}\n${rowLine()}\n${rowLine()}\n`), 'identical duplicate')
    assert.equal(d.code, 'duplicate-rows')
    assert.match(d.reason, /lines 2, 3/, 'the refusal must name both lines so a human can delete the right one')
  })

  test('REFUSES a duplicate that differs only in run_url — the later row does not win', () => {
    const a = rowLine()
    const b = rowLine({ run_url: 'https://github.com/aarohkandy/auros-base/actions/runs/9999999999' })
    refuses(at(`${headerLine()}\n${a}\n${b}\n`), 'two live rows, one newer')
  })

  test('REFUSES when a duplicate pair disagrees about the PROFILES that passed', () => {
    // The worst version: one row says a full pass, the other says a partial one. A gate that took
    // the first match would publish on the strength of whichever row the appender happened to write
    // first, which is not a decision anybody made.
    const full = rowLine()
    const partial = rowLine({ profiles_passed: `uefi-modern/${KNOWN_PROFILES.length}` })
    refuses(at(`${headerLine()}\n${full}\n${partial}\n`), 'full row plus partial row')
    refuses(at(`${headerLine()}\n${partial}\n${full}\n`), 'partial row plus full row (order reversed)')
  })

  test('a SECOND digest in the ledger is not a duplicate — the control for the rule above', () => {
    const other = rowLine({ digest: 'sha256:' + 'cd34'.repeat(16) })
    allows(at(`${headerLine()}\n${rowLine()}\n${other}\n`), 'two rows, two different digests')
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 3. THE LEDGER AS A FILESYSTEM OBJECT. gate.mjs derives the ledger path from its own location so
//    that the working directory cannot change which file decides. That is only half the property:
//    the path also has to be the file a reviewer would open. A symlink is a second name for bytes
//    somewhere else, and "somewhere else" is exactly where a build step writes.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('the ledger has to be a real file at the real path', () => {
  test('REFUSES a ledger that is a SYMLINK, even when the link target is a perfectly valid pass', () => {
    const real = scratch('real-target')
    writeFileSync(real, GOOD)
    const link = scratch('link')
    symlinkSync(real, link)

    // Control first: the target itself allows. So the refusal below is caused by the LINK and by
    // nothing else — without this line the test would also pass if the fixture were simply broken.
    allows({ ...DEFAULT_PATHS, ledger: real }, 'the link target read directly')

    const d = refuses({ ...DEFAULT_PATHS, ledger: link }, 'the same bytes reached through a symlink')
    assert.equal(d.code, 'ledger-not-a-regular-file')
    assert.match(d.reason, /symbolic link/)
  })

  test('REFUSES a DANGLING symlink rather than reporting a confusing read error', () => {
    const link = scratch('dangling')
    symlinkSync(join(tmp(), 'does-not-exist-at-all.tsv'), link)
    refuses({ ...DEFAULT_PATHS, ledger: link }, 'a symlink to nothing')
  })

  test('REFUSES a directory where the ledger should be', () => {
    const d = join(tmp(), `dir-${n++}`)
    mkdirSync(d)
    refuses({ ...DEFAULT_PATHS, ledger: d }, 'a directory as the ledger')
  })

  test('REFUSES a ledger whose permissions make it unreadable', (t) => {
    if (process.getuid && process.getuid() === 0) return t.skip('running as root — mode 000 is readable, so this proves nothing here')
    const p = scratch('unreadable')
    writeFileSync(p, GOOD)
    chmodSync(p, 0o000)
    try {
      // Control: the same bytes at mode 644 allow. Restoring the mode and re-asserting proves the
      // refusal is the permission and not the content.
      const d = refuses({ ...DEFAULT_PATHS, ledger: p }, 'mode 000 ledger')
      assert.equal(d.code, 'no-ledger')
      chmodSync(p, 0o644)
      allows({ ...DEFAULT_PATHS, ledger: p }, 'the same file once it is readable again')
    } finally { try { chmodSync(p, 0o644) } catch {} }
  })

  test('REFUSES a ledger that is absent entirely', () => {
    refuses({ ...DEFAULT_PATHS, ledger: join(tmp(), 'never-created.tsv') }, 'no ledger file')
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 4. THE ROWS THEMSELVES. Each of these is a single-character or single-field defect introduced
//    into GOOD. Each is paired with the control that the undefected fixture allows, which is what
//    makes the refusal attributable.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('row-level defects, each against a passing control', () => {
  const cases = [
    ['a digest one character off',
      { q: { digest: DIGEST.slice(0, -1) + 'c' } }, 'digest-absent'],
    ['a digest that is a PREFIX of the recorded one',
      { q: { digest: DIGEST.slice(0, 40) } }, 'not-a-digest'],
    ['a digest with the recorded one as ITS prefix (longer)',
      { q: { digest: DIGEST + 'ab' } }, 'not-a-digest'],
    ['an uppercase spelling of the recorded digest',
      { q: { digest: 'sha256:' + 'AB12'.repeat(16) } }, 'not-a-digest'],
    ['a mixed-case spelling of the recorded digest',
      { q: { digest: 'sha256:' + 'Ab12'.repeat(16) } }, 'not-a-digest'],
    ['a tag instead of a digest',
      { q: { digest: `${BASE_IMAGE}:hardened` } }, 'not-a-digest'],
    ['the empty string as a digest', { q: { digest: '' } }, 'no-digest'],
    ['a stale matrix_version', { row: { matrix_version: String(MATRIX_VERSION - 1) } }, 'stale-matrix-version'],
    ['a matrix_version from the future', { row: { matrix_version: String(MATRIX_VERSION + 1) } }, 'stale-matrix-version'],
    ['a partial profile pass',
      { row: { profiles_passed: `uefi-modern,low-ram/${KNOWN_PROFILES.length}` } }, 'partial-profile-pass'],
    ['a profile that is not in profiles.yaml',
      { row: { profiles_passed: `${KNOWN_PROFILES.slice(1).join(',')},acme-special/${KNOWN_PROFILES.length}` } }, 'unknown-profile'],
    ['a profile listed twice to make the count add up',
      { row: { profiles_passed: `${KNOWN_PROFILES.slice(0, -1).join(',')},uefi-modern/${KNOWN_PROFILES.length}` } }, 'duplicate-profile'],
    ['zero bound profiles', { row: { profiles_passed: 'uefi-modern/0' } }, 'no-profiles-bound'],
    ['one required check missing',
      { row: { checks_passed: `${REQUIRED_CHECKS.slice(0, -1).join(',')}/${REQUIRED_CHECKS.length}` } }, 'incomplete-checks'],
    ['one required check swapped for an invented one',
      // This refuses as `incomplete-checks`, not `unknown-check`, because the missing-check test runs
      // first and R1 is now absent. Asserting the code the gate ACTUALLY returns, rather than the one
      // that reads best, is the point — a test written to the prettier code would have been "fixed"
      // later by reordering the gate, which would change what it refuses.
      { row: { checks_passed: `${REQUIRED_CHECKS.slice(0, -1).join(',')},Z9/${REQUIRED_CHECKS.length}` } }, 'incomplete-checks'],
    ['an invented check ADDED to a complete set — the only shape that reaches unknown-check',
      { row: { checks_passed: `${REQUIRED_CHECKS.join(',')},Z9/${REQUIRED_CHECKS.length}` } }, 'unknown-check'],
    ['the right digest but a foreign image',
      { row: { image: 'ghcr.io/somebody-else/auros-base' } }, 'foreign-image'],
    ['the right digest but the wrong image in OUR namespace',
      { q: { digest: DIGEST, image: `${BASE_IMAGE}-kiosk` } }, 'image-mismatch'],
    ['the right digest but a recipe the pass was not for',
      { q: { digest: DIGEST, recipe: 'lincoln' } }, 'recipe-mismatch'],
    ['a run_url nobody can reopen', { row: { run_url: 'internal-build-4412' } }, 'malformed-ledger'],
    ['an http (not https) run_url', { row: { run_url: 'http://github.com/x/y/actions/runs/1' } }, 'malformed-ledger'],
    ['a recorded_at in the future', { row: { recorded_at: '2099-01-01T00:00:00Z' } }, 'malformed-ledger'],
    ['a recorded_at that is not a real instant', { row: { recorded_at: '2026-02-30T00:00:00Z' } }, 'malformed-ledger'],
    ['a digest field that is a tag', { row: { digest: 'latest' } }, 'malformed-ledger'],
    ['an image field carrying a tag', { row: { image: `${BASE_IMAGE}:hardened` } }, 'malformed-ledger'],
    ['an empty recipe field (not "-")', { row: { recipe: '' } }, 'malformed-ledger'],
  ]

  for (const [name, mut, expectedCode] of cases) {
    test(`REFUSES ${name}`, () => {
      const paths = at(`${headerLine()}\n${rowLine(mut.row ?? {})}\n`)
      // Control: the SAME query against the undefected ledger allows, unless the defect is in the
      // query itself, in which case the control is the plain query against the same ledger.
      if (mut.row) allows(paths === undefined ? at(GOOD) : at(GOOD), `control for "${name}"`)
      else allows(paths, `control for "${name}" (the row is fine; the query is the defect)`)

      const d = refuses(paths, name, mut.q ?? { digest: DIGEST })
      assert.equal(d.code, expectedCode, `"${name}" should refuse with [${expectedCode}], got [${d.code}]: ${d.reason}`)
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 5. NO BYPASS. The claim in gate.mjs's header comment is "no parameter, no environment variable and
//    no command-line flag turns a refusal into an allow". A claim in a comment is decoration. These
//    execute it.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('nothing relaxes the gate', () => {
  const BYPASS_FLAGS = [
    '--force', '-f', '--yes', '-y', '--allow', '--skip-gate', '--no-verify', '--override',
    '--ledger', '--ledger=/tmp/x.tsv', '--dry-run', '--emergency', '--i-know-what-im-doing',
    '--matrix-version=0', '--profiles=uefi-modern', '--checks=all', '--trust', '--insecure',
  ]

  test('every plausible bypass flag is a fatal argument error, never a silent no-op', () => {
    for (const flag of BYPASS_FLAGS) {
      const orig = console.error
      console.error = () => {}
      let code
      try { code = main([DIGEST, flag]) } finally { console.error = orig }
      assert.equal(code, 2, `"${flag}" did not produce an argument error (exit 2); it exited ${code}. ` +
        'A flag the parser tolerates is a flag someone will ship in a workflow and believe in.')
    }
  })

  test('a bypass flag BEFORE the digest is equally fatal', () => {
    for (const flag of BYPASS_FLAGS) {
      const orig = console.error
      console.error = () => {}
      let code
      try { code = main([flag, DIGEST]) } finally { console.error = orig }
      assert.equal(code, 2, `"${flag}" placed first exited ${code}, not 2`)
    }
  })

  test('the CLI exit code for a real refusal is 1, and for unparseable input is 2 — never 0', () => {
    const orig = console.error; const origLog = console.log
    console.error = () => {}; console.log = () => {}
    try {
      assert.equal(main(['sha256:' + '00ff'.repeat(16)]), 1, 'an unrecorded digest must exit 1')
      assert.equal(main([]), 2, 'no arguments must exit 2')
      assert.equal(main(['not-a-digest']), 1, 'a tag is a refusal (exit 1), because the gate has a real answer for it')
      assert.equal(main(['record', '--results', 'results.json']), 2, 'a subcommand that does not exist must exit 2')
      assert.equal(main([DIGEST, '--image']), 2, '--image with no value must exit 2')
      assert.equal(main([DIGEST, '--recipe', '--image']), 2, 'a flag consumed as a value must exit 2')
      assert.equal(main([DIGEST, 'extra']), 2, 'a second positional must exit 2')
    } finally { console.error = orig; console.log = origLog }
  })

  test('no environment variable changes the verdict — tried against the real CLI, not a mock', () => {
    // The shipped ledger records nothing, so the real CLI must refuse regardless of what is in the
    // environment. `AUROS_LEDGER` is in this list because a workflow in auros-recipes was written as
    // if it worked; it does not, and this test is what keeps that true rather than hopeful.
    const poison = {
      AUROS_LEDGER: join(tmp(), 'poison.tsv'),
      AUROS_FORCE: '1', AUROS_SKIP_GATE: '1', AUROS_ALLOW: 'true', AUROS_GATE: 'off',
      GATE_BYPASS: '1', CI: 'true', FORCE: '1', NODE_ENV: 'production', AUROS_MATRIX_VERSION: '0',
    }
    writeFileSync(poison.AUROS_LEDGER, GOOD)   // a *valid full pass* sitting where the env var points

    let threw = null
    try {
      execFileSync(process.execPath, [GATE, DIGEST], {
        env: { ...process.env, ...poison }, encoding: 'utf8', stdio: 'pipe',
      })
    } catch (e) { threw = e }
    assert.ok(threw, 'the gate ALLOWED a digest that only the environment vouched for. There is a bypass.')
    assert.equal(threw.status, 1, `expected exit 1 (refused), got ${threw.status}`)
    assert.match(String(threw.stderr), /REFUSED/)
  })

  test('gate.mjs contains no read of process.env and no allow that is not the final one', () => {
    // A source-text assertion, which is weak on its own — so it is paired with the execution test
    // above rather than standing in for it. Its job is to catch a bypass added later in a form the
    // execution test would not think to try.
    const src = readFileSync(GATE, 'utf8')
    const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
    assert.doesNotMatch(code, /process\.env/, 'gate.mjs reads process.env — the ledger is no longer the only input')
    assert.doesNotMatch(code, /allowed:\s*true/g.source && /allowed: true[^}]*\}\s*\)?\s*$/m,
      'an `allowed: true` outside the single allow() helper')
    const allowSites = [...code.matchAll(/allowed:\s*true/g)]
    assert.equal(allowSites.length, 1,
      `there must be exactly ONE place in gate.mjs that can produce allowed:true; found ${allowSites.length}. ` +
      'Every additional one is a second gate, and the weaker of two gates is the one that gets used.')
  })

  test('the ledger path cannot be supplied on the command line in any spelling', () => {
    const spellings = ['--ledger', '--ledger-path', '--attest', '--tsv', '--file', '--results', '--from']
    for (const s of spellings) {
      const orig = console.error
      console.error = () => {}
      let code
      try { code = main([DIGEST, s, join(tmp(), 'poison.tsv')]) } finally { console.error = orig }
      assert.equal(code, 2, `"${s}" was accepted as a way to point the gate at a different ledger`)
    }
  })

  test('decide() cannot be handed a ledger STRING instead of a path and be talked into an allow', () => {
    // paths.ledger is read from disk, never interpreted. Passing the ledger *text* must fail to
    // resolve rather than being parsed as content.
    refuses({ ...DEFAULT_PATHS, ledger: GOOD }, 'ledger contents passed where a path belongs')
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 6. THE SHIPPED STATE. What the repository actually contains, right now, decided by the real gate
//    against the real ledger. If this ever goes green without a CI run behind it, a pass was
//    fabricated by hand.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('the repository as it stands', () => {
  test('the real ledger is a regular file, parses cleanly, and records zero passes', () => {
    const text = readFileSync(DEFAULT_PATHS.ledger, 'utf8')
    const { rows, problems } = parseLedger(text)
    assert.deepEqual(problems, [], 'the shipped ledger does not parse — every publish is refused until it does')
    assert.equal(rows.length, 0,
      `the shipped ledger has ${rows.length} row(s). No image has passed the matrix in CI yet, so any row here ` +
      'is a fabricated pass — an example row in this file is not documentation, it is a forged attestation.')
  })

  test('the real gate REFUSES the base image digest that GATE.md reports booting', () => {
    // GATE.md names sha256:911281f2…d0d2f1 as the UPSTREAM base that pulls and boots. Booting is not
    // passing the matrix. This asserts we have not quietly confused the two.
    const d = decide({ digest: 'sha256:' + '911281f2'.repeat(8) })
    assert.equal(d.allowed, false, 'the gate allowed a digest for which no matrix pass is recorded')
  })

  test('every gate.mjs path named in any workflow RESOLVES to a file that exists', async () => {
    // Resolution is done the way the runner does it: a workflow's working directory is its own
    // checkout, and any OTHER repo it reads is one it checked out with actions/checkout under an
    // explicit `path:`. So we read those (repository, path) pairs out of the workflow itself rather
    // than hard-coding a convention — a convention is the thing that drifts.
    // The class of bug this catches: `node .auros-base/../tools/gate.mjs` in auros-recipes, which
    // normalises to `tools/gate.mjs` — a path that repo does not have. The step then dies with
    // "Cannot find module", which fails closed but reads like an infrastructure error rather than
    // like a gate, and the publish path is broken until somebody reads the log carefully.
    //
    // This test can only speak about repos that are checked out beside us (D6), and it says so
    // rather than passing on an empty scan.
    const { readdirSync, existsSync } = await import('node:fs')
    const { normalize } = await import('node:path')
    const repoRoot = join(HERE, '..')
    // Where each repository lives on this disk (D6: the four product repos are nested here).
    const ON_DISK = {
      'aarohkandy/auros': repoRoot,
      'aarohkandy/auros-base': join(repoRoot, 'auros-base'),
      'aarohkandy/auros-recipes': join(repoRoot, 'auros-recipes'),
      'aarohkandy/auros-installer': join(repoRoot, 'auros-installer'),
      'aarohkandy/auros-web': join(repoRoot, 'auros-web'),
    }
    const repos = ['auros-base', 'auros-recipes', 'auros-installer', 'auros-web', '.']
    const seen = []
    const problems = []

    /** Read `actions/checkout` steps and return [{ prefix, dir }] — the extra repos this workflow mounts. */
    function checkouts (text) {
      const lines = text.split('\n')
      // `repository:` is often written as `${{ env.META_REPO }}`, so the workflow's own env map has
      // to be resolved before the value means anything. Resolving it rather than pattern-matching
      // around it is what lets this test say "this path does not exist" and be believed.
      const env = {}
      for (const m of text.matchAll(/^\s{2,}([A-Z][A-Z0-9_]+):\s*'?([\w.\-\/]+)'?\s*$/gm)) env[m[1]] = m[2]
      const resolve = (raw) => {
        const v = raw.trim().replace(/^["']|["'],?$/g, '').replace(/,$/, '')
        const expr = /^\$\{\{\s*env\.([A-Z0-9_]+)\s*\}\}$/.exec(v)
        return expr ? env[expr[1]] : v
      }

      const out = []
      for (let i = 0; i < lines.length; i++) {
        const repoM = /repository:\s*(.+?)\s*$/.exec(lines[i])
        if (!repoM) continue
        // Flow style closes with `}` on the same line and may carry `path:` after a comma; block
        // style runs to end of line and can legitimately END in `}}` (a `${{ }}` expression), which
        // is why the two shapes are separated instead of sharing one clever regex.
        const isFlow = /with:\s*\{/.test(lines[i])
        const repo = resolve(isFlow ? repoM[1].replace(/\}\s*$/, '').split(',')[0] : repoM[1])
        if (!repo || !repo.includes('/')) continue
        const inline = /path:\s*([^\s,}]+)/.exec(lines[i])
        if (inline) { out.push({ repo, prefix: inline[1] }); continue }
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
          const pm = /^\s*path:\s*(\S+)\s*$/.exec(lines[j])
          if (pm) { out.push({ repo, prefix: pm[1] }); break }
          if (/^\s*-\s/.test(lines[j])) break            // the next step began
        }
      }
      return out
        .filter((c) => ON_DISK[c.repo])
        .map((c) => ({ prefix: normalize(c.prefix.replace(/\/$/, '')), dir: ON_DISK[c.repo] }))
    }

    for (const repo of repos) {
      const wfDir = join(repoRoot, repo, '.github', 'workflows')
      let files
      try { files = readdirSync(wfDir) } catch { continue }
      for (const f of files) {
        if (!/\.ya?ml$/.test(f)) continue
        const where = `${repo === '.' ? 'auros' : repo}/.github/workflows/${f}`
        const text = readFileSync(join(wfDir, f), 'utf8')
        const mounts = checkouts(text)
        const ownDir = repo === '.' ? repoRoot : join(repoRoot, repo)
        for (const line of text.split('\n')) {
          if (/^\s*#/.test(line)) continue
          for (const m of line.matchAll(/node\s+(\S*gate\.mjs)/g)) {
            const rel = normalize(m[1])          // `.auros-base/../tools/gate.mjs` → `tools/gate.mjs`
            seen.push(`${where}: ${m[1]}`)
            const tried = []
            // A path under one of this workflow's checkout prefixes resolves inside THAT repo;
            // anything else resolves inside the workflow's own checkout.
            const mount = mounts.find((c) => rel === c.prefix || rel.startsWith(c.prefix + '/'))
            if (mount) tried.push(join(mount.dir, rel.slice(mount.prefix.length + 1)))
            tried.push(join(ownDir, rel))
            if (!tried.some((p) => existsSync(p))) {
              problems.push(
                `${where} runs \`node ${m[1]}\`, which resolves to no file that exists in any checkout this ` +
                `workflow makes (tried: ${tried.map((p) => p.replace(repoRoot + '/', '')).join(', ')}). ` +
                'The step dies with "Cannot find module" before the gate runs. It fails closed, but the ' +
                'publish path is broken and the log reads like an infrastructure error, not like a gate.')
            }
          }
        }
      }
    }
    assert.ok(seen.length > 0,
      'found no gate.mjs invocation in any checked-out workflow. Either no repo is checked out beside us, or ' +
      'nothing calls the publish gate at all — and this test refuses to pass on an empty scan either way.')
    assert.deepEqual(problems, [], `\n  - ${problems.join('\n  - ')}\n`)
  })
})

test.after(() => { if (TMP) rmSync(TMP, { recursive: true, force: true }) })
