#!/usr/bin/env node
// PUBLISH GATE — the enforcement library shared by CI and by the PreToolUse hook.
//
// Spec §4.3 / prohibition §4.3: *never publish an image that has not booted in a VM and passed the
// full check matrix. Enforce with a CI gate that cannot be overridden by a flag.*
//
// One implementation, two callers. CI calls it before `podman push`/`cosign sign`; the hook calls it
// before this agent runs a Bash command that looks like a publish. Two copies of a gate become two
// different gates within a month, and the weaker one is the one that gets used.
//
// ── THE DISPOSITION IS ALWAYS "REFUSE" UNLESS PROVEN OTHERWISE ───────────────────────────────────
// Every path through this file that does not reach the final `allow()` returns a refusal. In
// particular these are refusals, not errors, not warnings and not unknowns:
//   * the ledger cannot be read, or is empty, or has the wrong header
//   * ANY row in the ledger is malformed — not merely the row being asked about
//   * the digest is not present, or is present twice, or is not a digest at all (a tag)
//   * the row records a partial pass: fewer profiles listed than bound, or a check missing
//   * the row's matrix_version is not the current one
//   * the matrix definition has drifted from the constants below
//   * auros.config.json cannot be read, so we cannot confirm the image is ours
//
// ── THERE IS NO BYPASS, AND HERE IS HOW TO CHECK THAT CLAIM ──────────────────────────────────────
// `decide()` takes exactly one thing that can change its answer: the ledger contents. Its options
// argument selects WHICH FILES to read (so the tests can run against a fixture), and every other
// parameter — image, recipe — can only ever add a reason to refuse, never remove one. There is no
// parameter, no environment variable and no command-line flag that turns a refusal into an allow;
// this file reads `process.env` nowhere, and the CLI rejects every argument it does not recognise
// rather than ignoring it, so an unrecognised flag is itself a refusal. `tools/gate.test.mjs`
// asserts both of those properties against this file's own source text.

import { readFileSync, lstatSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = join(HERE, '..')

// Paths are resolved from this file's own location, never from the working directory and never from
// the environment, so that where the process happens to be started cannot change which ledger is read.
export const DEFAULT_PATHS = {
  ledger: join(REPO_ROOT, 'attest', 'passed-digests.tsv'),
  config: join(REPO_ROOT, 'auros.config.json'),
  checks: join(REPO_ROOT, 'auros-base', 'matrix', 'checks.yaml'),
  profiles: join(REPO_ROOT, 'auros-base', 'matrix', 'profiles.yaml'),
}

// ── The matrix, as this gate understands it ──────────────────────────────────────────────────────
// These constants are authoritative FOR THE GATE. `auros-base/matrix/checks.yaml` is authoritative
// for the harness. They must agree; when the matrix files are present, `driftCheck()` compares them
// and refuses everything on disagreement rather than silently gating on the weaker of the two.
// auros-base is a separate repo (DECISIONS.md D6) and is not always checked out beside us, which is
// why the constants live here as well as there.
export const MATRIX_VERSION = 1

export const REQUIRED_CHECKS = Object.freeze([
  'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10',
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12',
  'U1', 'U2', 'U3', 'U4', 'U5',
  'R1',
])

export const KNOWN_PROFILES = Object.freeze([
  'uefi-modern', 'uefi-secureboot', 'bios-legacy', 'low-ram', 'old-cpu', 'small-disk', 'tpm12',
])

// Every image, base or recipe, is tested on the baseline profile. A recipe binds additional ones.
export const MANDATORY_PROFILES = Object.freeze(['uefi-modern'])

export const HEADER = Object.freeze([
  'digest', 'image', 'recipe', 'matrix_version', 'profiles_passed',
  'checks_passed', 'run_url', 'recorded_at', 'recorded_by',
])

export const DIGEST_RE = /^sha256:[a-f0-9]{64}$/
const IMAGE_RE = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?(\/[a-z0-9]([a-z0-9._-]*[a-z0-9])?)+$/
const RECIPE_RE = /^[a-z0-9][a-z0-9-]{0,38}$/
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
const URL_RE = /^https:\/\/[^\s]+$/
const SET_RE = /^([^\s/]+)\/(\d+)$/          // "a,b,c/3"

const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000   // clock skew between a runner and a reviewer

// ── Result shape ─────────────────────────────────────────────────────────────────────────────────
// `allowed` is a boolean and nothing else is consulted by callers. `code` is for machines, `reason`
// is for the human who has to understand a refusal at 2am and must not be tempted to route around it.
const refuse = (code, reason) => ({ allowed: false, code, reason })
const allow = (row) => ({ allowed: true, code: 'pass-recorded', reason:
  `digest has a full recorded pass: ${row.profilesPassed.length}/${row.profilesBound} profiles, ` +
  `${row.checksPassed.length}/${REQUIRED_CHECKS.length} checks, matrix v${row.matrix_version}, ` +
  `run ${row.run_url}`, row })

// ── Ledger parsing ───────────────────────────────────────────────────────────────────────────────
// Structural validity is checked for EVERY row, because a file we cannot fully parse is a file whose
// silence about a digest means nothing. Currency (matrix_version) is judged per-row later, so that
// bumping the matrix invalidates old passes without making the file unreadable.
export function parseLedger (text) {
  const problems = []
  const rows = []
  const lines = text.split('\n')
  let headerSeen = false

  lines.forEach((raw, i) => {
    const lineNo = i + 1
    if (raw.startsWith('#')) return
    if (raw.trim() === '') return
    const fields = raw.split('\t')

    if (!headerSeen) {
      headerSeen = true
      if (fields.length !== HEADER.length || fields.some((f, n) => f !== HEADER[n])) {
        problems.push(`line ${lineNo}: header must be exactly "${HEADER.join('\\t')}", got "${raw.slice(0, 160)}"`)
      }
      return
    }

    if (fields.length !== HEADER.length) {
      problems.push(`line ${lineNo}: expected ${HEADER.length} tab-separated fields, got ${fields.length}`)
      return
    }
    const r = Object.fromEntries(HEADER.map((h, n) => [h, fields[n]]))
    r.__line = lineNo

    for (const [k, v] of Object.entries(r)) {
      if (k === '__line') continue
      if (v !== v.trim() || v === '') problems.push(`line ${lineNo}: field "${k}" is empty or has surrounding whitespace`)
    }
    if (!DIGEST_RE.test(r.digest)) problems.push(`line ${lineNo}: digest "${r.digest}" is not sha256:<64 lowercase hex>. A tag is never acceptable here.`)
    if (!IMAGE_RE.test(r.image)) problems.push(`line ${lineNo}: image "${r.image}" is not a bare image reference (no tag, no digest)`)
    if (r.recipe !== '-' && !RECIPE_RE.test(r.recipe)) problems.push(`line ${lineNo}: recipe "${r.recipe}" is neither "-" nor a valid recipe name`)
    if (!/^\d+$/.test(r.matrix_version)) problems.push(`line ${lineNo}: matrix_version "${r.matrix_version}" is not an integer`)
    if (!SET_RE.test(r.profiles_passed)) problems.push(`line ${lineNo}: profiles_passed "${r.profiles_passed}" is not "<id>,<id>,…/<bound count>"`)
    if (!SET_RE.test(r.checks_passed)) problems.push(`line ${lineNo}: checks_passed "${r.checks_passed}" is not "<id>,<id>,…/<required count>"`)
    if (!URL_RE.test(r.run_url)) problems.push(`line ${lineNo}: run_url "${r.run_url}" is not an https URL anyone can reopen`)
    if (!TIMESTAMP_RE.test(r.recorded_at)) problems.push(`line ${lineNo}: recorded_at "${r.recorded_at}" is not UTC YYYY-MM-DDTHH:MM:SSZ`)
    else {
      const t = Date.parse(r.recorded_at)
      if (Number.isNaN(t)) problems.push(`line ${lineNo}: recorded_at "${r.recorded_at}" is not a real instant`)
      // Date.parse does NOT reject a date that cannot exist: it rolls it over, so "2026-02-30" comes
      // back as 2026-03-02 and a shape check alone reports it clean. The only reliable test is that
      // the instant prints back as the string we were given. Caught by gate.refusals.test.mjs; the
      // field is the ledger's whole audit trail, and a timestamp that silently means a different day
      // is worse than an obviously missing one because it still looks like evidence.
      else if (new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z') !== r.recorded_at) {
        problems.push(`line ${lineNo}: recorded_at "${r.recorded_at}" is not a date that exists — it normalises to ` +
          `"${new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z')}". A rolled-over date is not a record of when anything happened.`)
      }
      else if (t > Date.now() + FUTURE_TOLERANCE_MS) problems.push(`line ${lineNo}: recorded_at "${r.recorded_at}" is in the future`)
    }
    rows.push(r)
  })

  if (!headerSeen) problems.push('ledger has no header row — it is empty or entirely comments')
  return { rows, problems }
}

function parseSet (field) {
  const m = SET_RE.exec(field)
  const items = m[1].split(',').map((s) => s.trim()).filter((s) => s !== '')
  return { items, declared: Number(m[2]) }
}

// ── Drift detection against the matrix definition ────────────────────────────────────────────────
// If auros-base is checked out beside us, its matrix files must agree with the constants above. A
// disagreement means the harness is testing one thing and the gate is enforcing another, so we refuse
// everything until a human reconciles them. If the files are absent we proceed on the constants — the
// gate does not become weaker because a sibling repo is missing, and it does not become a no-op either.
export function driftCheck (paths = DEFAULT_PATHS) {
  let checksText, profilesText
  try { checksText = readFileSync(paths.checks, 'utf8') } catch { return null }
  try { profilesText = readFileSync(paths.profiles, 'utf8') } catch {
    return `${paths.checks} is readable but ${paths.profiles} is not — the matrix definition is half-present`
  }

  const mv = /^matrix_version:\s*(\d+)\s*$/m.exec(checksText)
  if (!mv) return `cannot find matrix_version in ${paths.checks}`
  if (Number(mv[1]) !== MATRIX_VERSION) {
    return `matrix_version drift: checks.yaml says ${mv[1]}, this gate enforces ${MATRIX_VERSION}. ` +
      'Bumping the matrix invalidates every recorded pass; update MATRIX_VERSION and REQUIRED_CHECKS in tools/gate.mjs in the same change.'
  }
  const ids = [...checksText.matchAll(/^\s*-?\s*id:\s*([SBUR]\d+)\s*$/gm)].map((m) => m[1])
  const missing = REQUIRED_CHECKS.filter((c) => !ids.includes(c))
  const extra = ids.filter((c) => !REQUIRED_CHECKS.includes(c))
  if (missing.length || extra.length) {
    return `check-set drift between checks.yaml and tools/gate.mjs — ` +
      `${missing.length ? `gate requires but matrix lacks: ${missing.join(',')}. ` : ''}` +
      `${extra.length ? `matrix defines but gate does not require: ${extra.join(',')}.` : ''}`
  }
  const profIds = [...profilesText.matchAll(/^\s*-\s*id:\s*([a-z0-9][a-z0-9-]*)\s*$/gm)].map((m) => m[1])
  const pMissing = KNOWN_PROFILES.filter((p) => !profIds.includes(p))
  const pExtra = profIds.filter((p) => !KNOWN_PROFILES.includes(p))
  if (pMissing.length || pExtra.length) {
    return `profile-set drift between profiles.yaml and tools/gate.mjs — ` +
      `${pMissing.length ? `gate knows but matrix lacks: ${pMissing.join(',')}. ` : ''}` +
      `${pExtra.length ? `matrix defines but gate does not know: ${pExtra.join(',')}.` : ''}`
  }
  return null
}

// ── The decision ─────────────────────────────────────────────────────────────────────────────────
/**
 * @param {{digest:string, image?:string, recipe?:string}} query
 * @param {object} [paths]  which files to read — a test fixture, or the repo's own. Selecting a file
 *                          is not the same as overriding a verdict: the same bytes always decide the
 *                          same way, and nothing here can make a refusal into an allow.
 * @returns {{allowed:boolean, code:string, reason:string, row?:object}}
 */
export function decide (query, paths = DEFAULT_PATHS) {
  const digest = query && typeof query.digest === 'string' ? query.digest.trim() : ''
  if (digest === '') return refuse('no-digest', 'no digest was supplied. A publish is gated on exact bytes; there is nothing to look up.')
  if (!DIGEST_RE.test(digest)) {
    return refuse('not-a-digest',
      `"${digest}" is not a content digest (sha256:<64 lowercase hex>). A tag is not acceptable: a tag can be ` +
      'repointed after the tests passed, so a tag-gated publish gates nothing. Resolve it with ' +
      '`skopeo inspect --no-tags docker://<ref> | jq -r .Digest` and gate on that.')
  }

  // We must be able to confirm the image is inside our own namespace, and the namespace has exactly
  // one home: auros.config.json. If we cannot read it, we do not guess — we refuse.
  let config
  try { config = JSON.parse(readFileSync(paths.config, 'utf8')) } catch (e) {
    return refuse('no-config', `cannot read the namespace from ${paths.config}: ${e.message}. Refusing rather than assuming which registry is ours.`)
  }
  const nsPrefix = `${config.registry}/${config.org}/`
  if (!config.registry || !config.org) return refuse('bad-config', `${paths.config} does not declare both registry and org`)

  const drift = driftCheck(paths)
  if (drift) return refuse('matrix-drift', `${drift} Refusing every digest until the gate and the matrix agree.`)

  // The ledger must be a REGULAR FILE at the path this gate derived from its own location. A symlink
  // is a second name for bytes somewhere else, and "somewhere else" is a place a build step can write
  // without touching anything a reviewer reads. The job that manufactures evidence must not be able to
  // hand the job that reads it a different file by renaming one, so a non-regular ledger is a refusal
  // rather than a follow. lstat, never stat: stat would follow the very link we are trying to see.
  try {
    const st = lstatSync(paths.ledger)
    if (st.isSymbolicLink()) {
      return refuse('ledger-not-a-regular-file',
        `${paths.ledger} is a symbolic link, not a regular file. The ledger is the one artefact a publish is ` +
        'gated on; a link means the bytes that decide live somewhere this repo does not show a reviewer. ' +
        'Replace the link with the file.')
    }
    // A directory (or a device, or a socket) where the ledger should be keeps the historical
    // `no-ledger` code: from a caller's point of view nothing readable is there at all.
    if (!st.isFile()) {
      return refuse('no-ledger', `${paths.ledger} is not a regular file. An attestation ledger that is not a file records nothing.`)
    }
  } catch (e) {
    return refuse('no-ledger', `cannot stat the attestation ledger at ${paths.ledger}: ${e.message}. An unreadable ledger proves nothing passed.`)
  }

  let text
  try { text = readFileSync(paths.ledger, 'utf8') } catch (e) {
    return refuse('no-ledger', `cannot read the attestation ledger at ${paths.ledger}: ${e.message}. An unreadable ledger proves nothing passed.`)
  }

  const { rows, problems } = parseLedger(text)
  if (problems.length) {
    return refuse('malformed-ledger',
      `the attestation ledger is malformed, so its silence about any digest is meaningless:\n  - ${problems.join('\n  - ')}`)
  }
  if (rows.length === 0) {
    return refuse('empty-ledger', `${paths.ledger} has a valid header and no recorded passes. Nothing has qualified to be published.`)
  }

  const matches = rows.filter((r) => r.digest === digest)
  if (matches.length === 0) {
    return refuse('digest-absent',
      `${digest} has no row in ${paths.ledger}. It has not passed the check matrix, or it passed under a ` +
      'different matrix version and was invalidated, or these are simply not the bytes that were tested.')
  }

  const current = matches.filter((r) => Number(r.matrix_version) === MATRIX_VERSION)
  if (current.length === 0) {
    const versions = [...new Set(matches.map((r) => r.matrix_version))].join(', ')
    return refuse('stale-matrix-version',
      `${digest} is recorded, but under matrix version ${versions}; the current matrix is v${MATRIX_VERSION}. ` +
      'A pass under a different matrix is not evidence of a pass under this one — re-run the matrix against this digest.')
  }
  if (current.length > 1) {
    return refuse('duplicate-rows',
      `${digest} has ${current.length} rows at matrix v${MATRIX_VERSION} (lines ${current.map((r) => r.__line).join(', ')}). ` +
      'Re-testing a digest replaces its row; two live claims about the same bytes is a ledger we cannot trust.')
  }

  const row = current[0]

  if (!row.image.startsWith(nsPrefix)) {
    return refuse('foreign-image',
      `the row for ${digest} names image "${row.image}", which is not under this project's namespace ` +
      `"${nsPrefix}" as declared in ${paths.config}.`)
  }
  if (query.image && query.image !== row.image) {
    return refuse('image-mismatch',
      `the publish targets "${query.image}" but the recorded pass is for "${row.image}". The same bytes under a ` +
      'different name are still gated on the name that was tested.')
  }
  if (query.recipe && query.recipe !== row.recipe) {
    return refuse('recipe-mismatch', `the publish claims recipe "${query.recipe}" but the recorded pass is for "${row.recipe}".`)
  }

  // ── Profiles: a partial pass is a fail ─────────────────────────────────────────────────────────
  const prof = parseSet(row.profiles_passed)
  const profileSet = new Set(prof.items)
  if (prof.items.length !== profileSet.size) {
    return refuse('duplicate-profile', `profiles_passed lists a profile twice: "${row.profiles_passed}"`)
  }
  const unknownProfiles = prof.items.filter((p) => !KNOWN_PROFILES.includes(p))
  if (unknownProfiles.length) {
    return refuse('unknown-profile',
      `profiles_passed names ${unknownProfiles.join(', ')}, which is not a profile in profiles.yaml. ` +
      'An invented profile name is how a pass gets claimed for hardware nobody tested.')
  }
  if (prof.declared < 1) return refuse('no-profiles-bound', `the row claims ${prof.declared} bound profiles. An image tested on nothing has not been tested.`)
  if (prof.items.length !== prof.declared) {
    return refuse('partial-profile-pass',
      `PARTIAL PASS: ${prof.items.length} of ${prof.declared} bound profiles passed (${prof.items.join(', ')}). ` +
      'Every bound profile must pass. One failure anywhere is no publish — a machine we did not prove it on is ' +
      'a machine in a school that boots to nothing.')
  }
  const missingMandatory = MANDATORY_PROFILES.filter((p) => !profileSet.has(p))
  if (missingMandatory.length) {
    return refuse('missing-mandatory-profile',
      `every image is tested on ${MANDATORY_PROFILES.join(', ')}; this row does not list ${missingMandatory.join(', ')}.`)
  }
  if (row.recipe === '-') {
    // The base is the single thing every customer machine inherits. It is tested on all of them.
    const missingBase = KNOWN_PROFILES.filter((p) => !profileSet.has(p))
    if (missingBase.length || prof.declared !== KNOWN_PROFILES.length) {
      return refuse('base-profile-coverage',
        `the base image must pass every profile in profiles.yaml (${KNOWN_PROFILES.length}); this row covers ` +
        `${prof.items.length}${missingBase.length ? `, missing ${missingBase.join(', ')}` : ''}. Every recipe inherits ` +
        'from the base, so a gap here is a gap in every customer fleet at once.')
    }
  }

  // ── Checks: the set must be complete, and `skip` was never written here ────────────────────────
  const chk = parseSet(row.checks_passed)
  const checkSet = new Set(chk.items)
  if (chk.items.length !== checkSet.size) return refuse('duplicate-check', `checks_passed lists a check twice: "${row.checks_passed}"`)
  if (chk.declared !== REQUIRED_CHECKS.length) {
    return refuse('wrong-check-count',
      `checks_passed declares ${chk.declared} required checks; this matrix requires ${REQUIRED_CHECKS.length}. ` +
      'A row that disagrees with the gate about how many checks exist was written against a different matrix.')
  }
  const missingChecks = REQUIRED_CHECKS.filter((c) => !checkSet.has(c))
  if (missingChecks.length) {
    return refuse('incomplete-checks',
      `PARTIAL PASS: ${chk.items.length} of ${REQUIRED_CHECKS.length} required checks recorded; missing ` +
      `${missingChecks.join(', ')}. A skipped check is a failed check — that is the single most common way a ` +
      'suite quietly stops testing anything.')
  }
  const unknownChecks = chk.items.filter((c) => !REQUIRED_CHECKS.includes(c))
  if (unknownChecks.length) {
    return refuse('unknown-check', `checks_passed names ${unknownChecks.join(', ')}, which this matrix does not define.`)
  }

  row.profilesPassed = prof.items
  row.profilesBound = prof.declared
  row.checksPassed = chk.items
  return allow(row)
}

/** Throws on refusal. For callers that want the failure to be structural rather than a boolean they might drop. */
export function assertPublishable (query, paths = DEFAULT_PATHS) {
  const d = decide(query, paths)
  if (!d.allowed) {
    const e = new Error(`publish gate REFUSES ${query && query.digest ? query.digest : '(no digest)'} [${d.code}]: ${d.reason}`)
    e.code = d.code
    throw e
  }
  return d
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────
//   node tools/gate.mjs <sha256:…> [--image ghcr.io/<org>/<name>] [--recipe <name>]
// exit 0 = a full pass is recorded · exit 1 = REFUSED · exit 2 = could not decide (also a refusal).
// The ledger path is deliberately NOT an argument. `--image` and `--recipe` can only narrow, never widen.
// Any argument this parser does not recognise is fatal: a flag we ignore is a flag someone will try.
export function main (argv) {
  // ── THERE ARE NO SUBCOMMANDS, AND THIS IS THE CHECK THAT SAYS SO OUT LOUD ──────────────────────
  // A call written as `gate.mjs record --results …` used to swallow "record" as the digest and then
  // die on the NEXT token, so the error read like a flag problem rather than like a call to a
  // program that does not exist. A CI step written that way never reaches the gate at all, and the
  // workflow around it looks gated. A leading bare word followed by further arguments is therefore
  // fatal in its own right, and the message names the program the caller actually wanted.
  // A lone bare word still falls through to `decide`, which has a better answer for it: a tag.
  if (argv.length > 1 && !argv[0].startsWith('-') && !DIGEST_RE.test(argv[0])) {
    console.error(
      `gate: "${argv[0]}" is not a content digest, and this CLI has no subcommands. It has exactly one form:\n` +
      '  gate.mjs <sha256:…> [--image REF] [--recipe NAME]\n' +
      'Writing a pass INTO the ledger is a different program, run from a different job, on purpose: ' +
      'auros-base/matrix/run/record-pass.mjs. The job that manufactures the evidence must not be the ' +
      'job that reads it. (spec §4.3)')
    return 2
  }

  const args = { digest: null, image: null, recipe: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--image' || a === '--recipe') {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) { console.error(`gate: ${a} needs a value`); return 2 }
      args[a.slice(2)] = v
    } else if (a.startsWith('-')) {
      console.error(
        `gate: unrecognised argument "${a}". This gate has no flags that change its answer — not this one and not ` +
        'any other. If an image has not passed the matrix, the way through is to make it pass. (spec §4.3)')
      return 2
    } else if (args.digest === null) {
      args.digest = a
    } else {
      console.error(`gate: unexpected extra argument "${a}"`); return 2
    }
  }
  if (args.digest === null) {
    console.error('usage: gate.mjs <sha256:…> [--image REF] [--recipe NAME]')
    return 2
  }
  let d
  try { d = decide(args) } catch (e) {
    console.error(`gate: REFUSED — the gate itself failed (${e.message}). A gate that cannot run has not passed anything.`)
    return 2
  }
  if (d.allowed) { console.log(`gate: ALLOW ${args.digest} — ${d.reason}`); return 0 }
  console.error(`gate: REFUSED ${args.digest} [${d.code}]\n  ${d.reason}`)
  return 1
}

// Run only when this file IS the program. Comparing resolved paths rather than a suffix matters:
// `.claude/hooks/publish-gate.mjs` also ends in "gate.mjs", and a suffix test made importing this
// library run its CLI and exit the hook before it ever read the command.
const SELF = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === SELF) process.exit(main(process.argv.slice(2)))
