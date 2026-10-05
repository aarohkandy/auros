// validate(): what a recipe may say, and the sentence it gets when it says something else.
//
// Every refusal here is PAIRED with its control: the same recipe with the one defect removed must
// be accepted. A validator that refused everything would otherwise pass this whole file.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { validate, compile, parseYaml, OPTIONS, FIELDS, RESERVED_NAMES } from '../lib/recipe.mjs'
import { EXAMPLES, example, minimal, clone } from './helpers.mjs'

/** Apply `change` to a fresh minimal recipe and return the validation. */
const check = (change) => { const r = minimal(); change(r); return validate(r) }
const refused = (change, path, re) => {
  const v = check(change)
  assert.equal(v.ok, false, `expected a refusal at ${path}`)
  const hit = v.errors.find((e) => e.path === path)
  assert.ok(hit, `no error at ${path}; got: ${JSON.stringify(v.errors)}`)
  if (re) assert.match(hit.message, re)
  return hit
}

describe('the controls', () => {
  test('the minimal recipe is accepted', () => assert.deepEqual(validate(minimal()), { ok: true, errors: [] }))
  test('every example is accepted', () => {
    for (const n of EXAMPLES) assert.deepEqual(validate(example(n)), { ok: true, errors: [] }, n)
  })
})

describe('every error is a {path, message} a non-engineer can act on', () => {
  test('shape, and no leaked internals', () => {
    const v = validate({ schema: 2, name: 'Bad Name', apps: 'Firefox', policy: 'strict', theme: { accent: '#FFF' }, nonsense: 1, from: 'x' })
    assert.equal(v.ok, false)
    assert.ok(v.errors.length >= 8, JSON.stringify(v.errors, null, 1))
    for (const e of v.errors) {
      assert.equal(typeof e.path, 'string')
      assert.equal(typeof e.message, 'string')
      assert.ok(e.message.length > 20, `too short to help anybody: ${e.message}`)
      assert.doesNotMatch(e.message, /undefined|\[object Object\]|NaN|TypeError/, e.message)
    }
  })
  test('a recipe that is not a map', () => {
    for (const x of [null, [], 'text', 3]) assert.equal(validate(x).ok, false)
  })
})

describe('required fields', () => {
  for (const f of FIELDS.filter((f) => f.required && !f.path.includes('.'))) {
    test(`missing ${f.path}`, () => refused((r) => { delete r[f.path] }, f.path, /missing/))
  }
  test('missing organisation.display_name', () => refused((r) => { r.organisation = {} }, 'organisation.display_name', /missing/))
  test('missing prune.keep_only_the_apps_above', () => refused((r) => { r.prune = {} }, 'prune.keep_only_the_apps_above', /missing/))
})

describe('refused by design — and the refusal says why that is a feature', () => {
  for (const k of ['from', 'base', 'image', 'digest', 'inherit']) {
    test(`${k}: a recipe cannot name what it is built on`, () => refused((r) => { r[k] = 'ubuntu:24.04' }, k, /refused, and that is a feature.*same base/))
  }
  for (const k of ['pin', 'hold', 'version', 'exclude']) {
    test(`${k}: a recipe cannot pin a version`, () => refused((r) => { r[k] = ['firefox=128'] }, k, /unpatched/))
  }
  for (const k of ['kernel', 'kernel_args', 'boot_args', 'drivers']) {
    test(`${k}: a recipe cannot choose a kernel`, () => refused((r) => { r[k] = 'linux-image-6.1' }, k, /kernel/))
  }
  for (const k of ['run', 'script', 'post_install', 'hooks', 'env']) {
    test(`${k}: a recipe cannot run code`, () => refused((r) => { r[k] = 'curl x | sh' }, k, /cannot run code/))
  }
  for (const k of ['skip_checks', 'force', 'unsigned']) {
    test(`${k}: a recipe cannot ask for less checking`, () => refused((r) => { r[k] = true }, k, /less checking/))
  }
  for (const k of ['password', 'wifi_password', 'token']) {
    test(`${k}: a recipe cannot carry a secret`, () => refused((r) => { r[k] = 'hunter2' }, k, /secret/))
  }
  test('packages: programs are named by people-names only', () => refused((r) => { r.packages = ['vlc'] }, 'packages', /people say/))
  test('a version number in an app name is refused by its shape', () => {
    for (const a of ['Firefox 140', 'firefox-140.0', 'VLC 3']) refused((r) => { r.apps = ['Files', a] }, 'apps', /digit/)
  })
  test('a package name in apps is answered with the people-name', () => {
    const e = refused((r) => { r.apps = ['thunar'] }, 'apps', /package name/)
    assert.match(e.message, /"Files"/)
  })
})

describe('LATHE fields the engine cannot honour are refused, never recorded and ignored (D38)', () => {
  const lathe = {
    hardware: { machines: 180, models: ['dell-latitude-e6440'] },
    windows_apps: { enabled: false },
    updates: { install_between: '21:00-05:00' },
    first_boot_message: 'Hello',
    size_budget_gb: 9,
    approved_by: { enrolment: 'pending', name: 'A. Person' },
  }
  for (const [k, v] of Object.entries(lathe)) {
    test(`${k}`, () => refused((r) => { r[k] = v }, k, /not something AurOS can do yet.*refuses it rather than record it and ignore it/))
  }
  const nested = {
    'organisation.helpdesk': (r) => { r.organisation.helpdesk = { label: 'Desk', phone: '+44 20 7946 0000' } },
    'organisation.logo': (r) => { r.organisation.logo = 'logo.png' },
    'prune.must_remove_at_least': (r) => { r.prune.must_remove_at_least = 40 },
    'desktop.guided_first_boot': (r) => { r.desktop = { guided_first_boot: false } },
    'desktop.taskbar_and_start_menu': (r) => { r.desktop = { taskbar_and_start_menu: true } },
    'desktop.double_click_to_open': (r) => { r.desktop = { double_click_to_open: true } },
    'kiosk.opens': (r) => { r.policy = 'kiosk'; r.apps = ['Firefox']; r.kiosk = { opens: 'https://example.org' } },
    'kiosk.allowed_sites': (r) => { r.policy = 'kiosk'; r.apps = ['Firefox']; r.kiosk = { allowed_sites: ['example.org'] } },
    'kiosk.restart_daily_at': (r) => { r.policy = 'kiosk'; r.apps = ['Firefox']; r.kiosk = { restart_daily_at: '03:30' } },
    'theme.accent': (r) => { r.theme = { accent: '#1f5c3d' } },
    'theme.text_scale': (r) => { r.theme = { text_scale: 1.1 } },
    'theme.preset': (r) => { r.theme = { preset: 'light' } },
  }
  for (const [path, change] of Object.entries(nested)) test(path, () => refused(change, path, /AurOS/))

  test('the ported LATHE examples, verbatim, are refused on every unported field', () => {
    // The LATHE example-school, as LATHE wrote it (flow lists put on one line; this parser does not
    // read a flow list across lines, and says so).
    const lathe = parseYaml([
      'schema: 1', 'name: example-school',
      'for: The 180 shared classroom laptops at a Marathi-medium secondary school. Pupils sign in to Google Workspace in the browser and do all their work there.',
      'organisation:', '  display_name: Example Vidyalaya', '  helpdesk: { label: School IT helpdesk, phone: "+91 20 2555 0143" }',
      'hardware:', '  machines: 180', '  models: [dell-latitude-e6440]', '  also_test: [bios-legacy]',
      'language: Marathi', 'keyboard: English (US)', 'timezone: Asia/Kolkata',
      'apps: [Firefox, Google Chrome, Scratch]',
      'prune:', '  keep_only_the_apps_above: true', '  also_keep: [printing]', '  also_remove: [games]', '  must_remove_at_least: 240',
      'policy: managed', 'desktop:', '  layout: browser-first',
      'theme: { preset: light, accent: "#1f5c3d", text_scale: 1.1 }',
      'updates: { install_between: "21:00-05:00" }', 'size_budget_gb: 9',
      'approved_by: { enrolment: pending, name: A. Deshmukh, role: IT Coordinator, date: "2026-09-18" }',
    ].join('\n'))
    const v = validate(lathe)
    const paths = new Set(v.errors.map((e) => e.path))
    for (const p of ['organisation.helpdesk', 'hardware', 'apps', 'prune.also_remove', 'prune.must_remove_at_least', 'desktop.layout',
      'theme.preset', 'theme.accent', 'theme.text_scale', 'updates', 'size_budget_gb', 'approved_by']) {
      assert.ok(paths.has(p), `${p} was not refused:\n${JSON.stringify(v.errors, null, 1)}`)
    }
    assert.match(v.errors.find((e) => e.path === 'desktop.layout').message, /"dock"/)
  })
})

describe('field rules', () => {
  test('schema must be exactly 1', () => {
    for (const s of [2, 0, '1', 1.5]) refused((r) => { r.schema = s }, 'schema', /only knows schema 1/)
  })
  test('name: lowercase-hyphen, not a shipped profile', () => {
    for (const n of ['Bad', 'a_b', 'a--b', '-a', 'a.b', 'a:b', 'x'.repeat(41)]) refused((r) => { r.name = n }, 'name', /not a valid name/)
    for (const n of RESERVED_NAMES) refused((r) => { r.name = n }, 'name', /ships with AurOS/)
    assert.ok(check((r) => { r.name = 'lincoln-high-2' }).ok)
  })
  test('for: twenty words', () => {
    refused((r) => { r.for = 'Some laptops.' }, 'for', /twenty/)
  })
  test('free text cannot carry shell syntax into the profile', () => {
    for (const evil of ['School"; rm -rf / #', 'School $(reboot)', 'School `id`', 'School \\', 'a‮b']) {
      refused((r) => { r.organisation.display_name = evil }, 'organisation.display_name')
      refused((r) => { r.for = `${r.for} ${evil}` }, 'for')
    }
    assert.ok(check((r) => { r.organisation.display_name = "St Mary's & St John's (Upper)" }).ok)
  })
  test('language: a name, not a code; known; not repeated', () => {
    refused((r) => { r.language = 'mr_IN.UTF-8' }, 'language', /locale code/)
    refused((r) => { r.language = 'Klingon' }, 'language', /not a language/)
    refused((r) => { r.other_languages = ['English (United Kingdom)'] }, 'other_languages', /already the main/)
    refused((r) => { r.other_languages = [] }, 'other_languages', /empty/)
    refused((r) => { r.other_languages = ['Hindi', 'Hindi'] }, 'other_languages', /twice/)
    const near = refused((r) => { r.language = 'Marthi' }, 'language')
    assert.match(near.message, /Marathi/)
  })
  test('keyboard: Latin main layout; a second script needs its switch and vice versa', () => {
    refused((r) => { r.keyboard = 'Marathi (InScript)' }, 'keyboard', /password/)
    refused((r) => { r.second_script = 'Marathi (InScript)' }, 'switch_scripts_with', /nobody can reach/)
    refused((r) => { r.switch_scripts_with = 'Alt + Shift' }, 'switch_scripts_with', /no second_script/)
    refused((r) => { r.second_script = 'English (UK)'; r.switch_scripts_with = 'Alt + Shift' }, 'second_script', /nothing to switch/)
    refused((r) => { r.second_script = 'Russian'; r.switch_scripts_with = 'Caps Lock' }, 'switch_scripts_with')
    assert.ok(check((r) => { r.second_script = 'Russian'; r.switch_scripts_with = 'Alt + Shift' }).ok)
  })
  test('timezone: a named zone', () => {
    for (const tz of ['auto', 'local', 'GeoIP', '+05:30', 'UTC+1', 'GMT-5', 'kolkata', 'Asia/Kolkata; reboot']) refused((r) => { r.timezone = tz }, 'timezone')
    for (const tz of ['UTC', 'Asia/Kolkata', 'America/Los_Angeles', 'America/Argentina/Buenos_Aires', 'Etc/GMT+5']) assert.ok(check((r) => { r.timezone = tz }).ok, tz)
  })
  test('timezone: a zone the image has, not just one shaped like a zone', () => {
    // Found by the adversarial review. build/forge links /etc/localtime to /usr/share/zoneinfo/<zone>
    // with `|| true`, so a zone that does not exist leaves a dangling link and a machine on UTC that
    // says nothing. Europe/Londn (a typo), Mars/Olympus_Mons and Asia/Calcutta — an old name that
    // Ubuntu 24.04 moved to tzdata-legacy, which the image does not install — all validated.
    for (const tz of ['Europe/Londn', 'Mars/Olympus_Mons', 'Asia/Calcutta', 'US/Eastern', 'Europe/London/Extra']) refused((r) => { r.timezone = tz }, 'timezone', /not a zone/)
    const typo = refused((r) => { r.timezone = 'Europe/Londn' }, 'timezone')
    assert.match(typo.message, /Europe\/London/)
  })
  test('apps: known, non-empty, no duplicates; refused names explain themselves', () => {
    refused((r) => { r.apps = [] }, 'apps', /no programs/)
    refused((r) => { r.apps = ['Files', 'Files'] }, 'apps', /twice/)
    refused((r) => { r.apps = 'Files' }, 'apps', /list/)
    for (const [a, why] of Object.entries(OPTIONS.refusedApps)) {
      const e = refused((r) => { r.apps = ['Files', a] }, 'apps')
      assert.ok(e.message.includes(why), `${a}'s reason is not the one in REFUSED_APPS`)
    }
    const near = refused((r) => { r.apps = ['Fire fox'] }, 'apps')
    assert.match(near.message, /Firefox/)
  })
  test('a program that installs software, on a machine whose person may not install, is refused', () => {
    for (const p of ['managed', 'locked', 'kiosk']) refused((r) => { r.policy = p; r.apps = ['Firefox', 'Software Centre'] }, 'apps', /refuses/)
    refused((r) => { r.policy = 'open'; r.apps = ['Program Installer']; r.desktop = { can_install_apps: false } }, 'apps', /refuses/)
    assert.ok(check((r) => { r.policy = 'open'; r.apps = ['Firefox', 'Software Centre', 'Program Installer'] }).ok)
  })
  test('a terminal undoes locked and kiosk', () => {
    refused((r) => { r.policy = 'locked'; r.apps = ['Firefox', 'Terminal'] }, 'apps', /command line/)
    refused((r) => { r.policy = 'open'; r.apps = ['Konsole']; r.desktop = { can_reach_a_terminal: false } }, 'apps', /contradict/)
    assert.ok(check((r) => { r.policy = 'managed'; r.apps = ['Firefox', 'Terminal'] }).ok)
  })
  test('policy: exactly four words', () => {
    for (const p of ['strict', 'Open', 'custom', '']) refused((r) => { r.policy = p }, 'policy', /exactly four/)
  })
  test('prune: also_keep only with keep_only true; also_remove only with keep_only false', () => {
    refused((r) => { r.prune = { keep_only_the_apps_above: false, also_keep: ['printing'] } }, 'prune.also_keep', /protects nothing/)
    refused((r) => { r.prune = { keep_only_the_apps_above: true, also_remove: ['bluetooth'] } }, 'prune.also_remove', /removes? nothing more/)
    refused((r) => { r.prune = { keep_only_the_apps_above: true, also_keep: ['Firefox'] } }, 'prune.also_keep', /Programs are kept by listing them in apps/)
    refused((r) => { r.prune = { keep_only_the_apps_above: 'yes' } }, 'prune.keep_only_the_apps_above', /true or false/)
    assert.ok(check((r) => { r.prune = { keep_only_the_apps_above: true, also_keep: ['printing', 'bluetooth'] } }).ok)
    assert.ok(check((r) => { r.prune = { keep_only_the_apps_above: false, also_remove: ['bluetooth', 'printing'] } }).ok)
  })
  test('prune.also_remove: groups that name nothing on this desktop are refused, with the reason', () => {
    for (const [g, why] of Object.entries(OPTIONS.absentGroups)) {
      const e = refused((r) => { r.prune = { keep_only_the_apps_above: false, also_remove: [g] } }, 'prune.also_remove')
      assert.ok(e.message.includes(why), g)
    }
    refused((r) => { r.prune = { keep_only_the_apps_above: false, also_remove: ['screen reader'] } }, 'prune.also_remove', /accessibility/)
    refused((r) => { r.prune = { keep_only_the_apps_above: false, also_remove: ['systemd'] } }, 'prune.also_remove', /has no name here/)
    refused((r) => { r.apps = ['VLC Media Player']; r.prune = { keep_only_the_apps_above: false, also_remove: ['media players'] } }, 'prune.also_remove', /says both/)
  })
  test('kiosk: keep-only, no desktop block, at most nine buttons; which program starts is not the recipe\'s to say', () => {
    const kiosk = (r) => { r.policy = 'kiosk'; r.apps = ['Firefox'] }
    assert.ok(check(kiosk).ok)
    refused((r) => { kiosk(r); r.prune.keep_only_the_apps_above = false }, 'prune.keep_only_the_apps_above', /every program/)
    refused((r) => { kiosk(r); r.desktop = { layout: 'tiles' } }, 'desktop', /no desktop/)
    // kiosk.starts reordered allowed_apps, which the shell reads as a set (fields.test.mjs, SET_VALUED).
    refused((r) => { kiosk(r); r.apps = ['Firefox', 'Calculator']; r.kiosk = { starts: 'Calculator' } }, 'kiosk.starts', /chosen by AurOS, not by the recipe/)
    refused((r) => { kiosk(r); r.kiosk = { starts: 'Firefox' } }, 'kiosk', /nothing for a kiosk block to say/)
    refused((r) => { kiosk(r); r.apps = Object.keys(OPTIONS.apps).filter((a) => !OPTIONS.apps[a].door).slice(0, 10) }, 'apps', /nine/)
    assert.ok(check((r) => { kiosk(r); r.apps = ['Firefox', 'Calculator'] }).ok, 'a kiosk with two programs no longer has to name one')
  })
  test('locked: an allow-list longer than the shell reads is refused, not truncated', () => {
    // Found by the adversarial review. aurshell reads policy.conf through src/common/theme.c, which
    // keeps 191 bytes of a value. Every program in the catalogue under policy: locked compiled to a
    // 237-byte allowed_apps: the last few (mousepad, tuxpaint, klavaro, vlc) were installed and
    // could never be opened, and validate, compile and the report all said they could.
    const all = Object.keys(OPTIONS.apps).filter((a) => !OPTIONS.apps[a].door)
    refused((r) => { r.policy = 'locked'; r.apps = all }, 'apps', /characters.*never be opened/)
    assert.ok(check((r) => { r.policy = 'managed'; r.apps = all }).ok, 'the same programs under managed (no allow-list) are fine')
    assert.ok(check((r) => { r.policy = 'locked'; r.apps = all.slice(0, 12) }).ok, 'a locked machine with a dozen programs is fine')
  })
  test('desktop: layouts by engine name, LATHE names answered with the nearest', () => {
    for (const [lathe, ours] of Object.entries({ windows: 'taskbar', mac: 'dock', simple: 'tiles', 'browser-first': 'dock' })) {
      const e = refused((r) => { r.desktop = { layout: lathe } }, 'desktop.layout')
      assert.match(e.message, new RegExp(`"${ours}"`))
    }
    refused((r) => { r.desktop = { layout: 'locked' } }, 'desktop.layout', /policy: kiosk/)
    for (const l of Object.keys(OPTIONS.layouts)) assert.ok(check((r) => { r.desktop = { layout: l } }).ok, l)
    refused((r) => { r.desktop = {} }, 'desktop', /empty/)
  })
  test('desktop: a permission the policy already withholds cannot be granted back', () => {
    refused((r) => { r.desktop = { can_install_apps: true } }, 'desktop.can_install_apps', /contradicts/)
    refused((r) => { r.policy = 'locked'; r.desktop = { can_reach_a_terminal: true } }, 'desktop.can_reach_a_terminal', /contradicts/)
    assert.ok(check((r) => { r.policy = 'open'; r.desktop = { can_install_apps: true, can_reach_a_terminal: false, can_choose_wifi: false } }).ok)
  })
  test('desktop.screen_off_minutes: 0..120 whole minutes', () => {
    for (const m of [-1, 121, 1.5, '10', 100000]) refused((r) => { r.desktop = { screen_off_minutes: m } }, 'desktop.screen_off_minutes')
    for (const m of [0, 1, 120]) assert.ok(check((r) => { r.desktop = { screen_off_minutes: m } }).ok)
  })
  test('theme: by name; LATHE presets answered', () => {
    refused((r) => { r.theme = 'light' }, 'theme', /"sandstone"/)
    refused((r) => { r.theme = 'high contrast' }, 'theme', /no "high contrast" theme/)
    for (const t of Object.keys(OPTIONS.themes)) assert.ok(check((r) => { r.theme = t }).ok, t)
  })
  test('a misspelt field is refused with the nearest real one, at every level', () => {
    const top = refused((r) => { r.langauge = 'French' }, 'langauge', /not a field/)
    assert.match(top.message, /"language"/)
    const nested = refused((r) => { r.prune.also_remvoe = ['bluetooth'] }, 'prune.also_remvoe', /not a field/)
    assert.match(nested.message, /"also_remove"/)
  })
  test('what validate accepts, compile writes: no free text passes one and stops the other', () => {
    // Found by the adversarial review: display_name: "A\nB" (a quoted \n, or a | block) validated,
    // and compile then threw "refusing to write profile_name". validate is the promise; a recipe it
    // calls fine must compile.
    const texts = ['A\nB', 'A\n', '\nA', 'A\r\nB', "St Mary's", 'A;B|C&D<E>(F)#G!H~I%J', 'A B', 'A B', 'Ünïcödé 学校']
    for (const t of texts) {
      const r = minimal(); r.organisation.display_name = t
      if (validate(r).ok) assert.doesNotThrow(() => compile(r), JSON.stringify(t))
    }
    refused((r) => { r.organisation.display_name = 'Line one\nLine two' }, 'organisation.display_name', /one line/)
    assert.ok(check((r) => { r.for = `${r.for}\nAnd a second line.` }).ok, 'for: is a paragraph and may span lines')
  })
  test('a word every JavaScript object answers to is not an option (constructor, toString, __proto__)', () => {
    // Found by the adversarial review: the option tables were plain objects, so `LANGUAGES[L]` was
    // truthy for L = "constructor". `policy: constructor` validated and compiled to
    // kiosk_mode="undefined" and allow_*="undefined", which build/forge's yesno() reads as YES — a
    // fully open machine from a recipe validate called fine. `theme: valueOf` validated and would
    // have died in stage 5; `switch_scripts_with: constructor` wrote the text of Object's source
    // into /etc/default/keyboard.
    const words = ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__', '__defineGetter__']
    const at = {
      language: (r, w) => { r.language = w },
      other_languages: (r, w) => { r.other_languages = [w] },
      keyboard: (r, w) => { r.keyboard = w },
      second_script: (r, w) => { r.second_script = w; r.switch_scripts_with = 'Alt + Shift' },
      switch_scripts_with: (r, w) => { r.second_script = 'Russian'; r.switch_scripts_with = w },
      policy: (r, w) => { r.policy = w },
      apps: (r, w) => { r.apps = ['Files', w] },
      'prune.also_keep': (r, w) => { r.prune.also_keep = [w] },
      'prune.also_remove': (r, w) => { r.prune = { keep_only_the_apps_above: false, also_remove: [w] } },
      'desktop.layout': (r, w) => { r.policy = 'open'; r.desktop = { layout: w } },
      theme: (r, w) => { r.theme = w },
    }
    for (const w of words) {
      for (const [path, change] of Object.entries(at)) {
        const hit = refused((r) => change(r, w), path)
        assert.doesNotMatch(hit.message, /native code|function |undefined/, `${path} = ${w}: ${hit.message}`)
      }
      // and as a key, at the top and inside a block
      const top = refused((r) => { Object.defineProperty(r, w, { value: 1, enumerable: true }) }, w)
      assert.doesNotMatch(top.message, /native code|function /, top.message)
      const nested = refused((r) => { Object.defineProperty(r.organisation, w, { value: 1, enumerable: true }) }, `organisation.${w}`)
      assert.doesNotMatch(nested.message, /native code|function /, nested.message)
    }
  })
  test('a huge value is refused quickly: the did-you-mean search is not a denial of service', () => {
    // Found by the adversarial review: the nearest-name search is quadratic in the value's length,
    // and a 20 kB timezone took four seconds of a browser tab against the zone list.
    for (const k of ['timezone', 'language', 'keyboard', 'theme', 'policy', 'name']) {
      const r = minimal(); r[k] = 'Q'.repeat(1_000_000)
      const t = Date.now()
      assert.equal(validate(r).ok, false, k)
      assert.ok(Date.now() - t < 1000, `${k}: ${Date.now() - t} ms`)
    }
    const r = minimal(); r['Q'.repeat(1_000_000)] = 1
    const t = Date.now(); validate(r)
    assert.ok(Date.now() - t < 1000, `a huge key: ${Date.now() - t} ms`)
  })
  test('validate never throws, whatever it is given', () => {
    const r = example('example-school')
    const junk = [null, 0, '', [], {}, true, { a: { b: { c: 1 } } }, [1, 2]]
    for (const k of Object.keys(r)) {
      for (const j of junk) {
        const x = clone(r); x[k] = j
        assert.doesNotThrow(() => validate(x), `${k} = ${JSON.stringify(j)}`)
        assert.equal(validate(x).ok, false, `${k} = ${JSON.stringify(j)} was accepted`)
      }
    }
  })
})
