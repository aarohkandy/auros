# PROGRESS

Newest first. One entry per meaningful step, with evidence. Re-read at session start (spec §8).

---

### 2026-09-20 (late) · Licensing reversed · testing campaign · Gate 1 close

**The licence changed, on the owner's instruction (D30/D31).** Apache-2.0 removed from all five repos;
everything is now **all rights reserved**. Apache explicitly grants redistribution and sale of
derivatives, which is precisely what was not wanted. Exposure was ~90 minutes with **zero forks and zero
stars**, so nothing was taken under it. Repos stay **public** — readable, not licensed — because
unlimited Actions minutes on public repos is what has allowed ~50 build/boot experiments today, and
2,000 minutes/month would have stopped the work.

I should have surfaced the licence as a §9 business decision rather than choosing it. I picked Apache
because the spec instructs us to advertise replaceability and a licence is what makes that claim real,
but which licence a company ships under is a business decision wearing a technical costume — the same
category as the `verdict=unsupported` call I correctly refused to make.

**What is not ours to decide:** the built image contains GPL/LGPL software because Fedora does, and
recipients hold rights we cannot withhold. Ordinary for every Linux appliance vendor. Our code is fully
protectable; the image's Fedora components are not; both are true at once and the site must not imply
otherwise (LICENSING.md).

**The new trust story (D31)**, which came out of the owner's question *"they get the image as soon as
we're done with it wdym"*: the customer **always** had the image — it is on their laptops and keeps
booting whatever happens to us. What dies with us is the **maintenance**, which spec §1.1 says is the
actual product. So the commitment is: **if we cease operating, each customer gets the build files for
their own image.** Not a licence to our tooling, not redistribution rights. Costs nothing while we
exist; grants a competitor nothing.

**Testing campaign** (owner: *"make sure you're testing A LOT"*). 400 recipe tests · 229 installer test
functions · 59 gate tests · shell suites for the base build scripts · mutation testing in flight.

Defects it found **in my own work**, none of which re-reading had caught:
1. **Self-certification** — the recipe publish step gated an image on a `results.json` *the same job
   wrote*. Now gates on the ledger fetched from origin, because a checkout is something a workflow can
   edit before reading it.
2. **Injection ×16** — the recipe name arrives in a PR from the internet and was interpolated into
   sixteen shell command lines. `${{ }}` in a `run:` block substitutes before bash sees it.
3. **A permanently-green security check** — `tr -d '[:space:]'` deleted the newlines, so `^selinux=0$`
   could never match. Nine-case test in both directions now.
4. **A silently-invalid workflow** — `${{ }}` inside a YAML flow mapping; GitHub rejected the file and
   showed the run named by its *file path*, with no jobs and no error.
5. **Nine greenboot units named, three exist** — six from an older release. Each cost a twelve-minute
   image build to learn one name.

**Three guards added, each verified able to go red:** `tools/workflow-lint.mjs` (flow-mapping
interpolation, missing pipefail, missing name), `auros-base/tests/units.test.sh` (every unit we enable
must be one the image ships, checked against `units.known` in one second on a laptop), and two
licence-grant rules in the honesty gate that found **25 places** where the site still offers a right we
withdrew. Those sentences were *true when written* — which is the lesson: a claims ledger is only as
good as the last time something re-read it against reality.

**Gate 1 status:** the base now gets through digest pinning, hardening, all four policy modes, greenboot
install, health checks and signature enforcement. A **development signing key** (D32) lets it build and
boot while being refused at publish, so Gate 1 is not blocked on a human minting a long-lived
credential. The key kind is written *into* the image and read back *out of it* at publish, because a
workflow variable can be set by whoever edits the workflow.

**Verified personally, not delegated:** the policy assertions genuinely attempt forbidden operations as
an unprivileged user (`runuser`/`setpriv`), and the same attempt runs in `open` mode expecting
**success** — so a green in `locked` cannot be an attempt that could never have succeeded. That is B5's
"configured but not effective" properly closed.

---

### 2026-09-20 · Gate 1 in progress · four repos live · gates are mechanical

**Decisions closed by the human:** Auros (D1) · flatten at publish (D2) · Aurora/KDE (D3) · the
*personalized Windows, never a terminal* directive (D4) · real public repos and real CI (D5).

**Five repos live and public** under `aarohkandy`: the meta/control repo plus base, recipes, installer,
web.

**Measured rather than assumed** (`docs/evidence/2026-09-20-runner-probe.md`). PLAN.md's CI section
rested on research claims; two of them were wrong in our favour and one was the most important number
nobody had:
- Runner disk: plan feared ~14 GB and called it a possible hard blocker. **Measured 145 G total, 110 G
  free after cleanup.** Not a blocker, not close.
- `/dev/kvm`: present, `kvm-ok` confirms acceleration, writable after `chmod 666`. Gates 1–2 cost nothing.
- **The Aurora base is 3.5 GB compressed.** So a nightly base change is a 3.5 GB pull per machine and a
  180-machine school is a ~630 GB event. That makes flattening a requirement rather than an optimisation,
  and it constrains what we may *claim* about nightly updates until we have measured a real delta
  (BLOCKED.md B6).
- Upstream digest pinned: `sha256:911281f2…d0d2f1`, Fedora 44, Plasma 6.7.5, bootc 1.16.10, x86_64 only.

**Eight-way live research produced 225 facts and 37 blockers** (`docs/DECISION-SHEET.md`), and overturned
five plan assumptions. Recorded as D8–D25. The three that mattered:
- **D8** — deriving from Aurora does *not* give signature enforcement. Its `policy.json` ends in an
  `insecureAcceptAnything` catch-all, so `--enforce-container-sigpolicy` succeeds while verifying
  nothing. Check U4 would have passed vacuously. We ship our own key, `registries.d` and sigstoreSigned
  transport inside the image.
- **D21** — upstream **garbage-collects the digest we pin** (weekly cleanup, 90 days, keep 7 tags).
  Pinning protects against a tag moving, not against the blob being deleted. We now mirror the pinned
  digest into our own namespace and resolve `FROM` against the mirror, which is what keeps a customer's
  fork buildable — and the replaceability claim true — after upstream forgets.
- **D22** — `uupd`, not `bootc-fetch-apply-updates`, is the real update driver on this base. PLAN.md named
  the wrong unit, which would have produced an update agent that looked configured and never ran.

**Two prohibitions are now mechanical, not aspirational.** `tools/gate.mjs` for §4.3 (no untested image
publishes) and `tools/honesty-gate.mjs` for §4.4 (no fabricated social proof). Both fail closed. Each was
verified able to go **red** — a gate that cannot fail is not a gate. `./verify` runs every gate and CI
calls the same script, so local and CI cannot drift.

**Two bugs of our own worth keeping:** a probe piped a build through `tail`, so a *failing*
`bootc-image-builder` scored as a *passing* step — the exact failure the check matrix exists to prevent,
appearing in our own code within an hour of writing the matrix (D19, `pipefail` everywhere). And
`ostree container commit` is obsolete on this base and fails confusingly (D20) — every pre-2024 tutorial
ends with that line.

**In flight:** base image layers (hardening, four policy modes, update agent + signing, Windows-feel,
matrix harness, nightly CI), recipe schema and compiler, installer safety core and fault harness, site
foundation and terrain renderer. The boot probe is testing the literal Gate 1 exit path end to end:
image → qcow2 → QEMU → login prompt.

---

### 2026-09-20 · Foundations laid, upstream research running
- PLAN.md approved by human. §9 blockers D1–D5 answered (see DECISIONS.md).
- Verified local environment first-hand rather than trusting the plan: macOS 27 / **arm64**, Node 22 +
  pnpm present, **no docker, no podman, no qemu, no cosign, no Go.** `gh` authenticated as `aarohkandy`
  with scopes `gist, read:org, repo, workflow` — notably **no `write:packages`, no `admin:org`.**
  Consequence: nothing bootc-related can build or boot on this machine, and no org can be created.
  Every build and every VM boot happens in GitHub Actions. This is decided, not discovered later.
- `aarohkandy/auros` confirmed to exist, public, empty.
- Created workspace + `auros.config.json` (single source of truth for the namespace).
- `hardware/compat.tsv` created hour one with its header and the `source` column that keeps VM rows from
  ever being mistaken for hardware evidence.
- Launched 8-way parallel upstream research (Aurora digest/tags, bootc lifecycle + greenboot + signature
  enforcement, rechunk + real pruning, GH Actions KVM/disk/dispatch limits, Windows migration APIs, web
  stack, KDE Windows-feel, honest .exe compatibility) → one decision sheet the code gets written from.
