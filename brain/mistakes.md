# Mistakes — Issue & Fix Log

## Issue 001: Missing MONGO_URI Error on Startup
- **Symptom**: `node backend/server.js` failed with `❌ Error: MONGO_URI is required`.
- **Root Cause**: `dotenv.config()` was called without a file path parameter, searching in working directory root instead of `backend/.env`.
- **Fix**: Updated call to `require("dotenv").config({ path: path.join(__dirname, ".env") });`.
- **Status**: Resolved.

## Issue 002: Crew Dashboard Missing Patient Data Fields
- **Symptom**: Scanning patient QR code in `CrewAmbulance_dashboard.html` displayed "Emergency Patient" without blood group or allergies.
- **Root Cause**: `crew-dashboard.js` expected `activePatient.user.name` and `activePatient.profile.bloodGroup`, but `/api/v1/patient/profile/:qrCodeId` returned flat properties (`activePatient.name`, `activePatient.bloodGroup`).
- **Fix**: Updated `renderPatientDetails()` to check both top-level and nested property formats.
- **Status**: Resolved.

## Issue 003: EPERM File Access Lock During Directory Restructuring
- **Symptom**: `fs.rmSync('frontend')` failed with `EPERM Permission denied`.
- **Root Cause**: Background server process (`node backend/server.js`) was actively holding open file handles in `frontend/`.
- **Fix**: Terminated running background server process before completing file folder cleanup.
- **Status**: Resolved.

## Issue 004: File Not Found Error on `website/lifeqr_signup.html`
- **Symptom**: Browser displayed `File not found: website/lifeqr_signup.html` when clicking Sign Up / Sign In links on the marketing site.
- **Root Cause**: `website/index.html` linked to `lifeqr_signup.html` without relative path (`../app/lifeqr_signup.html`), which failed when browsing file system directories directly.
- **Fix**: Updated all `href` paths in `website/index.html` to `../app/lifeqr_signup.html` & `../app/lifeqr_login.html`, and added fallback redirect files in `website/`.
- **Status**: Resolved.

## Issue 005: Unstyled Raw HTML & Broken Images on Mobile/LAN Testing (Port 5000)
- **Symptom**: Browsing `http://192.168.100.82:5000` on mobile rendered unstyled serif text (Times New Roman) and broken image icons.
- **Root Cause**: Helmet middleware applied default `upgrade-insecure-requests` CSP directive. When accessing via HTTP over local IP, the mobile browser automatically rewrote all CSS, images, and font URLs to `https://192.168.100.82:5000/...`, causing SSL handshake failures.
- **Fix**: Configured Helmet CSP with `upgradeInsecureRequests: null` for local development/HTTP and opened CORS for all LAN network interfaces. Rebuilt Tailwind CSS distribution bundle.
- **Status**: Resolved.

## Issue 006: Post-Signup Dashboard Redirection & Cross-Origin Auth Guard
- **Symptom**: After successfully creating an account, the browser failed to reach the dashboard or got bounced back to login.
- **Root Cause**: `js/auth-guard.js` hardcoded `const API_BASE = '/api/v1'`, causing session verification on alternate dev ports/origins (e.g. 5500, 3000) to 404 and kick the user back to login. Dashboard HTML files also omitted `api-utils.js`, and signup redirection had fixed timing without immediate role resolution.
- **Fix**: Upgraded `auth-guard.js` to dynamically detect `API_BASE` and sync `localStorage` user metadata. Included `api-utils.js` across all dashboards. Updated `lifeqr_signup.html` to resolve target dashboard immediately based on user role and redirect cleanly.
- **Status**: Resolved.

## Issue 007: Dashboard Data Failing to Populate Due to Hardcoded Relative Fetch Calls
- **Symptom**: Upon landing on `patient_dashboard.html`, the patient's name showed `Patient: Loading...`, the QR badge was broken, and form inputs stayed empty.
- **Root Cause**: `patient-dashboard.js` (and other dashboard JS controllers) made unrouted relative `fetch('/api/v1/patient/me')` calls instead of utilizing `window.authFetch` and dynamic `getApiUrl()`. When running via separate dev ports (e.g., Live Server on port 5500), these requests failed with 404, throwing an unhandled rejection and skipping DOM rendering. Additionally, `userName` and QR badge were not populated immediately from the verified session object.
- **Fix**: Updated `api-utils.js` to expose `window.getApiUrl()` and upgraded `patient-dashboard.js`, `doctor-dashboard.js`, and `crew-dashboard.js` to use `window.authFetch` across all endpoints. Added immediate pre-rendering of patient name, phone, gender, and QR badge from the authenticated user object on `DOMContentLoaded`.
- **Status**: Resolved.

## Issue 008: Doctor Dashboard Patient Search & QR Scanner Theme Discrepancy
- **Symptom**: In Doctor Dashboard, searching patient ID (e.g., `RAH-D3200470`) remained stuck on "No Patient Record Selected" if the doctor account was pending verification; QR camera modal had unmatched purple styling and failed to populate search results; overall dashboard had harsh brutalist block shadows inconsistent with `website/landingpage.html`.
- **Root Cause**: `backend/routes/v1/doctorAccess.js` enforced `requireVerified` on `GET /status/:qrCodeId`, blocking search lookups for pending doctors and omitting emergency medical summaries (blood group, allergies, medications). `qr-scanner.js` used mismatched purple theme and lacked callback wiring to trigger `searchPatient()`. `doctor_dashboard.html` had static 6px drop-shadows on all cards.
- **Fix**: Removed `requireVerified` blocker from `/status/:qrCodeId`, returning full emergency triage matrix. Rebuilt `qr-scanner.js` with Swiss high-contrast editorial theme, drag-and-drop, test button, and auto-trigger callback. Modernized `doctor_dashboard.html` to match `website/landingpage.html` with high-impact medical cards and synchronized `website/` and `app/`.
- **Status**: Resolved.

## Issue 009: Crew Dashboard Patient Details & Emergency ICE Contacts Failing to Render
- **Symptom**: In `CrewAmbulance_dashboard.html`, searching a patient QR ID (e.g., `VED-C188E7F9`) displayed the patient name, age, and allergies, but Blood Group, Current Prescriptions, Chronic Conditions showed empty `-` dashes, Emergency Contacts (ICE) remained blank, and the Patient QR Identifier displayed literal text `ID`.
- **Root Cause**: `renderPatientDetails()` in `crew-dashboard.js` targeted mismatched element IDs (`patBlood`, `patMeds`, `patIssues`, `patContactsList`), whereas `CrewAmbulance_dashboard.html` defined IDs as `patBloodGroup`, `patMedications`, `patHealthIssues`, `patEmergencyContact`, and omitted updating `patId`. Additionally, `renderEmergencyMap()` looked for `emergencyMapContainer` and `L.map('emergencyMap')` instead of `mapWrapper` and `leafletMapContainer`, `logIncidentStage()` and `closeSosPopup()` were undefined, and backend `/api/v1/sos/acknowledge` lacked body-based resolution.
- **Fix**: Updated `renderPatientDetails()` to support both legacy and HUD element IDs (`patBloodGroup`, `patMedications`, `patHealthIssues`, `patEmergencyContact`, `patId`), wired Leaflet map container to `leafletMapContainer` with live Google Maps navigation link, implemented `logIncidentStage()` and `closeSosPopup()`, and added fallback resolution to `backend/routes/v1/sos.js` and `backend/routes/v1/patientProfile.js`.
- **Status**: Resolved.

## Issue 010: Scanned Emergency Credential Tokens & Full QR URLs Failing Doctor/Crew Lookup
- **Symptom**: When scanning or pasting a patient QR badge containing raw emergency credential hex tokens (e.g., `e9fdaf2e8d68178adc8d5ba06c9b44c1...`) or full emergency URLs (`/e/...`), Doctor and Crew lookups failed with `Patient not found for ID: e9fdaf...` or only loaded partial data.
- **Root Cause**: Backend routes (`/doctor-access/status/:qrCodeId`, `/patient/profile/:qrCodeId`, `/history/:qrCodeId`, etc.) strictly performed `PatientProfile.findOne({ qrCodeId })`. When emergency QR codes encoded active credential hashes (stored in the `EmergencyCredential` model) rather than the raw `qrCodeId`, lookups returned `null`.
- **Fix**: Implemented a unified resolver utility `backend/utils/patientResolver.js` that normalizes URLs and resolves patient profiles across `qrCodeId`, case-insensitive strings, `EmergencyCredential` SHA-256 token hashes, raw hex tokens, and ObjectIds. Connected the resolver across Doctor, Crew, History, AI Clinical, and ER Handover endpoints.
- **Status**: Resolved.

## Issue 011: Residual Legacy Gradients and Soft Rounded Containers in Dynamic JS Renderers
- **Symptom**: After converting static HTML files to the Swiss Brutalist editorial design of `landingpage.html`, some cards, boxes, fonts, and action buttons in Patient, Crew, Doctor, ER, and Admin dashboards still rendered with old pastel gradients, soft rounded borders (`rounded-xl`, `rounded-2xl`, `rounded-3xl`), and generic purple styles when populated dynamically at runtime.
- **Root Cause**: Client-side JavaScript modules (`patient-dashboard.js`, `crew-dashboard.js`, `doctor-dashboard.js`, `er-dashboard.js`, `admin-dashboard.js`, `pwa-install.js`) dynamically created and injected HTML template strings containing legacy Tailwind classes (`rounded-2xl`, `bg-purple-50`, `bg-teal-50`, `bg-slate-900`, `shadow-xs`).
- **Fix**: Systematically audited and refactored all dynamic JavaScript template injectors across all dashboards to use 2px solid borders (`border-2 border-[#111111]` / `border-2 border-[#E11D2E]`), hard offset drop-shadows (`shadow-[4px_4px_0px_#111111]`, `shadow-[6px_6px_0px_#111111]`), uppercase `Archivo Black` (`font-black`) headings, `JetBrains Mono` (`font-mono`) badges/telemetry, and semantic buttons (`btn-primary`, `btn-secondary`, `btn-danger`). Re-synchronized `website/` and `app/`.
- **Status**: Resolved.
## Issue 012: Cross-Device QR Code Scanning & Emergency Content Resolution Failure
- **Symptom**: Scanning patient QR badges from external devices (e.g. mobile phones on Wi-Fi) failed to load the emergency profile, resulting in network connection errors ("Site can't be reached") or server 500 error ("Failed to resolve emergency access token").
- **Root Cause**:
  1. `FRONTEND_URL` in `.env` held an obsolete IP (`192.168.100.82:5000`) instead of the host machine's active network IP (`192.168.100.144`), or defaulted to `localhost:5000` which on external phones points to the phone's loopback rather than the host server.
  2. `backend/routes/v1/emergencyCredentials.js` threw `TypeError: Cannot read properties of null (reading '_id')` in `logEvent` when resolving by `qrCodeId` because `credential` was null in the fallback branch, returning 500 to the client.
  3. `backend/generateQR.js` attempted to read `user.qrCodeId` from the `User` schema (where it was `undefined`) instead of `PatientProfile.qrCodeId`.
- **Fix**:
  1. Enhanced `backend/utils/frontendUrl.js` with `getLocalIpAddress()` via `os.networkInterfaces()` to detect the live non-internal IPv4 address and automatically resolve reachable network URLs for QR codes.
  2. Updated `backend/routes/v1/emergencyCredentials.js` to integrate `resolvePatientProfile`, safely read `credentialId: credential?._id || profile.qrCodeId`, support case-insensitive lookups, and allow photo access for all QR formats.
  3. Corrected `backend/generateQR.js` and `patientProfile.js` to read `qrCodeId` from `PatientProfile` and re-generated the live badge for `patient@lifeqr.com`.
- **Status**: Resolved.

## Issue 013: Server Startup Crash Due to Missing `nodemailer` Dependency
- **Symptom**: Executing `node server.js` failed immediately on boot with `Error: Cannot find module 'nodemailer' Require stack: .../services/emailService.js`.
- **Root Cause**: `nodemailer` was imported unconditionally in `backend/services/emailService.js` without being listed in `backend/package.json` dependencies. In addition, an accidental user string was present at the end of `backend/.env`.
- **Fix**: Wrapped `nodemailer` loading in a safe `try-catch` with automatic fallback to mock console email dispatch, corrected the `.env` path resolution to `{ path: path.join(__dirname, "../.env") }`, cleaned up `backend/.env`, and installed `nodemailer` with `--save` into `backend/package.json`.
- **Status**: Resolved.

## Issue 014: `npm run dev` Failure from Workspace Root
- **Symptom**: Running `npm run dev` from workspace root failed with `'nodemon' is not recognized as an internal or external command, operable program or batch file` or `❌ Port 5000 is already in use`.
- **Root Cause**: 
  1. The root `package.json` defined `"dev": "cd backend && nodemon server.js"`. When executing root scripts on Windows, `npm` only injects root `node_modules/.bin` into PATH, leaving `backend/node_modules/.bin/nodemon` unresolved.
  2. A previous background server instance was running on port 5000, causing nodemon to hit `EADDRINUSE`.
- **Fix**: Replaced `"cd backend && nodemon server.js"` with `"npm --prefix backend run dev"` (and `"start": "npm --prefix backend start"`) in root [`package.json`](file:///c:/Users/tarun/Downloads/lifeqr-complete/package.json), set `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force` to prevent PowerShell script execution blocking on `npm.ps1`, and terminated background instances on port 5000.
- **Status**: Resolved.

## Issue 015: Doctor AI Copilot Output Box Remaining Hidden
- **Symptom**: In `doctor_dashboard.html`, clicking "AI Clinical Summary", "Medical Scribe", "Differential Diagnosis", "Rx Safety", or "Auto-SOAP Note" executed backend requests, but the output box never appeared on screen.
- **Root Cause**: `doctor_dashboard.html` defines the output container as `id="aiClinicalOutputContainer"`, while `doctor-dashboard.js` strictly queried `document.getElementById('aiOutputContainer')`, resulting in `null` and uncaught TypeError on `classList.remove('hidden')`.
- **Fix**: Created helper `getAiContainer()` in `doctor-dashboard.js` that checks both `aiClinicalOutputContainer` and `aiOutputContainer` before mutating DOM.
- **Status**: Resolved.

## Issue 016: Admin Dashboard JavaScript Crash on Uncaught Null Property Access
- **Symptom**: In `admin_dashboard.html`, statistics cards failed to complete loading and the pending practitioner verification queue stayed blank.
- **Root Cause**: `admin-dashboard.js` line 47 executed `document.getElementById('statTotalSos').textContent = data.stats.sos;` without checking if `#statTotalSos` existed in the HTML. Because `#statTotalSos` was absent, an uncaught TypeError aborted `loadAdminStats()` mid-execution.
- **Fix**: Added defensive null guard `if (document.getElementById('statTotalSos'))` before assigning textContent.
- **Status**: Resolved.

## Issue 017: Ambulance Dispatch HUD Dead Google Maps Navigation Button
- **Symptom**: In `CrewAmbulance_dashboard.html`, clicking "Open Google Maps" on the patient radar map did nothing or navigated to an empty URL.
- **Root Cause**: The anchor tag `#gmapsNavBtn` had `href=""`, and `renderEmergencyMap(lat, lng)` initialized the Leaflet radar but never assigned coordinates to the anchor.
- **Fix**: Updated `renderEmergencyMap(lat, lng)` in `crew-dashboard.js` to dynamically set `gmapsBtn.href = 'https://maps.google.com/?q=' + lat + ',' + lng`.
- **Status**: Resolved.

## Issue 018: Missing Master Test Accounts in Active Database
- **Symptom**: Attempting to log in as `admin@lifeqr.com` or `er@lifeqr.com` failed with 401 "Invalid email or password"; `doctor@lifeqr.com` and `crew@lifeqr.com` remained stuck in `PENDING` verification status.
- **Root Cause**: Test accounts defined in `TEST_CREDENTIALS.md` were never seeded into the live MongoDB collection.
- **Fix**: Created and executed `backend/seed_master_accounts.js`, creating `admin@lifeqr.com` and `er@lifeqr.com` and elevating `doctor@lifeqr.com` and `crew@lifeqr.com` to `VERIFIED` with `Password@123`.
- **Status**: Resolved.

## Issue 019: Automated Browser Testing Multi-Role Session Leakage & Keystroke State
- **Symptom**: During automated headful browser testing across multiple portals (Patient -> Doctor -> Ambulance Crew), the browser timed out waiting for role-specific dashboard elements or threw `401 Unauthorized` during login form submission.
- **Root Cause**:
  1. Consecutive `page.type()` calls in single-page applications without clearing existing input values concatenated keystrokes (e.g. `patient@lifeqr.comdoctor@lifeqr.com`), triggering login rejections.
  2. Attempting to clear `localStorage` while on `about:blank` triggered `DOMException: SecurityError: Access is denied for this document`.
  3. Single browser contexts shared HTTP-only authentication cookies across role transitions, triggering client-side `auth-guard.js` auto-redirects before new credentials could be submitted.
- **Fix**: Upgraded browser automation test suites to utilize `browser.createBrowserContext()` for each role transition, providing 100% session isolation with clean cookies, isolated local storage, and independent page lifecycles.
## Issue 020: Stale Host IP & Unsynchronized Legacy User Schema Resulting in ERR_CONNECTION_TIMED_OUT on Mobile QR Scan
- **Symptom**: Scanning patient QR badges (such as `SUJ04O`) with mobile cameras / Google Lens navigated to `http://192.168.100.82:5000/emergency_access.html?id=SUJ04O` which hung and failed with `ERR_CONNECTION_TIMED_OUT` ("192.168.100.82 took too long to respond"). Furthermore, the patient dashboard rendered blank clinical vitals (blood group, allergies, medications, emergency contacts).
- **Root Cause**:
  1. **Dynamic IP Change**: The host machine's Wi-Fi DHCP address shifted from `192.168.100.82` to `192.168.100.144`. Previously stored QR PNG data URLs statically contained the old IP.
  2. **Schema Inconsistency**: 7 legacy patient users had vital data directly on `User` collection records rather than in `PatientProfile` collection documents. When querying `/api/v1/patient/me` or `/api/v1/emergency-access/:token`, lack of a `PatientProfile` returned null, suppressing dashboard form fields and failing emergency credential resolution.
- **Fix**:
  1. Updated `backend/utils/patientResolver.js` with fallback logic to inspect `User` and self-heal missing `PatientProfile` records.
  2. Updated `backend/routes/v1/patientProfile.js` (`GET /me` and `PUT /update`) to auto-create and synchronize `PatientProfile` and `User` fields, keeping `User.qrCode` and `PatientProfile.qrCode` aligned.
  3. Created and executed `backend/migrate-qr-ips.js`, which backfilled all 7 missing patient profiles with legacy vitals and regenerated QR codes for all 21 patient accounts pointing to the active host IP (`http://192.168.100.144:5000/emergency_access.html?id=...`).
  4. Updated `APP_URL` in `android-wrapper/app/src/main/java/com/lifeqr/MainActivity.java` to `http://192.168.100.144:5000`.
- **Status**: Resolved.

## Issue 021: Doctor "Create Patient ID" Endpoint Failing with ReferenceError: cleanEmail is not defined
- **Symptom**: When creating a new patient from the Doctor Clinical Workstation (`+ Create Patient ID` in [doctor_dashboard.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/doctor_dashboard.html)), the action failed and the new patient was not added to the OPD waiting queue.
- **Root Cause**: In [backend/routes/v1/doctorAccess.js](file:///c:/Users/tarun/Downloads/lifeqr-complete/backend/routes/v1/doctorAccess.js), `POST /create-patient` referenced `cleanEmail` on line 496 before defining it, throwing an unhandled `ReferenceError: cleanEmail is not defined` and aborting patient creation. Additionally, `setupDoctorSocketQueue` in `doctor-dashboard.js` did not join `doctor:all` room, preventing real-time queue synchronization.
- **Fix**: Defined `cleanEmail` with fallback generation (`patient_<timestamp>_<random>@lifeqr.local`), synchronized `UserSecurity` collection, updated `setupDoctorSocketQueue()` to join `doctor:all` room on connection, and updated doctor name formatting to prevent duplicate `Dr. Dr.` prefix.
- **Status**: Resolved.

## Issue 022: Patient Avatar "Edit" Button Inactive Due to Missing File Input & Android WebView File Chooser Unhandled
- **Symptom**: Clicking the patient profile picture avatar or the bottom "EDIT" badge in [patient_dashboard.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/patient_dashboard.html) had no effect; no gallery permission prompt or photo picker opened.
- **Root Cause**:
  1. In [patient_dashboard.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/patient_dashboard.html), `<label for="profilePhotoInput">Edit</label>` referenced a non-existent `<input id="profilePhotoInput">`.
  2. In [patient-dashboard.js](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/js/patient-dashboard.js), `uploadProfilePhoto()` only updated `userProfilePhoto` instead of the active DOM element `normalUserProfilePhoto`, and was not wired to an `onchange` handler.
  3. In the Android wrapper [MainActivity.java](file:///c:/Users/tarun/Downloads/lifeqr-complete/android-wrapper/app/src/main/java/com/lifeqr/MainActivity.java), `WebChromeClient` omitted `onShowFileChooser()`, causing Android WebView to drop file chooser requests silently.
- **Fix**:
  1. Added hidden `<input type="file" id="profilePhotoInput">` and camera capture `<input type="file" id="profileCameraInput">` to [patient_dashboard.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/patient_dashboard.html).
  2. Implemented the Swiss Editorial `#photoUploadModal` with "Open Gallery / Choose Photo" and "Take Live Photo (Camera)" actions, instant local image preview, and synchronized cache-busting image reload across the dashboard.
  3. Implemented `onShowFileChooser` and `onActivityResult` in [MainActivity.java](file:///c:/Users/tarun/Downloads/lifeqr-complete/android-wrapper/app/src/main/java/com/lifeqr/MainActivity.java) along with `READ_MEDIA_IMAGES` and `READ_EXTERNAL_STORAGE` permissions in `AndroidManifest.xml`.
  4. Synchronized `app/` and `website/` via `scripts/sync-frontend.js`.
- **Status**: Resolved.

## Issue 023: CrewAmbulance_dashboard.html Patient Image Missing & Unbalanced Standby Layout
- **Symptom**: In [CrewAmbulance_dashboard.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/CrewAmbulance_dashboard.html), upon looking up a patient, the patient's profile photo was completely missing from the triage HUD. When no patient was searched, the right 8 columns were completely hidden, leaving an awkward blank screen.
- **Root Cause**:
  1. [CrewAmbulance_dashboard.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/CrewAmbulance_dashboard.html) had no `<img>` element for patient photos in the DOM.
  2. In `crew-dashboard.js`, `renderPatientDetails()` did not retrieve or render any photo for the patient.
  3. The layout was structured with a narrow 4-column search panel on the left and a hidden 8-column right panel, leaving the page half-empty on initial load.
- **Fix**:
  1. Redesigned [CrewAmbulance_dashboard.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/CrewAmbulance_dashboard.html) into a unified tactical workstation featuring a prominent top Triage & Scanner Control Bar, an informative Standby Deck with live GPS telemetry, radar map, and protocol checklist when idle, and a full-width Patient Identity Hero with a high-contrast framed `#patPhoto` (`w-24 h-24 sm:w-28 sm:h-28`) with verified badge overlay and error fallback.
  2. Added secure photo endpoint `GET /api/v1/patient/profile/:qrCodeId/photo` in `backend/routes/v1/patientProfile.js` alongside existing `/api/v1/emergency-access/:token/photo`.
  3. Updated `crew-dashboard.js` with responsive light/dark Swiss Editorial card styles, allergy flash alerts, phone quick-call button, and clear reset/standby workflow.
  4. Synchronized all updates between `app/` and `website/` via `scripts/sync-frontend.js`.
- **Status**: Resolved.

## Issue 024: Paramedic Crew Dashboard Blank Map & Unhandled Missing GPS Location
- **Symptom**: In [CrewAmbulance_dashboard.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/CrewAmbulance_dashboard.html), upon looking up a patient, the "PATIENT LIVE EMERGENCY GPS LOCATION" container rendered as a completely blank white rectangle with a black border, and the "GOOGLE MAPS" navigation button was dead/unlinked.
- **Root Cause**:
  1. **Unpersisted SOS Location**: In [backend/routes/v1/sos.js](file:///c:/Users/tarun/Downloads/lifeqr-complete/backend/routes/v1/sos.js), `POST /sos/sos` unshifted alerts into `profile.sosAlerts` but omitted updating `profile.lastLocation`, leaving patient profiles without top-level coordinates.
  2. **Missing Address Field in API**: In [backend/routes/v1/patientProfile.js](file:///c:/Users/tarun/Downloads/lifeqr-complete/backend/routes/v1/patientProfile.js), `GET /profile/:qrCodeId` omitted `address` and lacked fallback to recent SOS alert locations.
  3. **Silent Bypass in JavaScript**: In `crew-dashboard.js`, `renderEmergencyMap()` was only invoked if `loc && loc.lat && loc.lng` existed. When absent, the map container remained visible in the DOM with empty HTML and `gmapsNavBtn` left with `href=""`.
  4. **Stale Test Accounts**: Test accounts (including master patient Rahul Sharma `patient@lifeqr.com`) had empty `lastLocation: {}`.
- **Fix**:
  1. Updated `backend/routes/v1/sos.js` to automatically persist `profile.lastLocation` whenever valid `lat`/`lng` coordinates are broadcasted.
  2. Updated `backend/routes/v1/patientProfile.js` to return `address` and fallback to the latest SOS alert location if `lastLocation` is unset.
  3. Re-seeded `patient@lifeqr.com` in `backend/seed_master_accounts.js` with verified emergency coordinates for Marine Drive, Mumbai (`18.9438, 72.8234`).
  4. Added `resolveCoordinatesFromAddress()` fallback to map registered scene locations (Mumbai, Delhi/NCR, Bengaluru, Pune, Nagpur, Hyderabad, Chennai).
  5. Implemented `renderMapStandbyState()` so that patients without live GPS render a Swiss Editorial tactical radar HUD (`AWAITING GPS FIX`), an explanation, and a "Simulate Scene Location (EMT Drill)" button that lets responders immediately drop scene coordinates and view nearby trauma centers.
  6. Enhanced `renderEmergencyMap()` with reliable OpenStreetMap tiles, custom pulsing red emergency beacon marker (`custom-emergency-beacon`), dynamic Google Maps route link, and status badge (`LIVE SATELLITE FIX` / `SCENE BASELINE` / `EMT SIMULATED FIX`).
  7. Synchronized all changes between `app/` and `website/` via `scripts/sync-frontend.js`.
- **Status**: Resolved.

## Issue 025: Removed Unrealistic Hospital ER Pre-Arrival Uplink Card
- **Symptom**: In [CrewAmbulance_dashboard.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/CrewAmbulance_dashboard.html), an impractical "Hospital ER Pre-Arrival Uplink" card and "Stream to ER" button were present claiming to stream live vitals (HR, SpO2, BP) and ETA directly to hospital trauma bays.
- **Root Cause**: The feature was an unrealistic placeholder mockup requiring non-existent specialized ambulance hardware telemetry connections.
- **Fix**: Removed the "Hospital ER Pre-Arrival Uplink" card and "Stream to ER" button from both `app/CrewAmbulance_dashboard.html` and `website/CrewAmbulance_dashboard.html`. Cleaned up unused stream functions in `crew-dashboard.js`. Updated standby card to "Trauma Center Routing" and synchronized frontend directories via `scripts/sync-frontend.js`.
- **Status**: Resolved.

## Issue 026: Patient Mobile App Overlay Modal Leakage & Missing Home Medical Details
- **Symptom**: In `patient_app.html`, upon authentication the add-contact and add-record modals rendered inline in the viewport over the content because `.modal-overlay` was unstyled. In addition, the Home dashboard only presented the QR code while critical patient vitals, severe allergies, and active medications were buried behind a separate tab.
- **Root Cause**:
  1. `app/css/patient-app.css` lacked styling rules for `.modal-overlay`, `.modal-overlay.active`, and `.home-subview.active`, causing un-instantiated modals to render inline in the mobile viewport.
  2. `#tab-view-qr` only displayed the QR badge and action buttons without immediate clinical context (blood group, allergies, medications, emergency contacts).
- **Fix**:
  1. Rebuilt `app/css/patient-app.css` with fixed modal overlay styles (`z-index: 99999`, backdrop blur, `display: none` by default, active pop animations).
  2. Integrated the **Critical Vitals & Medical Identity** card directly onto `#tab-view-qr`, providing a unified emergency view with Blood Group, Age, Gender, Donor status, Severe Allergies warning chips, Active Medications pills, Chronic Conditions, and 1-tap dialable Primary Emergency Contact.
  3. Added a 1-click `⚡ Instant Demo Patient (Rahul Sharma)` sign-in button to `#screen-login` for instant testing.
  4. Synchronized all changes between `app/` and `website/` via `scripts/sync-frontend.js`.
- **Status**: Resolved.

## Issue 027: Android Wrapper Outdated Host IP & Missing SDK Licenses
- **Symptom**: Installing the debug APK onto a connected physical Android device resulted in `ERR_ADDRESS_UNREACHABLE` pointing to obsolete IP `http://192.168.100.82:5000/`. Compiling with Gradle failed due to unaccepted Android SDK 34 licenses, and ADB commands failed due to `unauthorized` device state and missing `platform-tools` in PATH.
- **Root Cause**:
  1. `MainActivity.java` had been edited but `app-debug.apk` had not been rebuilt.
  2. Android SDK Command-Line tools and licenses were missing from `C:\Users\tarun\AppData\Local\Android\Sdk`.
  3. Debug keystore signature mismatch between previous installation and fresh build (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`).
  4. Date formatting in `patient-dashboard.js` rendered `Invalid Date` when timestamps were missing on hospital admission records.
- **Fix**:
  1. Downloaded Android SDK Platform-Tools and Command-Line tools, added to User PATH, and accepted all licenses via `sdkmanager.bat --licenses`.
  2. Updated `MainActivity.java` with active LAN IP `http://192.168.100.144:5000`, automatic `http://127.0.0.1:5000` fallback (via `adb reverse tcp:5000 tcp:5000`), and HTML5 Geolocation enablement.
  3. Added fine and coarse location permissions in `AndroidManifest.xml`.
  4. Fixed `dateStr` formatting in `patient-dashboard.js` with fallback to `rawDate` and validation.
  5. Uninstalled conflicting old package signature, compiled a fresh debug build with Gradle 8.2, and deployed successfully to connected Motorola device.
- **Status**: Resolved.

## Issue 028: Patient Mobile App Theme Discrepancy & System Mode Mismatch with Website
- **Symptom**: When visiting the Patient Mobile App (`patient_app.html`), it defaulted to Dark Mode with muddy gray backgrounds (`#e5e7eb`), soft blur shadows, rounded pill buttons, and blue (`#2563EB`) accent chips, whereas the main website (`website/index.html`) opened in high-contrast Swiss Brutalist Light Mode (`#ffffff`, `#111111`, `#E11D2E` with crisp 2px solid borders, hard offset drop shadows, and top live telemetry status bar).
- **Root Cause**:
  1. `patient_app.html` had `<html lang="en" data-theme="dark">` hardcoded in the root HTML tag.
  2. `app/css/patient-app.css` defined `--bg-app: #f9fafb`, `body { background-color: #e5e7eb }`, soft `box-shadow: 0 0 30px rgba(0,0,0,0.15)`, and blue laser/reticle colors (`#2563EB`).
  3. `patient-app.js` defaulted theme fallback to `'dark'` (`localStorage.getItem('lifeqr_theme') || 'dark'`) and omitted updating `meta[name="theme-color"]` and `lifeqr_theme_manual`.
  4. `patient_app.html` header used circular buttons (`border-radius: 50%`) and lacked the signature live telemetry ticker.
- **Fix**:
  1. Updated `patient_app.html` root tag to `<html lang="en">` with `<meta name="theme-color" content="#ffffff">` and zero-FOUC adaptive system head script.
  2. Rebuilt `app/css/patient-app.css` tokens: pure white background (`#ffffff`), onyx black text (`#111111`), signal red accents (`#E11D2E`), 2px solid borders, and hard offset shadows (`8px 8px 0px #111111`).
  3. Added the signature Live Telemetry Status Bar (`.app-telemetry-bar`) with pulsing `.live-dot` at the top of the mobile shell.
  4. Aligned laser beam and reticle targeting to Signal Red (`#E11D2E`) and updated progress gradient to `#111111` to `#E11D2E`.
  5. Replaced rounded buttons with crisp editorial square buttons and unified `.btn-primary`, `.btn-secondary`, and `.btn-link`.
  6. Synchronized `initApp()` and `toggleTheme()` in `patient-app.js` with `theme.js`, `lifeqr_theme_manual`, and `meta[name="theme-color"]`.
  7. Synchronized `app/` and `website/` via `scripts/sync-frontend.js`.
- **Status**: Resolved.

## Issue 029: Android SwipeRefreshLayout Intercepted Vertical Scroll-Up Gestures
- **Symptom**: When scrolling down inside the app on an Android device, dragging downward to scroll back up was intercepted; instead of scrolling up, the native circular reload spinner appeared from the top and attempted to reload the page.
- **Root Cause**:
  1. `activity_main.xml` used `SwipeRefreshLayout` as the root element wrapping a `RelativeLayout` container that held the `WebView`.
  2. `SwipeRefreshLayout.canChildScrollUp()` defaulted to querying its direct child (`RelativeLayout`), which has no vertical scroll offset and always returned `false`.
  3. As a result, `SwipeRefreshLayout` considered the view permanently at `scrollY == 0`, intercepting every downward drag as a pull-to-refresh attempt.
  4. In an emergency medical application, pull-to-reload also posed risk of accidental data/form loss and websocket disconnection.
- **Fix**:
  1. Removed `SwipeRefreshLayout` from `activity_main.xml` and hosted `WebView` directly in the root layout.
  2. Removed all `SwipeRefreshLayout` dependencies, fields, and listeners from `MainActivity.java` and `app/build.gradle`.
  3. Configured `webView.setOverScrollMode(View.OVER_SCROLL_NEVER)` for seamless, artifact-free scrolling.
  4. Recompiled debug APK with Gradle and deployed fresh build to physical phone. Verified via ADB touch swipe tests that scrolling up and down functions smoothly without gesture hijacking.
- **Status**: Resolved.

## Issue 030: Purged Artificial Demo Shortcuts & Codified Zero Demo Features Rule
- **Symptom**: Presence of quick "Demo" auto-fill buttons and bypass shortcuts across Doctor Workstation (`doctor_dashboard.html`), QR Scanner modal (`qr-scanner.js`), Patient App (`patient-app.js`), and landing page preview simulator (`landingpage.html`).
- **Root Cause**: Convenience test shortcuts (`qrQuickDemoBtn`, `quickFillDemoPatient`, `simFillDemoPatient`) were previously injected into production views, violating the strict real-world medical platform standard.
- **Fix**:
  1. Codified the **Zero Demo Features Policy** as rule #4 under Core Engineering Principles in `AGENTS.md`, Section 5 in `brain/master-memory.md`, and Section 10 in `brain/patterns.md`.
  2. Removed `Quick Demo Patient Button` and demo chart prompt from `doctor_dashboard.html`.
  3. Removed `qrQuickDemoBtn` bypass button and handler from `qr-scanner.js`.
  4. Removed `window.quickFillDemoPatient` from `patient-app.js`.
  5. Removed simulator demo fill buttons and references from `landingpage.html`.
  6. Synchronized `app/` and `website/` via `scripts/sync-frontend.js`.
- **Status**: Resolved.

## Issue 031: Patient App Desktop View Lacked Phone Proportions & Device Frame
- **Symptom**: Accessing `http://localhost:5000/app` on desktop monitors rendered a generic 480px wide block with desktop scrollbars, double vertical scrolling, and no smartphone chassis or aspect ratio.
- **Root Cause**: `patient-app.css` defined `.app-container` with arbitrary `max-width: 480px` and `height: 94vh; min-height: 840px;` without responsive phone framing, device presets, or hidden mobile scrollbars.
- **Fix**:
  1. Built the **Smartphone Hardware Chassis Simulator** (`.phone-stage-wrapper`, `#phoneMockupChassis`, `.phone-screen-viewport`) in [app/patient_app.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/patient_app.html) and [website/patient_app.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/website/patient_app.html).
  2. Implemented photorealistic smartphone hardware styling: 390px × 844px default dimensions, titanium bezel, physical side buttons, Dynamic Island camera pill, home indicator bar, and studio dot backdrop.
  3. Added Desktop Simulator Control Toolbar with preset toggles: Standard Phone (390px), Compact (360px), Max (428px), and Fill Screen.
  4. Hid bulky native desktop scrollbars inside the phone screen with `scrollbar-width: none` while preserving smooth native scrolling.
  5. Kept 100% full-screen edge-to-edge responsiveness on actual mobile devices (`@media (max-width: 639px)`).
  6. Synchronized directories via `scripts/sync-frontend.js`.
- **Status**: Resolved.

## Issue 033: Patient App Bottom Navigation Bar Scrolled Away with Page Content
- **Symptom**: In `patient_app.html` (`http://localhost:5000/app`), the bottom navigation bar (`MY QR`, `MEDICAL`, `CONTACTS`, `RECORDS`, `SETTINGS`) was not fixed at the bottom of the screen. Users had to scroll all the way down past the QR code, vitals, and ICE contacts to reach it, and it scrolled out of view when scrolling up or down.
- **Root Cause**:
  1. `.bottom-nav` was styled with `position: absolute; bottom: 0;` inside `#screen-home` without a height-bounded flex parent.
  2. Outer container `.app-container` had `overflow-y: auto;` and `#screen-home` expanded to the total scroll height of the active tab (1221px), placing `.bottom-nav` at the bottom of the scrollable document instead of the phone screen viewport.
  3. On desktop monitors, `.phone-mockup-chassis` inherited `min-height: 100dvh;` which overrode `max-height: calc(100vh - 90px);`, causing the chassis to extend past the desktop window bottom and cut off the navigation bar.
  4. `.nav-item` SVG and text spans lacked `pointer-events: none;`, occasionally misdirecting pointer event targets.
- **Fix**:
  1. Configured `#screen-home` as a fixed flex column container (`flex: 1 1 0%; min-height: 0; height: auto; overflow: hidden; position: relative; width: 100%;`).
  2. Isolated scrolling to individual tab subviews (`.home-subview { flex: 1 1 0%; min-height: 0; overflow-y: auto; padding: 16px 18px 88px 18px; -webkit-overflow-scrolling: touch; }`), keeping both the top header and bottom navigation bar permanently locked in place.
  3. Docked `.bottom-nav` permanently at the bottom of the phone screen (`position: absolute; bottom: 0; left: 0; right: 0; z-index: 60; box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.12); padding-bottom: max(14px, env(safe-area-inset-bottom));`).
  4. Updated desktop chassis styling in `@media (min-width: 640px)` with `min-height: 0; max-height: calc(100vh - 84px);` and reduced stage padding so the entire phone and bottom nav fit comfortably inside laptop viewports (e.g., 1536×776) without desktop scrollbars.
  5. Added `pointer-events: none;` to `.nav-item svg, .nav-item span` and exposed `window.showTab`.
  6. Synchronized directories via `scripts/sync-frontend.js` and empirically validated zero-pixel nav shift during scrolling across all tabs.
- **Status**: Resolved.

## Issue 034: "Create Badge" Auto-Logged In Instead of Loading Signup Page
- **Symptom**: On the landing page (`index.html`), clicking "CREATE BADGE" or "CREATE FREE BADGE" immediately redirected the user into their existing dashboard (e.g. `patient_dashboard.html`) instead of loading the signup registration form (`lifeqr_signup.html`).
- **Root Cause**: `lifeqr_signup.html` included `checkAuthPagesAccess()` from `auth-guard.js`, which unconditionally checked `/api/v1/auth/verify` and called `redirectUserToDashboard(user.role)` whenever a valid session cookie existed. When an authenticated user attempted to register a new account or create a badge, the signup form was bypassed completely by the script.
- **Fix**:
  1. Replaced `checkAuthPagesAccess()` in [website/lifeqr_signup.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/website/lifeqr_signup.html) and [app/lifeqr_signup.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/lifeqr_signup.html) with non-blocking session check `checkExistingSession()`.
  2. Implemented `#activeSessionBanner` displaying the active account's name and role, with direct buttons to `[Go to Dashboard]` and `[Sign Out]`, while leaving the full registration form 100% accessible and editable.
  3. Added dynamic session awareness to the landing page navbar in [website/index.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/website/index.html), [app/index.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/index.html), [website/landingpage.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/website/landingpage.html), and [app/landingpage.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/landingpage.html) so authenticated users clearly see `[DASHBOARD]` in the header while "Create Badge" reliably navigates to the registration form without redirection.
- **Status**: Resolved.


