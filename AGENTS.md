# Agent Guidelines & Operating Rules — LifeQR

Welcome AI Agent. You are operating on **LifeQR**, a critical emergency medical
information system built for Patients and Ambulance Crews.

---

## 🧠 MANDATORY PRE-TASK WORKFLOW

Before executing any research, modification, or code generation:

1. **Read `brain/master-memory.md` FIRST**: Get a compressed overview of the
   architecture, key decisions, active patterns, and known pitfalls.
2. **Consult Specific Memory Files**:
   - For system design & routing: Check
     [architecture.md](file:///c:/Users/USER/Downloads/lifeqr-complete/brain/architecture.md).
   - For coding conventions & protocols: Check
     [patterns.md](file:///c:/Users/USER/Downloads/lifeqr-complete/brain/patterns.md).
   - For bug fixes & past issues: Check
     [mistakes.md](file:///c:/Users/USER/Downloads/lifeqr-complete/brain/mistakes.md).
   - For feature file mapping: Check
     [feature-map.md](file:///c:/Users/USER/Downloads/lifeqr-complete/brain/feature-map.md).

---

## 🚑 Core Engineering Principles

1. **Separation of Concerns**:
   - `website/`: Public marketing landing page & presentation site
     (`index.html`, branding).
   - `app/`: Emergency medical dashboards (`patient_dashboard.html`,
     `CrewAmbulance_dashboard.html`, `doctor_dashboard.html`,
     `admin_dashboard.html`, `emergency_access.html`).
   - `backend/`: Node.js Express REST API (v1), MongoDB models, Socket.IO live
     SOS server.

2. **Security & Data Integrity**:
   - Can store plain text passwords but cannot use it anywhere or expose it to
     any user; and can also use hashing using `bcryptjs`.
   - Never hardcode secrets; use environment variables from `backend/.env`.
   - Strictly scope patient health profile access and audit every access event
     via `logEvent`.

3. **Real-time SOS Communication**:
   - Patient SOS triggers broadcast immediately over Socket.IO to room
     `crew:all` and update individual room `patient:<id>`.

4. **Zero Demo Features Policy (Strict Real-World Production Standard)**:
   - Absolutely **NO demo features**, fake mockups, superficial stubs, or bypass demo buttons.
   - Every capability must be genuine, fully functional, production-grade, and backed by authentic backend routes, validated database models, and real workflows.
   - Never implement or maintain fake demo bypasses, mock data shortcuts, or dummy buttons in UI or backend logic.

5. **Post-Task Requirement (Memory Update)**:
   - When completing significant architecture changes, pattern additions, or bug
     fixes, update `brain/` files via the **Memory Agent** workflow.

6. **Distinct App vs Website View UI/UX (No Auto-Syncing)**:
   - `app/` and `website/` share the same backend and data models, but their user interfaces, form factors, and UI/UX are intentionally different (mobile app view with phone chassis, bottom navigation bar, sidebar drawer vs desktop website portal).
   - Some features exist specifically in `app/` and not in `website/` (or vice versa).
   - NEVER continuously or automatically sync whole HTML views, templates, or distinct scripts between directories.
   - Background file watchers and auto-sync on server boot are strictly disabled. Only shared theme tokens, stylesheets, and brand assets may be manually copied when explicitly needed.

