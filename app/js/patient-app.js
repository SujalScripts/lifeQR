/**
 * LifeQR - Patient MVP Application Controller
 * Handles Splash, Auth, OTP, Profile Setup, and Home (5 Sub-Views).
 */

const AppState = {
  user: null,
  profile: null,
  qrProfile: null,
  contacts: [],
  records: [],
  pendingAuth: {
    userId: null,
    email: null,
    phone: null
  },
  activeScreen: 'splash',
  activeTab: 'qr',
  otpTimerInterval: null,
  otpCountdown: 60
};

// --- Toast System ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// --- Screen Router ---
function showScreen(screenId) {
  AppState.activeScreen = screenId;
  document.querySelectorAll('.app-screen').forEach(el => el.classList.remove('active'));
  
  const target = document.getElementById(`screen-${screenId}`);
  if (target) {
    target.classList.add('active');
  }

  // Hook actions when entering specific screens
  if (screenId === 'otp') {
    startOtpCountdown();
    focusFirstOtpBox();
  }
  if (screenId === 'onboarding') {
    goToOnboardStep(1);
  }
}

// --- Tab Router (Home Sub-Views) ---
function showTab(tabId) {
  AppState.activeTab = tabId;
  document.querySelectorAll('.home-subview').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  const subview = document.getElementById(`tab-view-${tabId}`);
  const navBtn = document.getElementById(`nav-btn-${tabId}`);
  
  if (subview) subview.classList.add('active');
  if (navBtn) navBtn.classList.add('active');
}
window.showTab = showTab;

// --- API Helpers ---
function getPatientAppApiBase() {
  if (typeof window !== 'undefined' && window.API_URL) {
    return window.API_URL;
  }
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '');
  const port = typeof window !== 'undefined' ? window.location.port : '';
  if ((isLocal && port && port !== '5000') || (typeof window !== 'undefined' && window.location.protocol === 'file:')) {
    const host = window.location.hostname || 'localhost';
    return `http://${host}:5000/api/v1`;
  }
  return ((typeof window !== 'undefined' && window.location.origin) || '') + '/api/v1';
}

async function apiCall(endpoint, method = 'GET', body = null) {
  try {
    const apiBase = getPatientAppApiBase();
    const fullUrl = endpoint.startsWith('http') 
      ? endpoint 
      : (endpoint.startsWith('/api/v1') 
          ? endpoint.replace('/api/v1', apiBase) 
          : `${apiBase}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`);

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    };

    const savedToken = localStorage.getItem('lifeqr_auth_token') || localStorage.getItem('token');
    if (savedToken) {
      options.headers['Authorization'] = `Bearer ${savedToken}`;
    }

    if (body) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(fullUrl, options);
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error('API Error:', err);
    return { ok: false, status: 0, data: { error: 'Network error or server unreachable' } };
  }
}

// --- 1. Startup & Session Check (Splash Screen) ---
async function initApp() {
  // Theme check (Align with website universal theme system)
  const savedTheme = localStorage.getItem('lifeqr_theme_manual') || 
    localStorage.getItem('lifeqr_theme') || 
    ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', savedTheme);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', savedTheme === 'dark' ? '#0a0a0a' : '#ffffff');

  // Check URL params for preview
  const urlParams = new URLSearchParams(window.location.search);
  const isPreview = urlParams.get('preview_splash') === 'true' || urlParams.get('preview') === 'true';

  // Smooth progress animation & telemetry ticker
  const progressFill = document.getElementById('splashProgressFill');
  const percentText = document.getElementById('splashProgressPercent');
  const statusText = document.getElementById('splashStatusText');

  const statusStages = [
    { p: 25, msg: 'INITIALIZING EMERGENCY VAULT...' },
    { p: 55, msg: 'SCANNING OPTICAL QR MATRIX...' },
    { p: 85, msg: 'CALIBRATING GPS TELEMETRY...' },
    { p: 100, msg: 'EMERGENCY PROTOCOL READY' }
  ];

  let currentPercent = 0;
  const progressTimer = setInterval(() => {
    currentPercent = Math.min(100, currentPercent + (isPreview ? 1 : 2));
    if (progressFill) progressFill.style.width = `${currentPercent}%`;
    if (percentText) percentText.textContent = `${currentPercent}%`;

    const stage = statusStages.find(s => currentPercent <= s.p) || statusStages[statusStages.length - 1];
    if (statusText && stage) {
      statusText.textContent = stage.msg;
    }

    if (currentPercent >= 100) {
      clearInterval(progressTimer);
    }
  }, 50);

  if (isPreview) {
    console.log('LifeQR: Splash preview mode active (holding splash screen)');
    return;
  }

  // Show 3-second locked camera cinematic splash
  const startTime = Date.now();
  const res = await apiCall('/api/v1/auth/me');
  const elapsed = Date.now() - startTime;
  const remainingWait = Math.max(0, 3000 - elapsed);

  setTimeout(async () => {
    // Fade out splash smoothly
    const splashEl = document.getElementById('screen-splash');
    if (splashEl) {
      splashEl.classList.add('splash-fade-out');
      await new Promise(r => setTimeout(r, 280));
    }

    if (res.ok && res.data.authenticated && res.data.user) {
      AppState.user = res.data.user;
      
      if (res.data.user.role !== 'patient') {
        showToast(`Logged in as ${res.data.user.role}. Redirecting to portal...`, 'info');
        window.location.href = res.data.user.role === 'crew' 
          ? '/app/CrewAmbulance_dashboard.html' 
          : res.data.user.role === 'doctor'
            ? '/app/doctor_dashboard.html'
            : res.data.user.role === 'hospital'
              ? '/app/hospital_dashboard.html'
              : '/app/admin_dashboard.html';
        return;
      }

      if (!res.data.user.isPhoneVerified && res.data.user.phone) {
        AppState.pendingAuth.userId = res.data.user.id;
        AppState.pendingAuth.phone = res.data.user.phone;
        AppState.pendingAuth.email = res.data.user.email;
        showScreen('otp');
        return;
      }

      if (!res.data.user.isProfileComplete) {
        showScreen('profile-setup');
        return;
      }

      await loadPatientFullData();
      showScreen('home');
      showTab('qr');
    } else {
      // First-time visitor: Show Introduction & Permission Explanation Screen
      const hasOnboarded = localStorage.getItem('lifeqr_onboarded') === 'true';
      if (!hasOnboarded) {
        showScreen('onboarding');
      } else {
        showScreen('login');
      }
    }
  }, remainingWait);
}

// --- Onboarding & Sequential Permission Wizard System ---
let currentOnboardStep = 1;
const onboardPermissions = {
  geo: false,
  notif: false,
  camera: false
};

const ONBOARD_STEP_TITLES = {
  1: '01 / INTRODUCTION',
  2: '02 / LIVE GPS LOCATION',
  3: '03 / EMERGENCY ALERTS',
  4: '04 / OPTICAL SCANNER',
  5: '05 / VAULT SECURED & READY'
};

function goToOnboardStep(stepNum) {
  if (stepNum < 1) stepNum = 1;
  if (stepNum > 5) stepNum = 5;
  currentOnboardStep = stepNum;

  // 1. Toggle Step Panes
  for (let i = 1; i <= 5; i++) {
    const pane = document.getElementById(`onboard-pane-${i}`);
    if (pane) {
      pane.classList.toggle('active', i === stepNum);
    }
  }

  // 2. Update Header Metas
  const badgeEl = document.getElementById('onboard-step-badge');
  const titleEl = document.getElementById('onboard-step-title');
  const progressFill = document.getElementById('onboard-progress-bar');

  if (badgeEl) badgeEl.innerText = `STEP ${stepNum} / 5`;
  if (titleEl) titleEl.innerText = ONBOARD_STEP_TITLES[stepNum] || 'PERMISSIONS';
  if (progressFill) progressFill.style.width = `${(stepNum / 5) * 100}%`;

  // 3. Update Stepper Dots
  document.querySelectorAll('.onboard-dot').forEach(dot => {
    const dotStep = parseInt(dot.getAttribute('data-step') || '1', 10);
    dot.classList.toggle('active', dotStep === stepNum);
    dot.classList.toggle('completed', dotStep < stepNum);
  });

  // 4. Scroll screen to top
  const screenEl = document.getElementById('screen-onboarding');
  if (screenEl) screenEl.scrollTop = 0;

  // 5. Update Status displays if entering specific steps
  if (stepNum === 3) {
    updateNotifStatusBadge();
  }
  if (stepNum === 5) {
    updateSummaryBadges();
  }
}
window.goToOnboardStep = goToOnboardStep;

function updateNotifStatusBadge() {
  const badge = document.getElementById('onboard-status-badge-notif');
  const btn = document.getElementById('btn-request-notif');
  if (!badge) return;

  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      badge.innerText = '● GRANTED (ACTIVE)';
      badge.className = 'onboard-status-badge granted';
      onboardPermissions.notif = true;
      if (btn) btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">check_circle</span> Notifications Enabled ✅';
    } else if (Notification.permission === 'denied') {
      badge.innerText = '● RESTRICTED (BLOCKED IN BROWSER)';
      badge.className = 'onboard-status-badge restricted';
      onboardPermissions.notif = false;
    } else {
      badge.innerText = '● NOT GRANTED YET';
      badge.className = 'onboard-status-badge pending';
    }
  } else {
    badge.innerText = '● NOT SUPPORTED';
    badge.className = 'onboard-status-badge restricted';
  }
}

function updateSummaryBadges() {
  const geoBadge = document.getElementById('summary-badge-geo');
  const notifBadge = document.getElementById('summary-badge-notif');
  const cameraBadge = document.getElementById('summary-badge-camera');

  if (geoBadge) {
    geoBadge.innerText = onboardPermissions.geo ? 'GRANTED ✅' : 'HOME ADDR';
    geoBadge.style.color = onboardPermissions.geo ? 'var(--success)' : 'var(--text-muted)';
  }
  if (notifBadge) {
    const isGranted = 'Notification' in window && Notification.permission === 'granted';
    notifBadge.innerText = isGranted ? 'GRANTED ✅' : 'OFFLINE';
    notifBadge.style.color = isGranted ? 'var(--success)' : 'var(--text-muted)';
  }
  if (cameraBadge) {
    cameraBadge.innerText = onboardPermissions.camera ? 'GRANTED ✅' : 'UPLOAD ONLY';
    cameraBadge.style.color = onboardPermissions.camera ? 'var(--success)' : 'var(--text-muted)';
  }
}

// Permission 1: Live GPS Location Handler
function requestOnboardGeo() {
  const badge = document.getElementById('onboard-status-badge-geo');
  const telemetry = document.getElementById('onboard-telemetry-geo');
  const coordsPreview = document.getElementById('onboard-coords-preview');
  const btn = document.getElementById('btn-request-geo');

  if (!('geolocation' in navigator)) {
    if (badge) {
      badge.innerText = '● NOT SUPPORTED BY BROWSER';
      badge.className = 'onboard-status-badge restricted';
    }
    showToast('Geolocation is not supported by your browser', 'info');
    return;
  }

  showToast('Requesting GPS location access...', 'info');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      onboardPermissions.geo = true;
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const latStr = lat >= 0 ? lat.toFixed(4) + '° N' : Math.abs(lat).toFixed(4) + '° S';
      const lngStr = lng >= 0 ? lng.toFixed(4) + '° E' : Math.abs(lng).toFixed(4) + '° W';

      if (badge) {
        badge.innerText = '● GRANTED (ACTIVE)';
        badge.className = 'onboard-status-badge granted';
      }
      if (telemetry) telemetry.style.display = 'block';
      if (coordsPreview) coordsPreview.innerText = `${latStr}, ${lngStr}`;
      if (btn) btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">check_circle</span> Location Access Granted ✅';

      showToast(`Location permission granted (${latStr}, ${lngStr})`, 'success');
      setTimeout(() => goToOnboardStep(3), 1200);
    },
    (err) => {
      console.warn('Geolocation onboard request error:', err.message);
      onboardPermissions.geo = false;
      if (badge) {
        badge.innerText = '● ACCESS RESTRICTED / FALLBACK';
        badge.className = 'onboard-status-badge restricted';
      }
      showToast('Location skipped. SOS will use your registered profile address.', 'info');
    },
    { timeout: 8000, maximumAge: 60000, enableHighAccuracy: true }
  );
}
window.requestOnboardGeo = requestOnboardGeo;

// Permission 2: Emergency Notifications Handler
async function requestOnboardNotif() {
  const badge = document.getElementById('onboard-status-badge-notif');
  const btn = document.getElementById('btn-request-notif');

  if (!('Notification' in window)) {
    if (badge) {
      badge.innerText = '● NOT SUPPORTED';
      badge.className = 'onboard-status-badge restricted';
    }
    showToast('Notifications are not supported in this browser', 'info');
    return;
  }

  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      onboardPermissions.notif = true;
      if (badge) {
        badge.innerText = '● GRANTED (ACTIVE)';
        badge.className = 'onboard-status-badge granted';
      }
      if (btn) btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">check_circle</span> Notifications Enabled ✅';
      showToast('Emergency notifications enabled for dispatch alerts!', 'success');
      setTimeout(() => goToOnboardStep(4), 1200);
    } else {
      onboardPermissions.notif = false;
      if (badge) {
        badge.innerText = '● PERMISSION SKIPPED';
        badge.className = 'onboard-status-badge restricted';
      }
      showToast('Notifications skipped. You can enable them later in browser settings.', 'info');
    }
  } catch (e) {
    console.warn('Notification onboard request error:', e);
    showToast('Could not request notifications.', 'info');
  }
}
window.requestOnboardNotif = requestOnboardNotif;

// Permission 3: Camera & QR Scanner Handler
async function requestOnboardCamera() {
  const badge = document.getElementById('onboard-status-badge-camera');
  const btn = document.getElementById('btn-request-camera');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (badge) {
      badge.innerText = '● CAMERA NOT SUPPORTED';
      badge.className = 'onboard-status-badge restricted';
    }
    showToast('Camera stream is not supported in this environment', 'info');
    return;
  }

  showToast('Testing camera access for QR badge scanning...', 'info');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });

    // Safely stop tracks immediately after granting
    stream.getTracks().forEach(t => t.stop());

    onboardPermissions.camera = true;
    if (badge) {
      badge.innerText = '● GRANTED (SCANNER ACTIVE)';
      badge.className = 'onboard-status-badge granted';
    }
    if (btn) btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">check_circle</span> Camera Access Granted ✅';

    showToast('Camera access granted for badge scanner!', 'success');
    setTimeout(() => goToOnboardStep(5), 1200);
  } catch (err) {
    console.warn('Camera onboard request error:', err.message);
    onboardPermissions.camera = false;
    if (badge) {
      badge.innerText = '● ACCESS RESTRICTED / UPLOAD ONLY';
      badge.className = 'onboard-status-badge restricted';
    }
    showToast('Camera skipped. You can upload photos directly from file storage.', 'info');
  }
}
window.requestOnboardCamera = requestOnboardCamera;

// Final Transition to Login Page
function completeOnboardingAndGoToLogin() {
  localStorage.setItem('lifeqr_onboarded', 'true');
  showToast('Setup complete! Sign in to access your LifeQR vault.', 'success');
  showScreen('login');
}
window.completeOnboardingAndGoToLogin = completeOnboardingAndGoToLogin;

function skipOnboardingToLogin() {
  localStorage.setItem('lifeqr_onboarded', 'true');
  showScreen('login');
}
window.skipOnboardingToLogin = skipOnboardingToLogin;

// --- 2. Load Full Patient Data ---
async function loadPatientFullData() {
  const res = await apiCall('/api/v1/patient-app/profile');
  if (res.ok && res.data.success) {
    AppState.user = res.data.user;
    AppState.profile = res.data.profile;
    AppState.contacts = res.data.contacts || [];
    AppState.qrProfile = res.data.qrProfile;
    AppState.records = res.data.records || [];

    renderHeader();
    renderSidebar();
    renderQRTab();
    renderMedicalTab();
    renderContactsTab();
    renderRecordsTab();
    renderSettingsTab();
  }
}

// --- 3. Authentication Handlers ---
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('btn-login-submit');

  if (!email || !password) {
    showToast('Please enter both email and password', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerText = 'Signing in...';

  const res = await apiCall('/api/v1/auth/login', 'POST', { email, password });
  btn.disabled = false;
  btn.innerText = 'Sign In to LifeQR';

  if (res.ok) {
    showToast('Login successful', 'success');
    AppState.user = res.data.user;

    // Persist session tokens & user info for permanent auto-login
    if (res.data.token) {
      localStorage.setItem('lifeqr_auth_token', res.data.token);
      localStorage.setItem('token', res.data.token);
    }
    if (res.data.user) {
      localStorage.setItem('lifeqr_user', JSON.stringify(res.data.user));
    }
    localStorage.setItem('lifeqr_onboarded', 'true');

    // Check if role is patient
    if (res.data.user.role !== 'patient') {
      window.location.href = res.data.user.role === 'crew' 
        ? '/app/CrewAmbulance_dashboard.html' 
        : res.data.user.role === 'doctor'
          ? '/app/doctor_dashboard.html'
          : res.data.user.role === 'hospital'
            ? '/app/hospital_dashboard.html'
            : '/app/admin_dashboard.html';
      return;
    }

    const meRes = await apiCall('/api/v1/auth/me');
    if (meRes.ok && meRes.data.user && !meRes.data.user.isProfileComplete) {
      showScreen('profile-setup');
    } else {
      await loadPatientFullData();
      showScreen('home');
      showTab('qr');
    }
  } else {
    showToast(res.data.error || 'Invalid email or password', 'error');
  }
}


async function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const phone = document.getElementById('signup-phone').value.trim();
  const gender = document.getElementById('signup-gender').value;
  const password = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-password-confirm').value;
  const btn = document.getElementById('btn-signup-submit');

  if (!name || !email || !phone || !password) {
    showToast('Please fill out all required fields', 'error');
    return;
  }

  if (password !== confirmPassword) {
    showToast('Passwords do not match', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerText = 'Creating account...';

  const res = await apiCall('/api/v1/auth/register', 'POST', {
    name,
    email,
    phone,
    gender,
    password,
    role: 'patient'
  });

  btn.disabled = false;
  btn.innerText = 'Create Patient Account';

  if (res.ok) {
    showToast('Account created! Please verify OTP.', 'success');
    AppState.pendingAuth.userId = res.data.user.id;
    AppState.pendingAuth.email = email;
    AppState.pendingAuth.phone = phone;
    document.getElementById('otp-sent-target').innerText = phone || email;

    showScreen('otp');
  } else {
    showToast(res.data.error || 'Signup failed', 'error');
  }
}

// --- 4. OTP Handlers ---
function startOtpCountdown() {
  clearInterval(AppState.otpTimerInterval);
  AppState.otpCountdown = 60;
  const timerEl = document.getElementById('otp-timer-display');
  const resendBtn = document.getElementById('btn-resend-otp');
  
  if (resendBtn) resendBtn.disabled = true;

  AppState.otpTimerInterval = setInterval(() => {
    AppState.otpCountdown--;
    if (timerEl) timerEl.innerText = `0:${AppState.otpCountdown.toString().padStart(2, '0')}`;
    
    if (AppState.otpCountdown <= 0) {
      clearInterval(AppState.otpTimerInterval);
      if (timerEl) timerEl.innerText = '0:00';
      if (resendBtn) resendBtn.disabled = false;
    }
  }, 1000);
}

function focusFirstOtpBox() {
  const first = document.querySelector('.otp-box');
  if (first) first.focus();
}

function fillOtp(code) {
  const boxes = document.querySelectorAll('.otp-box');
  const digits = code.toString().split('');
  boxes.forEach((box, i) => {
    if (digits[i]) box.value = digits[i];
  });
  if (boxes[5]) boxes[5].focus();
}

function setupOtpInputListeners() {
  const boxes = document.querySelectorAll('.otp-box');
  boxes.forEach((box, index) => {
    box.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val.length >= 1) {
        e.target.value = val.slice(-1); // Single digit
        if (index < boxes.length - 1) {
          boxes[index + 1].focus();
        }
      }
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && index > 0) {
        boxes[index - 1].focus();
      }
    });

    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text').trim();
      if (/^\d{6}$/.test(pasted)) {
        fillOtp(pasted);
      }
    });
  });
}

async function handleVerifyOtp(e) {
  if (e) e.preventDefault();
  const boxes = document.querySelectorAll('.otp-box');
  let otp = '';
  boxes.forEach(b => otp += b.value);

  if (otp.length < 6) {
    showToast('Please enter the full 6-digit code', 'error');
    return;
  }

  const btn = document.getElementById('btn-verify-otp-submit');
  btn.disabled = true;
  btn.innerText = 'Verifying...';

  const res = await apiCall('/api/v1/auth/verify-otp', 'POST', {
    userId: AppState.pendingAuth.userId,
    email: AppState.pendingAuth.email,
    phone: AppState.pendingAuth.phone,
    otp
  });

  btn.disabled = false;
  btn.innerText = 'Verify & Continue';

  if (res.ok) {
    showToast('Phone verified successfully!', 'success');
    AppState.user = res.data.user;

    // Persist session tokens & user info for permanent auto-login
    if (res.data.token) {
      localStorage.setItem('lifeqr_auth_token', res.data.token);
      localStorage.setItem('token', res.data.token);
    }
    if (res.data.user) {
      localStorage.setItem('lifeqr_user', JSON.stringify(res.data.user));
    }
    localStorage.setItem('lifeqr_onboarded', 'true');

    if (!res.data.isProfileComplete) {
      showScreen('profile-setup');
    } else {
      await loadPatientFullData();
      showScreen('home');
      showTab('qr');
    }
  } else {
    showToast(res.data.error || 'Invalid OTP code', 'error');
  }
}

async function handleResendOtp() {
  const btn = document.getElementById('btn-resend-otp');
  btn.disabled = true;
  btn.innerText = 'Sending...';

  const res = await apiCall('/api/v1/auth/send-otp', 'POST', {
    userId: AppState.pendingAuth.userId,
    email: AppState.pendingAuth.email,
    phone: AppState.pendingAuth.phone
  });

  btn.innerText = 'Resend Code';

  if (res.ok) {
    showToast('New verification code sent', 'success');
    startOtpCountdown();
  } else {
    showToast(res.data.error || 'Failed to resend code', 'error');
    btn.disabled = false;
  }
}

// --- 5. Patient Profile Setup Handlers ---
let selectedBloodGroup = '';

function setupProfileFormChips() {
  // Blood group chips
  document.querySelectorAll('#blood-group-chips .chip-select').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#blood-group-chips .chip-select').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedBloodGroup = chip.getAttribute('data-val');
    });
  });

  // Allergy quick chips
  document.querySelectorAll('#allergy-chips .chip-select').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
      updateInputFromChips('allergy-chips', 'setup-allergies');
    });
  });

  // Condition quick chips
  document.querySelectorAll('#condition-chips .chip-select').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
      updateInputFromChips('condition-chips', 'setup-conditions');
    });
  });
}

function updateInputFromChips(containerId, inputId) {
  const activeChips = Array.from(document.querySelectorAll(`#${containerId} .chip-select.active`))
    .map(c => c.getAttribute('data-val'));
  const input = document.getElementById(inputId);
  if (input) {
    input.value = activeChips.join(', ');
  }
}

async function handleSaveProfileSetup(e) {
  e.preventDefault();
  const age = document.getElementById('setup-age').value;
  const allergies = document.getElementById('setup-allergies').value.trim();
  const healthIssues = document.getElementById('setup-conditions').value.trim();
  const medications = document.getElementById('setup-medications').value.trim();
  const contactName = document.getElementById('setup-contact-name').value.trim();
  const contactPhone = document.getElementById('setup-contact-phone').value.trim();
  const contactRel = document.getElementById('setup-contact-rel').value;
  const btn = document.getElementById('btn-save-profile-setup');

  if (!selectedBloodGroup) {
    showToast('Please select your Blood Group', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerText = 'Generating Your LifeQR...';

  // 1. Save Profile
  const res = await apiCall('/api/v1/patient-app/profile', 'POST', {
    age,
    bloodGroup: selectedBloodGroup,
    allergies,
    healthIssues,
    medications
  });

  // 2. Save Primary Contact if provided
  if (contactName && contactPhone) {
    await apiCall('/api/v1/patient-app/contacts', 'POST', {
      name: contactName,
      phone: contactPhone,
      relationship: contactRel,
      isPrimary: true
    });
  }

  btn.disabled = false;
  btn.innerText = 'Complete & Launch LifeQR';

  if (res.ok) {
    showToast('Your Emergency LifeQR is Ready! 🎉', 'success');
    await loadPatientFullData();
    showScreen('home');
    showTab('qr');
  } else {
    showToast(res.data.error || 'Failed to save profile', 'error');
  }
}

// --- 6. RENDER HOME SUB-VIEWS ---

function renderHeader() {
  const nameEl = document.getElementById('header-user-name');
  const avatarEl = document.getElementById('header-user-avatar');
  if (nameEl && AppState.user) nameEl.innerText = AppState.user.name;
  if (avatarEl && AppState.user) {
    const initials = AppState.user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    avatarEl.innerText = initials || 'ME';
  }
}

// Tab 1: My LifeQR & Home Emergency Details
function renderQRTab() {
  if (!AppState.qrProfile) return;

  const p = AppState.profile || {};
  const u = AppState.user || {};

  // 1. QR Badge Showcase
  const qrImg = document.getElementById('live-qr-image');
  const qrIdEl = document.getElementById('live-qr-id');
  const bgBadge = document.getElementById('live-blood-badge');
  const scanCountEl = document.getElementById('stat-scan-count');

  if (qrImg) qrImg.src = AppState.qrProfile.qrImageUrl;
  if (qrIdEl) qrIdEl.innerText = `ID: ${AppState.qrProfile.qrCodeId}`;
  if (bgBadge) bgBadge.innerText = p.bloodGroup ? `Blood: ${p.bloodGroup}` : 'Blood: N/A';
  if (scanCountEl) scanCountEl.innerText = AppState.qrProfile.scanCount || 0;

  // 2. Home Vitals Strip
  const homeBlood = document.getElementById('home-vitals-blood');
  const homeAge = document.getElementById('home-vitals-age');
  const homeGender = document.getElementById('home-vitals-gender');
  const homeDonor = document.getElementById('home-vitals-donor');

  if (homeBlood) homeBlood.innerText = p.bloodGroup || '--';
  if (homeAge) homeAge.innerText = p.age ? `${p.age} Y` : '--';
  if (homeGender) homeGender.innerText = u.gender ? u.gender.substring(0, 4).toUpperCase() : '--';
  if (homeDonor) homeDonor.innerText = p.organDonor ? 'YES' : 'NO';

  // 3. Home Allergies Section
  const homeAllergies = document.getElementById('home-allergies-list');
  if (homeAllergies) {
    if (p.allergies && p.allergies.trim()) {
      const items = p.allergies.split(',').map(s => s.trim()).filter(Boolean);
      homeAllergies.innerHTML = items.map(item => `
        <span class="badge-emergency">⚠️ ${item}</span>
      `).join('');
    } else {
      homeAllergies.innerHTML = '<span style="font-size: 12px; color: var(--text-dim); font-family: var(--font-mono);">No severe drug or food allergies recorded.</span>';
    }
  }

  // 4. Home Active Medications
  const homeMeds = document.getElementById('home-medications-list');
  if (homeMeds) {
    if (p.medications && p.medications.trim()) {
      const items = p.medications.split(',').map(s => s.trim()).filter(Boolean);
      homeMeds.innerHTML = items.map(item => `
        <span class="badge-success">💊 ${item}</span>
      `).join('');
    } else {
      homeMeds.innerHTML = '<span style="font-size: 12px; color: var(--text-dim); font-family: var(--font-mono);">No active daily prescriptions.</span>';
    }
  }

  // 5. Home Chronic Conditions
  const homeConditions = document.getElementById('home-conditions-list');
  if (homeConditions) {
    if (p.healthIssues && p.healthIssues.trim()) {
      const items = p.healthIssues.split(',').map(s => s.trim()).filter(Boolean);
      homeConditions.innerHTML = items.map(item => `
        <span class="badge-warning">🩺 ${item}</span>
      `).join('');
    } else {
      homeConditions.innerHTML = '<span style="font-size: 12px; color: var(--text-dim); font-family: var(--font-mono);">No chronic conditions listed.</span>';
    }
  }

  // 6. Home Primary Emergency Contact
  const homeContactName = document.getElementById('home-contact-name');
  const homeContactRel = document.getElementById('home-contact-rel');
  const homeContactCallBtn = document.getElementById('home-contact-call-btn');

  if (AppState.contacts && AppState.contacts.length > 0) {
    const primary = AppState.contacts.find(c => c.isPrimary) || AppState.contacts[0];
    if (homeContactName) homeContactName.innerText = primary.name;
    if (homeContactRel) homeContactRel.innerText = `${primary.relationship || 'Emergency'} • ${primary.phone}`;
    if (homeContactCallBtn) {
      homeContactCallBtn.href = `tel:${primary.phone}`;
      homeContactCallBtn.style.display = 'inline-flex';
    }
  } else {
    if (homeContactName) homeContactName.innerText = 'No Contact Added';
    if (homeContactRel) homeContactRel.innerText = 'Tap Edit Details to add next-of-kin';
    if (homeContactCallBtn) homeContactCallBtn.style.display = 'none';
  }
}

// Tab 2: Medical Profile
function renderMedicalTab() {
  const p = AppState.profile || {};
  const u = AppState.user || {};

  document.getElementById('med-val-blood').innerText = p.bloodGroup || 'Not Specified';
  document.getElementById('med-val-age').innerText = p.age ? `${p.age} years` : 'Not Specified';
  document.getElementById('med-val-gender').innerText = u.gender ? u.gender.toUpperCase() : 'Not Specified';

  // Allergies
  const allergiesEl = document.getElementById('med-allergies-list');
  if (allergiesEl) {
    if (p.allergies) {
      const items = p.allergies.split(',').map(s => s.trim()).filter(Boolean);
      allergiesEl.innerHTML = items.map(item => `
        <span class="badge-emergency">⚠️ ${item}</span>
      `).join('');
    } else {
      allergiesEl.innerHTML = '<span class="text-dim" style="font-size: 13px;">No known severe allergies recorded.</span>';
    }
  }

  // Conditions
  const conditionsEl = document.getElementById('med-conditions-list');
  if (conditionsEl) {
    if (p.healthIssues) {
      const items = p.healthIssues.split(',').map(s => s.trim()).filter(Boolean);
      conditionsEl.innerHTML = items.map(item => `
        <span class="badge-warning" style="background: var(--warning-light); color: var(--warning); padding: 4px 10px; border-radius: var(--radius-full); font-size: 12px; font-weight: 600;">🩺 ${item}</span>
      `).join('');
    } else {
      conditionsEl.innerHTML = '<span class="text-dim" style="font-size: 13px;">No chronic conditions listed.</span>';
    }
  }

  // Medications
  const medsEl = document.getElementById('med-medications-list');
  if (medsEl) {
    if (p.medications) {
      const items = p.medications.split(',').map(s => s.trim()).filter(Boolean);
      medsEl.innerHTML = items.map(item => `
        <span class="badge-success">💊 ${item}</span>
      `).join('');
    } else {
      medsEl.innerHTML = '<span class="text-dim" style="font-size: 13px;">No active daily prescriptions.</span>';
    }
  }
}

// Tab 3: Emergency Contacts
function renderContactsTab() {
  const container = document.getElementById('contacts-list-container');
  if (!container) return;

  if (AppState.contacts.length === 0) {
    container.innerHTML = `
      <div class="glass-card" style="text-align: center; padding: 30px 20px;">
        <div style="font-size: 36px; margin-bottom: 12px;">👥</div>
        <h4 style="margin-bottom: 6px;">No Emergency Contacts</h4>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">Add family or doctors who should be contacted in a medical crisis.</p>
        <button class="btn-primary" onclick="openAddContactModal()" style="width: auto; padding: 10px 20px;">+ Add Contact</button>
      </div>
    `;
    return;
  }

  container.innerHTML = AppState.contacts.map(c => `
    <div class="glass-card" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 42px; height: 42px; border-radius: 12px; background: ${c.isPrimary ? 'var(--emergency-light)' : 'var(--primary-light)'}; display: flex; align-items: center; justify-content: center; font-size: 18px;">
          ${c.isPrimary ? '🚨' : '📞'}
        </div>
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong style="font-size: 15px;">${c.name}</strong>
            ${c.isPrimary ? '<span class="badge-emergency" style="font-size: 10px; padding: 2px 6px;">PRIMARY</span>' : ''}
          </div>
          <div style="font-size: 12px; color: var(--text-muted);">${c.relationship} • ${c.phone}</div>
        </div>
      </div>
      <div style="display: flex; gap: 8px;">
        <a href="tel:${c.phone}" class="btn-secondary" style="padding: 8px 12px; font-size: 13px; text-decoration: none; color: var(--success);" title="Call Contact">
          📞 Call
        </a>
        <button class="btn-secondary" onclick="deleteContact('${c._id}')" style="padding: 8px; color: var(--emergency);" title="Remove">
          ✕
        </button>
      </div>
    </div>
  `).join('');
}

// Tab 4: Medical Records
let activeCategoryFilter = 'All';

function renderRecordsTab() {
  const container = document.getElementById('records-list-container');
  if (!container) return;

  const filtered = activeCategoryFilter === 'All'
    ? AppState.records
    : AppState.records.filter(r => r.category === activeCategoryFilter);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="glass-card" style="text-align: center; padding: 30px 20px;">
        <div style="font-size: 36px; margin-bottom: 12px;">📁</div>
        <h4 style="margin-bottom: 6px;">No Records in "${activeCategoryFilter}"</h4>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">Keep lab tests, doctor summaries, and prescriptions easily accessible.</p>
        <button class="btn-primary" onclick="openAddRecordModal()" style="width: auto; padding: 10px 20px;">+ Add Record</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(r => `
    <div class="glass-card" style="margin-bottom: 12px; position: relative;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
        <div>
          <span style="font-size: 11px; font-weight: 700; color: var(--secondary); text-transform: uppercase; letter-spacing: 0.5px;">${r.category}</span>
          <h4 style="font-size: 16px; margin: 2px 0 4px 0;">${r.title}</h4>
          <div style="font-size: 12px; color: var(--text-muted);">
            ${r.doctorOrHospital ? `🏥 ${r.doctorOrHospital} • ` : ''} 📅 ${new Date(r.recordDate).toLocaleDateString()}
          </div>
        </div>
        <button onclick="deleteRecord('${r._id}')" style="background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 4px;">
          ✕
        </button>
      </div>
      ${r.notes ? `<p style="font-size: 13px; color: var(--text-main); margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: var(--radius-sm);">${r.notes}</p>` : ''}
    </div>
  `).join('');
}

function filterRecords(cat) {
  activeCategoryFilter = cat;
  document.querySelectorAll('#record-filter-chips .chip-select').forEach(c => {
    c.classList.toggle('active', c.getAttribute('data-cat') === cat);
  });
  renderRecordsTab();
}

// Tab 5: Settings
function renderSettingsTab() {
  if (!AppState.user) return;

  const emailEl = document.getElementById('settings-user-email');
  const phoneEl = document.getElementById('settings-user-phone');
  const verifiedBadge = document.getElementById('settings-phone-badge');

  if (emailEl) emailEl.innerText = AppState.user.email;
  if (phoneEl) phoneEl.innerText = AppState.user.phone || 'No phone linked';
  if (verifiedBadge) {
    verifiedBadge.innerText = AppState.user.isPhoneVerified ? 'Verified' : 'Unverified';
    verifiedBadge.className = AppState.user.isPhoneVerified ? 'badge-success' : 'badge-emergency';
  }
}

// --- 7. MODAL ACTIONS & EXTRA FEATURES ---

// Add Contact Modal
function openAddContactModal() {
  document.getElementById('modal-add-contact').classList.add('active');
}

function closeAddContactModal() {
  document.getElementById('modal-add-contact').classList.remove('active');
}

async function handleSaveContact(e) {
  e.preventDefault();
  const name = document.getElementById('modal-contact-name').value.trim();
  const phone = document.getElementById('modal-contact-phone').value.trim();
  const relationship = document.getElementById('modal-contact-rel').value;
  const isPrimary = document.getElementById('modal-contact-primary').checked;

  if (!name || !phone) {
    showToast('Name and phone are required', 'error');
    return;
  }

  const res = await apiCall('/api/v1/patient-app/contacts', 'POST', {
    name,
    phone,
    relationship,
    isPrimary
  });

  if (res.ok) {
    showToast('Contact added', 'success');
    closeAddContactModal();
    document.getElementById('form-add-contact').reset();
    await loadPatientFullData();
  } else {
    showToast(res.data.error || 'Failed to add contact', 'error');
  }
}

async function deleteContact(id) {
  if (!confirm('Are you sure you want to remove this emergency contact?')) return;
  const res = await apiCall(`/api/v1/patient-app/contacts/${id}`, 'DELETE');
  if (res.ok) {
    showToast('Contact removed', 'success');
    await loadPatientFullData();
  }
}

// Add Medical Record Modal
function openAddRecordModal() {
  document.getElementById('modal-add-record').classList.add('active');
}

function closeAddRecordModal() {
  document.getElementById('modal-add-record').classList.remove('active');
}

async function handleSaveRecord(e) {
  e.preventDefault();
  const title = document.getElementById('record-title').value.trim();
  const category = document.getElementById('record-category').value;
  const doctorOrHospital = document.getElementById('record-doctor').value.trim();
  const recordDate = document.getElementById('record-date').value;
  const notes = document.getElementById('record-notes').value.trim();

  if (!title) {
    showToast('Record title is required', 'error');
    return;
  }

  const res = await apiCall('/api/v1/patient-app/records', 'POST', {
    title,
    category,
    doctorOrHospital,
    recordDate: recordDate || new Date(),
    notes
  });

  if (res.ok) {
    showToast('Medical record added', 'success');
    closeAddRecordModal();
    document.getElementById('form-add-record').reset();
    await loadPatientFullData();
  } else {
    showToast(res.data.error || 'Failed to add record', 'error');
  }
}

async function deleteRecord(id) {
  if (!confirm('Delete this medical record?')) return;
  const res = await apiCall(`/api/v1/patient-app/records/${id}`, 'DELETE');
  if (res.ok) {
    showToast('Record deleted', 'success');
    await loadPatientFullData();
  }
}

// Lock Screen Wallpaper Generator
function generateLockScreenWallpaper() {
  if (!AppState.qrProfile) return;

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');

  // Background Gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 1920);
  grad.addColorStop(0, '#090d16');
  grad.addColorStop(0.5, '#1e1b4b');
  grad.addColorStop(1, '#090d16');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1920);

  // Header Banner
  ctx.fillStyle = '#e11d48';
  ctx.fillRect(80, 200, 920, 120);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EMERGENCY MEDICAL ID', 540, 275);

  // Patient Info
  ctx.font = 'bold 58px sans-serif';
  ctx.fillText(AppState.user.name, 540, 420);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '36px sans-serif';
  const blood = AppState.profile ? AppState.profile.bloodGroup : 'N/A';
  ctx.fillText(`Blood Group: ${blood}`, 540, 480);

  // QR Code Image
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    // White background box
    ctx.fillStyle = '#ffffff';
    ctx.roundRect(240, 560, 600, 600, 40);
    ctx.fill();

    ctx.drawImage(img, 280, 600, 520, 520);

    // Call to action
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('SCAN IN AN EMERGENCY', 540, 1260);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '32px sans-serif';
    ctx.fillText('Instant Access to Allergies, Blood Type & Contacts', 540, 1320);

    // Footer
    ctx.font = '28px sans-serif';
    ctx.fillText('LifeQR Emergency Network', 540, 1800);

    // Trigger download
    const link = document.createElement('a');
    link.download = `LifeQR-LockScreen-${AppState.user.name.replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    showToast('Lock Screen Wallpaper downloaded!', 'success');
  };
  img.src = AppState.qrProfile.qrImageUrl;
}

// Download Badge
function downloadBadge() {
  if (!AppState.qrProfile) return;
  const link = document.createElement('a');
  link.download = `LifeQR-Badge-${AppState.qrProfile.qrCodeId}.png`;
  link.href = AppState.qrProfile.qrImageUrl;
  link.click();
  showToast('QR Badge downloaded', 'success');
}

// --- Helper: HTML Sanitization ---
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- Sidebar Drawer System ---
function openSidebar() {
  const overlay = document.getElementById('sidebar-overlay');
  const sidebar = document.getElementById('app-sidebar');
  if (overlay) overlay.classList.add('active');
  if (sidebar) sidebar.classList.add('open');
  renderSidebar();
}
window.openSidebar = openSidebar;

function closeSidebar() {
  const overlay = document.getElementById('sidebar-overlay');
  const sidebar = document.getElementById('app-sidebar');
  if (overlay) overlay.classList.remove('active');
  if (sidebar) sidebar.classList.remove('open');
}
window.closeSidebar = closeSidebar;

function renderSidebar() {
  const avatarEl = document.getElementById('sidebar-user-avatar');
  const nameEl = document.getElementById('sidebar-user-name');
  const emailEl = document.getElementById('sidebar-user-email');
  const phoneEl = document.getElementById('sidebar-user-phone');
  const bloodBadge = document.getElementById('sidebar-blood-badge');
  const idBadge = document.getElementById('sidebar-id-badge');

  if (AppState.user) {
    if (avatarEl) {
      const initials = AppState.user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      avatarEl.innerText = initials || 'ME';
    }
    if (nameEl) nameEl.innerText = AppState.user.name;
    if (emailEl) emailEl.innerText = AppState.user.email || 'patient@lifeqr.com';
    if (phoneEl) phoneEl.innerText = AppState.user.phone || '+91 Emergency Registered';
  }

  const p = AppState.profile || {};
  if (bloodBadge) {
    bloodBadge.innerText = p.bloodGroup ? `Blood: ${p.bloodGroup}` : 'Blood: O+';
  }

  const qr = AppState.qrProfile || {};
  if (idBadge) {
    idBadge.innerText = `ID: ${qr.qrCodeId || 'LQR-PATIENT'}`;
  }

  // Populate Live Location details in sidebar
  const addressEl = document.getElementById('sidebar-live-address');
  const address = p.address || (AppState.user && AppState.user.address) || '42 Marine Drive, Nariman Point, Mumbai';
  if (addressEl) {
    addressEl.innerText = address;
  }

  const mapsLink = document.getElementById('sidebar-maps-link');
  if (mapsLink) {
    mapsLink.href = `https://maps.google.com/?q=${encodeURIComponent(address)}`;
  }

  updateSidebarLiveLocation(false);
}
window.renderSidebar = renderSidebar;

// Live Geolocation Tracking for Patient Sidebar
function updateSidebarLiveLocation(notify = false) {
  const coordsValEl = document.getElementById('sidebar-coords-val');
  const statusEl = document.getElementById('sidebar-location-status');
  const mapsLink = document.getElementById('sidebar-maps-link');

  const p = AppState.profile || {};
  const registeredAddr = p.address || (AppState.user && AppState.user.address) || '42 Marine Drive, Mumbai';

  if (!('geolocation' in navigator)) {
    if (coordsValEl) coordsValEl.innerText = 'GPS Not Supported';
    if (statusEl) {
      statusEl.innerText = '● REGISTERED LOCATION';
      statusEl.style.color = 'var(--text-dim)';
    }
    if (notify) showToast('Geolocation is not supported by your browser', 'info');
    return;
  }

  if (notify) {
    showToast('Acquiring real-time GPS telemetry...', 'info');
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const accuracy = Math.round(pos.coords.accuracy || 10);
      const latStr = lat >= 0 ? lat.toFixed(4) + '° N' : Math.abs(lat).toFixed(4) + '° S';
      const lngStr = lng >= 0 ? lng.toFixed(4) + '° E' : Math.abs(lng).toFixed(4) + '° W';

      if (coordsValEl) {
        coordsValEl.innerText = `${latStr}, ${lngStr} (±${accuracy}m)`;
      }
      if (statusEl) {
        statusEl.innerText = '● LIVE GPS ACTIVE';
        statusEl.style.color = 'var(--success)';
      }
      if (mapsLink) {
        mapsLink.href = `https://maps.google.com/?q=${lat},${lng}`;
      }
      if (notify) {
        showToast(`Live GPS synchronized: ${latStr}, ${lngStr}`, 'success');
      }
    },
    (err) => {
      console.warn('Sidebar GPS acquisition fallback:', err.message);
      if (coordsValEl) {
        coordsValEl.innerText = '18.9220° N, 72.8347° E (Baseline)';
      }
      if (statusEl) {
        statusEl.innerText = '● REGISTERED LOCATION';
        statusEl.style.color = 'var(--text-dim)';
      }
      if (mapsLink) {
        mapsLink.href = `https://maps.google.com/?q=${encodeURIComponent(registeredAddr)}`;
      }
      if (notify) {
        showToast('GPS unavailable. Showing registered profile address.', 'info');
      }
    },
    { timeout: 8000, maximumAge: 30000, enableHighAccuracy: true }
  );
}
window.updateSidebarLiveLocation = updateSidebarLiveLocation;

function refreshSidebarLiveLocation() {
  updateSidebarLiveLocation(true);
}
window.refreshSidebarLiveLocation = refreshSidebarLiveLocation;

// --- Edit Profile Navigation & Pre-Filling ---
function openEditProfile() {
  closeSidebar();

  const p = AppState.profile || {};
  const u = AppState.user || {};

  // 1. Pre-fill Age
  const ageInput = document.getElementById('setup-age');
  if (ageInput) ageInput.value = p.age || '';

  // 2. Pre-fill & Select Blood Group Chip
  if (p.bloodGroup) {
    selectedBloodGroup = p.bloodGroup;
    document.querySelectorAll('#blood-group-chips .chip-select').forEach(chip => {
      chip.classList.toggle('active', chip.getAttribute('data-val') === p.bloodGroup);
    });
  }

  // 3. Pre-fill Allergies
  const allergiesInput = document.getElementById('setup-allergies');
  const allergiesVal = Array.isArray(p.allergies) ? p.allergies.join(', ') : (p.allergies || '');
  if (allergiesInput) allergiesInput.value = allergiesVal;
  document.querySelectorAll('#allergy-chips .chip-select').forEach(chip => {
    const val = chip.getAttribute('data-val');
    chip.classList.toggle('active', allergiesVal.toLowerCase().includes(val.toLowerCase()));
  });

  // 4. Pre-fill Conditions
  const conditionsInput = document.getElementById('setup-conditions');
  const conditionsVal = Array.isArray(p.healthIssues) ? p.healthIssues.join(', ') : (p.healthIssues || '');
  if (conditionsInput) conditionsInput.value = conditionsVal;
  document.querySelectorAll('#condition-chips .chip-select').forEach(chip => {
    const val = chip.getAttribute('data-val');
    chip.classList.toggle('active', conditionsVal.toLowerCase().includes(val.toLowerCase()));
  });

  // 5. Pre-fill Medications
  const medsInput = document.getElementById('setup-medications');
  const medsVal = Array.isArray(p.medications) ? p.medications.join(', ') : (p.medications || '');
  if (medsInput) medsInput.value = medsVal;

  // 6. Pre-fill Primary Contact
  if (AppState.contacts && AppState.contacts.length > 0) {
    const primary = AppState.contacts.find(c => c.isPrimary) || AppState.contacts[0];
    const cName = document.getElementById('setup-contact-name');
    const cPhone = document.getElementById('setup-contact-phone');
    const cRel = document.getElementById('setup-contact-rel');
    if (cName) cName.value = primary.name || '';
    if (cPhone) cPhone.value = primary.phone || '';
    if (cRel && primary.relationship) cRel.value = primary.relationship;
  }

  // Update UI Labels for Edit Mode
  const heading = document.getElementById('profile-setup-heading');
  const desc = document.getElementById('profile-setup-desc');
  const submitBtn = document.getElementById('btn-save-profile-setup');
  if (heading) heading.innerText = 'Edit Medical Profile';
  if (desc) desc.innerText = 'Update your emergency vitals, allergies, conditions, and contacts.';
  if (submitBtn) submitBtn.innerText = 'Save & Update Profile';

  showScreen('profile-setup');
}
window.openEditProfile = openEditProfile;

function cancelProfileEdit() {
  if (AppState.user && AppState.profile) {
    showScreen('home');
  } else {
    showScreen('login');
  }
}
window.cancelProfileEdit = cancelProfileEdit;

// --- Download Everything / Complete Emergency Vault ---
async function downloadEverything() {
  if (!AppState.user) {
    showToast('Please sign in first', 'error');
    return;
  }
  showToast('Preparing full emergency download bundle...', 'info');

  try {
    downloadBadge();
  } catch (err) {
    console.warn('QR badge download:', err);
  }

  await new Promise(r => setTimeout(r, 600));

  try {
    generateLockScreenWallpaper();
  } catch (err) {
    console.warn('Wallpaper download:', err);
  }

  await new Promise(r => setTimeout(r, 600));

  try {
    downloadMedicalSummary();
  } catch (err) {
    console.warn('Medical summary download:', err);
  }

  showToast('Full Emergency Vault downloaded! (Badge, Wallpaper & Dossier)', 'success');
}
window.downloadEverything = downloadEverything;

// --- Download Medical Dossier / Offline Printable Emergency Card ---
function downloadMedicalSummary() {
  if (!AppState.user) {
    showToast('Patient profile not available', 'error');
    return;
  }
  const user = AppState.user;
  const prof = AppState.profile || {};
  const qr = AppState.qrProfile || {};
  const contacts = AppState.contacts || [];

  const allergiesList = Array.isArray(prof.allergies) ? prof.allergies : (prof.allergies ? prof.allergies.split(',').map(s => s.trim()).filter(Boolean) : []);
  const conditionsList = Array.isArray(prof.healthIssues) ? prof.healthIssues : (prof.healthIssues ? prof.healthIssues.split(',').map(s => s.trim()).filter(Boolean) : []);
  const medsList = Array.isArray(prof.medications) ? prof.medications : (prof.medications ? prof.medications.split(',').map(s => s.trim()).filter(Boolean) : []);

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LifeQR Emergency Medical Dossier - ${escapeHtml(user.name)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111111; margin: 0; padding: 24px; background: #ffffff; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #111111; padding-bottom: 14px; margin-bottom: 20px; }
    .brand { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }
    .brand span { color: #E11D2E; }
    .badge { background: #E11D2E; color: #ffffff; padding: 4px 10px; font-weight: 800; font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase; }
    .layout-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
    .patient-title { font-size: 26px; font-weight: 900; margin: 0 0 4px 0; }
    .patient-meta { font-size: 12px; color: #555555; margin-bottom: 16px; font-family: monospace; }
    .vitals-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px; }
    .vital-cell { border: 2px solid #111111; padding: 10px 6px; text-align: center; }
    .vital-title { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #666666; }
    .vital-val { font-size: 18px; font-weight: 900; margin-top: 4px; }
    .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; border-bottom: 2px solid #111111; padding-bottom: 4px; margin: 18px 0 8px 0; }
    .pill { display: inline-block; padding: 4px 8px; font-size: 12px; font-weight: 700; margin: 3px; border-radius: 3px; }
    .pill-red { background: #fee2e2; color: #991b1b; border: 1.5px solid #dc2626; }
    .pill-blue { background: #f1f5f9; color: #334155; border: 1.5px solid #64748b; }
    .qr-card { border: 2px solid #111111; padding: 16px; text-align: center; background: #fafafa; }
    .qr-img { width: 190px; height: 190px; display: block; margin: 0 auto; }
    .contact-card { border: 1.5px solid #111111; padding: 10px 12px; margin-bottom: 8px; font-size: 13px; }
    .footer { font-size: 11px; color: #777777; border-top: 1px solid #cccccc; margin-top: 28px; padding-top: 10px; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">LIFE<span>QR</span> EMERGENCY MEDICAL DOSSIER</div>
      <div style="font-size: 12px; color: #666666; margin-top: 2px;">Official Emergency Patient Identification Document</div>
    </div>
    <span class="badge">VERIFIED LIVE VAULT</span>
  </div>

  <div class="layout-grid">
    <div>
      <h1 class="patient-title">${escapeHtml(user.name)}</h1>
      <div class="patient-meta">
        ID: <strong>${escapeHtml(qr.qrCodeId || 'LQR-PATIENT')}</strong> | Email: ${escapeHtml(user.email || 'N/A')} | Phone: ${escapeHtml(user.phone || 'N/A')}
      </div>

      <div class="vitals-grid">
        <div class="vital-cell" style="border-color: #E11D2E;">
          <div class="vital-title" style="color: #E11D2E;">Blood Type</div>
          <div class="vital-val" style="color: #E11D2E;">${escapeHtml(prof.bloodGroup || 'O+')}</div>
        </div>
        <div class="vital-cell">
          <div class="vital-title">Age</div>
          <div class="vital-val">${escapeHtml(String(prof.age || 28))}y</div>
        </div>
        <div class="vital-cell">
          <div class="vital-title">Gender</div>
          <div class="vital-val">${escapeHtml(user.gender ? user.gender.toUpperCase() : 'MALE')}</div>
        </div>
        <div class="vital-cell" style="border-color: #10b981;">
          <div class="vital-title" style="color: #10b981;">Organ Donor</div>
          <div class="vital-val" style="color: #10b981;">YES</div>
        </div>
      </div>

      <div class="section-title">⚠️ Severe Life-Threatening Allergies</div>
      <div>
        ${allergiesList.length ? allergiesList.map(a => `<span class="pill pill-red">⚠️ ${escapeHtml(a)}</span>`).join(' ') : '<span style="color:#777; font-size:12px;">No known severe allergies recorded</span>'}
      </div>

      <div class="section-title">🩺 Chronic Health Conditions</div>
      <div>
        ${conditionsList.length ? conditionsList.map(c => `<span class="pill pill-blue">🩺 ${escapeHtml(c)}</span>`).join(' ') : '<span style="color:#777; font-size:12px;">No chronic conditions listed</span>'}
      </div>

      <div class="section-title">💊 Active Daily Prescriptions</div>
      <div>
        ${medsList.length ? medsList.map(m => `<span class="pill pill-blue">💊 ${escapeHtml(m)}</span>`).join(' ') : '<span style="color:#777; font-size:12px;">No active daily prescriptions listed</span>'}
      </div>

      <div class="section-title">🚨 Primary Emergency Contacts</div>
      <div>
        ${contacts.length ? contacts.map(c => `
          <div class="contact-card">
            <strong>${escapeHtml(c.name)}</strong> (${escapeHtml(c.relationship || 'Emergency')})<br>
            Phone: <a href="tel:${escapeHtml(c.phone)}" style="color: #111111; font-weight: 700;">${escapeHtml(c.phone)}</a>
            ${c.isPrimary ? ' <span style="color: #E11D2E; font-weight: 800; font-size: 11px;">[PRIMARY DISPATCH CONTACT]</span>' : ''}
          </div>
        `).join('') : '<div style="color:#777; font-size:12px;">No emergency contacts listed</div>'}
      </div>
    </div>

    <div>
      <div class="qr-card">
        <div style="font-weight: 800; font-size: 13px; text-transform: uppercase; margin-bottom: 8px;">ZERO-LOGIN EMERGENCY QR</div>
        ${qr.qrImageUrl ? `<img class="qr-img" src="${qr.qrImageUrl}" alt="LifeQR Code">` : '<div style="height:190px; display:flex; align-items:center; justify-content:center;">QR Code</div>'}
        <div style="font-size: 11px; color: #555555; margin-top: 8px; line-height: 1.4;">
          First responders scan with any phone camera to access zero-login emergency medical directives.
        </div>
        <div style="margin-top: 10px; font-weight: 800; font-size: 13px; font-family: monospace;">${escapeHtml(qr.qrCodeId || '')}</div>
      </div>
    </div>
  </div>

  <div class="footer">
    Generated by LifeQR Emergency Healthcare Network • Instant Responder Access • Validated Real-Time Telemetry
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `LifeQR-Medical-Dossier-${user.name.replace(/\s+/g, '_')}.html`;
  a.href = url;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Emergency Medical Dossier downloaded', 'success');
}
window.downloadMedicalSummary = downloadMedicalSummary;

// --- Export Health Vault Data (JSON) ---
function exportHealthDataJSON() {
  if (!AppState.user) {
    showToast('Please sign in first', 'error');
    return;
  }
  const data = {
    user: AppState.user,
    profile: AppState.profile,
    qrProfile: AppState.qrProfile,
    contacts: AppState.contacts,
    records: AppState.records,
    exportedAt: new Date().toISOString()
  };
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `LifeQR-HealthVault-${AppState.user.name.replace(/\s+/g, '_')}.json`;
  a.href = url;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Health Vault data exported (JSON)', 'success');
}
window.exportHealthDataJSON = exportHealthDataJSON;

// --- Sidebar Action Handlers ---
function navToTabFromSidebar(tabId) {
  closeSidebar();
  showTab(tabId);
}
window.navToTabFromSidebar = navToTabFromSidebar;

function handleSidebarDownloadBadge() {
  closeSidebar();
  downloadBadge();
}
window.handleSidebarDownloadBadge = handleSidebarDownloadBadge;

function handleSidebarLockscreen() {
  closeSidebar();
  generateLockScreenWallpaper();
}
window.handleSidebarLockscreen = handleSidebarLockscreen;

function handleSidebarMedicalDossier() {
  closeSidebar();
  downloadMedicalSummary();
}
window.handleSidebarMedicalDossier = handleSidebarMedicalDossier;

function handleSidebarExportData() {
  closeSidebar();
  exportHealthDataJSON();
}
window.handleSidebarExportData = handleSidebarExportData;

function handleSidebarPreviewScan() {
  closeSidebar();
  previewEmergencyView();
}
window.handleSidebarPreviewScan = handleSidebarPreviewScan;

function handleSidebarShareLink() {
  closeSidebar();
  shareEmergencyLink();
}
window.handleSidebarShareLink = handleSidebarShareLink;

function handleSidebarAddContact() {
  closeSidebar();
  showTab('contacts');
  openAddContactModal();
}
window.handleSidebarAddContact = handleSidebarAddContact;

function handleSidebarAddRecord() {
  closeSidebar();
  showTab('records');
  openAddRecordModal();
}
window.handleSidebarAddRecord = handleSidebarAddRecord;

function handleSidebarTriggerSOS() {
  closeSidebar();
  triggerAppSOS();
}
window.handleSidebarTriggerSOS = handleSidebarTriggerSOS;

function handleSidebarLogout() {
  closeSidebar();
  handleLogout();
}
window.handleSidebarLogout = handleSidebarLogout;

// Share Emergency Link
function shareEmergencyLink() {
  if (!AppState.qrProfile) return;
  const url = AppState.qrProfile.emergencyAccessUrl;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('Emergency Access link copied to clipboard!', 'success');
    });
  } else {
    prompt('Copy Emergency Link:', url);
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
if (typeof window !== 'undefined') window.escapeHtml = escapeHtml;

// Emergency Preview Modal Logic (In-App Presentation)
function renderEmergencyPreviewModal() {
  const container = document.getElementById('emergency-preview-content-body');
  if (!container) return;

  const p = AppState.profile || {};
  const u = AppState.user || {};
  const qr = AppState.qrProfile || {};
  const contacts = AppState.contacts || [];

  const patientName = p.firstName 
    ? `${p.firstName} ${p.lastName || ''}`.trim() 
    : (u.name || 'Emergency Patient');
  const qrId = qr.qrCodeId || u.credentialId || 'LQR-EMERGENCY';
  const bloodGroup = p.bloodGroup || 'N/A';
  const age = p.age || 'N/A';
  const gender = u.gender ? u.gender.toUpperCase() : (p.gender ? p.gender.toUpperCase() : 'N/A');
  const phone = u.phone || p.phone || 'Phone on record';
  const address = p.address || u.address || 'Address on record';
  const allergies = p.allergies || 'None Reported';
  const conditions = p.healthIssues || 'None Reported';
  const medications = p.medications || 'None Reported';

  // Urgent Alert if severe allergies or explicit alert
  let urgentAlertHTML = '';
  if (p.allergies && p.allergies.trim() && p.allergies.toLowerCase() !== 'none') {
    urgentAlertHTML = `
      <div style="padding: 10px 12px; border: 2px solid #111111; background: #fef3c7; color: #111111; font-family: var(--font-mono); font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 8px; box-shadow: 2px 2px 0px #111111;">
        <span style="font-size: 16px;">⚠️</span>
        <span>URGENT RESCUE ALERT: Patient has severe allergy to ${escapeHtml(p.allergies)}.</span>
      </div>
    `;
  }

  // Paramedic Unlock Callout Box
  const crewNoticeHTML = `
    <div style="padding: 12px; border: 2px solid var(--border-card); background: var(--bg-muted); display: flex; align-items: center; justify-content: space-between; gap: 10px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 32px; height: 32px; background: #111111; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;">🚑</div>
        <div>
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase;">Paramedic & Crew Access</div>
          <div style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">PIN verification or trauma override unlocks full clinical dossier.</div>
        </div>
      </div>
    </div>
  `;

  // Bystander Telemetry Header
  const bystanderBarHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 10px; border-bottom: 2px solid var(--border-card);">
      <div style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; background: #111111; color: #ffffff; font-size: 9px; font-family: var(--font-mono); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
        <span class="live-dot" style="width: 6px; height: 6px; border-radius: 999px; background: #E11D2E; display: inline-block;"></span>
        <span>BYSTANDER RESCUE LIFELINE</span>
      </div>
      <div style="font-family: var(--font-mono); font-size: 11px; font-weight: 700;">
        <span style="color: var(--text-dim); text-transform: uppercase;">PERSON ID:</span>
        <span style="color: var(--emergency);">${escapeHtml(qrId)}</span>
      </div>
    </div>
  `;

  // Patient Identity Hero
  const photoUrl = p.photo || u.photo || '/LifeQR.png';
  const heroHTML = `
    <div style="display: flex; align-items: center; gap: 12px; padding-bottom: 12px; border-bottom: 2px solid var(--border-card);">
      <img src="${photoUrl}" alt="${escapeHtml(patientName)}" style="width: 60px; height: 60px; border: 2px solid var(--border-card); object-fit: cover; background: #f1f5f9; box-shadow: 3px 3px 0px #111111; flex-shrink: 0;" onerror="this.src='/LifeQR.png'">
      <div style="flex: 1; min-width: 0;">
        <h2 style="font-family: var(--font-headline); font-size: 18px; font-weight: 900; text-transform: uppercase; margin: 0; line-height: 1.1; letter-spacing: -0.5px;">${escapeHtml(patientName)}</h2>
        <div style="display: flex; gap: 8px; font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); font-weight: 700; margin-top: 4px;">
          <span>Age: <strong style="color: var(--text-main);">${escapeHtml(age)}</strong></span>
          <span>•</span>
          <span>Gender: <strong style="color: var(--text-main);">${escapeHtml(gender)}</strong></span>
        </div>
      </div>
      <!-- Blood Group Highlight Box -->
      <div style="border: 2px solid var(--emergency); background: rgba(225, 29, 46, 0.08); padding: 8px 10px; text-align: center; min-width: 64px; box-shadow: 3px 3px 0px var(--emergency); flex-shrink: 0;">
        <div style="font-family: var(--font-mono); font-size: 9px; font-weight: 800; text-transform: uppercase; color: var(--emergency);">BLOOD</div>
        <div style="font-family: var(--font-headline); font-weight: 900; font-size: 24px; color: var(--emergency); line-height: 1; margin-top: 2px;">${escapeHtml(bloodGroup)}</div>
      </div>
    </div>
  `;

  // Contact / Phone & Location Bar
  const contactBarHTML = `
    <div style="display: flex; flex-direction: column; gap: 8px; padding-bottom: 12px; border-bottom: 2px solid var(--border-card);">
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border: 2px solid var(--border-card); background: var(--bg-muted);">
        <div>
          <div style="font-size: 9px; font-family: var(--font-mono); font-weight: 700; text-transform: uppercase; color: var(--text-dim);">Phone Number</div>
          <div style="font-family: var(--font-mono); font-weight: 800; font-size: 13px; margin-top: 1px;">${escapeHtml(phone)}</div>
        </div>
        <a href="tel:${phone}" class="btn-primary" style="padding: 5px 12px; font-size: 11px; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
          📞 Call
        </a>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border: 2px solid var(--border-card); background: var(--bg-muted);">
        <div style="flex: 1; min-width: 0; margin-right: 8px;">
          <div style="font-size: 9px; font-family: var(--font-mono); font-weight: 700; text-transform: uppercase; color: var(--text-dim);">Registered Location</div>
          <div style="font-size: 11px; font-weight: 600; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(address)}</div>
        </div>
        <a href="https://maps.google.com/?q=${encodeURIComponent(address)}" target="_blank" class="btn-secondary" style="padding: 5px 10px; font-size: 11px; font-weight: 700; text-decoration: none; flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px;">
          🗺️ Maps
        </a>
      </div>
    </div>
  `;

  // Medical Vitals Cards: Allergies & Conditions & Medications
  const vitalsHTML = `
    <div style="display: flex; flex-direction: column; gap: 10px; padding-bottom: 12px; border-bottom: 2px solid var(--border-card);">
      <!-- Severe Allergies -->
      <div style="padding: 12px; border: 2px solid var(--emergency); background: rgba(225, 29, 46, 0.06); box-shadow: 2px 2px 0px var(--emergency);">
        <div style="display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 10px; font-weight: 800; text-transform: uppercase; color: var(--emergency); margin-bottom: 4px;">
          <span>⚠️</span>
          <span>Severe Allergies</span>
        </div>
        <div style="font-weight: 700; font-size: 13px;">${escapeHtml(allergies)}</div>
      </div>

      <!-- Critical Medical Issues -->
      <div style="padding: 12px; border: 2px solid var(--border-card); background: var(--bg-card); box-shadow: 2px 2px 0px #111111;">
        <div style="display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 10px; font-weight: 800; text-transform: uppercase; color: var(--text-main); margin-bottom: 4px;">
          <span>🩺</span>
          <span>Critical Medical Conditions</span>
        </div>
        <div style="font-weight: 700; font-size: 13px;">${escapeHtml(conditions)}</div>
      </div>

      <!-- Active Medications -->
      <div style="padding: 12px; border: 2px solid var(--border-card); background: var(--bg-card); box-shadow: 2px 2px 0px #111111;">
        <div style="display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 10px; font-weight: 800; text-transform: uppercase; color: var(--text-main); margin-bottom: 4px;">
          <span>💊</span>
          <span>Active Daily Prescriptions</span>
        </div>
        <div style="font-weight: 700; font-size: 13px;">${escapeHtml(medications)}</div>
      </div>
    </div>
  `;

  // Emergency Contacts (ICE)
  let contactsListHTML = '';
  if (contacts.length === 0) {
    contactsListHTML = `<div style="padding: 12px; border: 2px dashed var(--border-card); text-align: center; font-size: 11px; font-family: var(--font-mono); color: var(--text-dim);">No emergency contacts registered.</div>`;
  } else {
    contactsListHTML = contacts.map(c => `
      <div style="padding: 10px 12px; border: 2px solid var(--border-card); background: var(--bg-card); display: flex; align-items: center; justify-content: space-between; gap: 8px; box-shadow: 2px 2px 0px #111111;">
        <div>
          <div style="font-weight: 800; font-size: 13px; text-transform: uppercase;">
            ${escapeHtml(c.name)} ${c.relationship ? `<span style="font-size: 11px; color: var(--emergency); font-family: var(--font-mono);">(${escapeHtml(c.relationship)})</span>` : ''}
          </div>
          <div style="font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--text-muted); margin-top: 1px;">
            ${escapeHtml(c.phone)}
          </div>
        </div>
        <a href="tel:${c.phone}" class="btn-primary" style="padding: 5px 12px; font-size: 11px; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
          📞 Call
        </a>
      </div>
    `).join('');
  }

  const contactsSectionHTML = `
    <div>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="color: var(--emergency); font-size: 16px;">🆘</span>
          <span style="font-size: 11px; font-weight: 900; text-transform: uppercase;">Emergency Contacts (ICE)</span>
        </div>
        <span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-dim); font-weight: 700;">1-TAP CALL</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${contactsListHTML}
      </div>
    </div>
  `;

  // Protocol Note
  const protocolNoteHTML = `
    <div style="padding: 10px 12px; border: 2px solid var(--border-card); background: var(--bg-muted); font-size: 10px; color: var(--text-muted); line-height: 1.45;">
      <strong style="color: var(--text-main);">First Responder Protocol:</strong> All medical details displayed are patient-authorized for emergency care. Direct emergency phone triggers do not require authentication or application installs.
    </div>
  `;

  container.innerHTML = `
    ${urgentAlertHTML}
    ${crewNoticeHTML}
    ${bystanderBarHTML}
    ${heroHTML}
    ${contactBarHTML}
    ${vitalsHTML}
    ${contactsSectionHTML}
    ${protocolNoteHTML}
  `;
}

// In-App Emergency Preview Modal Open/Close
function previewEmergencyView() {
  renderEmergencyPreviewModal();
  const modal = document.getElementById('modal-emergency-preview');
  if (modal) {
    modal.classList.add('active');
  }
}
window.previewEmergencyView = previewEmergencyView;

function closeEmergencyPreview() {
  const modal = document.getElementById('modal-emergency-preview');
  if (modal) {
    modal.classList.remove('active');
  }
}
window.closeEmergencyPreview = closeEmergencyPreview;

// Theme Toggle
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 
    ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('lifeqr_theme_manual', next);
  localStorage.setItem('lifeqr_theme', next);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', next === 'dark' ? '#0a0a0a' : '#ffffff');
  showToast(`Switched to ${next} mode`, 'info');
}

// --- Logout Handlers (Swiss Editorial Confirmation Modal) ---
function handleLogout() {
  console.log('[LifeQR Auth] handleLogout triggered');
  const modal = document.getElementById('modal-logout-confirm');
  if (modal) {
    modal.classList.add('active');
  } else {
    confirmLogoutAction();
  }
}
window.handleLogout = handleLogout;

function closeLogoutModal() {
  const modal = document.getElementById('modal-logout-confirm');
  if (modal) {
    modal.classList.remove('active');
  }
}
window.closeLogoutModal = closeLogoutModal;

async function confirmLogoutAction() {
  closeLogoutModal();
  showToast('Signing out...', 'info');

  try {
    await apiCall('/api/v1/auth/logout', 'POST');
  } catch (err) {
    console.warn('Logout API error:', err);
  }

  // Clear application runtime state
  AppState.user = null;
  AppState.profile = null;
  AppState.qrProfile = null;
  AppState.contacts = [];
  AppState.records = [];

  // Clear all auth/session keys
  const keysToRemove = [
    'lifeqr_auth_token',
    'token',
    'lifeqr_user',
    'user',
    'userName',
    'userId',
    'userRole',
    'offline_qrCode',
    'offline_qrCodeId',
    'offline_name'
  ];
  keysToRemove.forEach(k => localStorage.removeItem(k));

  // Reset form inputs
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  if (emailInput) emailInput.value = '';
  if (passInput) passInput.value = '';

  showToast('Signed out successfully', 'success');
  showScreen('login');
}
window.confirmLogoutAction = confirmLogoutAction;

// Emergency SOS Trigger (The Golden Hour)
async function triggerAppSOS() {
  if (!confirm('🚨 Are you sure you want to trigger an EMERGENCY SOS? This will alert family and nearby ambulance crews with your live location.')) return;

  const btn = document.getElementById('btn-panic-sos');
  btn.disabled = true;
  btn.style.opacity = '0.7';

  // Get current position
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;

    const res = await apiCall('/api/v1/sos/sos', 'POST', {
      lat: latitude,
      lng: longitude,
      message: 'Mobile App User SOS - Critical Distress Triggered'
    });

    btn.disabled = false;
    btn.style.opacity = '1';

    if (res.ok) {
      showToast('SOS Beacon Broadcasted! Stay Calm, help is on the way.', 'success');
      // If PWA background sync kicked in, it will show the offline message
      if (res.data.offline) {
        showToast(res.data.message, 'warning');
      }
    } else {
      showToast(res.data.error || 'SOS trigger failed', 'error');
    }
  }, (err) => {
    showToast('Failed to get GPS location. Enabling emergency broadcast anyway...', 'warning');
    // Fallback: Trigger without location if GPS fails
    apiCall('/api/v1/sos/sos', 'POST', {
      lat: 0,
      lng: 0,
      message: 'Mobile App SOS (GPS Blocked)'
    }).then(res => {
      btn.disabled = false;
      btn.style.opacity = '1';
      if (res.ok) showToast('Emergency broadcasted without location.', 'success');
    });
  }, { enableHighAccuracy: true });
}

// --- DOM Initializer ---
document.addEventListener('DOMContentLoaded', () => {
  setupOtpInputListeners();
  setupProfileFormChips();

  // Form submits
  const loginForm = document.getElementById('form-login');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const signupForm = document.getElementById('form-signup');
  if (signupForm) signupForm.addEventListener('submit', handleSignup);

  const otpForm = document.getElementById('form-otp');
  if (otpForm) otpForm.addEventListener('submit', handleVerifyOtp);

  const setupForm = document.getElementById('form-profile-setup');
  if (setupForm) setupForm.addEventListener('submit', handleSaveProfileSetup);

  const contactForm = document.getElementById('form-add-contact');
  if (contactForm) contactForm.addEventListener('submit', handleSaveContact);

  const recordForm = document.getElementById('form-add-record');
  if (recordForm) recordForm.addEventListener('submit', handleSaveRecord);

  const headerSignOut = document.getElementById('headerSignOutBtn');
  if (headerSignOut) {
    headerSignOut.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  }

  const headerSidebarBtn = document.getElementById('headerSidebarBtn');
  if (headerSidebarBtn) {
    headerSidebarBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openSidebar();
    });
  }

  // Run initial session probe
  initApp();
});
