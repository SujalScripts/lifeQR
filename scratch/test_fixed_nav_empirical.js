const puppeteer = require('puppeteer-core');
const path = require('path');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  console.log('=== EMPIRICAL TEST: FIXED BOTTOM NAVIGATION BAR ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1000 });

    console.log('1. Loading http://localhost:5000/app ...');
    await page.goto('http://localhost:5000/app');
    await new Promise(r => setTimeout(r, 2000));

    // If on onboarding or splash, go straight to login
    await page.evaluate(() => {
      if (typeof window.showScreen === 'function') {
        const active = document.querySelector('.app-screen.active')?.id;
        if (active !== 'screen-home' && active !== 'screen-login') {
          window.showScreen('login');
        }
      }
    });
    await new Promise(r => setTimeout(r, 500));

    const screenNow = await page.evaluate(() => document.querySelector('.app-screen.active')?.id);
    console.log('Active screen:', screenNow);

    if (screenNow !== 'screen-home') {
      console.log('Logging in as patient@lifeqr.com ...');
      await page.waitForSelector('#login-email', { visible: true });
      await page.type('#login-email', 'patient@lifeqr.com');
      await page.type('#login-password', 'Password@123');
      await page.click('#btn-login-submit');

      await page.waitForFunction(() => {
        const home = document.getElementById('screen-home');
        return home && home.classList.contains('active');
      }, { timeout: 10000 });
      await new Promise(r => setTimeout(r, 800));
    }

    console.log('PASS: Logged in and on screen-home!');

    // 2. Measure bottom-nav docking
    const initialNav = await page.evaluate(() => {
      const nav = document.querySelector('.bottom-nav');
      const vp = document.querySelector('.phone-screen-viewport');
      const nR = nav.getBoundingClientRect();
      const vR = vp.getBoundingClientRect();
      return {
        navTop: Math.round(nR.top),
        navBottom: Math.round(nR.bottom),
        navHeight: Math.round(nR.height),
        vpBottom: Math.round(vR.bottom),
        isDocked: Math.abs(nR.bottom - vR.bottom) < 5
      };
    });
    console.log('Initial Bottom Nav Position:', initialNav);
    if (!initialNav.isDocked) {
      throw new Error(`Bottom nav is not docked at viewport bottom! navBottom: ${initialNav.navBottom}, vpBottom: ${initialNav.vpBottom}`);
    }
    console.log('PASS: Bottom navigation is properly docked at the bottom of the phone screen!');

    // 3. Scroll down on QR tab
    console.log('3. Scrolling down 400px inside QR tab...');
    await page.evaluate(() => {
      const activeSub = document.querySelector('.home-subview.active');
      if (activeSub) activeSub.scrollTop = 400;
    });
    await new Promise(r => setTimeout(r, 400));

    const scrolledNav = await page.evaluate(() => {
      const nav = document.querySelector('.bottom-nav');
      const vp = document.querySelector('.phone-screen-viewport');
      const activeSub = document.querySelector('.home-subview.active');
      const nR = nav.getBoundingClientRect();
      const vR = vp.getBoundingClientRect();
      return {
        scrollTop: activeSub.scrollTop,
        navTop: Math.round(nR.top),
        navBottom: Math.round(nR.bottom),
        isDocked: Math.abs(nR.bottom - vR.bottom) < 5
      };
    });
    console.log('Scrolled Bottom Nav Position:', scrolledNav);

    const delta = Math.abs(initialNav.navTop - scrolledNav.navTop);
    console.log('Nav shift delta:', delta);
    if (delta !== 0) {
      throw new Error(`Bottom nav shifted by ${delta}px during scroll! It must stay pinned at 0 shift.`);
    }
    console.log('PASS: Bottom nav remained 100% fixed and motionless during scroll!');

    // 4. Test Tab Switching across all 5 tabs
    const tabs = ['medical', 'contacts', 'records', 'settings', 'qr'];
    for (const t of tabs) {
      console.log(`4. Clicking tab: ${t} ...`);
      await page.click(`#nav-btn-${t}`);
      await new Promise(r => setTimeout(r, 300));

      const tabCheck = await page.evaluate((tabName) => {
        const sub = document.getElementById(`tab-view-${tabName}`);
        const nav = document.querySelector('.bottom-nav');
        const vp = document.querySelector('.phone-screen-viewport');
        const btn = document.getElementById(`nav-btn-${tabName}`);
        const nR = nav.getBoundingClientRect();
        const vR = vp.getBoundingClientRect();
        return {
          isSubActive: sub && sub.classList.contains('active'),
          isBtnActive: btn && btn.classList.contains('active'),
          isDocked: Math.abs(nR.bottom - vR.bottom) < 5
        };
      }, t);

      if (!tabCheck.isSubActive || !tabCheck.isBtnActive || !tabCheck.isDocked) {
        throw new Error(`Tab ${t} check failed: ${JSON.stringify(tabCheck)}`);
      }
      console.log(`PASS: Tab ${t} active and bottom nav properly docked.`);
    }

    console.log('=== ALL FIXED BOTTOM NAVIGATION TESTS PASSED PERFECTLY! ===');
  } catch (err) {
    console.error('TEST ERROR:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
