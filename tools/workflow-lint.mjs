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
    // Strip what cannot be structural before looking at braces at all:
    //   * quoted scalars — a `${{ }}` inside quotes is legal, the braces sit inside a string;
    //   * a trailing `# comment`, which YAML does not parse and which would otherwise fire falsely.
    // Quotes come off FIRST so that a `#` inside a quoted scalar is not mistaken for a comment.
    const bare = line.replace(/"[^"]*"|'[^']*'/g, '').replace(/\s#.*$/, '')

    // Where does a flow mapping OPEN on this line? `key: {` — the brace after a colon.
    //
    // The earlier version of this test asked whether the line looked like a COMPLETE flow mapping
    // (`:\s*\{[^}]*$` or `:\s*\{.*\}\s*$`) and missed the one shape that matters most: a mapping
    // that opens on this line and continues on the next —
    //     with: { name: art-${{ matrix.profile }},
    //             path: out/ }
    // Neither alternative matched, because the `}}` of the expression defeated `[^}]*$` while the
    // trailing comma defeated `\}\s*$`. So the exact bug this linter was written for went
    // undetected whenever somebody wrapped the line. Caught by tools/workflow-lint.test.mjs.
    //
    // The question to ask is simply: does a flow mapping open here, and is there an unquoted
    // expression after it? That is true of every broken shape and false of every legal one.
    const open = bare.search(/:\s*\{/)
    if (open !== -1) {
      const after = bare.slice(open)
      if (/\$\{\{/.test(after)) {
        problems.push({ file, line: i + 1, why:
          'a ${{ }} expression sits unquoted inside a YAML flow mapping { }. The braces are structural, ' +
          'so GitHub rejects the whole workflow — and the symptom is a run named by its file path with ' +
          'no jobs and no log, not an error. Quote the value, or use block style.', text: line.trim().slice(0, 120) })
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
