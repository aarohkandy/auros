# POINTING THE HONESTY GATE AT AD COPY

`tools/honesty-gate.mjs` mechanises §4.4 over `auros-web/src`. `./verify` runs it on that directory and
nothing else, which was correct when the website was the only place we made claims.

**It is no longer the only place.** `docs/outreach/EMAIL-DRAFT.md` makes claims to a real person's
inbox and is not scanned. Neither is this folder. Neither would a slide, a directory listing, or a
conference abstract.

---

## The concrete finding

Both outreach drafts close on the same sentence:

> *"every configuration is a public file in a public repository — if I disappear, you rebuild the exact
> same operating system from it without me"*

That is the `licence-grant` and `public-recipes` rules, twice, in the highest-stakes copy we have — and
it was invisible because the gate does not look at `docs/`. The website's 25 instances were found; the
outreach's were not, because of a directory argument.

## What to do

```bash
node tools/honesty-gate.mjs auros-web/src docs/outreach advertising
```

Running it over `advertising/` today produces findings, and **most of them are correct behaviour**:
this folder quotes forbidden phrasings in order to forbid them, which is what the `auros-allow`
annotation exists for. That is a known and acceptable cost of keeping the analysis honest about what
it is analysing.

The change actually worth making to `./verify` is narrower:

```bash
run "honesty gate — outreach" node tools/honesty-gate.mjs docs/outreach
```

`docs/outreach` is copy destined for a human being's inbox. It is a claim surface in exactly the sense
§4.4 means, and it should have been gated from the day it was written. `advertising/` is analysis and
should be scanned by hand, not wired into `verify`, because a gate that reports mostly-annotated
findings is the kind people learn to skim — a failure mode the gate's own comments warn about.

## What the gate cannot catch, and what that means for advertising

The gate is a regex over content. It catches a **claim class**. It cannot catch:

- **A true sentence that stopped being true.** This is what happened with the 25. Every one was
  accurate when written; reality moved. Only a human re-reading the claims ledger against the world
  catches that, and the interval between re-readings is the company's exposure window.
- **A misleading true statement.** "A qcow2 boots in 30 seconds" is true and, placed beside a photo of
  a school, implies something we have not done.
- **An implication built from two true sentences in adjacent paragraphs.** The gate reads lines.
- **Omission.** Not printing Microsoft's $1 education price would not trip any rule, and would be the
  most dishonest thing on the pricing page.

**So the gate is a floor, not a ceiling**, and the discipline that matters for advertising is the one
CLAIMS.md already encodes: every factual assertion gets a row and an evidence column, and somebody
re-reads the ledger against reality on a schedule. The gate catches the copy that was always wrong.
The ledger catches the copy that went wrong. We have had one of each already.
