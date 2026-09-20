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
