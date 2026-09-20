# CHROMEOS FLEX (and Neverware CloudReady before it)

**Steal: 9 · Fit: 10 · The company that already won this market.**

---

## The history that matters

Neverware sold CloudReady — ChromeOS on other people's old PCs — into schools for years, on exactly the
pitch we are considering: *your old machines are not dead, here is an OS that makes them useful.* Google
bought them and it became ChromeOS Flex, now free.

**Somebody already ran this experiment, and it worked well enough that Google bought it.** That is
strong evidence the market is real. It is also why our differentiation has to be somewhere other than
"old laptops, new OS", because that position is occupied by a free product from Google.

## What they do now

*"A version of ChromeOS made to modernize your school's existing PCs and Mac devices at no additional
cost"* ([Google for Education](https://edu.google.com/intl/ALL_us/chromebooks/chrome-os-flex/)).
Management runs through the Google Admin Console with Chrome Education Upgrade — the same console the
school already uses for Chromebooks.

## The one thing to steal

**The certified models list.** Google maintains and dates it — last updated 2026-09-02
([support.google.com](https://support.google.com/chromeosflex/answer/11513094?hl=en)) — with a
certification-start version and an end-of-support date per model.

Google is not a small company and this is the artifact they chose to maintain. In this market, **the
model list is the trust object.** A school IT person does not evaluate an OS; they check whether their
specific machines are on the list.

**And it is the positive half only.** A certification list says *this model passed*. It does not say
*the trackpad works, suspend does not, and here is the firmware setting that fixes brightness* — which
is what the person holding the machine actually needs. That gap is the opening described in
[`../data-as-marketing/backblaze-drive-stats.md`](../data-as-marketing/backblaze-drive-stats.md).

## Where a buyer genuinely picks them over us

- Fully browser-based, no local applications needed.
- Already in Google Admin; adding Flex is a smaller change than adding a vendor.
- Free.

**That is a real and common shape and we should say so.** Conceding the segment we would lose anyway is
the cheapest credibility available, and an IT person who sees us concede it believes the rest of the
page. `docs/outreach/PILOT-OFFER.md` already does this with Windows software; the same move applies
here.

## Where the shapes differ

Facts, not comparisons — the honesty gate's `comparative-superiority` rule means none of this may be
restated on the site as a claim against them:

- **Local applications.** Flex is the browser. Spec §1 is *"the ten or so applications your staff
  actually open"*, installed in the image.
- **Subtraction is not a concept they sell.** No removal report, no `must_remove_at_least` floor.
- **Data migration.** Installing Flex wipes the machine. Spec §4.1 requires a verified copy before any
  write, with hashes, and refuses to proceed otherwise.
- **Whose console.** Theirs is Google's. Ours does not exist and spec §6E says build it last.
- **Where the data goes.** A school with a reason to not put everything in Google Workspace is a school
  Flex cannot serve. That reason is more common outside the US than in it — and spec §1's flagship
  example is a Marathi-locale school.

## The lesson that applies most

Google's asset is the **list**, not the OS. Ours will be too. The difference is that they publish only
what passed, and we are already required by Gate 5's exit condition to publish *"at least one honest
✗"*.
