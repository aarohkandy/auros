// Shared by recipes/test/*.test.mjs. Not a test file itself.
import { readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { parseYaml } from '../lib/recipe.mjs'

export const RECIPES = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const ROOT = resolve(RECIPES, '..')
export const FORGE = join(ROOT, 'build', 'forge')
export const CLI = join(RECIPES, 'bin', 'auros-recipe')
export const EXAMPLES = ['example-kiosk', 'example-school', 'example-workstation']

export const exampleText = (name) => readFileSync(join(RECIPES, 'examples', `${name}.yaml`), 'utf8')
export const example = (name) => parseYaml(exampleText(name))
export const clone = (x) => JSON.parse(JSON.stringify(x))

/**
 * The assignments in a profile, as build/forge would see them after `source` — for the single-line
 * KEY="value" form the compiler writes. Comments and blank lines are ignored, because a comment that
 * changes is not a machine that changes.
 */
export function assignments (profileText) {
  const out = {}
  for (const line of profileText.split('\n')) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue
    const m = /^([a-z_][a-z0-9_]*)="([^"]*)"$/.exec(line)
    if (!m) throw new Error(`not a KEY="value" line: ${line}`)
    if (m[1] in out) throw new Error(`${m[1]} assigned twice`)
    out[m[1]] = m[2]
  }
  return out
}

/** `build/forge resolve <profile>` — the merged variables of a profile and everything it inherits. */
export function resolveProfile (profile) {
  const text = execFileSync('bash', [FORGE, 'resolve', profile], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const out = {}
  for (const line of text.split('\n')) {
    const m = /^([a-z_][a-z0-9_]*)="(.*)"$/.exec(line)
    if (m) out[m[1]] = m[2]
  }
  return out
}

/** A minimal recipe that validates, for tests that change one thing. */
export function minimal () {
  return {
    schema: 1,
    name: 'test-fleet',
    for: 'Twenty-five shared laptops in a small public library, used by visitors for job applications, email and printing forms, and by staff for the catalogue.',
    organisation: { display_name: 'Test Library' },
    language: 'English (United Kingdom)',
    keyboard: 'English (UK)',
    timezone: 'Europe/London',
    apps: ['Files', 'Firefox'],
    prune: { keep_only_the_apps_above: true },
    policy: 'managed',
  }
}
