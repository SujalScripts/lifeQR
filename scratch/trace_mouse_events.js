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

  await page.evaluate(() => {
    const events = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'];
    events.forEach(ev => {
      window.addEventListener(ev, (e) => {
        console.log(`WINDOW ${ev.toUpperCase()} at (${e.clientX}, ${e.clientY}), target: ${e.target.tagName}#${e.target.id}.${e.target.className}`);
      }, true);
    });
  });

  const btnRect = await page.evaluate(() => {
    const r = document.getElementById('headerSignOutBtn').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });

  console.log('Dispatching mouse events at:', btnRect);
  await page.mouse.move(btnRect.x, btnRect.y);
  await page.mouse.down();
  await page.mouse.up();

  await new Promise(r => setTimeout(r, 1000));
  await browser.close();
})();
