import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

  let reqPayload = null;
  let respSnippet = null;

  page.on('request', (req) => {
    if (req.url().includes('/api/answer/stream')) {
      reqPayload = {
        method: req.method(),
        postData: req.postData(),
      };
    }
  });

  page.on('response', async (resp) => {
    if (resp.url().includes('/api/answer/stream')) {
      try {
        respSnippet = await resp.text();
      } catch (error) {
        respSnippet = "read-failed";
      }
    }
  });

  await page.goto('http://localhost:4298', { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="Ask a question"]', 'What monitoring is required after starting lithium?');
  await page.locator('button[aria-label="Generate source-backed answer"]').click();
  await page.waitForTimeout(5000);

  const statusText = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '));

  await page.screenshot({ path: 'C:/Dev/Apps/Database/.tmp-visual/query-stream-desktop.png', fullPage: true });
  await browser.close();

  console.log('RESULTS:' + JSON.stringify({
    request: reqPayload,
    responseSnippet: (respSnippet || '').slice(0, 1200),
    statusText: statusText.slice(0, 2200),
    hasNoDataMarkers: {
      noPassages: statusText.includes('Retrieved passages appear after a question'),
      searching: statusText.includes('Searching indexed documents'),
      notReady: statusText.includes('Search setup is not ready') || statusText.includes('setup is not ready')
    }
  }, null, 2));
})();
