// A FIELD THAT CHANGES NOTHING IS A LIE.
//
// LATHE D38: `updates.install_between`, `hardware.also_test` and `prune.also_keep` (under
// keep_only: false) were validated, printed into the customer's pull request — and reached the image
// as nothing. They were found by asserting that every difference in the YAML makes a difference in
// the output. This is that assertion, for every field this form has:
//
//   PROBES   each field, two values, everything else fixed: the compiled ASSIGNMENTS must differ
//            (comments do not count — a comment that changes is not a machine that changes), or the
//            second value must be refused with a sentence.
//   INVERSE  across the three examples, swap any one top-level field between two of them: the
//            profile must change, or the swap must be refused.
//   COMPLETE every path in FIELDS has a probe, so a new field cannot arrive without proving itself.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { compile, validate, FIELDS } from '../lib/recipe.mjs'
import { EXAMPLES, example, clone, assignments } from './helpers.mjs'
import { PROBES } from './probes.mjs'

// Values the engine reads as SETS, compared as sets. An order that changes in the profile and is
// thrown away by the machine is a comment by another name. Found by the adversarial review:
// `kiosk.starts` reordered allowed_apps and nothing else — and src/aurshell/apps.c reads
// allowed_apps only as a membership test (allowed()), then sorts the programs by its own rank_of()
// (a browser first) and the kiosk starts index 0 of THAT order. apt, locale-gen and the package
// lists are no different: order is not an instruction any of them takes.
const SET_VALUED = ['allowed_apps', 'packages_apps', 'packages_files', 'packages_hardware', 'packages_extra', 'extra_locales']
const asMachine = (values) => {
  const out = { ...values }
  for (const k of SET_VALUED) if (k in out) out[k] = out[k].split(/[\s,]+/).filter(Boolean).sort().join(' ')
  return out
}
const build = (r) => {
  const v = validate(r)
  if (!v.ok) return { refused: v.errors }
  return { values: asMachine(assignments(compile(r).profile)) }
}
const diff = (x, y) => [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((k) => x[k] !== y[k])

describe('every field changes the compiled profile', () => {
  for (const p of PROBES) {
    test(p.path, () => {
      const ra = p.base(); p.set(ra, p.a)
      const rb = p.base(); p.set(rb, p.b)
      const A = build(ra)
      assert.ok(A.values, `${p.path}=${JSON.stringify(p.a)} was refused: ${JSON.stringify(A.refused)}`)
      const B = build(rb)
      if (p.refusedB) {
        assert.ok(B.refused, `${p.path}=${JSON.stringify(p.b)} should be refused`)
        return
      }
      assert.ok(B.values, `${p.path}=${JSON.stringify(p.b)} was refused: ${JSON.stringify(B.refused)}`)
      assert.notDeepEqual(diff(A.values, B.values), [],
        `${p.path}: ${JSON.stringify(p.a)} and ${JSON.stringify(p.b)} compile to the same profile. A field that changes nothing is a lie.`)
    })
  }
  test('every field in the form has a probe', () => {
    const probed = new Set(PROBES.map((p) => p.path))
    for (const f of FIELDS) assert.ok(probed.has(f.path), `${f.path} has no probe in recipes/test/probes.mjs`)
    for (const p of probed) assert.ok(FIELDS.some((f) => f.path === p), `probe for ${p}, which is not a field`)
  })
  test('the probe can go red: a field the compiler ignored would be caught', () => {
    // A recipe and the same recipe with a comment-only difference compile to equal assignments.
    const r = example('example-school')
    const a = assignments(compile(r).profile)
    const b = assignments(compile(r).profile.replace('# timezone: Asia/Kolkata', '# timezone: anything at all'))
    assert.deepEqual(diff(a, b), [])
  })
})

describe('inverse, across the examples (LATHE test/differ.test.ts)', () => {
  for (const x of EXAMPLES) {
    for (const y of EXAMPLES) {
      if (x === y) continue
      test(`${x} <- each field of ${y}`, () => {
        const X = example(x); const Y = example(y)
        const base = build(X).values
        for (const k of new Set([...Object.keys(X), ...Object.keys(Y)])) {
          if (k === 'name' || JSON.stringify(X[k]) === JSON.stringify(Y[k])) continue
          const swapped = clone(X)
          if (k in Y) swapped[k] = clone(Y[k]); else delete swapped[k]
          const out = build(swapped)
          if (out.refused) {
            for (const e of out.refused) assert.ok(e.message.length > 20, `refusal with no sentence: ${JSON.stringify(e)}`)
            continue
          }
          assert.notDeepEqual(diff(base, out.values), [], `${x} with ${y}'s ${k} compiles to the same profile`)
        }
      })
    }
  }
})
