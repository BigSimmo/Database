import { chromium } from 'playwright';

const APP_URL = 'http://localhost:4298';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const querySelectors = [
    'input[type="text"]',
    'input[placeholder*="Search" i]',
    'textarea',
    '[data-testid="clinical-search-input"]',
    '[name="q"]',
    'input[role="searchbox"]'
  ];

  let input = null;
  for (const selector of querySelectors) {
    const el = page.locator(selector).first();
    if (await el.count()) {
      input = el;
      break;
    }
  }

  if (!input) {
    const allInputs = page.locator('input, textarea');
    const cnt = await allInputs.count();
    console.log(JSON.stringify({ status: 'no-query-input-found', inputCount: cnt }));
    await page.screenshot({ path: 'C:/Dev/Apps/Database/.tmp-visual/query-noinput-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'C:/Dev/Apps/Database/.tmp-visual/query-noinput-mobile.png', fullPage: true });
    await browser.close();
    process.exit(0);
  }

  await input.fill('acute mania first line pharmacologic treatment');

  const submitSelectors = [
    'button:has-text("Search")',
    'button[type="submit"]',
    'form button',
    '[data-testid="clinical-search-submit"]'
  ];

  for (const selector of submitSelectors) {
    const btn = page.locator(selector).first();
    if (await btn.count()) {
      await btn.click({ timeout: 1500 }).catch(async () => {
        await page.keyboard.press('Enter');
      });
      break;
    }
  }

  if (!page.url().includes('/search') && !page.url().includes('/results')) {
    await page.keyboard.press('Enter');
  }

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const desktopText = await page.evaluate(() => {
    const texts = Array.from(document.querySelectorAll('body *'))
      .map((node) => (node.textContent || '').trim())
      .filter(Boolean);

    const compact = texts.filter((t) =>
      /Open source|Source PDF|Add scope|No linked citations|No source provenance|Citations|Sources|Gaps|Verify/.test(t),
    );

    const preview = compact.slice(0, 60);
    const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map((h) => h.textContent?.trim()).filter(Boolean);

    return { compact: preview, headings, hasSourceButtons: !!document.querySelector('button:has-text("Open source")') };
  });

  await page.screenshot({ path: 'C:/Dev/Apps/Database/.tmp-visual/query-result-desktop.png', fullPage: true });

  const openSourceButtons = await page.locator('button:has-text("Open source"), a:has-text("Open source"), a:has-text("Source PDF"), button:has-text("Add scope")').count();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'C:/Dev/Apps/Database/.tmp-visual/query-result-mobile.png', fullPage: true });

  const actionButtonLabels = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a')).map((el) => (el.textContent || '').trim()).filter((t) => /(Open source|Source PDF|Add scope|Citations|No linked citations|No source provenance)/.test(t));
  });

  await browser.close();

  console.log('RESULTS:' + JSON.stringify({
    homeURL: APP_URL,
    currentURL: page.url(),
    headings: desktopText.headings.slice(0, 30),
    compactHints: desktopText.compact.slice(0, 60),
    openSourceButtons,
    actionButtonLabels: Array.from(new Set(actionButtonLabels)).slice(0, 30),
  }, null, 2));
})();
