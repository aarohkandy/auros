# AIRBNB (YC W09) — doing things that don't scale

**Steal: 7 · Fit: 6**

---

## The play

The founders went door to door in New York, met hosts in person, and **photographed the listings
themselves** with a borrowed camera. Listings with good photos converted; the founders' time was the
input. It could never have worked at a million listings and it was exactly right for the first hundred
([YC Startup Library](https://www.ycombinator.com/library/96-do-things-that-don-t-scale)).

## What maps

**The manual step that becomes the product.** Airbnb's photography was a service they performed by hand
until it was clear it mattered enough to systematise.

Our equivalent is the **recipe conversation**. `docs/outreach/PILOT-OFFER.md` already has it: *"One
conversation about what the machines are for... That conversation is the recipe."*

That is the thing to do by hand, for as long as possible. The configurator exists to scale it later;
doing it manually first is how we learn what the schema is actually missing — and the schema is spec
§6B's product, not an afterthought.

**The second mapping** is that the pilot itself is unscalable by design: collect three laptops, build
an image, hand them back. Nobody builds a company doing that. It is how the first five customers happen.

## Where it does not map, and the warning

Airbnb's unscalable work was **reversible and cheap**. A bad photograph costs a photograph.

Ours touches the only copy of somebody's files. The unscalable version of our product has a failure
mode that ends the company, which is why spec §4.1 exists and why `PROGRESS.md` records 229 installer
test functions and a fault-injection harness before the tool compiles.

**"Do things that don't scale" does not license "do things that are not safe."** Our unscalable work is
the conversation and the logistics. It is never the data-safety path, which is mechanical, tested, and
the same for the first machine as for the thousandth.
