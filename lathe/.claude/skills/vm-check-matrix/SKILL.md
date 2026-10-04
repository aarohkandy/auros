---
name: vm-check-matrix
description: Run the Auros VM check matrix against an image digest and record the result in the attest ledger. Use when validating a base or recipe image before publish, when a nightly build needs gating, or when asked whether a digest has passed. This is the only procedure permitted to write a pass into attest/passed-digests.tsv.
---

# vm-check-matrix

The procedure that decides whether an image may reach a customer. Spec §4.3: *never publish an image that
has not booted in a VM and passed the full check matrix.*

## Before you start

Read `auros-base/matrix/checks.yaml` and `auros-base/matrix/profiles.yaml`. They are the definition of
"passed"; this file is only how to run it.

## Procedure

1. **Resolve to a digest.** Never work from a tag. A tag can be moved after a test passed, which would let
   an untested image inherit a passing record.
   ```
   skopeo inspect --no-tags docker://<ref> | jq -r .Digest
   ```
2. **Static checks first** (S1–S10). They need no VM, they are seconds not minutes, and they catch most
   regressions. If any fails, stop — do not spend twenty minutes booting an image that already failed lint.
3. **Determine the bound profiles.** Base images run all seven. A recipe runs the profiles named in its
   `hardware_profile:` field, plus `uefi-modern` always.
4. **Boot checks per profile** (B1–B12), fanned out one subagent per profile. Each returns **pass/fail
   plus a log, and nothing else** — their context must not pollute the caller's.
5. **Update and rollback** (U1–U5, R1). These are the heart of Gates 1 and 2. If time is short, these are
   the ones to keep.
6. **Emit `results.json`** against `matrix/results.schema.json`. Anything that does not validate is a
   FAIL, never an unknown.
7. **Record in the ledger** only on a full pass across every bound profile.

## Three ways this procedure silently stops working

- **Treating `skip` as `pass`.** A skipped required check is a failure. This is the most common way a
  suite quietly stops testing anything.
- **Trusting the harness's own `verdict` field.** `tools/gate.mjs` recomputes it from the checks array,
  because a field that says `"pass"` is exactly what a broken or malicious harness would write. If you
  find yourself reading `verdict` to decide something, stop.
- **Retrying a red S3.** S3 (prune assertions) goes red when upstream re-adds a package we removed. That
  is the check doing its job. Retrying it until it passes ships a kiosk image with a desktop inside it.

## When a check fails

Do not disable it, do not add a flag, do not mark it `continue-on-error`. Write the failure to
`BLOCKED.md` with the digest and the run URL, take the next unblocked task, and surface it at the next
checkpoint. A matrix that can be argued with is not a gate.
