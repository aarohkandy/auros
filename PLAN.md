# LATHE — PLAN

**Status:** awaiting approval. No code written. No repos created. No money spent. Nothing has touched real hardware.
**Author:** build agent · **Date:** 2026-09-20 · **Spec:** `LATHE — BUILD SPEC` (§ references below are to it)

This document answers §11: task breakdown, assumptions, where I think the spec is wrong, the VM check
matrix, and the §9 decisions I need before Gate 1. Read §3 (*where the spec is wrong*) first if you read
nothing else — two items there change the architecture diagram, and one of them decides whether the
product's central claim is true on the wire or only true in a report.

---

## 0. WHAT I VERIFIED BEFORE PLANNING

I checked the environment and the upstream stack rather than assuming them. Findings that changed the plan:

| Finding | Source | Consequence |
|---|---|---|
| Working dir `/Users/aaroh/auros` is **empty and not a git repo** | local | Truly greenfield, as §2 says. |
| Operator machine is **macOS 27 / arm64**, no docker, no podman, no qemu, no cosign | local | §2's "one Windows laptop, unlimited VMs" does not describe this machine. Nothing bootc-related can build or boot locally. All builds and VM tests must run elsewhere. |
| **`/dev/kvm` is available on free GitHub-hosted `ubuntu-latest` runners** (since Jan 2024) | [runner-images#7541](https://github.com/actions/runner-images/issues/7541), [actuated](https://actuated.com/blog/kvm-in-github-actions) | The VM check matrix can run in CI with hardware acceleration. Gate 1 and Gate 2 are achievable with zero infrastructure spend. This is the single most load-bearing fact in the plan. |
| Public repos get free unlimited Actions minutes and free GHCR bandwidth | GitHub billing | All four repos public ⇒ CI and registry cost **$0**. Aligns with §1.3 "replaceable on purpose". |
| `ghcr.io/ublue-os/aurora:stable` is live, currently **Fedora 44**, tagged `stable-20260915.1` | [ublue-os/aurora releases](https://github.com/ublue-os/aurora/releases/tag/stable-20260915.1) | Digest pinning per §6A is viable today. |
| **cosign 3.x broke signature discovery for podman/bootc** — it defaults to new-format OCI 1.1 referrer bundles that `containers/image` cannot see. `cosign verify` still passes, so this fails *silently*. | [projectbluefin/common#977](https://github.com/projectbluefin/common/issues/977) (closed) | Directly threatens §3's "unsigned image can never reach a customer". Must sign with `--new-bundle-format=false` **and** add a check that the legacy `.sig` tag is discoverable. A green `cosign verify` is not sufficient evidence. |
| **rechunk** flattens the filesystem tree, "removing files that were replaced in later OCI layers", then re-partitions into N stable layers | [hhd-dev/rechunk](https://github.com/hhd-dev/rechunk) | This is the mechanism that makes pruning real. See §3.1 — it is also the mechanism that breaks literal `FROM` inheritance. |
| Removing packages from a base image is fragile: "upstream may add new dependencies that sneak back in" | [Fedora Magazine](https://fedoramagazine.org/building-your-own-atomic-bootc-desktop/) | The nightly rebuild can silently un-prune the product. The prune list must be an **asserted post-condition**, not a build step. See check `S3`. |
| Remote server `homebase` is **x86_64 with `/dev/kvm`, 8 vCPU, 62 GB RAM** | ssh | Viable Windows-VM host for Gate 3 — *except* for the next row. |
| homebase disk is **94% full: 17 GB free** of 247 GB (98 GB docker, 129 GB `/home/azureuser`), with 13 containers and a tmux session belonging to other work | ssh | **Blocker for Gate 3.** The 100-run Windows farm needs ~100 GB. I have not deleted anything and will not — that data is not mine. Needs a §9 decision. |
| `azureuser` is **not in the `kvm` group** | ssh | One-line fix (`usermod -aG kvm`), but it needs sudo and a session restart. Noted so it does not surprise us at Gate 3. |
| `gh` is authenticated as **`aarohkandy`, member of zero orgs**; token scopes lack `write:packages` and `admin:org` | `gh auth status` | `ghcr.io/lathe/...` does not exist and I cannot create the org. Blocks Gate 1 publish. See §5. |

---

## 1. TASK BREAKDOWN

Dependency notation: `→` blocks. `∥` safe to run in parallel. **[H]** needs a human decision or action first.

### W0 — Foundations (blocks all workstreams; ~half a day)

| # | Task | Deps |
|---|---|---|
| 0.1 | **[H]** Company name → create GitHub org → GHCR namespace fixed | blocks 0.2, A7 |
| 0.2 | Create 4 public repos per §5, MIT/Apache, CODEOWNERS, branch protection | 0.1 |
| 0.3 | Repo-root state files — `PROGRESS.md`, `TASKS.md`, `GATE.md`, `BLOCKED.md`, `DECISIONS.md`. Re-read at the start of every session per §8. **Never under `.claude/`.** | 0.2 |
| 0.4 | `hardware/compat.tsv` created **empty with its header row on hour one** per §8, with an explicit `source` column (`vm` \| `physical`) so VM rows can never be mistaken for hardware evidence | 0.2 |
| 0.5 | `PreToolUse` publish-gate hook + `attest/passed-digests.tsv` ledger | 0.2 |
| 0.6 | Skills: `recipe-compile`, `vm-check-matrix`, `driver-triage`, `theme-generate` | 0.2 |

### W-A — `lathe-base` (Gate 1, then Gate 2) — critical path

| # | Task | Deps |
|---|---|---|
| A1 | `Containerfile` `FROM ghcr.io/ublue-os/aurora@sha256:…`; digest recorded in `base.lock` | 0.2 |
| A2 | Hardening layer: SELinux enforcing asserted, sshd off by default, firewalld default-deny inbound, no telemetry, sudo/polkit baseline, automatic-update timer | A1 |
| A3 | Policy module — `open` / `managed` / `locked` / `kiosk` as declarative units (systemd presets + polkit + KDE kiosk config). Each mode ships a **runtime assertion script** so the check matrix can prove the mode is in force, not merely configured | A2 |
| A4 | Update agent: `bootc-fetch-apply-updates` timer + greenboot health checks in `/etc/greenboot/check/required.d/`, previous deployment retained, auto-rollback on repeated failed boot | A2 |
| A5 | Signing: cosign keyless via Actions OIDC **with `--new-bundle-format=false`**, `registries.d` + `policy.json` for install-time enforcement, plus a post-sign check that the legacy `.sig` tag is discoverable by `skopeo` | A1 |
| A6 | `rechunk` as the final publish step (see §3.1) | A1 |
| A7 | Nightly workflow: re-resolve upstream digest → build → **full check matrix** → sign → push **only on full pass** | A1–A6, 0.1 |
| A8 | VM check matrix harness (§4), runnable locally and in CI, emits machine-readable `results.json` keyed by image digest | A1 |
| A9 | **Gate 1 exit test**, then Gate 2 propagation via `repository_dispatch` into `lathe-recipes` | A7, A8, B-series |

### W-B — `lathe-recipes` (Gate 2) — depends on A

| # | Task | Deps |
|---|---|---|
| B1 | `recipe.yaml` JSON Schema + validator. **Rejects** any `FROM` override, kernel pin, or package version pin, with an error message that explains *why* the rejection is a feature | A1 |
| B2 | Compiler YAML → Containerfile. Deterministic: sorted lists, `SOURCE_DATE_EPOCH`, reused rechunk plan | B1 |
| B3 | **Prune engine** — first-class per §6B. Emits `removal-report.json` (package, version, bytes reclaimed) and enforces post-condition assertions (`S3`) | B2, A6 |
| B4 | Hardware profiles → QEMU machine definitions (firmware mode, RAM floor, CPU feature level, disk floor). See §4 for what this can and cannot prove | A8 |
| B5 | Three reference recipes: 180-machine Marathi school, 40-machine English kiosk, single dense developer desktop | B1–B4 |
| B6 | Per-recipe CI, fanned out one subagent per recipe × profile, each returning pass/fail + log only (§8) | B5 |

### W-C — `lathe-installer` (Gate 3) — **start day 1, parallel to A/B**

Highest-risk component and the longest wall-clock (120 VM runs). It does not depend on A or B until C7,
which needs a real ISO; until then a stub ISO is sufficient. Detailed breakdown in §1.1 below.

### W-D — `lathe-web` (Gate 4) — ∥ with A/B/C except D4/D6

| # | Task | Deps |
|---|---|---|
| D1 | Astro scaffold on **Workers Static Assets** (not Pages — Cloudflare now steers new projects to Workers), design tokens, self-hosted WOFF2 subsets | 0.2 |
| D2 | Canvas terrain renderer: seeded value noise, 4px logical blocks, `OffscreenCanvas` in a Web Worker, parallax by `transform` only, static render under `prefers-reduced-motion` | D1 |
| D3 | Content pages incl. the *what doesn't come across* column above the fold (§6D) | D1 |
| D4 | Configurator → live `recipe.yaml` with the `remove:` block. Must emit YAML that **passes B1's validator** | B1, D1 |
| D5 | Build console streaming genuine pipeline output (§7) — needs a real feed from A7/B6, not a mock | A7, B6 |
| D6 | One Worker, three routes: `POST /order` (→ PR), `POST /build-result` (→ charge), `POST /stripe-webhook`. GitHub App + RS256 via WebCrypto; token cached in KV | B1, D1 |
| D7 | Stripe: subscription-mode Checkout with a trial covering the build window (see §3.8) | **[H]** |
| D8 | Lighthouse ≥95 mobile, keyboard-complete, WCAG AA contrast **measured** per pair, no-JS mailto fallback | D1–D6 |

### W-E — `lathe-console`

**Not built.** §6E says build last and only after a real customer exists. I will not touch it.

### 1.1 — W-C detail (migration)

Ordered so that every destructive capability is built **last** and behind everything that protects it.
The abort path is written before the happy path, per §6C.

| # | Task | Deps |
|---|---|---|
| C1 | Single static `.exe` scaffold, UAC manifest, no installer | — |
| C2 | Inventory: Documents/Desktop/Pictures/Downloads, browser profiles, Wi-Fi profiles, printers, account name | C1 |
| C3 | **Cannot-migrate report** from the actual installed-programs list, by name, with a required acknowledgement | C1 |
| C4 | Destination selection + free-space check; **refuses to continue** if no non-system destination with room exists | C1 |
| C5 | Copy + manifest (per-file SHA-256 + count) | C4 |
| C6 | Verify + abort semantics — any mismatch aborts and changes nothing | C5 |
| C7 | Image write + one-time boot + restart. **Built last.** Gated on C6 returning a verified manifest | C6, A/B ISO |
| C8 | Linux first-boot restore, re-verify, report count on the desktop | C5, A4 |
| C9 | Test harness: Windows VM, 18,000 synthetic files, snapshot/restore, 100 consecutive runs | C6 |
| C10 | Fault injection: 20 induced-failure runs (power cut mid-copy, USB pulled, disk full, hash mismatch) | C9 |
| C11 | Optional dual-boot path — **see §3.7, this one has a prohibition problem** | C7 |

### 1.2 — Critical path and parallelism

```
day 1   W0 ─── A1─A6 ────────► A7 ─► GATE 1
        C1─C4 (parallel, no dependency on A)        D1─D3 (parallel)
day 2   B1─B5 ─► B6 ─► A9 ────────────────────────► GATE 2
        C5─C6                                        D4
day 3   C9 ─► C10 ──────────────────────────────────► GATE 3
day 4   D5─D8 ─────────────────────────────────────► GATE 4
day 5-6 physical laptops, compat.tsv ──────────────► GATE 5
day 7   pilot install ─────────────────────────────► GATE 6
```

C is the long pole in wall-clock (120 VM runs) but the shortest in dependencies, so it starts on day 1.
A is the long pole in *risk*. Per §10 I will stop adding scope and report if Gate 1 misses by more than a day.

---

## 2. ASSUMPTIONS THE SPEC DOES NOT SETTLE

Each is a decision I will make unless you overrule it. They are cheap to reverse now and expensive later.

| # | Assumption | Why | Cost to reverse later |
|---|---|---|---|
| 2.1 | **Base is Aurora (KDE)**, per the §3 diagram — not Bluefin, which §2 also lists | §3's diagram names `aurora:stable`; "exactly one base" means exactly one desktop environment | High — changes every recipe, every theme, every kiosk assertion |
| 2.2 | **x86_64 only.** No arm64 images | 2012–2018 laptops are x86_64 | Low |
| 2.3 | **All four repos public** | Free Actions minutes + free GHCR bandwidth = $0 infra; and §1.3 makes publicness a feature | Low for base/recipes, medium for installer |
| 2.4 | **All builds and VM tests run in GitHub Actions**, not locally. The operator's Mac is arm64 with no hypervisor | Verified above | Low |
| 2.5 | Children rebuild when the **base digest changes or the recipe changes** — not unconditionally every night | Avoids pushing a new image to 180 machines nightly for no reason | Low |
| 2.6 | Compiler and validator in **Node 22 + TypeScript** | Already present locally and in CI; same language as the web stack; one toolchain | Medium |
| 2.7 | Installer in **Go** | Single static exe, mature Win32 bindings, fastest to a working Gate 3. Rust if AV reputation or size becomes the binding constraint | Medium |
| 2.8 | **SHA-256** for migration manifests | Customer can verify with tools they already have; auditability beats speed here | Low |
| 2.9 | **No domain purchased.** Site ships on `*.workers.dev` until a name and a budget exist | §9 + §4.6 forbid spending | Low |
| 2.10 | **Minimum viable machine: 64 GB disk, 4 GB RAM, x86_64 with UEFI or BIOS.** Two bootc deployments plus Flatpaks will not fit a 32 GB eMMC ultrabook | Arithmetic on image size; **to be validated at Gate 5, not before** | Low |
| 2.11 | Customer data **never leaves the customer's premises**. Archive lives on their USB or second drive; no cloud default | Smallest possible liability surface for a school | Low |
| 2.12 | Marathi recipe pulls **Lohit/Noto Devanagari** explicitly | Locale without fonts is a blank screen | Low |
| 2.13 | The `180 / 40 / 62` machine counts in §3's diagram are **illustrative**, and per §4.4 will never appear on the website as device counts | §4.4 | — |
| 2.14 | Windows test VMs built from **Evaluation Center ISOs** (90-day), installed once to a qcow2 base, each run on a throwaway overlay | MS's free dev VMs were discontinued in 2024 and have not returned | Low |

---

## 3. WHERE I BELIEVE THE SPEC IS WRONG OR INCONSISTENT

Ordered by how much damage each does if we build past it. The first two change the architecture.

### 3.1 — Pruning saves nothing on the wire unless we flatten, and flattening breaks the inheritance diagram — **[decision needed]**

This is the most important item in the document, because it is about whether the product's central claim
is literally true.

§1.2 says subtraction is the whole value proposition, and §6B says the build must "report exactly what was
removed." But OCI layers are additive. A `RUN dnf remove …` in a customer recipe writes a *whiteout* into
the child layer. **The base layer's bytes are still pulled by the client.** A customer whose image
"removed 214 packages" would download every one of those 214 packages on first install, plus a marker
saying to ignore them. The report would be true and the disk saving would be real; the download would be
a lie by omission.

The fix is `rechunk`, which "flatten[s] the file system tree, thereby removing files that were replaced in
later OCI layers, then re-partition[s] the image into a set of N equally sized layers" — so removals become
real bytes saved, and stable layer plans keep incremental updates small. But the same source is explicit
that this "effectively breaks inheritance — you're producing a new, optimized image rather than layering
atop the original base."

So §3's `FROM` arrows cannot simultaneously mean *literal shared OCI blobs* and *real subtraction*. Pick one.

**My recommendation:** keep `FROM` as the **source-level and rebuild-graph** contract, and flatten at publish.
Concretely — the recipe still says `FROM lathe/base:hardened`; a base change still triggers exactly one
rebuild that propagates to every child; §3's CVE rule ("CVE response is one rebuild") is fully preserved,
because that rule is about the *build graph*, not about blob sharing. What we give up is registry-side
deduplication between customers, which costs us nothing (GHCR public storage is free) and costs the
customer nothing (rechunk keeps their nightly delta small). What we gain is that "we removed 214 packages"
is true in bytes transferred, not just in a manifest.

I want this confirmed rather than assumed, because it means the diagram in §3 describes the build graph,
not the blob layout, and that is a real amendment to a section marked NON-NEGOTIABLE.

### 3.2 — The `PreToolUse` hook is not the mechanical guarantee §8 claims it is

§3 says an unsigned or untested image reaching a customer is "enforced mechanically (CI gate), not by
convention," and §8 assigns that job to a `PreToolUse` hook. **A `PreToolUse` hook only constrains this
agent inside this harness.** It does nothing about a push from CI, a human with registry write access, a
different agent session, or a workflow with a `workflow_dispatch` button. Relying on it would give us the
feeling of a hard gate with none of the properties.

The real gate has to be all three of: (a) the publish step in CI reads `attest/passed-digests.tsv` and
refuses a digest with no recorded pass; (b) GHCR write permission is held only by the workflow's
`GITHUB_TOKEN`, with no human or PAT having push rights; (c) install-time signature policy on the machine,
so an image that somehow reached the registry still cannot be installed. The hook stays as a fourth layer —
useful, but defence in depth, not the guarantee. I will build all four and describe the hook accurately.

### 3.3 — "Byte-identical image out" is not achievable; the useful property is

§6B asks for "same YAML in, byte-identical image out." Against a moving upstream this is not attainable —
RPM database ordering, build IDs, file timestamps, and the upstream digest itself all vary. Even with
`SOURCE_DATE_EPOCH`, byte-identical OCI output is a research-grade problem.

The property that actually delivers what §6B wants is: **given the same recipe and the same pinned base
digest, two builds produce the same content digest.** That is testable, and I will gate on it (check `S7`)
by building twice in one CI run and comparing. I will write the schema docs to promise that, not
byte-identity.

### 3.4 — The spec makes a migration claim about browser data that is not true, and §4.2 forbids exactly that

§6C lists "browser profiles" among the things that migrate, and §4.2 says never claim something migrates
when it doesn't. Those two are in conflict, because the truth is partial and differs by browser:

- **Firefox: genuinely portable.** Bookmarks, history, cookies and saved passwords all move (`places.sqlite`, `cookies.sqlite`, `logins.json` + `key4.db`).
- **Chrome/Edge bookmarks and history: portable.**
- **Chrome/Edge saved passwords: only by decrypting on the source machine** (DPAPI-bound key in `Local State`). Moving the ciphertext to Linux is impossible.
- **Chrome/Edge cookies: not migratable at all.** App-Bound Encryption (Chrome/Edge 127+) has an elevated service validate the calling binary.

And there is a second reason not to do it even where it is technically possible: reading `Login Data` and
calling `CryptUnprotectData` is the exact behavioural signature of an infostealer. Defender and any EDR
will flag it, which poisons the code-signing reputation we need for the tool to run at all (§3.6).

**What I will build:** Firefox profiles copied wholesale; Chrome/Edge bookmarks and history copied; Chrome/Edge
passwords and cookies **not touched**, with the tool walking the user through Chrome's own export or sign-in
sync instead. And the website's *what doesn't come across* column names this explicitly, per §4.2.

### 3.5 — "Any mismatch aborts and changes nothing" will abort constantly in the field

§6C.4's ordering instinct is right and I am not weakening it. But a literal reading — any single per-file
hash mismatch aborts the whole run — will fail on most real machines, because files legitimately change
during a copy: OneDrive hydrating placeholders, antivirus touching files, a browser writing its profile,
the user leaving a document open.

**Refinement that keeps the safety property intact:** the invariant that matters is §4.1 — *nothing is
written to the system disk until the data exists in two places and is verified*. That invariant is
untouched by retrying a file. So: per-file mismatch → re-copy that file once → re-hash. Still mismatched →
quarantine it, continue, and **surface it in the final report**. The run then only proceeds to the
destructive phase if the unresolved-file count is zero; if it is not zero, the user is shown the exact list
and must decide. Any failure of the *overall* verification still aborts and changes nothing.

Related, and missing from §6C entirely: **OneDrive Files On-Demand.** Documents/Desktop/Pictures are
frequently OneDrive-redirected with cloud-only placeholders. Naively reading them either triggers a
multi-hundred-gigabyte hydration or fails outright. The inventory step must detect
`FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS` and handle it explicitly — this is a common, fatal case.

### 3.6 — "One restart" is not achievable on a meaningful share of the target fleet

§1 promises "installed in one restart." Three things break that on 2012–2016 hardware, and all three need
the user to touch firmware:

1. **BitLocker on TPM 1.2.** Microsoft lists "changing the BIOS or firmware boot device order" as a recovery trigger for TPM 1.2 — which is a large share of the 2012–2015 cohort. Mitigation exists and I will ship it unconditionally: `manage-bde -protectors -disable C: -RebootCount 1` suspends protection for exactly one boot and reseals with no key entry. Without it, we strand users at a recovery prompt on the abort path, which is the worst possible place.
2. **Secure Boot.** Fedora's shim is signed by Microsoft's *third-party* UEFI CA, which some Lenovo/Dell business firmware ships disabled. Those machines require a firmware toggle we cannot automate. Worse, **Universal Blue images carrying custom kernel modules additionally require interactive MOK enrollment** at boot.
3. **`BootNext` is not reliably honoured** across vendors — Fast Boot can skip USB enumeration and some OEM firmware rewrites `BootOrder` at POST.

None of these is a showstopper, but "one restart" should become "one restart on most machines; some need a
firmware setting changed, and the tool tells you which before you start." I will build the firmware-menu
fallback (`shutdown /r /fw`) as a first-class path, not an error case. **This wording is a §9 item — it is a
claim on the website.**

### 3.7 — The optional dual-boot path contradicts prohibition §4.1

§6C offers "keep Windows, add a boot menu entry" as a default on first machines. Doing that requires
shrinking the Windows partition, which **is writing to the system disk** — the precise thing §4.1 forbids
before verified copy-off, and NTFS shrink is among the riskier operations we could perform on a ten-year-old
drive with no backup.

Two ways out, and I need you to pick: (a) dual-boot is offered **only after** the verified archive exists,
so §4.1's ordering still holds and the resize is recoverable; or (b) dual-boot is offered only on machines
with a second physical drive, and never via resize. I lean (a), which preserves both the spirit and the
letter, but it does mean dual-boot is not a "lighter touch" option — it is strictly more dangerous than a
clean install, and should be described that way rather than as the cautious choice.

### 3.8 — "Charged only after the test build passes" cannot be done the obvious way for subscriptions

§6D requires the card be charged only after the test build passes. The natural mechanism — Checkout with
`capture_method: manual` — is documented as available in **`payment` mode only**, so it cannot authorize-and-hold
a per-device annual subscription. (It would also cap us at a ~7-day authorization window.)

**Workable path:** run subscription-mode Checkout with `subscription_data.trial_period_days` covering the
build window. The card is collected and SCA-authenticated at checkout, **$0 is charged**; on a passing build
we end the trial early and bill; on failure we cancel and nothing was ever captured, so there is nothing to
refund. Per-device pricing with a floor works via `quantity: 25` plus `adjustable_quantity.minimum: 25`.
The $79 one-time tier keeps `payment` mode with manual capture, which is exactly what that mode is for.

No price changes are implied; this is purely about mechanism. Flagging it because §9 reserves anything
touching a real card.

### 3.9 — The design system's palette exceeds its own maximum

§7 says "maximum 18 colours." The palette as listed is **19**: sky 4, cloud 2, far hills 2, trees 2, grass 1,
soil 2, strata 4, ore 2. That is before the dark-theme sky (`#171C24`, `#1E242C`) and before any ink or panel
colour for the text that §7 requires to sit on opaque panels.

I need to know which constraint is real. My proposal: treat 18 as applying to the **terrain renderer's**
palette and drop one of the four sky bands (the stepped sky reads fine in three), keeping ink, panel and
dark-theme colours as a separate small set. Alternatively raise the cap to 24 and say so. Either is fine;
silently shipping 19 under a sign saying 18 is not.

### 3.10 — Turnstile requires JavaScript, which collides with the no-JS requirement

§6D requires the site to work with JS disabled down to a mailto fallback. But the order form opens a PR in a
public repo, which is an obvious abuse vector, and the Cloudflare-native mitigation — Turnstile — **is** a
JavaScript widget with no `<noscript>` fallback.

These are reconcilable but only in one arrangement: the real form is rendered into a JS-injected container,
the `mailto:` link lives in `<noscript>`, and the Worker **never** accepts a POST without a valid Turnstile
token. That satisfies both requirements honestly. It does mean a JS-off visitor cannot submit the
configurator — only email us — which I think is the intent of "down to a mailto fallback," but it is worth
being explicit that no-JS is a degraded path, not an equivalent one.

### 3.11 — "Kiosk" and "exactly one base" are in tension, and the tension recurs nightly

§6A defines kiosk as "no desktop shell exists in the image at all." With Aurora (KDE) as the single base,
a kiosk recipe must delete an entire desktop environment from an image built around it. That is allowed by
§6B's prune list, and §3.1's flattening makes it genuinely smaller — but it is fragile in a specific,
recurring way: the base is rebuilt nightly against upstream, and upstream may re-add a dependency that
pulls part of KDE back in. That is the "packages sneak back in" failure mode.

I am not proposing a second base — §3 is explicit and I think it is right. I am proposing that the prune
list is enforced as a **post-condition assertion** (check `S3`), so that if upstream re-adds a pruned
package, **the nightly build fails loudly instead of shipping a kiosk with a desktop in it.** Please note
this means some mornings the kiosk recipe will be red through no fault of ours; that is the correct
behaviour and should not be treated as flakiness.

### 3.12 — Gate 6 has no workstream, and §9 forbids the only action that reaches it

Gate 6 is "a nonprofit has three working laptops they did not have last week." Nothing in §6 produces a
nonprofit. There is no outreach workstream, no list, no pitch, and §9 reserves "anything touching… a real
person's inbox," which is every path to a first customer.

This is the gate most likely to be missed for non-technical reasons, and the lead time is human, not
computational. Outreach needs to begin on **day 1**, not day 7 — and it needs your approval to begin at all.
I will draft the outreach and the pilot one-pager and put them in front of you; I will not send anything.

### 3.13 — `compat.tsv`'s columns cannot be filled honestly from a VM

§8 wants compat rows from "every VM profile and every physical machine," with columns wifi / trackpad /
suspend / brightness / gpu / audio / webcam. **A QEMU profile cannot produce an honest verdict for wifi,
trackpad, brightness, or webcam** — there is no real chipset. Filling those from VM runs would manufacture
exactly the kind of unearned confidence §4 exists to prevent, and we would then quote customers from it.

So `compat.tsv` gets a mandatory `source` column (`vm` | `physical`), VM rows leave physical-only columns
blank rather than green, and no quote is ever generated from a `vm` row. What VM profiles *can* honestly
establish — firmware mode, RAM floor, CPU feature level, disk floor, boot, update, rollback — is in §4.

### 3.14 — §2's description of the operator environment does not match the machine

§2 says the operator has "one Windows laptop, unlimited VMs." The machine this runs on is **macOS 27 on
arm64 with no container runtime, no QEMU and no hypervisor**, and the target laptops are x86_64. "Unlimited
VMs" has no host specified, and it matters: Gate 3 alone is 120 Windows VM runs.

My answer is GitHub Actions for everything in Gates 1–2 (free, x86_64, KVM available) and a dedicated host
for Gate 3's farm. The obvious candidate is the `homebase` server — x86_64, KVM, 62 GB RAM — **but it has
17 GB of disk free and is running 13 containers of somebody else's work.** See §5.

### 3.15 — Nightly rebuilds are a bandwidth event at the customer's site

A school with 180 machines on one connection, all pulling a rebuilt base, is a real operational problem the
spec does not address. rechunk mitigates it substantially (stable layer plans, 40–80% smaller deltas), but a
change in a low layer still means a large pull for every machine.

I am not solving this now — staged rollout and an on-site cache are properly the fleet console's job (§6E,
deferred). I am flagging it so it does not arrive as a surprise at the first 180-machine customer, and so we
do not promise nightly updates to a site whose uplink cannot carry them.

### 3.16 — Two small ones

- §6D says "one serverless function," but the flow needs three endpoints: order intake, the Stripe webhook, and a build-result callback from CI to trigger the charge. One Worker with three routes satisfies the intent; noting it so the count isn't read as a constraint I violated.
- §5 says agent state must never live under `.claude/`, which I will follow. But hook *configuration* has to live in `.claude/settings.json` — that is the only place the harness reads it. I read the rule as being about **state** (progress, queues, logs), so config goes in `.claude/settings.json` once, with approval, and the pass ledger it reads lives at repo root.

---

## 4. THE VM CHECK MATRIX

This is what "passed" means. Every check is binary and machine-checkable; the harness emits
`results.json` keyed by image digest, and **the publish step refuses any digest without a full pass**
(§3.2). No flag overrides it (§4.3).

### 4.1 Static checks — on the OCI image, no VM required

| ID | Check | Pass criterion |
|---|---|---|
| **S1** | Base pinned | Resolved `FROM` digest === `base.lock`. A tag-only reference fails. |
| **S2** | Lint | `bootc container lint` exits 0. |
| **S3** | **Prune assertions** | For every package in `remove:`, `rpm -q` reports not installed. **Any single survivor fails the build.** This is the check that stops upstream silently un-pruning us (§3.11). |
| **S4** | Keep assertions | Every `install:` package present; every Flatpak ref resolves on Flathub. |
| **S5** | Removal report | `removal-report.json` exists, is non-empty, and its package set equals the recipe's `remove:` closure. |
| **S6** | Size budget | Final image ≤ declared budget; report delta vs base. Fails on regression > 10%. |
| **S7** | Determinism | Built twice in one run from identical inputs ⇒ identical content digest (§3.3). |
| **S8** | **Signature discoverable** | `cosign verify` passes **and** `skopeo inspect` finds the legacy `.sig` tag. Both required — `cosign verify` alone passed throughout the cosign 3.x breakage. |
| **S9** | Policy shape | `kiosk` ⇒ no `plasmashell`/`gnome-shell`/display-manager binaries in the image. `locked`/`managed` ⇒ policy units present. |

### 4.2 Boot checks — QEMU, per hardware profile

| ID | Check | Pass criterion |
|---|---|---|
| **B1** | Reaches login | Display manager active / greeter detected within **120 s** of power-on. |
| **B2** | Not degraded | `systemctl is-system-running` === `running`. `degraded` fails. |
| **B3** | Boots twice | B1+B2 hold across two consecutive cold boots. |
| **B4** | Locale & keyboard | `localectl` output === recipe values, exactly. |
| **B5** | Policy in force | Mode's runtime assertion script passes — e.g. `locked` ⇒ unprivileged user cannot install a package or gain sudo. Configured-but-not-effective fails. |
| **B6** | Network | NetworkManager active, DHCP lease on virtio-net, default route present, DNS resolves. |
| **B7** | Audio stack | pipewire + wireplumber active; `wpctl` enumerates ≥1 sink. |
| **B8** | Graphics | Compositor running on virtio-gpu; Wayland session; no compositor crash in journal. |
| **B9** | Flatpaks | Flathub remote present; every recipe app installs exit-0 and its `.desktop` exists. |
| **B10** | Suspend/resume | QEMU S3 suspend + wakeup returns to `running`, no new failed units. *Approximation only — real suspend is physical-only.* |
| **B11** | Journal clean | Zero SELinux denials, zero kernel oops/taint, zero failed units. |

### 4.3 Update and rollback — the heart of Gates 1 and 2

| ID | Check | Pass criterion |
|---|---|---|
| **U1** | Upgrade applies | After base change: VM pulls, stages, reboots, `bootc status` booted digest === new digest, **unattended, within 20 min** (§6A exit condition). |
| **U2** | Previous retained | `bootc status` lists 2 deployments; the prior image is still on disk. |
| **U3** | **Auto-rollback** | Given an image with a failing greenboot `required.d` check: after repeated failed boots the machine returns to the previous deployment and reaches a login prompt. Booted digest === old digest, system usable. |
| **U4** | **Refuses bad image** | Offered an unsigned or wrongly-signed image, `bootc upgrade` exits non-zero and the booted digest is **unchanged**. This is the second half of the Gate 1 exit condition. |
| **U5** | Offline tolerant | Registry unreachable ⇒ no change, no breakage, retry later. |
| **R1** | Restore verifies | First boot with a migration archive restores every file, re-verifies count + hash against the source manifest, reports the count on the desktop. Any discrepancy is shown, not swallowed. |

### 4.4 Hardware profiles — what QEMU can honestly vary

| Profile | Varies | What it actually proves |
|---|---|---|
| `uefi-modern` | OVMF, 8 GB, virtio-gpu | Baseline. |
| `uefi-secureboot` | OVMF + Secure Boot + MS keys, swtpm **2.0** | Image boots under Secure Boot. |
| `bios-legacy` | SeaBIOS, 4 GB | 2012-era BIOS-only machines boot at all. |
| `low-ram` | 4 GB, spinning-disk I/O limits | KDE + Flatpaks are usable at the RAM floor (2.10). |
| `old-cpu` | CPU model without AVX2 (Nehalem/Sandy Bridge) | No illegal-instruction regressions from upstream. |
| `small-disk` | 64 GB | Install + 2 deployments + Flatpaks fit with ≥15% free. |
| `tpm12` | swtpm **1.2** | **Reproduces the BitLocker boot-order risk of §3.6 directly** — swtpm emulates 1.2, so this is testable rather than assumed. |

**Explicitly not provable in any VM**, and therefore physical-only in `compat.tsv` (§3.13): real Wi-Fi
chipset association, trackpad gestures, brightness keys, true firmware suspend, webcam, battery/thermals,
GPU acceleration on GMA-era hardware, and whether a given vendor's firmware honours `BootNext`.

**Gate criterion:** a digest publishes only if **every** static + boot + update check passes on **every**
profile bound to that recipe. One failure anywhere = no publish.

---

## 5. WHAT I NEED FROM YOU BEFORE GATE 1

The first three block Gate 1 outright. The rest block later gates but are cheaper to answer now.

| # | Decision | Why it blocks | §9? |
|---|---|---|---|
| **5.1** | **The company name.** | It is the GitHub org and the GHCR namespace baked into every recipe and every installed machine. `gh` is authenticated as `aarohkandy` with **zero orgs**, so `ghcr.io/lathe/...` does not exist. Renaming after machines are deployed changes the image reference on every one of them. I also cannot create the org — the token lacks `admin:org` — so this is a click you have to make. | Yes |
| **5.2** | **Confirm §3.1** — `FROM` is the build-graph contract, and we flatten at publish so pruning is real. | Amends a section marked NON-NEGOTIABLE. I will not proceed on my own reading of it. | Effectively |
| **5.3** | **Aurora (KDE) as the one base.** | §2 lists Bluefin too; "exactly one" forces the choice. Reversing it later rewrites every recipe, theme and kiosk assertion. | Yes — product decision |
| **5.4** | **A host for Gate 3's Windows VM farm.** | `homebase` is the only x86_64 KVM box available, and it has **17 GB free of 247 GB**, plus 13 running containers and a tmux session that are not mine. I will not delete another workload's data. Options: expand the Azure disk (costs money → §9), you free space yourself, or we accept a slower serialized farm. | Yes — spends money |
| **5.5** | **The "one restart" wording** (§3.6). | It is a claim on the landing page and it is not true for BitLocker-on-TPM-1.2 or Secure-Boot-restricted machines. §9 reserves website claims we cannot evidence. | Yes |
| **5.6** | **Dual-boot: option (a) or (b)** from §3.7. | As specified it contradicts prohibition §4.1. | Yes |
| **5.7** | **Palette: drop to 18 or raise the cap** (§3.9). | The listed palette is 19 before ink and dark theme. | No — but it's your design system |
| **5.8** | **Approval to draft (not send) nonprofit outreach**, starting day 1. | Gate 6 has no workstream (§3.12) and its lead time is human. I will write; you send. | Yes |
| **5.9** | **Code-signing certificate for the installer** (~$10/mo Azure Artifact Signing, or $200–400/yr OV). | Unsigned, the exe triggers a full-screen SmartScreen block plus an "Unknown publisher" UAC prompt. Signing does **not** grant instant SmartScreen trust — reputation accrues — so the sooner it starts, the better. | Yes — spends money |
| **5.10** | **Stripe mechanism** per §3.8 (trial-period pattern). No price change implied. | §9 reserves anything touching a real card. | Yes |

**Not blocking, but you should know:** `azureuser` is not in the `kvm` group on homebase — a one-line
`usermod` with sudo, needed before any VM work there.

---

## 6. WHAT I WILL DO THE MOMENT THIS IS APPROVED

In order, stopping at the first thing that needs an unanswered §5 item:

1. Create the four repos and the root state files (`PROGRESS.md`, `TASKS.md`, `GATE.md`, `BLOCKED.md`), and `hardware/compat.tsv` with its header and `source` column — hour one, per §8.
2. Land the publish-gate hook and the digest ledger **before** anything can build, so the gate exists before the thing it gates.
3. `lathe-base`: Containerfile on a pinned digest → hardening → policy modes → update agent → signing with the legacy bundle format → rechunk → nightly workflow.
4. Stand up the check matrix harness in parallel with the base, because the base cannot publish without it.
5. Drive Gate 1's exit condition literally: push a trivial base change, watch a downstream test recipe rebuild and a running VM take it within 20 minutes unattended — then break the base on purpose and prove the VM refuses it and stays put.

I will not touch real hardware, send anything to a real person, spend money, or publish a site with an
unevidenced claim on it, at any point, without asking first.
