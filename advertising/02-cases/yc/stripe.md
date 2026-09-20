# STRIPE (YC S09) — the Collison installation

**Steal: 8 · Fit: 8**

---

## The play

When anyone agreed to try Stripe, the founders said *"Right then, give me your laptop"* and integrated
it on the spot — rather than *"Great, we'll send you a link"*
([YC Startup Library](https://www.ycombinator.com/library/96-do-things-that-don-t-scale)).

It removed the gap between interest and implementation, in which most interest dies, and put the
founders in the room while the confusing parts were being confused over.

## Why it maps

**Our pilot offer is already a Collison installation** and nobody labelled it as one.
`docs/outreach/PILOT-OFFER.md`: *"Three laptops, working, in your building, at no cost, with no
commitment."* Not a trial, not a demo — we take the machines, do the work, hand them back.

The structural insight is identical: **the buyer's real objection is not price, it is the effort of
trying.** A school IT person's question — *"will this create work for me?"* — is answered by removing
all of the work from their side of the transaction, and by nothing else.

## What we should copy more literally

1. **Take the machines away and bring them back.** Currently the offer says the machines end up
   working in their building; it does not say who does the labour. Say it explicitly: *we collect,
   we build, we return.* Zero minutes of their time is the product.
2. **Be in the room for first boot.** The Collison installation's value was not the integration, it was
   watching people get confused. Spec §11.4 promises a guided first boot. We will not know whether it
   works until we watch somebody who is not us use it — and that observation is worth more than the
   pilot.
3. **The qualifying question stays.** PILOT-OFFER's *"what would you do with three more working
   computers next week?"* is the guard against a pilot ending in a cupboard. Doing things that don't
   scale is expensive; doing them for someone with no use for the result is just expensive.

## Where the analogy breaks

Stripe's install took minutes and the downside of a bad one was a failed API call. Ours takes hours,
touches the only copy of somebody's files, and the downside is data loss — which is why spec §4.1
exists. **We cannot move as fast as they did and it would be dangerous to try.** What we copy is the
removal of effort from the customer, not the speed.

## The other Stripe lesson, which we are already following

Stripe's documentation was the marketing. The thing a developer evaluated was the docs, and they were
better than the product needed them to be.

Our equivalent is the **configurator panel** — spec §6D calls it *"the single most persuasive object on
the site"* — and the **removal report**. Both are artifacts the buyer inspects instead of reading
claims about. That instinct is already in the spec; it just has not been recognised as the same insight.
