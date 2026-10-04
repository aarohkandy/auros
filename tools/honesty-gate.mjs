#!/usr/bin/env node
// HONESTY GATE — what the website and the front-door documents may claim, enforced mechanically.
//
// Adopted from LATHE (lathe/tools/honesty-gate.mjs), whose rule was "never fabricate social proof:
// no invented case studies, customer logos, testimonials, device counts or savings figures". A
// prohibition enforced by good intentions lasts until the first deadline; this runs in ./verify and
// FAILS on a match. It is deliberately noisy in the direction of stopping us: a false positive costs
// one `auros-allow: <reason>` annotation; a false negative costs the trust the product is built on.
//
// What changed in the port, for the merged product:
//   * It scans HTML as a reader sees it: tags, styles and HTML comments removed, alt/title/aria-label
//     text kept, entities decoded — with every line number unchanged, so a finding points at the file.
//   * NUMBERS CAN CITE THEIR SOURCE. An element carrying data-source="path/in/this/repo" must contain
//     only numbers that appear in that file. A cited number passes the numeric rules; a number whose
//     source does not contain it, or whose source does not exist, is a finding of its own.
//   * LICENCE CLAIMS ARE CHECKED AGAINST ./LICENSE, whatever it says. LATHE was all-rights-reserved and
//     refused every licence grant; this repository's LICENSE is MIT, so here it is a claim of
//     restriction, or the name of a different licence, that contradicts it. Either way the file decides.
//   * "Works on every PC" and its relatives are refused: nothing has run on a real PC yet, and even
//     afterwards a statement about every PC is a statement about machines nobody has seen.
//   * Claims of hands-on experience are refused while hardware/compat.tsv has no physical rows, and
//     allowed by themselves once it does. The evidence file decides, not the gate.
//   * LATHE's bootc-specific rules (the rollback history, Winboat) and its CLAIMS.md freshness check,
//     which read files this repository does not have, were not carried over (lathe/ADOPTED.md).
//
// Usage:
//   node tools/honesty-gate.mjs                         the default scan (below), from this repository
//   node tools/honesty-gate.mjs [--root DIR] PATH...    files or directories; DIR holds LICENSE,
//                                                       hardware/compat.tsv and data-source files
// Default scan: website/ (.html, .js), docs/TRY-IT.md, README.md.
// Exit 0 = clean. Exit 1 = findings. Exit 2 = could not run (also a failure — it fails closed).

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, extname, relative, dirname, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const SCAN_EXT = new Set(['.md', '.mdx', '.astro', '.ts', '.tsx', '.js', '.mjs', '.jsx', '.html', '.htm', '.json', '.yaml', '.yml'])
const SITE_EXT = new Set(['.html', '.htm', '.js', '.mjs'])
const SKIP_DIR = new Set(['node_modules', '.git', 'dist', '.astro', 'coverage', '.wrangler', 'fonts'])
const IS_TEST = /\.(test|spec)\.[jt]sx?$/
// In CODE, a pure comment line cannot reach a customer. Markdown and HTML text are content: every
// line counts (HTML comments are removed before scanning, which is the same principle).
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.jsx', '.astro'])
const PURE_COMMENT = /^\s*(\/\/|\*|\/\*|<!--)/

// The negation guard, LATHE's vocabulary unchanged: a mention inside a refusal ("we have no
// testimonials") is the rule being described, not exercised. Deliberately NOT widened: every word
// added to a suppression list is a word an author can put in front of a real claim.
const NEGATED_BEFORE = /\b(no|not|never|without|avoid|forbid(?:s|den)?|refuse[sd]?|fabricat\w*|invent\w*|do not|don't|must not|may not|zero)\b[^.]{0,55}$/
// Licence words about SOMEBODY ELSE'S software are not claims about ours.
const THIRD_PARTY = /\b(?:windows|microsoft|third[- ]party|upstream|their own|its own|under (?:their|its)|vendor|apple|google|nvidia|firmware|drivers?|codecs?|ubuntu|debian|canonical|linux kernel|kernel|firefox|mozilla|gnu|fonts?|typefaces?|package[sd]?|libraries|library|components?)\b/i

// ── the rules ─────────────────────────────────────────────────────────────────────────────────────
// Each: what it catches, and WHY — the why is printed, because a writer who understands the rule
// routes around the letter of it far less often than one who does not.
//   notNegated            skip a match preceded by a negation in the same sentence
//   alsoNegatedBy         extra negation words for this rule only
//   needsNear/nearWindow  only fires when the qualification is ABSENT nearby
//   requiresNoPhysical    only fires while hardware/compat.tsv has no physical rows
//   numeric               a match inside a correctly cited data-source element passes
//   licence(kind)         only active when ./LICENSE is of that kind
//   thirdPartyOk          skip when the sentence is about somebody else's software
const RULES = [
  { id: 'social-proof', why: 'AurOS has no customers yet. Implying otherwise is the fastest way to be worth distrusting.',
    re: /\b(trusted by|used by (?:schools|hundreds|thousands|over|families|businesses)|our (?:customers|users) (?:say|report|love)|(?:happy|satisfied) (?:customers|users|schools|families)|join (?:hundreds|thousands)|rated \d(?:\.\d)? (?:stars|out of)|as featured in|testimonials?|case stud(?:y|ies))\b/gi,
    notNegated: true },
  { id: 'device-count', why: 'A count of machines in the field is a claim about users AurOS does not have.',
    re: /\b(?:over|more than|already|now)\s+[\d,]{2,}\s*(?:\+\s*)?(?:devices?|machines?|laptops?|pcs?|computers?|schools?|organi[sz]ations?|students?|users?|people|installs?)\b/gi,
    notNegated: true, numeric: true },
  { id: 'device-count-across', why: 'A count of machines attached to schools or customers is a customer claim, with or without a leading "over".',
    re: /\b[\d,]{2,}\s*(?:\+\s*)?(?:devices?|machines?|laptops?|pcs?|computers?)\s+(?:across|at|in|for)\s+(?:[\d,]+|a|three|four|five|several|multiple)?\s*(?:schools?|nonprofits?|charit(?:y|ies)|organi[sz]ations?|customers?|councils?|trusts?|libraries)\b/gi,
    notNegated: true, numeric: true },
  { id: 'savings-figure', why: 'A saving is a measurement of somebody\'s money. Supply the arithmetic, never the answer, unless the number is cited.',
    re: /\b(?:saves?|saving|cut costs?|cuts? costs?|reduces? costs?|pays? for itself)\b[^.\n]{0,30}?(?:[£$€₹]\s?[\d,]{3,}|\d{1,3}\s?%)/gi,
    notNegated: true, numeric: true },
  { id: 'unqualified-percent', why: 'A bare percentage reads as a measured result. If it is measured, cite it with data-source; if it is not, delete it.',
    re: /\b\d{2,3}\s?% (?:of (?:schools|customers|users|machines|pcs|computers|laptops)|faster|cheaper|fewer|less|more|smaller|lighter)\b/gi,
    numeric: true },
  { id: 'one-restart-unqualified', why: '"One restart" is not true of every machine: preflight refuses some, and some need a firmware setting changed first. It must carry its qualification nearby.',
    re: /\bone restart\b/gi, needsNear: /(most (?:machines|pcs|computers)|some (?:machines|pcs|computers|need)|firmware|except|unless|qualif|preflight|tells you|checks? first|before (?:you|it) (?:start|begin|change)|refuse)/i, nearWindow: 400 },
  { id: 'blanket-exe', why: 'Windows programs do not run on AurOS. A sentence implying they do is the one overclaim that ends trust in everything else.',
    re: /\b(?:runs?|supports?|works? with) (?:all|any|your|every) (?:windows )?(?:apps?|applications?|programs?|software|\.exe)\b/gi,
    notNegated: true },
  { id: 'office-adobe-claim', why: 'Microsoft Office and Adobe programs do not run on AurOS. They belong on the does-not-come-across list, never in a caveat.',
    re: /\b(?:microsoft office|office 365|photoshop|adobe (?:creative|acrobat|photoshop))\b[^.\n]{0,60}\b(?:works?|runs?|supported|compatible|available)\b/gi,
    // "Microsoft Office does not run on AurOS" is the sentence this rule exists to make people
    // write. LATHE's version fired on it, because the negation sits INSIDE the match.
    notNegated: true, notNegatedWithin: /\b(?:not|never|no|cannot|can't|doesn't|don't|won't|isn't|aren't)\b/i },
  { id: 'universal-hardware', why: 'Nothing has run on a real PC yet, and a statement about EVERY PC is a statement about machines nobody has seen. Say what preflight checks instead.',
    re: /\b(?:works?|runs?|installs?|boots?) (?:on|with) (?:every|any|all|each)(?: (?:old|windows|modern|single))? (?:pcs?|computers?|laptops?|machines?|hardware|devices?)\b|\b(?:compatible with|supports?) (?:every|all|any) (?:pcs?|computers?|laptops?|hardware|machines?)\b|\bno matter (?:what|which) (?:pc|computer|laptop|hardware)\b/gi,
    notNegated: true },
  { id: 'guarantee', why: 'An absolute promise needs an operating history AurOS does not have. Say what the system does and what it checks, not what we promise.',
    re: /\b(?:guarantee[ds]?|100\s?% (?:safe|reliable|secure|compatible|risk[- ]free)|never fails?|can(?:not|'t) (?:fail|go wrong)|nothing can go wrong|zero risk|risk[- ]free|completely safe|perfectly safe|totally safe|bulletproof|fool ?proof)\b/gi,
    notNegated: true, alsoNegatedBy: /\b(?:cannot|can't|won't|will not|nobody can|no one can)\b[^.]{0,30}$/ },
  { id: 'competitor-absolute', why: 'An absolute claim about every competitor is a claim about a market nobody here has surveyed. Say what AurOS does.',
    re: /\b(?:nobody else|no ?one else|no other (?:vendor|company|supplier|distribution|operating system|os)|(?:we are|we're) the only|the only (?:vendor|company|supplier|product|distribution|operating system|os) (?:who|that|to)|unlike (?:everyone|everybody|every other)|first (?:vendor|company|os|distribution) to)\b/gi,
    notNegated: true },
  { id: 'comparative-superiority', why: 'A "faster/safer/better than X" claim needs a measurement against X. Narrow it to the property you can defend, or cite the measurement.',
    re: /\b(?:stronger|better|safer|faster|lighter|more secure|more reliable|harder to break)\s+than\b/gi,
    notNegated: true, numeric: true },
  { id: 'worded-frequency', why: 'A ranked frequency is a measurement in words, and there is nothing to rank yet.',
    re: /\b(?:the )?most (?:common|frequent|likely|often)(?: cause| reason| problem| failure)?\b|\b(?:in most cases|nine times out of ten|almost always|the majority of (?:machines|pcs|schools|cases|customers|users))\b/gi,
    notNegated: true,
    needsNear: /(we (?:have not|haven't) measured|not (?:yet )?measured|we expect|which we have not|auros-allow)/i, nearWindow: 300 },
  { id: 'implied-track-record', why: 'No AurOS machine has a user yet. Phrasing that implies accumulated experience is fabricated social proof.',
    re: /\b(?:in our (?:experience|testing|deployments?)|machines we(?:'ve| have) built|schools we(?:'ve| have) (?:worked|migrated)|we(?:'ve| have) (?:seen|found|migrated|deployed|tested)\b(?!\s+(?:nothing|none|no |it only|only in|in qemu|in a vm|on a simulated))|from what we(?:'ve| have) seen|every time we)\b/gi,
    notNegated: true },
  { id: 'fabricated-experience', why: 'hardware/compat.tsv has no physical rows: AurOS has been tested on no real PC. A first-person claim of hands-on experience with real hardware is invented. This rule lifts itself once physical rows exist.',
    re: /\b(?:our (?:test )?(?:lab|machines|fleet|test hardware|bench|devices|laptops)\b|the (?:test )?(?:lab|bench|test hardware)\b|in our (?:testing|experience|lab)|we(?:'ve| have) (?:tested|seen|found|run|imaged|deployed|installed)\b|machines we(?:'ve| have) (?:built|imaged|tested)|our own notes|from experience|tested on (?:real|physical|actual) (?:hardware|pcs?|computers?|laptops?|machines?)|(?:on|across) (?:dozens|hundreds|thousands) of (?:real )?(?:pcs|computers|laptops|machines))/gi,
    notNegated: true, requiresNoPhysical: true },
  { id: 'time-estimate', why: 'An unmeasured duration is a number with no source, and the reader plans around it. Cite the measurement with data-source, or say the shape of the work.',
    re: /\b(?:\d+|one|two|three|four|five|six|ten|fifteen|twenty|thirty|forty|sixty|ninety|a few|a couple of)[- ](?:second|minute|hour|afternoon|morning)s?\b(?!\s*(?:random(?:i[sz]ed)? )?(?:delay|interval|timer|timeout|window|poll|cron|jitter))|\b(?:takes?|take|in|about|roughly|around|under|only|just|budget)\s+(?:an?\s+)?(?:\d+|one|two|three|four|five|ten|fifteen|twenty|thirty|sixty|a few|a couple of)[- ]?(?:second|minute|hour|day|week|afternoon|morning)s?\b/gi,
    notNegated: true, numeric: true },
  { id: 'perpetual-commitment', why: 'An open-ended commitment is decided by publishing it. Nobody has decided it.',
    re: /\b(?:for as long as we (?:are|exist)|in perpetuity|for life|lifetime (?:updates?|support|access)|always be (?:free|supported|maintained)|never stop(?:s|ping)? (?:updating|supporting))\b|\b(?:updates?|support(?:ed)?|maintained|included|free)\b[^.\n]{0,24}\bfor ?ever\b|\bfor ?ever\b[^.\n]{0,24}\b(?:free|supported|maintained|updates?)\b/gi,
    notNegated: true },

  // ── licence claims, against ./LICENSE ───────────────────────────────────────────────────────
  { id: 'licence-grant', why: 'LICENSE reserves all rights. Offering a right it does not grant is a claim nobody can honour.',
    re: /\b(?:you (?:can|may) (?:fork|copy|redistribute|rebuild (?:it|the same|your own))|fork (?:it|this|our|the)(?:\s+(?:repo|repository|recipes?))?|open[- ]source|free to (?:use|copy|modify|redistribute)|MIT licen[cs]e|Apache[- ]2)\b/gi,
    notNegated: true, licence: 'reserved' },
  { id: 'public-recipes', why: 'LICENSE reserves all rights. "Public repository" invites a reader to conclude they may copy it.',
    re: /\b(?:public (?:git )?repositor(?:y|ies)|in a public repo|publicly available (?:recipes?|source))\b/gi,
    notNegated: true, licence: 'reserved' },
  { id: 'licence-restriction', why: 'LICENSE grants the MIT permissions. A sentence saying the code is proprietary, or may not be copied, contradicts the file that actually governs it.',
    re: /\b(?:all rights reserved|proprietary|closed[- ]source|no licen[cs]e is granted|(?:you )?may not (?:copy|modify|redistribute|fork|reuse)|not (?:allowed|permitted) to (?:copy|modify|redistribute|fork)|not open[- ]source)\b/gi,
    notNegated: true, thirdPartyOk: true, licence: 'permissive' },
  { id: 'licence-named', why: 'The sentence names a licence that is not the one in LICENSE. Name the licence LICENSE actually grants, or none.',
    re: /\b(?:MIT(?: licen[cs]e)?|Apache(?:[- ]2(?:\.0)?| licen[cs]e)|(?:A|L)?GPL(?:-?v?[23](?:\.0)?)?(?:\+|-or-later|-only)?|GNU (?:Affero |Lesser )?General Public Licen[cs]e|BSD(?:[- ][234]-clause)?(?: licen[cs]e)?|MPL(?:-?2\.0)?|Mozilla Public Licen[cs]e|ISC licen[cs]e|Unlicense|CC0|CC[- ]BY(?:-SA)?)(?![\w-])/g,
    thirdPartyOk: true, licenceNamed: true },
]

// Cross-file checks. Declared here, with ids, so the corpus test requires a must-fire case for each.
const CROSS_RULES = [
  { id: 'data-source-mismatch', why: 'This element cites a source, and the number it shows does not appear in that source. Either the page or the citation is wrong.' },
  { id: 'data-source-missing', why: 'This element cites a source file that does not exist in this repository. A citation nobody can open is not evidence.' },
  { id: 'cited-workflow-missing', why: 'The text cites a workflow file that is not in this repository.' },
  { id: 'cited-workflow-schedule', why: 'The text states a cadence for a workflow that has no active schedule (every workflow in this repository is parked). Say what the file does, or turn the schedule on.' },
]

// ── arguments, and the evidence files ────────────────────────────────────────────────────────────
function fail2 (msg) { console.error(`honesty-gate: ${msg}`); process.exit(2) }
const argv = process.argv.slice(2)
let ROOT = HERE_ROOT
const targets = []
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--root') { ROOT = resolve(argv[++i] ?? fail2('--root needs a directory')); continue }
  if (argv[i].startsWith('--')) fail2(`unknown option ${argv[i]}`)
  targets.push(resolve(argv[i]))
}
const defaultScan = targets.length === 0
if (defaultScan) {
  targets.push(join(ROOT, 'website'), join(ROOT, 'docs', 'TRY-IT.md'), join(ROOT, 'README.md'))
}

// How many rows of hardware/compat.tsv are PHYSICAL evidence. No file means no evidence: fail toward
// refusing the claim.
const PHYSICAL_ROWS = (() => {
  try {
    const lines = readFileSync(join(ROOT, 'hardware', 'compat.tsv'), 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('#'))
    const i = lines[0].split('\t').map((h) => h.trim()).indexOf('source')
    if (i < 0) return 0
    return lines.slice(1).filter((l) => (l.split('\t')[i] || '').trim() === 'physical').length
  } catch { return 0 }
})()

// What ./LICENSE is. A licence this gate cannot recognise is a licence it cannot check claims
// against, so it refuses to run rather than pass every licence sentence.
const LICENCE = (() => {
  let t
  try { t = readFileSync(join(ROOT, 'LICENSE'), 'utf8') } catch { fail2(`no LICENSE in ${ROOT}: licence claims cannot be checked against nothing`) }
  if (/All rights reserved/i.test(t) && /NO LICEN[CS]E IS GRANTED/i.test(t)) return { kind: 'reserved', name: null, own: /(?!)/ }
  if (/^\s*MIT License/m.test(t) || /Permission is hereby granted, free of charge/.test(t)) return { kind: 'permissive', name: 'MIT', own: /^MIT(?: licen[cs]e)?$/i }
  if (/Apache License/.test(t) && /Version 2\.0/.test(t)) return { kind: 'permissive', name: 'Apache-2.0', own: /^Apache(?:[- ]2(?:\.0)?| licen[cs]e)$/i }
  if (/GNU GENERAL PUBLIC LICENSE/.test(t)) return { kind: 'permissive', name: 'GPL', own: /^(?:GPL|GNU General Public Licen[cs]e)/i }
  fail2('LICENSE is not a licence this gate recognises (MIT, Apache-2.0, GPL, or the all-rights-reserved notice); it cannot check licence claims against it')
})()

// ── turning a file into what a reader sees, line numbers intact ──────────────────────────────────
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', mdash: '—', ndash: '–', hellip: '…', middot: '·', times: '×', pound: '£', euro: '€', rarr: '→', larr: '←' }
const decode = (s) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m }
  return ENTITIES[e] ?? m
})
const smart = (s) => s.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"')
const keepNewlines = (s) => s.replace(/[^\n]/g, ' ')
const VISIBLE_ATTR = /\b(?:alt|title|aria-label|placeholder|content)\s*=\s*("([^"]*)"|'([^']*)')/gi

function visibleHtml (raw) {
  let t = raw
  t = t.replace(/<!--[\s\S]*?-->/g, keepNewlines)
  t = t.replace(/<style\b[\s\S]*?<\/style>/gi, keepNewlines)
  // Inside a script, a pure comment line is not shipped copy; everything else (strings) may be.
  t = t.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, a, body, c) => keepNewlines(a) + body.split('\n').map((l) => (PURE_COMMENT.test(l) ? '' : l)).join('\n') + keepNewlines(c))
  t = t.replace(/<[^>]*>/g, (tag) => {
    const attrs = [...tag.matchAll(VISIBLE_ATTR)].map((m) => m[2] ?? m[3]).join(' ')
    const nl = (tag.match(/\n/g) || []).length
    return ` ${attrs} ` + '\n'.repeat(nl)
  })
  // Runs of spaces left by removed tags are one space to a reader: "Trusted <b>by</b> schools" is
  // the sentence "Trusted by schools". Newlines are kept, so line numbers still point at the file.
  return smart(decode(t)).replace(/[ \t\u00a0]+/g, ' ')
}

// ── data-source: a number must appear in the file it cites ───────────────────────────────────────
const NUMBER = /\d+(?:[.,]\d+)*/g
const digitsOnly = (s) => s.replace(/(\d),(?=\d{3}\b)/g, '$1')
function citedElements (raw) {
  // An element carrying data-source="path", and its text. Elements of the same tag nested inside it
  // are not supported, and are not needed for a number.
  const out = []
  const re = /<([a-zA-Z][\w-]*)\b([^>]*?)\bdata-source\s*=\s*"([^"]*)"([^>]*)>([\s\S]*?)<\/\1\s*>/g
  let m
  while ((m = re.exec(raw)) !== null) {
    out.push({ index: m.index, end: m.index + m[0].length, source: m[3].trim(), text: smart(decode(m[5].replace(/<[^>]*>/g, ' '))) })
  }
  return out
}

// ── cited workflows (kept from LATHE): a cadence stated next to a workflow path must be real ──────
const CADENCE = /\b(?:every |each )?(?:Mondays?|Tuesdays?|Wednesdays?|Thursdays?|Fridays?|Saturdays?|Sundays?|nightly|every night|daily|weekly|hourly|every (?:hour|day|week))\b/i
const WORKFLOW_PATH = /((?:[A-Za-z0-9._-]+\/)*\.github\/workflows(?:\.parked)?\/[A-Za-z0-9._-]+\.ya?ml)/g
function hasActiveSchedule (yamlText) {
  const live = (l) => !/^\s*#/.test(l)
  const lines = yamlText.split('\n')
  return lines.some((l) => /^\s*schedule\s*:/.test(l) && live(l)) && lines.some((l) => /^\s*-\s*cron\s*:/.test(l) && live(l))
}

// ── the scan ─────────────────────────────────────────────────────────────────────────────────────
const findings = []
let scanned = 0
const allowed = (lines, lineNo) => /auros-allow:\s*\S+/.test(lines[lineNo - 1] ?? '') || /auros-allow:\s*\S+/.test(lines[lineNo - 2] ?? '')

function scan (file, base) {
  const raw = readFileSync(file, 'utf8')
  const ext = extname(file).toLowerCase()
  const isHtml = ext === '.html' || ext === '.htm'
  const text = isHtml ? visibleHtml(raw) : smart(raw)
  const rawLines = raw.split('\n')
  const lines = text.split('\n')
  const rel = relative(base, file) || basename(file)
  const lineAt = (i) => text.slice(0, i).split('\n').length

  // Spans of correctly cited numbers, and the citation findings themselves.
  const citedOk = []
  if (isHtml) {
    for (const el of citedElements(raw)) {
      const lineNo = raw.slice(0, el.index).split('\n').length
      if (allowed(rawLines, lineNo)) { citedOk.push([el.index, el.end]); continue }
      // One path, or several separated by spaces: every one must exist, and every number must appear
      // in at least one of them. A compat.tsv also vouches for the one number it cannot contain as
      // text: how many physical rows it has ("Real PCs installed so far: 0").
      const paths = el.source.split(/\s+/).filter(Boolean)
      const missing = paths.filter((p) => { const f = resolve(ROOT, p); return !f.startsWith(ROOT + '/') || !existsSync(f) || !statSync(f).isFile() })
      if (paths.length === 0 || missing.length) {
        findings.push({ file: rel, line: lineNo, rule: 'data-source-missing', match: missing.join(' ') || '(empty)', context: el.text.trim().slice(0, 140) })
        continue
      }
      const evidence = paths.map((p) => {
        const t = readFileSync(resolve(ROOT, p), 'utf8')
        if (basename(p) !== 'compat.tsv') return digitsOnly(t)
        const rows = t.split('\n').filter((l) => l.trim() && !l.startsWith('#'))
        const i = (rows[0] ?? '').split('\t').map((h) => h.trim()).indexOf('source')
        const physical = i < 0 ? 0 : rows.slice(1).filter((l) => (l.split('\t')[i] || '').trim() === 'physical').length
        return `${digitsOnly(t)}\n${physical}\n`
      }).join('\n')
      const has = (n) => new RegExp(`(?<![\\d.])${n.replace(/\./g, '\\.')}(?![\\d]|\\.\\d)`).test(evidence)
      const nums = [...el.text.matchAll(NUMBER)].map((n) => digitsOnly(n[0]))
      const absent = nums.filter((n) => !has(n))
      if (nums.length === 0 || absent.length) {
        findings.push({ file: rel, line: lineNo, rule: 'data-source-mismatch', match: nums.length ? absent.join(', ') : '(no number in the element)', context: `${el.text.trim().slice(0, 100)}  [cites ${el.source}]` })
        continue
      }
      citedOk.push([el.index, el.end])
    }
  }
  // Map a position in `text` back to `raw` — identical offsets for non-HTML; for HTML the two differ
  // in length per line, so compare by line: a match on a line inside a cited element counts as cited.
  const citedLines = new Set()
  for (const [a, b] of citedOk) {
    const from = raw.slice(0, a).split('\n').length
    const to = raw.slice(0, b).split('\n').length
    for (let l = from; l <= to; l++) citedLines.add(l)
  }

  for (const rule of RULES) {
    if (rule.requiresNoPhysical && PHYSICAL_ROWS > 0) continue
    if (rule.licence && rule.licence !== LICENCE.kind) continue
    rule.re.lastIndex = 0
    let m
    while ((m = rule.re.exec(text)) !== null) {
      const lineNo = lineAt(m.index)
      const line = lines[lineNo - 1] ?? ''
      const before = text.slice(Math.max(0, m.index - 60), m.index).toLowerCase()
      if (rule.requiresNoPhysical) {
        const after = text.slice(m.index + m[0].length, m.index + m[0].length + 40).toLowerCase()
        if (/^\W{0,3}(?:nothing|none|no\b|not\b|yet\b|, when we have any|when we have any)/.test(after)) continue
        if (/\buntil\s*$/.test(text.slice(Math.max(0, m.index - 12), m.index).toLowerCase())) continue
      }
      if (rule.notNegated && NEGATED_BEFORE.test(before)) continue
      if (rule.alsoNegatedBy && rule.alsoNegatedBy.test(before)) continue
      if (rule.notNegatedWithin && rule.notNegatedWithin.test(m[0])) continue
      if (rule.needsNear) {
        const win = text.slice(Math.max(0, m.index - rule.nearWindow), m.index + rule.nearWindow)
        if (rule.needsNear.test(win)) continue
      }
      if (rule.thirdPartyOk) {
        const sentence = text.slice(Math.max(0, m.index - 80), m.index + m[0].length + 40)
        if (THIRD_PARTY.test(sentence)) continue
      }
      if (rule.licenceNamed && LICENCE.own.test(m[0].trim())) continue
      if (rule.numeric && citedLines.has(lineNo)) continue
      if (CODE_EXT.has(ext) && PURE_COMMENT.test(line)) continue
      if (allowed(rawLines, lineNo)) continue
      if (basename(file) === 'honesty-gate.mjs') continue
      findings.push({ file: rel, line: lineNo, rule: rule.id, match: m[0].trim(), context: line.trim().slice(0, 140) })
    }
  }

  WORKFLOW_PATH.lastIndex = 0
  let w
  while ((w = WORKFLOW_PATH.exec(text)) !== null) {
    const lineNo = lineAt(w.index)
    const line = lines[lineNo - 1] ?? ''
    if (CODE_EXT.has(ext) && PURE_COMMENT.test(line)) continue
    if (allowed(rawLines, lineNo)) continue
    if (!CADENCE.test(line)) continue
    const onDisk = join(ROOT, w[1])
    if (!existsSync(onDisk)) findings.push({ file: rel, line: lineNo, rule: 'cited-workflow-missing', match: w[1], context: line.trim().slice(0, 140) })
    else if (w[1].includes('.parked/') || !hasActiveSchedule(readFileSync(onDisk, 'utf8'))) findings.push({ file: rel, line: lineNo, rule: 'cited-workflow-schedule', match: w[1], context: line.trim().slice(0, 140) })
  }
}

function walkDir (p, base, exts) {
  for (const e of readdirSync(p).sort()) {
    if (SKIP_DIR.has(e)) continue
    const q = join(p, e)
    let s
    try { s = statSync(q) } catch { continue }
    if (s.isDirectory()) { walkDir(q, base, exts); continue }
    if (!exts.has(extname(q).toLowerCase()) || IS_TEST.test(e)) continue
    scanned++
    scan(q, base)
  }
}
function walkTop (p, base, exts) {
  let st
  try { st = statSync(p) } catch { fail2(`cannot scan ${p}: it does not exist`) }
  if (st.isDirectory()) return walkDir(p, base, exts)
  if (!SCAN_EXT.has(extname(p).toLowerCase())) fail2(`${p} is not a kind of file this gate reads`)
  if (IS_TEST.test(basename(p))) return  // a test file ships to nobody, even when named directly
  scanned++
  scan(p, base === p ? dirname(p) : base)
}

for (const t of targets) {
  const isSite = defaultScan && t === join(ROOT, 'website')
  walkTop(t, defaultScan ? ROOT : t, isSite ? SITE_EXT : SCAN_EXT)
}
if (scanned === 0) fail2('scanned 0 files — refusing to report a pass on an empty scan')

const WHY = Object.fromEntries([...RULES, ...CROSS_RULES].map((r) => [r.id, r.why]))
if (findings.length === 0) {
  console.log(`honesty-gate: ${scanned} files scanned, no unevidenced claims found. (LICENSE: ${LICENCE.name ?? 'all rights reserved'}; physical rows in hardware/compat.tsv: ${PHYSICAL_ROWS})`)
  process.exit(0)
}
console.error(`\nhonesty-gate: ${findings.length} finding(s) across ${scanned} files. (LICENSE: ${LICENCE.name ?? 'all rights reserved'}; physical rows in hardware/compat.tsv: ${PHYSICAL_ROWS})\n`)
const byRule = new Map()
for (const f of findings) { if (!byRule.has(f.rule)) byRule.set(f.rule, []); byRule.get(f.rule).push(f) }
for (const [rule, fs] of byRule) {
  console.error(`── ${rule} ──`)
  console.error(`   ${WHY[rule]}\n`)
  for (const f of fs) console.error(`   ${f.file}:${f.line}  "${f.match}"\n      ${f.context}`)
  console.error('')
}
console.error('If a finding is genuinely fine, annotate the line with `auros-allow: <reason>` (in HTML, inside')
console.error('an HTML comment) — it shows up in the diff, which is the point. Do not widen a rule to make a')
console.error('finding disappear. A number can instead cite its evidence: <span data-source="docs/PLAN.md">138</span>.\n')
process.exit(1)
