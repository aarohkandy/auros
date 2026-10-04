// The compiler against the real build/forge.
//
// LATHE's hardest lesson (D38): fields that reach the image as nothing. Two halves of that here:
//
//   1. Every key compile() writes is a key build/forge actually reads — collected by parsing
//      build/forge itself, so a key forge stops reading turns this red without anybody updating a list.
//   2. Some keys forge reads and then only copies into /etc/auros/policy.conf, where nothing on the
//      machine reads them back. Those are inert, and compile() must never write them either.
//
// And then the real thing: `build/forge resolve` on every committed example, which runs forge's own
// profile loader — inheritance, its checks — and must agree with what the compiler wrote.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { compile, validate, BASE } from '../lib/recipe.mjs'
import { ROOT, FORGE, EXAMPLES, example, minimal, assignments, resolveProfile } from './helpers.mjs'
import { PROBES } from './probes.mjs'

/**
 * Every variable build/forge reads: $name and ${name...} outside shell comments (heredoc bodies are
 * kept — they are where most profile values are written into the image), plus the keys it reads out
 * of profile files with sed.
 */
export function forgeReads (text) {
  const keep = []
  let heredoc = null
  for (const line of text.split('\n')) {
    if (heredoc) {
      keep.push(line)
      if (line.trim() === heredoc) heredoc = null
      continue
    }
    if (/^\s*#/.test(line)) continue
    keep.push(line)
    const h = /<<-?\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?/.exec(line)
    if (h) heredoc = h[1]
  }
  const body = keep.join('\n')
  const out = new Set()
  for (const m of body.matchAll(/\$\{?([a-z_][a-z0-9_]*)/g)) out.add(m[1])
  for (const m of body.matchAll(/s\/\^(?:\[\[:space:\]\]\*)?([a-z_][a-z0-9_]*)=/g)) out.add(m[1])
  return out
}

const FORGE_TEXT = readFileSync(FORGE, 'utf8')
const READS = forgeReads(FORGE_TEXT)

// Read by build/forge, written into policy.conf, and read by nothing on the machine
// (aurshell reads policy.conf through theme_str/theme_int; the inert-check below re-verifies).
const INERT = ['auto_login', 'enrollment_url', 'update_channel', 'telemetry']

/** Every recipe the tests know: the examples and every probe value. */
function allRecipes () {
  const rs = EXAMPLES.map(example)
  for (const p of PROBES) for (const v of [p.a, p.b]) { const r = p.base(); p.set(r, v); if (validate(r).ok) rs.push(r) }
  return rs
}

describe('build/forge itself', () => {
  test('bash -n build/forge', () => {
    const r = spawnSync('bash', ['-n', FORGE], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
  })
  test('the key collector can go red: it sees a read, and stops seeing it when the read is removed', () => {
    assert.ok(READS.has('keyboard_options'), 'forge does not read keyboard_options — the XKBOPTIONS line is gone')
    assert.ok(READS.has('locale') && READS.has('allowed_apps') && READS.has('profile_description') && READS.has('inherit'))
    const without = FORGE_TEXT.replace(/\$\{keyboard_options:-\}/g, '')
    assert.equal(forgeReads(without).has('keyboard_options'), false)
    assert.equal(forgeReads('# $only_in_a_comment\n').has('only_in_a_comment'), false)
    assert.equal(forgeReads("cat <<'EOL'\n# $in_a_heredoc\nEOL\n").has('in_a_heredoc'), true)
  })
  test('ENGINE FINDING, pinned: desktop.profile sets keys build/forge never reads', () => {
    // Not the recipe's bug, the engine's — recorded so the day it changes, somebody looks.
    // wallpaper_style is written in every profile and read by nothing.
    const set = [...readFileSync(join(ROOT, 'profiles', 'desktop.profile'), 'utf8').matchAll(/^([a-z_][a-z0-9_]*)=/gm)].map((m) => m[1])
    const unread = set.filter((k) => !READS.has(k)).sort()
    assert.deepEqual(unread, ['wallpaper_style'])
  })
})

describe('compile writes only keys build/forge reads (D38)', () => {
  test('every key, in every recipe the tests know', () => {
    const seen = new Set()
    for (const r of allRecipes()) {
      for (const k of Object.keys(assignments(compile(r).profile))) {
        seen.add(k)
        assert.ok(READS.has(k), `compile() wrote ${k}, and build/forge never reads it: a field that reaches the image as nothing`)
      }
    }
    assert.ok(seen.size >= 25, `only ${seen.size} keys seen; the probe set is not exercising the compiler`)
  })
  test('and never one of the inert keys, which forge copies into policy.conf for nothing to read', () => {
    for (const r of allRecipes()) {
      const keys = Object.keys(assignments(compile(r).profile))
      for (const k of INERT) assert.ok(!keys.includes(k), `compile() wrote ${k}`)
    }
  })
  test('the inert keys are still inert: nothing in src/ or rootfs/ reads them', () => {
    // If this goes red, something now honours the key — a recipe field for it may be possible.
    const hits = []
    const walk = (dir) => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e)
        const st = statSync(p)
        if (st.isDirectory()) { walk(p); continue }
        if (st.size > 2_000_000) continue
        const text = readFileSync(p, 'latin1')
        for (const k of INERT) {
          for (const line of text.split('\n')) {
            if (/^\s*(#|\/\/|\*|\/\*)/.test(line)) continue
            if (new RegExp(`\\b${k}\\b`).test(line)) hits.push(`${p}: ${k}: ${line.trim().slice(0, 100)}`)
          }
        }
      }
    }
    walk(join(ROOT, 'src'))
    walk(join(ROOT, 'rootfs'))
    assert.deepEqual(hits, [])
  })
})

describe('build/forge resolve agrees with the compiler', () => {
  test('desktop resolves (the mode exists and needs no root)', () => {
    const d = resolveProfile('desktop')
    assert.equal(d.profile_id, 'desktop')
  })
  for (const n of EXAMPLES) {
    test(`profiles/${n}.profile: forge loads it, and every value is what the compiler wrote`, () => {
      const wrote = assignments(compile(example(n)).profile)
      const got = resolveProfile(n)
      for (const [k, v] of Object.entries(wrote)) {
        if (k === 'inherit') continue
        assert.equal(got[k], v.replace(/\s+/g, ' ').trim(), `${n}: ${k}`)
      }
      // and what it did not write is inherited from desktop, unchanged
      for (const k of ['browser', 'packages_base', 'packages_boot', 'packages_desktop', 'default_user']) {
        assert.equal(got[k], resolveProfile('desktop')[k], `${n}: ${k} should be inherited`)
      }
    })
  }
  test('resolve refuses what forge\'s loader refuses (it is the same loader)', () => {
    const r = spawnSync('bash', [FORGE, 'resolve', 'no-such-profile'], { encoding: 'utf8' })
    assert.notEqual(r.status, 0)
    assert.match(r.stderr, /no such profile/)
  })
  test('resolve touches nothing: it creates no work tree', () => {
    execFileSync('bash', [FORGE, 'resolve', 'example-kiosk'], { cwd: ROOT, stdio: 'ignore' })
    let exists = true
    try { statSync(join(ROOT, 'work', 'forge', 'example-kiosk')) } catch { exists = false }
    assert.equal(exists, false)
  })
  test('the minimal test recipe resolves too, from a file outside profiles/', () => {
    // load_profile takes a path as well as a name; inherit="desktop" still resolves to profiles/.
    const { profile } = compile(minimal())
    const tmp = join(ROOT, 'recipes', 'test', '.tmp-minimal.profile')
    try {
      writeFileSync(tmp, profile)
      const got = resolveProfile(tmp)
      assert.equal(got.profile_id, 'test-fleet')
      assert.equal(got.allowed_apps, '')
      assert.equal(got.theme, BASE.theme)
    } finally { rmSync(tmp, { force: true }) }
  })
})
