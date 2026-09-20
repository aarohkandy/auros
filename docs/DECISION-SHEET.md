# Upstream decision sheet

> Produced 2026-09-20 by eight parallel research agents against primary sources, then synthesized.
> 225 facts, 37 blockers, 563 tool uses. This is what the build is written from.
>
> **Precedence:** where this contradicts PLAN.md, this wins. Where our own direct measurement contradicts
> THIS, the measurement wins — see docs/evidence/. Research reports what upstream documents; a probe
> reports what the runner actually did today.

# AUROS BUILD DECISION SHEET
**Frozen 2026-09-20 from 8 research dossiers. Everything below is what the build gets written from.**

---

## PINNED FACTS

### Base image
| Thing | Value |
|---|---|
| Base ref | `ghcr.io/ublue-os/aurora:stable@sha256:911281f2aaa42bfd17532c5cef917aba8d7ac8c0faeb1c1edc6a43dc28d0d2f1` |
| Human tag | `stable-20260915.2` (identical manifest to `:stable` and `:stable-daily`) |
| `org.opencontainers.image.version` | `44.20260915.2` |
| Built | 2026-09-15T20:28:34Z, revision `c6a79ae03b7a4e7c8119615fe7099f1f00cb949e` |
| Arch | **x86_64 only** — single OCI manifest, not an index. aarch64 commented out of the build matrix. |
| Fedora | 44 · kernel `7.1.8-200.fc44.x86_64` · Plasma `6.7.5-1` · Mesa `26.2.2-1` · podman `5.8.4-1` · **bootc `1.16.10-1`** · flatpak `1.18.2-1` · ostree `2026.4-1` · rpm-ostree `2026.2-1` · NVIDIA `615.71.09-1` (open) |
| Compressed size (aurora:latest, measured) | 3.71 GB across 256 layers |
| Streams that exist | `stable`, `latest`, `testing`. **No `lts`, no `gts`, no `beta`** (404). |
| Stable cadence | `cron: "0 1 * * TUE"` off branch `stable-f44` |
| GHCR retention (kills our pin) | `dataaxiom/ghcr-cleanup-action` weekly Sun 00:15 UTC, `older-than: 90 days`, `keep-n-tagged: 7`, `keep-n-untagged: 7`, `delete-orphaned-images: true` |

### Paths and unit names we hardcode
| Path / name | Purpose |
|---|---|
| `/etc/containers/policy.json` | signature enforcement policy (aurora ships it here) |
| `/etc/containers/registries.d/auros.yaml` | `use-sigstore-attachments: true` for our namespace |
| `/usr/lib/pki/containers/ublue-os.pub`, `ublue-os-backup.pub` | ublue keys — **`/usr/lib`, NOT `/etc/pki`** |
| `/usr/lib/pki/containers/ghcr.io-auros.pub` | our cosign public key |
| `uupd.timer` / `uupd.service` / `uupd-manual.service` | the actual update driver. `OnCalendar=*-*-* 04:00:00`, `Persistent=true`, `RandomizedDelaySec=15m`. `uupd-manual` = `--hw-check=false`. |
| `/etc/uupd/config.json` | aurora ships it with the distrobox module disabled |
| `/etc/rpm-ostreed.conf` | `AutomaticUpdatePolicy=stage` — decoy, not the driver |
| `/usr/share/ublue-os/just/*.just` | drop our `ujust` recipes here |
| `/usr/share/ublue-os/homebrew/system-flatpaks.Brewfile` | aurora's 22 preinstalled flatpaks |
| `/usr/share/flatpak/preinstall.d/*.preinstall` | our declarative flatpak set (in `/usr`, image-lifecycled) |
| `/usr/share/flatpak/remotes.d/flathub.flatpakrepo` | Flathub remote, applies to default **system** installation only |
| `/usr/share/plasma/look-and-feel/com.auros.desktop/contents/layouts/org.kde.plasma.desktop-layout.js` | first-run panel layout |
| `/usr/share/plasma/look-and-feel/com.auros.desktop/contents/defaults` | appearance bundle |
| `/usr/share/plasma/layout-templates/com.auros.taskbar/contents/layout.js` | reusable taskbar template |
| `/etc/xdg/kdeglobals` | policy + kiosk restrictions |
| **`/etc/kde5rc`** | `[KDE Control Module Restrictions]` — literal KF5 filename, still hardcoded in KF6 |
| `/etc/greenboot/check/required.d/*.sh` (0755), `/etc/greenboot/greenboot.conf` | health checks, `GREENBOOT_MAX_BOOT_ATTEMPTS=3` |
| `/boot/grub2/grubenv` | `boot_counter`, `boot_success` |
| `/ostree/deploy/default/` | stateroot `bootc install` always uses |
| `/etc/ostree/auth.json` | bootc's private-registry pull secret (NOT the containers auth path) |

### bootc status JSON — the exact paths CI gates on
```
apiVersion            org.containers.bootc/v1
kind                  BootcHost
.status.booted.image.imageDigest          <- THE digest
.status.booted.image.image.image          <- ref string (triple nesting)
.status.booted.image.image.signature      <- must equal "containerPolicy"
.status.booted.ostree.checksum
.status.staged.downloadOnly
.status.rollback                          <- exactly one, ever
journal MESSAGE_ID=26f3b1eb24464d12aa5e7b544a6b5468   <- a rollback happened
```

### CI pins
| Thing | Pin |
|---|---|
| Runner | `ubuntu-24.04` (NOT `ubuntu-latest` — migrates to 26.04 between 2026-10-19 and 2026-11-19) |
| Free disk | `ublue-os/remove-unwanted-software@cc0becac701cf642c8f0a6613bbdaf5dc36b259e` (v9), `remove-swapfile: false` |
| Login | `docker/login-action@abd2ef45e78c5afb21d64d4ca52ee8550d9572c7` (v4.5.1) |
| Cosign installer | `sigstore/cosign-installer@6f9f17788090df1f26f669e9d70d6ae9567deba6` (v4.1.2) |
| Cosign release | `v3.1.3` — exact, never floating |
| Rechunker | `quay.io/coreos/chunkah` `--max-layers 128 --prune /sysroot/` **or** in-image `rpm-ostree compose build-chunked-oci --bootc --max-layers 127 --format-version 2` |
| bootc-image-builder | `quay.io/centos-bootc/bootc-image-builder:latest`, `--rootfs xfs`, `--type` repeated |
| Free-runner disk reality | ~25–29 GB free before cleanup, ~51 GB after. The docs' "14 GB SSD" is the temp disk, not `/`. |
| Hard limits | 6 h/job, 20 concurrent jobs (Free plan), public-repo Actions minutes unmetered, GHCR public storage/bandwidth free |

### Website stack
`astro 7.3.3` · `@astrojs/cloudflare 14.3.2` (peer: astro ^7.2.0, wrangler ^4.125.0) · `wrangler 4.135.0`. Cloudflare **Workers**, not Pages. Lighthouse mobile weights: TBT 30, LCP 25, CLS 25, FCP 10, SI 10, INP 0. Moto G Power 412×823 @1.75, Slow 4G 1638/768/150ms, CPU 4×. Turnstile test sitekey `1x00000000000000000000AA` / secret `1x0000000000000000000000000000000AA`. Fonts: Instrument Serif is OFL, **400 normal + 400 italic only, no bold**; IBM Plex Sans/Mono are variable `[wdth,wght]`, OFL.

### Migrator (Windows side)
`SHGetKnownFolderPath` via `golang.org/x/sys/windows.KnownFolderPath` (no cgo; x/sys ships `KF_FLAG_*` but **no `FOLDERID_*` GUIDs** — we hardcode them). `cldapi.dll` → `CfGetPlaceholderStateFromFindData`; `CF_PLACEHOLDER_STATE_PARTIALLY_ON_DISK = 0x20` is the would-hydrate signal. `FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS = 0x00400000`. `IO_REPARSE_TAG_CLOUD = 0x9000001A` (mask `0xFFFF0FFF`). `manage-bde -protectors -disable C: -rc 1`. Bottles prefix lives at `~/.var/app/com.usebottles.bottles/data/bottles/bottles/` — per-user, in `$HOME`.

---

## CONTRADICTIONS

**1. "Use hhd-dev/rechunk" (plan) vs. "ublue moved off it" (D3).** → **Believe D3.** D3 read the workflows: bazzite and image-template run `rpm-ostree compose build-chunked-oci --bootc`; aurora's step is literally named *"Rechunk Image with Chunkah"*; bazzite-gdx has the rechunk step commented out; only bluefin still uses rechunk, via a vendored fork `ghcr.io/ublue-os/legacy-rechunk`. rechunk's last commit is 2025-10-11 and its own `action.yml` warns its container images expire after 90 days. **Decision: chunkah.**

**2. rechunk has a `rawhide:` input.** → **False.** D3 read `action.yml` in full and grepped the repo: zero hits. Full input set is `ref, prev-ref, clear-plan, prev-ref-fail, max-layers, skip_compression, labels, description, version, pretty, rechunk, keep-ref, changelog, git, revision, formatters, meta`. Output is **`location`**, not `output` (the widely-copied bazzite-gdx template has `steps.rechunk.outputs.output`, which expands to empty).

**3. "Derive from aurora and signature enforcement keeps working."** → **False** (D1 blocker, D2 corroborates). aurora's `policy.json` ends with `"": [{"type":"insecureAcceptAnything"}]`, and `image-template` ships no policy for your namespace. `bootc switch --enforce-container-sigpolicy ghcr.io/auros/...` will **succeed while verifying nothing**. Both dossiers agree. We ship our own key + registries.d + transports entry.

**4. "greenboot gives us health-check rollback out of the box."** → **False.** D2 verified greenboot is absent from ublue-os/main, bluefin **and aurora**, and from Fedora bootc standard/minimal/minimal-plus. Only the Fedora bootc **IoT** manifest ships it. We `dnf5 install -y greenboot greenboot-default-health-checks` ourselves.

**5. Cosign version: D1 says aurora uses `v3.1.3`; D4 says image-template uses `v3.1.2`.** → Both true, different repos. **Take `v3.1.3`** (aurora is our base's own pipeline). Immaterial — what matters is the flags, which are identical.

**6. Runner: D3 requires `ubuntu-24.04` (rechunk); D4 notes image-template is on `ubuntu-26.04`.** → We're not using rechunk, so the 24.04 pin isn't forced — but **still pin `ubuntu-24.04`**, because `ubuntu-latest` shifts under us during the 2026-10-19→11-19 migration window and D4's free-disk numbers were measured on 24.04.

**7. "Disk space is a hard blocker on free runners."** → **False** (D4). osbuild's own CI builds raw+qcow2+vmdk+vhd from a Fedora image on free `ubuntu-24.04` in a 45-min timeout with one cleanup step. But the cleanup step is a **hard dependency**, not an optimization: 3.71 GB compressed → ~9–11 GB unpacked → plus qcow2 ≈ 25–30 GB peak, which does not fit in the 25–29 GB baseline.

**8. "Repo A can't dispatch repo B because of GITHUB_TOKEN recursion prevention."** → **Wrong reason** (D4). Docs explicitly exempt `repository_dispatch` and `workflow_dispatch`: they *always* create runs. The real blocker is **scope** — GITHUB_TOKEN is issued per-repo. Fix is a GitHub App installation token, not a workaround for recursion.

**9. D6's Discover surgery vs. D1's package list.** → D1 verified aurora already **removes** `plasma-discover` and ships Bazaar plus `/usr/share/flatpak/preinstall.d/bazaar.preinstall`. D6's `plasma-discover-*` backend-stripping plan is written against Kinoite and is **mostly moot on our base**. Keep D6's *mechanism* knowledge (there is no config key for backends — only plugin `.so` presence or `--backends`) in case we reintroduce Discover; do not run its `dnf remove` list blind.

**10. `plasma-apply-layoutscript`.** → **Does not exist**, in Plasma 5 or 6. Verified by package file list and recursive repo grep. Any plan step naming it is void.

**11. `/etc/xdg/plasma-org.kde.plasma.desktop-appletsrc` as a system default.** → **Silently ignored.** libplasma opens it `KConfig::SimpleConfig`, which disables the XDG cascade. No error; you just get stock Breeze.

**12. "Plasma needs SingleClick=false to feel like Windows."** → Already the Plasma 6 default. The real gap is `DndBehavior`.

**13. "Chrome passwords are DPAPI, cookies are ABE."** → Understated (D5). Since Chrome/Edge 127 the `v20` App-Bound wrapping covers **cookies, passwords and payment data**. Microsoft's own `ApplicationBoundEncryptionEnabled` doc names "fully portable between different computers" as the only reason to disable it.

**14. "Astro on Cloudflare Pages."** → `@astrojs/cloudflare` v13+ **removed Pages support**. Workers only.

**15. "Canvas is our LCP problem."** → A `<canvas>` is **not an LCP candidate element**. On the configurator page LCP is hero text (a font problem) and the binding constraint is **TBT at 30%**.

---

## HARD BLOCKERS

**B1 — Our pinned FROM digest expires in ≤90 days, sooner in practice.**
aurora's `clean.yml` keeps 7 tagged manifests at a weekly cadence ⇒ under 2 months. **Workaround: mirror.** On every successful build, `skopeo copy` the base into `ghcr.io/auros/base-aurora:stable-YYYYMMDD.N` in our own registry and `FROM` *that*. Renovate-style digest bumping is the ublue answer but leaves us dependent on their retention; a fleet that must not break mirrors.

**B2 — Signature enforcement on our namespace is cosmetic unless we build it.**
Workaround in CANONICAL SNIPPETS §2 + §6. Three parts, all required: our `.pub` under `/usr/lib/pki/containers/`, a `registries.d` yaml with `use-sigstore-attachments: true`, and a `transports.docker["ghcr.io/auros"]` `sigstoreSigned` entry. Plus `--enforce-container-sigpolicy` at install/switch, else the deployment records `ContainerPolicyAllowInsecure` and the policy file is decorative.

**B3 — `cosign sign` default writes signatures podman/bootc cannot see.**
cosign 3.x defaults `--new-bundle-format=true` → OCI 1.1 referrer; containers/image only looks for the legacy `sha256-<digest>.sig` tag and GHCR doesn't serve `/referrers`. Bluefin shipped ~3 months of effectively-unsigned images this way (projectbluefin/common#977). **`cosign verify` passes on both formats and therefore cannot catch it.** Workaround: `--new-bundle-format=false --use-signing-config=false`, **plus a registry-level assertion that the `.sig` tag exists** (§6). Time-boxed risk: the flag is deprecated ("this will be the only supported format in future versions") while containers/container-libs#388 has been open since 2025-10-12. Pin cosign exactly; block Renovate on that major.

**B4 — `dnf remove` in a derived layer saves zero pull bytes.**
Whiteouts mask; parent-layer bytes still ship. Workaround: a flatten/rechunk pass (§3). Any savings number measured before that step is fiction.

**B5 — Removing packages from aurora fights three separate mechanisms.**
(a) versionlocks on `qt6-*`, `plasma-desktop`, `plasma-setup` and 12 mesa/intel/libva/libheif packages — the qt6 lock exists because partial KDE upgrades **black-screened the desktop** (aurora#1227); (b) all third-party repos ship `enabled=0`, so a bare `dnf5 install` sees only base Fedora — use `--enablerepo=` / `--from-repo=`; (c) `protected_packages` defaults to `dnf5,glob:/etc/dnf/protected.d/*.conf` and a DE-group removal classically fails with *"would result in removing the following protected packages: systemd, dnf"*. Workaround: stash `/etc/dnf/protected.d/*.conf` in the build stage, do removals **last**, and set `install_weak_deps=False` on every install (a later `dnf install` re-pulls removed packages via Recommends — the #1 way a removal silently doesn't happen).

**B6 — Exactly one rollback deployment exists. Ever.**
libostree GCs everything but merge + booted; bootc's finalization passes only `NO_CLEAN`, no RETAIN flags. "Roll back to any of the last N images" is false. Workaround: `ostree admin pin` a known-good deployment ourselves (surfaces in `.status.otherDeployments` with `pinned: true`); bootc exposes no verb for it.

**B7 — `bootc rollback` reverts `/etc` and discards staged updates.**
Anything written to `/etc` post-deploy (enrollment, certs) vanishes. Workaround: that state goes in `/var` or gets baked into the image.

**B8 — Digest pinning makes `bootc upgrade` a permanent no-op.**
Every update must be `bootc switch`. A timer-driven auto-update will look healthy while doing nothing.

**B9 — Flatpaks cannot be baked into the image.**
`/var/lib/flatpak` follows Docker `VOLUME` semantics: unpacked from the *initial* image only, never refreshed. Workaround: `/usr/share/flatpak/preinstall.d/*.preinstall` + `flatpak preinstall -y` at boot (§8) — which means **first-boot network is required** for the app baseline.

**B10 — A Bottles prefix cannot ship in the image.**
It lives under `$XDG_DATA_HOME/bottles` → `~/.var/app/.../data/bottles`, per-user, in `$HOME`. Wine upstream: *"applications must be installed separately for each user… you can copy Wine prefixes."* Workaround: template tarball in `/usr/share/auros/`, extracted by a per-user `systemd --user` oneshot with a stamp file. Budget hundreds of MB **per user**.

**B11 — Bottles' Flathub manifest grants no home access at all.**
No `--filesystem=home`, no `--filesystem=host`. A user double-clicking an `.exe` in `~/Downloads` fails, and a Wine app "saving to Documents" saves *inside the bottle* (userdir has been sandboxed, not symlinked, since Bottles 2021.10.14). Workaround: provisioning script runs `flatpak override --user --filesystem="$HOME/WindowsApps"` and we train on one folder. Do **not** blanket-grant `--filesystem=home`; that permission set is our strongest safety claim.

**B12 — `vssadmin create shadow` does not exist on Win10/11 client, and WMIC is being removed.**
Current vssadmin reference lists seven subcommands, none of them `create shadow`. WMIC is gone from new 24H2/25H2 installs and the Aug 2026 preview update removes it from installed ones. Workaround: default path is `CreateFileW` with `FILE_SHARE_READ|WRITE|DELETE` + `FILE_FLAG_BACKUP_SEMANTICS` (covers ~95% of files, no elevation for the user's own data); VSS only as an opt-in escalation via `github.com/SmithOperatingSolutions/go-vss` (elevated, **64-bit only, refuses WOW64**); honest "N files were in use and were skipped" manifest otherwise.

**B13 — Writing the bootable USB from Windows is out of scope.**
Raw `\\.\PhysicalDriveN` writes, `FSCTL_LOCK_VOLUME`/`DISMOUNT`, `IOCTL_DISK_SET_DRIVE_LAYOUT_EX`, hand-rolled FAT32 ESP — irreversibly destructive on a machine we don't own. Workaround: we ship media, or the customer writes it with the tool they already have. Our exe stages a migration bundle as plain files to an ordinary external drive.

**B14 — Real-time GitHub Actions log output is not available.**
`GET /actions/jobs/{id}/logs` 404s while running and returns a 60s-lived 302 only after completion; community discussion #154834 is unanswered. Workaround (pick one, decide before writing the SSE code): (a) poll `GET /actions/runs/{run_id}/jobs` every 2–3 s and emit **step-level** transitions — coarse but zero extra infrastructure; (b) the workflow itself `tee`s into `curl` against an authenticated `/api/ingest` backed by a Durable Object — the only way to get line-level text live. **Ship (a) for v1.**

**B15 — Manual capture on a subscription is impossible.**
`capture_method` exists only under `payment_intent_data`, which is payment-mode only. Workaround for "bill when the build passes": `subscription_data.trial_period_days` at checkout, then `POST /v1/subscriptions/{id} -d trial_end=now -d proration_behavior=none`. For the one-time $79, payment-mode manual capture works but the authorization window is **4d18h (Visa MIT) to 7 days** — capture inside it or the PaymentIntent self-cancels.

**B16 — Compressed SSE buffers on Cloudflare.**
workerd PR #7390 open since 2026-09-16. Workaround: `Content-Encoding: identity` + `Cache-Control: no-transform` + a `: keepalive` comment every 15 s. Also: runtime updates land a few times a week and terminate in-flight requests after a 30 s grace period — emit `id:` lines and honour `Last-Event-ID`.

**B17 — Scheduled workflows on public repos auto-disable after 60 days of no *repository* activity.** The nightly's own green runs are not activity. Workaround: keepalive commit bump or external cron hitting `workflow_dispatch`.

**B18 — Making the GHCR package public is a manual, irreversible UI step.** Until done, `bootc switch` from a clean machine 401s and looks like a build bug. Also set `org.opencontainers.image.source` or the package won't link to the repo.

---

## CANONICAL SNIPPETS

### 1. `Containerfile` — FROM line
```dockerfile
# Containerfile
# == stable-20260915.2 == 44.20260915.2, Fedora 44, kernel 7.1.8-200.fc44.x86_64,
# KDE Plasma 6.7.5-1, bootc 1.16.10-1, x86_64 ONLY.
# MIRRORED into our own registry because ublue prunes GHCR manifests older than
# 90 days keeping only 7 tagged (clean.yml) -> upstream digest dies in <2 months.
FROM ghcr.io/auros/base-aurora:stable-20260915.2@sha256:911281f2aaa42bfd17532c5cef917aba8d7ac8c0faeb1c1edc6a43dc28d0d2f1

# During bring-up, before the mirror exists, this is the identical manifest:
# FROM ghcr.io/ublue-os/aurora:stable@sha256:911281f2aaa42bfd17532c5cef917aba8d7ac8c0faeb1c1edc6a43dc28d0d2f1
```

### 2. `system_files/etc/containers/policy.json` — signature enforcement
```json
{
    "default": [{ "type": "reject" }],
    "transports": {
        "docker": {
            "registry.access.redhat.com": [
                { "type": "signedBy", "keyType": "GPGKeys",
                  "keyPath": "/etc/pki/rpm-gpg/RPM-GPG-KEY-redhat-release" }
            ],
            "registry.redhat.io": [
                { "type": "signedBy", "keyType": "GPGKeys",
                  "keyPath": "/etc/pki/rpm-gpg/RPM-GPG-KEY-redhat-release" }
            ],
            "quay.io/toolbx-images": [
                { "type": "sigstoreSigned",
                  "keyPath": "/usr/lib/pki/containers/quay.io-toolbx-images.pub",
                  "signedIdentity": { "type": "matchRepository" } }
            ],
            "ghcr.io/ublue-os": [
                { "type": "sigstoreSigned",
                  "keyPaths": [
                      "/usr/lib/pki/containers/ublue-os.pub",
                      "/usr/lib/pki/containers/ublue-os-backup.pub"
                  ],
                  "signedIdentity": { "type": "matchRepository" } }
            ],
            "ghcr.io/auros": [
                { "type": "sigstoreSigned",
                  "keyPaths": [
                      "/usr/lib/pki/containers/ghcr.io-auros.pub",
                      "/usr/lib/pki/containers/ghcr.io-auros-backup.pub"
                  ],
                  "signedIdentity": { "type": "matchRepository" } }
            ],
            "": [{ "type": "reject" }]
        },
        "docker-daemon":      { "": [{ "type": "insecureAcceptAnything" }] },
        "atomic":             { "": [{ "type": "insecureAcceptAnything" }] },
        "containers-storage": { "": [{ "type": "insecureAcceptAnything" }] },
        "dir":                { "": [{ "type": "insecureAcceptAnything" }] },
        "oci":                { "": [{ "type": "insecureAcceptAnything" }] },
        "oci-archive":        { "": [{ "type": "insecureAcceptAnything" }] },
        "docker-archive":     { "": [{ "type": "insecureAcceptAnything" }] },
        "tarball":            { "": [{ "type": "insecureAcceptAnything" }] }
    }
}
```
> **Deliberate divergence from aurora:** the catch-all `""` docker entry is `reject`, not `insecureAcceptAnything`. That is the whole point. It will break any unpinned pull from an unlisted registry — accept that. Generate a **backup key now**; `keyPaths` is plural so rotation is not a flag day.

`system_files/etc/containers/registries.d/auros.yaml`:
```yaml
docker:
  ghcr.io/auros:
    use-sigstore-attachments: true
```
> Without this the attachment is never fetched and verification cannot succeed. Built-in default is to not read attachments. One scope may appear in at most one file in `registries.d`.

### 3. Rechunk step — **chunkah**, not hhd-dev/rechunk
```yaml
      # This is THE step that makes deletions real bytes. Without it every
      # `dnf5 remove` and `rm -rf` is an overlayfs whiteout and nobody's pull
      # gets smaller. Run it AFTER all removals, immediately before push.
      - name: Rechunk image with chunkah
        run: |
          set -xeuo pipefail
          CHUNKAH_CONFIG_FILE="$(mktemp)"
          CHUNKAH_OUTPUT_DIR="$(mktemp -d ./auros_chunkah_XXXXXX)"
          trap 'rm -f "${CHUNKAH_CONFIG_FILE}"; rm -rf "${CHUNKAH_OUTPUT_DIR}"' EXIT

          # Carries the base labels forward. chunkah DROPS them otherwise,
          # including containers.bootc=1, which bootc requires.
          podman inspect "${IMAGE_NAME}:${TAG}" > "${CHUNKAH_CONFIG_FILE}"

          podman run --rm \
            --mount=type=image,src="${IMAGE_NAME}:${TAG}",target=/chunkah \
            -v "${CHUNKAH_CONFIG_FILE}:/chunkah-config.json:ro,Z" \
            -v "${CHUNKAH_OUTPUT_DIR}:/run/out:Z" \
            quay.io/coreos/chunkah:latest \
            build \
              --verbose \
              --compressed \
              --max-layers 128 \
              --prune /sysroot/ \
              --label ostree.commit- --label ostree.final-diffid- \
              --config /chunkah-config.json \
              --output oci:/run/out/chunked

          CHUNKED="$(podman pull "oci:${CHUNKAH_OUTPUT_DIR}/chunked")"
          podman tag "${CHUNKED}" "${IMAGE_NAME}:${TAG}"

      - name: Assert the rechunk preserved bootc-ness
        run: |
          set -euo pipefail
          podman inspect "${IMAGE_NAME}:${TAG}" \
            | jq -e '.[0].Labels["containers.bootc"] == "1"' >/dev/null
          podman run --rm --entrypoint bootc "${IMAGE_NAME}:${TAG}" container lint
```
> **REJECTED alternative, for the record:** `hhd-dev/rechunk@5fbe1d3a639615d2548d83bc888360de6267b1a2` (v1.2.4). Rejected because (a) unmaintained since 2025-10-11, (b) its pinned container tags expire after 90 days per its own FIXME, (c) requires rootful podman + `runs-on: ubuntu-24.04`, and (d) its `1_prune.sh` merges `/etc/passwd`,`/etc/group` into `/usr/lib/` (nss-altfiles), which **black-screens and makes unbootable** any machine that later rebases off a rechunked image — aurora ships `rechunker-group-fix.service` specifically to repair this. chunkah and `build-chunked-oci` have none of these problems.

### 4. KVM enable — GitHub Actions
```yaml
      # /dev/kvm EXISTS on standard free 2-vCPU Linux runners since the
      # 2024-01-17 runner update. It is gated by device permissions only.
      # `sudo usermod -aG kvm $USER` DOES NOT WORK -- supplementary groups are
      # resolved at login and the already-running runner shell never sees it.
      - name: Enable KVM group perms
        run: |
          echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules
          sudo udevadm control --reload-rules
          sudo udevadm trigger --name-match=kvm

      - name: Assert KVM is usable (do not let QEMU be the probe)
        run: |
          set -euo pipefail
          test -w /dev/kvm || { echo 'FATAL: /dev/kvm not writable'; ls -l /dev/kvm; exit 1; }
          echo "ok: /dev/kvm writable"

      - name: Install QEMU (NOT preinstalled on ubuntu-24.04 or 26.04)
        run: |
          sudo apt-get update
          sudo apt-get install -y --no-install-recommends \
            qemu-system-x86 qemu-utils ovmf
```
> This belongs **only in the vm-test job**. `bootc-image-builder` needs privileged podman, not KVM, so the publishing path stays off the KVM dependency entirely.

### 5. Free disk space
```yaml
      # MUST run BEFORE actions/checkout (its own README says so).
      # Frees ~36 GB: dotnet ~2, android ~9, haskell ~5.2, codeql ~5.4,
      # docker-images ~3.2, large-packages ~3.1, cached-tools ~8.3.
      # Baseline free on / is ~25-29 GB (NOT the 14 GB in GitHub's table --
      # that is the temp disk). Post-cleanup ~51 GB. Our peak is ~25-30 GB,
      # so this step is a HARD DEPENDENCY, not an optimization.
      - name: Maximize build space
        uses: ublue-os/remove-unwanted-software@cc0becac701cf642c8f0a6613bbdaf5dc36b259e # v9
        with:
          remove-codeql: true
          remove-swapfile: false   # reclaiming the 4 GB swapfile OOM-kills
                                   # osbuild with an error that never names
                                   # this action. Leave it.

      - name: Disk before/after (so a runner-image change surfaces here)
        run: df -h
```

### 6. cosign sign
```yaml
      - name: Install Cosign
        uses: sigstore/cosign-installer@6f9f17788090df1f26f669e9d70d6ae9567deba6 # v4.1.2
        if: github.event_name != 'pull_request' && github.ref == format('refs/heads/{0}', github.event.repository.default_branch)
        with:
          # PIN EXACTLY. --new-bundle-format is deprecated-and-hidden as of
          # v3.1.2 ("this will be the only supported format in future versions").
          # When it is removed our signatures go invisible again, silently.
          cosign-release: 'v3.1.3'

      - name: Sign container image
        if: github.event_name != 'pull_request' && github.ref == format('refs/heads/{0}', github.event.repository.default_branch)
        env:
          COSIGN_EXPERIMENTAL: false
          COSIGN_PRIVATE_KEY: ${{ secrets.SIGNING_SECRET }}
          DIGEST: ${{ steps.push-image.outputs.digest }}
        run: |
          # --new-bundle-format=false: cosign 3.x defaults to an OCI 1.1 referrer
          #   that containers/image (podman, skopeo, bootc, rpm-ostree) cannot see
          #   and that GHCR does not serve via /referrers.
          #   https://github.com/containers/container-libs/issues/388
          #   https://github.com/coreos/rpm-ostree/issues/5509
          # --use-signing-config=false: also defaults true in 3.1.x. Passing only
          #   the first flag is the common half-fix.
          cosign sign -y --new-bundle-format=false --use-signing-config=false \
            --key env://COSIGN_PRIVATE_KEY \
            "${IMAGE_REGISTRY}/${IMAGE_NAME}@${DIGEST}"

      # MANDATORY. `cosign verify` passes on BOTH formats and therefore cannot
      # detect the regression that shipped Bluefin ~3 months of unsigned images.
      # Assert at the registry level that the LEGACY tag exists.
      - name: Assert legacy signature tag is discoverable
        env:
          DIGEST: ${{ steps.push-image.outputs.digest }}
        run: |
          set -euo pipefail
          SIG_TAG="${DIGEST/:/-}.sig"
          skopeo inspect --raw "docker://${IMAGE_REGISTRY}/${IMAGE_NAME}:${SIG_TAG}" > /dev/null
          echo "ok: ${SIG_TAG} present"
```
> Port aurora's **ephemeral-tag-then-sign-then-push** ordering: push to a throwaway `staging` tag, sign the digest, then re-tag. It exists specifically so a CI flake can never publish an unsigned image (containers/podman#27796).

### 7. Cross-repo dispatch
```yaml
# --- repo A: auros/image ---
      - name: Mint a scoped installation token for repo B
        id: app-token
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ vars.DISPATCH_APP_ID }}
          private-key: ${{ secrets.DISPATCH_APP_PRIVATE_KEY }}
          owner: ${{ github.repository_owner }}
          repositories: auros-site      # narrow. App installed on B with
                                        # repository permission Contents: write.
      - name: Dispatch to repo B
        env:
          GH_TOKEN: ${{ steps.app-token.outputs.token }}
        run: |
          set -euo pipefail
          gh api --method POST -H "Accept: application/vnd.github+json" \
            /repos/${{ github.repository_owner }}/auros-site/dispatches \
            -f event_type='image-published' \
            -F 'client_payload[digest]=${{ needs.build.outputs.digest }}' \
            -F 'client_payload[tag]=stable'

# --- repo B: auros-site/.github/workflows/on-dispatch.yml ---
# on:
#   repository_dispatch:
#     types: [image-published]
```
> The default `GITHUB_TOKEN` **cannot** do this — not because of recursion prevention (`repository_dispatch` is explicitly exempt and always creates runs) but because the token is scoped to the repo containing the workflow. Prefer a scoped App installation token over a classic PAT with blanket `repo`.

### 8. Flatpak baseline (goes with the above)
`system_files/usr/share/flatpak/preinstall.d/00-auros-base.preinstall`:
```ini
[Flatpak Preinstall org.mozilla.firefox]
Branch=stable
IsRuntime=false

[Flatpak Preinstall org.libreoffice.LibreOffice]
Branch=stable
IsRuntime=false

[Flatpak Preinstall com.github.tchx84.Flatseal]
Branch=stable
IsRuntime=false
```
Plus, in the Containerfile, override aurora's 22-flatpak Brewfile and drop its Bazaar preinstall:
```dockerfile
RUN rm -f /usr/share/flatpak/preinstall.d/bazaar.preinstall && \
    printf '# Auros-managed flatpak set\n' > /usr/share/ublue-os/homebrew/system-flatpaks.Brewfile && \
    systemctl disable tailscaled.service || true
```

### 9. KDE Windows-like layout
`system_files/usr/share/plasma/look-and-feel/com.auros.desktop/contents/layouts/org.kde.plasma.desktop-layout.js`:
```javascript
// Runs ONCE, at a user's first Plasma login, when they have no containments.
// Resolution order (ShellCorona::loadDefaultLayout):
//   <lnf>/contents/layouts/org.kde.plasma.desktop-prelayout.js
//   <lnf>/contents/layouts/org.kde.plasma.desktop-layout.js   <- this file
//   <shell pkg>/contents/layout.js
// There is NO plasma-apply-layoutscript. This file is the mechanism.
loadTemplate("com.auros.taskbar")

var desktopsArray = desktopsForActivity(currentActivity());
for (var j = 0; j < desktopsArray.length; j++) {
    desktopsArray[j].wallpaperPlugin = 'org.kde.image';
}
```
`system_files/usr/share/plasma/layout-templates/com.auros.taskbar/contents/layout.js`:
```javascript
// Windows 11 shape: full-width opaque bottom bar; Start + pinned apps centered
// by two expanding panelspacers; tray + clock + show-desktop on the right.
var panel = new Panel
panel.location   = "bottom"
panel.height     = 2 * Math.ceil(gridUnit * 2.5 / 2)   // even px; the UI only shows even
panel.lengthMode = "fill"        // fill | fit | custom
panel.alignment  = "center"      // left | center | right
panel.hiding     = "normal"      // normal | autohide | dodgewindows | windowsgobelow
panel.floating   = false         // Win11 taskbar is edge-anchored
panel.opacity    = "opaque"      // adaptive | opaque | translucent

var leftSpacer = panel.addWidget("org.kde.plasma.panelspacer")
leftSpacer.currentConfigGroup = ["General"]
leftSpacer.writeConfig("expanding", true)

var kickoff = panel.addWidget("org.kde.plasma.kickoff")
kickoff.currentConfigGroup = ["General"]
kickoff.writeConfig("icon", "start-here-kde-symbolic")
kickoff.writeConfig("menuLabel", "")
kickoff.writeConfig("favoritesDisplay", 0)        // 0 = Grid   (Win11 "Pinned")
kickoff.writeConfig("applicationsDisplay", 1)     // 1 = List   (Win11 "All apps")
kickoff.writeConfig("primaryActions", 0)          // power buttons in footer
kickoff.writeConfig("showActionButtonCaptions", true)
kickoff.writeConfig("alphaSort", true)
kickoff.writeConfig("favorites",
    "preferred://browser,org.kde.dolphin.desktop,org.libreoffice.LibreOffice.desktop,systemsettings.desktop")
kickoff.writeConfig("systemFavorites", "suspend,reboot,shutdown")

var tasks = panel.addWidget("org.kde.plasma.icontasks")
tasks.currentConfigGroup = ["General"]
tasks.writeConfig("launchers",
    "applications:org.kde.dolphin.desktop,preferred://browser,applications:org.libreoffice.LibreOffice.desktop")
tasks.writeConfig("groupingStrategy", 1)          // group by program
tasks.writeConfig("onlyGroupWhenFull", false)     // Win11 always groups
tasks.writeConfig("showOnlyCurrentDesktop", false)
tasks.writeConfig("minimizeActiveTaskOnClick", true)
tasks.writeConfig("middleClickAction", 2)         // new instance
tasks.writeConfig("fill", false)

var rightSpacer = panel.addWidget("org.kde.plasma.panelspacer")
rightSpacer.currentConfigGroup = ["General"]
rightSpacer.writeConfig("expanding", true)

panel.addWidget("org.kde.plasma.systemtray")
var clock = panel.addWidget("org.kde.plasma.digitalclock")
clock.currentConfigGroup = ["Appearance"]
clock.writeConfig("showDate", true)
clock.writeConfig("dateFormat", "shortDate")
panel.addWidget("org.kde.plasma.showdesktop")
```
`system_files/usr/share/plasma/look-and-feel/com.auros.desktop/contents/defaults`:
```ini
[kdeglobals][KDE]
widgetStyle=Breeze
SingleClick=false
DndBehavior=MoveIfSameDevice

[kdeglobals][General]
ColorScheme=BreezeLight
accentColorFromWallpaper=false

[kdeglobals][Icons]
Theme=breeze

[plasmarc][Theme]
name=default

[kcminputrc][Mouse]
cursorTheme=breeze_cursors

[kwinrc][org.kde.kdecoration2]
library=org.kde.breeze
theme=Breeze
ButtonsOnLeft=M
ButtonsOnRight=IAX

[kwinrc][Windows]
FocusPolicy=ClickToFocus
NextFocusPrefersMouse=false

[ksplashrc][KSplash]
Theme=com.auros.desktop
```
Selected for everyone via `system_files/etc/xdg/kdeglobals`:
```ini
[KDE]
LookAndFeelPackage=com.auros.desktop
DefaultLightLookAndFeel=com.auros.desktop
DefaultDarkLookAndFeel=com.auros-dark.desktop
AutomaticLookAndFeel=false
SingleClick=false
DoubleClickInterval=400
DndBehavior=MoveIfSameDevice
```
> Appearance keys go in the LnF `defaults`, **not** in `/etc/xdg/kdeglobals`, because startplasma prepends `~/.config/kdedefaults` to `XDG_CONFIG_DIRS` and rewrites it from the active Global Theme at every session start. Policy keys go in `/etc/xdg/kdeglobals` with `[$i]`.

### 10. Kiosk restriction keys
`system_files/etc/xdg/kdeglobals` — **locked** profile:
```ini
[KDE Action Restrictions][$i]
shell_access=false
run_command=false
plasma/plasmashell/unlockedDesktop=false
plasma-desktop/scripting_console=false
ghns=false
plasma-desktop/add_activities=false
editable_desktop_icons=false
action/kwin_rmb=false

[KDE][$i]
LookAndFeelPackage=com.auros.desktop
SingleClick=false
```
**kiosk** profile adds:
```ini
[KDE Action Restrictions][$i]
run_desktop_files=false
plasma/allow_configure_when_locked=false
plasma/containment_actions=false
movable_toolbars=false
# logout needs BOTH: KDE checks authorizeAction("logout") -> action/logout
# AND authorize("logout"). Setting one leaves logout available.
logout=false
action/logout=false
action/lock_screen=false
action/start_new_session=false
action/switch_user=false
action/options_configure=false
action/options_configure_keybinding=false
action/options_configure_toolbars=false
action/options_configure_notifications=false
action/help_report_bug=false
action/help_about_kde=false
action/switch_application_language=false
action/openwith=false
action/editfiletype=false
action/show_dot=false
action/executeshellcommand=false

[KDE Resource Restrictions][$i]
autostart=false
```
`system_files/etc/kde5rc` — hide System Settings pages (**kde5rc is correct on KF6; `/etc/kde6rc` does not exist**):
```ini
[KDE Control Module Restrictions][$i]
kcm_users=false
kcm_kwinoptions=false
kcm_kwindecoration=false
kcm_kwinrules=false
kcm_kwin_virtualdesktops=false
kcm_activities=false
kcm_lookandfeel=false
kcm_desktoptheme=false
kcm_colors=false
kcm_style=false
kcm_splashscreen=false
kcm_autostart=false
kcm_sddm=false
kcm_kded=false
```
> Only these keys are **provably** read by Plasma 6 code: `logout`/`action/logout`, `action/start_new_session`, `action/lock_screen`, `run_command`, `shell_access`, `action/kwin_rmb`, `plasma/plasmashell/unlockedDesktop`, `plasma-desktop/scripting_console`. Everything else above is from the official key list but is KDE4-era in origin — **verify each in a VM before a customer sees it**.

---

## HONEST CLAIMS

Exact sentences. These are the only versions approved for the website.

**One-restart install**
> "On most machines we can set the next restart to boot our installer for you. On some older laptops the firmware ignores that, and you'll need to press a key at startup — we show you which one on screen before we begin."

*Why not stronger:* `bcdedit /set {fwbootmgr} bootsequence {GUID}` is documented only by composition, is firmware-dependent on 2012–2018 hardware (several OEM firmwares clear BootNext or re-enumerate USB entries each boot, staling the GUID), and legacy BIOS/CSM machines have no `{fwbootmgr}` object at all. `shutdown /r /fw` goes to the **firmware setup UI**, not to a device — it is a fallback, not the feature. BitLocker adds a second precondition (`manage-bde -protectors -disable C: -rc 1`, elevated).

**.exe support**
> "Some Windows programs run on Auros through a compatibility layer. We check every program on your list against the WineHQ Application Database before we quote, and we tell you in writing which ones will not run."

Approved companion sentences:
> "Microsoft Office 2021 and Microsoft 365 do not run. We move you to LibreOffice and Office on the web."
> "Adobe Creative Cloud does not run. We do not migrate Adobe users."
> "Any program that installs a Windows hardware driver — most printer and scanner utilities, most licence dongles, and games with anti-cheat — cannot run, on Auros or in a Windows virtual machine."

**Never write:** "Runs your Windows apps." · "Full .exe support." · "Office works through WINE." · "Sandboxed Windows apps" without the qualifier that WINE provides no isolation and Bottles' Flatpak grants `--allow=devel` and `--device=all`.

*Why:* WineHQ's own definitions — Gold is *"with workarounds"*, Silver is *"has some problems for which there are no workarounds."* Office 365 Business, Office 365 ProPlus and Office 2021 Pro Plus are all **Garbage**. Every Photoshop CC 2019–2024 is **Silver**, several on 2-result samples and two-year-stale Wine versions, with no entry at all for 2025/2026.

**What migrates**
> "We move your files — Desktop, Documents, Downloads, Pictures, Music and Videos — plus your Wi-Fi networks, your printers' network addresses, and your Firefox bookmarks, history and saved passwords. From Chrome and Edge we move bookmarks and history only: their saved passwords, cookies and payment details are locked to the old computer by Microsoft and Google and cannot be moved by anyone. We give you a written list of every installed program so nothing is a surprise."

Approved companion sentences:
> "Files stored only in OneDrive and not downloaded to the laptop are not copied. We show you exactly how many there are and how large before we start, and you choose."
> "If a file is open in another program when we copy, we skip it and list it for you rather than copy a damaged version."

*Why:* DPAPI is documented as *"the encryption and decryption must be done on the same computer"*; App-Bound Encryption (Chrome/Edge 127+, `v20`) covers cookies, passwords **and** payment data, and Microsoft's own Edge policy doc names portability between computers as the only reason to disable it. Firefox genuinely does migrate — `logins.json` + `key4.db` travel together. Nothing about a Windows print driver survives; CUPS deprecated raw queues in 2.2 and drivers in 2.3.

**Bytes saved by pruning**
> "Our image is smaller than the stock one. We publish the exact download size of every build so you can see it yourself."

If a number is required, the only defensible one today:
> "Removing the CJK font set alone cuts about 157 MiB from the download."

*Why not a bigger number:* The 3.71 GB base is dominated by the desktop, not by the things we can safely remove. The 22 preinstalled Flatpaks are **not in the image** — they are fetched at first boot — so dropping them saves first-boot bandwidth, not download size, and should be described that way. And no savings figure is real until measured on the **pushed manifest after rechunk**: `skopeo inspect docker://... | jq '[.LayersData[].Size] | add'`. `podman image inspect .Size` is the uncompressed on-disk figure, 2–3× larger, and must never appear in a claim.

---

## OPEN QUESTIONS — discover empirically in CI

1. **Does aurora use the ostree backend with bootupd static GRUB configs?** greenboot's rollback depends entirely on `08_greenboot.cfg` under `/usr/lib/bootupd/grub2-static/configs.d/` setting `boot_counter`. If aurora is composefs/UKI, there is no boot-entry counting and no `boot-complete` equivalent — **automatic rollback silently does not exist**. Test: build, boot a VM, deliberately fail a required health check 3×, assert `grub2-editenv /boot/grub2/grubenv list` shows `boot_counter` counting down and then `-1`. Nothing in any dossier establishes this for aurora.
2. **Does installing greenboot on aurora work at all?** `greenboot` still carries `Requires: rpm-ostree` (present on aurora, fine) but nobody has verified the unit set (`greenboot-healthcheck.service`, `greenboot-set-rollback-trigger.service`, `greenboot-success.target` — the rs rewrite, ≥0.16.0) coexists with `uupd`. Also unverified: whether a greenboot-triggered `bootc rollback` and an armed `uupd.timer` fight each other.
3. **Does our `"": reject` policy default break anything on a running machine?** It diverges from aurora's shipped `insecureAcceptAnything`. Unknown blast radius on distrobox/toolbox pulls, `quay.io/fedora/*`, Homebrew's `ghcr.io/ublue-os/brew`, and the Flatpak OCI path. Test in the VM before it ships.
4. **Is `/etc/containers/policy.json` the right home given bootc's 3-way `/etc` merge?** A user edit persists across updates and would silently disable enforcement. Whether containers/image reads a `/usr/share/containers/policy.json` fallback we could use instead is not established by any dossier.
5. **Actual measured savings.** Nobody has run `skopeo inspect | jq '[.LayersData[].Size]|add'` on a rechunked Auros image versus the base. Every number in HONEST CLAIMS is provisional until this runs. Also unmeasured: whether chunkah's re-layering *increases* size relative to aurora's existing chunkah layout for users doing delta updates.
6. **Does a `dnf5 remove` of anything meaningful survive the versionlocks?** The qt6/plasma lock exists because partial upgrades black-screened the desktop. What we can actually remove without tripping it is unknown. Run `dnf5 remove --assumeno <target>` in CI and read the transaction table before committing to any removal list.
7. **F44 → F45.** `main` already pins `kinoite:45` and `:testing` is `45.20260920.5`. The stable rebase will land as an ordinary `:stable` digest bump with **no separate tag warning**. We need a gate — probably a CI assertion on the base's `org.opencontainers.image.version` major — but nobody has established how much of our layer survives the jump.
8. **Does the LnF layout script actually fire on aurora?** It only runs for users with **no existing containments**, and aurora may already seed a layout via its own Breeze-derived LnF. Untested. Also untested: our migration path for users created under image v1 when v2 changes the taskbar (`/etc/skel` and the LnF script both only help *new* users).
9. **Which kiosk keys in §10 beyond the 8 verified ones are still honoured by Plasma 6.7.5?** Half the official key list is KDE3/4-era. Needs a per-key VM check.
10. **SSE on Workers under a real 20-minute build.** Unmeasured: whether identity-encoded SSE actually flushes per event through Cloudflare today, how often the runtime-update 30 s termination actually fires, and whether `Last-Event-ID` reconnection loses step transitions. Also: GitHub installation rate-limit burn when N viewers each open a poller — a Durable Object fan-out may be mandatory, not optional.
11. **Does step-level polling (`/actions/runs/{id}/jobs`) feel like a "live build console" to a buyer, or does it need the `tee`-to-ingest path?** Product question that only a prototype answers.
12. **32-bit Windows in the field.** A 2012–2018 school laptop may run 32-bit Win10; `go-vss` refuses to start on 32-bit and under WOW64. Unknown what fraction of the target fleet that is — affects whether we ship a 386 build at all.
13. **`{fwbootmgr} bootsequence` success rate on actual 2012–2018 OEM firmware.** The whole one-restart claim's strength depends on a number nobody has. Instrument it: log outcome per machine from the first ten installs.
14. **Does `bootc-image-builder`'s `--rootfs xfs` + our `config.toml` produce a bootable installer ISO from an aurora-derived image?** Every dossier example is CentOS/Fedora-bootc, none is ublue-derived. Also: the `2 × base container size` rootfs floor on a 3.7 GB base.