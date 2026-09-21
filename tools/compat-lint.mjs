#!/usr/bin/env node
// compat.tsv is only worth anything if every row is true. This enforces the one rule that keeps it
// true (hardware/README.md): a `vm` row may not claim a physical-only column.
//
// A QEMU profile has no real wifi chipset, trackpad, backlight or webcam. Filling those columns from a
// VM run would manufacture exactly the unearned confidence spec §4 exists to prevent — and we would
// then quote a real school from it. Empty means "we did not test this", which is the truth.
import { readFileSync } from 'node:fs'

const PHYSICAL_ONLY = ['wifi', 'trackpad', 'suspend', 'brightness', 'webcam']
const PATH = 'hardware/compat.tsv'

// ── the `ids` column, added when auros-base/tools/capture-compat.sh gave it somewhere to go ──────
// GATE5-RUNBOOK step 1 and the driver-triage skill both say the same thing: "Intel Wireless" is not
// a model, and a row that records a marketing name is a row we cannot match against the next
// machine — which is the entire point of building this file. Until this column existed the runbook
// demanded numeric IDs and the schema had nowhere to put them, so they were being dropped.
//
// Format: role=bus:vvvv:dddd, several roles separated by ';', several devices in one role by ','.
//   wifi=pci:8086:08b1;gpu=pci:8086:0a16;webcam=usb:04f2:b39a
// The point of the pattern is that a MARKETING NAME CANNOT SATISFY IT. "wifi=Intel Wireless-AC 7260"
// is rejected here rather than discovered in four years when it matches nothing.
const ONE_ID = '(pci|usb):[0-9a-f]{4}:[0-9a-f]{4}'
const IDS_ENTRY = new RegExp(`^[a-z][a-z0-9_]*=${ONE_ID}(,${ONE_ID})*$`)
// A TPM either is not there, or is one of exactly two generations. Anything else is a string
// somebody typed. `2` and `1.2.0` and `TPM 2.0` all mean the same thing to a human and none of them
// sort, filter or compare, so they are refused at the door.
const TPM_VALUES = ['', 'none', '1.2', '2.0']

let text
try { text = readFileSync(PATH, 'utf8') } catch (e) {
  console.error(`compat-lint: cannot read ${PATH}: ${e.message} — failing closed`); process.exit(2)
}
const lines = text.split('\n').filter(l => l.trim() !== '')
if (lines.length === 0) { console.error('compat-lint: file is empty, not even a header — failing closed'); process.exit(2) }

// Trimmed, so a CRLF file's CR does not land on the header's last column. That was harmless while
// the last column (`tester`) was not required; it is required now (provenance, below), and an
// untrimmed header would refuse every CRLF file as "missing required column tester" — a true
// refusal of a file that is fine. quote-from-compat.mjs has always trimmed its header.
const header = lines[0].split('\t').map(h => h.trim())
for (const required of ['model', 'year', 'source', 'verdict', 'ids', 'tpm', 'tester', 'tested_on', ...PHYSICAL_ONLY]) {
  if (!header.includes(required)) { console.error(`compat-lint: header is missing required column "${required}"`); process.exit(2) }
}
const idx = Object.fromEntries(header.map((h, i) => [h, i]))
const rows = lines.slice(1)

const problems = []
rows.forEach((raw, n) => {
  const c = raw.split('\t')
  const lineNo = n + 2
  const source = (c[idx.source] ?? '').trim()
  if (!['vm', 'physical'].includes(source)) {
    problems.push(`${PATH}:${lineNo}  source is "${source}" — must be exactly "vm" or "physical". An unlabelled row cannot be trusted or filtered.`)
    return
  }
  if (source === 'vm') {
    for (const col of PHYSICAL_ONLY) {
      const v = (c[idx[col]] ?? '').trim()
      if (v !== '') problems.push(`${PATH}:${lineNo}  vm row claims ${col}="${v}". A QEMU profile cannot observe ${col}. Leave it empty — empty is the honest value.`)
    }
  }
  // ── ids ──────────────────────────────────────────────────────────────────────────────────────
  const ids = (c[idx.ids] ?? '').trim()
  if (source === 'physical' && ids === '') {
    problems.push(`${PATH}:${lineNo}  a physical row with an empty ids column. Record the numeric PCI/USB IDs ` +
      '(auros-base/tools/capture-compat.sh reads them out of sysfs). A row we cannot match against the next ' +
      'machine is not the asset spec §8 describes; it is an anecdote.')
  }
  if (ids !== '') {
    for (const entry of ids.split(';')) {
      if (!IDS_ENTRY.test(entry)) {
        problems.push(`${PATH}:${lineNo}  ids entry "${entry}" is not role=bus:vvvv:dddd with lowercase hex ` +
          '(e.g. wifi=pci:8086:08b1, webcam=usb:04f2:b39a, two cards as role=a,b). A marketing name matches ' +
          'nothing four years from now, which is when this file has to earn its keep.')
      }
    }
  }

  // ── provenance: whose observation, and when ──────────────────────────────────────────────────
  // A physical row with seven `ok`s and nobody's name on it passed this file as "all honest", and
  // auros-base/tools/quote-from-compat.mjs then said, in full, "We have imaged this model and every
  // one of wifi, trackpad, suspend, brightness, gpu, audio, webcam worked" — over an evidence line
  // reading "tested (no date) by (no tester)". The strongest sentence either tool can say needed no
  // human's name and no date. An unsigned, undated row is an anecdote, the word the ids rule above
  // already uses for a row we cannot match.
  //
  // vm rows are exempt on purpose: a vm row is never quoted from, and CI writes them.
  if (source === 'physical') {
    const tester = (c[idx.tester] ?? '').trim()
    const testedOn = (c[idx.tested_on] ?? '').trim()
    if (tester === '') {
      problems.push(`${PATH}:${lineNo}  a physical row with an empty tester. Somebody shut the lid and pressed the ` +
        'brightness key; this column is who, so the next person can ask them. A row nobody signed is an anecdote.')
    }
    if (testedOn === '') {
      problems.push(`${PATH}:${lineNo}  a physical row with an empty tested_on. A driver that worked on one kernel ` +
        'can break on the next, so an observation with no date cannot be weighed against a newer one.')
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(testedOn) || !Number.isFinite(Date.parse(`${testedOn}T00:00:00Z`))) {
      problems.push(`${PATH}:${lineNo}  tested_on="${testedOn}" is not a YYYY-MM-DD date. ` +
        'auros-base/tools/capture-compat.sh writes `date +%F`; anything else is a string somebody typed, and it does not sort.')
    }
  }

  // ── tpm ──────────────────────────────────────────────────────────────────────────────────────
  const tpm = (c[idx.tpm] ?? '').trim()
  if (!TPM_VALUES.includes(tpm)) {
    problems.push(`${PATH}:${lineNo}  tpm="${tpm}" — must be one of ${TPM_VALUES.filter(Boolean).join(', ')}, ` +
      'or empty for "a TPM is present but we could not read its version". ' +
      'GATE5-RUNBOOK defers BitLocker-on-TPM-1.2 to physical machines, and that check is selected by this column.')
  }

  if ((c[idx.verdict] ?? '').trim() === 'unsupported' && source === 'vm') {
    problems.push(`${PATH}:${lineNo}  a vm row may not declare a model unsupported. That is a §9 decision reserved for a human, made on physical evidence.`)
  }
})

if (problems.length) {
  console.error(`\ncompat-lint: ${problems.length} problem(s)\n`)
  for (const p of problems) console.error('  ' + p)
  console.error('')
  process.exit(1)
}
// The per-row checks above read `source` TRIMMED, so the summary has to as well. It did not, and a
// row whose source field carried a trailing space was counted as neither vm nor physical — printing
// "1 row(s), all honest. (0 physical, 0 vm)". The summary line is the only thing anybody reads when
// this is green, so a summary that does not add up is the one place a quiet inconsistency survives.
const sourceOf = (r) => (r.split('\t')[idx.source] ?? '').trim()
const nPhysical = rows.filter(r => sourceOf(r) === 'physical').length
const nVm = rows.filter(r => sourceOf(r) === 'vm').length
if (nPhysical + nVm !== rows.length) {
  console.error(`compat-lint: internal inconsistency — ${rows.length} row(s) but ${nPhysical} physical + ${nVm} vm. Failing closed rather than printing a summary that does not add up.`)
  process.exit(2)
}
console.log(`compat-lint: ${rows.length} row(s), all honest. (${nPhysical} physical, ${nVm} vm)`)
