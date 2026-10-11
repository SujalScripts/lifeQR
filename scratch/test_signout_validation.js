const puppeteer = require('puppeteer-core');
const path = require('path');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  console.log('=== STARTING SIGNOUT EMPIRICAL VALIDATION ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });

    console.log('1. Navigating to http://localhost:5000/app ...');
    await page.goto('http://localhost:5000/app', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));

    // Ensure we are ready to log in
    await page.evaluate(() => localStorage.setItem('lifeqr_onboarded', 'true'));
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1800));

    let activeScreen = await page.evaluate(() => document.querySelector('.app-screen.active')?.id);
    console.log('Current screen after load:', activeScreen);

    if (activeScreen !== 'screen-home') {
      console.log('Logging in as patient@lifeqr.com ...');
      await page.waitForSelector('#login-email', { visible: true });
      await page.type('#login-email', 'patient@lifeqr.com');
      await page.type('#login-password', 'Password@123');
      await page.click('#btn-login-submit');
      await new Promise(r => setTimeout(r, 2500));
      activeScreen = await page.evaluate(() => document.querySelector('.app-screen.active')?.id);
      console.log('Screen after login:', activeScreen);
    }

    if (activeScreen !== 'screen-home') {
      throw new Error(`Expected screen-home after login, got: ${activeScreen}`);
    }
    console.log('PASS: Logged in and on screen-home!');

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    // 2. Check header sign out button existence and properties
    const headerBtn = await page.$('#headerSignOutBtn');
    if (!headerBtn) {
      throw new Error('Header signout button #headerSignOutBtn not found!');
    }
    console.log('PASS: Found #headerSignOutBtn in header.');

    const preState = await page.evaluate(() => {
      const btn = document.getElementById('headerSignOutBtn');
      const modal = document.getElementById('modal-logout-confirm');
      return {
        btnOnclick: btn ? btn.getAttribute('onclick') : null,
        handleLogoutType: typeof window.handleLogout,
        modalExists: !!modal,
        modalClasses: modal ? modal.className : null
      };
    });
    console.log('Pre-click state:', preState);

    // 3. Click the header signout button
    console.log('3. Clicking #headerSignOutBtn ...');
    await headerBtn.click();
    await new Promise(r => setTimeout(r, 800));

    // 4. Verify logout modal is visible and active
    const postState = await page.evaluate(() => {
      const modal = document.getElementById('modal-logout-confirm');
      return {
        isModalActive: modal ? modal.classList.contains('active') : false,
        modalClasses: modal ? modal.className : null,
        modalStyle: modal ? window.getComputedStyle(modal).display : null
      };
    });
    console.log('Post-click state:', postState);

    if (!postState.isModalActive) {
      // Let's test calling window.handleLogout directly
      console.log('Testing direct execution of window.handleLogout() in page context...');
      const directCall = await page.evaluate(() => {
        try {
          window.handleLogout();
          const modal = document.getElementById('modal-logout-confirm');
          return {
            called: true,
            modalActive: modal ? modal.classList.contains('active') : false,
            modalClasses: modal ? modal.className : null
          };
        } catch (e) {
          return { error: e.message, stack: e.stack };
        }
      });
      console.log('Direct call result:', directCall);
      throw new Error('Expected #modal-logout-confirm to have active class after clicking signout button!');
    }
    console.log('PASS: Logout confirmation modal appeared cleanly without blocking window.confirm() dialog.');

    // Save screenshot of the confirmation modal
    await page.screenshot({ path: path.join(__dirname, 'modal_signout_confirm.png') });

    // 5. Click the Confirm Sign Out button
    console.log('5. Clicking #btn-confirm-logout-action ...');
    const confirmBtn = await page.$('#btn-confirm-logout-action');
    if (!confirmBtn) {
      throw new Error('#btn-confirm-logout-action not found inside modal!');
    }
    await confirmBtn.click();
    await new Promise(r => setTimeout(r, 1200));

    // 6. Verify screen transitioned to login
    activeScreen = await page.evaluate(() => document.querySelector('.app-screen.active')?.id);
    console.log('Screen after confirming logout:', activeScreen);
    if (activeScreen !== 'screen-login') {
      throw new Error(`Expected screen-login after logout, got: ${activeScreen}`);
    }
    console.log('PASS: App transitioned to screen-login.');

    // 7. Verify localStorage auth keys removed
    const storageKeys = await page.evaluate(() => {
      return {
        token: localStorage.getItem('token'),
        lifeqr_auth_token: localStorage.getItem('lifeqr_auth_token'),
        lifeqr_user: localStorage.getItem('lifeqr_user')
      };
    });
    console.log('LocalStorage auth keys:', storageKeys);
    if (storageKeys.token || storageKeys.lifeqr_auth_token || storageKeys.lifeqr_user) {
      throw new Error('Auth keys were not removed from localStorage!');
    }
    console.log('PASS: LocalStorage auth keys successfully purged.');

    // 8. Test reload persistence: user must remain logged out!
    console.log('8. Reloading page to test persistence of logged out state...');
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2200));

    activeScreen = await page.evaluate(() => document.querySelector('.app-screen.active')?.id);
    console.log('Screen after reload:', activeScreen);
    if (activeScreen !== 'screen-login') {
      throw new Error(`Expected screen-login after reload, got: ${activeScreen}`);
    }
    console.log('PASS: Reloading confirms persistent logged-out state (cookie cleared, no auto-login back to home).');

    // Save final screenshot
    await page.screenshot({ path: path.join(__dirname, 'logged_out_screen.png') });

    console.log('=== ALL SIGNOUT CHECKS PASSED PERFECTLY ===');
  } catch (err) {
    console.error('TEST FAILED:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
