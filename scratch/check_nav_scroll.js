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

  const navInfo = await page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav');
    const chassis = document.getElementById('phoneMockupChassis');
    const viewport = document.querySelector('.phone-screen-viewport');
    const container = document.getElementById('appMainContainer');

    const navRect = nav ? nav.getBoundingClientRect() : null;
    const vpRect = viewport ? viewport.getBoundingClientRect() : null;
    const contRect = container ? container.getBoundingClientRect() : null;

    return {
      navRect,
      vpRect,
      contRect,
      containerScrollHeight: container ? container.scrollHeight : null,
      containerClientHeight: container ? container.clientHeight : null,
      containerScrollTop: container ? container.scrollTop : null,
      isNavInsideViewport: navRect && vpRect ? (navRect.bottom <= vpRect.bottom && navRect.top >= vpRect.top) : false
    };
  });

  console.log('Nav visibility info initially:', JSON.stringify(navInfo, null, 2));

  // Now scroll the container
  await page.evaluate(() => {
    const container = document.getElementById('appMainContainer');
    if (container) container.scrollTop = 300;
  });
  await new Promise(r => setTimeout(r, 300));

  const scrolledInfo = await page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav');
    const viewport = document.querySelector('.phone-screen-viewport');
    const container = document.getElementById('appMainContainer');
    const navRect = nav ? nav.getBoundingClientRect() : null;
    const vpRect = viewport ? viewport.getBoundingClientRect() : null;

    return {
      navRect,
      containerScrollTop: container ? container.scrollTop : null,
      isNavInsideViewport: navRect && vpRect ? (navRect.bottom <= vpRect.bottom && navRect.top >= vpRect.top) : false
    };
  });

  console.log('Nav visibility after scrolling 300px:', JSON.stringify(scrolledInfo, null, 2));

  await browser.close();
})();
