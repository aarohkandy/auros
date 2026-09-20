# BACKBLAZE DRIVE STATS

**Steal: 10 · Fit: 10 · The single most applicable case in this folder.**

---

## What they did

Since 2013, Backblaze has published the annualised failure rates of every hard drive in its data
centres — by manufacturer, by model, by capacity — quarterly, without interruption, as an open dataset
anyone can download ([Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data)).
Thirteen years of it as of the 2025 annual report
([StorageNewsletter](https://www.storagenewsletter.com/2026/02/18/backblaze-publishes-2025-drive-stats-report-13-years-of-data-show-growing-healthier-drive-fleet/)).

## What it produced

- **150+ citations on Google Scholar**, and 105+ academic papers and ML projects since 2018.
- Described as *"one of the only public datasets about drive usage"* — the phrase that matters, because
  it is the whole moat.
- Buyers use it to choose drives. It became infrastructure for other people's decisions.

Backblaze sells cloud backup. The dataset is not about their product at all.

## Why it worked, mechanically

1. **They had the data as a by-product of operating.** Collecting it cost nearly nothing; they were
   already running the drives.
2. **Nobody else would publish it.** Manufacturers cannot — it names competitors' failure rates and
   their own. Backblaze had no such conflict, which is exactly why the gap existed.
3. **They published the bad numbers.** The dataset's credibility is entirely a function of it
   containing models that failed, including ones they bought.
4. **They never stopped.** The value is the unbroken series. A single report is a blog post; fifty-two
   consecutive quarters is a reference work.
5. **It answers the question the buyer is already asking**, in the buyer's own words: *is this specific
   model any good?* That is a search query, not a marketing message.

## The mapping to us is almost one-to-one

`hardware/compat.tsv`. Spec §8 already says: *"Build `hardware/compat.tsv` from hour one. After fifty
rows it is the thing competitors cannot copy quickly."* `tools/compat-lint.mjs` already enforces that a
VM row cannot claim a physical column. The honesty rule is already built.

**What has not been written down is that this is the advertising strategy.**

| Backblaze | Auros |
|---|---|
| Drive model, capacity, manufacturer | Laptop make, model, year |
| Annualised failure rate | Wifi · trackpad · suspend · brightness · GPU · audio · webcam |
| Published quarterly, 13 years | Published per machine touched, forever |
| Credibility from publishing failures | `compat.tsv` requires *"at least one honest ✗"* — Gate 5's exit condition |
| Data is a by-product of running a backup company | Data is a by-product of `driver-triage`, which we run per machine anyway |
| Nobody else will publish it | Vendors cannot; distros will not; **Google publishes the positive half only** |

That last row is the opening. Google maintains a ChromeOS Flex **certified models list**
([support.google.com](https://support.google.com/chromeosflex/answer/11513094?hl=en)) — proof that in
this market the model list is the trust artifact. But a certification list tells you what *passed*. It
does not tell you that the trackpad works and suspend does not, which is the thing the person holding
the laptop actually needs to know.

**The unoccupied position is the negative space in somebody else's list**, and it is the most valuable
half.

## What it would look like

One row per machine, per subsystem, with `source=vm` or `source=physical` and an honest empty cell
where we have not looked. One page per model, generated from the table — which is the
[Zapier programmatic-SEO play](../yc/zapier.md) with real content underneath instead of templated
filler, because each page is backed by a measurement.

The search that lands on it — *"dell latitude e6430 linux wifi"* — is typed by exactly one kind of
person: someone holding that laptop, wondering if it can be saved. That is the entire ICP, self-selected,
arriving for free, at the moment of the question.

## The discipline this requires, and it is the hard part

- **Publish the failures.** A table without ✗ rows is a marketing page and will be read as one.
- **Publish the gaps.** An empty cell that says *we have not tested this* is worth more than a guess,
  and `compat-lint.mjs` already refuses to let a VM row pretend otherwise.
- **Never stop.** Backblaze's asset is the series. Ours starts the day a laptop is touched and is worth
  nothing at row one, something at row fifty, and a great deal at row five hundred.
- **Declaring a model unsupported is a §9 decision.** Every ✗ is one. The pipeline for deciding them has
  to be cheap or the table stalls — flagged as **A4** in
  [`../../00-constraints/human-decisions.md`](../../00-constraints/human-decisions.md).

## The uncomfortable part

`hardware/compat.tsv` has **zero rows today**, and Gate 5 is blocked on three laptops that have not
arrived (`BLOCKED.md` B5). The best marketing asset we have is the one furthest from existing, and it
is blocked on physical hardware — which spec §10 already warns is the thing that does not compress.

**The implication for sequencing is uncomfortable and correct: getting laptops in the door is a
marketing priority, not only an engineering one.** It is the only work that starts the clock on the
only asset that compounds.
