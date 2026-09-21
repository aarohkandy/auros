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
