const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function toObj(r) {
  if (!r) return null;
  return { x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
}

(async () => {
  try {
    const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 950 });
    await page.goto('http://localhost:5000/app');
    await page.evaluate(() => localStorage.setItem('lifeqr_onboarded', 'true'));
    await page.reload();
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
    await page.evaluate(() => window.openSidebar());
    await new Promise(r => setTimeout(r, 800));

    const rects = await page.evaluate(() => {
      function toObj(r) {
        if (!r) return null;
        return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) };
      }
      const s = document.getElementById('app-sidebar');
      const v = document.querySelector('.phone-screen-viewport');
      const c = document.getElementById('phoneMockupChassis');
      const h = s ? s.querySelector('.sidebar-header') : null;
      const b = s ? s.querySelectorAll('.sidebar-sq-btn') : [];
      return {
        sidebar: toObj(s ? s.getBoundingClientRect() : null),
        header: toObj(h ? h.getBoundingClientRect() : null),
        viewport: toObj(v ? v.getBoundingClientRect() : null),
        chassis: toObj(c ? c.getBoundingClientRect() : null),
        btnCount: b.length,
        firstBtn: toObj(b[0] ? b[0].getBoundingClientRect() : null)
      };
    });
    console.log(JSON.stringify(rects, null, 2));
    await browser.close();
  } catch(e) {
    console.error('Error:', e);
  }
})();
