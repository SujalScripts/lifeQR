const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,850']
  });

  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('dialog', async dialog => {
    console.log('DIALOG DETECTED:', dialog.type(), dialog.message());
    await dialog.accept();
    console.log('DIALOG ACCEPTED');
  });

  console.log('Navigating to http://localhost:5000/app...');
  await page.goto('http://localhost:5000/app', { waitUntil: 'networkidle2' });

  // Wait 2 seconds for splash transition
  await new Promise(r => setTimeout(r, 2000));

  // Check current visible screen
  const activeScreen = await page.evaluate(() => {
    const el = document.querySelector('.app-screen.active');
    return el ? el.id : 'none';
  });
  console.log('Active screen after load:', activeScreen);

  // If not logged in, log in first
  if (activeScreen === 'screen-login') {
    console.log('Logging in as patient@lifeqr.com...');
    await page.type('#login-email', 'patient@lifeqr.com');
    await page.type('#login-password', 'Password@123');
    await page.click('#btn-login-submit');
    await new Promise(r => setTimeout(r, 2000));
    const screenAfterLogin = await page.evaluate(() => {
      const el = document.querySelector('.app-screen.active');
      return el ? el.id : 'none';
    });
    console.log('Active screen after login:', screenAfterLogin);
  }

  // Find signout button and click it
  console.log('Clicking sign out button in header...');
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('button[title="Sign Out"]') || document.querySelector('button[onclick*="handleLogout"]');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log('Button clicked:', clicked);

  await new Promise(r => setTimeout(r, 2000));

  const screenAfterSignout = await page.evaluate(() => {
    const el = document.querySelector('.app-screen.active');
    return el ? el.id : 'none';
  });
  console.log('Active screen after signout:', screenAfterSignout);

  const cookies = await page.cookies();
  console.log('Remaining cookies:', cookies.map(c => c.name));

  await browser.close();
})();
