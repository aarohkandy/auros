# GITLAB (YC W15) — the handbook as distribution

**Steal: 9 · Fit: 7**

---

## The play

GitLab publishes its **handbook** — how the company operates, how it makes decisions, its strategy, its
compensation bands — in public, as the default. Not a marketing site: the actual internal document,
readable by anyone including competitors.

Two things came out of it. It ranked for an enormous range of *"how do you run a company"* searches
made by exactly the people GitLab wanted to hire and sell to. And it functioned as a credibility
argument that no amount of advertising buys: a company willing to show its own workings is making a
costly, hard-to-fake signal.

## Why it maps, and the part that is uncomfortable

**We already write to this standard and publish none of it as marketing.**

`DECISIONS.md` is 36 KB of decisions with their reasoning, including the ones that were wrong.
`BLOCKED.md` names eleven things we cannot do and why. `PROGRESS.md` lists **defects found in our own
work** — a probe piped through `tail` so a failing build scored as passing; sixteen shell-injection
sites; a security check that could never fail; a workflow that was silently invalid. `GATE.md` has a
section literally titled *"Not proven, and not claimed"*.

There is no marketing agency that could write those documents, because their credibility comes
entirely from the fact that they were written for us, before anybody was reading.

**The uncomfortable part:** they are already public — the repos are public (D31) — and nobody has ever
been pointed at them. The asset exists and is unlinked.

## What to do with it

1. **Link the record from the site.** Not a curated "engineering blog". The actual files, as they are.
   The value is in them being unretouched.
2. **The best single artifact is D30 itself.** We changed our licence, it broke the central promise on
   our own website, and we wrote that down as *"all of that is now false"* and filed it as a blocker
   against ourselves. A buyer worried about vendor trust learns more from that one entry than from
   anything we could assert.
3. **`GATE.md`'s "Not proven, and not claimed" is the single most persuasive paragraph we own.** It
   should be reachable from the front page, and it is exactly the state banner `CLAIMS.md` asks for
   (**A7**).

## The limits, honestly

- GitLab had a product and users when the handbook became a growth asset. Transparency amplified a
  working company; it did not substitute for one.
- The audience is narrow. A school IT director will not read `DECISIONS.md`. **A refurbisher's
  technical lead will** — which is another reason the wedge points there.
- It is not reversible. Publishing the record and then going quiet when things get bad is worse than
  never having started, because the silence is itself legible.

## The specific risk for us

We are all rights reserved (D30) and building on open-source. The radical-transparency move from a
proprietary vendor invites the question *"if you are so open, where is the licence?"*

The answer has to be ready and it has to be the real one: **the code is ours, the image's GPL and LGPL
components carry rights we cannot withhold and do not claim to, and if we cease operating you get your
build files.** `LICENSING.md` already says all of this, plainly, including the part where we do not
control the image's components. That document is itself part of the asset.
