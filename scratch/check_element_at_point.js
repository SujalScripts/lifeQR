const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  await page.goto('http://localhost:5000/app');
  await new Promise(r => setTimeout(r, 1500));
  await page.evaluate(() => localStorage.setItem('lifeqr_onboarded', 'true'));
  await page.reload();
  await new Promise(r => setTimeout(r, 1800));
  await page.type('#login-email', 'patient@lifeqr.com');
  await page.type('#login-password', 'Password@123');
  await page.click('#btn-login-submit');
  await new Promise(r => setTimeout(r, 2500));

  const result = await page.evaluate(() => {
    const btn = document.getElementById('headerSignOutBtn');
    if (!btn) return { error: 'No button' };
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const topEl = document.elementFromPoint(cx, cy);
    return {
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      cx, cy,
      topElTag: topEl ? topEl.tagName : null,
      topElId: topEl ? topEl.id : null,
      topElClass: topEl ? topEl.className : null,
      isBtn: topEl === btn,
      btnContainsTopEl: btn.contains(topEl)
    };
  });
  console.log('Result:', result);
  await browser.close();
})();
