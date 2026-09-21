# AUROS — BUILD SPEC (canonical)

> The contract. Amendments live in `DECISIONS.md` and are marked here inline as **[AMENDED → Dn]**.
> Original placeholder name "Lathe" is now **Auros** (D1).

## 1. WHAT WE ARE SELLING

Schools and nonprofits have piles of laptops from 2012–2018 that modern Windows has abandoned. They are
not broken. They are orphaned.

We sell them a Linux image that contains **only what that organisation asked for**, in **their language**,
under **their rules**, installed in **one restart with every file intact**, and **rebuilt every night** so
it is still patched in four years.

Three sentences that must stay true of everything we build:

1. **The OS is not the product.** The maintained image and the fleet console are the product. The
   configurator is a storefront.
2. **Craft here is subtraction.** A machine with eleven applications instead of three hundred is the
   entire value proposition. Anything the customer didn't ask for is *deleted from the image*, not hidden
   behind a settings menu.
3. **We are replaceable on purpose.** Every recipe is a public git repo. If we vanish, the customer
   rebuilds their exact OS from the file. This is a feature we advertise.

First customer profile: a nonprofit or small school with 25–200 dead laptops, already living in Google
Workspace or a browser-based system, with one overworked IT person.

## 2. WHAT WE INHERIT

| We inherit | We do not build |
|---|---|
| Fedora + `bootc` (OS as an OCI container image) | A kernel, bootloader, init system, or package manager |
| Universal Blue base images (`ghcr.io/ublue-os/aurora`) | A distribution |
| `bootc-image-builder` (OCI image → bootable ISO/raw) | An image-building toolchain |
| Flathub (userspace apps, self-updating) | An app store |
| GitHub Actions + GHCR (build + registry, free) | CI infrastructure |

## 3. ARCHITECTURE — NON-NEGOTIABLE

```
   ghcr.io/ublue-os/aurora:stable            UPSTREAM — not ours, patched by others
              │ FROM
              ▼
   ghcr.io/aarohkandy/auros-base:hardened    OURS. EXACTLY ONE. Policy + hardening + agent.
              │ FROM                         Rebuilt nightly against upstream.
     ┌────────┼────────┐
     ▼        ▼        ▼
  lincoln  hopelink  westside                CUSTOMER RECIPES — ~10 lines of YAML each.
     │        │        │                     Rebuild automatically when base moves.
     ▼        ▼        ▼
  180 mach. 40 mach.  62 mach.               Pull on next boot. Previous image stays on disk.
```

Rules this implies, which may not be violated:

- **There is exactly one base image.** Not one per customer, not one per hardware generation. One.
- **A customer recipe may only ADD.** Install packages, set locale, apply policy, apply theme, prune
  packages. It may **never** change the `FROM` line, pin a different kernel, patch a driver, or hold back
  a package version. A customer who needs that is a customer we decline. Surface it to the human as a
  decision, never solve it by forking.
- **CVE response is one rebuild.** Base rebuilds → all children rebuild → all machines update on next
  boot. If patching ever requires touching more than one file, the design is wrong.
- **Userspace apps come from Flathub, not the image.** They update themselves and are explicitly not our
  security surface. The image owns everything that can root the machine; Flatpaks own everything else.
- **An unsigned or untested image can never reach a customer.** Enforced mechanically (CI gate), not by
  convention.

**[AMENDED → D2]** `FROM` is the **source-level and rebuild-graph** contract, not a promise about OCI blob
layout. We flatten at publish (`rechunk`) so that pruned packages are bytes the customer never downloads.
"CVE response is one rebuild" is fully preserved — it is a statement about the build graph.

## 4. HARD PROHIBITIONS

1. **Never write to a customer's system partition before their data has been copied off it AND verified
   by file count and hash.** There must be a moment where the data exists in two places and the original
   disk is untouched. Wubi destroyed people's data by ignoring this ordering.
2. **Never claim an app migrates when it doesn't.** Windows programs do not migrate. Files, browser
   profiles, Wi-Fi credentials, printers and accounts do. Say so everywhere, prominently, including on
   the landing page.
3. **Never publish an image that has not booted in a VM and passed the full check matrix.** Enforce with
   a CI gate that cannot be overridden by a flag.
4. **Never fabricate social proof.** No invented case studies, customer logos, testimonials, device counts
   or savings figures on the website. If we have no customers, the site says what a build *looks like*,
   framed as illustration, labelled as such.
5. **Never use remote images, external fonts beyond Google Fonts, or any script host other than cdnjs on
   the public site.**
6. **Never spend money, send an email to a real person, charge a card, or write to real hardware** without
   explicit human approval in that session.
7. **Never test the migration installer against the operator's own machine.** Windows in a VM, with
   synthetic files, destroyed repeatedly.

## 5. REPOSITORY LAYOUT

`auros-base` · `auros-recipes` (PUBLIC) · `auros-installer` · `auros-web`.
Agent working state lives at repo root, **never under `.claude/`**. **[See D6]** `aarohkandy/auros` is the
meta/control repo holding state, docs and `hardware/compat.tsv`.

## 6. WORKSTREAMS

### A — auros-base
- Single `Containerfile` inheriting from a **pinned Universal Blue digest**, plus hardening and policy.
- Nightly GitHub Action: rebase on upstream, rebuild, run the VM check matrix, publish to GHCR **only on
  a full pass**.
- Images signed (cosign, keyless). Signature verification enforced at install time. **[AMENDED → D8/D17]** signing is keyed, with a key pair (`auros-base/signing/README.md` §1). <!-- auros-allow: original contract wording, amended inline -->
- Machine-side update agent: pulls on boot, stages, keeps the previous image on disk, **rolls back
  automatically if the new image fails to reach a login prompt twice.**
- Policy declarative and switchable per-recipe: `open` / `managed` / `locked` / `kiosk`. Kiosk means **no
  desktop shell exists in the image at all.**

**Exit condition (binary):** push a trivial change to the base; within 20 minutes, without human action, a
downstream test recipe has rebuilt and a running VM has picked up the new image on reboot. Then
intentionally break the base; the VM must **refuse** the update and stay on the old image.

### B — auros-recipes
- `recipe.yaml` schema a **non-engineer can read**: name, base, locale, keyboard, install list, prune
  list, policy, theme, branding, hardware profile.
- Compiler YAML → Containerfile. Deterministic. **[AMENDED → PLAN §3.3]** "byte-identical" is not
  attainable against a moving upstream; the gated property is *same recipe + same pinned base digest ⇒
  same content digest*, verified by building twice in one run.
- **The prune list is first-class.** The schema must make it trivially easy to express "remove everything
  except these eleven things", and the build output must report exactly what was removed. This is the
  product; it is not an afterthought.
- A hardware profile per customer selects a QEMU test machine definition.
- Schema validation **rejects** anything that would change the `FROM` line or pin a package version. That
  rejection is a feature.

**Exit condition:** three visibly different recipes (180-machine Marathi-locale school; 40-machine English
kiosk fleet; one dense developer desktop) build from the same base, boot, and differ in every way the YAML
says they should and **in no way it doesn't**.

### C — auros-installer

**Windows side** — single executable, no runtime dependency, no installer of its own:
1. Inventory user data: Documents, Desktop, Pictures, Downloads, browser profiles, Wi-Fi profiles, mapped
   printers, account name.
2. Show the user what it found and what it **cannot** bring (installed programs, by name, from the actual
   installed-programs list). Require acknowledgement.
3. Copy to a destination that is **not the system disk**. Refuse to continue if none exists with space.
4. Verify by file count and per-file hash. **Any mismatch aborts and changes nothing.**
5. **Only then** write the bootable image, set one-time boot, restart.

**Linux side:** restore from the verified archive on first boot, re-verify, report the count on the desktop.

**Optional:** keep Windows, add a boot menu entry. **[AMENDED → PLAN §3.7a]** offered only *after* the
verified archive exists, and described as strictly more dangerous than a clean install, not as the
cautious choice.

**Exit conditions:** 100 consecutive runs against a Windows VM with 18,000 synthetic files — 100 successes,
zero files lost, zero corrupted. 20 runs with induced failure (power cut mid-copy, USB pulled, disk full,
hash mismatch) — 20 clean aborts, Windows still boots normally every time, zero data loss.
**The abort path is tested more than the happy path.**

### D — auros-web
Static site, one serverless function. Astro, static output, Cloudflare. No client-side framework for
content pages.

- Landing page, live configurator, order flow, pricing, FAQ.
- The configurator's output panel renders the customer's answers as **the actual `recipe.yaml`, live as
  they choose** — including the `remove:` block naming what gets deleted. **This panel is the single most
  persuasive object on the site. Nobody else selling a computer shows you what they took out.**
- **An order opens a pull request.** The Worker takes the submitted spec, creates
  `auros-recipes/<customer>/recipe.yaml` on a branch, opens a PR, emails the operator. The order literally
  becomes the build. Stripe Checkout, charged **only after the test build passes**.
- Pricing: one machine **$79 one-time**; school/nonprofit **$15 per device per year, 25 minimum**;
  business fleet **$12/device/month, 10 minimum**; single-purpose **$19/device/month, 5 minimum**;
  self-serve **$0** (recipes are public). **Prices are §9-reserved; do not change them.**
- The school tier must display the **replacement-cost comparison** alongside it. Our real competitor is
  doing nothing, which is free.
- Above the fold: a column titled ***what doesn't come across***, naming Windows programs explicitly.
  This converts organisations; hiding it loses them at month two.
- Lighthouse ≥ 95 on mobile. Full keyboard operation. Works with JS disabled down to a mailto fallback.

**Exit condition:** a person who is not the operator configures a 40-device school build on a phone,
submits, and a PR appears in `auros-recipes` with valid schema-passing YAML matching exactly what they chose.

### E — auros-console
Build **last**, only after a real customer exists. List machines, show image/version, push a recipe change
to all, lock or wipe a lost device. Nothing more. **Do not build this speculatively.**

## 7. WEBSITE DESIGN SYSTEM — fixed, not open to reinterpretation

### The concept
**The background is a pixel-art cross-section of the earth, and it IS the architecture diagram.** Sky and
trees at the top; as the visitor scrolls they descend through rock strata. Each stratum is a layer of the
image stack, labelled in the margin as they pass it:

```
  ☁        ☁              ── sky ──         hero: "an OS with only what you asked for"
 ♠  ♠  ♠  ♠  ♠            ── surface ──     your machine
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓          ── topsoil ──     your apps, your language, your look
▒▒▒▒▒▒◆▒▒▒▒▒▒▒▒▒          ── stratum 1 ──   your recipe        ◆ = ore, accent colour,
▓▓▓▓▓▓▓▓▓▓◆▓▓▓▓▓          ── stratum 2 ──   auros-base:hardened    marks layer boundaries
████████████████          ── bedrock ──     Fedora · Universal Blue
```

Decorative pixel art is slop. Pixel art that *is* the explanation is not. **The background must always be
carrying meaning, never just vibes.**

### Rules
**Rendering.** Procedurally generated to a `<canvas>` at load from a **fixed seed** — identical on every
visit, it is the brand. No image files, no sprite sheets, no remote assets. Logical block size **4 CSS px**,
`image-rendering: pixelated`. Terrain heights from layered value noise, quantised to the block grid.
**Render once offscreen; scroll parallax via `transform` only, never redraw.**

**Palette.** Maximum 18 colours. Muted and earthy — not Minecraft's saturation.
```
sky        #C9D6DE  #D6DCDC  #E2DDD0  #EFE6D4   (stepped bands, never a CSS gradient)
cloud      #F4F1EA  #E6E0D2
far hills  #A8AFA2  #8E968C
trees      #6E7A66  #57624F
grass      #7D8A63
soil       #8A7358  #6F5C46
strata     #5A4E40  #463E34  #33302A  #24231F
ore/accent #BE3A12  #D9682E   (sparse — under 2% of pixels, only at layer boundaries)
```
Dark theme: sky becomes `#171C24 / #1E242C` with single-pixel stars; strata darken; ore stays.

**Typography (on top, unchanged).** Display: **Instrument Serif**. UI: **IBM Plex Sans**. Anything
factual — specs, prices, config, logs: **IBM Plex Mono**. The collision of editorial serif against 16-bit
terrain is the whole identity. **Do not "harmonise" them by making the type pixelated too** — that
collapses it into a game landing page.

**Ink.** No gradients (the stepped sky is not a gradient). No drop shadows. Border radius ceiling **3px**.
Hairline 1px rules are the only divider. All body text sits on **opaque panels** — the background never
reduces text contrast.

**Motion.** Only things reporting a real fact may move. Permitted: scroll parallax; clouds drifting
(≤ 2px/sec); the build console streaming real pipeline output. Forbidden: hero animations, glowing orbs,
pulsing gradients, particles, custom cursors, scroll-jacking, anything that exists to look alive.
**The overcorrection against generic design is adding visual noise; restraint is the correction.**

**The build console** replaces every decorative animation impulse. It streams genuine build output —
`pruning 214 packages`, `booting test vm`, `✓ wifi associates`, `signed · cosign keyless` **[AMENDED → D8/D17: keyed]**. <!-- auros-allow: original contract wording, amended inline --> It is more
interesting than any animation and it is true.

**Accessibility.** `prefers-reduced-motion`: static render, no parallax. `prefers-color-scheme` respected
with a manual override. **WCAG AA contrast on every text/panel pair, verified not assumed.**

## 8. HOW TO WORK

- **Subagents** for anything parallel and isolated. Each returns pass/fail plus a log, nothing else.
- **Skills**, not subagents, for reusable procedures: `recipe-compile`, `vm-check-matrix`, `driver-triage`,
  `theme-generate`.
- **Hooks as the hard gate.** A `PreToolUse` hook must refuse any image publish where the VM check matrix
  has not recorded a pass for that exact digest. **[AMENDED → PLAN §3.2]** a PreToolUse hook only
  constrains this agent in this harness; the real gate is four layers — CI publish step reads the ledger,
  GHCR write held only by the workflow token, install-time signature policy on the machine, and the hook
  as defence in depth.
- **State on disk.** Progress, task queue and current gate live in files at repo root, re-read at the
  start of every work session.
- **Build `hardware/compat.tsv` from hour one.** After fifty rows it is the thing competitors cannot copy
  quickly; before then it is how we quote without guessing.
- **When blocked:** do not invent a workaround that crosses a prohibition. Write it to `BLOCKED.md`, take
  the next unblocked task, surface it at the next checkpoint.

## 9. RESERVED FOR THE HUMAN — do not decide these, ask

- The company name. **[ANSWERED → D1: Auros]**
- Any price change.
- Anything touching real hardware, a real card, or a real person's inbox.
- Accepting a customer whose requirement would fork the base.
- Any claim on the website about customers, results or savings we cannot evidence.
- Whether a hardware model is declared unsupported.

## 10. GATES

| Gate | True when | Behind if |
|---|---|---|
| 1 | `auros-base:hardened` builds in CI and boots in a VM | end of day 1 |
| 2 | A customer recipe inherits from it; a base change propagates to it and to a running VM with no human action | end of day 2 |
| 3 | 100/100 clean migrations and 20/20 clean aborts against a Windows VM | end of day 3 |
| 4 | Site live; a stranger's configuration opens a valid PR | end of day 4 |
| 5 | Three donated laptops imaged; `compat.tsv` has three rows and at least one honest ✗ | end of day 6 |
| 6 | A nonprofit has three working laptops they did not have last week | end of day 7 |

**Gates 1 and 5 are the ones that slip.** Everything else is software and compresses; hardware does not.
A payment is not required for Gate 6 — with schools the first yes is a pilot, and three machines working
in their building is the sale.

## 11. PRODUCT DIRECTIVE (D4, human, binding)

*"make sure people can still use it, if it can run exe and feel like windows that'd be amazing but not
completely required, make it clean end to end, make it feel like personalized windows rather than linux rn
which needs you to memorize books of commands and stuff"*

1. **Zero-terminal.** If a task the product promises requires a command line, it gets a GUI or it stops
   being a promise.
2. **Windows-shaped by default**, system-wide in the image: taskbar, start menu, double-click, familiar
   folder names, Explorer-like file manager.
3. **.exe support is a capability offered honestly.** Bounded hard by prohibition §4.2 — state precisely
   what runs and what does not; never imply blanket compatibility.
4. **Clean end to end.** First boot is a guided setup, not a desktop dumped on a stranger.
