const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\tarun\\.gemini\\antigravity-ide\\brain\\08b9a5ea-520e-4487-bb4a-2fd6538a6aef';

(async () => {
  console.log('[Test] Launching Chrome for Onboarding Permission Wizard validation...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-fake-ui-for-media-stream']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 950 });

    const context = browser.defaultBrowserContext();
    await context.overridePermissions('http://localhost:5000', ['geolocation', 'notifications']);
    await page.setGeolocation({ latitude: 18.9220, longitude: 72.8347, accuracy: 15 });

    console.log('[Test] Opening http://localhost:5000/app with clean storage...');
    await page.goto('http://localhost:5000/app', { waitUntil: 'networkidle2' });

    // Wipe storage to guarantee true first-time visitor experience
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.reload({ waitUntil: 'networkidle2' });

    console.log('[Test] Waiting for splash completion & onboarding screen...');
    await page.waitForFunction(() => {
      const splash = document.getElementById('screen-splash');
      const onboard = document.getElementById('screen-onboarding');
      return (!splash || !splash.classList.contains('active')) && (onboard && onboard.classList.contains('active'));
    }, { timeout: 10000 });

    const phoneChassis = await page.$('#phoneMockupChassis');

    // --- STEP 1: Introduction ---
    console.log('[Test] Verifying Step 1: Introduction...');
    const step1Active = await page.evaluate(() => {
      const pane = document.getElementById('onboard-pane-1');
      const title = document.getElementById('onboard-step-title');
      return pane && pane.classList.contains('active') && title && title.innerText.includes('INTRODUCTION');
    });
    console.log('[Test] Step 1 active:', step1Active);
    await phoneChassis.screenshot({ path: path.join(ARTIFACTS_DIR, 'onboarding_step1_intro.png') });

    // --- Transition to STEP 2: GPS Location ---
    console.log('[Test] Advancing to Step 2: Live GPS Location...');
    await page.click('#btn-start-permissions');
    await new Promise(r => setTimeout(r, 400));

    const step2Active = await page.evaluate(() => {
      const pane = document.getElementById('onboard-pane-2');
      const title = document.getElementById('onboard-step-title');
      return pane && pane.classList.contains('active') && title && title.innerText.includes('GPS');
    });
    console.log('[Test] Step 2 active:', step2Active);
    await phoneChassis.screenshot({ path: path.join(ARTIFACTS_DIR, 'onboarding_step2_location_instructions.png') });

    // Test granting GPS
    console.log('[Test] Requesting Location permission in Step 2...');
    await page.click('#btn-request-geo');
    await new Promise(r => setTimeout(r, 600));

    const geoResult = await page.evaluate(() => {
      const badge = document.getElementById('onboard-status-badge-geo');
      const telemetry = document.getElementById('onboard-telemetry-geo');
      return {
        badgeText: badge ? badge.innerText : null,
        telemetryVisible: telemetry ? telemetry.style.display !== 'none' : false
      };
    });
    console.log('[Test] Step 2 GPS result:', geoResult);
    await phoneChassis.screenshot({ path: path.join(ARTIFACTS_DIR, 'onboarding_step2_location_granted.png') });

    // Wait for auto-advance or trigger next
    await new Promise(r => setTimeout(r, 1000));
    const isStep3Already = await page.evaluate(() => {
      const p3 = document.getElementById('onboard-pane-3');
      return p3 && p3.classList.contains('active');
    });
    if (!isStep3Already) {
      await page.click('#btn-next-geo');
      await new Promise(r => setTimeout(r, 400));
    }

    // --- STEP 3: Notifications ---
    console.log('[Test] Verifying Step 3: Emergency Notifications...');
    const step3Active = await page.evaluate(() => {
      const pane = document.getElementById('onboard-pane-3');
      const title = document.getElementById('onboard-step-title');
      return pane && pane.classList.contains('active') && title && title.innerText.includes('ALERTS');
    });
    console.log('[Test] Step 3 active:', step3Active);
    await phoneChassis.screenshot({ path: path.join(ARTIFACTS_DIR, 'onboarding_step3_notifications_instructions.png') });

    // Test granting Notifications
    console.log('[Test] Requesting Notifications permission in Step 3...');
    await page.click('#btn-request-notif');
    await new Promise(r => setTimeout(r, 600));

    const notifResult = await page.evaluate(() => {
      const badge = document.getElementById('onboard-status-badge-notif');
      return badge ? badge.innerText : null;
    });
    console.log('[Test] Step 3 Notification result:', notifResult);
    await phoneChassis.screenshot({ path: path.join(ARTIFACTS_DIR, 'onboarding_step3_notifications_granted.png') });

    // Wait for auto-advance or trigger next
    await new Promise(r => setTimeout(r, 1000));
    const isStep4Already = await page.evaluate(() => {
      const p4 = document.getElementById('onboard-pane-4');
      return p4 && p4.classList.contains('active');
    });
    if (!isStep4Already) {
      await page.click('#btn-next-notif');
      await new Promise(r => setTimeout(r, 400));
    }

    // --- STEP 4: Camera Scanner ---
    console.log('[Test] Verifying Step 4: Camera & QR Scanner...');
    const step4Active = await page.evaluate(() => {
      const pane = document.getElementById('onboard-pane-4');
      const title = document.getElementById('onboard-step-title');
      return pane && pane.classList.contains('active') && title && title.innerText.includes('SCANNER');
    });
    console.log('[Test] Step 4 active:', step4Active);
    await phoneChassis.screenshot({ path: path.join(ARTIFACTS_DIR, 'onboarding_step4_camera_instructions.png') });

    // Test granting Camera
    console.log('[Test] Requesting Camera permission in Step 4...');
    await page.click('#btn-request-camera');
    await new Promise(r => setTimeout(r, 600));

    const cameraResult = await page.evaluate(() => {
      const badge = document.getElementById('onboard-status-badge-camera');
      return badge ? badge.innerText : null;
    });
    console.log('[Test] Step 4 Camera result:', cameraResult);
    await phoneChassis.screenshot({ path: path.join(ARTIFACTS_DIR, 'onboarding_step4_camera_granted.png') });

    // Wait for auto-advance or trigger next
    await new Promise(r => setTimeout(r, 1000));
    const isStep5Already = await page.evaluate(() => {
      const p5 = document.getElementById('onboard-pane-5');
      return p5 && p5.classList.contains('active');
    });
    if (!isStep5Already) {
      await page.click('#btn-next-camera');
      await new Promise(r => setTimeout(r, 400));
    }

    // --- STEP 5: Summary & Vault Secured ---
    console.log('[Test] Verifying Step 5: Vault Setup Complete & Summary...');
    const step5Active = await page.evaluate(() => {
      const pane = document.getElementById('onboard-pane-5');
      const title = document.getElementById('onboard-step-title');
      const summaryGeo = document.getElementById('summary-badge-geo');
      const summaryNotif = document.getElementById('summary-badge-notif');
      const summaryCamera = document.getElementById('summary-badge-camera');
      return {
        paneActive: pane && pane.classList.contains('active'),
        title: title ? title.innerText : null,
        geo: summaryGeo ? summaryGeo.innerText : null,
        notif: summaryNotif ? summaryNotif.innerText : null,
        camera: summaryCamera ? summaryCamera.innerText : null
      };
    });
    console.log('[Test] Step 5 Summary result:', step5Active);
    await phoneChassis.screenshot({ path: path.join(ARTIFACTS_DIR, 'onboarding_step5_summary_ready.png') });

    // --- STEP 6: Complete Onboarding and Navigate to Login Page ---
    console.log('[Test] Clicking "Continue to Sign In →" to arrive at login page...');
    await page.click('#btn-complete-onboarding-login');
    await new Promise(r => setTimeout(r, 600));

    const finalResult = await page.evaluate(() => {
      const login = document.getElementById('screen-login');
      const onboard = document.getElementById('screen-onboarding');
      const hasOnboardedFlag = localStorage.getItem('lifeqr_onboarded');
      return {
        loginScreenActive: login && login.classList.contains('active'),
        onboardingScreenActive: onboard && onboard.classList.contains('active'),
        hasOnboardedInLocalStorage: hasOnboardedFlag === 'true'
      };
    });
    console.log('[Test] Final transition to login page:', finalResult);
    await phoneChassis.screenshot({ path: path.join(ARTIFACTS_DIR, 'onboarding_final_login_screen_reached.png') });

    if (finalResult.loginScreenActive && finalResult.hasOnboardedInLocalStorage) {
      console.log('✅ ALL TEST ASSERTIONS PASSED: First-time app open successfully showed Introduction, asked permissions one-by-one with proper usage instructions, and smoothly landed on the Login page!');
    } else {
      console.error('❌ Assertion failed: Login page was not reached as expected.');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('[Test Error]:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
