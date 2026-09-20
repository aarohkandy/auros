# auros

Custom operating systems for machines that still work.

Schools and nonprofits have piles of laptops from 2012–2018 that modern Windows has abandoned. They are
not broken. They are orphaned. We sell a Linux image containing **only what that organisation asked
for**, in their language, under their rules, installed in one restart with every file intact — and
rebuilt every night so it is still patched in four years.

**This is the control repo.** The product lives in four public repos:

| Repo | What it is |
|---|---|
| [auros-base](https://github.com/aarohkandy/auros-base) | The one hardened base image. Exactly one, forever. |
| [auros-recipes](https://github.com/aarohkandy/auros-recipes) | One directory per customer. YAML in, image out. |
| [auros-installer](https://github.com/aarohkandy/auros-installer) | Windows-side migration, Linux-side restore. |
| [auros-web](https://github.com/aarohkandy/auros-web) | Site, configurator, order intake. |

## We are replaceable on purpose

Every recipe is a public git repo. If we vanish tomorrow, a customer rebuilds their exact operating
system from a ten-line file. That is not a concession — it is the reason to trust us with a fleet.

## What's in here

`PLAN.md` · `DECISIONS.md` · `GATE.md` · `TASKS.md` · `BLOCKED.md` · `PROGRESS.md` ·
[`hardware/compat.tsv`](hardware/compat.tsv) — one row per machine we have actually observed, and an
honest empty cell for everything we haven't.
