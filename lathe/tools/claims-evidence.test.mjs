#!/usr/bin/env node --test
// tools/claims-evidence.mjs, driven red and green (D34). Each refusal has a control that must pass.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'
import { checkDesignRows, checkPhrases, CLAIMS } from './claims-evidence.mjs'

const TOOL = join(dirname(fileURLToPath(import.meta.url)), 'claims-evidence.mjs')

/** A throwaway five-repo root. `repos` maps repo dir -> { path: body }; each becomes a git repo. */
function tree (repos) {
  const root = mkdtempSync(join(tmpdir(), 'auros-claims-evidence-'))
  for (const [repo, files] of Object.entries(repos)) {
    const dir = join(root, repo)
    mkdirSync(dir, { recursive: true })
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, rel)), { recursive: true })
      writeFileSync(join(dir, rel), body)
    }
    execFileSync('git', ['init', '-q', dir])
    execFileSync('git', ['-C', dir, 'add', '-A'])
  }
  return root
}
const row = evidence => `| A claim | \`somewhere.md\` | ${evidence} | \`2026-09-20\` |\n`
const claims = rows => ({ 'auros-web': { [CLAIMS.replace('auros-web/', '')]: '# CLAIMS\n\n| Claim | Where | Evidence | verified_on |\n|---|---|---|---|\n' + rows.join('') } })

test('RED — the real Wi-Fi row as it shipped: DESIGN with the promise as its evidence', () => {
  const root = tree(claims([row('**SPEC** §4.2 and §6C.1 name exactly these. **DESIGN.**')]))
  try { assert.equal(checkDesignRows(root).findings.length, 1) } finally { rmSync(root, { recursive: true }) }
})

test('RED — a DESIGN row citing a path that does not exist, or an empty file', () => {
  const root = tree({ ...claims([row('**DESIGN** — `auros-installer/internal/wifi/export.go`.'), row('**DESIGN** — `auros-installer/empty.go`.')]),
    'auros-installer': { 'empty.go': '' } })
  try { assert.equal(checkDesignRows(root).findings.length, 2) } finally { rmSync(root, { recursive: true }) }
})

test('GREEN — a DESIGN row citing a real non-empty file (with a :line suffix), and non-DESIGN rows with no path', () => {
  const root = tree({ ...claims([row('**DESIGN** — `auros-installer/internal/verify/verify.go:224-237`.'), row('**UPSTREAM.** No file.'), row('Was marked DESIGN once; **UNEVIDENCED** now.')]),
    'auros-installer': { 'internal/verify/verify.go': 'package verify\n' } })
  try {
    const r = checkDesignRows(root)
    assert.equal(r.checked, 1)
    assert.deepEqual(r.findings, [])
  } finally { rmSync(root, { recursive: true }) }
})

test('RED — each withdrawn phrase, in a tracked file outside auros-web/src, in any of the five repos', () => {
  const root = tree({
    '.': { 'README.md': 'If we vanish tomorrow, a customer rebuilds their exact\noperating system from a ten-line file.\n' },
    'auros-base': { 'README.md': '# 2 ── Verify the signature. Keyless: there is no Auros private key to steal.\n' },
    'auros-recipes': { 'schema/recipe.schema.json': '{"description": "This repository is public on purpose"}\n' },
    'auros-installer': { 'NOTES.md': 'You can fork it yourself.\n' },
    'auros-web': { 'src/content/copy.ts': 'const l = "check S8        signed · cosign keyless"\n' },
  })
  try {
    const r = checkPhrases(root)
    assert.equal(r.scanned.length, 5)
    assert.deepEqual(r.findings.map(f => f.rule).sort(),
      ['fork-it-yourself', 'keyless', 'keyless', 'public-on-purpose', 'rebuild-exact-os'])
  } finally { rmSync(root, { recursive: true }) }
})

test('GREEN — quoted with auros-allow, test fixtures, a keyed-not-keyless correction, untracked files, the decision log', () => {
  const root = tree({
    '.': { 'DECISIONS.md': 'D29 quoted `signed · cosign keyless`.\n' },
    'auros-base': { 'CI.md': '### Signing is keyed, not keyless\n\nThe brief said "sign with cosign keyless via OIDC".\n' },
    'auros-web': { 'CLAIMS.md': '| row that read "signing is keyless" | <!-- auros-allow: quotes the withdrawn wording --> |\n',
      'tools/build-console.test.mjs': 'const FAKE = "signed · cosign keyless"\n' },
  })
  writeFileSync(join(root, 'auros-web', 'untracked.md'), 'public on purpose\n')
  try { assert.deepEqual(checkPhrases(root).findings, []) } finally { rmSync(root, { recursive: true }) }
})

test('the CLI exits 1 on a finding, 0 when clean, and 2 when there is nothing to scan', () => {
  const dirty = tree({ '.': { 'a.md': 'public on purpose\n' } })
  const clean = tree({ '.': { 'a.md': 'all rights reserved\n' } })
  const empty = mkdtempSync(join(tmpdir(), 'auros-claims-evidence-'))
  try {
    assert.equal(spawnSync('node', [TOOL, '--root', dirty]).status, 1)
    assert.equal(spawnSync('node', [TOOL, '--root', clean]).status, 0)
    assert.equal(spawnSync('node', [TOOL, '--root', empty]).status, 2)
  } finally { for (const d of [dirty, clean, empty]) rmSync(d, { recursive: true }) }
})
