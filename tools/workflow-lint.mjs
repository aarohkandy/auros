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

  // `${NAME}` IN AN `env:` VALUE — a shell expansion written where an expression was meant.
  //
  // GitHub interpolates `${{ }}` and nothing else. `RECIPE: ${RECIPE}` is not an error, not a
  // warning, and not empty: it sets the variable to the nine literal characters `${RECIPE}`. Every
  // later `"$RECIPE"` then expands back to that literal, so a job that binds an input this way
  // computes paths that cannot exist and dies before it does the thing it exists to do.
  //
  // This cost us the validator on the only path an order takes. auros-recipes/build-recipe.yml had
  // `RECIPE: ${RECIPE}` at the job level, so `node dist/cli.js validate customers/${RECIPE}/recipe.yaml`
  // exited 2 on EVERY run — the recipe was never validated, never compiled, never gated. The failure
  // looked like infrastructure, and the file two lines away used the correct `${{ }}` syntax, so it
  // read as a convention rather than as a typo.
  //
  // Scope: `env:` values only, which is where the mistake is invisible. A `${VAR}` inside a `run:`
  // block is an ordinary shell expansion and entirely correct.
  {
    let inEnv = false
    let envIndent = 0
    lines.forEach((line, i) => {
      if (/^\s*#/.test(line) || line.trim() === '') return
      const indent = line.length - line.trimStart().length
      if (inEnv && indent <= envIndent) inEnv = false
      const m = /^(\s*)env:\s*$/.exec(line)
      if (m) { inEnv = true; envIndent = m[1].length; return }
      if (!inEnv) return
      const kv = /^\s*[A-Za-z_][A-Za-z0-9_]*:\s*(.+?)\s*$/.exec(line)
      if (!kv) return
      const value = kv[1]
      if (/\$\{\{/.test(value)) return                 // a real expression: fine
      if (!/\$\{[A-Za-z_][A-Za-z0-9_]*\}/.test(value)) return
      problems.push({ file, line: i + 1, why:
        'an `env:` value uses ${NAME} where a GitHub expression was meant. GitHub interpolates only ' +
        '${{ }}, so this variable is set to the LITERAL string "${NAME}" — the job does not fail, it ' +
        'quietly carries the wrong value into every step that reads it. Write ${{ inputs.name }}, ' +
        '${{ matrix.name }} or ${{ env.NAME }}; if a shell expansion really was intended, do it ' +
        'inside the `run:` block where it is one.', text: line.trim().slice(0, 120) })
    })
  }

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
