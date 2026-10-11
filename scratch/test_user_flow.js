const puppeteer = require('puppeteer-core');

async function testFlow() {
  console.log('🚀 Starting LifeQR App Lifecycle Test...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 420, height: 880 });

    // ==========================================
    // TEST 1: FIRST-TIME USER FLOW
    // ==========================================
    console.log('\n--- TEST 1: FIRST-TIME USER OPEN ---');
    // Clear cookies & storage to simulate brand new user
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');

    await page.goto('http://localhost:5000/patient_app.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });

    // 1. Verify Splash Screen
    const isSplashActive = await page.evaluate(() => {
      const el = document.getElementById('screen-splash');
      return el && el.classList.contains('active');
    });
    console.log('1. Splash screen active on initial launch:', isSplashActive);
    if (!isSplashActive) throw new Error('Splash screen was not active on launch');

    await page.screenshot({ path: 'scratch/flow_1_splash.png' });

    // 2. Wait for splash to transition (approx 1.8s)
    await new Promise(r => setTimeout(r, 2200));

    // 3. Verify Introduction & Permission Onboarding Screen
    const isOnboardingActive = await page.evaluate(() => {
      const el = document.getElementById('screen-onboarding');
      return el && el.classList.contains('active');
    });
    console.log('2. Transitioned to Onboarding & Permissions screen:', isOnboardingActive);
    if (!isOnboardingActive) throw new Error('Did not transition to onboarding screen');

    await page.screenshot({ path: 'scratch/flow_2_onboarding.png' });

    // 4. Test clicking "Sign In" from onboarding
    console.log('3. Clicking Sign In from onboarding...');
    await page.click('button[onclick="skipOnboardingToLogin()"]');
    await new Promise(r => setTimeout(r, 400));

    const isLoginActive = await page.evaluate(() => {
      const el = document.getElementById('screen-login');
      return el && el.classList.contains('active');
    });
    console.log('4. Transitioned to Login screen:', isLoginActive);
    if (!isLoginActive) throw new Error('Did not transition to login screen');

    await page.screenshot({ path: 'scratch/flow_3_login.png' });

    // 5. Fill credentials & submit login
    console.log('5. Submitting credentials (patient@lifeqr.com)...');
    await page.type('#login-email', 'patient@lifeqr.com');
    await page.type('#login-password', 'Password@123');
    await page.click('#btn-login-submit');

    // Wait for login & dashboard render
    await new Promise(r => setTimeout(r, 2000));

    const isHomeActiveAfterLogin = await page.evaluate(() => {
      const el = document.getElementById('screen-home');
      return el && el.classList.contains('active');
    });
    console.log('6. Reached Patient Dashboard after login:', isHomeActiveAfterLogin);
    if (!isHomeActiveAfterLogin) throw new Error('Did not reach dashboard after login');

    await page.screenshot({ path: 'scratch/flow_4_dashboard.png' });

    // ==========================================
    // TEST 2: REGULAR RETURNING USER OPEN
    // ==========================================
    console.log('\n--- TEST 2: RETURNING USER (REGULAR LAUNCH) ---');
    console.log('Reloading app to simulate opening app again on regular basis...');

    await page.goto('http://localhost:5000/patient_app.html', { waitUntil: 'domcontentloaded' });

    // 1. Should show splash during verification
    const isSplashActiveReturn = await page.evaluate(() => {
      const el = document.getElementById('screen-splash');
      return el && el.classList.contains('active');
    });
    console.log('1. Splash screen active on returning launch:', isSplashActiveReturn);

    // 2. Wait for session check to resolve and splash to fade out (approx 1.8s)
    await new Promise(r => setTimeout(r, 2200));

    // 3. Should DIRECTLY be on Dashboard without login prompt!
    const isHomeActiveAuto = await page.evaluate(() => {
      const el = document.getElementById('screen-home');
      return el && el.classList.contains('active');
    });
    const isLoginActiveAuto = await page.evaluate(() => {
      const el = document.getElementById('screen-login');
      return el && el.classList.contains('active');
    });

    console.log('2. Direct to Dashboard on regular open:', isHomeActiveAuto);
    console.log('3. Login screen skipped (no prompt):', !isLoginActiveAuto);

    if (!isHomeActiveAuto || isLoginActiveAuto) {
      throw new Error('Returning user was prompted to login or did not reach dashboard');
    }

    await page.screenshot({ path: 'scratch/flow_5_returning_dashboard.png' });

    console.log('\n🎉 ALL LIFECYCLE TESTS PASSED 100% SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
  } finally {
    await browser.close();
  }
}

testFlow();
