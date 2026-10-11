const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
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

  console.log('Testing step-by-step logout...');
  const trace = await page.evaluate(async () => {
    const steps = [];
    try {
      steps.push('1. calling apiCall');
      const res = await apiCall('/api/v1/auth/logout', 'POST');
      steps.push('2. apiCall result: ' + JSON.stringify(res));

      steps.push('3. clearing AppState');
      AppState.user = null;
      AppState.profile = null;

      steps.push('4. clearing storage');
      localStorage.removeItem('lifeqr_auth_token');
      localStorage.removeItem('token');
      localStorage.removeItem('lifeqr_user');

      steps.push('5. calling showScreen(login)');
      showScreen('login');

      steps.push('6. active screens: ' + Array.from(document.querySelectorAll('.app-screen.active')).map(s => s.id).join(', '));
      return steps;
    } catch(err) {
      steps.push('ERROR: ' + err.stack);
      return steps;
    }
  });

  console.log('TRACE:\n', trace.join('\n'));
  await browser.close();
})();
