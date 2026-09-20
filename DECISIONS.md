# DECISIONS

Append-only. Every §9-reserved decision and every architectural choice, with who made it and when.
Re-read at the start of every work session (spec §8).

---

## D1 — Company name: **Auros** · 2026-09-20 · HUMAN
GitHub namespace `aarohkandy`, product `auros`. Images publish to `ghcr.io/aarohkandy/auros-base`.
Namespace lives in exactly one file, `auros.config.json`; everything else derives from it, so a later
rename is one file plus a registry re-tag. Resolves PLAN.md §5.1.

## D2 — Flatten at publish · 2026-09-20 · HUMAN
Confirmed PLAN.md §3.1. `FROM` is the **source-level and rebuild-graph** contract, not a promise about
blob layout. `rechunk` flattens at publish so that removed packages are bytes the customer never
downloads. Spec §3's "CVE response is one rebuild" is fully preserved — that rule is about the build
graph. What we give up is registry-side dedup between customers, which is free on GHCR and invisible to
the customer. **This is a deliberate amendment to a section marked NON-NEGOTIABLE.**

## D3 — Base: Aurora (KDE Plasma) · 2026-09-20 · HUMAN
One base, forever, per spec §3. KDE because the human's directive (D4) requires a Windows-shaped desktop
and because the KDE Kiosk framework is the only lockdown mechanism strong enough to make our `locked` and
`kiosk` policy modes provable rather than merely configured.

## D4 — Product directive: *personalized Windows, not Linux* · 2026-09-20 · HUMAN
Verbatim: *"make sure people can still use it, if it can run exe and feel like windows that'd be amazing
but not completely required, make it clean end to end, make it feel like personalized windows rather than
linux rn which needs you to memorize books of commands and stuff"*

Binding consequences, treated as requirements not aspirations:
1. **Zero-terminal.** A user must never need a command line to do anything the product promises. If a task
   requires a terminal, either it gets a GUI or it is not a promise we make.
2. **Windows-shaped by default.** Taskbar, start menu, double-click-to-open, familiar folder names, an
   Explorer-like file manager. Shipped system-wide in the image, not left to the user.
3. **.exe support is a capability, offered honestly.** A `compat_layer` recipe field installs
   Bottles/WINE from Flathub. We will state precisely what runs and what does not, per-application,
   and never imply blanket compatibility. Bounded by prohibition §4.2.
4. **Clean end to end** — first boot is a guided setup, not a desktop dumped on a stranger.

## D5 — Execution is real · 2026-09-20 · HUMAN
Four public repos under `aarohkandy`, real GitHub Actions builds, real QEMU boots, real GHCR publishes.
Local machine (macOS 27 / arm64, no podman, no qemu, no cosign — verified) cannot build or boot anything,
so CI is not a convenience here, it is the only execution environment.

## D6 — Repo layout reconciliation · 2026-09-20 · AGENT
Spec §5 wants four repos; the human created one repo named `auros`. Resolution: `aarohkandy/auros` is the
**meta/control repo** — this workspace root: PLAN.md, state files, `hardware/compat.tsv`, skills, hooks,
docs. The four product repos (`auros-base`, `auros-recipes`, `auros-installer`, `auros-web`) are separate
and nested here as their own git repos, gitignored from the meta repo. Spec §5's "different audiences and
different lifetimes" is preserved; `auros-recipes` in particular must be independently public and
forkable for the §1.3 replaceability claim to be true.

## D7 — GHCR auth path · 2026-09-20 · AGENT
Local `gh` token scopes are `gist, read:org, repo, workflow` — **no `write:packages`, no `admin:org`.**
So: no org can be created from here, and no image can be pushed from this machine. Neither is needed.
Workflows publish with the job's own `GITHUB_TOKEN` under `permissions: packages: write`. Cross-repo
dispatch (base → recipes) is the one place that needs a credential the default token cannot supply; see
BLOCKED.md B2.

---

# Amendments forced by upstream research · 2026-09-20 · AGENT
Eight-way parallel live research contradicted assumptions in PLAN.md. Each item below is a change to the
build, not a note. Sources are in the research dossiers; the important ones are named inline.

## D8 — Signature enforcement does NOT come for free by deriving from Aurora · **load-bearing**
`ublue-os/image-template`, the officially recommended path, **ships no `policy.json` and no `registries.d`
entry for your own namespace**, and the base image's `policy.json` ends with a docker
`"": [{"type":"insecureAcceptAnything"}]` catch-all. So
`bootc switch --enforce-container-sigpolicy ghcr.io/aarohkandy/auros-base` **succeeds while verifying
nothing.**

PLAN.md assumed "derive from aurora and signature enforcement keeps working". That premise is false as
written. We must ship, inside our own image: our public key under `/usr/lib/pki/containers/`, our own
`/etc/containers/registries.d/` yaml with `use-sigstore-attachments: true`, and a
`transports.docker["ghcr.io/aarohkandy"]` **sigstoreSigned** entry that comes *before* any catch-all.
Check **U4** is what proves this works; without D8 it would have passed vacuously.

## D9 — greenboot is not installed on Aurora. We install it.
Verified absent from `ublue-os/aurora`, `ublue-os/bluefin`, `ublue-os/main` and the Fedora bootc
standard/minimal manifests. It ships only in the Fedora bootc **IoT** manifest. PLAN.md's A4 assumed it
was present. Auto-rollback (check **U3**) is a headline safety property — a school has no out-of-band
console — so greenboot is an explicit install step in the base, not an assumption.

**Also:** on the composefs/UKI backend, greenboot rollback does not work at all — upstream has not wired
boot-loader entry counting there. We therefore stay on the **ostree + GRUB/bootupd** path deliberately,
and that is now a constraint, not a default.

## D10 — Exactly one rollback deployment is retained, not N
There is no way through normal bootc operation to keep more than booted + one rollback. `ostree admin pin`
exists but bootc exposes no verb for it. Any wording implying "roll back to any recent image" is false.
Check **U2** asserts two deployments, which is the real guarantee, and the website says "the previous
image", singular.

## D11 — Flatten with `rpm-ostree compose build-chunked-oci`, not `rechunk` · **mechanism change**
D2 (flatten at publish) stands. Its *mechanism* changes. `hhd-dev/rechunk` is effectively unmaintained
(last commit 2025-10-11) and its own `action.yml` warns that the container images it depends on expire
after 90 days. More decisively, **ublue-os has largely moved off it**: bazzite and image-template run
`rpm-ostree compose build-chunked-oci --bootc`, aurora's step is `chunkah`, bluefin uses a vendored fork.
Adopting rechunk means adopting a fork and its maintenance.

We use `rpm-ostree compose build-chunked-oci --bootc`, which already ships in fedora-bootc.
*(PLAN.md also asserted rechunk takes a `rawhide:` input. It does not — there is no such input in
`action.yml`. Moot now, but it is a reminder that a plan written from memory of a README is not evidence.)*

## D12 — Kiosk strips the shell, not the whole desktop stack · **tension with §3, resolved inside it**
Research recommends inverting: build kiosk **up** from `fedora-bootc minimal` rather than stripping Plasma
out of a KDE base, because stripping fights `protected_packages`, weak deps, and a dependency closure that
has historically tried to remove systemd and dnf.

**We are not doing that, because it would mean a second base, and spec §3 says exactly one.** The cost of
two bases is that a CVE stops being one rebuild — which is the thing we sell.

What we do instead: kiosk removes the **shell and the display manager** — the binaries a user could reach
a desktop through — and check **S9** asserts exactly that (`plasmashell`, `gnome-shell`, display-manager
binaries absent). Shared libraries that the closure will not release stay, and **we report the real
measured size rather than a minimal one we did not achieve.** The spec's kiosk definition is "no desktop
shell exists in the image at all", and that is satisfied literally.

**Honest cost, recorded so nobody is surprised:** our kiosk image will be meaningfully larger than a
purpose-built minimal one. We trade image size for the one-rebuild CVE property. If that trade ever stops
being worth it, it is a **§9 decision for the human**, not something to fix by forking.

## D13 — Windows-side: we do not write boot media · **scope reduction that reduces risk**
Spec §6C step 5 says "write the bootable image, set one-time boot, restart". Writing boot media from
Windows with no dependencies means an elevated raw handle to `\\.\PhysicalDriveN`, `FSCTL_DISMOUNT_VOLUME`
on every child volume, hand-rolled GPT and a FAT32 ESP, and sector-aligned raw writes — **irreversibly
destructive, on a machine we do not own, with no undo.**

We drop it. The Windows exe does what it is good at: inventory, disclose, stage a verified bundle of
**plain files** to an ordinary external drive, and — at most — set `bcdedit /set {fwbootmgr} bootsequence`
against media **the user already made**. Install media is produced elsewhere, by a machine with the tools
for it.

This removes the single most destructive code path in the company and loses nothing a customer wanted.
**Flagged for the human** as a deviation from §6C's literal wording.

## D14 — VSS is an escalation, not the mechanism
`vssadmin create shadow` **does not exist on Windows 10/11 client SKUs** — it survives only in archived
Server docs. `wmic` is removed from Windows 11 24H2/25H2 and is no longer a Feature on Demand. And there
is no C-callable VSS entry point, so a pure-Go requester means hand-built MSVC-ABI vtable dispatch that
refuses to run on 32-bit or WOW64.

So: **backup semantics + full sharing is the default path** for the ~95% of files that are not locked;
VSS is an opt-in escalation for the residue; and when VSS is unavailable the run produces an honest
*"these N files were in use and were skipped"* list rather than a silent gap. Quarantine, not omission.

## D15 — Chrome/Edge: passwords do not migrate either · **corrects PLAN.md §3.4**
PLAN.md said App-Bound Encryption blocks cookies and DPAPI blocks passwords. Understated: as of Chrome/
Edge 127+, **v20 ABE wrapping covers cookies, saved passwords *and* payment data.** Microsoft's own Edge
documentation says disabling the policy is only for when "encrypted user data is expected to be fully
portable between different computers".

Product position, final: **Chrome/Edge bookmarks and history migrate. Cookies, passwords and payment data
do not, full stop.** The tool walks the user through Chrome's own sync or a manual export from
`chrome://password-manager` *before* the wipe.

**We do not build a decryptor.** Every published technique requires injecting into or impersonating the
signed browser binary. That is malware behaviour, Defender treats it as such, and it would poison the
code-signing reputation the tool needs to run at all.

## D16 — No automated .exe compatibility checker, and Office/Adobe go on the "does not migrate" list
There is **no WineHQ AppDB API** — it is a PHP/MySQL web app with no JSON endpoint, currently behind an
Anubis proof-of-work challenge. Building "paste your app list and we'll check it" would mean circumventing
a deliberate anti-bot control. We will not.

Read directly from AppDB on 2026-09-20: Office 365 Business, Office 2021 Pro Plus and Office 365 ProPlus
are all rated **Garbage**; every Photoshop CC release 2019–2024 is **Silver** ("has some problems for
which there are no workarounds"), on small samples and stale Wine versions, with no 2025/2026 entry at all.

So **Office and Adobe go on the explicit "does not come across" list**, not into a caveat footnote (§4.2).
Compatibility scoping is a hand-curated internal table plus manual lookups during the sales conversation.

**Winboat / WinApps is dropped from the pitch entirely.** It needs a Windows Pro licence per device that
the customer buys on top of the migration, its own floor is 4 GB RAM and 32 GB free *for the VM*, and it
is self-described beta. Offering a Windows VM to a school with 4 GB 2012 laptops is not an honest option.
When a customer genuinely needs Office, the honest answers are the web version, keeping one Windows
machine, or not migrating that user.

## D17 — Cosign is a time-boxed risk, pinned
`--new-bundle-format=false` is the flag that keeps signatures discoverable by `containers/image`, and it
is **explicitly deprecated upstream** ("this will be the only supported format in future versions"), while
`containers/container-libs#388` — the fix that would let podman/bootc read the new format — has been
**open since 2025-10-12 with no fix.** If cosign drops the flag first, signing for bootc consumers breaks
with no workaround. We pin cosign to an exact version in CI and track #388 as a project risk. Check **S8**
is what would catch the breakage, and it checks discoverability rather than trusting `cosign verify`.

## D18 — Cross-repo dispatch: confirmed blocked, and the reason is not the usual one
`GITHUB_TOKEN` is issued *for the repository containing the workflow* and cannot authenticate
`POST /repos/{other}/{repo}/dispatches`. (Note the commonly-cited recursion rule is not the cause — the
docs explicitly exempt `repository_dispatch`.) Needs a PAT or a GitHub App installation token.
Confirms BLOCKED.md **B2**; the scheduled-poll fallback stands and satisfies Gate 2's 20-minute window.

## D19 — Standing CI rule: `set -o pipefail`, always · 2026-09-20 · AGENT
Our own first boot probe piped a build step through `tail -40`. The pipeline's exit status was `tail`'s,
so a **failing** `bootc-image-builder` was scored as a **passing** step, and the workflow reported success
while producing no image at all.

This is exactly the failure mode the check matrix exists to prevent, and it appeared in our own code
within an hour of writing the matrix. Every workflow in every Auros repo therefore sets:

```yaml
defaults:
  run:
    shell: bash -euo pipefail {0}
```

The general form of the lesson, which matters more than the flag: **a step that cannot fail is not a
check.** When adding any gate, the first question is "what would make this go red?", and if there is no
answer, the gate is decoration.

## D20 — `ostree container commit` is obsolete on this base · 2026-09-20 · AGENT (measured)
Our boot probe failed with `error: Not in an ostree-based container environment` on a plain
`RUN ... && ostree container commit`. The command belongs to the older rpm-ostree derivation flow and is
not applicable to a modern bootc image derived from `ghcr.io/ublue-os/aurora`.

**The base `Containerfile` must not call it.** `bootc container lint` (check S2) is the validation step.
Recorded because every tutorial written before ~2024 ends with that line, and an agent or a human copying
one would break the build in a way whose error message does not obviously point at the cause.

---

# Amendments from the full research synthesis · 2026-09-20 · AGENT
Full sheet: `docs/DECISION-SHEET.md` (225 facts, 37 blockers, 8 dossiers). Only the items that change the
build are repeated here.

## D21 — Upstream deletes the digest we pin. We mirror it. · **architectural, would have broken us silently**
`ublue-os/aurora` runs `dataaxiom/ghcr-cleanup-action` **weekly, Sunday 00:15 UTC**, with
`older-than: 90 days`, `keep-n-tagged: 7`, `keep-n-untagged: 7`, `delete-orphaned-images: true`.

So the digest in `base.lock` is **garbage-collected by upstream** — after roughly 90 days, or after seven
newer stable tags, whichever comes first. Pinning by digest protects us from upstream *moving* a tag. It
does not protect us from upstream *deleting the blob*. The failure mode is the worst kind: everything
works for weeks, then one morning every build fails with a manifest-unknown on an image nobody changed,
and a customer who forked our recipe to rebuild without us — the thing we advertise — cannot.

**Fix, and it is not optional:** on every successful base build we **mirror the pinned upstream digest
into our own namespace** (`ghcr.io/aarohkandy/auros-upstream-mirror`) with `skopeo copy --all`, and the
`FROM` resolves against the mirror. Upstream remains the source of truth for *what to pin*; our mirror is
what guarantees the pin is still *pullable*. This costs nothing — GHCR public storage is free — and it is
what makes spec §1.3's "if we vanish, you rebuild your exact OS from the file" survive contact with
upstream's retention policy.

This also protects the customer, not just us. A recipe that references a deleted base is a recipe that
cannot be rebuilt by anyone, which would quietly convert our main trust asset into a broken promise.

## D22 — `uupd`, not `bootc-fetch-apply-updates`, is the real update driver on this base
Aurora ships **`uupd.timer` / `uupd.service`** (`OnCalendar=*-*-* 04:00:00`, `Persistent=true`,
`RandomizedDelaySec=15m`), configured by `/etc/uupd/config.json`. `/etc/rpm-ostreed.conf`'s
`AutomaticUpdatePolicy=stage` is a decoy — present, but not what drives updates here.

PLAN.md A4 named the wrong unit. Health checks, the update-timer-is-still-enabled assertion, and check U1
all bind to `uupd`. Getting this wrong would have produced an agent that looked configured and never ran.

## D23 — Pin the runner to `ubuntu-24.04`, not `ubuntu-latest`
`ubuntu-latest` migrates to 26.04 between 2026-10-19 and 2026-11-19. An OS migration under a build that
boots VMs is a week we do not have. Pin the runner and move it deliberately. Same reasoning as pinning
the base by digest, applied to CI.

## D24 — Where research and our own probe disagree about the runner, the probe wins
The synthesis reports ~25–29 GB free before cleanup and ~51 GB after. **Our own probe measured 145 GB
total, 87 GB free before cleanup and 110 GB after**, on `ubuntu-latest`, today
(`docs/evidence/2026-09-20-runner-probe.md`).

We use our measurement. Research reports what upstream *documents*; a probe reports what the runner
*actually did*. Recorded as a standing precedence rule, because this will happen again: **when a document
and a measurement disagree about our own infrastructure, the measurement wins, and we write down that it
did.**

## D25 — Assorted pins now fixed rather than discovered at 2am
- **Aurora is x86_64 only** — a single OCI manifest, not an index; aarch64 is commented out of their
  build matrix. Confirms assumption 2.2 as a fact rather than a guess.
- Fedora **44**, kernel 7.1.8, Plasma **6.7.5**, bootc **1.16.10**, flatpak 1.18.2, ostree 2026.4.
- Streams that exist: `stable`, `latest`, `testing`. **There is no `lts` and no `gts`** — they 404.
  Stable rebuilds `cron: 0 1 * * TUE` off branch `stable-f44`.
- `bootc status --json`: the booted digest is at **`.status.booted.image.imageDigest`**, and
  `.status.booted.image.image.signature` must read **`containerPolicy`** — that field is how CI proves
  D8's enforcement is real rather than nominal. `.status.rollback` is singular, confirming D10.
  A rollback emits journal `MESSAGE_ID=26f3b1eb24464d12aa5e7b544a6b5468`.
- Our cosign public key goes in **`/usr/lib/pki/containers/`**, not `/etc/pki` — `/usr` is image-lifecycled.
- KDE Control Module restrictions live in **`/etc/kde5rc`** — the literal KF5 filename, still hardcoded
  in KF6. A file named `kde6rc` is ignored.
- greenboot: `GREENBOOT_MAX_BOOT_ATTEMPTS=3` in `/etc/greenboot/greenboot.conf`; checks in
  `/etc/greenboot/check/required.d/*.sh`, mode 0755.
- `bootc-image-builder` wants **`--rootfs xfs`** for this base.
- Cosign pinned to **v3.1.3** exactly (D17's time-boxed risk).
- Web: Astro **7.3.3**, `@astrojs/cloudflare` **14.3.2**, wrangler **4.135.0**, Cloudflare **Workers**
  (not Pages). Turnstile test keys `1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`.
- **Instrument Serif ships 400 normal and 400 italic only — there is no bold.** Any design calling for a
  bold display weight has to be redrawn, not faked with synthetic bold.

## D26 — The image needs a ≥20 GiB root filesystem · 2026-09-20 · AGENT (measured)
`bootc-image-builder` failed with `min-free-space-percent '3%' would be exceeded` building a qcow2 from a
plain Aurora derivative. **The image is 8.4 GB across 257 layers**, and bib's default root filesystem is
too small for it — ostree refuses the write rather than filling the disk.

Fixed in the build config with an explicit `[[customizations.filesystem]] mountpoint = "/", minsize =
"20 GiB"`.

**This is a product fact, not a CI detail.** It puts a measured floor under assumption 2.10 ("minimum
viable machine: 64 GB disk"). The arithmetic that matters for a customer: ~8.4 GB image, **two** bootc
deployments retained so rollback is possible (U2), plus Flatpaks, plus user data, plus ostree's 3%
reserve. The `small-disk` test profile (64 GB) is therefore not a comfortable margin — it is close to the
real floor, and it is the profile most likely to fail on a genuinely old machine.

A 32 GB eMMC ultrabook is almost certainly **out of scope**, which matters because that describes a large
part of the 2014–2016 cheap-laptop cohort. Declaring a model unsupported is a §9 decision, so this is
recorded as evidence for the human rather than acted on.
