# DECISIONS THIS STRATEGY NEEDS FROM A HUMAN

Spec §9 reserves: the company name · **any price change** · anything touching real hardware, a real
card, or **a real person's inbox** · accepting a customer who would fork the base · **any website claim
about customers, results or savings we cannot evidence** · declaring a hardware model unsupported.

Advertising sits on top of four of those six. Nothing in this folder has been acted on. Ordered by how
much of the plan is stuck behind it.

---

## A1 — Reorder the ICP: refurbishers first, schools last · **blocks the whole plan**

**The question.** Spec §1 names *"a nonprofit or small school"* and every piece of copy on the site is
aimed there. [The cost arithmetic](../01-market/the-cost-math-that-inverts.md) shows schools are our
**worst** first buyer — Microsoft charges them $1/$2/$4 per device where we charge $15 — and
[the wedge](../03-analysis/the-wedge.md) argues refurbishers are the best, because their inventory has
no OS path at all and each one is a channel to many schools.

**What changes if yes.** Who the landing page argues with, which tier is the hero, and who the first
outreach email goes to. **No price changes.** Schools stay a tier and stay the eventual market.

**What it costs if we do nothing.** We aim the first pilot at the segment with the longest sales cycle,
the largest committee, and a cheaper incumbent — and we find out in about six months.

**Recommendation: yes, and it is the highest-value decision in this folder.**

---

## A2 — Resolve B9, the $0 tier · **no longer blocks copy; still the trust story**

*Status 2026-09-20:* B9 is now in a holding pattern that decides nothing — the tier file carries
`blocked: true`, every page filters it out, and the pricing page says in words that a fifth tier is
being held back and why. Unblocking it is clearing that flag, which is the human's act.

Already written up in `BLOCKED.md` B9 with three options. It is here too because it is **not only a
pricing decision, it is the trust argument.** The $0 tier was half of "we are not holding you hostage",
and D31's wind-down handover has to carry that weight alone now.

Advertising's view, which is not the deciding view: **option 2 (read, don't build)** is the one that
keeps a marketing asset. A prospect who can read their own recipe before spending anything is a
prospect doing due diligence on our terms. Option 1 is cleaner and gives up that asset; option 3 hands
a competitor the schema for a benefit we could get from option 2.

---

## A3 — Rewrite the 25 licence-grant instances and both outreach emails · **blocks every channel**

The honesty gate found 25 live places offering a right D30 withdrew. **Both drafts in
`docs/outreach/EMAIL-DRAFT.md` close on that sentence, and in both it is the load-bearing one.**

This is not a §9 decision about whether to fix it — it must be fixed. It is §9 because the
**replacement wording is a website claim**, and D31's handover commitment has to exist as a real term
rather than a sentiment. Drafting that term (`docs/legal/WIND-DOWN-TERMS.DRAFT.md`) showed D31's own
wording — *"you receive the build files"* — grants nothing under all rights reserved; it has to be a
**licence that vests on a trigger**. So A3 now depends on `BLOCKED.md` B11 (the wind-down entry):
terms finalised, reviewed by a lawyer, *then* the copy. Proposed wording, aligned to the draft, is in
[`04-plan/messaging.md`](../04-plan/messaging.md).

The gate also **misses one of the three instances** (email Version B) — so the rewrite has to be done
by reading, not by running the gate until it goes green.

**Nothing can be published or sent until this closes.** Highest urgency, lowest ambiguity.

---

## A4 — Permission to publish `hardware/compat.tsv` as a standalone public artifact

**The question.** The strategy makes the compatibility table the top of the funnel — a public, citable,
per-model record of what works, what does not, and what we have not tested, with our own failures in
it. Spec §8 already instructs us to build it. This asks to **publish and promote it**, which makes it a
website claim (§9), and it touches "whether a hardware model is declared unsupported" (§9) every time a
row gets a ✗.

**What must be true first:** the table needs rows. Today it has none, and
[the Backblaze case](../02-cases/data-as-marketing/backblaze-drive-stats.md) is emphatic that the
value is in the unbroken series, not the first post.

**Recommendation: yes in principle, publish nothing until Gate 5 puts at least one physical row in it**,
with VM rows visibly marked `source=vm` as `tools/compat-lint.mjs` already enforces.

---

## A5 — The code-signing certificate, argued as a funnel cost · $10/mo or $200–400/yr

`BLOCKED.md` B3 has this as a trust and Gate 3 item. **It is also the single largest conversion loss in
the funnel and nobody has costed it that way.** The migration `.exe` is the moment the buyer commits,
and unsigned it opens with a full-screen SmartScreen block and *"Unknown publisher"* — on a machine
holding the only copy of their files, run by someone who was already nervous.

SmartScreen reputation **accrues over time**, so the certificate is worth more the earlier it exists.
Buying it at the moment of the first pilot is buying it too late to have any reputation attached.

**Spends money, so §4.6 and §9.** Recommendation: approve the $10/mo option now. It is the cheapest
conversion improvement available and it decays if deferred.

---

## A6 — Listing on endof10.org and in repair-café directories

Free, aligned, and it is a directory our exact buyer is already browsing
([endof10.org](https://endof10.org/)). A submission reaches a real organisation, so it is §9.

**It also carries a real risk that is not obvious:** that campaign is backed by Debian, Fedora, GNOME,
KDE and Zorin — a free-software coalition — and D30 made us all rights reserved while building on
Fedora and Aurora. Approaching them without volunteering that fact is the kind of thing that becomes a
thread. Handled honestly it is fine and possibly a strength; handled quietly it is a liability. See
[the pre-mortem](../03-analysis/what-would-make-this-fail.md).

---

## A7 — Whether we publish before Gates 1–3, and with what banner

`CLAIMS.md` already escalates this: hold the site until Gates 1–3, **or** publish sooner with a visible
state banner on every page saying what is built and what is not — and *"if (b), the banner text is a §9
decision, not an agent's."*

Advertising's view: **(b), and the banner is an asset rather than a cost.** A site that opens by saying
which of its own promises are not yet true is doing something the reader has not seen a vendor do, and
it is the same move that makes the rest of the site credible. But the wording is the human's.

---

## Summary

| | Decision | Blocks | Spends money | Recommendation |
|---|---|---|---|---|
| **A1** | Refurbishers first, schools last | The whole plan | No | **Yes** |
| **A2** | Resolve B9 ($0 tier) | The trust story (copy is held, not blocked) | No | Option 2 |
| **A3** | Rewrite 25 grants + both emails | Every channel | No | **Must happen first** |
| **A4** | Publish `compat.tsv` publicly | Top of funnel | No | Yes, after Gate 5 |
| **A5** | Code-signing certificate | Conversion at the riskiest step | **Yes, ~$10/mo** | Yes, now |
| **A6** | endof10.org listing | One free channel | No | Yes, with the licence stated |
| **A7** | Publish early + state banner | Everything being visible at all | No | Yes, banner is an asset |
