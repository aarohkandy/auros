# THE CASE LIBRARY

Companies and campaigns worth stealing from, scored against **our actual constraints**: no customers,
no budget, no permission to email anyone, a product that has not shipped, and an honesty gate that
rejects most of what marketing normally says.

That filter is unusual and it eliminates most famous growth stories. A case that depends on a large
user base, a referral loop, paid acquisition or a viral consumer surface scores near zero here however
brilliant it was.

**Scoring.** *Steal* = how much of it we can use in the next 90 days, given the constraints.
*Fit* = how close their situation was to ours at the point the play worked.

---

## The five that matter most

| # | Case | Why it is here | Steal | Fit |
|---|---|---|---|---|
| 1 | [**Backblaze Drive Stats**](data-as-marketing/backblaze-drive-stats.md) | Published a dataset nobody else had, quarterly, for 13 years. 150+ scholarly citations. **This is `hardware/compat.tsv`.** | **10** | **10** |
| 2 | [**ChromeOS Flex / Neverware**](adjacent-market/chromeos-flex.md) | Sold into *this exact market* and won it. Their certified models list is the trust artifact. | **9** | **10** |
| 3 | [**GitLab's handbook**](transparency/gitlab-handbook.md) | Made the internal record the public artifact. We already write `DECISIONS.md` and `BLOCKED.md` to that standard and publish neither as marketing. | **9** | 7 |
| 4 | [**Stripe's Collison installation**](yc/stripe.md) | The canonical do-things-that-don't-scale move, and the exact shape of our pilot offer. | **8** | 8 |
| 5 | [**PostHog's content engine**](data-as-marketing/posthog-content.md) | Deep technical content by the engineers who did the work; ~70% of early growth from recommendation, 30% inbound content. | 8 | 7 |

## Everything else, by folder

### [`yc/`](yc/) — Y Combinator companies
| Case | The play | Steal | Fit |
|---|---|---|---|
| [Stripe](yc/stripe.md) | Collison installation; docs as the product surface | 8 | 8 |
| [Airbnb](yc/airbnb.md) | Door-to-door, photographing listings themselves | 7 | 6 |
| [GitLab](yc/gitlab.md) | Open-core + radical transparency as distribution | 9 | 7 |
| [Zapier](yc/zapier.md) | Programmatic long-tail SEO: one page per integration | **9** | 8 |
| [Segment](yc/segment.md) | Open-sourced the client library; HN launch | 6 | 5 |
| [Supabase](yc/supabase.md) | Launch Week — manufactured recurring attention | 4 | 3 |
| [Gusto](yc/gusto.md) | SMB via the accountant channel — sell to the intermediary | **8** | 8 |
| [Ironclad, Rippling, others](yc/others.md) | Short notes on the rest of the YC set and why each scores low | 3 | — |

### [`data-as-marketing/`](data-as-marketing/) — publish the measurement, not the pitch
| Case | The play | Steal | Fit |
|---|---|---|---|
| [Backblaze Drive Stats](data-as-marketing/backblaze-drive-stats.md) | 13 years of quarterly failure-rate data | **10** | **10** |
| [PostHog content](data-as-marketing/posthog-content.md) | Engineers writing about engineering decisions | 8 | 7 |
| [Tailscale's blog](data-as-marketing/tailscale.md) | Hard technical writing as the entire top of funnel | 8 | 8 |
| [Cloudflare post-mortems](data-as-marketing/cloudflare-postmortems.md) | Publishing your own outages in full | **9** | 8 |

### [`transparency/`](transparency/) — the record as the asset
| Case | The play | Steal | Fit |
|---|---|---|---|
| [GitLab handbook](transparency/gitlab-handbook.md) | Everything public by default | 9 | 7 |
| [Buffer open metrics](transparency/buffer-open-salaries.md) | Salaries and revenue public | 5 | 4 |
| [Plausible open startup](transparency/plausible.md) | Live revenue dashboard; positioning against a free giant | **9** | **9** |

### [`adjacent-market/`](adjacent-market/) — people who sold into *this* room
| Case | The play | Steal | Fit |
|---|---|---|---|
| [ChromeOS Flex / Neverware](adjacent-market/chromeos-flex.md) | Free, certified model list, school channel | 9 | **10** |
| [Zorin OS](adjacent-market/zorin-os.md) | Windows-shaped Linux, education page, End of 10 backer | 7 | **9** |
| [End of 10 campaign](adjacent-market/end-of-10.md) | Coalition + local volunteer directory | **8** | **9** |
| [Refurbisher networks](adjacent-market/refurbishers.md) | MAR/TPR licensing economics — and the crack in them | **10** | **10** |

### [`anti-patterns/`](anti-patterns/) — the ones to study so we do not repeat them
| Case | The failure | Lesson |
|---|---|---|
| [Zorin Grid](anti-patterns/zorin-grid.md) | Announced Jan 2020, unreleased Apr 2026 | Never pre-announce the console. Spec §6E was right |
| [Wubi](anti-patterns/wubi.md) | Destroyed user data by writing before verifying | Already encoded as prohibition §4.1 |
| [Linux-on-the-desktop-year](anti-patterns/year-of-linux.md) | Twenty years of advocacy marketing that never converted an institution | Sell the absence of a problem, never the OS |
| [Open-core bait-and-switch](anti-patterns/licence-reversals.md) | Companies that withdrew a licence and lost the room | **We just did this (D30). Directly applicable.** |

---

## What the library says, taken together

Three findings survive the filter, and all three point the same way.

1. **Every case that scores 9 or 10 is the same play: publish a measurement nobody else has, on a
   schedule, including the parts that embarrass you.** Backblaze, Cloudflare, GitLab, Plausible, and
   Google's own certified models list. Not one of them is a campaign. All of them compound.
2. **The cases that fit our constraints best are the least glamorous.** Gusto selling through
   accountants and refurbisher licensing economics are worth more to us than any launch story, because
   they are about reaching a buyer through someone who already has them.
3. **The anti-patterns are closer to home than the successes.** We have already done the licence
   reversal, and we are three months from being able to pre-announce a console. The library's most
   useful files may be the four in [`anti-patterns/`](anti-patterns/).
