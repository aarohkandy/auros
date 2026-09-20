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
  oras:    (a) => hasSub(a, ['push']) || hasSub(a, ['copy']) || hasSub(a, ['cp']),
  crane:   (a) => hasSub(a, ['push']) || hasSub(a, ['copy']) || hasSub(a, ['cp']),
  regctl:  (a) => hasSub(a, ['image', 'copy']) || hasSub(a, ['image', 'import']) ||
                  hasSub(a, ['image', 'export']) || hasSub(a, ['image', 'mod']) ||
                  hasSub(a, ['index', 'create']) || hasSub(a, ['artifact', 'put']),
  gh:      (a) => hasSub(a, ['release', 'upload']) && a.some(isImageArtifact),
  // A publish does not need a client. The registry API is an HTTP PUT to
  // /v2/<name>/manifests/<ref>, and `curl -X PUT --data-binary @manifest.json https://…` is exactly
  // as much of a publish as `podman push` is. This gate used to allow it because `curl` was not on
  // the list — the shape it models is "a tool we recognise", and the registry does not require one.
  curl:    (a) => REGISTRY_WRITE(a),
  wget:    (a) => REGISTRY_WRITE(a),
}

const MANIFEST_URL_RE = /\/v2\/[A-Za-z0-9._\-/]+\/(?:manifests|blobs)\//
const WRITE_METHOD_RE = /^(?:PUT|POST|PATCH|DELETE)$/i
const REGISTRY_WRITE = (args) => {
  if (!args.some((a) => MANIFEST_URL_RE.test(a))) return false
  return args.some((a, i) =>
    (a === '-X' || a === '--request') && WRITE_METHOD_RE.test(args[i + 1] ?? '') ||
    a === '-T' || a === '--upload-file' || a === '--data-binary' || a === '-d' || a === '--data' ||
    a === '--method' && WRITE_METHOD_RE.test(args[i + 1] ?? '') ||
    a === '--post-file' || a === '--body-file')
}

// Wrappers that hide the real command word behind themselves.
const TRANSPARENT = new Set(['sudo', 'doas', 'env', 'nice', 'ionice', 'time', 'timeout', 'stdbuf', 'nohup', 'xargs', 'command'])
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh'])

const IMAGE_ARTIFACT_RE = /\.(iso|raw|qcow2|img|vhd|vhdx|oci|oci-archive|tar|tar\.gz|tar\.zst|zst)$/i
const isImageArtifact = (s) => IMAGE_ARTIFACT_RE.test(s)

const DIGEST_ANYWHERE_RE = /\bsha256:[a-f0-9]{64}\b/g
const CAPITAL_DIGEST_RE  = /\bsha256:[A-Fa-f0-9]{64}\b/g

// A subcommand may sit at ANY positional index, not only the first.
//
// This function used to require positional[0] === 'push', which is true of `podman push` and false
// of `podman image push` — the form podman's own documentation uses, and docker's. `docker image
// push ghcr.io/…@sha256:…` was ALLOWED by this gate: a literal publish, digest in plain sight, no
// obfuscation of any kind. `crane cp`, `buildah manifest push` and `regctl image export` went the
// same way. Scanning the list means `podman compose push` and any future `<noun> push` is covered
// too, and the cost of matching one extra shape is one refusal an operator can read.
function hasSub (args, words) {
  const positional = args.filter((a) => !a.startsWith('-'))
  for (let start = 0; start + words.length <= positional.length; start++) {
    if (words.every((w, i) => positional[start + i] === w)) return true
  }
  return false
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

// Shell grammar that sits in FRONT of a command word without being one.
//
// This is where five of the twelve bypasses lived. `if true; then podman push $REF; fi` splits into
// segments on `;`, so one segment is `then podman push $REF` — and peel() took `then` as the command
// word, found it in no table, and allowed the segment. The same for `do` (a for loop), `{` and `(`
// (grouping), and a LEADING redirection: `>/tmp/log podman push $REF` was allowed while
// `podman push $REF > /tmp/log` was correctly blocked, so the gap was position-dependent, which is
// the worst kind to reason about.
const KEYWORDS = new Set(['if', 'then', 'elif', 'else', 'fi', 'while', 'until', 'do', 'done', 'for', 'case', 'esac', 'select', 'function', '!', 'coproc'])
const GROUPING = new Set(['{', '}', '(', ')', '[[', ']]'])
const REDIRECT_RE = /^\d*(?:>>|>|<<<|<<|<|&>|>&)/

// Command words whose payload is a program this gate cannot read.
//
// The file's own stated disposition — "a command this gate cannot read is a command it will not
// approve" — was simply not applied to these. `eval "podman push $REF"`, `python3 -c "…"`,
// `node -e "…"`, `echo '…' | bash`, `make push` and `npm run publish:image` all returned ALLOW with
// the digest sitting in plain text inside them. They are now refused whenever the segment carries
// anything that looks like an image reference: refusing them unconditionally would block ordinary
// `make test`, and refusing them when a digest or a registry URL is present is the line that
// separates "I cannot read this" from "I cannot read this AND it is handling an image".
// Always opaque: these run whatever a file, a recipe or a string tells them to.
const OPAQUE = new Set([
  'eval', 'source', '.',
  'make', 'gmake', 'just', 'task', 'mage', 'rake', 'invoke', 'tox', 'nox',
  'npm', 'pnpm', 'yarn', 'npx', 'pnpx',
  'ansible', 'ansible-playbook', 'terraform', 'pulumi', 'helm', 'kubectl', 'flux', 'argocd',
])

// Interpreters are opaque only when the PROGRAM IS IN THE COMMAND LINE rather than in a file this
// gate could in principle be pointed at. `python3 -c "…"` and `node -e "…"` hide a publish inside a
// string; `node tools/gate.mjs <digest>` is running the gate itself and must not be refused, or the
// gate becomes a thing you cannot invoke.
const EVAL_FLAGS = {
  node: ['-e', '--eval', '-p', '--print'],
  deno: ['eval'],
  bun:  ['-e', '--eval'],
  python: ['-c', '-m'], python2: ['-c', '-m'], python3: ['-c', '-m'],
  perl: ['-e', '-E'], ruby: ['-e'], php: ['-r'], lua: ['-e'], Rscript: ['-e'],
}

function isOpaque (word, args) {
  if (OPAQUE.has(word)) return true
  const flags = EVAL_FLAGS[word]
  if (flags) {
    if (args.some((a) => flags.includes(a))) return true
    // No flag and no script operand: it is reading the program from stdin.
    return args.filter((a) => !a.startsWith('-')).length === 0
  }
  // A bare shell with no -c and no script argument: it is running whatever arrives on stdin, which
  // is how `echo 'podman push …' | bash` reached the registry through a gate that reads arguments.
  if (SHELLS.has(word) && args.filter((a) => !a.startsWith('-')).length === 0) return true
  return false
}

// Strip wrappers, `VAR=value` prefixes, leading redirections, shell keywords and grouping tokens to
// reach the command word. For a shell with -c, the payload is itself a command line, so it is
// returned for a fresh round of splitting.
function peel (tokens) {
  let t = tokens.slice()
  for (let guard = 0; guard < 16; guard++) {
    while (t.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t[0]) || REDIRECT_RE.test(t[0]))) {
      // A redirection written as `> file` is two tokens; `>file` is one.
      const wasBareRedirect = REDIRECT_RE.test(t[0]) && /^\d*(?:>>|>|<<<|<<|<|&>|>&)$/.test(t[0])
      t = t.slice(wasBareRedirect ? 2 : 1)
    }
    if (!t.length) return { cmd: null, args: [], nested: null }
    let word = t[0]
    // `(podman` and `{podman` tokenize as one word when no space follows the brace.
    while (word.length > 1 && (word.startsWith('(') || word.startsWith('{'))) word = word.slice(1)
    word = word.split('/').pop()
    if (GROUPING.has(word) || KEYWORDS.has(word)) { t = t.slice(1); continue }
    if (TRANSPARENT.has(word)) { t = t.slice(1); continue }
    if (SHELLS.has(word)) {
      const ci = t.findIndex((x, i) => i > 0 && (x === '-c' || (x.startsWith('-') && !x.startsWith('--') && x.includes('c'))))
      if (ci !== -1 && t[ci + 1] !== undefined) return { cmd: null, args: [], nested: t[ci + 1] }
      return { cmd: word, args: t.slice(1).map(stripGrouping), nested: null }
    }
    return { cmd: word, args: t.slice(1).map(stripGrouping), nested: null }
  }
  return { cmd: null, args: [], nested: null }
}

const stripGrouping = (s) => s.replace(/[)}]+$/, '')

// Does this text handle an image at all? Used only to decide whether an UNREADABLE segment is worth
// refusing. A digest, a `docker://` reference, a registry manifest/blob path, or the name of a
// publishing tool appearing as a word all count.
const PUBLISHER_WORD_RE = new RegExp(`(?:^|[^A-Za-z0-9_./-])(?:${Object.keys(PUBLISHERS).filter((k) => k !== 'curl' && k !== 'wget').join('|')})(?:[^A-Za-z0-9_-]|$)`)
const ANY_DIGEST_RE = /\bsha256:[A-Fa-f0-9]{64}\b/   // deliberately NOT /g: .test() on a global
                                                      // regex advances lastIndex and answers false
                                                      // every other call, which is a gate that
                                                      // alternates between working and not.
function touchesAnImage (text) {
  return ANY_DIGEST_RE.test(text) ||
    /docker:\/\//.test(text) ||
    MANIFEST_URL_RE.test(text) ||
    PUBLISHER_WORD_RE.test(text)
}

// ── Find every publishing act in a command line ──────────────────────────────────────────────────
// `whole` is the ENTIRE command line this segment came from. It matters for exactly one shape: a
// bare shell reading stdin. `echo 'podman push <ref>' | bash` splits into `echo '…'` (harmless on
// its own) and `bash` (harmless-looking on its own), and the publish lives in the pipe between them
// — which is why looking only at each segment allowed it.
function findPublishes (cmd, depth = 0, whole = cmd) {
  if (depth > 4) return [{ segment: cmd, reason: 'command is nested more than four shells deep; refusing to keep guessing what it runs' }]
  const found = []
  for (const seg of splitSegments(cmd)) {
    const tokens = tokenize(seg)
    if (!tokens.length) continue

    // A command substitution IN THE COMMAND-WORD POSITION decides at runtime what runs, which is by
    // definition something this gate cannot read: `$(echo podman) push $REF` was allowed.
    if (/^[`$]/.test(tokens[0]) && touchesAnImage(seg)) {
      found.push({ segment: seg, reason: 'the command word is produced by a command substitution, so what this actually runs is decided at runtime and cannot be read here — and the segment carries an image reference' })
      continue
    }

    const { cmd: word, args, nested } = peel(tokens)
    if (nested !== null) { found.push(...findPublishes(nested, depth + 1, whole)); continue }
    if (!word) continue

    const bareShell = SHELLS.has(word) && args.filter((a) => !a.startsWith('-')).length === 0
    if (isOpaque(word, args) && (touchesAnImage(seg) || (bareShell && touchesAnImage(whole)))) {
      found.push({
        segment: bareShell ? whole : seg,
        reason: bareShell
          ? `\`${word}\` is reading its program from a pipe, so what it runs is not in any argument this gate can inspect — and the command line carries an image reference`
          : `\`${word}\` runs a program this gate cannot read, and this segment carries an image reference. A command this gate cannot read is a command it will not approve`,
      })
      continue
    }

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

// ── The evidence itself, and the gate that reads it ─────────────────────────────────────────────
//
// attest/README.md names this as "the one thing none of these protect against": the ledger is a
// claim, and its real boundary is write access. An audit demonstrated the consequence — one
// `printf … >> attest/passed-digests.tsv` turned `REFUSED [empty-ledger]` into
// `ALLOW — 7/7 profiles, 28/28 checks`, and this hook then approved the push. No VM ever booted.
//
// The real fix is cryptographic and is not this file's to make: the matrix harness must sign
// results.json with the CI OIDC identity so that decide() can tell a machine's row from a hand-typed
// one. Until that exists, this is the interim, and its scope is honest — it stops THIS agent in THIS
// harness from writing its own evidence or removing its own gate. It does nothing about a human with
// an editor, another session, or CI. That is the same limit the rest of this file has.
const PROTECTED_PATHS = [
  { re: /attest\/passed-digests\.tsv/, what: 'the attestation ledger' },
  { re: /\.claude\/hooks\//, what: 'the hook that enforces the publish gate' },
  { re: /\.claude\/settings(?:\.local)?\.json/, what: 'the settings file that installs the hook' },
  { re: /tools\/gate\.mjs/, what: 'the gate library CI and this hook share' },
]

// Shapes that modify a file rather than read it. `>` and `>>` are redirections, so they are checked
// against the raw segment; the rest are command words with the path in an argument.
const MUTATORS = new Set(['tee', 'rm', 'mv', 'cp', 'install', 'truncate', 'dd', 'chmod', 'chown', 'ln', 'patch', 'touch'])
const IN_PLACE_EDITORS = new Set(['sed', 'perl', 'ruby', 'awk', 'ed', 'python', 'python3', 'node'])

function protectedWrites (command) {
  const hits = []
  for (const seg of splitSegments(command)) {
    const target = PROTECTED_PATHS.find((p) => p.re.test(seg))
    if (!target) continue
    const tokens = tokenize(seg)
    if (!tokens.length) continue
    const { cmd: word } = peel(tokens)
    const redirects = /(^|\s)\d*>>?\s*\S*(?:attest\/passed-digests\.tsv|\.claude\/(?:hooks\/|settings)|tools\/gate\.mjs)/.test(seg)
    const mutates = word !== null && (MUTATORS.has(word) || (IN_PLACE_EDITORS.has(word) && /(^|\s)(-i|--in-place)\b/.test(seg)))
    if (redirects || mutates) hits.push({ what: target.what, segment: seg })
  }
  return hits
}

const PROTECTED_MESSAGE = (hits) =>
  'BLOCKED by the Auros publish gate.\n\n' +
  hits.map((h) => `  · this command writes to ${h.what}.\n    segment: ${h.segment.slice(0, 200)}`).join('\n') + '\n\n' +
  'A row in attest/passed-digests.tsv is a claim that a machine booted and every check passed. The\n' +
  'gate is worth exactly what that row is worth, so an agent that can write the row has no gate at\n' +
  'all — it has a formality it performs on itself. The same is true of the hook and of the settings\n' +
  'file that installs it.\n\n' +
  'A row is written by `.claude/skills/vm-check-matrix` running to completion with a full pass, in CI,\n' +
  'and by nothing else. If this genuinely needs to change — a new profile, a corrected header, a\n' +
  'deliberate revocation — that is a change a person makes and a person reviews, not one this session\n' +
  'makes on its own authority. Say what you want changed and why, and let them make it.\n'

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

  // Non-Bash tools. The installed matcher in .claude/settings.json is "Bash", so a Write or Edit
  // event does not reach this file today and the ledger is NOT protected against those — that is
  // stated here rather than papered over, because changing which tools the harness routes here is a
  // change to the operator's own configuration and not this file's to make. If the matcher is ever
  // widened, this branch already does the right thing.
  if (event.tool_name !== 'Bash') {
    const path = event?.tool_input?.file_path ?? event?.tool_input?.path ?? ''
    if (typeof path === 'string' && path !== '') {
      const target = PROTECTED_PATHS.find((p) => p.re.test(path))
      if (target) {
        process.stderr.write(PROTECTED_MESSAGE([{ what: target.what, segment: path }]))
        return BLOCK
      }
    }
    return ALLOW
  }

  const command = event?.tool_input?.command
  if (typeof command !== 'string' || command.trim() === '') return ALLOW

  let written
  try { written = protectedWrites(command) } catch (e) {
    process.stderr.write(`publish-gate: BLOCKED — could not parse this command safely (${e.message}).\n`)
    return BLOCK
  }
  if (written.length > 0) { process.stderr.write(PROTECTED_MESSAGE(written)); return BLOCK }

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
