// OPTIONS is derived from the engine, and these tests are what keep it derived rather than remembered.
//
// LATHE lesson: "never guess a path, unit name or flag" — four build cycles lost to remembered names.
// Its own keyboard catalogue named three XKB variants that do not exist (in:mar-inscript,
// in:hin-inscript, in:ben-inscript). So every name below is checked against the thing that will
// read it, wherever that thing is present on the machine running the tests.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { BASE, OPTIONS, RESERVED_NAMES, GENERATED_MARK, ALLOW_LIST_MAX } from '../lib/recipe.mjs'
import { ROOT, EXAMPLES, example, resolveProfile } from './helpers.mjs'

const listDir = (d, ext) => readdirSync(join(ROOT, d)).filter((f) => f.endsWith(ext)).map((f) => f.slice(0, -ext.length)).sort()

describe('the copy of desktop.profile is desktop.profile', () => {
  test('BASE equals `build/forge resolve desktop`, key by key', () => {
    const d = resolveProfile('desktop')
    for (const [k, v] of Object.entries(BASE)) {
      if (k === 'profile') continue
      const want = Array.isArray(v) ? v.join(' ') : v
      assert.equal(d[k], want, `BASE.${k} has drifted from profiles/desktop.profile`)
    }
  })
})

describe('themes and layouts are the engine\'s files', () => {
  test('themes = themes/*.theme, with each file\'s own variant', () => {
    assert.deepEqual(Object.keys(OPTIONS.themes).sort(), listDir('themes', '.theme'))
    for (const [t, { variant }] of Object.entries(OPTIONS.themes)) {
      const m = /^theme_variant="([a-z]+)"/m.exec(readFileSync(join(ROOT, 'themes', `${t}.theme`), 'utf8'))
      assert.equal(variant, m?.[1], t)
    }
  })
  test('layouts = shells/*.shell, minus locked (which is policy: kiosk)', () => {
    assert.deepEqual(Object.keys(OPTIONS.layouts).sort(), listDir('shells', '.shell').filter((s) => s !== 'locked'))
    assert.ok(existsSync(join(ROOT, 'shells', 'locked.shell')))
  })
})

describe('programs map onto what desktop.profile installs', () => {
  test('every package in desktop.profile\'s packages_files belongs to exactly one program, or is support', () => {
    for (const pkg of BASE.packages_files) {
      const owners = Object.keys(OPTIONS.apps).filter((a) => OPTIONS.apps[a].from === 'files' && OPTIONS.apps[a].packages.includes(pkg))
      const support = OPTIONS.filesSupport.includes(pkg)
      assert.equal(owners.length + (support ? 1 : 0), 1, `${pkg}: owners ${JSON.stringify(owners)}, support ${support}`)
    }
    for (const [a, A] of Object.entries(OPTIONS.apps)) {
      if (A.from === 'files') for (const p of A.packages) assert.ok(BASE.packages_files.includes(p), `${a}: ${p} is not in packages_files`)
    }
  })
  test('the capabilities are in packages_hardware, and nothing the machine needs to start is one', () => {
    const vital = ['linux-image-generic', 'linux-firmware', 'network-manager', 'polkitd', 'wpasupplicant']
    for (const [c, C] of Object.entries(OPTIONS.capabilities)) {
      for (const p of C.packages) {
        assert.ok(BASE.packages_hardware.includes(p), `${c}: ${p}`)
        assert.ok(!vital.includes(p), `${c} would remove ${p}`)
      }
    }
  })
  test('the store and the browser are forge knobs, not packages', () => {
    assert.equal(OPTIONS.apps['Software Centre'].from, 'store')
    assert.equal(BASE.software_store, 'gnome-software')
    assert.equal(OPTIONS.apps.Firefox.from, 'browser')
    assert.equal(BASE.browser, 'firefox')
  })
  test('every program has packages and allow-list names; no name carries a digit; no refused name is offered', () => {
    for (const [a, A] of Object.entries(OPTIONS.apps)) {
      assert.ok(A.packages.length > 0 && A.launch.length > 0, a)
      assert.doesNotMatch(a, /\d/, a)
      assert.ok(!(a in OPTIONS.refusedApps), a)
      for (const l of A.launch) assert.match(l, /^[A-Za-z0-9._-]+$/, `${a}: ${l}`)
    }
  })
  test('the groups name only programs and capabilities that exist', () => {
    for (const [g, G] of Object.entries(OPTIONS.groups)) {
      if (G.capability) assert.ok(OPTIONS.capabilities[G.capability], g)
      for (const a of G.apps ?? []) assert.ok(OPTIONS.apps[a], `${g}: ${a}`)
      assert.ok(!(g in OPTIONS.absentGroups), g)
    }
  })
  test('the shipped profiles a recipe may not overwrite are exactly the hand-written ones', () => {
    const hand = listDir('profiles', '.profile').filter((p) => readFileSync(join(ROOT, 'profiles', `${p}.profile`), 'utf8').split('\n')[0] !== GENERATED_MARK)
    assert.deepEqual([...RESERVED_NAMES].sort(), hand)
  })
})

describe('the sizes the shell reads, read from the shell', () => {
  test('ALLOW_LIST_MAX fits both src/common/theme.h THEME_VAL_LEN and src/aurshell/shell.h allowed_apps[]', () => {
    const theme = readFileSync(join(ROOT, 'src', 'common', 'theme.h'), 'utf8')
    const shell = readFileSync(join(ROOT, 'src', 'aurshell', 'shell.h'), 'utf8')
    const val = /#define\s+THEME_VAL_LEN\s+(\d+)/.exec(theme)
    const arr = /char\s+allowed_apps\[(\d+)\]/.exec(shell)
    assert.ok(val && arr, 'could not find THEME_VAL_LEN or allowed_apps[] — the check must not pass by finding nothing')
    const fits = Math.min(Number(val[1]), Number(arr[1])) - 1
    assert.equal(ALLOW_LIST_MAX, fits, `the shell keeps ${fits} bytes of allowed_apps; recipe.mjs says ${ALLOW_LIST_MAX}`)
  })
})

describe('copies of this module elsewhere in the repository', () => {
  // The website carries its own copy of recipe.mjs for the browser. A copy is a second source of
  // truth the moment it differs; this is what notices.
  const copy = join(ROOT, 'website', 'assets', 'recipe.mjs')
  test('website/assets/recipe.mjs, where it exists, is recipes/lib/recipe.mjs byte for byte', { skip: !existsSync(copy) && 'no copy in website/assets' }, () => {
    assert.ok(readFileSync(copy, 'utf8') === readFileSync(join(ROOT, 'recipes', 'lib', 'recipe.mjs'), 'utf8'),
      'website/assets/recipe.mjs has drifted from recipes/lib/recipe.mjs. Copy it again: cp recipes/lib/recipe.mjs website/assets/recipe.mjs')
  })
})

describe('names, checked against the machine that will read them (where it exists here)', () => {
  const SUPPORTED = '/usr/share/i18n/SUPPORTED'
  test('every locale is one glibc can generate', { skip: !existsSync(SUPPORTED) && `no ${SUPPORTED} on this machine` }, () => {
    const lines = readFileSync(SUPPORTED, 'utf8').split('\n')
    for (const [L, { locale }] of Object.entries(OPTIONS.languages)) {
      const base = locale.replace(/\.UTF-8$/, '')
      assert.ok(lines.some((l) => l === `${base}.UTF-8 UTF-8` || l === `${base} UTF-8`), `${L}: ${locale} is not in ${SUPPORTED}`)
    }
  })
  const EVDEV = '/usr/share/X11/xkb/rules/evdev.lst'
  test('every keyboard layout, variant and switch is one XKB has', { skip: !existsSync(EVDEV) && `no ${EVDEV} on this machine` }, () => {
    const text = readFileSync(EVDEV, 'utf8')
    const section = (name) => {
      const m = new RegExp(`^! ${name}\\n([\\s\\S]*?)(?=^! |$(?![\\s\\S]))`, 'm').exec(text)
      return m ? m[1] : ''
    }
    const layouts = new Set([...section('layout').matchAll(/^\s+(\S+)\s/gm)].map((m) => m[1]))
    const variants = new Set([...section('variant').matchAll(/^\s+(\S+)\s+([a-z]+):/gm)].map((m) => `${m[2]}:${m[1]}`))
    const options = new Set([...section('option').matchAll(/^\s+(\S+)\s/gm)].map((m) => m[1]))
    for (const [k, { layout, variant }] of Object.entries(OPTIONS.keyboards)) {
      assert.ok(layouts.has(layout), `${k}: no XKB layout "${layout}"`)
      if (variant) assert.ok(variants.has(`${layout}:${variant}`), `${k}: no XKB variant "${layout}:${variant}"`)
    }
    for (const [t, opt] of Object.entries(OPTIONS.toggles)) assert.ok(options.has(opt), `${t}: no XKB option ${opt}`)
    // The canary: LATHE's names, which are wrong, must fail this same check.
    for (const bad of ['in:mar-inscript', 'in:hin-inscript', 'in:ben-inscript']) assert.ok(!variants.has(bad), bad)
  })
  test('every zone the form accepts is one this machine\'s tzdata has', { skip: !existsSync('/usr/share/zoneinfo/zone1970.tab') && 'no tzdata on this machine' }, () => {
    assert.ok(OPTIONS.zones.length > 300, `only ${OPTIONS.zones.length} zones`)
    for (const tz of OPTIONS.zones) assert.ok(existsSync(join('/usr/share/zoneinfo', tz)), `${tz} is not in /usr/share/zoneinfo`)
    // and every zone tzdata assigns to a country is offered
    const tab = readFileSync('/usr/share/zoneinfo/zone1970.tab', 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split('\t')[2])
    for (const tz of tab) assert.ok(OPTIONS.zones.includes(tz), `${tz} (zone1970.tab) is not offered`)
  })
  test('every example\'s timezone exists', { skip: !existsSync('/usr/share/zoneinfo') && 'no zoneinfo on this machine' }, () => {
    for (const n of EXAMPLES) {
      const tz = example(n).timezone
      assert.ok(existsSync(join('/usr/share/zoneinfo', tz)), `${n}: ${tz}`)
    }
  })
})
