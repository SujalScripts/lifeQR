const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  await page.setViewport({ width: 1200, height: 900 });

  console.log('Navigating to app...');
  await page.goto('http://localhost:5000/app');
  await page.evaluate(() => localStorage.setItem('lifeqr_onboarded', 'true'));
  await page.reload();

  // Wait until splash screen is completely gone and login screen is active
  console.log('Waiting for #screen-login to be active...');
  await page.waitForFunction(() => {
    const splash = document.getElementById('screen-splash');
    const login = document.getElementById('screen-login');
    return (!splash || !splash.classList.contains('active')) && (login && login.classList.contains('active'));
  }, { timeout: 10000 });
  console.log('Login screen is ready!');

  await page.type('#login-email', 'patient@lifeqr.com');
  await page.type('#login-password', 'Password@123');
  await page.click('#btn-login-submit');

  console.log('Waiting for #screen-home to be active...');
  await page.waitForFunction(() => {
    const home = document.getElementById('screen-home');
    return home && home.classList.contains('active');
  }, { timeout: 10000 });
  console.log('Home screen is active!');

  // Small delay for any CSS entry transition
  await new Promise(r => setTimeout(r, 600));

  console.log('Clicking #headerSignOutBtn ...');
  await page.click('#headerSignOutBtn');
  await new Promise(r => setTimeout(r, 500));

  let isModalActive = await page.evaluate(() => {
    const modal = document.getElementById('modal-logout-confirm');
    return modal && modal.classList.contains('active');
  });
  console.log('Is logout modal active?', isModalActive);

  if (isModalActive) {
    console.log('Clicking #btn-confirm-logout-action inside modal...');
    await page.click('#btn-confirm-logout-action');
    await new Promise(r => setTimeout(r, 1000));

    const finalScreen = await page.evaluate(() => document.querySelector('.app-screen.active')?.id);
    console.log('Active screen after confirming logout:', finalScreen);

    // Verify token cleared
    const token = await page.evaluate(() => localStorage.getItem('token') || localStorage.getItem('lifeqr_auth_token'));
    console.log('Remaining token:', token);
  }

  await browser.close();
})();
