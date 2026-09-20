#!/usr/bin/env node
// PUBLISH GATE — PreToolUse hook. LAYER FOUR of four. Defence in depth, not the guarantee.
//
// Spec §8 assigns "an unsigned or untested image can never reach a customer" to a PreToolUse hook.
// PLAN.md §3.2 established that this is not sufficient and this file is not going to pretend otherwise:
// a PreToolUse hook constrains ONE agent inside ONE harness. It does nothing about CI, a human with
// registry credentials, a different agent session, or a `workflow_dispatch` button. The layers that
// actually hold are (1) the CI publish step calling tools/gate.mjs, (2) GHCR write held only by the
// workflow token, and (3) install-time signature policy on the machine. This is the fourth, and it is
// here because the failure it catches — an agent in a hurry pushing bytes nobody booted — is a real
// failure mode that the other three do not see until after the push.
//
// Protocol: stdin is the hook event as JSON; exit 2 with a message on stderr blocks the tool call and
// hands the message back to the model. Exit 0 allows. ANY internal failure exits 2 — a hook that
// cannot decide has not approved anything.
//
// CONSERVATIVE BY CONSTRUCTION: if a command looks like an image publish and the digest cannot be
// parsed out of it with confidence, this REFUSES. A false positive costs one annoyed operator thirty
// seconds; a false negative puts unbooted bytes on a school's laptops.

import { decide } from '../../tools/gate.mjs'

const BLOCK = 2
const ALLOW = 0

// ── Command words that can move an image to somewhere a customer could reach ─────────────────────
// Matched on the COMMAND WORD only, never as a substring of the line, so `grep -r "docker push"` and
// `echo "podman push …"` are not publishes and are not blocked. `git push` is not here on purpose.
const PUBLISHERS = {
  podman:  (a) => hasSub(a, ['push']) || hasSub(a, ['manifest', 'push']),
  docker:  (a) => hasSub(a, ['push']) || hasSub(a, ['manifest', 'push']),
  buildah: (a) => hasSub(a, ['push']),
  skopeo:  (a) => hasSub(a, ['copy']) || hasSub(a, ['sync']),
  cosign:  (a) => hasSub(a, ['sign']) || hasSub(a, ['attest']) || hasSub(a, ['copy']),
  oras:    (a) => hasSub(a, ['push']) || hasSub(a, ['copy']),
  crane:   (a) => hasSub(a, ['push']) || hasSub(a, ['copy']),
  regctl:  (a) => hasSub(a, ['image', 'copy']) || hasSub(a, ['image', 'import']),
  gh:      (a) => hasSub(a, ['release', 'upload']) && a.some(isImageArtifact),
}

// Wrappers that hide the real command word behind themselves.
const TRANSPARENT = new Set(['sudo', 'doas', 'env', 'nice', 'ionice', 'time', 'timeout', 'stdbuf', 'nohup', 'xargs', 'command'])
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh'])

const IMAGE_ARTIFACT_RE = /\.(iso|raw|qcow2|img|vhd|vhdx|oci|oci-archive|tar|tar\.gz|tar\.zst|zst)$/i
const isImageArtifact = (s) => IMAGE_ARTIFACT_RE.test(s)

const DIGEST_ANYWHERE_RE = /\bsha256:[a-f0-9]{64}\b/g
const CAPITAL_DIGEST_RE  = /\bsha256:[A-Fa-f0-9]{64}\b/g

function hasSub (args, words) {
  // subcommands appear before the first operand; flags may be interleaved
  const positional = args.filter((a) => !a.startsWith('-'))
  return words.every((w, i) => positional[i] === w)
}

// ── Splitting a command line into the pieces that each run something ─────────────────────────────
// Quote-aware, so a separator inside a quoted string does not create a phantom segment, and a
// publisher hidden inside a quoted `bash -c` payload is still reached (see peel()).
function splitSegments (cmd) {
  const out = []
  let cur = ''
  let quote = null
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i]
    if (quote) {
      if (c === '\\' && quote === '"') { cur += c + (cmd[++i] ?? ''); continue }
      cur += c
      if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'") { quote = c; cur += c; continue }
    if (c === '\\' && cmd[i + 1] === '\n') { i++; continue }
    if (c === ';' || c === '\n' || c === '&' || c === '|') {
      // consume a doubled operator whole
      if ((c === '&' || c === '|') && cmd[i + 1] === c) i++
      out.push(cur); cur = ''
      continue
    }
    cur += c
  }
  out.push(cur)
  return out.map((s) => s.trim()).filter((s) => s !== '')
}

function tokenize (segment) {
  const out = []
  let cur = ''
  let quote = null
  let had = false
  for (let i = 0; i < segment.length; i++) {
    const c = segment[i]
    if (quote) {
      if (c === '\\' && quote === '"') { cur += segment[++i] ?? ''; continue }
      if (c === quote) { quote = null; continue }
      cur += c; continue
    }
    if (c === '"' || c === "'") { quote = c; had = true; continue }
    if (c === '\\') { cur += segment[++i] ?? ''; continue }
    if (/\s/.test(c)) { if (cur !== '' || had) { out.push(cur); cur = ''; had = false } continue }
    cur += c
  }
  if (cur !== '' || had) out.push(cur)
  return out
}

// Strip wrappers and `VAR=value` prefixes to reach the command word. For a shell with -c, the payload
// is itself a command line, so it is returned for a fresh round of splitting.
function peel (tokens) {
  let t = tokens.slice()
  for (let guard = 0; guard < 8; guard++) {
    while (t.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(t[0])) t = t.slice(1)
    if (!t.length) return { cmd: null, args: [], nested: null }
    const word = t[0].split('/').pop()
    if (TRANSPARENT.has(word)) { t = t.slice(1); continue }
    if (SHELLS.has(word)) {
      const ci = t.findIndex((x, i) => i > 0 && (x === '-c' || (x.startsWith('-') && !x.startsWith('--') && x.includes('c'))))
      if (ci !== -1 && t[ci + 1] !== undefined) return { cmd: null, args: [], nested: t[ci + 1] }
      return { cmd: word, args: t.slice(1), nested: null }
    }
    return { cmd: word, args: t.slice(1), nested: null }
  }
  return { cmd: null, args: [], nested: null }
}

// ── Find every publishing act in a command line ──────────────────────────────────────────────────
function findPublishes (cmd, depth = 0) {
  if (depth > 4) return [{ segment: cmd, reason: 'command is nested more than four shells deep; refusing to keep guessing what it runs' }]
  const found = []
  for (const seg of splitSegments(cmd)) {
    const tokens = tokenize(seg)
    if (!tokens.length) continue
    const { cmd: word, args, nested } = peel(tokens)
    if (nested !== null) { found.push(...findPublishes(nested, depth + 1)); continue }
    if (!word) continue
    const test = PUBLISHERS[word]
    if (test && test(args)) found.push({ segment: seg, tool: word, args })
  }
  return found
}

// ── Pull the digest out of a publishing command ──────────────────────────────────────────────────
// Confidence rules: exactly one distinct digest in the segment, lowercase hex, and it must be the
// gated one. Zero digests, two different digests, or an uppercase-hex digest that will not compare
// equal to the ledger are all "cannot parse with confidence", which means refuse.
function digestOf (segment) {
  const lower = [...new Set(segment.match(DIGEST_ANYWHERE_RE) ?? [])]
  const anyCase = [...new Set((segment.match(CAPITAL_DIGEST_RE) ?? []).map((s) => s.toLowerCase()))]
  if (lower.length === 1 && anyCase.length === 1) return { digest: lower[0] }
  if (lower.length === 0 && anyCase.length > 0) {
    return { error: 'the command carries a sha256 with uppercase hex. The ledger records lowercase digests and this gate compares exactly, so this cannot be matched with confidence.' }
  }
  if (lower.length === 0) {
    return { error: 'no `@sha256:<64 hex>` appears anywhere in the command. This is a tag-only publish, and a tag can be repointed after the tests passed — gating on one gates nothing.' }
  }
  return { error: `${lower.length} different digests appear in this command (${lower.join(', ')}); which one is being published is ambiguous.` }
}

// The bare image reference, if the command makes it unambiguous. Used only to NARROW the decision:
// when it cannot be determined, the gate is still asked, just without the image cross-check.
function imageOf (segment) {
  const refs = [...new Set((segment.match(/\b(?:docker:\/\/)?([a-z0-9][a-z0-9.-]*(?:\.[a-z]{2,}|:\d+)\/[a-z0-9][a-z0-9._\-/]*)@sha256:[a-f0-9]{64}/g) ?? [])
    .map((s) => s.replace(/^docker:\/\//, '').split('@')[0]))]
  return refs.length === 1 ? refs[0] : null
}

// ── Main ─────────────────────────────────────────────────────────────────────────────────────────
async function main () {
  const { readFileSync } = await import('node:fs')
  let raw = ''
  try { raw = readFileSync(0, 'utf8') } catch { raw = '' }

  let event
  try { event = JSON.parse(raw) } catch {
    // A hook that cannot understand its own input has not approved anything.
    process.stderr.write('publish-gate: could not parse the hook event as JSON. Failing closed (spec §4.3).\n')
    return BLOCK
  }

  if (event.tool_name !== 'Bash') return ALLOW
  const command = event?.tool_input?.command
  if (typeof command !== 'string' || command.trim() === '') return ALLOW

  let publishes
  try { publishes = findPublishes(command) } catch (e) {
    process.stderr.write(`publish-gate: BLOCKED — could not parse this command safely (${e.message}). A command this gate cannot read is a command it will not approve.\n`)
    return BLOCK
  }
  if (publishes.length === 0) return ALLOW

  const refusals = []
  for (const p of publishes) {
    if (p.reason) { refusals.push(`  · ${p.reason}\n    segment: ${p.segment.slice(0, 200)}`); continue }
    const { digest, error } = digestOf(p.segment)
    if (error) {
      refusals.push(`  · \`${p.tool}\` publishes an image, and ${error}\n    segment: ${p.segment.slice(0, 200)}`)
      continue
    }
    let d
    try { d = decide({ digest, image: imageOf(p.segment) ?? undefined }) } catch (e) {
      refusals.push(`  · the gate itself failed while checking ${digest} (${e.message}). A gate that cannot run has not passed anything.`)
      continue
    }
    if (!d.allowed) refusals.push(`  · ${digest} [${d.code}]\n    ${d.reason}`)
  }

  if (refusals.length === 0) return ALLOW

  process.stderr.write(
    'BLOCKED by the Auros publish gate (spec §4.3: an unsigned or untested image can never reach a customer).\n\n' +
    `${refusals.join('\n')}\n\n` +
    'What to do — in this order:\n' +
    '  1. Resolve the reference to a digest: `skopeo inspect --no-tags docker://<ref> | jq -r .Digest`\n' +
    '  2. Run the full check matrix against that digest (skill: vm-check-matrix).\n' +
    '  3. On a FULL pass across every bound profile, the harness records a row in attest/passed-digests.tsv.\n' +
    '  4. Re-run the publish, referring to the image by `@<digest>` rather than by tag.\n\n' +
    'There is no flag, environment variable or argument that turns this into an allow, in this hook or in\n' +
    'tools/gate.mjs, and this hook is only the fourth of four layers — CI and the registry token will refuse\n' +
    'the same push independently. Do not edit the ledger by hand to get past this: a hand-written row is a\n' +
    'claim that a machine booted when it did not, and the whole gate is worth exactly what that row is worth.\n')
  return BLOCK
}

main().then((code) => process.exit(code)).catch((e) => {
  process.stderr.write(`publish-gate: BLOCKED — unhandled failure in the gate (${e && e.stack ? e.stack : e}). Failing closed.\n`)
  process.exit(BLOCK)
})
