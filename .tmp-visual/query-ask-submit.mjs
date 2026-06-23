import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.goto('http://localhost:4298', { waitUntil: 'networkidle' });

  const input = page.locator('input[placeholder="Ask a question"]');
  await input.fill('What monitoring is required after starting lithium?');

  const askButton = page.locator('button[aria-label="Generate source-backed answer"]').first();
  await askButton.waitFor({ state: 'visible', timeout: 12000 });
  await askButton.click();

  // Wait for first response indicator
  await page.waitForTimeout(1200);
  await page.waitForSelector('text=Checking indexed library before showing document status', { timeout: 1000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);

  const state = await page.evaluate(() => {
    const text = (document.body.innerText || '').replace(/\s+/g, ' ');
    const phrase = 'Sourced synthesis with quotes, PDFs, and indexed diagrams.';
    const beforeQ = text.indexOf(phrase);

    const panelHeadings = Array.from(document.querySelectorAll('h2, h3')).map((el) => (el.textContent || '').trim()).filter(Boolean);

    const actionHints = Array.from(document.querySelectorAll('button, a')).map((el) => (el.textContent || '').trim()).filter((t) => t && /Open source|Add scope|Source PDF|Citations|Sources|Gaps|No linked citations|No source provenance|No source passages|quote cards|source passages|verify/i.test(t));

    const allLabels = Array.from(new Set(actionHints)).slice(0, 80);

    return {
      currentUrl: location.href,
      headingCount: document.querySelectorAll('h2, h3, h4').length,
      panelHeadings: panelHeadings.slice(0, 40),
      labels: allLabels,
      bodyPreview: document.body.innerText?.slice(0, 2800) || '',
    };
  });

  await page.screenshot({ path: 'C:/Dev/Apps/Database/.tmp-visual/query-answer-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'C:/Dev/Apps/Database/.tmp-visual/query-answer-mobile.png', fullPage: true });

  await browser.close();
  console.log('RESULTS:' + JSON.stringify(state, null, 2));
})();
