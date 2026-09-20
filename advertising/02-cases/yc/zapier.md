# ZAPIER (YC S12) — programmatic long-tail SEO

**Steal: 9 · Fit: 8 · The mechanism for turning `compat.tsv` into a funnel.**

---

## The play

Zapier generated a page for every integration and every *pair* of integrations — thousands of pages,
each targeting a search somebody was actually typing (*"connect X to Y"*). The searcher had already
named their problem in the query, so intent was near-perfect and competition near-zero.

Crucially the pages were **backed by something real**: each one corresponded to an integration that
existed and worked.

## Why it maps almost exactly

Our long-tail query is **the laptop model**. Someone holding a dead ThinkPad types
*"thinkpad x230 linux wifi"* or *"latitude e6430 suspend"*. That search has:

- **Perfect intent.** Only one kind of person types it: someone holding that machine, wondering if it
  can be saved.
- **Almost no good answers.** Forum threads from 2015 and a wiki page nobody has updated.
- **Zero commercial competition.** Nobody is bidding on it because it looks like it has no commercial
  value — which is exactly the condition that made Zapier's pages cheap to win.

`hardware/compat.tsv` generates one page per model, automatically, from measurements. The content is
not templated filler; it is a record of what we observed on that machine, including what failed.

## The line this cannot cross

Programmatic SEO becomes spam the moment the pages stop being backed by something real. Zapier's were
backed by integrations that existed.

**Ours must be backed by a machine somebody actually touched.** A generated page for a model we have
never seen — filled with plausible guesses — would be a fabricated claim, would trip
`tools/compat-lint.mjs` if it pretended a VM row were physical, and would destroy the credibility of
every real row beside it.

So the rule is simple and it is already enforced in code: **a model gets a page when it gets a row, and
the row says how we know.** An empty cell renders as *we have not tested this*, which is a better page
than a guess and a better signal than a lie.

## The asymmetry worth noticing

This is a channel where **our constraints are an advantage**. Every competitor in programmatic SEO is
fighting generated filler. We are structurally incapable of producing it — the honesty gate and the
compat lint make it a build failure — so our pages are worth more per page, and there will be far fewer
of them.

Fifty honest pages beat five thousand generated ones in a market where the reader is an IT person
checking a specific model number.
