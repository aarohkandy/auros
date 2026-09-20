# DATA AS MARKETING

Publish the measurement, not the pitch. **Every case in this folder scores 8 or higher**, and that is
not a coincidence — it is the only category of marketing available to a company with no customers, no
budget, and a gate that rejects claims.

| Case | The play | Steal | Fit |
|---|---|---|---|
| [Backblaze Drive Stats](backblaze-drive-stats.md) | 13 years of quarterly drive-failure data, including their own bad buys | **10** | **10** |
| [Cloudflare post-mortems](cloudflare-postmortems.md) | Publish your outages in full, with the bad assumption named | **9** | 8 |
| [Tailscale's blog](tailscale.md) | Explain hard problems; the product is discovered second | 8 | 8 |
| [PostHog content](posthog-content.md) | Engineers writing about engineering; 70% of growth was still word of mouth | 8 | 7 |

## What they share

1. **The data is a by-product of operating.** Nobody built a research department. Backblaze ran drives,
   Cloudflare had outages, we run `driver-triage` on every machine.
2. **It includes the unflattering parts, and that is the entire mechanism.** A dataset without failures
   is a brochure. The cost of publishing the bad rows is exactly what makes the good ones believed.
3. **It answers a question the reader already has**, in their words — *is this drive any good*, *why did
   it break*, *does wifi work on this laptop* — rather than a question we wish they had.
4. **It compounds.** The asset is the series, not the post. This is the only marketing that is worth
   more in year three than in year one, which matters enormously for a company that cannot spend money.

## What it means for us

`hardware/compat.tsv` is a Backblaze Drive Stats. `DECISIONS.md` and `PROGRESS.md` are a Cloudflare
post-mortem series. `BLOCKED.md` is a list of honest constraints nobody else in this market publishes.

**All three exist. None has a single reader.** The gap between this company and a credible one is
mostly a matter of pointing at documents we have already written — and putting rows in a table that is
currently empty.
