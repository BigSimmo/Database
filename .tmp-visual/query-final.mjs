import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.goto('http://localhost:4298', { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="Ask a question"]', 'What monitoring is required after starting lithium?');
  const ask = page.locator('button[aria-label="Generate source-backed answer"]');
  await ask.click();
  await page.waitForTimeout(5000);

  const output = await page.evaluate(() => {
    const body = (document.body.innerText || '').replace(/\s+/g, ' ');
    return {
      hasSearching: body.includes('Searching indexed documents.'),
      hasSearchReadyText: body.includes('Search setup not ready'),
      hasNoPassagesText: body.includes('Retrieved passages appear after a question'),
      query: document.querySelector('input[placeholder="Ask a question"]')?.value || '',
      labels: Array.from(document.querySelectorAll('button, a')).map((el) => (el.textContent || '').trim()).filter((text) => /Open source|Source PDF|Add scope|Citations|Sources|Gaps|No linked citations|No source provenance|Search setup|Retrieved passages/.test(text)),
    };
  });

  await page.screenshot({ path: 'C:/Dev/Apps/Database/.tmp-visual/final-query-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'C:/Dev/Apps/Database/.tmp-visual/final-query-mobile.png', fullPage: true });
  await browser.close();

  console.log('RESULTS:' + JSON.stringify(output, null, 2));
})();
