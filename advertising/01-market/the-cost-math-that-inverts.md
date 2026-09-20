# THE COST ARITHMETIC, AND THE PLACE IT INVERTS

> **This is the most important file in the folder.** It kills the campaign everybody would have
> written first, and it reorders who we sell to. Retrieved 2026-09-20.

---

## What we would have claimed, and why it is false

The obvious campaign for a product like this writes itself: *Microsoft wants to charge you to keep
these machines patched. We charge less.* It is the first slide in every pitch deck in this category.

For a **school**, it is backwards.

## Microsoft's published ESU prices

| | Year 1 | Year 2 | Year 3 | Then |
|---|---|---|---|---|
| **Education** | **$1** | **$2** | **$4** | programme ends |
| **Commercial** | **$61** | **$122** | **$244** | programme ends |

Education pricing is Microsoft's own, stated verbatim: *"ESU pricing for Microsoft education customers
will be $1 per license for the first year, $2 the following year, and $4 the third year"*
([Microsoft Education Blog](https://www.microsoft.com/en-us/education/blog/2024/04/windows-10-end-of-support-updates-for-education/)).
Commercial pricing and the doubling structure: [Microsoft Learn](https://learn.microsoft.com/en-us/windows/whats-new/extended-security-updates).
Late enrolment in Year 2 requires buying Year 1 retroactively, so a commercial org starting now pays a
**$183 minimum** ([TrustedTech](https://www.trustedtechteam.com/blogs/windows/windows-10-esu-10-things-you-need-to-know)).

## Ours, from `auros-web/src/content/tiers/`

| Tier | Price | Minimum |
|---|---|---|
| School and nonprofit | **$15** per device per year | 25 devices |
| Business fleet | $12 per device per month | 10 devices |
| Single-purpose | $19 per device per month | 5 devices |
| One machine | $79 one-time | — |

## The inversion, stated plainly

**For a school, over the full three-year ESU run, Microsoft charges $7 per device and we charge $45.**
We are the expensive option, by a factor of six, for the entire remaining life of the programme.

**For a nonprofit paying commercial rates, Microsoft charges $427 per device over three years and we
charge $45.** We are the cheap option, by a factor of nine.

That is not a rounding difference between two segments. It is **the same sentence being true and false
depending on which of the two words in "schools and nonprofits" you are talking to**, and the spec
treats them as one audience throughout.

## What this changes

1. **Price is not the argument for schools. It cannot be made to be.** Any school-facing copy built on
   cost is an overclaim the buyer disproves with one search, and `savings-figure` in the honesty gate
   would have stopped it from shipping anyway.
2. **Price is a very strong argument for nonprofits**, who pay commercial rates and often have no
   volume-licensing agreement at all. This is the segment where the obvious campaign works, and the
   spec's ICP ordering buries it.
3. **The argument for schools is the wall, not the bill.** $1, then $2, then $4, then **nothing**, on
   machines that will never run Windows 11. ESU is a payment plan on a decision, not an alternative to
   making it.
4. **Spec §6D's replacement-cost comparison is the right instrument and is about the right thing.**
   The school tier is told to show a comparison because *"our real competitor is doing nothing, which
   is free."* Doing nothing now has a published price ladder and a published expiry date. Print both
   ladders. Print the source and the date. Say nothing else.

## The form the comparison must take

The honesty gate's `savings-figure` rule exists for this exact moment: *"We cannot evidence a saving.
The reader does this arithmetic with their own numbers; we supply the arithmetic, never the answer."*

So the permitted object is **two published price ladders in mono type, each with its source and the
date we read it, and no adjective between them.** Not "save $X". Not "cheaper than". Two tables and a
citation. The reader multiplies by their own device count, which is the only number that matters and
the only one we do not have.

This is also the strongest available version of the argument, because a school IT person who catches
us quietly omitting the $1 education price stops reading. One who finds we printed it ourselves,
including in the years where it makes us look expensive, reads the rest.

## The segment nobody costed: refurbishers

Neither ladder applies. A refurbisher's problem is not a per-device bill, it is that **a pallet of
2013 machines cannot take Windows 11 and their Microsoft Authorized Refurbisher licences are for an OS
that is expiring** — so the inventory has no OS path and therefore no resale path. Their number is
revenue foregone per pallet, which is far larger than either ladder and which we do not know.

That is a materially better problem to sell into than either of the two the spec names, and it is
developed in [`03-analysis/the-wedge.md`](../03-analysis/the-wedge.md).

---

## Recommendation flagged for the human

Spec §9 reserves price changes. **This file recommends no price change.** It recommends a change to
**who the pricing page argues with**, which is copy rather than price — but because it reorders the
spec's stated ICP, it is written up in
[`00-constraints/human-decisions.md`](../00-constraints/human-decisions.md) as **A1** rather than
acted on.
