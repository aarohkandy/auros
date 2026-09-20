# The publish gate

**Spec §4.3 (hard prohibition):** *Never publish an image that has not booted in a VM and passed the full
check matrix. Enforce with a CI gate that cannot be overridden by a flag.*

This directory holds the ledger that sentence depends on, and this file is an honest account of what
enforces it — including what each mechanism does **not** do. A gate you misunderstand is worse than no
gate, because you stop looking.

| File | What it is |
|---|---|
| `passed-digests.tsv` | The ledger. Which exact digests passed the full matrix, on which profiles, under which matrix version. Starts with zero rows. |
| `../tools/gate.mjs` | The enforcement library. One implementation, used by CI **and** by the hook. |
| `../tools/gate.test.mjs` | 64 tests, almost all of them asserting refusals. |
| `../.claude/hooks/publish-gate.mjs` | The `PreToolUse` hook. Layer four. |

## Why this is four layers and not one

Spec §8 assigns the job to a `PreToolUse` hook. `PLAN.md §3.2` established that a hook alone is **not**
the mechanical guarantee §4.3 claims, and that finding is the reason this directory looks the way it does.
A `PreToolUse` hook constrains one agent, inside one harness, on one machine. It says nothing about CI,
about a human with registry credentials, about a different agent session, or about a `workflow_dispatch`
button. Relying on it would give us the *feeling* of a hard gate with none of its properties.

### Layer 1 — the CI publish step reads the ledger

**What it guards is the tag move, and the ordering is worth stating exactly, because the obvious
reading of the sentence above is wrong.** In `auros-base/.github/workflows/build.yml`:

| order | job | what reaches the registry |
|---|---|---|
| 1 | `build` | `podman push` to `:stage-<run_id>` — **unsigned bytes are in GHCR before any gate** |
| 2 | `sign` | `cosign sign` on that digest — **signed before the ledger is consulted** |
| 3 | `update` | U1–U5, R1 — the update and rollback leg, which needs a signed image to test against |
| 4 | `record` | the row is written to the ledger, only on a full pass |
| 5 | `publish` | `node meta/tools/gate.mjs <digest> --image <image>`, then the `:hardened` tag moves |

The gate sits between 4 and 5. It is **not** between the bytes and the registry, and it is **not** before
the signature. It cannot be: `update` tests that a machine refuses a bad image and rolls back, which
needs a signed image to exist first. So the honest statement of this layer is: **the gate guards the tag
that machines follow**, which is a defensible design and is not the same sentence as the one above it.

*Does not protect against:* a digest that fails the update leg still existing in the registry, signed,
under `:stage-<run_id>`, until the `cleanup` job removes it — and cleanup is best-effort, logging
`::warning::could not delete … the token lacks delete:packages. The tag stays.` A machine pointed
directly at such a digest would install it, because `auros-base/signing/policy.json` asks only for a
valid signature over a repository it trusts and has no way to consult a ledger. Today this is bounded by
the fact that **no production key exists**: `signing/keys/` holds only `auros-development.pub`, the sign
step fails closed without `signing/keys/auros.pub`, and D32 refuses a development-signed image at the
publish step. It stops being bounded the day a production key lands — BLOCKED.md B10.

*Also does not protect against:* a publish that never goes through CI. It is a step in a workflow, and a
workflow can be edited in the same pull request that removes the step. Its integrity is the integrity of
review on `.github/workflows/`. It also cannot tell whether the row it read is true — see **the one thing
none of these protect against**, below.

### Layer 2 — GHCR write is held only by the workflow token

Push permission on `ghcr.io/<org>/*` belongs to the workflow's `GITHUB_TOKEN` and to no human PAT. This is
the layer that makes layer 1 unavoidable rather than merely customary: if nobody *can* push by hand, then
the CI path is the only path, and the CI path is gated.

*Does not protect against:* anyone who can change the package's access settings or mint a new token —
which is the repository owner, always. It is an organisational control wearing a technical costume. It
also does nothing once bytes are already in the registry.

### Layer 3 — install-time signature policy on the machine

`containers-policy.json` on every Auros machine requires a valid Auros signature for the base image, so an
image that somehow reached the registry unsigned still cannot be installed. This is the only layer that
survives the registry being wrong.

*Does not protect against:* an image that is **signed and bad**. Signing proves origin, not quality. If a
digest is signed after a partial test run, every machine will accept it happily. It also depends on the
signature being *discoverable* by `containers/image`, not merely valid to `cosign` — the failure mode
check `S8` exists for, because cosign 3.x can report a green verify while a laptop finds no signature at
all.

### Layer 4 — the `PreToolUse` hook

`.claude/hooks/publish-gate.mjs` inspects Bash commands for publishing shapes (`podman|docker|buildah
push` including the `<noun> push` forms, `skopeo copy`, `cosign sign|attest`, `crane`/`oras`/`regctl`
copies, `gh release upload` of an image artifact, and a `curl`/`wget` writing to a `/v2/…/manifests/`
URL) and blocks with exit code 2 when the digest has no recorded full pass. It is **conservative on
purpose**: if it cannot confidently parse a digest out of the command — a tag-only push, two different
digests, uppercase hex that will not compare equal — it refuses rather than allowing. A false positive
costs an operator thirty seconds; a false negative puts unbooted bytes on a school's laptops.

*Does not protect against:* everything outside this harness — CI, a human shell, another agent, a
different machine. It is also not a sandbox, and it does not pretend to be: it reads the command it is
handed, so a publish reached through a shell script it cannot see (`bash ./deploy.sh`) or a command
assembled at runtime from values it cannot evaluate is not something it can parse and therefore not
something it can gate.

**And the list above is a best effort, not a proof.** It matches a fixed set of command shapes, so a real
publish spelled in a form not on that list is allowed — which is not hypothetical. An audit found
eighteen: `podman image push` and `docker image push` (the documented forms, missed because the
subcommand had to be the first positional), `crane cp`, `buildah manifest push`, `regctl image export`,
five pieces of shell grammar in front of the command word (`then`, `do`, `{`, `(`, a leading
redirection), `eval …`, `$(…) push`, `echo … | bash`, `python3 -c`, `node -e`, `make`, `npm run`, and a
raw `curl -X PUT` to the registry API. All eighteen are refused now and each carries a test in
`tools/gate.test.mjs` under *negative space* — but the general point survives the fix: this layer knows
the shapes somebody thought of.

It is defence in depth against haste, not against intent. Layers 1–3 are what stand up to intent.

## What the gate actually checks

`tools/gate.mjs` fails closed. Every one of these is a **refusal**, not a warning and never an unknown:

- the ledger is missing, unreadable, empty, or has the wrong header
- **any** row in the ledger is malformed — not merely the row being asked about, because a file we cannot
  fully parse is a file whose *silence* about a digest means nothing
- the digest is absent, present twice at the current matrix version, or is not a digest at all (a tag)
- the digest differs from a recorded one by a single character, or is a prefix of one — there is no
  near-match, truncation or case-folding anywhere in the comparison
- the row records a partial pass: fewer profiles listed than bound, a missing mandatory profile, a base
  image not covering every profile, or any required check ID missing
- the row's `matrix_version` is not the current one, in either direction
- `auros-base/matrix/checks.yaml` is present and disagrees with the gate's own constants (drift ⇒ refuse
  everything until a human reconciles them)
- `auros.config.json` cannot be read, so the namespace cannot be confirmed

**A `skip` never reaches this file.** The harness records only checks that passed, and the gate requires
the recorded set to equal the matrix's required set. A skipped required check is therefore a missing
check, which is a refusal. That is the single most common way a test suite quietly stops testing anything.

**The harness's own `verdict` field is not consulted.** The gate recomputes the verdict from the recorded
sets, because a field saying `"pass"` is exactly what a broken or malicious harness would write.

### There is no bypass, and you can check that claim

`decide()` takes exactly one thing that can change its answer: the bytes of the ledger. Its other
parameters — image, recipe — can only ever *add* a reason to refuse. The options argument selects which
files to read so the tests can run against fixtures; selecting a file is not overriding a verdict, since
the same bytes always decide the same way. `tools/gate.mjs` reads `process.env` nowhere. The CLI rejects
every argument it does not recognise, so `--force` is fatal rather than ignored, as are `-f`, `--yes`,
`--allow`, `--override`, `--skip-gate` and `--no-verify`.

Three tests enforce those properties mechanically rather than trusting this paragraph: one scans the
library's own source (comments stripped) for `process.env` and for force/override/bypass in executable
code; one asserts every unrecognised flag exits 2; one runs the CLI as a subprocess under six different
environments and asserts the verdict never moves.

## The one thing none of these protect against

**The ledger is a claim, and the gate verifies the claim's shape — not the world.**

`tools/gate.mjs` can prove that a row is well-formed, complete, current, unambiguous, and about an image
in our namespace. It cannot prove that a VM ever booted. Anyone who can land a commit on this repository
can append a row asserting a pass that never happened, and every layer above will believe it: CI will read
it and publish, the token will sign the push, the machine will verify the signature, and the hook will
step aside. The fourth layer does not help, because the row is valid.

This was demonstrated, not theorised. Appending one line to a scratch copy of the ledger moved
`node tools/gate.mjs <digest>` from `REFUSED [empty-ledger]` to `ALLOW — 7/7 profiles, 28/28 checks`, and
the hook then exited 0 for a `podman push` of that digest. No VM ever booted.

So the real boundary of this gate is **write access to `attest/passed-digests.tsv`**, and the only things
defending that boundary are code review and git history — human controls, not mechanical ones.

One narrow thing has since been added, and its scope should not be overstated: the `PreToolUse` hook now
refuses a Bash command that writes to the ledger, to the hook, to `.claude/settings.json` or to
`tools/gate.mjs`, so **this agent in this harness** cannot author its own evidence or delete its own
gate. Reads are untouched; only writes are refused. That is one process out of every process that can
open the file. It is also incomplete by construction: `.claude/settings.json` installs the hook with
matcher `Bash`, so a `Write` or `Edit` tool call never reaches it — the branch that would refuse one
exists and is tested, but nothing routes such an event to it today. Widening that matcher is a change to
the operator's own configuration and is theirs to make. If this
ever needs to be stronger than that, the fix is signed attestations from the CI identity (the harness
signs `results.json` with the workflow's OIDC identity and the gate verifies that signature) so that a
hand-written row is cryptographically distinguishable from a real one. We have not built that, and until
we do, **a row in this file is worth exactly as much as the process that wrote it.**

A second, smaller thing worth saying plainly: a full green matrix means the *software* is sound. It does
not mean a particular 2013 ThinkPad works. Real Wi-Fi association, trackpad gestures, brightness keys,
true firmware suspend, webcam, battery and GMA-era GPU acceleration are not observable in QEMU; they live
in `hardware/compat.tsv` with `source=physical`, and no customer quote is ever generated from a `vm` row.

## Why a file lives under `.claude/` at all

Spec §5: *agent working state lives at repo root, never under `.claude/`.* That rule is intact.
`PROGRESS.md`, `TASKS.md`, `GATE.md`, `BLOCKED.md`, `DECISIONS.md` and this ledger are all at the root,
where a human reads them and git tracks them as the project's record.

`.claude/settings.json` and `.claude/hooks/publish-gate.mjs` are **configuration, not state** — the
distinction being that state is what the agent has learned or done, while configuration is what the
harness must be told before it will do anything. The harness reads its hook registration from
`.claude/settings.json` and nowhere else, so a hook registered at the root is a hook that does not run.
The hook file itself contains no state: it holds no record of what passed, makes no decision of its own,
and delegates entirely to `tools/gate.mjs`, which lives at the root with everything else. Delete
`.claude/` and layers 1–3 are untouched; that is the test of whether something is state or configuration.

## Recording a pass

Only `.claude/skills/vm-check-matrix` writes to the ledger, only after `emit-results.mjs` has produced a
`results.json` that validates, and only on a full pass across every bound profile. Re-testing a digest
**replaces** its row rather than appending a second one — two live claims about the same bytes is a ledger
the gate refuses to reason about, and it will say so. Revoking a pass is deleting the row; the gate starts
refusing that digest again immediately, and git remembers what was there.

## Running it

```
node --test tools/gate.test.mjs        # 64 tests
node tools/gate.mjs <sha256:…>         # exit 0 allow · 1 REFUSED · 2 could not decide (also a refusal)
./verify                               # every gate Auros has, including this one
```
