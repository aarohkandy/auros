# ANTI-PATTERN: WUBI

**Already encoded as prohibition §4.1. Here because it is also a marketing case.**

---

## What happened

Wubi installed Ubuntu from inside Windows, as an easy on-ramp for nervous users. It was popular
precisely because it removed the scary part — no partitioning, no boot media, no commitment.

It also **destroyed people's data**, by writing before the data was safely elsewhere. The audience it
attracted was the one least equipped to recover.

Spec §4.1 names it directly: *"Wubi destroyed people's data by ignoring this ordering."*

## The marketing reading, which is the point of this file

**The feature that made it attractive is the feature that made it dangerous, and they were the same
feature.** "Easy, no commitment, from inside Windows" is a great headline and an unsafe architecture.

Our product has exactly this shape. *"One restart, every file intact"* is our most attractive sentence
and it describes the most dangerous operation we perform — on the only copy of somebody's files, on a
machine belonging to someone who was already nervous.

## What the spec does about it, and why it is a marketing decision

1. **Ordering is a prohibition, not a preference.** There must be a moment where the data exists in two
   places and the original disk is untouched (§4.1).
2. **The abort path is tested more than the happy path** (§6C). 100 clean runs, 20 induced failures,
   Windows still boots every time.
3. **"One restart" may never appear unqualified.** The honesty gate's `one-restart-unqualified` rule
   fails the build: it is false on BitLocker, TPM-1.2 and Secure-Boot-restricted machines (PLAN §3.6).

That third one is the important one for this folder. **The gate deliberately breaks our best headline**,
and the temptation to annotate past it will recur every time somebody writes copy.

## The rule

**The most attractive sentence about a dangerous operation is the one most likely to be an overclaim.**
Every time a piece of copy makes migration sound easy, that is the moment to check what it is promising
about the abort path.

Wubi's users did not lose data because the engineers were careless. They lost it because the product
promised something the ordering could not support, and the promise was what brought them in.
