const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  await page.setViewport({ width: 1200, height: 900 });

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

  await new Promise(r => setTimeout(r, 800));

  const info = await page.evaluate(() => {
    const btn = document.getElementById('headerSignOutBtn');
    const rect = btn.getBoundingClientRect();
    const elAtCenter = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    
    // Add global click listener
    document.addEventListener('click', (e) => {
      console.log('DOCUMENT CLICK RECEIVED at', e.clientX, e.clientY, 'target:', e.target.tagName, e.target.id, e.target.className);
    }, true);

    return {
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
      elAtCenter: elAtCenter ? (elAtCenter.tagName + '#' + elAtCenter.id + '.' + elAtCenter.className) : null
    };
  });
  console.log('Button geometry:', info);

  console.log('Now clicking via page.mouse.click(center)...');
  const cx = info.rect.left + info.rect.width / 2;
  const cy = info.rect.top + info.rect.height / 2;
  await page.mouse.click(cx, cy);

  await new Promise(r => setTimeout(r, 1000));
  await browser.close();
})();
