# Feature Map — Capability to Code File Mapping

## 🗺️ Feature Matrix

### 1. Patient Emergency Profile & QR Generation
- **Frontend Views**: [patient_dashboard.html](file:///c:/Users/USER/Downloads/lifeqr-complete/app/patient_dashboard.html)
- **Frontend Logic**: [patient-dashboard.js](file:///c:/Users/USER/Downloads/lifeqr-complete/app/js/patient-dashboard.js)
- **Backend Route**: [patientProfile.js](file:///c:/Users/USER/Downloads/lifeqr-complete/backend/routes/v1/patientProfile.js)
- **Database Model**: `PatientProfile.js`, `User.js`

### 2. Real-time Emergency SOS Geolocation Broadcast
- **Trigger**: [patient-dashboard.js](file:///c:/Users/USER/Downloads/lifeqr-complete/app/js/patient-dashboard.js) (`triggerSOS()`)
- **Backend Handler**: [sos.js](file:///c:/Users/USER/Downloads/lifeqr-complete/backend/routes/v1/sos.js) (`/api/v1/sos/sos`)
- **Socket Dispatch**: `io.to('crew:all').emit('sos-alert', ...)`
- **Responder Receiver**: [crew-dashboard.js](file:///c:/Users/USER/Downloads/lifeqr-complete/app/js/crew-dashboard.js) (`showSosAlertPopup()`)

### 3. Ambulance Crew Camera QR Scanner & Triage Lookup
- **Frontend View**: [CrewAmbulance_dashboard.html](file:///c:/Users/USER/Downloads/lifeqr-complete/app/CrewAmbulance_dashboard.html)
- **QR Scanner**: [qr-scanner.js](file:///c:/Users/USER/Downloads/lifeqr-complete/app/qr-scanner.js) (`jsQR`)
- **Controller Logic**: [crew-dashboard.js](file:///c:/Users/USER/Downloads/lifeqr-complete/app/js/crew-dashboard.js)
- **Backend Handler**: [patientProfile.js](file:///c:/Users/USER/Downloads/lifeqr-complete/backend/routes/v1/patientProfile.js) (`GET /profile/:qrCodeId`)

### 4. Zero-Login Public Emergency Profile View
- **Frontend View**: [emergency_access.html](file:///c:/Users/USER/Downloads/lifeqr-complete/app/emergency_access.html)
- **Controller Logic**: [emergency-access.js](file:///c:/Users/USER/Downloads/lifeqr-complete/app/js/emergency-access.js)
- **Backend Route**: [emergencyCredentials.js](file:///c:/Users/USER/Downloads/lifeqr-complete/backend/routes/v1/emergencyCredentials.js)

### 5. Hospital ER Reception Live Stream & Trauma Bay Dispatcher
- **Frontend View**: [er_dashboard.html](file:///c:/Users/USER/Downloads/lifeqr-complete/app/er_dashboard.html)
- **Controller Logic**: [er-dashboard.js](file:///c:/Users/USER/Downloads/lifeqr-complete/app/js/er-dashboard.js)
- **Paramedic Stream Integration**: [crew-dashboard.js](file:///c:/Users/USER/Downloads/lifeqr-complete/app/js/crew-dashboard.js)
- **Backend Route**: [erHandover.js](file:///c:/Users/USER/Downloads/lifeqr-complete/backend/routes/v1/erHandover.js)
- **Database Model**: [ERHandover.js](file:///c:/Users/USER/Downloads/lifeqr-complete/backend/models/ERHandover.js)

### 6. AI Clinical Copilot & Decision Tree
- **Backend Routes**: `aiClinical.js`, `doctorDecisionTree.js`
- **Features**: Patient Summary, Medical Scribe, Differential Dx, Rx Safety, SOAP Generator.
- **Frontend Controller**: `doctor-dashboard.js`

### 7. Phase 1 Patient Mobile MVP Application
- **Frontend App Shell**: [patient_app.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/patient_app.html) & [splash.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/splash.html)
- **Mobile Controller**: [patient-app.js](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/js/patient-app.js)
- **App Design System**: [patient-app.css](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/css/patient-app.css)
- **Backend API Route**: [patientApp.js](file:///c:/Users/tarun/Downloads/lifeqr-complete/backend/routes/v1/patientApp.js) (`/api/v1/patient-app/...`), [auth.js](file:///c:/Users/tarun/Downloads/lifeqr-complete/backend/routes/v1/auth.js)
- **Splash & Loading Engine**: Premium Cinematic Promotional Poster Visual (`lifeqr_splash_cinematic.jpg`) inspired by luxury automotive and dark thriller aesthetics, featuring an emergency night scene, brush typography, realistic rugged LifeQR hardware prototype, and real-time telemetry HUD progress tracking.
- **App Lifecycle & Navigation**:
  - *First Open*: Splash $\rightarrow$ Introduction & Permission Explanation Screen (explains Live GPS for SOS rescue radius, Emergency Notifications for ambulance ETA, Camera for QR badges) $\rightarrow$ Signup / Login $\rightarrow$ OTP $\rightarrow$ Profile Setup $\rightarrow$ Dashboard.
  - *Regular Open*: Splash $\rightarrow$ Instant Token Verification $\rightarrow$ Dashboard (zero repeated login prompts).
- **Database Models**: `User.js`, `PatientProfile.js`, `EmergencyContact.js`, `QRProfile.js`, `MedicalRecord.js`

### 8. Hospital & Clinic Operations Command Hub
- **Frontend View**: [hospital_dashboard.html](file:///c:/Users/USER/Downloads/lifeqr-complete/app/hospital_dashboard.html) / [clinic_dashboard.html](file:///c:/Users/USER/Downloads/lifeqr-complete/app/clinic_dashboard.html)
- **Controller Logic**: [hospital-dashboard.js](file:///c:/Users/USER/Downloads/lifeqr-complete/app/js/hospital-dashboard.js)
- **Backend Route**: [hospitals.js](file:///c:/Users/USER/Downloads/lifeqr-complete/backend/routes/v1/hospitals.js) (`/api/v1/hospitals/...`)
- **Capabilities**: Inpatient Admissions Registry, Ward & Bed Allocation Matrix (Trauma Bays, ICU, General Wards), On-Duty Specialist Roster, Emergency Blood Bank & Supplies Vault, Fast Patient Intake via LifeQR auto-fill.
- **Database Models**: `Hospital.js`, `PatientProfile.js`, `Doctor.js`, `User.js`

### 9. Smart Emergency NFC Card System
- **Module Directory**: `nfc-card/`
- **Documentation**: [README.md](file:///c:/Users/USER/Downloads/lifeqr-complete/nfc-card/README.md), [IDEAS_AND_FEATURES.md](file:///c:/Users/USER/Downloads/lifeqr-complete/nfc-card/IDEAS_AND_FEATURES.md), [ARCHITECTURE.md](file:///c:/Users/USER/Downloads/lifeqr-complete/nfc-card/ARCHITECTURE.md)
- **Interactive Simulator**: [demo-simulator.html](file:///c:/Users/USER/Downloads/lifeqr-complete/nfc-card/demo-simulator.html)
- **Hardware & Chip Standards**: ISO/IEC 14443 Type A, 13.56 MHz, NXP NTAG216 (888B offline EEPROM), NTAG424 DNA (AES-128 SUN CMAC)
- **Database Models & Schemas**: `nfc-card/schemas/NfcCard.js`, `nfc-card/schemas/nfcCard.schema.json`
- **Features**: 0.5s zero-login tap, dual-tier privacy (bystander vs verified paramedic), offline NDEF emergency telegram, tap-to-dispatch geolocated SOS, Web NFC in-browser flashing.

### 10. Help & Support Ticket Clearinghouse
- **Frontend Views**: Dedicated Help Modals across [patient_dashboard.html](file:///c:/Users/USER/Downloads/lifeqr-complete/app/patient_dashboard.html), [doctor_dashboard.html](file:///c:/Users/USER/Downloads/lifeqr-complete/app/doctor_dashboard.html), [CrewAmbulance_dashboard.html](file:///c:/Users/USER/Downloads/lifeqr-complete/app/CrewAmbulance_dashboard.html) and Admin Clearinghouse tab in [admin_dashboard.html](file:///c:/Users/USER/Downloads/lifeqr-complete/app/admin_dashboard.html).
- **Frontend Logic**: `patient-dashboard.js`, `doctor-dashboard.js`, `crew-dashboard.js`, `admin-dashboard.js`
- **Backend Route**: [helpTickets.js](file:///c:/Users/USER/Downloads/lifeqr-complete/backend/routes/v1/helpTickets.js) (`/api/v1/help-tickets`)
- **Database Model**: `backend/models/HelpTicket.js`
- **Features**: Category & priority tagging, auto-linked patient QR code context, live Socket.IO alerts to `admin:all` and user rooms, status filtering (`PENDING`, `IN_PROGRESS`, `RESOLVED`), and 1-click admin resolution.

### 11. Universal Admin User Profile Handling & Troubleshooting System
- **Frontend View**: `#adminUserProfileModal` in [admin_dashboard.html](file:///c:/Users/USER/Downloads/lifeqr-complete/app/admin_dashboard.html)
- **Frontend Logic**: `admin-dashboard.js` (`openAdminUserProfile()`, `renderRoleSpecificForm()`, `handleAdminProfileSave()`, `adminRegenerateUserQR()`)
- **Backend Routes**: [admin.js](file:///c:/Users/USER/Downloads/lifeqr-complete/backend/routes/v1/admin.js) (`GET /api/v1/admin/users`, `GET /api/v1/admin/users/:id/profile`, `PUT /api/v1/admin/users/:id/profile`, `POST /api/v1/admin/users/:id/regenerate-qr`)
- **Capabilities**: Universal management for Patients (blood group, age, allergies, chronic conditions, medications, emergency contacts, QR badge regeneration), Doctors (specialization, license, hospital, council, verification status), Ambulance Crew (vehicle number, crew type, station, organization), and Administrators; password reset override with `UserSecurity` synchronization; seamless ticket-to-profile troubleshooting with auto-resolution notes.

### 12. Admin Emergency View Customization & Live Mobile Simulator
- **Frontend Views**: `#adminEmergencyViewCustomizationSection` and `#adminEmergencyPreviewModal` in [admin_dashboard.html](file:///c:/Users/USER/Downloads/lifeqr-complete/app/admin_dashboard.html)
- **Frontend Logic**: [admin-dashboard.js](file:///c:/Users/USER/Downloads/lifeqr-complete/app/js/admin-dashboard.js) (`openEmergencyLivePreview()`, `setEmergencyPreviewMode()`, `changeEmergencyPreviewLang()`, `scrollToEmergencyCustomization()`, `renderEmergencyPreviewContent()`) and [emergency-access.js](file:///c:/Users/USER/Downloads/lifeqr-complete/app/js/emergency-access.js)
- **Backend Routes**: [admin.js](file:///c:/Users/USER/Downloads/lifeqr-complete/backend/routes/v1/admin.js) (`PUT /api/v1/admin/users/:id/profile`), [emergencyCredentials.js](file:///c:/Users/USER/Downloads/lifeqr-complete/backend/routes/v1/emergencyCredentials.js) (`GET /api/v1/emergency-access/:token`)
- **Database Model**: `PatientProfile.js` (`emergencyViewSettings` schema)
- **Capabilities**: Fine-grained emergency view customization (theme colors, high-risk allergy flash alerts, resuscitation/DNR directives, organ donor callout, sensitive medication masking, bystander phone masking, custom emergency banner notices, language defaults), and real-time interactive mobile phone HUD simulator modal supporting instant toggling between Bystander and Paramedic clearance views.

### 13. Security Access Audit Log & Emergency Scan Isolation
- **Frontend Views**: Hidden card `#securityAuditLogCard` in [patient_dashboard.html](file:///c:/Users/USER/Downloads/lifeqr-complete/app/patient_dashboard.html); Section 4 `#adminUserAuditSection` in `#adminUserProfileModal` in [admin_dashboard.html](file:///c:/Users/USER/Downloads/lifeqr-complete/app/admin_dashboard.html).
- **Frontend Logic**: [patient-dashboard.js](file:///c:/Users/USER/Downloads/lifeqr-complete/app/js/patient-dashboard.js) (`loadActivities()`), [admin-dashboard.js](file:///c:/Users/USER/Downloads/lifeqr-complete/app/js/admin-dashboard.js) (`openAdminUserProfile()`).
- **Backend Routes**: [patientProfile.js](file:///c:/Users/USER/Downloads/lifeqr-complete/backend/routes/v1/patientProfile.js) (`GET /api/v1/patient/me` sanitizes `activities` for non-admins), [admin.js](file:///c:/Users/USER/Downloads/lifeqr-complete/backend/routes/v1/admin.js) (`GET /api/v1/admin/users/:id/profile`).
- **Capabilities**: Complete security isolation ensuring regular patients cannot see the Security Access Audit Log or emergency QR scan trail. Strictly revealed only to administrators (and in admin clearinghouse modal inspection).

### 14. Hospital Operations, Inpatient Admissions & Bed Matrix
- **Frontend Views**: `#hospitalAdmissionSection` in [doctor_dashboard.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/doctor_dashboard.html), [hospital_dashboard.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/hospital_dashboard.html), [er_dashboard.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/er_dashboard.html), and `#doctorHistoryCard` (Doctor & Hospital History) in [patient_dashboard.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/patient_dashboard.html).
- **Frontend Logic**: [doctor-dashboard.js](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/js/doctor-dashboard.js) (`admitPatientToHospital()`, `updateSuggestedBed()`, `loadDoctorHospitalBedMetrics()`), [hospital-dashboard.js](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/js/hospital-dashboard.js) (`setupSocketListeners()`, `loadHospitalMetrics()`, `loadAdmissionsList()`), [patient-dashboard.js](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/js/patient-dashboard.js) (`loadDoctorHistory()`).
- **Backend Routes**: [hospitals.js](file:///c:/Users/tarun/Downloads/lifeqr-complete/backend/routes/v1/hospitals.js) (`POST /api/v1/hospitals/admissions`, `PUT /api/v1/hospitals/admissions/:id/discharge`, `GET /api/v1/hospitals/metrics`, `GET /api/v1/hospitals/admissions`), [doctorAccess.js](file:///c:/Users/tarun/Downloads/lifeqr-complete/backend/routes/v1/doctorAccess.js) (`GET /api/v1/doctor-access/history`).
- **Database Models**: `PatientProfile.js` (`activities`, `medicalHistory`), `Hospital.js`, `Doctor.js`.
- **Capabilities**: Real-time bed allocation (Trauma Bays 1-4, ICU Wing, General Wards), live bed count telemetry, Socket.IO broadcast (`hospital:er`, `doctor:all`, `patient:<userId>`), seamless cross-linking from physician workstation consultations into hospital command, and unified patient-facing timeline of doctor consultations and inpatient stays with trauma severity indicators.

### 15. Tactical 24/7 Ambulance Radar Map & Proximity SOS Dispatch Mesh
- **Frontend Views**: `#crewTacticalRadarMap`, `#crewActiveSosFeed`, `#sosDispatchModal` in [CrewAmbulance_dashboard.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/CrewAmbulance_dashboard.html); `#sosDispatchedTopBanner`, `#sosDispatchedModal` in [patient_dashboard.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/patient_dashboard.html).
- **Frontend Logic**: [crew-dashboard.js](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/js/crew-dashboard.js) (`initCrewTacticalMap()`, `startCrewLiveTracking()`, `renderSosBeaconOnMap()`, `openSosDispatchModal()`, `acceptCurrentSosDispatch()`, `calculateDistanceKm()`); [patient-dashboard.js](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/js/patient-dashboard.js) (`handleSosDispatchAccepted()`, `playRescueChime()`, `closeSosDispatchedModal()`, `reopenSosDispatchedModal()`).
- **Backend Routes**: [sos.js](file:///c:/Users/tarun/Downloads/lifeqr-complete/backend/routes/v1/sos.js) (`POST /api/v1/sos/crew/location`, `GET /api/v1/sos/active`, `POST /api/v1/sos/accept`, `POST /api/v1/sos/sos`).
- **Database Models**: `CrewProfile.js` (`currentLocation`, `status`), `AmbulanceCrew.js`, `PatientProfile.js` (`sosAlerts`, `activities`), `User.js`.
- **Socket.IO Pipeline**: `sos-alert` (emits to `crew:all`), `sos-dispatch-accepted` (emits directly to `patient:<userId>` and `crew:all`), `sos-claimed` (emits to `crew:all`).
- **Capabilities**: Active 24-hr live GPS tracking via `navigator.geolocation.watchPosition` with automatic backend push; dynamic 2.5–3.0 KM dispatch perimeter circle; Haversine proximity filtering with emergency synthesizer audio alarm; interactive pulsing red LifeQR SOS logo markers plotted at victim coordinates; 1-click modal dispatch review; immediate patient notification with crew name, direct 1-tap call button, vehicle unit, base station, and estimated arrival time. Zero demo delays.

### 16. Ambulance Crew Duty Status Management (On-Duty / Off-Duty Toggle)
- **Frontend Views**: `#crewDutyToggleBtn`, `#crewDutyStatusBadge`, `#crewDutyStateDesc` in [CrewAmbulance_dashboard.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/CrewAmbulance_dashboard.html).
- **Frontend Logic**: [crew-dashboard.js](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/js/crew-dashboard.js) (`toggleCrewDutyStatus()`, `updateCrewDutyUI()`, `loadCrewDutyStatus()`).
- **Backend Routes**: [ambulance.js](file:///c:/Users/tarun/Downloads/lifeqr-complete/backend/routes/v1/ambulance.js) (`GET /api/v1/ambulance/duty-status`, `PUT /api/v1/ambulance/duty-status`).
- **Database Models**: `CrewProfile.js` (`status`: `AVAILABLE` / `OFF_DUTY`, `dutyStatus`: `ON_DUTY` / `OFF_DUTY`), `AmbulanceCrew.js` (`isAvailable`, `dutyStatus`).
- **Capabilities**: Crew members can switch between On-Duty and Off-Duty states directly from their dashboard. When off-duty, real-time geolocation push is halted, proximity emergency sirens are silenced, and incoming dispatch routing excludes the vehicle until they toggle back on-duty.

### 17. Super-Administrator God Mode & Full Platform Command Center
- **Frontend Views**:
  - [app/admin_dashboard.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/admin_dashboard.html) and [website/admin_dashboard.html](file:///c:/Users/tarun/Downloads/lifeqr-complete/website/admin_dashboard.html)
  - `#sectionSosCommand` (City-Wide Emergency SOS Incident Hub & Dispatch Override)
  - `#sectionFleetControl` (Ambulance Fleet & Duty Master Command)
  - `#sectionGodMode` (1-Click Platform Integrity Self-Healing & Live Audio/Visual Broadcast Console)
  - `#adminCreateUserModal` (Universal User Account Creator with dynamic role forms for Patient, Doctor, Crew, Hospital, Admin)
  - `#adminUserProfileModal` (Enhanced with God-Mode System Role Migration and User Purge)
- **Frontend Logic**:
  - [app/js/admin-dashboard.js](file:///c:/Users/tarun/Downloads/lifeqr-complete/app/js/admin-dashboard.js) & [website/js/admin-dashboard.js](file:///c:/Users/tarun/Downloads/lifeqr-complete/website/js/admin-dashboard.js)
  - `openCreateUserModal()`, `handleAdminCreateUserSubmit()`, `adminDeleteUser()`, `adminRunSystemRepair()`, `adminSendBroadcast()`, `loadAdminSosIncidents()`, `adminOverrideSosStatus()`, `adminDeleteSos()`, `loadAdminFleet()`, `adminToggleCrewDuty()`, `adminDeleteTicket()`.
- **Backend Routes**: [admin.js](file:///c:/Users/tarun/Downloads/lifeqr-complete/backend/routes/v1/admin.js)
  - `POST /api/v1/admin/users`: Universal account creation across all 5 roles with auto-provisioned schemas and cryptographic QR code generation.
  - `DELETE /api/v1/admin/users/:id`: Cascading account purge across all 11 system collections with admin self-lockout prevention.
  - `PUT /api/v1/admin/users/:id/role`: Instant role promotion and schema migration.
  - `GET /api/v1/admin/sos`: Aggregated emergency distress incidents across standalone and embedded schemas.
  - `PUT /api/v1/admin/sos/:sosId/status`: Force status override (`RESOLVED`, `CREW_DISPATCHED`, `ACTIVE`).
  - `DELETE /api/v1/admin/sos/:sosId`: Purge false alarm emergency beacons.
  - `GET /api/v1/admin/crew/fleet`: Complete EMS fleet status, duty registry, and live coordinates.
  - `PUT /api/v1/admin/crew/:crewId/duty`: Admin override to force ambulance crews On-Duty / Off-Duty.
  - `POST /api/v1/admin/system/repair`: 1-Click Platform Integrity Self-Healing engine (audits all accounts, auto-heals missing profiles, synchronizes `UserSecurity`, re-mints corrupt QR codes, resolves stale >24h SOS beacons).
  - `POST /api/v1/admin/broadcast`: Real-time system announcement audio/visual sirens dispatched over Socket.IO (`crew:all`, `doctor:all`, `patient:all`, or global).
  - `DELETE /api/v1/admin/help-tickets/:id`: Help desk ticket purge.
- **Database Models**: `User.js`, `UserSecurity.js`, `PatientProfile.js`, `DoctorProfile.js`, `Doctor.js`, `CrewProfile.js`, `AmbulanceCrew.js`, `HospitalProfile.js`, `Hospital.js`, `VerificationDocument.js`, `HelpTicket.js`, `EmergencyCredential.js`, `SOS.js`.
- **Security & Reliability**: Strictly guarded by `auth` + `roles('admin')` middleware; admin self-deletion guard returns HTTP 400; zero demo mocks or bypass buttons; fully verified with automated test suites and real browser sessions.

