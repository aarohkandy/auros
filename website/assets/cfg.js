/* cfg.js — the configurator. A recipe made from four answers, written
 * out, validated and compiled by recipes/lib/recipe.mjs (copied here as
 * assets/recipe.mjs: the same code the build uses, not a lookalike).
 *
 * The YAML panel is emitYaml()'s output with its per-field comment lines
 * left out to fit; the two lists under it are compile()'s report: what is
 * on the machines and what is taken out of the standard desktop.
 */
import { OPTIONS, emitYaml, validate, compile } from "./recipe.mjs";

const $ = (s) => document.querySelector(s);
const form = $("#cfg-form");
if (form) {
  // The languages offered here, with the keyboard printed on the keys and a
  // clock to match. Non-Latin scripts get a Latin keyboard plus a second
  // layout, because recipe.mjs only accepts Latin layouts for `keyboard:`
  // (so a password can always be typed).
  const LANGS = [
    ["English (United Kingdom)", { keyboard: "English (UK)", timezone: "Europe/London" }],
    ["English (United States)", { keyboard: "English (US)", timezone: "America/New_York" }],
    ["Spanish", { keyboard: "Spanish", timezone: "Europe/Madrid" }],
    ["French", { keyboard: "French", timezone: "Europe/Paris" }],
    ["German", { keyboard: "German", timezone: "Europe/Berlin" }],
    ["Portuguese (Brazil)", { keyboard: "Portuguese (Brazil)", timezone: "America/Sao_Paulo" }],
    ["Swahili", { keyboard: "English (US)", timezone: "Africa/Nairobi" }],
    ["Arabic", { keyboard: "English (US)", second_script: "Arabic", timezone: "Africa/Cairo" }],
    ["Hindi", { keyboard: "English (India)", second_script: "Hindi (InScript)", timezone: "Asia/Kolkata" }],
    ["Marathi", { keyboard: "English (India)", second_script: "Marathi (InScript)", timezone: "Asia/Kolkata" }],
  ].filter(([l, o]) => OPTIONS.languages[l] && OPTIONS.keyboards[o.keyboard] && (!o.second_script || OPTIONS.keyboards[o.second_script]));

  const APPS = ["Firefox", "LibreOffice Writer", "LibreOffice Calc", "LibreOffice Impress", "Files", "Document Viewer",
    "Image Viewer", "Text Editor", "Calculator", "Media Player", "GCompris", "Typing Tutor", "Scanner"]
    .filter((a) => OPTIONS.apps[a]);
  const START = new Set(["Firefox", "LibreOffice Writer", "Files", "Document Viewer"]);
  const POLICIES = Object.keys(OPTIONS.policies);

  const sel = $("#f-lang");
  for (const [l] of LANGS) sel.add(new Option(l, l, false, l === "English (United Kingdom)"));

  const chips = $("#f-apps");
  const chip = (value, label, on) => {
    const lab = document.createElement("label");
    lab.className = "chip";
    lab.innerHTML = '<input type="checkbox"><span></span>';
    lab.firstChild.value = value; lab.firstChild.checked = on;
    lab.lastChild.textContent = label;
    chips.appendChild(lab);
  };
  for (const a of APPS) chip(a, a, START.has(a));
  if (OPTIONS.capabilities.printing) chip("@printing", "Printing", true);

  const pol = $("#f-policy");
  for (const p of POLICIES) {
    const lab = document.createElement("label");
    lab.innerHTML = '<input type="radio" name="policy"><span></span>';
    lab.firstChild.value = p; lab.firstChild.checked = p === "managed";
    lab.lastChild.textContent = p;
    pol.appendChild(lab);
  }

  const esc = (t) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const yamlEl = $("#yaml"), keepEl = $("#l-keep"), goneEl = $("#l-gone"), nKeep = $("#n-keep"), nGone = $("#n-gone"), says = $("#f-says"),
    refusedEl = $("#plan-refused"), plan = $("#plan");
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  let before = new Set();

  const build = () => {
    const language = sel.value;
    const L = Object.fromEntries(LANGS)[language];
    const picked = [...chips.querySelectorAll("input:checked")].map((i) => i.value);
    const apps = picked.filter((v) => v[0] !== "@").sort();
    const policy = form.querySelector('input[name="policy"]:checked').value;
    const r = {
      schema: 1,
      name: "example-school",
      for: "Shared classroom laptops at an example school. Pupils and teachers use them for schoolwork in the browser and in the few programs listed here, and nobody installs anything by hand.",
      organisation: { display_name: "Example School" },
      language,
      keyboard: L.keyboard,
    };
    if (L.second_script) { r.second_script = L.second_script; r.switch_scripts_with = "Windows key + Spacebar"; }
    r.timezone = L.timezone;
    r.apps = apps;
    r.prune = { keep_only_the_apps_above: true };
    if (picked.includes("@printing")) r.prune.also_keep = ["printing"];
    r.policy = policy;
    // (no kiosk: block: recipe.mjs refuses it -- the locked shell picks the
    // program a kiosk starts, and a recipe cannot yet say otherwise)
    if ($("#f-pin").checked) r.pin = ["firefox"];
    return r;
  };

  const render = () => {
    const r = build();
    says.textContent = OPTIONS.policies[r.policy].says;
    let yaml;
    try { yaml = emitYaml(r); } catch (e) { yaml = ""; }
    const lines = yaml.split("\n").filter((l, i) => !(l.startsWith("#") && i > 0)).join("\n").replace(/\n{2,}/g, "\n").trim();
    const v = validate(r);
    // One block per line with a hanging indent: a long line wraps under
    // its own text instead of back at the left edge, where it would read
    // as a new key.
    const row = (inner, n) => '<span class="ln" style="--in:' + n + 'ch">' + inner + "</span>";
    let html = lines.split("\n").map((l) => {
      const n = l.match(/^\s*/)[0].length, t = l.slice(n);
      if (t.startsWith("#")) return row('<span class="c">' + esc(t) + "</span>", n);
      const m = t.match(/^([a-z_]+):(.*)$/);
      return row(m ? '<span class="k">' + m[1] + "</span>:" + esc(m[2]) : esc(t), n);
    }).join("");
    if (!v.ok) {
      html += row("&nbsp;", 0) + v.errors.map((e) => row('<span class="err"># refused: ' + esc((e.path ? e.path + ": " : "") + e.message) + "</span>", 0)).join("");
    }
    yamlEl.innerHTML = html;
    // a refusal is the answer, so it is said where the lists were, not
    // only at the bottom of a scrolled file
    refusedEl.hidden = v.ok;
    plan.classList.toggle("refused", !v.ok);
    refusedEl.textContent = v.ok ? "" : "Refused, and nothing is built: " + v.errors.map((e) => e.message).join(" ");

    keepEl.textContent = ""; goneEl.textContent = "";
    if (!v.ok) { nKeep.textContent = "–"; nGone.textContent = "–"; return; }
    const { report } = compile(r);
    const now = new Set();
    for (const i of report.installed) {
      const li = document.createElement("li");
      li.textContent = cap(i.item);
      keepEl.appendChild(li);
    }
    for (const i of report.removed) {
      const li = document.createElement("li");
      li.innerHTML = esc(cap(i.item)) + " <small>" + esc(i.packages.join(" ")) + "</small>";
      now.add(i.item);
      if (before.size && !before.has(i.item)) li.className = "new";
      goneEl.appendChild(li);
    }
    before = now;
    nKeep.textContent = String(report.installed.length);
    nGone.textContent = String(report.removed.length);
  };
  form.addEventListener("change", render);
  form.addEventListener("submit", (e) => e.preventDefault());
  render();
}
