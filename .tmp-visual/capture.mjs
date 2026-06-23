import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.goto('http://localhost:4298', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'C:/Dev/Apps/Database/.tmp-visual/desktop-home.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:4298', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'C:/Dev/Apps/Database/.tmp-visual/mobile-home.png', fullPage: true });
  await browser.close();
})();
