# Desktop layouts: what people ask for, and what we ship

Written 2026-09-20. Internal only. **None of this goes on the website.** Nothing below counts as a
customer claim (§4.4). It's a planning document.

The owner asked for it in these words: *"i want a couple different types of UI's pre installed, maybe a
windows one, a mac one, one which just has like 3 apps, one which is always full screen, idrk what
people want, but a list of what people want."*

Short answer:

- The Windows layout stays the default. D4 requires that.
- Two more layouts now ship in the base as config only: **browser-first ("shelf")** and **simple (three
  big buttons)**.
- "Always full screen" already exists as `policy: kiosk`.
- **Mac-style (top bar and dock) now ships too** (`org.auros.mac.desktop`), because the owner asked
  for it by name. I still found no demand evidence for it in our segment (§2.8).
- **One image-level setting picks the default layout**: `RUN /usr/libexec/auros/set-desktop-layout
  <windows|browser-first|simple|mac>` in a recipe's layer. Without it, every user gets Windows (§3.2).
- **Both Windows-layout defects from §2.1 are fixed**: the taskbar no longer floats, and every layout
  now adds the input-method indicator for Marathi, Hindi and the other upstream languages.
- Guest wipe-on-logout and exam mode are what schools and libraries ask for most after the shape of the
  desktop. Neither is a layout. Both are policy/session work.

Throughout, **[E]** marks a claim backed by the cited source. **[J]** marks my judgment.

---

## 1. The ranked list

Rank = demand in our segment (schools, nonprofits, libraries, small orgs on 2012–2018 laptops) ×
how cheaply we can make it true. **[J]** for the ranking itself.

| # | Experience | Kind | Status in repo | Cost |
|---|---|---|---|---|
| 1 | **Windows-style** taskbar | layout | ships, default (`org.auros.windows.desktop`) | done |
| 2 | **Browser-first / Chromebook-shaped** shelf | layout | **ships now** (`org.auros.shelf.desktop`) | done |
| 3 | **Simple**: three big buttons | layout | **ships now** (`org.auros.simple.desktop`) | done |
| 4 | **Public / guest, wiped at logout** | session + policy | not built | high |
| 5 | **Exam mode** | policy (kiosk variant) + a vendor app | kiosk exists; no exam integration | high, partly outside our control |
| 6 | **Kiosk**: one app, full screen, no desktop | policy | ships (`policy: kiosk`, D12) | done |
| 7 | **Accessibility**: large text, high contrast, screen reader | orthogonal toggle | partly: `theme.text_scale`, `theme.preset: high contrast`, AT tools unprunable | low |
| 8 | **Mac-style**: top bar and a centred dock | layout | **ships** (`org.auros.mac.desktop`), built on the owner's request | done |
| 9 | **Maximize everything** | KWin window rule | not built | low–medium (can't go in a look-and-feel package, see §3.9) |
| 10 | **Touch / tablet** | Plasma built-in plus an on-screen keyboard | nothing to do for layout; OSK is the real work | medium, little matching hardware |

---

## 2. Evidence, and what each one is

### 2.1 Windows-style: exists, default

- **Who:** most adults in our segment. Staff, volunteers, the "62-year-old school administrator"
  (D4). The owner made it binding (D4 §2). **[E: DECISIONS.md D4]**
- **Plasma:** bottom panel with `kickoff`, `icontasks`, `marginsseparator`, `systemtray`,
  `digitalclock`, `showdesktop`. See
  `auros-base/desktop/lookandfeel/org.auros.windows.desktop/contents/layouts/org.kde.plasma.desktop-layout.js`.
- **Two findings from checking it against KDE source. Both are fixed on base branch
  `agent/desktop-layouts-2` (§5).**
  - The script never set `panel.floating`. The scripting default is `true`
    (`plasma-workspace/shell/scripting/panel.cpp`, `readEntry("floating", true)`), so Windows users get
    a floating panel with a gap under it. Windows' taskbar sits flush on the screen edge.
    **Fixed:** `panel.floating = false;`. `PanelView::defaultFloating()` returns `true` as well, so the
    default holds for the view too, not only for the script. The build now fails if the line is missing.
    It still needs someone to look at it on a real screen.
  - Upstream's own default panel (`plasma-desktop/layout-templates/org.kde.plasma.desktop.defaultPanel`)
    adds `org.kde.plasma.kimpanel` when the language is Marathi, Hindi, Tamil and ~30 others. Ours
    never added it. The example recipe is a Marathi school.
    **Fixed:** every Auros layout now runs upstream's exact test, `langIds.indexOf(languageId) != -1`, with
    the 31-entry list copied verbatim. `languageId` is a scripting global,
    `QLocale::system().bcp47Name()` up to the first `-` (`shell/scripting/appinterface.cpp`).
    The build fails if any layout lacks the `addWidget("org.kde.plasma.kimpanel")` call.
    - We copied upstream's quirk too. `languageId` never contains `_`, so the list's `zh_CN` and
      `zh_TW` entries can't match. That doesn't matter for our segment.
    - **Unverified:** whether the input method actually starts for a Marathi user on our image. The
      indicator only shows what an input-method framework reports. Whoever owns `second_script` still
      needs to confirm that on a VM.

### 2.2 Browser-first ("shelf", Chromebook-shaped): built

- **Who:** pupils, and any org that already works in a browser.
  - Chromebooks were the largest share of K-12 mobile-PC shipments worldwide: 39% in 2022, against 36%
    for notebooks and 23% for tablets. **[E: Futuresource, Jan 2023]**
  - 93% of US district leaders planned to spend on Chromebooks in 2025, up from 84% in 2023. Source is
    a nationally representative EdWeek Research Center survey of 236 district leaders, fall 2024.
    **[E: EdWeek Market Brief, Jan 2025]**
  - Our own first-customer profile is an org "already living in Google Workspace or a browser-based
    system". **[E: SPEC §1]**
- **[J]:** a child who uses a Chromebook in class sees a laptop from us as "the thing like my school
  laptop". An adult in the same org uses the browser for nearly everything. For both, putting the
  browser first and centring the pinned apps is the smallest step away from what they already know.
- **Plasma:** `org.auros.shelf.desktop`.
  - One bottom panel, 48px, not floating.
  - `kickoff` sits bottom-left with favourites and apps shown as a grid, because the launcher they know
    is a grid under a search box.
  - `icontasks` sits between two `panelspacer`s, so the pins are centred. Pin order: browser, files,
    software.
  - `systemtray` and `digitalclock` sit at the right.
- **Copies the shape, not the look (§4.2):** Breeze throughout, Plasma's own launcher, nothing named or
  drawn like Google's. The package id avoids the trademark on purpose.
- **Kind:** config only. No packages.

### 2.3 Simple: three big buttons (built)

- **Who:**
  - young children
  - older adults at library and charity digital-skills sessions
  - adults on their first computer
  - users with cognitive disabilities
- **Evidence that the need is real:**
  - Apple built a whole mode for it. Assistive Access "offers a distinctive interface with high-contrast
    buttons, large text labels", a large grid, and a small fixed set of apps.
    **[E: Apple Newsroom, May 2023; Apple Assistive Access guide]**
  - Microsoft built a "restricted user experience": a desktop whose Start menu and taskbar show only
    the allowed apps. Its documentation names schools and libraries as uses.
    **[E: Microsoft Learn, multi-app kiosk / assigned access]**
  - Two platform vendors each shipping this is the strongest demand signal I found. I found no survey
    that measures it directly. **[J]**
- **Plasma:** `org.auros.simple.desktop`.
  - One bottom panel, 72px. Icon size in `icontasks` follows panel thickness, so this makes the
    buttons large.
  - A `kickoff` menu.
  - `icontasks` with three pins (browser, files, `org.auros.Welcome.desktop`) and `iconSpacing` 2.
  - A spacer, `systemtray`, and `digitalclock` with the date.
  - No show-desktop button, no pager.
- **Deliberately not a lockdown.** The menu stays, so a fourth app is reachable. "Only these apps exist"
  is `prune` plus `policy: locked`, which are real, provable tools. Hiding the menu would remove the
  GUI path to settings and fail B12. **[J]**
- **Known gap:** the buttons have no text labels, only tooltips. For this audience, labels would help.
  Labels mean `org.kde.plasma.taskmanager` instead of `icontasks`, and B12's windows-shape check
  (`desktop/assert-zero-terminal.sh` line ~454) only accepts `icontasks`. That makes it a two-file
  change, not done here.
- **Kind:** config only. No packages.

### 2.4 Public / guest, wiped at logout (not built)

- **Who:** public libraries above all, plus drop-in centres and shared lab machines.
  - Libraries use reboot-to-restore tools (Deep Freeze) so that downloads, files and history from one
    patron never reach the next. **[E: ALA Office for Intellectual Freedom, "Choosing Privacy for
    Public Computers in Libraries"; Wisconsin Valley Library Service Deep Freeze page]**
  - The ALA publishes a privacy checklist specifically for public-access computers.
    **[E: ALA Library Privacy Checklist for Public Access Computers]**
  - ChromeOS "managed guest sessions" delete all data on exit and are sold for libraries and labs.
    **[E: Google Chrome Enterprise Help, managed guest session devices]**
- **Plasma / Auros mapping.** Not a layout. It needs:
  - a guest account whose home directory is a tmpfs or is recreated at each login (session/PAM work)
  - SDDM autologin or a guest button
  - a clear "everything you do here is erased" notice
  - `policy: locked` underneath
- **[J]:** this is probably the second most valuable thing on this list for libraries, after the
  layout itself. It's a policy-mode-sized piece of work. It needs its own ticket and a B-check that
  proves the wipe, not a look-and-feel package.

### 2.5 Exam mode (not built)

- **Who:** any school that runs state or standardised tests on these machines.
  - TestNav on Chromebooks must run in kiosk mode, and only on school-managed devices.
    **[E: Pearson TestNav, "Set Up TestNav on ChromeOS" and system requirements]**
  - Safe Exam Browser supports Windows and macOS only. Its developers say they don't plan a Linux
    lockdown version. **[E: SEB discussion #1360, seb-win-refactoring]**
- **Plasma / Auros mapping:** the lockdown shape we already have is `policy: kiosk` (cage plus one app,
  no shell, D12). What we lack is permission. Whether a testing vendor accepts our machine is **their**
  decision, not something config can make true.
- **[J]:** don't promise this until one real vendor lists Linux as supported. I didn't verify whether
  TestNav supports Linux desktops at all. That's the first thing to check. Until then, the honest
  answer to "can we test on these?" is "only for tests that run in an ordinary browser".

### 2.6 Kiosk, one app, full screen (exists)

- **Who:** catalogue terminals, reception sign-in, corridor displays. **[E: auros-base/policy/README.md]**
- Windows ships the same idea as single-app assigned access. **[E: Microsoft Learn, single-app kiosk]**
- **Plasma:** none. Kiosk removes `plasmashell` entirely (spec §6A, D12, check S9). That's why it isn't
  a look-and-feel package, and why none of the three layouts applies under `policy: kiosk`.
- The owner's "one which is always full screen" is this, if it means one app. If it means a normal
  desktop where every window opens maximised, that's #9.

### 2.7 Accessibility (orthogonal, partly exists)

- Not a layout. It applies on top of any of them. The recipe already has `theme.text_scale`,
  `theme.cursor_size` and `theme.preset: high contrast`, and assistive tools can't be pruned
  (`auros-recipes/schema/README.md`, "It cannot remove accessibility tools").
- **[J]:** keep it a toggle. Making it a layout would force a choice between "simple" and "accessible",
  and those two audiences overlap heavily.

### 2.8 Mac-style (built on the owner's request; ranked by evidence, not by the owner's list order)

- **Who:** users coming from a Mac.
  - I found no evidence of Mac users as a meaningful group in our segment. `hardware/compat.tsv` has no
    Apple rows.
  - There is one real opening. Apple has stopped updating many 2017–2018 Macs: the 2017 MacBook Pro
    stops at Ventura, and the 2018/2019 MacBook Air at Sonoma.
    **[E: AppleInsider, 2026-08-31; Macworld]**
  - That puts orphaned Macs exactly in our hardware window. If a customer brings a Mac fleet, the
    layout is the cheap part and the hardware is the hard part (e.g. Broadcom Wi-Fi), which is a
    `driver-triage` question first.
- **Built anyway, as `org.auros.mac.desktop`**, because the owner asked for it by name. See §5. The
  ranking below is unchanged. It reflects evidence, not the build order.
- **Why it didn't make the top two [J]:** that job was two layouts. The browser-first and simple
  layouts each serve a group with cited evidence and a clear place in our first-customer profile. The
  Mac layout serves a group I couldn't find in the segment. It's cheap and ready to build. §4 has the
  verified recipe for it.

### 2.9 Maximise everything (not built)

- **Who [J]:** the same people as "simple". Overlapping windows are the most common way a novice loses
  a window.
- **Plasma:** a KWin window rule (`kwinrulesrc`) that maximises new windows.
- **Why it's not in a look-and-feel package:** `plasma-apply-lookandfeel` reads only the groups
  libklookandfeel knows about:
  - kdeglobals KDE/General/Icons
  - plasmarc Theme
  - kcminputrc Mouse
  - kwinrc decoration and switchers

  (`plasma-workspace/libklookandfeel/klookandfeelmanager.cpp`, `klookandfeelmanifest.cpp`). It would
  have to ship as `/etc/xdg/kwinrulesrc`, and that applies to every layout, not just one. I didn't
  verify the `kwinrulesrc` key names, and I wouldn't write one without doing so.

### 2.10 Touch / tablet (nothing to build as a layout)

- Plasma 6 switches to a touch mode by itself on convertibles when the screen folds or the keyboard
  detaches. **[E: MakeUseOf, "I put Linux on a tablet"; KDE Plasma 6 Wikipedia article]**
  - These are secondary sources. I didn't confirm this against KDE source.
- The real gap is the on-screen keyboard. Fedora users report Maliit not appearing automatically.
  **[E: Fedora Discussion #85479]**
- **[J]:** few 2012–2018 school laptops have touchscreens. Park this until a customer's fleet does.

---

## 3. How a recipe selects a layout (base side built; recipe field still a proposal; auros-recipes NOT edited)

### 3.1 The field

It goes in the existing `desktop:` block, which already means "the Windows-shaped layer". It's
optional, and it defaults to today's behaviour:

```yaml
desktop:
  layout: windows        # windows | browser-first | simple | mac
```

| value | package |
|---|---|
| `windows` (default) | `org.auros.windows.desktop` |
| `browser-first` | `org.auros.shelf.desktop` |
| `simple` | `org.auros.simple.desktop` |
| `mac` | `org.auros.mac.desktop` |

Schema fragment, in the style of the existing `desktop` properties:

```json
"layout": {
  "description": "Where things are on screen. windows — a taskbar with a start menu, the default. browser-first — the launcher at the left and pinned apps centred, the shape pupils know from school laptops. simple — one tall bar with three big buttons, for young children and first-time users. mac — a bar along the top with the menu, the running app's own menus and the clock, and a centred dock of apps along the bottom, for people coming from a Mac. Every layout keeps the menu, the Wi-Fi and the clock; none of them is a lockdown — that is what policy is for.",
  "enum": ["windows", "browser-first", "simple", "mac"],
  "default": "windows"
}
```

Validation rules, all rejections that teach:

- `layout` under `policy: kiosk` is rejected. `desktop:` is already rejected there, because there is
  no desktop.
- `layout` other than `windows` with `taskbar_and_start_menu: false` is rejected as contradictory.
  - **[J]** It would be cleaner to retire `taskbar_and_start_menu` into this field later. Every layout
    has a menu and a task list.
- No free-form ids, and no file paths. The value is one of our shipped, tested packages, the same way
  `policy` is one of four words.

### 3.2 What the compiler emits, and the base helper (now built)

Selection currently lives in two places in the base, both hardcoded to Windows:

1. `/etc/xdg/kdeglobals` `[KDE] LookAndFeelPackage=org.auros.windows.desktop` (`desktop/xdg/kdeglobals`).
2. `LAYOUT=/usr/share/plasma/look-and-feel/org.auros.windows.desktop/...` and
   `plasma-apply-lookandfeel -a org.auros.windows.desktop` in `desktop/welcome/auros-first-run`.

Proposal. It follows the `apply-policy` pattern, one line in the derived Containerfile:

```dockerfile
RUN /usr/libexec/auros/set-desktop-layout simple
```

The helper is **built** (base `desktop/set-desktop-layout` → `/usr/libexec/auros/set-desktop-layout`).
It takes the recipe's word, not a package id, and it:

- maps `windows | browser-first | simple | mac` to the package ids in the table above. Anything else,
  including a raw package id or a path, exits 1 with the list of valid names, so the image build fails.
- refuses a name whose package isn't in the image, because every new user would get no panel.
- rewrites only `LookAndFeelPackage` inside `[KDE]` of `/etc/xdg/kdeglobals`. It replaces the key where it
  stands, or adds it under the header. The rest of that shared file is left byte-for-byte alone.
- writes the id to `/etc/auros/desktop-layout`.

`auros-first-run` reads that file. Three cases fall back to `org.auros.windows.desktop` and log a line:
no file, a value that isn't `org.auros.<word>.desktop`, and a package the image doesn't ship. The base
never calls the helper, so the base stays Windows (D4).

The build also fails if a shipped package has no name in the helper, because no recipe could choose it.

The compiler side is still a proposal: `desktop.layout: X` emits that one `RUN` line, and
`windows` can emit nothing at all.

- The first-run stamp doesn't need bumping for new machines.
- Existing users keep their panel. That's correct: first-run must never rebuild a panel a user has
  already arranged.

### 3.3 Without any recipe change

The two new packages are already in the image. An administrator can switch any account today from
**System Settings → Global Theme**, which applies the package's layout when the layout option is
ticked. So all three shapes are reachable with no terminal (D4 §1) before the schema changes.

That GUI path is standard Plasma behaviour. It has **not** been exercised on an Auros image.

---

## 4. Verification: what is and isn't known

**Checked statically, against KDE source** (shallow clones of `plasma-desktop`, `plasma-workspace`,
`kwin`, `kconfig` master, 2026-09-20):

- **Applet ids** (from `plasma_add_applet(...)` in each applet's CMakeLists):
  - `org.kde.plasma.kickoff`
  - `org.kde.plasma.icontasks`
  - `org.kde.plasma.panelspacer`
  - `org.kde.plasma.appmenu`
  - `org.kde.plasma.kicker`
  - Existing ids in the Windows layout: `systemtray`, `digitalclock`, `marginsseparator`,
    `showdesktop`.
- **Config keys** (from each applet's `main.xml`):
  - kickoff `[General] favoritesDisplay`, `applicationsDisplay` (Int, 0 = Grid, 1 = List)
  - taskmanager/icontasks `[General] launchers`, `groupingStrategy`, `showOnlyCurrentDesktop`,
    `showOnlyCurrentScreen`, `iconSpacing` (Int, margin multiplier)
  - digital-clock `[Appearance] showDate`, `dateDisplayFormat` (`BelowTime` is a valid choice)
  - panelspacer `[General] expanding`, default `true`
- **Panel scripting properties** (`shell/scripting/panel.h` / `.cpp`):
  - `location`, `height`, `hiding` (`none`/`autohide`/`dodgewindows`/`windowsgobelow`)
  - `floating` (default `true`)
  - `alignment` (`left`/`right`, anything else = center)
  - `lengthMode` (`fill`/`fit`/`custom`)
- **Look-and-feel `defaults` groups** that are actually applied: the list in §2.9.
  - Consequence: the `SingleClick=false` line in every package's `defaults`, including the original
    Windows one, is never read by `plasma-apply-lookandfeel`. Double-click is enforced by
    `/etc/xdg/kdeglobals`. That was already the case, and the build asserts it.
- **KWin title-bar button letters** (`kwin/src/decorations/settings.cpp`): M menu, N app menu,
  S all desktops, H help, I minimise, A maximise, X close, F above, B below, E exclude-from-capture,
  `_` spacer. The group is still `org.kde.kdecoration2`.
- **Tests:**
  - both new `metadata.json` files parse, carry their own id, `LicenseRef-Proprietary` (D30) and
    `Plasma/LookAndFeel`
  - both layout scripts pass `node --check`
  - the build validates every package, and `tests/40-windows-feel.test.sh` drives that check green on
    the real payload and red on eight mutations
  - `tests/prove-red.sh` W07–W09 show that weakening the check is caught

**Not verified. None of this has been seen on a screen:**

- Neither layout has ever run in a real `plasmashell`. `node --check` proves syntax, not that Plasma
  accepts every call. First real evidence would be desktop/README.md VERIFY-3 in a VM.
- What 72px looks like on a 1366×768 screen, how large the icons actually render, and whether
  `iconSpacing` 2 reads as intended.
- Whether the `panelspacer` pair centres the task icons exactly or only approximately, with the tray
  present.
- Which Plasma 6.x the pinned Aurora digest carries. I verified against master. `lengthMode`,
  `floating` and `iconSpacing` are recent additions. I haven't checked the first release that has
  each. `lengthMode` is only used in the Mac sketch below, not in the shipped packages.
- The System Settings → Global Theme path on an Auros image (§3.3).
- `org.kde.plasma.kickerdash` (the full-screen Application Dashboard). `kicker/main.qml` checks for
  that plugin name, but I couldn't find where current master registers it, so neither layout uses it.

### Mac-style sketch (as first written; the built version is in §5)

```js
// top bar: menu, global app menu, spacer, tray, clock
var top = new Panel("org.kde.panel"); top.location = "top"; top.height = 28; top.floating = false;
top.addWidget("org.kde.plasma.kickoff");
top.addWidget("org.kde.plasma.appmenu");
top.addWidget("org.kde.plasma.panelspacer");
top.addWidget("org.kde.plasma.systemtray");
top.addWidget("org.kde.plasma.digitalclock");
// dock: centred, only as long as its contents
var dock = new Panel("org.kde.panel"); dock.location = "bottom"; dock.height = 56;
dock.alignment = "center"; dock.lengthMode = "fit"; dock.floating = true;
dock.addWidget("org.kde.plasma.icontasks");
```

- `defaults` would add `ButtonsOnLeft=XIA` under `[kwinrc][org.kde.kdecoration2]`.
- **Unverified:** what an *empty* `ButtonsOnRight=` does. KConfig falls back to the default only when
  the value is null (`kconfiggroup.cpp`, `aValue.isNull()`). I didn't confirm whether an empty INI
  value is null or empty. If it's null, KWin's default right-hand buttons (`HIAX`) come back and the
  window gets two close buttons. `ButtonsOnRight=_` (a lone spacer) is the verified-safe fallback.
- It keeps `kickoff` and `icontasks`, so B12's windows-shape check still passes.

---

## 5. What was built on 2026-09-20 (second pass)

Base branch `agent/desktop-layouts-2`, commit `42f0028`, on top of `agent/desktop-layouts` (`78a1519`).
Not pushed. No Containerfile or workflow change, and no new packages.

- **`org.auros.mac.desktop`**:
  - **Top bar:** 32px, not floating. It holds `kickoff`, `appmenu`, a `panelspacer`, `kimpanel` (under
    the upstream language condition), `systemtray`, and `digitalclock` with `dateDisplayFormat`
    `BesideTime` (a valid choice in main.xml).
  - **Dock:** bottom, 56px, `alignment = "center"`, `lengthMode = "fit"`, `floating = true`, holding
    `icontasks` with the browser, files and software pins.
  - **Window buttons:** `defaults` sets `ButtonsOnLeft=XIA` and `ButtonsOnRight=_`. Button letters are
    checked against `kwin/src/decorations/settings.cpp`.
  - **Global menu:** `org.kde.plasma.appmenu` gets menus from the appmenu kded module, which autoloads
    (`plasma-workspace/appmenu/appmenu.json`, `X-KDE-Kded-autoload: true`).
  - **Name:** the visible name is "Auros Top Bar and Dock". "mac" appears only in the internal id and in
    the recipe word.
- **Selection**: `set-desktop-layout` and `auros-first-run` work as described in §3.2.
- **Windows fixes**: see §2.1.
  - `kimpanel` was added to the shelf and simple layouts too. A Marathi school on any layout has the
    same need.
- **Tests:**
  - `tests/40-windows-feel.test.sh` went from 109 to 159 checks.
  - The new `layout.choose` group runs the real helper against a fake root holding the real payload.
    Each of the four names is green. Six refusals are red: an unknown name, no name, a raw id, a path,
    a missing package, and no kdeglobals.
  - Two edge cases are green: the key being absent from `[KDE]`, and a decoy in `[General]`.
    Re-running is idempotent.
  - The same group runs first-run's selection block against six file states.
  - `tests/prove-red.sh` adds W10–W15 and updates W08: mac left out of validation, the floating check
    dropped, kimpanel dropped from the widget list, the helper accepting unknown names, a group-blind
    key rewrite, and first-run trusting the file. 70/70 are caught, and `run-all.sh` passes 16/16.

**Still unverified, and none of it has been seen on a screen:**

- Whether the dock actually centres and fits to its contents.
- Whether two panels (top and bottom) coexist without overlap on 1366×768.
- Which applications fill the global menu. Many GTK, Electron and Flatpak apps don't export their menus;
  those keep the menus in their own window.
- Whether `ButtonsOnRight=_` really draws nothing.
- The whole first-run path with a non-Windows layout.
- **B12 on a mac-layout image.** `assert-zero-terminal.sh` greps the appletsrc for `kickoff` and
  `icontasks`, and both are present, just in two panels.
- The input-method indicator, as noted in §2.1.

## Sources

- Futuresource Consulting, "K-12 PC device shipments hit by changing priorities, still outpace 2019
  levels", 16 Jan 2023. https://www.futuresource-consulting.com/the-source/industry-pulse/k-12-pc-device-shipments-hit-by-changing-priorities-still-outpace-2019-levels/
- EdWeek Market Brief, "How School Districts' Spending on Chromebooks and Other Devices Will Change Over
  the Next Year", Jan 2025. https://marketbrief.edweek.org/education-market/how-school-districts-spending-on-chromebooks-and-other-devices-will-change-over-the-next-year/2025/01
- Pearson, "Set Up TestNav on ChromeOS". https://support.assessment.pearson.com/TN/set-up-testnav-on-chromeos-18614070.html
- Pearson, "TestNav System Requirements". https://support.assessment.pearson.com/TN/testnav-system-requirements-18613791.html
- Safe Exam Browser, "Safe Exam Browser for Linux Distros", discussion #1360. https://github.com/SafeExamBrowser/seb-win-refactoring/discussions/1360
- ALA Office for Intellectual Freedom, "Choosing Privacy for Public Computers in Libraries". https://www.oif.ala.org/choosing-privacy-public-computers-libraries/
- ALA, "Library Privacy Checklist for Public Access Computers and Networks". https://www.ala.org/advocacy/privacy/checklists/public-access-computer
- Wisconsin Valley Library Service, "DeepFreeze Public Computer Restore". https://www.wvls.org/deepfreeze/
- Google, "Managed guest session devices", Chrome Enterprise and Education Help. https://support.google.com/chrome/a/answer/3017014
- Microsoft Learn, "Configure a Multi-App Kiosk With Assigned Access". https://learn.microsoft.com/en-us/windows/configuration/assigned-access/configure-multi-app-kiosk
- Microsoft Learn, "Windows kiosk configuration options overview". https://learn.microsoft.com/en-us/windows/configuration/kiosk/
- Apple Newsroom, "Apple previews Live Speech, Personal Voice, and more new accessibility features",
  May 2023. https://www.apple.com/newsroom/2023/05/apple-previews-live-speech-personal-voice-and-more-new-accessibility-features/
- Apple, Assistive Access User Guide. https://support.apple.com/guide/assistive-access-iphone/welcome/ios
- AppleInsider, "Apple adds three Intel MacBook models to obsolete list", 31 Aug 2026. https://appleinsider.com/articles/26/08/31/apple-ends-hardware-support-for-three-intel-macbook-models
- Macworld, "How long do Macs last?". https://www.macworld.com/article/673939/this-is-how-long-macs-and-macbooks-last.html
- Fedora Discussion, "On-screen keyboard fails to open automatically in KDE on a touch device". https://discussion.fedoraproject.org/t/on-screen-keyboard-fails-to-open-automatically-in-kde-on-a-touch-device/85479
- MakeUseOf, "I put Linux on a tablet, and KDE Plasma handled everything I threw at it". https://www.makeuseof.com/i-put-linux-on-a-tablet-and-kde-plasma-handled-everything-i-threw-at-it/
- KDE source (read directly): github.com/KDE/plasma-desktop, plasma-workspace, kwin, kconfig, master
  as of 2026-09-20.
