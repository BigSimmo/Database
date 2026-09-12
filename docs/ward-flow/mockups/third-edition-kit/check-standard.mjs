// Usage (from the wardflow directory): node merged/check-standard.mjs [file.html] [fontcss]
// Adapted from merged/check.mjs for the design standard: fonts, weights, page errors, sideways
// overflow at four viewports in both themes, the type floor, a contrast sweep over every visible
// text element in both themes (scrolling through the page in viewport-height steps), the
// standard's own reconciliation lines, the masthead figures, rail targets, demo heights, demo
// containment, the appearance control's first click from a dark machine, and keyboard focus.
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
const file = process.argv[2] || "merged/design-system-third-edition.html",
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
  const label = (e) =>
    (e.id ? "#" + e.id + " " : "") +
    (typeof e.className === "string" && e.className ? e.className : e.tagName.toLowerCase());
  const seen = new Set();
  let low = [],
    minFont = 99,
    n = 0,
    small = [];
  const H = innerHeight,
    total = document.documentElement.scrollHeight;
  let steps = 0;
  for (let y = 0; y < total; y += H) {
    window.scrollTo(0, y);
    steps++;
    const els = [...document.querySelectorAll("body *")].filter((e) => {
      if (seen.has(e)) return false;
      if (e.closest("svg")) return false;
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.9) return false;
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) return false;
      return [...e.childNodes].some((nd) => nd.nodeType === 3 && nd.textContent.trim().length > 1);
    });
    for (const e of els) {
      seen.add(e);
      const cs = getComputedStyle(e);
      const size = parseFloat(cs.fontSize);
      if (size < minFont) minFont = size;
      if (size < 10.5) small.push([label(e), size]);
      const bold = +cs.fontWeight >= 700;
      const large = size >= 18.66 || (size >= 14 && bold);
      const a = lum(cs.color),
        c = lum(bgOf(e));
      if (a == null || c == null) continue;
      n++;
      const r = (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
      const need = large ? 3 : 4.5;
      if (r < need) low.push([label(e), +r.toFixed(2), size, e.textContent.trim().slice(0, 30)]);
    }
  }
  window.scrollTo(0, 0);
  const svgT = [...document.querySelectorAll("svg text")].map((t) => parseFloat(getComputedStyle(t).fontSize));
  const minSvg = svgT.length ? Math.min(...svgT) : null;
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
  const cc = document.getElementById("contrastCheck"),
    rc = document.getElementById("railCheck");
  const kpis = [...document.querySelectorAll("#kpis dd")].map((d) => parseInt(d.textContent, 10));
  const rail = [...document.querySelectorAll('.g-rail a[href^="#"]')].map((a) => a.getAttribute("href").slice(1));
  const railMissing = rail.filter((id) => !document.getElementById(id));
  const comps = [...document.querySelectorAll(".g-comp")].map((c) => [
    c.getAttribute("data-component") || label(c),
    Math.round(c.getBoundingClientRect().height),
  ]);
  const shortComps = comps.filter((c) => c[1] <= 40);
  const demoOut = [];
  for (const d of document.querySelectorAll(".g-demo")) {
    const dr = d.getBoundingClientRect();
    if (d.scrollWidth > d.clientWidth + 1)
      demoOut.push([label(d.closest(".g-comp") || d), "scrollWidth " + d.scrollWidth + " > " + d.clientWidth]);
    for (const m of d.querySelectorAll("img, svg")) {
      const r = m.getBoundingClientRect();
      if (r.width < 1) continue;
      if (r.left < dr.left - 1 || r.right > dr.right + 1)
        demoOut.push([
          label(d.closest(".g-comp") || d),
          m.tagName.toLowerCase() +
            " " +
            Math.round(r.left) +
            ".." +
            Math.round(r.right) +
            " vs " +
            Math.round(dr.left) +
            ".." +
            Math.round(dr.right),
        ]);
    }
  }
  return {
    fonts,
    badWeights: weights,
    steps,
    ovx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    minFont,
    minSvg,
    sampled: n,
    lowCount: low.length,
    low: low.slice(0, 10),
    small: small.slice(0, 10),
    contrastOk: cc ? cc.getAttribute("data-ok") : null,
    contrastText: cc ? cc.textContent : "",
    railOk: rc ? rc.getAttribute("data-ok") : null,
    railText: rc ? rc.textContent : "",
    kpis,
    railLinks: rail.length,
    railMissing,
    comps: comps.length,
    shortComps,
    demoOut,
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
    say(`errors ${tag}`, errs.length === 0, errs.join(" | ") || "none");
    say(`overflow ${tag}`, r.ovx === 0, r.ovx + "px");
    say(
      `typefloor ${tag}`,
      r.minFont >= 10.5 && (r.minSvg === null || r.minSvg >= 10.5),
      `min ${r.minFont}px html, ${r.minSvg}px svg` + (r.small.length ? " small: " + JSON.stringify(r.small) : ""),
    );
    say(
      `contrast ${tag}`,
      r.lowCount === 0,
      `${r.lowCount} low of ${r.sampled} sampled in ${r.steps} scroll steps` +
        (r.low.length ? " " + JSON.stringify(r.low) : ""),
    );
    if (vp[0] === 1920) {
      say(
        `contrastCheck ${tag}`,
        r.contrastOk === "true" && /all match the printed figures/.test(r.contrastText),
        r.contrastText.trim(),
      );
      say(`railCheck ${tag}`, r.railOk === "true", r.railText.trim());
      say(`kpis ${tag}`, r.kpis.length === 5 && r.kpis.every((v) => v > 0), r.kpis.join(", "));
      say(
        `rail targets ${tag}`,
        r.railLinks > 0 && r.railMissing.length === 0,
        `${r.railLinks} links` + (r.railMissing.length ? " missing: " + r.railMissing.join(" ") : ""),
      );
      say(
        `demo heights ${tag}`,
        r.comps > 0 && r.shortComps.length === 0,
        `${r.comps} demos` + (r.shortComps.length ? " short: " + JSON.stringify(r.shortComps) : ", all above 40px"),
      );
      say(
        `demo containment ${tag}`,
        r.demoOut.length === 0,
        r.demoOut.length ? JSON.stringify(r.demoOut.slice(0, 8)) : "every image and svg inside its .g-demo",
      );
    }
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
    document.getElementById("contrastCheck").getAttribute("data-ok"),
    document.getElementById("contrastCheck").textContent,
  ]);
  say("appearance first click", bg1[0] !== bg0 && bg1[1] === "light", `${bg0} -> ${bg1[0]} data-theme=${bg1[1]}`);
  say("contrastCheck after the click", bg1[2] === "true" && /light theme/.test(bg1[3]), bg1[3].trim());
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
