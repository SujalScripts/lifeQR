// Patient Dashboard JS Module
let currentUser = null;
let currentProfile = null;
let reportsPage = 1;
let activitiesPage = 1;

document.addEventListener('DOMContentLoaded', async () => {
  // Pre-populate username and cached fields from localStorage if available
  const cachedName = localStorage.getItem('userName');
  if (cachedName) {
    const nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = cachedName;
  }
  const cachedQr = localStorage.getItem('offline_qrCode');
  const cachedQrId = localStorage.getItem('offline_qrCodeId');
  if (cachedQr) {
    const qrImg = document.getElementById('qrCodeImage');
    if (qrImg) qrImg.src = cachedQr;
  }
  if (cachedQrId) {
    const qrVal = document.getElementById('qrCodeIdValue');
    if (qrVal) qrVal.textContent = cachedQrId;
  }

  // Check auth and role
  currentUser = await checkDashboardAccess(['patient']);
  if (!currentUser) return;

  // Immediately render data received from auth verification
  if (currentUser.name) {
    const nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = currentUser.name;
    const nameInput = document.getElementById('profileName');
    if (nameInput && !nameInput.value) nameInput.value = currentUser.name;
  }
  if (currentUser.qrCode) {
    const qrImg = document.getElementById('qrCodeImage');
    if (qrImg) qrImg.src = currentUser.qrCode;
    const qrVal = document.getElementById('qrCodeIdValue');
    if (qrVal && currentUser.qrCodeId) qrVal.textContent = currentUser.qrCodeId;
  }

  // Initialize Socket.IO connection for notifications
  initSocketConnection();

  // Load patient data
  await loadDashboardData();

  // Setup form listeners
  setupFormListeners();

  // Load active help requests
  loadPatientHelpTickets();
});

function initSocketConnection() {
  try {
    const socketUrl = (typeof window !== 'undefined' && window.API_URL)
      ? window.API_URL.replace(/\/api\/v1\/?$/, '')
      : window.location.origin;
    const socket = io(socketUrl, { withCredentials: true });

    socket.on('connect', () => {
      console.log('🔌 Patient socket connected:', socket.id);
    });
    
    // Real-time Ambulance Dispatch Accepted Alert
    socket.on('sos-dispatch-accepted', (data) => {
      console.log('🚨 Received sos-dispatch-accepted notification:', data);
      handleSosDispatchAccepted(data);
    });

    // Listen for authorized doctor accesses or SOS status updates
    socket.on('sos-acknowledged', (data) => {
      console.log('🚨 Received sos-acknowledged notification:', data);
      showToast(`Emergency crew (${data.responderName || 'Ambulance Responder'}) acknowledged your SOS alert!`, 'info', 8000);
      loadDashboardData();
    });

    // Listen for admin responses to help requests
    socket.on('help-ticket-updated', (data) => {
      showToast(`LifeQR Admin updated ticket ${data.ticketId} (${data.status})`, 'info');
      loadPatientHelpTickets();
    });
  } catch (e) {
    console.warn('Socket.IO connection failed. Offline notifications unavailable.');
  }
}

function playRescueChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Resonant rescue chime)
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.12);
      osc.stop(ctx.currentTime + idx * 0.12 + 0.65);
    });
  } catch (e) {
    // Non-blocking
  }
}

function handleSosDispatchAccepted(data) {
  playRescueChime();

  const crewName = data.crewName || 'Paramedic Unit';
  const crewPhone = data.crewPhone || '+91 98201 10800';
  const vehicle = data.vehicleNumber || 'AMB-UNIT-108';
  const station = data.station || 'Central Emergency Station';
  const eta = data.etaMinutes || 4;

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  // 1. Populate Modal
  setTxt('dispatchedCrewName', crewName);
  setTxt('dispatchedCrewPhone', crewPhone);
  setTxt('dispatchedVehicleNumber', vehicle);
  setTxt('dispatchedStation', station);
  setTxt('dispatchedEta', `~${eta} MINS`);

  const callBtn = document.getElementById('callCrewBtn');
  if (callBtn) {
    callBtn.href = `tel:${crewPhone.replace(/\s+/g, '')}`;
  }

  const modal = document.getElementById('sosDispatchedModal');
  if (modal) {
    modal.classList.remove('hidden');
  }

  // 2. Populate Persistent Top Banner
  setTxt('bannerCrewName', crewName);
  setTxt('bannerCrewPhone', crewPhone);
  setTxt('bannerVehicleNumber', vehicle);
  setTxt('bannerEta', `~${eta} Mins`);

  const bannerCallBtn = document.getElementById('bannerCallBtn');
  if (bannerCallBtn) {
    bannerCallBtn.href = `tel:${crewPhone.replace(/\s+/g, '')}`;
  }

  const banner = document.getElementById('sosDispatchedTopBanner');
  if (banner) {
    banner.classList.remove('hidden');
  }

  showToast(`🚨 AMBULANCE DISPATCHED: Paramedic ${crewName} (${crewPhone}) is en route to your location!`, 'emergency', 12000);
  loadDashboardData();
}

window.closeSosDispatchedModal = function() {
  const modal = document.getElementById('sosDispatchedModal');
  if (modal) modal.classList.add('hidden');
};

window.reopenSosDispatchedModal = function() {
  const modal = document.getElementById('sosDispatchedModal');
  if (modal) modal.classList.remove('hidden');
};

async function loadDashboardData() {
  showSkeletons();
  try {
    const response = await (window.authFetch 
      ? window.authFetch('/api/v1/patient/me') 
      : fetch((window.getApiUrl ? window.getApiUrl('/patient/me') : '/api/v1/patient/me'), { credentials: 'include' }));
    
    const data = await response.json();
    
    if (!response.ok) throw new Error(data.error || 'Failed to load details');
    
    currentUser = data.user || currentUser;
    currentProfile = data.profile || {};

    renderProfileDetails();
    renderQRDetails();
    await loadReports();
    await loadActivities();
    await loadDoctorHistory();
    await loadMedicalHistory();

    // Check for active dispatched SOS in profile to restore top banner on reload
    if (currentProfile && currentProfile.sosAlerts && currentProfile.sosAlerts.length > 0) {
      const activeDispatched = currentProfile.sosAlerts.find(a => a.status === 'dispatched' && a.acknowledgedBy);
      if (activeDispatched && activeDispatched.acknowledgedBy) {
        const ack = activeDispatched.acknowledgedBy;
        const banner = document.getElementById('sosDispatchedTopBanner');
        if (banner) {
          const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
          };
          setTxt('bannerCrewName', ack.name || 'Paramedic Unit');
          setTxt('bannerCrewPhone', ack.phone || '+91 98201 10800');
          setTxt('bannerVehicleNumber', ack.vehicleNumber || 'AMB-UNIT-108');
          setTxt('bannerEta', 'Unit En Route');
          const callBtn = document.getElementById('bannerCallBtn');
          if (callBtn && ack.phone) {
            callBtn.href = `tel:${ack.phone.replace(/\s+/g, '')}`;
          }
          banner.classList.remove('hidden');
        }
      }
    }

  } catch (err) {
    console.error('loadDashboardData error:', err);
    showToast(err.message || 'Failed to load details', 'error');
    if (currentUser) {
      renderProfileDetails();
      renderQRDetails();
    }
  } finally {
    hideSkeletons();
  }
}

function showSkeletons() {
  document.querySelectorAll('.dashboard-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.dashboard-skeleton').forEach(el => el.classList.remove('hidden'));
}

function hideSkeletons() {
  document.querySelectorAll('.dashboard-skeleton').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.dashboard-content').forEach(el => el.classList.remove('hidden'));
}

function renderProfileDetails() {
  if (!currentUser) return;

  const nameEl = document.getElementById('userName');
  if (nameEl) nameEl.textContent = currentUser.name || 'Patient';

  const nameInput = document.getElementById('profileName');
  if (nameInput) nameInput.value = currentUser.name || '';

  const phoneInput = document.getElementById('profilePhone');
  if (phoneInput) phoneInput.value = currentUser.phone || '+91 ';

  const addrInput = document.getElementById('profileAddress');
  if (addrInput) addrInput.value = currentUser.address || '';

  const cityInput = document.getElementById('profileCity');
  if (cityInput) cityInput.value = currentUser.city || '';

  const stateInput = document.getElementById('profileState');
  if (stateInput) stateInput.value = currentUser.state || '';

  const genderInput = document.getElementById('profileGender');
  if (genderInput) genderInput.value = currentUser.gender || '';
  
  const ageInput = document.getElementById('profileAge');
  if (ageInput) ageInput.value = currentProfile?.age || '';

  const bloodInput = document.getElementById('profileBloodGroup');
  if (bloodInput) bloodInput.value = currentProfile?.bloodGroup || '';

  const allergiesInput = document.getElementById('profileAllergies');
  if (allergiesInput) allergiesInput.value = currentProfile?.allergies || '';

  const medsInput = document.getElementById('profileMedications');
  if (medsInput) medsInput.value = currentProfile?.medications || '';

  const healthIssuesInput = document.getElementById('profileHealthIssues');
  if (healthIssuesInput) healthIssuesInput.value = currentProfile?.healthIssues || '';

  // Render profile photo
  const photoUrl = currentUser.profilePhoto
    ? ((window.getApiUrl ? window.getApiUrl('/patient/photo') : '/api/v1/patient/photo') + '?t=' + Date.now())
    : 'https://www.w3schools.com/howto/img_avatar.png';

  const photoEl = document.getElementById('userProfilePhoto');
  if (photoEl) photoEl.src = photoUrl;

  const normalPhoto = document.getElementById('normalUserProfilePhoto');
  if (normalPhoto) normalPhoto.src = photoUrl;

  const modalPreview = document.getElementById('photoModalPreview');
  if (modalPreview) modalPreview.src = photoUrl;

  // Set toggle visibility state
  const toggle = document.getElementById('publicProfileToggle');
  if (toggle) toggle.checked = currentProfile?.publicProfile !== false;

  // Render multiple emergency contacts
  const contactsList = document.getElementById('emergencyContactsContainer');
  if (contactsList) {
    contactsList.innerHTML = '';
    const contacts = currentProfile?.emergencyContacts || [];
    if (contacts.length === 0) {
      contactsList.innerHTML = `<p class="text-xs text-[#111111]/60 font-mono italic">No emergency contacts configured.</p>`;
    } else {
      contacts.forEach((c) => {
        const contactRow = document.createElement('div');
        contactRow.className = 'flex justify-between items-center p-3.5 bg-[#f9fafb] border-2 border-[#111111]';
        contactRow.innerHTML = `
          <div>
            <p class="font-black text-[#111111] text-xs uppercase tracking-tight">${c.name} ${c.relationship ? `<span class="text-[#E11D2E] font-mono font-bold">(${c.relationship})</span>` : ''}</p>
            <p class="text-xs font-mono font-bold text-[#111111]/70 mt-0.5">${c.phone}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 border border-[#111111] bg-white text-[#111111] text-[10px] font-mono font-bold uppercase">Priority ${c.priority || 1}</span>
            <a href="tel:${c.phone}" class="p-1.5 bg-[#111111] text-white hover:bg-[#E11D2E] transition flex items-center justify-center">
              <span class="material-symbols-outlined text-sm">call</span>
            </a>
          </div>
        `;
        contactsList.appendChild(contactRow);
      });
    }
  }

  // Populate emergency contact form fields
  const contacts = currentProfile?.emergencyContacts || [];
  for (let i = 1; i <= 3; i++) {
    const contact = contacts[i - 1] || {};
    const nameInput = document.getElementById(`emergencyContactName${i}`);
    const phoneInput = document.getElementById(`emergencyContactPhone${i}`);
    const relInput = document.getElementById(`emergencyContactRelationship${i}`);
    if (nameInput) nameInput.value = contact.name || '';
    if (phoneInput) phoneInput.value = contact.phone || '+91 ';
    if (relInput) relInput.value = contact.relationship || '';
  }

  // Populate Normal View Elements (Read-only view shown first)
  const normalName = document.getElementById('normalProfileName');
  if (normalName) normalName.textContent = currentUser.name || 'Patient';

  if (normalPhoto && photoEl) {
    normalPhoto.src = photoEl.src;
  }

  const normalMeta = document.getElementById('normalProfileMeta');
  if (normalMeta) {
    const ageStr = currentProfile?.age ? `${currentProfile.age} Yrs` : 'Age Unspecified';
    const genderStr = currentUser?.gender ? currentUser.gender.toUpperCase() : 'Gender Unspecified';
    const phoneStr = currentUser?.phone ? currentUser.phone : 'No Phone';
    normalMeta.textContent = `${ageStr} • ${genderStr} • Phone: ${phoneStr}`;
  }

  const normalBlood = document.getElementById('normalBloodGroupDisplay');
  if (normalBlood) normalBlood.textContent = currentProfile?.bloodGroup || '--';

  const normalPhoneDisp = document.getElementById('normalPhoneDisplay');
  if (normalPhoneDisp) normalPhoneDisp.textContent = currentUser?.phone || 'Not Registered';

  const normalLocDisp = document.getElementById('normalLocationDisplay');
  if (normalLocDisp) {
    const city = currentUser?.city || '';
    const state = currentUser?.state || '';
    normalLocDisp.textContent = (city && state ? `${city}, ${state}` : (city || state || '--'));
  }

  const normalFullAddr = document.getElementById('normalFullAddressDisplay');
  if (normalFullAddr) {
    const addr = currentUser?.address || '';
    const city = currentUser?.city || '';
    const state = currentUser?.state || '';
    const full = [addr, city, state].filter(Boolean).join(', ');
    normalFullAddr.textContent = full || 'No residential address registered';
  }

  const normalPublicBadge = document.getElementById('normalPublicBadge');
  if (normalPublicBadge) {
    const isPublic = currentProfile?.publicProfile !== false;
    if (isPublic) {
      normalPublicBadge.textContent = 'PUBLIC QR ACTIVE';
      normalPublicBadge.className = 'px-2 py-0.5 border border-emerald-600 bg-emerald-50 text-emerald-800 text-[10px] font-mono font-bold uppercase';
    } else {
      normalPublicBadge.textContent = 'PRIVATE QR ONLY';
      normalPublicBadge.className = 'px-2 py-0.5 border border-neutral-600 bg-neutral-100 text-neutral-800 text-[10px] font-mono font-bold uppercase';
    }
  }

  // Populate Normal Allergies
  const normalAllergies = document.getElementById('normalAllergiesContainer');
  if (normalAllergies) {
    const rawAllergies = currentProfile?.allergies;
    let list = [];
    if (Array.isArray(rawAllergies)) {
      list = rawAllergies;
    } else if (typeof rawAllergies === 'string' && rawAllergies.trim()) {
      list = rawAllergies.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (list.length === 0) {
      normalAllergies.innerHTML = `
        <span class="px-2 py-0.5 border border-emerald-600 bg-emerald-50 text-emerald-800 text-[11px] font-mono font-bold flex items-center gap-1">
          <span class="material-symbols-outlined text-xs">verified</span>
          <span>No known severe drug or food allergies reported</span>
        </span>
      `;
    } else {
      normalAllergies.innerHTML = list.map(item => `
        <span class="px-2.5 py-1 border border-[#E11D2E] bg-red-100 text-[#E11D2E] text-xs font-mono font-bold flex items-center gap-1 shadow-[1px_1px_0px_#111111]">
          <span class="material-symbols-outlined text-xs">warning</span>
          <span>${item.toUpperCase()}</span>
        </span>
      `).join('');
    }
  }

  // Populate Normal Medications
  const normalMeds = document.getElementById('normalMedicationsContainer');
  if (normalMeds) {
    const rawMeds = currentProfile?.medications;
    let list = [];
    if (Array.isArray(rawMeds)) {
      list = rawMeds;
    } else if (typeof rawMeds === 'string' && rawMeds.trim()) {
      list = rawMeds.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (list.length === 0) {
      normalMeds.innerHTML = `
        <span class="text-xs text-gray-500 font-mono italic">No active daily prescription medications listed</span>
      `;
    } else {
      normalMeds.innerHTML = list.map(item => `
        <span class="px-2.5 py-1 border border-[#111111] bg-gray-100 text-[#111111] text-xs font-mono font-bold flex items-center gap-1 shadow-[1px_1px_0px_#111111]">
          <span class="material-symbols-outlined text-xs">medication</span>
          <span>${item}</span>
        </span>
      `).join('');
    }
  }

  // Populate Normal Health Issues
  const normalHealth = document.getElementById('normalHealthIssuesContainer');
  if (normalHealth) {
    const rawIssues = currentProfile?.healthIssues;
    let list = [];
    if (Array.isArray(rawIssues)) {
      list = rawIssues;
    } else if (typeof rawIssues === 'string' && rawIssues.trim()) {
      list = rawIssues.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (list.length === 0) {
      normalHealth.innerHTML = `
        <span class="text-xs text-gray-500 font-mono italic">No chronic medical conditions listed</span>
      `;
    } else {
      normalHealth.innerHTML = list.map(item => `
        <span class="px-2.5 py-1 border border-[#111111] bg-[#f9fafb] text-[#111111] text-xs font-mono font-bold flex items-center gap-1 shadow-[1px_1px_0px_#111111]">
          <span class="material-symbols-outlined text-xs">vital_signs</span>
          <span>${item}</span>
        </span>
      `).join('');
    }
  }
}

window.toggleEditProfile = function(show) {
  const editSec = document.getElementById('profileEditSection');
  if (!editSec) return;

  const isHidden = editSec.classList.contains('hidden');
  const willShow = show !== undefined ? show : isHidden;

  if (willShow) {
    editSec.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const nameInput = document.getElementById('profileName');
    if (nameInput) setTimeout(() => nameInput.focus(), 150);
  } else {
    editSec.classList.add('hidden');
    document.body.style.overflow = '';
  }
};

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const cropModal = document.getElementById('photoCropModal');
    if (cropModal && !cropModal.classList.contains('hidden')) {
      if (typeof window.cancelCropModal === 'function') window.cancelCropModal();
      return;
    }
    const editSec = document.getElementById('profileEditSection');
    if (editSec && !editSec.classList.contains('hidden')) {
      window.toggleEditProfile(false);
    }
  }
});

function renderQRDetails() {
  const qrCode = currentProfile?.qrCode || currentUser?.qrCode;
  const qrCodeId = currentProfile?.qrCodeId || currentUser?.qrCodeId;

  if (qrCode) {
    const qrImg = document.getElementById('qrCodeImage');
    if (qrImg) qrImg.src = qrCode;
    localStorage.setItem('offline_qrCode', qrCode);
  }
  if (qrCodeId) {
    const qrVal = document.getElementById('qrCodeIdValue');
    if (qrVal) qrVal.textContent = qrCodeId;
    localStorage.setItem('offline_qrCodeId', qrCodeId);
  }
  if (currentUser?.name) {
    localStorage.setItem('offline_name', currentUser.name);
  }
  if (currentProfile?.bloodGroup) {
    localStorage.setItem('offline_bloodGroup', currentProfile.bloodGroup);
  }
}

async function loadReports() {
  try {
    const apiUrl = window.getApiUrl ? window.getApiUrl(`/reports?page=${reportsPage}&limit=4`) : `/api/v1/reports?page=${reportsPage}&limit=4`;
    const response = await (window.authFetch ? window.authFetch(apiUrl) : fetch(apiUrl, { credentials: 'include' }));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    const container = document.getElementById('medicalReportsList');
    if (!container) return;
    container.innerHTML = '';

    if (!data.reports || data.reports.length === 0) {
      container.innerHTML = `
        <div class="text-center p-8 bg-[#f9fafb] border-2 border-[#111111]">
          <span class="material-symbols-outlined text-4xl text-[#111111]/40">description</span>
          <p class="text-xs font-mono font-bold text-[#111111]/60 mt-2 uppercase tracking-wider">No medical reports uploaded yet.</p>
        </div>
      `;
      const pagEl = document.getElementById('reportsPagination');
      if (pagEl) pagEl.innerHTML = '';
      return;
    }

    data.reports.forEach(r => {
      const card = document.createElement('div');
      card.className = 'p-4 bg-white border-2 border-[#111111] shadow-[4px_4px_0px_#111111] flex justify-between items-center transition hover:-translate-y-0.5';
      card.innerHTML = `
        <div style="flex-1; min-width: 0;">
          <h4 class="font-black text-[#111111] text-xs sm:text-sm uppercase tracking-tight truncate">${r.originalName}</h4>
          <p class="text-[10px] font-mono font-bold text-[#E11D2E] uppercase mt-0.5">${r.category} &bull; ${new Date(r.uploadedAt).toLocaleDateString()}</p>
          <p class="text-xs text-[#111111]/70 truncate mt-1 font-medium italic">${r.description || 'No description'}</p>
        </div>
        <a href="${r.url}" target="_blank" class="p-2 border-2 border-[#111111] bg-white hover:bg-[#111111] hover:text-white transition flex items-center justify-center">
          <span class="material-symbols-outlined text-sm">visibility</span>
        </a>
      `;
      container.appendChild(card);
    });

    renderPagination('reportsPagination', data.pagination || {}, 'reportsPage', loadReports);

  } catch (err) {
    console.warn('loadReports notice:', err.message);
  }
}

async function loadActivities() {
  const auditCard = document.getElementById('securityAuditLogCard');

  // Security Access Audit Log is strictly restricted to administrators
  if (!currentUser || currentUser.role !== 'admin') {
    if (auditCard) auditCard.classList.add('hidden');
    return;
  }

  // Revealed exclusively to administrators
  if (auditCard) auditCard.classList.remove('hidden');

  try {
    const apiUrl = window.getApiUrl ? window.getApiUrl('/patient/me') : '/api/v1/patient/me';
    const response = await (window.authFetch ? window.authFetch(apiUrl) : fetch(apiUrl, { credentials: 'include' }));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    const list = (data.profile && data.profile.activities) || [];
    const container = document.getElementById('activitiesList');
    if (!container) return;
    container.innerHTML = '';

    // Paginate manually on client
    const limit = 4;
    const startIndex = (activitiesPage - 1) * limit;
    const paginated = list.slice(startIndex, startIndex + limit);

    if (paginated.length === 0) {
      container.innerHTML = `
        <div class="text-center p-6 bg-[#f9fafb] border-2 border-[#111111]">
          <p class="text-xs font-mono font-bold text-[#111111]/60 uppercase tracking-wider">No activity recorded yet.</p>
        </div>
      `;
      const pagEl = document.getElementById('activitiesPagination');
      if (pagEl) pagEl.innerHTML = '';
      return;
    }

    paginated.forEach(a => {
      const row = document.createElement('div');
      row.className = 'flex gap-3 items-start border-b-2 border-[#111111]/10 pb-3 last:border-b-0 last:pb-0';
      row.innerHTML = `
        <div class="w-8 h-8 border-2 border-[#111111] bg-white flex items-center justify-center text-[#E11D2E] flex-shrink-0">
          <span class="material-symbols-outlined text-sm">history</span>
        </div>
        <div style="flex-1;">
          <p class="text-xs font-black text-[#111111] uppercase tracking-tight">${a.title}</p>
          <p class="text-xs text-[#111111]/70 mt-0.5 font-medium">${a.description}</p>
          <span class="text-[10px] font-mono text-[#111111]/50 block mt-1 uppercase font-bold">${new Date(a.timestamp).toLocaleString()}</span>
        </div>
      `;
      container.appendChild(row);
    });

    const paginationData = {
      currentPage: activitiesPage,
      totalPages: Math.ceil(list.length / limit) || 1,
      hasNextPage: startIndex + limit < list.length,
      hasPrevPage: activitiesPage > 1
    };
    renderPagination('activitiesPagination', paginationData, 'activitiesPage', loadActivities);

  } catch (err) {
    console.warn('loadActivities notice:', err.message);
  }
}

async function loadDoctorHistory() {
  try {
    const apiUrl = window.getApiUrl ? window.getApiUrl('/doctor-access/history') : '/api/v1/doctor-access/history';
    const response = await (window.authFetch ? window.authFetch(apiUrl) : fetch(apiUrl, { credentials: 'include' }));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    const container = document.getElementById('doctorHistoryContainer') || document.getElementById('doctorAccessRequests');
    const badge = document.getElementById('doctorHistoryCountBadge');
    if (!container) return;
    container.innerHTML = '';

    const pendingRequests = data.pendingRequests || [];
    const hospitalAdmissions = data.hospitalAdmissions || [];
    const consultations = data.consultations || [];
    const clinicalEntries = data.clinicalEntries || [];
    const medicalRecords = data.medicalRecords || [];
    const authorizedDoctors = data.authorizedDoctors || [];

    const totalCount = pendingRequests.length + hospitalAdmissions.length + consultations.length + clinicalEntries.length + medicalRecords.length + authorizedDoctors.length;
    if (badge) {
      badge.textContent = `${totalCount} ${totalCount === 1 ? 'Record' : 'Records'}`;
    }

    if (totalCount === 0) {
      container.innerHTML = `
        <div class="text-center p-5 bg-[#f9fafb] border-2 border-[#111111] space-y-1.5">
          <div class="w-9 h-9 mx-auto border-2 border-[#111111] bg-white flex items-center justify-center text-[#E11D2E]">
            <span class="material-symbols-outlined text-lg">local_hospital</span>
          </div>
          <p class="font-black text-xs uppercase text-[#111111]">No Doctor or Hospital Records Yet</p>
          <p class="text-[10px] font-mono text-gray-500 leading-normal">Verified doctor consultations, hospital admissions, inpatient ward allocations, and clinical diagnoses will appear here.</p>
        </div>
      `;
      return;
    }

    // 1. Pending Access Requests (Priority Action at top)
    pendingRequests.forEach(r => {
      const row = document.createElement('div');
      row.className = 'p-3 bg-amber-50 border-2 border-[#111111] space-y-2 shadow-[2px_2px_0px_#111111]';
      row.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <span class="px-1.5 py-0.2 bg-amber-600 text-white font-mono text-[9px] font-bold uppercase tracking-wider">Access Request</span>
            <p class="text-xs font-black text-[#111111] uppercase tracking-tight mt-1">Dr. ${r.metadata?.doctorName || 'Doctor'}</p>
            <p class="text-[10px] font-mono font-bold text-[#111111]/70 mt-0.5 uppercase">${r.metadata?.specialization || 'Attending Physician'} &bull; ${r.metadata?.hospital || 'Clinical Centre'}</p>
          </div>
          <span class="material-symbols-outlined text-amber-800 text-base">lock_open</span>
        </div>
        <div class="flex gap-2 justify-end pt-1 border-t border-[#111111]/20">
          <button onclick="respondToRequest('${r.metadata?.requestId}', false)" class="btn-secondary text-[10px] px-2.5 py-1 uppercase font-mono tracking-wider font-bold">Decline</button>
          <button onclick="respondToRequest('${r.metadata?.requestId}', true)" class="btn-primary text-[10px] px-3 py-1 uppercase font-mono tracking-wider font-bold">Authorize</button>
        </div>
      `;
      container.appendChild(row);
    });

    // 2. Hospital Admissions & Inpatient Stays
    hospitalAdmissions.forEach(adm => {
      const meta = adm.metadata || {};
      const dateStr = adm.timestamp ? new Date(adm.timestamp).toLocaleDateString() : 'Active';
      const timeStr = adm.timestamp ? new Date(adm.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const ward = meta.ward || 'Emergency / Inpatient Ward';
      const bed = meta.bedNumber ? `Bed ${meta.bedNumber}` : '';
      const triage = (meta.triageLevel || 'URGENT').toUpperCase();
      const doctor = meta.attendingDoctor ? `Attending: ${meta.attendingDoctor}` : 'Attending Physician';
      const isDischarged = adm.type === 'Hospital Discharge' || meta.status === 'discharged';
      
      const row = document.createElement('div');
      row.className = `p-3.5 border-2 border-[#111111] space-y-2 shadow-[2px_2px_0px_#111111] ${isDischarged ? 'bg-gray-50' : 'bg-red-50/50'}`;
      row.innerHTML = `
        <div class="flex justify-between items-start">
          <div class="space-y-0.5">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="px-1.5 py-0.5 ${isDischarged ? 'bg-gray-800' : 'bg-[#E11D2E]'} text-white font-mono text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                <span class="material-symbols-outlined text-[10px]">local_hospital</span>
                <span>${isDischarged ? 'Hospital Discharge' : 'Hospital Inpatient Admission'}</span>
              </span>
              <span class="px-1.5 py-0.5 border border-[#111111] bg-white font-mono text-[9px] font-bold uppercase">${triage}</span>
            </div>
            <p class="text-xs font-black text-[#111111] uppercase tracking-tight mt-1">${ward} ${bed ? `&bull; ${bed}` : ''}</p>
            <p class="text-[10px] font-mono text-gray-700 font-bold uppercase">${doctor} &bull; Metro City Central Hospital</p>
          </div>
          <span class="material-symbols-outlined text-[#E11D2E] text-base">${isDischarged ? 'check_circle' : 'hotel'}</span>
        </div>
        ${adm.description ? `<p class="text-[11px] font-sans text-gray-700 bg-white p-2 border border-[#111111]/20">${adm.description}</p>` : ''}
        <div class="flex justify-between items-center text-[10px] font-mono text-gray-500 pt-1 border-t border-[#111111]/10">
          <span>Facility: Metro City Central ER Hub</span>
          <span>${dateStr} ${timeStr}</span>
        </div>
      `;
      container.appendChild(row);
    });

    // 3. Doctor Consultations
    consultations.forEach(c => {
      const docName = c.doctorId?.name ? `Dr. ${c.doctorId.name}` : 'Attending Physician';
      const dateStr = new Date(c.createdAt || c.scheduledAt).toLocaleDateString();
      const row = document.createElement('div');
      row.className = 'p-3 bg-white border-2 border-[#111111] space-y-1.5 shadow-[2px_2px_0px_#111111]';
      row.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <p class="text-xs font-black text-[#111111] uppercase tracking-tight flex items-center gap-1">
              <span class="material-symbols-outlined text-sm text-[#E11D2E]">medical_services</span>
              <span>${docName}</span>
            </p>
            <p class="text-[10px] font-mono font-bold text-[#111111]/60 uppercase">${c.chiefComplaint || 'Consultation Encounter'}</p>
          </div>
          <span class="px-1.5 py-0.5 border border-emerald-600 bg-emerald-50 text-emerald-800 text-[9px] font-mono font-bold uppercase">Consultation</span>
        </div>
        ${c.diagnosis ? `<p class="text-[11px] font-mono font-bold text-[#E11D2E] bg-red-50 p-1.5 border border-[#111111]/10">Dx: ${c.diagnosis}</p>` : ''}
        <div class="flex justify-between items-center text-[10px] font-mono text-gray-500 pt-1 border-t border-gray-100">
          <span>Status: ${c.status ? c.status.toUpperCase() : 'COMPLETED'}</span>
          <span>${dateStr}</span>
        </div>
      `;
      container.appendChild(row);
    });

    // 4. Clinical History Entries from Doctors & Hospital Wards
    clinicalEntries.forEach(entry => {
      const isHospital = (entry.author && entry.author.role === 'hospital') ||
                         (entry.title && (entry.title.toLowerCase().includes('hospital') || entry.title.toLowerCase().includes('admission') || entry.title.toLowerCase().includes('ward')));
      const dateStr = entry.recordDate || entry.date ? new Date(entry.recordDate || entry.date).toLocaleDateString() : 'Recorded';
      const authorName = entry.author?.name || entry.doctorOrHospital || (isHospital ? 'Hospital Medical Staff' : 'Attending Physician');

      const row = document.createElement('div');
      row.className = 'p-3 bg-white border-2 border-[#111111] space-y-1.5 shadow-[2px_2px_0px_#111111]';
      row.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="px-1.5 py-0.2 ${isHospital ? 'bg-red-800' : 'bg-[#111111]'} text-white font-mono text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                <span class="material-symbols-outlined text-[10px]">${isHospital ? 'local_hospital' : 'medical_services'}</span>
                <span>${isHospital ? 'Hospital Clinical Entry' : 'Doctor Clinical Finding'}</span>
              </span>
            </div>
            <p class="text-xs font-black text-[#111111] uppercase tracking-tight mt-1">${entry.title || 'Clinical Encounter'}</p>
            <p class="text-[10px] font-mono text-gray-600 font-bold uppercase">${authorName}</p>
          </div>
          <span class="text-[9px] font-mono text-gray-500">${dateStr}</span>
        </div>
        ${entry.diagnosis ? `<p class="text-[11px] font-mono font-bold text-[#E11D2E] bg-red-50 p-1.5 border border-[#111111]/10">Dx: ${entry.diagnosis}</p>` : ''}
        ${entry.treatment ? `<p class="text-[11px] font-mono text-gray-800 bg-gray-50 p-1.5 border border-[#111111]/10">Rx / Plan: ${entry.treatment}</p>` : ''}
        ${entry.description && entry.description !== entry.title ? `<p class="text-[11px] font-sans text-gray-700 line-clamp-2">${entry.description}</p>` : ''}
      `;
      container.appendChild(row);
    });

    // 5. Clinical Medical Records from Doctors & Hospitals
    medicalRecords.forEach(m => {
      const dateStr = new Date(m.recordDate || m.createdAt).toLocaleDateString();
      const row = document.createElement('div');
      row.className = 'p-3 bg-[#f9fafb] border-2 border-[#111111] space-y-1';
      row.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <p class="text-xs font-black text-[#111111] uppercase tracking-tight">${m.title || 'Clinical Encounter Note'}</p>
            <p class="text-[10px] font-mono text-gray-600 uppercase font-bold">${m.doctorOrHospital || 'Attending Physician'}</p>
          </div>
          <span class="text-[9px] font-mono text-gray-500">${dateStr}</span>
        </div>
        ${m.notes ? `<p class="text-[11px] font-sans text-gray-700 line-clamp-2">${m.notes}</p>` : ''}
      `;
      container.appendChild(row);
    });

    // 6. Authorized Attending Doctors
    authorizedDoctors.forEach(doc => {
      const dateStr = doc.grantedAt ? new Date(doc.grantedAt).toLocaleDateString() : 'Active';
      const row = document.createElement('div');
      row.className = 'p-3 bg-white border-2 border-[#111111] space-y-1';
      row.innerHTML = `
        <div class="flex justify-between items-center">
          <div>
            <p class="text-xs font-black text-[#111111] uppercase tracking-tight">Dr. ${doc.name || 'Authorized Doctor'}</p>
            <p class="text-[10px] font-mono text-gray-500 font-bold">Authorized: ${dateStr}</p>
          </div>
          <button onclick="revokeDoctorAccess('${doc.doctorId}')" class="px-2 py-0.5 border border-[#111111] bg-white text-[9px] font-mono font-bold uppercase hover:bg-red-50 hover:text-[#E11D2E] transition" title="Revoke Access">
            Revoke
          </button>
        </div>
      `;
      container.appendChild(row);
    });

  } catch (err) {
    console.warn('loadDoctorHistory notice:', err.message);
  }
}

window.loadAccessRequests = loadDoctorHistory;

window.revokeDoctorAccess = async function(doctorId) {
  try {
    const apiUrl = window.getApiUrl ? window.getApiUrl('/doctor-access/revoke') : '/api/v1/doctor-access/revoke';
    const response = await (window.authFetch 
      ? window.authFetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doctorId })
        })
      : fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ doctorId })
        }));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    showToast('Doctor access revoked successfully', 'info');
    await loadDoctorHistory();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.respondToRequest = async function(requestId, approve) {
  try {
    const apiUrl = window.getApiUrl ? window.getApiUrl('/doctor-access/respond') : '/api/v1/doctor-access/respond';
    const response = await (window.authFetch 
      ? window.authFetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId, approve })
        })
      : fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ requestId, approve })
        }));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    
    showToast(approve ? 'Request approved successfully!' : 'Request rejected successfully.', 'success');
    await loadDashboardData();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

async function loadMedicalHistory() {
  try {
    const apiUrl = window.getApiUrl ? window.getApiUrl('/history') : '/api/v1/history';
    const response = await (window.authFetch ? window.authFetch(apiUrl) : fetch(apiUrl, { credentials: 'include' }));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    const container = document.getElementById('historyTimelineContainer');
    if (!container) return;
    container.innerHTML = '';

    if (!data.history || data.history.length === 0) {
      container.innerHTML = `
        <div class="text-center p-8 bg-[#f9fafb] border-2 border-[#111111]">
          <div class="w-12 h-12 border-2 border-[#111111] bg-white text-[#E11D2E] flex items-center justify-center mx-auto mb-2">
            <span class="material-symbols-outlined text-2xl">timeline</span>
          </div>
          <p class="text-xs font-black text-[#111111] uppercase tracking-tight">No medical history logged yet</p>
          <p class="text-[11px] font-mono font-bold text-[#111111]/60 mt-0.5 uppercase">Use the form below to record symptoms or vital measurements.</p>
        </div>
      `;
      return;
    }

    data.history.forEach(h => {
      const item = document.createElement('div');
      item.className = 'relative pl-7 pb-5 last:pb-0 group';
      
      let icon = 'medical_services';
      let badgeClass = 'border border-[#111111] bg-white text-[#111111]';
      let dotBg = 'bg-[#111111]';
      
      if (h.type === 'vital') {
        icon = 'favorite';
        badgeClass = 'border border-[#E11D2E] bg-red-50 text-[#E11D2E]';
        dotBg = 'bg-[#E11D2E]';
      } else if (h.type === 'symptom') {
        icon = 'thermostat';
        badgeClass = 'border border-amber-600 bg-amber-50 text-amber-800';
        dotBg = 'bg-amber-600';
      } else if (h.type === 'treatment') {
        icon = 'medication';
        badgeClass = 'border border-blue-600 bg-blue-50 text-blue-800';
        dotBg = 'bg-blue-600';
      }

      const authorRole = h.author ? h.author.role : 'patient';
      const rawDate = h.timestamp || h.date || h.createdAt;
      const dateStr = rawDate && !isNaN(new Date(rawDate).getTime()) 
        ? new Date(rawDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) 
        : 'Recent';

      item.innerHTML = `
        <!-- Vertical connecting line -->
        <div class="absolute left-[11px] top-4 bottom-0 w-0.5 bg-[#111111] group-last:hidden"></div>
        
        <!-- Timeline node dot -->
        <span class="absolute left-0 top-0.5 w-6 h-6 border-2 border-[#111111] ${dotBg} text-white flex items-center justify-center z-10">
          <span class="material-symbols-outlined text-[12px]">${icon}</span>
        </span>
        
        <!-- Timeline card content -->
        <div class="bg-white p-4 border-2 border-[#111111] shadow-[4px_4px_0px_#111111] transition hover:-translate-y-0.5">
          <div class="flex items-center justify-between gap-2 mb-1.5 pb-2 border-b-2 border-[#111111]/10">
            <h5 class="font-black text-[#111111] text-xs sm:text-sm tracking-tight uppercase">${h.title}</h5>
            <span class="px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider font-bold ${badgeClass}">${h.type || 'entry'}</span>
          </div>
          <p class="text-xs text-[#111111]/80 leading-relaxed font-medium mb-3">${h.description}</p>
          <div class="flex items-center justify-between pt-2 border-t border-[#111111]/10 text-[10px] font-mono font-bold text-[#111111]/60">
            <span class="flex items-center gap-1">
              <span class="material-symbols-outlined text-xs text-[#E11D2E]">person</span>
              LOGGED BY <strong class="text-[#111111]">${authorName}</strong> (${authorRole.toUpperCase()})
            </span>
            <span>${dateStr}</span>
          </div>
        </div>
      `;
      container.appendChild(item);
    });
  } catch (err) {
    console.warn('loadMedicalHistory notice:', err.message);
  }
}

function renderPagination(containerId, pagination, pageVarName, callback) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  
  if (!pagination || pagination.totalPages <= 1) return;

  const btnPrev = document.createElement('button');
  btnPrev.className = `btn-secondary text-xs px-3 py-1.5 uppercase font-mono font-bold tracking-wider ${pagination.hasPrevPage ? '' : 'opacity-40 cursor-not-allowed pointer-events-none'}`;
  btnPrev.textContent = 'Prev';
  btnPrev.disabled = !pagination.hasPrevPage;
  btnPrev.onclick = () => {
    if (pageVarName === 'reportsPage') reportsPage--;
    if (pageVarName === 'activitiesPage') activitiesPage--;
    callback();
  };

  const pageNum = document.createElement('span');
  pageNum.className = 'text-xs font-mono font-bold text-[#111111] px-3 flex items-center uppercase';
  pageNum.textContent = `Page ${pagination.currentPage || 1} / ${pagination.totalPages || 1}`;

  const btnNext = document.createElement('button');
  btnNext.className = `btn-secondary text-xs px-3 py-1.5 uppercase font-mono font-bold tracking-wider ${pagination.hasNextPage ? '' : 'opacity-40 cursor-not-allowed'}`;
  btnNext.textContent = 'Next';
  btnNext.disabled = !pagination.hasNextPage;
  btnNext.onclick = () => {
    if (pageVarName === 'reportsPage') reportsPage++;
    if (pageVarName === 'activitiesPage') activitiesPage++;
    callback();
  };

  container.appendChild(btnPrev);
  container.appendChild(pageNum);
  container.appendChild(btnNext);
}

function setupFormListeners() {
  const profileForm = document.getElementById('profileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('saveProfileBtn') || e.target.querySelector('button[type="submit"]');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Saving...';
      }

      try {
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        // Restructure emergency contacts
        const contacts = [];
        for (let i = 1; i <= 3; i++) {
          const nameInput = document.getElementById(`emergencyContactName${i}`);
          const phoneInput = document.getElementById(`emergencyContactPhone${i}`);
          const relInput = document.getElementById(`emergencyContactRelationship${i}`);
          const nameVal = nameInput ? nameInput.value.trim() : '';
          const phoneVal = phoneInput ? phoneInput.value.trim() : '';
          const relVal = relInput ? relInput.value.trim() : '';
          if (nameVal && phoneVal && phoneVal !== '+91' && phoneVal !== '+91 ') {
            contacts.push({ name: nameVal, phone: phoneVal, relationship: relVal });
          }
        }
        data.emergencyContacts = contacts;

        const apiUrl = window.getApiUrl ? window.getApiUrl('/patient/update') : '/api/v1/patient/update';
        const response = await (window.authFetch 
          ? window.authFetch(apiUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            })
          : fetch(apiUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(data)
            }));
        const res = await response.json();
        if (!response.ok) throw new Error(res.error);

        showToast('Profile updated successfully!', 'success');
        await loadDashboardData();
        if (window.toggleEditProfile) window.toggleEditProfile(false);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<span>Save Medical Profile Changes</span><span class="material-symbols-outlined text-sm">check</span>';
        }
      }
    });
  }

  // Report Upload Listener
  const reportForm = document.getElementById('reportUploadForm');
  if (reportForm) {
    reportForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('uploadReportBtn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Uploading...';
      }

      try {
        const formData = new FormData(e.target);
        const apiUrl = window.getApiUrl ? window.getApiUrl('/reports/upload') : '/api/v1/reports/upload';
        const response = await (window.authFetch 
          ? window.authFetch(apiUrl, { method: 'POST', body: formData })
          : fetch(apiUrl, { method: 'POST', credentials: 'include', body: formData }));
        const res = await response.json();
        if (!response.ok) throw new Error(res.error);

        showToast('Report uploaded successfully!', 'success');
        e.target.reset();
        await loadReports();
        await loadActivities();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Upload Document';
        }
      }
    });
  }

  // Toggle Visibility Listener
  const toggleBtn = document.getElementById('publicProfileToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('change', async (e) => {
      try {
        const apiUrl = window.getApiUrl ? window.getApiUrl('/patient/visibility') : '/api/v1/patient/visibility';
        const response = await (window.authFetch 
          ? window.authFetch(apiUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ publicProfile: e.target.checked })
            })
          : fetch(apiUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ publicProfile: e.target.checked })
            }));
        const res = await response.json();
        if (!response.ok) throw new Error(res.error);
        showToast(`Profile visibility changed to ${e.target.checked ? 'Public' : 'Private'}.`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Symptom / Vital add listener (if form is present)
  const symptomForm = document.getElementById('symptomForm');
  if (symptomForm) {
    symptomForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('addHistoryBtn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Adding...';
      }

      try {
        const type = document.getElementById('historyType').value;
        const title = document.getElementById('historyTitle').value;
        const description = document.getElementById('historyDesc').value;

        const apiUrl = window.getApiUrl ? window.getApiUrl('/history/add') : '/api/v1/history/add';
        const response = await (window.authFetch 
          ? window.authFetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type, title, description })
            })
          : fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ type, title, description })
            }));
        const res = await response.json();
        if (!response.ok) throw new Error(res.error);

        showToast('Timeline entry added successfully!', 'success');
        e.target.reset();
        await loadMedicalHistory();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Add Entry';
        }
      }
    });
  }
}

// Profile Photo Modal & Picker Handlers
window.openPhotoUploadModal = function() {
  const modal = document.getElementById('photoUploadModal');
  if (modal) {
    modal.classList.remove('hidden');
    // Sync current photo in modal preview
    const normalPhoto = document.getElementById('normalUserProfilePhoto');
    const modalPreview = document.getElementById('photoModalPreview');
    if (modalPreview && normalPhoto) {
      modalPreview.src = normalPhoto.src;
    }
  }
};

window.closePhotoUploadModal = function() {
  const modal = document.getElementById('photoUploadModal');
  if (modal) modal.classList.add('hidden');
  const statusEl = document.getElementById('photoUploadStatus');
  if (statusEl) statusEl.classList.add('hidden');
};

window.triggerGalleryPicker = function() {
  const fileInput = document.getElementById('profilePhotoInput');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
};

window.triggerCameraPicker = function() {
  const cameraInput = document.getElementById('profileCameraInput');
  if (cameraInput) {
    cameraInput.value = '';
    cameraInput.click();
  }
};

// ============================================================
// PROFILE PHOTO CROPPER & 1080x1080 RESOLUTION ENFORCEMENT
// ============================================================

let cropSession = {
  img: null,
  file: null,
  originalWidth: 0,
  originalHeight: 0,
  objectUrl: null,
  scaleMultiplier: 1,
  baseScale: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  listenersAttached: false
};

// Entry point when user selects/takes a photo
window.uploadProfilePhoto = function(file) {
  if (!file) {
    const fileInput = document.getElementById('profilePhotoInput');
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      file = fileInput.files[0];
    }
  }
  if (!file) {
    const cameraInput = document.getElementById('profileCameraInput');
    if (cameraInput && cameraInput.files && cameraInput.files.length > 0) {
      file = cameraInput.files[0];
    }
  }
  if (!file) return;

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!allowedTypes.includes(file.type)) {
    showToast('Invalid file format. Please upload a JPG or PNG image.', 'error');
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    showToast('Image file exceeds 8MB. Please select a smaller photo.', 'error');
    return;
  }

  // Inspect dimensions to verify if 1080x1080
  const img = new Image();
  const objectUrl = URL.createObjectURL(file);
  img.onload = function() {
    const width = img.naturalWidth;
    const height = img.naturalHeight;

    if (width === 1080 && height === 1080) {
      // Exactly 1080x1080 - proceed directly
      URL.revokeObjectURL(objectUrl);
      window.performPhotoUpload(file, false);
    } else {
      // Dimensions are NOT 1080x1080 - ask for crop & launch 1080x1080 cropping tool!
      window.openCropModal(img, file, width, height, objectUrl);
    }
  };
  img.onerror = function() {
    URL.revokeObjectURL(objectUrl);
    showToast('Could not decode image. Please choose a valid image.', 'error');
  };
  img.src = objectUrl;
};

window.openCropModal = function(img, file, width, height, objectUrl) {
  // Hide parent photo modal if open
  closePhotoUploadModal();

  const cropModal = document.getElementById('photoCropModal');
  if (!cropModal) return;

  cropSession.img = img;
  cropSession.file = file;
  cropSession.originalWidth = width;
  cropSession.originalHeight = height;
  cropSession.objectUrl = objectUrl;
  cropSession.rotation = 0;
  cropSession.scaleMultiplier = 1;
  cropSession.offsetX = 0;
  cropSession.offsetY = 0;

  const dimText = document.getElementById('cropDimensionText');
  if (dimText) {
    dimText.textContent = `Original: ${width} × ${height}px`;
  }

  const slider = document.getElementById('cropZoomSlider');
  if (slider) slider.value = 1;

  const statusEl = document.getElementById('cropProcessStatus');
  if (statusEl) statusEl.classList.add('hidden');

  const btn = document.getElementById('applyCropBtn');
  if (btn) btn.disabled = false;

  cropModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  initCropCanvas();
  redrawCropPreview();
};

window.cancelCropModal = function() {
  const cropModal = document.getElementById('photoCropModal');
  if (cropModal) cropModal.classList.add('hidden');
  document.body.style.overflow = '';

  if (cropSession.objectUrl) {
    try { URL.revokeObjectURL(cropSession.objectUrl); } catch(e){}
    cropSession.objectUrl = null;
  }
  cropSession.img = null;
  cropSession.file = null;

  // Clear inputs so re-selecting same file fires onchange
  const fileInput = document.getElementById('profilePhotoInput');
  if (fileInput) fileInput.value = '';
  const cameraInput = document.getElementById('profileCameraInput');
  if (cameraInput) cameraInput.value = '';
};

function initCropCanvas() {
  const canvas = document.getElementById('cropPreviewCanvas');
  const container = document.getElementById('cropViewportContainer');
  if (!canvas || !container) return;

  canvas.width = 640;
  canvas.height = 640;

  const maxDim = Math.min(cropSession.originalWidth, cropSession.originalHeight);
  cropSession.baseScale = 640 / Math.max(maxDim, 1);

  if (cropSession.listenersAttached) return;
  cropSession.listenersAttached = true;

  // Mouse pan
  container.addEventListener('mousedown', (e) => {
    e.preventDefault();
    cropSession.isDragging = true;
    container.style.cursor = 'grabbing';
    cropSession.dragStartX = e.clientX - cropSession.offsetX;
    cropSession.dragStartY = e.clientY - cropSession.offsetY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!cropSession.isDragging) return;
    cropSession.offsetX = e.clientX - cropSession.dragStartX;
    cropSession.offsetY = e.clientY - cropSession.dragStartY;
    redrawCropPreview();
  });

  window.addEventListener('mouseup', () => {
    if (cropSession.isDragging) {
      cropSession.isDragging = false;
      const c = document.getElementById('cropViewportContainer');
      if (c) c.style.cursor = 'grab';
    }
  });

  // Touch pan for mobile
  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      cropSession.isDragging = true;
      const t = e.touches[0];
      cropSession.dragStartX = t.clientX - cropSession.offsetX;
      cropSession.dragStartY = t.clientY - cropSession.offsetY;
    }
  }, { passive: false });

  container.addEventListener('touchmove', (e) => {
    if (!cropSession.isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    cropSession.offsetX = t.clientX - cropSession.dragStartX;
    cropSession.offsetY = t.clientY - cropSession.dragStartY;
    redrawCropPreview();
  }, { passive: false });

  container.addEventListener('touchend', () => {
    cropSession.isDragging = false;
  });

  // Wheel zoom
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    adjustCropZoom(delta);
  }, { passive: false });
}

function redrawCropPreview() {
  const canvas = document.getElementById('cropPreviewCanvas');
  if (!canvas || !cropSession.img) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  const container = document.getElementById('cropViewportContainer');
  const dispW = (container ? container.clientWidth : 320) || 320;
  const scaleRatio = canvas.width / dispW;

  ctx.translate(canvas.width / 2 + cropSession.offsetX * scaleRatio, canvas.height / 2 + cropSession.offsetY * scaleRatio);
  ctx.rotate((cropSession.rotation * Math.PI) / 180);

  const drawScale = cropSession.baseScale * cropSession.scaleMultiplier;
  const w = cropSession.originalWidth * drawScale;
  const h = cropSession.originalHeight * drawScale;

  ctx.drawImage(cropSession.img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

window.adjustCropZoom = function(delta) {
  const slider = document.getElementById('cropZoomSlider');
  let current = parseFloat(slider ? slider.value : 1);
  let next = Math.max(0.5, Math.min(3, current + delta));
  if (slider) slider.value = next;
  window.onCropZoomInput(next);
};

window.onCropZoomInput = function(val) {
  cropSession.scaleMultiplier = parseFloat(val) || 1;
  redrawCropPreview();
};

window.rotateCropImage = function() {
  cropSession.rotation = (cropSession.rotation + 90) % 360;
  redrawCropPreview();
};

window.resetCropPosition = function() {
  cropSession.offsetX = 0;
  cropSession.offsetY = 0;
  cropSession.scaleMultiplier = 1;
  cropSession.rotation = 0;
  const slider = document.getElementById('cropZoomSlider');
  if (slider) slider.value = 1;
  redrawCropPreview();
};

window.applyAndUploadCrop = function() {
  if (!cropSession.img) return;

  const btn = document.getElementById('applyCropBtn');
  const statusEl = document.getElementById('cropProcessStatus');
  if (btn) btn.disabled = true;
  if (statusEl) statusEl.classList.remove('hidden');

  // Render to offscreen canvas strictly at 1080x1080
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = 1080;
  exportCanvas.height = 1080;
  const exportCtx = exportCanvas.getContext('2d');
  exportCtx.imageSmoothingEnabled = true;
  exportCtx.imageSmoothingQuality = 'high';

  const container = document.getElementById('cropViewportContainer');
  const dispW = (container ? container.clientWidth : 320) || 320;
  const scaleRatio = 1080 / dispW;

  exportCtx.translate(540 + cropSession.offsetX * scaleRatio, 540 + cropSession.offsetY * scaleRatio);
  exportCtx.rotate((cropSession.rotation * Math.PI) / 180);

  const exportBaseScale = 1080 / Math.min(cropSession.originalWidth, cropSession.originalHeight);
  const drawScale = exportBaseScale * cropSession.scaleMultiplier;
  const w = cropSession.originalWidth * drawScale;
  const h = cropSession.originalHeight * drawScale;

  exportCtx.drawImage(cropSession.img, -w / 2, -h / 2, w, h);

  exportCanvas.toBlob(async function(blob) {
    if (!blob) {
      if (btn) btn.disabled = false;
      if (statusEl) statusEl.classList.add('hidden');
      showToast('Cropping error occurred. Please try again.', 'error');
      return;
    }

    const croppedFile = new File([blob], 'patient-avatar-1080x1080.jpg', { type: 'image/jpeg' });
    cancelCropModal();
    await window.performPhotoUpload(croppedFile, true);

    if (btn) btn.disabled = false;
    if (statusEl) statusEl.classList.add('hidden');
  }, 'image/jpeg', 0.92);
};

window.performPhotoUpload = async function(file, isCropped) {
  if (!file) return;

  const statusEl = document.getElementById('photoUploadStatus');
  if (statusEl) statusEl.classList.remove('hidden');

  // Instant local preview
  const reader = new FileReader();
  reader.onload = function(e) {
    const localUrl = e.target.result;
    const normalPhoto = document.getElementById('normalUserProfilePhoto');
    if (normalPhoto) normalPhoto.src = localUrl;
    const photoEl = document.getElementById('userProfilePhoto');
    if (photoEl) photoEl.src = localUrl;
    const modalPreview = document.getElementById('photoModalPreview');
    if (modalPreview) modalPreview.src = localUrl;
  };
  reader.readAsDataURL(file);

  const formData = new FormData();
  formData.append('photo', file);

  try {
    const apiUrl = window.getApiUrl ? window.getApiUrl('/patient/upload-photo') : '/api/v1/patient/upload-photo';
    const response = await (window.authFetch 
      ? window.authFetch(apiUrl, { method: 'POST', body: formData })
      : fetch(apiUrl, { method: 'POST', credentials: 'include', body: formData }));
    const res = await response.json();
    if (!response.ok) throw new Error(res.error || 'Failed to upload photo');

    showToast(isCropped ? 'Profile photo cropped to 1080×1080 & updated!' : 'Profile photo updated successfully!', 'success');

    const freshUrl = (window.getApiUrl ? window.getApiUrl('/patient/photo') : '/api/v1/patient/photo') + '?t=' + Date.now();
    const normalPhoto = document.getElementById('normalUserProfilePhoto');
    if (normalPhoto) normalPhoto.src = freshUrl;
    const photoEl = document.getElementById('userProfilePhoto');
    if (photoEl) photoEl.src = freshUrl;
    const modalPreview = document.getElementById('photoModalPreview');
    if (modalPreview) modalPreview.src = freshUrl;

    if (currentUser) {
      currentUser.profilePhoto = res.profilePhoto;
    }

    setTimeout(() => {
      closePhotoUploadModal();
    }, 400);
  } catch (err) {
    showToast(err.message || 'Error uploading profile photo', 'error');
  } finally {
    if (statusEl) statusEl.classList.add('hidden');
    const fileInput = document.getElementById('profilePhotoInput');
    if (fileInput) fileInput.value = '';
    const cameraInput = document.getElementById('profileCameraInput');
    if (cameraInput) cameraInput.value = '';
  }
};

// Regenerate QR
window.regenerateQR = async function() {
  try {
    const apiUrl = window.getApiUrl ? window.getApiUrl('/patient/regenerate-qr') : '/api/v1/patient/regenerate-qr';
    const response = await (window.authFetch 
      ? window.authFetch(apiUrl, { method: 'POST' })
      : fetch(apiUrl, { method: 'POST', credentials: 'include' }));
    const res = await response.json();
    if (!response.ok) throw new Error(res.error);
    showToast('QR Code successfully regenerated!', 'success');
    await loadDashboardData();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// Trigger SOS
window.triggerEmergencySOS = async function() {
  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your browser.', 'error');
    return;
  }

  showToast('Acquiring location coordinates...', 'info');

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    try {
      const apiUrl = window.getApiUrl ? window.getApiUrl('/sos/sos') : '/api/v1/sos/sos';
      const response = await (window.authFetch 
        ? window.authFetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng, message: 'Emergency Patient SOS Triggered!' })
          })
        : fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ lat, lng, message: 'Emergency Patient SOS Triggered!' })
          }));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      showToast('🚨 SOS Emergency broadcasted successfully!', 'emergency', 10000);
      await loadDashboardData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, (err) => {
    showToast(`Location access denied: ${err.message}. Triggering generic SOS...`, 'warning');
    // Fallback SOS without live coordinates
    triggerSOSWithFallback();
  }, { enableHighAccuracy: true });
};

async function triggerSOSWithFallback() {
  try {
    const apiUrl = window.getApiUrl ? window.getApiUrl('/sos/sos') : '/api/v1/sos/sos';
    const response = await (window.authFetch 
      ? window.authFetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: 0, lng: 0, message: 'SOS Alert - Geolocation unavailable' })
        })
      : fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ lat: 0, lng: 0, message: 'SOS Alert - Geolocation unavailable' })
        }));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    showToast('🚨 Emergency SOS alert sent without location.', 'emergency', 10000);
    await loadDashboardData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Share live location coordinate updates
window.shareLiveLocation = function() {
  if (!navigator.geolocation) {
    showToast('Geolocation is not supported.', 'error');
    return;
  }

  showToast('Starting live location tracking...', 'info');
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const apiUrl = window.getApiUrl ? window.getApiUrl('/patient/location') : '/api/v1/patient/location';
      const response = await (window.authFetch 
        ? window.authFetch(apiUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          })
        : fetch(apiUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          }));
      if (!response.ok) throw new Error();
      showToast('Live location coordinates updated!', 'success');
    } catch (e) {
      showToast('Failed to update live coordinates.', 'error');
    }
  });
};

// NFC Smart Medical Card Helper: Draw rounded rectangles safely across all browsers
function drawCardRoundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

// NFC Smart Medical Card Helper: Draw contactless wave symbol
function drawNfcWaves(ctx, x, y, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(x, y, i * 11, -Math.PI * 0.42, Math.PI * 0.42, false);
    ctx.stroke();
  }
  ctx.restore();
}

let currentCardImageBlobUrl = null;
let currentCardDataUrl = null;

// EMV Smart Contact Chip Helper (Brushed Metallic Gold)
function drawEmvChip(ctx, x, y, w, h) {
  ctx.save();
  const chipGrad = ctx.createLinearGradient(x, y, x + w, y + h);
  chipGrad.addColorStop(0, '#e5b651');
  chipGrad.addColorStop(0.25, '#fae08c');
  chipGrad.addColorStop(0.5, '#d49b28');
  chipGrad.addColorStop(0.75, '#f5d576');
  chipGrad.addColorStop(1, '#b57b12');
  ctx.fillStyle = chipGrad;
  drawCardRoundRect(ctx, x, y, w, h, 8, true, false);

  ctx.strokeStyle = '#8c590b';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Internal circuit contact trace lines
  ctx.strokeStyle = '#7c4d07';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + 10, y + h / 2);
  ctx.lineTo(x + w - 10, y + h / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + w * 0.34, y + 6);
  ctx.lineTo(x + w * 0.34, y + h - 6);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + w * 0.66, y + 6);
  ctx.lineTo(x + w * 0.66, y + h - 6);
  ctx.stroke();

  // Center contact pad
  drawCardRoundRect(ctx, x + w * 0.34, y + h * 0.26, w * 0.32, h * 0.48, 4, false, true);

  ctx.restore();
}

// Download Wallet Card: Generates and downloads a physical-ready ISO 7810 ID-1 NFC Smart Medical Card
window.downloadWalletCard = function() {
  const qrSrc = currentProfile?.qrCode || currentUser?.qrCode || localStorage.getItem('offline_qrCode') || document.getElementById('qrCodeImage')?.src;
  
  if (!qrSrc) {
    showToast('Patient QR code is still generating. Please wait a moment.', 'warning');
    return;
  }

  showToast('Generating NFC Smart Medical Card...', 'info');

  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 756;
  const ctx = canvas.getContext('2d');

  const name = (currentUser?.name || localStorage.getItem('offline_name') || 'Patient Identity').trim();
  const qrId = (currentProfile?.qrCodeId || currentUser?.qrCodeId || localStorage.getItem('offline_qrCodeId') || 'LQR-EMERGENCY').trim();

  const qrImg = new Image();
  qrImg.crossOrigin = 'anonymous';

  qrImg.onload = () => {
    // 1. Base Card Shell (Standard CR80 1200x756 with 36px rounded corners)
    ctx.save();
    drawCardRoundRect(ctx, 0, 0, 1200, 756, 36, false, false);
    ctx.clip();

    // Dark sleek obsidian brushed texture gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 1200, 756);
    bgGrad.addColorStop(0, '#070a11');
    bgGrad.addColorStop(0.35, '#101726');
    bgGrad.addColorStop(0.7, '#151f32');
    bgGrad.addColorStop(1, '#080b12');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1200, 756);

    // Subtle micro security grid watermark
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.028;
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= 1200; gx += 36) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, 756); ctx.stroke();
    }
    for (let gy = 0; gy <= 756; gy += 36) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(1200, gy); ctx.stroke();
    }
    ctx.restore();

    // Subtle concentric radar rings originating from the EMV/NFC zone
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.globalAlpha = 0.035;
    ctx.lineWidth = 1.2;
    for (let r = 80; r <= 600; r += 70) {
      ctx.beginPath();
      ctx.arc(120, 210, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Top Emergency Signal Bar (Red Stripe)
    ctx.fillStyle = '#E11D2E';
    ctx.fillRect(44, 24, 1112, 6);

    // 2. Header Row
    // LIFEQR Wordmark
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 38px "Archivo", "Archivo Black", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('LIFEQR', 52, 78);

    // Pulsing Signal Dot
    ctx.fillStyle = '#E11D2E';
    ctx.beginPath();
    ctx.arc(202, 68, 6.5, 0, Math.PI * 2);
    ctx.fill();

    // Subtitle
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillText('SMART NFC MEDICAL PASSPORT • ZERO-LOGIN RESCUE ACCESS', 52, 102);

    // Divider Line
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(44, 122);
    ctx.lineTo(1156, 122);
    ctx.stroke();

    // 3. Left Section: Chip, NFC & Identity
    // EMV Smart Contact Chip
    drawEmvChip(ctx, 52, 150, 110, 80);

    // Contactless Wave Symbol
    drawNfcWaves(ctx, 210, 190, '#E11D2E');

    // NFC Details Text beside waves
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 13px "Archivo", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('NFC CONTACTLESS', 255, 178);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillText('13.56 MHz • NTAG 424 DNA', 255, 198);

    ctx.fillStyle = '#10b981';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillText('● HARDWARE ENCRYPTED', 255, 218);

    // Cardholder Identity Box (y = 265)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillText('OFFICIAL CARDHOLDER IDENTITY', 52, 282);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 36px "Archivo", Arial, sans-serif';
    const displayPatientName = name.length > 22 ? name.substring(0, 20) + '...' : name;
    ctx.fillText(displayPatientName.toUpperCase(), 52, 324);

    // ID Badge Capsule
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = '#E11D2E';
    ctx.lineWidth = 1.5;
    drawCardRoundRect(ctx, 52, 344, 250, 36, 6, true, true);
    ctx.fillStyle = '#E11D2E';
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.fillText(`PERSON ID: ${qrId}`, 66, 368);

    // Physical Privacy Guarantee Notice Container (y = 405)
    ctx.fillStyle = '#0b111e';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    drawCardRoundRect(ctx, 52, 405, 615, 205, 10, true, true);

    // Left Red Bar in container
    ctx.fillStyle = '#E11D2E';
    ctx.fillRect(52, 405, 4, 205);

    ctx.fillStyle = '#f87171';
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillText('🔒 ZERO-KNOWLEDGE PHYSICAL PRIVACY ARCHITECTURE', 74, 435);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '500 14px "Archivo", sans-serif';
    ctx.fillText('All emergency health parameters, blood group, severe allergies, active', 74, 470);
    ctx.fillText('prescriptions, and emergency contacts are encrypted within this card.', 74, 496);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 13px "Archivo", sans-serif';
    ctx.fillText('Sensitive personal details remain strictly private on the physical card face.', 74, 532);
    ctx.fillText('First responders tap NFC or scan the QR code to open the secure rescue profile.', 74, 558);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillText('✓ INSTANT BYSTANDER & PARAMEDIC COMPATIBLE', 74, 592);

    // 4. Right Section: Scannable QR Core (x = 710, y = 145, w = 440, h = 505)
    // White Ceramic High-Contrast Mount
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    drawCardRoundRect(ctx, 710, 145, 440, 505, 18, true, true);

    // Top Black Mount Header Ribbon
    ctx.fillStyle = '#0f172a';
    drawCardRoundRect(ctx, 730, 165, 400, 32, 4, true, false);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FIELD RESCUE OPTICAL SCANNER', 710 + 440 / 2, 186);

    // Draw Live Scannable Patient QR Code (350x350)
    ctx.drawImage(qrImg, 755, 212, 350, 350);

    // Below QR Text
    ctx.fillStyle = '#E11D2E';
    ctx.font = '900 17px "Archivo", Arial, sans-serif';
    ctx.fillText('SCAN OR TAP IN EMERGENCY', 710 + 440 / 2, 592);

    ctx.fillStyle = '#475569';
    ctx.font = '600 12px "Archivo", sans-serif';
    ctx.fillText('Works with any smartphone camera or ambulance terminal', 710 + 440 / 2, 614);

    ctx.fillStyle = '#0f172a';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillText('NO APPLICATION OR LOGIN REQUIRED', 710 + 440 / 2, 634);

    // 5. Card Bottom Security Footer (y = 675, height = 44)
    ctx.fillStyle = '#060910';
    drawCardRoundRect(ctx, 44, 675, 1112, 44, 6, true, false);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('● OFFICIAL SMART MEDICAL PASSPORT • ISO 7810 ID-1 • FIELD ENCRYPTED PASS', 60, 702);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('EMERGENCY DISPATCH: 112 / 911 / 108 • WWW.LIFEQR.COM', 1136, 702);

    // Card Outer Bevel & Border
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    drawCardRoundRect(ctx, 0, 0, 1200, 756, 36, false, true);

    ctx.restore();

    // 7. Generate Data URL and Trigger Instant PNG Download
    currentCardDataUrl = canvas.toDataURL('image/png', 1.0);
    const cleanFilename = (name || 'Patient').replace(/[^a-zA-Z0-9_-]/g, '_');
    const downloadLink = document.createElement('a');
    downloadLink.download = `LifeQR-Smart-Medical-Card-${cleanFilename}.png`;
    downloadLink.href = currentCardDataUrl;
    downloadLink.click();

    // 8. Display Interactive Preview Modal
    const previewImg = document.getElementById('walletCardPreviewImg');
    if (previewImg) {
      previewImg.src = currentCardDataUrl;
    }
    const modal = document.getElementById('walletCardModal');
    if (modal) {
      modal.classList.remove('hidden');
    }

    showToast('🚑 Smart NFC Medical Card generated and downloaded!', 'success');
  };

  qrImg.onerror = () => {
    showToast('Failed to load QR code image for card generation.', 'error');
  };

  qrImg.src = qrSrc;
};

// Re-download generated card image
window.triggerCardImageDownload = function() {
  if (!currentCardDataUrl) {
    window.downloadWalletCard();
    return;
  }
  const name = (currentUser?.name || localStorage.getItem('offline_name') || 'Patient').trim();
  const cleanFilename = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const link = document.createElement('a');
  link.download = `LifeQR-Smart-Medical-Card-${cleanFilename}.png`;
  link.href = currentCardDataUrl;
  link.click();
  showToast('Image downloaded!', 'success');
};

// Print wallet card directly
window.printWalletCardImage = function() {
  if (!currentCardDataUrl) {
    window.print();
    return;
  }
  const printWin = window.open('', '_blank');
  if (!printWin) {
    window.print();
    return;
  }
  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print LifeQR Smart Medical Card</title>
      <style>
        body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #ffffff; }
        img { width: 85.6mm; height: 53.98mm; border-radius: 3.18mm; box-shadow: 0 0 1px #000; }
        @media print {
          body { margin: 0; }
          img { width: 85.6mm; height: 53.98mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <img src="${currentCardDataUrl}" alt="LifeQR Smart Medical Card" onload="window.print(); window.close();" />
    </body>
    </html>
  `);
  printWin.document.close();
};

// Close Wallet Card Modal
window.closeWalletCardModal = function() {
  const modal = document.getElementById('walletCardModal');
  if (modal) {
    modal.classList.add('hidden');
  }
};

// Traditional Medical ID Download using browser print layout

// Traditional Medical ID Download using browser print layout
window.downloadQR = function() {
  window.print();
};

// Auto-fill and format +91 for phone inputs in patient dashboard
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('input[type="tel"]').forEach(input => {
    input.addEventListener('focus', () => {
      if (!input.value.trim()) {
        input.value = '+91 ';
      }
    });
    input.addEventListener('input', () => {
      const raw = input.value.trim();
      if (!raw.startsWith('+91')) {
        const digits = raw.replace(/[^0-9]/g, '');
        if (digits.startsWith('91')) {
          input.value = '+' + digits.slice(0, 2) + ' ' + digits.slice(2);
        } else if (digits.length > 0) {
          input.value = '+91 ' + digits;
        }
      }
    });
  });
});

// ==========================================
// PATIENT HELP & ADMIN ASSISTANCE WORKFLOW
// ==========================================

async function patientApiFetch(endpoint, options = {}) {
  const url = (window.getApiUrl ? window.getApiUrl(endpoint) : `/api/v1${endpoint}`);
  const fetchFn = window.authFetch || fetch;
  const mergedOptions = {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  };
  return fetchFn(url, mergedOptions);
}

window.openPatientHelpModal = function() {
  const modal = document.getElementById('patientHelpModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const qrInput = document.getElementById('patientHelpQrId');
  if (qrInput) {
    qrInput.value = currentProfile?.qrCodeId || currentUser?.qrCodeId || localStorage.getItem('offline_qrCodeId') || '';
  }

  loadPatientHelpTickets();
};

window.closePatientHelpModal = function() {
  const modal = document.getElementById('patientHelpModal');
  if (modal) modal.classList.add('hidden');
};

window.switchPatientHelpTab = function(tab) {
  const newBtn = document.getElementById('patientHelpTabNewBtn');
  const histBtn = document.getElementById('patientHelpTabHistoryBtn');
  const formPane = document.getElementById('patientHelpForm');
  const histPane = document.getElementById('patientHelpHistoryPane');

  if (tab === 'new') {
    newBtn.className = 'px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider border-b-2 border-[#E11D2E] text-[#E11D2E] -mb-[2px] transition flex items-center gap-1.5';
    histBtn.className = 'px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-[#111111]/60 hover:text-[#111111] transition flex items-center gap-1.5';
    formPane.classList.remove('hidden');
    histPane.classList.add('hidden');
  } else {
    histBtn.className = 'px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider border-b-2 border-[#E11D2E] text-[#E11D2E] -mb-[2px] transition flex items-center gap-1.5';
    newBtn.className = 'px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-[#111111]/60 hover:text-[#111111] transition flex items-center gap-1.5';
    formPane.classList.add('hidden');
    histPane.classList.remove('hidden');
    loadPatientHelpTickets();
  }
};

window.handlePatientHelpSubmit = async function(e) {
  e.preventDefault();
  const subject = document.getElementById('patientHelpSubject')?.value?.trim();
  const message = document.getElementById('patientHelpMessage')?.value?.trim();
  const category = document.getElementById('patientHelpCategory')?.value;
  const priority = document.getElementById('patientHelpPriority')?.value;
  const patientQrCodeId = document.getElementById('patientHelpQrId')?.value?.trim();

  if (!subject || !message) {
    showToast('Please provide both subject and detailed description', 'warning');
    return;
  }

  const submitBtn = document.getElementById('patientHelpSubmitBtn');
  const origHtml = submitBtn.innerHTML;

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span><span>Dispatching...</span>';

    const res = await patientApiFetch('/help-tickets', {
      method: 'POST',
      body: JSON.stringify({
        subject,
        message,
        category,
        priority,
        patientQrCodeId
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit help ticket');

    showToast('Help request dispatched to LifeQR Administrators!', 'success');
    document.getElementById('patientHelpForm').reset();
    switchPatientHelpTab('history');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origHtml;
    }
  }
};

window.loadPatientHelpTickets = async function() {
  try {
    const res = await patientApiFetch('/help-tickets/my');
    if (!res.ok) return;
    const data = await res.json();
    const tickets = data.tickets || [];

    const badge = document.getElementById('patientHelpMyTicketsBadge');
    if (badge) {
      badge.textContent = tickets.length;
      if (tickets.length > 0) badge.classList.remove('hidden');
      else badge.classList.add('hidden');
    }

    const dot = document.getElementById('patientHelpPendingDot');
    const hasPending = tickets.some(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
    if (dot) {
      if (hasPending) dot.classList.remove('hidden');
      else dot.classList.add('hidden');
    }

    const list = document.getElementById('patientHelpHistoryList');
    if (!list) return;

    if (tickets.length === 0) {
      list.innerHTML = `
        <div class="border-2 border-dashed border-[#111111]/20 p-6 text-center text-xs font-mono text-[#111111]/60">
          No help tickets submitted yet. If you have an inquiry or need assistance, submit a request above.
        </div>
      `;
      return;
    }

    list.innerHTML = tickets.map(t => {
      let statusBadge = '<span class="px-2 py-0.5 border border-amber-600 bg-amber-50 text-amber-800 text-[10px] font-bold uppercase">Pending Admin Review</span>';
      if (t.status === 'IN_PROGRESS') {
        statusBadge = '<span class="px-2 py-0.5 border border-blue-600 bg-blue-50 text-blue-800 text-[10px] font-bold uppercase">In Progress</span>';
      } else if (t.status === 'RESOLVED') {
        statusBadge = '<span class="px-2 py-0.5 border border-emerald-600 bg-emerald-50 text-emerald-800 text-[10px] font-bold uppercase">Resolved</span>';
      }

      let priorityBadge = '<span class="px-1.5 py-0.5 border border-gray-300 bg-gray-50 text-gray-700 text-[9px] font-bold uppercase">NORMAL</span>';
      if (t.priority === 'HIGH') {
        priorityBadge = '<span class="px-1.5 py-0.5 border border-amber-600 bg-amber-50 text-amber-900 text-[9px] font-bold uppercase">HIGH</span>';
      } else if (t.priority === 'CRITICAL') {
        priorityBadge = '<span class="px-1.5 py-0.5 border border-[#E11D2E] bg-red-50 text-[#E11D2E] text-[9px] font-bold uppercase">CRITICAL</span>';
      }

      const dateStr = new Date(t.createdAt).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      const adminNotesHtml = t.adminNotes ? `
        <div class="mt-2.5 p-3 border-2 border-emerald-600 bg-emerald-50 text-emerald-950 text-xs">
          <div class="flex items-center gap-1.5 font-bold uppercase text-[10px] text-emerald-800 mb-1">
            <span class="material-symbols-outlined text-xs">admin_panel_settings</span>
            <span>Administrator Response Note</span>
            ${t.resolvedAt ? `<span class="ml-auto font-normal text-[9px] opacity-75">${new Date(t.resolvedAt).toLocaleDateString()}</span>` : ''}
          </div>
          <p class="font-sans leading-relaxed whitespace-pre-wrap">${t.adminNotes}</p>
        </div>
      ` : `
        <div class="mt-2 p-2 border border-dashed border-[#111111]/20 bg-gray-50 text-[11px] text-[#111111]/60 font-sans italic">
          Ticket queued in administrator command clearinghouse. Awaiting admin review.
        </div>
      `;

      return `
        <div class="border-2 border-[#111111] p-3.5 bg-white space-y-2 shadow-[2px_2px_0px_#111111]">
          <div class="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <span class="font-bold text-xs text-[#111111] uppercase tracking-wide">${t.subject}</span>
              <div class="text-[10px] text-[#111111]/60 font-mono mt-0.5">
                <span>#${t.ticketId}</span> &bull; <span>${t.category.replace(/_/g, ' ')}</span> &bull; <span>${dateStr}</span>
              </div>
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
              ${priorityBadge}
              ${statusBadge}
            </div>
          </div>
          <p class="text-xs font-sans text-[#111111]/80 whitespace-pre-wrap">${t.message}</p>
          ${adminNotesHtml}
        </div>
      `;
    }).join('');

  } catch (err) {
    console.warn('Failed to load patient help tickets:', err);
  }
};



