const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,850']
  });

  const page = await browser.newPage();
  const logs = [];
  page.on('console', msg => logs.push(`CONSOLE [${msg.type()}]: ${msg.text()}`));
  page.on('pageerror', err => logs.push(`ERROR: ${err.message}`));

  console.log('1. Navigating to http://localhost:5000/app...');
  await page.goto('http://localhost:5000/app', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // Set onboarding complete and login
  await page.evaluate(() => localStorage.setItem('lifeqr_onboarded', 'true'));
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('2. Entering credentials on screen-login...');
  await page.type('#login-email', 'patient@lifeqr.com');
  await page.type('#login-password', 'Password@123');
  await page.click('#btn-login-submit');

  await new Promise(r => setTimeout(r, 2500));

  const currentScreen = await page.evaluate(() => document.querySelector('.app-screen.active')?.id);
  console.log('3. Active screen after login:', currentScreen);

  // Now, what happens when we click the signout button in the header?
  console.log('4. Checking if handleLogout exists in window...');
  const fnExists = await page.evaluate(() => typeof window.handleLogout);
  console.log('typeof window.handleLogout:', fnExists);

  // Let's check the onclick attribute of the button in the DOM:
  const btnInfo = await page.evaluate(() => {
    const btn = document.querySelector('button[title="Sign Out"]');
    return {
      outerHTML: btn?.outerHTML,
      disabled: btn?.disabled,
      offsetParent: !!btn?.offsetParent,
      rect: btn?.getBoundingClientRect()
    };
  });
  console.log('5. Sign Out button info:', JSON.stringify(btnInfo, null, 2));

  // Listen for dialog
  let dialogAppeared = false;
  page.on('dialog', async dialog => {
    dialogAppeared = true;
    console.log('6. Dialog appeared:', dialog.message());
    await dialog.accept();
  });

  console.log('7. Clicking button...');
  await page.click('button[title="Sign Out"]');
  await new Promise(r => setTimeout(r, 1000));

  console.log('8. Dialog appeared?', dialogAppeared);
  const screenAfterClick = await page.evaluate(() => document.querySelector('.app-screen.active')?.id);
  console.log('9. Active screen after sign out:', screenAfterClick);

  console.log('\n--- BROWSER LOGS ---');
  console.log(logs.join('\n'));

  await browser.close();
})();
