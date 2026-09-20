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

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, extname, relative, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const SCAN_EXT = new Set(['.md', '.mdx', '.astro', '.ts', '.tsx', '.js', '.jsx', '.html', '.json', '.yaml', '.yml'])
const SKIP_DIR = new Set(['node_modules', '.git', 'dist', '.astro', 'coverage', '.wrangler', 'fonts'])

// Test files ship to nobody. A claim has to reach a customer to be a claim.
const IS_TEST = /\.(test|spec)\.[jt]sx?$/

// In CODE, only a string literal or JSX/markup text can reach a customer. A pure comment line cannot,
// and three separate engineering comments using "guarantees" in its ordinary technical sense had
// already tripped this gate. Annotating each one would have taught people to reach for the escape
// hatch reflexively, and an escape hatch people reach for reflexively is not a gate.
//
// This closes no real hole: to SHIP a claim you must put it in content or in a string, and both are
// still scanned in full. Markdown and MDX are content, so every line of them counts.
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.astro'])
const PURE_COMMENT = /^\s*(\/\/|\*|\/\*|<!--)/

// Each rule: what it catches, and WHY it is forbidden — the why is printed, because a developer who
// understands the rule routes around the letter of it far less often than one who does not.
const RULES = [
  { id: 'social-proof', why: 'We have no customers. Implying otherwise is the fastest way to be worth distrusting.',
    re: /\b(trusted by|used by (?:schools|hundreds|thousands|over)|our customers (?:say|report|love)|join (?:hundreds|thousands)|rated \d(?:\.\d)? (?:stars|out of)|as featured in|testimonial|case stud(?:y|ies))\b/gi,
    notNegated: true },
  { id: 'device-count', why: 'A device count in the field is a claim about customers we do not have. The 180/40/62 in the architecture diagram are illustrative and must be labelled as such.',
    re: /\b(?:over|more than|already|now)\s+[\d,]{2,}\s*(?:\+\s*)?(?:devices?|machines?|laptops?|schools?|organi[sz]ations?|students?)\b/gi,
    notNegated: true },
  // The device-count rule above requires a leading over/more than/already/now, which is what keeps
  // it off SPEC §3's illustrative 180-machine fleet and off "180 machines on one uplink". The shape
  // it therefore cannot see is a bare count ATTACHED TO ORGANISATIONS — "180 machines across three
  // schools" — which is a customer claim wearing an architecture diagram's clothes.
  { id: 'device-count-across', why: 'A device count attached to schools, nonprofits or customers is a claim about customers we do not have, whether or not it carries a leading "over".',
    re: /\b[\d,]{2,}\s*(?:\+\s*)?(?:devices?|machines?|laptops?)\s+(?:across|at|in|for)\s+(?:[\d,]+|a|three|four|five|several|multiple)?\s*(?:schools?|nonprofits?|organi[sz]ations?|customers?|councils?|trusts?)\b/gi,
    notNegated: true },
  { id: 'savings-figure', why: 'We cannot evidence a saving. The reader does this arithmetic with their own numbers; we supply the arithmetic, never the answer.',
    re: /\b(?:saves?|saving|cut costs?|cuts? costs?|reduces? costs?|pays? for itself)\b[^.\n]{0,30}?(?:[£$€]\s?[\d,]{3,}|\d{1,3}\s?%)/gi,
    notNegated: true },
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
  // Added after D30/D31. The site was written when the product was Apache-2.0 and replaceability was
  // the headline feature, so several pages PRINT A LICENCE GRANT — "every recipe is a public git
  // repository, including yours; if we disappear you rebuild the same operating system". Those were
  // true when written, which is exactly why no existing rule caught them: a claims ledger is only as
  // good as the last time somebody re-read it against reality.
  //
  // What we may now say is narrower and true: you have the image, and if we cease operating you are
  // given the build files needed to keep patching it. Not a licence to our tooling, not permission to
  // redistribute. See DECISIONS.md D31.
  // NOTE on the `fork …` alternative: the space before the noun is INSIDE the optional group. It
  // used to sit outside it — `fork (?:it|this|our|the) (?:repo|recipes?)?` — which made the space
  // mandatory, so "fork it" and "fork this" (the two commonest phrasings by a distance) could never
  // match and only "fork the repo" did. Caught by tools/honesty-gate.corpus.test.mjs.
  { id: 'licence-grant', why: 'D30/D31: proprietary, all rights reserved. Offering a right we withdrew is a claim we cannot honour, and it is the one the owner explicitly asked us not to make.',
    re: /\b(?:you (?:can|may) (?:fork|copy|redistribute|rebuild (?:it|the same|your own))|fork (?:it|this|our|the)(?:\\s+(?:repo|repository|recipes?))?|open[- ]source|free to (?:use|copy|modify|redistribute)|MIT licen[cs]e|Apache[- ]2)\b/gi,
    notNegated: true },
  { id: 'public-recipes', why: 'The repositories are readable, not licensed. "Public git repo" invites a reader to conclude they may copy it, which is the inference D30 exists to prevent.',
    re: /\b(?:public (?:git )?repositor(?:y|ies)|in a public repo|publicly available (?:recipes?|source))\b/gi,
    notNegated: true },
  // FABRICATED EXPERIENCE — the worst AI tell, and the one a keyword list structurally cannot catch.
  //
  // The site said "the machines are in a room" and promised checks "against our own notes from machines
  // we have built". There was no room, no notes and no machines: hardware/compat.tsv was a header row.
  // Invented concrete detail is what a generator produces when a sentence would plausibly contain it,
  // and it appeared on the page whose entire job is being believed.
  //
  // So this rule is CONDITIONAL ON THE EVIDENCE FILE. First-person claims of hands-on experience are
  // refused while compat.tsv has zero physical rows, and become permissible automatically once it does.
  // The gate does not decide whether we have experience; the evidence file does.
  { id: 'fabricated-experience', why: 'hardware/compat.tsv has no physical rows, so we have tested nothing on real hardware. A first-person claim of hands-on experience is invented detail. This rule lifts itself automatically once physical rows exist.',
    // "the machines" is deliberately NOT here: on this site it means the CUSTOMER'S machines ("the
    // machines are yours", "the machines keep booting"), and the first draft of this rule flagged five
    // true sentences for it. Only FIRST-PERSON possession signals a claim about our own experience, plus
    // the handful of nouns that only name a facility ("the lab") and so imply we have one.
    re: /\b(?:our (?:test )?(?:lab|machines|fleet|test hardware|bench|devices|laptops)\b|the (?:test )?(?:lab|bench|test hardware)\b|in our (?:testing|experience|lab)|we(?:'ve| have) (?:tested|seen|found|run|imaged|deployed|installed)|machines we(?:'ve| have) (?:built|imaged|tested)|our own notes|from experience)/gi,
    notNegated: true, requiresNoPhysicalEvidence: true },
  { id: 'guarantee', why: 'We do not have the operating history to guarantee anything. Say what the system does, not what we promise.',
    re: /\b(?:guarantee[ds]?|100% (?:safe|reliable|secure)|never fails?|zero downtime|bulletproof)\b/gi },
  { id: 'multi-rollback', why: 'D10: bootc retains booted + exactly ONE rollback. Anything implying a history of images is false.',
    re: /\broll ?back to any\b|\b(?:previous|last) \d+ (?:images?|versions?|deployments?)\b/gi },

  // ── Added after the 2026-09-20 honesty audit. Each of these is a claim class that was PUBLISHED
  //    and that this gate reported a clean pass over, which is the specific way a gate becomes
  //    decoration: it keeps checking what it always checked while the prose moves somewhere else.
  { id: 'competitor-absolute', why: 'An absolute claim about every competitor is a claim about a market we have surveyed none of. Say what WE do; leave the comparison to the reader.',
    re: /\b(?:nobody else|no ?one else|no other (?:vendor|company|supplier)|(?:we are|we're) the only|the only (?:vendor|company|supplier|product) (?:who|that|to)|unlike (?:everyone|everybody|every other)|first (?:vendor|company) to)\b/gi,
    notNegated: true },
  { id: 'comparative-superiority', why: 'A "stronger/better/safer than X" claim needs a measurement against X. We have not run one. Narrow it to the property you can actually defend.',
    re: /\b(?:stronger|better|safer|faster|more secure|more reliable|harder to break)\s+than\b/gi,
    notNegated: true },
  // Scoped to RANKED frequency — a superlative or a stated proportion — not to ordinary hedging.
  // An earlier draft of this rule also matched bare "usually" and "typically" and produced eight
  // findings, every one of them a hedge rather than a claim. A gate whose findings are mostly noise
  // is a gate people annotate past without reading, which is worse than the rule not existing.
  { id: 'worded-frequency', why: 'A ranked frequency claim is a measurement claim in words. hardware/compat.tsv has no rows and no image has booted on a physical machine, so we have nothing to rank.',
    re: /\b(?:the )?most (?:common|frequent|likely|often)(?: cause| reason| problem| failure)?\b|\b(?:in most cases|nine times out of ten|almost always|the majority of (?:machines|schools|cases|customers))\b/gi,
    notNegated: true,
    needsNear: /(we (?:have not|haven't) measured|not (?:yet )?measured|we expect|which we have not|auros-allow)/i, nearWindow: 300 },
  { id: 'implied-track-record', why: 'We have built no machines and have no customers. Any phrasing that implies accumulated experience is fabricated social proof under SPEC §4.4.',
    re: /\b(?:in our (?:experience|testing|deployments?)|machines we(?:'ve| have) built|schools we(?:'ve| have) (?:worked|migrated)|we(?:'ve| have) (?:seen|found|migrated|deployed|tested)\b(?!\s+(?:nothing|none|no ))|from what we(?:'ve| have) seen|every time we)\b/gi,
    notNegated: true },
  { id: 'time-estimate', why: 'An unmeasured duration is a number with no source, and the reader budgets from it. Say the SHAPE of the work (a per-machine visit) or measure it.',
    // Two shapes, because the published defects used both: a verb-led estimate ("it takes an
    // afternoon per machine") and an adjectival one ("a thirty-second job"). The second is the one
    // that matters most — it reads as trivial and it is per-machine work across a whole fleet.
    // A configured schedule is not an estimate of human effort: "a 3-hour random delay" and a
    // "15-minute poll" are values in a unit file and a cron line, not guesses at how long a job
    // takes. The lookahead lets those through and keeps "a thirty-second job" caught.
    re: /\b(?:\d+|one|two|three|four|five|six|ten|fifteen|twenty|thirty|forty|sixty|ninety|a few|a couple of)[- ](?:second|minute|hour|afternoon|morning)s?\b(?!\s*(?:random(?:i[sz]ed)? )?(?:delay|interval|timer|timeout|window|poll|cron|jitter))|\b(?:takes?|take|in|about|roughly|around|under|only|just|budget)\s+(?:an?\s+)?(?:\d+|one|two|three|four|five|ten|fifteen|twenty|thirty|sixty|a few|a couple of)[- ]?(?:second|minute|hour|day|week|afternoon|morning)s?\b/gi,
    notNegated: true },
  { id: 'perpetual-commitment', why: 'Duration of service is a commercial term and §9-reserved. An open-ended commitment attached to a one-time price is decided by publishing it, which is not an agent\'s decision to make.',
    re: /\b(?:for as long as we (?:are|exist)|in perpetuity|for life|lifetime (?:updates?|support|access)|always be (?:free|supported|maintained)|never stop(?:s|ping)? (?:updating|supporting))\b|\b(?:updates?|support(?:ed)?|maintained|rebuild(?:s|ing|t)?|included|free)\b[^.\n]{0,24}\bfor ?ever\b|\bfor ?ever\b[^.\n]{0,24}\b(?:free|supported|maintained|updates?)\b/gi,
    notNegated: true },
]

// How many rows of hardware/compat.tsv are PHYSICAL evidence. Rules marked requiresNoPhysicalEvidence
// only fire while this is zero — the evidence file, not the gate, decides whether we have experience.
const PHYSICAL_ROWS = (() => {
  for (const candidate of ['hardware/compat.tsv', '../hardware/compat.tsv', '../../hardware/compat.tsv']) {
    try {
      const lines = readFileSync(candidate, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'))
      const header = lines[0].split('\t'); const i = header.indexOf('source')
      if (i < 0) return 0
      return lines.slice(1).filter(l => (l.split('\t')[i] || '').trim() === 'physical').length
    } catch { /* try the next location */ }
  }
  return 0   // No evidence file found means no evidence. Fail toward refusing the claim.
})()

const findings = []
let scanned = 0

// ────────────────────────────────────────────────────────────────────────────────────────────────
// TWO CROSS-FILE CHECKS, added 2026-09-20 after this gate returned "no unevidenced claims found"
// over a build whose central trust argument was false.
//
// The gate was not broken. It was measuring the wrong thing. Every rule above is a REGEX OVER ONE
// FILE, so it can only catch a claim whose WORDING is suspicious. Both defects that shipped were
// claims whose wording was perfectly sober and whose EVIDENCE had moved:
//
//   - the site advertised a weekly CI cadence for a workflow that is paused on manual dispatch;
//   - a licensing decision (D30/D31) falsified thirteen content files, and nothing re-read them.
//
// A claims ledger is only as good as the last time somebody re-read it against reality, so these
// two rules read the reality instead of the sentence.
// ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * CITED-WORKFLOW-SCHEDULE. If the site names a workflow file AND asserts a cadence in the same
 * sentence, open that workflow and check it actually has an active `schedule:` trigger.
 *
 * The published defect: `Replaceability test · Wednesdays 05:23 UTC ·
 * auros-recipes/.github/workflows/replaceable.yml`, in the footer panel whose entire stated job is
 * "what this site is standing on". The cron line in that file is commented out under a header
 * reading PAUSED. A false row there is worse than a false row anywhere else on the site, and it
 * passed every regex above because the path it cited was real.
 */
const CADENCE = /\b(?:every |each )?(?:Mondays?|Tuesdays?|Wednesdays?|Thursdays?|Fridays?|Saturdays?|Sundays?|nightly|every night|daily|weekly|hourly|every (?:hour|day|week))\b/i
const WORKFLOW_PATH = /((?:[A-Za-z0-9._-]+\/)*\.github\/workflows\/[A-Za-z0-9._-]+\.ya?ml)/g

/** True when the file has a `schedule:` trigger that is not commented out. */
function hasActiveSchedule (yamlText) {
  return yamlText.split('\n').some(l => /^\s*schedule\s*:/.test(l) && !/^\s*#/.test(l))
}

function checkCitedWorkflows (file, root, text, lines) {
  WORKFLOW_PATH.lastIndex = 0
  let m
  while ((m = WORKFLOW_PATH.exec(text)) !== null) {
    const lineNo = text.slice(0, m.index).split('\n').length
    const line = lines[lineNo - 1] ?? ''
    if (CODE_EXT.has(extname(file)) && PURE_COMMENT.test(line)) continue
    if (/auros-allow:\s*\S+/.test(line) || /auros-allow:\s*\S+/.test(lines[lineNo - 2] ?? '')) continue
    // Only a cadence asserted in the SAME rendered string is a claim about the schedule.
    if (!CADENCE.test(line)) continue
    const onDisk = join(REPO_ROOT, m[1])
    if (!existsSync(onDisk)) {
      findings.push({ file: relative(root, file), line: lineNo, rule: 'cited-workflow-missing',
        why: 'The site cites a workflow file that is not in this tree. A path nobody can open is not evidence.',
        match: m[1], context: line.trim().slice(0, 140) })
      continue
    }
    if (!hasActiveSchedule(readFileSync(onDisk, 'utf8'))) {
      findings.push({ file: relative(root, file), line: lineNo, rule: 'cited-workflow-schedule',
        why: 'The site states a cadence for a workflow that has no active `schedule:` trigger. Say what the file does — "paused", "manual dispatch only" — or turn the schedule back on.',
        match: m[1], context: line.trim().slice(0, 140) })
    }
  }
}

/**
 * CLAIMS-FRESHNESS. `src/content/CLAIMS.md` must record which DECISIONS.md entry it was last read
 * against, and that entry must be the latest one. D30 and D31 landed and thirteen content files
 * became false; nothing in CI noticed, because nothing in CI knew the ledger had a date.
 *
 * Deliberately crude: any new decision invalidates the review, not just a licensing one. Deciding
 * WHICH decisions touch the site is the judgement call that failed the first time.
 */
const FRESH_MARKER = /Reviewed against DECISIONS\.md:\s*D(\d+)/i

function checkClaimsFreshness (root) {
  const claims = join(root, 'content', 'CLAIMS.md')
  const alt = join(root, 'src', 'content', 'CLAIMS.md')
  const path = existsSync(claims) ? claims : (existsSync(alt) ? alt : null)
  if (!path) return
  const decisionsPath = join(REPO_ROOT, 'DECISIONS.md')
  if (!existsSync(decisionsPath)) return
  const latest = Math.max(0, ...[...readFileSync(decisionsPath, 'utf8').matchAll(/^##\s*D(\d+)\b/gm)].map(x => Number(x[1])))
  const text = readFileSync(path, 'utf8')
  const m = FRESH_MARKER.exec(text)
  const rel = relative(root, path)
  if (!m) {
    findings.push({ file: rel, line: 1, rule: 'claims-freshness',
      why: 'CLAIMS.md carries no "Reviewed against DECISIONS.md: D<n>" marker, so nothing can tell whether it has been read since the last decision.',
      match: 'no review marker', context: '' })
    return
  }
  if (Number(m[1]) < latest) {
    findings.push({ file: rel, line: text.slice(0, m.index).split('\n').length, rule: 'claims-freshness',
      why: `CLAIMS.md was last read against D${m[1]}; DECISIONS.md is at D${latest}. A decision landed and nobody re-read the claims against it. This is the exact shape of the D30/D31 failure: the copy did not change, reality did.`,
      match: m[0], context: `latest decision on disk: D${latest}` })
  }
}

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
    if (IS_TEST.test(e)) continue
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
    if (rule.requiresNoPhysicalEvidence && PHYSICAL_ROWS > 0) continue
    while ((m = rule.re.exec(text)) !== null) {
      // A rule with `needsNear` only fires when its qualification is ABSENT nearby.
      // A mention inside a NEGATION is not a claim. "no testimonials", "never fabricate a case study",
      // "we do not say trusted by" are all the rule being described or refused, not exercised. Without
      // this, the files that audit our honesty are the ones that trip the honesty gate — which trains
      // people to annotate their way past it, and an escape hatch people use reflexively is not a gate.
      // A forward negation. "We have tested NOTHING", "our test hardware, WHEN WE HAVE ANY", "until we
      // have run yours" all state the absence of the thing the phrase names. The backward-looking guard
      // below misses every one of them, because the word that negates comes after. The first four
      // findings this rule produced on the real site were all this shape — true sentences, flagged.
      if (rule.requiresNoPhysicalEvidence) {
        const after = text.slice(m.index + m[0].length, m.index + m[0].length + 40).toLowerCase()
        const lead = text.slice(Math.max(0, m.index - 12), m.index).toLowerCase()
        if (/^\W{0,3}(?:nothing|none|no\b|not\b|yet\b|, when we have any|when we have any)/.test(after)) continue
        if (/\buntil\s*$/.test(lead)) continue
      }
      if (rule.notNegated) {
        const before = text.slice(Math.max(0, m.index - 60), m.index).toLowerCase()
        if (/\b(no|not|never|without|avoid|forbid(?:s|den)?|refuse[sd]?|fabricat\w*|invent\w*|do not|don't|must not|may not|zero)\b[^.]{0,55}$/.test(before)) continue
      }
      if (rule.needsNear) {
        const from = Math.max(0, m.index - rule.nearWindow)
        const window = text.slice(from, m.index + rule.nearWindow)
        if (rule.needsNear.test(window)) continue
      }
      const lineNo = text.slice(0, m.index).split('\n').length
      const line = lines[lineNo - 1] ?? ''
      // In a code file, a pure comment line cannot reach a customer, so it is not a claim.
      if (CODE_EXT.has(extname(file)) && PURE_COMMENT.test(line)) continue
      // Escape hatch, deliberately visible in the diff and requiring a stated reason.
      if (/auros-allow:\s*\S+/.test(line) || /auros-allow:\s*\S+/.test(lines[lineNo - 2] ?? '')) continue
      // The rules file describes the forbidden patterns; it is not itself a claim.
      if (file.endsWith('honesty-gate.mjs')) continue
      findings.push({ file: relative(root, file), line: lineNo, rule: rule.id, why: rule.why, match: m[0].trim(), context: line.trim().slice(0, 140) })
    }
  }
  if (!file.endsWith('honesty-gate.mjs')) checkCitedWorkflows(file, root, text, lines)
}

const roots = process.argv.slice(2)
if (roots.length === 0) { console.error('honesty-gate: no directories given — refusing to report a pass'); process.exit(2) }
for (const r of roots) { try { walk(r, r); checkClaimsFreshness(r) } catch (e) { console.error(`honesty-gate: cannot scan ${r}: ${e.message}`); process.exit(2) } }
if (scanned === 0) { console.error('honesty-gate: scanned 0 files — refusing to report a pass on an empty scan'); process.exit(2) }

if (findings.length === 0) {
  console.log(`honesty-gate: ${scanned} files scanned, no unevidenced claims found.`)
  console.log('honesty-gate: cited workflow schedules checked against the workflow files; CLAIMS.md checked against the latest DECISIONS.md entry.')
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
