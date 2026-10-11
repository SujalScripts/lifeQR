const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('dialog', async d => { console.log('DIALOG DETECTED:', d.message()); await d.accept(); });
  await page.goto('http://localhost:5000/app');
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(() => localStorage.setItem('lifeqr_onboarded', 'true'));
  await page.reload();
  await new Promise(r => setTimeout(r, 2000));
  await page.type('#login-email', 'patient@lifeqr.com');
  await page.type('#login-password', 'Password@123');
  await page.click('#btn-login-submit');
  await new Promise(r => setTimeout(r, 2500));
  console.log('Calling window.handleLogout() directly:');
  const res = await page.evaluate(async () => {
    try {
      await handleLogout();
      return 'OK: ' + document.querySelector('.app-screen.active')?.id;
    } catch(e) {
      return 'ERROR: ' + e.message;
    }
  });
  console.log('Result:', res);

  // Now test finding the button and clicking it via element.click()
  // First login again
  await page.type('#login-email', 'patient@lifeqr.com');
  await page.type('#login-password', 'Password@123');
  await page.click('#btn-login-submit');
  await new Promise(r => setTimeout(r, 2500));
  console.log('Now clicking button via element.click():');
  const clickRes = await page.evaluate(() => {
    const btn = document.querySelector('button[title="Sign Out"]');
    if (!btn) return 'BUTTON NOT FOUND';
    btn.click();
    return 'CLICKED, active: ' + document.querySelector('.app-screen.active')?.id;
  });
  console.log('Click result:', clickRes);

  await new Promise(r => setTimeout(r, 1000));
  const finalScreen = await page.evaluate(() => document.querySelector('.app-screen.active')?.id);
  console.log('Final screen:', finalScreen);

  await browser.close();
})();
