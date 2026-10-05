// One probe per field of the recipe form: two values for that field, everything else fixed. Used by
// fields.test.mjs (does the field change the profile?) and forge.test.mjs (is every key the compiler
// can write one that build/forge reads?). Not a test file.
import { minimal } from './helpers.mjs'

const put = (path) => (r, v) => {
  const parts = path.split('.')
  let o = r
  for (const p of parts.slice(0, -1)) o = (o[p] ??= {})
  if (v === undefined) delete o[parts.at(-1)]
  else o[parts.at(-1)] = v
}
const open = () => { const r = minimal(); r.policy = 'open'; return r }
const twoScripts = () => { const r = minimal(); r.second_script = 'Russian'; r.switch_scripts_with = 'Alt + Shift'; return r }
const notKeepOnly = () => { const r = minimal(); r.prune = { keep_only_the_apps_above: false }; return r }
const withDesktop = (base) => () => { const r = base(); r.desktop = { layout: 'tiles' }; return r }

/**
 * path   the field
 * base   a valid recipe to change
 * a, b   two values (undefined = the field left out)
 * refusedB  b is expected to be REFUSED rather than to compile differently — the only honest
 *           alternative to changing the profile (LATHE's differ test, inverse property)
 */
export const PROBES = [
  { path: 'schema', base: minimal, a: 1, b: 2, refusedB: true },
  { path: 'name', base: minimal, a: 'fleet-one', b: 'fleet-two' },
  { path: 'for', base: minimal, a: minimal().for, b: 'Forty laptops on two trolleys in a primary school, shared between six classes for reading practice, typing lessons and looking things up for projects.' },
  { path: 'organisation', base: minimal, a: { display_name: 'North Library' }, b: { display_name: 'South Library' } },
  { path: 'organisation.display_name', base: minimal, a: 'North Library', b: 'South Library' },
  { path: 'language', base: minimal, a: 'English (United Kingdom)', b: 'French' },
  { path: 'other_languages', base: minimal, a: undefined, b: ['French'] },
  { path: 'keyboard', base: minimal, a: 'English (UK)', b: 'French' },
  { path: 'second_script', base: twoScripts, a: 'Russian', b: 'Greek' },
  { path: 'switch_scripts_with', base: twoScripts, a: 'Alt + Shift', b: 'Ctrl + Spacebar' },
  { path: 'timezone', base: minimal, a: 'Europe/London', b: 'Europe/Paris' },
  { path: 'apps', base: minimal, a: ['Files', 'Firefox'], b: ['Files', 'Firefox', 'GIMP'] },
  { path: 'prune', base: minimal, a: { keep_only_the_apps_above: true }, b: { keep_only_the_apps_above: false } },
  { path: 'prune.keep_only_the_apps_above', base: minimal, a: true, b: false },
  { path: 'prune.also_keep', base: minimal, a: undefined, b: ['printing'] },
  { path: 'prune.also_remove', base: notKeepOnly, a: undefined, b: ['bluetooth'] },
  { path: 'policy', base: minimal, a: 'managed', b: 'locked' },
  { path: 'desktop', base: minimal, a: undefined, b: { layout: 'tiles' } },
  { path: 'desktop.layout', base: withDesktop(minimal), a: 'tiles', b: 'taskbar' },
  { path: 'desktop.can_install_apps', base: open, a: true, b: false },
  { path: 'desktop.can_reach_a_terminal', base: minimal, a: true, b: false },
  { path: 'desktop.can_choose_wifi', base: minimal, a: true, b: false },
  { path: 'desktop.screen_off_minutes', base: minimal, a: 5, b: 15 },
  { path: 'theme', base: minimal, a: undefined, b: 'slate' },
].map((p) => ({ ...p, set: put(p.path) }))
