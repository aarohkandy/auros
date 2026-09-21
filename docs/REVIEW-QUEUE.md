# Review queue

Things I noticed while reading agent output that need a decision or a second look. Not bugs yet —
questions. Cleared during integration passes; anything still here at a gate gets surfaced to the human.

---

## R1 — Should `docker: ""` stay `insecureAcceptAnything` in the base policy? · OPEN
`auros-base/signing/policy.json` correctly implements D8: `"default": [{"type":"reject"}]`, and our own
scope carries `sigstoreSigned` with `keyPath: /usr/lib/pki/containers/auros.pub` and
`signedIdentity: matchRepository`. That is the fix, and it is right.

But it retains `"docker": { "": [{"type":"insecureAcceptAnything"}] }` — inherited from how Universal Blue
ships it. Scope matching is most-specific-wins, so our namespace is genuinely enforced. The residue is
that **any other registry is accepted unsigned.**

The tension:
- Tightening it to `reject` would make spec §3's "an unsigned image can never reach a customer" true in
  the strongest sense.
- It would also break `podman pull docker.io/...` and distrobox, which Aurora users — and our own
  `developer workstation` recipe — reasonably expect to work.
- Exploiting the hole requires **root on the machine**, which under `locked` and `kiosk` policy is
  exactly what a user is not supposed to be able to get. So in the modes that matter most it is already
  closed by a different mechanism.

**Proposed:** keep `insecureAcceptAnything` for other registries under `open` and `managed`; tighten to
`reject` under `locked` and `kiosk`, where nobody should be pulling arbitrary containers anyway, and
where the defence-in-depth is worth the lost convenience. That makes the policy mode-dependent, which it
already is for everything else.

Wants confirmation that the audit agent reached the same conclusion independently rather than being told.

## R2 — The landing page says a single mismatch stops the migration · **CLOSED 2026-09-20**
`auros-web/src/content/pages/1-landing.mdx`: *"If one file disagrees, the migration stops and changes
nothing."*

`auros-installer/SAFETY.md` phase 5 is more nuanced: a per-file mismatch is retried once, then
quarantined and surfaced, and the run proceeds to the wall **only if the unresolved count is zero** — a
literal single-mismatch abort fails on most real machines (OneDrive hydrating, antivirus, an open
document) and a tool that aborts constantly gets worked around, which is more dangerous.

The landing page's claim is the *safer-sounding* one, and at the wall it is true: nothing is written
unless everything verified. But it implies a mechanism we do not have.

**Done.** The page now describes the actual mechanism, which is more reassuring anyway — *"every file
is checked twice; anything we cannot verify is listed for you by name, and nothing is written to the old
disk until that list is empty."* Overclaiming safety is still overclaiming.

## R3 — Verify the rebuild command end to end before Gate 4 · OPEN
D28 fixes the missing Containerfile. The remaining risk is that the *rest* of the instructions on the
`replaceable-on-purpose` page have never been run.

Spec §1.3 makes replaceability something **we advertise**, and the FAQ says the instructions work
because "they are the same instructions we use" — which is only a reason to believe them if it is true.

**Before Gate 4:** a CI job clones `auros-recipes` from scratch into a container with nothing but podman,
runs the published commands verbatim, and asserts an image comes out. If they do not work, the page is
wrong and the page is the trust asset.

## R4 — Site content still claims replaceability · **CLOSED 2026-09-20**
D31 settled the new claim: *"you have the image; if we cease operating you get the build files needed to
keep patching it."* Thirteen content files made the old, now-false claim. They were rewritten together,
in one pass — not patched one at a time, because the argument runs through all of them.

| File | What is now false |
|---|---|
| `faq/1-if-you-disappear.md` | The whole answer is clone-and-build instructions |
| `pages/5-replaceable-on-purpose.mdx` | The entire page |
| `pages/1-landing.mdx` | Closing section, "We are replaceable on purpose" |
| `tiers/5-self-serve.md` | The tier has no product — **§9, see BLOCKED.md B9** |
| `tiers/2-school-nonprofit.md` | References public recipes |
| `pages/3-pricing.mdx` | References the self-serve tier |
| `layers/3-stratum-1.md`, `layers/5-bedrock.md` | Terrain strata copy |
| `migration/04-active-directory.md`, `migration/20-files.md` | Incidental references |
| `faq/5-do-you-see-my-data.md` | Incidental |
| `copy.ts`, `CLAIMS.md` | Strings and the claims ledger |

**Nothing was deployed**, so no false claim ever went public.

**Done.** Every file in the table is rewritten around D31: the machines keep booting because the image is
already on them, what dies with us is the patching, and the written term is that a customer receives the
build files for their own image. `node tools/honesty-gate.mjs auros-web/src` reports a clean scan and
`pnpm build` passes.

Three things came out of it that outlive this pass:

- `tiers/5-self-serve.md` is **not** decided. It carries `blocked: true`, the `tiers()` lookup filters
  blocked tiers out of every page, and `pages/3-pricing.mdx` says in words that a fifth tier exists and
  is being held back. B9 is still the open question and still §9.
- `CLAIMS.md` now carries a **`verified_on`** date on every row and a **Reviewed against DECISIONS.md**
  marker at the top, which `honesty-gate` fails the build on when it falls behind the newest decision.
  That is the actual fix: the copy did not change, reality did, and nothing was watching for that.
- The published rebuild command lost its `cd` when these pages were rewritten, and
  `tools/content-commands.mjs` caught it the same minute. A gate that reads the filesystem earns its
  keep the first time somebody edits prose around a command.

## R5 — "Derived is safer than hardcoded" is not a rule · CLOSED as a lesson · 2026-09-20
Two bugs an hour apart, in the same function, in opposite directions.

First it **hardcoded** a systemd link path naming a unit and a target from a greenboot version we do
not run. The fix was to *derive* the expected links from the installed unit file, which cannot drift
because it has nothing to drift from.

Then the derivation itself was wrong: systemd's directory suffix is `.wants` but the directive is
`WantedBy`, so deriving one from the other produced `WantsBy`, matched nothing, and made every unit
look like it had no install section. The build then declared that bootc's own update timer could not be
enabled.

**The lesson, which generalises past systemd:** derived is safer than hardcoded *only when the thing
you derive from is the same thing.* `.wants` and `WantedBy` look related and are not. Two spelled-out
words cannot drift; a transformation between two merely-similar things can.

Worth keeping because the first fix was written explicitly to avoid hardcoding, and the second bug was
caused by taking that principle one step too far. A principle applied without asking what it is true
*of* is just a different way to be wrong.

## R6 — S7 doubles every base build, including the ones that can never publish · OPEN · propose after Gate 1
**Measured:** the build job has been running 48 minutes and is not finished. It builds the image twice
and flattens twice, because S7 (determinism) compares the content digests of two builds from identical
inputs. Chunking a ~10 GB image into 127 layers is the expensive half, and it happens twice.

Roughly eight base builds were run on 2026-09-20 while debugging. At ~50 minutes rather than ~25, that
is around three hours spent re-proving determinism on builds that were going to fail at step four
anyway.

**Proposal, to make once Gate 1 is green — not now, because changing the pipeline mid-debug turns one
unknown into two:** run S7 where a publish can actually happen (main, nightly, and the release path) and
run a single build on other pushes. Determinism would still be proven every night and before every
publish, which is where the property is load-bearing. Feedback on a broken build script would halve.

The counter-argument, which deserves a hearing: a determinism break introduced on a branch would then be
found at merge rather than at push. Given S7 compares content digests and the usual cause is an
unpinned input, that is a cheap thing to find late — but it IS later.

## R7 — The base build queue is now the throughput bottleneck · OPEN
Three agents push to `auros-base`. Every push runs `build.yml`, which takes ~50 minutes (S7 builds and
flattens twice, see R6) and **queues** rather than cancelling, because main runs are deliberately not
cancellable — a run on main may be mid-publish.

The result, observed twice within half an hour: a README push and a probe-workflow push each put the
build everyone was waiting on an hour further away. Two runs were cancelled by hand to recover.

Mitigated so far: `paths-ignore` for markdown, docs, LICENSE and `probe-*.yml`.

Still open, and worth deciding together with R6 once Gate 1 is green:
- Make main runs cancellable **except** while the publish job is live, rather than never. Cancelling a
  superseded build is almost always right; the exception is narrow and detectable.
- Or move the expensive half (S7's second build and flatten) to nightly and the release path.

Minor, deliberately left: the `pull_request` trigger's `paths-ignore` does not include `probe-*.yml`,
only the `push` one does. Fixing it means editing `build.yml`, which correctly queues another
fifty-minute build for a cosmetic asymmetry. It goes in with the next real change to that file.
