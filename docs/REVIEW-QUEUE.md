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

## R4 — Site content still claims replaceability · OPEN · blocks Gate 4 copy, not mechanism
D31 settled the new claim: *"you have the image; if we cease operating you get the build files needed to
keep patching it."* Thirteen content files still make the old, now-false claim. They need rewriting
together, in one pass, by whoever owns the voice — not patched one at a time, because the argument runs
through all of them.

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

**Nothing is deployed**, so no false claim is public. The honesty gate does not catch these because they
were true when written — which is worth noting: a claims ledger is only as good as the last time someone
re-read it against reality. `CLAIMS.md` needs a "verified on" date per row.
