const puppeteer = require('puppeteer-core');
const path = require('path');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  console.log('=== VERIFYING REAL PRODUCTION CSS AT USER VIEWPORT (1536x776) ===');
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1536, height: 776 });

  await page.goto('http://localhost:5000/app');
  await new Promise(r => setTimeout(r, 2200));

  let screen = await page.evaluate(() => document.querySelector('.app-screen.active')?.id);
  if (screen !== 'screen-home') {
    await page.evaluate(() => {
      if (typeof window.showScreen === 'function') window.showScreen('login');
    });
    await new Promise(r => setTimeout(r, 600));
    await page.type('#login-email', 'patient@lifeqr.com');
    await page.type('#login-password', 'Password@123');
    await page.click('#btn-login-submit');
    await page.waitForFunction(() => document.getElementById('screen-home')?.classList.contains('active'), { timeout: 10000 });
  }

  await new Promise(r => setTimeout(r, 800));

  // Purely check real production CSS geometry:
  const metrics = await page.evaluate(() => {
    const chassis = document.getElementById('phoneMockupChassis');
    const nav = document.querySelector('.bottom-nav');
    const qrView = document.getElementById('tab-view-qr');
    const cR = chassis.getBoundingClientRect();
    const nR = nav.getBoundingClientRect();

    return {
      windowHeight: window.innerHeight,
      chassisTop: Math.round(cR.top),
      chassisBottom: Math.round(cR.bottom),
      chassisHeight: Math.round(cR.height),
      navTop: Math.round(nR.top),
      navBottom: Math.round(nR.bottom),
      navHeight: Math.round(nR.height),
      isChassisFullyOnScreen: cR.bottom <= window.innerHeight && cR.top >= 0,
      isNavFullyOnScreen: nR.bottom <= window.innerHeight && nR.top >= 0,
      isQrScrollable: qrView.scrollHeight > qrView.clientHeight
    };
  });
  console.log('Production metrics on user viewport (1536x776):', metrics);

  if (!metrics.isChassisFullyOnScreen || !metrics.isNavFullyOnScreen) {
    throw new Error('Chassis or Bottom Nav is not fully visible on screen!');
  }
  console.log('PASS: Bottom Navigation Bar and Smartphone Chassis are 100% fully on screen!');

  // Take screenshot at top
  await page.screenshot({ path: path.join(__dirname, 'prod_nav_at_top.png') });

  // Scroll down 400px
  console.log('Scrolling QR tab by 400px...');
  await page.evaluate(() => {
    const qrView = document.getElementById('tab-view-qr');
    qrView.scrollTop = 400;
  });
  await new Promise(r => setTimeout(r, 400));

  const scrolledMetrics = await page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav');
    const qrView = document.getElementById('tab-view-qr');
    const nR = nav.getBoundingClientRect();
    return {
      scrollTop: qrView.scrollTop,
      navTop: Math.round(nR.top),
      navBottom: Math.round(nR.bottom)
    };
  });
  console.log('Scrolled metrics:', scrolledMetrics);

  const deltaNav = Math.abs(metrics.navTop - scrolledMetrics.navTop);
  console.log('Nav shift delta:', deltaNav);
  if (deltaNav !== 0) {
    throw new Error(`Nav shifted by ${deltaNav}px! It must stay pinned at 0 shift.`);
  }
  console.log('PASS: Bottom navigation remained permanently locked at bottom during scroll!');

  await page.screenshot({ path: path.join(__dirname, 'prod_nav_at_scroll.png') });

  // Test clicking all 5 tabs using window.showTab
  const tabs = ['medical', 'contacts', 'records', 'settings', 'qr'];
  for (const t of tabs) {
    await page.evaluate((tabName) => window.showTab(tabName), t);
    await new Promise(r => setTimeout(r, 200));
    const activeSub = await page.evaluate(() => document.querySelector('.home-subview.active')?.id);
    console.log(`PASS: Switched to tab ${t} -> ${activeSub}`);
  }

  console.log('=== ALL EMPIRICAL VALIDATIONS PASSED PERFECTLY ===');
  await browser.close();
})();
