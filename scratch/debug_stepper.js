const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 950 });
  await page.goto('http://localhost:5000/app');
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.waitForSelector('#screen-onboarding.active');

  const rects = await page.evaluate(() => {
    function toObj(el) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { tag: el.tagName, id: el.id, class: el.className, x: r.x, y: r.y, w: r.width, h: r.height, top: r.top, bottom: r.bottom };
    }
    return {
      screen: toObj(document.getElementById('screen-onboarding')),
      header: toObj(document.querySelector('.onboard-stepper-header')),
      meta: toObj(document.querySelector('.onboard-stepper-meta')),
      progress: toObj(document.querySelector('.onboard-progress-track')),
      dots: toObj(document.querySelector('.onboard-steps-dots')),
      pane1: toObj(document.getElementById('onboard-pane-1'))
    };
  });
  console.log(JSON.stringify(rects, null, 2));
  await browser.close();
})();
