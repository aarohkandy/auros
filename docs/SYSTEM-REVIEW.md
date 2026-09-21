# SYSTEM REVIEW — AUROS as a product, not as a set of repositories

**Date:** 2026-09-20 · **Scope:** the promises in SPEC §1 and §3, as amended by DECISIONS D1–D37, traced end
to end through `auros-base`, `auros-recipes`, `auros-installer`, `auros-web` and the control repo.

**What this document is for.** It is the thing to read before putting Auros in front of a school. It is not
a bug list — the repositories are well-tested and several components are better than they need to be. It is
an assessment of whether the *assembled system* delivers what the pricing page sells. It does not.

**Method.** Every claim below is traced to a file and a line, and the load-bearing ones were verified by
execution rather than by reading. Where a supplied trace overstated a finding it is corrected in place and
marked **[trace corrected]**; those corrections narrow three findings and rescue no promise.

---

## 1. The promises, and whether they hold

| # | Promise | Verdict |
|---|---|---|
| P1 | **"CVE response is one rebuild."** Base rebuilds → children rebuild → machines update on next boot (SPEC §3; `auros-web/src/content/pages/3-pricing.mdx:21-22`). | **BREAKS.** The only code path that moves the upstream pin calls a function that does not exist. Nothing can enter the build graph. |
| P2 | **"An unsigned or untested image can never reach a customer."** Enforced mechanically, not by convention (SPEC §3, §4.3). | **BREAKS.** The base is gated well. The *recipe* — the only image a school laptop follows — is published with no signature and no key-kind check, into a namespace the machine's own policy requires a signature for. |
| P3 | **"Every file intact."** Inventory → disclose → copy → verify → wall → restore → re-verify → count on the desktop (SPEC §1, §4.1, §6C). | **BREAKS.** The Windows half is strong and its safety invariant holds. The Linux half is not in the repository, the two halves disagree about their only shared contract, and two advertised capabilities have no implementation at all. |
| P4 | **"Only what you asked for."** Pruned packages are deleted, and are bytes the customer never downloads (SPEC §1.2; D2/D11/D12). | **BREAKS.** The flatten is implemented on `auros-base:hardened`, which no customer pulls. The customer's image is a layered `podman build`, so every pruned package is downloaded and then discarded. The removal floor meant to catch regressions is enforced nowhere and is unreachable by arithmetic anyway. |
| P5 | **"If we cease, you get the build files."** The post-D31 trust story (D31; `auros-recipes/src/explain.ts:330-345`). | **CAVEAT.** Honestly narrowed on the website and in the order PR. It is still a promise to hand someone files under a licence that forbids building from them, and two repository READMEs still instruct readers to do what `LICENSE:5-7` prohibits. |
| P6 | **"Somebody watches the nightly build."** Sold as the thing being paid for (`pages/3-pricing.mdx:18`; `pages/5-replaceable-on-purpose.mdx:143-144`). | **HOLDS, AND THAT IS THE PROBLEM.** Literally true. There is no alerting of any kind — verified: zero occurrences of `gh issue create`, `slack`, `webhook`, `notify`, `mailto` or `SMTP` in any workflow in `auros-base/.github` or `auros-recipes/.github`. A human's attention is not a gap in the implementation; it *is* the implementation. |
| P7 | **Zero-terminal** (SPEC §11.1 / D4, HUMAN, binding). | **BREAKS** for the migration. Both halves are command-line programs. Not recorded as a deviation anywhere. |
| P8 | **Gate 1 is one build away** (`GATE.md:8`). | **NOT TRUE.** Gate 1 is one *human credential* away. `auros-base/signing/keys/auros.pub` does not exist, the `sign` job hard-fails without it, and `update`, `record` and `publish` all depend on `sign`. |

---

## 2. What breaks, ranked by consequence

Ranked by *who is harmed, when they find out, and whether they can recover* — not by severity label.

### 2.1 — The customer-facing image is published unsigned into a namespace that requires signatures

**Where:** `auros-recipes/.github/workflows/build-recipe.yml:345` (the publish), against
`auros-base/signing/policy.json:5-10` and `auros-base/build/30-update-agent.sh:43-51`.

`auros_scope_default()` emits `ghcr.io/<org>` — the *whole namespace*. `policy.json` installs a
`sigstoreSigned` rule at that scope with keyPath `/usr/lib/pki/containers/auros.pub`. Scope matching in
containers/image is most-specific-wins, so `ghcr.io/aarohkandy/auros-lincoln:latest` matches that rule.

There is no cosign invocation anywhere in `auros-recipes`. Verified: a recursive grep for cosign across that
repository returns exactly one hit, a third-party-context regex in `test/licence.test.ts:60`. The word
"recipe" does not appear in `auros-base/signing/README.md`, `RISKS.md`, `BLOCKED.md` or any ticket in
connection with signing. **Signing was designed for the layer machines do not follow.**

The check matrix actively conceals this. `build-recipe.yml:247-250` hands `--signing-key /tmp/auros.key` to
`run-update.sh`, which signs the candidate *inside the test VM*
(`auros-base/matrix/run/run-update.sh:118-124`). U1–U5 therefore prove that a **signed** recipe image
installs — and then CI publishes an **unsigned** one. Green matrix, broken product.

Two outcomes, and both break the promise:

- **(a) As built:** every machine refuses its own recipe updates forever. `bootc upgrade` fails,
  `auros-base/update-agent/libexec/auros-update:220` exits 0, and the fleet silently stops being patched.
- **(b) If anyone "fixes" this by loosening the policy** instead of signing, unsigned images reach
  customers — SPEC §3's prohibition, verbatim.

**Who is harmed:** the school. 180 laptops keep booting and stop receiving every security rebuild — the
exact orphaned machine the product exists to replace, manufactured by us.

**When they find out:** possibly never. The only signal is `70-update-freshness.sh`, which sits in
`wanted.d` (reported, never a rollback trigger) and writes to the boot-status motd, on a zero-terminal
machine under `locked`/`kiosk` policy. `auros-console` (§6E) is deliberately unbuilt, so there is no fleet
view. `propagate.yml` tracks whether images were **built**, never whether machines **installed** them.

**Recoverable:** yes, by adding a sign step. But the fleet's unpatched window is unbounded and invisible.

This outranks everything else because it is the only defect that produces silent, fleet-wide, indefinite
harm to a paying customer with no signal on either side.

---

### 2.2 — Nothing moves the upstream pin. The one code path that would calls a function that does not exist.

**Where:** `auros-base/tools/resolve-upstream.sh:269-270`, called from
`auros-base/.github/workflows/nightly.yml:97` and `auros-base/.github/workflows/build.yml:185`.

Lines 269-270 dispatch `drift) cmd_drift ;;` and `update) cmd_update ;;`. Neither function is defined.
Function definitions in the file stop at `cmd_assert()` (line 206) and the file ends at line 264.

**Verified by execution:**

| invocation | result | exit |
|---|---|---|
| `./tools/resolve-upstream.sh update` | `line 270: cmd_update: command not found` | **127** |
| `./tools/resolve-upstream.sh drift` | `line 269: cmd_drift: command not found` | **127** |
| `./tools/resolve-upstream.sh mirror` | `unknown command 'mirror'` | **1** |
| `bash -n tools/resolve-upstream.sh` | (silent) | 0 — **syntax is valid** |

Consequences, in order:

- The nightly's *Re-resolve the upstream digest* step (`nightly.yml:92-97`) fails every night. The `drift`
  job goes red. `moved` is never set, so *Commit the new lock* (`:99`) is skipped and `build`
  (`nightly.yml:149`, gated on `needs.drift.outputs.moved == 'true'`) never runs.
- `auros-base/base.lock:7` is frozen at `sha256:911281f2…d0d2f1`, resolved 2026-09-20 (line 8),
  **permanently**.
- `build.yml:185-192` runs the same broken subcommand on *every* build under `set +e`, gets rc=127, and its
  fallthrough arm reports `::warning::could not reach the upstream registry to check drift`. **The one
  place in the pipeline that touches this bug on every run actively misdiagnoses it as a network problem.**

The irony is recorded in the repository itself. `build.yml:211` reads: *"This is how the publish step
silently stopped running: it called subcommands that do not exist."* That lesson was turned into a
CLI-contract test for `gate.mjs` (`build.yml:203-212`, plus `tools/gate.refusals.test.mjs`) and **never
applied to the shell scripts**. Nothing in `verify` resolves a shell entry point; `tools/workflow-lint.mjs`
checks only pipefail and `${NAME}` env interpolation.

**Same class, three more instances:**

- `auros-base/.github/workflows/gate1-exit.yml:233` calls `./tools/resolve-upstream.sh mirror`, which is
  not even in the case statement (`:266-274` accepts resolve, assert, drift, update). Verified: exit 1. The
  step has no `set +e`, so under the file's `bash -euo pipefail` default it is fatal. **Gate 1's own binary
  exit test cannot pass** — the gate `GATE.md:8` lists as IN PROGRESS.
- `auros.config.json:14` says *"Pinned by tools/pin-upstream.sh, never edited by hand."* That file does not
  exist; `auros-base/tools/` holds five scripts and that is not one of them.
- `auros-base/CI.md:124` and `:292` document `resolve-upstream.sh update` as a working recovery instruction.

**Who is harmed:** every customer on every image. Upstream's fix physically cannot enter the build graph.
**When they find out:** the first red nightly — tonight — but only if a human opens the Actions tab.
**Recoverable:** yes, trivially. Two functions. The consequence is product-level; the fix is an hour.

---

### 2.3 — The rebuild trigger is "the digest moved", not "a fix exists"

**Where:** `auros-base/.github/workflows/nightly.yml:149`, and the absence of any CVE feed.

Verified: a recursive case-insensitive grep for cve, advisory, osv and nvd across `auros-base/.github`,
`auros-recipes/.github`, `auros-base/matrix` and `auros-base/tools` returns five files, **all of them prose
citing SPEC §3**. Nothing reads NVD, OSV, a Fedora advisory feed, or anything else.

Two consequences the plan does not address:

- **Our own layer is not covered.** `build/10-hardening.sh`, `20-policy.sh` and `30-update-agent.sh`
  dnf-install packages (greenboot among them) resolved at build time from Fedora repos. A CVE in one of
  those does not move the upstream digest, so we never rebuild and never pick it up.
- **An upstream stall reports green.** If ublue-os/aurora's CI is red for three weeks, or Fedora freezes for
  a mass rebuild, `nightly.yml:137-141` prints *"No change. Not rebuilding"*, the run is green, every night,
  and the fleet is unpatched with every dashboard clean. **There is no maximum-age forced rebuild and no
  floor on staleness anywhere in the system.**

**Who is harmed:** every customer.
**When they find out:** *never, from inside.* The system's own reporting says healthy in exactly this state.

**This is a defect in the plan, not a schedule slip.** More building does not finish it, because the design
has no input that represents "a fix exists."

---

### 2.4 — The machine-side staleness canary cannot see a supply-side stall

**Where:** `auros-base/update-agent/libexec/auros-update:224` and `:232`, read by
`auros-base/update-agent/greenboot/check/wanted.d/70-update-freshness.sh`.

`last-successful-fetch` is stamped at line 224 whenever `bootc upgrade` exits 0. Line 232's
*"already up to date; nothing staged"* is an exit-0 path *below* that stamp. So when **we** stop publishing,
every laptop contacts the registry every six hours, finds nothing, and reports *"last successful update
fetch was 0 day(s) ago"* — green, forever. `WARN_AFTER_DAYS=14` is never reached.

**The check measures "can I reach the registry", not "is the image I am running current."** That is the
failure mode this system actually has, and it is the one the canary is blind to.

The file's own header documents that this check *"was wrong in both directions at once"* and that both
halves were fixed. It fixed the fetch-failure half and left the no-publish half open.

Everything needed to fix it is already on the machine: `bootc status --json` carries the booted image's
digest and creation time, and `vm-digest` in `gate1-exit.yml:218-224` already reads exactly that field.

Secondarily: even when it does fire, it writes to the boot-status motd, on a product whose D4.1 directive is
zero-terminal. **The one staleness signal lands in the one place the product promises nobody has to look.**

**Who is harmed:** every customer. The fleet cannot self-report the thing it is most likely to suffer from.
**When:** never, from the machine.

---

### 2.5 — Propagation fails open, silently, and is scheduled to break in November

**Where:** `auros-recipes/.github/workflows/propagate.yml:52`, `:62`, `:64-68`.

The poll is the only propagation mechanism we actually have, since dispatch needs the B2 credential. Line 64
runs an unauthenticated `skopeo inspect` and, on any failure, prints *"base not published yet — nothing to
propagate"*, sets `stale=[]` and exits 0.

**Every failure mode collapses into that branch and reports success:** a private GHCR package (new GHCR
packages are private by default and this inspect is unauthenticated), a registry outage, a rate limit, or
skopeo being absent. **144 green runs a day, forever, propagating nothing.**

Line 52 is `runs-on: ubuntu-latest`, which D23 forbids *precisely because* it migrates to 26.04 between
2026-10-19 and 2026-11-19 — **29 days from today**. Line 63's comment, *"skopeo is preinstalled on
ubuntu-latest (measured: 1.13.3)"*, is a measurement of an image that is about to be replaced. On that
migration, propagation stops and every run stays green.

Line 62 also hardcodes `ghcr.io/aarohkandy/auros-base:hardened`, which D1 and `auros.config.json` say must
be derived. `build.yml:136` gets both of these right; the propagation path gets both wrong.

**Who is harmed:** every customer fleet simultaneously. The base can be publishing fixes correctly while no
recipe ever hears about them.
**When they find out:** not discovered. A green schedule saying "nothing to propagate" is indistinguishable
from a healthy idle system.

---

### 2.6 — The Linux restore half exists only in a temp directory

**Where:** `auros-installer` (committed) versus a session-scoped scratch worktree at
`/private/tmp/claude-501/.../scratchpad/lr`.

Verified:

- `git rev-parse main feat/linux-restore` in `auros-installer` returns the same commit `4b944cbd6b44…` for
  both. **The branch BLOCKED.md B15 names holds nothing.**
- `auros-installer/internal/` contains no `restore`, no `netprofile`, no `printers`, no `deskbus`.
  `auros-installer/cmd/` contains `auros-migrate` only.
- The scratch worktree is on `feat/linux-restore` at the same commit, with `git status --porcelain` showing
  six untracked entries: `cmd/auros-restore/`, `internal/restore/`, `internal/deskbus/`,
  `internal/netprofile/`, `internal/printers/`, `internal/safety/wall_restore_test.go` — **104 Go files, all
  untracked**. Its `dist/` directory is empty, so the systemd unit was planned and never written.
- Nothing in `auros-base/Containerfile` or `auros-base/build/*.sh` installs a restore binary or unit, and
  `auros-base/desktop/welcome/auros-first-run.service` does not invoke one.

**Two separate findings with different characters.** That the restore is not yet installed into the image is
a *schedule item*. That the only copy of roughly five thousand lines of the most safety-critical code in the
company — the code that runs when the archive is the user's **only** copy, because the old disk has been
overwritten — lives in a session-scoped temp directory that no backup, no CI and no other session can see,
is not.

**When they find out:** the scratch-directory risk materialises silently, whenever temp is reaped.
**Recoverable:** no, if it is reaped.

---

### 2.7 — The two halves of the migration disagree about their only shared contract

**Where:** `auros-installer/internal/winenv/env_windows.go:84-91` (producer) versus
`internal/restore/route.go:105-155` in the scratch worktree (consumer), joined at
`auros-installer/cmd/auros-migrate/main.go:405`.

The Windows side can only ever produce **eight** first path segments: Desktop, Documents, Downloads,
Pictures, Music, Videos, RoamingAppData, LocalAppData.

The Linux router handles those six folder labels plus Firefox, Chrome, Edge, WiFi and Printers. **Those five
are never produced, so five whole code paths are dead** — including D15's password-withholding branch at
`route.go:130-140`.

Browser profiles travel *inside* the AppData labels. The Gate 3 corpus itself places them at
`AppData/Local/Google/Chrome/User Data/Default` and `AppData/Roaming/Mozilla/Firefox/Profiles`
(`testharness/gen/generate.go:262-270`). On Linux they hit the default branch and land under
`~/Restored from Windows/LocalAppData/…` and `~/Restored from Windows/RoamingAppData/…`. Firefox never sees
its profile at `~/.mozilla/firefox`; Chrome never sees its bookmarks at `~/.config/google-chrome`.

And because the withheld disposition never fires, **Chrome's Login Data, Cookies and Web Data are restored
into the user's home as ordinary files and counted as files that came across**, while the report's
explanation of why passwords did not migrate is never printed — it requires a non-zero withheld count.

Both sides are implemented. Both sides pass their own tests. **Neither side's tests look at the join.**

**Who is harmed:** every user with a browser, which on a school laptop is every user — SPEC §1's first
customer profile is an organisation already living in a browser.
**When they find out:** when they open Firefox on the new machine and it is empty. That is *after* the
Windows disk has been repointed. The old machine is already gone.

---

### 2.8 — Wi-Fi and printers are claimed on the website, in the §4.2 disclosure, and in the claims ledger, and do not exist

**Where:** `auros-installer/cmd/auros-migrate/main.go:355-356`;
`auros-web/src/content/migration/23-wifi-credentials.md`; `auros-web/src/content/CLAIMS.md:159`.

SPEC §6C.1 requires the Windows tool to inventory Wi-Fi profiles, mapped printers and the account name.
Verified: a case-insensitive grep for wlan, netsh, wifi, EnumPrinters and printer across
`auros-installer/internal/` and `cmd/` returns **three** hits — the claim itself at `main.go:355-356`, and a
function called `progressPrinter` at `main.go:371`. **There is no export code at all.**

Meanwhile `main.go:355-356` tells the user, *inside the phase-2 disclosure that prohibition §4.2 exists to
make honest*, that Wi-Fi networks, printers and account name do come across.
`migration/23-wifi-credentials.md` tells the public the installer reads saved wireless profiles and carries
them over. And `CLAIMS.md:159` marks the row verified on 2026-09-20 with the justification **"SPEC §4.2 and
§6C.1 name exactly these. DESIGN."** — *the evidence offered for the claim is the promise.*

This is the structural weakness in the honesty gate, stated plainly: it verifies that CLAIMS.md was read
against the newest decision. It cannot verify that a row marked DESIGN corresponds to code that exists. It is
B12's lesson applied to legal claims and never generalised to capability claims.

On the other side of the wall, `internal/netprofile/` and `internal/printers/` sit in the scratch worktree
waiting for WiFi and Printers labels that cannot be produced.

**Who is harmed:** the school. This is the claim that makes a 180-machine rollout sound like a day rather
than a week of retyping the wireless key at every desk.
**When they find out:** first boot of the first machine — or earlier, in the sales conversation, by a buyer
who reads the migration page. The second is survivable; the first is a refund.

---

### 2.9 — Pruned packages are downloaded by every customer, every night

**Where:** `auros-recipes/.github/workflows/build-recipe.yml:154` and `:345`, against
`auros-base/.github/workflows/build.yml:354-363`, where the flatten actually lives.

The recipe is built with plain `sudo podman build` (line 154) and pushed with plain `sudo podman push` (line
345). The prune runs as a **new layer** on top of the base (`auros-recipes/src/compile.ts:444` emits a RUN
of `/usr/libexec/auros/auros-prune`, which calls dnf remove). Nothing re-chunks or squashes the recipe image.

`rpm-ostree compose build-chunked-oci --bootc` appears in exactly two places:
`auros-base/.github/workflows/build.yml:360` and `gate1-exit.yml:247`. Both operate on `auros-base`, whose
output is an intermediate **no customer ever pulls**.

So the removed files remain as bytes in the lower base layers of the published manifest; the recipe layer
adds whiteouts. **A school downloads every pruned package and throws it away at extraction.** D2's stated
purpose — *"so that removed packages are bytes the customer never downloads"* — is satisfied for an image
nobody pulls and false for the only image that reaches a laptop.

This is **"cannot work as designed"**: the design placed the flatten at the wrong publish.

It also makes example-kiosk's `size_budget_gb: 4` unreachable, since S6 measures compressed pull size and
the upstream base alone is 3.5 GB (`auros-base/base.lock:11`) before `auros-base`'s own additions.

**Who is harmed:** the school on the school uplink — the exact customer BLOCKED.md B6 is about. And anyone
who believed `pages/1-landing.mdx:31-33` (*"not bytes your machines download"*) or
`faq/7-updates-one-uplink.md:21-22` (*"a smaller image is a smaller pull, every night, forever"*).
**When they find out:** first nightly pull on a real fleet. Before that, S6 fails the build against the
declared budget and reads as a budget problem rather than as a missing pipeline stage.

---

### 2.10 — The removal floor is unenforceable and arithmetically unreachable

**Where:** `auros-recipes/src/prune.ts:268-283` (P1-floor), `:449-477` (the count),
`auros-recipes/src/explain.ts:139-144` and `auros-web/src/content/copy.ts:267` (the claim).

Two failures compounding.

**(a) `must_remove_at_least` is enforced nowhere.** P1-floor is an English sentence in
`removal-report.json`'s post_conditions array. No check in `auros-base/matrix/checks.yaml`, no branch in
`analyze.mjs`, `run-static.sh`, `run-boot.sh` or `run-update.sh`, and nothing in `tools/gate.mjs` reads
`floor.met`. Verified: a recursive grep for "floor" across all `.mjs`, `.sh`, `.yml` and `.yaml` in the tree
returns four hits, none of them a floor check — one honesty-gate corpus string, one D16 WinApps note, one
compat-lint test, one pricing regression test.

**(b) Even if something read it, the number is computed from the plan, not the image.** `prune.ts:451`
iterates the plan's `planned` array and increments `removed` only for packages the recipe *named* and rpm
found installed. The dependency closure — which the code's own comment calls "most of the work" — is excluded
by construction. `packages_installed_after` is computed at `:474` and never used.

The two halves point at each other. The in-image script's own trailing comment says *"The floor is asserted
by the check matrix … not here"*, while the script sets `floor["met"]` itself at `:477` from the plan count.
And `prune.ts`'s header at lines 20-22 warns that *"a floor of 240 checked against a plan of 30 would be an
alarm that can never go off"* — the code it introduces is exactly that.

**Verified arithmetic:** example-kiosk declares `must_remove_at_least: 1100`
(`customers/example-kiosk/recipe.yaml:26`). Decoding the base64 prune-plan embedded in
`customers/example-kiosk/Containerfile` gives **57 planned packages**. `floor.met` is mathematically false
forever. example-school declares 240 against a catalogue universe of under 100 names
(`catalogue/apps.tsv` 53 lines and `catalogue/groups.tsv` 63 lines, headers included).

**Who is harmed:** the customer who read the order PR. `explain.ts:139-144` tells them by name that if the
build removes fewer than the floor, it fails and nothing is published. It does not fail and nothing checks.
The stated purpose — catching upstream silently un-pruning the product — is unprotected, so the first quiet
regression reaches a school.
**When they find out:** never, by us. Only when someone reads `removal-report.json` on a machine and sees a
failed floor beside a published image.

---

### 2.11 — The recipe's base pin and the D28 drift check are mutually exclusive

**Where:** `auros-recipes/src/compile.ts:157-160` and `:191`, against
`auros-recipes/.github/workflows/build-recipe.yml:84` and `:142-147`.

**[trace corrected]** The supplied trace called this a variable-name mismatch. It is worse: plumbing the
variable through would *break the build*.

`resolveBaseDigest()` reads `AUROS_BASE_DIGEST`. The workflow sets `BASE_DIGEST` (line 84) and never exports
the name the compiler wants. So every recipe compiles with a tag-only base — confirmed in the committed
artefact at `customers/example-school/Containerfile:9-10`: *"base pinned by tag only — no digest was
supplied to the compiler."*

But `build-recipe.yml:142-147` implements D28 by regenerating the Containerfile and **failing the build on
any difference** from the committed copy. **Verified by execution:** compiling example-school with
`AUROS_BASE_DIGEST` set to a well-formed digest changes both the header line *and* the FROM line, so the
regenerated file differs from the committed one and the job exits 1 at line 147.

**The per-build digest pin and the committed-Containerfile guarantee cannot both hold.** This is a plan
defect, not a typo.

Two things follow. `build-recipe.yml:374` writes `.locks/<name>.lock` claiming a `BASE_DIGEST` the build did
not actually use — and `propagate.yml:83` treats that lockfile as proof the fleet is current. A base
published between resolution and build makes a fleet **permanently not-stale on a base it never received**:
the abandoned-machine failure the lockfile was moved out of `customers/` to prevent, reintroduced from the
other end of the same mechanism. And SPEC §6B's gated determinism property — *same recipe + same pinned base
digest ⇒ same content digest* — has no pin behind it; S7 compares two builds minutes apart, which is a
weaker statement.

---

### 2.12 — B2 is mis-scoped, and the mis-scoping is load-bearing

**Where:** `BLOCKED.md:20-28`, against `auros-base/.github/workflows/build.yml:934` and
`auros-recipes/.github/workflows/build-recipe.yml:316-330`.

B2 describes the missing cross-repo credential as costing instant dispatch versus a 10-minute poll:
*"propagation still happens unattended, just on a poll interval… Instant dispatch is the upgrade."*

That is not what the code does. The **same** missing `AUROS_DISPATCH_TOKEN` is what writes the attestation
ledger in the control repo, and **both publish gates read that ledger from origin**:

- `build.yml:934` hard-fails the `record` job without it, and `publish` depends on `record`.
- `build-recipe.yml:316-330` refuses to publish without a ledger row and says so in its own error text.

**B2 blocks every publish in the system, base and recipe alike.** An operator triaging blockers by stated
impact would rank it as a latency nicety and work on something else.

Worse, B2 asks the human to mint a fine-grained PAT with *"contents: write on auros-recipes only"*. That
token would **not** satisfy `build.yml:934`, which needs write on `aarohkandy/auros`. Following B2 as
written leaves base publishing broken, and the failure will look like a token-scope bug at 2am.

B2's stated *cause* is also the one D18 explicitly corrects: B2:21 says GitHub *"suppresses this deliberately
to prevent recursion"*; D18 says the recursion rule is not the cause and the docs exempt
`repository_dispatch`. Someone acting on B2 may go looking for the wrong fix.

**Separately, a design point.** `attest/README.md` presents layers 1 and 2 as independent — the CI step reads
the ledger, and only the workflow token can write the registry. They collapse onto one secret.
`AUROS_DISPATCH_TOKEN` must carry write on the control repo and is available to every workflow in
`auros-base`. **The same repository that builds the image holds the credential that authors its own
evidence.** B17 states this weakness in the abstract; that is its concrete shape.

---

### 2.13 — Gate 1 is blocked on a human credential, and GATE.md does not say so

**Where:** `auros-base/.github/workflows/build.yml:646-652` and `:723-726`;
`auros-base/matrix/run/run-update.sh:70`; D32 (`DECISIONS.md:494-528`); `BLOCKED.md:109-120`.

D32 states the development key *"builds, boots and passes the matrix"* and is refused only at publish.
**That is not true of `build.yml`.**

- `auros-base/signing/keys/` contains `.gitkeep`, `DEVELOPMENT-KEY.md`, `README.md` and
  `auros-development.pub`. **`auros.pub` does not exist.**
- `build.yml:651` hard-fails the `sign` job when `signing/keys/auros.pub` is absent; `:646` hard-fails when
  `COSIGN_PRIVATE_KEY` is unset.
- Job graph, verified: `update` needs `[plan, build, sign]` (`:725`); `record` needs
  `[plan, build, static, boot, sign, update]` (`:817`); `publish` needs `[plan, build, record]` (`:981`).
- `run-update.sh:70` refuses to run without `--signing-key`.
- `AUROS_DEV_SIGNING_KEY` — named in D32:520 and `DEVELOPMENT-KEY.md:34` as where the dev private half
  lives — is referenced by **zero workflows**. Verified: its only occurrence in the entire tree is
  `DECISIONS.md:520`.

So U1–U5 and R1 cannot execute, the ledger can never receive a row (`attest/passed-digests.tsv` has **zero
data rows**, verified), and the D32 refusal at `build.yml:1053` has never run and cannot run today.

**Consequence for the plan, not just the code:** B10 says a production key *"blocks publishing, not
building."* It blocks the full check matrix, which GATE.md's own "Not proven" section says Gate 1 requires.
**Gate 1 is sitting behind a §9 human action nobody has been told is on the critical path**, and `GATE.md:8`
reads as though it is one build away.

It fails closed, so no customer is exposed. What is harmed is the project's ability to plan.

---

### 2.14 — The key-kind guarantee tests a filename, and our own repo demonstrates the bypass

**Where:** `auros-base/build/30-update-agent.sh:284-291`, defeated by
`auros-base/.github/workflows/gate1-exit.yml:191-196`.

D32's guarantee is that the key kind *"travels with the artifact"* so a workflow cannot claim production for
a development build. But the test is whether the **file** `signing/keys/auros.pub` is non-empty. It
identifies a filename, not a key.

`gate1-exit.yml:191` generates a throwaway key pair on the runner and `:196` copies its public half over
`signing/keys/auros.pub`. Every fixture image it builds therefore records `signing-key-kind=production`.
**We already ship a working demonstration of the bypass.**

Nothing anywhere in the publish path pins the production key's fingerprint.
`signing/keys/DEVELOPMENT-KEY.md:3` records a fingerprint for the *dev* key and no code reads it; there is no
equivalent for the production key. The `sign` job (`build.yml:664-670`) only checks that
`COSIGN_PRIVATE_KEY` round-trips to whatever `auros.pub` currently holds.

**When they find out:** never, by CI. The publish step prints *"signing key kind: production — publish
permitted"* and proceeds.

---

### 2.15 — There is no gated path from a published image to install media

**Where:** `docs/GATE5-RUNBOOK.md:28-29`; D13 (`DECISIONS.md:124-137`);
`auros-base/matrix/run/lib/vm.sh:75` and `:81`.

D13 removed boot-media writing from the Windows tool — correctly; it was the most destructive code path in
the company — and said install media is produced elsewhere, by a machine with the tools for it. Nothing
replaced it. The only artefact describing it is an unchecked checkbox saying an installable ISO exists from
bootc-image-builder, written to a USB stick by a Linux machine.

Whoever makes that USB types an image reference by hand. **None of the four layers in `attest/README.md` is
on that path:** layer 1 is a CI step, layer 2 governs registry *writes* not reads, layer 3 (install-time
signature policy) lives *inside* the image being installed so it cannot judge itself, and layer 4 is a
PreToolUse hook that matches publish shapes, not `bootc install`. A local `--local` build (`vm.sh:81`), a
staging-tag ref, or a fixtures ref all produce a bootable disk with no ledger lookup and no signature check.

**Who is harmed:** the first three pilot laptops, and every machine imaged thereafter. Bytes run as root from
first boot.
**When they find out:** only if someone later diffs the installed digest against the ledger. Nothing does;
the Gate 5 runbook does not ask for the digest at all.
**Recoverable:** no. An image that should not have been installed cannot be un-installed from a school.

---

### 2.16 — The staging tag is signed and installable, and the one message an operator reads says it is not

**Where:** `auros-base/.github/workflows/build.yml:39`, `:483`, `:1158`, `:1175`, against `:581-672`.

Four places assert the staging tag is *"unsigned, not installable"* / *"unsigned and cannot be installed."*
That is true only until the `sign` job runs, which is **before** `update`, `record` and `publish`. cosign
signs the **digest** (`:672`), and `signedIdentity: matchRepository` (`signing/policy.json:8`) accepts any
tag on that repository. So after signing, the staging tag is a fully installable image on every machine in
the field.

If `update` then fails — the leg that proves a machine refuses a bad image and rolls back — the run stops,
nothing publishes, and those signed bytes stay in the public production repository. `cleanup`
(`:1129-1177`) is best-effort, and its warning at `:1175` tells the operator the tag stays but *"it is
unsigned and cannot be installed."*

**That is the one message an operator reads during an incident, telling them not to worry, about the one case
where they should.** `attest/README.md:44-50` states the true version correctly; `build.yml` contradicts it
in every place someone would actually look.

---

### 2.17 — The two guards against GitHub disabling the nightly defeat each other in exactly the state the system is in

**Where:** `auros-base/.github/workflows/nightly.yml:232-260` and
`auros-base/.github/workflows/build.yml:1179-1187`.

GitHub disables scheduled workflows on public repos after 60 days of repository inactivity.

- The nightly's own `schedule-health` job cannot rescue a disabled workflow. Its comment at lines 240-243
  says so: a disabled workflow does not run, so the step does not run.
- The backstop, `keep-nightly-enabled`, runs only on a push to main (`build.yml:1187`). The only automatic
  push to main is `nightly.yml:116` — which happens **only when upstream moved**. With `cmd_update` dead it
  never happens; with upstream stalled it never happens either.

**So the exact scenarios that most need the nightly are the scenarios that silently switch it off.** The
residual signal is a `::warning::` at day 45 inside a step summary (`nightly.yml:258-260`).

**When they find out:** never automatically. GitHub emails the repo owner once; after that the Actions tab
shows a workflow with no recent runs, which looks like a quiet week. After the 60-day mark, fixing everything
upstream of it changes nothing until a human clicks Enable workflow.

---

### 2.18 — D21 is documented as "not optional" and is implemented as a log line

**Where:** `auros-base/Containerfile:32` against `auros-base/.github/workflows/build.yml:168-176`.

The mirror is populated on every successful build (`build.yml:286`). The Containerfile's FROM still points at
`ghcr.io/ublue-os/aurora@sha256:911281f2…`. `build.yml:171-176` detects exactly this and emits a warning
with the words *"flipping FROM to the mirror is a one-line change"* — explicitly not a gate.

**The architectural decision D21 calls mandatory is implemented as a log line asking a human to make a
one-line edit**, among hundreds of lines of output on a fifty-minute build.

D21 records that ublue-os/aurora garbage-collects our pinned digest after roughly 90 days *or 7 newer stable
tags, whichever comes first*. Stable moves often, so **7 newer tags is the binding clause**, and that is
likely weeks, not 90 days.

**When they find out:** one morning, all at once, when every build in every repo goes red simultaneously on a
manifest-unknown for an image nobody touched. Then every customer. Then — per D21 and D31's handover
commitment — any customer who took the wind-down handover and tries to rebuild.

---

### 2.19 — S5 fails on every recipe build that will ever be attempted

**Where:** `auros-base/matrix/run/lib/analyze.mjs:74-80` against `auros-recipes/src/prune.ts:224-260`.

`reportEntries()` accepts `r.packages`, `r.removed` or `r.removals`. `removalReportShape()` emits the array
as **`planned`**. There is no other producer. So S5 takes the branch at `analyze.mjs:120` —
*"removal-report.json has no packages (or removed) array"* — and fails.

Two agents wrote the two halves of one contract and nobody ran them against each other. **It fails closed,
which is why nothing bad shipped, but it means the check matrix has never passed on a customer image and
cannot** — so `build-recipe.yml`'s own header claim that the matrix gates every recipe is undemonstrated.

Secondary, and it survives renaming the key: S5's measured closure (`analyze.mjs:64`) is computed against
`base.lock`'s `UPSTREAM_IMAGE`, which is ublue aurora, not `auros-base`. For a recipe it would compare the
report against upstream-minus-recipe — including everything `auros-base` removed — and fail on the
only-measured arm.

---

### 2.20 — AppData is copied wholesale into a quarantine gate that has no release

**Where:** `auros-installer/cmd/auros-migrate/main.go:399-406`;
`auros-installer/internal/copyengine/plan.go:52-194`; `auros-installer/internal/safety/arm.go:203-206`.

`buildSources()` includes RoamingAppData and LocalAppData unconditionally — any folder marked present — and
`plan()` has no exclusion list of any kind.

On a live Windows machine LocalAppData carries legacy compatibility junctions (Application Data, History,
Temporary Internet Files) with deny ACLs, plus files held open by whatever is running. `plan.go:92-131`
turns each into a quarantine record, and `arm.go:203-206` refuses to mint a VerifiedArchive while any record
is unresolved.

`quarantine.Set.Waive` exists (`quarantine.go:109`) but **has no production call site**. Verified: a grep for
its call across the repository returns six hits, all in `_test.go` files. There is no flag on
`auros-migrate`. So a committed run on a real machine accumulates unresolved records it cannot clear and
stops, permanently, with no remedy offered.

Gate 3 cannot see this: the corpus at `testharness/gen/generate.go:262-270` is a synthetic tree with no
junctions and no locked files, so 100/100 clean runs say nothing about the machine the tool is pointed at.

**This is a plan defect, not a schedule item:** the two mechanisms are individually correct and mutually
exclusive. The gate is fail-safe, so no data is lost — the product simply cannot complete.

---

### 2.21 — The OneDrive choice is collected, logged, and thrown away

**Where:** `auros-installer/cmd/auros-migrate/main.go:146`, `:151`, `:224-234`;
`auros-installer/internal/copyengine/copy.go:55-110`.

`placeholderChoice()` obtains the user's decision at `main.go:146`. It is printed (`:509-514`), written to the
run log (`:208-215`), and used for exactly one thing — shrinking the free-space estimate at `:151` via
`adjustForPlaceholders`.

**Verified:** `copyengine.Options` (`copy.go:55-110`) has no field for it. `main.go:225-234` sets ten fields,
none a placeholder policy. `copyengine/plan.go` and `copy.go` contain no reference to the offline attribute.
`quarantine.ReasonCloudPlaceholder` is declared at `quarantine.go:40` and **referenced nowhere else in the
repository**.

So choosing skip does three things, all wrong:

1. Every placeholder is opened and therefore **hydrated anyway** — the synchronous school-uplink download
   the comment at `main.go:139-141` exists to prevent.
2. The destination was sized against a number that **subtracted** those bytes, so a stick chosen on the
   tool's own advice is too small and the copy dies mid-run with destination-full.
3. The promise printed at `main.go:513-514` — that they are listed in the report so you can see them — is
   false. No list is ever produced.

Gate 3 is blind to all of it: `testharness/gate3/runner_windows.go:238` hard-codes `--cloud-files=hydrate`.
**The skip branch has never been executed by any test.**

**Who is harmed:** any organisation using OneDrive Files On-Demand — the default configuration of a managed
Windows 10/11 fleet. The uplink harm hits everyone else in the building at the same time.
**It fails closed**, so no data is lost; but the run the IT person scheduled for that afternoon does not
complete and nothing explains why.

---

### 2.22 — The count on the desktop is honest about the archive and silent about what the archive is missing

**Where:** `internal/restore/report.go:87-99` and `:143-156` in the scratch worktree.

The clean branch tells the user that N files came across, that every one was checked twice, and that they
match file for file, byte for byte.

N is written plus already-there plus placed-aside, against a manifest that by construction contains only
what copied **and** verified on Windows. The inventory count measured at `main.go:132-136` is never written
into the archive, so the Linux side has no denominator and cannot say "17,600 of your 18,000".
`_auros/quarantine.txt` is on the stick and is never read — "quarantine" appears nowhere in
`internal/restore` or `cmd/auros-restore` — and the report's detail section does not point at it.

The `arm.go:203` gate genuinely bounds this for quarantined files: a committed run cannot have any. That is a
good property. It does **not** bound the two paths that bypass quarantine — hydrated-despite-skip
placeholders, for which no record is ever created (§2.21), and the label mismatch (§2.7), where the file is
present, hashed, counted, and in the wrong place. **Both produce a green "everything worked" report over a
real gap.**

Finally: the reassurance that the backup drive has not been changed sits only in the problem branch
(`report.go:97-99`). **The clean branch never tells the user to keep the USB stick.**

**When they find out:** weeks later, when something is looked for and is not there. By then the stick has
been reused for the next machine. **Not recoverable.**

---

### 2.23 — R1, the only end-to-end check of the migration, is written against a third format

**Where:** `auros-base/matrix/run/run-update.sh:202-211` and `:363-377`, against
`auros-installer/internal/manifest/manifest.go:36-44` and `internal/restore/archive.go:146-268`.

The harness builds an ext4 image labelled `AUROS_MIGRATION` holding `files/Documents/*.txt` plus a
`manifest.sha256` in `sha256sum(1)` format, then greps the serial console for `auros-restore` and for a
restored-file count.

The real archive is `<root>/_auros/manifest.tsv` in the `auros-manifest/1` TSV format, located by scanning
`/proc/self/mountinfo` with no volume-label requirement, with payload under a Stored path.

**Three independent conventions** — spec prose, Windows implementation, matrix harness — and the script's own
text at `:371` concedes *"R1 is the least-grounded check in this harness."* It fails closed, correctly. But
it is why the label seam in §2.7 went unnoticed: the check that would have caught it has never run against a
real archive. **No ticket, task or blocker owns the reconciliation.**

---

### 2.24 — The migration is a command-line program, against a binding human directive

**Where:** `auros-installer/cmd/auros-migrate/main.go:71-92`; `docs/SPEC.md:286-288`.

SPEC §11.1 (D4, HUMAN, **binding**): *"If a task the product promises requires a command line, it gets a GUI
or it stops being a promise."* The migration is the task.

`auros-migrate` is a flag set that will not proceed until the operator types
`--i-understand-programs-do-not-migrate` and `--cloud-files=hydrate|skip`. `auros-restore` is another. There
is no GUI anywhere in `auros-installer`.

**This is not recorded in DECISIONS.md and not in BLOCKED.md.** The spec's most explicit product constraint
is being violated *silently* rather than as a written, surfaced deviation the way D13 was — which is the part
that matters, because D13 shows the project knows how to do this correctly.

---

### 2.25 — Smaller, but real

| Where | What |
|---|---|
| `auros-recipes/.github/workflows/build-recipe.yml:382` | The lockfile push is followed by a fallback echo saying a failed push is not fatal because the poll will retry — and it runs **after** the image is published (`:345`). A durable push failure (branch protection, or a concurrent-push race that the base's record job handles with a rebase loop at `build.yml:951-958` and this one does not) leaves the image published and the lockfile unwritten. `propagate.yml:83` then sees that recipe as stale on every poll: **144 full matrix builds and republishes per day, indefinitely.** The comment's claim is true of the transient case and inverts in the durable one. |
| `auros-base/matrix/run/lib/vm.sh:75`, `:81` | The tool that turns our OCI image into bootable bytes defaults to `quay.io/centos-bootc/bootc-image-builder:latest` — a third-party image on a **mutable tag**, run privileged with the host container store bind-mounted, overridable by an env var, and pulled with a trailing `|| true` so a failed pull is silent. Every boot and update check is a statement about a disk image this unpinned tool produced. D25 did not reach it; D23 pinned the runner OS for exactly this class of reason. |
| `auros-web/src/content/copy.ts:258`; `CLAIMS.md:184` | The build-console sample streams `check S8   signed · cosign keyless`, and the ledger records *"There is no private key to lose; signing is keyless"* as verified on 2026-09-20. Both are false as of D8/D17 and the code: signing is **keyed** (`cosign sign --key` at `build.yml:672`; a keyPath in `policy.json:6`), and the private key is the entire content of RISKS.md R3 and B10. The honesty gate passed it because **the row cites SPEC §6A's original wording, which D8 superseded.** |
| `auros-base/README.md:179-192` | An entire section headed "Build it yourself", saying that if Auros vanishes a customer rebuilds their exact operating system from public files, followed by clone-and-build commands. The pre-D30 claim verbatim, contradicted by the same file's own Licence section 45 lines below (`:236-239`). R4 rewrote thirteen `auros-web` files; this one was not on the list, because the list was built from the honesty gate's scope. |
| `LICENSING.md` (final section) | Stale by one decision, and it is the document `auros-base/README.md:236` links to as authoritative. It still says that with proprietary licensing and **private** repos every replaceability claim is now false (D31 chose **public** repos), still lists four site files as carrying live false claims (R4 rewrote them all), still says it must be resolved before anything ships and that it is a §9 decision recorded in D30 — with no mention of D31, which resolved it. **A reader following the link from the base README lands on a page telling them our own site is lying.** |
| `auros-recipes/README.md:88`, then `:116-122` and `:139` | *"nothing on this page is permission to copy, fork, redistribute"*, then instructions to build the base yourself from its own public repository and to copy `auros.config.json` and change the namespace to your own — instructions to do what the licence on the same page forbids. |
| `auros-recipes/schema/recipe.schema.json:1310`; `schema/README.md:12`, `:276`, `:373`; `schema/validate.py:12` | Four more instances of the withdrawn pre-D30 claim, in the files that quote our promises back at a recipe author. The schema's secrets refusal reads *"This repository is public on purpose — it is how an organisation keeps its exact operating system if we disappear."* |
| `auros-recipes/customers/*/Containerfile:31-33` (from `src/compile.ts:212-214`) | The compiler stamps into every customer's Containerfile the sentence about rebuilding your exact operating system from the file being something you can test rather than something we say. The claim D30 withdrew, compiled into the exact artefact D31's handover commitment centres on, committed to a public repo under D28. The same header (`:22-24`) points at "the single case the replaceability page documents" — a page R4 rewrote so it no longer documents it. |
| `auros-recipes/src/config.ts:17`, `:48` | A user-facing refusal directs the reader to README.md, "Rebuilding without us" — a section the D31 rewrite renamed to "If we stop, your machines do not". |
| `auros-web/src/content/CLAIMS.md:189` | *"Removed packages are bytes the customer never downloads"* justified as D2, flatten at publish via rechunk, DESIGN. The mechanism is no longer rechunk (D11), and the row is marked DESIGN when the design is **not in the pipeline that builds a customer's image** (§2.9). By contrast D12's kiosk-size row at `:193` is correct and honest, which shows the ledger *can* carry a statement against interest. |
| `auros-installer/internal/safety/destination.go` | No destination-empty check. A second run against a populated folder whose source set changed leaves the first run's files behind; `verify.go:224-237` correctly reports them as unexpected and `arm.go:203` refuses. Fails closed, nothing lost — but the user is told there are unexplained files and is never told that emptying the folder is the fix. Restoring twice **is** genuinely safe: `run.go:285-300` decides idempotence by hashing what is on disk. |

### 2.26 — What is handled well, and must not be disturbed

Naming these matters, because the next pass must not "fix" them.

- **The wall.** `internal/safety/arm.go:203-221` is the only construction site for `VerifiedArchive`,
  `verified.go:45-60` makes it unforgeable, and a Go test parses the import graph to prove no package
  outside `internal/safety` can reach the system disk *and* asserts that the test is not vacuous. This is
  the single best-built thing in the repository, and every migration finding above is *bounded* by it.
- **`tools/gate.mjs`.** Derives its ledger path from its own location, fails closed on twelve conditions,
  recomputes the verdict rather than trusting the harness's verdict field, and is exercised by a negative
  control at `build.yml:1027-1051` *and* a CLI-contract check at `:203-212`. The gate is the one thing that
  is genuinely mechanical rather than conventional.
- **S3's stance.** `matrix/checks.yaml:43-45` — *"Some mornings this will be red through no fault of ours.
  That is the correct behaviour and must not be treated as flakiness or retried away."* Correct. See §3 for
  what is missing *around* it, not in it.
- **`migration/20-files.md`'s install-media disclosure.** *"Who makes that stick is not settled, and we are
  not going to pretend it is… Ask us where this has landed before you order."* A genuine not-built-yet,
  correctly disclosed rather than papered over. It should not be counted against the plan, and the next pass
  must not mistake the honest disclosure for a solved problem.
- **`explain.ts:330-345`** — **[trace corrected]** the supplied trace claimed this still prints the
  withdrawn pre-D30 commitment. It does not; it was rewritten for D31 and explicitly says *"it is not a
  licence to our tooling, and it is not permission to redistribute it."* The residual gap is narrower and is
  captured in P5 and §6.6.

---

## 3. Where the promise depends on a human remembering

Every item here is a 3am-on-a-holiday failure.

| # | What a human must remember | What would mechanise it |
|---|---|---|
| H1 | **That the nightly went red.** There is no alerting anywhere. Verified: zero occurrences of `gh issue create`, slack, webhook, notify, mailto or SMTP in any workflow. `pages/3-pricing.mdx:18` and `pages/5:143-144` sell exactly this as the product — *"somebody watches the nightly build go red at six in the morning"* — at $15/device/year. SPEC §3 says the gate is enforced *"mechanically, not by convention"*: the gate is; **the noticing is pure convention.** | An `if: failure()` step on every scheduled workflow that opens or updates a deduplicated GitHub issue, plus a **heartbeat** job that fails when the last green nightly is older than N hours. The second matters more than the first, because the dangerous states are green. |
| H2 | **That the nightly is still *enabled*** (§2.17). The two guards cancel out in exactly the state the system is in. | Run `keep-nightly-enabled` on a schedule in a *different* workflow file, or have the nightly push a dated heartbeat file to main on every run so the 60-day inactivity clock never starts. |
| H3 | **That upstream has not stalled** (§2.3). *"No change. Not rebuilding"* is green forever. | A maximum-age forced rebuild: if `UPSTREAM_RESOLVED_AT` in `base.lock` is older than N days, rebuild and re-run the matrix regardless of drift. Cheap, and it converts an invisible failure into a normal red. |
| H4 | **That a fleet has stopped updating** (§2.4). The freshness check measures registry reachability, and writes to a motd on a machine designed so nobody sees a shell. | Compare the **booted image's age** from `bootc status --json` against a threshold, not the fetch stamp. And surface it where D4.1 says a user actually looks — the Windows-shaped desktop — not the motd. |
| H5 | **Triaging an S3 red on the night it blocks a CVE.** `checks.yaml:43-45` states a red morning is correct and provides no path from there to a patched fleet. A human must decide, under time pressure, whether to lower the removal floor or leave 180 machines unpatched — with no tooling, no way to distinguish "a package came back" from "the image is broken", no partial-publish path for recipes whose removal set is unaffected, and no expression of the trade. `fail-fast: false` on the boot matrix (`build.yml:536`) shows all seven profiles, which does not help when the blocker is one surviving rpm. | A triage output that separates the two cases mechanically, plus a recorded, time-boxed override that is itself a ledger row — so the trade is made explicitly and leaves evidence, rather than being made by editing a floor at 6am. |
| H6 | **Flipping `auros-base/Containerfile:32` to the mirror.** D21 calls it not optional; `build.yml:171-176` implements it as a warning in a fifty-minute build's log. | Make it the gate D21 says it is: fail the build when the resolved route is upstream and the mirror is populated. One line. |
| H7 | **Signing recipe images at all** (§2.1). It is written down **nowhere** — not in `signing/README.md`, not in RISKS.md, not in BLOCKED.md, not in a ticket. The gap is invisible because the matrix signs the candidate in-VM and therefore passes. | A publish-time assertion that `cosign verify` succeeds against the *published* digest, in both repos, run as a negative-controlled step the way `gate.mjs` already is. |
| H8 | **Minting `AUROS_DISPATCH_TOKEN` with the right scope, and a production signing key** (B2, B10). Both are hard blocks on every publish; B2 understates its impact as latency and names a scope that would not work. | Not mechanisable — it is a human action. What *is* mechanisable: correct B2's text, and pin the production key's **fingerprint** in the publish gate so §2.14's filename test becomes a key test. |
| H9 | **Producing customer install media correctly.** `GATE5-RUNBOOK.md:28-29` is a checkbox. The person holding the USB chooses which bytes boot on a school laptop, by typing a reference. | A single script that takes a digest, refuses any digest not in the ledger, refuses any reference that is a tag, and writes the media. Then the checkbox becomes "run this." |
| H10 | **That `--cloud-files=skip` is not honoured** (§2.21). Nothing enforces the choice and nothing records that it was ignored; the only trace is a run-log field asserting a policy that was never applied. | Plumb it into `copyengine.Options` — or, until then, **refuse** the skip value outright. A flag that lies is worse than a flag that is absent. |
| H11 | **That the quarantine list matters.** Printed to stdout (`main.go:361-369`) and written to `_auros/quarantine.txt` (`copyengine/copy.go:366`). **No machine reads either one afterwards.** | Have the Linux restore read `_auros/quarantine.txt` and carry it into the desktop report. Everything needed is already on the stick. |
| H12 | **That CLAIMS.md rows need re-reading against the *code*, not just against DECISIONS.** The honesty gate checks freshness against the newest decision; it cannot tell that `CLAIMS.md:159`'s justification for the Wi-Fi claim is *"SPEC §6C.1 name exactly these. DESIGN."* — **a citation of the promise as evidence for the promise** (§2.8). | Require every DESIGN row to name a file path, and have CI assert the path exists and is non-empty. It will not catch everything; it would have caught Wi-Fi, printers and keyless signing. |
| H13 | **That the honesty gate's scope is one directory.** `verify:26` runs it on `auros-web/src` and nothing else. Every file in the ownership trace — `explain.ts`, three READMEs, `recipe.schema.json`, `validate.py`, the generated Containerfiles, LICENSE, LICENSING.md — is outside it. | Extend the gate's corpus, or at minimum add a grep-level check for the withdrawn pre-D30 phrases across all five repos. R4 cleaned one directory; nothing generalised it. |
| H14 | **B12's four sentences.** B12 names four site files and is enforced by a human reading B12. | Not fully mechanisable — B12 says so itself. But H12's check would at least force the row to point at `docs/legal/WIND-DOWN-TERMS.DRAFT.md` and reveal that it is a draft. |
| H15 | **B16 — widening the PreToolUse matcher** from Bash to include Write and Edit in `.claude/settings.json:5`. Confirmed still Bash. The half of the hook that guards the ledger against a Write has never executed. | The settings change. It is the owner's to make. |
| H16 | **`signing/keys/README.md`'s three-step rotation order.** Step 2 — wait until the fleet has taken an update containing both keys, confirmed *"from the console, not from an assumption"* — is a human waiting, **and the console (§6E) is deliberately not built.** Skipping it bricks every machine that has not updated, with no way in but physical access. | Nothing short of §6E. This is the strongest argument in the repository for building a minimal fleet view *before* the first pilot, not after. |
| H17 | **Deleting the staging tag when the cleanup token lacks delete:packages** — and not believing the warning that says it is harmless (§2.16). | Grant the scope, or correct the message. The message is the cheaper half and the more urgent one. |
| H18 | **That R1's format needs reconciling.** `run-update.sh:371`: *"if the convention differs, this check is what has to change"* — an instruction to a future human, left in a shell script, with no ticket behind it. | Write the ticket. It is the cheapest item in this table. |
| H19 | **That the Linux restore source exists at all** (§2.6). Its survival depends on somebody remembering to commit it before a temp directory is reaped. | Commit it on `feat/linux-restore`. Today. |
| H20 | **That the disclosure acknowledgement means something.** `--i-understand-programs-do-not-migrate` is typed once per machine; on machine 40 of 180 it is muscle memory and the list it gates is scrolled past. | This is what D4's GUI directive is *for* (§2.24). A dialog that requires scrolling the list is not equivalent to a flag, and the difference is the whole point of §4.2. |
| H21 | **Pinning `propagate.yml` off `ubuntu-latest` before 2026-10-19** (D23) — 29 days away. Nothing enforces D23; `tools/workflow-lint.mjs` checks pipefail and env interpolation only. | Add a `runs-on` rule to `workflow-lint.mjs`. It already walks every workflow file. |

---

## 4. "Not built yet" versus "cannot work as designed"

The distinction matters because the first is a schedule and the second means more building makes it worse.

### Cannot work as designed — the plan is wrong

| # | Defect | Why more building does not fix it |
|---|---|---|
| C1 | **The rebuild trigger has no input representing "a fix exists"** (§2.3). | The design's only trigger is an upstream digest change. Our own layer's CVEs and an upstream stall are both outside it by construction. No amount of implementation adds an input the architecture does not have. |
| C2 | **The flatten is at the wrong publish** (§2.9). | `auros-base` is flattened; the customer pulls a layered recipe. Building more of `auros-base`'s flatten changes nothing. The pipeline stage has to move. |
| C3 | **The floor is computed from the plan, not the image, and is unreachable by arithmetic** (§2.10). | 57 planned against a floor of 1100 can never be met. Enforcing the check as written would fail every kiosk build forever. Both the measurement source and the number have to change. |
| C4 | **The per-build base pin and the D28 drift check are mutually exclusive** (§2.11) — proven by execution. | Plumbing the variable through *breaks the build*. One of the two mechanisms has to be redesigned. |
| C5 | **AppData copied wholesale into a quarantine gate with no release** (§2.20). | Both mechanisms are individually correct. Together they guarantee the tool cannot complete on a real machine. Either AppData is scoped, or quarantine gains a release path — a product decision, not a coding task. |
| C6 | **The freshness canary measures the wrong thing** (§2.4). | Making the check more careful about a stamp that is refreshed on the no-op path does not help. The quantity being measured has to change. |
| C7 | **Signing was designed for the layer machines do not follow** (§2.1). | The entire signing design — README, RISKS, policy.json.README, D8, D32, B10 — discusses only the base. This is a scope error in the design, not missing code, and it is why nobody noticed. |
| C8 | **There is no gated path from a published image to install media** (§2.15). | D13 removed a path and nothing replaced it. None of `attest/README.md`'s four layers can be extended to cover it — layer 3 lives inside the image being installed and cannot judge itself. A fifth thing has to exist. |
| C9 | **Layers 1 and 2 of the attestation design collapse onto one secret** (§2.12). | The repository that builds the image holds the credential that authors its own evidence. Independence is asserted in `attest/README.md` and is not a property of the deployment. |
| C10 | **The staging tag is signed before the matrix's rollback leg runs** (§2.16). | Job ordering is sign → update → record → publish. Signed-but-unproven bytes in the production repository is what that order *means*. |
| C11 | **Every promise's failure signal is a human reading a web page** (H1). | Alerting is not a missing feature of a component; it is a missing component. And the website sells it as the product. |

### Not built yet — a schedule

| # | Item | Note |
|---|---|---|
| N1 | `cmd_update`, `cmd_drift`, the `mirror` subcommand, `pin-upstream.sh` (§2.2). | Four missing entry points in the pin-moving path. An hour, plus one test that resolves shell entry points the way `gate.refusals.test.mjs` resolves `gate.mjs` paths. |
| N2 | The Linux restore, installed into the image (§2.6). | Code exists. Unit, Containerfile line, first-run wiring. **The untracked-worktree half of that finding is not a schedule item — it is a live risk today.** |
| N3 | Wi-Fi and printer export on Windows (§2.8). | Roughly two files. The consuming side already exists. What is *not* a schedule item is that it is currently **claimed** in three places, including the §4.2 disclosure. |
| N4 | The `planned`/`packages` key rename (§2.19) and S5's closure basis. | Rename is minutes; the closure basis needs thought. |
| N5 | `--cloud-files=skip` plumbed into `copyengine.Options` (§2.21). | Small. Until then the flag should be refused, not accepted and ignored. |
| N6 | `propagate.yml` pinned to `ubuntu-24.04`, namespace derived, the inspect failing closed (§2.5). | Three lines, one of them a deadline. |
| N7 | A GUI for the migration (§2.24). | Genuinely large. **The schedule item is the GUI; the defect is that the deviation is unrecorded.** Record it today, build it later. |
| N8 | R1 reconciled against the real archive format (§2.23). | Needs a decision about which convention wins, then a day. |
| N9 | Stale copy: `auros-base/README.md:179-192`, LICENSING.md, `auros-recipes/README.md:116-139`, `schema/*`, `config.ts:17`, the generated Containerfiles, `CLAIMS.md:184` and `:189`, `copy.ts:258`. | A sweep. What makes it recur is H13. |
| N10 | Production signing key, dispatch token (B10, B2). | Human actions. Nothing to build. |

---

## 5. The three things to fix first

### First — sign the recipe image, or the fleet stops updating and nobody finds out

**§2.1.** It outranks everything because it is the only defect that produces **silent, fleet-wide,
indefinite harm to a paying customer** with no signal on either side of the wall. Every other break either
fails closed (nothing ships, we notice), fails loudly (a red build someone eventually sees), or harms us
before it harms them. This one ships a working machine to a school and then quietly stops patching it —
which is, precisely, the orphaned laptop the company exists to replace.

It also outranks the others because it is *invisible to the evidence we already collect*. The matrix signs
the candidate in the test VM, so U1–U5 pass; `propagate.yml` tracks builds, not installs; and the one
machine-side canary measures registry reachability rather than image currency (§2.4), so it stays green.
Three independent mechanisms that all look healthy while the product is failing.

Fix scope: a cosign sign step in `build-recipe.yml` before `:345`, a key-kind read-back mirroring
`build.yml:1053-1082`, and a post-publish `cosign verify` as a negative-controlled assertion. Then §2.4, so
that if it ever happens again a machine can say so.

### Second — make the CVE chain able to fire at all, and able to say when it has not

**§2.2 + §2.3 + §2.5 + §2.17, and H1 across all of them.** These are one failure wearing four faces: *the
chain cannot move, and every way it fails reports green.*

- `cmd_update` does not exist, so the pin cannot move (§2.2).
- Even fixed, only an upstream digest change triggers a rebuild, so our own layer's CVEs and an upstream
  stall are both invisible (§2.3).
- Even triggered, propagation fails open on an unauthenticated inspect and is scheduled to break in 29 days
  (§2.5).
- And the workflow that drives all of it switches itself off after 60 quiet days, with the backstop disarmed
  by the same bug (§2.17).

It ranks second rather than first only because today it fails *closed for the customer* — nothing ships, so
nothing bad reaches a school. It ranks above everything else remaining because **it is the promise on the
pricing page**, and because the four failures compose into a state where every dashboard is green, every run
is a success, and the fleet has not been patched in months.

The cheapest high-value piece is not any of the four bugs. It is the **heartbeat**: one job that fails when
the last green nightly, or the last published base digest, is older than a threshold. That single check
converts the entire class from invisible to ordinary-red. Build it before fixing the four.

### Third — commit the Linux restore, then close the label seam

**§2.6 + §2.7.** Ordered this way because the two halves have different clocks.

The commit is urgent on a timescale of *hours*: roughly five thousand lines of the most safety-critical code
in the company — the code that runs when the archive is the user's only copy, because the old disk has
already been overwritten — exist solely as untracked files in a session-scoped temp directory. No backup, no
CI, no other session can see them. That is not a defect in the plan; it is a thing that can be lost this
afternoon.

The seam (§2.7) is what makes it urgent on a timescale of *weeks*: the two halves disagree about the only
contract they share, both pass their own tests, and the check that would have caught it (R1, §2.23) has
never run against a real archive. The consequence lands after the Windows disk is repointed — the user opens
Firefox and it is empty, and the old machine is gone. Fix the seam with a shared, tested table of labels that
both halves import, so the contract has one definition rather than two.

It ranks third rather than higher because the wall (`internal/safety/arm.go`) genuinely holds: no data is
destroyed by any of it. What is lost is the user's expectation that their browser came across, and the
project's only copy of the code that was supposed to deliver it.

**Not in the top three, but do it in the same hour as anything else:** correct B2's text (§2.12). It costs a
paragraph, and it is currently steering whoever triages blockers away from the thing that blocks every
publish in the system, toward a token scope that would not work.

---

## 6. What this review could not establish, and why

1. **Whether any of this survives contact with a real build.** No workflow in this trace has run to
   completion. `attest/passed-digests.tsv` has **zero data rows** (verified), which is itself the strongest
   evidence that the publish path has never executed end to end. Every statement here about runtime
   behaviour is derived from reading the code and, where possible, executing individual scripts locally —
   not from observing a run. Findings §2.2 (missing subcommands), §2.11 (the drift-check conflict) and the
   kiosk plan count in §2.10 were verified by execution; the rest are inference from static reading and
   should be treated as high-confidence-but-unobserved.

2. **The true pull size of a published recipe image.** §2.9's consequence is derived from how `podman build`
   layers work and from where `build-chunked-oci` is invoked. Nothing has been published, so nobody has run
   `skopeo inspect` on a real recipe manifest and summed the layer sizes. The direction is certain; the
   magnitude is not.

3. **The real removal closure for any recipe.** No build has ever produced one. The floors of 240 and 1100
   were chosen, not measured. `scripts/floor-ratchet.mjs` governs how the number may *change* between
   commits; **nothing governs whether it was ever right**, and there is no measurement to calibrate it
   against. §2.10's arithmetic — 57 planned against a floor of 1100 — is certain; whether 1100 is a
   defensible *closure* figure is unknowable until a build runs.

4. **Whether the Windows tool completes on a real machine.** §2.20 predicts a hard stop from legacy junctions
   and locked files in LocalAppData, with no waiver path. The Gate 3 corpus is synthetic
   (`testharness/gen/generate.go:262-270`) with no junctions and no locked files, so 100/100 clean runs are
   not evidence about this. Nobody has pointed `auros-migrate` at a live Windows profile. **This is the
   single highest-value unknown in the migration workstream, and it is one afternoon on one VM away.**

5. **Anything about real hardware.** GATE.md already says this and it remains true. `hardware/compat.tsv` is
   a header row. No physical machine has been touched, so nothing here speaks to firmware, BitLocker on TPM
   1.2, Secure Boot's third-party CA, or whether `BootNext` is honoured — the three things
   `migration/10-firmware-and-disk-encryption.md` says break "one restart".

6. **The legal sufficiency of the wind-down commitment.** P5 observes that handing someone files under
   `LICENSE:5-7` gives them nothing they can lawfully act on, because building from a Containerfile creates
   a derivative work. Whether that is *legally* so, and what a licence vesting on a trigger would have to
   say, is not something this review can establish. B12 already says the commitment must be *"a licence that
   vests on a trigger, not a delivery"*, and that is the right frame. Note that B12's enforcement list covers
   four site files and **does not cover** `auros-recipes/README.md:96-105`, which makes a version of the same
   commitment outside the honesty gate's scope.

7. **Wall-clock CVE response time**, even assuming every break above is fixed. Traced but not measured:
   upstream publishes → up to 24h to the 04:17 cron (`nightly.yml:42`), mean ~12h, plus B7's unbounded
   free-tier cron delay → ~50 min base build (R6 measured two builds and two chunkings for S7 at 48 min,
   unfinished) → ~40 min for static plus seven boot profiles in parallel → sign → the U1–U5 job, which is a
   full stage-and-reboot VM cycle → record → publish, serialised by job dependencies → up to 10 min poll
   (`propagate.yml:23`) → a comparable full recipe build and matrix per customer → up to 6h10m before a
   machine's timer fires (`10-auros.conf:74-76`) → `when-idle`, so a laptop in use all day stages and
   activates at next power-on.

   **"One rebuild" is one *file*, not one hour.** Best case is roughly 4–5 hours; realistic is 1–2 days; a
   Friday-evening CVE over a holiday weekend is 3+ days. `pages/3-pricing.mdx:22` — *"your machines have it
   by the next restart"* — is **literally true and reads far faster than it is.** Nothing on the site states
   the elapsed figure. That is not a false claim, and it is exactly the kind of gap between a true sentence
   and a buyer's expectation that turns into a month-two conversation. It should be measured on the first
   real run and then either stated or deliberately not stated, as a decision rather than as an omission.

---

## Closing

The components here are, individually, better than they need to be. `internal/safety`, `tools/gate.mjs`,
S3's stance on red mornings, and the install-media disclosure are all work most teams do not do. That is
exactly what makes the system-level result worth stating without softening:

**Four of the product's core promises do not currently hold, and the three most consequential failures are
all invisible from inside the system.** A school that bought this today would receive machines that boot,
that look right, that were migrated onto with most of their files, and that would stop receiving security
updates without anyone — them or us — being told.

The spec's own standard is that a check nobody can fail is worth nothing. The same is true of a green
dashboard. Before the first pilot, this system needs one thing it does not have at all: **a way to notice
that it has stopped working.** Everything else on this list is a bug, and bugs get fixed.
