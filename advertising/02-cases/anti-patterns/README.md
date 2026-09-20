# ANTI-PATTERNS

The failures are closer to home than the successes. **Two of these four are about things we have
already done or are about to do.**

| Case | The failure | The rule it produces |
|---|---|---|
| [Zorin Grid](zorin-grid.md) | Console announced Jan 2020, unreleased Apr 2026 | Never advertise the console. No roadmap, no waitlist. Spec §6E was right |
| [The licence reversal](licence-reversals.md) | **Ours.** D30, and 25 stale claims left behind | Re-read the claims ledger on a schedule. Never build the trust argument on something revocable |
| [Wubi](wubi.md) | Wrote before verifying; destroyed user data | The most attractive sentence about a dangerous operation is the likeliest overclaim |
| ["Year of the Linux desktop"](year-of-linux.md) | 20 years of advocacy; 4.7% share | Never sell the OS. Sell the absence of a problem they already have |

## The pattern across all four

Each failure is a **claim that outran the thing it described** — a console announced before it was
built, a licence promise that outlived the licence, an easy-install promise the ordering could not
support, and an ideology sold to people who did not want one.

This company already has all the machinery to catch this: `tools/honesty-gate.mjs`, `CLAIMS.md` with its
evidence column, `GATE.md`'s *"Not proven, and not claimed"*, and `BLOCKED.md`.

**And it still shipped 25 stale claims**, because the machinery was pointed at the copy rather than at
the gap between the copy and reality, and because nothing forced a re-read. That gap is where every
case in this folder lives.
