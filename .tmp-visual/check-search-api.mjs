import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const events = [];
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('/api/')) {
      try {
        const text = await resp.text();
        events.push({
          url,
          status: resp.status(),
          ok: resp.ok(),
          text: text.slice(0, 220),
        });
      } catch {
        events.push({
          url,
          status: resp.status(),
          ok: resp.ok(),
          text: '',
        });
      }
    }
  });

  await page.goto('http://localhost:4298', { waitUntil: 'networkidle' });
  const input = page.locator('input[placeholder="Ask a question"]');
  await input.fill('What monitoring is required after starting lithium?');

  const askButton = page.locator('button[aria-label="Generate source-backed answer"]').first();
  await askButton.click();

  await page.waitForTimeout(12000);
  await page.waitForLoadState('networkidle');

  const state = await page.evaluate(() => ({
    body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 2200),
    statusLine: document.querySelector('.text-sm, p, h2, h3')?.textContent || '',
    hasResultsText: (document.body.innerText || '').includes('Retrieved passages appear after a question') || false,
    headingText: Array.from(document.querySelectorAll('h2, h3')).map((el) => (el.textContent || '').trim()),
    ctaText: Array.from(document.querySelectorAll('button, a')).map((el) => (el.textContent || '').trim()).filter((t) => /Open source|Source PDF|Add scope|Ask|Search|Citations|Sources|Gaps|Verify/.test(t)),
  }));

  await browser.close();

  console.log('RESULTS:' + JSON.stringify({
    api: events.filter((e) => e.url.includes('/api/search') || e.url.includes('/api/tools') || e.url.includes('/api/documents') || e.url.includes('/api/local-project-id')),
    state,
  }, null, 2));
})();
