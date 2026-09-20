# MESSAGING

Every proposed line of customer-facing copy here **passes `tools/honesty-gate.mjs`** — checked
2026-09-20 by extracting the blockquotes and running the gate over them (exit 0, no findings; the one
hit was the old Version A text, quoted here so it can be replaced). **Passing the gate is the floor, not
the bar.** It cannot see a claim that stopped being true, and it already missed one instance of the
licence claim ([details](../00-constraints/honesty-gate-for-marketing.md)). Where a line needs a §9
sign-off it says so, and several need the wind-down terms to exist before they are true at all.

---

## 1. The urgent one: replacing the withdrawn licence claim

**The problem.** Both email versions and the pilot one-pager close on the same promise, in three
different wordings, and in each it is the load-bearing sentence:

> Version A — *"a public file in a public repository — if I vanish, you rebuild the exact same operating
> system from it without me"*
> Version B — *"Every configuration I build is a public file — if I disappear, you can rebuild your
> machines from it without me."*

D30 withdrew that right. **The gate catches Version A and the one-pager, and misses Version B** — it
says *public file* rather than *public repository*, and *rebuild your machines* rather than any object
the `licence-grant` rule lists. Verified, with the regexes tested directly:
[`../00-constraints/honesty-gate-for-marketing.md`](../00-constraints/honesty-gate-for-marketing.md).
So all three must be rewritten by hand. **This is §9 decision A3 and it blocks every channel.**

**Do not use D31's original wording.** *"If we cease operating, you receive the build files"* sounds
like a promise and is not one. Drafting the terms (`docs/legal/WIND-DOWN-TERMS.DRAFT.md`) exposed why:
**under all rights reserved, files you have no licence to use give you nothing.** The repos are already
readable; what a customer lacks is the *right to use* them. So the commitment has to be **a licence that
vests on a trigger**, not a delivery of files.

**Proposed replacement**, aligned to that draft. Needs the draft terms finalised and reviewed by a
lawyer first (`BLOCKED.md` B11, the wind-down entry). Then it needs sign-off (A3):

> *I am new and I have no customers to point you at. What I can tell you is what happens if I stop.
> The image is on your machines and it keeps booting whether or not I exist — that was never the real
> risk. What would stop is the patching. So it is written into the contract: **if Auros closes, or
> simply stops publishing builds for your fleet for 90 days, you automatically get the right to build
> and patch your own image yourself**, or to pay anybody you like to do it. That covers your recipe,
> the base definition and the build scripts, for your own machines. It is not a licence to our other
> tools, and it is not permission to resell.*

**The clause that does the work is "simply stops".** The draft's own note: *"Companies rarely announce
their own death; they simply stop. A trigger that requires an announcement protects no one."* A buyer
who has watched a vendor go quiet will recognise that clause, and it is the one line here nobody puts
in a brochure. The 90 days is a placeholder in the draft; use whatever number survives legal review.

**Why it is still weaker than the licence it replaced.** A right that exists today beats one that only
vests when something goes wrong, and it is only as good as a contract with a company that may not
exist. The reader will notice. Say it plainly anyway, because the honest version has one advantage the
original lacked: **once the terms exist, it is true.**

**Until the terms document exists, this paragraph does not ship.** Four references on the site are
already held for the same reason (`BLOCKED.md` B11, the wind-down entry). A commitment stated on a page
with no document behind it is the fabricated-claim problem again. See
[`../02-cases/anti-patterns/licence-reversals.md`](../02-cases/anti-patterns/licence-reversals.md).

---

## 2. The price comparison spec §6D mandates

The rule: *"We cannot evidence a saving. The reader does this arithmetic with their own numbers; we
supply the arithmetic, never the answer."*

So: two published ladders, each sourced and dated, **with no adjective between them.**

> **What Microsoft charges to keep a Windows 10 machine patched**
> *(published rates, read 2026-09-20)*
> ```
> education        $1      $2      $4      programme ends
> commercial      $61    $122    $244     programme ends
>                 yr 1   yr 2    yr 3        Oct 2028
> ```
>
> **What we charge**
> ```
> school / nonprofit    $15 per device per year, 25 device minimum
> business fleet        $12 per device per month, 10 minimum
> single-purpose        $19 per device per month, 5 minimum
> one machine           $79 one-time
> ```
>
> Multiply by your own device count. **For a school, the first row is cheaper than we are** and it runs
> until October 2028. What it does not do is give these machines a destination, because they will not
> run Windows 11 at any price.

**The third paragraph is the point.** Volunteering that Microsoft is cheaper for schools costs us
nothing we would have kept — a school IT person finds that price in one search — and it is the single
most credible thing on the pricing page. An IT person who catches us omitting it stops reading.

---

## 3. Who should not buy from us

[Plausible's move](../02-cases/transparency/plausible.md). `PILOT-OFFER.md` already does this with
Windows software and it is the best paragraph in the document.

> **If your people work entirely in a browser and you already run Google Admin**, ChromeOS Flex is free
> and it is probably the right answer.
>
> **If anything on those machines runs a Windows-only program**, that machine should keep Windows. Not
> some programs — none come across. We tell you exactly which ones are on each machine before we touch
> it.
>
> **If you are a school**, Microsoft will sell you security updates for $1 a device this year. That is
> cheaper than us.
>
> This is for the case where the machines need applications installed on them, in your language,
> configured your way, and where somebody has to be able to show exactly what is on them.

---

## 4. Segment openers

| Segment | Opening line | Gate check |
|---|---|---|
| **Refurbisher** | *"The machines in your warehouse that will not take Windows 11 do not have an OS path. They can have one."* | No claim about us at all. Clean |
| **Nonprofit** | *"Microsoft's published price to keep these patched is $61, then $122, then $244, then it stops. Here is ours."* | Two published figures, no adjective. Clean |
| **Library / kiosk** | *"A machine that does one thing should contain one thing. The desktop shell is not in the image, and the build checks nightly it has not come back."* | Amber — true of the design, needs future tense until Gate 1 |
| **School** | *"ESU runs to October 2028 and these machines will never run Windows 11. The question is not this year's bill; it is what is on them in 2029."* | Sourced dates only. Clean |

---

## 5. The state banner (§9 decision A7)

`CLAIMS.md` requires either holding the site until Gates 1–3, or a visible banner on every page — and
says the wording is a human's decision.

Proposed, for sign-off:

> **This product is not finished, and this page says which parts are.**
> An image builds and boots in a virtual machine — [here is the run](…). No physical laptop has been
> touched, no customer exists, and the migration tool does not compile yet. Everything on this site
> written in the future tense is a description of a design. Everything in the past tense has a link to
> the run that produced it.

**This is an asset, not a cost.** A site that opens by saying which of its own promises are not yet true
is doing something the reader has not seen a vendor do, and it is what makes the rest of the site
credible. It is also the only honest way to be visible before Gate 3.

---

## 6. The positioning line

Current README: *"Custom operating systems for machines that still work."* Accurate, describes us
rather than their situation, and "custom operating systems" reads as *a bespoke thing only they can
maintain* — which is the fear, not the pitch.

Proposed:

> **The laptops are fine. The operating system expired, and the replacement will not run on them.**

Then the existing landing-page copy, which is already good: *"A 2014 laptop opens a spreadsheet as fast
as it did in 2014. Nothing about it wore out."*

The word *Linux* does not appear. [Why](../02-cases/anti-patterns/year-of-linux.md).

---

## 7. Words that may not appear

Straight from the gate, restated as a writing rule rather than a regex:

| Never write | Because |
|---|---|
| any customer, testimonial, logo, device count | `social-proof`, `device-count` — we have none |
| any saving, any bare percentage | `savings-figure`, `unqualified-percent` |
| "one restart" without its qualification in the same sentence | `one-restart-unqualified` — false on BitLocker / TPM-1.2 |
| anything implying general .exe support; Office or Adobe as a caveat | `blanket-exe`, `office-adobe-claim` — Office rates Garbage, Photoshop Silver |
| "public git repo", "clone and rebuild it yourself" | `licence-grant`, `public-recipes` — D30 |
| "guarantee" | `guarantee` — no operating history |
| "roll back through previous versions" | `multi-rollback` — bootc keeps booted + exactly one |
| "unlike other vendors", "the only company that" | `competitor-absolute` — we have surveyed none |
| "better / safer / faster than X" | `comparative-superiority` — no measurement exists |
| "usually", "most customers", "in our experience" | `worded-frequency`, `implied-track-record` — zero rows, zero customers |

## 8. Before anything ships

```bash
node tools/honesty-gate.mjs auros-web/src docs/outreach
```

And the thing the gate cannot do: **somebody re-reads the claims ledger against the world.** All 25
violations were true when written. The gate catches copy that was always wrong; only a re-read catches
copy that went wrong.
