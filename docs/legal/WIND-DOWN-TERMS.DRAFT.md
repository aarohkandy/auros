# Continuity commitment — DRAFT

> **DRAFT. NOT LEGAL ADVICE. NOT IN EFFECT. NOT PUBLISHED.**
> Written by the build agent to turn BLOCKED.md B11 from a blank page into something a human and a
> lawyer can review. It is a contractual undertaking, which is §9-reserved. **A lawyer must review this
> before any version of it is offered to a customer**, and the website's four references to it must not
> ship until one exists.

---

## A gap in D31 that drafting this exposed

D31 says: *"if we cease operating, each customer receives the build files for their own image."*

**Handing someone files they have no licence to use gives them nothing.** Under D30 everything is all
rights reserved. A school that received our recipe, Containerfile and build scripts on the day we
closed would hold copies they could not lawfully run, modify or build — which is exactly the situation
the commitment exists to prevent.

So the commitment cannot be *delivery*. It has to be a **licence that vests on a trigger**. That is the
real shape of it, and it is a better one:

- The repositories are **already readable** (D31). A customer can see and copy the files today; access
  is not the problem and needs no escrow.
- What they lack is the **right to use** them. That is what vests.
- Nothing about it grants anyone anything while we are operating, which was the whole objection to
  Apache.

**Recommendation for the human:** confirm this reading of D31, because it changes the words on the site
from *"you are given the build files"* to *"you are given the right to use them"* — a more precise and
more valuable promise.

---

## Draft terms

### 1. What this is for

The Customer owns their machines and the image installed on them, and it continues to boot whatever
happens to Auros. What would stop if Auros stopped is the rebuild that keeps the image patched. This
commitment exists so that the Customer can arrange for that to continue without us.

### 2. Handover Materials

"**Handover Materials**" means, for the Customer's own fleet only:

  (a) the Customer's recipe file;
  (b) the base image definition (`Containerfile`) and the build scripts it runs;
  (c) the configuration and policy files those scripts install;
  (d) documentation sufficient to build the image from (a)–(c).

Handover Materials **do not** include: the configurator, the order service, the migration installer,
the check-matrix harness, the fleet console, any signing key, any customer's data but the Customer's
own, or any other customer's recipe.

*[Lawyer: confirm whether (b) and (c), which are shared across every customer, can be licensed to each
customer individually for their own use without that amounting to a general release.]*

### 3. Trigger

The licence in §4 vests if **any** of the following occurs:

  (a) Auros is dissolved, wound up, or enters insolvency proceedings that are not dismissed within
      [60] days;
  (b) Auros publicly announces that it is ceasing to provide the maintained-image service; or
  (c) Auros fails to publish a successfully built image for the Customer's fleet for [90] consecutive
      days, having been notified in writing and given [30] days to cure.

*[Human: (c) is the one that matters in practice. Companies rarely announce their own death; they
simply stop. A trigger that requires an announcement protects no one. The numbers are placeholders.]*

### 4. The licence

On the Trigger, Auros grants the Customer a **non-exclusive, perpetual, royalty-free, non-transferable**
licence to use, copy, modify and build the Handover Materials **solely to maintain, patch and operate
the Customer's own machines**, including by engaging a third party to do so on the Customer's behalf.

It does **not** permit the Customer to sell, sublicense or redistribute the Handover Materials, or to
offer a maintained-image service to anyone else.

### 5. Access

Because the Handover Materials are held in repositories the Customer can already read, access does not
depend on Auros continuing to exist. Nonetheless:

  (a) the Customer may, at any time, keep their own copy of the Handover Materials for their fleet; and
  (b) *[Human: decide whether to add a third-party escrow. It costs money, and a readable repository may
      make it unnecessary — unless the hosting account itself would be deleted on dissolution, which it
      might be. See note below.]*

### 6. What this does not include

No support, no warranty, no obligation to keep the Handover Materials working against future upstream
releases, and no licence to any signing key. **A customer maintaining their own fleet after the Trigger
signs their own images with their own key.**

### 7. Relationship to open-source components

The image contains software licensed by third parties, including GPL and LGPL components from Fedora.
Nothing here limits any right the Customer already holds under those licences.

---

## Two practical risks the human should weigh

**The repositories may not survive us.** If the GitHub account is deleted when the company is wound up,
the "already readable" argument in §5 fails on the same day the licence vests. Cheapest mitigation:
each customer is told, at onboarding, how to mirror their own Handover Materials, and is encouraged to.
Second-cheapest: a small escrow arrangement. That spends money and is §9.

**The signing key.** A fleet that has been trusting our key will, after the Trigger, need to trust a new
one. That is a machine-side change the Customer must make, and it should be documented now — not
discovered by a school in the week it matters. Worth a short runbook alongside this.
