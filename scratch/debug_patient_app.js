const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 900 });

  page.on('console', msg => console.log('[Console]:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('[PageError]:', err.message));

  console.log('Navigating to patient_app.html...');
  await page.goto('http://localhost:5000/patient_app.html', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1500));

  console.log('Filling login...');
  await page.type('#login-email', 'patient@lifeqr.com');
  await page.type('#login-password', 'Password@123');
  await page.click('#btn-login-submit');
  await new Promise(r => setTimeout(r, 3000));

  const debugInfo = await page.evaluate(() => {
    return {
      activeScreen: document.querySelector('.app-screen.active')?.id,
      activeTab: document.querySelector('.home-subview.active')?.id,
      qrSrc: document.getElementById('live-qr-image')?.src?.substring(0, 50),
      qrId: document.getElementById('live-qr-id')?.innerText,
      userName: document.getElementById('header-user-name')?.innerText,
      bloodBadge: document.getElementById('live-blood-badge')?.innerText
    };
  });
  console.log('Debug Info:', debugInfo);

  await page.screenshot({ path: 'scratch/debug_patient_app.png' });
  await browser.close();
})();
