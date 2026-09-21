#!/usr/bin/env node --test
// compat-lint — the honesty rule for hardware/compat.tsv, tested in both directions.
//
//   node --test tools/compat-lint.test.mjs
//
// WHAT THIS FILE IS DEFENDING. compat.tsv is the one asset in this company that compounds: after
// fifty rows it is the thing a competitor cannot copy quickly, and before then it is how we quote a
// school without guessing. Its value is entirely a function of every row being true. One `vm` row
// with a wifi verdict invented from a QEMU profile turns the table from evidence into a spreadsheet,
// and we would then quote a real school from it.
//
// compat-lint takes no arguments and reads `hardware/compat.tsv` relative to the working directory —
// deliberately, so there is no way to point it at a friendlier file. Every test here therefore runs
// the real program as a real process with `cwd` set to a fixture tree. Choosing which tree the
// process starts in is not the same as overriding a verdict: the same bytes always decide the same.
//
// EVERY ASSERTION HERE IS PAIRED. A test that asserts a rejection is followed by, or contains, the
// same fixture with the one defect removed, asserting acceptance. Without the pair, a lint that
// rejected every file on earth would satisfy the whole suite.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..')
const LINT = join(HERE, 'compat-lint.mjs')

// The header is read from the real file rather than copied, so a column added to compat.tsv without
// a thought for this lint shows up here as a failure instead of as a silently divergent fixture.
const REAL = readFileSync(join(REPO, 'hardware', 'compat.tsv'), 'utf8')
const HEADER = REAL.split('\n')[0]
const COLS = HEADER.split('\t')
const PHYSICAL_ONLY = ['wifi', 'trackpad', 'suspend', 'brightness', 'webcam']

let ROOT
const root = () => (ROOT ??= mkdtempSync(join(tmpdir(), 'auros-compat-')))
let seq = 0

/** @returns {{exit:number, out:string}} the real lint, run in a tree whose only content is `text`. */
function lint (text, { omitFile = false } = {}) {
  const dir = join(root(), `t-${seq++}`)
  mkdirSync(join(dir, 'hardware'), { recursive: true })
  if (!omitFile) writeFileSync(join(dir, 'hardware', 'compat.tsv'), text)
  try {
    const out = execFileSync(process.execPath, [LINT], { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
    return { exit: 0, out }
  } catch (e) {
    return { exit: e.status ?? -1, out: String(e.stdout ?? '') + String(e.stderr ?? '') }
  }
}

/** Build one row from a field map. Anything unnamed is empty, which is the honest default. */
function row (fields = {}) {
  return COLS.map((c) => fields[c] ?? '').join('\t')
}
const file = (...rows) => `${HEADER}\n${rows.join('\n')}\n`

/** A physical row may claim anything; it is the control that proves the lint is not simply strict. */
const PHYSICAL_FULL = row({
  model: 'ThinkPad-T440s', year: '2014', source: 'physical', cpu: 'i5-4300U', ram_gb: '8',
  firmware: 'uefi', ids: 'wifi=pci:8086:08b1;gpu=pci:8086:0a16;webcam=usb:04f2:b39a', tpm: '1.2',
  wifi: 'ok', trackpad: 'ok', suspend: 'ok', brightness: 'ok', gpu: 'ok',
  audio: 'ok', webcam: 'ok', verdict: 'supported', notes: '-', tested_on: '2026-09-21', tester: 'aaroh',
})
/** A vm row with every physical column left empty. Empty is the truth: we did not observe them. */
const VM_HONEST = row({
  model: 'qemu-uefi-modern', year: '-', source: 'vm', cpu: 'host', ram_gb: '4',
  firmware: 'uefi', gpu: 'virtio', audio: 'none', verdict: 'boots', notes: 'profile uefi-modern',
  tested_on: '2026-09-21', tester: 'ci',
})

const rejects = (res, why) => {
  assert.notEqual(res.exit, 0, `expected a REJECTION (${why}) but compat-lint exited 0:\n${res.out}`)
  return res
}
const accepts = (res, why) =>
  (assert.equal(res.exit, 0, `expected ACCEPTANCE (${why}) but compat-lint exited ${res.exit}:\n${res.out}`), res)

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('the controls — without these, every rejection below could come from a lint that says no to everything', () => {
  test('ACCEPTS a physical row that claims every physical-only column', () => {
    const r = accepts(lint(file(PHYSICAL_FULL)), 'a physical row may claim what a physical machine can show')
    assert.match(r.out, /1 physical/)
  })

  test('ACCEPTS a vm row that leaves every physical-only column empty', () => {
    const r = accepts(lint(file(VM_HONEST)), 'empty is the honest value for something a VM cannot observe')
    assert.match(r.out, /1 vm/)
  })

  test('ACCEPTS a header-only file — zero rows is a true state, not a broken one', () => {
    // This is the repository's ACTUAL state (B5: the laptops are not here yet). A lint that treated
    // "no evidence" as "a problem" would push somebody to invent a row to make it quiet.
    const r = accepts(lint(`${HEADER}\n`), 'no rows yet')
    assert.match(r.out, /0 row/)
  })

  test('ACCEPTS a mixed file of honest vm and physical rows', () => {
    accepts(lint(file(PHYSICAL_FULL, VM_HONEST)), 'both kinds, both honest')
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('a vm row may not claim a physical-only column — one column at a time', () => {
  // Exhaustive rather than representative. The rule is a five-element loop in the lint; a refactor
  // that dropped one element from the list would leave four tests green and one column unguarded,
  // and the unguarded column is the one that ends up in a quote.
  for (const col of PHYSICAL_ONLY) {
    test(`REJECTS a vm row claiming ${col}`, () => {
      // Control first, in the same test, so the rejection is attributable to this column alone.
      accepts(lint(file(VM_HONEST)), `control for ${col}`)

      const claimed = row({
        model: 'qemu-uefi-modern', year: '-', source: 'vm', cpu: 'host', ram_gb: '4',
        firmware: 'uefi', gpu: 'virtio', audio: 'none', verdict: 'boots',
        tested_on: '2026-09-21', tester: 'ci', [col]: 'ok',
      })
      const r = rejects(lint(file(claimed)), `vm row claiming ${col}`)
      assert.equal(r.exit, 1, 'a dishonest row is a finding (exit 1), not a crash (exit 2)')
      assert.match(r.out, new RegExp(`vm row claims ${col}`),
        `the message must name the column, or the person fixing it guesses. Got:\n${r.out}`)
      assert.match(r.out, /empty is the honest value/i,
        'the message must say what to do instead, or somebody deletes the row rather than the claim')
    })
  }

  test('REJECTS a vm row claiming ALL FIVE at once, and reports all five', () => {
    const greedy = row({
      model: 'qemu-uefi-modern', source: 'vm', verdict: 'boots',
      wifi: 'ok', trackpad: 'ok', suspend: 'ok', brightness: 'ok', webcam: 'ok',
    })
    const r = rejects(lint(file(greedy)), 'a vm row claiming everything')
    for (const col of PHYSICAL_ONLY) {
      assert.match(r.out, new RegExp(`vm row claims ${col}`), `${col} was not reported`)
    }
    assert.match(r.out, /5 problem/, 'it must report all five, not stop at the first')
  })

  test('REJECTS a vm row whose physical claim is the single character "-"', () => {
    // "-" looks like "not applicable" and is not empty. The lint compares against empty, so this is
    // a claim. Asserting it here makes the convention explicit rather than folklore.
    rejects(lint(file(row({ model: 'qemu', source: 'vm', verdict: 'boots', wifi: '-' }))), 'a dash is not empty')
  })

  test('a vm row MAY claim the columns a VM can genuinely observe', () => {
    // gpu, audio, cpu, ram_gb, firmware are not on the physical-only list, and a lint that rejected
    // them would make the vm rows useless and push people to stop writing them.
    accepts(lint(file(row({
      model: 'qemu-low-ram', source: 'vm', cpu: 'host', ram_gb: '2', firmware: 'bios',
      gpu: 'virtio', audio: 'none', verdict: 'boots', tested_on: '2026-09-21', tester: 'ci',
    }))), 'a vm row claiming only what QEMU can show')
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('unsupported is a §9 decision, and a VM may not make it', () => {
  test('REJECTS a vm row declaring a model unsupported', () => {
    const r = rejects(lint(file(row({ model: 'qemu-old-cpu', source: 'vm', verdict: 'unsupported' }))),
      'a vm row calling a model unsupported')
    assert.match(r.out, /§9|reserved for a human/i,
      'the message must say WHY this is refused — it is not a data-quality rule, it is a decision boundary')
  })

  test('ACCEPTS a PHYSICAL row declaring a model unsupported — the control for the rule above', () => {
    accepts(lint(file(row({
      model: 'Latitude-E6420', year: '2011', source: 'physical', verdict: 'unsupported',
      ids: 'wifi=pci:8086:0085', tpm: 'none',
      notes: '32 GB eMMC, below the 20 GiB root + two deployments floor (D26)',
      tested_on: '2026-09-21', tester: 'aaroh',
    }))), 'a human on a real machine may declare a model unsupported')
  })

  test('a vm row may carry any OTHER verdict', () => {
    for (const v of ['boots', 'partial', 'ok', 'fails']) {
      accepts(lint(file(row({ model: 'qemu', source: 'vm', verdict: v }))), `verdict=${v} on a vm row`)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('the source column is what makes every other rule enforceable', () => {
  test('REJECTS a row whose source is neither vm nor physical', () => {
    for (const bad of ['VM', 'Physical', 'qemu', 'hardware', 'real', 'unknown', '']) {
      const r = rejects(lint(file(row({ model: 'x', source: bad, verdict: 'ok' }))), `source="${bad}"`)
      assert.match(r.out, /must be exactly "vm" or "physical"/,
        `source="${bad}" was rejected, but not for the reason a reader needs. Got:\n${r.out}`)
    }
  })

  test('a PADDED source is trimmed, applied, AND counted — the summary has to add up', () => {
    // Padding is tolerated on purpose: compat.tsv is typed by a human with a laptop open in front of
    // them, and being strict about an invisible space costs more than it buys. But the per-row rules
    // read the TRIMMED value while the summary line read the raw one, so `source="vm "` was linted
    // as a vm row and then counted as neither — printing "1 row(s), all honest. (0 physical, 0 vm)".
    // The summary is the only line anybody reads when this is green, so it has to add up. Fixed
    // 2026-09-20; compat-lint now fails closed if the counts do not reconcile with the row count.
    for (const padded of ['vm ', ' vm', 'physical ', ' physical']) {
      const kind = padded.trim()
      // ids is required on a physical row (see the ids suite below), so the fixture carries one;
      // a vm row is allowed to have none. This loop is about the source column, not about ids.
      // …and a tester and a date, which a physical row needs too (provenance suite below).
      const r = accepts(lint(file(row({ model: 'x', source: padded, verdict: 'ok', ids: 'wifi=pci:8086:08b1', tested_on: '2026-09-21', tester: 'aaroh' }))), `source="${padded}"`)
      assert.match(r.out, new RegExp(`1 ${kind}`),
        `source="${padded}" was accepted but counted as something else:\n${r.out}`)
    }
  })

  test('a padded vm source still gets the physical-column rules applied to it', () => {
    // Tolerance must not become a bypass: `source="vm "` is still a vm row.
    rejects(lint(file(row({ model: 'x', source: 'vm ', verdict: 'ok', wifi: 'ok' }))),
      'a padded vm source smuggling a wifi claim')
  })

  test('the case-sensitivity above is deliberate — "VM" is rejected, "vm" is accepted', () => {
    // Stated as its own test because "it should probably be case-insensitive" is a change somebody
    // will propose, and this is where the argument gets had rather than quietly applied.
    rejects(lint(file(row({ model: 'x', source: 'VM', verdict: 'ok' }))), 'uppercase VM')
    accepts(lint(file(row({ model: 'x', source: 'vm', verdict: 'ok' }))), 'lowercase vm')
  })

  test('an unlabelled row does NOT get its physical columns checked, and is rejected outright', () => {
    // The dangerous shape: source garbage AND a wifi claim. The lint must not "skip to the next row"
    // in a way that lets the claim through — it rejects the row, so the claim never counts.
    const r = rejects(lint(file(row({ model: 'x', source: '?', verdict: 'ok', wifi: 'ok' }))), 'unlabelled row with a claim')
    assert.match(r.out, /cannot be trusted or filtered/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('malformed files fail CLOSED — exit 2, never a quiet pass', () => {
  test('REFUSES a completely empty file', () => {
    const r = lint('')
    assert.equal(r.exit, 2, `an empty compat.tsv exited ${r.exit}; it must fail closed`)
    assert.match(r.out, /not even a header/)
  })

  test('REFUSES a file of only whitespace', () => {
    assert.equal(lint('\n\n   \n').exit, 2)
  })

  test('REFUSES an absent file', () => {
    const r = lint('', { omitFile: true })
    assert.equal(r.exit, 2, 'a missing compat.tsv must fail closed, not report zero honest rows')
    assert.match(r.out, /failing closed/)
  })

  test('REFUSES a file missing a required column, one column at a time', () => {
    for (const drop of ['model', 'year', 'source', 'verdict', 'ids', 'tpm', ...PHYSICAL_ONLY]) {
      const kept = COLS.filter((c) => c !== drop)
      const text = `${kept.join('\t')}\n`
      const r = lint(text)
      assert.equal(r.exit, 2, `dropping "${drop}" from the header exited ${r.exit}; it must fail closed`)
      assert.match(r.out, new RegExp(`missing required column "${drop}"`),
        `the message must name the missing column. Got:\n${r.out}`)
    }
  })

  // ── CRLF: what actually happens, and why it is safe rather than merely untested ────────────────
  // A CR always lands on the LAST field of a line. In this header that field is `tester`, which is
  // now REQUIRED — a physical row must carry a name and a date (provenance suite, below). So the
  // header is trimmed like every row cell already was; without that, every CRLF file would have been
  // refused as "missing required column tester". These assert the property that matters (a line
  // ending cannot smuggle a claim past the lint) and that a CRLF file is still read.
  test('a CRLF file is accepted, and its rows are still checked', () => {
    const r = lint(`${HEADER}\r\n${VM_HONEST}\r\n`)
    assert.equal(r.exit, 0, `a CRLF file with an honest vm row should pass; got exit ${r.exit}:\n${r.out}`)
    assert.match(r.out, /1 vm/, 'the CR must not break the summary count')
  })

  test('a CRLF vm row claiming wifi is STILL caught — a line ending cannot smuggle a claim', () => {
    // This is the assertion the CRLF case exists for. Every field is read with .trim(), so a CR at
    // the end of a line cannot turn a claim into an empty cell or an empty cell into a claim.
    const bad = row({ model: 'qemu', source: 'vm', verdict: 'boots', wifi: 'ok' })
    const r = rejects(lint(`${HEADER}\r\n${bad}\r\n`), 'a CRLF vm row claiming wifi')
    assert.match(r.out, /vm row claims wifi/)
  })

  test('a CRLF header ending in a REQUIRED column is read — and one genuinely missing it is not', () => {
    // This test used to assert the opposite and said why: "Right outcome, confusing message —
    // recorded so that if somebody adds explicit CRLF handling, this says what changed." Explicit
    // CRLF handling was added (the header is trimmed) because `tester` became required and is the
    // last column. So: what changed is that a CRLF header ending in `verdict` is now READ…
    const reordered = [...COLS.filter((c) => c !== 'verdict'), 'verdict'].join('\t')
    const r = lint(`${reordered}\r\n`)
    assert.equal(r.exit, 0, `a CRLF header ending in a required column was refused:\n${r.out}`)
    // …and the red half, so trimming is not a way to make the header check go away: a header that
    // really lacks the column still fails closed, CRLF or not.
    const missing = COLS.filter((c) => c !== 'verdict').join('\t')
    const m = lint(`${missing}\r\n`)
    assert.equal(m.exit, 2, 'a header with no verdict column at all was accepted')
    assert.match(m.out, /missing required column "verdict"/)
  })

  test('REFUSES a row with fewer fields than the header, without crashing', () => {
    const r = lint(`${HEADER}\nqemu\tvm\n`)
    assert.notEqual(r.exit, 0, 'a short row was accepted')
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// `ids` — the column that exists so a row can be MATCHED against the next machine.
//
// GATE5-RUNBOOK step 1 and the driver-triage skill both say "Intel Wireless" is not a model. The
// runbook demanded numeric IDs while the schema had nowhere to put them, so auros-base/tools/
// capture-compat.sh reads them out of sysfs and this is the rule that keeps them numeric.
//
// Each test pairs a rejection with the control that makes it attributable, because a lint that
// rejected everything would pass every rejection test in this file and be useless.
describe('ids must be numeric bus:vendor:device — a marketing name matches nothing in four years', () => {
  const physical = (fields) => file(row({
    model: 'x', year: '2014', source: 'physical', verdict: 'supported',
    tested_on: '2026-09-21', tester: 'aaroh', tpm: 'none', ...fields,
  }))

  test('ACCEPTS the shapes capture-compat.sh actually emits', () => {
    for (const ids of [
      'wifi=pci:8086:08b1',
      'wifi=pci:8086:08b1;gpu=pci:8086:0a16;audio=pci:8086:0a0c;eth=pci:8086:1559;webcam=usb:04f2:b39a',
      'gpu=pci:8086:0a16,pci:10de:0fe4',            // two GPUs, which is an Optimus laptop
      'webcam=usb:04f2:b39a',
    ]) accepts(lint(physical({ ids })), `ids="${ids}"`)
  })

  test('REJECTS a marketing name in the ids column — the whole point of the column', () => {
    for (const ids of [
      'wifi=Intel Wireless-AC 7260',
      'wifi=Intel Centrino Advanced-N 6205',
      'gpu=Intel HD Graphics 4400',
      'wifi=iwlwifi',
      'Intel Wireless',
    ]) {
      const r = rejects(lint(physical({ ids })), `ids="${ids}"`)
      assert.match(r.out, /role=bus:vvvv:dddd/,
        `the message must say what the column wants. Got:\n${r.out}`)
    }
  })

  test('REJECTS malformed numeric ids, one malformation at a time', () => {
    for (const ids of [
      'wifi=8086:08b1',        // no bus
      'wifi=pci:8086',         // no device id
      'wifi=pci:8086:08b1:00', // one field too many
      'wifi=pci:8086:08B1',    // uppercase hex sorts and compares differently from lowercase
      'wifi=pci:806:08b1',     // three hex digits
      'wifi=eisa:8086:08b1',   // a bus we do not read
      'pci:8086:08b1',         // no role
      'wifi=pci:8086:08b1;',   // trailing separator, which yields an empty entry
    ]) rejects(lint(physical({ ids })), `ids="${ids}"`)
  })

  test('REJECTS a physical row with NO ids at all, and ACCEPTS a vm row with none', () => {
    const r = rejects(lint(physical({ ids: '' })), 'a physical row with no ids')
    assert.match(r.out, /empty ids column/)
    // The control. A vm row has no hardware to identify, so requiring ids there would be requiring
    // a fiction — which is the failure mode this entire file exists to prevent.
    accepts(lint(file(row({ model: 'qemu', source: 'vm', verdict: 'boots' }))), 'a vm row needs no ids')
  })
})

describe('tpm is one of exactly two generations, or nothing', () => {
  const physical = (tpm) => file(row({
    model: 'x', year: '2014', source: 'physical', verdict: 'supported',
    ids: 'wifi=pci:8086:08b1', tested_on: '2026-09-21', tester: 'aaroh', tpm,
  }))

  test('ACCEPTS 2.0, 1.2, none, and empty', () => {
    // Empty is not laziness here: capture-compat.sh emits it when /sys/class/tpm/tpm0 exists but
    // neither tpm_version_major nor caps gives a version. "There is one and we could not read it"
    // is a different fact from "there is not one", and the schema has to be able to hold both.
    for (const t of ['2.0', '1.2', 'none', '']) accepts(lint(physical(t)), `tpm="${t}"`)
  })

  test('REJECTS the spellings that mean the same thing to a human and nothing to a sort', () => {
    for (const t of ['2', '1', 'TPM 2.0', 'v2.0', '2.0.1', 'yes', 'present', 'fTPM', '1.2.0']) {
      const r = rejects(lint(physical(t)), `tpm="${t}"`)
      assert.match(r.out, /must be one of/, `Got:\n${r.out}`)
    }
  })

  test('the tpm rule applies to vm rows too — a QEMU profile HAS a declared TPM version', () => {
    accepts(lint(file(row({ model: 'qemu-tpm12', source: 'vm', verdict: 'boots', tpm: '1.2' }))), 'vm tpm=1.2')
    rejects(lint(file(row({ model: 'qemu-tpm12', source: 'vm', verdict: 'boots', tpm: 'swtpm' }))), 'vm tpm=swtpm')
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// PROVENANCE — a physical row carries a person's name and a date, or it is an anecdote.
//
// The attack this answers: a physical row for ThinkPad-T440s with all seven capabilities `ok`,
// verdict `supported`, valid ids, and `tester` and `tested_on` both EMPTY. This lint said
// "1 row(s), all honest." and exited 0; quote-from-compat then said "TESTED · WORKS — We have imaged
// this model and every one of … worked", over an evidence line reading "tested (no date) by (no
// tester)". The strongest sentence either tool can say required no human's name and no date.
describe('a physical row must say who observed it, and when', () => {
  const physical = (fields) => file(row({
    model: 'ThinkPad-T440s', year: '2014', source: 'physical', verdict: 'supported',
    ids: 'wifi=pci:8086:08b1', tpm: '1.2',
    wifi: 'ok', trackpad: 'ok', suspend: 'ok', brightness: 'ok', gpu: 'ok', audio: 'ok', webcam: 'ok',
    tested_on: '2026-09-21', tester: 'aaroh', ...fields,
  }))

  test('the control: a signed, dated physical row is accepted', () => {
    accepts(lint(physical({})), 'a physical row with a tester and a date')
  })

  test('REJECTS the attack exactly as it was run: no tester AND no date', () => {
    const r = rejects(lint(physical({ tester: '', tested_on: '' })), 'an unsigned, undated physical row')
    assert.match(r.out, /empty tester/, `the refusal did not name the missing tester:\n${r.out}`)
    assert.match(r.out, /empty tested_on/, `the refusal did not name the missing date:\n${r.out}`)
  })

  test('REJECTS each half on its own — neither is a substitute for the other', () => {
    assert.match(rejects(lint(physical({ tester: '' })), 'no tester').out, /empty tester/)
    assert.match(rejects(lint(physical({ tested_on: '' })), 'no date').out, /empty tested_on/)
  })

  test('REJECTS whitespace, which is empty wearing a costume', () => {
    rejects(lint(physical({ tester: '   ' })), 'a tester of only spaces')
  })

  test('REJECTS a tested_on that is not a date', () => {
    for (const d of ['last week', '2026', '21/09/2026', '2026-9-21', 'yesterday']) {
      const r = rejects(lint(physical({ tested_on: d })), `tested_on="${d}"`)
      assert.match(r.out, /not a YYYY-MM-DD date/, `Got:\n${r.out}`)
    }
  })

  test('a vm row needs neither — it is never quoted from, and CI writes them', () => {
    // The control on the other side: requiring a human signature on a CI-written vm row would make
    // every vm row a lie about who ran it.
    accepts(lint(file(row({ model: 'qemu', source: 'vm', verdict: 'boots' }))), 'an unsigned vm row')
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('the file as it actually stands in this repository', () => {
  test('the real hardware/compat.tsv passes the real lint', () => {
    const out = execFileSync(process.execPath, [LINT], { cwd: REPO, encoding: 'utf8' })
    assert.match(out, /all honest/)
  })

  test('the real compat.tsv has ZERO physical rows, because no laptop has been touched', () => {
    // BLOCKED.md B5 and GATE.md both say no physical machine exists yet. If this ever goes red
    // without a Gate 5 run behind it, a row was written from a VM or from imagination, and the one
    // asset in this company that compounds has been poisoned at row one.
    const rows = REAL.split('\n').slice(1).filter((l) => l.trim() !== '')
    const idx = COLS.indexOf('source')
    const physical = rows.filter((r) => r.split('\t')[idx] === 'physical')
    assert.equal(physical.length, 0,
      `hardware/compat.tsv claims ${physical.length} physical row(s). No laptop has been imaged ` +
      '(BLOCKED.md B5), so every one of them is fabricated evidence:\n' + physical.join('\n'))
  })
})

test.after(() => { if (ROOT) rmSync(ROOT, { recursive: true, force: true }) })
