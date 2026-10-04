#!/usr/bin/env node --test
// HONESTY GATE — the two checks that read something OTHER than the sentence.
//
//   node --test tools/honesty-gate.crossfile.test.mjs
//
// Every rule in `RULES` is a regex over one file, so it can only catch a claim whose WORDING is
// suspicious. Both defects that shipped on 2026-09-20 had perfectly sober wording and evidence that
// had moved underneath it:
//
//   1. The footer provenance panel — the one block whose stated job is "what this site is standing
//      on" — printed `Replaceability test · Wednesdays 05:23 UTC ·
//      auros-recipes/.github/workflows/replaceable.yml`. That file has been on `workflow_dispatch`
//      only since the same morning, with its cron commented out under a `── PAUSED ──` header. The
//      gate passed it, because the path it cited was real.
//   2. D30 and D31 falsified about thirteen content files. The gate passed that too, because no
//      rule knew the claims ledger had a date on it.
//
// So there are two cross-file checks, and this file is the proof they can go red. A gate that has
// never been shown failing is a gate nobody should quote, and "no unevidenced claims found" printed
// over a false trust argument is the most dangerous single line this repository can emit.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const GATE = join(HERE, 'honesty-gate.mjs')
const REPO = join(HERE, '..')

/** Runs the gate over a throwaway tree and returns { code, out }. */
function run (files) {
  const dir = mkdtempSync(join(tmpdir(), 'auros-crossfile-'))
  try {
    for (const [rel, body] of Object.entries(files)) {
      const abs = join(dir, rel)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, body)
    }
    let out = ''
    let code = 0
    try {
      out = execFileSync(process.execPath, [GATE, dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (e) {
      code = e.status ?? 1
      out = `${e.stdout ?? ''}${e.stderr ?? ''}`
    }
    return { code, out }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** The freshness marker has to be current or every other case here fails for the wrong reason. */
const latestDecision = Math.max(
  0,
  ...[...readFileSync(join(REPO, 'DECISIONS.md'), 'utf8').matchAll(/^##\s*D(\d+)\b/gm)].map(m => Number(m[1])),
)
const FRESH = { 'content/CLAIMS.md': `# CLAIMS\n\nReviewed against DECISIONS.md: D${latestDecision}\n` }

describe('cited-workflow-schedule: the site may not advertise a cadence a workflow does not run on', () => {
  test('FIRES on the exact string that shipped in the footer', () => {
    const { code, out } = run({
      ...FRESH,
      'copy.ts': 'export const p = { value: "Replaceability test · Wednesdays 05:23 UTC · auros-recipes/.github/workflows/replaceable.yml" }\n',
    })
    assert.equal(code, 1, 'the gate must fail on a cadence cited for a paused workflow')
    assert.match(out, /cited-workflow-schedule/)
    assert.match(out, /replaceable\.yml/)
  })

  test('FIRES on a workflow path that is not in the tree at all', () => {
    const { code, out } = run({ ...FRESH, 'copy.ts': 'export const z = { v: "Weekly · ops/.github/workflows/nope.yml" }\n' })
    assert.equal(code, 1)
    assert.match(out, /cited-workflow-missing/)
  })

  test('QUIET for the nightly, which genuinely has an active schedule', () => {
    const { code } = run({ ...FRESH, 'copy.ts': 'export const r = { v: "Nightly · 04:17 UTC · auros-base/.github/workflows/nightly.yml" }\n' })
    assert.equal(code, 0, 'a real cadence on a real schedule must not be a finding')
  })

  test('QUIET when the same path is cited WITHOUT asserting a cadence', () => {
    // This is the wording the footer now uses. The check must permit naming a paused job honestly,
    // otherwise the only way to pass is to stop mentioning it — which is the opposite of the point.
    const { code } = run({
      ...FRESH,
      'copy.ts': 'export const p = { value: "paused · workflow_dispatch only · auros-recipes/.github/workflows/replaceable.yml" }\n',
    })
    assert.equal(code, 0)
  })

  test('QUIET in a pure code comment, which reaches no customer', () => {
    const { code } = run({
      ...FRESH,
      'note.ts': '// Wednesdays 05:23 UTC · auros-recipes/.github/workflows/replaceable.yml\nexport const x = 1\n',
    })
    assert.equal(code, 0)
  })
})

describe('claims-freshness: the ledger has to have been read against the latest decision', () => {
  test('FIRES when CLAIMS.md is behind DECISIONS.md', () => {
    const { code, out } = run({ 'content/CLAIMS.md': '# CLAIMS\n\nReviewed against DECISIONS.md: D7\n', 'a.ts': 'export const x = 1\n' })
    assert.equal(code, 1)
    assert.match(out, /claims-freshness/)
    assert.match(out, new RegExp(`D${latestDecision}`))
  })

  test('FIRES when CLAIMS.md carries no marker at all', () => {
    const { code, out } = run({ 'content/CLAIMS.md': '# CLAIMS\n\nnothing here\n', 'a.ts': 'export const x = 1\n' })
    assert.equal(code, 1)
    assert.match(out, /claims-freshness/)
  })

  test('QUIET when the marker is current', () => {
    const { code } = run({ ...FRESH, 'a.ts': 'export const x = 1\n' })
    assert.equal(code, 0)
  })
})

describe('the live tree', () => {
  test('auros-web/src/content/CLAIMS.md is itself current', () => {
    const text = readFileSync(join(REPO, 'auros-web', 'src', 'content', 'CLAIMS.md'), 'utf8')
    const m = /Reviewed against DECISIONS\.md:\s*D(\d+)/i.exec(text)
    assert.ok(m, 'CLAIMS.md must carry a "Reviewed against DECISIONS.md: D<n>" marker')
    assert.ok(
      Number(m[1]) >= latestDecision,
      `CLAIMS.md says D${m?.[1]} and DECISIONS.md is at D${latestDecision}: re-read the ledger, then raise the number`,
    )
  })
})
