# ANTI-PATTERN: THE LICENCE REVERSAL

**We have already done this. 2026-09-20, D30. This file is about us.**

---

## The pattern

A company builds an audience on permissive licensing, then narrows it — Apache or MIT to
source-available, BSL, or proprietary. The pattern is well established, and the reaction is too: a
public backlash, forks, and a durable loss of trust with the technical audience, whether or not the
business reasoning was sound.

The damage is rarely about the licence terms themselves. It is about the **reversal** — people who
built on a promise discovering the promise was revocable.

## What we did

| | |
|---|---|
| **Exposure** | ~90 minutes under Apache-2.0 |
| **Forks** | **Zero** |
| **Stars** | **Zero** |
| **Users affected** | **Nobody** |
| **Recorded as** | D30, with the owner's verbatim reasoning |

**We got away with it completely**, and the reason is luck of timing, not judgement. Ninety minutes.

The agent's own note in D30 is the useful part: *"I should have surfaced this as a §9 business decision
instead of choosing. Which licence a company ships under is a business decision wearing a technical
costume."*

## The residue, which is real

The licence reversed cleanly. **The claims did not.**

- **25 places on the website** still offer the withdrawn right, found by two new honesty-gate rules.
- **Both outreach email drafts** close on it, and in both it is the load-bearing sentence.
- A CI job, `replaceable.yml`, **executed the promise weekly** and is now paused.
- Spec §1.3 still says replaceability is *"a feature we advertise."*

That is the anti-pattern in its real form for us: not angry forum threads, but **a marketing apparatus
still running on a promise that was withdrawn**, discovered only because somebody wrote a new rule and
pointed it at old text.

## The three rules this produces

**1. The claims ledger has to be re-read against reality on a schedule, not on a hunch.** Every one of
the 25 was true when written. `CLAIMS.md` has a *"Last reviewed"* date; nothing enforces that it moves.

**2. Never build the central trust argument on something revocable.** Replaceability was the answer to
*"what if you disappear"*, and it evaporated with one commercial decision.

D31's replacement — *if we cease operating you receive your build files* — is a **term**, which is only
as good as the entity offering it. That is weaker than a licence and it is what we have. It must be
written and published as an actual term, not a sentiment on a page, or the next honesty audit finds it
the same way it found these.

**3. If we ever open anything, assume it is permanent.** Whatever is permissively licensed cannot be
taken back without paying this cost with an audience that actually exists next time.

**Which is why `BLOCKED.md` B9's option 3 — open-source `auros-recipes` — deserves more caution than
its low cost suggests.** The cost is not the schema. The cost is doing this again, later, in public,
with users. See [`../../00-constraints/human-decisions.md`](../../00-constraints/human-decisions.md) A2.
