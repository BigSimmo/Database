import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.goto('http://localhost:4298', { waitUntil: 'networkidle' });

  const input = page.locator('input[placeholder="Ask a question"]');
  await input.fill('What monitoring is required after starting lithium?');

  const askButton = page.locator('button[aria-label="Generate source-backed answer"]');
  const info = await askButton.evaluate((btn) => ({
    disabled: btn.disabled,
    text: (btn.textContent || '').trim(),
    title: btn.getAttribute('title') || '',
    aria: btn.getAttribute('aria-label') || '',
    classes: btn.className,
  }));

  const summary = await page.evaluate(() => ({
    bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 2200),
    statusBanner: (document.querySelector('[role="status"], .status, .text-sm')?.textContent || '').replace(/\s+/g, ' ').trim(),
    hasReadyText: (document.body.innerText || '').includes('setup is not ready'),
    headings: Array.from(document.querySelectorAll('h2, h3')).map((el) => (el.textContent || '').trim()),
    ctaCandidates: Array.from(document.querySelectorAll('button')).map((btn) => ({
      text: (btn.textContent || '').trim(),
      title: btn.getAttribute('title') || '',
      aria: btn.getAttribute('aria-label') || '',
      disabled: !!btn.disabled,
    })).filter((x) => /Generate source-backed answer|Open mobile document scope|Clear refine|Source passages|Ask/i.test(x.text) || /ready/.test(x.title)),
  }));

  await page.screenshot({ path: 'C:/Dev/Apps/Database/.tmp-visual/query-disabled-desktop.png', fullPage: true });
  await browser.close();

  console.log('RESULTS:' + JSON.stringify({ button: info, summary }, null, 2));
})();
