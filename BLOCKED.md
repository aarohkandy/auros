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

## B9 — The $0 self-serve tier has no product any more · OPEN · §9 (pricing) · blocks Gate 4 copy
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

## B10 — A production signing key is a human action · OPEN · blocks publishing, not building
D32 created a development key so Gate 1 is not blocked. It builds, boots and passes the matrix; the
publish step refuses it by reading the key kind back out of the image.

**Before a single customer machine exists**, a human must generate a production key pair, commit the
public half as `signing/keys/auros.pub`, and place the private half in the signing secret. It is a
long-lived organisational credential whose custody matters more than its cryptography — see
`auros-base/signing/RISKS.md` R3.

Doing it late costs a re-sign of everything published under the development key. Doing it now costs
nothing, because nothing is published.

## B11 — The order flow's human check needs a script host §4.5 does not permit · OPEN · blocks Gate 4 exit
Spec §6D's exit condition is that a stranger configures a build, submits, and a PR appears in
`auros-recipes`. The Worker will not accept a POST without a verified Turnstile token
(`auros-web/worker/lib/turnstile.js`), and Turnstile's widget is delivered by
`https://challenges.cloudflare.com/turnstile/v0/api.js`. **Spec §4.5 permits no script host on the
public site other than cdnjs.** Turnstile is not on cdnjs and cannot be: the challenge is served
from Cloudflare's own origin by design.

This is not a one-line fix and it is not mine to make. It needs one of:
1. **An explicit, recorded §4.5 exemption for `challenges.cloudflare.com`** — narrowly, for that one
   endpoint. It is the same origin the Worker already calls for `siteverify`, so the trust decision
   is arguably already taken on the server side; §4.5 is about the *browser* though, and the two are
   not the same question.
2. **A different human check** for the order flow — one that is same-origin, or one the Worker can
   run without a third-party widget.
3. **No human check, and a different abuse control on the Worker** (rate limit, proof of work,
   a review queue). This is a §9 question about what an open PR-opening endpoint may cost.

*What the site does while this is open:* nothing pretends. `auros-web/src/components/configurator/human-check.ts`
holds `HUMAN_CHECK_DEPLOYED = false`; the empty `<div class="cf-turnstile">` is not rendered at all,
the submit button is disabled with the reason printed beside it, and the copy says the email path is
the only path from the site today. Before this was found, the widget div shipped with nothing loading
it, so every visitor — JS on or off — was told the check "has not completed", which described an
exceptional state that was in fact the only state.

*Turning it on is one constant plus the loader*, in the same commit that records the decision.
`auros-web/tools/configurator-a11y.test.mjs` asserts the two halves cannot drift apart again: no
widget without a loader, and no loader from a host §4.5 does not name.
