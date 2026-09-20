# ANTI-PATTERN: ZORIN GRID

**Announced January 2020. Unreleased as of April 2026.**

---

## What happened

Zorin announced Zorin Grid — *"Manage all of your organization's computers. As easily as one."* — in
January 2020, with a landing page, a waitlist, press coverage in Forbes and Linux.com, and stated
pricing intent (per-machine, discounted for schools and nonprofits)
([Zorin blog](https://blog.zorin.com/2020/01/16/introducing-zorin-grid-manage-all-of-your-organizations-computers-as-easily-as-one/),
[Forbes](https://www.forbes.com/sites/jasonevangelho/2020/01/16/meet-zorin-grid-a-slick-solution-for-businesses-ditching-windows-7-for-linux/)).

Per [Wikipedia](https://en.wikipedia.org/wiki/Zorin_OS), **as of April 2026 the software is
unreleased.** Six years.

This is not a failing company. Zorin OS ships, has users, and is a named backer of the End of 10
campaign. **The management layer specifically is the thing that did not ship.**

## What it costs, beyond the obvious

1. **Every organisational enquiry for six years hit a waitlist.** The announcement converted interest
   into a queue instead of into a product, and a queue that never resolves burns the interest
   permanently.
2. **The claim is load-bearing for the whole pitch.** Selling Linux to an organisation *requires* a
   fleet answer. Announcing one and not shipping it means every organisational conversation for six
   years ended at the same place.
3. **It is a standing invitation for a competitor.** The gap has been visible, named and unfilled since
   2020, which is one of the reasons the position we are aiming at is open.

## Why it is hard, which is the actual lesson

Fleet management is the hardest part of this business. Not the desktop, not the installer — the layer
that keeps hundreds of machines you cannot see in a known state.

The company closest to us in positioning, with a shipping product and real users, could not do it in
six years.

## What the spec already got right

Spec §6E: *"Build **last**, only after a real customer exists. List machines, show image/version, push a
recipe change to all, lock or wipe a lost device. Nothing more. **Do not build this speculatively.**"*

And `TASKS.md` W-E, in full: *"Not built."*

**This case validates that instruction with six years of somebody else's evidence.**

## The advertising rule this produces

**Do not advertise the console. Do not put it on a roadmap. Do not take a waitlist for it.**

When an organisational buyer asks *"how do we manage 40 of these"* — and they will, it is the first
serious question — the honest answers today are: nightly rebuild means the fleet updates itself without
a console, and beyond that, **we do not have one yet and here is what we would do instead.**

That answer loses some deals. Announcing a console we then fail to ship for six years loses the
company.
