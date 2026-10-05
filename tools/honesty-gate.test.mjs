#!/usr/bin/env node --test
// HONESTY GATE — a corpus of real-looking sentences, about half of which must fire.
//
// Ported from lathe/tools/honesty-gate.corpus.test.mjs. The design is LATHE's and is the point:
//   * Half the corpus MUST FIRE and half MUST NOT. A gate that matches everything fails the second
//     half; one that matches nothing fails the first. No degenerate implementation passes.
//   * Every must-fire case asserts WHICH rule fired: a sentence caught by the wrong rule stops being
//     caught the moment that rule is narrowed for its real purpose.
//   * Every rule the gate declares must have a must-fire case here, or this file goes red.
// Added for the merged product: HTML as a reader sees it, numbers that cite a data-source, licence
// claims checked against whichever LICENSE the tree holds (LATHE's all-rights-reserved one and this
// repository's MIT one), "works on every PC", and the compat.tsv lift proven in both directions.
//
// Every case runs the REAL gate as a REAL process over a directory holding one file, with --root
// pointing at that directory so its LICENSE and hardware/compat.tsv are the case's own.

import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const GATE = join(HERE, 'honesty-gate.mjs')
const REPO = join(HERE, '..')
const TMP = mkdtempSync(join(tmpdir(), 'auros-honesty-'))
after(() => rmSync(TMP, { recursive: true, force: true }))
let seq = 0

const RESERVED = 'Copyright (c) 2026 Auros. All rights reserved.\n\nNO LICENCE IS GRANTED.\n'
const MIT = readFileSync(join(REPO, 'LICENSE'), 'utf8')
const COMPAT_HEADER = readFileSync(join(REPO, 'hardware', 'compat.tsv'), 'utf8').split('\n')[0]

/**
 * @param file  the one file under test
 * @param opts  licence: 'mit' | 'reserved' (default mit); physical: add a physical compat row;
 *              extra: {path: text} more files in the root (data sources, workflows); companion: add
 *              a clean scannable file so an excluded file does not make the scan empty
 */
function scan (file, text, opts = {}) {
  const dir = join(TMP, `case-${seq++}`)
  mkdirSync(dirname(join(dir, file)), { recursive: true })
  writeFileSync(join(dir, file), text)
  writeFileSync(join(dir, 'LICENSE'), opts.licence === 'reserved' ? RESERVED : MIT)
  mkdirSync(join(dir, 'hardware'), { recursive: true })
  const cols = COMPAT_HEADER.split('\t')
  const physical = cols.map((c) => ({ model: 'ThinkPad-T440s', source: 'physical', tester: 'someone', tested_on: '2026-10-01' }[c] ?? '')).join('\t')
  writeFileSync(join(dir, 'hardware', 'compat.tsv'), `${COMPAT_HEADER}\n${opts.physical ? physical + '\n' : ''}`)
  for (const [p, t] of Object.entries(opts.extra ?? {})) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), t) }
  if (opts.companion) writeFileSync(join(dir, 'companion.md'), 'AurOS is built from one profile file.\n')
  // Scan only the file under test (and the companion), never the LICENSE or the evidence files.
  const targets = [join(dir, file), ...(opts.companion ? [join(dir, 'companion.md')] : [])]
  const r = spawnSync(process.execPath, [GATE, '--root', dir, ...targets], { encoding: 'utf8' })
  const out = (r.stdout ?? '') + (r.stderr ?? '')
  return { exit: r.status, rules: [...out.matchAll(/^── (\S+) ──$/gm)].map((m) => m[1]), out }
}

// ── the corpus ──────────────────────────────────────────────────────────────────────────────────
const MUST_FIRE = [
  // LATHE's, unchanged
  { name: 'trusted-by, the oldest one', file: 'a.md', rule: 'social-proof', text: '# AurOS\n\nTrusted by schools across three districts, and growing.\n' },
  { name: 'a case study we do not have', file: 'a.md', rule: 'social-proof', text: 'Read the case study from our first district rollout.\n' },
  { name: 'a star rating', file: 'a.md', rule: 'social-proof', text: 'Rated 4.8 stars by the IT staff who run it.\n' },
  { name: 'a testimonial block', file: 'a.md', rule: 'social-proof', text: '> "It just worked." — a testimonial from our pilot school\n' },
  { name: 'a device count in the field', file: 'a.md', rule: 'device-count', text: 'More than 4,000 machines are running AurOS this morning.\n' },
  { name: 'a device count wearing "already"', file: 'a.md', rule: 'device-count', text: 'Already 250 laptops have been brought back from the dead.\n' },
  { name: 'a savings figure in currency', file: 'a.md', rule: 'savings-figure', text: 'A 200-machine school saves $46,000 in the first year.\n' },
  { name: 'a savings figure as a percentage', file: 'a.md', rule: 'savings-figure', text: 'AurOS cuts costs by 60% against replacing the fleet.\n' },
  { name: 'a bare percentage presented as a result', file: 'a.md', rule: 'unqualified-percent', text: 'Support tickets drop: 40% fewer calls to the one person who fixes everything.\n' },
  { name: '[HARD] "one restart" with no qualification anywhere near it', file: 'a.md', rule: 'one-restart-unqualified', text: 'Your files, your Wi-Fi and your printers come across in one restart.\n' },
  { name: 'blanket .exe compatibility', file: 'a.md', rule: 'blanket-exe', text: 'It runs any Windows app you already paid for.\n' },
  { name: 'Office named as working', file: 'a.md', rule: 'office-adobe-claim', text: 'Microsoft Office is fully supported through the compatibility layer.\n' },
  { name: 'a guarantee', file: 'a.md', rule: 'guarantee', text: 'We guarantee not a single file is lost during the migration.\n' },
  { name: 'an absolute claim about every competitor', file: 'a.md', rule: 'competitor-absolute', text: 'Nobody else shows you the list of what they deleted from your computer.\n' },
  { name: 'a comparative claim nobody measured', file: 'a.md', rule: 'comparative-superiority', text: 'AurOS is more secure than a stock Windows 10 install.\n' },
  { name: 'a ranked frequency claim, stated as fact', file: 'a.md', rule: 'worded-frequency', text: 'Wireless firmware is the most common cause of a failed migration.\n' },
  { name: 'an implied track record', file: 'a.md', rule: 'implied-track-record', text: 'In our experience a 2014 ThinkPad installs cleanly on the first attempt.\n' },
  { name: 'a verb-led time estimate', file: 'a.md', rule: 'time-estimate', text: 'Budget about thirty minutes per machine and you will be fine.\n' },
  { name: 'an adjectival time estimate', file: 'a.md', rule: 'time-estimate', text: 'Installing AurOS is a thirty-second job.\n' },
  { name: 'an open-ended service term', file: 'a.md', rule: 'perpetual-commitment', text: 'Pay once. Lifetime updates are included.\n' },
  { name: '[HARD] a claim inside a string literal in a component', file: 'Hero.astro', rule: 'social-proof', text: '---\nconst kicker = "Trusted by schools that had given up on these laptops"\n---\n<p>{kicker}</p>\n' },
  { name: 'a first-person claim of a test lab we do not have', file: 'a.md', rule: 'fabricated-experience', text: 'Our lab runs every image on a shelf of donated ThinkPads before it ships.\n' },
  { name: 'a bare count attached to schools', file: 'a.md', rule: 'device-count-across', text: 'We are running 180 machines across three schools in the county.\n' },
  { name: '[HARD] a claim in JSX text, not in a string', file: 'Banner.astro', rule: 'device-count', text: '---\n---\n<section>\n  <h2>Now 1,200 machines and counting</h2>\n</section>\n' },
  // LATHE's licence cases, under LATHE's LICENSE
  { name: 'reserved LICENSE: an offer to fork and redistribute', file: 'a.md', rule: 'licence-grant', licence: 'reserved', text: 'Every recipe is yours: fork it, rebuild it, ship it to whoever you like.\n' },
  { name: 'reserved LICENSE: "open-source" applied to our own tooling', file: 'a.md', rule: 'licence-grant', licence: 'reserved', text: 'The whole toolchain is open-source, so you are never locked in.\n' },
  { name: 'reserved LICENSE: a permissive licence named', file: 'a.md', rule: 'licence-grant', licence: 'reserved', text: 'Released under the Apache-2 licence, like the rest of the ecosystem.\n' },
  { name: 'reserved LICENSE: "public repository" as an invitation to copy', file: 'a.md', rule: 'public-recipes', licence: 'reserved', text: 'Your recipe lives in a public git repository that anyone can work from.\n' },
  // new for the merged product
  { name: 'MIT LICENSE: a claim that the code is proprietary', file: 'a.md', rule: 'licence-restriction', text: 'AurOS is proprietary software. All rights reserved.\n' },
  { name: 'MIT LICENSE: a claim that it may not be copied', file: 'a.md', rule: 'licence-restriction', text: 'You may not copy or redistribute AurOS without permission.\n' },
  { name: 'MIT LICENSE: a different licence named for our code', file: 'a.md', rule: 'licence-named', text: 'AurOS is released under the GPLv3.\n' },
  { name: 'every PC', file: 'a.md', rule: 'universal-hardware', text: 'AurOS works on every PC made since 2012.\n' },
  { name: 'any laptop, as compatibility', file: 'a.md', rule: 'universal-hardware', text: 'Compatible with all laptops, old and new.\n' },
  { name: 'never fails', file: 'a.md', rule: 'guarantee', text: 'The installer never fails halfway.\n' },
  { name: '100% safe', file: 'a.md', rule: 'guarantee', text: 'Moving to AurOS is 100% safe for your files.\n' },
  { name: 'tested on real hardware, with no physical row to say so', file: 'a.md', rule: 'fabricated-experience', text: 'Every release is tested on real hardware before you see it.\n' },
  { name: '[HARD] HTML: a claim split across tags is still one sentence', file: 'a.html', rule: 'social-proof', text: '<p>Trusted <b>by</b> <em>schools</em> everywhere.</p>\n' },
  { name: '[HARD] HTML: alt text is read by people too', file: 'a.html', rule: 'social-proof', text: '<img src="x.png" alt="Trusted by schools across the county">\n' },
  { name: '[HARD] HTML: an entity-encoded apostrophe', file: 'a.html', rule: 'fabricated-experience', text: '<p>We&rsquo;ve tested it on dozens of laptops.</p>\n' },
  { name: '[HARD] HTML: a cited number that is not in its source', file: 'a.html', rule: 'data-source-mismatch', extra: { 'docs/results.md': 'Power cuts survived: 138.\n' }, text: '<p>Windows came back after <span data-source="docs/results.md">139</span> power cuts.</p>\n' },
  { name: '[HARD] HTML: a citation of a file that does not exist', file: 'a.html', rule: 'data-source-missing', text: '<p>Windows came back after <span data-source="docs/nowhere.md">138</span> power cuts.</p>\n' },
  { name: '[HARD] HTML: one of two cited files does not exist', file: 'a.html', rule: 'data-source-missing', extra: { 'a.md': '61.2 GiB\n' }, text: '<p data-source="a.md b.md">Windows shrinks to 61.2 GiB.</p>\n' },
  { name: '[HARD] HTML: a number is a substring of the source, not a number in it', file: 'a.html', rule: 'data-source-mismatch', extra: { 'r.md': 'It ran 1138 checks.\n' }, text: '<p>It ran <span data-source="r.md">138</span> checks.</p>\n' },
  { name: '[HARD] HTML: "1 real PC" cited to a compat.tsv with no physical rows', file: 'a.html', rule: 'data-source-mismatch', text: '<p>Real PCs installed so far: <b data-source="hardware/compat.tsv">1</b></p>\n' },
  { name: 'a cited workflow that does not exist, with a cadence', file: 'a.md', rule: 'cited-workflow-missing', text: 'Rebuilt nightly by .github/workflows/nightly.yml.\n' },
  // Found by the adversarial review: claims a reader sees that the gate did not.
  { name: '[HARD] a claim wrapped across two source lines (HTML)', file: 'a.html', rule: 'social-proof', text: '<p>AurOS is trusted\n   by schools across the county.</p>\n' },
  { name: '[HARD] a claim wrapped across two source lines (Markdown)', file: 'a.md', rule: 'universal-hardware', text: 'AurOS works on\nevery PC made since 2012.\n' },
  { name: '"used by" with a number in it', file: 'a.md', rule: 'social-proof', text: 'Used by 500 schools in three countries.\n' },
  { name: '"loved by", "chosen by" and their relatives', file: 'a.md', rule: 'social-proof', text: 'Loved by teachers, chosen by head teachers.\n' },
  { name: 'a bare count with a plus sign', file: 'a.md', rule: 'social-proof', text: '500+ schools have switched.\n' },
  { name: 'thousands of schools, no verb needed', file: 'a.md', rule: 'social-proof', text: 'Thousands of schools rely on it every morning.\n' },
  { name: '[HARD] "not only" is an intensifier, not a negation', file: 'a.md', rule: 'social-proof', text: 'Not only is it free, it is trusted by schools across the county.\n' },
  { name: '[HARD] "no wonder" is not a negation either', file: 'a.md', rule: 'social-proof', text: 'No wonder it is trusted by schools everywhere.\n' },
  { name: '[HARD] HTML: a word split by an inline tag reads as one word', file: 'a.html', rule: 'social-proof', text: '<p>Trus<span>ted</span> by schools.</p>\n' },
  { name: '[HARD] HTML: a soft hyphen inside a word', file: 'a.html', rule: 'social-proof', text: '<p>Read our testi&shy;monials.</p>\n' },
  { name: '[HARD] HTML: a zero-width space between words', file: 'a.html', rule: 'social-proof', text: '<p>Trusted&#8203; by schools.</p>\n' },
  { name: '[HARD] HTML: a button\'s value is text on the screen', file: 'a.html', rule: 'social-proof', text: '<input type="submit" value="Join thousands of happy users">\n' },
  { name: '[HARD] HTML: CSS content: is text on the screen', file: 'a.html', rule: 'social-proof', text: '<style>.hero::after { content: "Trusted by schools"; }</style>\n<p>AurOS</p>\n' },
  { name: '[HARD] JS: a \\u escape in a string', file: 'a.js', rule: 'social-proof', text: 'el.textContent = "\\u0054rusted by schools"\n' },
  { name: 'a cadence claimed for a parked workflow', file: 'a.md', rule: 'cited-workflow-schedule', extra: { '.github/workflows.parked/nightly.yml': 'on:\n  schedule:\n    - cron: "0 3 * * *"\n' }, text: 'Rebuilt nightly by .github/workflows.parked/nightly.yml.\n' },
]

const MUST_NOT_FIRE = [
  { name: '[HARD] a negated mention', file: 'a.md', text: 'We have no testimonials and no case studies, because we have no customers.\n' },
  { name: '[HARD] a negation using "never"', file: 'a.md', text: 'We never write trusted by anyone, because there is no one to be trusted by yet.\n' },
  { name: '[HARD] a negation using "do not"', file: 'a.md', text: 'We do not publish a device count, because the number is zero.\n' },
  { name: '[HARD] the phrase in a // comment in a component', file: 'Hero.astro', text: '---\n// This component must never render anything like "trusted by hundreds of schools".\nconst x = 1\n---\n<p>{x}</p>\n' },
  { name: '[HARD] the phrase in an HTML comment', file: 'a.html', text: '<!-- no case study goes here until there is a customer -->\n<footer>AurOS</footer>\n' },
  { name: '[HARD] the phrase in a style block', file: 'a.html', text: '<style>/* testimonials grid, trusted by */ .x{}</style>\n<p>AurOS</p>\n' },
  { name: '[HARD] an assertion about forbidden copy, inside a .test.ts file', file: 'claims.test.ts', companion: true, text: "assert.doesNotMatch(copy, /trusted by|case study|lifetime updates/)\n" },
  { name: '[HARD] "one restart" carrying its qualification', file: 'a.md', text: 'Most PCs move over in one restart. Some need a firmware setting changed first, and preflight tells you which before anything is written.\n' },
  { name: '[HARD] a number with its evidence cited in prose', file: 'a.md', text: 'The image is 5.3 GB (docs/results/v4.md).\n' },
  { name: '[HARD] HTML: a cited number that IS in its source passes the numeric rules too', file: 'a.html', extra: { 'docs/plan.md': 'A full install took 20 minutes on the test machine.\n' }, text: '<p data-source="docs/plan.md">An install takes about 20 minutes.</p>\n' },
  { name: '[HARD] HTML: a cited count with a thousands separator', file: 'a.html', extra: { 'docs/r.md': 'checks: 4200000\n' }, text: '<p>Checked <span data-source="docs/r.md">4,200,000</span> cases.</p>\n' },
  { name: '[HARD] HTML: two cited files, each number in one of them', file: 'a.html', extra: { 'a.md': 'resize to 61.2 GiB\n', 'b.md': 'a 256 GB disk\n' }, text: '<p data-source="a.md b.md">A 256 GB drive; Windows shrinks to 61.2 GiB.</p>\n' },
  { name: '[HARD] HTML: "0 real PCs", cited to the compat.tsv that has no physical rows', file: 'a.html', text: '<p>Real PCs installed so far: <b data-source="hardware/compat.tsv">0</b>.</p>\n' },
  { name: 'a configured timer is not an estimate', file: 'a.md', text: 'The update timer fires daily with a 15-minute randomised delay.\n' },
  { name: 'Office named as NOT running — the sentence the office rule exists to get written', file: 'a.md', text: 'Microsoft Office does not run on AurOS, and neither does Photoshop: they are not supported.\n' },
  { name: 'the honest does-not-come-across list', file: 'a.md', text: 'Office does not come across. Photoshop does not come across. Your files, bookmarks and Wi-Fi names do.\n' },
  { name: 'reserved LICENSE: the true position', file: 'a.md', licence: 'reserved', text: 'The repositories are readable so you can see exactly what is on your machines. Nothing here is licensed for copying or redistribution; all rights reserved.\n' },
  { name: 'reserved LICENSE: a negated licence mention', file: 'a.md', licence: 'reserved', text: 'We do not open-source our tooling. All rights reserved.\n' },
  { name: 'MIT LICENSE: saying it is MIT', file: 'a.md', text: 'AurOS is MIT-licensed: see LICENSE.\n' },
  { name: 'MIT LICENSE: somebody else\'s licence named about their software', file: 'a.md', text: 'Ubuntu\'s packages keep their own licences, many of them GPL.\n' },
  { name: 'MIT LICENSE: Windows described as proprietary', file: 'a.md', text: 'Windows is proprietary, and its programs do not run here.\n' },
  { name: '"the machines" meaning the person\'s own machines', file: 'a.md', text: 'The machines are yours, and they keep booting whatever happens to us.\n' },
  { name: 'every PC, refused rather than claimed', file: 'a.md', text: 'AurOS does not work on every PC. Preflight checks yours and says no before anything is written.\n' },
  { name: '"cannot guarantee" is the honest sentence', file: 'a.md', text: 'We cannot guarantee that a failing disk gives up every file.\n' },
  { name: 'an admission of no hardware testing', file: 'a.md', text: 'AurOS has never been tested on real hardware. Every install so far has been in QEMU.\n' },
  { name: 'a price is a term, not a claim', file: 'a.md', text: 'The download is free.\n' },
  { name: 'an honest admission that a measurement has not been taken', file: 'a.md', text: 'We have not measured how long an install takes on a real PC, so we do not tell you.\n' },
  { name: 'an ordinary technical sentence', file: 'a.md', text: 'Every profile inherits from desktop, and a security fix in desktop rebuilds every image.\n' },
  { name: 'a workflow file is configuration, not copy', file: 'build.yml', text: 'name: build\non:\n  schedule:\n    - cron: "0 3 * * *"\n' },
  { name: 'a factual statement about kiosk policy', file: 'a.md', text: 'On a kiosk there is no desktop: the first program starts and fills the screen.\n' },
  { name: 'a statement about the competitor being inaction', file: 'a.md', text: 'The real alternative is doing nothing, which is free and which works until the security updates stop.\n' },
  { name: 'a wrapped negation still negates', file: 'a.md', text: 'We have no\ntestimonials, and no case studies.\n' },
  { name: '"used by default" is not social proof', file: 'a.md', text: 'The dock is used by default; the rail is used by the kiosk.\n' },
  { name: 'HTML: two blocks are two sentences, not one', file: 'a.html', text: '<h2>Trusted</h2>\n<p>by nobody yet: there are no customers.</p>\n' },
  { name: 'HTML: a CSS comment and a non-content property stay invisible', file: 'a.html', text: '<style>/* trusted by */ .x { font-family: "Trusted by"; }</style>\n<p>AurOS</p>\n' },
  { name: 'the illustrative fleet sizes, labelled as illustrations', file: 'a.md', text: 'The examples show a 180-machine school and a 40-machine kiosk fleet. They are illustrations, not customers.\n' },
]

describe('the corpus must fire', () => {
  for (const c of MUST_FIRE) {
    test(`FIRES: ${c.name}`, () => {
      const r = scan(c.file, c.text, c)
      assert.equal(r.exit, 1, `this reached a reader and the gate said nothing (exit ${r.exit}):\n    ${c.text.trim()}\n${r.out}`)
      assert.ok(r.rules.includes(c.rule), `caught by ${JSON.stringify(r.rules)} rather than by "${c.rule}":\n    ${c.text.trim()}`)
    })
  }
})

describe('the corpus must stay quiet', () => {
  for (const c of MUST_NOT_FIRE) {
    test(`QUIET: ${c.name}`, () => {
      const r = scan(c.file, c.text, c)
      assert.equal(r.exit, 0, `a false positive — the expensive kind; a gate that cries wolf gets annotated past.\n    ${c.text.trim()}\n  fired: ${JSON.stringify(r.rules)}\n${r.out}`)
    })
  }
})

describe('the evidence files decide, in both directions', () => {
  const claim = 'We have tested AurOS on a ThinkPad T440s and a Latitude E6440.\n'
  test('no physical row in hardware/compat.tsv: a claim of hands-on testing fires', () => {
    const r = scan('a.md', claim)
    assert.equal(r.exit, 1)
    assert.ok(r.rules.includes('fabricated-experience'))
  })
  test('one physical row: the same sentence no longer fires as fabricated', () => {
    const r = scan('a.md', claim, { physical: true })
    assert.ok(!r.rules.includes('fabricated-experience'), r.out)
  })
  test('the same restriction sentence: refused under MIT, the truth under all-rights-reserved', () => {
    const s = 'All rights reserved; nothing here is licensed for copying.\n'
    assert.ok(scan('a.md', s).rules.includes('licence-restriction'))
    assert.equal(scan('a.md', s, { licence: 'reserved' }).exit, 0)
  })
  test('the same licence name: the truth under MIT, refused under all-rights-reserved', () => {
    const s = 'AurOS is under the MIT License.\n'
    assert.equal(scan('a.md', s).exit, 0)
    assert.equal(scan('a.md', s, { licence: 'reserved' }).exit, 1)
  })
  test('the same number: quiet when its source says it, a finding when the source changes', () => {
    const html = '<p>It survived <span data-source="r.md">138</span> power cuts.</p>\n'
    assert.equal(scan('a.html', html, { extra: { 'r.md': '138 cuts\n' } }).exit, 0)
    assert.ok(scan('a.html', html, { extra: { 'r.md': '137 cuts\n' } }).rules.includes('data-source-mismatch'))
  })
  test('an HTML line number points at the line the reader sees', () => {
    const r = scan('a.html', '<html>\n<!-- a\ncomment -->\n<style>\n.x{}\n</style>\n<p>\nTrusted by schools.\n</p>\n')
    assert.match(r.out, /a\.html:8\s/)
  })
})

describe('the boundary of the negation guard, recorded rather than discovered', () => {
  test('KNOWN LIMITATION (LATHE\'s, kept): "nothing … says you may fork it" still fires', () => {
    const r = scan('a.md', 'Nothing on this site says you may fork it.\n', { licence: 'reserved' })
    assert.equal(r.exit, 1, 'the negation guard now understands "nothing": read the comment in LATHE\'s corpus before accepting that — it widens a suppression list')
  })
  test('the guard does cover the words it claims to', () => {
    for (const neg of ['We do not say', 'We never say', 'We must not say', 'We may not say', "We don't say"]) {
      assert.equal(scan('a.md', `${neg} trusted by anybody.\n`).exit, 0, neg)
    }
  })
})

describe('the corpus is balanced, every rule is exercised, and the gate fails closed', () => {
  const declared = () => [...readFileSync(GATE, 'utf8').matchAll(/^\s*\{\s*id:\s*'([a-z0-9-]+)'/gm)].map((m) => m[1])
  test('roughly half fires and half does not', () => {
    const total = MUST_FIRE.length + MUST_NOT_FIRE.length
    assert.ok(total >= 40, `${total} sentences`)
    const ratio = MUST_FIRE.length / total
    assert.ok(ratio > 0.35 && ratio < 0.65, `${MUST_FIRE.length} fire / ${MUST_NOT_FIRE.length} quiet`)
  })
  test('every rule the corpus asserts exists in the gate', () => {
    const d = new Set(declared())
    assert.ok(d.size >= 20, `only ${d.size} rules parsed out of the gate — the parse is wrong`)
    for (const c of MUST_FIRE) assert.ok(d.has(c.rule), c.rule)
  })
  test('EVERY rule the gate declares has at least one must-fire case', () => {
    const covered = new Set(MUST_FIRE.map((c) => c.rule))
    assert.deepEqual(declared().filter((r) => !covered.has(r)), [])
  })
  test('refuses to report a pass when its default targets are missing', () => {
    const empty = join(TMP, `empty-${seq++}`)
    mkdirSync(empty, { recursive: true })
    writeFileSync(join(empty, 'LICENSE'), MIT)
    const r = spawnSync(process.execPath, [GATE, '--root', empty], { encoding: 'utf8' })
    assert.equal(r.status, 2, r.stdout + r.stderr)
  })
  test('refuses a directory with nothing scannable in it', () => {
    const d = join(TMP, `noscan-${seq++}`)
    mkdirSync(d, { recursive: true })
    writeFileSync(join(d, 'LICENSE'), MIT)
    writeFileSync(join(d, 'notes.txt'), 'Trusted by schools everywhere.\n')
    const r = spawnSync(process.execPath, [GATE, '--root', d, d], { encoding: 'utf8' })
    assert.equal(r.status, 2)
    assert.match(r.stderr, /0 files/)
  })
  test('refuses to run with no LICENSE, or one it cannot read the terms of', () => {
    const d = join(TMP, `nolic-${seq++}`)
    mkdirSync(d, { recursive: true })
    writeFileSync(join(d, 'a.md'), 'AurOS.\n')
    assert.equal(spawnSync(process.execPath, [GATE, '--root', d, d], { encoding: 'utf8' }).status, 2)
    writeFileSync(join(d, 'LICENSE'), 'Do what you like, probably.\n')
    assert.equal(spawnSync(process.execPath, [GATE, '--root', d, d], { encoding: 'utf8' }).status, 2)
  })
  test('auros-allow silences a finding, and ONLY on the line it annotates', () => {
    assert.equal(scan('a.md', 'Trusted by schools everywhere. <!-- auros-allow: this file documents the rule -->\n').exit, 0)
    const other = scan('b.md', 'Trusted by schools everywhere. <!-- auros-allow: documented -->\n\n\nLifetime updates are included.\n')
    assert.equal(other.exit, 1)
    assert.ok(other.rules.includes('perpetual-commitment'))
    const html = scan('c.html', '<!-- auros-allow: the old copy, quoted -->\n<p>Trusted by schools.</p>\n<p>\n</p>\n<p>Trusted by schools.</p>\n')
    assert.equal(html.exit, 1, 'an HTML auros-allow covered a line three lines below it')
  })
  test('the real repository is scannable: the default scan runs and gives a verdict (0 or 1, never 2)', () => {
    const r = spawnSync(process.execPath, [GATE], { cwd: REPO, encoding: 'utf8' })
    assert.ok(r.status === 0 || r.status === 1, r.stdout + r.stderr)
    assert.match(r.stdout + r.stderr, /files scanned|finding\(s\) across/)
  })
})
