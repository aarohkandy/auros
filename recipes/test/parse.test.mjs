// The YAML subset: what it reads, what it writes, and what it refuses — loudly, with a line number.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { parseYaml, emitYaml, YamlError } from '../lib/recipe.mjs'
import { EXAMPLES, example, exampleText, minimal } from './helpers.mjs'

const refuses = (text, re, line) => {
  assert.throws(() => parseYaml(text), (e) => {
    assert.ok(e instanceof YamlError, `expected a YamlError, got ${e}`)
    if (re) assert.match(e.message, re)
    if (line !== undefined) assert.equal(e.line, line, `wrong line in: ${e.message}`)
    return true
  })
}

describe('reads what a recipe contains', () => {
  test('maps, nesting, block and flow lists, comments', () => {
    const doc = parseYaml([
      '# a comment',
      'a: 1            # trailing comment',
      'b:',
      '  c: hello world',
      '  d: [x, "y, z", \'it\'\'s\']',
      'e:',
      '  - one',
      '  - two # not part of it',
      'f: { k: v, n: 2 }',
      'g: true',
      'h: 1.5',
      'i: "quoted: colon # hash"',
      'j: https://example.org/a#frag',
      '',
    ].join('\n'))
    assert.deepEqual(doc, {
      a: 1,
      b: { c: 'hello world', d: ['x', 'y, z', "it's"] },
      e: ['one', 'two'],
      f: { k: 'v', n: 2 },
      g: true,
      h: 1.5,
      i: 'quoted: colon # hash',
      j: 'https://example.org/a#frag',
    })
  })
  test('a list may sit at the same indentation as its key', () => {
    assert.deepEqual(parseYaml('apps:\n- Files\n- Firefox\nn: 1\n'), { apps: ['Files', 'Firefox'], n: 1 })
  })
  test('folded and literal block text', () => {
    assert.deepEqual(parseYaml('a: >\n  one\n  two\n\n  three\nb: >-\n  x\n  y\nc: |\n  l1\n  l2\nd: |-\n  k\n'),
      { a: 'one two\nthree\n', b: 'x y', c: 'l1\nl2\n', d: 'k' })
  })
  test('a list of maps', () => {
    assert.deepEqual(parseYaml('t:\n  - app: A\n    result: fails\n  - app: B\n'), { t: [{ app: 'A', result: 'fails' }, { app: 'B' }] })
  })
  test('CRLF and a byte-order mark are read as if they were not there', () => {
    assert.deepEqual(parseYaml('\ufeffa: 1\r\nb:\r\n  - x\r\n'), { a: 1, b: ['x'] })
  })
  test('unicode text is text', () => {
    assert.deepEqual(parseYaml('m: नमस्कार! काही अडचण असल्यास सांगा.\n'), { m: 'नमस्कार! काही अडचण असल्यास सांगा.' })
  })
  test('every example parses', () => {
    for (const n of EXAMPLES) assert.equal(typeof example(n), 'object')
  })
})

describe('refuses everything outside the subset, with the line', () => {
  const cases = [
    ['a tab in indentation', 'a:\n\tb: 1\n', /tab/, 2],
    ['an anchor', 'a: &x 1\n', /anchor/, 1],
    ['an alias', 'a: *x\n', /alias/, 1],
    ['a tag', 'a: !!str 1\n', /tag/, 1],
    ['a document marker', '---\na: 1\n', /document/, 1],
    ['a merge key', 'a:\n  <<: 1\n', /merge|not a plain key|key: value/, 2],
    ['a duplicate key', 'a: 1\nb: 2\na: 3\n', /twice/, 3],
    ['unquoted yes', 'a: yes\n', /ambiguous/, 1],
    ['unquoted No', 'a: No\n', /ambiguous/, 1],
    ['unquoted off', 'a: off\n', /ambiguous/, 1],
    ['null', 'a: null\n', /nothing/, 1],
    ['~', 'a: ~\n', /nothing/, 1],
    ['a key with no value and no children', 'a:\nb: 1\n', /no value/, 1],
    ['hex', 'schema: 0x1\n', /number/, 1],
    ['plus sign', 'schema: +1\n', /number/, 1],
    ['exponent', 'n: 1e3\n', /number/, 1],
    ['leading zero', 'n: 010\n', /number/, 1],
    ['bare decimal point', 'n: .5\n', /number/, 1],
    ['an unquoted time', 'at: 03:30\n', /time/, 1],
    ['an unquoted date', 'on: 2026-09-18\n', /date/, 1],
    ['a flow list across lines', 'a: [x,\n  y]\n', /not closed/, 1],
    ['a nested flow list', 'a: [x, [y]]\n', /inside a one-line list/, 1],
    ['an empty flow item', 'a: [x, , y]\n', /empty item/, 1],
    ['a colon-space in a plain value', 'a: b: c\n', /quotes/, 1],
    ['an unclosed quote', 'a: "abc\n', /not closed/, 1],
    ['an unknown escape', 'a: "\\q"\n', /escape/, 1],
    ['a list at the top', '- a\n- b\n', /not a list/, 1],
    ['a list inside a list', 'a:\n  - - x\n', /list inside a list/, 2],
    ['bad indentation under a value', 'a: 1\n  b: 2\n', /indented more/, 2],
    ['an indented first line', '  a: 1\n', /must not be indented/, 1],
    ['a line that is not key: value', 'a: 1\njust words\n', /not "key: value"/, 2],
    ['a quoted key', '"a": 1\n', /quoted keys/, 1],
    ['an empty list item', 'a:\n  -\n', /empty list item/, 2],
    ['a block scalar with keep (+)', 'a: >+\n  x\n', /not supported/, 1],
    ['an empty document', '# only a comment\n', /empty/, 1],
  ]
  for (const [name, text, re, line] of cases) test(`refuses ${name}`, () => refuses(text, re, line))

  test('the controls: each refused shape, written the accepted way, parses', () => {
    // Without these, every refusal above could come from a parser that refuses everything.
    assert.deepEqual(parseYaml('a: "yes"\nb: true\nc: "03:30"\nd: "2026-09-18"\ne: 1\nf: "0x1"\n'),
      { a: 'yes', b: true, c: '03:30', d: '2026-09-18', e: 1, f: '0x1' })
  })
})

describe('emitYaml', () => {
  test('round-trips every example: parse(emit(r)) equals r with its lists sorted', () => {
    for (const n of EXAMPLES) {
      const r = example(n)
      const back = parseYaml(emitYaml(r))
      const norm = JSON.parse(JSON.stringify(r))
      norm.apps.sort()
      if (norm.other_languages) norm.other_languages.sort()
      if (norm.prune.also_keep) norm.prune.also_keep.sort()
      assert.deepEqual(back, norm, n)
    }
  })
  test('is a fixed point: emit(parse(emit(r))) === emit(r)', () => {
    for (const n of EXAMPLES) {
      const once = emitYaml(example(n))
      assert.equal(emitYaml(parseYaml(once)), once, n)
    }
  })
  test('is deterministic in key order: shuffling the input changes nothing', () => {
    const r = example('example-school')
    const shuffled = Object.fromEntries(Object.entries(r).reverse())
    shuffled.apps = [...r.apps].reverse()
    assert.equal(emitYaml(shuffled), emitYaml(r))
  })
  test('writes the canonical field order and a comment for every top-level field', () => {
    const text = emitYaml(minimal())
    const keys = text.split('\n').filter((l) => /^[a-z_]+:/.test(l)).map((l) => l.split(':')[0])
    assert.deepEqual(keys, ['schema', 'name', 'for', 'organisation', 'language', 'keyboard', 'timezone', 'apps', 'prune', 'policy'])
    for (const k of keys) {
      const i = text.split('\n').findIndex((l) => l.startsWith(`${k}:`))
      assert.match(text.split('\n')[i - 1], /^# /, `no comment above ${k}`)
    }
  })
  test('quotes exactly what would otherwise be read differently, and round-trips it', () => {
    const tricky = ['yes', 'No', '03:30', '2026-09-18', '0x1', '1e3', '12', 'true', 'a: b', 'x #y', '#lead', '- dash', '[x]', '{y}', ' pad', 'tab\there', 'line\nbreak', '', 'it\'s', 'plain words', 'ünïcödé', '\u202eevil']
    const r = { notes: tricky }
    const back = parseYaml(emitYaml(r))
    assert.deepEqual(back, r)
  })
  test('folded `for` text round-trips, with and without its final newline', () => {
    const words = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ')
    for (const v of [words, words + '\n']) assert.equal(parseYaml(emitYaml({ for: v })).for, v)
    assert.equal(parseYaml(exampleText('example-school')).for.endsWith('\n'), true)
  })
})
