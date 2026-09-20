# POSITIONING

What we are, in a sentence, and the four sentences underneath it that have to survive contact with an
IT person who has been oversold for twenty years.

---

## The problem with what we have now

The README says: *"Custom operating systems for machines that still work."*

It is accurate, and it has two faults. It describes **us** rather than their situation. And "custom
operating systems" is the phrase most likely to make an overworked IT person close the tab, because it
sounds like a bespoke thing that only we can maintain — which is the fear, not the pitch.

The landing page is much better and buries its best line: *"They are not broken. They are orphaned."*

## The positioning, stated

> **The laptops are fine. The operating system expired, and the replacement will not run on them.**
> We build one image holding only what your organisation asked for, install it without touching your
> files until they are verified somewhere else, and rebuild it every night so it is still patched in
> four years.

Four moves in it, each doing specific work:

1. **"The laptops are fine"** — starts with the object in the room, not the technology. Borrowed from
   [End of 10](../02-cases/adjacent-market/end-of-10.md), whose message is the best in this market.
2. **"the replacement will not run on them"** — names the real trap. Not "Windows 10 ended" but
   "Windows 11 will not install", which is the fact that makes ESU a countdown rather than a solution.
3. **"only what your organisation asked for"** — subtraction, spec §1.2, the actual product.
4. **"still patched in four years"** — spec §1.1: the maintained image is the product, not the OS.

The word *Linux* does not appear. See
[the advocacy anti-pattern](../02-cases/anti-patterns/year-of-linux.md).

## The four supporting claims, and their evidence

| Claim | Status today | What makes it credible |
|---|---|---|
| **Only what you asked for** | Designed, built, unproven at Gate 1 | The configurator's live `recipe.yaml` and the removal report — artifacts the buyer inspects rather than claims they evaluate |
| **Your files are safe** | Installer does not compile yet | Spec §4.1's ordering, and that the abort path is tested more than the happy path |
| **Still patched in four years** | Pipeline built, not observed end to end | Nightly rebuild, one base, CVE response is one rebuild |
| **If we vanish, you are not stranded** | Decided (D31), **not yet written as a term** | The wind-down handover. Weaker than the licence it replaced, and it is what we have |

**Three of the four are amber.** Positioning that leads with any of them in the present tense is the
untruth `CLAIMS.md` warns about. Which leads to the thing we actually have.

## The differentiator we are not using

**The published record of our own mistakes.**

We have no customers, no case studies, no logos, no years in business, and no reference a buyer can
call. Every conventional trust signal is unavailable by definition.

What we have instead, already written and already public:

- `DECISIONS.md` — 32 decisions with reasoning, **including the reversals**
- `BLOCKED.md` — eleven things we cannot do, and why
- `PROGRESS.md` — **defects found in our own work**, including a gate that graded a failing build as
  passing, within an hour of writing the gate
- `GATE.md` — a section titled ***"Not proven, and not claimed"***
- `LICENSING.md` — the part of the image we **cannot** control, stated plainly

No competitor can copy these, because their value is that they were written for us, before anyone was
reading, and include the parts that make us look bad. It is a costly signal in the literal sense:
expensive to produce, impossible to fake.

**A vendor asking a school to trust it with a fleet has exactly one credible thing to offer when it has
no track record: evidence of how it behaves when it is wrong.** We have that in unusual quantity and it
is currently unlinked from anything a buyer would see.

See [Cloudflare post-mortems](../02-cases/data-as-marketing/cloudflare-postmortems.md) and
[GitLab](../02-cases/yc/gitlab.md).

## Who we tell not to buy

[Plausible's move](../02-cases/transparency/plausible.md), and `PILOT-OFFER.md` already does it with
Windows software. Extended:

> **If your people work entirely in a browser and you already run Google Admin, ChromeOS Flex is free
> and it is probably the right answer.** This is for the case where the machines need applications
> installed on them, in your language, configured your way — and where somebody has to be able to show
> exactly what is on them.
>
> **If anything on those machines runs a Windows-only program, that machine should keep Windows.** Not
> some programs — none of them come across. We will tell you which ones are on each machine before we
> touch it.
>
> **And if you are a school, Microsoft will sell you security updates for $1 a device this year.** That
> is cheaper than us and it runs until October 2028. What it does not do is give these machines a
> destination, because they will not run Windows 11 at any price.

Three paragraphs that disqualify a large share of the market. They cost us buyers we would have lost at
month two anyway, and they are the most persuasive thing we can put in front of the ones who remain.

## Positioning by segment

| Segment | The sentence that opens |
|---|---|
| **Refurbisher** | *"The machines in your warehouse that will not take Windows 11 do not have an OS path. They can have one."* |
| **Nonprofit** | *"Microsoft's published price to keep these patched is $61, then $122, then $244, then it stops. Here is ours. Do the arithmetic with your own device count."* |
| **Library / kiosk** | *"A machine that does one thing should contain one thing. The desktop shell is not in the image, and the build checks nightly that it has not come back."* |
| **School** | *"ESU runs to October 2028 and these machines will never run Windows 11. The question is not this year's bill; it is what is on them in 2029."* |

Each is true, evidenced, and gate-safe. None contains a saving, a customer, a percentage or a
comparison.
