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

## B8 — The site advertises replaceability, which proprietary licensing makes false · OPEN · blocks Gate 4
D30 made everything all-rights-reserved. Four places on the site now claim the opposite: the FAQ's
"what happens when you go out of business" answer (clone-and-build instructions), the entire
*Replaceable on purpose* page, the landing page's closing section, and
`auros-recipes/.github/workflows/replaceable.yml`, a CI job that executes the promise weekly.

Publishing any of it now would be the fabricated claim §4.4 forbids.

**Needs the human to pick a trust story** (DECISIONS.md D30 lists three). Gate 4's exit condition — a
stranger configures a build and a PR appears — does not depend on the answer, so the mechanism can be
finished while the copy waits. **No site content ships until this is resolved.**
