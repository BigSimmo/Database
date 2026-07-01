import fs from 'fs';
import path from 'path';
import { chromium, devices } from 'playwright';

(async () => {
  const outputDir = 'C:/Dev/Apps/Database/.qa-smoke';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const baseUrl = process.env.CQA_BASE_URL || '';
  const docId = process.env.CQA_DOC_ID || '';

  const docUrl = `${baseUrl}/documents/${docId}`;

  const browser = await chromium.launch({ headless: true });
  const runs = [
    {
      key: 'desktop-canvas-default',
      viewport: { width: 1440, height: 2100 },
      deviceScaleFactor: 1,
      isMobile: false,
      mode: 'canvas',
      targetUrl: docUrl,
      mobile: false,
    },
    {
      key: 'mobile-canvas-default',
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      mode: 'canvas',
      targetUrl: docUrl,
      mobile: true,
    },
  ];

  let signedUrl = null;
  try {
    const signedRes = await fetch(`${baseUrl}/api/documents/${docId}/signed-url?download=true`);
    const signedJson = await signedRes.json();
    signedUrl = signedJson?.data?.signedUrl || signedJson?.signedUrl || signedJson?.url || null;
  } catch (err) {
    console.warn('Could not fetch signed URL:', err?.message || err);
  }

  const browserModeRuns = [
    {
      key: 'desktop-browser',
      viewport: { width: 1440, height: 2100 },
      deviceScaleFactor: 1,
      isMobile: false,
      mode: 'browser',
      targetUrl: signedUrl,
      mobile: false,
    },
    {
      key: 'mobile-browser',
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      mode: 'browser',
      targetUrl: signedUrl,
      mobile: true,
    },
  ].filter((run) => Boolean(run.targetUrl));

  const allRuns = [...runs, ...browserModeRuns];
  const results = [];

  for (const run of allRuns) {
    const context = await browser.newContext({
      viewport: run.viewport,
      deviceScaleFactor: run.deviceScaleFactor,
      isMobile: run.isMobile,
      hasTouch: run.isMobile,
      permissions: ['clipboard-read', 'clipboard-write'],
      userAgent: run.isMobile ? devices['Pixel 5'].userAgent : undefined,
    });

    const page = await context.newPage();
    const started = Date.now();

    try {
      const nav = page.goto(run.targetUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
      const apiWait = page.waitForResponse((resp) => {
        const url = resp.url();
        return (url.includes(`/api/documents/${docId}`) || url.includes(`/api/documents/${docId}/signed-url`)) && resp.status() === 200;
      }, { timeout: 120000 }).catch(() => null);

      const [response] = await Promise.all([nav, apiWait]);
      const status = response ? response.status() : null;

      const marker = await Promise.race([
        page.waitForSelector('canvas', { timeout: 120000 }).then(() => 'canvas'),
        page.waitForSelector('iframe', { timeout: 120000 }).then(() => 'iframe'),
        page.waitForSelector('embed,object,embed[type="application/pdf"]', { timeout: 120000 }).then(() => 'pdf-embed'),
        page.waitForFunction(() => {
          const text = document.body?.innerText || '';
          return !text.includes('Preparing PDF preview') && !text.includes('Loading source metadata');
        }, { timeout: 120000 }).then(() => 'loaded'),
      ]).catch(() => 'timeout-marker');

      await page.waitForTimeout(1200);

      const uiSummary = await page.$$eval('button, a[role="button"]', (els) => {
        const labels = [];
        for (const el of els) {
          const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (txt) labels.push(txt);
        }
        const filtered = labels
          .filter((t) => t.length > 1 && t.length < 80)
          .filter((t) => /pdf|zoom|download|browser|canvas|open|view/i.test(t));
        const uniq = [...new Set(filtered)];

        return {
          allControls: labels.slice(0, 50),
          relevantControls: uniq,
          modeCandidates: uniq.filter((t) => /browser|canvas|open pdf|new tab|download pdf/i.test(t)),
        };
      });

      const zoomButton = await page.$('button:has-text("Zoom In")');
      const zoomPlus = await page.$('button:has-text("+")');

      let zoomMode = 'none';
      const shotPaths = [];

      const defaultShot = path.join(outputDir, `${run.key}-default.png`);
      await page.screenshot({ path: defaultShot, fullPage: true });
      shotPaths.push({ step: 'default', path: defaultShot });

      if (zoomButton || zoomPlus) {
        const btn = zoomButton || zoomPlus;
        await btn.click({ trial: false }).catch(() => {});
        await page.waitForTimeout(900);
        const zoomShot = path.join(outputDir, `${run.key}-zoom-step-1.png`);
        await page.screenshot({ path: zoomShot, fullPage: true });
        shotPaths.push({ step: 'ui-zoom', path: zoomShot });
        zoomMode = 'ui-button';
      } else if (run.mode === 'browser') {
        await page.keyboard.down('Control');
        await page.keyboard.press('Equal');
        await page.keyboard.press('Equal');
        await page.keyboard.up('Control');
        await page.waitForTimeout(900);
        const zoomShot = path.join(outputDir, `${run.key}-zoom-keyboard.png`);
        await page.screenshot({ path: zoomShot, fullPage: true });
        shotPaths.push({ step: 'ctrl-plus', path: zoomShot });
        zoomMode = 'keyboard';
      }

      const bodyText = await page.textContent('body').catch(() => null);
      const pdfState = {
        hasErrorText: !!(bodyText && (bodyText.includes('500') || bodyText.includes('Something went wrong') || bodyText.includes('error'))),
        loadingText: !!(bodyText && (bodyText.includes('Preparing PDF preview') || bodyText.includes('Loading source metadata'))),
      };

      results.push({
        run: run.key,
        mode: run.mode,
        targetUrl: run.targetUrl,
        status,
        marker,
        loadMs: Date.now() - started,
        zoomMode,
        uiSummary,
        pdfState,
        shots: shotPaths,
      });
    } catch (err) {
      results.push({ run: run.key, mode: run.mode, error: String(err?.message || err) });
    } finally {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
    }
  }

  await browser.close();

  console.log('CQA_RESULT_START');
  console.log(JSON.stringify(results, null, 2));
  console.log('CQA_RESULT_END');
})();
