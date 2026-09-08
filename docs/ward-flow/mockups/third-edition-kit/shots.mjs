// Usage (from the wardflow directory): node merged/shots.mjs <file.html> <outprefix> <fontcss>
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
const file = process.argv[2],
  out = process.argv[3] || "merged/shot",
  css = process.argv[4] || "platinum";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const route = async (p) => {
  await p.route(/fonts\.googleapis\.com/, (r) =>
    r.fulfill({ contentType: "text/css", body: fs.readFileSync(`fonts/${css}.css`) }),
  );
  await p.route(/fonts\.gstatic\.com/, (r) => {
    const f = "fonts/" + path.basename(new URL(r.request().url()).pathname);
    try {
      r.fulfill({ contentType: "font/woff2", body: fs.readFileSync(f) });
    } catch {
      r.abort();
    }
  });
};
const shots = {};
for (const scheme of ["light", "dark"]) {
  for (const dsf of [1, 2]) {
    const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, colorScheme: scheme, deviceScaleFactor: dsf });
    await route(p);
    await p.goto("file://" + process.cwd() + "/" + file, { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(600);
    const buf = await p.screenshot();
    fs.writeFileSync(`${out}-${scheme}@${dsf}x.png`, buf);
    if (dsf === 1) shots[scheme] = buf.toString("base64");
    await p.close();
  }
}
const q = await b.newPage({ viewport: { width: 1920, height: 100 } });
await q.setContent(
  `<style>body{margin:0;background:#0c0d0f;font:600 16px system-ui;color:#e8e8e8}.w{display:grid;gap:14px;padding:16px}.c{display:grid;gap:8px}.c span{padding:0 4px;font-weight:500;color:#aaa}img{width:100%;display:block;border-radius:8px}</style><div class="w"><div class="c"><span>Light</span><img src="data:image/png;base64,${shots.light}"></div><div class="c"><span>Dark</span><img src="data:image/png;base64,${shots.dark}"></div></div>`,
);
await q.waitForTimeout(300);
await q.screenshot({ path: `${out}-pair.png`, fullPage: true });
await q.close();
await b.close();
console.log("wrote", `${out}-{light,dark}@{1,2}x.png`, `${out}-pair.png`);
