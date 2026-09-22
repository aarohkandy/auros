# BLOCKED

Written when a task cannot proceed without crossing a prohibition or without a human. The rule (spec §8):
write it here, take the next unblocked task, surface it at the next checkpoint. Never invent a workaround
that crosses a prohibition.

---

## B1 — Gate 3 needs a Windows VM host with ~100 GB free · **RESOLVED 2026-09-20** → D27
`homebase` re-checked: still 17 GB free of 247 GB, 22 running containers of other people's work, QEMU not
installed. Not mine to move.

**Resolved without spending money or touching anyone's workload:** Gate 3 runs on GitHub
`windows-latest` runners, which are ephemeral Windows machines destroyed after every job — exactly what
spec §4.7 asks for — with ~110 GB free and 20 concurrent jobs on a public repo. See DECISIONS.md D27,
including why asserting *"the system disk was not written"* is stronger evidence than the spec's
*"Windows still boots"*. The firmware-dependent checks (BitLocker, `BootNext`, ARM) move to Gate 5's
physical machines, which is the only place they could have been honestly tested anyway.

## B2 — Cross-repo `repository_dispatch` needs a credential · OPEN · blocks Gate 2 exit
A workflow's default `GITHUB_TOKEN` cannot trigger a workflow in a different repo (GitHub suppresses this
deliberately to prevent recursion). Base → recipes propagation therefore needs either a fine-grained PAT
stored as a secret, or a GitHub App installation token. The local token lacks the scope to mint either.
**Needs the human to create one fine-grained PAT** (`contents: write` on `auros-recipes` only) or install
a GitHub App.
*Workaround while blocked:* recipes also run on a `schedule` and compare the base digest against their
lockfile, so propagation still happens unattended — just on a poll interval rather than instantly. The
Gate 2 exit condition allows 20 minutes, so a 15-minute poll satisfies it. Instant dispatch is the upgrade.

## B3 — Installer code-signing certificate · OPEN · degrades Gate 3, blocks real-user trust
Unsigned, the migration `.exe` triggers a full-screen SmartScreen block and an "Unknown publisher" UAC
prompt. Signing does not grant instant trust — SmartScreen reputation accrues over time — so the sooner a
certificate exists the better. ~$10/mo (Azure Trusted Signing) or $200–400/yr (OV). **Spends money, §9.**
*Workaround:* build and test unsigned; the signing step is one CI step added later.

## B4 — Gate 6 has no workstream and needs a human to send mail · OPEN · blocks Gate 6
Nothing in spec §6 produces a nonprofit. §9 reserves "anything touching a real person's inbox", which is
every path to a first customer. Lead time is human, not computational.
*Action taken:* I will draft the outreach one-pager and pilot offer and put them in front of the human.
**I will not send anything.**

## B5 — Three donated laptops not yet in hand · OPEN · blocks Gate 5
Spec §2 says they arrive "this week". `compat.tsv` cannot get a `physical` row until they do, and §10
identifies Gate 5 as one of the two that slip because hardware does not compress.
*Workaround:* every VM profile row lands first, marked `source=vm` with physical columns empty.

## B6 — Nightly pull size vs. a school's uplink · OPEN · constrains a website claim, not a build
**Measured:** the Aurora base is **3.5 GB compressed**
([evidence](docs/evidence/2026-09-20-runner-probe.md)). A nightly base change that touches a low layer is
a 3.5 GB pull *per machine*; a 180-machine site on one uplink is a ~630 GB event.

`rechunk`'s stable layer plan is the mitigation and it is now a requirement rather than an optimisation
(DECISIONS.md D2). But until we have **measured** a real nightly delta, we may not claim "updates every
night" to a large site without qualification. §9 reserves website claims we cannot evidence.
*Action:* `results.json` carries `pull_size_delta_bytes` as a measured field. The claim waits for the
measurement. Staged rollout and an on-site cache belong to the fleet console (§6E, deferred).

## B7 — Gate 2's 20-minute window depends on GitHub honouring a cron · OPEN · risks Gate 2 timing only
The propagation fallback (BLOCKED.md B2) polls on `*/10`. **Scheduled workflows on free public repos are
delayed under load, sometimes by a lot**, so the poll satisfies Gate 2's "within 20 minutes" only when
GitHub is not busy. The `repository_dispatch` path is instant and needs the credential B2 describes.
*Not solvable without the credential.* Recorded so that a slow Gate 2 run is read as infrastructure
latency rather than as a broken propagation design.

## B8 — The site advertises replaceability, which proprietary licensing makes false · **RESOLVED 2026-09-20** → D31
D30 made everything all-rights-reserved. Four places on the site now claim the opposite: the FAQ's
"what happens when you go out of business" answer (clone-and-build instructions), the entire
*Replaceable on purpose* page, the landing page's closing section, and
`auros-recipes/.github/workflows/replaceable.yml`, a CI job that executes the promise weekly.

Publishing any of it now would be the fabricated claim §4.4 forbids.

**Resolved:** D31. The claim becomes *"you have the image; if we cease operating you get the build
files needed to keep patching it."* Weaker than the original and true. The four sections need rewriting
before anything ships; the mechanism (configurator, order PR) never depended on the answer.

## B9 — The $0 self-serve tier has no product any more · OPEN · §9 (pricing) · no longer blocks copy
D30/D31 made everything all-rights-reserved. The self-serve tier existed **because** the recipes were
public and forkable — that was the entire product at that price. `tiers/5-self-serve.md` currently says:

> *"Every recipe, including every customer recipe, in a public repository" · "The base image
> Containerfile, the hardening, and the policy modules" · "you can have the same image we would build
> for you and pay us nothing"*

**Every line of that is now false**, and it is a pricing question, which §9 reserves for the human. I am
not deleting a tier the spec fixes.

Three options:
1. **Remove the tier.** Four tiers. Cleanest and most honest. Loses the "we are not holding you hostage"
   signal that made the other four easier to trust.
2. **Redefine at $0 as "read, don't build".** Recipes readable so a customer can see exactly what is on
   their machines, with no licence to build or redistribute. Keeps some of the signal; the tier stops
   being a product and becomes a transparency promise, which may be the more honest framing anyway.
3. **Keep the tier and open-source only `auros-recipes`** — recipes permissive, everything else
   proprietary. The recipe file is the least valuable thing we produce (LICENSING.md), so this costs
   little, but it does hand a competitor a working schema.

Note for whoever decides: spec §6D requires the school tier to show a replacement-cost comparison
because *"our real competitor is doing nothing, which is free."* The $0 tier was the other half of that
argument. Removing it strengthens "doing nothing" as the alternative.

**Holding pattern, 2026-09-20 — this decides nothing.** The rest of the site copy was rewritten for
D31 and this tier could not be left saying what it said. So `tiers/5-self-serve.md` now carries
`blocked: true` in its frontmatter, `tiers()` in `auros-web/src/components/content.ts` filters blocked
tiers out of every page that renders them, and `pages/3-pricing.mdx` states in words that a fifth tier
exists and is being held back and why. The file is intact, the price is untouched, and all three options
above are still open. **Unblocking it is clearing that flag, which is the human's act, not an agent's.**

## B10 — A production signing key is a human action · OPEN · blocks publishing, not building
D32 created a development key so Gate 1 is not blocked. It builds, boots and passes the matrix; the
publish step refuses it by reading the key kind back out of the image.

**Before a single customer machine exists**, a human must generate a production key pair, commit the
public half as `signing/keys/auros.pub`, and place the private half in the signing secret. It is a
long-lived organisational credential whose custody matters more than its cryptography — see
`auros-base/signing/RISKS.md` R3.

Doing it late costs a re-sign of everything published under the development key. Doing it now costs
nothing, because nothing is published.

## B11 — The order flow's human check needs a script host §4.5 did not permit · **RESOLVED — D33 RATIFIED BY THE HUMAN 2026-09-20** · RESOLVED by D33 · Gate 4 unblocked
Spec §6D's exit condition is that a stranger configures a build, submits, and a PR appears in
`auros-recipes`. The Worker will not accept a POST without a verified Turnstile token
(`auros-web/worker/lib/turnstile.js`), and Turnstile's widget is delivered by
`https://challenges.cloudflare.com/turnstile/v0/api.js`. **Spec §4.5 permitted no script host on the
public site other than cdnjs.** Turnstile is not on cdnjs and cannot be: the challenge is served
from Cloudflare's own origin by design.

Three ways out were written down here: an explicit exemption for that one endpoint, a different
same-origin human check, or no human check and a different abuse control on the Worker.

**RESOLVED — DECISIONS.md D33 takes the first, narrowly.** `challenges.cloudflare.com/turnstile/v0/api.js`
is exempt from §4.5, on the configurator page only. No other path on that host and no other host is
added, and every other page on the site still loads nothing remote. The reasoning, and what the
exemption explicitly is not, are in D33.

*What shipped with it, in the same change:* `human-check.ts` has `HUMAN_CHECK_DEPLOYED = true`, the
loader is on the page with `render=explicit`, and `configurator.client.ts` calls `turnstile.render()`
itself after the form template is cloned into the document — the implicit renderer scans for
`.cf-turnstile` once, when `api.js` runs, and our widget does not exist yet at that moment, so it
would never have been rendered even with the script present. That was the second half of the same
fatal.

*Still mechanised:* `auros-web/tools/configurator-a11y.test.mjs` fails the build on a script from any
other host, on a widget with no loader, and on a loader without `render=explicit`.


## B12 — The wind-down commitment is stated four times and has no document behind it · OPEN · §9 · blocks publication
D31 says the handover must be *"a real published term rather than a sentiment"*, and the site now states
it in four places: the landing close, `faq/1-if-you-disappear`, `pages/5-replaceable-on-purpose`, and
the school tier.

**No terms document exists.** A commitment made four times on a website with nothing behind it is a
promise we have not actually made, which is the fabricated-claim prohibition wearing a different hat —
and this one is worse than a marketing overclaim, because a school would be relying on it when they
decide to put a fleet on us.

Needs a human: it is a contractual undertaking, not copy. Roughly, it has to say **what** is handed over
(the recipe, the base Containerfile, the build scripts — not a licence to the tooling), **when** the
trigger fires, **how** the customer receives it, and **what it does not include.**

Until it exists, the four sentences must not ship. Caught by the R4 rewrite rather than by a gate,
because no gate can tell that a true-sounding sentence has no document behind it.

**B12 update:** a draft now exists at `docs/legal/WIND-DOWN-TERMS.DRAFT.md`, clearly marked as not legal
advice and not in effect. Drafting it exposed a gap in D31 itself: **handing someone files they have no
licence to use gives them nothing** under all-rights-reserved. The commitment has to be a *licence that
vests on a trigger*, not a delivery. Because the repos are already readable, access needs no escrow —
only the right to use does. Needs the human's confirmation and a lawyer's review.


## ID collision note · 2026-09-20
Two different blockers were both numbered **B11** — the §4.5/Turnstile one (opened by an agent) and the
wind-down terms one (opened by me) — and D33 then recorded **"Closes B11."** A reader seeing that could
reasonably conclude the wind-down claim was cleared to ship, when it still has no document behind it.

The wind-down blocker is now **B12**. Several advertising documents had already noticed the collision
and written around it as *"B11, the wind-down entry"*; they are updated to B12. Worth recording because
working around a bookkeeping bug instead of fixing it leaves the next reader to make the same mistake,
and here the mistake would have been shipping a promise with nothing behind it.

## B13 — Purge `advertising/` from the public meta repo's history · OPEN · deferred by the owner
Moved to `aarohkandy/auros_private` and removed from `main` (D36). It remains in the public repo's
history. Purging needs a history rewrite and a force-push to `main` — destructive, and unsafe while
agents are still pushing to the same repo, because it could discard their commits. **Do it when the
repo is quiet.** Zero forks, so the rewrite will be clean.

## B14 — Going live needs a Cloudflare account and explicit permission to publish · OPEN · blocks Gate 4
Gate 4 is *"site live, and a stranger's configuration opens a valid PR."* The site builds, the
configurator works, the order Worker exists and D33 gives it a submit path. Three separate things still
stand between that and "live", and they are easy to conflate:

1. **An account.** The spec names Cloudflare Pages plus one Worker. No Cloudflare account or API token
   exists, and creating accounts is something I may not do. The owner creates a free account and adds an
   API token as a repository secret. **The static pages alone could go on GitHub Pages instead** — free,
   public repo, no new account — but the Worker that opens the pull request needs somewhere to run, and
   that is the half Gate 4 actually tests.
2. **Permission.** A live website is publishing public content, which needs the owner's explicit yes for
   that specific action. Not assumed from "keep going".
3. **B12.** The site states the wind-down commitment in four places and no terms document exists.
   Publishing before B12 is resolved would put an unbacked promise in front of the exact audience that
   would rely on it. **This one is not a formality; it is the reason the other two can wait.**

Order of operations when the owner is ready: B12 terms → Cloudflare account + token → explicit go-ahead
to publish → deploy → a stranger's order opens a PR.

## B15 — The Linux-side restore did not exist · **IN PROGRESS 2026-09-20** · was blocking Gate 3's other half and check R1
Found by auditing deliverables against the spec rather than against the task list — the task list said
W-C was largely done.

Spec §6C: *"Linux side: restore from the verified archive on first boot, re-verify, report the count to
the user on the desktop."* Nothing implemented it. Check **R1** in `auros-base/matrix/checks.yaml`
depends on it and could never have passed.

**Why it matters more than its size suggests.** The Windows half copies a school's files off and
verifies them. Without the Linux half, that archive sits on a USB stick and the machine they are handed
back has none of their work on it. Half a migration is not a migration; it is a laptop with a stranger's
operating system on it and everything they had somewhere else.

It also runs at the single most dangerous moment in the product: the archive is the user's **only** copy,
because the old disk has been overwritten by then. A bug there destroys data that a correct Windows-side
run had successfully preserved.

Being built now on branch `feat/linux-restore`, with the abort paths attacked before anything else.

**The process lesson:** `TASKS.md` said this workstream was nearly done, because it tracked the tasks
someone had written down rather than the deliverables the spec demands. Audit against the contract,
not against your own list.

## B16 — The publish gate's hook is installed for `Bash` only, so the ledger is one `Write` away · OPEN · needs a settings change, which is the owner's

`.claude/hooks/publish-gate.mjs` protects four paths — `attest/passed-digests.tsv`, `.claude/hooks/`,
`.claude/settings*.json`, `tools/gate.mjs` — and it protects them correctly. Fed a `Write` event for
the ledger it exits **2** with the right message; that branch of the file works and was executed to
confirm it.

**It is never fed one.** `.claude/settings.json` registers the hook with `"matcher": "Bash"`, so the
harness routes Bash tool calls to it and nothing else. The `event.tool_name !== 'Bash'` branch — the
half that guards against `Write` and `Edit` — has never run and cannot run. It is a check that cannot
fail, which §D34 says is not a check.

**The concrete chain, each step verified against the installed hook:**

| step | tool | hook verdict |
|---|---|---|
| append a `pass` row for any digest | `Write` / `Edit` | not routed to the hook at all |
| `git add attest/passed-digests.tsv && git commit` | `Bash` | **exit 0** — `git` is not a mutator and there is no redirection, so `protectedWrites()` does not fire |
| `git push` | `Bash` | exit 0 |

After that, `tools/gate.mjs` reads the row, `build-recipe.yml` fetches the same file from
`raw.githubusercontent.com/aarohkandy/auros/main` and publishes. No VM ever booted. The audit
recorded in the hook's own comments proved the second half of this a while ago; what is new is that
the first step needs no shell at all, so the guard added in response to that audit is bypassed by the
default tool an agent reaches for.

**The fix is one line** — `"matcher": "Bash|Write|Edit|MultiEdit|NotebookEdit"` — and it is in
`.claude/settings.json`, which is the operator's harness configuration. An agent that can edit the
file that installs its own gate does not have a gate, which is precisely why that path is on the
protected list. **So this is written here instead of made.** It costs nothing to apply and it closes
the only remaining step of the chain that does not already require a human.

*Scope, honestly:* this is layer four of four (PLAN.md §3.2). It constrains one agent in one harness
and does nothing about a person with an editor, another session, or CI. B17 is the part that would.

## B17 — The attestation ledger is an unsigned TSV, so a typed row and a booted VM are the same evidence · OPEN · needs a decision about identity

`tools/gate.mjs` refuses everything unless `attest/passed-digests.tsv` records a full pass for the
exact digest. Every layer that matters reads that file: the CI publish step in
`auros-recipes/.github/workflows/build-recipe.yml`, the equivalent in `auros-base`, and the hook. The
file is tab-separated text in a git repository. Its only access control is write access to
`aarohkandy/auros`.

`attest/README.md` and `gate.mjs`'s own header already say this — *"a field that says pass is exactly
what a broken or malicious harness would write"* — and both name the same fix: **the matrix harness
signs `results.json` with the CI OIDC identity, and `decide()` verifies that signature** before it
believes a row. Then a row typed by a person, or by an agent, or by a compromised runner outside the
workflow, is distinguishable from one a machine produced.

Why it is not being done here: it needs a decision about *which identity signs* and *where the public
half lives* — the same class of question as B10's production signing key, and plausibly the same key
custody. Choosing it unilaterally would be choosing an organisational credential, which §9 reserves.

**Until it exists, no gate in this product is stronger than write access to one text file.** That is
worth saying in those words on the page that lists what we have not solved, rather than only in the
comments of the code that depends on it.

## B18 — `/build-console` is unauthenticated and spends the same GitHub budget the order path needs · OPEN · needs a decision on the abuse control

`GET /build-console?recipe=<name>` takes no token and is not rate limited. Each connection holds an
SSE stream for up to eight minutes, polling `GET /actions/runs/{id}/jobs` every three seconds — about
160 authenticated GitHub calls per connection, all against the **installation token that
`/order-submit` also uses to open pull requests.**

`routes/order.js` rate-limits orders twice, per address and globally, and its comment explains
exactly why the global ceiling exists. The console has neither counter. A few dozen concurrent
streams exhaust the installation's hourly budget, and the first thing that stops working is not the
console — the console degrades honestly, which it was carefully written to do — it is
`openRecipePr()`, which starts returning 502 to real customers.

There is also a smaller, real disclosure: an unknown recipe name falls back to `main`, while a name
with an order behind it returns that order's branch in the `hello` event
(`order/<name>-<date>-<hash>`). So the endpoint answers "does a customer called X exist, and when did
they order". The file's own comment refuses a "whatever is building right now" parameter *"because
that would leak which customers exist"*; probing by name leaks the same thing more slowly. The
pull request is public, so this is a confirmation rather than a revelation — but the argument written
in the file is not currently true of the file.

**Three options, and picking one is a product decision:**
1. Rate-limit by address in KV, the way `/order-submit` already does. Cheapest. Also limits a
   legitimate customer watching their own build reconnect after every runtime cut.
2. Require the order's branch suffix (the YAML fingerprint already in the branch name) as an
   unguessable token in the query string. Closes the enumeration too; means the console URL has to be
   handed to the customer rather than constructed from their name.
3. Serve the console from a cached KV snapshot refreshed by one scheduled poll, so viewers cost
   nothing at GitHub. Most work; decouples the budget entirely.

**Also folded in here, from the same review:** `src/pages/configure.astro` passed no `sitekey` to the
configurator, so `dist/configure.html` shipped Cloudflare's published **test** sitekey. It now reads
`PUBLIC_TURNSTILE_SITEKEY` and falls back to the test key for local builds (verified in both
directions). That makes a real key *possible*; it does not make it *present*. **B14's go-live
sequence needs a step that fails the deploy if the built page still carries
`1x00000000000000000000AA`** — the Worker refuses a test SECRET on a reachable host, so a forgotten
sitekey does not open the door, it refuses every single visitor, and Gate 4 fails on day one for a
reason nothing in the repository would have named.

## B19 — The Linux restore cannot switch Wi-Fi on or add a printer queue, because both need root · OPEN · degrades §6C, blocks nothing
`cmd/auros-restore` (phase 7) runs as the user, at first login. It restores files, and for the two
things that are not files it goes as far as an unprivileged process honestly can:

- **Wi-Fi.** Each migrated network is written as a NetworkManager keyfile with mode `0600` into
  `~/.local/share/auros-restore/network/`. The mode is **read back off the disk** and the file is
  deleted if it is not 0600 — a world-readable PSK is a real disclosure *and* a silent failure,
  because NetworkManager refuses to load such a file. Moving them to
  `/etc/NetworkManager/system-connections` with root ownership needs root.
- **Printers.** The queues that can honestly become driverless IPP are written to
  `~/.local/state/auros-restore/printers.plan` **as data, never as a script** — a script staged in a
  home directory that root runs later is a privilege-escalation hole wearing a convenience costume.
  `lpadmin` needs root.

The note on the desktop says in plain words, for both, that they are saved and **not yet switched
on**, and nothing anywhere reports either as migrated (§4.2). An administrator running
`auros-restore` as root *does* write the keyfiles straight into `/etc`; that path is implemented and
its permission check is tested in both directions.

**Why the privileged half is not in the branch, rather than rushed into it.** It is the only
component in the product where **root reads a file a non-root user controls**, on a shared school
laptop. Doing it safely needs `O_NOFOLLOW`, an owner check through `syscall.Stat_t`, and a strict
allow-list parser that *rebuilds* the connection from validated keys rather than copying the file —
and the first two are forbidden outside `internal/winenv` and `internal/sysdisk` by
`TestWall_SyscallIsConstantsOnly`, whose own comment says widening it is an architecture change to
argue for in a pull request of its own. Writing that program at the end of a long change, to make a
report line read better, is how the wall stops meaning anything.

*Not blocked on a human, blocked on a design review it deserves.* Until it exists the degradation is
visible to the user rather than hidden from them, which is the property that matters. Details:
`auros-installer/packaging/systemd/README.md`.

## B16 — The only code path that moves the upstream pin does not exist · **RESOLVED 2026-09-20** (auros-base `c849612`)
> **Resolved.** `cmd_drift` and `cmd_update` exist; `gate1-exit.yml` now calls `tools/mirror-upstream.sh`
> instead of the nonexistent `mirror` subcommand. `tests/dispatch.test.sh` fails on any case-arm dispatch
> to an undefined function in any shell script, and on any workflow calling a subcommand its script does
> not dispatch; `tests/resolve-upstream.test.sh` drives drift/update against a stub registry. Both were
> watched red on the pre-fix tree. Run live against ghcr.io on 2026-09-20: `aurora:stable` still at
> `911281f2…`, `moved=false`. `pin-upstream.sh` (named in `auros.config.json:14`) is still a dangling
> reference. **Not fixed by this:** §2.3 of SYSTEM-REVIEW — the trigger is still "digest moved", so our own
> layer's CVEs and an upstream stall still never rebuild and still report green.
>
> *ID collision:* the publish-gate hook entry above is also numbered B16. Both are referenced by that
> number elsewhere, so neither is renumbered; this one is "B16 (upstream pin)".
>
> *Also found:* `base.lock`'s `UPSTREAM_PULL_SIZE_BYTES=3758096384` is exactly 3.5 GiB, not a measurement.
> The live read is **3,706,306,117**. `update` rewrites it on the next upstream move; not hand-edited here,
> per the file's own rule.

Found by the end-to-end system review (`docs/SYSTEM-REVIEW.md`), not by any test.

`auros-base/tools/resolve-upstream.sh:269-270` dispatches `drift) cmd_drift ;;` and
`update) cmd_update ;;`. **Neither function is defined.** Only `cmd_resolve` (line 191) and
`cmd_assert` (line 206) exist. Verified by running it: `cmd_update: command not found`.

Its two callers are the two that matter:
- `nightly.yml:97` — `./tools/resolve-upstream.sh update`, the nightly step that moves the pin.
- `build.yml:185` — `./tools/resolve-upstream.sh drift`.

**Consequence.** This is the *only* mechanism that moves `base.lock` to a newer upstream digest. It
fails every night. The `drift` job goes red, `build` is skipped by `needs`, and `base.lock` stays at
`sha256:911281f2…` forever. Spec §3's "CVE response is one rebuild" is currently **"a CVE fix has no
route into our build graph at all."** Every customer on every image, if there were any.

**Why nothing caught it.** `bash -n` passes — the file is syntactically valid, the functions are simply
absent. `tools/workflow-lint.mjs` checks pipefail and env interpolation, not shell symbols. No suite in
`verify` invokes this script. And `build.yml:211` already carries a comment naming *this exact failure
class* — *"this is how the publish step silently stopped running: it called subcommands that do not
exist"* — which was fixed for `gate.mjs` with `tools/gate.refusals.test.mjs` and never applied to the
shell scripts.

**What the fix must do** (for whoever implements it):
- `cmd_drift` — re-resolve `UPSTREAM_IMAGE:UPSTREAM_TAG` to a digest, compare with `base.lock`'s
  `UPSTREAM_DIGEST`, emit `moved=true|false` plus the new digest to `$GITHUB_OUTPUT`. `nightly.yml:149`
  gates the rebuild on `needs.drift.outputs.moved == 'true'`.
- `cmd_update` — do that, then rewrite `base.lock` (digest, resolved-at, created, pull size) and leave
  the tree committable.
- **Then add a test that every dispatched subcommand is a defined function**, for every shell script in
  the repo. That is the generalisable fix; the two functions are the instance.

## B20 — The landing page misses §6D's Lighthouse floor: 91 against 95 · OPEN · the gate is red on purpose
**Measured, on a GitHub `ubuntu-24.04` runner, Lighthouse 12.8.2 mobile, median of three**
(`auros-web/.github/workflows/lighthouse.yml`; reports are the run's `lighthouse-reports` artifact).
Eight of nine pages pass. `/` does not, and `/how-it-works` sits on the line — 95, 95, then 94 across three consecutive CI runs (the build console again: it is the other page that carries the full log):

| page | perf | a11y | LCP (stable) | DOM | fonts fetched |
|---|---|---|---|---|---|
| `/faq` | 99 | 100 | 2.1 s | 202 | 218 KB |
| `/order` | 95 | 100 | 2.9 s | 905 | 290 KB |
| **`/`** | **91** | 100 | **3.5 s** | **1,116** | **365 KB** |

**What was already fixed on the way to 91** (D40): `/` started at **85** performance and **97**
accessibility. 267 KB of a 585 KB page was one Devanagari face drawing one Marathi greeting — now
75 KB, shaping verified identical with HarfBuzz (85 → 91). And the first-boot figure was the one
block of reading text not on a panel, so once the terrain mounted it sat at 1.94:1 on bedrock —
now on a `<Panel>` as §7 requires (97 → 100).

**What Lighthouse names as the remaining cost.** Its `network-dependency-tree-insight` puts the
longest chain at document → `Panel.css` → the seven font files that stylesheet discovers, and the
LCP element (the hero standfirst, plain text) waits on that chain in Lantern's model even though
every face is `font-display: swap`. Behind it: a 1,116-element DOM, **770 of which are the build
console** — 482 in the live log at rest and 266 in the pinned-runs record.

**Tried, measured, and NOT adopted:**
- *Inlining every stylesheet* (`build.inlineStylesheets: 'always'`): the document grew from 19 KB to
  28 KB gzipped and `/` went **down** to 83 locally. Reverted.
- *Merging `/`'s four stylesheets into one*: 92 locally, inside this laptop's noise. Not adopted on
  that evidence.
- *Dropping both font preloads*: two contended A/Bs suggested +2 (D40). Not settled; this laptop's
  load average was above 300 for the whole session and cannot separate 2 points from noise.

**Why this is written here and not fixed.** What is left is the build console's size on the
landing page, which is D29's "living element" and was deliberately made large, and the landing
page's font mix (four Latin faces plus Devanagari plus symbols on one screen). Shrinking either is
a design decision about what the first page shows, not a performance tweak, and it should be made
by whoever owns D29 with these numbers in front of them.

**The gate stays at 95 and stays red.** Lowering it to make `/` pass would be D19 in reverse — a
check tuned until it cannot fail. The spec says 95; the site measures 91; now, for the first time,
everybody knows.

## B21 — Decisions waiting on the owner after the 2026-09-21 session · OPEN · §9
Everything below is built, tested and waiting on a call only the owner can make. Evidence for each is
in the named doc or commit.

| # | Decision | Blocks | Where |
|---|---|---|---|
| 1 | ~~RESOLVED (D44)~~ `tools/gate.mjs`: `MATRIX_VERSION = 2` and add `'S11'` to `REQUIRED_CHECKS`. The file is protected from agents on purpose. Until then the gate refuses every digest and `gates` CI is red — or revert the removal floor from auros-base. | every publish; `gates` CI | auros-base `4a8cc7b` (S11) |
| 2 | ~~RESOLVED (D44): 4.63 GB~~ S6 size budget for the base (measured 4,207,427,618 bytes; suggestion: measured + 10% ≈ 4.63 GB) | Gate 1 static phase | run 35566336512 |
| 3 | ~~RESOLVED (D44): bootc timer~~ S10: `uupd.timer` and `bootc-fetch-apply-updates.timer` are both enabled; keep one (the latter carries our rollback wiring) or change the check | Gate 1 static phase | `build/30-update-agent.sh:192-195` |
| 4 | ~~RESOLVED (D44): S5 skips base~~ S5 on the base: should the base write a removal report, or does S5 not apply to a base build? And what S5 compares a recipe against (auros-base vs upstream) | Gate 1 static phase; recipes | agent/s5-claims notes |
| 5 | Staleness thresholds: upstream 21 d, forced rebuild 7 d, laptop freshness 21 d | heartbeat branch (not merged) | `agent/heartbeat`, `agent/freshness` |
| 6 | Production signing key (B10); then pin its fingerprint in the publish check | every publish | `tools/signing-key.sh` |
| 7 | Wi-Fi passwords sit on the USB stick in plain text during migration (FAT has no permissions): accept with disclosure / encrypt that file / drop Wi-Fi keys | merging `agent/wifi-printers` | installer `df013fe` |
| 8 | AppData scope (allow-list + per-file waive, recommended) | real-machine migrations (§2.20) | `docs/APPDATA-SCOPE.md` |
| 9 | Build the migration GUI (D42) | D4 for the migration | `docs/MIGRATION-GUI.md` |
| 10 | Fleet view: amend SPEC §6E, change the published "no telemetry" line, Cloudflare account (B14) | knowing a fleet stopped updating | `docs/FLEET-VIEW.md` |
| 11 | Push/release `feat/linux-restore` so the image can pin the restore binary | R1, §6C | auros-base `1dd8e18` (45-restore, off) |
| 12 | Floors (1100 / 240) recalibrated from the first real S11 measurement | recipe builds | auros-recipes `f924660` |
| 13 | First boot shows two setup wizards with overlapping questions (KDE plasma-setup, then our auros-first-run): suppress KDE's, trim ours, or brand KDE's | D4.4 "clean end to end" | agent/plasma-setup report |
| 14 | Gate 3 measurement: switch from observing "no change on C:" (a treadmill against Windows servicing) to ENFORCING it with a deny-write ACL for the migration account + installer-tree attribution | Gate 3 | gate3 runs 35639286740 etc. |
| 15 | SELinux: bootc's own chcon self-test is denied when our units run bootc; ship a policy module, or read status via rpm-ostree | B11 | agent/b5-selinux report |
| 16 | Gate 3 last blocker: grant the standard-user migration account window-station/desktop access before launch (shell32 DllMain fails without it) | Gate 3 | run 35672736107, F07 artifact |
| 17 | B11 upstream denials (tuned_t, bootloader-update) and B12 Discover-in-VM are the last two boot failures; `sign`/U1–U5 have never run | Gate 1 | run 35668716088 fragments |
| 18 | Merge `integration/installer` into installer main (owner pushes main) | installer | CI run 35668658587 green |
| 19 | Stop Gate 3 push-triggered runs on agent/* branches (email volume) | owner's inbox | gate3.yml `on:` |
