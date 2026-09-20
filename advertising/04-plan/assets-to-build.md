# ASSETS TO BUILD

Ordered by **value ÷ effort**, given that we cannot spend money or contact anyone without a §9
approval. "Effort" is ours; "blocked on" is what actually stops it today.

---

## Tier 1 — build these, they compound

### 1. `hardware/compat.tsv` as a public, citable dataset
**Value: 10 · Effort: low per row, unbounded in total · Blocked on: three laptops (B5), §9 (A4)**

The whole funnel. One row per machine per subsystem, `source=vm` or `source=physical`, honest empty
cells. [Why it is the strategy](../02-cases/data-as-marketing/backblaze-drive-stats.md).

Three rules, all of them load-bearing:
- **The ✗ rows are the product.** A table without failures is a brochure and reads as one.
- **Empty means untested**, never "probably fine". `tools/compat-lint.mjs` already enforces the VM/physical
  half of this.
- **Never stop.** Backblaze's asset is thirteen unbroken years, not any single report.

### 2. One page per laptop model, generated from the table
**Value: 9 · Effort: low (one template) · Blocked on: rows**

[Zapier's long tail](../02-cases/yc/zapier.md) with a measurement behind every page. The query
*"latitude e6430 linux wifi"* has perfect intent, no good answers, and no commercial competition.

**A model gets a page when it gets a row.** No row, no page — which is the line between this and spam,
and it is enforceable in code.

### 3. The decision record, linked and framed
**Value: 9 · Effort: nearly zero · Blocked on: §9 (A7), and adding links**

`DECISIONS.md`, `BLOCKED.md`, `PROGRESS.md`, `GATE.md`, `LICENSING.md` are public, unusually good and
linked from nothing. The single best artifact is **`GATE.md`'s "Not proven, and not claimed"**, which
is already the state banner `CLAIMS.md` asks for.

**Cheapest item in this folder by a wide margin.** It is a link and a decision.

### 4. The two price ladders
**Value: 8 · Effort: one table · Blocked on: nothing**

Spec §6D's mandated comparison, in the only form `savings-figure` permits. Draft in
[`messaging.md`](messaging.md). Includes volunteering that Microsoft is cheaper for schools, which is
what makes the rest of the page credible.

---

## Tier 2 — build when the gate allows

### 5. The configurator, shareable
**Value: 8 · Effort: a route · Blocked on: Gate 4**

Spec §6D: *"the single most persuasive object on the site."* A URL that renders someone's configuration
and its `remove:` block is the nearest thing this product has to a portfolio piece.

The earlier blocker — the order flow's human check needed a script host §4.5 did not permit — is
**resolved by D33**: one named exemption for Cloudflare Turnstile, on the configurator page only.
Worth keeping the lesson from the period before it: the site disabled submit and said so rather than
shipping a check that could never complete. **That kind of visible honesty is an asset**; do not paper
over the next gap to make a demo look complete.

### 6. The build console
**Value: 7 · Effort: built, needs Gate 1 output · Blocked on: Gate 1**

Spec §7: streams genuine pipeline output — `pruning 214 packages`, `booting test vm`,
`✓ wifi associates`. *"It is more interesting than any animation and it is true."*

It is proof-of-work rendered live, and it only works while it is real. The moment it replays a
recording it becomes a hero animation with extra steps.

### 7. The removal report as a shareable artifact
**Value: 7 · Effort: low once B3 lands · Blocked on: recipe compiler**

Every package removed, by name, with its measured size. *"Not an estimate from counting lines in a
file. A measurement taken from the image you are about to receive."*

The `must_remove_at_least: 240` floor is the detail worth leading with — a customer writing a minimum
for deletion into their own configuration file.

---

## Tier 3 — editorial, cheap, needs a §9 claim approval

### 8. Three technical pieces, already written in `DECISIONS.md`
**Value: 6 · Effort: editorial only · Blocked on: §9**

The investigation is done. The work is writing it up.

1. **The `tail` bug.** A gate built to stop untested images shipping, defeated by a shell pipeline in
   our own code within an hour of writing it (D19). **Write this one first** — true, costs nothing, no
   customer affected, and it demonstrates the exact property a buyer needs to believe.
2. **D8 — deriving from a base image does not give you signature enforcement.** Aurora's `policy.json`
   ends in an `insecureAcceptAnything` catch-all, so the enforcement flag succeeds while verifying
   nothing. A real finding about a widely-used upstream.
3. **D21 — upstream garbage-collects the digest you pinned.** Pinning protects against a tag moving, not
   against the blob being deleted. Anyone building on a public base image has this and does not know it.

Audience: the refurbisher's technical lead, the MSP, the repair-café volunteer — **not** the school IT
director. Measure accordingly. [Why](../02-cases/data-as-marketing/tailscale.md).

### 9. The pilot one-pager, rewritten
**Value: 8 · Effort: low · Blocked on: A3**

`docs/outreach/PILOT-OFFER.md` is strong and its closing argument is a right we withdrew. Rewrite with
the vesting-licence form of the handover (see [`messaging.md`](messaging.md) §1 — D31's original
wording grants nothing), once the terms exist, and add the refurbisher variant with its own qualifying question: *"how many machines
can you not sell because they will not take Windows 11?"*

---

## Explicitly not building

| | Why |
|---|---|
| A fleet-console page, roadmap or waitlist | Spec §6E. [Six years of somebody else's evidence](../02-cases/anti-patterns/zorin-grid.md) |
| Case studies, testimonials, logos | `social-proof`. We have none |
| A comparison page against ChromeOS Flex or Zorin | `competitor-absolute`, `comparative-superiority`. State what we do; put their documentation next to it and stop |
| An ROI calculator | `savings-figure`. Publish both ladders; the reader multiplies |
| A launch video or brand film | Motion that does not report a real fact is forbidden by §7, and it would be reporting nothing |
| A newsletter | Nothing to say yet at a useful cadence. Revisit when `compat.tsv` has a rhythm |

---

## The summary that matters

**The four Tier-1 assets are worth more than everything else combined, and three of the four are nearly
free.** Linking the decision record and publishing the price ladders cost an afternoon.

The fourth — the compatibility table — is the one that decides whether any of this works, and it is
blocked on **three laptops arriving**. That is the whole critical path of the advertising strategy, and
it is not an advertising problem.
