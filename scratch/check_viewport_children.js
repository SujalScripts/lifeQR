const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 950 });
  await page.goto('http://localhost:5000/app');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#screen-onboarding.active');

  const children = await page.evaluate(() => {
    const v = document.querySelector('.phone-screen-viewport');
    return Array.from(v.children).map(c => {
      const r = c.getBoundingClientRect();
      const s = window.getComputedStyle(c);
      return {
        tag: c.tagName,
        id: c.id,
        class: c.className,
        display: s.display,
        position: s.position,
        height: r.height,
        top: r.top,
        bottom: r.bottom
      };
    }).filter(c => c.display !== 'none' && c.height > 0);
  });
  console.log('Visible children of viewport:', JSON.stringify(children, null, 2));
  await browser.close();
})();
