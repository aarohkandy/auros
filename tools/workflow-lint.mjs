#!/usr/bin/env node
// Catch the GitHub Actions YAML mistakes whose symptom is silence.
//
// The one that cost us: `with: { name: x-${{ matrix.f }}, path: ... }`. Inside a YAML FLOW MAPPING the
// braces of `${{ }}` are structural, so the document is invalid, so GitHub rejects the whole workflow.
// The symptom is not an error message — it is a run that appears named by its FILE PATH instead of its
// `name:`, with no jobs and no log. Easy to stare past.
//
// Also checks that every workflow sets pipefail (D19), after a pipe through `tail` made a failing
// build score as a passing step.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const roots = process.argv.slice(2)
if (!roots.length) { console.error('workflow-lint: no roots given — refusing to report a pass'); process.exit(2) }

const problems = []
let scanned = 0

const walk = (d) => {
  let es = []
  try { es = readdirSync(d, { withFileTypes: true }) } catch { return }
  for (const e of es) {
    const p = join(d, e.name)
    if (e.isDirectory()) { if (!['node_modules', '.git', 'dist'].includes(e.name)) walk(p); continue }
    if (!/\.ya?ml$/.test(e.name)) continue
    if (!p.includes('.github/workflows')) continue
    scanned++
    check(p)
  }
}

const check = (file) => {
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')

  lines.forEach((line, i) => {
    // A flow mapping on this line that also carries an UNQUOTED ${{ }}.
    const flow = line.match(/:\s*\{[^}]*$|:\s*\{.*\}\s*$/)
    if (flow && /\$\{\{/.test(line)) {
      // Quoted is legal — the braces sit inside a scalar. Unquoted is not.
      const unquoted = line.replace(/"[^"]*"|'[^']*'/g, '')
      if (/\$\{\{/.test(unquoted)) {
        problems.push({ file, line: i + 1, why:
          'a ${{ }} expression sits unquoted inside a YAML flow mapping { }. The braces are structural, ' +
          'so GitHub rejects the whole workflow — and the symptom is a run named by its file path with ' +
          'no jobs and no log, not an error. Use block style.', text: line.trim().slice(0, 120) })
      }
    }
  })

  // D19: a step that cannot fail is not a check.
  const topLevel = lines.filter(l => /^[A-Za-z]/.test(l)).map(l => l.split(':')[0])
  if (!topLevel.includes('defaults') && !/shell:\s*bash -[a-z]*e[a-z]*o pipefail/.test(text) && !/shell:\s*pwsh/.test(text)) {
    problems.push({ file, line: 1, why:
      'no pipefail default. A step that pipes through `tail`, `head` or `tee` takes the LAST command\'s ' +
      'exit status, so a failing build scores as a passing step — which happened here (D19). Add ' +
      'defaults.run.shell: bash -euo pipefail {0}.', text: '(whole file)' })
  }

  // The parse-failure symptom itself: a file with no name: is one GitHub will show by path.
  if (!topLevel.includes('name')) {
    problems.push({ file, line: 1, why: 'no top-level `name:` — GitHub will list this workflow by its file path.', text: '(whole file)' })
  }
}

for (const r of roots) walk(r)
if (!scanned) { console.error('workflow-lint: scanned 0 workflows — refusing to report a pass'); process.exit(2) }

if (!problems.length) { console.log(`workflow-lint: ${scanned} workflow(s), no problems.`); process.exit(0) }
console.error(`\nworkflow-lint: ${problems.length} problem(s) across ${scanned} workflow(s)\n`)
for (const p of problems) console.error(`  ${relative(process.cwd(), p.file)}:${p.line}\n    ${p.why}\n    ${p.text}\n`)
process.exit(1)
