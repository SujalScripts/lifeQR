const puppeteer = require('puppeteer-core');
const path = require('path');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 950 });

  await page.goto('http://localhost:5000/app');
  await new Promise(r => setTimeout(r, 2200));

  let screen = await page.evaluate(() => document.querySelector('.app-screen.active')?.id);
  if (screen !== 'screen-home') {
    await page.evaluate(() => {
      if (typeof window.showScreen === 'function') window.showScreen('login');
    });
    await new Promise(r => setTimeout(r, 600));
    await page.type('#login-email', 'patient@lifeqr.com');
    await page.type('#login-password', 'Password@123');
    await page.click('#btn-login-submit');
    await page.waitForFunction(() => document.getElementById('screen-home')?.classList.contains('active'), { timeout: 10000 });
  }

  await new Promise(r => setTimeout(r, 800));

  // 1. Initial QR tab screenshot
  console.log('Capturing initial QR tab...');
  await page.screenshot({ path: path.join(__dirname, 'fixed_nav_qr_top.png') });

  // 2. Scroll QR tab down
  console.log('Scrolling QR tab down...');
  await page.evaluate(() => {
    const sub = document.getElementById('tab-view-qr');
    if (sub) sub.scrollTop = 500;
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(__dirname, 'fixed_nav_qr_scrolled.png') });

  // 3. Click Medical tab
  console.log('Clicking Medical tab...');
  await page.evaluate(() => window.showTab('medical'));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(__dirname, 'fixed_nav_medical_tab.png') });

  // 4. Click Settings tab
  console.log('Clicking Settings tab...');
  await page.evaluate(() => window.showTab('settings'));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(__dirname, 'fixed_nav_settings_tab.png') });

  console.log('All screenshots captured successfully!');
  await browser.close();
})();
