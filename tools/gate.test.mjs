#!/usr/bin/env node --test
// Tests for the publish gate. `node --test tools/gate.test.mjs`
//
// THE BIAS OF THIS FILE: almost every test here asserts a REFUSAL. That is deliberate and it mirrors
// the installer's rule that the abort path is tested more than the happy path (spec §6C). A gate is
// not a feature that sometimes fails; it is a refusal that occasionally relents. There is exactly one
// test for the allow path, and it exists mainly so the refusals cannot pass vacuously — a gate that
// refuses everything, including a genuine full pass, would satisfy every other test in this file while
// being just as useless as a gate that allows everything.
//
// Fixtures are written to a temp directory and the library is pointed at them. Choosing which file to
// read is not the same as overriding a verdict: the same bytes always produce the same answer.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

import {
  decide, main, parseLedger, driftCheck,
  MATRIX_VERSION, REQUIRED_CHECKS, KNOWN_PROFILES, HEADER, DEFAULT_PATHS, REPO_ROOT,
} from './gate.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

// The namespace has one home (auros.config.json) and this test file reads it from there rather than
// carrying a second copy of the org name that could drift from the first.
const CONFIG = JSON.parse(readFileSync(DEFAULT_PATHS.config, 'utf8'))
const BASE_IMAGE = `${CONFIG.registry}/${CONFIG.org}/${CONFIG.product}-base`

const DIGEST = 'sha256:' + 'ab12'.repeat(16)
const OTHER  = 'sha256:' + 'cd34'.repeat(16)
const ALL_CHECKS = `${REQUIRED_CHECKS.join(',')}/${REQUIRED_CHECKS.length}`
const ALL_PROFILES = `${KNOWN_PROFILES.join(',')}/${KNOWN_PROFILES.length}`
const NOW = new Date(Date.now() - 60_000).toISOString().replace(/\.\d+Z$/, 'Z')

let tmp
function fixture (ledgerText, opts = {}) {
  tmp ??= mkdtempSync(join(tmpdir(), 'auros-gate-'))
  const ledger = join(tmp, `ledger-${Math.random().toString(36).slice(2)}.tsv`)
  if (ledgerText !== null) writeFileSync(ledger, ledgerText)
  return { ...DEFAULT_PATHS, ledger, ...opts }
}
const header = () => HEADER.join('\t')
function row (over = {}) {
  const r = {
    digest: DIGEST, image: BASE_IMAGE, recipe: '-', matrix_version: String(MATRIX_VERSION),
    profiles_passed: ALL_PROFILES, checks_passed: ALL_CHECKS,
    run_url: 'https://github.com/aarohkandy/auros-base/actions/runs/1234567890',
    recorded_at: NOW, recorded_by: 'github-actions[bot]', ...over,
  }
  return HEADER.map((h) => r[h]).join('\t')
}
const ledgerWith = (...rows) => `${header()}\n${rows.join('\n')}\n`

const refused = (d, code) => {
  assert.equal(d.allowed, false, `expected a REFUSAL, got allow: ${d.reason}`)
  if (code) assert.equal(d.code, code, `refused for the wrong reason: ${d.reason}`)
  assert.ok(d.reason && d.reason.length > 20, 'a refusal must explain itself to the human who hits it')
}

// ── The one allow ────────────────────────────────────────────────────────────────────────────────
test('allows a digest with a complete, current, unambiguous recorded pass', () => {
  const d = decide({ digest: DIGEST }, fixture(ledgerWith(row())))
  assert.equal(d.allowed, true, d.reason)
  assert.equal(d.row.profilesBound, KNOWN_PROFILES.length)
})

// ── Refusal: the ledger itself ───────────────────────────────────────────────────────────────────
test('REFUSES when the ledger file does not exist', () => {
  refused(decide({ digest: DIGEST }, fixture(null, { ledger: join(tmpdir(), 'auros-gate-nonexistent-ledger.tsv') })), 'no-ledger')
})

test('REFUSES when the ledger is unreadable (a directory where a file should be)', () => {
  refused(decide({ digest: DIGEST }, fixture(null, { ledger: tmpdir() })), 'no-ledger')
})

test('REFUSES an empty ledger — header only, zero recorded passes', () => {
  refused(decide({ digest: DIGEST }, fixture(header() + '\n')), 'empty-ledger')
})

test('REFUSES a zero-byte ledger (no header at all)', () => {
  refused(decide({ digest: DIGEST }, fixture('')), 'malformed-ledger')
})

test('REFUSES a ledger that is only comments — a file with no header is not a ledger', () => {
  refused(decide({ digest: DIGEST }, fixture('# nothing here\n# still nothing\n')), 'malformed-ledger')
})

test('REFUSES when the header has been altered', () => {
  const bad = ledgerWith(row()).replace('matrix_version', 'matrixversion')
  refused(decide({ digest: DIGEST }, fixture(bad)), 'malformed-ledger')
})

test('REFUSES the whole ledger when ANY OTHER row is malformed, even though the asked-for row is fine', () => {
  // A file we cannot fully parse is a file whose silence about a digest means nothing.
  const d = decide({ digest: DIGEST }, fixture(ledgerWith(row(), 'garbage\tnot\tenough\tfields')))
  refused(d, 'malformed-ledger')
})

test('REFUSES a row with too many fields', () => {
  refused(decide({ digest: DIGEST }, fixture(ledgerWith(row() + '\textra'))), 'malformed-ledger')
})

test('REFUSES a row whose digest is a tag rather than a digest', () => {
  refused(decide({ digest: DIGEST }, fixture(ledgerWith(row({ digest: 'hardened' })))), 'malformed-ledger')
})

test('REFUSES a row whose run_url is not an auditable https URL', () => {
  refused(decide({ digest: DIGEST }, fixture(ledgerWith(row({ run_url: 'local-run' })))), 'malformed-ledger')
  refused(decide({ digest: DIGEST }, fixture(ledgerWith(row({ run_url: 'http://github.com/x/actions/runs/1' })))), 'malformed-ledger')
})

test('REFUSES a row dated in the future', () => {
  const future = new Date(Date.now() + 8 * 24 * 3600_000).toISOString().replace(/\.\d+Z$/, 'Z')
  refused(decide({ digest: DIGEST }, fixture(ledgerWith(row({ recorded_at: future })))), 'malformed-ledger')
})

test('REFUSES a row with an empty field', () => {
  refused(decide({ digest: DIGEST }, fixture(ledgerWith(row({ recorded_by: '' })))), 'malformed-ledger')
})

// ── Refusal: the digest ──────────────────────────────────────────────────────────────────────────
test('REFUSES a digest that is simply not in the ledger', () => {
  refused(decide({ digest: OTHER }, fixture(ledgerWith(row()))), 'digest-absent')
})

test('REFUSES a digest that differs from a recorded pass by ONE character', () => {
  const off = DIGEST.slice(0, -1) + (DIGEST.endsWith('2') ? '3' : '2')
  assert.notEqual(off, DIGEST)
  assert.equal(off.length, DIGEST.length)
  refused(decide({ digest: off }, fixture(ledgerWith(row()))), 'digest-absent')
})

test('REFUSES a digest that is a PREFIX of a recorded one — no substring or truncated matching', () => {
  refused(decide({ digest: DIGEST.slice(0, 40) }, fixture(ledgerWith(row()))), 'not-a-digest')
})

test('REFUSES an uppercase-hex spelling of a recorded digest', () => {
  refused(decide({ digest: DIGEST.toUpperCase().replace('SHA256', 'sha256') }, fixture(ledgerWith(row()))), 'not-a-digest')
})

test('REFUSES a tag-only publish: no digest supplied at all', () => {
  refused(decide({ digest: '' }, fixture(ledgerWith(row()))), 'no-digest')
  refused(decide({}, fixture(ledgerWith(row()))), 'no-digest')
  refused(decide({ digest: `${BASE_IMAGE}:hardened` }, fixture(ledgerWith(row()))), 'not-a-digest')
  refused(decide({ digest: 'latest' }, fixture(ledgerWith(row()))), 'not-a-digest')
})

// ── Refusal: partial passes ──────────────────────────────────────────────────────────────────────
test('REFUSES a partial profile pass — 3 of 5 bound profiles', () => {
  const d = decide({ digest: DIGEST }, fixture(ledgerWith(row({
    recipe: 'lincoln',
    profiles_passed: 'uefi-modern,low-ram,bios-legacy/5',
  }))))
  refused(d, 'partial-profile-pass')
  assert.match(d.reason, /3 of 5/)
})

test('REFUSES a base image tested on fewer than every profile, even if the count is self-consistent', () => {
  // Self-consistent and still not good enough: every recipe inherits from the base.
  refused(decide({ digest: DIGEST }, fixture(ledgerWith(row({
    profiles_passed: 'uefi-modern,low-ram/2',
  })))), 'base-profile-coverage')
})

test('REFUSES a row that omits the mandatory baseline profile', () => {
  refused(decide({ digest: DIGEST }, fixture(ledgerWith(row({
    recipe: 'lincoln', profiles_passed: 'low-ram,tpm12/2',
  })))), 'missing-mandatory-profile')
})

test('REFUSES a row claiming zero bound profiles', () => {
  refused(decide({ digest: DIGEST }, fixture(ledgerWith(row({ recipe: 'lincoln', profiles_passed: 'uefi-modern/0' })))), 'no-profiles-bound')
})

test('REFUSES an invented profile name', () => {
  refused(decide({ digest: DIGEST }, fixture(ledgerWith(row({
    recipe: 'lincoln', profiles_passed: 'uefi-modern,definitely-tested/2',
  })))), 'unknown-profile')
})

test('REFUSES a profile listed twice to pad the count', () => {
  refused(decide({ digest: DIGEST }, fixture(ledgerWith(row({
    recipe: 'lincoln', profiles_passed: 'uefi-modern,uefi-modern/2',
  })))), 'duplicate-profile')
})

test('REFUSES when a single required check is missing — a skipped check is a failed check', () => {
  const short = REQUIRED_CHECKS.filter((c) => c !== 'S3')
  const d = decide({ digest: DIGEST }, fixture(ledgerWith(row({
    checks_passed: `${short.join(',')}/${REQUIRED_CHECKS.length}`,
  }))))
  refused(d, 'incomplete-checks')
  assert.match(d.reason, /S3/)
})

test('REFUSES when the row disagrees with the gate about how many checks the matrix has', () => {
  refused(decide({ digest: DIGEST }, fixture(ledgerWith(row({
    checks_passed: `${REQUIRED_CHECKS.join(',')}/${REQUIRED_CHECKS.length - 1}`,
  })))), 'wrong-check-count')
})

test('REFUSES an invented check ID padding the set out to the right length', () => {
  const faked = [...REQUIRED_CHECKS.filter((c) => c !== 'U3'), 'U99']
  refused(decide({ digest: DIGEST }, fixture(ledgerWith(row({
    checks_passed: `${faked.join(',')}/${REQUIRED_CHECKS.length}`,
  })))), 'incomplete-checks')
})

// ── Refusal: matrix version ──────────────────────────────────────────────────────────────────────
test('REFUSES a row claiming a pass under a STALE matrix_version', () => {
  const d = decide({ digest: DIGEST }, fixture(ledgerWith(row({ matrix_version: '0' }))))
  refused(d, 'stale-matrix-version')
  assert.match(d.reason, /not evidence/)
})

test('REFUSES a row claiming a pass under a matrix version NEWER than the one we enforce', () => {
  refused(decide({ digest: DIGEST }, fixture(ledgerWith(row({ matrix_version: String(MATRIX_VERSION + 1) })))), 'stale-matrix-version')
})

test('REFUSES when the only current row is stale even though an older row for the same digest exists', () => {
  refused(decide({ digest: DIGEST }, fixture(ledgerWith(
    row({ matrix_version: '0' }), row({ matrix_version: '0', recorded_by: 'someone-else' }),
  ))), 'stale-matrix-version')
})

test('REFUSES two live rows for the same digest', () => {
  refused(decide({ digest: DIGEST }, fixture(ledgerWith(
    row(), row({ run_url: 'https://github.com/aarohkandy/auros-base/actions/runs/9' }),
  ))), 'duplicate-rows')
})

// ── Refusal: identity of the image ───────────────────────────────────────────────────────────────
test('REFUSES a recorded pass for an image outside our own namespace', () => {
  refused(decide({ digest: DIGEST }, fixture(ledgerWith(row({ image: 'docker.io/someone/else' })))), 'foreign-image')
})

test('REFUSES when the publish targets a different image than the one that was tested', () => {
  refused(decide({ digest: DIGEST, image: `${CONFIG.registry}/${CONFIG.org}/${CONFIG.product}-recipes` },
    fixture(ledgerWith(row()))), 'image-mismatch')
})

test('REFUSES when the publish claims a recipe the recorded pass was not for', () => {
  refused(decide({ digest: DIGEST, recipe: 'westside' }, fixture(ledgerWith(row({ recipe: 'lincoln' })))), 'recipe-mismatch')
})

// ── Refusal: the gate cannot establish its own preconditions ─────────────────────────────────────
test('REFUSES when auros.config.json cannot be read — it will not guess which registry is ours', () => {
  refused(decide({ digest: DIGEST }, fixture(ledgerWith(row()), { config: join(tmpdir(), 'auros-no-such-config.json') })), 'no-config')
})

test('REFUSES every digest when checks.yaml has drifted from the gate constants', () => {
  tmp ??= mkdtempSync(join(tmpdir(), 'auros-gate-'))
  const drifted = join(tmp, 'checks-drifted.yaml')
  writeFileSync(drifted, `matrix_version: ${MATRIX_VERSION + 7}\n`)
  refused(decide({ digest: DIGEST }, fixture(ledgerWith(row()), { checks: drifted })), 'matrix-drift')
})

test('REFUSES when checks.yaml is present but profiles.yaml is missing — a half-present matrix', () => {
  refused(decide({ digest: DIGEST }, fixture(ledgerWith(row()), {
    profiles: join(tmpdir(), 'auros-no-such-profiles.yaml'),
  })), 'matrix-drift')
})

test('the repo-as-checked-out has no drift between tools/gate.mjs and the live matrix definition', () => {
  assert.equal(driftCheck(DEFAULT_PATHS), null)
})

// ── Refusal: there is no bypass ──────────────────────────────────────────────────────────────────
test('REFUSES `--force`, and every other flag it does not recognise, rather than ignoring it', () => {
  for (const flag of ['--force', '-f', '--yes', '--allow', '--override', '--skip-gate', '--no-verify', '--insecure']) {
    const code = main([flag, DIGEST])
    assert.equal(code, 2, `${flag} must be fatal, not silently ignored`)
  }
})

test('the CLI cannot be pointed at a different ledger by argument', () => {
  assert.equal(main([DIGEST, '--ledger', '/tmp/anything.tsv']), 2)
  assert.equal(main(['--ledger=/tmp/anything.tsv', DIGEST]), 2)
})

test('the CLI exits 1 (refused) for a digest with no recorded pass, and 2 for nonsense input', () => {
  assert.equal(main([OTHER]), 1)          // the real repo ledger has no rows
  assert.equal(main([]), 2)
  assert.equal(main(['not-a-digest']), 1)
  assert.equal(main([DIGEST, 'and-another']), 2)
})

test('gate.mjs reads no environment variable and has no force/override path in its code', () => {
  // Comments are stripped first, because the comments in that file discuss the flags it refuses.
  const src = readFileSync(join(HERE, 'gate.mjs'), 'utf8')
    .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
  for (const forbidden of [/process\.env/, /\bforce\b/i, /\boverride\b/i, /\bbypass\b/i, /\bDANGEROUS/i]) {
    assert.ok(!forbidden.test(src), `tools/gate.mjs contains ${forbidden} in executable code — that is a bypass path`)
  }
})

test('an environment variable cannot change the CLI verdict', () => {
  const node = process.execPath
  const run = (env) => {
    try {
      execFileSync(node, [join(HERE, 'gate.mjs'), DIGEST], { env: { ...process.env, ...env }, stdio: 'pipe' })
      return 0
    } catch (e) { return e.status }
  }
  const base = run({})
  for (const env of [{ AUROS_FORCE: '1' }, { FORCE: '1' }, { CI: 'false' }, { AUROS_GATE: 'off' },
    { AUROS_LEDGER: '/tmp/fake.tsv' }, { NODE_ENV: 'development' }]) {
    assert.equal(run(env), base, `an environment variable changed the verdict: ${JSON.stringify(env)}`)
  }
  assert.notEqual(base, 0, 'the real ledger has no passes, so the baseline verdict must not be an allow')
})

// ── The call sites: every invocation in CI must be one this parser accepts ───────────────────────
// THIS IS THE TEST THAT WAS MISSING, and its absence is why the publish gate had never once run.
// build.yml called `gate.mjs record --results … --ledger … --checks …` and then
// `gate.mjs check --digest … --results … --ledger …`. Neither subcommand has ever existed: "record"
// and "check" were swallowed as the positional digest and the next token killed the parser with
// exit 2. Under `shell: bash -euo pipefail` the step died before the gate ran, so the publish was
// fail-closed by accident — and the same accident meant nothing could ever ship.
//
// Fifty-six tests called `decide()` and `main()` with arguments the tests themselves invented. Not
// one of them called `main()` with the arguments CI actually uses. So this section does two things:
// it pins the exact shapes as literals, and it reads every workflow in the tree and runs whatever it
// finds there, so a future edit to a call site fails here rather than in production at 3am.

const OK_DIGEST = OTHER            // a well-formed digest with no recorded pass: a REFUSAL, not a parse error
const acceptsArgv = (argv) => {
  const code = main(argv)
  assert.notEqual(code, 2, `gate.mjs cannot parse this invocation: gate.mjs ${argv.join(' ')}`)
  return code
}

test('the argv shapes build.yml uses are invocations this parser accepts', () => {
  // Exit 1 (refused — the repo ledger is empty), never exit 2 (could not parse).
  assert.equal(acceptsArgv([OK_DIGEST]), 1)
  assert.equal(acceptsArgv([OK_DIGEST, '--image', BASE_IMAGE]), 1)
  assert.equal(acceptsArgv([OK_DIGEST, '--image', BASE_IMAGE, '--recipe', 'lincoln']), 1)
})

test('the shapes CI actually shipped are rejected, and say so in terms that name the real program', () => {
  const stderr = []
  const orig = console.error
  console.error = (...a) => stderr.push(a.join(' '))
  try {
    assert.equal(main(['record', '--results', 'results.json', '--ledger', 'meta/attest/passed-digests.tsv', '--checks', 'matrix/checks.yaml']), 2)
    assert.equal(main(['check', '--digest', OK_DIGEST, '--results', 'results.json', '--ledger', 'meta/attest/passed-digests.tsv']), 2)
    assert.equal(main(['--require-pass', 'results.json']), 2)
  } finally { console.error = orig }
  const text = stderr.join('\n')
  assert.match(text, /no subcommands/, 'the refusal must say that subcommands do not exist')
  assert.match(text, /record-pass\.mjs/, 'it must name the program that DOES write a pass, or the next author invents another one')
})

test('every gate.mjs invocation in every Auros workflow is one this parser accepts', () => {
  const roots = ['auros-base', 'auros-recipes', 'auros-installer', 'auros-web', '.']
    .map((r) => join(REPO_ROOT, r, '.github', 'workflows'))

  const found = []
  for (const dir of roots) {
    let entries
    try { entries = readdirSync(dir) } catch { continue }
    for (const f of entries) {
      if (!/\.ya?ml$/.test(f)) continue
      // Fold shell line-continuations so a multi-line invocation is read as one command.
      const text = readFileSync(join(dir, f), 'utf8').replace(/\\\n\s*/g, ' ')
      for (const line of text.split('\n')) {
        if (/^\s*#/.test(line)) continue                       // a YAML comment is documentation
        // `a || b` is TWO commands, and a fallback chain is exactly where a broken call site hides —
        // the reader's eye reads "if the first one fails we try the other", not "both are unparseable".
        for (const part of line.split(/\s*(?:\|\||&&|;)\s*/)) {
          const m = /(?:^|\s)node\s+(\S*gate\.mjs)\s*(.*)$/.exec(part)
          if (!m) continue
          found.push({ file: `${dir.replace(REPO_ROOT + '/', '')}/${f}`, raw: part.trim(), rest: m[2] })
        }
      }
    }
  }

  for (const call of found) {
    // Strip trailing shell noise, then unquote and substitute CI's own placeholders for concrete
    // values. Substituting a digest for `${{ needs.build.outputs.digest }}` does not weaken the
    // test: the parser's job is to accept the SHAPE, and the shape is what the call site controls.
    // Shell redirections are not argv — `>/dev/null 2>&1` never reaches the program. Strip them,
    // along with their targets, before asking the parser about what is left.
    const raw = call.rest.replace(/(^|\s)\d?(>>|>|<)\s*\S+/g, ' ')
    const tokens = (raw.split(/\s+/).filter(Boolean))
      .filter((t) => !['||', '&&', ';', '|'].includes(t))
      .map((t) => t.replace(/^['"]|['"]$/g, ''))
    const argv = []
    let sawPositional = false
    for (const t of tokens) {
      const isPlaceholder = t.includes('${{') || /^\$\{?[A-Za-z_]\w*\}?$/.test(t)
      if (t.startsWith('--')) { argv.push(t); continue }
      if (argv.length && argv[argv.length - 1] === '--image') { argv.push(isPlaceholder ? BASE_IMAGE : t); continue }
      if (argv.length && argv[argv.length - 1] === '--recipe') { argv.push(isPlaceholder ? 'lincoln' : t); continue }
      if (!sawPositional) { argv.push(isPlaceholder ? OK_DIGEST : t); sawPositional = true; continue }
      argv.push(t)
    }
    const orig = console.error
    console.error = () => {}
    let code
    try { code = main(argv) } finally { console.error = orig }
    assert.notEqual(code, 2,
      `${call.file} invokes the gate in a way the gate cannot parse, so that step dies before the ` +
      `gate runs and the workflow is gated on nothing:\n    ${call.raw}\n  parsed as: gate.mjs ${argv.join(' ')}\n` +
      '  THE ONLY FORM THIS PROGRAM HAS: gate.mjs <sha256:…> [--image REF] [--recipe NAME].\n' +
      '  Writing a pass is a different program in a different job: auros-base/matrix/run/record-pass.mjs\n' +
      '  --results <file> --ledger <meta>/attest/passed-digests.tsv. Gate on the digest afterwards,\n' +
      '  against a ledger fetched from origin, never against the file the same job just wrote.')
  }

  // Non-vacuity. A scan that finds nothing passes for the wrong reason, and this particular scan
  // finding nothing would mean the publish gate is not called from any workflow at all.
  const base = found.filter((c) => c.file.startsWith('auros-base/'))
  assert.ok(base.length >= 1,
    'found no `node …/gate.mjs …` invocation in auros-base/.github/workflows. Either the checkout is ' +
    'incomplete, or nothing in the build pipeline calls the publish gate — and the second one is the ' +
    'condition this whole file exists to make impossible.')
})

// ── The shipped ledger ───────────────────────────────────────────────────────────────────────────
test('the repo ledger parses cleanly and contains no rows — an example row would be a fabricated pass', () => {
  const { rows, problems } = parseLedger(readFileSync(DEFAULT_PATHS.ledger, 'utf8'))
  assert.deepEqual(problems, [], `the shipped ledger is malformed: ${problems.join('; ')}`)
  assert.equal(rows.length, 0)
})

test('the shipped ledger refuses everything, because nothing has passed yet', () => {
  refused(decide({ digest: DIGEST }, DEFAULT_PATHS), 'empty-ledger')
})

// ── The hook, end to end ─────────────────────────────────────────────────────────────────────────
const HOOK = join(REPO_ROOT, '.claude', 'hooks', 'publish-gate.mjs')
function hook (command, toolName = 'Bash') {
  const payload = JSON.stringify({ tool_name: toolName, tool_input: { command } })
  try {
    execFileSync(process.execPath, [HOOK], { input: payload, stdio: 'pipe' })
    return { code: 0, stderr: '' }
  } catch (e) { return { code: e.status, stderr: String(e.stderr) } }
}
const blocked = (cmd) => {
  const r = hook(cmd)
  assert.equal(r.code, 2, `expected the hook to BLOCK: ${cmd}`)
  assert.match(r.stderr, /BLOCKED by the Auros publish gate|publish-gate: BLOCKED/)
}
const allowed = (cmd) => assert.equal(hook(cmd).code, 0, `expected the hook to allow: ${cmd}`)

test('hook BLOCKS every publishing shape when the digest has no recorded pass', () => {
  for (const cmd of [
    `podman push ${BASE_IMAGE}@${DIGEST}`,
    `podman manifest push --all auros ${BASE_IMAGE}@${DIGEST}`,
    `docker push ${BASE_IMAGE}@${DIGEST}`,
    `buildah push ${BASE_IMAGE}@${DIGEST} docker://${BASE_IMAGE}:hardened`,
    `skopeo copy docker://${BASE_IMAGE}@${DIGEST} docker://${BASE_IMAGE}:hardened`,
    `cosign sign --yes ${BASE_IMAGE}@${DIGEST}`,
    `cosign attest --predicate sbom.json ${BASE_IMAGE}@${DIGEST}`,
    `crane copy ${BASE_IMAGE}@${DIGEST} ${BASE_IMAGE}:hardened`,
    `oras push ${BASE_IMAGE}@${DIGEST} layer.tar`,
    `regctl image copy ${BASE_IMAGE}@${DIGEST} ${BASE_IMAGE}:hardened`,
  ]) blocked(cmd)
})

test('hook BLOCKS a tag-only push — it cannot confidently parse a digest, so it refuses', () => {
  blocked(`podman push ${BASE_IMAGE}:hardened`)
  blocked('docker push ghcr.io/aarohkandy/auros-base')
  blocked(`skopeo copy dir:./out docker://${BASE_IMAGE}:hardened`)
})

test('hook BLOCKS a gh release upload of an image artifact', () => {
  blocked('gh release upload v0.1.0 auros-lincoln.iso')
  blocked('gh release upload v0.1.0 ./out/disk.raw --clobber')
})

test('hook BLOCKS when two different digests make the target ambiguous', () => {
  const r = hook(`skopeo copy docker://${BASE_IMAGE}@${DIGEST} docker://${BASE_IMAGE}@${OTHER}`)
  assert.equal(r.code, 2)
  assert.match(r.stderr, /ambiguous/)
})

test('hook BLOCKS an uppercase-hex digest rather than normalising it into a match', () => {
  const r = hook(`podman push ${BASE_IMAGE}@sha256:${'AB12'.repeat(16)}`)
  assert.equal(r.code, 2)
  assert.match(r.stderr, /uppercase/)
})

test('hook BLOCKS a publish hidden behind sudo, env assignments and a nested shell', () => {
  blocked(`sudo podman push ${BASE_IMAGE}@${DIGEST}`)
  blocked(`REGISTRY_AUTH_FILE=/tmp/auth.json podman push ${BASE_IMAGE}@${DIGEST}`)
  blocked(`bash -c "podman push ${BASE_IMAGE}@${DIGEST}"`)
  blocked(`sh -c 'sudo docker push ${BASE_IMAGE}@${DIGEST}'`)
  blocked(`make build && podman push ${BASE_IMAGE}:hardened`)
  blocked(`echo starting; cosign sign --yes ${BASE_IMAGE}@${DIGEST}; echo done`)
})

test('hook BLOCKS a publish whose digest differs from a would-be pass by one character', () => {
  // Nothing has passed at all here, but the point is that no near-match logic exists to save it.
  blocked(`podman push ${BASE_IMAGE}@${DIGEST.slice(0, -1)}9`)
})

test('hook does NOT block ordinary work, including commands that merely mention a publisher', () => {
  for (const cmd of [
    'ls -la',
    'git push origin main',
    'npm test',
    'grep -rn "docker push" .',
    'echo "podman push ghcr.io/x/y:tag"',
    'podman build -t auros-base .',
    'skopeo inspect --no-tags docker://ghcr.io/aarohkandy/auros-base:hardened',
    'cosign verify ghcr.io/aarohkandy/auros-base@' + DIGEST,
    'gh release upload v0.1.0 release-notes.md',
    'gh pr create --fill',
  ]) allowed(cmd)
})

test('hook allows non-Bash tools and ignores empty commands', () => {
  assert.equal(hook('anything', 'Read').code, 0)
  assert.equal(hook('', 'Bash').code, 0)
})

test('hook fails CLOSED on input it cannot understand', () => {
  const r = (() => {
    try { execFileSync(process.execPath, [HOOK], { input: 'this is not json', stdio: 'pipe' }); return { code: 0 } } catch (e) { return { code: e.status, stderr: String(e.stderr) } }
  })()
  assert.equal(r.code, 2)
})

test('hook still blocks a genuine publish when a pass exists for a DIFFERENT digest', () => {
  // The hook reads the repo's real ledger, which is empty; this asserts the shape of the refusal
  // reaches the model rather than a bare exit code.
  const r = hook(`podman push ${BASE_IMAGE}@${DIGEST}`)
  assert.match(r.stderr, /vm-check-matrix/)
  assert.match(r.stderr, /no flag, environment variable or argument/i)
})

test.after(() => { if (tmp) rmSync(tmp, { recursive: true, force: true }) })

// ── NEGATIVE SPACE: publish shapes this parser does NOT explicitly model ─────────────────────────
//
// The suite above proves the parser handles its own allowlist. It does not prove the allowlist is
// complete, and an audit found eighteen shapes that were ALLOWED with the digest sitting in plain
// text: `podman image push`, `docker image push`, `crane cp`, `buildah manifest push`,
// `regctl image export`, `if …; then … fi`, `for …; do … done`, `{ … }`, `( … )`, a LEADING
// redirection, `eval "…"`, `$(echo podman) push`, `echo … | bash`, `python3 -c`, `node -e`,
// `make push`, `npm run`, and a raw `curl -X PUT` to /v2/…/manifests/.
//
// Every case below failed when it was written. That is the point of writing it: a test that asserts
// the parser's own list back to it cannot discover that the list is short.
test('hook BLOCKS publish shapes it does not explicitly model', () => {
  const REF = `${BASE_IMAGE}@${DIGEST}`
  for (const cmd of [
    // subcommands that are not positional[0]
    `podman image push ${REF}`,
    `docker image push ${REF}`,
    `buildah manifest push ${REF} docker://${REF}`,
    `crane cp ${REF} ${BASE_IMAGE}:stable`,
    `regctl image export ${REF} out.tar`,
    // shell grammar in front of the command word
    `if true; then podman push ${REF}; fi`,
    `for i in 1; do podman push ${REF}; done`,
    `{ podman push ${REF}; }`,
    `(podman push ${REF})`,
    `>/tmp/log podman push ${REF}`,
    // indirection and interpreters
    `eval "podman push ${REF}"`,
    `$(echo podman) push ${REF}`,
    `echo 'podman push ${REF}' | bash`,
    `python3 -c "import subprocess;subprocess.run(['podman','push','${REF}'])"`,
    `node -e "require('child_process').execSync('podman push ${REF}')"`,
    `make push IMAGE=${REF}`,
    `npm run publish:image --image=${REF}`,
    // the registry API itself, no client involved
    "curl -X PUT -H 'Authorization: Bearer t' --data-binary @manifest.json https://ghcr.io/v2/aarohkandy/auros-base/manifests/stable",
  ]) blocked(cmd)
})

test('the same widening does not swallow ordinary work', () => {
  for (const cmd of [
    'make test',
    'npm run build',
    'pnpm install --frozen-lockfile',
    `node tools/gate.mjs ${DIGEST}`,          // running the gate must not be refused BY the gate
    'node --test tools/gate.test.mjs',
    'python3 -m pip install --quiet jsonschema',
    'for f in *.ts; do echo $f; done',
    'if true; then echo hi; fi',
    'podman build -t localhost/x:candidate -f Containerfile .',
    `skopeo inspect --no-tags docker://${BASE_IMAGE}:hardened`,
  ]) allowed(cmd)
})

// ── The evidence, and the gate, are not this agent's to edit ─────────────────────────────────────
//
// attest/README.md calls this "the one thing none of these protect against": nothing gated writes to
// the ledger, so one appended line turned REFUSED into ALLOW with no VM anywhere. The real fix is a
// signature from the CI identity on results.json, verified by decide(). This is the interim, and its
// scope is exactly one agent in one harness — which is the scope of every claim this hook makes.
const LEDGER_REL = ['attest', 'passed-digests.tsv'].join('/')
const HOOK_REL = ['.claude', 'hooks', 'publish-gate.mjs'].join('/')
const SETTINGS_REL = ['.claude', 'settings.json'].join('/')
const GATE_REL = ['tools', 'gate.mjs'].join('/')

test('hook BLOCKS writes to the ledger, the hook and the gate', () => {
  for (const cmd of [
    `printf 'row\\n' >> ${LEDGER_REL}`,
    `sed -i '' 's/a/b/' ${LEDGER_REL}`,
    `echo x | tee -a ${LEDGER_REL}`,
    `cp /tmp/fake.tsv ${LEDGER_REL}`,
    `mv /tmp/fake.tsv ${LEDGER_REL}`,
    `truncate -s 0 ${LEDGER_REL}`,
    `rm ${HOOK_REL}`,
    `rm ${SETTINGS_REL}`,
    `chmod 777 ${GATE_REL}`,
  ]) blocked(cmd)
})

test('hook ALLOWS reading the ledger — it is public evidence, not a secret', () => {
  for (const cmd of [
    `cat ${LEDGER_REL}`,
    `wc -l ${LEDGER_REL}`,
    `grep sha256 ${LEDGER_REL}`,
    `git diff ${LEDGER_REL}`,
    `curl -sfL -o /tmp/x https://raw.githubusercontent.com/aarohkandy/auros/main/${LEDGER_REL}`,
  ]) allowed(cmd)
})

test('a Write or Edit aimed at the ledger is refused, if such an event ever reaches this hook', () => {
  // .claude/settings.json installs this hook with matcher "Bash", so these events do NOT reach it
  // today and the ledger is NOT protected against the Write tool. Widening the matcher is a change
  // to the operator's own configuration, not ours to make — so the branch is correct and the limit
  // is stated, here and in the hook, rather than implied to be covered.
  for (const rel of [LEDGER_REL, SETTINGS_REL, GATE_REL]) {
    const payload = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: `/Users/x/auros/${rel}` } })
    let code = 0
    try { execFileSync(process.execPath, [HOOK], { input: payload, stdio: 'pipe' }) } catch (e) { code = e.status }
    assert.equal(code, 2, `a Write to ${rel} was allowed`)
  }
  const ok = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: '/Users/x/auros/README.md' } })
  execFileSync(process.execPath, [HOOK], { input: ok, stdio: 'pipe' })
})

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// DRIFT, AGAINST THE REAL MATRIX FILES
//
// There are already two drift tests above. Both point the gate at a STUB checks.yaml whose entire
// content is a `matrix_version:` line. That stub is wrong in two ways at once — the version differs
// AND the check set is empty — so either comparison alone refuses it, and deleting the other one
// changes nothing that any test can see. A mutation run confirmed it: `if (Number(mv[1]) !==
// MATRIX_VERSION)` → `if (false)` and `if (missing.length || extra.length)` → `&&` both survived the
// full suite.
//
// Every test below therefore starts from the REAL matrix files and changes exactly one thing, so the
// refusal is attributable to that thing. The first test is the control that makes the rest mean
// something: an unedited copy of both real files must still ALLOW.
// ═════════════════════════════════════════════════════════════════════════════════════════════════

const realChecks = () => readFileSync(DEFAULT_PATHS.checks, 'utf8')
const realProfiles = () => readFileSync(DEFAULT_PATHS.profiles, 'utf8')

/** A fixture whose ledger is `ledgerText` and whose matrix files are copies (optionally edited). */
function matrixFixture (ledgerText, { checks, profiles } = {}) {
  tmp ??= mkdtempSync(join(tmpdir(), 'auros-gate-'))
  const paths = fixture(ledgerText)
  const put = (name, text) => {
    const p = join(tmp, `${name}-${Math.random().toString(36).slice(2)}.yaml`)
    writeFileSync(p, text)
    return p
  }
  if (checks !== undefined) paths.checks = put('checks', checks)
  if (profiles !== undefined) paths.profiles = put('profiles', profiles)
  return paths
}

/** Delete the `- id: <id>` line from a matrix file, and prove the fixture actually changed. */
function withoutId (text, id) {
  const re = new RegExp(`^\\s*-?\\s*id:\\s*${id}\\s*$`)
  const out = text.split('\n').filter((l) => !re.test(l)).join('\n')
  assert.notEqual(out, text, `the fixture did not remove an "id: ${id}" line — it would prove nothing`)
  return out
}

test('CONTROL: verbatim copies of the real matrix files still ALLOW', () => {
  // Without this, every drift refusal below could be caused by the copying rather than by the edit.
  const d = decide({ digest: DIGEST }, matrixFixture(ledgerWith(row()), {
    checks: realChecks(), profiles: realProfiles(),
  }))
  assert.equal(d.allowed, true, `copying the real matrix files verbatim changed the verdict: ${d.reason}`)
})

test('REFUSES every digest when checks.yaml declares a different matrix_version than the gate', () => {
  // The worst survivor of the run. Bump auros-base/matrix/checks.yaml to v2 while the gate still
  // enforces v1 and the gate ALLOWED a pass recorded under v1 — the harness testing one matrix, the
  // gate enforcing another, nothing red. checks.yaml's own comment says bumping the matrix
  // INVALIDATES every previously recorded pass; this is the test that makes that sentence true.
  const bumped = realChecks().replace(/^matrix_version:\s*\d+\s*$/m, `matrix_version: ${MATRIX_VERSION + 1}`)
  assert.notEqual(bumped, realChecks(), 'the fixture did not change the matrix_version line')
  const d = decide({ digest: DIGEST }, matrixFixture(ledgerWith(row()), { checks: bumped, profiles: realProfiles() }))
  refused(d, 'matrix-drift')
  // Both numbers, because a drift message naming one of them tells nobody which side to change.
  assert.match(d.reason, new RegExp(`checks\\.yaml says ${MATRIX_VERSION + 1}`),
    `the refusal must name the version the matrix declares; got: ${d.reason}`)
  assert.match(d.reason, new RegExp(`this gate enforces ${MATRIX_VERSION}`),
    `the refusal must name the version the gate enforces; got: ${d.reason}`)
})

test('REFUSES every digest when checks.yaml is BEHIND the gate, not only ahead of it', () => {
  const older = realChecks().replace(/^matrix_version:\s*\d+\s*$/m, 'matrix_version: 0')
  refused(decide({ digest: DIGEST }, matrixFixture(ledgerWith(row()), { checks: older, profiles: realProfiles() })), 'matrix-drift')
})

test('REFUSES when checks.yaml LACKS a check the gate requires — a deletion, in one direction only', () => {
  // The most likely real edit: somebody removes a check they think is flaky. With the drift condition
  // written as `missing.length && extra.length`, a pure deletion is invisible and the gate keeps
  // certifying passes for a matrix that no longer runs that check.
  for (const id of ['S10', 'S1', 'R1', 'B12', 'U1']) {
    const d = decide({ digest: DIGEST }, matrixFixture(ledgerWith(row()), {
      checks: withoutId(realChecks(), id), profiles: realProfiles(),
    }))
    refused(d, 'matrix-drift')
    assert.match(d.reason, /gate requires but matrix lacks/, `deleting ${id} was reported as: ${d.reason}`)
    assert.ok(d.reason.includes(id), `the refusal must name the missing check ${id}; got: ${d.reason}`)
  }
})

test('REFUSES when checks.yaml DEFINES a check the gate does not require — an addition, one direction only', () => {
  const added = `${realChecks()}\n  - id: S99\n    name: A check this gate has never heard of\n`
  const d = decide({ digest: DIGEST }, matrixFixture(ledgerWith(row()), { checks: added, profiles: realProfiles() }))
  refused(d, 'matrix-drift')
  assert.match(d.reason, /matrix defines but gate does not require/, d.reason)
  assert.match(d.reason, /S99/, `the refusal must name the extra check; got: ${d.reason}`)
})

test('REFUSES when profiles.yaml defines a profile the gate does not know', () => {
  // The base-coverage rule ("the base must pass every profile in profiles.yaml") is computed from the
  // gate's own KNOWN_PROFILES. Add an 8th profile to profiles.yaml and, with the drift check reduced
  // to `pMissing.length`, the base is ALLOWED after passing only the 7 the gate knows — a gap in
  // every customer fleet at once, and silent.
  const added = realProfiles().replace(/^(\s*)- id: tpm12\s*$/m,
    '$1- id: uefi-future\n$1  summary: A profile this gate has never heard of.\n$1- id: tpm12')
  assert.notEqual(added, realProfiles(), 'the fixture did not add a profile')
  const d = decide({ digest: DIGEST }, matrixFixture(ledgerWith(row()), { checks: realChecks(), profiles: added }))
  refused(d, 'matrix-drift')
  assert.match(d.reason, /matrix defines but gate does not know/, d.reason)
  assert.match(d.reason, /uefi-future/, `the refusal must name the extra profile; got: ${d.reason}`)
})

test('REFUSES when profiles.yaml LACKS a profile the gate knows — the inverse, also untested until now', () => {
  for (const id of ['bios-legacy', 'uefi-modern', 'tpm12']) {
    const d = decide({ digest: DIGEST }, matrixFixture(ledgerWith(row()), {
      checks: realChecks(), profiles: withoutId(realProfiles(), id),
    }))
    refused(d, 'matrix-drift')
    assert.match(d.reason, /gate knows but matrix lacks/, d.reason)
    assert.ok(d.reason.includes(id), `the refusal must name the missing profile ${id}; got: ${d.reason}`)
  }
})

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// THE NAMESPACE BOUNDARY
//
// The existing foreign-image test uses `docker.io/someone/else`, which is obviously not ours and is
// therefore refused by almost any implementation. Dropping the trailing slash from the namespace
// prefix — `${registry}/${org}/` → `${registry}/${org}` — survived the whole suite, and it turns
// every org whose NAME STARTS WITH ours into a member of our namespace. Namespace confusion, in the
// one check that confirms the image is ours at all.
// ═════════════════════════════════════════════════════════════════════════════════════════════════

test('REFUSES an image in an org whose name merely STARTS WITH ours', () => {
  const evilOrgs = [`${CONFIG.org}-evil`, `${CONFIG.org}x`, `${CONFIG.org}.attacker`, `${CONFIG.org}2`]
  for (const org of evilOrgs) {
    const image = `${CONFIG.registry}/${org}/${CONFIG.product}-base`
    assert.ok(image.startsWith(`${CONFIG.registry}/${CONFIG.org}`),
      `the fixture "${image}" is not actually a prefix collision, so it tests the wrong thing`)
    assert.ok(!image.startsWith(`${CONFIG.registry}/${CONFIG.org}/`), 'and it must not be genuinely ours')
    const d = decide({ digest: DIGEST }, fixture(ledgerWith(row({ image }))))
    refused(d, 'foreign-image')
    assert.ok(d.reason.includes(image), `the refusal must name the image it rejected; got: ${d.reason}`)
  }
})

test('REFUSES a registry whose name merely starts with ours', () => {
  for (const registry of [`${CONFIG.registry}.evil.com`, `${CONFIG.registry}x`]) {
    refused(decide({ digest: DIGEST }, fixture(ledgerWith(row({
      image: `${registry}/${CONFIG.org}/${CONFIG.product}-base`,
    })))), 'foreign-image')
  }
})

test('CONTROL: a genuine image in our namespace, including a longer NAME, still ALLOWS', () => {
  // The boundary cuts on the org separator, not on string length: `auros-base-kiosk` is ours.
  assert.equal(decide({ digest: DIGEST }, fixture(ledgerWith(row()))).allowed, true)
  assert.equal(decide({ digest: DIGEST }, fixture(ledgerWith(row({
    image: `${CONFIG.registry}/${CONFIG.org}/${CONFIG.product}-base-kiosk`,
  })))).allowed, true)
})

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// A BROKEN CONFIG IS A BROKEN CONFIG, AND MUST SAY SO
//
// Not a fail-open: with `!config.registry && !config.org`, a config declaring only `registry` still
// refuses — but as `foreign-image`, because the prefix becomes "ghcr.io/undefined/". At 2am the
// operator is told the recorded image is foreign when the real fault is auros.config.json, and the
// fix goes in the wrong direction. The existing test for this branch asserts no code at all, so any
// refusal satisfies it.
// ═════════════════════════════════════════════════════════════════════════════════════════════════

test('REFUSES with code bad-config when auros.config.json declares only half the namespace', () => {
  tmp ??= mkdtempSync(join(tmpdir(), 'auros-gate-'))
  const cases = [
    ['only registry', { registry: CONFIG.registry, product: CONFIG.product }],
    ['only org', { org: CONFIG.org, product: CONFIG.product }],
    ['neither', { product: CONFIG.product }],
    ['an empty registry string', { registry: '', org: CONFIG.org }],
    ['an empty org string', { registry: CONFIG.registry, org: '' }],
  ]
  for (const [what, cfg] of cases) {
    const p = join(tmp, `config-${Math.random().toString(36).slice(2)}.json`)
    writeFileSync(p, JSON.stringify(cfg))
    const d = decide({ digest: DIGEST }, fixture(ledgerWith(row()), { config: p }))
    refused(d, 'bad-config')
    assert.match(d.reason, /registry and org/,
      `a config with ${what} must be reported as a broken config, not as a foreign image; got: ${d.reason}`)
  }
})

test('CONTROL: a config declaring both halves ALLOWS, so bad-config is not refusing everything', () => {
  tmp ??= mkdtempSync(join(tmpdir(), 'auros-gate-'))
  const p = join(tmp, `config-good-${Math.random().toString(36).slice(2)}.json`)
  writeFileSync(p, JSON.stringify({ registry: CONFIG.registry, org: CONFIG.org, product: CONFIG.product }))
  assert.equal(decide({ digest: DIGEST }, fixture(ledgerWith(row()), { config: p })).allowed, true)
})
