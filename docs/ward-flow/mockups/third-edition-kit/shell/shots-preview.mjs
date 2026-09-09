// Screenshots of shell/preview.html in both themes at four sizes and in every shell state. Run
// from the repository root: node docs/ward-flow/mockups/third-edition-kit/shell/shots-preview.mjs
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const file = "docs/ward-flow/mockups/third-edition-kit/shell/preview.html";
const out = "docs/ward-flow/mockups/third-edition-shots/shell-preview";
const kitDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fontDir = path.join(kitDir, "fonts");
const fixture = (n) => {
  try {
    return fs.readFileSync(path.join(fontDir, n));
  } catch {
    return null;
  }
};
const route = async (p) => {
  await p.route(/fonts\.googleapis\.com/, (r) => {
    const b = fixture("platinum.css");
    return b ? r.fulfill({ contentType: "text/css", body: b }) : r.continue();
  });
  await p.route(/fonts\.gstatic\.com/, (r) => {
    const b = fixture(path.basename(new URL(r.request().url()).pathname));
    return b ? r.fulfill({ contentType: "font/woff2", body: b }) : r.continue();
  });
};
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
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
  await p.waitForTimeout(400);
  return p;
}
const names = [];
async function shot(p, name) {
  await p.screenshot({ path: `${out}/${name}.png` });
  names.push(name);
}
for (const scheme of ["light", "dark"]) {
  for (const [w, h] of [
    [1920, 1080],
    [1440, 900],
    [1280, 800],
    [1100, 800],
  ]) {
    const t = `${scheme}-${w}`;
    let p = await page(scheme, w, h);
    await shot(p, `${t}-open`);
    await p.click("#svcMenu summary");
    await p.waitForTimeout(250);
    await shot(p, `${t}-service`);
    await p.keyboard.press("Escape");
    await p.click("#q");
    await p.keyboard.type("Lark");
    await p.waitForTimeout(250);
    await shot(p, `${t}-search`);
    await p.keyboard.press("Escape");
    await p.keyboard.press("Escape");
    await p.mouse.click(w / 2, h - 40);
    for (const d of ["activity", "tasks", "tools"]) {
      await p.click(`#${d}Menu summary`);
      await p.waitForTimeout(350);
      await shot(p, `${t}-${d}`);
      if (d === "activity") {
        await p.click('#activityPanel [data-part="tally"]');
        await p.waitForTimeout(250);
        await shot(p, `${t}-activity-tally`);
      }
      if (d === "tools") {
        await p.evaluate(() => {
          const e = document.getElementById("toolsPanel");
          e.scrollTop = e.scrollHeight;
        });
        await p.waitForTimeout(200);
        await shot(p, `${t}-tools-foot`);
      }
      await p.keyboard.press("Escape");
      await p.waitForTimeout(150);
    }
    await p.keyboard.press("[");
    await p.waitForTimeout(400);
    await p.hover('.rail.closed .railLink[data-page="command"]');
    await p.waitForTimeout(250);
    await shot(p, `${t}-closed-hover`);
    if (w === 1920) {
      await p.mouse.move(900, 700);
      await p.click("#pinMenu summary");
      await p.waitForTimeout(250);
      await shot(p, `${t}-closed-pinned`);
      await p.keyboard.press("Escape");
      await p.keyboard.press("[");
      await p.waitForTimeout(400);
      await p.click("#svcMenu summary");
      await p.click('.menuItem[data-svc="south"]');
      await p.waitForTimeout(250);
      await p.click("#tasksMenu summary");
      await p.click('.taskRow[data-task="soon"]');
      await p.waitForTimeout(250);
      await shot(p, `${t}-south-soon`);
      await p.keyboard.press("Tab");
      await p.keyboard.press("Tab");
      await p.keyboard.press("Tab");
      await p.waitForTimeout(150);
      await shot(p, `${t}-keyboard-focus`);
    }
    await p.close();
  }
}
await b.close();
console.log(names.join("\n"));
