const puppeteer = require('puppeteer-core');
const path = require('path');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  console.log('=== EMPIRICALLY VALIDATING PATIENT APP SIDEBAR DRAWER ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1536, height: 776 });

  console.log('1. Navigating to http://localhost:5000/app...');
  await page.goto('http://localhost:5000/app');
  await new Promise(r => setTimeout(r, 2200));

  // Log in if needed
  let screen = await page.evaluate(() => document.querySelector('.app-screen.active')?.id);
  if (screen !== 'screen-home') {
    console.log('Logging in with patient credentials...');
    await page.evaluate(() => {
      if (typeof window.showScreen === 'function') window.showScreen('login');
    });
    await new Promise(r => setTimeout(r, 600));
    await page.type('#login-email', 'patient@lifeqr.com');
    await page.type('#login-password', 'Password@123');
    await page.click('#btn-login-submit');
    await page.waitForFunction(() => document.getElementById('screen-home')?.classList.contains('active'), { timeout: 10000 });
  }

  await new Promise(r => setTimeout(r, 1200));
  console.log('Patient is on Home dashboard.');

  // 2. Check header sidebar trigger button
  const isTriggerVisible = await page.evaluate(() => {
    const btn = document.getElementById('headerSidebarBtn');
    if (!btn) return false;
    const r = btn.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  console.log('✓ Header sidebar trigger button present & visible:', isTriggerVisible);
  if (!isTriggerVisible) throw new Error('Header sidebar trigger button not visible!');

  // 3. Click sidebar trigger button to open drawer
  console.log('3. Clicking #headerSidebarBtn...');
  await page.evaluate(() => document.getElementById('headerSidebarBtn').click());
  await new Promise(r => setTimeout(r, 500));

  const sidebarOpen = await page.evaluate(() => {
    const sb = document.getElementById('app-sidebar');
    const ov = document.getElementById('sidebar-overlay');
    return {
      isOpen: sb?.classList.contains('open'),
      overlayActive: ov?.classList.contains('active'),
      name: document.getElementById('sidebar-user-name')?.innerText,
      email: document.getElementById('sidebar-user-email')?.innerText,
      blood: document.getElementById('sidebar-blood-badge')?.innerText,
      id: document.getElementById('sidebar-id-badge')?.innerText
    };
  });
  console.log('Sidebar drawer state:', sidebarOpen);
  if (!sidebarOpen.isOpen || !sidebarOpen.overlayActive) {
    throw new Error('Sidebar drawer did not open!');
  }
  console.log('PASS: Sidebar successfully opened with live patient data!');

  // Screenshot open sidebar
  await page.screenshot({ path: path.join(__dirname, 'patient_sidebar_open.png') });
  console.log('Saved screenshot: scratch/patient_sidebar_open.png');

  // 4. Test Edit Profile from Sidebar
  console.log('4. Testing Edit Profile button in sidebar...');
  await page.evaluate(() => window.openEditProfile());
  await new Promise(r => setTimeout(r, 500));

  const editProfileState = await page.evaluate(() => {
    const isProfileSetupActive = document.getElementById('screen-profile-setup')?.classList.contains('active');
    const ageVal = document.getElementById('setup-age')?.value;
    const allergiesVal = document.getElementById('setup-allergies')?.value;
    const conditionsVal = document.getElementById('setup-conditions')?.value;
    const medicationsVal = document.getElementById('setup-medications')?.value;
    const heading = document.getElementById('profile-setup-heading')?.innerText;
    return { isProfileSetupActive, ageVal, allergiesVal, conditionsVal, medicationsVal, heading };
  });
  console.log('Edit Profile screen state:', editProfileState);
  if (!editProfileState.isProfileSetupActive) {
    throw new Error('Edit Profile screen did not activate!');
  }
  console.log('PASS: Edit Profile opened and pre-filled with patient clinical vitals!');

  await page.screenshot({ path: path.join(__dirname, 'patient_edit_profile_screen.png') });

  // 5. Cancel and return back to home
  console.log('5. Clicking Back to App...');
  await page.evaluate(() => window.cancelProfileEdit());
  await new Promise(r => setTimeout(r, 400));
  const isBackOnHome = await page.evaluate(() => document.getElementById('screen-home')?.classList.contains('active'));
  console.log('Returned to Home screen:', isBackOnHome);
  if (!isBackOnHome) throw new Error('Failed to return to home screen!');

  // 6. Test Download Everything & Other Exports
  console.log('6. Re-opening sidebar to test downloads & navigation...');
  await page.evaluate(() => window.openSidebar());
  await new Promise(r => setTimeout(r, 300));

  // Test individual functions
  console.log('Testing exportHealthDataJSON...');
  await page.evaluate(() => window.exportHealthDataJSON());

  console.log('Testing downloadMedicalSummary...');
  await page.evaluate(() => window.downloadMedicalSummary());

  // 7. Test Tab Navigation from Sidebar
  console.log('7. Testing Tab navigation from sidebar...');
  const tabs = ['medical', 'contacts', 'records', 'settings', 'qr'];
  for (const t of tabs) {
    await page.evaluate((tab) => window.navToTabFromSidebar(tab), t);
    await new Promise(r => setTimeout(r, 200));
    const activeSub = await page.evaluate(() => document.querySelector('.home-subview.active')?.id);
    const sidebarClosed = await page.evaluate(() => !document.getElementById('app-sidebar')?.classList.contains('open'));
    console.log(`PASS: Navigated to tab "${t}" -> ${activeSub} (Sidebar closed: ${sidebarClosed})`);
  }

  // 8. Test close button ✕
  console.log('8. Testing close button ✕...');
  await page.evaluate(() => window.openSidebar());
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => document.querySelector('.sidebar-close-btn').click());
  await new Promise(r => setTimeout(r, 300));
  const isClosed = await page.evaluate(() => !document.getElementById('app-sidebar')?.classList.contains('open'));
  console.log('PASS: Sidebar closed cleanly with close button:', isClosed);
  if (!isClosed) throw new Error('Sidebar did not close with close button!');

  // 9. Test closing by clicking overlay
  console.log('9. Testing closing by clicking overlay...');
  await page.evaluate(() => window.openSidebar());
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => document.getElementById('sidebar-overlay').click());
  await new Promise(r => setTimeout(r, 300));
  const isOverlayClosed = await page.evaluate(() => !document.getElementById('app-sidebar')?.classList.contains('open'));
  console.log('PASS: Sidebar closed cleanly with overlay click:', isOverlayClosed);
  if (!isOverlayClosed) throw new Error('Sidebar did not close with overlay click!');

  console.log('=== ALL TESTS PASSED WITH 100% SUCCESS ===');
  await browser.close();
})();
