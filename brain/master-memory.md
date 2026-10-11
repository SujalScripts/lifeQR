# Master Memory — LifeQR Project Intelligence

> **Target Size**: Under 5,000 words  
> **Audience**: AI Agents (Read this file FIRST before starting any task)

---

## 📌 Project Overview
**LifeQR** is an emergency medical web application designed for **Patients** and **Ambulance Crews / Emergency Responders**. Patients store encrypted health profiles (blood group, severe allergies, active medications, emergency contacts) and generate printable QR code badges. In an emergency, scanning the QR badge gives instant access to critical health data without requiring login. Patients can also trigger 1-click SOS beacons with live GPS coordinates, broadcasting real-time dispatch alerts to ambulance crews.

---

## 🏗️ Core Architecture at a Glance

- **Website Directory (`website/`)**: Public-facing marketing website, feature showcase, 404 page, and static brand assets.
- **Application Directory (`app/`)**: Web application portals:
  - `patient_app.html` & `js/patient-app.js` & `css/patient-app.css` (Phase 1 Patient Mobile MVP: Cinematic Promotional Poster Splash Loading Screen [lifeqr_splash_cinematic.jpg], Step-by-Step 5-Stage Introduction & One-by-One Permission Wizard [GPS, Notifications, Camera] with detailed usage instructions transitioning smoothly to Login page, Persistent Session Auto-Login, Signup/Login, OTP, Profile Setup, Home with 5 Sub-Views, and Live Location Sidebar with neo-brutalist square quick action buttons)
  - `patient_dashboard.html` & `js/patient-dashboard.js`
  - `CrewAmbulance_dashboard.html` & `js/crew-dashboard.js`
  - `doctor_dashboard.html` & `js/doctor-dashboard.js`
  - `admin_dashboard.html` & `js/admin-dashboard.js`
  - `emergency_access.html` & `js/emergency-access.js` (Zero-login emergency QR page)
- **Backend API (`backend/`)**: Node.js + Express API (`/api/v1/...`), MongoDB Mongoose schemas (`User`, `UserSecurity`, `PatientProfile`, `DoctorProfile`, `CrewProfile`, `HospitalProfile`, `EmergencyContact`, `QRProfile`, `MedicalRecord`, `Doctor`, `AmbulanceCrew`, `Hospital`, `Consultation`, `Prescription`, `SOS`, `ERHandover`, `AuditLog`), Socket.IO real-time event server, Helmet security headers, rate limiters, JWT cookie auth. Note: `UserSecurity` synchronizes with `users` during registration/resets to store credentials in the `'user securities'` collection. Supports 4 ecosystem registration account types: Patient, Doctor, Ambulance Crew (`crew`), and Hospital Staff (`hospital`).
- **Notification Services**: Integrated OneSignal for multi-platform push notifications and Telegram Bot support for professional crew dispatch.
- **AI Clinical & Verification Engine**: Integrated logic for AI Deep Patient Analysis & Risk Stratification, Medical Scribe modal dictation, Differential Diagnosis copilot with 1-click apply, Rx Safety cross-checking against lethal contraindications, and AI Credential Sentinel (practitioner license audits in `admin_dashboard.html`). All seamlessly integrated into `doctor_dashboard.html` with Swiss Editorial styling and 1-click consultation form population.
- **Help & Support Ticket Clearinghouse**: End-to-end ticketing system (`HelpTicket` Mongoose model, `/api/v1/help-tickets` REST API, Socket.IO live notifications to `admin:all` and user rooms). Patients, doctors, and crew have dedicated Help modals with auto-referenced patient QR context to file issues (e.g. damaged QR badges, urgent medication safety checks, system overrides). Admins review, prioritize, filter, and resolve tickets with audit notes in `admin_dashboard.html`.
- **Universal Admin User Profile Handling & Troubleshooting System**: Multi-type administrative profile manager (`#adminUserProfileModal`, `GET/PUT /api/v1/admin/users/:id/profile`, `POST /api/v1/admin/users/:id/regenerate-qr`). Empowers admins to inspect and troubleshoot any user type (`patient`, `doctor`, `crew`, `admin`), edit clinical parameters (allergies, health issues, medications, emergency contacts), rotate/regenerate QR codes, manage medical council licenses, reset locked passwords with `UserSecurity` synchronization, and auto-resolve associated help tickets directly upon saving.
- **Admin Emergency View Customization & Live Mobile Simulator**: Fine-grained emergency view customizer (`#adminEmergencyViewCustomizationSection`, `#adminEmergencyPreviewModal`) enabling administrators to customize patient public emergency badges. Controls zero-login visibility, badge theme accent colors (`#E11D2E`, `#111111`, `#D97706`, `#059669`, `#2563EB`), high-risk allergy banner flash alerts, resuscitation/DNR directives (`FULL_CODE`, `DNR`, `ADVANCE_DIRECTIVE`, `COMFORT_CARE`), organ donor badge, sensitive medication masking, bystander phone masking, custom emergency banner announcements, and multi-language defaults. Includes an authentic interactive mobile phone HUD simulator modal to test bystander vs paramedic view states in real-time.
- **Security Access Audit Log & Emergency Scan Isolation**: The Security Access Audit Log (`#securityAuditLogCard`, `activitiesList`) is strictly restricted to users with the `admin` role. In `patient_dashboard.html`, the audit card is hidden by default and guarded by `currentUser.role === 'admin'`. On the backend, `/api/v1/patient/me` automatically sanitizes/strips `activities` for non-admin callers to eliminate data exposure. Administrators inspect the full patient audit trail (emergency scan events, responder accesses, security logs) directly inside Section 4 of `#adminUserProfileModal` in `admin_dashboard.html`.
- **Editorial Administrative Confirmation & Prompt Dialog System**: Replaced intrusive native browser `confirm()` and `prompt()` alerts in `admin_dashboard.html` with `#adminConfirmModal` and promise-based helper functions (`window.adminConfirmDialog`, `window.adminPromptDialog`). Implemented with high z-index (`z-[70]`), dark mode support, keyboard listeners (Enter/Escape), consequential action warnings, and custom styling for critical operations such as patient QR regeneration, practitioner credential approvals, and bulk uncredentialed account revocations.
- **Hospital Inpatient Admission & Doctor/Hospital Clinical History Ecosystem**: Deeply integrated hospital admissions (`POST /api/v1/hospitals/admissions`), real-time trauma bed allocation, and live Socket.IO events (`hospital:er`, `doctor:all`, `patient:<userId>`) into `doctor_dashboard.html` (`#hospitalAdmissionSection`) and `hospital_dashboard.html`. Attending physicians can directly allocate trauma bays, ICU beds, or inpatient wards during active consultations. Patient profiles (`patient_dashboard.html`, `#doctorHistoryCard`) unify verified doctor consultations with hospital admissions, displaying red `HOSPITAL INPATIENT ADMISSION` badges, trauma urgency levels, ward & bed numbers, attending medical staff, and admission/discharge timestamps. In `hospital_dashboard.html`, replaced raw browser `confirm()` prompts with the **Swiss Editorial Inpatient Discharge Modal** (`#dischargePatientModal`, `#hospitalConfirmModal`, `window.hospitalConfirmDialog`), capturing clinical disposition, attending notes, dynamically releasing bed occupancy across Trauma/ICU/General wards, and appending official discharge records to the patient's medical history.
- **Tactical 24/7 Ambulance Radar Map & 2–3 KM Emergency SOS Dispatch Mesh**: Continuous real-time GPS tracking engine for ambulance crews (`CrewAmbulance_dashboard.html`, `#crewTacticalRadarMap`, `navigator.geolocation.watchPosition`, `POST /api/v1/sos/crew/location`). Displays on-duty ambulance position with an animated beacon, active telemetry bar (`GPS ONLINE 24/7`), and a dynamic 3.0 KM dispatch perimeter overlay (`L.circle`). When an emergency SOS beacon is broadcast within 2–3 km, the Haversine distance engine places an interactive pulsing red LifeQR SOS logo marker at the exact victim coordinates and sounds an audio siren chime. Paramedics click the SOS logo marker to open the **Tactical Dispatch Sheet** (`#sosDispatchModal`), review victim vitals (blood group, severe allergies, coordinates, emergency notes), and click **ACCEPT DISPATCH & DEPLOY AMBULANCE** (`POST /api/v1/sos/accept`). The backend binds the responding crew record (`User.name`, `User.phone`, `CrewProfile.vehicleNumber`, `CrewProfile.station`), draws a tactical route line on the crew radar, and emits Socket.IO event `sos-dispatch-accepted` to `patient:<userId>`. The patient's dashboard (`patient_dashboard.html`) immediately displays the **Ambulance Dispatched Notification Modal** (`#sosDispatchedModal`) and top alert banner (`#sosDispatchedTopBanner`) featuring paramedic name, 1-tap call button (`tel:...`), vehicle unit number, base station, and estimated arrival time (ETA). Fully synced between `app/` and `website/` with zero demo delays.
- **Super-Administrator God-Mode & Platform Omnipotence System**: Omnipotent administrative command center (`admin_dashboard.html`, `backend/routes/v1/admin.js`) granting root control over the entire platform:
  - **Universal User Creation (`POST /api/v1/admin/users`)**: Creates any user account (`patient`, `doctor`, `crew`, `hospital`, `admin`) with instant credentials, bcrypt hashing, `UserSecurity` synchronization, and automatic role-specific profile provisioning (creates `PatientProfile` with 256-bit emergency token, SHA-256 hash in `EmergencyCredential`, and visual QR DataURL; `DoctorProfile` with license registry; `CrewProfile` with vehicle fleet unit; `HospitalProfile` with facility and triage department).
  - **Cascading Account Purge (`DELETE /api/v1/admin/users/:id`)**: Permanently obliterates any user and cascades across all associated collections (`User`, `UserSecurity`, `PatientProfile`, `DoctorProfile`, `Doctor`, `CrewProfile`, `AmbulanceCrew`, `HospitalProfile`, `Hospital`, `VerificationDocument`, `HelpTicket`, `EmergencyCredential`). Root safety prevents administrators from deleting their own active account.
  - **Instant Role Promotion & Migration (`PUT /api/v1/admin/users/:id/role`)**: Seamlessly promotes or migrates any user between any of the 5 system roles with automatic profile creation and security credential syncing.
  - **City-Wide Emergency SOS Command Center (`GET /api/v1/admin/sos`, `PUT /api/v1/admin/sos/:sosId/status`, `DELETE /api/v1/admin/sos/:sosId`)**: Aggregates distress incidents across `PatientProfile.sosAlerts` and standalone `SOS` collections into a unified tactical radar. Admins can force-override status (`RESOLVED`, `CREW_DISPATCHED`, `ACKNOWLEDGED`), reassign ambulances, and purge false alarms.
  - **Ambulance Fleet & Duty Master (`GET /api/v1/admin/crew/fleet`, `PUT /api/v1/admin/crew/:crewId/duty`)**: Real-time registry of all EMS ambulance units with live GPS telemetry and force On-Duty / Off-Duty controls.
  - **1-Click Platform Integrity Self-Healing (`POST /api/v1/admin/system/repair`)**: Automated diagnostic problem solver that inspects all database users, provisions missing profiles, repairs missing/desynced `UserSecurity` records, re-mints corrupt or missing patient QR codes, and auto-resolves stale SOS beacons (>24h).
  - **Real-Time Broadcast Announcement Engine (`POST /api/v1/admin/broadcast`)**: Transmits instant sirens, high-caution notices, or operational bulletins across the Socket.IO mesh to all users or targeted rooms (`crew:all`, `doctor:all`, `patient:all`).

---

## 🔑 Verified Account Notes

- **Patient Account**:
  - **Email**: `patient@lifeqr.com` | **Password**: `Password@123`
  - **Name**: Rahul Sharma (`+91 9876543210`)
  - **QR Code ID**: `RAH-D3200470`
  - **Blood Group**: `O+` | **Allergies**: Penicillin, Peanuts (Severe Anaphylaxis)
  - **Medications**: Albuterol Inhaler (PRN), Cetirizine 10mg
  - **Emergency Contacts**: Priya Sharma (`+91 9876543211`, Spouse), Dr. Amit Sharma (`+91 9876543212`, Brother)
- **Ambulance Crew Account**:
  - Use a verified crew account for live dispatch workflows.
  - Unit and station details should be populated from the registered profile.

---

## 🔒 Security & Verification Protocol

1. **Official Professional Verification**: Doctor and Ambulance Crew verification relies strictly on uploading official credential documents (`/api/v1/verification/upload-document`) and Admin review/approval via [admin_dashboard.html](file:///c:/Users/USER/Downloads/lifeqr-complete/app/admin_dashboard.html). All demo auto-verify bypasses have been removed.
2. **Website vs App Separation & UI/UX Distinction (No Auto-Sync)**: Public landing site lives in `website/`; mobile-first app portals live in `app/`. Both share the same backend REST API and data models, but their interfaces and UI/UX layouts are distinct (phone mockup, mobile bottom nav, mobile sidebar drawer vs desktop website presentation). HTML pages and distinct UI scripts are NOT synchronized. Continuous auto-sync watchers are disabled; only shared theme stylesheets and brand assets may be manually copied when explicitly needed.
3. **Socket.IO Real-Time Dispatch**: Emergency SOS beacons emit `sos-alert` to `crew:all` room, while in-transit telemetry streams to `hospital:er` room for ER triage monitoring.
4. **Public DNS Resolution**: `backend/server.js` invokes `dns.setServers(['8.8.8.8', '1.1.1.1'])` to resolve MongoDB Atlas SRV URIs reliably across environments.
5. **Zero Demo Features Rule**: Strict non-negotiable policy prohibiting demo features, mock shortcuts, dummy bypass buttons, or placeholder UI components. Every feature in LifeQR must be genuine, production-grade, fully functional, and backed by authentic backend logic and database models.

---

## ⚠️ Known Pitfalls & Fixes

- **Dotenv Path**: Always specify `{ path: path.join(__dirname, '.env') }` when requiring `dotenv` in `backend/` scripts.
- **Nodemailer Dependency**: `backend/services/emailService.js` incorporates safe fallback mocking if SMTP credentials or `nodemailer` are absent.
- **Mongoose Index Warnings**: `qrCodeId` has schema index `patientProfileSchema.index({ qrCodeId: 1 })`; avoid duplicate `index: true` inline declarations.
- **Emergency Scan Preview in Mobile App**: Tapping "Preview Scan" or "Preview Responder Emergency View" in `patient_app.html` opens the in-app modal sheet (`#modal-emergency-preview`) within the phone screen viewport, never launching `window.open()` to a separate desktop browser tab. Additionally, `app/emergency_access.html` is containerized in `.mobile-emergency-shell` (`max-w-[440px] mx-auto`) so that even when accessed on desktop viewports it renders as a crisp centered phone pass rather than a wide unconstrained desktop website.
