#!/usr/bin/env python3
"""data.py -- the numbers on the website, read out of the repository.

    python3 website/tools/data.py          (from the repo root)

Writes website/assets/data/facts.json. Every number the landing page
shows that comes from a transcript is in here, with the file it came
from, so nobody types a number into the HTML by hand. The page also
carries each number in its markup (so it reads with JS off); run this
and diff when a transcript changes.
"""
import json, re, os, sys

def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()

out = {}

# ── docs/results/powercut.txt ──────────────────────────────────────
src = "docs/results/powercut.txt"
txt = read(src)
inst, cur, phase = [], None, "install"
for line in txt.splitlines():
    if "the power goes during the restore" in line:
        phase = "restore"
    m = re.match(r"^  ── (\S+)$", line)
    if m:
        cur = {"name": m.group(1), "phase": phase, "checks": []}
        inst.append(cur)
        continue
    m = re.match(r"^    (.+?)\s+(ok|FAIL)$", line)
    if m and cur:
        cur["checks"].append([m.group(1), m.group(2)])
tot = re.search(r"^(\d+) checks:", txt, re.M)
oks = len(re.findall(r" ok$", txt, re.M))
fails = len(re.findall(r" FAIL$", txt, re.M))
out["powercut"] = {
    "source": src,
    "instants": len(inst),
    "install_instants": sum(1 for i in inst if i["phase"] == "install"),
    "restore_instants": sum(1 for i in inst if i["phase"] == "restore"),
    "checks": int(tot.group(1)) if tot else None,
    "ok": oks, "fail": fails,
    "files_in_windows": int(re.search(r"with (\d+) files in Windows", txt).group(1)),
    "list": inst,
}

# ── lathe/hardware/compat.tsv: real PCs installed ─────────────────
src = "lathe/hardware/compat.tsv"
rows = [l for l in read(src).splitlines()[1:] if l.strip()]
out["real_pcs"] = {"source": src, "count": len(rows)}

# ── docs/results/*.txt: the other transcripts' totals ─────────────
tests = {}
for name in ["roundtrip", "nostick", "firstboot", "putback", "loader", "screen", "bootchain", "bootupdate", "choicesboot"]:
    p = "docs/results/%s.txt" % name
    if not os.path.exists(p):
        continue
    t = read(p)
    tests[name] = {"source": p, "ok": len(re.findall(r" ok$", t, re.M)),
                   "fail": len(re.findall(r" FAIL$", t, re.M))}
out["transcripts"] = tests

# ── the desktop image (docs/results/desktop.json) ─────────────────
d = json.loads(read("docs/results/desktop.json"))
out["image"] = {"source": "docs/results/desktop.json", "profile": d["profile"],
                "image_bytes": d["image_bytes"], "image_sha256": d["image_sha256"],
                "artifact_sha256": d["artifact_sha256"]}

os.makedirs("website/assets/data", exist_ok=True)
with open("website/assets/data/facts.json", "w") as f:
    json.dump(out, f, indent=1)
pc = out["powercut"]
print("powercut: %d instants (%d install + %d restore), %d checks, %d ok, %d FAIL"
      % (pc["instants"], pc["install_instants"], pc["restore_instants"], pc["checks"], pc["ok"], pc["fail"]))
print("real PCs:", out["real_pcs"]["count"])
for k, v in tests.items():
    print("%-12s %3d ok %d FAIL" % (k, v["ok"], v["fail"]))
