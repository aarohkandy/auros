#!/usr/bin/env node
// watchdog — notices the nightly NOT happening, from outside the repository it lives in.
//
//   node tools/watchdog.mjs            (needs GITHUB_TOKEN; run by .github/workflows/watchdog.yml)
//
// WHY THIS IS IN THE CONTROL REPO. SYSTEM-REVIEW §2.17 / H1 / H2: a job inside a workflow cannot
// notice that workflow's absence. auros-base's nightly had never completed a scheduled run when this
// was written — its only runs were rejected at startup as an invalid workflow file — and nothing said
// so, because the dangerous states are the ones where nothing goes red. So the check lives here, reads
// the public product repos through the API (read-only), and says so in ONE issue labelled `watchdog`
// in this repo. It opens that issue when anything is red, edits it while it stays red, comments when
// the SET of red findings changes (so the owner is notified of news, not of every run), and closes
// it when everything is green.
//
// WHAT IS RED:
//   stale      a watched scheduled workflow has no COMPLETED scheduled run inside its window
//   failed     the latest completed scheduled run did not conclude `success` — and when GitHub ran
//              zero jobs, that it rejected the workflow FILE (the run then has no log to read)
//   disabled   any scheduled workflow in any Auros repo is not `active`
//   inactive   a repo has had no push for INACTIVITY_WARN_DAYS: GitHub disables every scheduled
//              workflow in a public repo at 60 days, THIS ONE INCLUDED. See watchdog.yml's header.
//
// Field names below were probed with `gh api`, not recalled: workflows[].{path,state},
// workflow_runs[].{status,conclusion,updated_at,html_url}, jobs.total_count, repo.pushed_at.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HOUR = 3600e3

/** Thresholds. Defaults here; the workflow sets them as named env vars, which is where to tune them. */
export function thresholds (env = process.env) {
  const num = (k, d) => {
    const v = env[k] === undefined || env[k] === '' ? d : Number(env[k])
    if (!Number.isFinite(v) || v <= 0) throw new Error(`${k}=${env[k]} is not a positive number`)
    return v
  }
  return {
    nightlyMaxAgeHours: num('WATCHDOG_NIGHTLY_MAX_AGE_HOURS', 30),
    propagateMaxAgeHours: num('WATCHDOG_PROPAGATE_MAX_AGE_HOURS', 3),
    inactivityWarnDays: num('WATCHDOG_INACTIVITY_WARN_DAYS', 45),
  }
}

/** Every finding is {key, text}. `key` is stable across runs so the issue can tell news from repeats. */
export async function check (api, { repos, now = Date.now(), t = thresholds() }) {
  const out = []
  const watched = [
    { repo: repos.base, file: 'nightly.yml', hours: t.nightlyMaxAgeHours },
    { repo: repos.recipes, file: 'propagate.yml', hours: t.propagateMaxAgeHours },
  ]

  for (const { repo, file, hours } of watched) {
    const runs = await api(`repos/${repo}/actions/workflows/${file}/runs?event=schedule&status=completed&per_page=1`)
    const last = runs.workflow_runs[0]
    const where = `${repo} \`${file}\``
    if (!last) {
      out.push({ key: `stale:${repo}/${file}`, text: `${where} has NEVER completed a scheduled run.` })
      continue
    }
    const ageH = (now - Date.parse(last.updated_at)) / HOUR
    if (ageH > hours) {
      out.push({ key: `stale:${repo}/${file}`,
        text: `${where}: last completed scheduled run was ${ageH.toFixed(1)} h ago (limit ${hours} h) — ${last.html_url}` })
    }
    if (last.conclusion !== 'success') {
      const jobs = await api(`repos/${repo}/actions/runs/${last.id}/jobs`)
      const why = jobs.total_count === 0
        ? ' — ZERO jobs ran: GitHub rejected the workflow FILE at startup, so there is no log. Run `node tools/workflow-lint.mjs` against it.'
        : ''
      out.push({ key: `failed:${repo}/${file}`,
        text: `${where}: last scheduled run concluded \`${last.conclusion}\`${why} ${last.html_url}` })
    }
  }

  for (const repo of Object.values(repos)) {
    const { workflows } = await api(`repos/${repo}/actions/workflows?per_page=100`)
    for (const w of workflows) {
      if (w.state === 'active' || w.state === 'deleted') continue
      // Only scheduled workflows are in scope; read the file to tell. Comment lines are not schedules.
      const f = await api(`repos/${repo}/contents/${w.path}`)
      const yml = Buffer.from(f.content, f.encoding).toString('utf8')
      if (!/^\s*schedule\s*:/m.test(yml.replace(/^\s*#.*$/gm, ''))) continue
      out.push({ key: `disabled:${repo}/${w.path}`,
        text: `${repo} \`${w.path}\` is \`${w.state}\`. A disabled workflow cannot re-enable itself: Actions tab → Enable workflow. ${w.html_url}` })
    }

    const { pushed_at: pushed } = await api(`repos/${repo}`)
    const days = Math.floor((now - Date.parse(pushed)) / (24 * HOUR))
    if (days >= t.inactivityWarnDays) {
      out.push({ key: `inactive:${repo}`,
        text: `${repo}: no push for ${days} days. GitHub disables its scheduled workflows at 60 — push any commit within ${60 - days} days.` })
    }
  }
  return out
}

const MARK = (keys) => `<!-- watchdog-keys:${keys.join(',')} -->`

/** Bring the ONE `watchdog` issue in `repo` into line with `findings`. Returns what it did. */
export async function sync (api, repo, findings, runUrl = '') {
  const open = (await api(`repos/${repo}/issues?labels=watchdog&state=open&per_page=100`))
    .filter((i) => !i.pull_request)
    .sort((a, b) => a.number - b.number)
  const issue = open[0]

  if (!findings.length) {
    for (const i of open) {
      await api(`repos/${repo}/issues/${i.number}/comments`, { method: 'POST', body: { body: `All green. ${runUrl}` } })
      await api(`repos/${repo}/issues/${i.number}`, { method: 'PATCH', body: { state: 'closed', state_reason: 'completed' } })
    }
    return open.length ? 'closed' : 'green'
  }

  const keys = findings.map((f) => f.key).sort()
  const body = [
    'The out-of-band watchdog (`.github/workflows/watchdog.yml`) found:', '',
    ...findings.map((f) => `- ${f.text}`), '',
    `Last checked: ${runUrl || 'locally'}. This issue closes itself when every check is green.`,
    MARK(keys),
  ].join('\n')

  if (!issue) {
    await api(`repos/${repo}/issues`, { method: 'POST',
      body: { title: 'watchdog: the nightly or its schedule needs attention', body, labels: ['watchdog'] } })
    return 'opened'
  }
  const was = /<!-- watchdog-keys:(.*?) -->/.exec(issue.body ?? '')?.[1] ?? ''
  await api(`repos/${repo}/issues/${issue.number}`, { method: 'PATCH', body: { body } })
  if (was !== keys.join(',')) {
    await api(`repos/${repo}/issues/${issue.number}/comments`, { method: 'POST',
      body: { body: `What is red changed:\n\n${findings.map((f) => `- ${f.text}`).join('\n')}` } })
    return 'changed'
  }
  return 'updated'
}

/** Minimal GitHub REST client. Throws on any non-2xx, so an API outage is a red run, not a green one. */
function github (token) {
  return async (path, { method = 'GET', body } = {}) => {
    const r = await fetch(`https://api.github.com/${path}`, { method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: body && JSON.stringify(body) })
    if (!r.ok) throw new Error(`${method} ${path}: HTTP ${r.status} ${await r.text()}`)
    return r.status === 204 ? null : r.json()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const token = process.env.GITHUB_TOKEN
  if (!token) { console.error('watchdog: GITHUB_TOKEN is not set — refusing to report anything'); process.exit(2) }
  const cfg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'auros.config.json'), 'utf8'))
  const api = github(token)
  const findings = await check(api, { repos: cfg.repos })
  const runUrl = process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : ''
  if (process.env.WATCHDOG_DRY_RUN) console.log('dry run: issue not touched')
  else console.log(`issue: ${await sync(api, process.env.GITHUB_REPOSITORY || cfg.repos.meta, findings, runUrl)}`)
  for (const f of findings) console.log(`::error::${f.text}`)
  console.log(findings.length ? `RED — ${findings.length} finding(s)` : 'GREEN')
  process.exit(findings.length ? 1 : 0)
}
