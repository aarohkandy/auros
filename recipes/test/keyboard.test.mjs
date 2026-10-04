// The keyboard a recipe asks for, compiled by the library the compositor compiles it with.
//
// Needs a C compiler and libxkbcommon's development files; skips with the reason when either is
// missing. Everything else about keyboards (names against evdev.lst) is in options.test.mjs.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { compile, OPTIONS } from '../lib/recipe.mjs'
import { RECIPES, EXAMPLES, example, minimal, assignments } from './helpers.mjs'

const TMP = mkdtempSync(join(tmpdir(), 'auros-xkb-'))
after(() => rmSync(TMP, { recursive: true, force: true }))
const BIN = join(TMP, 'xkbcheck')
const flags = spawnSync('pkg-config', ['--cflags', '--libs', 'xkbcommon'], { encoding: 'utf8' })
const built = flags.status === 0 &&
  spawnSync('cc', ['-O1', '-o', BIN, join(RECIPES, 'test', 'xkbcheck.c'), ...flags.stdout.trim().split(/\s+/)], { encoding: 'utf8' }).status === 0
const skip = built ? false : 'needs a C compiler and libxkbcommon-dev (pkg-config xkbcommon)'
const xkb = (l, v, o) => spawnSync(BIN, [l, v, o], { encoding: 'utf8' })

test('the checker can say no: LATHE\'s Marathi variant does not compile, the real one does', { skip }, () => {
  assert.equal(xkb('us,in', ',mar-inscript', 'grp:win_space_toggle').status, 1)
  assert.equal(xkb('us,in', ',marathi', 'grp:win_space_toggle').status, 0)
})

test('every compiled example\'s keyboard compiles', { skip }, () => {
  for (const n of EXAMPLES) {
    const p = assignments(compile(example(n)).profile)
    const r = xkb(p.keyboard_layout, p.keyboard_variant, p.keyboard_options)
    assert.equal(r.status, 0, `${n}: ${r.stdout}`)
  }
})

test('every keyboard this form offers compiles, alone and as a second script with every switch', { skip }, () => {
  for (const [name, k] of Object.entries(OPTIONS.keyboards)) {
    assert.equal(xkb(k.layout, k.variant, '').status, 0, name)
    for (const toggle of Object.keys(OPTIONS.toggles)) {
      const r0 = minimal(); r0.second_script = name; r0.switch_scripts_with = toggle
      if (name === r0.keyboard) continue
      const p = assignments(compile(r0).profile)
      const r = xkb(p.keyboard_layout, p.keyboard_variant, p.keyboard_options)
      assert.equal(r.status, 0, `${name} + ${toggle}: ${r.stdout}`)
      assert.match(r.stdout, /^2 layout/, `${name}: a second script must give two layouts`)
    }
  }
})
