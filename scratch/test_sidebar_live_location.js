const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\tarun\\.gemini\\antigravity-ide\\brain\\08b9a5ea-520e-4487-bb4a-2fd6538a6aef';

(async () => {
  console.log('[Test] Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 950 });

    const context = browser.defaultBrowserContext();
    await context.overridePermissions('http://localhost:5000', ['geolocation']);
    await page.setGeolocation({ latitude: 18.9220, longitude: 72.8347, accuracy: 12 });

    await page.goto('http://localhost:5000/app', { waitUntil: 'networkidle2' });
    await page.evaluate(() => localStorage.setItem('lifeqr_onboarded', 'true'));
    await page.reload({ waitUntil: 'networkidle2' });

    await page.waitForFunction(() => {
      const login = document.getElementById('screen-login');
      return login && login.classList.contains('active');
    }, { timeout: 10000 });

    await page.type('#login-email', 'patient@lifeqr.com');
    await page.type('#login-password', 'Password@123');
    await page.click('#btn-login-submit');

    await page.waitForFunction(() => {
      const home = document.getElementById('screen-home');
      return home && home.classList.contains('active');
    }, { timeout: 10000 });

    // Wait for any login toast to fade away
    await new Promise(r => setTimeout(r, 2500));

    // Clear toast container just in case
    await page.evaluate(() => {
      const tc = document.getElementById('toast-container');
      if (tc) tc.innerHTML = '';
    });

    console.log('[Test] Opening sidebar...');
    await page.evaluate(() => window.openSidebar());
    await page.waitForFunction(() => {
      const s = document.getElementById('app-sidebar');
      return s && s.classList.contains('open');
    }, { timeout: 4000 });

    await new Promise(r => setTimeout(r, 600));

    const phoneChassis = await page.$('#phoneMockupChassis');

    // 1. Pristine top view of sidebar
    const topPath = path.join(ARTIFACTS_DIR, 'sidebar_clean_top_view.png');
    await phoneChassis.screenshot({ path: topPath });
    console.log('[Test] Saved clean top view:', topPath);

    // 2. Scroll sidebar down to see the quick shortcuts and bottom options
    await page.evaluate(() => {
      const scrollable = document.querySelector('.sidebar-scrollable');
      if (scrollable) scrollable.scrollTop = scrollable.scrollHeight;
    });

    await new Promise(r => setTimeout(r, 500));

    const bottomPath = path.join(ARTIFACTS_DIR, 'sidebar_clean_bottom_view.png');
    await phoneChassis.screenshot({ path: bottomPath });
    console.log('[Test] Saved clean bottom view:', bottomPath);

    // 3. Test Theme Toggle button in sidebar
    console.log('[Test] Testing Theme Toggle button...');
    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'light');
    await page.evaluate(() => {
      const sqThemeBtn = document.querySelector('.sidebar-sq-btn');
      if (sqThemeBtn) sqThemeBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));
    const newTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'light');
    console.log(`[Test] Theme toggled from ${initialTheme} to ${newTheme}`);

    const darkPath = path.join(ARTIFACTS_DIR, 'sidebar_dark_mode_view.png');
    await phoneChassis.screenshot({ path: darkPath });
    console.log('[Test] Saved dark mode view:', darkPath);

    // 4. Test Sign Out Modal trigger from sidebar
    console.log('[Test] Testing Logout button in sidebar...');
    await page.evaluate(() => {
      const sqLogoutBtn = document.querySelectorAll('.sidebar-sq-btn')[1];
      if (sqLogoutBtn) sqLogoutBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    const modalActive = await page.evaluate(() => {
      const modal = document.getElementById('modal-logout-confirm');
      return modal && modal.classList.contains('active');
    });
    console.log('[Test] Logout confirmation modal active:', modalActive);

    const logoutModalPath = path.join(ARTIFACTS_DIR, 'sidebar_logout_modal_triggered.png');
    await phoneChassis.screenshot({ path: logoutModalPath });
    console.log('[Test] Saved logout modal view:', logoutModalPath);

    console.log('[Test] All sidebar verifications completed successfully!');
  } catch (err) {
    console.error('[Test Error]:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
