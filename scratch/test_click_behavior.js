const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
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

  await page.evaluate(() => {
    const btn = document.getElementById('headerSignOutBtn');
    btn.addEventListener('click', () => console.log('HEADER BTN EVENT LISTENER FIRED!'));
  });

  console.log('Testing page.click("#headerSignOutBtn")...');
  await page.click('#headerSignOutBtn');
  await new Promise(r => setTimeout(r, 500));

  let active = await page.evaluate(() => document.getElementById('modal-logout-confirm').classList.contains('active'));
  console.log('Active after page.click("#headerSignOutBtn"):', active);

  console.log('Testing page.evaluate(() => document.getElementById("headerSignOutBtn").click())...');
  await page.evaluate(() => document.getElementById('headerSignOutBtn').click());
  await new Promise(r => setTimeout(r, 500));

  active = await page.evaluate(() => document.getElementById('modal-logout-confirm').classList.contains('active'));
  console.log('Active after eval .click():', active);

  await browser.close();
})();
