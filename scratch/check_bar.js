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

  const info = await page.evaluate(() => {
    const bar = document.querySelector('.app-telemetry-bar');
    const s = bar ? window.getComputedStyle(bar) : null;
    const r = bar ? bar.getBoundingClientRect() : null;
    return {
      barDisplay: s ? s.display : null,
      barVisible: s ? s.visibility : null,
      barBg: s ? s.backgroundColor : null,
      barRect: r ? { top: r.top, height: r.height, bottom: r.bottom } : null
    };
  });
  console.log('Telemetry bar info:', info);
  await browser.close();
})();
