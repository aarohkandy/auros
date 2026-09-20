# WHAT WE MAY CLAIM TODAY

Dated 2026-09-20, at Gate 1. **This file expires.** Every row moves as gates close, and a row that has
not been re-read against reality is the exact failure mode that put 25 licence-grant violations on the
website — sentences that were true when written.

---

## The blanket condition

`auros-web/src/content/CLAIMS.md` already states it and it governs everything here:

> This site must not be published to a public address before Gates 1, 2 and 3 are true. Until then,
> every present-tense sentence about image signing, rollback, prune assertions, the check matrix and
> the verified-copy installer is a description of a design rather than a report of a measurement.

**Advertising consequence:** there is no campaign to run yet, because there is nothing that has been
observed to work. What there is, is a set of things that are true *now* and that are worth publishing
*now* — and they are all measurements, not promises.

## Green — true today, evidenced, publishable

| Claim | Evidence |
|---|---|
| A derived image builds and `bootc container lint` passes | [run 35538612202](https://github.com/aarohkandy/auros-base/actions/runs/35538612202) |
| A qcow2 built from it boots under KVM to a running system in ~30s | [run 35539867513](https://github.com/aarohkandy/auros-base/actions/runs/35539867513), `docs/evidence/2026-09-20-boot-path.md` |
| The upstream base is 3.5 GB compressed | `docs/evidence/2026-09-20-runner-probe.md` |
| `bootc-image-builder` produces a 4.4 GB qcow2 in ~7 min given a ≥20 GiB root | D26 |
| No untested image can publish; the gate fails closed and was verified able to go red | `tools/gate.mjs`, 59 tests |
| No fabricated social proof can ship; likewise verified red | `tools/honesty-gate.mjs` |
| A `vm` row in `compat.tsv` cannot claim a physical-only column | `tools/compat-lint.mjs` |
| Nothing outside `internal/safety` can reach the system disk | Go import-graph test, asserted non-vacuous |
| Microsoft's published ESU prices and dates | [the clock](../01-market/the-clock.md) |
| Our own prices | `auros-web/src/content/tiers/` |
| Our own defects, decisions and reversals | `DECISIONS.md`, `PROGRESS.md`, `BLOCKED.md` |

**The last row is the interesting one.** The published record of our own mistakes is the only asset we
have that a competitor cannot copy and that requires no customer to exist. See
[`03-analysis/positioning.md`](../03-analysis/positioning.md).

## Amber — true of the design, not yet of a machine

Sayable **only** in the explicit future or conditional, and only with the state banner CLAIMS.md
demands: nightly rebuilds · signed images · automatic rollback · the measured removal report ·
verified migration · four policy modes · kiosk with no shell in the image.

Every one of these is built or building. None has been observed end to end on a machine anybody owns.
Writing them in the present tense is the same category of untruth as a fabricated testimonial, and
CLAIMS.md says so in those words.

## Red — may not be claimed at all, and the gate will catch the attempt

| Forbidden | Rule | Why |
|---|---|---|
| Customers, testimonials, logos, case studies | `social-proof` | We have none |
| Device counts in the field | `device-count`, `device-count-across` | The 180/40/62 are illustrative and must be labelled |
| Any savings figure or bare percentage | `savings-figure`, `unqualified-percent` | Supply the arithmetic, never the answer |
| "One restart", unqualified | `one-restart-unqualified` | False on BitLocker / TPM-1.2 / restricted Secure Boot |
| Any blanket .exe compatibility | `blanket-exe`, `office-adobe-claim`, `winapps` | Office rates Garbage, Photoshop Silver on WineHQ (D16) |
| **Any licence grant — "public git repo", "clone and rebuild it yourself"** | `licence-grant`, `public-recipes` | D30/D31. **25 live instances found.** See below |
| "Guarantee" | `guarantee` | No operating history |
| A history of images to roll back through | `multi-rollback` | bootc keeps booted + exactly one (D10) |
| Absolute claims about competitors | `competitor-absolute` | We have surveyed none |
| "Better/safer/stronger than X" | `comparative-superiority` | No measurement against X exists |
| "Usually", "most", "in our experience" | `worded-frequency`, `implied-track-record` | `compat.tsv` has no rows |

## The 25, and why they matter more to advertising than to engineering

The honesty gate's two new licence-grant rules found **25 places** where the site still offers a right
D30 withdrew (`PROGRESS.md`, 2026-09-20 late). `docs/outreach/EMAIL-DRAFT.md` and
`docs/outreach/PILOT-OFFER.md` carry the same problem — both versions of the first-contact email and
the one-pager close on the promise that the reader can rebuild the OS from a public file without us,
worded three different ways, and **it is the load-bearing sentence in all three.** The gate catches two
of the three and misses Version B entirely
([details](honesty-gate-for-marketing.md)).

So this is not a find-and-replace. **The single strongest trust argument in our outreach is a right we
no longer grant**, and the replacement (D31's wind-down handover) is narrower and has to do the same
job. Rewriting it is a messaging problem, and it is the first item in
[`04-plan/messaging.md`](../04-plan/messaging.md).

## The rule that makes this survivable

Every forbidden row above has a permitted neighbour that is usually *more* persuasive:

| Instead of | Say |
|---|---|
| "Trusted by schools" | "We have no customers. Here is what we have measured." |
| "Save $X per device" | Both published price ladders, sourced and dated |
| "Runs your Windows apps" | The named list of what does not come across, above the fold |
| "Clone it and rebuild it yourself" | "If we cease operating you receive your build files" |
| "Better than the alternatives" | What we do, in specifics, and their documentation next to it |
| "Proven on hundreds of machines" | `compat.tsv`, with the ✗ rows visible |

Every one of those substitutions trades a claim the reader discounts automatically for a fact they can
check. In a market where the buyer has been oversold by vendors for twenty years, that is not a
handicap.
