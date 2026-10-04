// stills.mjs — the hero's first paint: one frame of assets/aurora.js,
// rendered by a real browser, saved as AVIF/WebP. The page shows this
// until WebGL has drawn (and forever with JS off).
//
//   (cd website && python3 -m http.server 8801) &
//   node website/tools/stills.mjs http://localhost:8801   (from the repo root)
// Needs playwright (chromium), cwebp, avifenc.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
const base = process.argv[2] || 'http://localhost:8801';
const out = 'website/assets/sky';
const shots = [
  { name: 'still-1600', w: 1600, h: 1000, t: 120 },
  { name: 'still-portrait', w: 820, h: 1480, t: 120 },
];
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const s of shots) {
  const p = await b.newPage({ viewport: { width: s.w, height: s.h } });
  await p.goto(`${base}/tools/sky.html?t=${s.t}&scale=1&grain=0.022`);
  await p.waitForSelector('body[data-ready]', { timeout: 60000 });
  await p.waitForTimeout(300);
  const png = `/tmp/${s.name}.png`;
  await p.screenshot({ path: png });
  execFileSync('cwebp', ['-quiet', '-q', '78', '-m', '6', png, '-o', `${out}/${s.name}.webp`]);
  execFileSync('avifenc', ['-q', '62', '-s', '4', png, `${out}/${s.name}.avif`]);
  await p.close();
}
await b.close();
