# GUSTO (YC W12) — sell through the intermediary

**Steal: 8 · Fit: 8**

---

## The play

Selling payroll software to small businesses one at a time is brutal: tiny deals, no budget, no buyer,
enormous support burden. Gusto's unlock was to sell to **accountants and bookkeepers**, who each serve
dozens or hundreds of small businesses, already hold the trust, and already have a recurring reason to
be in the conversation.

One relationship, many customers, and the recommendation arrives from someone the buyer already pays
for advice.

## Why it maps

Spec §1's ICP — *a nonprofit or small school with 25–200 dead laptops and one overworked IT person* —
has the same economics as a small business buying payroll. Each deal is small. Each one takes months.
Each one needs hand-holding. Reaching them one at a time does not work for a company with no sales team.

**Our accountant is the refurbisher.** They hold the machines, the school relationships, and a business
reason to care. Full analysis:
[`../adjacent-market/refurbishers.md`](../adjacent-market/refurbishers.md).

Secondary intermediaries worth the same thought: **managed service providers** serving several schools,
**regional education authorities and multi-academy trusts**, and **TechSoup** for the nonprofit half
([`../../01-market/buyers-and-channels.md`](../../01-market/buyers-and-channels.md)).

## What makes an intermediary say yes, which is not what makes an end customer say yes

- It must make them **money or time**, not just be good for their client.
- It must not create **support load** they carry — the reason our zero-terminal directive (§11) and the
  abort-safe installer are commercial features, not engineering ones.
- It must not make them **look bad** if it fails, which is why `hardware/compat.tsv` matters more to a
  refurbisher than to a school: they need to know *before* buying a pallet.

## The trap

An intermediary channel takes longer to build than direct sales and looks like nothing for months. It
is the right long game and the wrong thing to be the *only* thing. The plan in
[`../../04-plan/STRATEGY.md`](../../04-plan/STRATEGY.md) runs it alongside direct pilots rather than
instead of them.
