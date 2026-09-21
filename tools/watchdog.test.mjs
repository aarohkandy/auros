#!/usr/bin/env node --test
// watchdog — every condition, red AND green, against canned GitHub API JSON.
//
//   node --test tools/watchdog.test.mjs
//
// The canned responses copy the SHAPE of real `gh api` output (probed 2026-09-20, including the
// auros-base nightly run rejected as an invalid workflow file: conclusion `failure`, zero jobs). The
// fake API throws on any path it does not know, so a renamed endpoint fails here instead of reading
// as "nothing found". Every red case is paired with the same fixture minus its one defect, asserting
// green — without the pair a watchdog that always screamed would pass.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { check, sync, thresholds } from './watchdog.mjs'

const NOW = Date.parse('2026-09-20T12:00:00Z')
const ago = (h) => new Date(NOW - h * 3600e3).toISOString()
const REPOS = { meta: 'o/auros', base: 'o/auros-base', recipes: 'o/auros-recipes' }
const T = thresholds({})
const b64 = (s) => ({ content: Buffer.from(s).toString('base64'), encoding: 'base64' })

const run = (over = {}) => ({ id: 1, status: 'completed', conclusion: 'success', updated_at: ago(2),
  html_url: 'https://github.com/o/x/actions/runs/1', event: 'schedule', ...over })
const wf = (path, state = 'active') => ({ path, state, html_url: `https://github.com/x/${path}` })

/** A healthy world. Each test breaks exactly one thing in it. */
function world () {
  return {
    'repos/o/auros-base/actions/workflows/nightly.yml/runs?event=schedule&status=completed&per_page=1':
      { total_count: 1, workflow_runs: [run()] },
    'repos/o/auros-recipes/actions/workflows/propagate.yml/runs?event=schedule&status=completed&per_page=1':
      { total_count: 1, workflow_runs: [run({ id: 2, updated_at: ago(0.2) })] },
    'repos/o/auros-base/actions/runs/1/jobs': { total_count: 0, jobs: [] },
    'repos/o/auros-base/actions/runs/7/jobs': { total_count: 3, jobs: [{}, {}, {}] },
    'repos/o/auros/actions/workflows?per_page=100': { total_count: 1, workflows: [wf('.github/workflows/gates.yml')] },
    'repos/o/auros-base/actions/workflows?per_page=100': { total_count: 2,
      workflows: [wf('.github/workflows/nightly.yml'), wf('.github/workflows/build.yml')] },
    'repos/o/auros-recipes/actions/workflows?per_page=100': { total_count: 1, workflows: [wf('.github/workflows/propagate.yml')] },
    'repos/o/auros-base/contents/.github/workflows/nightly.yml': b64("on:\n  schedule:\n    - cron: '17 4 * * *'\n"),
    'repos/o/auros-base/contents/.github/workflows/build.yml': b64('on:\n  push:\n  # schedule:\n  #   - cron: x\n'),
    'repos/o/auros': { pushed_at: ago(24) },
    'repos/o/auros-base': { pushed_at: ago(24) },
    'repos/o/auros-recipes': { pushed_at: ago(24) },
  }
}
const fake = (w) => async (path, opts) => {
  assert.equal(opts, undefined, `check() must be read-only, but called ${opts?.method} ${path}`)
  if (!(path in w)) throw new Error(`unexpected API path ${path}`)
  return structuredClone(w[path])
}
const keys = async (w, t = T) => (await check(fake(w), { repos: REPOS, now: NOW, t })).map((f) => f.key)
const texts = async (w) => (await check(fake(w), { repos: REPOS, now: NOW, t: T })).map((f) => f.text).join('\n')
const NIGHTLY = 'repos/o/auros-base/actions/workflows/nightly.yml/runs?event=schedule&status=completed&per_page=1'
const PROPAGATE = 'repos/o/auros-recipes/actions/workflows/propagate.yml/runs?event=schedule&status=completed&per_page=1'

describe('check', () => {
  test('green: a healthy world has no findings', async () => {
    assert.deepEqual(await keys(world()), [])
  })

  test('(a) red: nightly has never completed a scheduled run — the state on 2026-09-20', async () => {
    const w = world(); w[NIGHTLY] = { total_count: 0, workflow_runs: [] }
    assert.deepEqual(await keys(w), ['stale:o/auros-base/nightly.yml'])
    assert.match(await texts(w), /NEVER completed/)
  })

  test('(a) red at 31 h, green at 29 h (threshold 30)', async () => {
    const w = world(); w[NIGHTLY].workflow_runs[0].updated_at = ago(31)
    assert.deepEqual(await keys(w), ['stale:o/auros-base/nightly.yml'])
    w[NIGHTLY].workflow_runs[0].updated_at = ago(29)
    assert.deepEqual(await keys(w), [])
  })

  test('(a) the threshold is owner-tunable by env var', async () => {
    const w = world(); w[NIGHTLY].workflow_runs[0].updated_at = ago(31)
    assert.deepEqual(await keys(w, thresholds({ WATCHDOG_NIGHTLY_MAX_AGE_HOURS: '48' })), [])
    assert.throws(() => thresholds({ WATCHDOG_NIGHTLY_MAX_AGE_HOURS: 'thirty' }), /not a positive number/)
    assert.throws(() => thresholds({ WATCHDOG_INACTIVITY_WARN_DAYS: '0' }), /not a positive number/)
  })

  test('(b) red: failed with ZERO jobs is reported as a rejected workflow file, with the run URL', async () => {
    const w = world(); w[NIGHTLY].workflow_runs[0].conclusion = 'failure'
    assert.deepEqual(await keys(w), ['failed:o/auros-base/nightly.yml'])
    const t = await texts(w)
    assert.match(t, /ZERO jobs ran: GitHub rejected the workflow FILE/)
    assert.match(t, /https:\/\/github\.com\/o\/x\/actions\/runs\/1/)
  })

  test('(b) red: failed with jobs is a failure but NOT called a workflow-file failure', async () => {
    const w = world(); Object.assign(w[NIGHTLY].workflow_runs[0], { id: 7, conclusion: 'failure' })
    assert.deepEqual(await keys(w), ['failed:o/auros-base/nightly.yml'])
    assert.doesNotMatch(await texts(w), /workflow FILE/)
  })

  test('(b) red: cancelled/timed_out/startup_failure are not success either', async () => {
    for (const c of ['cancelled', 'timed_out', 'startup_failure']) {
      const w = world(); w[NIGHTLY].workflow_runs[0].conclusion = c
      assert.deepEqual(await keys(w), ['failed:o/auros-base/nightly.yml'], c)
    }
  })

  test('(c) red: a scheduled workflow disabled_inactivity or disabled_manually, in any repo', async () => {
    for (const s of ['disabled_inactivity', 'disabled_manually']) {
      const w = world(); w['repos/o/auros-base/actions/workflows?per_page=100'].workflows[0].state = s
      assert.deepEqual(await keys(w), ['disabled:o/auros-base/.github/workflows/nightly.yml'], s)
      assert.match(await texts(w), new RegExp(`\`${s}\``))
    }
  })

  test('(c) green: a disabled NON-scheduled workflow (schedule only in a comment) is out of scope', async () => {
    const w = world(); w['repos/o/auros-base/actions/workflows?per_page=100'].workflows[1].state = 'disabled_manually'
    assert.deepEqual(await keys(w), [])
  })

  test('(d) red: auros-recipes propagate stale beyond 3 h; green inside it', async () => {
    const w = world(); w[PROPAGATE].workflow_runs[0].updated_at = ago(4)
    assert.deepEqual(await keys(w), ['stale:o/auros-recipes/propagate.yml'])
    w[PROPAGATE].workflow_runs[0].updated_at = ago(2.5)
    assert.deepEqual(await keys(w), [])
  })

  test('(d) red: propagate never ran on schedule, or last one failed', async () => {
    const w = world(); w[PROPAGATE] = { total_count: 0, workflow_runs: [] }
    assert.deepEqual(await keys(w), ['stale:o/auros-recipes/propagate.yml'])
    const v = world(); v[PROPAGATE].workflow_runs[0].conclusion = 'failure'
    v['repos/o/auros-recipes/actions/runs/2/jobs'] = { total_count: 1, jobs: [{}] }
    assert.deepEqual(await keys(v), ['failed:o/auros-recipes/propagate.yml'])
  })

  test('(e) red: a repo — including the watchdog\'s own — 45 days without a push; green at 44', async () => {
    const w = world(); w['repos/o/auros'].pushed_at = ago(45 * 24 + 1)
    assert.deepEqual(await keys(w), ['inactive:o/auros'])
    assert.match(await texts(w), /within 15 days/)
    w['repos/o/auros'].pushed_at = ago(44 * 24)
    assert.deepEqual(await keys(w), [])
  })

  test('an API error is thrown, never read as green', async () => {
    const w = world(); delete w[NIGHTLY]
    await assert.rejects(check(fake(w), { repos: REPOS, now: NOW, t: T }), /unexpected API path/)
  })
})

describe('sync — one deduplicated issue', () => {
  const R = 'o/auros'
  const LIST = `repos/${R}/issues?labels=watchdog&state=open&per_page=100`
  const F1 = [{ key: 'stale:a', text: 'A is stale' }]
  const F2 = [...F1, { key: 'failed:b', text: 'B failed' }]
  function recorder (open) {
    const calls = []
    const api = async (path, opts) => {
      if (!opts) { assert.equal(path, LIST); return structuredClone(open) }
      calls.push(`${opts.method} ${path}${opts.body.state ? ' ' + opts.body.state : ''}`)
      return {}
    }
    return { api, calls }
  }

  test('red, no open issue: opens one, labelled watchdog, carrying every finding', async () => {
    let sent
    const api = async (p, o) => { if (!o) return []; sent = o.body; return {} }
    assert.equal(await sync(api, R, F2), 'opened')
    assert.deepEqual(sent.labels, ['watchdog'])
    assert.match(sent.body, /A is stale[\s\S]*B failed/)
  })

  test('red, same findings as the open issue: edits it, no comment (no notification spam)', async () => {
    const { api, calls } = recorder([{ number: 5, body: '<!-- watchdog-keys:stale:a -->' }])
    assert.equal(await sync(api, R, F1), 'updated')
    assert.deepEqual(calls, [`PATCH repos/${R}/issues/5`])
  })

  test('red, findings changed: edits AND comments, still one issue', async () => {
    const { api, calls } = recorder([{ number: 5, body: '<!-- watchdog-keys:stale:a -->' }])
    assert.equal(await sync(api, R, F2), 'changed')
    assert.deepEqual(calls, [`PATCH repos/${R}/issues/5`, `POST repos/${R}/issues/5/comments`])
  })

  test('pull requests carrying the label are not the issue', async () => {
    const { api, calls } = recorder([{ number: 3, pull_request: {}, body: '' }])
    assert.equal(await sync(api, R, F1), 'opened')
    assert.deepEqual(calls, [`POST repos/${R}/issues`])
  })

  test('green with an open issue: comments and closes it', async () => {
    const { api, calls } = recorder([{ number: 5, body: '' }])
    assert.equal(await sync(api, R, []), 'closed')
    assert.deepEqual(calls, [`POST repos/${R}/issues/5/comments`, `PATCH repos/${R}/issues/5 closed`])
  })

  test('green with no issue: touches nothing', async () => {
    const { api, calls } = recorder([])
    assert.equal(await sync(api, R, []), 'green')
    assert.deepEqual(calls, [])
  })
})
