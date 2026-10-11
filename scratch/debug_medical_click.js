const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  await page.setViewport({ width: 1200, height: 1000 });
  await page.goto('http://localhost:5000/app');
  await new Promise(r => setTimeout(r, 2200));

  await page.evaluate(() => {
    if (typeof window.showScreen === 'function') window.showScreen('login');
  });
  await new Promise(r => setTimeout(r, 600));

  await page.type('#login-email', 'patient@lifeqr.com');
  await page.type('#login-password', 'Password@123');
  await page.click('#btn-login-submit');

  await page.waitForFunction(() => document.getElementById('screen-home')?.classList.contains('active'), { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));

  console.log('Testing btn.click() via page.evaluate...');
  const res = await page.evaluate(() => {
    const btn = document.getElementById('nav-btn-medical');
    btn.click();
    return {
      activeSub: document.querySelector('.home-subview.active')?.id,
      activeBtn: document.querySelector('.nav-item.active')?.id
    };
  });
  console.log('Result after btn.click():', res);

  console.log('Now testing clicking settings tab...');
  const resSettings = await page.evaluate(() => {
    const btn = document.getElementById('nav-btn-settings');
    btn.click();
    return {
      activeSub: document.querySelector('.home-subview.active')?.id,
      activeBtn: document.querySelector('.nav-item.active')?.id
    };
  });
  console.log('Result after settings click:', resSettings);

  await browser.close();
})();
