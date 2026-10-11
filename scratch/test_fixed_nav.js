const puppeteer = require('puppeteer-core');
const path = require('path');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });

  await page.goto('http://localhost:5000/app');
  await page.evaluate(() => localStorage.setItem('lifeqr_onboarded', 'true'));
  await page.reload();

  await page.waitForFunction(() => {
    const splash = document.getElementById('screen-splash');
    const login = document.getElementById('screen-login');
    return (!splash || !splash.classList.contains('active')) && (login && login.classList.contains('active'));
  }, { timeout: 10000 });

  await page.type('#login-email', 'patient@lifeqr.com');
  await page.type('#login-password', 'Password@123');
  await page.click('#btn-login-submit');

  await page.waitForFunction(() => {
    const home = document.getElementById('screen-home');
    return home && home.classList.contains('active');
  }, { timeout: 10000 });

  await new Promise(r => setTimeout(r, 800));

  // Apply proposed CSS
  await page.addStyleTag({
    content: `
      #screen-home {
        padding: 0 !important;
        height: 100% !important;
        min-height: 0 !important;
        overflow: hidden !important;
        position: relative !important;
        display: none;
        flex-direction: column !important;
        flex: 1 !important;
        width: 100% !important;
      }
      #screen-home.active {
        display: flex !important;
      }
      .app-header {
        flex-shrink: 0 !important;
      }
      .home-subview {
        display: none;
        flex-direction: column !important;
        gap: 16px !important;
        width: 100% !important;
        flex: 1 !important;
        min-height: 0 !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        padding: 16px 16px 84px 16px !important;
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
      .home-subview::-webkit-scrollbar {
        display: none !important;
      }
      .home-subview.active {
        display: flex !important;
      }
      .bottom-nav {
        position: absolute !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        width: 100% !important;
        background: var(--bg-card) !important;
        border-top: 2px solid var(--border-card) !important;
        display: flex !important;
        justify-content: space-around !important;
        align-items: center !important;
        padding: 8px 4px 14px 4px !important;
        z-index: 60 !important;
        box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.12) !important;
        flex-shrink: 0 !important;
      }
    `
  });

  await new Promise(r => setTimeout(r, 400));

  // Measure initial bottom-nav position
  const initialNav = await page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav');
    const vp = document.querySelector('.phone-screen-viewport');
    const nR = nav.getBoundingClientRect();
    const vR = vp.getBoundingClientRect();
    return {
      navTop: nR.top,
      navBottom: nR.bottom,
      navHeight: nR.height,
      vpBottom: vR.bottom,
      isDockedAtBottom: Math.abs(nR.bottom - vR.bottom) < 5
    };
  });
  console.log('Initial nav positioning:', initialNav);

  // Take screenshot of initial view (QR tab)
  await page.screenshot({ path: path.join(__dirname, 'fixed_nav_initial.png') });

  // Now scroll the active tab
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
      scrollTop: activeSub ? activeSub.scrollTop : null,
      navTop: nR.top,
      navBottom: nR.bottom,
      isDockedAtBottom: Math.abs(nR.bottom - vR.bottom) < 5
    };
  });
  console.log('Scrolled nav positioning:', scrolledNav);

  // Take screenshot after scrolling
  await page.screenshot({ path: path.join(__dirname, 'fixed_nav_scrolled.png') });

  // Now test tab navigation: Click Medical tab
  await page.click('#nav-btn-medical');
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(__dirname, 'fixed_nav_medical_tab.png') });

  // Click Settings tab
  await page.click('#nav-btn-settings');
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(__dirname, 'fixed_nav_settings_tab.png') });

  await browser.close();
})();
