# POINTING THE HONESTY GATE AT AD COPY

`tools/honesty-gate.mjs` mechanises §4.4 over `auros-web/src`. `./verify` runs it on that directory and
nothing else, which was correct when the website was the only place we made claims.

**It is no longer the only place.** `docs/outreach/EMAIL-DRAFT.md` makes claims to a real person's
inbox and is not scanned. Neither is this folder. Neither would a slide, a directory listing, or a
conference abstract.

---

## The concrete finding — verified 2026-09-20, not inferred

Run against `docs/outreach`, the gate **exits 1 with 6 findings**. Two of them are the withdrawn licence
claim, caught by `public-recipes`:

| Where | Text | Caught? |
|---|---|---|
| `EMAIL-DRAFT.md:26` (Version A) | *"…a public file in a public repository — if I vanish, you rebuild the exact same operating system from it without me"* | **Yes** — `public-recipes` |
| `PILOT-OFFER.md:62` | *"…a public file in a public repository — if we disappear tomorrow, you can rebuild your exact operating system…"* | **Yes** — `public-recipes` |
| `EMAIL-DRAFT.md:54–55` (Version B) | *"Every configuration I build is a public file — if I disappear, you can rebuild your machines from it without me."* | **No. Missed.** |

**Version B makes the identical withdrawn claim and passes the gate.** Tested directly against both
rules' regexes:

- `licence-grant` matches `you can rebuild (it | the same | your own)`. Version B says *rebuild **your
  machines***. Not in the list.
- `public-recipes` matches *public **repository***. Version B says *public **file***. Not in the list.

So the one email we would send a school carries a right D30 withdrew, and a clean gate run would have
reported nothing. It was invisible twice over: the gate does not look at `docs/` at all, and when
pointed there, one of the three instances still slips through because the prose used a different noun.

**This is the failure mode the gate's own comments name** — *"the specific way a gate becomes
decoration: it keeps checking what it always checked while the prose moves somewhere else."* An
enumerated list of objects (`it | the same | your own`) will always trail the ways a person can phrase
the same promise.

**Scope note:** fixing the rule is engineering, owned alongside `tools/honesty-gate.corpus.test.mjs`,
and is **not changed by this folder.** The advertising consequence stands regardless of the fix: A3 in
[`human-decisions.md`](human-decisions.md) must rewrite all three by hand, because the gate cannot be
relied on to have found them all.

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
