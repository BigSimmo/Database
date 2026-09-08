// Crops of inputs/rail.html for the shell review. Run from the repository root.
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
const file = "docs/ward-flow/mockups/third-edition-kit/inputs/rail.html";
const out = "docs/ward-flow/mockups/third-edition-shots/shell-review";
const css = "premium";
const fontDir = "docs/ward-flow/mockups/third-edition-kit/fonts";
let stubbed = null;
const fixture = (n) => {
  try {
    return fs.readFileSync(path.join(fontDir, n));
  } catch {
    return null;
  }
};
const route = async (p) => {
  await p.route(/fonts\.googleapis\.com/, (r) => {
    const b = fixture(`${css}.css`);
    if (stubbed === null) stubbed = b !== null;
    return b ? r.fulfill({ contentType: "text/css", body: b }) : r.continue();
  });
  await p.route(/fonts\.gstatic\.com/, (r) => {
    const b = fixture(path.basename(new URL(r.request().url()).pathname));
    return b ? r.fulfill({ contentType: "font/woff2", body: b }) : r.continue();
  });
};
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const log = [];
async function page(scheme, w, h) {
  const p = await b.newPage({ viewport: { width: w, height: h }, colorScheme: scheme });
  await route(p);
  await p.goto("file://" + process.cwd() + "/" + file, { waitUntil: "load" });
  await p.evaluate(() => {
    try {
      localStorage.clear();
    } catch (e) {}
  });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  return p;
}
async function shot(p, name, clip) {
  await p.screenshot({ path: `${out}/${name}.png`, clip });
  log.push(name);
}
const rect = async (p, sel) =>
  p.$eval(sel, (e) => {
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
const pad = (r, n, W = 1920, H = 1080) => {
  const x = Math.max(0, r.x - n),
    y = Math.max(0, r.y - n);
  return { x, y, width: Math.min(W - x, r.width + 2 * n), height: Math.min(H - y, r.height + 2 * n) };
};
for (const scheme of ["light", "dark"]) {
  const t = scheme;
  let p = await page(scheme, 1920, 1080);
  // header at rest, with the switcher bar above it
  const hdr = await rect(p, ".hdr1");
  await shot(p, `${t}-header-rest`, { x: 0, y: 0, width: 1920, height: hdr.y + hdr.height + 40 });
  // primary at rest and hovered
  const prim = await rect(p, "#newMenu summary");
  await shot(p, `${t}-primary-rest`, pad(prim, 24));
  await p.hover("#newMenu summary");
  await p.waitForTimeout(200);
  await shot(p, `${t}-primary-hover`, pad(prim, 24));
  await p.mouse.move(900, 700);
  // open rail top and active item, hovered item, pinned group, foot
  await shot(p, `${t}-rail-open-top`, { x: 0, y: 43, width: 300, height: 420 });
  await p.hover('.rail.open .railLink[data-page="capacity"]');
  await p.waitForTimeout(200);
  const cap = await rect(p, '.rail.open .railLink[data-page="capacity"]');
  const cmd = await rect(p, '.rail.open .railLink[data-page="command"]');
  await shot(p, `${t}-rail-item-active-and-hover`, {
    x: 0,
    y: cmd.y - 40,
    width: 300,
    height: cap.y + cap.height - cmd.y + 80,
  });
  await p.mouse.move(900, 700);
  await p.evaluate(() => {
    const s = document.querySelector(".railScroll");
    s.scrollTop = s.scrollHeight;
  });
  await p.waitForTimeout(200);
  const pin = await rect(p, ".rail.open .pinGroup");
  await shot(p, `${t}-rail-pinned`, pad(pin, 12, 1920, 1080));
  const foot = await rect(p, ".rail.open .railFoot");
  await shot(p, `${t}-rail-foot`, { x: 0, y: foot.y - 8, width: 300, height: 1080 - foot.y + 8 });
  // search focused with results
  await p.click("#q");
  await p.keyboard.type("Larkspur");
  await p.waitForTimeout(300);
  const pop = await rect(p, "#qPop");
  const sw = await rect(p, "#searchWrap");
  await shot(p, `${t}-search-results`, {
    x: Math.max(0, sw.x - 30),
    y: 43,
    width: Math.min(1920, pop.width + 80),
    height: pop.y + pop.height + 30 - 43,
  });
  await p.keyboard.press("Escape");
  await p.keyboard.press("Escape");
  await p.mouse.click(900, 700);
  // service selector open
  await p.click("#svcMenu summary");
  await p.waitForTimeout(300);
  const sp = await rect(p, "#svcMenu .menuPanel");
  const ss = await rect(p, "#svcMenu summary");
  await shot(p, `${t}-service-open`, {
    x: ss.x - 30,
    y: 43,
    width: sp.x + sp.width - ss.x + 60,
    height: sp.y + sp.height + 30 - 43,
  });
  await p.keyboard.press("Escape");
  await p.mouse.click(900, 700);
  // drawers
  for (const d of ["activity", "tasks", "tools"]) {
    await p.click(`#${d}Menu summary`);
    await p.waitForTimeout(400);
    const dp = await rect(p, `#${d}Panel`);
    await shot(p, `${t}-drawer-${d}`, {
      x: Math.max(0, dp.x - 60),
      y: 0,
      width: Math.min(1920, dp.width + 60),
      height: 1080,
    });
    if (d === "activity") {
      await p.click('#activityPanel [data-part="tally"]');
      await p.waitForTimeout(300);
      await shot(p, `${t}-drawer-activity-tally`, {
        x: Math.max(0, dp.x - 60),
        y: 0,
        width: Math.min(1920, dp.width + 60),
        height: 1080,
      });
    }
    if (d === "tools") {
      await p.evaluate(() => {
        const e = document.getElementById("toolsPanel");
        e.scrollTop = e.scrollHeight;
      });
      await p.waitForTimeout(200);
      await shot(p, `${t}-drawer-tools-bottom`, {
        x: Math.max(0, dp.x - 60),
        y: 0,
        width: Math.min(1920, dp.width + 60),
        height: 1080,
      });
    }
    await p.keyboard.press("Escape");
    await p.waitForTimeout(200);
  }
  // closed strip with a hover card
  await p.keyboard.press("[");
  await p.waitForTimeout(400);
  await p.hover('.rail.closed .railLink[data-page="command"]');
  await p.waitForTimeout(250);
  await shot(p, `${t}-closed-hover`, { x: 0, y: 43, width: 420, height: 1037 });
  await p.hover('.rail.closed .railLink[data-page="referrals"]');
  await p.waitForTimeout(250);
  await shot(p, `${t}-closed-hover-referrals`, { x: 0, y: 43, width: 420, height: 1037 });
  await p.mouse.move(900, 700);
  await p.click("#pinMenu summary");
  await p.waitForTimeout(300);
  await shot(p, `${t}-closed-pinned`, { x: 0, y: 500, width: 480, height: 580 });
  await p.keyboard.press("Escape");
  await p.close();
  for (const w of [1440, 1280, 1100]) {
    p = await page(scheme, w, 900);
    const h2 = await rect(p, ".hdr1");
    await shot(p, `${t}-header-${w}`, { x: 0, y: 0, width: w, height: h2.y + h2.height + 30 });
    log.push(
      `${t} ${w}: header ${Math.round(h2.width)}x${Math.round(h2.height)}, search ${Math.round((await rect(p, "#searchWrap")).width)}`,
    );
    await p.close();
  }
}
await b.close();
console.log(log.join("\n"));
console.log(stubbed ? "fonts stubbed" : "fonts from network or fallback");
