#!/usr/bin/env node
// PROVE-RED — the recipe tests, tested.
//
// LATHE D34: every check must be watched failing. A test file that only ever demonstrates the happy
// path looks identical to one that works. Each mutation below puts one specific bug into a scratch
// copy of recipes/, runs the named test file there, and requires a test whose NAME matches `catcher`
// to fail. A mutation that reddens some other test does not count: the named test is the one that
// understands the bug, and the one a reader will be sent to.
//
//   node recipes/test/prove-red.mjs            every mutation must be caught
//   node recipes/test/prove-red.mjs M3 M7      just these
//   node recipes/test/prove-red.mjs --list
//
// The scratch tree mirrors the real layout: <tmp>/recipes is a copy, and build/, profiles/, themes/,
// shells/, src/ and rootfs/ are symlinks to the real ones, so build/forge resolve runs for real.
// The real recipes/ is never written.

import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RECIPES = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = resolve(RECIPES, '..')
const LIB = 'recipes/lib/recipe.mjs'

const MUTATIONS = [
  { id: 'M1', why: 'compile writes a key forge reads and then copies into policy.conf for nothing to read',
    file: LIB, find: "  set('kiosk_mode', P.kiosk_mode)\n", to: "  set('kiosk_mode', P.kiosk_mode)\n  set('update_channel', 'managed')\n",
    test: 'recipes/test/forge.test.mjs', catcher: /never one of the inert keys/ },
  { id: 'M2', why: 'compile writes a key build/forge never reads — LATHE\'s install_between, again',
    file: LIB, find: "  set('timezone', r.timezone, `timezone: ${r.timezone}`)\n", to: "  set('timezone', r.timezone, `timezone: ${r.timezone}`)\n  set('install_between', '21:00-05:00')\n",
    test: 'recipes/test/forge.test.mjs', catcher: /every key, in every recipe/ },
  { id: 'M3', why: 'a field is accepted and reaches the image as nothing (D38)',
    file: LIB, find: "  if ('screen_off_minutes' in desk) set(", to: "  if (false) set(",
    test: 'recipes/test/fields.test.mjs', catcher: /^desktop\.screen_off_minutes$/ },
  { id: 'M4', why: 'a second layout is installed with no key that reaches it',
    file: LIB, find: '    kbOptions = TOGGLES[r.switch_scripts_with]\n', to: '',
    test: 'recipes/test/fields.test.mjs', catcher: /^switch_scripts_with$/ },
  { id: 'M5', why: 'a locked allow-list longer than the shell reads is accepted, and its last programs can never be opened',
    file: LIB, find: '    if (list.length > ALLOW_LIST_MAX) err(', to: '    if (false) err(',
    test: 'recipes/test/validate.test.mjs', catcher: /an allow-list longer than the shell reads is refused/ },
  { id: 'M6', why: 'free text with shell syntax gets past validation into a file bash sources',
    file: LIB, find: '    if (SHELL_UNSAFE.test(v)) {', to: '    if (false) {',
    test: 'recipes/test/validate.test.mjs', catcher: /free text cannot carry shell syntax/ },
  { id: 'M7', why: 'the parser reads an unquoted "yes" as true, like YAML 1.1 — a word two tools disagree on',
    file: LIB, find: "  if (BOOLISH.test(s)) throw", to: "  if (BOOLISH.test(s)) return /^[yYoO]/.test(s) && s !== 'off'; if (false) throw",
    test: 'recipes/test/parse.test.mjs', catcher: /refuses unquoted yes/ },
  { id: 'M8', why: 'also_remove under keep_only: true is accepted — credited for removals it did not make (D38)',
    file: LIB, find: "        if (keepOnly === true) err('prune.also_remove',", to: "        if (false) err('prune.also_remove',",
    test: 'recipes/test/validate.test.mjs', catcher: /also_keep only with keep_only true; also_remove only/ },
  { id: 'M9', why: 'emitYaml stops sorting set-like lists, so the same recipe has two texts',
    file: LIB, find: "const SORTED_LISTS = new Set(['other_languages', 'apps', 'prune.also_keep', 'prune.also_remove'])", to: 'const SORTED_LISTS = new Set([])',
    test: 'recipes/test/parse.test.mjs', catcher: /is deterministic in key order/ },
  { id: 'M10', why: 'the compiler\'s copy of desktop.profile drifts from the file',
    file: LIB, find: "  software_store: 'gnome-software',\n  browser: 'firefox',", to: "  software_store: 'none',\n  browser: 'firefox',",
    test: 'recipes/test/options.test.mjs', catcher: /BASE equals `build\/forge resolve desktop`/ },
  { id: 'M11', why: 'keep-only stops removing printing and bluetooth, while the report still says it did',
    file: LIB, find: "  const hardware = BASE.packages_hardware.filter((p) => !capDropped.includes(p))", to: '  const hardware = [...BASE.packages_hardware]',
    test: 'recipes/test/compile.test.mjs', catcher: /every package the report says was removed is absent/ },
  { id: 'M12', why: 'policy: locked stops restricting which programs can be opened',
    file: LIB, find: "  if (r.policy !== 'locked' && r.policy !== 'kiosk') return ''", to: "  if (r.policy !== 'kiosk') return ''",
    test: 'recipes/test/compile.test.mjs', catcher: /locked allows only its programs/ },
  { id: 'M13', why: 'the forge key collector counts a variable mentioned only in a comment as read',
    file: 'recipes/test/forge.test.mjs', find: '    if (/^\\s*#/.test(line)) continue\n', to: '',
    test: 'recipes/test/forge.test.mjs', catcher: /the key collector can go red/ },
  { id: 'M14', why: 'a committed example profile no longer matches its recipe',
    file: 'recipes/examples/example-school.yaml', find: 'timezone: Asia/Kolkata', to: 'timezone: Asia/Calcutta',
    test: 'recipes/test/compile.test.mjs', catcher: /profiles\/example-school\.profile === compile/ },
  { id: 'M15', why: 'the option tables answer to Object.prototype again: policy: constructor validates and compiles to allow_*="undefined"',
    file: LIB, find: 'function table (o) { return Object.assign(Object.create(null), o) }', to: 'function table (o) { return o }',
    test: 'recipes/test/validate.test.mjs', catcher: /every JavaScript object answers to is not an option/ },
  { id: 'M16', why: 'the parser takes a __proto__ key as a prototype, and the key vanishes',
    file: LIB, find: "    if (key === '__proto__') throw new YamlError(l.no, PROTO_KEY_WHY)\n", to: '',
    test: 'recipes/test/parse.test.mjs', catcher: /^refuses a __proto__ key$/ },
]

function scratch () {
  const dir = mkdtempSync(join(tmpdir(), 'auros-prove-red-'))
  cpSync(RECIPES, join(dir, 'recipes'), { recursive: true })
  for (const d of ['build', 'profiles', 'themes', 'shells', 'src', 'rootfs']) symlinkSync(join(ROOT, d), join(dir, d))
  return dir
}

function runTests (dir, file) {
  // NODE_TEST_CONTEXT is removed because a `node --test` inside another one runs NOTHING and exits 0
  // ("run() is being called recursively"), which would make every mutation look survived and the
  // baseline look green. The baseline below also requires that tests actually ran.
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', join(dir, file)], { cwd: dir, env, encoding: 'utf8', timeout: 300_000 })
  const failed = [...(r.stdout ?? '').matchAll(/^\s*not ok \d+ - (.*)$/gm)].map((m) => m[1].trim())
  const passed = Number(/^# pass (\d+)$/m.exec(r.stdout ?? '')?.[1] ?? 0)
  return { code: r.status, failed, passed, out: (r.stdout ?? '') + (r.stderr ?? '') }
}

const args = process.argv.slice(2)
if (args.includes('--list')) {
  for (const m of MUTATIONS) console.log(`${m.id.padEnd(4)} ${m.test.replace('recipes/test/', '').padEnd(20)} ${m.why}`)
  process.exit(0)
}
const chosen = args.length ? MUTATIONS.filter((m) => args.includes(m.id)) : MUTATIONS
if (chosen.length === 0) { console.error(`prove-red: no mutation named ${args.join(' ')}`); process.exit(2) }

// The baseline: every test file this harness uses must be GREEN in an unmutated scratch tree.
// Otherwise a "caught" mutation might only be an environment that was red already.
{
  const dir = scratch()
  try {
    for (const t of new Set(chosen.map((m) => m.test))) {
      const r = runTests(dir, t)
      if (r.code !== 0) { console.error(`prove-red: ${t} is not green before any mutation:\n${r.failed.join('\n')}`); process.exit(2) }
      if (r.passed === 0) { console.error(`prove-red: ${t} ran no tests at all — a baseline of nothing proves nothing:\n${r.out.slice(-1500)}`); process.exit(2) }
    }
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

let survived = 0
for (const m of chosen) {
  const dir = scratch()
  try {
    const path = join(dir, m.file)
    const text = readFileSync(path, 'utf8')
    const count = text.split(m.find).length - 1
    if (count !== 1) {
      // A mutation that matched nothing proves nothing: that is the failure this file exists to stop.
      console.log(`ERROR    ${m.id}  the text to mutate appears ${count} times in ${m.file}, not once`)
      survived++
      continue
    }
    writeFileSync(path, text.replace(m.find, m.to))
    const r = runTests(dir, m.test)
    const caught = r.failed.some((n) => m.catcher.test(n))
    if (caught) console.log(`caught   ${m.id}  ${m.why}`)
    else {
      survived++
      console.log(`SURVIVED ${m.id}  ${m.why}\n         expected a failing test matching ${m.catcher}; failing: ${JSON.stringify(r.failed)}`)
    }
  } finally { rmSync(dir, { recursive: true, force: true }) }
}
console.log(`\nprove-red: ${chosen.length - survived}/${chosen.length} mutations caught by the test named for them`)
process.exit(survived ? 1 : 0)
