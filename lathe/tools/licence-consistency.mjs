#!/usr/bin/env node
// Every repo's PROSE licence claim must match its LICENSE file.
//
// auros-base/README.md said "Apache-2.0. See LICENSE." for hours after LICENSE had been replaced with
// an all-rights-reserved notice (D30). A public repository stating the wrong licence is worse than a
// stale sentence: somebody could rely on it, and the owner's explicit instruction was that nobody may
// redistribute this.
//
// The honesty gate scans the SITE. Nothing was scanning the repos' own documentation.
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const REPOS = ['.', 'auros-base', 'auros-recipes', 'auros-installer', 'auros-web']
// Phrases that assert a permissive licence. A negated or historical mention is handled below.
const PERMISSIVE = /\b(Apache[- ]2(?:\.0)?|MIT licen[cs]e|BSD licen[cs]e|GPL(?:v[23])?[- ]licen[cs]ed|open[- ]source(?:d)?|freely (?:available|redistributable))\b/gi
const NEGATED = /\b(not|no longer|never|withdrew|withdrawn|used to|was|before|ceased|third[- ]party|upstream|their own|carries|per package|recipient)\b/i

let problems = 0, checked = 0
for (const repo of REPOS) {
  const lic = join(repo, 'LICENSE'), readme = join(repo, 'README.md')
  if (!existsSync(lic)) { console.error(`licence-consistency: ${repo} has no LICENSE file`); problems++; continue }
  const licText = readFileSync(lic, 'utf8')
  const reserved = /All rights reserved/i.test(licText) && /NO LICENCE IS GRANTED/i.test(licText)
  if (!reserved) { console.error(`licence-consistency: ${repo}/LICENSE is not the all-rights-reserved notice (D30)`); problems++ }
  if (!existsSync(readme)) { console.error(`licence-consistency: ${repo} has no README.md — a public repo with no README says nothing about its terms`); problems++; continue }
  checked++
  readFileSync(readme, 'utf8').split('\n').forEach((line, i) => {
    PERMISSIVE.lastIndex = 0
    let m
    while ((m = PERMISSIVE.exec(line)) !== null) {
      // A line about UPSTREAM licences, or one recording what we no longer offer, is not a claim
      // about ours. Anything else asserting a permissive licence contradicts LICENSE.
      if (NEGATED.test(line)) continue
      console.error(`licence-consistency: ${readme}:${i + 1} claims "${m[0]}" but LICENSE reserves all rights`)
      console.error(`    ${line.trim().slice(0, 130)}`)
      problems++
    }
  })
}
if (!checked) { console.error('licence-consistency: checked 0 repos — failing closed'); process.exit(2) }
if (problems) { console.error(`\nlicence-consistency: ${problems} problem(s)`); process.exit(1) }
console.log(`licence-consistency: ${checked} repo(s), README and LICENSE agree.`)
