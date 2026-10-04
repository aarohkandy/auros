/* restart.js — the one restart, played by scrolling.
 *
 * The screen is src/aurscreen/screen.c ported line for line: the same
 * seven steps matched on the same sentences, the same rules for what
 * counts as "her sentence" and what is a technician's detail line, the
 * same tail of four raw lines kept for a photo, the same "do not turn
 * the computer off" band from the first step that cannot be undone,
 * the same sizes (38/20/15/13 px, scaled by the screen's height over
 * 720 and clamped to 0.85–2.4) and the same colours. It is set in
 * DejaVu Sans because that is what aurscreen falls back to in the
 * staging environment.
 *
 * What it is fed is aurstage's own output: every sentence below is a
 * stage_say() in src/aurstage/install.c, word for word. Detail lines
 * that would need a number from a real machine (the drive's hours, the
 * size of the saved copy, the boot entry's number) are left out rather
 * than made up; the two numbers that remain are the image size
 * (docs/results/desktop.json: 5268045824 bytes = 4.9 GiB) and the
 * shrunk Windows drive from the test fixture (tools/screentest.sh:
 * "windows  61.2 GiB"), which the disk bar under the screen uses too.
 * /dev/vda3 is the fixture's disk: every install so far was a VM.
 */
(function () {
  "use strict";

  /* ── screen.c: STEP[] ────────────────────────────────────────────── */
  var STEP = [
    ["", "Checking this computer"],
    ["Saving this computer's Windows startup", "Saving the way back to Windows"],
    ["Making room on the Windows drive", "Making room on the Windows drive"],
    ["Copying AurOS onto this computer", "Copying AurOS"],
    ["Making this computer able to start AurOS", "Setting up how it starts"],
    ["Checking that this computer works under AurOS", "Checking AurOS works here"],
    ["Writing the new layout", "Finishing"]
  ];
  var RISKY_FROM = 2, NTAIL = 4;

  function fresh() {
    return { step: 0, pct: -1, para: [], paraOpen: false, tail: [], verdict: "", report: "",
             stopped: false, handover: false, warn: "" };
  }
  function isDetail(t) {
    if (t[0] === " ") return true;
    var i = 0;
    while (i < t.length && t[i] >= "a" && t[i] <= "z") i++;
    return i > 0 && i <= 8 && t[i] === " " && t[i + 1] === " ";
  }
  /* screen.c: feed(), for M_INSTALL */
  function feed(s, line) {
    if (line.indexOf("aurstage-progress ") === 0) {
      var p = parseInt(line.slice(18), 10) || 0;
      s.pct = Math.max(0, Math.min(100, p));
      return;
    }
    var t = line.indexOf("aurstage: ") === 0 ? line.slice(10) : line;
    if (t) { s.tail.push(t); if (s.tail.length > NTAIL) s.tail.shift(); }
    var v = t.indexOf("aurstage-report v1 verdict=");
    if (v >= 0) {
      s.verdict = t.slice(v + 27).split(" ")[0];
      s.report = t.slice(v);
      s.paraOpen = false;
      return;
    }
    if (t.indexOf("handing over to the system on") >= 0) { s.handover = true; s.pct = -1; return; }
    if (!t) { s.paraOpen = false; return; }
    if (t === "AurOS staging environment") {
      s.para = ["Getting ready. Nothing on this computer has been changed yet."];
      s.paraOpen = false;
      return;
    }
    if (t.indexOf("WARNING: ") === 0) { s.warn = t.slice(9); return; }
    if (isDetail(t)) return;
    if (!(t[0] >= "A" && t[0] <= "Z") && !s.paraOpen) return;
    if (!s.paraOpen) {
      s.para = []; s.paraOpen = true;
      for (var i = 1; i < STEP.length; i++)
        if (t.indexOf(STEP[i][0]) === 0 && i > s.step) { s.step = i; s.pct = -1; }
    }
    if (s.para.length < 4) s.para.push(t);
  }

  /* ── what aurstage says, in order (src/aurstage/install.c) ─────────
   * [line, weight]: weight is how much scrolling the line is given.   */
  var A = "aurstage: ";
  var SCRIPT = [
    [A + "AurOS staging environment", 3],
    [A + "", 0],
    [A + "── installing AurOS ────────────────────────────────────", 1],
    [A + "record   no memory stick: an interrupted install will start again from the beginning", 1],
    [A + "power    This computer is plugged in.", 1],
    [A + "image    desktop, 4.9 GiB", 1],
    [A + "checking the copy of AurOS on the Windows drive", 2],
    [A + "measuring how small the Windows drive can get", 2],
    [A + "reading every sector of the space that would be reclaimed", 2],
    [A + "", 0],
    [A + "Saving this computer's Windows startup, so it can be put back.", 4],
    [A + "", 0],
    [A + "Everything AurOS can check has been checked.", 3],
    [A + "", 0],
    [A + "Making room on the Windows drive. This is the only part", 0],
    [A + "that cannot be undone. Do not turn the computer off.", 9],
    [A + "windows  the Windows drive is now 61.2 GiB", 2],
    [A + "", 0],
    [A + "Copying AurOS onto this computer.", 1]
  ];
  for (var p = 0; p <= 100; p += 4) SCRIPT.push(["aurstage-progress " + p, 0.6]);
  SCRIPT.push([A + "", 0], [A + "Making this computer able to start AurOS.", 1]);
  for (p = 0; p <= 100; p += 10) SCRIPT.push(["aurstage-progress " + p, 0.5]);
  SCRIPT.push(
    [A + "", 0],
    [A + "Checking that this computer works under AurOS.", 5],
    [A + "", 0],
    [A + "Writing the new layout.", 4],
    [A + "handing over to the system on /dev/vda3, in this same boot", 4]
  );
  var TOTAL = SCRIPT.reduce(function (a, l) { return a + l[1]; }, 0);

  /* the state after the first n units of scrolling */
  function stateAt(units) {
    var s = fresh(), acc = 0;
    for (var i = 0; i < SCRIPT.length; i++) {
      feed(s, SCRIPT[i][0]);
      acc += SCRIPT[i][1];
      if (acc > units) break;
    }
    return s;
  }

  /* ── paint: the DOM version of screen.c's paint() ─────────────────── */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function Screen(root) {
    this.root = root;
    root.innerHTML = "";
    var mark = el("div", "a-mark"); mark.appendChild(el("i")); mark.appendChild(el("span", null, "AurOS"));
    this.title = el("div", "a-title");
    this.paras = el("div", "a-paras");
    this.bar = el("div", "a-bar"); this.fill = el("span"); this.bar.appendChild(this.fill);
    this.pct = el("div", "a-pct");
    this.steps = el("ol", "a-steps");
    this.items = STEP.map(function (s) { var li = el("li", null, s[1]); this.steps.appendChild(li); return li; }, this);
    this.warn = el("div", "a-warn", "Do not turn the computer off. It will restart by itself.");
    this.foot = el("div", "a-foot");
    [mark, this.title, this.paras, this.bar, this.pct, this.steps, this.warn, this.foot].forEach(function (n) { root.appendChild(n); });
    this.fit();
  }
  Screen.prototype.fit = function () {
    var h = this.root.clientHeight || 720;
    var k = Math.max(0.85, Math.min(2.4, h / 720));
    this.root.style.setProperty("--k", k.toFixed(3));
  };
  Screen.prototype.paint = function (s) {
    this.title.textContent = s.stopped ? "AurOS was not installed" : s.handover ? "AurOS is installed" : "Installing AurOS";
    this.paras.textContent = "";
    s.para.forEach(function (t) { this.paras.appendChild(el("p", null, t)); }, this);
    var bar = s.pct >= 0 && !s.stopped;
    this.bar.hidden = this.pct.hidden = !bar;
    this.root.classList.toggle("has-bar", bar);
    if (bar) { this.fill.style.width = s.pct + "%"; this.pct.textContent = s.pct + "%"; }
    this.items.forEach(function (li, i) {
      li.className = (i < s.step || s.handover) ? "done" : (i === s.step && !s.handover) ? "now" : "";
    });
    var risky = s.step >= RISKY_FROM && !s.stopped && !s.handover;
    this.warn.classList.toggle("on", risky);
    this.foot.textContent = "";
    s.tail.forEach(function (t) { this.foot.appendChild(el("div", null, t)); }, this);
  };

  window.AurOSRestart = { Screen: Screen, stateAt: stateAt, TOTAL: TOTAL, STEP: STEP };
})();
