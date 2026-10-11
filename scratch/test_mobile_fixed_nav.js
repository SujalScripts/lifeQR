const puppeteer = require('puppeteer-core');
const path = require('path');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  // Real iPhone 14 / modern smartphone viewport
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

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

  await page.addStyleTag({
    content: `
      .app-container:has(#screen-home.active) {
        overflow: hidden !important;
      }
      #screen-home {
        padding: 0 !important;
        flex: 1 1 0% !important;
        min-height: 0 !important;
        height: auto !important;
        overflow: hidden !important;
        position: relative !important;
        display: none;
        flex-direction: column !important;
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
        flex: 1 1 0% !important;
        min-height: 0 !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        padding: 16px 18px 88px 18px !important;
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
        -webkit-overflow-scrolling: touch !important;
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
        max-width: 100% !important;
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

  const mobileMetrics = await page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav');
    const qrView = document.getElementById('tab-view-qr');
    const nR = nav.getBoundingClientRect();
    return {
      windowHeight: window.innerHeight,
      navTop: nR.top,
      navBottom: nR.bottom,
      navHeight: nR.height,
      isDockedAtBottom: Math.abs(nR.bottom - window.innerHeight) < 2
    };
  });
  console.log('Mobile metrics initial:', mobileMetrics);

  await page.screenshot({ path: path.join(__dirname, 'mobile_fixed_nav_initial.png') });

  // Scroll active subview
  await page.evaluate(() => {
    const qrView = document.getElementById('tab-view-qr');
    qrView.scrollTop = 500;
  });
  await new Promise(r => setTimeout(r, 300));

  const mobileMetricsScrolled = await page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav');
    const qrView = document.getElementById('tab-view-qr');
    const nR = nav.getBoundingClientRect();
    return {
      qrScrollTop: qrView.scrollTop,
      navTop: nR.top,
      navBottom: nR.bottom,
      isDockedAtBottom: Math.abs(nR.bottom - window.innerHeight) < 2
    };
  });
  console.log('Mobile metrics after scroll:', mobileMetricsScrolled);

  await page.screenshot({ path: path.join(__dirname, 'mobile_fixed_nav_scrolled.png') });

  await browser.close();
})();
