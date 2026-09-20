# CLOUDFLARE POST-MORTEMS

**Steal: 9 · Fit: 8**

---

## The play

When Cloudflare has an outage, they publish a full technical post-mortem: what broke, the timeline to
the minute, the bad assumption, the code, and what changed. Not a status-page apology — an engineering
document that names the mistake.

The counter-intuitive result is that these are among their **most-read and most-linked** posts. Each
outage produces a credibility asset. Engineers cite them as teaching material years later.

## Why it works

1. **Nobody fakes a post-mortem that makes them look bad.** It is a costly signal in the economic sense
   — expensive to produce, impossible to fake, therefore believed.
2. **It reframes the event.** The story stops being *"Cloudflare went down"* and becomes *"here is how
   Cloudflare thinks"*. The reader evaluates the thinking, which is what they are actually buying.
3. **It pre-empts the alternative.** Someone will write about the outage. Being the most detailed and
   earliest source means the authoritative account is yours.

## Why it maps unusually well to us

**We already write these and we write them well.** `PROGRESS.md` documents four defects found in our
own work, including one — *a probe piped a build through `tail`, so a failing build scored as passing*
— that is the precise failure the check matrix exists to prevent, found in our own code within an hour
of writing the matrix.

`DECISIONS.md` D30 is a post-mortem on a **business** decision: we changed the licence, it broke the
central promise on our own website, and the entry says *"all of that is now false"* and files a blocker
against us.

These documents exist, are public, and have never been pointed at anybody.

## The specific asset here

A vendor asking a school to trust it with a fleet of machines, with no customers and no track record,
has exactly one credible thing to offer: **evidence of how it behaves when it is wrong.**

Every other form of trust — references, case studies, logos, years in business — is unavailable to us
by definition. This one is available *right now*, and it is available precisely *because* we are early
and making mistakes and writing them down.

## The discipline it demands

- **It has to be the real thing.** A sanitised post-mortem is worse than none; readers detect the
  sanitising and correctly downgrade everything else.
- **It has to continue when it hurts.** The first time a real customer's machine fails to boot, the
  post-mortem is expensive and it is the one that matters. A series that stops at the first serious
  incident retroactively converts the earlier ones into marketing.
- **It cannot be the only content.** Cloudflare's post-mortems work against a backdrop of a product
  that works. Ours will read as a list of problems unless there is something working beside them —
  which is `hardware/compat.tsv` and the boot evidence.

## The one we should write first

Not an outage. **The `tail` bug.** A gate designed to stop untested images from shipping was itself
defeated by a shell pipeline, in our own code, within an hour of being written — and the fix
(`set -o pipefail` everywhere, D19) is now a standing CI rule with a linter enforcing it.

It is a genuinely good engineering story, it is true, it costs us nothing to tell because no customer
was affected, and it demonstrates the exact property a buyer needs to believe: **that our gates can
fail, that we look for it, and that we say so.**
