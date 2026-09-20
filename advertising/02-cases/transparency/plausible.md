# PLAUSIBLE ANALYTICS — positioning against a free giant

**Steal: 9 · Fit: 9 · The closest strategic analogue to our ChromeOS Flex problem.**

---

## The situation they were in, which is ours

Plausible sells web analytics. Their competitor is **Google Analytics, which is free, dominant, and
already installed.**

That is structurally identical to our position against [ChromeOS Flex](../adjacent-market/chromeos-flex.md):
free, from Google, aimed at the same buyer, already in the admin console.

## What they did

1. **They did not compete on price.** Competing with free on price is a losing argument and makes you
   sound cheap rather than different.
2. **They competed on a property the giant structurally cannot offer.** Google's business model *is*
   the data. Privacy was not a feature Google had neglected; it was one Google could not provide
   without ceasing to be Google. Plausible chose the axis where the incumbent's strength is the source
   of the weakness.
3. **They ran as an "open startup"** — public revenue dashboard, public roadmap, public reasoning.
4. **They said plainly who should not buy.** If you need the full feature surface of Google Analytics,
   they tell you to use Google Analytics.

## The lesson, precisely stated

**Find the axis where the free incumbent's business model prevents them from following you.**

Not a feature they have not built yet — they will build it. A property they **cannot** offer without
becoming a different company.

## Applying it to us

Where can ChromeOS Flex *not* follow, structurally?

| Axis | Can Google follow? |
|---|---|
| **Price** | Yes, trivially. They are already free. **Do not compete here.** |
| **Local applications** | Partly, and it cuts against ChromeOS's entire architecture and business logic |
| **Per-organisation subtraction** — an image built for one org, with a measured removal report | **No.** ChromeOS is one OS for everybody; per-customer image building is the opposite of their economics |
| **Verified data migration before any write** | Unlikely. Their install wipes the machine, and changing that is a large cost for a small segment |
| **An honest compatibility record including failures** | **No.** Google publishes a certified list — the positive half. A list of what is broken on which model is not something a platform vendor publishes about itself |
| **Data not going to Google** | **No.** Definitionally |

**Two clean axes: per-organisation subtraction, and the honest failure record.** Both are already the
spec's core (§1.2 *"craft here is subtraction"*, §8 *"build `compat.tsv` from hour one"*). Neither was
chosen because of Google. That they also happen to be un-followable is the thing worth noticing.

## The part we should copy immediately and nearly free

**Say plainly who should not buy from us.** Plausible sends people to Google Analytics. Our equivalent:

> *If your staff and students work entirely in a browser and you already run Google Admin, ChromeOS
> Flex is free and it is probably the right answer. This is for the case where the machines need
> applications installed on them, in your language, configured your way — and where somebody has to be
> able to show what is on them.*

That paragraph costs us the customers we would have lost anyway and buys credibility with everyone
else. `docs/outreach/PILOT-OFFER.md` already does exactly this move with Windows software (*"if the
machines need Windows software, this is the wrong product and I will say so"*), and it is the best
sentence in the document.

## The open-startup half

Plausible's public revenue dashboard works because the numbers go up. Ours would be zero.

**Publishing a zero is a different act than publishing a number**, and it is not obviously wrong — but
it is a §9 decision and not one this folder should make. What transfers without that risk is the
*reasoning* being public, which we already do in `DECISIONS.md`, and which
[GitLab's handbook](gitlab-handbook.md) covers.
