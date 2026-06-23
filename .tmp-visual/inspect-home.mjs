import { chromium } from 'playwright';

(async () => {
  const page = await chromium.launch({ headless: true }).then(async (browser) => {
    const p = await browser.newPage();
    await p.goto('http://localhost:4298', { waitUntil: 'networkidle' });
    const body = await p.evaluate(() => document.body.innerText || '');
    const links = await p.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map((a) => ({
        text: (a.textContent || '').trim(),
        href: a.getAttribute('href') || '',
      })).filter((x) => x.text || x.href);
    });

    const buttons = await p.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map((b) => ({
        text: (b.textContent || '').trim(),
        type: b.getAttribute('type') || '',
      }));
    });

    const inputs = await p.evaluate(() => Array.from(document.querySelectorAll('input, textarea')).map((el) => ({
      tag: el.tagName,
      type: el.getAttribute('type') || '',
      placeholder: el.getAttribute('placeholder') || '',
      id: el.id || '',
      name: el.getAttribute('name') || '',
    })));

    console.log('TITLE:' + (await p.title()));
    console.log('URL:' + p.url());
    console.log('HREFS:' + JSON.stringify(links.slice(0, 80), null, 2));
    console.log('BUTTONS:' + JSON.stringify(buttons.slice(0, 80), null, 2));
    console.log('INPUTS:' + JSON.stringify(inputs, null, 2));
    console.log('TEXT_SNIPPET_START');
    console.log(body.slice(0, 1200));
    console.log('TEXT_SNIPPET_END');

    await browser.close();
  });
})();
