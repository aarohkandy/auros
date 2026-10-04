// recipes/bin/auros-recipe, as a process: exit codes, output, and what it will not overwrite.
import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { emitYaml, compile } from '../lib/recipe.mjs'
import { CLI, RECIPES, ROOT, EXAMPLES, example, minimal } from './helpers.mjs'

const TMP = mkdtempSync(join(tmpdir(), 'auros-recipe-cli-'))
after(() => rmSync(TMP, { recursive: true, force: true }))
const run = (...args) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: 'utf8' })
  return { code: r.status, out: r.stdout, err: r.stderr }
}
const file = (name, text) => { const p = join(TMP, name); writeFileSync(p, text); return p }

describe('validate', () => {
  test('0 for the examples', () => {
    const r = run('validate', ...EXAMPLES.map((n) => join(RECIPES, 'examples', `${n}.yaml`)))
    assert.equal(r.code, 0, r.err)
    assert.equal((r.out.match(/: ok$/gm) ?? []).length, 3)
  })
  test('1 for a refused recipe, with every problem named by its field', () => {
    const r0 = minimal(); r0.from = 'fedora'; r0.updates = { install_between: '21:00-05:00' }
    const r = run('validate', file('bad.yaml', emitYaml(r0)))
    assert.equal(r.code, 1)
    assert.match(r.err, /REFUSED — 2 problems/)
    assert.match(r.err, /^ {2}from: /m)
    assert.match(r.err, /^ {2}updates: /m)
  })
  test('1 for YAML outside the subset, with the line', () => {
    const r = run('validate', file('yaml.yaml', 'schema: 1\nname: x\nlocked: yes\n'))
    assert.equal(r.code, 1)
    assert.match(r.err, /line 3: .*ambiguous/)
  })
  test('2 when it cannot run: a missing file, no arguments, an unknown command', () => {
    assert.equal(run('validate', join(TMP, 'nope.yaml')).code, 2)
    assert.equal(run('validate').code, 2)
    assert.equal(run().code, 2)
    assert.equal(run('frobnicate', 'x').code, 2)
    assert.equal(run('compile', '--force', join(RECIPES, 'examples', 'example-school.yaml')).code, 2)
  })
})

describe('compile', () => {
  test('to stdout, exactly compile()', () => {
    const r = run('compile', join(RECIPES, 'examples', 'example-kiosk.yaml'))
    assert.equal(r.code, 0, r.err)
    assert.equal(r.out, compile(example('example-kiosk')).profile)
  })
  test('-o writes <name>.profile, and refuses any other file name', () => {
    const src = file('r.yaml', emitYaml(minimal()))
    const ok = run('compile', src, '-o', join(TMP, 'test-fleet.profile'))
    assert.equal(ok.code, 0, ok.err)
    assert.equal(readFileSync(join(TMP, 'test-fleet.profile'), 'utf8'), compile(minimal()).profile)
    const bad = run('compile', src, '-o', join(TMP, 'other.profile'))
    assert.equal(bad.code, 2)
    assert.match(bad.err, /must be written to test-fleet\.profile/)
    assert.equal(existsSync(join(TMP, 'other.profile')), false)
  })
  test('refuses to overwrite a profile it did not write', () => {
    const r0 = minimal(); r0.name = 'handmade'
    const target = join(TMP, 'handmade.profile')
    writeFileSync(target, '# a profile somebody wrote by hand\ninherit="desktop"\n')
    const r = run('compile', file('h.yaml', emitYaml(r0)), '-o', target)
    assert.equal(r.code, 2)
    assert.match(r.err, /not written by auros-recipe/)
    assert.equal(readFileSync(target, 'utf8'), '# a profile somebody wrote by hand\ninherit="desktop"\n')
  })
  test('refuses to compile a refused recipe, and writes nothing', () => {
    const r0 = minimal(); r0.policy = 'strict'
    const r = run('compile', file('s.yaml', emitYaml(r0)), '-o', join(TMP, 'test-fleet-strict.profile'))
    assert.equal(r.code, 1)
    assert.equal(existsSync(join(TMP, 'test-fleet-strict.profile')), false)
  })
})

describe('explain', () => {
  test('prints the report for a person', () => {
    const r = run('explain', join(RECIPES, 'examples', 'example-school.yaml'))
    assert.equal(r.code, 0, r.err)
    for (const s of ['Example Vidyalaya', 'ON THESE MACHINES', 'TAKEN OUT OF THE STANDARD DESKTOP', '- bluetooth', 'ALWAYS THERE', 'Windows key + Spacebar']) {
      assert.ok(r.out.includes(s), s)
    }
  })
})
