const puppeteer = require('puppeteer-core');
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

  await page.addStyleTag({
    content: `
      .app-container {
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

  const initialMetrics = await page.evaluate(() => {
    const cont = document.getElementById('appMainContainer');
    const home = document.getElementById('screen-home');
    const qrView = document.getElementById('tab-view-qr');
    const nav = document.querySelector('.bottom-nav');
    const vp = document.querySelector('.phone-screen-viewport');

    const navRect = nav.getBoundingClientRect();
    const vpRect = vp.getBoundingClientRect();

    return {
      contScrollHeight: cont.scrollHeight,
      contClientHeight: cont.clientHeight,
      isContOverflowZero: cont.scrollHeight === cont.clientHeight,
      qrScrollHeight: qrView.scrollHeight,
      qrClientHeight: qrView.clientHeight,
      isQrScrollable: qrView.scrollHeight > qrView.clientHeight,
      navTop: navRect.top,
      navBottom: navRect.bottom,
      vpBottom: vpRect.bottom,
      isNavAtViewportBottom: Math.abs(navRect.bottom - vpRect.bottom) < 5
    };
  });
  console.log('Initial metrics:', initialMetrics);

  // Scroll QR subview
  await page.evaluate(() => {
    const qrView = document.getElementById('tab-view-qr');
    qrView.scrollTop = 350;
  });
  await new Promise(r => setTimeout(r, 300));

  const afterScrollMetrics = await page.evaluate(() => {
    const qrView = document.getElementById('tab-view-qr');
    const nav = document.querySelector('.bottom-nav');
    const vp = document.querySelector('.phone-screen-viewport');
    const navRect = nav.getBoundingClientRect();
    const vpRect = vp.getBoundingClientRect();

    return {
      qrScrollTop: qrView.scrollTop,
      navTop: navRect.top,
      navBottom: navRect.bottom,
      isNavAtViewportBottom: Math.abs(navRect.bottom - vpRect.bottom) < 5
    };
  });
  console.log('After scroll metrics:', afterScrollMetrics);

  const deltaNav = Math.abs(initialMetrics.navTop - afterScrollMetrics.navTop);
  console.log('Delta nav position (should be 0):', deltaNav);

  await browser.close();
})();
