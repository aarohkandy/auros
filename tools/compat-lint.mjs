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

let text
try { text = readFileSync(PATH, 'utf8') } catch (e) {
  console.error(`compat-lint: cannot read ${PATH}: ${e.message} — failing closed`); process.exit(2)
}
const lines = text.split('\n').filter(l => l.trim() !== '')
if (lines.length === 0) { console.error('compat-lint: file is empty, not even a header — failing closed'); process.exit(2) }

const header = lines[0].split('\t')
for (const required of ['model', 'year', 'source', 'verdict', ...PHYSICAL_ONLY]) {
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
console.log(`compat-lint: ${rows.length} row(s), all honest. (${rows.filter(r => r.split('\t')[idx.source] === 'physical').length} physical, ${rows.filter(r => r.split('\t')[idx.source] === 'vm').length} vm)`)
