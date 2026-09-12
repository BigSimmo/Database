// The third edition harness adapted for shell/preview.html, which is not a Command page. Run from
// the repository root:
//   node docs/ward-flow/mockups/third-edition-kit/shell/check-preview.mjs <file.html> platinum
// Same gates as check.mjs (fonts, weights, errors, reconcile absent, overflow at five widths, the
// 10.5 px floor, contrast on every visible text element, the appearance control's first click from
// a dark machine, a keyboard focus ring), with two changes: the appearance probe opens the Tools
// drawer first, because the control lives there, and a contrast sweep runs over every shell state
// (each drawer, the tally, the service selector, the search results, the closed strip with a hover
// card, the pinned fly out) in both themes at 1920 by 1080.
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const file = process.argv[2],
  css = process.argv[3] || "platinum";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const kitDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fontDir = process.env.WARD_FLOW_FONT_DIR || path.join(kitDir, "fonts");
let stubbedFonts = null;
const fontFixture = (name) => {
  try {
    return fs.readFileSync(path.join(fontDir, name));
  } catch {
    return null;
  }
};
const route = async (p) => {
  await p.route(/fonts\.googleapis\.com/, (r) => {
    const body = fontFixture(`${css}.css`);
    if (stubbedFonts === null) stubbedFonts = body !== null;
    return body ? r.fulfill({ contentType: "text/css", body }) : r.continue();
  });
  await p.route(/fonts\.gstatic\.com/, (r) => {
    const body = fontFixture(path.basename(new URL(r.request().url()).pathname));
    return body ? r.fulfill({ contentType: "font/woff2", body }) : r.continue();
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
    isCommand: /Ward Flow Command/i.test(document.title),
    reconcile: Array.isArray(window.__commandCheck) ? window.__commandCheck.length : "absent",
    ovx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    minFont,
    minSvg,
    sampled: n,
    lowCount: low.length,
    low: low.slice(0, 10),
    small: small.slice(0, 10),
  };
};
let ok = true;
const say = (k, pass, detail) => {
  ok = ok && pass;
  console.log((pass ? "PASS" : "FAIL") + "  " + k + (detail ? "  " + detail : ""));
};
const open = async (p) => {
  await p.goto("file://" + process.cwd() + "/" + file, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
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
    await open(p);
    const r = await p.evaluate(audit);
    const tag = `${scheme} ${vp[0]}x${vp[1]}`;
    if (vp[0] === 1920) {
      say(`fonts ${tag}`, r.fonts.length >= 3, r.fonts.join(", "));
      say(`weights ${tag}`, r.badWeights.length === 0, r.badWeights.join(", ") || "all loaded");
    }
    say(`errors ${tag}`, errs.length === 0, errs.join(" | "));
    say(`reconcile ${tag}`, r.reconcile === "absent", `not a Command page (${r.reconcile})`);
    say(`overflow ${tag}`, r.ovx === 0, r.ovx + "px");
    if (vp[0] >= 1200) {
      say(
        `typefloor ${tag}`,
        r.minFont >= 10.5 && (r.minSvg === null || r.minSvg >= 10.5),
        `min ${r.minFont}px html, ${r.minSvg}px svg` + (r.small.length ? " small: " + JSON.stringify(r.small) : ""),
      );
      say(
        `contrast ${tag}`,
        r.lowCount === 0,
        `${r.lowCount} low of ${r.sampled}` + (r.low.length ? " " + JSON.stringify(r.low) : ""),
      );
    }
    await p.close();
  }
  // the shell states, each swept for the floor and for contrast
  const states = {
    "service open": async (p) => p.click("#svcMenu summary"),
    "search results": async (p) => {
      await p.click("#q");
      await p.keyboard.type("Lark");
    },
    "activity drawer": async (p) => p.click("#activityMenu summary"),
    "activity tally": async (p) => {
      await p.click("#activityMenu summary");
      await p.click('#activityPanel [data-part="tally"]');
    },
    "tasks drawer": async (p) => p.click("#tasksMenu summary"),
    "tools drawer": async (p) => p.click("#toolsMenu summary"),
    "tools drawer foot": async (p) => {
      await p.click("#toolsMenu summary");
      await p.evaluate(() => {
        const e = document.getElementById("toolsPanel");
        e.scrollTop = e.scrollHeight;
      });
    },
    "new referral menu": async (p) => p.click("#newMenu summary"),
    "closed strip, hover card": async (p) => {
      await p.keyboard.press("[");
      await p.waitForTimeout(300);
      await p.hover('.rail.closed .railLink[data-page="command"]');
    },
    "closed strip, pinned fly out": async (p) => {
      await p.keyboard.press("[");
      await p.waitForTimeout(300);
      await p.click("#pinMenu summary");
    },
    "service chosen, task filter, rail foot": async (p) => {
      await p.click("#svcMenu summary");
      await p.click('.menuItem[data-svc="south"]');
      await p.click("#tasksMenu summary");
      await p.click('.taskRow[data-task="soon"]');
      await p.evaluate(() => {
        const s = document.querySelector(".railScroll");
        if (s) s.scrollTop = s.scrollHeight;
      });
    },
  };
  for (const name of Object.keys(states)) {
    const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, colorScheme: scheme });
    await route(p);
    const errs = [];
    p.on("pageerror", (e) => errs.push(String(e)));
    await open(p);
    await p.evaluate(() => {
      try {
        localStorage.clear();
      } catch (e) {}
    });
    await states[name](p);
    await p.waitForTimeout(350);
    const r = await p.evaluate(audit);
    say(
      `state ${scheme} ${name}`,
      errs.length === 0 && r.lowCount === 0 && r.minFont >= 10.5 && r.ovx === 0,
      `contrast ${r.lowCount} low of ${r.sampled}, floor ${r.minFont}px, overflow ${r.ovx}px` +
        (r.low.length ? " " + JSON.stringify(r.low) : "") +
        (r.small.length ? " small: " + JSON.stringify(r.small) : "") +
        (errs.length ? " errors: " + errs.join(" | ") : ""),
    );
    await p.close();
  }
}
// appearance control: first click from a dark machine. The control lives in the Tools drawer.
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, colorScheme: "dark" });
await route(p);
await open(p);
const bg0 = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
await p.click("#toolsMenu summary");
await p.waitForTimeout(300);
const btn = await p.$(".apBtn >> text=Light");
if (btn) {
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await p.waitForTimeout(300);
  const bg1 = await p.evaluate(() => [
    getComputedStyle(document.body).backgroundColor,
    document.documentElement.getAttribute("data-theme"),
  ]);
  say("appearance first click", bg1[0] !== bg0 && bg1[1] === "light", `${bg0} -> ${bg1[0]} data-theme=${bg1[1]}`);
} else say("appearance control present", false, "no .apBtn in the Tools drawer");
await p.keyboard.press("Escape");
await p.waitForTimeout(200);
await p.evaluate(() => document.activeElement && document.activeElement.blur());
await p.keyboard.press("Tab");
await p.keyboard.press("Tab");
await p.keyboard.press("Tab");
const f = await p.evaluate(() => {
  const e = document.activeElement;
  const cs = getComputedStyle(e);
  return { cls: e.className, ring: cs.boxShadow !== "none" || cs.outlineStyle !== "none" };
});
say("keyboard focus ring", f.ring, f.cls);
// the rail state survives a reload and the bracket key flips it
await p.evaluate(() => {
  try {
    localStorage.setItem("ward-flow-rail", "closed");
  } catch (e) {}
});
await open(p);
const railW = await p.evaluate(() => [
  document.documentElement.getAttribute("data-rail"),
  document.getElementById("rail").getBoundingClientRect().width,
]);
say("rail state remembered", railW[0] === "closed" && railW[1] < 120, `data-rail=${railW[0]}, ${railW[1]}px`);
const words = await p.evaluate(() => {
  const nav = document.getElementById("rail");
  return [...nav.querySelectorAll(".word")].map((e) => [
    e.textContent,
    Math.ceil(e.scrollWidth),
    Math.floor(e.parentElement.parentElement.getBoundingClientRect().width),
  ]);
});
say(
  "closed strip words fit",
  words.every((w) => w[1] <= w[2]),
  JSON.stringify(words.filter((w) => w[1] > w[2] - 2)),
);
await p.keyboard.press("[");
await p.waitForTimeout(400);
const railW2 = await p.evaluate(() => [
  document.documentElement.getAttribute("data-rail"),
  document.getElementById("rail").getBoundingClientRect().width,
  document.activeElement.className,
]);
say(
  "bracket key opens the rail",
  railW2[0] === "open" && railW2[1] === 236 && railW2[2] === "railBtn",
  `data-rail=${railW2[0]}, ${railW2[1]}px, focus on ${railW2[2]}`,
);
await p.evaluate(() => {
  try {
    localStorage.clear();
  } catch (e) {}
});
await p.close();
await b.close();
console.log(stubbedFonts ? `fonts stubbed from ${fontDir}` : "fonts loaded from the network (no local fixtures)");
console.log(ok ? "ALL GREEN" : "SOME CHECKS FAILED");
process.exit(ok ? 0 : 1);
