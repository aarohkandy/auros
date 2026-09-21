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
  mkdtempSync, writeFileSync, mkdirSync, symlinkSync, chmodSync, rmSync, readFileSync, realpathSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

import {
  decide, main, parseLedger, assertPublishable,
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
    assert.match(d.reason, new RegExp(`matrix v${MATRIX_VERSION}`))
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


// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 7. WHAT A MUTATION RUN FOUND THIS SUITE COULD NOT SEE
//
// Everything from here down was written against a specific surviving mutation: a change to
// tools/gate.mjs that made the gate weaker while all 334 tests stayed green. Each block names the
// mutation it kills, and each was confirmed by re-applying that mutation and watching the new test
// go red. A test added without re-running the mutation is a guess.
//
// The two rules they all obey, both of which came from real bugs in this repo:
//   1. A check that cannot fail is not a check. Every block below has a stated answer to "what makes
//      this go red?", and a CONTROL asserting the same fixture minus the one defect still ALLOWS.
//   2. Test the refusals harder than the happy path.
// ═════════════════════════════════════════════════════════════════════════════════════════════════

// ── 7.1 The header is the ledger's schema declaration ────────────────────────────────────────────
// M01: `fields.length !== HEADER.length || fields.some(...)` → `fields.some(...)`.
// `some()` only iterates the fields that are PRESENT, so a header of 8 columns matches the first 8
// of HEADER vacuously and the file is accepted. A row underneath it then publishes. If the header can
// be short, the file a reviewer reads and the file the gate parses are not the same document.
describe('the header must be the whole header', () => {
  test('REFUSES a header with FEWER columns than HEADER', () => {
    const short = HEADER.slice(0, -1).join('\t')            // recorded_by dropped
    const d = refuses(at(`${short}\n${rowLine()}\n`), 'a header missing its last column')
    assert.equal(d.code, 'malformed-ledger')
    assert.match(d.reason, /header must be exactly/)
  })

  test('REFUSES a header truncated at EVERY prefix length, not merely by one column', () => {
    for (let k = 1; k < HEADER.length; k++) {
      const d = decide({ digest: DIGEST }, at(`${HEADER.slice(0, k).join('\t')}\n${rowLine()}\n`))
      assert.equal(d.allowed, false,
        `a ${k}-column header was accepted as this ledger's schema, and the row under it published`)
      assert.equal(d.code, 'malformed-ledger', `a ${k}-column header refused as ${d.code}`)
    }
  })

  test('REFUSES a header with MORE columns than HEADER', () => {
    refuses(at(`${HEADER.join('\t')}\textra\n${rowLine()}\n`), 'an over-long header')
  })

  test('REFUSES a header whose columns are the right ones in the wrong ORDER', () => {
    const swapped = [...HEADER]
    ;[swapped[0], swapped[1]] = [swapped[1], swapped[0]]
    refuses(at(`${swapped.join('\t')}\n${rowLine()}\n`), 'digest and image transposed')
  })

  test('CONTROL: the exact header, and only the exact header, ALLOWS', () => {
    allows(at(GOOD), 'the unmodified header')
  })
})

// ── 7.2 Every required check, one at a time ──────────────────────────────────────────────────────
// M36: `REQUIRED_CHECKS.filter(...)` → `REQUIRED_CHECKS.slice(1).filter(...)`, so S1 is never
// required and a row recording 27 of 28 checks publishes. It survived because EVERY incomplete-checks
// test in this repo dropped the LAST element (`REQUIRED_CHECKS.slice(0, -1)`). One check at one end
// of one array, untested — which is the exact shape of "a skipped check is a failed check" failing
// silently. A loop over the whole matrix is the only thing that closes it, and it stays correct when
// the matrix grows.
describe('a skipped check is a failed check — every id in the matrix, individually', () => {
  for (const missing of REQUIRED_CHECKS) {
    test(`REFUSES a row whose checks_passed omits ${missing}`, () => {
      const kept = REQUIRED_CHECKS.filter((c) => c !== missing)
      assert.equal(kept.length, REQUIRED_CHECKS.length - 1, 'the fixture did not actually drop a check')
      const d = refuses(at(`${headerLine()}\n${rowLine({
        checks_passed: `${kept.join(',')}/${REQUIRED_CHECKS.length}`,   // declared count still says 28
      })}\n`), `${missing} absent from a row that still declares a full matrix`)
      assert.equal(d.code, 'incomplete-checks')
      assert.ok(d.reason.includes(`missing ${missing}.`),
        `the refusal must name ${missing}, or the operator does not know which check to go and run; got: ${d.reason}`)
    })
  }

  test(`CONTROL: all ${REQUIRED_CHECKS.length} checks recorded ALLOWS — the loop above is not vacuous`, () => {
    allows(at(GOOD), 'a complete check set')
  })
})

// ── 7.3 A duplicated check id cannot pad a row to look complete ──────────────────────────────────
// M38: `if (chk.items.length !== checkSet.size)` → `if (false)`. Duplication is how a row pads its
// count to look complete while a real check is absent: the declared-count test and the missing-set
// test are both satisfied because the SET still contains everything. The suite had a duplicate-PROFILE
// test, so the pattern was known — there was simply no duplicate-CHECK test.
describe('duplicate check ids', () => {
  test('REFUSES a row whose checks_passed lists a check twice', () => {
    const d = refuses(at(`${headerLine()}\n${rowLine({
      checks_passed: `S1,${REQUIRED_CHECKS.join(',')}/${REQUIRED_CHECKS.length}`,
    })}\n`), 'S1 listed twice')
    assert.equal(d.code, 'duplicate-check')
    assert.match(d.reason, /twice/)
  })

  test('REFUSES a duplicate standing in for a check that genuinely did not run', () => {
    // The hostile shape: R1 never ran, S1 is written twice, the declared count still says 28. It
    // refuses as `duplicate-check` and not `incomplete-checks` because the duplicate test runs first
    // in decide(). Asserting the code the gate ACTUALLY returns rather than the one that reads best —
    // a test written to the prettier code gets "fixed" later by reordering the gate.
    const padded = ['S1', ...REQUIRED_CHECKS.filter((c) => c !== 'R1')]
    assert.equal(padded.length, REQUIRED_CHECKS.length, 'the fixture must be the right LENGTH, which is the point')
    assert.equal(new Set(padded).size, REQUIRED_CHECKS.length - 1, 'and must genuinely be missing one id')
    const d = refuses(at(`${headerLine()}\n${rowLine({
      checks_passed: `${padded.join(',')}/${REQUIRED_CHECKS.length}`,
    })}\n`), 'a duplicate padding out an absent R1')
    assert.equal(d.code, 'duplicate-check')
  })

  test('REFUSES a duplicate of EVERY id in the matrix, not just the first', () => {
    for (const c of REQUIRED_CHECKS) {
      const d = decide({ digest: DIGEST }, at(`${headerLine()}\n${rowLine({
        checks_passed: `${[c, ...REQUIRED_CHECKS].join(',')}/${REQUIRED_CHECKS.length}`,
      })}\n`))
      assert.equal(d.allowed, false, `a row listing ${c} twice was ALLOWED`)
      assert.equal(d.code, 'duplicate-check', `${c} duplicated refused as ${d.code}`)
    }
  })

  test('CONTROL: the same set with no duplicate ALLOWS', () => {
    allows(at(GOOD), 'no duplicated check')
  })
})

// ── 7.4 The declared check count, in BOTH directions ─────────────────────────────────────────────
// M35: `chk.declared !== REQUIRED_CHECKS.length` → `<`. A row declaring 29 required checks while
// listing the 28 this matrix defines was ALLOWED. A row that disagrees with the gate about how many
// checks EXIST was written against a different matrix — that is what the code comment says, and only
// the too-few direction was ever tested.
describe('the declared check count must EQUAL the matrix', () => {
  test('REFUSES a row declaring MORE required checks than the matrix defines', () => {
    const d = refuses(at(`${headerLine()}\n${rowLine({
      checks_passed: `${REQUIRED_CHECKS.join(',')}/${REQUIRED_CHECKS.length + 1}`,
    })}\n`), `declared ${REQUIRED_CHECKS.length + 1} where the matrix has ${REQUIRED_CHECKS.length}`)
    assert.equal(d.code, 'wrong-check-count')
    assert.match(d.reason, new RegExp(`declares ${REQUIRED_CHECKS.length + 1} required checks`), d.reason)
  })

  test('REFUSES a row declaring FEWER required checks than the matrix defines', () => {
    const d = refuses(at(`${headerLine()}\n${rowLine({
      checks_passed: `${REQUIRED_CHECKS.join(',')}/${REQUIRED_CHECKS.length - 1}`,
    })}\n`), 'declared one too few')
    assert.equal(d.code, 'wrong-check-count')
  })

  test('equality is the ONLY accepted relation — a sweep either side of the boundary', () => {
    for (const delta of [-5, -2, -1, 1, 2, 5, 100]) {
      const declared = REQUIRED_CHECKS.length + delta
      const d = decide({ digest: DIGEST }, at(`${headerLine()}\n${rowLine({
        checks_passed: `${REQUIRED_CHECKS.join(',')}/${declared}`,
      })}\n`))
      assert.equal(d.allowed, false, `a declared count of ${declared} was ACCEPTED against a matrix of ${REQUIRED_CHECKS.length}`)
      assert.equal(d.code, 'wrong-check-count', `declared ${declared} refused as ${d.code}`)
    }
    allows(at(GOOD), `declared count exactly ${REQUIRED_CHECKS.length}`)
  })
})

// ── 7.5 The profile count, in BOTH directions ────────────────────────────────────────────────────
// M32: `prof.items.length !== prof.declared` → `<`. A row claiming `uefi-modern,bios-legacy/1` — two
// profiles passed, one bound — was ALLOWED. The row is internally inconsistent, which means the
// recording procedure did not write it, and an inconsistent row is the first sign of a hand-edited
// ledger. Only the fewer-than-declared direction was tested.
describe('the profile count must EQUAL the number of ids listed', () => {
  const profileRow = (over) => at(`${headerLine()}\n${rowLine({ recipe: 'lincoln', ...over })}\n`)

  test('REFUSES a row listing MORE profiles than it declares bound', () => {
    const d = refuses(profileRow({ profiles_passed: 'uefi-modern,bios-legacy/1' }), '2 listed, 1 bound')
    assert.equal(d.code, 'partial-profile-pass')
    assert.match(d.reason, /2 of 1/, d.reason)
  })

  test('REFUSES a row listing FEWER profiles than it declares bound', () => {
    const d = refuses(profileRow({ profiles_passed: 'uefi-modern,bios-legacy/3' }), '2 listed, 3 bound')
    assert.equal(d.code, 'partial-profile-pass')
    assert.match(d.reason, /2 of 3/, d.reason)
  })

  test('items.length === declared is the only accepted relation, swept both ways', () => {
    const ids = ['uefi-modern', 'bios-legacy', 'low-ram']
    for (let declared = 1; declared <= 6; declared++) {
      const d = decide({ digest: DIGEST }, profileRow({ profiles_passed: `${ids.join(',')}/${declared}` }))
      if (declared === ids.length) {
        assert.equal(d.allowed, true, `${ids.length} profiles bound to ${declared} was REFUSED: ${d.reason}`)
      } else {
        assert.equal(d.allowed, false, `${ids.length} profiles listed against ${declared} bound was ALLOWED`)
        assert.equal(d.code, 'partial-profile-pass', `declared ${declared} refused as ${d.code}`)
      }
    }
  })
})

// ── 7.6 matrix_version is an integer, not something that merely BEGINS like one ──────────────────
// M10: `/^\d+$/` → `/^\d+/`. Two separate fail-opens. (a) A row whose matrix_version is `1.0` is
// ALLOWED, because Number('1.0') === 1. (b) A garbage matrix_version in ANY OTHER row stops making
// the ledger malformed, so a good row beside it publishes where the whole file was previously
// refused — which breaks the documented invariant "ANY row malformed, not merely the row being
// asked about".
describe('matrix_version shape', () => {
  const NOT_INTEGERS = ['1.0', '1.', '1e0', '0x1', '01x', '1_000', '1-', '+1', '1 ', ' 1', '1١', '1,0']
  for (const v of NOT_INTEGERS) {
    test(`REFUSES a row whose matrix_version is ${JSON.stringify(v)}`, () => {
      const d = refuses(at(`${headerLine()}\n${rowLine({ matrix_version: v })}\n`), `matrix_version ${JSON.stringify(v)}`)
      assert.equal(d.code, 'malformed-ledger',
        `${JSON.stringify(v)} was not treated as a malformed matrix_version. Number(${JSON.stringify(v)}) is ` +
        `${Number(v)}, so an unanchored shape check lets it through as a pass under the CURRENT matrix.`)
    })
  }

  test('ONE row with a non-integer matrix_version poisons the WHOLE ledger', () => {
    const OTHER_DIGEST = 'sha256:' + 'cd34'.repeat(16)
    const good = rowLine()
    const bad = rowLine({ digest: OTHER_DIGEST, matrix_version: '1.0' })
    const d = refuses(at(`${headerLine()}\n${good}\n${bad}\n`), 'a perfect row beside a "1.0" row')
    assert.equal(d.code, 'malformed-ledger',
      'the queried row is perfect; it must still be refused, because a file we cannot fully parse is a ' +
      'file whose silence about any digest means nothing')
    // CONTROL: the same two rows with the second one's version repaired DO allow, so the refusal
    // above is caused by "1.0" and not merely by a second row existing.
    allows(at(`${headerLine()}\n${good}\n${rowLine({ digest: OTHER_DIGEST })}\n`), 'two well-formed rows')
  })

  test('CONTROL: a plain integer matrix_version ALLOWS', () => {
    allows(at(GOOD), 'matrix_version 1')
  })
})

// ── 7.7 A comment is a line that STARTS with #, not a line that contains one ─────────────────────
// M15: `raw.startsWith('#')` → `raw.includes('#')`. A malformed row containing a '#' anywhere — a URL
// fragment is enough — is silently treated as a comment and vanishes, so the ledger parses clean and
// a DIFFERENT digest publishes where it was previously refused. It also deletes legitimate rows: a
// recorded pass disappears with no diagnostic at all.
describe('comment detection', () => {
  const FRAG_URL = 'https://github.com/aarohkandy/auros-base/actions/runs/1234567890#step:7:42'
  const OTHER_DIGEST = 'sha256:' + 'cd34'.repeat(16)

  test('a MALFORMED row containing a # is still malformed, not a comment', () => {
    const d = refuses(at(`${headerLine()}\n${rowLine()}\n${rowLine({
      digest: OTHER_DIGEST, run_url: FRAG_URL, recorded_by: '',
    })}\n`), 'a broken row wearing a URL fragment')
    assert.equal(d.code, 'malformed-ledger')
    assert.match(d.reason, /recorded_by/,
      'the defect must be REPORTED. If the row is skipped as a comment it vanishes, the file parses ' +
      'clean, and the queried digest publishes.')
  })

  test('a WELL-FORMED row containing a # is still FOUND — the other half, so this cannot pass by refusing everything', () => {
    allows(at(`${headerLine()}\n${rowLine({ run_url: FRAG_URL })}\n`), 'a valid row whose run_url carries a fragment')
  })

  test('a row that contains a # and is malformed for some OTHER reason is still reported', () => {
    // Each of these carries a '#' somewhere AND a defect somewhere else. If '#' anywhere makes a line
    // a comment, the row vanishes, the file parses clean, and the QUERIED digest publishes.
    const cases = [
      ['a # in the recipe name', { recipe: 'lincoln#2' }],
      ['a # in recorded_by beside an unopenable run_url', { recorded_by: 'ci#1', run_url: 'internal-build-9' }],
      ['a # in the run_url beside a date that does not exist', { run_url: FRAG_URL, recorded_at: '2026-02-30T00:00:00Z' }],
      ['a # in the image field', { image: `${BASE_IMAGE}#latest` }],
    ]
    for (const [what, over] of cases) {
      const d = decide({ digest: DIGEST }, at(`${headerLine()}\n${rowLine()}\n${rowLine({ digest: OTHER_DIGEST, ...over })}\n`))
      assert.equal(d.allowed, false, `a second row with ${what} was skipped as a comment, and the queried digest published`)
      assert.equal(d.code, 'malformed-ledger', `${what}: got ${d.code}`)
    }
  })

  test('a # in a field with NO shape rule is legal, and the row is kept, not deleted', () => {
    // The other half of M15, and the half that matters to an operator: `includes('#')` does not only
    // let bad rows through, it silently DELETES good ones. recorded_by has no shape rule beyond
    // "non-empty, unpadded", so `github-actions[bot]#1` is a perfectly legal value.
    const paths = at(`${headerLine()}\n${rowLine({ recorded_by: 'github-actions[bot]#1' })}\n`)
    allows(paths, 'a valid row whose recorded_by contains a #')
    const { rows, problems } = parseLedger(readFileSync(paths.ledger, 'utf8'))
    assert.deepEqual(problems, [], 'the row is well-formed')
    assert.equal(rows.length, 1, 'a legitimate recorded pass was deleted by the comment rule with no diagnostic at all')
  })

  test('CONTROL: a LEADING # really is a comment, at the top of the file and between rows', () => {
    allows(at(`# written by CI, do not hand-edit\n${headerLine()}\n#  a stale row was removed here\n${rowLine()}\n`),
      'genuine comment lines')
  })
})

// ── 7.8 One bad row poisons the file — proven per field rule, not assumed ────────────────────────
// M08: IMAGE_RE `)+$` → `)*$`, which accepts a bare name with no namespace. The QUERIED row is still
// caught by the namespace check, which is exactly why every single-row test in this suite is blind to
// it: the hole only shows when the junk is in a DIFFERENT row, where parseLedger is the only thing
// looking.
describe('a malformed image in any row poisons the whole ledger', () => {
  const OTHER_DIGEST = 'sha256:' + 'cd34'.repeat(16)
  const BAD_IMAGES = [
    'auros-base',                                  // a bare name, no namespace at all
    'ghcr.io',                                     // a registry and nothing else
    `${BASE_IMAGE}/`,                              // trailing slash
    'GHCR.io/aarohkandy/auros-base',               // uppercase
    `${BASE_IMAGE}:hardened`,                      // a tag
    '/aarohkandy/auros-base',                      // leading slash
    'ghcr.io//auros-base',                         // empty segment
    '-ghcr.io/aarohkandy/auros-base',              // leading hyphen
  ]

  for (const image of BAD_IMAGES) {
    test(`REFUSES the queried digest when ANOTHER row's image is ${JSON.stringify(image)}`, () => {
      const d = refuses(at(`${headerLine()}\n${rowLine()}\n${rowLine({ digest: OTHER_DIGEST, image })}\n`),
        `a second row whose image is "${image}"`)
      assert.equal(d.code, 'malformed-ledger')
      assert.ok(d.reason.includes(image), `the refusal must name the offending value; got: ${d.reason}`)
    })
  }

  test('CONTROL: the same two rows with a well-formed second image ALLOW', () => {
    allows(at(`${headerLine()}\n${rowLine()}\n${rowLine({ digest: OTHER_DIGEST })}\n`), 'two well-formed rows')
  })
})

// ── 7.9 The recipe-name bound, pinned on both sides ──────────────────────────────────────────────
// M09: `{0,38}` → `{0,39}`, so a 40-character recipe name is accepted where the documented limit is
// 39. Nothing pinned either side of the bound, so it could have drifted to {0,200} just as quietly.
// Recipe names become image tags and filesystem paths, which is why the bound exists at all.
describe('recipe name bounds', () => {
  const recipeRow = (recipe) => at(`${headerLine()}\n${rowLine({ recipe, profiles_passed: 'uefi-modern/1' })}\n`)
  const name = (len) => 'a' + 'b'.repeat(len - 1)

  test('ACCEPTS a recipe name of exactly 39 characters — the documented limit', () => {
    assert.equal(name(39).length, 39)
    allows(recipeRow(name(39)), 'a recipe name at the limit')
  })

  test('REFUSES a recipe name of 40 characters — one past the limit', () => {
    assert.equal(name(40).length, 40)
    const d = refuses(recipeRow(name(40)), 'a recipe name one character over the bound')
    assert.equal(d.code, 'malformed-ledger')
    assert.match(d.reason, /recipe/)
  })

  test('REFUSES every length above the bound, not merely the first one', () => {
    for (const len of [40, 41, 64, 128, 255]) {
      assert.equal(decide({ digest: DIGEST }, recipeRow(name(len))).allowed, false,
        `a ${len}-character recipe name was accepted`)
    }
  })

  test('ACCEPTS a single-character recipe name — the other end of the bound', () => {
    allows(recipeRow('a'), 'the shortest legal recipe name')
  })

  test('REFUSES recipe names outside the character class', () => {
    for (const bad of ['-lincoln', '_lincoln', 'Lincoln', 'LINCOLN', 'lincoln_west', 'lincoln.west', 'lincoln/west', 'lincoln west']) {
      const d = decide({ digest: DIGEST }, recipeRow(bad))
      assert.equal(d.allowed, false, `recipe name "${bad}" was accepted`)
      assert.equal(d.code, 'malformed-ledger', `"${bad}" refused as ${d.code}`)
    }
  })

  test('a TRAILING hyphen is ACCEPTED today, and this test exists to make that a decision', () => {
    // `/^[a-z0-9][a-z0-9-]{0,38}$/` permits "lincoln-". It is a legal OCI tag and a legal path
    // component, so it is PINNED here rather than quietly fixed — tightening the class later is then
    // a change that turns this red and gets discussed, instead of one nobody notices.
    allows(recipeRow('lincoln-'), 'a trailing hyphen, as the regex is written today')
  })

  test('CONTROL: "-" (the base image, no recipe) is not subject to the name rules at all', () => {
    allows(at(GOOD), 'recipe "-"')
  })
})

// ── 7.10 assertPublishable — the API whose whole point is that the failure is structural ─────────
// M40: `if (!d.allowed)` → `if (d.allowed === undefined)`, so it returns normally on EVERY refusal.
// This is the function that exists precisely so a caller cannot drop a boolean, and it had zero
// tests and zero callers. The day CI or the hook starts using it, a refusal becomes a silent success
// and the suite still prints green.
describe('assertPublishable', () => {
  const REFUSAL_FIXTURES = [
    ['a digest with no row', { digest: 'sha256:' + 'ff00'.repeat(16) }, GOOD],
    ['a tag instead of a digest', { digest: 'not-a-digest' }, GOOD],
    ['no digest at all', { digest: '' }, GOOD],
    ['an uppercase spelling of a recorded digest', { digest: 'sha256:' + 'AB12'.repeat(16) }, GOOD],
    ['an empty ledger', { digest: DIGEST }, `${headerLine()}\n`],
    ['a malformed ledger', { digest: DIGEST }, `${headerLine()}\n${rowLine({ recorded_by: '' })}\n`],
    ['a partial profile pass', { digest: DIGEST },
      `${headerLine()}\n${rowLine({ recipe: 'lincoln', profiles_passed: 'uefi-modern,low-ram/3' })}\n`],
    ['an incomplete check set', { digest: DIGEST },
      `${headerLine()}\n${rowLine({ checks_passed: `${REQUIRED_CHECKS.slice(1).join(',')}/${REQUIRED_CHECKS.length}` })}\n`],
    ['a foreign image', { digest: DIGEST }, `${headerLine()}\n${rowLine({ image: 'ghcr.io/somebody-else/auros-base' })}\n`],
    ['a stale matrix version', { digest: DIGEST }, `${headerLine()}\n${rowLine({ matrix_version: '0' })}\n`],
    ['duplicate rows', { digest: DIGEST }, `${headerLine()}\n${rowLine()}\n${rowLine()}\n`],
    ['base profile coverage', { digest: DIGEST }, `${headerLine()}\n${rowLine({ profiles_passed: 'uefi-modern/1' })}\n`],
  ]

  for (const [what, query, ledger] of REFUSAL_FIXTURES) {
    test(`THROWS on ${what}`, () => {
      const paths = at(ledger)
      const d = decide(query, paths)
      assert.equal(d.allowed, false,
        `the fixture "${what}" is not actually a refusal, so this test would prove nothing: ${d.reason}`)
      assert.throws(() => assertPublishable(query, paths), (e) => {
        assert.ok(e instanceof Error, 'assertPublishable must throw an Error, not a value')
        assert.equal(e.code, d.code, `the thrown error must carry decide()'s code; got "${e.code}" for "${d.code}"`)
        assert.match(e.message, /publish gate REFUSES/)
        assert.ok(e.message.includes(query.digest || '(no digest)'),
          `the message must name what was refused; got: ${e.message}`)
        assert.ok(e.message.includes(d.reason),
          'the message must carry decide()\'s reason, not merely its code — a caller that only sees a code ' +
          'cannot tell the operator what to do')
        return true
      }, `assertPublishable RETURNED on ${what} instead of throwing`)
    })
  }

  test('RETURNS the decision on a full recorded pass', () => {
    const d = assertPublishable({ digest: DIGEST }, at(GOOD))
    assert.equal(d.allowed, true)
    assert.equal(d.code, 'pass-recorded')
    assert.ok(d.row, 'the decision it returns must carry the row that justified it')
  })

  test('assertPublishable and decide() never disagree, on any fixture in this file', () => {
    for (const [what, query, ledger] of [...REFUSAL_FIXTURES, ['a full pass', { digest: DIGEST }, GOOD]]) {
      const paths = at(ledger)
      const d = decide(query, paths)
      let threw = null
      try { assertPublishable(query, paths) } catch (e) { threw = e }
      assert.equal(threw === null, d.allowed,
        `decide() says allowed=${d.allowed} for "${what}" but assertPublishable ${threw ? 'threw' : 'returned'}`)
    }
  })
})

// ── 7.11 The ledger must be a REGULAR file, and the GUARD must be what says so ───────────────────
// M25: `if (!st.isFile())` → `if (false)`. The directory case in section 3 passes either way — with
// the guard it is "not a regular file", without it readFileSync throws EISDIR and the catch reports
// "cannot read". Both are code `no-ledger`, so asserting the code alone leaves the guard itself
// completely unexercised. For a FIFO there is no such luck: readFileSync BLOCKS on a pipe with no
// writer, and the mutant hangs forever instead of refusing. A gate that hangs never says no, so it
// never fails closed, and a rerun-until-green culture routes around it.
describe('the lstat guard itself, not just the code it shares', () => {
  test('REFUSES a directory THROUGH the lstat guard, not through the read error', () => {
    const dir = join(tmp(), `dir-guard-${n++}`)
    mkdirSync(dir)
    const d = refuses({ ...DEFAULT_PATHS, ledger: dir }, 'a directory as the ledger')
    assert.equal(d.code, 'no-ledger')
    assert.match(d.reason, /is not a regular file/,
      'the refusal must come from the lstat guard. "cannot read" means the guard was skipped and ' +
      'readFileSync happened to fail instead — which for a FIFO it does not do; it blocks forever.')
  })

  test('REFUSES a FIFO at the ledger path, and refuses PROMPTLY', (t) => {
    const fifo = join(tmp(), `ledger-fifo-${n++}`)
    try { execFileSync('mkfifo', [fifo], { stdio: 'pipe' }) } catch {
      return t.skip('mkfifo is unavailable on this host, so the blocking case cannot be reproduced here')
    }
    const probe = join(tmp(), `fifo-probe-${n++}.mjs`)
    writeFileSync(probe,
      `import { decide, DEFAULT_PATHS } from ${JSON.stringify(GATE)}\n` +
      `const d = decide({ digest: ${JSON.stringify(DIGEST)} }, { ...DEFAULT_PATHS, ledger: ${JSON.stringify(fifo)} })\n` +
      'process.stdout.write(JSON.stringify({ allowed: d.allowed, code: d.code, reason: d.reason }))\n')

    const started = Date.now()
    let out = null
    let failure = null
    try {
      out = execFileSync(process.execPath, [probe], { encoding: 'utf8', stdio: 'pipe', timeout: 8000 })
    } catch (e) { failure = e }
    const elapsed = Date.now() - started

    assert.equal(failure, null,
      `the gate did not return within 8s against a FIFO ledger (killed by ${failure && failure.signal}). It did ` +
      'not refuse — it HUNG. A CI job that hangs never says no, so it never fails closed; it gets cancelled ' +
      'and rerun until something goes green.')
    assert.ok(elapsed < 8000, `took ${elapsed}ms`)

    const d = JSON.parse(out)
    assert.equal(d.allowed, false, 'a named pipe at the ledger path was accepted as an attestation ledger')
    assert.equal(d.code, 'no-ledger')
    assert.match(d.reason, /is not a regular file/)
  })

  test('CONTROL: a regular file at the same path, with the same bytes, ALLOWS', () => {
    allows(at(GOOD), 'an ordinary file')
  })
})

// ── 7.12 The CLI's last line of defence ──────────────────────────────────────────────────────────
// M42: in main(), `catch (e) { …; return 2 }` → `return 0`. "A gate that cannot run has not passed
// anything" had no test at all. Exit 0 is ALLOW, and CI runs `node tools/gate.mjs <digest> &&
// podman push` — so an internal crash reported as 0 publishes an untested image. It survived because
// the suite had no way to make decide() throw.
describe('the CLI fails CLOSED when the gate itself fails', () => {
  test('every return inside main()\'s catch around decide() is a NON-ZERO literal', () => {
    const src = readFileSync(GATE, 'utf8')
    const m = /try\s*\{\s*d\s*=\s*decide\(args\)\s*\}\s*catch\s*\(e\)\s*\{([\s\S]*?)\n\s{2}\}/.exec(src)
    assert.ok(m,
      'could not find the try/catch around decide() in main(). If it was removed, an internal failure now ' +
      'propagates as an uncaught exception — which does fail closed, but this test can no longer say so.')
    const returns = [...m[1].matchAll(/return\s+(-?\d+)/g)].map((r) => Number(r[1]))
    assert.ok(returns.length > 0,
      'the catch around decide() returns nothing, so control falls through to the code below it — and the ' +
      'line below it is the one that prints ALLOW.')
    for (const r of returns) {
      assert.notEqual(r, 0,
        `main()'s catch returns ${r}. Exit 0 is the ALLOW signal; an internal crash must never be one.`)
    }
  })

  test('the CLI exits 2 and prints REFUSED when decide() itself throws', () => {
    // Built as a real repo, because gate.mjs resolves every path from its OWN location: the file sits
    // at <root>/tools/gate.mjs and reads <root>/auros.config.json. A config of `null` is valid JSON
    // that is not an object, so `config.registry` throws — a genuine internal failure, reached
    // without editing one byte of the gate.
    const root = join(realpathSync(tmp()), `repo-${n++}`)
    mkdirSync(join(root, 'tools'), { recursive: true })
    writeFileSync(join(root, 'tools', 'gate.mjs'), readFileSync(GATE, 'utf8'))
    writeFileSync(join(root, 'auros.config.json'), 'null')

    let status = 0
    let stderr = ''
    let stdout = ''
    try {
      stdout = execFileSync(process.execPath, [join(root, 'tools', 'gate.mjs'), DIGEST], { encoding: 'utf8', stdio: 'pipe' })
    } catch (e) { status = e.status; stderr = String(e.stderr); stdout = String(e.stdout) }

    assert.equal(status, 2,
      `the gate failed internally and exited ${status}. The shell line in CI is ` +
      '`node tools/gate.mjs <digest> && podman push`, so exit 0 here publishes an image nothing tested.')
    assert.doesNotMatch(stdout, /ALLOW/, 'an internal failure must never print ALLOW')
    assert.match(stderr, /REFUSED/, 'an internal failure must be reported to the operator as a refusal')
    assert.match(stderr, /the gate itself failed/)
  })

  test('CONTROL: the same temp repo with a VALID config reaches a real verdict, not the catch', () => {
    // Proves the test above is exercising the catch and not merely "a copied gate always exits 2".
    const root = join(realpathSync(tmp()), `repo-ok-${n++}`)
    mkdirSync(join(root, 'tools'), { recursive: true })
    writeFileSync(join(root, 'tools', 'gate.mjs'), readFileSync(GATE, 'utf8'))
    writeFileSync(join(root, 'auros.config.json'), JSON.stringify({ registry: CONFIG.registry, org: CONFIG.org }))
    mkdirSync(join(root, 'attest'), { recursive: true })
    writeFileSync(join(root, 'attest', 'passed-digests.tsv'), GOOD)

    let status = 0
    let stdout = ''
    try {
      stdout = execFileSync(process.execPath, [join(root, 'tools', 'gate.mjs'), DIGEST], { encoding: 'utf8', stdio: 'pipe' })
    } catch (e) { status = e.status; stdout = String(e.stdout) }
    assert.equal(status, 0, 'a full recorded pass in a well-formed temp repo must exit 0')
    // And it must have exited 0 because it ALLOWED, not because it never ran. The first draft of the
    // test above passed for exactly that wrong reason: node loads a module by its REALPATH, macOS
    // hands out /var/folders/... for tmpdir(), and gate.mjs's `resolve(process.argv[1]) === SELF`
    // guard was therefore false — so main() never executed and the process exited 0 in silence. A
    // test whose green comes from the program not running is the thing this whole file is against.
    assert.match(stdout, /gate: ALLOW/,
      'the copied CLI produced no verdict at all, so the exit code above means nothing')
  })
})

// ── 7.13 "This CLI has no subcommands" must fire for the SHORTEST subcommand call ────────────────
// M44: `argv.length > 1` → `> 2`. Not a fail-open: `gate.mjs record x.json` still exits 2 — but with
// "unexpected extra argument", a FLAG-shaped error for a PROGRAM-shaped mistake. The comment above
// the guard says that exact confusion is what made a CI step look gated while never reaching the
// gate: the author fixes the argument, the step keeps dying, and nobody learns that record-pass.mjs
// is a different program. The existing test only covers the three-token form.
describe('the no-subcommands message', () => {
  const capture = (argv) => {
    const lines = []
    const orig = console.error
    console.error = (...a) => lines.push(a.join(' '))
    let code
    try { code = main(argv) } finally { console.error = orig }
    return { code, text: lines.join('\n') }
  }

  test('fires for a TWO-token subcommand call, not only a longer one', () => {
    for (const argv of [['record', 'results.json'], ['check', 'x.json'], ['verify', 'out'], ['record', '--results']]) {
      const { code, text } = capture(argv)
      assert.equal(code, 2, `gate.mjs ${argv.join(' ')} must exit 2`)
      assert.match(text, /no subcommands/,
        `gate.mjs ${argv.join(' ')} reported "${text.split('\n')[0]}" — a flag-shaped error for a call to a ` +
        'program that does not exist.')
      assert.match(text, /record-pass\.mjs/,
        'the message must name the program that DOES write a pass, or the next author invents another one')
    }
  })

  test('still fires for the longer forms the suite already covered', () => {
    const { code, text } = capture(['record', '--results', 'results.json', '--ledger', 'attest/passed-digests.tsv'])
    assert.equal(code, 2)
    assert.match(text, /no subcommands/)
  })

  test('CONTROL: a LONE bare word falls through to decide(), which has a better answer — it is a tag', () => {
    const { code, text } = capture(['hardened'])
    assert.equal(code, 1, 'a single bare word is a REFUSAL (exit 1), not an argument error (exit 2)')
    assert.match(text, /not a content digest/)
    assert.doesNotMatch(text, /no subcommands/, 'the guard must not swallow the one-token case')
  })

  test('CONTROL: a well-formed digest with flags is still accepted by the parser', () => {
    const orig = console.error
    console.error = () => {}
    try {
      assert.notEqual(main([DIGEST, '--image', BASE_IMAGE]), 2, 'the guard must not reject the real form')
    } finally { console.error = orig }
  })
})

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 8. A SECOND-ORDER SWEEP — MUTATIONS NOBODY REPORTED
//
// The eighteen blocks above were written against a supplied list of survivors. A suite patched at
// exactly the eighteen points it was told about is a checklist, not a net, so 27 further mutations
// were generated independently and run against the suite as it stood after section 7. Twenty-two
// died. Five did not, and this section is the three of those five that were real. (The other two
// were EQUIVALENT MUTANTS — no input can distinguish them — and are recorded in the report rather
// than papered over with a test that would pass either way.)
// ═════════════════════════════════════════════════════════════════════════════════════════════════

describe('second-order survivors', () => {
  const capture = (argv) => {
    const lines = []
    const orig = console.error
    console.error = (...a) => lines.push(a.join(' '))
    let code
    try { code = main(argv) } finally { console.error = orig }
    return { code, text: lines.join('\n') }
  }

  // ── 8.1 The digest length bound ────────────────────────────────────────────────────────────────
  // `/^sha256:[a-f0-9]{64}$/` → `{63,64}` survived everything. Nothing in this repo pinned the
  // length, and DIGEST_RE is used BOTH to validate the query and to validate the rows, so loosening
  // it loosens both ends at once: a 63-character digest becomes a legal attestation AND a legal
  // thing to ask about, and they match each other. A truncated digest is then a recorded pass.
  test('DIGEST_RE accepts exactly 64 hex characters, and no other length', () => {
    for (const len of [0, 1, 8, 32, 62, 63, 65, 66, 128]) {
      assert.equal(DIGEST_RE.test('sha256:' + 'a'.repeat(len)), false,
        `a digest of ${len} hex characters matched DIGEST_RE. The bound is what makes a digest the whole hash.`)
    }
    assert.equal(DIGEST_RE.test('sha256:' + 'a'.repeat(64)), true, 'the real length must still match')
  })

  test('REFUSES a 63-character digest even when a row is recorded under the SAME 63 characters', () => {
    // Both halves loosen together, so the truncated query and the truncated row match each other.
    // This is the only shape that catches it: a short query against a full-length row merely misses.
    const short = 'sha256:' + 'ab12'.repeat(15) + 'abc'
    assert.equal(short.length - 'sha256:'.length, 63)
    const d = decide({ digest: short }, at(`${headerLine()}\n${rowLine({ digest: short })}\n`))
    assert.equal(d.allowed, false, 'a 63-character digest matched a row recorded under the same 63 characters')
    assert.equal(d.code, 'not-a-digest')
  })

  test('REFUSES the whole ledger when ANOTHER row records a wrong-length digest', () => {
    for (const bad of ['sha256:' + 'ab12'.repeat(15) + 'abc', 'sha256:' + 'ab12'.repeat(16) + 'ab', 'sha256:ab12']) {
      const d = refuses(at(`${headerLine()}\n${rowLine()}\n${rowLine({ digest: bad })}\n`), `a row whose digest is ${bad.length - 7} hex`)
      assert.equal(d.code, 'malformed-ledger')
    }
    allows(at(`${headerLine()}\n${rowLine()}\n${rowLine({ digest: 'sha256:' + 'cd34'.repeat(16) })}\n`), 'two full-length digests')
  })

  // ── 8.2 The timestamp anchor ───────────────────────────────────────────────────────────────────
  // TIMESTAMP_RE `…Z$/` → `…Z/` survived, because trailing junk makes Date.parse return NaN and the
  // row is refused anyway — by accident, one line further down. The VERDICT is the same; the RULE is
  // not. Asserting the code alone cannot tell the two apart, so this asserts the reason, which is
  // the only place the difference is visible.
  test('REFUSES a recorded_at with trailing junk as a SHAPE error, not as an unparseable instant', () => {
    for (const suffix of ['junk', 'Z', '+01:00', '.000', ' UTC'.trim()]) {
      const ts = `${NOW}${suffix}`
      const d = refuses(at(`${headerLine()}\n${rowLine({ recorded_at: ts })}\n`), `recorded_at "${ts}"`)
      assert.equal(d.code, 'malformed-ledger')
      assert.match(d.reason, /is not UTC YYYY-MM-DDTHH:MM:SSZ/,
        'an unanchored TIMESTAMP_RE lets the shape through and leaves Date.parse to reject it by accident. ' +
        `Today the verdict is the same; the rule is not, and the next edit to that line has no test. Got: ${d.reason}`)
    }
  })

  test('CONTROL: a correctly shaped recorded_at ALLOWS', () => {
    allows(at(GOOD), 'a well-formed UTC timestamp')
  })

  // ── 8.3 An unrecognised flag must be rejected AS A FLAG ────────────────────────────────────────
  // `else if (a.startsWith('-'))` → `else if (false)` survived: an unknown flag falls through to the
  // positional branch and still exits 2, so every existing test is satisfied. What is lost is the
  // sentence — the one that tells the operator this gate has no flags that change its answer. That
  // sentence is the whole anti-bypass message; "unexpected extra argument" invites another try.
  test('an unrecognised FLAG is rejected as a flag, with the message that says there is no bypass', () => {
    for (const flag of ['--force', '--skip-gate', '-f', '--allow', '--i-know-what-im-doing']) {
      const { code, text } = capture([DIGEST, flag])
      assert.equal(code, 2, `"${flag}" must be fatal`)
      assert.match(text, /unrecognised argument/,
        `"${flag}" was reported as "${text.split('\n')[0]}". An extra-positional error reads as "wrong ` +
        'number of arguments", so the author edits the arguments instead of reading the sentence below.')
      assert.match(text, /no flags that change its answer/,
        'the refusal must state that no flag can change the verdict, or the next person looks for the one that can')
    }
  })

  test('CONTROL: a second POSITIONAL really is an extra-argument error, and says so', () => {
    const { code, text } = capture([DIGEST, 'sha256:' + 'cd34'.repeat(16)])
    assert.equal(code, 2)
    assert.match(text, /unexpected extra argument/)
    assert.doesNotMatch(text, /unrecognised argument/, 'the two errors must stay distinguishable')
  })
})


test.after(() => { if (TMP) rmSync(TMP, { recursive: true, force: true }) })
