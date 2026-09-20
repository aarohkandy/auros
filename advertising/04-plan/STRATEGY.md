# STRATEGY

2026-09-20, at Gate 1. Supersedes nothing — spec §1, §6D and §9 govern. Where this conflicts with the
spec it says so and routes the conflict to
[`../00-constraints/human-decisions.md`](../00-constraints/human-decisions.md) rather than resolving it.

---

## The strategy in one page

**We do not run a campaign. We publish a dataset and a calculator, and we sell through refurbishers.**

Three moves, in dependency order.

### Move 1 — Make `hardware/compat.tsv` the top of the funnel

Spec §8 already instructs us to build it: *"After fifty rows it is the thing competitors cannot copy
quickly."* What was never written down is that it is also **the entire acquisition channel**.

One row per machine, per subsystem, with `source=vm` or `source=physical` and an honest empty cell
where we have not looked. One page generated per model. The search that lands there —
*"latitude e6430 linux wifi"* — is typed by exactly one kind of person: someone holding that laptop,
wondering if it can be saved.

Why this and not content marketing:

- It is [Backblaze Drive Stats](../02-cases/data-as-marketing/backblaze-drive-stats.md): a by-product of
  operating, that nobody else will publish, that compounds for years, cited 150+ times in Backblaze's
  case.
- It is [Zapier's long tail](../02-cases/yc/zapier.md) with a real measurement behind every page, so it
  cannot degrade into generated filler — `tools/compat-lint.mjs` makes that a build failure.
- Google publishes the **positive half** for ChromeOS Flex. The negative half — what is broken on which
  model — is the half the buyer needs and the half a platform vendor cannot publish about itself.
- It is the one marketing asset that is **§4.4-safe by construction**: it is a record of measurements
  including failures, which is the opposite of fabricated social proof.

**Blocked on:** rows. Today there are zero, and physical rows need the three laptops of `BLOCKED.md` B5.
**Therefore: getting laptops in the door is a marketing priority, not only an engineering one.**

### Move 2 — Sell through refurbishers, not to schools

Spec §1 aims at schools. Two findings move them to last:

- **Microsoft charges schools $1/$2/$4 per device. We charge $15.** Over the full ESU run, $7 against
  $45. We are six times the price of doing nothing, until 2028
  ([the arithmetic](../01-market/the-cost-math-that-inverts.md)).
- **Refurbishers have no alternative at all.** Their 2012–2018 stock cannot take Windows 11 and the
  Windows 10 licence they can install expires. Stock with no OS path has no resale path. And each
  refurbisher is a **channel** to dozens of schools — [the Gusto play](../02-cases/yc/gusto.md),
  and nobody had identified the intermediary.

Full argument and its weaknesses: [`../03-analysis/the-wedge.md`](../03-analysis/the-wedge.md).
**This is §9 decision A1.** It changes who the copy argues with. It changes no prices.

### Move 3 — Make the published record of our own mistakes the trust argument

We have no customers, no logos, no references, no years in business. Every conventional trust signal is
unavailable **by definition**, and no amount of work changes that before Gate 6.

What we have, already written and already public: `DECISIONS.md` (including the reversals),
`BLOCKED.md` (eleven things we cannot do), `PROGRESS.md` (**defects found in our own work**),
`GATE.md`'s *"Not proven, and not claimed"*, and `LICENSING.md` (the part of the image we **cannot**
control).

A competitor cannot copy these, because their value is that they were written for us, before anyone was
reading, and include the parts that make us look bad —
[Cloudflare's post-mortem effect](../02-cases/data-as-marketing/cloudflare-postmortems.md) and
[GitLab's handbook](../02-cases/yc/gitlab.md).

**A vendor with no track record has exactly one credible thing to offer: evidence of how it behaves
when it is wrong.** We have that in unusual quantity and it is linked from nothing.

Cost of this move: **adding links, and deciding on a state banner** (§9 decision A7).

---

## What we are not doing, and why

| Not doing | Why |
|---|---|
| A launch on 2026-10-13 | Nothing to launch. Gate 1 open, no image published, no laptop touched. An announcement at the moment of maximum scrutiny is [failure mode 1](../03-analysis/what-would-make-this-fail.md) |
| Any paid acquisition | §4.6, and the queries have no commercial intent. It would buy clicks from people who cannot buy |
| Competing with ChromeOS Flex on price or ease | It is free and from Google. [Plausible's move](../02-cases/transparency/plausible.md): concede the segment, compete on the two axes their business model forbids them |
| Announcing the fleet console | [Zorin announced theirs in January 2020; unreleased April 2026](../02-cases/anti-patterns/zorin-grid.md). Spec §6E. No roadmap, no waitlist |
| Hacker News, yet | Proprietary product on Fedora, no shipped image, a pricing page. Every question is fair and we should answer them on our own front page first |
| Cold-emailing schools | Wrong segment first, longest cycle, cheapest incumbent |
| Any savings figure | `savings-figure`. Print both published ladders, sourced and dated. The reader does the arithmetic |

## The order things must happen in

```
A3  fix the 25 licence-grant claims + both outreach emails      ← BLOCKS EVERYTHING
      │
      ├── link the decision record + state banner (A7)           ← free, immediate
      │
      ├── one refurbisher conversation (A1, §9)                  ← settles or kills Move 2
      │
      └── laptops in the door (B5)
             └── first physical compat.tsv rows
                    └── model pages                              ← Move 1 starts compounding
                           └── organic arrivals
                                  └── pilots (§9)
                                         └── Gate 6
```

**Nothing downstream of A3 may be published or sent.** Every outreach draft we have closes on a right we
withdrew, and in both versions it is the load-bearing sentence.

## How we will know it is working

Leading indicators, in order of when they can move. Deliberately not revenue — revenue cannot move for
a year and a plan measured on it is a plan that gets abandoned in month three.

| Signal | Means | Earliest |
|---|---|---|
| Rows in `compat.tsv`, with ✗ rows present | The asset has started | On laptop arrival |
| A refurbisher answers *"how many machines can you not sell?"* with a number | The wedge is real | One conversation |
| Model pages get organic arrivals | The channel works | ~3 months after first rows |
| Somebody cites the table who is not a customer | It has become infrastructure | ~6 months |
| A pilot is requested rather than offered | Positioning landed | Gate 5+ |
| An organisation asks *"how do we manage 40"* | We are in real conversations | Gate 5+ |

## The honest summary

This strategy is **one asset, one channel and one trust argument**, and it is shaped that way because
almost everything else is forbidden, unaffordable, or blocked on a human.

Its largest weakness is that the asset it depends on — `hardware/compat.tsv` — **has zero rows and is
blocked on three laptops that have not arrived**, and its central wedge rests on an inference about
refurbishers that **no refurbisher has confirmed.**

Both are cheap to fix and neither is fixable by writing more code. That is the actual finding in this
folder: the bottleneck on advertising is not creative, budget or engineering. It is **three laptops and
one phone call**, and both need a human.
