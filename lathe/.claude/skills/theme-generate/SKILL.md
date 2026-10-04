---
name: theme-generate
description: Generate an Auros customer theme and branding layer - colours, wallpaper, login screen, Plasma layout - from a customer's existing identity, and verify it meets contrast and Windows-familiarity requirements. Use when onboarding a customer, when a recipe sets theme or branding, or when asked to make a build look like a particular organisation.
---

# theme-generate

Produces the theme layer a recipe's `theme:`/`branding:` fields refer to. Two constraints govern
everything here, and they pull in opposite directions.

## Constraint 1 — it must feel like Windows (D4)

The human directive is binding: *"make it feel like personalized Windows rather than linux which needs you
to memorize books of commands"*. A school's users are not evaluating a desktop environment, they are
trying to find the thing they clicked yesterday.

So the defaults are not KDE's defaults:
- Taskbar at the bottom with a start menu. Not a dock, not an overview, not a hot corner.
- **Double-click to open.** KDE defaults to single-click; Windows users do not.
- Familiar folder names, and a file manager arranged like Explorer.
- Every default shipped **system-wide in the image** (`/etc/skel`, `/etc/xdg`), never left for the user to
  configure. A setting a user has to find is a setting that is not set.

## Constraint 2 — a customer's brand may not break legibility

Schools arrive with a colour from a logo, and it is frequently a colour nobody can read text on.

- **Measure contrast, never assume it.** Every foreground/background pair the theme produces gets a
  computed ratio. Body text ≥ 4.5:1, large text ≥ 3:1.
- When a customer's brand colour fails, **do not use it as a text or panel colour.** Use it as an accent
  — a selection highlight, a focus ring, the login screen — where it carries identity without carrying
  words. Tell the customer that is what you did and why.
- Never ship a theme that lowers contrast below the base image's. A branded machine that is harder to read
  is a worse machine with a logo on it.

## Procedure

1. Take the customer's existing identity: a logo file, a hex colour, or the school's website.
2. Derive a small palette — accent, accent-hover, and neutral surface steps. Keep it small; a theme with
   fourteen colours is a theme that will look wrong somewhere.
3. Generate: Plasma colour scheme, login/SDDM theme, wallpaper, and the layout script for the
   Windows-shaped panel.
4. **Run the contrast check.** Any failing pair is fixed, not excused.
5. Render the result in the check matrix's `uefi-modern` profile and look at it. A theme that only exists
   as config has not been seen.

## What branding may never do

Impersonate someone. A recipe's branding is validated against that, and it is not a formality — an image
carrying another organisation's identity is something we would be handing to 180 machines. If a customer
asks for branding that is not theirs to use, that is a §9 decision for the human.
