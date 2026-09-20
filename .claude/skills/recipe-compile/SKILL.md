---
name: recipe-compile
description: Validate and compile an Auros customer recipe.yaml into a Containerfile, and explain in plain English what it will produce. Use when adding or changing a customer recipe, reviewing an order PR from the configurator, or checking whether a requested change is something a recipe is allowed to do.
---

# recipe-compile

YAML in, Containerfile out — plus the part that matters commercially: a plain-English account of exactly
what gets deleted.

## Procedure

```
node auros-recipes/dist/cli.js validate  customers/<name>/recipe.yaml
node auros-recipes/dist/cli.js explain   customers/<name>/recipe.yaml
node auros-recipes/dist/cli.js compile   customers/<name>/recipe.yaml
```

Always run `explain` before `compile` when a human is in the loop. `explain` is written for a school IT
person, and reading it aloud is the fastest way to catch a recipe that is technically valid and
commercially wrong.

## What a recipe may never do, and why refusing is the product

A recipe may **only ADD**. It may not change the `FROM` line, pin a kernel, patch a driver, or hold back a
package version. If validation refuses one of these, **do not work around it.**

The reason is not purity. It is that spec §3's promise — *CVE response is one rebuild* — only holds if
every customer image is downstream of one base. A recipe with its own `FROM` is a second base, and a
second base means a CVE requires touching two files, then five, then forty. The refusal is what keeps the
promise true at scale.

A customer who genuinely needs one of these is **a customer we decline**. Surface it to the human as a
decision (spec §9 reserves it). Never solve it by forking.

## The prune list is the product, not a cleanup step

Subtraction is the entire value proposition. When reviewing a recipe, the `remove:`/keep-only block
deserves more attention than the install list.

Check three things:
- **Is anything in the protected set being pruned?** See `auros-recipes/schema/PROTECTED.md`. Pruning the
  update path produces a machine we can never patch again — the exact abandoned laptop we sell against.
- **Does the removal report have real measured byte counts?** "We removed 214 packages" is a claim we put
  in front of customers. It has to come from a measurement, not from counting lines in the YAML.
- **Will S3 hold tomorrow?** The base is rebuilt nightly; upstream can drag a removed package back in.
  That is expected, and it should fail the build loudly rather than ship quietly.

## Reviewing an order PR from the configurator

The configurator emits YAML that must pass this same validator — same code path, no parallel
implementation. If a PR from the website fails validation, the bug is in the configurator and the fix
belongs there, not in a hand-edit of the customer's file.
