const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 }); // iPhone 14 / modern mobile viewport

  // 1. Visit splash
  console.log('Navigating to patient_app.html...');
  await page.goto('http://localhost:5000/patient_app.html', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000)); // wait 2s for splash transition
  await page.screenshot({ path: 'scratch/patient_app_initial.png' });
  console.log('Saved scratch/patient_app_initial.png');

  // Check active screen
  let activeScreen = await page.evaluate(() => {
    const active = document.querySelector('.app-screen.active');
    return active ? active.id : 'none';
  });
  console.log('Initial screen after splash:', activeScreen);

  // If on login screen, log in as verified patient
  if (activeScreen === 'screen-login') {
    console.log('Logging in as patient@lifeqr.com...');
    await page.type('#login-email', 'patient@lifeqr.com');
    await page.type('#login-password', 'Password@123');
    await page.click('#btn-login-submit');
    await new Promise(r => setTimeout(r, 2500));
    activeScreen = await page.evaluate(() => {
      const active = document.querySelector('.app-screen.active');
      return active ? active.id : 'none';
    });
    console.log('Screen after login:', activeScreen);
    await page.screenshot({ path: 'scratch/patient_app_home.png' });
    console.log('Saved scratch/patient_app_home.png');
  }

  await browser.close();
})();
