#!/usr/bin/env node
// CONTENT COMMAND LINT — every shell command we publish must reference paths that exist.
//
// WHY THIS EXISTS. On 2026-09-20 the website published, in two places, the command that backs the
// single claim we advertise hardest — if we vanish, you rebuild your own operating system without us:
//
//     podman build -t myschool:local -f myschool/Containerfile .
//
// The repository lays its recipes out under `customers/<name>/`. The command was wrong by one path
// component, for every reader, on the page a sceptical IT person opens first. Nothing caught it:
// honesty-gate reads prose, not filesystems, and the workflow that claimed to run the command
// "verbatim" ran a different string.
//
// A published command is a factual claim about a filesystem. This checks it the only way a claim about
// a filesystem can be checked — by looking.
//
// Usage: node tools/content-commands.mjs [<content dir>] [--repos <dir>]
// Exit 0 = every referenced path exists. 1 = at least one does not. 2 = could not run (fails closed).

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const META = resolve(HERE, '..')

const args = process.argv.slice(2)
let contentDir = resolve(META, 'auros-web/src/content')
let reposDir = META
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--repos') { reposDir = resolve(args[++i]); continue }
  contentDir = resolve(args[i])
}

// A command may name one of our repositories. `cd <repo>` inside a block moves the working directory,
// exactly as it would for the reader typing it.
const REPOS = new Set(['auros-base', 'auros-recipes', 'auros-installer', 'auros-web', 'auros'])

// Things that look like paths but are not paths in OUR repositories.
const NOT_OURS = [
  /^[a-z0-9.-]+\.[a-z]{2,}\//i,      // registry or domain: quay.io/..., ghcr.io/..., github.com/...
  /^localhost\//,                     // a local image tag
  /^\//,                              // absolute: /output, /var/lib/containers/storage
  /^\.\//,                            // a mount source in the reader's own cwd: ./out:/output
  /^out\b/,                           // output directory the command itself creates
  /^https?:/,
]

// The stand-in customer name the pages use. It is not a directory; it is a placeholder the reader
// replaces with their own. A path containing it is checked against every real customer directory,
// and it is an error if NONE of them satisfies it — which is the "no Containerfile is committed for
// anybody" failure, caught from the website side.
const PLACEHOLDER = 'myschool'

const problems = []
let commandsChecked = 0
let pathsChecked = 0

function candidateDirs (repoRoot) {
  const customers = join(repoRoot, 'customers')
  if (!existsSync(customers)) return []
  return readdirSync(customers).filter((d) => {
    try { return statSync(join(customers, d)).isDirectory() } catch { return false }
  })
}

function checkPath (file, lineNo, cmd, token, cwd) {
  pathsChecked++
  if (token.includes(PLACEHOLDER)) {
    const names = candidateDirs(cwd)
    if (names.length === 0) {
      problems.push({ file, lineNo, cmd, token,
        why: `there are no customer directories under ${cwd}/customers, so no substitution of '${PLACEHOLDER}' can resolve` })
      return
    }
    const ok = names.filter((n) => existsSync(join(cwd, token.replaceAll(PLACEHOLDER, n))))
    if (ok.length === 0) {
      problems.push({ file, lineNo, cmd, token,
        why: `'${PLACEHOLDER}' is a placeholder, and substituting it with each of ${names.join(', ')} produces a path that does not exist under ${cwd}. A reader following this command gets no such file.` })
    }
    return
  }
  if (!existsSync(join(cwd, token))) {
    problems.push({ file, lineNo, cmd, token, why: `does not exist under ${cwd}` })
  }
}

function looksLikeOurPath (token) {
  if (token.length === 0) return false
  if (NOT_OURS.some((re) => re.test(token))) return false
  if (REPOS.has(token)) return true
  if (!token.includes('/')) return false
  if (token.includes(':')) return false          // image ref or a -v mount
  if (token.includes('$') || token.includes('*')) return false
  return true
}

function scanFile (file, rel) {
  const lines = readFileSync(file, 'utf8').split('\n')
  let inFence = false
  let cwd = reposDir
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      if (inFence) cwd = reposDir   // each block starts where the reader starts
      continue
    }
    if (!inFence) continue
    const cmd = line.trim()
    if (cmd.length === 0 || cmd.startsWith('#')) continue

    // `git clone <url>` puts the reader inside that repository.
    const clone = cmd.match(/git clone\s+(?:--\S+\s+)*https:\/\/github\.com\/[\w.-]+\/([\w.-]+?)(?:\.git)?(?:\s|$)/)
    if (clone) { commandsChecked++; continue }
    const cd = cmd.match(/^cd\s+([\w.\/-]+)/)
    if (cd) {
      const target = resolve(cwd, cd[1])
      if (!existsSync(target)) problems.push({ file: rel, lineNo: i + 1, cmd, token: cd[1], why: `cd target does not exist under ${cwd}` })
      else cwd = target
      commandsChecked++
      continue
    }
    if (!/^(podman|docker|node|bash|sh|\.\/|make)\b/.test(cmd)) continue
    commandsChecked++

    // -f/--file takes a path; so does a bare trailing argument that looks like one.
    const tokens = cmd.replace(/\\$/, '').split(/\s+/)
    for (let t = 0; t < tokens.length; t++) {
      const tok = tokens[t]
      if ((tok === '-f' || tok === '--file') && tokens[t + 1]) { checkPath(rel, i + 1, cmd, tokens[t + 1], cwd); t++; continue }
      if (t === 0) continue
      if (tok.startsWith('-')) continue
      if (looksLikeOurPath(tok) || REPOS.has(tok)) checkPath(rel, i + 1, cmd, tok, cwd)
    }
  }
}

function walk (dir, root) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    const st = statSync(p)
    if (st.isDirectory()) { walk(p, root); continue }
    if (!['.md', '.mdx'].includes(extname(p))) continue
    scanFile(p, p.slice(root.length + 1))
  }
}

if (!existsSync(contentDir)) {
  console.error(`content-commands: ${contentDir} does not exist — refusing to report a pass on a directory I cannot read`)
  process.exit(2)
}
walk(contentDir, contentDir)

if (commandsChecked === 0) {
  console.error('content-commands: found no shell commands at all — refusing to report a pass on an empty scan')
  process.exit(2)
}

if (problems.length === 0) {
  console.log(`content-commands: ${commandsChecked} published command(s), ${pathsChecked} referenced path(s), all present.`)
  process.exit(0)
}

console.error(`\ncontent-commands: ${problems.length} published command(s) reference a path that does not exist.\n`)
for (const p of problems) {
  console.error(`   ${p.file}:${p.lineNo}`)
  console.error(`      ${p.cmd}`)
  console.error(`      '${p.token}' ${p.why}\n`)
}
console.error('A command on the website is a claim about a filesystem. Fix the repository or fix the page;')
console.error('do not relax this check, because the reader cannot.\n')
process.exit(1)
