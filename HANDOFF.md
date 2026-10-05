# HANDOFF — AurOS, merged (2026-10-05)

Read this, then `README.md`, then `lathe/ADOPTED.md`. `HANDOFF-TRIAGE.md` asked "which codebase?";
this file is the answer and replaces it.

## The decision that was made

The owner asked for the best parts of both codebases in one finished product. The call:

- **Engine = the from-scratch implementation** (repo root). It is the one that boots, installs, puts
  Windows back and survives power cuts today, with transcripts. LATHE's bootc/Fedora base never got
  past its boot checks (B11/B12) and its Go installer never passed Gate 3, and both live in other
  repositories. Rebuilding the working half on the unfinished half would have thrown away the
  evidence.
- **From LATHE, the parts that make it a product and keep it honest:** per-organisation recipes
  (`recipes/`), the honesty gate, `hardware/compat.tsv`, one `./verify` that cannot go green over a
  failure, the schools/nonprofits business (prices from `lathe/docs/SPEC.md`). LATHE's nightly
  rebuild pipeline was **not** adopted, so nothing claims nightly rebuilds; the image takes Ubuntu's
  security updates itself, kernel and boot chain included (`rootfs/usr/lib/auros/bootchain`).

## What was done this session

1. **Merged** — `recipes/` (dependency-free `recipe.mjs` used by the CLI *and* the website's
   configurator), `tools/honesty-gate.mjs`, `tools/compat-lint.mjs`, `hardware/`, `./verify`,
   `forge resolve`. Three example recipes compiled to `profiles/example-*.profile` with a drift test.
2. **Tested everything that can be tested without a real PC** in a cloud container: toolchain
   (`tools/container-deps.sh`), every C unit test (`tools/unit-all.sh`), the image built from
   scratch, and every QEMU end-to-end test (`tools/e2e-all.sh`). Results and red-proofs:
   `docs/results/2026-10-container/` (`SUMMARY.md`, `red/`).
3. **Adversarial review, three rounds** — the recipe/gate port (10 defects, among them a policy value
   that compiled to a fully open machine and a kiosk field that changed nothing), the test harness
   (an orphaned compositor client spinning forever), and the website (claims that were not true:
   browser-password unlock that does not exist yet, Firefox when the test build ships GNOME Web,
   "fast" with nothing measuring it). Every fix has a test that failed first.
4. **Website rebuilt** — `website/index.html` "Aurora": live WebGL aurora, a CSS-3D laptop showing
   real renders from the desktop's own code, the restart rebuilt from `src/aurscreen`, the power-cut
   timeline from the transcript, a lit desktop gallery, and the schools configurator on the real
   recipe library. Lighthouse mobile: 97 performance / 97 accessibility / 100 / 100.
   **`website/directions/`** holds four alternative directions (Exhibit, Cold boot, The Drive,
   Field) with like/dislike/notes so the owner can pick.

## Waiting on the owner (nothing here blocks the code)

| | |
|---|---|
| **Pick the website direction** | Aurora is built out; the board at `website/directions/` has the alternatives. The directions agent's own ranking: Cold boot hero, Drive as "how it works", Field as the schools page. |
| **Licence** | Root `LICENSE` is MIT (from the engine); LATHE was all rights reserved (D30/D31). The gate enforces whichever file is at the root. |
| **Turn on CI** | Two ready workflows are parked so nothing emails anyone: `.github/workflows.parked/verify.yml` (./verify on push) and `windows.yml` (starts the real installer on a real Windows VM; hand-run only). Moving a file into `.github/workflows/` activates it. |
| **A real PC** | Zero real installs. `docs/TRY-IT.md` is the script for a tester; the first result goes into `hardware/compat.tsv` as a `physical` row. |
| **Signing certificate, image host, legal entity** | `docs/SIGNING.md`, `docs/RELEASE.md`. |
| **Publishing the site** | Not published anywhere public. A private preview exists as a claude.ai artifact. |

## Known, not fixed

- `office.profile` installs `thunderbird`, which on Ubuntu 24.04 is a snap stub (the build purges
  snapd) — that profile ships without mail. The recipe compiler refuses Thunderbird for this reason.
- Profile keys `update_channel`, `enrollment_url`, `telemetry`, `auto_login` are written to
  `policy.conf` and read by nothing; `wallpaper_style` is not read at all. Pinned by tests so the
  list cannot grow silently.
- Second-script keyboard switching compiles and is checked against libxkbcommon, but has not been
  exercised on a booted image.
- Deleting a whole test file is still not caught by `./verify`.

## Rules carried forward

Push often, no PRs unless asked. A check that cannot fail is not a check — break it on purpose before
believing it. Never claim a real-hardware result `hardware/compat.tsv` doesn't have. Never write to a
real disk from a test. Keep CI quiet (the owner hates failure e-mail).
