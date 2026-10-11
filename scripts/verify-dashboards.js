const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5000';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'tests', 'screenshots');

const delay = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('🏥 Capturing Remaining Clinical & Emergency Dashboards + Token Audit...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,850']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 850 });

  const roleTests = [
    { role: 'patient', email: 'patient@lifeqr.com', file: 'patient_dashboard.html', name: 'patient_desktop' },
    { role: 'crew', email: 'crew@lifeqr.com', file: 'CrewAmbulance_dashboard.html', name: 'crew_dashboard' },
    { role: 'doctor', email: 'doctor@lifeqr.com', file: 'doctor_dashboard.html', name: 'doctor_dashboard' },
    { role: 'hospital', email: 'er@lifeqr.com', file: 'hospital_dashboard.html', name: 'hospital_dashboard' },
    { role: 'hospital', email: 'er@lifeqr.com', file: 'er_dashboard.html', name: 'er_dashboard' },
    { role: 'admin', email: 'admin@lifeqr.com', file: 'admin_dashboard.html', name: 'admin_dashboard' }
  ];

  for (const rt of roleTests) {
    try {
      // Clear cookies
      const client = await page.target().createCDPSession();
      await client.send('Network.clearBrowserCookies');

      // Direct login API
      const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: rt.email, password: 'Password@123' })
      });
      const data = await res.json();
      if (data && data.token) {
        await page.setCookie({
          name: 'token',
          value: data.token,
          domain: 'localhost',
          path: '/',
          httpOnly: true
        });
      }

      await page.goto(`${BASE_URL}/${rt.file}`, { waitUntil: 'domcontentloaded' });
      await delay(1200);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `12_${rt.name}.png`) });
      console.log(`   ✓ [${rt.role.toUpperCase()}] ${rt.file} captured.`);
    } catch (err) {
      console.warn(`   ⚠️ Error capturing ${rt.file}:`, err.message);
    }
  }

  // Emergency access (public scan)
  try {
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await page.goto(`${BASE_URL}/emergency_access.html?id=RAH-D3200470`, { waitUntil: 'domcontentloaded' });
    await delay(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_emergency_access.png') });
    console.log(`   ✓ [PUBLIC] emergency_access.html captured.`);
  } catch (err) {
    console.warn('   ⚠️ Error capturing emergency_access.html:', err.message);
  }

  // Splash Screen
  try {
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/splash.html`, { waitUntil: 'domcontentloaded' });
    await delay(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13_splash_screen.png') });
    console.log(`   ✓ [MOBILE] splash.html captured.`);
  } catch (err) {
    console.warn('   ⚠️ Error capturing splash.html:', err.message);
  }

  // Design Token Parity Check
  console.log('\n🎨 Comparing Design Tokens between App and Website...');
  await page.goto(`${BASE_URL}/patient_app.html`, { waitUntil: 'domcontentloaded' });
  const appTokens = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return {
      primary: s.getPropertyValue('--primary').trim(),
      emergency: s.getPropertyValue('--emergency').trim(),
      bgApp: s.getPropertyValue('--bg-app').trim(),
      fontSans: s.getPropertyValue('--font-sans').trim(),
      fontMono: s.getPropertyValue('--font-mono').trim()
    };
  });

  await page.goto(`${BASE_URL}/landingpage.html`, { waitUntil: 'domcontentloaded' });
  const webTokens = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return {
      primary: s.getPropertyValue('--primary').trim(),
      emergency: s.getPropertyValue('--emergency').trim(),
      bgApp: s.getPropertyValue('--bg-surface').trim(),
      fontSans: s.getPropertyValue('--font-sans').trim(),
      fontMono: s.getPropertyValue('--font-mono').trim()
    };
  });

  console.log('   App Design Tokens :', appTokens);
  console.log('   Web Design Tokens :', webTokens);

  const tokenMatch = 
    appTokens.primary.toLowerCase() === webTokens.primary.toLowerCase() &&
    appTokens.emergency.toLowerCase() === webTokens.emergency.toLowerCase();

  console.log(`\n🎉 Audit Completed! Style Parity: ${tokenMatch ? '100% Consistent Match' : 'Discrepancy'}\n`);

  await browser.close();
}

run();
