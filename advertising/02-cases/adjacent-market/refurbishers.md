# REFURBISHER NETWORKS

**Steal: 10 · Fit: 10 · The channel the spec does not mention.**

---

## What the channel is

A layer of nonprofits and small businesses that take donated and end-of-lease machines, refurbish them,
and sell or give them to schools, charities and low-income households.

- **PCs for People** is a **Microsoft Authorized Refurbisher (MAR)**, which lets it offer low-cost
  Windows and Office licences on the machines it distributes
  ([PCs for People](https://www.pcsforpeople.org/e-recycling/microsoft-authorized-refurbisher/)). It also
  **registers smaller Third Party Refurbishers (TPRs)**, who buy discounted Microsoft licences and
  pre-install genuine Windows before resale
  ([PCs for People — TPR](https://www.pcsforpeople.org/third-party-refurbishers/)).
- **The Turing Trust** wipes and refurbishes machines for schools, and provides **teacher training and
  maintenance support** alongside the hardware ([turingtrust.co.uk](https://turingtrust.co.uk/give-computers/)).
- Others in the same shape: Computers For Charities, Every Child Online, Human-I-T / Computers for a
  Cause ([Computing at School directory](https://www.computingatschool.org.uk/resources/2024/november/sources-of-recycled-it-equipment/)).

## Why this is the wedge

**They already have the pile.** Every other buyer in this market has to go and find the dead laptops.
The refurbisher's entire business is the pile.

**They have an acute problem with a date on it.** The MAR/TPR model works because Microsoft licences
are cheap for refurbishers. Two facts collide:

1. Machines from 2012–2018 largely **cannot run Windows 11** — TPM 2.0 and supported-CPU requirements
   are why they are in the pile.
2. The Windows 10 licence they *can* install is on an OS whose ESU ends **2028-10**
   ([the clock](../../01-market/the-clock.md)).

So a pallet of 2013 machines has **no OS with a future on it**. Not an expensive OS — no OS. The
machines become unsellable, and a refurbisher whose stock cannot be sold has a revenue problem, not an
IT problem.

**They are a channel, not just a customer.** One refurbisher touches dozens of schools and hundreds of
households. Landing one puts our image on every machine they ship, which is the difference between
selling 40 devices and selling 40 devices *per month, through someone else's sales motion*.

**They can say yes in days.** No procurement committee, no budget cycle, no board. It is cost of goods.

**They will find our weaknesses fast, which is what we need.** `docs/outreach/PILOT-OFFER.md` already
identifies this and gets the reason exactly right: *"they evaluate operating systems for a living —
which means they will find our weaknesses fast. That is a feature at this stage, not a risk."*

It ranks them **second**. The economics say **first**.

## The play, borrowed from Gusto

Gusto sells payroll to small businesses by selling to the **accountant** who already serves hundreds of
them — the intermediary has the trust, the relationship and the recurring reason to talk. See
[`../yc/gusto.md`](../yc/gusto.md).

The refurbisher is our accountant. They have the machines, the school relationships, and an
existing reason to be in the conversation.

## What they would actually need from us, and where we fall short

| They need | We have | Honest status |
|---|---|---|
| An OS they can put on stock with a future | The base image | **Not published.** Gate 1 |
| To know which models work before they buy a pallet | `hardware/compat.tsv` | **Zero rows.** Gate 5 |
| Per-customer configuration at volume | The recipe schema and compiler | Built, unproven at Gate 2 |
| Something that does not create support calls | Spec §11: Windows-shaped, zero-terminal | Built, untested on a human |
| A migration that does not lose donor data | The installer | **Does not compile yet.** Gate 3 |
| Not to be locked to a vendor who might vanish | D31 wind-down handover | Decided, **not written as a term** |

**Every row is a gate.** That is the honest read: the best channel we have is unreachable until Gates
1, 3 and 5 close, and pretending otherwise would put an unfinished product in front of the most
technically literate buyer in the market.

What is *not* blocked is the first conversation — and per `BLOCKED.md` B4 the lead time on that is
human, not computational.

## The one thing to check before betting the plan on this

**We have not spoken to a single refurbisher.** The entire wedge rests on an inference from published
licensing terms and hardware requirements, not from anybody in the business saying *yes, that is my
problem.*

It could be wrong in at least three ways, and each is cheap to check and expensive to assume:
- They may already install Linux on unsellable stock and consider it solved.
- They may be exiting old hardware entirely rather than trying to sell it.
- MAR terms may forbid or complicate shipping a non-Microsoft OS on machines in the programme.

**One conversation settles all three.** It needs a human (§9, real inbox), and it is the highest-value
twenty minutes available to this company right now — worth more than any code written this week,
because it either confirms the plan or saves six months.
