const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:5000/app');
  const fnStr = await page.evaluate(() => window.handleLogout ? window.handleLogout.toString() : 'UNDEFINED');
  console.log('window.handleLogout source:\n', fnStr);
  await browser.close();
})();
