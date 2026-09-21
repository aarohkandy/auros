#!/usr/bin/env node
// CLAIMS EVIDENCE — two checks honesty-gate.mjs structurally cannot make (SYSTEM-REVIEW H12, H13).
//
// 1. DESIGN ROWS CITE A FILE (H12). A CLAIMS.md row marked DESIGN says "this is how the system is
//    built". Its evidence cell must name a repository path that exists and is non-empty. The Wi-Fi
//    row passed every gate with the evidence "SPEC §4.2 and §6C.1 name exactly these. DESIGN." —
//    the promise cited as proof of the promise — while no export code existed. This will not catch
//    every false row: a real path can still be the wrong path. It does catch a row with no code
//    behind it at all.
//
// 2. WITHDRAWN PHRASES, EVERYWHERE (H13). honesty-gate.mjs reads auros-web/src and nothing else, so
//    the pre-D30/D31 claims survived in READMEs, the recipe schema and generated Containerfiles. This
//    reads every tracked file of all five repositories for the specific claims we withdrew.
//
// Usage: node tools/claims-evidence.mjs [--root <dir>]   (default root: this repo)
// Exit 0 = clean. Exit 1 = findings. Exit 2 = could not run (fails closed).

import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

export const REPOS = ['.', 'auros-base', 'auros-recipes', 'auros-installer', 'auros-web']
export const CLAIMS = 'auros-web/src/content/CLAIMS.md'

// Each phrase is a CLAIM SHAPE, not a bare word. "keyless" alone appears ~25 times in auros-base
// explaining why signing is keyed, NOT keyless; flagging those would teach people to ignore this.
export const PHRASES = [
  { id: 'rebuild-exact-os', re: /\brebuild(?:s|ing)?\s+(?:your|their|this|the|its)\s+exact\s+operating\s+system/gi, why: 'D30/D31: nobody may rebuild our OS from our files; the customer gets the build files only on wind-down.' },
  { id: 'exact-os-if-we-go', re: /\bexact\s+operating\s+system\s+if\s+we\s+(?:disappear|vanish)/gi, why: 'D31: the trust story is the wind-down handover, not a public rebuild.' },
  { id: 'public-on-purpose', re: /\bpublic\s+on\s+purpose\b/gi, why: 'D31: the repos are public for free CI minutes, all rights reserved — not as a replaceability guarantee.' },
  { id: 'fork-it-yourself', re: /\bfork\s+it\s+yourself\b/gi, why: 'D30: all rights reserved. There is no right to fork.' },
  { id: 'keyless', re: /\bcosign,?\s+keyless\b|\bsign(?:ing|ed)?\s+(?:is\s+)?keyless\b|\bkeyless\s*:\s*there\s+is\s+no\b|\bno\s+(?:auros\s+)?private\s+key\s+to\s+(?:lose|steal)\b/gi,
    // auros-base's signing docs quote the old instruction right after saying it was replaced; a match
    // with that correction in the 300 characters before it is the correction, not the claim.
    unlessBefore: /\bkeyed\b|\bnot keyless\b|\bwith a key pair\b/i, why: 'D8/D17: signing is KEYED (cosign sign --key; a keyPath in policy.json). The private key is a real risk (auros-base/signing/RISKS.md).' },
]

// Files that RECORD a withdrawn claim rather than make one. Each needs a reason; keep this short.
export const EXEMPT = [
  { repo: '.', path: /^DECISIONS\.md$/, why: 'the decision log quotes what it superseded' },
  { repo: '.', path: /^PLAN\.md$/, why: 'marked SUPERSEDED IN PART; kept as the record of the original plan' },
  { repo: '.', path: /^docs\/SYSTEM-REVIEW\.md$/, why: 'the audit quotes the defects it reports' },
  { repo: '.', path: /^docs\/evidence\//, why: 'research record, not a claim' },
  { repo: '.', path: /^tools\/claims-evidence(\.test)?\.mjs$/, why: 'defines the phrases' },
]
const IS_TEST = /(?:\.(?:test|spec)\.[cm]?[jt]sx?|_test\.go)$/

/** Evidence cell of every CLAIMS.md table row marked DESIGN, with its line number. */
export function designRows (text) {
  const out = []
  text.split('\n').forEach((line, i) => {
    if (!line.startsWith('|')) return
    const cells = line.split(/(?<!\\)\|/).slice(1, -1)
    if (cells.length < 3) return
    const evidence = cells[2]
    if (/\*\*DESIGN\b/.test(evidence)) out.push({ line: i + 1, claim: cells[0].trim(), evidence })
  })
  return out
}

/** Backticked tokens that look like paths, with any :line suffix stripped. */
export function citedPaths (evidence) {
  return [...evidence.matchAll(/`([^`\s]+)`/g)]
    .map(m => m[1].replace(/:\d[\d,\-–]*$/, ''))
    .filter(p => p.includes('/') || /\.[A-Za-z]{1,5}$/.test(p))
}

function nonEmpty (p) {
  try {
    const st = statSync(p)
    return st.isDirectory() ? readdirSync(p).length > 0 : st.size > 0
  } catch { return false }
}

/** A DESIGN row passes if one cited path resolves, from the control root or the site repo, to something non-empty. */
export function checkDesignRows (root) {
  const path = join(root, CLAIMS)
  if (!existsSync(path)) return { skipped: `${CLAIMS} not present` }
  const bases = [root, join(root, 'auros-web')]
  const findings = []
  const rows = designRows(readFileSync(path, 'utf8'))
  for (const r of rows) {
    const paths = citedPaths(r.evidence)
    if (!paths.some(p => bases.some(b => nonEmpty(join(b, p))))) {
      findings.push({ where: `${CLAIMS}:${r.line}`, rule: 'design-row-without-code',
        detail: `${r.claim.slice(0, 90)} — cites ${paths.length ? paths.join(', ') + ' (none exist, or all empty)' : 'no file path'}` })
    }
  }
  return { findings, checked: rows.length }
}

function tracked (dir) {
  try { return execFileSync('git', ['-C', dir, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 << 20 }).split('\0').filter(Boolean) } catch { return null }
}

export function checkPhrases (root) {
  const findings = []
  const scanned = []
  const missing = []
  for (const repo of REPOS) {
    const dir = join(root, repo)
    const files = existsSync(dir) ? tracked(dir) : null
    if (!files) { missing.push(repo); continue }
    scanned.push(repo)
    for (const f of files) {
      if (IS_TEST.test(f) || EXEMPT.some(e => e.repo === repo && e.path.test(f))) continue
      let text
      try { const b = readFileSync(join(dir, f)); if (b.includes(0) || b.length > 4 << 20) continue; text = b.toString('utf8') } catch { continue }
      const lines = text.split('\n')
      for (const p of PHRASES) {
        for (const m of text.matchAll(p.re)) {
          const ln = text.slice(0, m.index).split('\n').length
          if (p.unlessBefore?.test(text.slice(Math.max(0, m.index - 300), m.index))) continue
          if (/auros-allow:\s*\S+/.test(lines[ln - 1]) || /auros-allow:\s*\S+/.test(lines[ln - 2] ?? '')) continue
          findings.push({ where: `${repo === '.' ? '' : repo + '/'}${f}:${ln}`, rule: p.id, detail: `"${m[0].replace(/\s+/g, ' ')}" — ${p.why}` })
        }
      }
    }
  }
  return { findings, scanned, missing }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--root')
  const root = resolve(i > 0 ? process.argv[i + 1] : join(dirname(fileURLToPath(import.meta.url)), '..'))
  const d = checkDesignRows(root)
  const p = checkPhrases(root)
  if (!p.scanned.length) { console.error('claims-evidence: no repository could be listed — refusing to report a pass'); process.exit(2) }
  if (d.skipped) console.log(`claims-evidence: DESIGN rows SKIPPED — ${d.skipped}`)
  else console.log(`claims-evidence: ${d.checked} DESIGN rows checked, ${d.findings.length} cite no existing file`)
  console.log(`claims-evidence: withdrawn phrases — scanned ${p.scanned.join(', ')}${p.missing.length ? `; NOT PRESENT: ${p.missing.join(', ')}` : ''}; ${p.findings.length} finding(s)`)
  const all = [...(d.findings ?? []), ...p.findings]
  for (const f of all) console.error(`  ${f.rule}  ${f.where}\n      ${f.detail}`)
  if (all.length) {
    console.error('\nA DESIGN row names the file that implements it, or it is not DESIGN. A withdrawn claim is')
    console.error('rewritten, or annotated `auros-allow: <reason>` where it is quoted rather than made.')
    process.exit(1)
  }
}
