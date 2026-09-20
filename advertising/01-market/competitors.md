# WHO ELSE IS IN THIS ROOM

Retrieved 2026-09-20. Ordered by how much of our market they actually take.

> **Gate note.** The honesty gate's `competitor-absolute` and `comparative-superiority` rules mean
> **none of this analysis may be restated on the website as a comparison.** We have run no measurement
> against any of these products. This file exists to decide where to aim, not to supply copy.

---

## 1. Doing nothing — the largest competitor, and free

Spec §6D already names it. Now it has a price ladder and an expiry date
([the clock](the-clock.md)). Doing nothing is not irrational for a school until 2028; it is a
correctly-priced deferral. We win by being the thing they already know about when deferral runs out,
not by arguing they should stop deferring.

## 2. ChromeOS Flex — Google, free, aimed at exactly our buyer

*"A version of ChromeOS made to modernize your school's existing PCs and Mac devices at no additional
cost"* ([Google for Education](https://edu.google.com/intl/ALL_us/chromebooks/chrome-os-flex/)).
Compatible with most x86-64 PCs and Macs from the last 10+ years. Google maintains a **certified
models list**, last updated 2026-09-02
([support.google.com](https://support.google.com/chromeosflex/answer/11513094?hl=en)).

**This is the serious one.** Free, Google-backed, already in the school's admin console, and it
descends from Neverware CloudReady, which sold into this market for years before Google bought it.

Where a buyer would genuinely choose it over us: they are 100% browser-based, they already run Google
Admin, and they want zero cost. That is a real and common shape and **we should say so rather than
argue with it** — it is the single fastest way to be believed about everything else.

Where the shapes differ, factually, not comparatively:

| | ChromeOS Flex | What Auros is specified to do |
|---|---|---|
| Local applications | Browser and web apps | Applications installed in the image (spec §1) |
| What is removed | Not a customer-facing concept | The `remove:` block and a measured removal report (§6B) |
| Per-org customisation | Admin console policy | The recipe: locale, apps, policy mode, theme (§6B) |
| Data migration | Device is wiped | Verified copy before any write (§4.1) |
| Model support record | Google's certified list | `hardware/compat.tsv`, including the failures (§8) |
| Where management lives | Google's console | Not built. Spec §6E: last, after a real customer |

**The lesson to steal, not the market to fight:** Google publishes a certified models list and keeps it
current. That is proof that in this market **the model list is the trust artifact**. See
[`02-cases/adjacent-market/chromeos-flex.md`](../02-cases/adjacent-market/chromeos-flex.md).

## 3. Zorin OS — the closest positioning, and an instructive stall

Windows-shaped Linux aimed at people leaving Windows; an education page; a backer of the End of 10
campaign. Their fleet-management product **Zorin Grid was announced in January 2020**
([Zorin blog](https://blog.zorin.com/2020/01/16/introducing-zorin-grid-manage-all-of-your-organizations-computers-as-easily-as-one/),
[Forbes](https://www.forbes.com/sites/jasonevangelho/2020/01/16/meet-zorin-grid-a-slick-solution-for-businesses-ditching-windows-7-for-linux/))
and, per [Wikipedia](https://en.wikipedia.org/wiki/Zorin_OS), **remains unreleased as of April 2026.**

Six years of a pre-announced management product is the clearest available vindication of spec §6E
(*"Do not build this speculatively"*) — and a warning about announcing one.
[`02-cases/anti-patterns/zorin-grid.md`](../02-cases/anti-patterns/zorin-grid.md).

## 4. The End of 10 campaign — not a competitor, the nearest thing to a channel

Backed by Debian, Fedora, GNOME, KDE and Zorin. Message: *"Don't buy a new PC — revive yours with
Linux."* It connects people to **local volunteer groups and repair cafés** who will do the install in
person ([endof10.org](https://endof10.org/),
[Linuxiac](https://linuxiac.com/end-of-10-campaign-highlights-benefits-of-linux-transition/)). The
Restart Project ships a toolkit for repair groups
([therestartproject.org](https://therestartproject.org/end-of-windows-10-toolkit-for-repair-groups/)).

They have the demand and the goodwill and **no answer for a 40-machine fleet that needs to stay
patched for four years with nobody on site.** That is precisely our shape.

**The obstacle is real and it is ours:** this campaign is a free-software coalition and D30 made us
all rights reserved. Approaching it as a proprietary vendor without saying so is the kind of thing that
goes badly in public. Handled in [`03-analysis/what-would-make-this-fail.md`](../03-analysis/what-would-make-this-fail.md).

## 5. Refurbishers — a channel wearing a competitor's coat

PCs for People is a **Microsoft Authorized Refurbisher** and registers smaller **Third Party
Refurbishers**, who buy discounted Microsoft licences and pre-install Windows before resale
([PCs for People](https://www.pcsforpeople.org/third-party-refurbishers/)). The Turing Trust refurbishes
for schools and provides teacher training and maintenance
([turingtrust.co.uk](https://turingtrust.co.uk/give-computers/)).

So the channel is currently **locked to Microsoft economics** — cheap Windows licences are the reason
the model works. The crack in it is that those licences are for an OS that expires, on hardware that
cannot take its successor. See [`03-analysis/the-wedge.md`](../03-analysis/the-wedge.md).

## 6. Everything else, briefly

| | Why it is not the fight |
|---|---|
| **Ubuntu / Mint / elementary** | Distributions, not a maintained per-organisation image. No fleet answer, no migration guarantee, no compatibility record. |
| **Endless OS** | Nearest philosophical cousin, aimed at offline/low-connectivity education. Different geography, different problem. |
| **Intune / Jamf / managed Windows** | Manage machines that can already run the current OS. Ours cannot. Different product. |
| **New Chromebooks** | The real budget line we displace. This is the replacement-cost comparison spec §6D mandates, and the only one where our price wins outright for a school. |
| **Google Workspace itself** | Not a competitor — a **qualifier**. Spec §1's ICP is a browser-based org precisely because that is where our weakness (Windows apps) does not bite. |

## The honest summary

There is no competitor doing what spec §1 describes — a per-organisation image, subtraction as the
product, with verified migration and a published compatibility record. There are several doing
adjacent things with far more resources, and one of them is Google and free.

**We are not differentiated by the OS.** We are differentiated by the **recipe, the removal report and
the compatibility table** — three artifacts, all of which are marketing objects as much as engineering
ones, and none of which currently exists with a single real row in it.
