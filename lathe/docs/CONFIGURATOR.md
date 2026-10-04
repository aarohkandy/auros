# The configurator

Spec §6D: *"The configurator's output panel renders the customer's answers as the actual `recipe.yaml`,
live as they choose — including the `remove:` block naming what gets deleted. This panel is the single
most persuasive object on the site. Nobody else selling a computer shows you what they took out."*

This document is the design. It exists before the code because the panel is the product argument made
visible, and a thing built without an argument becomes a form with a preview pane.

---

## What the panel is arguing

Every other computer you can buy is sold by addition. The spec sheet is a list of what is *included*, and
the list gets longer every year, and nobody reads it because nobody believes any of it will be removed.

The panel makes one move: **it shows the reader a list of what is being deleted, by name, and the list is
longer than the list of what stays.** That asymmetry is the entire pitch, and it is not a rhetorical
device — it is the literal content of the file that builds their operating system.

So the design rule that governs everything below: **the `remove:` block is never collapsed, never
truncated behind a "show more", and never rendered smaller than the `install:` block.** If the layout
forces a choice about what to cut, cut the install list.

## The shape

Two columns on desktop, stacked on mobile with the panel **above** the form — a phone user must see the
argument before they see the work.

```
┌── your answers ──────────────┐   ┌── customers/hopelink/recipe.yaml ───────────┐
│                              │   │ name: hopelink                              │
│ How many machines?  [ 40 ]   │   │ base: auros-base:hardened                   │
│ Language            [ ▾ ]    │   │ locale: en_GB.UTF-8                         │
│ What do they do?    [ ☑☐☑ ]  │   │ policy: kiosk                               │
│ Who runs them?      [ ▾ ]    │   │ install:                                    │
│                              │   │   - org.mozilla.firefox                     │
│                              │   │ remove:                                     │
│                              │   │   - plasma-desktop      # the whole desktop │
│                              │   │   - discover            # no app store      │
│                              │   │   - …211 more                               │
└──────────────────────────────┘   └─────────────────────────────────────────────┘
```

IBM Plex Mono throughout the panel, per §7 — it is config, and config is factual.

## The four honesty constraints

**1. The YAML must be real.** It is not a mockup of a recipe; it is a recipe. It passes the *same*
validator that `auros-recipes` runs in CI — the same code, imported, not a parallel reimplementation. If
the site can render YAML the validator would reject, the site is lying at the exact moment it is trying
hardest to be trusted.

**2. The removal count must be measured, not estimated.** "…211 more" is a number from a real build of a
real recipe with that shape, not from counting a static list. Until we have that measurement the panel
shows the named removals and **omits the count** rather than inventing one. §4.4.

**3. Anything illustrative is labelled.** Before a real customer exists, any example fleet size, name or
saving is an **illustration** and carries `ILLUSTRATION` visibly, in the panel, not in a footnote.

**4. The panel must show a rejection.** When a visitor asks for something a recipe may not do — a
specific package version, a different base, a held-back kernel — the panel shows the **refusal**, in the
validator's own words, explaining why refusing is the point:

> `auros-recipes` refuses to pin package versions. A pinned version is a package we can never patch, and
> a machine we can never patch is the machine you already have in the cupboard.

This is counter-intuitive and it is the most persuasive state the panel has. It is the moment the reader
learns the constraint is load-bearing rather than a limitation. **Do not hide it, do not soften it, and
do not let the form prevent the visitor from reaching it.**

## What the form asks

Four questions, in plain words, because the reader is an overworked IT person and not an engineer. The
form asks about *their situation*; the compiler turns that into technical fields. A question that names a
package is a question that has already failed.

| Asked | Becomes |
|---|---|
| How many machines, and roughly what age? | `hardware_profile`, and the tier the price comes from |
| What language do you work in? | `locale`, `keyboard`, and the font packages that make it render at all |
| What do people actually do on these? (checkboxes: browse, write, email, one specific program, nothing else) | `install:`, and by subtraction the `remove:` block |
| Who is allowed to change things? (anyone / staff only / nobody / this is a single-purpose machine) | `policy: open \| managed \| locked \| kiosk` |

The fifth thing is not a question, it is a disclosure: **the Windows programs that will not come across.**
It appears before the submit button, not after, and it is not dismissible.

## Behaviour

- **Keyboard-complete.** Every control reachable and operable without a mouse, visible focus, the panel
  announced to screen readers as a live region that updates on change but does not interrupt.
- **No client framework.** Plain TypeScript modules per §6D. The panel is string generation and a diff
  highlight; it does not need React.
- **JS off:** the form is JS-injected, and `<noscript>` carries a `mailto:` fallback. Be explicit in the
  copy that this is a degraded path, not an equivalent one — a visitor without JS can email us, not
  submit. Turnstile has no `<noscript>` fallback and the Worker never accepts a POST without a valid
  token, so this arrangement is the only one that satisfies both requirements honestly.
- **Motion:** the panel updates. It does not animate. §7 permits movement only from things reporting a
  real fact; a value changing *is* a real fact, so the changed lines may highlight briefly and settle. No
  typewriter effect, no streaming-in, no cursor.

## Submit → a pull request

The order literally becomes the build (§6D). The Worker:
1. verifies the Turnstile token — no token, no POST, no exceptions;
2. **re-validates the recipe server-side** with the same validator, because a client-side check is a
   convenience and never a control;
3. creates `customers/<name>/recipe.yaml` on a branch in `auros-recipes`;
4. opens a PR whose body is the `explain` output — the plain-English account of what this machine will
   contain and what it will delete — so the PR is readable by the customer, who can see it, because the
   repo is public;
5. emails the operator.

**Payment is not taken here.** Stripe Checkout collects and authenticates the card, `$0` is charged, and
the card is only billed after the test build passes (PLAN.md §3.8). On a failing build, nothing was ever
captured, so there is nothing to refund. That ordering is the same ordering as the installer's: **verify
first, act second.** It is not a coincidence that the company's two riskiest operations share a shape.
