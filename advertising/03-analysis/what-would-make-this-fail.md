# PRE-MORTEM

It is 2027. The advertising strategy failed. Here is what happened, most likely first.

Written in the same spirit as `GATE.md`'s *"Not proven, and not claimed"*: the point is to name the
failure while it is still cheap.

---

## 1. We published while 25 false claims were still live — **highest probability, highest cost**

The honesty gate found 25 places offering a right D30 withdrew. **Both outreach emails close on that
sentence.** Somebody publishes, or sends, before they are fixed.

The audience for *"revive your old laptop"* overlaps almost perfectly with the audience that enjoys
catching a vendor overclaiming. The first serious reader diffs `LICENSE` against the front page, finds
we promise a right our own licence forbids, and posts the two side by side.

**We do not recover from that**, because the entire positioning is *"we are the ones who tell you the
truth"*. There is no second version of that first impression.

**Mitigation:** **A3** in [`../00-constraints/human-decisions.md`](../00-constraints/human-decisions.md)
blocks every channel until it is fixed. Also: point the gate at `docs/outreach`, which it has never
scanned — see [`../00-constraints/honesty-gate-for-marketing.md`](../00-constraints/honesty-gate-for-marketing.md).

## 2. The compatibility table never gets rows — **high probability, kills the whole plan**

The strategy rests on `hardware/compat.tsv` becoming the top of the funnel. It has **zero rows** and is
blocked on three laptops that have not arrived (`BLOCKED.md` B5). Spec §10 already warns Gate 5 is one
of the two that slips, *because hardware does not compress*.

Six months pass. The site is honest and empty. Nobody searches for us because there is nothing to find.

**Mitigation:** treat acquiring laptops as a **marketing** priority, not only an engineering one. It is
the only work that starts the clock on the only asset that compounds. Land VM rows first, honestly
marked — `tools/compat-lint.mjs` already prevents them from pretending to be physical.

## 3. The refurbisher wedge is wrong and we find out in month six — **medium probability, recoverable**

The wedge is inferred from published licensing terms, not from anyone in the business confirming it.
They may already install Linux on unsellable stock, may be exiting old hardware entirely, or MAR terms
may complicate a non-Microsoft OS.

**Mitigation:** one twenty-minute conversation settles it, and it is item one in the 30-day plan. The
rest of the plan is deliberately segment-independent — the table, the honest positioning and the pilot
mechanics are worth building whichever segment is first.

## 4. Hacker News eats us — **medium probability, high cost, entirely self-inflicted**

Someone posts us to HN or r/linux. The thread is not about schools. It is:

- *"Proprietary, built on Fedora and Aurora, and they want to be in the End of 10 directory?"*
- *"All rights reserved, but the image is full of GPL software — so which is it?"*
- *"No customers, no shipped image, and a pricing page."*

Every one of those is **fair**, and we have written good answers to all three: `LICENSING.md` says
plainly which parts we cannot control, D30 records the reversal in the owner's own words, and
`GATE.md` says what is not proven.

**The failure mode is not the questions. It is being surprised by them** — answering defensively, or
having a front page that does not volunteer what the thread is about to discover.

**Mitigation:** do not seek this channel before Gates 1–3. When it comes, the front page should already
say the awkward things. [`../02-cases/yc/segment.md`](../02-cases/yc/segment.md) and
[`end-of-10.md`](../02-cases/adjacent-market/end-of-10.md).

## 5. We compete with ChromeOS Flex on price and lose — **medium probability, avoidable**

Flex is free, from Google, aimed at our buyer, already in the console. Any copy that argues about cost
or ease loses, and deserves to.

**Mitigation:** [the Plausible move](../02-cases/transparency/plausible.md). Concede the segment we
would lose anyway, in writing, and compete only on the two axes Google's business model prevents it
from following: per-organisation subtraction, and a failure record.

## 6. We build the fleet console because prospects keep asking — **low probability, very high cost**

The first serious organisational question is *"how do we manage 40 of these?"* Losing that conversation
repeatedly creates enormous pressure to build the console, or worse, to **announce** it.

[Zorin announced theirs in January 2020 and it is still unreleased](../02-cases/anti-patterns/zorin-grid.md).
Six years, from a company with a shipping product and real users.

**Mitigation:** spec §6E is the rule — build last, after a real customer. The advertising rule is
harder: **never put it on a roadmap and never take a waitlist.** Answer the question with what is true:
the nightly rebuild means the fleet updates without a console, and beyond that we do not have one.

## 7. A pilot ends in a cupboard — **medium probability, slow damage**

`PILOT-OFFER.md` names this precisely: *"A pilot without a named person who wanted these specific
machines for a specific purpose is a pilot that ends in a cupboard."*

Three working laptops nobody uses is worse than no pilot: it consumes our scarcest resource and
produces a reference who will say *"we tried it, it was fine, we stopped."*

**Mitigation:** the qualifying question, enforced. *"What would you do with three more working computers
next week?"* No answer, no pilot.

## 8. We spend the 2026-10-13 moment on an announcement — **low probability now, would be a waste**

Consumer ESU ends in 23 days and there will be coverage. It is tempting to have *something* out.

**We have nothing to launch.** Gate 1 is not closed, no image has published, no laptop has been touched.
An announcement into that moment is a claim we cannot support at the moment of maximum scrutiny, which
is failure mode 1 with better timing.

**Mitigation:** treat the date as the first time our measurements get read, not as a launch. The clock
that actually governs our funnel is the spring budget cycle for academic year 2027–28
([the clock](../01-market/the-clock.md)).

---

## The pattern

Six of these eight are **self-inflicted**, and every one is a version of the same thing: **a claim
getting ahead of the thing it describes.** A console announced before it is built, a licence promise
that outlived the licence, a launch with nothing behind it, a price comparison we did not check.

That is the same pattern as all four [anti-patterns](../02-cases/anti-patterns/), and this company has
already committed one of them.

The machinery to catch it exists — the honesty gate, the claims ledger, `BLOCKED.md`, *"Not proven, and
not claimed"*. **It is better machinery than most companies have, and it still let 25 stale claims
through**, because it was pointed at the copy rather than at the distance between the copy and reality.

**Advertising is precisely the activity that widens that distance.** Every mitigation above reduces to
one discipline: before anything is published or sent, somebody re-reads the claims ledger against the
world, and the interval between those re-readings is the company's exposure.
