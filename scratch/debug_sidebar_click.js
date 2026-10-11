const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1536, height: 776 });
  await page.goto('http://localhost:5000/app');
  await new Promise(r => setTimeout(r, 2200));

  let screen = await page.evaluate(() => document.querySelector('.app-screen.active')?.id);
  if (screen !== 'screen-home') {
    await page.evaluate(() => { if (typeof window.showScreen === 'function') window.showScreen('login'); });
    await new Promise(r => setTimeout(r, 600));
    await page.type('#login-email', 'patient@lifeqr.com');
    await page.type('#login-password', 'Password@123');
    await page.click('#btn-login-submit');
    await page.waitForFunction(() => document.getElementById('screen-home')?.classList.contains('active'), { timeout: 10000 });
  }

  await new Promise(r => setTimeout(r, 1000));

  const btnDetails = await page.evaluate(() => {
    const btn = document.getElementById('headerSidebarBtn');
    const r = btn.getBoundingClientRect();
    const elemAtPoint = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      rect: { left: r.left, top: r.top, width: r.width, height: r.height },
      elemAtPoint: elemAtPoint ? { tag: elemAtPoint.tagName, id: elemAtPoint.id, class: elemAtPoint.className } : null,
      openSidebarType: typeof window.openSidebar
    };
  });
  console.log('Button details:', btnDetails);

  console.log('Testing direct evaluate openSidebar()...');
  await page.evaluate(() => window.openSidebar());
  const stateAfterEval = await page.evaluate(() => {
    const sb = document.getElementById('app-sidebar');
    const ov = document.getElementById('sidebar-overlay');
    return {
      sbClass: sb?.className,
      ovClass: ov?.className,
      isOpen: sb?.classList.contains('open')
    };
  });
  console.log('State after eval openSidebar():', stateAfterEval);

  console.log('Testing click via dispatchEvent or element.click()...');
  await page.evaluate(() => window.closeSidebar());
  await page.evaluate(() => document.getElementById('headerSidebarBtn').click());
  const stateAfterElClick = await page.evaluate(() => {
    const sb = document.getElementById('app-sidebar');
    return { sbClass: sb?.className, isOpen: sb?.classList.contains('open') };
  });
  console.log('State after document.getElementById("headerSidebarBtn").click():', stateAfterElClick);

  await browser.close();
})();
