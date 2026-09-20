#!/usr/bin/env node --test
// HONESTY GATE — a corpus of real-looking marketing sentences, half of which must fire.
//
//   node --test tools/honesty-gate.corpus.test.mjs
//
// WHY A CORPUS AND NOT A RULE-BY-RULE UNIT TEST. tools/honesty-regressions.test.mjs asserts that
// specific published sentences stay fixed. This file asserts the opposite direction: that the gate
// still *works as a classifier* on prose it has never seen. Those are different failures. A gate can
// keep every regression green while quietly losing the ability to catch anything new — that is
// exactly what happened on 2026-09-20, when a clean scan was reported over copy that contained seven
// unevidenced claims, because the rules kept checking what they had always checked while the prose
// moved somewhere else.
//
// THE DESIGN THAT MAKES THIS A CHECK RATHER THAN A CEREMONY:
//
//   * Half the corpus MUST FIRE and half MUST NOT. A gate that matches everything fails the second
//     half; a gate that matches nothing fails the first. There is no degenerate implementation that
//     passes this file — which is the property the SELinux karg check lacked when it was green for
//     an hour without being able to go red.
//   * Every must-fire case also asserts WHICH RULE fired. A sentence caught by the wrong rule is a
//     sentence that will stop being caught the moment somebody narrows that rule for its real
//     purpose.
//   * The quiet half is not filler. It is the expensive half: a gate with false positives gets
//     annotated past, and `auros-allow` used reflexively is not an escape hatch, it is the end of
//     the gate. Each quiet case is a sentence somebody would genuinely write.
//
// THE HARD CASES, which are the reason this file exists at all, are marked [HARD] below: a negated
// mention, a mention in a code comment, a mention in a test file, a claim inside a string literal in
// a component, the same claim in markdown, a number with a cited source against one without, and
// "one restart" with and without its qualification.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const GATE = join(HERE, 'honesty-gate.mjs')

let ROOT
const root = () => (ROOT ??= mkdtempSync(join(tmpdir(), 'auros-honesty-corpus-')))
let seq = 0

/**
 * Run the real honesty gate, as a real process, over a directory containing exactly one file.
 * One file per case so a finding can only have come from the sentence under test.
 * @returns {{exit:number, rules:string[], out:string}}
 */
function scan (file, text, companion = false) {
  const dir = join(root(), `case-${seq++}`)
  mkdirSync(dirname(join(dir, file)), { recursive: true })
  writeFileSync(join(dir, file), text)
  // A file the gate WILL scan, carrying nothing it could object to. Its only job is to keep the
  // scan non-empty so an exit 2 cannot be mistaken for a clean pass or for a finding.
  if (companion) writeFileSync(join(dir, 'companion.md'), 'Every recipe inherits from one base image.\n')
  try {
    const out = execFileSync(process.execPath, [GATE, dir], { encoding: 'utf8', stdio: 'pipe' })
    return { exit: 0, rules: [], out }
  } catch (e) {
    const out = String(e.stdout ?? '') + String(e.stderr ?? '')
    return { exit: e.status ?? -1, rules: [...out.matchAll(/^── (\S+) ──$/gm)].map((m) => m[1]), out }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE CORPUS. `rule` on a must-fire case is the rule that MUST be among those that fired.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const MUST_FIRE = [
  { name: 'trusted-by, the oldest one',
    file: 'a.md', rule: 'social-proof',
    text: '# Auros\n\nTrusted by schools across three districts, and growing.\n' },

  { name: 'a case study we do not have',
    file: 'a.md', rule: 'social-proof',
    text: 'Read the case study from our first district rollout.\n' },

  { name: 'a star rating',
    file: 'a.md', rule: 'social-proof',
    text: 'Rated 4.8 stars by the IT staff who run it.\n' },

  { name: 'a testimonial block',
    file: 'a.md', rule: 'social-proof',
    text: '> "It just worked." — a testimonial from our pilot school\n' },

  { name: 'a device count in the field',
    file: 'a.md', rule: 'device-count',
    text: 'More than 4,000 machines are running Auros this morning.\n' },

  { name: 'a device count wearing "already"',
    file: 'a.md', rule: 'device-count',
    text: 'Already 250 laptops have been brought back from the dead.\n' },

  { name: 'a savings figure in currency',
    file: 'a.md', rule: 'savings-figure',
    text: 'A 200-machine school saves $46,000 in the first year.\n' },

  { name: 'a savings figure as a percentage',
    file: 'a.md', rule: 'savings-figure',
    text: 'Auros cuts costs by 60% against replacing the fleet.\n' },

  { name: 'a bare percentage presented as a result',
    file: 'a.md', rule: 'unqualified-percent',
    text: 'Support tickets drop: 40% fewer calls to the one person who fixes everything.\n' },

  // [HARD] The same three words, twice, once with its qualification and once without. The pair is
  // the test; either sentence alone proves nothing about the rule.
  { name: '[HARD] "one restart" with no qualification anywhere near it',
    file: 'a.md', rule: 'one-restart-unqualified',
    text: 'Your files, your Wi-Fi and your printers come across in one restart.\n' },

  { name: 'blanket .exe compatibility',
    file: 'a.md', rule: 'blanket-exe',
    text: 'It runs any Windows app you already paid for.\n' },

  { name: 'Office named as working',
    file: 'a.md', rule: 'office-adobe-claim',
    text: 'Microsoft Office is fully supported through the compatibility layer.\n' },

  { name: 'Winboat offered as an option',
    file: 'a.md', rule: 'winapps',
    text: 'Need a stubborn program? Winboat runs it beside your Linux apps.\n' },

  { name: 'a guarantee',
    file: 'a.md', rule: 'guarantee',
    text: 'We guarantee not a single file is lost during the migration.\n' },

  { name: 'a rollback history that does not exist',
    file: 'a.md', rule: 'multi-rollback',
    text: 'Something broke? Roll back to any image from the last month.\n' },

  { name: 'an absolute claim about every competitor',
    file: 'a.md', rule: 'competitor-absolute',
    text: 'Nobody else shows you the list of what they deleted from your computer.\n' },

  { name: 'a comparative claim we have not measured',
    file: 'a.md', rule: 'comparative-superiority',
    text: 'The hardened base is more secure than a stock Fedora Workstation install.\n' },

  { name: 'a ranked frequency claim, stated as fact',
    file: 'a.md', rule: 'worded-frequency',
    text: 'Wireless firmware is the most common cause of a failed migration.\n' },

  { name: 'an implied track record',
    file: 'a.md', rule: 'implied-track-record',
    text: 'In our experience a 2014 ThinkPad images cleanly on the first attempt.\n' },

  { name: 'a verb-led time estimate',
    file: 'a.md', rule: 'time-estimate',
    text: 'Budget about thirty minutes per machine and you will be fine.\n' },

  { name: 'an adjectival time estimate, which reads as trivial and is per-machine work',
    file: 'a.md', rule: 'time-estimate',
    text: 'Imaging a laptop is a thirty-second job.\n' },

  { name: 'an open-ended service term attached to a one-time price',
    file: 'a.md', rule: 'perpetual-commitment',
    text: 'Pay once. Lifetime updates are included.\n' },

  // [HARD] The claim is not in prose — it is a string literal inside a component. This is the shape
  // that actually ships: a reviewer skims the markdown and never opens the .astro file.
  { name: '[HARD] a claim inside a string literal in a component',
    file: 'Hero.astro',
    rule: 'social-proof',
    text: '---\nconst kicker = "Trusted by schools that had given up on these laptops"\n---\n<p>{kicker}</p>\n' },

  { name: 'a bare count attached to schools — a customer claim in an architecture diagram\'s clothes',
    file: 'a.md', rule: 'device-count-across',
    text: 'We are running 180 machines across three schools in the county.\n' },

  { name: '[HARD] a claim in JSX text, not in a string',
    file: 'Banner.astro', rule: 'device-count',
    text: '---\n---\n<section>\n  <h2>Now 1,200 machines and counting</h2>\n</section>\n' },
]

const MUST_NOT_FIRE = [
  // [HARD] Negation. The files that audit our honesty are the files most likely to contain the
  // forbidden phrases, and a gate that trips on its own audit trains people to annotate past it.
  { name: '[HARD] a negated mention — the rule being refused, not exercised',
    file: 'a.md',
    text: 'We have no testimonials and no case studies, because we have no customers.\n' },

  { name: '[HARD] a negation using "never"',
    file: 'a.md',
    text: 'We never write trusted by anyone, because there is no one to be trusted by yet.\n' },

  { name: '[HARD] a negation using "do not"',
    file: 'a.md',
    text: 'We do not publish a device count, because the number is zero.\n' },

  // [HARD] A pure comment in code cannot reach a customer. Three engineering comments using
  // "guarantees" in its ordinary technical sense had already tripped this gate once.
  { name: '[HARD] the phrase in a // comment in a component',
    file: 'Hero.astro',
    text: '---\n// This component must never render anything like "trusted by hundreds of schools".\nconst x = 1\n---\n<p>{x}</p>\n' },

  { name: '[HARD] the phrase in an HTML comment in a component',
    file: 'Foot.astro',
    text: '---\n---\n<!-- no case study goes here until there is a customer -->\n<footer>Auros</footer>\n' },

  // [HARD] A test file ships to nobody. This case is here because the exclusion was DEAD CODE:
  // walk() read plain filenames and tested `entry.name`, which is undefined on a string, so the
  // regex never matched and every test file was scanned. Fixed 2026-09-20; this is what keeps it fixed.
  // These two carry a `companion` file so the directory is not an EMPTY scan. Without it the gate
  // exits 2 ("scanned 0 files — refusing to report a pass"), which is correct behaviour for a
  // different reason and would have made these two cases prove nothing about the test-file exclusion.
  { name: '[HARD] an assertion about forbidden copy, inside a .test.ts file',
    file: 'claims.test.ts', companion: true,
    text: "import assert from 'node:assert'\nassert.doesNotMatch(copy, /trusted by|case study|lifetime updates/)\n" },

  { name: '[HARD] a .spec.tsx file quoting a device count it is asserting against',
    file: 'hero.spec.tsx', companion: true,
    text: "it('never claims a fleet', () => expect(html).not.toContain('More than 4,000 machines'))\n" },

  // [HARD] "one restart" WITH its qualification in the same neighbourhood. The pair to the must-fire
  // case above: same three words, opposite verdict, and the difference is the only thing that matters.
  { name: '[HARD] "one restart" carrying its qualification',
    file: 'a.md',
    text: 'Most machines migrate in one restart. Some need a firmware setting changed first, and the tool tells you which before you start.\n' },

  // [HARD] A number WITH a cited source. The rule is not "no numbers" — it is "no numbers without a
  // source", and a gate that cannot tell the difference makes the site vaguer instead of truer.
  { name: '[HARD] a measured number with its evidence cited',
    file: 'a.md',
    text: 'The upstream base is 3.5 GB compressed, measured on a runner on 2026-09-20 (docs/evidence/2026-09-20-runner-probe.md).\n' },

  { name: '[HARD] a measured image size with its layer count',
    file: 'a.md',
    text: 'The image is 8.4 GB across 257 layers, which is why the root filesystem floor is 20 GiB.\n' },

  { name: 'a configured schedule is not an estimate of human effort',
    file: 'a.md',
    text: 'The update timer fires at 04:00 with a 15-minute randomised delay.\n' },

  { name: 'a poll interval is a value in a cron line, not a guess',
    file: 'a.md',
    text: 'Recipes compare their lockfile against the base on a 15-minute poll interval.\n' },

  { name: 'the true rollback statement',
    file: 'a.md',
    text: 'bootc keeps the running image and exactly one rollback. There is no history beyond that.\n' },

  { name: 'the honest does-not-come-across list',
    file: 'a.md',
    text: 'Office does not come across. Photoshop does not come across. Your files, bookmarks, Wi-Fi and printers do.\n' },

  { name: 'the D31 wind-down commitment, which is the trust story we can actually keep',
    file: 'a.md',
    text: 'You have the image already; it is on the laptops. If we cease operating, you get the build files needed to keep patching it.\n' },

  { name: 'the replacement-cost comparison, with the arithmetic left to the reader',
    file: 'a.md',
    text: 'A replacement laptop is $300 to $500. You have 40 of them. We charge $15 per device per year. Do that arithmetic with your own numbers.\n' },

  { name: 'a price, which is a term and not a claim',
    file: 'a.md',
    text: 'One machine is $79, one time. Schools and nonprofits are $15 per device per year, 25 devices minimum.\n' },

  { name: 'a factual statement about what the kiosk policy removes',
    file: 'a.md',
    text: 'In kiosk mode the desktop shell and the display manager are absent from the image. There is nothing to log in to.\n' },

  { name: 'a statement about the competitor being inaction',
    file: 'a.md',
    text: 'Our real competitor is doing nothing, which is free and which works until the laptops stop getting security updates.\n' },

  { name: 'an honest admission that a measurement has not been taken',
    file: 'a.md',
    text: 'We have not measured a nightly delta on a real school uplink, so we do not tell you what one costs.\n' },

  { name: 'an ordinary technical sentence with no claim in it',
    file: 'a.md',
    text: 'Every recipe inherits from one base image, and a CVE fix in that base rebuilds every recipe.\n' },

  { name: 'a workflow file, which is configuration and not copy',
    file: 'build.yml',
    text: 'name: build-base\non:\n  schedule:\n    - cron: "0 3 * * *"\n' },

  { name: 'the illustrative fleet sizes from the architecture diagram',
    file: 'a.md',
    text: 'The diagram shows three example recipes — 180 machines, 40 machines, 62 machines. They are illustrations, not customers.\n' },

  { name: 'a plain description of what the configurator shows',
    file: 'a.md',
    text: 'The panel on the right is your recipe.yaml, including the remove: block naming every package that gets deleted.\n' },
]

// ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('the corpus must fire', () => {
  for (const c of MUST_FIRE) {
    test(`FIRES: ${c.name}`, () => {
      const r = scan(c.file, c.text)
      assert.equal(r.exit, 1,
        `this sentence reached a customer and the gate said nothing:\n    ${c.text.trim()}\n  ` +
        `(expected exit 1, got ${r.exit}). Rule that should have caught it: ${c.rule}.`)
      assert.ok(r.rules.includes(c.rule),
        `the sentence was caught, but by ${JSON.stringify(r.rules)} rather than by "${c.rule}".\n    ${c.text.trim()}\n` +
        '  A sentence caught by the wrong rule stops being caught the moment that rule is narrowed for its real purpose.')
    })
  }
})

describe('the corpus must stay quiet', () => {
  for (const c of MUST_NOT_FIRE) {
    test(`QUIET: ${c.name}`, () => {
      const r = scan(c.file, c.text, c.companion)
      assert.equal(r.exit, 0,
        `a false positive. This is the expensive kind: a gate that cries wolf gets annotated past, and ` +
        `\`auros-allow\` used reflexively is not an escape hatch, it is the end of the gate.\n` +
        `    file: ${c.file}\n    ${c.text.trim().split('\n').join('\n    ')}\n  fired: ${JSON.stringify(r.rules)}\n`)
    })
  }
})

describe('the corpus itself is balanced, and the gate fails closed', () => {
  test('roughly half the corpus fires and half does not', () => {
    // The balance IS the anti-vacuity property. A gate that matches everything fails the quiet half;
    // one that matches nothing fails the loud half. Neither degenerate implementation survives.
    const total = MUST_FIRE.length + MUST_NOT_FIRE.length
    assert.ok(total >= 40, `the corpus is ${total} sentences; the brief asks for about 40`)
    const ratio = MUST_FIRE.length / total
    assert.ok(ratio > 0.35 && ratio < 0.65,
      `${MUST_FIRE.length} fire / ${MUST_NOT_FIRE.length} quiet is ${(ratio * 100).toFixed(0)}% — ` +
      'too lopsided to rule out a gate that simply always answers the same way')
  })

  test('every rule that has a must-fire case is a rule that exists in the gate', () => {
    // Catches the reverse drift: a rule renamed or deleted while this corpus keeps asserting it.
    const src = execFileSync('node', ['-e', `process.stdout.write(require('fs').readFileSync(${JSON.stringify(GATE)}, 'utf8'))`], { encoding: 'utf8' })
    const declared = new Set([...src.matchAll(/^\s*\{\s*id:\s*'([a-z0-9-]+)'/gm)].map((m) => m[1]))
    assert.ok(declared.size >= 10, `only ${declared.size} rules were parsed out of the gate — the parse is wrong, not the gate`)
    for (const c of MUST_FIRE) {
      assert.ok(declared.has(c.rule), `the corpus asserts rule "${c.rule}", which honesty-gate.mjs no longer declares`)
    }
  })

  test('EVERY rule the gate declares has at least one must-fire case', () => {
    // The gap this closes: a rule added in a hurry, never exercised, and quietly broken from birth.
    // If this fails, the fix is a new corpus sentence, not a smaller assertion.
    const src = execFileSync('node', ['-e', `process.stdout.write(require('fs').readFileSync(${JSON.stringify(GATE)}, 'utf8'))`], { encoding: 'utf8' })
    const declared = [...src.matchAll(/^\s*\{\s*id:\s*'([a-z0-9-]+)'/gm)].map((m) => m[1])
    const covered = new Set(MUST_FIRE.map((c) => c.rule))
    const uncovered = declared.filter((r) => !covered.has(r))
    assert.deepEqual(uncovered, [],
      `these honesty-gate rules have no sentence in this corpus that proves they can fire: ${uncovered.join(', ')}. ` +
      'A rule nobody has seen go red is a rule nobody knows works.')
  })

  test('the gate REFUSES to report a pass when given no directory', () => {
    let threw = null
    try { execFileSync(process.execPath, [GATE], { encoding: 'utf8', stdio: 'pipe' }) } catch (e) { threw = e }
    assert.ok(threw, 'the gate exited 0 with no arguments — a scan of nothing reported as clean')
    assert.equal(threw.status, 2)
  })

  test('the gate REFUSES to report a pass on a directory with nothing scannable in it', () => {
    // The empty-scan failure is the one that actually happened in CI: the four product repos are
    // separate git repos (D6), so a fresh meta checkout has none of them, and a gate that reports
    // "0 findings" over 0 files is a gate that has stopped running.
    const empty = join(root(), `empty-${seq++}`)
    mkdirSync(empty, { recursive: true })
    writeFileSync(join(empty, 'notes.txt'), 'Trusted by schools everywhere. Lifetime updates.\n')  // .txt is not scanned
    let threw = null
    try { execFileSync(process.execPath, [GATE, empty], { encoding: 'utf8', stdio: 'pipe' }) } catch (e) { threw = e }
    assert.ok(threw, 'the gate reported a clean pass over a directory it read zero files from')
    assert.equal(threw.status, 2)
    assert.match(String(threw.stderr), /0 files|refusing to report a pass/i)
  })

  test('the gate REFUSES a directory that does not exist', () => {
    let threw = null
    try {
      execFileSync(process.execPath, [GATE, join(root(), 'nowhere-at-all')], { encoding: 'utf8', stdio: 'pipe' })
    } catch (e) { threw = e }
    assert.ok(threw, 'a scan of a path that is not there reported clean')
    assert.notEqual(threw.status, 0)
  })

  test('auros-allow silences a finding, and ONLY on the line it annotates', () => {
    // The escape hatch has to work — otherwise people widen rules instead, which is worse and
    // invisible. It also has to be narrow, or one annotation quietly covers a file.
    const allowed = scan('a.md', 'Trusted by schools everywhere. <!-- auros-allow: this file documents the rule -->\n')
    assert.equal(allowed.exit, 0, 'an annotated line still fired — people will widen the rule instead, and a widened rule is invisible')

    const other = scan('b.md',
      'Trusted by schools everywhere. <!-- auros-allow: documented -->\n\n\nLifetime updates are included.\n')
    assert.equal(other.exit, 1, 'one auros-allow annotation silenced a DIFFERENT claim four lines away')
    assert.ok(other.rules.includes('perpetual-commitment'))
  })
})

test.after(() => { if (ROOT) rmSync(ROOT, { recursive: true, force: true }) })
