# What the merged AurOS took from LATHE

**Date:** 2026-10-04. The lead's decision: the **engine** is the from-scratch implementation at the
repository root (`build/forge` building Ubuntu-based images from `profiles/*.profile`, AurBridge,
the bootchain). LATHE stays here, in `lathe/`, as the archive. Nothing in `lathe/` was deleted or
changed except this file.

Four things were adopted, ported into the engine and tested there. The rest was deliberately left
behind, and why is written down below so that nobody has to re-derive it.

---

## Adopted, and where it lives now

| LATHE | Now | What changed in the port |
|---|---|---|
| The per-organisation **recipe** (`auros-recipes`: `recipe.yaml` → `Containerfile`) | `recipes/lib/recipe.mjs`, `recipes/bin/auros-recipe`, `recipes/examples/`, `recipes/test/` | Compiles to a forge profile (`inherit="desktop"` + overrides) instead of a Containerfile. One dependency-free ES module that runs in node and in a browser (a future configurator can import it as-is). Its own strict YAML-subset parser instead of a YAML library. |
| D28: the generated artefact is **committed** next to its source, and CI fails on drift | `profiles/example-*.profile`, checked by `recipes/test/compile.test.mjs` | Same rule. The compiled profile is what `build/forge` builds; a stale one is a red test. `auros-recipe compile` refuses to overwrite a profile it did not generate. |
| D38: **every field must change the image** (`test/differ.test.ts`) | `recipes/test/fields.test.mjs`, `recipes/test/forge.test.mjs` | Stronger: a probe per field (and a test that every field has one), LATHE's inverse swap across the three examples, plus a parse of `build/forge` itself so the compiler can only write keys forge reads — and never the four keys forge reads and then nothing on the machine does. |
| D34: every check watched failing (`scripts/prove-red.mjs`) | `recipes/test/prove-red.mjs` | 14 mutations, each required to redden the test *named* for it, in a scratch tree. |
| The **honesty gate** (`tools/honesty-gate.mjs`, its corpus) | `tools/honesty-gate.mjs`, `tools/honesty-gate.test.mjs` | Scans `website/` (HTML as a reader sees it, and the site's JS), `docs/TRY-IT.md`, `README.md`. New: numbers may cite `data-source="path"` and must appear in it; licence claims are checked against whatever `./LICENSE` says (MIT here, all-rights-reserved in LATHE — both directions tested); "works on every PC" is refused. The corpus is ported and extended (43 must fire, 29 must stay quiet). |
| **`hardware/compat.tsv`** as the only record of real hardware, and `tools/compat-lint.mjs` | `hardware/compat.tsv`, `hardware/README.md`, `tools/compat-lint.mjs`, `tools/compat-lint.test.mjs` | Rules unchanged. Still zero rows. The honesty gate reads it: first-person claims of hands-on experience are refused until it has a `physical` row. |
| **One `./verify`**, and D37's meta-test | `./verify`, `tools/verify-meta.test.mjs` | Runs the recipe suites, prove-red, every profile through `forge resolve`, the honesty gate and its corpus, the compat lint, `bash -n`/`sh -n` and `shellcheck -S error` on every shell script, and the fast C unit tests through `tools/unit-all.sh`; says SKIP, with what is needed, for everything else. The meta-test reproduces D37 (a piped suite reports PASS) and a second trap found while writing it (below). |

## The recipe fields, one by one

Every LATHE field either maps onto something the engine really does, or is **refused with a
sentence** (`NOT_IN_THE_ENGINE` in `recipe.mjs`). None is recorded-and-ignored: that was D38.

| LATHE field | In the engine |
|---|---|
| `schema`, `name`, `for` | `name` → `profile_id` (and the file name); `for` → `profile_description` (shown by `forge list`) |
| `organisation.display_name` | `brand_name`, `profile_name` (os-release, `/etc/issue`) |
| `organisation.helpdesk`, `.logo` | **refused** — no help screen or logo surface exists yet |
| `hardware.*` | **refused** — the image is the same on every machine; `hardware/compat.tsv` records real machines |
| `language`, `other_languages` | `locale`, `extra_locales`, plus `language-pack-*` and `fonts-noto-core` for non-Latin scripts in `packages_extra` |
| `keyboard`, `second_script`, `switch_scripts_with` | `keyboard_layout`, `keyboard_variant`, and a new **`keyboard_options`** key (forge now writes `XKBOPTIONS`; `src/aurwl` already read it). LATHE's catalogue named three XKB variants that do not exist (`in:mar-inscript`, `in:hin-inscript`, `in:ben-inscript`); they are corrected and checked against libxkbcommon |
| `timezone` | `timezone` |
| `apps` | the desktop's `packages_files` (kept or dropped), `software_store`, the browser mechanism, or `packages_apps`. Names with no honest Ubuntu 24.04 package are refused by name (Chrome, Chromium, Thunderbird — a snap stub — VS Code, Podman Desktop, Scratch 3) |
| `prune.keep_only_the_apps_above`, `also_keep`, `also_remove` | real removals from `packages_files` / `packages_hardware`; `also_keep` only with keep-only, `also_remove` only without (the D38 finding); groups the desktop does not contain (games, developer tools, …) are refused as "nothing to remove" |
| `prune.must_remove_at_least` | **refused** — forge does not measure removals; a floor checked against the plan cannot go off |
| `policy` (open/managed/locked/kiosk) | the `allow_*` keys, `kiosk_mode`, `allowed_apps` (aurshell's allow-list), `shell_archetype=locked` for kiosk |
| `desktop.layout` | `shell_archetype` — the engine's names (dock, rail, taskbar, tiles, workbench); LATHE's words are answered with the nearest |
| `desktop.can_install_apps`, `can_reach_a_terminal` | `allow_user_install`, `allow_tty`; plus engine-native `can_choose_wifi` → `allow_network_change` and `screen_off_minutes` |
| other `desktop.*` booleans | **refused** — no engine knob |
| `kiosk.*` | only `kiosk.starts` (which program opens first: the order of `allowed_apps`); `opens`, `allowed_sites`, session wipe, daily restart **refused** — not in the engine |
| `windows_apps` | **refused** — AurOS does not run Windows programs |
| `theme.*` | `theme: <name>` of an engine theme; preset, accent, text scale, cursor **refused** (a custom accent would skip `tools/contrast.c`) |
| `updates.install_between` | **refused** — exactly the D38 field; Ubuntu's apt timer decides, and AurOS has no setting |
| `first_boot_message`, `size_budget_gb`, `approved_by` | **refused** — nothing would show, enforce or need them |

LATHE's refusals by design are kept unchanged: no `from`/`base`/`digest`, no version pins, no
kernel or boot arguments, no code, no "skip checks", no secrets.

## Deliberately not adopted

- **The bootc/ostree/Fedora base (`auros-base`).** Superseded by the engine's Ubuntu 24.04 image,
  which boots today with Secure Boot on through Microsoft-signed shim, and by `auros-bootchain`,
  which keeps kernel/shim/grub updates booting. LATHE's base was one determinism bug from its first
  gate and had never booted a customer recipe.
- **The Go installer (`auros-installer`).** Superseded by AurBridge + `aurstage`, which is further
  along: the whole install and "put Windows back" run end to end on a synthetic machine, with a
  power-cut test at every named dangerous instant.
- **The Containerfile handover and the nightly rebuild/propagation workflows.** The engine builds
  with `build/forge`; the committed `.profile` plays the role the committed Containerfile did.
  Every workflow is parked; the gate's `cited-workflow-schedule` rule refuses a cadence claimed for one.
- **`auros-web` (Astro site, configurator, order Worker, pricing).** `website/` is being rewritten
  by another agent. `recipe.mjs` exports `OPTIONS`, `validate`, `emitYaml` and `compile` so a
  configurator can be built on it later; none was built here.
- **`tools/gate.mjs` (the publish gate), `watchdog.mjs`, `workflow-lint.mjs`, `claims-evidence.mjs`,
  `content-commands.mjs`, the CLAIMS.md freshness check.** Each reads LATHE-specific artefacts
  (bootc digests, GHCR, its repos, `CLAIMS.md`, `DECISIONS.md`) that the engine does not have.
- **`licence-consistency.mjs` and LATHE's licence position.** LATHE is all rights reserved
  (D30/D31); the root `LICENSE` is **MIT**. The gate checks claims against whichever file is there,
  so this is a decision for the owner, not for a tool — see the note below.
- **`capture-compat.sh` and `quote-from-compat.mjs`** lived in `auros-base`, which is not in this
  repository. Rows are written by hand until they are rebuilt on this engine (`hardware/README.md`).
- **The bootc-specific honesty rules** (`multi-rollback`, `winapps`).

## Found while porting — for whoever reads this next

1. **The engine has its own D38 fields.** `update_channel`, `enrollment_url`, `telemetry` and
   `auto_login` are read by `build/forge`, written into `/etc/auros/policy.conf`, and read by nothing
   on the machine; `wallpaper_style` is set in every profile and read by nothing at all. The recipe
   compiler never writes them, and `recipes/test/forge.test.mjs` pins both lists so the day one of
   them becomes real, a test says so.
2. **`profiles/office.profile` asks for `thunderbird`**, which on Ubuntu 24.04 is a snap stub; the
   build removes snapd. The image would ship with no mail program and no error.
3. **A `node --test` started inside another `node --test` runs nothing and exits 0**
   ("run() is being called recursively … skipping running files"). `./verify` therefore unsets
   `NODE_TEST_CONTEXT`, prove-red refuses a baseline that ran zero tests, and the meta-test
   reproduces the trap so the fix cannot be removed quietly. D37's lesson again, in a new shape.
4. **The licence.** LATHE's owner decision (D30, "proprietary, all rights reserved") and the root
   `LICENSE` (MIT) disagree. The honesty gate currently enforces MIT, because that is the file.
