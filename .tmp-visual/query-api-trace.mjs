import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const events = [];

  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('/api/')) {
      events.push({
        url,
        status: resp.status(),
        ok: resp.ok(),
      });
    }
  });

  await page.goto('http://localhost:4298', { waitUntil: 'networkidle' });
  const input = page.locator('input[placeholder="Ask a question"]');
  await input.fill('What monitoring is required after starting lithium?');

  const askButton = page.locator('button[aria-label="Generate source-backed answer"]');
  await askButton.click();

  await page.waitForTimeout(15000);
  await page.waitForLoadState('networkidle');

  const endText = await page.evaluate(() => ({
    text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 2200),
    hasResultPhrase: (document.body.innerText || '').includes('Retrieved passages appear after a question') || (document.body.innerText || '').includes('The answer, quotes, source PDFs, and diagrams will appear here.'),
    queryValue: (document.querySelector('input[placeholder="Ask a question"]')?.value || ''),
  }));

  await page.screenshot({ path: 'C:/Dev/Apps/Database/.tmp-visual/query-post-click-desktop.png', fullPage: true });

  await browser.close();
  const interesting = events.filter((event) => event.url.includes('/api/search') || event.url.includes('/api/search/'));
  const all = events.slice(-20);

  console.log('RESULTS:' + JSON.stringify({ endText, interesting, all }, null, 2));
})();
