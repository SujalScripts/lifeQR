const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 900 });

  page.on('console', msg => console.log('[Console]:', msg.type(), msg.text()));

  // 1. Visit patient_app.html to capture Splash Screen
  console.log('1. Navigating to patient_app.html for Splash...');
  await page.goto('http://localhost:5000/patient_app.html', { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: 'scratch/flow_1_splash.png' });
  console.log('Captured scratch/flow_1_splash.png');

  // Wait 1.8s for splash animation and transition to login
  await new Promise(r => setTimeout(r, 1800));
  await page.screenshot({ path: 'scratch/flow_2_login.png' });
  console.log('Captured scratch/flow_2_login.png');

  // 2. Perform 1-click Demo Login
  console.log('2. Clicking Quick Demo Sign-In button...');
  await page.evaluate(() => {
    window.quickFillDemoPatient();
  });
  await new Promise(r => setTimeout(r, 4500)); // wait for toasts to fade out

  // Scroll to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'scratch/flow_3_home_dashboard.png' });
  console.log('Captured scratch/flow_3_home_dashboard.png');

  const finalCheck = await page.evaluate(() => {
    return {
      activeScreen: document.querySelector('.app-screen.active')?.id,
      userName: document.getElementById('header-user-name')?.innerText,
      qrId: document.getElementById('live-qr-id')?.innerText,
      bloodBadge: document.getElementById('live-blood-badge')?.innerText,
      vitalsBlood: document.getElementById('home-vitals-blood')?.innerText,
      vitalsAge: document.getElementById('home-vitals-age')?.innerText,
      allergiesCount: document.querySelectorAll('#home-allergies-list .badge-emergency')?.length,
      contactName: document.getElementById('home-contact-name')?.innerText,
      modalsVisible: document.querySelectorAll('.modal-overlay.active')?.length
    };
  });
  console.log('Final Validation Results:', finalCheck);

  await browser.close();
})();
