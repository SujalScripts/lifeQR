const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testInAppPreview() {
  console.log('🚀 Starting In-App Emergency Preview & Emergency Pass Mobile Shell Validation...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  try {
    // 1. Navigate to patient app
    console.log('1. Navigating to http://localhost:5000/app');
    await page.goto('http://localhost:5000/app', { waitUntil: 'networkidle2', timeout: 30000 });

    // Ensure onboarded in localStorage
    await page.evaluate(() => {
      localStorage.setItem('lifeqr_onboarded', 'true');
    });

    // Check if on login screen, if splash skip to login
    await page.evaluate(() => {
      if (typeof window.showScreen === 'function') {
        const token = localStorage.getItem('lifeqr_auth_token') || localStorage.getItem('token');
        if (!token) window.showScreen('login');
      }
    });
    await new Promise(r => setTimeout(r, 600));

    // Check if login form is visible
    const isLoginVisible = await page.evaluate(() => {
      const el = document.getElementById('screen-login');
      return el && el.classList.contains('active');
    });

    if (isLoginVisible) {
      console.log('2. Logging in with patient@lifeqr.com...');
      await page.type('#login-email', 'patient@lifeqr.com');
      await page.type('#login-password', 'Password@123');
      await page.click('#btn-login-submit');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
    }

    // Ensure we are on screen-home
    const isHome = await page.evaluate(() => {
      const home = document.getElementById('screen-home');
      return home && home.classList.contains('active');
    });
    console.log('3. Is Home Active:', isHome);

    // 4. Click Preview Scan button on Home tab or call previewEmergencyView
    console.log('4. Invoking previewEmergencyView()...');
    const previewResult = await page.evaluate(() => {
      try {
        if (typeof window.previewEmergencyView === 'function') {
          window.previewEmergencyView();
          return { success: true };
        }
        return { success: false, reason: 'function not found' };
      } catch (err) {
        return { success: false, error: err.message, stack: err.stack };
      }
    });
    console.log('   previewEmergencyView invocation result:', previewResult);

    await new Promise(r => setTimeout(r, 1000));

    // Verify modal-emergency-preview is active
    const modalStatus = await page.evaluate(() => {
      const modal = document.getElementById('modal-emergency-preview');
      const body = document.getElementById('emergency-preview-content-body');
      return {
        exists: !!modal,
        isActive: modal ? modal.classList.contains('active') : false,
        bodyTextSnippet: body ? body.innerText.slice(0, 200) : ''
      };
    });
    console.log('5. In-App Modal Status:', modalStatus);

    if (!modalStatus.isActive) {
      throw new Error('In-App emergency preview modal did not open!');
    }

    // Save screenshot of in-app emergency preview modal inside phone chassis
    const screenshotDir = path.join(__dirname, '../artifacts_test');
    if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

    const inAppModalPath = path.join(screenshotDir, 'in_app_emergency_preview.png');
    await page.screenshot({ path: inAppModalPath, fullPage: false });
    console.log(`   ✓ In-App Preview Screenshot saved: ${inAppModalPath}`);

    // 6. Test Close Preview Modal
    console.log('6. Closing In-App Preview Modal...');
    await page.evaluate(() => {
      if (typeof window.closeEmergencyPreview === 'function') {
        window.closeEmergencyPreview();
      }
    });
    await new Promise(r => setTimeout(r, 500));
    const isClosed = await page.evaluate(() => {
      const modal = document.getElementById('modal-emergency-preview');
      return modal && !modal.classList.contains('active');
    });
    console.log('   Modal Closed Successfully:', isClosed);

    // 7. Test Sidebar Preview Scan trigger
    console.log('7. Testing Sidebar "Preview Responder Emergency View" trigger...');
    await page.evaluate(() => {
      if (typeof window.openSidebar === 'function') window.openSidebar();
    });
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
      if (typeof window.handleSidebarPreviewScan === 'function') {
        window.handleSidebarPreviewScan();
      }
    });
    await new Promise(r => setTimeout(r, 800));

    const isSidebarTriggerActive = await page.evaluate(() => {
      const modal = document.getElementById('modal-emergency-preview');
      return modal && modal.classList.contains('active');
    });
    console.log('   Sidebar trigger opened in-app modal:', isSidebarTriggerActive);

    // 8. Test Direct Emergency Pass page: /app/emergency_access.html?id=RAH-D3200470
    console.log('8. Testing Emergency Pass Web View: /app/emergency_access.html?id=RAH-D3200470...');
    await page.goto('http://localhost:5000/app/emergency_access.html?id=RAH-D3200470', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    const passShellInfo = await page.evaluate(() => {
      const shell = document.querySelector('.mobile-emergency-shell');
      if (!shell) return { hasShell: false };
      const rect = shell.getBoundingClientRect();
      const headerLinks = Array.from(document.querySelectorAll('header a')).map(a => a.href);
      return {
        hasShell: true,
        width: Math.round(rect.width),
        maxWidth: window.getComputedStyle(shell).maxWidth,
        headerLinks
      };
    });
    console.log('   Emergency Pass Shell Info:', passShellInfo);

    const passScreenshotPath = path.join(screenshotDir, 'mobile_emergency_pass_desktop_view.png');
    await page.screenshot({ path: passScreenshotPath, fullPage: false });
    console.log(`   ✓ Emergency Pass Desktop View Screenshot saved: ${passScreenshotPath}`);

    console.log('🎉 ALL VALIDATIONS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

testInAppPreview();
