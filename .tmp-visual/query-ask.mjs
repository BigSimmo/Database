import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:4298', { waitUntil: 'networkidle' });

  const q = 'What monitoring is required after starting lithium for bipolar disorder?';
  const input = page.locator('input[placeholder="Ask a question"]');
  await input.waitFor({ state: 'visible', timeout: 12000 });
  await input.fill(q);
  const askBtn = page.getByRole('button', { name: /^ask$/i }).first();
  await askBtn.click();

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);

  await page.screenshot({ path: 'C:/Dev\Apps\Database/.tmp-visual/query-answer-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'C:/Dev\Apps\Database/.tmp-visual/query-answer-mobile.png', fullPage: true });

  const dump = await page.evaluate(() => {
    const getText = (selector, limit = 500) => {
      const el = document.querySelector(selector);
      if (!el) return '';
      return (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, limit);
    };

    const outputRoot = document.querySelector('[data-testid="generated-answer"]') ||
      document.querySelector('[data-testid="rag-output"]') ||
      document.querySelector('main');

    const labels = Array.from(document.querySelectorAll('button, a')).map((el) => (el.textContent || '').trim())
      .filter((t) => /Open source|Source PDF|Add scope|Citations|Sources|Gaps|No linked citations|No source provenance|No indexed clinically useful tables|No quote|No quotes|No passages|Verified|Evidence map/i.test(t));

    const sections = Array.from(document.querySelectorAll('section, article')).map((section) => {
      const heading = section.querySelector('h2, h3, h4')?.textContent?.trim() || '';
      const txt = (section.textContent || '').replace(/\s+/g, ' ').trim();
      if (!heading) return null;
      return { heading, text: txt.slice(0, 260) };
    }).filter(Boolean).slice(0, 30);

    return {
      url: location.href,
      title: document.title,
      queryInInput: (document.querySelector('input[placeholder="Ask a question"]')?.value || ''),
      outputSnippet: outputRoot ? (outputRoot.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 1800) : '',
      relevantLabels: [...new Set(labels)].slice(0, 50),
      sectionSamples: sections,
      firstError: document.body ? ((document.body.textContent || '').match(/error|failed|unauth|401|429|403/ig)?.[0] || '') : ''
    };
  });

  await browser.close();
  console.log('RESULTS:' + JSON.stringify(dump, null, 2));
})();
