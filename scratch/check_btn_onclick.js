const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  await page.goto('http://localhost:5000/app');
  await page.evaluate(() => localStorage.setItem('lifeqr_onboarded', 'true'));
  await page.reload();

  await page.waitForFunction(() => {
    const splash = document.getElementById('screen-splash');
    const login = document.getElementById('screen-login');
    return (!splash || !splash.classList.contains('active')) && (login && login.classList.contains('active'));
  }, { timeout: 10000 });

  await page.type('#login-email', 'patient@lifeqr.com');
  await page.type('#login-password', 'Password@123');
  await page.click('#btn-login-submit');

  await page.waitForFunction(() => {
    const home = document.getElementById('screen-home');
    return home && home.classList.contains('active');
  }, { timeout: 10000 });

  await new Promise(r => setTimeout(r, 600));

  const result = await page.evaluate(() => {
    const btn = document.getElementById('headerSignOutBtn');
    console.log('btn.onclick:', btn.onclick);
    try {
      btn.onclick();
      return {
        executed: true,
        modalActive: document.getElementById('modal-logout-confirm').classList.contains('active')
      };
    } catch (e) {
      return { error: e.message, stack: e.stack };
    }
  });

  console.log('Result of btn.onclick():', result);
  await browser.close();
})();
