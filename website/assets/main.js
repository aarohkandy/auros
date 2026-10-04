/* main.js — the landing page. No framework, no build step.
 *
 *   1. the sky (assets/aurora.js), started after first paint
 *   2. the laptop: scrolling pushes the camera into its screen
 *   3. the one restart (assets/restart.js does the screen itself)
 * The page reads completely without any of this.
 */
(function () {
  "use strict";
  var root = document.documentElement;
  var motion = root.classList.contains("motion");
  var $ = function (s, el) { return (el || document).querySelector(s); };

  /* ── the sky ───────────────────────────────────────────────────── */
  function startSky() {
    var c = $("#sky");
    if (!c || !window.AurOSAurora) return;
    window.AurOSAurora.start(c, {
      reduce: !motion || /[?&]still\b/.test(location.search),
      onFirstFrame: function () { c.classList.add("on"); }
    });
  }
  // after the hero text and the still have painted
  if (document.readyState === "complete") setTimeout(startSky, 200);
  else window.addEventListener("load", function () { setTimeout(startSky, 200); });

  /* ── the laptop: push in ───────────────────────────────────────── */
  var hero = $(".hero"), rig = $("#rig"), copy = $(".hero-copy"), cue = $(".scroll-cue");
  var machine = rig && $(".machine", rig), lid = rig && $(".lid", rig), black = rig && $(".screen .black", rig);
  if (hero && rig && motion) {
    var base = null;
    var measure = function () {
      // where the screen sits with no scroll, so the push-in can aim at it
      rig.style.transform = "";
      var s = $(".screen", rig).getBoundingClientRect();
      var r = rig.getBoundingClientRect();
      base = { sx: s.left + s.width / 2, sy: s.top + s.height / 2, sw: s.width, sh: s.height,
               ox: r.left + r.width * 0.5, oy: r.top + r.height * 0.6 };
    };
    var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    var ticking = false;
    var update = function () {
      ticking = false;
      if (!base) measure();
      var h = hero.offsetHeight - window.innerHeight;
      var p = Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / Math.max(1, h)));
      var e = ease(p);
      var vw = window.innerWidth, vh = window.innerHeight;
      // scale so the screen ends up a little larger than the viewport
      var S = Math.max(vw / base.sw, vh / base.sh) * 1.04;
      var k = 1 + (S - 1) * e;
      var dx = (vw / 2 - base.sx) * e, dy = (vh / 2 - base.sy) * e;
      // the screen's centre relative to the transform origin, scaled
      rig.style.transform = "translate(" + (dx - (base.sx - base.ox) * (k - 1)) + "px," +
        (dy - (base.sy - base.oy) * (k - 1)) + "px) scale(" + k + ")";
      // the camera comes round to face the screen as it closes in
      var ry = rig.dataset.ry ? +rig.dataset.ry : (vw <= 860 ? -6 : -14);
      var rx = vw <= 860 ? -10 : -9;
      machine.style.transform = "rotateX(" + (rx * (1 - e)) + "deg) rotateY(" + (ry * (1 - e)) + "deg)";
      lid.style.setProperty("--lid", (12 * (1 - e)) + "deg");
      copy.style.opacity = String(Math.max(0, 1 - p * 3));
      copy.style.transform = "translateY(" + (-p * 120) + "px)";
      if (cue) cue.style.opacity = String(Math.max(0, 1 - p * 6));
      // and the screen goes dark: the one restart
      black.style.opacity = String(Math.min(1, Math.max(0, (p - 0.72) / 0.22)));
    };
    var onScroll = function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () { base = null; onScroll(); });
    // the lid animation sets its own transform; measure after it ends
    setTimeout(function () { root.classList.remove("boot-anim"); base = null; update(); }, 2400);
    update();
  }
})();
