# Patterns — Approved Implementation Standards

## 🔐 1. Authentication & Cookie Pattern
- **Token Delivery**: JWT tokens are issued upon login and stored in `token` HTTP-only cookies (`res.cookie('token', jwtToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production' })`).
- **Middleware Check**: `authenticateToken` reads `req.cookies.token` or `Authorization: Bearer <token>`.
- **Auth Guard (Frontend)**: `js/auth-guard.js` exports `checkDashboardAccess(allowedRoles)` which fetches `/api/v1/patient/me` and redirects unauthorized roles to `lifeqr_login.html`.

## 🚨 2. Real-Time Socket.IO SOS Pattern
- **Server Broadcast**:
  ```javascript
  const io = req.app.get('io');
  if (io) {
    io.to('crew:all').emit('sos-alert', {
      sosId, patientId, name, bloodGroup, allergies, location: { lat, lng }, timestamp: new Date()
    });
  }
  ```
- **Client Listener**:
  ```javascript
  const socket = io({ withCredentials: true });
  socket.on('sos-alert', (data) => {
    showSosAlertPopup(data);
  });
  ```

## 📊 3. UI Data Model Fallback Pattern
To accommodate flat vs nested profile JSON outputs from REST endpoints:
```javascript
const name = activePatient.name || (activePatient.user && activePatient.user.name) || 'Emergency Patient';
const bloodGroup = activePatient.bloodGroup || (activePatient.profile && activePatient.profile.bloodGroup) || 'N/A';
const contacts = activePatient.emergencyContacts || (activePatient.profile && activePatient.profile.emergencyContacts) || [];
```

## 🛡️ 4. Security Audit Logging Pattern
Every security-sensitive operation (login, profile change, QR scan, SOS trigger) MUST invoke:
```javascript
const { logEvent } = require('../../services/securityLogger');
logEvent('EVENT_NAME', { userId: user._id, metadata });
```

## 🎨 5. App View vs Website View UI/UX Separation & Manual Theme Asset Copy (No Auto-Sync)
- **Distinct Form Factors & Interfaces**: `app/` is the dedicated mobile emergency app (phone chassis, bottom nav, mobile sidebar drawer, 1-tap mobile panic triggers), whereas `website/` is the public desktop presentation site and web portal.
- **Independent Layouts & Features**: Some features exist solely in `app/` and not in `website/` (or vice versa). HTML views and divergent logic scripts are NEVER automatically synced or overwritten.
- **Manual Theme & Token Copy Only**: `scripts/sync-frontend.js` only copies shared design tokens (`theme.css`, `styles.css`, `input.css`, `output.css`) and brand assets (`LifeQR.png`, `lifeqr_transparent.png`) when manually invoked via `npm run sync`.
- **Zero Continuous Auto-Syncing**: Automatic background file watchers (`startWatcher`) and server boot syncs are completely disabled (`no auto syncs`, `not continue syncing`).


## 🎨 6. Unified Swiss / Brutalist Editorial Design Standard (landingpage.html Standard)
- **Palette**: Pure Onyx Black (`#111111`), Pure White (`#ffffff`), LifeQR Signal Red (`#E11D2E`), subtle contrast slate/gray accents.
- **Typography**: Display & Brand in `Archivo Black` / `Archivo` (weights 600–900), Body in `Archivo` / system-ui, and medical telemetry/tags in `JetBrains Mono`.
- **Cards & Surfaces**: Use crisp 2px solid borders (`border: 2px solid #111111` or `#E11D2E`) and hard offset drop shadows (`box-shadow: 6px 6px 0px #111111` or `#E11D2E`).
- **Buttons**: Use `.btn-primary` (black with red hover and 2px border), `.btn-secondary` (white with 2px black border), and `.btn-danger` / `.btn-sos` (red #E11D2E).
- **Telemetry Bars**: Sleek top ticker (`bg-[#111111] text-white py-2.5 px-6 font-mono text-[11px]`) with pulsing red `.live-dot`.

## 🌓 7. Universal Device Appearance / System Theme Synchronization
- **Device Theme Listener**: The application dynamically listens to OS / browser preference changes via `window.matchMedia('(prefers-color-scheme: dark)')` in `js/theme.js` & `api-utils.js`.
- **Zero-FOUC Head Bootstrapper**: Every HTML page runs an inline `<script>` in `<head>` to immediately set `<html data-theme="...">` matching either the user's manual choice or device appearance before first paint.
- **Dynamic Adaptability**: When the device switches between Dark and Light mode, the dashboard automatically updates its root `data-theme`, meta theme-color, toggle button state, and UI surfaces across all patient, crew, doctor, ER, and admin portals.

## 🚪 8. Swiss Editorial Modal & Action Confirmation Pattern
- **Elimination of Native Prompts**: Avoid native browser `confirm()`, `alert()`, or `prompt()` across dashboards.
- **Editorial Design Language**: Use `.editorial-card` (`border: 2px solid #111111`, `box-shadow: 6px 6px 0px #111111`), high z-index (`z-[70]`), backdrop blur (`bg-black/80 backdrop-blur-xs`), and theme-aware inputs.

## 📱 9. Mobile App Splash & Permissions Onboarding Lifecycle Pattern
- **Cinematic Poster Splash Loading Screen**: `app/patient_app.html`, `app/splash.html`, and `website/splash.html` feature the ultra-realistic promotional cinematic poster (`lifeqr_splash_cinematic.jpg`) inspired by luxury automotive and dark thriller aesthetics with ambient volumetric scanning lasers, mint-green glow, and a live telemetry HUD progress bar aligned with pixel precision to the reflective bed.
- **Micro-Animations & Telemetry**: Ambient laser glow pulse, live pulse status dot, dynamic telemetry stages (Vault initialization -> Matrix scan -> Telemetry calibration -> Network ready), and smooth fadeout transition into the onboarding or authenticated dashboard.
- **First Open vs Returning Lifecycle**:
  - `hasCompletedOnboarding`: If not set, shows `#screen-onboarding` explaining why GPS (2-3km SOS dispatch), Emergency Notifications (crew ETA), and Camera (QR badge scanner) are needed.
  - Returning User: Token verified via `/api/v1/patient-app/me` and `/api/v1/patient/me`; transitions directly from Splash to Dashboard (`#screen-home`) with zero repeated login prompts.
- **Dedicated Flow Modals**: Specific clinical flows (e.g. Inpatient Discharge `#dischargePatientModal`, Intake `#admitPatientModal`, QR Rotation) display full patient demographics, triage badges, ward/bed tags, and consequential warning boxes.
- **Universal Dialog Handlers**: Expose promise-based helpers (`window.hospitalConfirmDialog`, `window.adminConfirmDialog`) with Escape key and backdrop dismissal to provide consistent, premium UX throughout the platform.

## 🚫 10. Zero Demo Features Standard
- **No Mock or Demo Shortcuts**: Strictly avoid placing "Quick Demo", "Demo Fill", "Simulate Emergency", or fake bypass buttons in production portals (`patient_app.html`, `doctor_dashboard.html`, `CrewAmbulance_dashboard.html`, `admin_dashboard.html`, `lifeqr_login.html`).
- **Authentic Verification & Workflows**: All operations (authentication, registration, practitioner document verification, QR scanning, SOS dispatch) must rely strictly on genuine credentials, real user data, and live backend endpoints without artificial shortcuts.

## 📱 11. Smartphone Device Frame & Dual-Viewport Responsive Pattern
- **Desktop Simulator Presentation (`@media (min-width: 640px)`)**: When mobile pages (e.g. `patient_app.html`) are viewed on desktop viewports, wrap them in `.phone-mockup-chassis` with photorealistic device aesthetics: standard 390px × 844px dimensions, titanium bezel, Dynamic Island, home indicator, side buttons, and hidden scrollbars (`scrollbar-width: none`).
- **Device Control Toolbar**: Provide desktop users with device size toggles (Standard Phone 390px, Compact 360px, Max 428px, Fill Screen) and direct actions.
- **Native Mobile Zero-Overhead (`@media (max-width: 639px)`)**: On actual mobile screens, Android WebViews, and PWAs, strip all simulator bezels and toolbars so the interface fills 100% of the screen edge-to-edge.

## 🧭 12. Patient App Sliding Sidebar Drawer & Emergency Vault Actions Pattern
- **Header Trigger (`#headerSidebarBtn`)**: Top header contains a dedicated hamburger menu button (`☰` / `menu`) and a clickable user profile summary that triggers `openSidebar()`.
- **Slide-out Drawer Shell (`#app-sidebar` & `#sidebar-overlay`)**: Positioned inside `.phone-screen-viewport` (`position: absolute; top: 0; left: 0; bottom: 0; width: 84%; z-index: 95;`) with hardware-accelerated slide animation (`transform: translateX(-100%)` to `translateX(0)`).
- **Edit Medical Profile (`openEditProfile()`)**: Pre-fills the clinical profile setup form (`#screen-profile-setup`) with existing database values (age, blood group, allergies, chronic conditions, medications, primary emergency contact) and provides a "← Back to App" cancellation button.
- **Download Everything (`downloadEverything()`)**: 1-click batch export that sequentially triggers download of the patient's Emergency QR Badge PNG, high-resolution Lock Screen Wallpaper PNG, and the official standalone Emergency Medical Dossier (HTML / Printable Card).
- **Comprehensive App Routing**: Centralizes 1-tap navigation to all sub-views (`qr`, `medical`, `contacts`, `records`, `settings`), modal triggers (`+ Add Contact`, `+ Add Record`), responder tools (`previewEmergencyView`, `shareEmergencyLink`), emergency SOS dispatch, theme toggle, and authenticated sign out.

## 🪪 13. In-App Emergency Preview Modal & Mobile Emergency Pass Shell Pattern
- **In-App Scan Preview Sheet (`#modal-emergency-preview`)**:
  - In `patient_app.html`, tapping "👁️ Preview Scan" or clicking "Preview Responder Emergency View" in the sidebar opens an in-app emergency triage pass modal directly inside `.phone-screen-viewport`.
  - Never kicks the user out of the app to a browser tab or website URL (`window.open` removed).
  - Renders genuine, authenticated patient data (`AppState.user`, `AppState.profile`, `AppState.contacts`, `AppState.qrProfile`) with high-contrast emergency styling: urgent rescue allergy alerts, blood group highlight box, verified ICE contact triggers with 1-tap direct dialing, and paramedic override notices.
  - Dismissible via close button `✕` or "← Back to App" without navigating away from the dashboard.
- **Mobile-Native Emergency Pass Presentation (`app/emergency_access.html`)**:
  - Emergency pass routes (`/e/:token` and `/emergency_access.html`) are containerized within `.mobile-emergency-shell` (`max-w-[440px] mx-auto min-h-screen bg-white sm:my-6 sm:border-2 sm:border-[#111111] sm:shadow-[8px_8px_0px_#111111]`).
  - On desktop viewports, displays as a crisp centered phone card against a neutral staging backdrop (`#f1f5f9` / `#000000`).
  - No marketing links to `landingpage.html` or bulky desktop header elements; provides a streamlined emergency pass header (`LIFEQR PASS`), compact language selector, single-column responsive flow, and docked mobile print/share actions.


