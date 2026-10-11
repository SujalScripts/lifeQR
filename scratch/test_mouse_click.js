const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  await page.setViewport({ width: 1200, height: 900 });
  await page.goto('http://localhost:5000/app');
  await new Promise(r => setTimeout(r, 1000));
  await page.evaluate(() => localStorage.setItem('lifeqr_onboarded', 'true'));
  await page.reload();
  await new Promise(r => setTimeout(r, 1200));
  await page.type('#login-email', 'patient@lifeqr.com');
  await page.type('#login-password', 'Password@123');
  await page.click('#btn-login-submit');
  await new Promise(r => setTimeout(r, 2000));

  const coords = await page.evaluate(() => {
    const btn = document.getElementById('headerSignOutBtn');
    const r = btn.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  console.log('Button center coords:', coords);

  console.log('Sending mouse click directly to coordinates...');
  await page.mouse.click(coords.x, coords.y);
  await new Promise(r => setTimeout(r, 500));

  const modalActive = await page.evaluate(() => document.getElementById('modal-logout-confirm').classList.contains('active'));
  console.log('Modal active after page.mouse.click:', modalActive);

  await browser.close();
})();
