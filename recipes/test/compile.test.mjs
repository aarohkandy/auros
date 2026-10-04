// compile(): determinism, the committed profiles, the report, and the shell boundary.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { compile, explain, validate, BASE, GENERATED_MARK, OPTIONS } from '../lib/recipe.mjs'
import { ROOT, EXAMPLES, example, minimal, clone, assignments } from './helpers.mjs'

describe('the committed profiles are the compiled recipes (drift)', () => {
  // LATHE D28: a generated file committed next to its source drifts unless something fails on the
  // difference. profiles/<name>.profile is what build/forge builds; the recipe is what a person
  // reads. If they disagree, the person is reading a description of a different machine.
  for (const n of EXAMPLES) {
    test(`profiles/${n}.profile === compile(recipes/examples/${n}.yaml)`, () => {
      const committed = readFileSync(join(ROOT, 'profiles', `${n}.profile`), 'utf8')
      const { profile } = compile(example(n))
      assert.equal(committed, profile, `profiles/${n}.profile is stale. Run: recipes/bin/auros-recipe compile recipes/examples/${n}.yaml -o profiles/${n}.profile`)
    })
  }
})

describe('determinism', () => {
  test('the same recipe compiles to the same bytes, every time', () => {
    for (const n of EXAMPLES) {
      const a = compile(example(n)).profile
      for (let i = 0; i < 5; i++) assert.equal(compile(example(n)).profile, a)
    }
  })
  test('the order things are written in does not matter', () => {
    for (const n of EXAMPLES) {
      const r = example(n)
      const s = Object.fromEntries(Object.entries(clone(r)).reverse())
      s.apps.reverse()
      if (s.other_languages) s.other_languages.reverse()
      if (s.prune.also_keep) s.prune.also_keep.reverse()
      assert.equal(compile(s).profile, compile(r).profile, n)
    }
  })
  test('compile does not modify the recipe it was given', () => {
    const r = example('example-school')
    const before = JSON.stringify(r)
    compile(r)
    assert.equal(JSON.stringify(r), before)
  })
  test('the compiler reads nothing but the recipe: no clock, no environment, no randomness', () => {
    const src = readFileSync(join(ROOT, 'recipes', 'lib', 'recipe.mjs'), 'utf8')
    for (const banned of [/\bDate\b/, /Math\.random/, /process\./, /\bimport\s/, /require\(/, /globalThis/, /\bfetch\(/, /localStorage/]) {
      assert.doesNotMatch(src.replace(/^\s*\/\/.*$/gm, ''), banned, `recipe.mjs uses ${banned}; it must run identically in a browser and in node`)
    }
  })
})

describe('shape of the profile', () => {
  test('starts with the generated mark and inherits desktop, once', () => {
    for (const n of EXAMPLES) {
      const p = compile(example(n)).profile
      assert.equal(p.split('\n')[0], GENERATED_MARK)
      assert.equal(assignments(p).inherit, 'desktop')
    }
  })
  test('every line is a comment, blank, or one KEY="value" with nothing after it', () => {
    // build/forge reads profile_description with sed and inherit with sed; a trailing comment on
    // either would be read as part of the value.
    for (const n of EXAMPLES) {
      for (const line of compile(example(n)).profile.split('\n')) {
        assert.match(line, /^(?:|#.*|[a-z_][a-z0-9_]*="[^"$`\\]*")$/, line)
      }
    }
  })
  test('a display name carrying shell syntax never reaches the profile', () => {
    const r = minimal(); r.organisation.display_name = 'Evil"; reboot; #'
    assert.throws(() => compile(r), /not valid/)
  })
  test('the catalogue cannot be edited in place by whoever imports the module', () => {
    assert.throws(() => { OPTIONS.languages.Marathi.locale = 'x"; reboot; "' }, TypeError)
    assert.throws(() => { OPTIONS.apps.Files.packages.push('evil') }, TypeError)
    assert.equal(OPTIONS.languages.Marathi.locale, 'mr_IN.UTF-8')
  })
  test('compile refuses an invalid recipe and carries the errors', () => {
    const r = minimal(); r.policy = 'strict'
    assert.throws(() => compile(r), (e) => Array.isArray(e.errors) && e.errors.some((x) => x.path === 'policy'))
  })
})

describe('what a recipe compiles to', () => {
  const a = (change) => { const r = minimal(); change(r); return assignments(compile(r).profile) }

  test('keep-only: the standard desktop\'s programs not in apps are not installed', () => {
    const p = a(() => {})
    assert.equal(p.packages_files, 'thunar thunar-volman gvfs gvfs-backends udisks2 shared-mime-info desktop-file-utils xdg-user-dirs')
    assert.equal(p.software_store, 'none')
    assert.equal(p.packages_hardware, BASE.packages_hardware.filter((x) => !OPTIONS.capabilities.printing.packages.includes(x) && x !== 'bluez').join(' '))
  })
  test('not keep-only: the standard desktop stays, and nothing about it is restated', () => {
    const p = a((r) => { r.prune.keep_only_the_apps_above = false; r.policy = 'open' })
    assert.equal(p.packages_files, undefined)
    assert.equal(p.packages_hardware, undefined)
    assert.equal(p.software_store, 'gnome-software')
  })
  test('managed drops the installer and the store from the standard desktop, and says why', () => {
    const r = minimal(); r.prune.keep_only_the_apps_above = false
    const { profile, report } = compile(r)
    const p = assignments(profile)
    assert.equal(p.software_store, 'none')
    assert.doesNotMatch(p.packages_files, /\bgdebi\b/)
    const gone = report.removed.find((x) => x.item === 'Program Installer')
    assert.match(gone.why, /button that refuses/)
  })
  test('no Firefox in apps means no browser, said in the profile and the report', () => {
    const r = minimal(); r.apps = ['Files']
    const { profile, report } = compile(r)
    assert.equal(assignments(profile).browser_source, 'none')
    assert.ok(report.notes.some((n) => /no web browser/.test(n)))
  })
  test('a second script is a second layout AND the key that reaches it', () => {
    const p = a((r) => { r.second_script = 'Russian'; r.switch_scripts_with = 'Alt + Shift' })
    assert.equal(p.keyboard_layout, 'gb,ru')
    assert.equal(p.keyboard_variant, '')
    assert.equal(p.keyboard_options, 'grp:alt_shift_toggle')
  })
  test('a kiosk is the locked shell with only its programs, the starting one first', () => {
    const p = a((r) => { r.policy = 'kiosk'; r.apps = ['Calculator', 'Firefox']; r.kiosk = { starts: 'Firefox' } })
    assert.equal(p.kiosk_mode, 'yes')
    assert.equal(p.shell_archetype, 'locked')
    assert.equal(p.allowed_apps, 'firefox mate-calc')
    for (const k of ['allow_user_install', 'allow_settings_change', 'allow_theme_change', 'allow_network_change', 'allow_tty']) assert.equal(p[k], 'no', k)
  })
  test('locked allows only its programs; open and managed allow everything installed', () => {
    assert.equal(a((r) => { r.policy = 'locked' }).allowed_apps, 'thunar firefox')
    assert.equal(a((r) => { r.policy = 'open' }).allowed_apps, '')
    assert.equal(a(() => {}).allowed_apps, '')
  })
  test('every policy\'s permissions are what its sentence says', () => {
    for (const [name, P] of Object.entries(OPTIONS.policies)) {
      const p = a((r) => { r.policy = name; if (name === 'kiosk') r.apps = ['Firefox'] })
      for (const k of ['kiosk_mode', 'allow_user_install', 'allow_settings_change', 'allow_theme_change', 'allow_network_change', 'allow_tty']) {
        assert.equal(p[k], P[k], `${name}: ${k}`)
      }
    }
  })
})

describe('the report', () => {
  test('installed and removed partition the standard desktop, with a reason for every line', () => {
    for (const n of EXAMPLES) {
      const { report } = compile(example(n))
      const items = [...report.installed, ...report.removed].map((x) => x.item)
      for (const d of [...OPTIONS.defaultApps, ...Object.keys(OPTIONS.capabilities)]) {
        assert.equal(items.filter((i) => i === d).length, 1, `${n}: ${d} must be either installed or removed, exactly once`)
      }
      for (const x of [...report.installed, ...report.removed]) {
        assert.ok(x.why && x.why.length > 10, `${n}: ${x.item} has no reason`)
        assert.ok(x.packages.length > 0, `${n}: ${x.item} names no packages`)
      }
    }
  })
  test('every package the report says was removed is absent from the resolved lists, and every one it says is installed is present', () => {
    for (const n of EXAMPLES) {
      const { profile, report } = compile(example(n))
      const p = assignments(profile)
      const lists = [p.packages_files ?? BASE.packages_files.join(' '), p.packages_hardware ?? BASE.packages_hardware.join(' '), p.packages_apps].join(' ').split(' ')
      const has = (pkg) => lists.includes(pkg) || (pkg === 'gnome-software' && p.software_store === 'gnome-software') || (pkg === 'firefox' && p.browser_source !== 'none')
      for (const x of report.removed) for (const pkg of x.packages) assert.equal(has(pkg), false, `${n}: report says ${pkg} is removed`)
      for (const x of report.installed) for (const pkg of x.packages) assert.equal(has(pkg), true, `${n}: report says ${pkg} is installed`)
    }
  })
  test('explain prints every removal with its reason, and what can never be removed', () => {
    const text = explain(example('example-kiosk'))
    const { report } = compile(example('example-kiosk'))
    for (const x of report.removed) assert.ok(text.includes(`- ${x.item} — ${x.why}`), x.item)
    assert.match(text, /ALWAYS THERE/)
    assert.match(text, /cannot yet send the browser to a particular page/)
  })
  test('validate and compile agree: whatever validates, compiles', () => {
    for (const n of EXAMPLES) assert.ok(validate(example(n)).ok && compile(example(n)).profile.length > 0)
  })
})
