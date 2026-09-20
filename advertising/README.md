# ADVERTISING

How Auros gets in front of the people who have the problem, given that today it has **no product
published, no customer, no machine touched, and no permission to email anybody**.

Written 2026-09-20. Same rules as the rest of this repo: a claim carries its evidence or it carries
the word *unknown*. Where this folder recommends something that spec §9 reserves for a human, it says
so in the file and it is collected in [`00-constraints/human-decisions.md`](00-constraints/human-decisions.md).

---

## The one-paragraph version

The laptops in the cupboard have a **dated, published, externally-verifiable death sentence** and
almost nobody has done the arithmetic on what happens at the end of it. Our advertising is not a
campaign; it is **one dataset and one calculator**, published early and kept honest, that rank for the
searches the buyer is already doing and that a competitor cannot fake without touching hardware. The
sales motion underneath is not schools — it is **refurbishers**, who hold the pile already, who have
an acute commercial problem with a date on it, and each of whom is a channel to dozens of schools.

The long version is [`04-plan/STRATEGY.md`](04-plan/STRATEGY.md). Read
[`01-market/the-cost-math-that-inverts.md`](01-market/the-cost-math-that-inverts.md) first, because it
is the finding that reorders everything else.

---

## Folders

| Folder | What is in it |
|---|---|
| [`00-constraints/`](00-constraints/) | The envelope. What we may say today, what the honesty gate will reject, and every §9 decision this strategy needs from the human. **Read before writing a word of copy.** |
| [`01-market/`](01-market/) | The market as measured, not as assumed. The clock, the cost arithmetic, the buyers, the competition. |
| [`02-cases/`](02-cases/) | The inspiration library. YC companies, data-as-marketing, transparency plays, people who sold into *this exact market*, and the anti-patterns. [Index and scoring here.](02-cases/README.md) |
| [`03-analysis/`](03-analysis/) | What the cases and the market imply for us specifically. Positioning, the wedge, the channel scorecard, and the pre-mortem. |
| [`04-plan/`](04-plan/) | The plan. Strategy, sequencing, assets to build, and the messaging with its evidence. |

## The three facts this folder is built on

1. **There is a clock, and it is 23 days out.** Consumer Windows 10 ESU ends **2026-10-13**. The
   education and commercial programme runs to **2028-10** and no further. Dates, sources and the full
   ladder: [`01-market/the-clock.md`](01-market/the-clock.md).
2. **The obvious cost argument is backwards for schools.** Microsoft's published education ESU price is
   **$1 / $2 / $4** per device per year. Ours is **$15**. For a school we are the expensive option for
   the next two years, and pretending otherwise is the exact category of untruth §4.4 exists to stop.
   [`01-market/the-cost-math-that-inverts.md`](01-market/the-cost-math-that-inverts.md).
3. **The asset that compounds is already in the repo and is not being used as marketing.**
   `hardware/compat.tsv` has zero rows today. Spec §8 already tells us to fill it. What nobody wrote
   down is that it is also the entire top of the funnel.
   [`02-cases/data-as-marketing/backblaze-drive-stats.md`](02-cases/data-as-marketing/backblaze-drive-stats.md).

## House rule for everything in here

**No campaign in this folder may require a claim we cannot evidence.** That is not a moral posture, it
is a risk calculation: the moment of maximum attention is also the moment of maximum scrutiny, and the
audience for "revive your old laptop" overlaps almost exactly with the audience that enjoys catching a
vendor overclaiming. `tools/honesty-gate.mjs` is therefore a marketing asset and should be pointed at
ad copy, not only at the website.
