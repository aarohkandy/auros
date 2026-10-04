# Licensing

**Auros source code is proprietary. All rights reserved.** No licence is granted to anyone.

Changed 2026-09-20 on the owner's instruction, from Apache-2.0. Exposure was ~90 minutes with **zero
forks and zero stars** on all five repos, so nothing was taken under the permissive terms.

---

## What we own, and can keep

Everything we wrote. The recipe schema, compiler and validator; the base image's Containerfile and build
scripts; the hardening and policy layers; the check-matrix harness; the migration installer; the website
and the order Worker; the compatibility table.

Aurora is **Apache-2.0**, which is permissive: it lets us build on it commercially, keep our changes
private, and never publish anything. It does **not** oblige us to open-source derivatives. Building on
Aurora costs us nothing in ownership.

## What we cannot control, and must not claim we can

**The operating system image we hand a customer contains GPL and LGPL software**, because Fedora does.
Those licences grant the *recipient* rights we are not able to withhold:

- A customer who receives an image is entitled to the corresponding source for its GPL/LGPL parts.
- They may redistribute those parts.
- Any term of ours purporting to forbid that is void as to those components.

This is the ordinary position of every company shipping a Linux appliance — Synology, Ubiquiti, every
Android OEM. It is not a flaw in the plan and it does not stop this being a product.

**What it means concretely:**

| | Can we keep it closed? |
|---|---|
| Our recipes, compiler, installer, harness, site | **Yes.** Entirely ours. |
| Our base image's build scripts and policy | **Yes.** |
| The *built image* handed to a customer | **No, not the GPL parts.** Recipients hold rights directly. |
| Aurora and Fedora underneath | Not ours either way; already open. |

**The moat is not the licence.** A competitor with our recipe file still lacks the nightly rebuild
pipeline, the signed publish chain with a check matrix that can actually fail, the hardware
compatibility table, and the customer relationships. Those are the assets. The recipe file is the least
valuable thing we produce, and it is also the part we cannot fully lock down.

## Open conflict: the website currently advertises the opposite

Spec §1.3 made replaceability a headline feature — *"every recipe is a public git repo; if we vanish,
you rebuild your exact OS from the file. This is a feature we advertise."* The site is built on it:

- `faq/1-if-you-disappear.md` answers "what happens when you go out of business" with **clone-and-build
  instructions**.
- `pages/5-replaceable-on-purpose.mdx` is an entire page about it.
- The landing page closes with *"We are replaceable on purpose."*
- `auros-recipes/.github/workflows/replaceable.yml` is a CI job that **executes** that promise weekly.

With proprietary licensing and private repos, **every one of those is now false**, which is a §4.2 and
§4.4 violation — claiming something we do not do. It must be resolved before anything ships.

This is a **§9 decision for the human**, recorded in DECISIONS.md D30, not something to quietly rewrite.
