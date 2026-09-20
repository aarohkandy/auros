#!/usr/bin/env node
// HONESTY GATE — mechanizes prohibition §4.4 the way tools/gate.mjs mechanizes §4.3.
//
// "Never fabricate social proof. No invented case studies, customer logos, testimonials, device counts
//  or savings figures on the website. If we have no customers, the site says what a build *looks like*,
//  framed as illustration, labelled as such."
//
// A prohibition enforced by good intentions is a prohibition that lasts until the first deadline. This
// runs in CI over the site's content and source, and FAILS THE BUILD on a match. It is deliberately
// noisy in the direction of stopping us: a false positive costs one `auros-allow` annotation with a
// reason; a false negative costs the company.
//
// Usage: node tools/honesty-gate.mjs <dir> [<dir>...]
// Exit 0 = clean. Exit 1 = findings. Exit 2 = could not run (also a failure — fails closed).

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

const SCAN_EXT = new Set(['.md', '.mdx', '.astro', '.ts', '.tsx', '.js', '.jsx', '.html', '.json', '.yaml', '.yml'])
const SKIP_DIR = new Set(['node_modules', '.git', 'dist', '.astro', 'coverage', '.wrangler', 'fonts'])

// Each rule: what it catches, and WHY it is forbidden — the why is printed, because a developer who
// understands the rule routes around the letter of it far less often than one who does not.
const RULES = [
  { id: 'social-proof', why: 'We have no customers. Implying otherwise is the fastest way to be worth distrusting.',
    re: /\b(trusted by|used by (?:schools|hundreds|thousands|over)|our customers (?:say|report|love)|join (?:hundreds|thousands)|rated \d(?:\.\d)? (?:stars|out of)|as featured in|testimonial|case stud(?:y|ies))\b/gi },
  { id: 'device-count', why: 'A device count in the field is a claim about customers we do not have. The 180/40/62 in the architecture diagram are illustrative and must be labelled as such.',
    re: /\b(?:over|more than|already|now)\s+[\d,]{2,}\s*(?:\+\s*)?(?:devices?|machines?|laptops?|schools?|organi[sz]ations?|students?)\b/gi },
  { id: 'savings-figure', why: 'We cannot evidence a saving. The reader does this arithmetic with their own numbers; we supply the arithmetic, never the answer.',
    re: /\b(?:saves?|saving|save you|cut costs? by|reduces? costs? by)\s+(?:up to\s+)?(?:[£$€]\s?[\d,]+|\d+\s?%)/gi },
  { id: 'unqualified-percent', why: 'A bare percentage reads as a measured result. If it is measured, cite the measurement; if it is not, delete it.',
    re: /\b\d{2,3}\s?% (?:of (?:schools|customers|users|machines)|faster|cheaper|fewer|less|more)\b/gi },
  { id: 'one-restart-unqualified', why: 'False on BitLocker/TPM-1.2 and Secure-Boot-restricted machines (PLAN.md §3.6). Must carry its qualification within the same sentence.',
    re: /\bone restart\b/gi, needsNear: /(most machines|some (?:machines|need)|firmware|except|qualif|tells you|before you (?:start|begin))/i, nearWindow: 400 },
  { id: 'blanket-exe', why: 'Prohibition §4.2 and DECISIONS.md D16. Office rates Garbage and Photoshop Silver on WineHQ AppDB. An overclaim here ends the company.',
    re: /\b(?:runs?|supports?|works? with) (?:all|any|your|every) (?:windows )?(?:apps?|applications?|programs?|software|\.exe)\b/gi },
  { id: 'office-adobe-claim', why: 'D16: Office and Adobe belong on the explicit does-not-come-across list, never in a caveat.',
    re: /\b(?:microsoft office|office 365|photoshop|adobe (?:creative|acrobat|photoshop))\b[^.\n]{0,60}\b(?:works?|runs?|supported|compatible|available)\b/gi },
  { id: 'winapps', why: 'D16: needs a Windows licence per device and a 4 GB floor for the VM alone, on laptops with 4 GB total. Not honest to offer.',
    re: /\b(?:winboat|winapps)\b/gi },
  { id: 'guarantee', why: 'We do not have the operating history to guarantee anything. Say what the system does, not what we promise.',
    re: /\b(?:guarantee[ds]?|100% (?:safe|reliable|secure)|never fails?|zero downtime|bulletproof)\b/gi },
  { id: 'multi-rollback', why: 'D10: bootc retains booted + exactly ONE rollback. Anything implying a history of images is false.',
    re: /\broll ?back to any\b|\b(?:previous|last) \d+ (?:images?|versions?|deployments?)\b/gi },
]

const findings = []
let scanned = 0

function walk (dir, root) {
  let entries
  try { entries = readdirSync(dir) } catch { return }
  for (const e of entries) {
    if (SKIP_DIR.has(e)) continue
    const p = join(dir, e)
    let st
    try { st = statSync(p) } catch { continue }
    if (st.isDirectory()) { walk(p, root); continue }
    if (!SCAN_EXT.has(extname(p))) continue
    scanned++
    scan(p, root)
  }
}

function scan (file, root) {
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  for (const rule of RULES) {
    rule.re.lastIndex = 0
    let m
    while ((m = rule.re.exec(text)) !== null) {
      // A rule with `needsNear` only fires when its qualification is ABSENT nearby.
      if (rule.needsNear) {
        const from = Math.max(0, m.index - rule.nearWindow)
        const window = text.slice(from, m.index + rule.nearWindow)
        if (rule.needsNear.test(window)) continue
      }
      const lineNo = text.slice(0, m.index).split('\n').length
      const line = lines[lineNo - 1] ?? ''
      // Escape hatch, deliberately visible in the diff and requiring a stated reason.
      if (/auros-allow:\s*\S+/.test(line) || /auros-allow:\s*\S+/.test(lines[lineNo - 2] ?? '')) continue
      // The rules file describes the forbidden patterns; it is not itself a claim.
      if (file.endsWith('honesty-gate.mjs')) continue
      findings.push({ file: relative(root, file), line: lineNo, rule: rule.id, why: rule.why, match: m[0].trim(), context: line.trim().slice(0, 140) })
    }
  }
}

const roots = process.argv.slice(2)
if (roots.length === 0) { console.error('honesty-gate: no directories given — refusing to report a pass'); process.exit(2) }
for (const r of roots) { try { walk(r, r) } catch (e) { console.error(`honesty-gate: cannot scan ${r}: ${e.message}`); process.exit(2) } }
if (scanned === 0) { console.error('honesty-gate: scanned 0 files — refusing to report a pass on an empty scan'); process.exit(2) }

if (findings.length === 0) {
  console.log(`honesty-gate: ${scanned} files scanned, no unevidenced claims found.`)
  process.exit(0)
}

console.error(`\nhonesty-gate: ${findings.length} finding(s) across ${scanned} files.\n`)
const byRule = new Map()
for (const f of findings) { if (!byRule.has(f.rule)) byRule.set(f.rule, []) ; byRule.get(f.rule).push(f) }
for (const [rule, fs] of byRule) {
  console.error(`── ${rule} ──`)
  console.error(`   ${fs[0].why}\n`)
  for (const f of fs) console.error(`   ${f.file}:${f.line}  "${f.match}"\n      ${f.context}`)
  console.error('')
}
console.error('If a finding is genuinely fine, annotate the line with `auros-allow: <reason>` — it will show')
console.error('up in the diff, which is the point. Do not widen a rule to make a finding disappear.\n')
process.exit(1)
