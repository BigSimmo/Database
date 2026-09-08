// Usage (from the wardflow directory): node merged/check.mjs <file.html> <fontcss:platinum|premium>
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
const file = process.argv[2],
  css = process.argv[3] || "platinum";
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
const audit = () => {
  const lum = (c) => {
    const m = c.match(/[\d.]+/g);
    if (!m) return null;
    const [r, g, bb] = m
      .slice(0, 3)
      .map(Number)
      .map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bb;
  };
  const alpha = (c) => {
    const m = c.match(/[\d.]+/g);
    return m && m[3] !== undefined ? +m[3] : m ? 1 : 0;
  };
  const bgOf = (el) => {
    let e = el;
    while (e && e !== document.documentElement) {
      const cs = getComputedStyle(e);
      if (alpha(cs.backgroundColor) > 0.9) return cs.backgroundColor;
      e = e.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  };
  const els = [...document.querySelectorAll("body *")].filter((e) => {
    if (e.closest("svg")) return false;
    const cs = getComputedStyle(e);
    if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.9) return false;
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) return false;
    return [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
  });
  let low = [],
    minFont = 99,
    n = 0,
    small = [];
  for (const e of els) {
    const cs = getComputedStyle(e);
    const size = parseFloat(cs.fontSize);
    if (size < minFont) minFont = size;
    if (size < 10.5) small.push([e.className || e.tagName, size]);
    const bold = +cs.fontWeight >= 700;
    const large = size >= 18.66 || (size >= 14 && bold);
    const a = lum(cs.color),
      c = lum(bgOf(e));
    if (a == null || c == null) continue;
    n++;
    const r = (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
    const need = large ? 3 : 4.5;
    if (r < need) low.push([e.className || e.tagName, +r.toFixed(2), size, e.textContent.trim().slice(0, 30)]);
  }
  const svgT = [...document.querySelectorAll("svg text")].map((t) => parseFloat(getComputedStyle(t).fontSize));
  const minSvg = svgT.length ? Math.min(...svgT) : null;
  const diag = document.getElementById("diagWrap") || document.querySelector(".diagWrap");
  const fonts = [...document.fonts]
    .filter((f) => f.status === "loaded")
    .map((f) => f.family)
    .filter((v, i, a) => a.indexOf(v) === i);
  const weights = [
    ...new Set(
      [...document.querySelectorAll("body *")].map(
        (e) => getComputedStyle(e).fontFamily.split(",")[0].replace(/"/g, "") + " " + getComputedStyle(e).fontWeight,
      ),
    ),
  ].filter((w) => /Serif 4 (500|800|900)|Sans 3 (800|900)|JetBrains Mono (700|800)/.test(w));
  return {
    fonts,
    badWeights: weights,
    reconcile: Array.isArray(window.__commandCheck) ? window.__commandCheck.length : "absent",
    ovx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    minFont,
    minSvg,
    sampled: n,
    lowCount: low.length,
    low: low.slice(0, 10),
    small: small.slice(0, 10),
    diagH: diag ? diag.clientHeight : null,
    diagOvx: diag ? diag.scrollWidth - diag.clientWidth : null,
  };
};
let ok = true;
const say = (k, pass, detail) => {
  ok = ok && pass;
  console.log((pass ? "PASS" : "FAIL") + "  " + k + (detail ? "  " + detail : ""));
};
for (const scheme of ["light", "dark"]) {
  for (const vp of [
    [1920, 1080],
    [1440, 900],
    [1280, 800],
    [1200, 900],
    [390, 844],
  ]) {
    const p = await b.newPage({
      viewport: { width: vp[0], height: vp[1] },
      colorScheme: scheme,
      isMobile: vp[0] < 500,
    });
    await route(p);
    const errs = [];
    p.on("pageerror", (e) => errs.push(String(e)));
    await p.goto("file://" + process.cwd() + "/" + file, { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(600);
    const r = await p.evaluate(audit);
    const tag = `${scheme} ${vp[0]}x${vp[1]}`;
    if (vp[0] === 1920) {
      say(`fonts ${tag}`, r.fonts.length >= 3, r.fonts.join(", "));
      say(`weights ${tag}`, r.badWeights.length === 0, r.badWeights.join(", ") || "all loaded");
    }
    say(`errors ${tag}`, errs.length === 0, errs.join(" | "));
    say(`reconcile ${tag}`, r.reconcile === 0, String(r.reconcile));
    say(`overflow ${tag}`, r.ovx === 0, r.ovx + "px");
    if (vp[0] >= 1200) {
      say(
        `typefloor ${tag}`,
        r.minFont >= 10.5,
        `min ${r.minFont}px html, ${r.minSvg}px svg` + (r.small.length ? " small: " + JSON.stringify(r.small) : ""),
      );
      say(
        `contrast ${tag}`,
        r.lowCount === 0,
        `${r.lowCount} low of ${r.sampled}` + (r.low.length ? " " + JSON.stringify(r.low) : ""),
      );
    }
    if (vp[0] === 1440)
      say(`diagram ${tag}`, (r.diagH || 0) >= 260, `${r.diagH}px tall, sideways overflow ${r.diagOvx}px`);
    await p.close();
  }
}
// appearance control: first click from a dark machine
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, colorScheme: "dark" });
await route(p);
await p.goto("file://" + process.cwd() + "/" + file, { waitUntil: "load" });
await p.waitForTimeout(500);
const bg0 = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
const btn = (await p.$(".apBtn >> text=Light")) || (await p.$("#themeToggle"));
if (btn) {
  await btn.click();
  await p.waitForTimeout(300);
  const bg1 = await p.evaluate(() => [
    getComputedStyle(document.body).backgroundColor,
    document.documentElement.getAttribute("data-theme"),
  ]);
  say("appearance first click", bg1[0] !== bg0 && bg1[1] === "light", `${bg0} -> ${bg1[0]} data-theme=${bg1[1]}`);
} else say("appearance control present", false, "no .apBtn or #themeToggle");
await p.keyboard.press("Tab");
await p.keyboard.press("Tab");
await p.keyboard.press("Tab");
const f = await p.evaluate(() => {
  const e = document.activeElement;
  const cs = getComputedStyle(e);
  return { cls: e.className, ring: cs.boxShadow !== "none" || cs.outlineStyle !== "none" };
});
say("keyboard focus ring", f.ring, f.cls);
await p.close();
await b.close();
console.log(ok ? "ALL GREEN" : "SOME CHECKS FAILED");
process.exit(ok ? 0 : 1);
