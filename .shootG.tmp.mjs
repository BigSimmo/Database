import { chromium } from "playwright";
import path from "node:path";
const base = process.env.SHOOT_BASE;
const outDir = process.env.SHOOT_OUT;
const url = `${base}/documents/22222222-2222-4222-8222-222222222222`;
const browser = await chromium.launch();

const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await desktop.goto(url, { waitUntil: "domcontentloaded", timeout: 300_000 });
await desktop.waitForSelector('[data-testid="document-section-index"]', { timeout: 180_000 });
await desktop.waitForTimeout(1800);
const active = async () => (await desktop.locator('[data-testid="document-section-index"] button[aria-current="true"]').innerText()).split("\n")[0];
console.log("desktop at top:", await active());
await desktop.locator('[data-testid="document-section-index"] button', { hasText: "Tables and diagrams" }).click();
await desktop.waitForTimeout(1600);
console.log("tables open:", await desktop.locator("#source-images").evaluate((n) => n.open), "| active:", await active());
await desktop.screenshot({ path: path.join(outDir, "real-desktop-2.png") });

const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await phone.goto(url, { waitUntil: "domcontentloaded", timeout: 300_000 });
await phone.waitForSelector('[data-testid="document-section-trigger"]', { timeout: 180_000 });
await phone.waitForTimeout(1500);
const phoneLabel = async () => (await phone.locator('[data-testid="document-section-trigger"]').innerText()).split("\n").pop();
console.log("phone at top:", await phoneLabel());
const scrolled = await phone.evaluate(() => {
  const main = document.getElementById("main-content");
  const scroller = main && main.scrollHeight > main.clientHeight + 4 ? main : document.scrollingElement;
  scroller.scrollTo({ top: 2600, behavior: "auto" });
  return { owner: scroller === document.scrollingElement ? "document" : "main-content", top: scroller.scrollTop };
});
await phone.waitForTimeout(1200);
console.log("phone scroller:", scrolled.owner, "top:", scrolled.top, "| label:", await phoneLabel());
await phone.screenshot({ path: path.join(outDir, "real-phone-scrolled.png") });
await browser.close();
