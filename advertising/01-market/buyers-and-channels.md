# WHO BUYS, WHO DECIDES, AND HOW THEY ARE REACHED

Spec §1's ICP: *a nonprofit or small school with 25–200 dead laptops, already living in Google
Workspace, with one overworked IT person.* This file takes that apart, because "schools and
nonprofits" behave nothing like each other at the point of sale — see
[the cost arithmetic](the-cost-math-that-inverts.md).

---

## The four buyers, scored

Scored on what actually governs a first sale: how fast they can say yes, whether the money exists
without a committee, and whether one yes leads to more.

| | Speed to yes | Budget without committee | Multiplies? | Our price vs. their alternative | Rank |
|---|---|---|---|---|---|
| **Refurbisher / reuse charity** | Days | Yes — it is cost of goods | **Yes, strongly** | Their alternative is unsellable stock | **1** |
| **Nonprofit (commercial ESU rates)** | Weeks | Often yes | Weakly | We are ~9× cheaper than ESU | **2** |
| **Library / community centre** | Weeks | Small but discretionary | No | Kiosk tier, clean fit | **3** |
| **School / district** | Months, budget-cycle bound | No | Via district | We are ~6× *dearer* than ESU until 2028 | **4** |

The spec puts schools first. **The economics put them last.** Not never — last. A school is the
best customer in the world once it has bought; it is the worst first customer for an unproven vendor
with no compatibility table.

## The decision unit

Nobody in this market buys an operating system. They buy **the absence of a problem they already
have**, and there are only ever three people in the room:

1. **The overworked IT person.** Real question: *will this create work for me?* Not answerable by a
   website. Answerable by machines in their building — which is exactly why
   `docs/outreach/PILOT-OFFER.md` is shaped as three free laptops they keep.
2. **The person who signs.** Real question: *what happens when this vendor disappears?* Since D31 our
   answer is the wind-down handover, and it must read as a **published term**, not a sentiment.
3. **The person who uses the machine.** Real question: *where did everything go?* Answered by spec §11
   (Windows-shaped, zero-terminal) and by the *what doesn't come across* page being above the fold.

Copy that only addresses (1) loses at signature. Copy that only addresses (2) never gets to signature.
The site currently addresses all three, which is unusual and worth protecting.

## Channels, and whether we can use them today

§4.6 forbids spending money or emailing a real person without explicit human approval in-session.
Nearly every channel below fails that test, so the column that matters is the last one.

| Channel | Fit | Cost | Usable today without a §9 approval? |
|---|---|---|---|
| **Organic search on model names** | **Very high** — it is the query the buyer already types | £0 | **Yes.** Needs `compat.tsv` rows, not permission |
| **The dataset itself as a citable artifact** | **Very high** | £0 | **Yes** |
| Refurbisher direct outreach | **Very high** | £0 | **No** — real inbox, §9 |
| endof10.org / repair-café directory listing | High | £0 | **No** — submission reaches a real org, §9 |
| Hacker News / LWN / r/linux | Medium, and risky — see the pre-mortem | £0 | **No** — publishing a claim, §9 |
| TechSoup nonprofit catalogue | High for segment 2, long lead | Admin fee | **No** — §9, and months of qualification |
| Education conferences (BETT, ISTE) | High trust, wrong stage | ££££ | **No** — §4.6 |
| Paid search | Low — the query has no commercial intent yet | ££ | **No** — §4.6 |
| Paid social | Very low | ££ | **No** |

**Two channels are open to us today and both are the same channel:** publish the measurements, and let
the searches find them. Everything else needs a human to approve an email, a listing or a spend.

That is not a limitation to work around. It is the reason the strategy in
[`04-plan/STRATEGY.md`](../04-plan/STRATEGY.md) is a dataset rather than a campaign.

## TechSoup, specifically, because it has the longest lead time

Nonprofits get validated (501(c)(3) letter, EIN, 1–5 business days) and then browse a catalogue of
discounted and donated technology; vendors route nonprofit programmes through it precisely because
TechSoup does the eligibility verification ([techsoup.org](https://www.techsoup.org/get-product-donations),
[Zeffy guide](https://www.zeffy.com/blog/techsoup)).

For segment 2 this is a genuinely strong fit — it is where nonprofits already go to find exactly this
kind of thing. It is also the channel with the longest qualification runway, which means **starting it
is worth doing early even though it cannot convert for a long time.** It needs a human (§9) and it
needs a product that exists, so it belongs on the 90-day horizon, not this month.
