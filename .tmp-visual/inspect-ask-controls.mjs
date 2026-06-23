import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:4298', { waitUntil: 'domcontentloaded' });

  const input = page.locator('input[placeholder="Ask a question"]');
  await input.waitFor({ state: 'attached', timeout: 12000 });

  const controls = await page.evaluate(() => {
    const inp = Array.from(document.querySelectorAll('input')).find((el) => el.getAttribute('placeholder') === 'Ask a question');
    if (!inp) return null;
    const form = inp.closest('form');
    const allButtons = Array.from(document.querySelectorAll('button, input[type="submit"]')).map((el) => ({
      text: (el.textContent || '').trim(),
      type: el.getAttribute('type') || (el.tagName === 'BUTTON' ? 'button' : ''),
      value: el.getAttribute('value') || '',
      aria: el.getAttribute('aria-label') || '',
      id: el.id || '',
    }));
    const formButtons = form ? Array.from(form.querySelectorAll('button, input[type="submit"]')).map((el) => ({
      text: (el.textContent || '').trim(),
      type: el.getAttribute('type') || (el.tagName === 'BUTTON' ? 'button' : ''),
      value: el.getAttribute('value') || '',
      aria: el.getAttribute('aria-label') || '',
      id: el.id || '',
    })) : [];

    return {
      inputCount: document.querySelectorAll('input[placeholder="Ask a question"]').length,
      inputOuterHTML: inp.outerHTML.slice(0, 400),
      formAction: form ? form.getAttribute('action') : null,
      formMethod: form ? form.getAttribute('method') : null,
      formButtons,
      allButtons: allButtons.slice(0, 80),
    };
  });

  console.log(JSON.stringify(controls, null, 2));
  await browser.close();
})();
