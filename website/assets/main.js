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
      force: /[?&]gl=force\b/.test(location.search),
      reduce: !motion || /[?&]still\b/.test(location.search),
      onFirstFrame: function () { c.classList.add("on"); }
    });
  }
  // after the hero text and the still have painted
  var idle = function (f) { (window.requestIdleCallback || setTimeout)(f, { timeout: 2500 }); };
  var later = function () { setTimeout(function () { idle(startSky); }, 600); };
  if (document.readyState === "complete") later();
  else window.addEventListener("load", later);

  /* ── the laptop: push in ───────────────────────────────────────── */
  var hero = $(".hero"), rig = $("#rig"), copy = $(".hero-copy"), cue = $(".scroll-cue"), sky = $(".sky");
  var machine = rig && $(".machine", rig), lid = rig && $(".lid", rig), black = rig && $(".screen .black", rig),
      boot = rig && $(".screen .aur-boot", rig);
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
      // (a phone is portrait and the screen is not: there it fills the
      // width, and the night around it goes black instead)
      var S = vw <= 860 ? vw / base.sw * 1.02 : Math.max(vw / base.sw, vh / base.sh) * 1.04;
      var k = 1 + (S - 1) * e;
      var dx = (vw / 2 - base.sx) * e, dy = (vh / 2 - base.sy) * e;
      // the screen's centre relative to the transform origin, scaled
      rig.style.transform = "translate(" + (dx - (base.sx - base.ox) * (k - 1)) + "px," +
        (dy - (base.sy - base.oy) * (k - 1)) + "px) scale(" + k + ")";
      // the camera comes round to face the screen as it closes in
      var ry = vw <= 860 ? -6 : -9;
      var rx = vw <= 860 ? -10 : -11;
      machine.style.transform = "rotateX(" + (rx * (1 - e)) + "deg) rotateY(" + (ry * (1 - e)) + "deg)";
      lid.style.setProperty("--lid", (12 * (1 - e)) + "deg");
      copy.style.opacity = String(Math.max(0, 1 - p * 3));
      sky.style.opacity = String(1 - Math.min(1, Math.max(0, (p - 0.25) / 0.45)));
      copy.style.transform = "translateY(" + (-p * 120) + "px)";
      if (cue) cue.style.opacity = String(Math.max(0, 1 - p * 6));
      // and the screen goes dark: the one restart
      black.style.opacity = String(Math.min(1, Math.max(0, (p - 0.62) / 0.16)));
      // ...and comes back as the staging screen the next section is about
      boot.style.opacity = String(Math.min(1, Math.max(0, (p - 0.84) / 0.12)));
    };
    var onScroll = function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { try { update(); } catch (err) { /* keep scrolling usable */ } }); } };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () { base = null; onScroll(); });
    // the lid animation sets its own transform; measure after it ends
    setTimeout(function () { root.classList.remove("boot-anim"); base = null; update(); }, 2400);
    update();
  }
  /* ── 2. the one restart, driven by scrolling ───────────────────── */
  var R = window.AurOSRestart, aurEl = $("#aur");
  if (R && aurEl && motion) {
    var screen = new R.Screen(aurEl);
    var track = $(".restart-track"), fig = $(".r-screen");
    var nEl = $("#r-n"), lEl = $("#r-label");
    var dHead = $("#d-head"), segWin = $("#seg-win"), segAur = $("#seg-aur"), dWin = $("#d-win"), dAur = $("#d-aur");
    // the illustration: a 256 GB drive (238.4 GiB); EFI 0.1, recovery 1.0,
    // Windows 237.3 of which 61.2 used (the fixture's shrunk size)
    var WIN = 237.3, USED = 61.2, FREED = WIN - USED;
    var lastKey = "";
    var paintRestart = function () {
      var r = track.getBoundingClientRect();
      var span = track.offsetHeight - window.innerHeight;
      var p = Math.min(1, Math.max(0, -r.top / Math.max(1, span)));
      // 84% of the track is the install; the rest is the first start
      var q = Math.min(1, p / 0.84);
      var st = R.stateAt(q * R.TOTAL);
      var key = q.toFixed(4);
      if (key !== lastKey) {
        lastKey = key;
        screen.paint(st);
        var step = st.handover ? 6 : st.step;
        nEl.textContent = String(step + 1);
        lEl.textContent = st.handover ? "AurOS is installed" : R.STEP[step][1];
        // the drive: shrink while "Making room", fill while "Copying"
        var shrink = st.step > 2 || st.handover ? 1 : st.step === 2 ? 0.999 : 0;
        if (st.step === 2) {
          // how far through "Making room" are we, by scroll
          shrink = Math.min(1, Math.max(0, (q - 0.30) / 0.10));
        }
        var copy = st.handover || st.step > 3 ? 100 : st.step === 3 ? Math.max(0, st.pct) : 0;
        var win = WIN - FREED * shrink, aur = FREED * shrink;
        segWin.style.setProperty("--w", win.toFixed(2));
        segWin.style.setProperty("--used", (USED / win * 100).toFixed(2) + "%");
        segAur.style.setProperty("--w", aur.toFixed(2));
        segAur.style.setProperty("--fill", copy + "%");
        dWin.textContent = win.toFixed(1);
        // the read/write head: where on the drive each step is working
        var TOT = 0.1 + WIN + 1, at = null;
        if (!st.handover) {
          if (st.step === 0) at = 0.1 + USED + (WIN - USED) * Math.min(1, q / 0.2);
          else if (st.step === 1) at = 0.05;
          else if (st.step === 2) at = 0.1 + win;
          else if (st.step === 3) at = 0.1 + win + aur * Math.max(0, st.pct) / 100;
          else if (st.step === 4) at = 0.1 + win + aur * (0.9 + 0.1 * Math.max(0, st.pct) / 100);
          else if (st.step === 5) at = 0.1 + win + aur * 0.5;
          else at = 0.02;
        }
        dHead.style.opacity = at == null ? "0" : "1";
        if (at != null) dHead.style.left = (at / TOT * 100).toFixed(2) + "%";
        dAur.textContent = aur.toFixed(1);
      }
      fig.classList.toggle("welcome", p > 0.88);
      // the first stretch of the track: the screen arrives full-bleed
      // (where the laptop left it) and settles into its frame
      var e = Math.min(1, Math.max(0, p / 0.07));
      e = 1 - Math.pow(1 - e, 3);
      if (e !== lastE) {
        lastE = e;
        var bz = $(".r-bezel", fig);
        bz.style.transform = "";
        var fr = bz.getBoundingClientRect();
        var vw = window.innerWidth, vh = window.innerHeight;
        var S0 = Math.max(vw / fr.width, vh / fr.height) * 1.02;
        var k = S0 + (1 - S0) * e;
        // measured relative to the pinned stage, so it is right before
        // the stage has reached the top as well as after
        var sr = stage.getBoundingClientRect();
        var tx = (vw / 2 - (fr.left + fr.width / 2)) * (1 - e),
            ty = (vh / 2 - (fr.top - sr.top + fr.height / 2)) * (1 - e);
        bz.style.transformOrigin = "50% 50%";
        bz.style.transform = e >= 1 ? "" : "translate(" + tx + "px," + ty + "px) scale(" + k + ")";
        stage.style.setProperty("--intro", e.toFixed(3));
      }
    };
    var lastE = -1, stage = $(".restart-stage");
    var rt = false;
    window.addEventListener("scroll", function () { if (!rt) { rt = true; requestAnimationFrame(function () { rt = false; paintRestart(); }); } }, { passive: true });
    window.addEventListener("resize", function () { screen.fit(); lastKey = ""; paintRestart(); });
    paintRestart();
  }

  /* ── 3. the power cuts: read what the test checked at each ─────── */
  var tl = $("#tl"), trBody = $("#tr-body"), trName = $("#tr-name");
  if (tl) {
    var facts = null;
    var scope = $("#scope"), scName = $("#sc-name"), scOk = $("#sc-ok"), cur = 0, auto = null;
    var NS = "http://www.w3.org/2000/svg";
    // The scope: the machine's power, drawn as a trace across the 18
    // instants. At the chosen one it falls to nothing; after it, a second
    // trace comes back up: switched on again, Windows starts.
    var drawScope = function (i) {
      if (!scope) return;
      var w = scope.clientWidth || 800, h = scope.clientHeight || 220;
      scope.setAttribute("viewBox", "0 0 " + w + " " + h);
      var sr = scope.getBoundingClientRect();
      var xs = Array.prototype.map.call(tl.querySelectorAll("li.tick"), function (li) {
        var r = li.getBoundingClientRect(); return r.left + r.width / 2 - sr.left;
      });
      var x = xs[i], hi = h * 0.26, lo = h * 0.86, d = "M0 " + hi;
      for (var px = 6; px < x; px += 6) d += " L" + px + " " + (hi + Math.sin(px * 0.21) * 1.6 + Math.sin(px * 0.047 + i) * 2.4).toFixed(1);
      d += " L" + x + " " + hi + " L" + (x + 2) + " " + lo + " L" + w + " " + lo;
      var back = "M" + (x + 26) + " " + lo + " C" + (x + 60) + " " + lo + " " + (x + 50) + " " + (hi + 14) + " " + (x + 96) + " " + (hi + 14) + " L" + w + " " + (hi + 14);
      scope.textContent = "";
      var grid = document.createElementNS(NS, "g"); grid.setAttribute("class", "sc-grid");
      for (var gy = 1; gy < 4; gy++) { var l = document.createElementNS(NS, "line"); l.setAttribute("x1", 0); l.setAttribute("x2", w); l.setAttribute("y1", h * gy / 4); l.setAttribute("y2", h * gy / 4); grid.appendChild(l); }
      xs.forEach(function (gx, j) { var l = document.createElementNS(NS, "line"); l.setAttribute("x1", gx); l.setAttribute("x2", gx); l.setAttribute("y1", h * 0.08); l.setAttribute("y2", h); l.setAttribute("class", j === i ? "on" : ""); grid.appendChild(l); });
      scope.appendChild(grid);
      var mk = function (dd, cls) { var p = document.createElementNS(NS, "path"); p.setAttribute("d", dd); p.setAttribute("class", cls); scope.appendChild(p); return p; };
      mk(d, "sc-glow"); var tr = mk(d, "sc-trace"); var bk = mk(back, "sc-back");
      var c = document.createElementNS(NS, "circle"); c.setAttribute("cx", x); c.setAttribute("cy", lo); c.setAttribute("r", 4); c.setAttribute("class", "sc-dot"); scope.appendChild(c);
      if (motion) [tr, bk].forEach(function (p, k) {
        var L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
        p.getBoundingClientRect();
        p.style.transition = "stroke-dashoffset " + (k ? 0.7 : 1.1) + "s ease " + (k ? 1.0 : 0) + "s";
        p.style.strokeDashoffset = 0;
      });
      var lab = document.createElementNS(NS, "text");
      lab.setAttribute("x", Math.min(x + 104, w - 4)); lab.setAttribute("y", hi + 4);
      lab.setAttribute("text-anchor", x + 104 > w - 140 ? "end" : "start");
      lab.setAttribute("class", "sc-lab"); lab.textContent = "Windows comes back";
      if (x + 104 < w - 20) scope.appendChild(lab);
    };
    var show = function (i) {
      if (!facts) return;
      cur = i;
      var it0 = facts.powercut.list[i];
      scName.textContent = "power cut at " + it0.name;
      scOk.textContent = it0.checks.filter(function (c) { return c[1] === "ok"; }).length + " of " + it0.checks.length + " ok";
      drawScope(i);
      var it = facts.powercut.list[i];
      trName.textContent = "── " + it.name;
      trBody.textContent = "";
      it.checks.forEach(function (c) {
        var line = document.createElement("span");
        var pad = c[0].length < 58 ? new Array(59 - c[0].length).join(" ") : " ";
        line.textContent = "    " + c[0] + pad;
        var ok = document.createElement("span");
        ok.className = c[1] === "ok" ? "ok" : "fail";
        ok.textContent = c[1];
        trBody.appendChild(line); trBody.appendChild(ok); trBody.appendChild(document.createTextNode("\n"));
      });
      Array.prototype.forEach.call(tl.querySelectorAll("button"), function (b, j) {
        b.setAttribute("aria-pressed", j === i ? "true" : "false");
      });
    };
    fetch("assets/data/facts.json").then(function (r) { return r.json(); }).then(function (f) {
      facts = f;
      var start = 0;
      f.powercut.list.forEach(function (it, i) { if (it.name === "shrink-end") start = i; });
      show(start);
    }).catch(function () {});
    var stopAuto = function () { if (auto) { clearInterval(auto); auto = null; } };
    tl.addEventListener("click", function (e) {
      var li = e.target.closest("li.tick");
      if (li) { stopAuto(); show(+li.getAttribute("data-i")); }
    });
    // while it is on screen and nobody has chosen, walk through the cuts
    if (motion && "IntersectionObserver" in window) {
      var touched = false;
      tl.addEventListener("focusin", function () { touched = true; stopAuto(); });
      new IntersectionObserver(function (es) {
        if (es[0].isIntersecting && !touched && !auto) auto = setInterval(function () { if (facts) show((cur + 1) % facts.powercut.list.length); }, 3200);
        else if (!es[0].isIntersecting) stopAuto();
      }, { threshold: 0.4 }).observe(tl.parentNode);
      tl.addEventListener("pointerdown", function () { touched = true; stopAuto(); });
    }
    window.addEventListener("resize", function () { if (facts) drawScope(cur); });
    tl.addEventListener("keydown", function (e) {
      var li = e.target.closest("li.tick"); if (!li) return;
      var i = +li.getAttribute("data-i"), n = tl.children.length;
      var j = e.key === "ArrowRight" ? Math.min(n - 1, i + 1) : e.key === "ArrowLeft" ? Math.max(0, i - 1) : -1;
      if (j >= 0) { e.preventDefault(); show(j); tl.children[j].querySelector("button").focus(); }
    });
  }

  /* ── 3b. two fingerprints, made in this browser ────────────────── */
  var prints = $("#prints");
  if (prints && window.crypto && crypto.subtle && "IntersectionObserver" in window) {
    var hex = function (buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); };
    // OpenSSH's "drunken bishop" picture of a fingerprint (ssh-keygen -lv):
    // a 17x9 field walked two bits at a time, so equal hashes draw equal
    // pictures and different ones, almost always, visibly do not.
    var art = function (box, h, label) {
      var W = 17, H = 9, f = [], x = 8, y = 4, i, j, chars = " .o+=*BOX@%&#/^";
      for (i = 0; i < W * H; i++) f.push(0);
      for (i = 0; i < 32; i++) {
        var byte = parseInt(h.substr(i * 2, 2), 16);
        for (j = 0; j < 4; j++) {
          x = Math.max(0, Math.min(W - 1, x + ((byte & 1) ? 1 : -1)));
          y = Math.max(0, Math.min(H - 1, y + ((byte & 2) ? 1 : -1)));
          f[y * W + x]++; byte >>= 2;
        }
      }
      var end = y * W + x, out = "+----[SHA256]-----+\n";
      for (var r = 0; r < H; r++) {
        out += "|";
        for (var c = 0; c < W; c++) {
          var k = r * W + c;
          out += (k === 4 * W + 8) ? "S" : (k === end) ? "E" : chars[Math.min(chars.length - 1, f[k])];
        }
        out += "|\n";
      }
      box.textContent = out + label;
      box.classList.add("done");
    };
    var write = function (el, h) {
      $(".p-hash", el).textContent = h.match(/.{1,16}/g).join(" ");
      var pre = $(".p-art", el);
      art(pre, h, pre.textContent.split("\n").pop());
    };
    var run = function () {
      // the fixture: p1..p6.jpg, 64 KiB each, and thesis.odt, 2 MiB, random
      var sizes = [65536, 65536, 65536, 65536, 65536, 65536, 2097152];
      var files = sizes.map(function (n) {
        var b = new Uint8Array(n);
        for (var o = 0; o < n; o += 65536) crypto.getRandomValues(b.subarray(o, Math.min(n, o + 65536)));
        return b;
      });
      var whole = function (fs) {
        var total = fs.reduce(function (a, f) { return a + f.length; }, 0), all = new Uint8Array(total), o = 0;
        fs.forEach(function (f) { all.set(f, o); o += f.length; });
        return crypto.subtle.digest("SHA-256", all);
      };
      var pbWin = $("#pb-win"), pbAur = $("#pb-aur"), say = $("#pb-say");
      var WIN0 = 61.2, AUR0 = 176.1;
      whole(files).then(function (h1) {
        write($("#pr-before"), hex(h1));
        // Put Windows back: AurOS's space goes back to Windows, then the
        // files are read again and fingerprinted. (Here the bytes make a
        // round trip through a copy; on the test machine they never move.)
        say.textContent = "Putting Windows back…";
        prints.classList.add("restoring");
        var copies = files.map(function (f) { return f.slice(0); });
        var T = motion ? 2600 : 0, t0 = performance.now();
        var step = function (now) {
          var k = T ? Math.min(1, (now - t0) / T) : 1;
          var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          pbWin.style.setProperty("--w", (WIN0 + AUR0 * e).toFixed(2));
          pbWin.style.setProperty("--used", (WIN0 / (WIN0 + AUR0 * e) * 100).toFixed(2) + "%");
          pbAur.style.setProperty("--w", (AUR0 * (1 - e)).toFixed(2));
          if (k < 1) { requestAnimationFrame(step); return; }
          whole(copies).then(function (h2) {
            write($("#pr-after"), hex(h2));
            var same = hex(h1) === hex(h2);
            prints.classList.remove("restoring");
            prints.classList.add(same ? "same" : "diff");
            say.textContent = same ? "After: Windows is its full size again. Same bytes, same fingerprint." : "After: the fingerprints differ.";
            $(".print-eq", prints).classList.toggle("same", same);
            Array.prototype.forEach.call(document.querySelectorAll("#p-files li"), function (li, i) {
              setTimeout(function () { li.classList.add("ok"); }, motion ? i * 90 : 0);
            });
          });
        };
        requestAnimationFrame(step);
      });
    };
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { io.disconnect(); run(); }
    }, { rootMargin: "0px 0px -15% 0px" });
    io.observe(prints);
  }

  /* ── 4. the gallery: the same laptop, every look ────────────────── */
  var gallery = $("#gallery");
  if (gallery) {
    var gscreen = $(".rig-g .screen", gallery), glass = $(".glass", gscreen), grig = $("#rig-g"),
        tabs = gallery.querySelectorAll(".g-tab");
    var gName = $("#g-name"), gDesc = $("#g-desc"), gSrc = $("#g-src");
    // The light a screen throws is its own average colour (measured from
    // each render), brightened to a hue and scaled by how bright it is.
    var light = function (tone) {
      var c = tone.split(",").map(Number), m = Math.max(c[0], c[1], c[2], 1);
      var lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
      var hue = c.map(function (v) { return Math.round(150 + 105 * v / m); });
      var a = 0.16 + lum * 0.5;
      grig.style.setProperty("--spill", "rgba(" + hue.join(",") + "," + a.toFixed(2) + ")");
      grig.style.setProperty("--spill-ground", "rgba(" + hue.join(",") + "," + (a * 0.45).toFixed(2) + ")");
      gallery.style.setProperty("--pool", "rgba(" + hue.join(",") + "," + (0.05 + lum * 0.16).toFixed(3) + ")");
    };
    var pick = function (btn) {
      Array.prototype.forEach.call(tabs, function (t) { t.setAttribute("aria-pressed", t === btn ? "true" : "false"); });
      var name = btn.getAttribute("data-img"), isTheme = name.indexOf("theme-") === 0;
      var b = "assets/renders/" + name;
      var pic = document.createElement("picture");
      pic.className = "g-img";
      pic.innerHTML = '<source type="image/avif" srcset="' + b + '-1366.avif 1366w, ' + b + '-2732.avif 2732w" sizes="(max-width: 960px) 92vw, 64vw">' +
        '<img src="' + b + '-1366.webp" srcset="' + b + '-683.webp 683w, ' + b + '-1366.webp 1366w, ' + b + '-2732.webp 2732w" sizes="(max-width: 960px) 92vw, 64vw" width="1366" height="768" decoding="async" alt="">';
      var img = $("img", pic);
      img.alt = "The AurOS desktop: " + btn.textContent + (isTheme ? " look, Everything in a row layout." : " layout, Nocturne look, three programs open.");
      var swap = function () {
        gscreen.insertBefore(pic, glass);
        requestAnimationFrame(function () { requestAnimationFrame(function () {
          pic.classList.add("on");
          light(btn.getAttribute("data-tone") || "23,26,29");
          var old = gscreen.querySelectorAll(".g-img");
          setTimeout(function () { Array.prototype.forEach.call(old, function (o) { if (o !== pic) o.remove(); }); }, 800);
        }); });
      };
      if (img.decode) img.decode().then(swap, swap); else swap();
      gName.textContent = btn.textContent;
      gDesc.textContent = btn.getAttribute("data-desc");
      gSrc.textContent = (isTheme ? btn.getAttribute("data-src") + " · shells/rail.shell" : "themes/nocturne.theme · " + btn.getAttribute("data-src")) +
        " · rendered through src/aurshell at 1366 × 768";
    };
    light("23,26,29");
    Array.prototype.forEach.call(tabs, function (t, i) {
      t.addEventListener("click", function () { pick(t); });
      t.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = tabs[(i + d + tabs.length) % tabs.length];
        n.focus(); pick(n);
      });
    });
  }
})();
