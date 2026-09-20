#!/usr/bin/env node --test
// REGRESSION TESTS FOR THE 2026-09-20 HONESTY AUDIT.
//
// One named test per fatal and major finding. The point is not that the copy currently reads well —
// somebody can always rewrite a paragraph. The point is that each SPECIFIC defect that was found and
// fixed becomes an assertion, so it cannot come back quietly in a later rewrite by somebody who does
// not know it was ever there.
//
// Every test below names its finding, states what was published, and says why the sentence was wrong.
// If one of these goes red, read the comment before you change the assertion: the assertion is the
// part that was decided, and the copy is the part that moved.
//
//   node --test tools/honesty-regressions.test.mjs
//
// These tests SKIP rather than fail when a sibling repository is not checked out (D6 keeps the four
// product repos separate), because a missing repo is not a passing claim — but they refuse to skip on
// a file that is merely missing from a repo that IS present, because that is how an audit gets
// deleted rather than fixed.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const META = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WEB = join(META, 'auros-web')
const CONTENT = join(WEB, 'src/content')
const RECIPES = join(META, 'auros-recipes')
const INSTALLER = join(META, 'auros-installer')

const haveWeb = existsSync(CONTENT)
const haveRecipes = existsSync(RECIPES)
const haveInstaller = existsSync(join(INSTALLER, 'SAFETY.md'))

function read (...parts) {
  const p = join(...parts)
  assert.ok(existsSync(p), `${p} is missing. A finding is not resolved by deleting the file it was found in; if this file legitimately moved, move the assertion with it.`)
  return readFileSync(p, 'utf8')
}

/** Every content file, so a claim cannot come back in a file nobody thought to name. */
function allContent () {
  const out = []
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) { walk(p); continue }
      if (!/\.(md|mdx|ts)$/.test(p)) continue
      if (p.endsWith('CLAIMS.md')) continue   // the register describes withdrawn claims on purpose
      out.push([p.slice(CONTENT.length + 1), readFileSync(p, 'utf8')])
    }
  }
  walk(CONTENT)
  return out
}

/**
 * `allowNear` exists for one honest case: copy that STATES a claim in order to argue against it.
 * The landing page quotes the stronger safety promise by name and then explains why we do not make
 * it, which is the most useful paragraph on the page and would be deleted by a blind grep. The cue
 * has to appear within 300 characters, so a refutation cannot be moved three paragraphs away and
 * still launder the sentence.
 */
function forbidEverywhere (pattern, why, allowNear) {
  const hits = []
  for (const [rel, text] of allContent()) {
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')
    let m
    while ((m = re.exec(text)) !== null) {
      if (allowNear) {
        const window = text.slice(Math.max(0, m.index - 300), m.index + m[0].length + 300)
        if (allowNear.test(window)) continue
      }
      hits.push(`${rel}: "${m[0].trim()}"`)
    }
  }
  assert.deepEqual(hits, [], `${why}\nFound in:\n  ${hits.join('\n  ')}`)
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('FATAL 1 — the rebuild command a sceptic is invited to run', { skip: !haveWeb && 'auros-web not checked out' }, () => {
  // PUBLISHED: `podman build -t myschool:local -f myschool/Containerfile .`
  // The repository lays recipes out under `customers/<name>/`. The command was wrong by one path
  // component in both places it appeared, no customer had a committed Containerfile, and the
  // workflow that claimed to run it "verbatim" ran a different string. This is the command behind
  // the one thing we advertise hardest, on the page a sceptical IT person reads first.

  test('the published command names the customers/ path the repository actually uses', () => {
    for (const f of ['faq/1-if-you-disappear.md', 'pages/5-replaceable-on-purpose.mdx']) {
      const text = read(CONTENT, f)
      const cmds = text.split('\n').filter((l) => /^podman build .*Containerfile/.test(l.trim()))
      assert.ok(cmds.length > 0, `${f} no longer publishes a podman build command. If the claim moved, move this test with it deliberately.`)
      for (const c of cmds) {
        assert.match(c, /-f customers\/\S+\/Containerfile/,
          `${f} publishes a Containerfile path without the 'customers/' component:\n  ${c.trim()}\nThat is the exact fatal from 2026-09-20: a command that cannot work for anybody.`)
      }
    }
  })

  test('both pages publish the identical command, byte for byte', () => {
    const one = read(CONTENT, 'faq/1-if-you-disappear.md').split('\n').find((l) => /^podman build .*Containerfile/.test(l.trim())).trim()
    const two = read(CONTENT, 'pages/5-replaceable-on-purpose.mdx').split('\n').find((l) => /^podman build .*Containerfile/.test(l.trim())).trim()
    assert.equal(two, one, 'The FAQ and the replaceable page publish different rebuild commands. Only one of them is executed by auros-recipes/.github/workflows/replaceable.yml; the other is what a customer might type.')
  })

  test('every customer directory has a committed Containerfile', { skip: !haveRecipes && 'auros-recipes not checked out' }, () => {
    const customers = join(RECIPES, 'customers')
    const names = readdirSync(customers).filter((d) => statSync(join(customers, d)).isDirectory())
    assert.ok(names.length > 0, 'no customer directories at all')
    const missing = names.filter((n) => !existsSync(join(customers, n, 'Containerfile')))
    assert.deepEqual(missing, [], `Each of these is a customer who cannot rebuild their own operating system without us, while the website says they can: ${missing.join(', ')} (DECISIONS.md D28).`)
  })

  test('the compiled Containerfile takes BASE as a build argument, because the site documents overriding it', { skip: !haveRecipes && 'auros-recipes not checked out' }, () => {
    // pages/5 tells a reader whose registry is gone to build the base themselves and pass
    // `--build-arg BASE=localhost/auros-base:hardened`. Until 2026-09-20 no compiled Containerfile
    // declared ARG BASE, so that flag was silently ignored and the "registry is gone too" path —
    // the whole point of the paragraph — did not work.
    const customers = join(RECIPES, 'customers')
    for (const n of readdirSync(customers).filter((d) => statSync(join(customers, d)).isDirectory())) {
      const cf = join(customers, n, 'Containerfile')
      if (!existsSync(cf)) continue
      const text = readFileSync(cf, 'utf8')
      assert.match(text, /^ARG BASE=\S+$/m, `${n}/Containerfile has no 'ARG BASE=' line, so --build-arg BASE= does nothing`)
      assert.match(text, /^FROM \$\{BASE\}$/m, `${n}/Containerfile's FROM does not read the BASE argument`)
    }
  })

  test('the published command references paths that exist (tools/content-commands.mjs)', () => {
    execFileSync(process.execPath, [join(META, 'tools/content-commands.mjs')], { stdio: 'pipe' })
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('FATAL 2 — an open-ended service term attached to a one-time price', { skip: !haveWeb && 'auros-web not checked out' }, () => {
  // PUBLISHED, in tiers/1-one-machine.md includes: "Nightly rebuilds of the base it stands on, for
  // as long as we are here". CLAIMS.md forbade that exact string in terms, because duration of
  // service is a commercial term, §9-reserved, and nobody decided it. Publishing it decides it.

  test('no tier promises service for an open-ended term', () => {
    forbidEverywhere(/for as long as we (?:are|exist)|in perpetuity|lifetime (?:updates?|support|access)|for life\b/i,
      'A §9-reserved commercial term is being decided by publishing it. The length of any service commitment is a human decision (SPEC §9).')
  })

  test('the one-machine tier says the term is undecided rather than implying one', () => {
    const t = read(CONTENT, 'tiers/1-one-machine.md')
    assert.match(t, /not set a term|have not answered|undecided|not decided/i,
      'tiers/1-one-machine.md no longer states that the rebuild term is undecided. If a human has decided it, record the decision in DECISIONS.md and update this test with the decision number.')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('MAJOR — the migration promises must all describe the same tool', { skip: !haveWeb && 'auros-web not checked out' }, () => {
  // PUBLISHED: three different promises about what happens on a hash mismatch, on the most
  // dangerous operation this company performs. migration/20-files.md and copy.ts said "any mismatch
  // aborts and changes nothing"; the landing page and auros-installer/SAFETY.md phase 5 said a
  // mismatch is retried once and then listed. A reader could quote whichever one they read.

  test('no surface promises that any single mismatch aborts the whole run', () => {
    forbidEverywhere(/(?:any|a single|one)[^.\n]{0,40}mismatch[^.\n]{0,40}(?:aborts?|stops?)[^.\n]{0,40}(?:everything|the whole|and changes nothing)|if a single file disagrees, it stops/i,
      'SAFETY.md phase 5 retries a mismatch once and then quarantines and lists it; nothing is written until the list is empty. Promising the stronger guarantee is promising safety behaviour the installer does not have.',
      /sounds safer and is the one that fails|we are specific about this|gets worked around/i)
  })

  test('the surfaces that describe the mismatch path describe the real one', () => {
    for (const f of ['migration/20-files.md', 'copy.ts', 'pages/1-landing.mdx']) {
      const t = read(CONTENT, f)
      assert.match(t, /retried once|copied again, once|re-copied once/i, `${f} no longer describes the retry`)
      assert.match(t, /list is empty|until that list/i, `${f} no longer states that nothing is written until the list is empty`)
    }
  })

  test('SAFETY.md and the site agree that the Windows program does not write boot media (D13)', { skip: !haveInstaller && 'auros-installer not checked out' }, () => {
    const safety = read(INSTALLER, 'SAFETY.md')
    const arm = safety.slice(safety.indexOf('### 6 — ARM'), safety.indexOf('### 7 —'))
    assert.doesNotMatch(arm, /^\s*\d+\.\s*Write the boot medium/im,
      'SAFETY.md phase 6 lists writing the boot medium as a step, while migration/20-files.md tells the customer the Windows program does not write their USB stick. D13 removed it from the product; the contract the code is written against must not put it back.')
    assert.match(read(CONTENT, 'migration/20-files.md'), /does not write your USB stick/i)
  })

  test('the one-line verdict on files does not claim all of them', () => {
    const t = read(CONTENT, 'migration/20-files.md')
    const oneLine = t.match(/^oneLine:\s*(.+)$/m)[1]
    assert.doesNotMatch(oneLine, /^All of them/i,
      'Contradicted twice in this repository: the same file says open files are listed and not copied, and SAFETY.md phase 1 makes leaving cloud-only files in the cloud an honest, offered choice. The one-line verdict is what a skimmer takes away.')
    assert.match(oneLine, /open|cloud/i, 'the verdict no longer names the exceptions it has')
  })

  test('cloud-only files appear in the inventory at all', () => {
    const t = read(CONTENT, 'migration/20-files.md')
    assert.match(t, /OneDrive/i, 'OneDrive placeholders are a first-class case in SAFETY.md phase 1 and were absent from the site except as an aside about files changing during a copy.')
  })

  test('firmware and disk encryption are disclosed above the fold, not in the FAQ', () => {
    const files = readdirSync(join(CONTENT, 'migration'))
    const bit = files.map((f) => [f, readFileSync(join(CONTENT, 'migration', f), 'utf8')]).find(([, t]) => /BitLocker/i.test(t))
    assert.ok(bit, 'No migration entry mentions BitLocker. SAFETY.md phase 6 calls stranding a user at a recovery prompt the worst outcome this tool can produce, and mitigates it unconditionally on exactly the 2012–2015 cohort we sell to. A reader searching the site for BitLocker found nothing.')
    const [name, text] = bit
    assert.match(text, /^onLanding:\s*true$/m, `${name} is not on the landing column. This is the month-two discovery the site exists to prevent, so it does not belong in the FAQ.`)
    assert.match(text, /TPM 1\.2/i, `${name} does not name the TPM 1.2 recovery-prompt risk`)
    assert.match(text, /Secure Boot/i, `${name} does not cover Secure Boot's third-party CA`)
    assert.match(text, /boot (?:order|menu)|BootNext/i, `${name} does not cover one-time boot not being honoured`)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('MAJOR — claims of experience we do not have', { skip: !haveWeb && 'auros-web not checked out' }, () => {
  // PUBLISHED in three places: "our own notes from machines we have built" (no machine has been
  // built; hardware/compat.tsv is a header row), "We will say which of yours we tested and what
  // happened", and an offer to check assistive software "against the compatibility layer first".
  // The first is implied social proof under SPEC §4.4. The other two commit us to a per-customer
  // testing service that CLAIMS.md §11 records as an undecided §9 item.

  test('no copy implies machines built, customers served, or programs tested', () => {
    forbidEverywhere(/machines we(?:'ve| have) built|which of yours we tested|in our (?:experience|testing)|schools we(?:'ve| have) (?:worked|migrated)/i,
      'SPEC §4.4. No image has booted on a physical machine and hardware/compat.tsv has one line, its header.')
  })

  test('the compatibility offer is a lookup, and says so', () => {
    const t = read(CONTENT, 'migration/07-exe-compatibility-layer.md')
    assert.match(t, /have not (?:run|put|tested)|no results of our own/i,
      'migration/07 no longer states that we have tested nothing. D16 decided a hand lookup in the public database; a testing offer is a separate §9 decision that has not been taken.')
  })

  test('compat.tsv is still empty, which is what makes the above load-bearing', () => {
    const rows = read(META, 'hardware/compat.tsv').trim().split('\n')
    if (rows.length > 1) {
      // Not a failure — it is the good outcome. But the copy above is now allowed to change, and
      // somebody should decide how, rather than discovering it.
      console.log(`  note: hardware/compat.tsv now has ${rows.length - 1} row(s). The "we have tested nothing" wording can be revisited — deliberately, with a CLAIMS.md row.`)
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('MAJOR — comparative claims about things we have not measured', { skip: !haveWeb && 'auros-web not checked out' }, () => {
  test('no absolute claim about every competitor', () => {
    // PUBLISHED on the landing page: "Nobody else selling you a computer shows you what they took
    // out." An absolute claim about a market we have surveyed none of, with no CLAIMS.md row.
    forbidEverywhere(/nobody else|no ?one else|no other (?:vendor|company|supplier)|unlike (?:everyone|every other)/i,
      'Comparative advertising about vendors we have not surveyed. Say what the build does; leave the comparison to the reader.')
  })

  test('lockdown is not claimed to be stronger than Group Policy', () => {
    // PUBLISHED in migration/04: "stronger than Group Policy because it is compiled into the image".
    // False in scope even if the tamper-resistance argument holds — the same file lists four Group
    // Policy capabilities that go away entirely.
    forbidEverywhere(/(?:stronger|better|safer|more secure)\s+than\s+Group Policy/i,
      'An unevidenced comparative security claim, resting on MATRIX check S9 which has never run.')
    const t = read(CONTENT, 'migration/04-active-directory.md')
    assert.match(t, /does not replace/i, 'migration/04 no longer says what the lockdown does NOT replace, which is the half that makes the claim honest.')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('MAJOR — gaps the reader would otherwise find at day one', { skip: !haveWeb && 'auros-web not checked out' }, () => {
  test('the site says who makes the bootable media, or says that it is undecided', () => {
    // D13 removed boot-media writing from the Windows tool. Every tier excludes hardware and USB
    // sticks, so by elimination the customer produces the ISO — and the only documented route needs
    // podman and a command line, which D4's zero-terminal directive says cannot back a promise.
    const pricing = read(CONTENT, 'pages/3-pricing.mdx')
    const files = read(CONTENT, 'migration/20-files.md')
    for (const [name, t] of [['pages/3-pricing.mdx', pricing], ['migration/20-files.md', files]]) {
      assert.match(t, /(installation media|bootable|USB stick|the stick)/i, `${name} does not mention the media at all`)
      assert.match(t, /not (?:been )?(?:decided|settled)|open question|not settled/i,
        `${name} no longer states that who produces the installation media is undecided. If a human has decided it, that is a §9 decision — record it in DECISIONS.md and update this test with the number.`)
    }
  })

  test('the replaceability page discloses that the pinned upstream image is garbage-collected', () => {
    // D21: ublue-os/aurora deletes images older than 90 days. auros-base/Containerfile still pins
    // upstream rather than our mirror, so a forked recipe left alone fails with manifest-unknown —
    // the exact scenario the page tells the reader they are protected from.
    for (const f of ['pages/5-replaceable-on-purpose.mdx', 'layers/5-bedrock.md']) {
      const t = read(CONTENT, f)
      assert.match(t, /delete[sd]? old|deletes old images|no longer exists|removed/i, `${f} does not disclose that the pinned upstream image is deleted upstream`)
      assert.match(t, /three months|90 days/i, `${f} does not say roughly how long the pin lasts`)
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('MINOR — numbers with no source', { skip: !haveWeb && 'auros-web not checked out' }, () => {
  test('the invented 40 GB disk figure is gone', () => {
    forbidEverywhere(/\b40\s?GB\b/i,
      'CLAIMS.md said so in terms: the figure is an estimate and UNEVIDENCED. D26 measured the image at 8.4 GB and found bib needed an explicit 20 GiB root, so the real working set of a build is unknown and plausibly larger. On the replaceability page, a reader who runs out of disk concludes the instructions were written from imagination.')
  })

  test('no bare duration estimates', () => {
    forbidEverywhere(/\b(?:takes?|budget|in|about|roughly|only|just)\s+(?:an?\s+)?(?:\d+|one|two|three|ten|fifteen|thirty|sixty|a few)[- ]?(?:second|minute|hour|afternoon)s?\b/i,
      'Three were published with no measurement behind any of them. "A thirty-second job" is the dangerous one: it is per-machine physical work across a fleet the tiers exclude from the price, so at 180 machines it is a day of walking.')
  })

  test('the hero price line and the comparison arithmetic both carry the 25-device minimum', () => {
    const copy = read(CONTENT, 'copy.ts')
    const hero = copy.match(/priceNoteMono:\s*"([^"]+)"/)[1]
    assert.match(hero, /25/, `The hero is where the price is anchored. Published: "${hero}" — a 12-laptop nonprofit computes $180 against a real floor of 25 × $15 = $375.`)
    const formula = copy.match(/formulaMono:\s*"([^"]+)"/)[1]
    assert.match(formula, /max\(A, ?25\)|25/, `The comparison formula omits the minimum: "${formula}"`)
  })

  test('a ranked frequency claim carries the fact that it is unmeasured', () => {
    const t = read(CONTENT, 'faq/6-machine-wont-boot.md')
    assert.doesNotMatch(t, /the most common cause/i,
      'hardware/compat.tsv has one line, its header, and no image has booted on a physical machine. There is nothing to rank.')
    if (/most often|most common|most likely/i.test(t)) {
      assert.match(t, /not (?:yet )?measured|we expect/i, 'a frequency claim survives without the qualification that we have not measured it')
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('the gates that mechanise all of the above still fail closed', () => {
  test('honesty-gate reports a clean scan of the site', { skip: !haveWeb && 'auros-web not checked out' }, () => {
    execFileSync(process.execPath, [join(META, 'tools/honesty-gate.mjs'), join(WEB, 'src')], { stdio: 'pipe' })
  })

  test('honesty-gate refuses to report a pass on an empty scan', () => {
    // D19: a step that cannot fail is not a check. If this ever starts exiting 0, every clean run
    // above becomes meaningless, and the failure would be invisible.
    assert.throws(() => execFileSync(process.execPath, [join(META, 'tools/honesty-gate.mjs')], { stdio: 'pipe' }))
  })

  test('honesty-gate catches each claim class the 2026-09-20 audit found it blind to', () => {
    const { mkdtempSync, writeFileSync, rmSync } = require$fs()
    const dir = mkdtempSync(join(require$os().tmpdir(), 'auros-gate-'))
    try {
      const cases = [
        ['competitor.md', 'Nobody else selling you a computer shows you what they took out.'],
        ['superiority.md', 'Our lockdown is stronger than Group Policy because it is compiled in.'],
        ['frequency.md', 'The most common cause on this generation of hardware is Secure Boot.'],
        ['record.md', 'We checked it against our own notes from machines we have built.'],
        ['time.md', 'Changing the setting is a thirty-second job once you know which one it is.'],
        ['perpetual.md', 'Nightly rebuilds of the base it stands on, for as long as we are here.'],
      ]
      for (const [name, text] of cases) {
        writeFileSync(join(dir, name), text)
        assert.throws(
          () => execFileSync(process.execPath, [join(META, 'tools/honesty-gate.mjs'), dir], { stdio: 'pipe' }),
          `honesty-gate accepted "${text}" — this is one of the sentences that was actually published while the gate reported a clean pass.`,
        )
        rmSync(join(dir, name))
      }
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})

// node:test files are ESM here; these two are the only CommonJS-shaped needs and importing them at
// the top would run them for every skipped suite.
function require$fs () { return fsMod }
function require$os () { return osMod }
import * as fsMod from 'node:fs'
import * as osMod from 'node:os'
