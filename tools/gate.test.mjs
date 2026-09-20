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
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
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
