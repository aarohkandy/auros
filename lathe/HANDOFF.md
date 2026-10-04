# HANDOFF — Auros, 2026-09-21 ~01:00 UTC

Written by the outgoing agent for the next one. **Read this file, then `DECISIONS.md`, then
`BLOCKED.md`, then `GATE.md`.** Everything else is detail you can look up when you need it.

---

## 0a. UPDATE 2026-09-21 ~18:30 UTC — session ended by the owner; nothing is running

**Read this first, then §0 below.** Everything is committed; the last base build was cancelled at
the owner's request. Local `main` in each repo is what origin has.

**State of Gate 1 (auros-base main = batch 8, `15dc4a3`):**
- S7 green (honest). **Static phase fully green** (S1–S11) as of batch 7, run 35668716088.
- `sign` / U1–U5 have STILL never run: `sign` needs `boot`, and boot still fails on exactly two
  checks (uefi-modern, run 35668716088): **B11** — 11 SELinux denials, all UPSTREAM's now (tuned's
  and bootloader-update's bootc calls; ours are 0, taint 0, zfs/v4l2loopback not loaded); **B12** —
  Discover fails to start in the GPU-less VM (Mesa/ZINK), the three KCMs pass. Fix those two and the
  chain runs. Next batch (accounts + layout screenshots) is on main but its build was cancelled —
  rerun `build.yml` on main to get it.
- Four agents were started on: B11 upstream denials (extend `update-agent/selinux/auros_bootc.cil`
  to tuned_t etc. with a named allowlist), B12 Discover (software GL for the probe only),
  `auros-recipes` examples.yml (needs the `.auros-meta` checkout — run 35672463313), and Gate 3's
  window-station grant. All were stopped before writing anything; their worktrees under
  `/Users/aaroh/auros-wt/` are clean. Start them again from those briefs.

**Gate 3 (installer branch `agent/gate3-continue`, pushed):** enforcement is now a STANDARD-user token
plus deny ACEs on the ~43k directories the token can write (scan ~7 min), profile AppData exempt.
On real runners C1 (nothing written to C:) and C2 pass; the ONE remaining failure is the installer
failing to load shell32 when launched as a non-admin user — no window-station/desktop access
(STATUS_DLL_INIT_FAILED). Documented fix: grant WinSta0/Default to the user before launch. Then
Gate 3 should be green. `integration/installer` (6 feature branches) is green in CI and ready for the
owner to merge into installer main.

**Decisions made by the agent this session, all reversible — owner may overturn any:**
D44 (owner-answered), plus agent calls: Gate 3 enforcement replaces the disk diff (D27 amendment —
write D45); first-login password change is a mandatory welcome-flow step (plasmalogin cannot do
expired passwords); locked-mode users may change only their own password; accounts come from the
recipe + first-boot unit with the hash on the install media (docs/ACCOUNTS.md, branch agent/accounts
merged); mcelog skipped on CPUs it does not support; zfs/v4l2loopback blacklisted (D43).

**CI email spam (the owner's complaint):** ~40 of today's failure emails came from Gate 3 pushes on
two branches. Fix next: make `auros-installer/.github/workflows/gate3.yml` NOT trigger on push for
`agent/*` branches (workflow_dispatch only), and prefer one combined branch. Account-side: GitHub →
Settings → Notifications → Actions.

**Server:** homebase disk was 96% full (not ours; ~0.5 GB of Go caches under ~/work are ours).

## 0. UPDATE 2026-09-21 ~06:30 UTC — read this before §3, which is now history

- **B16 fixed** (auros-base `c849612`): `cmd_drift`/`cmd_update` exist; a test fails on any dispatched
  function that isn't defined, and on any workflow calling a subcommand its script doesn't have.
- **S7 is GREEN, honestly** (D41): the cause was dnf5's SQLite journal, 2 of 169,977 files. Two earlier
  "passes" were vacuous (empty lists; then a build served entirely from layer cache). Builds are now
  `--no-cache` and a cache hit fails the step.
- **Boot matrix:** 17 commits of harness fixes (in-guest deadlock, plasmalogin not sddm) had never been
  merged; they are now. Run 35566336512 is the first boot matrix that can finish.
- **Static phase** now fails only on three owner decisions (S5, S6, S10). **Everything waiting on the
  owner is in one table: BLOCKED.md B21.** The top one: `tools/gate.mjs` must learn S11 (protected
  from agents), or the gate refuses every digest.
- ~25 agent branches landed via integration branches; see `git log` in each repo. New docs:
  `docs/DESKTOP-LAYOUTS.md`, `FLEET-VIEW.md`, `MIGRATION-GUI.md`, `APPDATA-SCOPE.md`.
- **Installer:** nothing on `main` (owner pushes it). Feature branches pushed to origin:
  `agent/label-seam` (the restore + browser-profile routing fix; the only safe copy of that code),
  `agent/honesty`, `agent/gate3-continue`, `agent/gate3-appdata` (junctions verified on real Windows).
  Unpushed local branches: `agent/wifi-printers`, `agent/ci-pins`, `agent/appdata-junctions`, `agent/r1-fixture`.
- **The nightly has never completed a scheduled run** (first two runs were a YAML error, since fixed).
  The control-repo watchdog now opens an issue for exactly this.

---

## 1. What this is

Auros sells custom Fedora **bootc** OS images to schools and nonprofits with 2012–2018 laptops that
modern Windows abandoned. One hardened base image, one ~10-line `recipe.yaml` per customer, rebuilt
nightly so it stays patched. The contract is `docs/SPEC.md`. **`DECISIONS.md` (D1–D37) amends it and
wins wherever they conflict.**

Three sentences that govern everything:
1. The maintained image is the product, not the OS.
2. Craft here is **subtraction** — anything not asked for is deleted, not hidden.
3. *(Amended by D30/D31)* We are **proprietary, all rights reserved**. The site's old fork-and-rebuild
   argument is gone; the replacement is a **wind-down handover**.

## 2. Where things are

| | |
|---|---|
| Working root | `/Users/aaroh/auros` (this is the meta/control repo → `github.com/aarohkandy/auros`) |
| Product repos | `auros-base`, `auros-recipes`, `auros-installer`, `auros-web` — nested dirs, each its own git repo, all **public, all rights reserved** |
| Private repo | `github.com/aarohkandy/auros_private` at `/Users/aaroh/auros-private` — for anything with no public benefit |
| Run everything | `./verify` at the meta root. CI calls the same script. |

**Local machine cannot build or boot anything** — macOS arm64, no podman/qemu/cosign/Go. Every build
and VM boot happens in GitHub Actions. This is settled; don't re-litigate it.

## 3. State as of handoff

**Gate 1 (base builds + boots in a VM): very close.** The hardened image **builds end to end** — all 30
Containerfile steps, every build script, `bootc container lint`. It then fails at **S7 determinism**:
two builds from identical inputs give different content digests.

### ⚠ FIRST: B16 — the upstream pin cannot move. This outranks S7.

The end-to-end system review found that `auros-base/tools/resolve-upstream.sh:269-270` dispatches
`cmd_drift` and `cmd_update`, and **neither function is defined**. Verified by running it:
`cmd_update: command not found`. That script is the ONLY path that moves `base.lock` to a newer
upstream digest, and its callers are `nightly.yml:97` and `build.yml:185`.

So the nightly fails every night, `base.lock` is frozen at `sha256:911281f2…` permanently, and
**spec §3's "CVE response is one rebuild" is currently "a CVE fix has no route into our build graph."**
`bash -n` passes, workflow-lint does not check shell symbols, and nothing in `verify` runs this script —
which is why a full day of testing never saw it. **Fix this before S7.** Details and what the two
functions must do: `BLOCKED.md` B16. Read `docs/SYSTEM-REVIEW.md` for the rest of the review, including
a second fatal: nothing in the system reads a CVE feed, so a fix in OUR layer never triggers a rebuild
and an upstream stall reports green forever.

**THEN:** run `35548421189` in `auros-base`. It carries a diagnostic I added
that makes the S7 failure **name its own cause**. It will print either:
- `PACKAGE SETS DIFFER` → cause (a): `pkg_ensure` installs from live Fedora repos with no pinning
  (`build/00-common.sh:113`), so two builds minutes apart resolve differently. Fix: pin resolution
  (share a primed dnf cache between the two builds, or pin NEVRAs in the base only).
- `PACKAGE SETS ARE IDENTICAL` → cause (b): same packages, different bytes — almost certainly the RPM
  database, a sqlite file with per-package install times that `90-cleanup.sh` already flags as not
  byte-reproducible. Fix: S7 must compare a content digest over files we control, excluding a
  documented exclusion list. **This would mean S7 as specified is unachievable and must be redefined —
  say so plainly rather than weakening it quietly.**

It also prints the differing files by path/size/mtime and a count per directory.

```
gh run view <newest build run> --repo aarohkandy/auros-base --log | grep -A40 "S7 FAIL"
```

> **Do not trust run `35548421189`'s verdict.** It reported `PACKAGE SETS ARE IDENTICAL (0 packages)` —
> a comparison of two empty lists, called agreement. The build removed each raw image immediately after
> flattening to save disk, so the diagnostic had nothing left to inspect. That is the fifth vacuous pass
> found in this repository, and this one was inside the tool built to prevent vacuous passes.
>
> **Fixed** (commit after `de3a367`): the raw images now survive until after the comparison, and the
> diagnostic refuses to conclude anything from implausible data — a Fedora KDE image has thousands of
> packages, so fewer than a hundred means the read failed, not that the image is small. **Take the
> verdict from the NEXT build run, not that one.**

### In flight at handoff (results may arrive after you start)
- **4 Workflow runs** — check `/workflows`. Covering: exercising the check matrix against a real image
  (`probe-matrix.yml`, never run before, on the critical path); Lighthouse ≥95 mobile (a spec
  requirement never measured); a security review of the order path; recipe-differ tests; mutation
  testing on the Worker/web-lib/base-scripts; **the Linux-side restore** (see §5); real build-console
  data; Gate 5 capture tooling; `docs/TESTING.md`; and a **system review** tracing the four core
  promises end to end → will write `docs/SYSTEM-REVIEW.md`. **Read that one when it lands.**
- **2 background agents**: one on `auros-installer` branch `fix/gate3-real-cli` (Gate 3 harness), one
  on `feat/linux-restore`.
- **Uncommitted work exists** in several repos from live agents. Check `git status` in each before
  committing; prefer `git add -A -- ':!advertising'` habits and **read what you commit**.

## 4. Rules that are NOT negotiable

1. **Do not push `auros-installer` `main`.** The owner is doing it personally. Local `main` is at
   verified-green `4b944cb`, 3 ahead of origin. A subagent's push was blocked by the permission
   system and it asked me to push instead — that is permission laundering; I refused, and so should you.
2. **Do not touch branches `fix/gate3-real-cli` or `feat/linux-restore`** — other agents own them.
3. **Never write to real hardware, spend money, email a real person, or create an account.**
4. **§9-reserved for the owner:** prices, any website claim we cannot evidence, declaring a hardware
   model unsupported, anything touching a card or an inbox.
5. **Do not publish the site.** See B12/B14 — it states a commitment with no document behind it.

## 5. What the owner owes a decision on (all recorded in `BLOCKED.md`)

| | |
|---|---|
| **B9** | The `$0` self-serve tier lost its product when the licence changed. Held out of the price table, price untouched, three options recorded. Pricing is §9. |
| **B10** | A production signing key, before any customer. A development key (D32) builds and boots but is **refused at publish** by reading the key kind back out of the image. |
| **B12** | Wind-down terms. Draft at `docs/legal/WIND-DOWN-TERMS.DRAFT.md`. **Blocks publishing the site.** Drafting it exposed a gap in D31: handing someone files they have no licence to use gives them nothing, so the commitment must be a *licence that vests on a trigger*, not a delivery. |
| **B14** | Cloudflare account + **explicit permission to publish**. |
| **B13** | Purge `advertising/` from public git history — deferred; needs a force-push when the repo is quiet. |
| **B4 / B5** | A nonprofit pilot (outreach drafted, not sent) and three donated laptops. |

## 6. The lessons that cost the most today — do not re-learn them

- **A check that cannot fail is not a check.** Three separate checks were *permanently green*: a
  SELinux check (`tr -d '[:space:]'` ate the newlines), `grep -c … || echo 0` (emits `"0\n0"`, which
  would have failed **B8 and B11 on every perfect image**), and **`verify` itself** reported PASS on
  failing suites because a pipe through `tail` lost the exit code (**D37** — written by the same author
  who had recorded that exact rule as D19 hours earlier). **For anything you write, break it on purpose
  and watch it go red.**
- **Never guess a path, unit name or flag.** Four ~50-minute build cycles were lost to remembered
  greenboot layouts and a CLI that did not exist. Probe it, or make the failure print what IS there.
- **Two of my own guards failed their own canaries** — one regex stopped at `|`, another anchored at
  line start. Both reported "clean" while the bug was present.
- **A commit to a public repo is a publication.** `git add -A` published a 48-file go-to-market strategy
  nobody had read. Now in `auros_private` (D36).
- **Derived is safer than hardcoded only when it derives from the same thing.** `.wants` vs `WantedBy`.
- **Audit against the contract, not your task list.** `TASKS.md` said the installer was nearly done; the
  entire **Linux-side restore did not exist** (B15) — the half that puts a school's files *back*.
- **CI hygiene:** the base build takes ~50 min (S7 builds and flattens twice — see R6) and **queues**.
  Several agents pushing = an hour of delay for everyone. `paths-ignore` and `cancel-in-progress` are
  now set; the image build deliberately does not cancel, since a run on main may be mid-publish.
  85 failed runs emailed the owner today — **watch the volume you generate.**

## 7. Suggested order of work

1. **Read `35548421189`'s S7 verdict** and fix determinism accordingly. This is Gate 1's last blocker.
2. **Read `docs/SYSTEM-REVIEW.md`** when it lands — it ranks what actually breaks for a real school.
3. Land the in-flight workflow results; commit carefully (agents are editing).
4. Get the check matrix (`probe-matrix.yml`) running clean — it fires the moment the base builds.
5. Then Gate 2: `gate1-exit.yml` already publishes fixtures to a separate repo with a run-scoped key
   and never touches `:hardened`, so it does **not** need B10.
6. Gate 3 (100 clean + 20 aborts on ephemeral Windows runners, D27) — agent in progress.
7. Propose R6/R7 (halve build cost, make superseded builds cancellable) **only after Gate 1 is green** —
   changing the pipeline mid-debug turns one unknown into two.

## 8. Honest status

Nothing has touched real hardware. No image has been published. No customer exists. The boot path is
proven on a *minimal* derivative, not on the hardened image. `hardware/compat.tsv` is a header row, and
the honesty gate enforces that we may not claim hands-on experience until it has physical rows.

Roughly 1,500 tests exist; ~27 real bugs were found by writing them. Every claim on the site is gated.
