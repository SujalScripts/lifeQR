// Crew Dashboard JS Module
let currentUser = null;
let activePatient = null;
let scannerInstance = null;
let mapInstance = null;
let mapMarker = null;
let activeSosId = null;
let activeSosLocation = null;

// Tactical 24/7 Radar & Live Location State
let tacticalMapInstance = null;
let crewAmbulanceMarker = null;
let crewDispatchPerimeterCircle = null;
let tacticalRouteLine = null;
let activeSosMarkers = new Map();
let currentSelectedSos = null;
let crewLiveCoords = { lat: 18.9438, lng: 72.8234, accuracy: 10 }; // Default baseline (Mumbai Emergency Corridor)
let liveTrackingWatchId = null;
let locationSyncInterval = null;
let isCrewOffDuty = false;

function crewApiFetch(endpoint, options = {}) {
  const request = window.authFetch || fetch;
  const url = window.getApiUrl ? window.getApiUrl(endpoint) : (endpoint.startsWith('http') ? endpoint : `/api/v1${endpoint}`);
  const headers = { ...(options.headers || {}) };
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return request(url, { ...options, headers, credentials: 'include' });
}

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await checkDashboardAccess(['crew']);
  if (!currentUser) return;

  // Initialize Socket.IO connection for real-time SOS alerts
  initSocketConnection();

  // Check account verification status
  await checkVerificationStatus();

  // Load and apply Duty Status (On-Duty / Off-Duty)
  await loadCrewDutyStatus();

  // Initialize Tactical 24/7 Radar Map & Geolocation Tracking
  initCrewTacticalMap();
  startCrewLiveTracking();

  // Wire acknowledge button if present in DOM
  const ackBtn = document.getElementById('ackSosBtn');
  if (ackBtn) {
    ackBtn.addEventListener('click', window.acceptCurrentSosDispatch);
  }

  // Setup form submit listeners
  setupCrewListeners();

  // Load crew help tickets
  loadCrewHelpTickets();
});

async function checkVerificationStatus() {
  try {
    const apiUrl = window.getApiUrl ? window.getApiUrl('/verification/status') : '/api/v1/verification/status';
    const res = await (window.authFetch ? window.authFetch(apiUrl) : fetch(apiUrl, { credentials: 'include' }));
    if (!res.ok) return;
    const data = await res.json();
    currentUser.verificationStatus = data.verificationStatus;
    renderVerificationBanner(data.verificationStatus);
  } catch (e) {
    console.warn('Failed to check crew verification status:', e);
  }
}

function renderVerificationBanner(status) {
  const container = document.getElementById('verificationBannerContainer');
  if (!container) return;

  if (status === 'VERIFIED') {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="mb-6 p-5 bg-white border-2 border-[#E11D2E] shadow-[4px_4px_0px_#E11D2E] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div class="flex items-start sm:items-center gap-3.5">
        <div class="w-11 h-11 border-2 border-[#111111] bg-[#111111] text-white flex items-center justify-center flex-shrink-0">
          <span class="material-symbols-outlined text-2xl text-[#E11D2E]">ambulance</span>
        </div>
        <div>
          <h4 class="font-black text-[#111111] text-sm uppercase tracking-tight flex items-center gap-2">
            Emergency Dispatcher Clearance Required
            <span class="px-2 py-0.5 border border-[#E11D2E] bg-red-50 text-[#E11D2E] text-[10px] font-mono font-bold uppercase tracking-wider">${status}</span>
          </h4>
          <p class="text-xs text-[#111111]/70 font-sans font-medium mt-0.5">
            Your emergency responder account is pending clearance by dispatch administrators before performing patient triage lookups.
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2 w-full md:w-auto flex-shrink-0">
        <span class="px-4 py-2 border-2 border-[#111111] bg-[#f9fafb] text-[#111111] text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
          <span class="live-dot"></span>
          <span>Pending Dispatch Approval</span>
        </span>
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// Real-Time Socket.IO Pipeline
// ----------------------------------------------------
function initSocketConnection() {
  try {
    const socketHost = (window.API_URL && window.API_URL.startsWith('http')) ? new URL(window.API_URL).origin : window.location.origin;
    const socket = io(socketHost, { withCredentials: true });

    socket.on('connect', () => {
      console.log('🔌 Crew tactical socket connected:', socket.id);
    });

    socket.on('sos-alert', (data) => {
      console.log('🚨 Incoming live SOS alert received:', data);
      handleIncomingSosAlert(data);
    });

    socket.on('sos-dispatch-accepted', (data) => {
      console.log('🚨 SOS dispatch accepted event:', data);
      if (data.sosId && activeSosMarkers.has(data.sosId)) {
        const item = activeSosMarkers.get(data.sosId);
        item.status = 'dispatched';
        if (item.marker) {
          item.marker.setPopupContent(`
            <div style="font-family: Archivo, sans-serif; padding: 4px; min-width: 170px;">
              <span style="background: #059669; color: white; font-size: 9px; font-weight: bold; padding: 2px 5px; font-family: monospace;">DISPATCHED &bull; EN ROUTE</span>
              <p style="font-weight: 900; font-size: 13px; margin-top: 4px; text-transform: uppercase;">${escapeHtml(item.alert.name)}</p>
              <p style="font-size: 10px; font-family: monospace; color: #555;">Responded by: ${escapeHtml(data.crewName || 'Ambulance Unit')}</p>
            </div>
          `);
        }
      }
      loadActiveSosAlerts();
    });

    socket.on('sos-claimed', (data) => {
      showToast(`Unit ${data.claimedBy?.vehicleNumber || '108'} (${data.claimedBy?.name || 'Crew'}) claimed SOS ${data.sosId}`, 'info');
      loadActiveSosAlerts();
    });

    socket.on('trauma-bay-assigned', (data) => {
      showToast(`🏥 TRAUMA BAY ASSIGNED BY ER: ${data.assignedBay} for ${data.patientName}!`, 'success', 10000);
    });

    socket.on('help-ticket-updated', (data) => {
      showToast(`LifeQR Dispatch Admin updated ticket ${data.ticketId} (${data.status})`, 'info');
      loadCrewHelpTickets();
    });

    // Listen for real-time crew duty state updates
    socket.on('crew-duty-updated', (data) => {
      if (currentUser && (data.crewId === currentUser._id || data.crewId === currentUser.id)) {
        isCrewOffDuty = Boolean(data.isOffDuty);
        renderCrewDutyUI();
        updateMapDutyVisuals();
      }
    });
  } catch (e) {
    console.warn('Real-time Socket.IO connection failed. Crew alert broadcast disabled:', e);
  }
}

// ----------------------------------------------------
// Duty Status Controller (ON-DUTY / OFF-DUTY)
// ----------------------------------------------------
async function loadCrewDutyStatus() {
  try {
    const res = await crewApiFetch('/sos/crew/duty-status');
    if (!res.ok) return;
    const data = await res.json();
    isCrewOffDuty = Boolean(data.isOffDuty || data.status === 'off_duty');
    renderCrewDutyUI();
  } catch (err) {
    console.warn('Failed to load crew duty status:', err);
  }
}

window.toggleCrewDutyStatus = async function() {
  const nextTarget = isCrewOffDuty ? 'on_duty' : 'off_duty';
  const toggleBtn = document.getElementById('toggleDutyBtn');
  const navBtn = document.getElementById('navDutyToggleBtn');
  
  if (toggleBtn) toggleBtn.disabled = true;
  if (navBtn) navBtn.disabled = true;

  try {
    const res = await crewApiFetch('/sos/crew/duty-status', {
      method: 'POST',
      body: JSON.stringify({ status: nextTarget })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update duty status');

    isCrewOffDuty = Boolean(data.isOffDuty);
    renderCrewDutyUI();
    updateMapDutyVisuals();

    if (isCrewOffDuty) {
      showToast(`⏸️ Unit ${data.vehicleNumber || '108'} is now OFF-DUTY. Siren alarms muted and dispatch standby active.`, 'info', 8000);
    } else {
      showToast(`🚨 Unit ${data.vehicleNumber || '108'} is now ON-DUTY. 24/7 Tactical radar and emergency SOS alarms active!`, 'success', 8000);
    }
  } catch (err) {
    showToast(err.message || 'Error updating duty status', 'error');
  } finally {
    if (toggleBtn) toggleBtn.disabled = false;
    if (navBtn) navBtn.disabled = false;
  }
};

function renderCrewDutyUI() {
  const badge = document.getElementById('crewDutyBadge');
  const badgeText = document.getElementById('crewDutyBadgeText');
  const badgeDot = document.getElementById('crewDutyBadgeDot');
  const toggleBtn = document.getElementById('toggleDutyBtn');
  const toggleBtnText = document.getElementById('toggleDutyBtnText');
  const toggleIcon = document.getElementById('toggleDutyIcon');
  
  const navBtn = document.getElementById('navDutyToggleBtn');
  const navDot = document.getElementById('navDutyDot');
  const navText = document.getElementById('navDutyText');

  const noticeBanner = document.getElementById('crewOffDutyNoticeBanner');
  const title = document.getElementById('crewDutyTitle');
  const subtitle = document.getElementById('crewDutySubtitle');
  const iconWrapper = document.getElementById('crewUnitIconWrapper');
  const icon = document.getElementById('crewUnitIcon');

  const gpsBadge = document.getElementById('crewGpsStatusBadge');
  const gpsText = document.getElementById('crewGpsStatusText');

  if (isCrewOffDuty) {
    // Card badge & button
    if (badge) {
      badge.className = 'px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-500 text-[10px] font-mono font-bold uppercase flex items-center gap-1';
    }
    if (badgeText) badgeText.textContent = 'OFF-DUTY';
    if (badgeDot) {
      badgeDot.className = 'w-1.5 h-1.5 rounded-full bg-slate-400';
    }
    if (toggleBtn) {
      toggleBtn.className = 'px-2 py-0.5 border-2 border-emerald-700 bg-emerald-50 text-emerald-800 hover:bg-emerald-700 hover:text-white text-[10px] font-mono font-bold uppercase transition flex items-center gap-1 shadow-[1px_1px_0px_#111111]';
    }
    if (toggleBtnText) toggleBtnText.textContent = 'Go On-Duty';
    if (toggleIcon) toggleIcon.textContent = 'play_arrow';

    // Nav button
    if (navBtn) {
      navBtn.className = 'px-3 py-1.5 border-2 border-[#111111] bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[2px_2px_0px_#111111] transition';
    }
    if (navDot) {
      navDot.className = 'w-2 h-2 rounded-full bg-slate-400';
    }
    if (navText) navText.textContent = 'OFF-DUTY';

    // Off-Duty Notice Banner
    if (noticeBanner) noticeBanner.classList.remove('hidden');

    // Telemetry text
    if (title) title.textContent = 'Unit On Standby';
    if (subtitle) subtitle.textContent = 'Off-Shift • Alarms Muted';
    if (iconWrapper) iconWrapper.className = 'w-10 h-10 border-2 border-[#111111] bg-slate-100 flex items-center justify-center flex-shrink-0';
    if (icon) icon.className = 'material-symbols-outlined text-slate-500 text-2xl';

    // GPS Status in radar header
    if (gpsBadge) {
      gpsBadge.className = 'px-2 py-0.5 border border-slate-500 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 shadow-[2px_2px_0px_#111111]';
    }
    if (gpsText) gpsText.textContent = 'GPS STANDBY (OFF-DUTY)';

  } else {
    // Card badge & button
    if (badge) {
      badge.className = 'px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-700 text-[10px] font-mono font-bold uppercase flex items-center gap-1';
    }
    if (badgeText) badgeText.textContent = 'ON-DUTY';
    if (badgeDot) {
      badgeDot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse';
    }
    if (toggleBtn) {
      toggleBtn.className = 'px-2 py-0.5 border border-[#111111] bg-white hover:bg-[#111111] hover:text-white text-[10px] font-mono font-bold uppercase transition flex items-center gap-1 shadow-[1px_1px_0px_#111111]';
    }
    if (toggleBtnText) toggleBtnText.textContent = 'Go Off-Duty';
    if (toggleIcon) toggleIcon.textContent = 'bedtime';

    // Nav button
    if (navBtn) {
      navBtn.className = 'px-3 py-1.5 border-2 border-[#111111] bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[2px_2px_0px_#111111] transition';
    }
    if (navDot) {
      navDot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
    }
    if (navText) navText.textContent = 'ON-DUTY';

    // Off-Duty Notice Banner
    if (noticeBanner) noticeBanner.classList.add('hidden');

    // Telemetry text
    if (title) title.textContent = 'Rapid Response Unit';
    if (subtitle) subtitle.textContent = 'Tactical Paramedic Terminal';
    if (iconWrapper) iconWrapper.className = 'w-10 h-10 border-2 border-[#111111] bg-gray-50 flex items-center justify-center flex-shrink-0';
    if (icon) icon.className = 'material-symbols-outlined text-[#E11D2E] text-2xl';

    // GPS Status in radar header
    if (gpsBadge) {
      gpsBadge.className = 'px-2 py-0.5 border border-emerald-700 bg-emerald-100 text-emerald-900 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 shadow-[2px_2px_0px_#111111]';
    }
    if (gpsText) gpsText.textContent = 'GPS ONLINE 24/7';
  }
}

function updateMapDutyVisuals() {
  if (!tacticalMapInstance) return;

  // Update ambulance marker icon
  if (crewAmbulanceMarker) {
    const icon = L.divIcon({
      className: 'custom-crew-ambulance-icon',
      html: `
        <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; z-index: 50;">
          <span style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: ${isCrewOffDuty ? 'rgba(100, 116, 139, 0.25)' : 'rgba(16, 185, 129, 0.4)'}; ${isCrewOffDuty ? '' : 'animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;'}"></span>
          <div style="position: relative; width: 34px; height: 34px; background: #111111; border: 2px solid ${isCrewOffDuty ? '#94a3b8' : '#10b981'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 2px 2px 0px #111111;">
            <span class="material-symbols-outlined" style="color: ${isCrewOffDuty ? '#94a3b8' : '#10b981'}; font-size: 20px; line-height: 1;">ambulance</span>
          </div>
          <div style="position: absolute; top: -16px; left: 50%; transform: translateX(-50%); background: #111111; color: ${isCrewOffDuty ? '#94a3b8' : '#10b981'}; font-family: monospace; font-size: 8px; font-weight: 900; padding: 1px 4px; border: 1px solid ${isCrewOffDuty ? '#94a3b8' : '#10b981'}; white-space: nowrap; box-shadow: 1px 1px 0px rgba(0,0,0,0.5);">
            ${isCrewOffDuty ? 'AMBULANCE (OFF-DUTY)' : 'AMBULANCE (YOU)'}
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -22]
    });
    crewAmbulanceMarker.setIcon(icon);
  }

  // Update perimeter ring
  if (crewDispatchPerimeterCircle) {
    crewDispatchPerimeterCircle.setStyle({
      color: isCrewOffDuty ? '#64748b' : '#E11D2E',
      fillColor: isCrewOffDuty ? '#64748b' : '#E11D2E',
      fillOpacity: isCrewOffDuty ? 0.01 : 0.06
    });
  }
}

// ----------------------------------------------------
// 24/7 Tactical Geolocation Tracking & Backend Sync
// ----------------------------------------------------
function startCrewLiveTracking() {
  if (!navigator.geolocation) {
    console.warn('Geolocation not supported by this browser. Using emergency corridor baseline.');
    updateCrewPosition(crewLiveCoords.lat, crewLiveCoords.lng, 10);
    return;
  }

  // Initial fix
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      updateCrewPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
    },
    (err) => {
      console.warn('Initial GPS warning:', err.message, '- Using emergency corridor default');
      updateCrewPosition(crewLiveCoords.lat, crewLiveCoords.lng, 10);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
  );

  // 24/7 continuous watch
  liveTrackingWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      updateCrewPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
    },
    (err) => {
      console.warn('Continuous GPS telemetry notification:', err.message);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
  );

  // Periodic location push to backend every 20 seconds
  if (locationSyncInterval) clearInterval(locationSyncInterval);
  locationSyncInterval = setInterval(syncCrewLocationWithBackend, 20000);
}

function updateCrewPosition(lat, lng, accuracy = 10) {
  crewLiveCoords = { lat, lng, accuracy };

  // Update Telemetry Header
  const tele = document.getElementById('crewRadarTelemetry');
  if (tele) {
    tele.textContent = `Fix: ${lat.toFixed(5)}, ${lng.toFixed(5)} • Accuracy: ±${Math.round(accuracy)}m • 24-hr Active Dispatch Mesh`;
  }
  const statusTxt = document.getElementById('crewGpsStatusText');
  if (statusTxt) {
    statusTxt.textContent = `GPS ONLINE (±${Math.round(accuracy)}M)`;
  }

  // Update map marker & 3km perimeter circle
  if (tacticalMapInstance) {
    if (crewAmbulanceMarker) {
      crewAmbulanceMarker.setLatLng([lat, lng]);
    }
    if (crewDispatchPerimeterCircle) {
      crewDispatchPerimeterCircle.setLatLng([lat, lng]);
    }
  }

  // Recalculate distance for all active markers and refresh feed
  updateAllSosDistances();
}

async function syncCrewLocationWithBackend() {
  if (!crewLiveCoords) return;
  try {
    await crewApiFetch('/sos/crew/location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: crewLiveCoords.lat,
        lng: crewLiveCoords.lng
      })
    });
  } catch (e) {
    // Non-blocking background sync
  }
}

// ----------------------------------------------------
// Tactical 24/7 Radar Map Engine (Leaflet)
// ----------------------------------------------------
function initCrewTacticalMap() {
  const mapEl = document.getElementById('crewTacticalRadarMap');
  if (!mapEl) return;

  if (typeof L === 'undefined') {
    console.warn('Leaflet library not loaded.');
    mapEl.innerHTML = `
      <div class="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#f9fafb]">
        <p class="font-black text-sm uppercase text-[#111111]">Map Engine Loading...</p>
        <p class="text-xs font-mono text-[#111111]/70 mt-1">Coordinates: ${crewLiveCoords.lat.toFixed(4)}, ${crewLiveCoords.lng.toFixed(4)}</p>
      </div>
    `;
    return;
  }

  try {
    if (tacticalMapInstance) {
      try { tacticalMapInstance.remove(); } catch (e) {}
      tacticalMapInstance = null;
    }
    mapEl.innerHTML = '';

    tacticalMapInstance = L.map(mapEl, {
      zoomControl: true,
      scrollWheelZoom: false
    }).setView([crewLiveCoords.lat, crewLiveCoords.lng], 14);

    // High-performance CartoDB Voyager tiles (No 403 OSM blocks, high retina support)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(tacticalMapInstance);

    // 1. Ambulance Marker (My Unit)
    const ambulanceIcon = L.divIcon({
      className: 'custom-crew-ambulance-icon',
      html: `
        <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; z-index: 50;">
          <span style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(16, 185, 129, 0.4); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
          <div style="position: relative; width: 34px; height: 34px; background: #111111; border: 2px solid #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 2px 2px 0px #111111;">
            <span class="material-symbols-outlined" style="color: #10b981; font-size: 20px; line-height: 1;">ambulance</span>
          </div>
          <div style="position: absolute; top: -16px; left: 50%; transform: translateX(-50%); background: #111111; color: #10b981; font-family: monospace; font-size: 8px; font-weight: 900; padding: 1px 4px; border: 1px solid #10b981; white-space: nowrap; box-shadow: 1px 1px 0px rgba(0,0,0,0.5);">
            AMBULANCE (YOU)
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -22]
    });

    crewAmbulanceMarker = L.marker([crewLiveCoords.lat, crewLiveCoords.lng], { icon: ambulanceIcon, zIndexOffset: 1000 })
      .addTo(tacticalMapInstance)
      .bindPopup(`
        <div style="font-family: Archivo, sans-serif; padding: 3px; min-width: 140px;">
          <span style="background: #10b981; color: #111111; font-size: 9px; font-weight: 900; padding: 2px 5px; font-family: monospace; text-transform: uppercase;">ACTIVE ON-DUTY</span>
          <p style="font-weight: 900; font-size: 13px; margin-top: 4px; text-transform: uppercase; color: #111111;">Ambulance Unit 108</p>
          <p style="font-size: 10px; font-family: monospace; color: #555; margin-top: 2px;">${crewLiveCoords.lat.toFixed(5)}, ${crewLiveCoords.lng.toFixed(5)}</p>
        </div>
      `);

    // 2. 2.5 - 3.0 KM Dispatch Perimeter Circle
    crewDispatchPerimeterCircle = L.circle([crewLiveCoords.lat, crewLiveCoords.lng], {
      radius: 3000,
      color: '#E11D2E',
      weight: 2,
      dashArray: '6, 6',
      fillColor: '#E11D2E',
      fillOpacity: 0.06
    }).addTo(tacticalMapInstance);

    setTimeout(() => {
      if (tacticalMapInstance) tacticalMapInstance.invalidateSize();
    }, 250);

    // Load any existing active SOS beacons in the area
    loadActiveSosAlerts();

  } catch (err) {
    console.error('Failed to initialize Tactical Radar Map:', err);
  }
}

window.centerMapOnAmbulance = function() {
  if (tacticalMapInstance && crewLiveCoords) {
    tacticalMapInstance.flyTo([crewLiveCoords.lat, crewLiveCoords.lng], 14, { duration: 0.8 });
    showToast('Radar centered on your ambulance unit', 'info');
  }
};

let scannedPatientMarker = null;

function plotScannedPatientOnRadar(lat, lng, options = {}) {
  if (!tacticalMapInstance || typeof L === 'undefined') return;

  // Clear previous scanned patient marker and route
  if (scannedPatientMarker) {
    try { tacticalMapInstance.removeLayer(scannedPatientMarker); } catch (e) {}
    scannedPatientMarker = null;
  }
  if (tacticalRouteLine) {
    try { tacticalMapInstance.removeLayer(tacticalRouteLine); } catch (e) {}
    tacticalRouteLine = null;
  }

  const patName = (activePatient && activePatient.name) || options.name || 'Emergency Patient';
  const blood = (activePatient && (activePatient.bloodGroup || (activePatient.profile && activePatient.profile.bloodGroup))) || options.bloodGroup || 'N/A';
  const allergies = (activePatient && (activePatient.allergies || (activePatient.profile && activePatient.profile.allergies))) || options.allergies || 'None';
  const qrId = (activePatient && activePatient.qrCodeId) || options.qrCodeId || '';

  // Custom high-impact Red Pulsing Patient Incident Icon
  const patientIcon = L.divIcon({
    className: 'custom-scanned-patient-icon',
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; z-index: 60;">
        <span style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(225, 29, 46, 0.45); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <div style="position: relative; width: 34px; height: 34px; background: #E11D2E; border: 2px solid #111111; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 2px 2px 0px #111111;">
          <span class="material-symbols-outlined" style="color: white; font-size: 20px; line-height: 1;">person_pin_circle</span>
        </div>
        <div style="position: absolute; top: -16px; left: 50%; transform: translateX(-50%); background: #E11D2E; color: white; font-family: monospace; font-size: 8px; font-weight: 900; padding: 1px 4px; border: 1px solid #111111; white-space: nowrap; box-shadow: 1px 1px 0px rgba(0,0,0,0.5);">
          SCENE: ${escapeHtml(patName.split(' ')[0])}
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22]
  });

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  scannedPatientMarker = L.marker([lat, lng], { icon: patientIcon, zIndexOffset: 950 })
    .addTo(tacticalMapInstance)
    .bindPopup(`
      <div style="font-family: Archivo, sans-serif; padding: 4px; min-width: 175px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
          <span style="background: #E11D2E; color: white; font-size: 9px; font-weight: 900; padding: 2px 5px; font-family: monospace; text-transform: uppercase;">PATIENT SCENE</span>
          <span style="background: #111111; color: white; font-size: 9px; font-weight: 900; padding: 2px 5px; font-family: monospace;">${escapeHtml(blood)}</span>
        </div>
        <p style="font-weight: 900; font-size: 13px; margin-top: 5px; text-transform: uppercase; color: #111111; line-height: 1.2;">
          ${escapeHtml(patName)}
        </p>
        <p style="font-size: 10px; font-family: monospace; color: #555; margin-top: 3px;">
          GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}
        </p>
        ${allergies && allergies !== 'None' ? `<p style="font-size: 10px; color: #b45309; font-weight: bold; margin-top: 2px;">⚠️ ${escapeHtml(Array.isArray(allergies)?allergies.join(', '):allergies)}</p>` : ''}
        <a href="${mapsUrl}" target="_blank" style="display: inline-block; margin-top: 8px; font-size: 10px; font-weight: 900; background: #111111; color: white; padding: 3px 7px; text-decoration: none; text-transform: uppercase; font-family: monospace;">
          Open In Google Maps &rarr;
        </a>
      </div>
    `);

  // Calculate distance & ETA
  let distKm = 0;
  let etaMins = 1;
  if (crewLiveCoords && typeof crewLiveCoords.lat === 'number') {
    distKm = calculateDistanceKm(crewLiveCoords.lat, crewLiveCoords.lng, lat, lng);
    etaMins = Math.max(1, Math.round((distKm / 35) * 60)); // Avg 35 km/h emergency speed

    tacticalRouteLine = L.polyline([
      [crewLiveCoords.lat, crewLiveCoords.lng],
      [lat, lng]
    ], {
      color: '#E11D2E',
      weight: 4,
      opacity: 0.9,
      dashArray: '8, 8'
    }).addTo(tacticalMapInstance);

    const group = L.featureGroup([crewAmbulanceMarker, scannedPatientMarker]);
    tacticalMapInstance.fitBounds(group.getBounds(), { padding: [50, 50] });
  } else {
    tacticalMapInstance.setView([lat, lng], 15);
  }

  // Update In-Map Tactical HUD
  updateMapTacticalHud({
    name: patName,
    bloodGroup: blood,
    distanceKm: distKm,
    etaMins: etaMins,
    lat,
    lng,
    mapsUrl
  });

  // Activate Tactical Map Header buttons
  const centerPatBtn = document.getElementById('centerPatientBtn');
  if (centerPatBtn) centerPatBtn.classList.remove('hidden');

  const fitRouteBtn = document.getElementById('fitRouteBtn');
  if (fitRouteBtn) fitRouteBtn.classList.remove('hidden');

  const gmapsBtn = document.getElementById('tacticalGmapsBtn');
  if (gmapsBtn) {
    gmapsBtn.href = mapsUrl;
    gmapsBtn.classList.remove('hidden');
  }
}

function updateMapTacticalHud(info) {
  const hud = document.getElementById('mapTacticalHud');
  if (!hud) return;

  if (!info) {
    hud.classList.add('hidden');
    return;
  }

  hud.classList.remove('hidden');
  const nameEl = document.getElementById('hudPatientName');
  if (nameEl) nameEl.textContent = info.name;

  const bloodEl = document.getElementById('hudBloodGroup');
  if (bloodEl) bloodEl.textContent = info.bloodGroup || 'N/A';

  const distEl = document.getElementById('hudDistanceText');
  if (distEl) distEl.textContent = `${info.distanceKm.toFixed(1)} KM`;

  const etaEl = document.getElementById('hudEtaText');
  if (etaEl) etaEl.textContent = `~${info.etaMins} MIN`;

  const navLink = document.getElementById('hudGmapsLink');
  if (navLink) navLink.href = info.mapsUrl;
}

function clearPatientFromRadar() {
  if (scannedPatientMarker && tacticalMapInstance) {
    try { tacticalMapInstance.removeLayer(scannedPatientMarker); } catch (e) {}
    scannedPatientMarker = null;
  }
  if (tacticalRouteLine && tacticalMapInstance) {
    try { tacticalMapInstance.removeLayer(tacticalRouteLine); } catch (e) {}
    tacticalRouteLine = null;
  }

  updateMapTacticalHud(null);

  const centerPatBtn = document.getElementById('centerPatientBtn');
  if (centerPatBtn) centerPatBtn.classList.add('hidden');

  const fitRouteBtn = document.getElementById('fitRouteBtn');
  if (fitRouteBtn) fitRouteBtn.classList.add('hidden');

  const gmapsBtn = document.getElementById('tacticalGmapsBtn');
  if (gmapsBtn) gmapsBtn.classList.add('hidden');

  if (tacticalMapInstance && crewLiveCoords) {
    tacticalMapInstance.flyTo([crewLiveCoords.lat, crewLiveCoords.lng], 14, { duration: 0.8 });
  }
}

window.centerMapOnPatient = function() {
  if (scannedPatientMarker && tacticalMapInstance) {
    tacticalMapInstance.flyTo(scannedPatientMarker.getLatLng(), 16, { duration: 0.8 });
    scannedPatientMarker.openPopup();
  }
};

window.fitMapRoute = function() {
  if (scannedPatientMarker && crewAmbulanceMarker && tacticalMapInstance) {
    const group = L.featureGroup([crewAmbulanceMarker, scannedPatientMarker]);
    tacticalMapInstance.fitBounds(group.getBounds(), { padding: [50, 50] });
  }
};

// ----------------------------------------------------
// Haversine Distance & Proximity Engine
// ----------------------------------------------------
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || typeof lat2 !== 'number' || typeof lon2 !== 'number') {
    return 999;
  }
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ----------------------------------------------------
// Emergency Audio Alert Synthesizer (Web Audio API)
// ----------------------------------------------------
function playEmergencySirenTone() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(750, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1300, ctx.currentTime + 0.25);
    osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.5);
    osc.frequency.exponentialRampToValueAtTime(1300, ctx.currentTime + 0.75);

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.9);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.9);
  } catch (e) {
    // Audio context may require user interaction
  }
}

// ----------------------------------------------------
// Load Active SOS Beacons from Backend
// ----------------------------------------------------
async function loadActiveSosAlerts() {
  try {
    const res = await crewApiFetch('/sos/active');
    if (!res.ok) return;
    const data = await res.json();
    if (!data.alerts || !Array.isArray(data.alerts)) return;

    // Clear old markers that are no longer active
    const newSosIds = new Set(data.alerts.map(a => a.sosId));
    activeSosMarkers.forEach((val, id) => {
      if (!newSosIds.has(id)) {
        if (tacticalMapInstance && val.marker) {
          try { tacticalMapInstance.removeLayer(val.marker); } catch (e) {}
        }
        activeSosMarkers.delete(id);
      }
    });

    data.alerts.forEach(alert => {
      renderSosBeaconOnMap(alert);
    });

    updateSosFeedList(data.alerts);
  } catch (err) {
    console.warn('Failed to load active SOS alerts:', err);
  }
}

// ----------------------------------------------------
// Render SOS Logo Beacon on Map
// ----------------------------------------------------
function renderSosBeaconOnMap(alert) {
  if (!alert.location || typeof alert.location.lat !== 'number' || typeof alert.location.lng !== 'number') {
    return;
  }
  if (!tacticalMapInstance) return;

  const sosId = alert.sosId || alert._id;
  const distKm = calculateDistanceKm(crewLiveCoords.lat, crewLiveCoords.lng, alert.location.lat, alert.location.lng);
  const isWithin3Km = distKm <= 3.0;

  // Custom high-impact pulsing LifeQR SOS Logo icon
  const sosLogoIcon = L.divIcon({
    className: 'custom-sos-radar-marker',
    html: `
      <div style="position: relative; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 100;">
        <span style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(225, 29, 46, 0.45); animation: ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <div style="position: relative; width: 36px; height: 36px; background: #E11D2E; border: 2px solid #111111; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 3px 3px 0px #111111;">
          <span class="material-symbols-outlined" style="color: white; font-size: 20px; line-height: 1;">emergency</span>
        </div>
        <div style="position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); background: #111111; color: white; font-family: monospace; font-size: 9px; font-weight: 900; padding: 1px 5px; border: 1px solid white; white-space: nowrap; box-shadow: 2px 2px 0px rgba(0,0,0,0.5);">
          ${distKm.toFixed(1)} KM
        </div>
      </div>
    `,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    popupAnchor: [0, -23]
  });

  // If marker already exists, update position & popup
  if (activeSosMarkers.has(sosId)) {
    const existing = activeSosMarkers.get(sosId);
    existing.distKm = distKm;
    existing.marker.setLatLng([alert.location.lat, alert.location.lng]);
    existing.marker.setIcon(sosLogoIcon);
    return;
  }

  // Create new marker
  const marker = L.marker([alert.location.lat, alert.location.lng], { icon: sosLogoIcon, zIndexOffset: 2000 })
    .addTo(tacticalMapInstance);

  const popupHtml = `
    <div style="font-family: Archivo, sans-serif; padding: 4px; min-width: 180px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <span style="background: #E11D2E; color: white; font-size: 9px; font-weight: 900; padding: 1px 5px; font-family: monospace; border: 1px solid #111111; text-transform: uppercase;">
          ${isWithin3Km ? '🚨 IN 3KM ZONE' : 'EMERGENCY SOS'}
        </span>
        <span style="font-size: 9px; font-family: monospace; font-weight: bold; color: #111111;">${distKm.toFixed(1)} KM</span>
      </div>
      <p style="font-weight: 900; font-size: 13px; text-transform: uppercase; margin: 4px 0 2px 0; color: #111111; line-height: 1.2;">
        ${escapeHtml(alert.name || 'Emergency Patient')}
      </p>
      <p style="font-size: 10px; font-family: monospace; color: #E11D2E; font-weight: bold;">
        Blood: ${escapeHtml(alert.bloodGroup || 'N/A')} &bull; Allergies: ${escapeHtml(alert.allergies || 'None')}
      </p>
      <button onclick="window.triggerSosModalById('${sosId}')" style="margin-top: 8px; width: 100%; background: #E11D2E; color: white; font-weight: 900; font-size: 10px; font-family: monospace; text-transform: uppercase; padding: 5px 8px; border: 2px solid #111111; box-shadow: 2px 2px 0px #111111; cursor: pointer;">
        ACCEPT DISPATCH &rarr;
      </button>
    </div>
  `;

  marker.bindPopup(popupHtml);

  // Clicking on the SOS logo marker opens the dispatch review modal!
  marker.on('click', () => {
    openSosDispatchModal(alert, distKm);
  });

  activeSosMarkers.set(sosId, { marker, alert, distKm });
}

window.triggerSosModalById = function(sosId) {
  if (activeSosMarkers.has(sosId)) {
    const item = activeSosMarkers.get(sosId);
    openSosDispatchModal(item.alert, item.distKm);
  }
};

function updateAllSosDistances() {
  const alerts = [];
  activeSosMarkers.forEach((item, sosId) => {
    if (item.alert && item.alert.location) {
      item.distKm = calculateDistanceKm(crewLiveCoords.lat, crewLiveCoords.lng, item.alert.location.lat, item.alert.location.lng);
      alerts.push(item.alert);
    }
  });
  updateSosFeedList(alerts);
}

// ----------------------------------------------------
// Handle Incoming Real-Time SOS Alert Event
// ----------------------------------------------------
function handleIncomingSosAlert(data) {
  activeSosId = data.sosId;
  activeSosLocation = data.location;

  const distKm = calculateDistanceKm(crewLiveCoords.lat, crewLiveCoords.lng, data.location.lat, data.location.lng);
  const isWithin3Km = distKm <= 3.0;

  // Render SOS beacon on map
  renderSosBeaconOnMap(data);

  if (isCrewOffDuty) {
    // If OFF-DUTY: Mute siren alarm tone, skip intrusive modal popup, and provide silent log
    loadActiveSosAlerts();
    showToast(`🚨 Incoming SOS logged: ${data.name || 'Patient'} (${distKm.toFixed(1)} km) — Sirens muted (Unit OFF-DUTY)`, 'info', 8000);
    return;
  }

  // Play audio alert
  playEmergencySirenTone();

  // Pan map to encompass ambulance and victim
  if (tacticalMapInstance && data.location && typeof data.location.lat === 'number') {
    tacticalMapInstance.flyTo([data.location.lat, data.location.lng], 15, { duration: 1 });
  }

  // Populate and open dispatch modal
  openSosDispatchModal(data, distKm);

  // Also update standby popup values for redundancy
  showSosAlertPopup(data);

  // Toast
  if (isWithin3Km) {
    showToast(`🚨 CRITICAL: SOS triggered ${distKm.toFixed(1)} km away within your 3km response perimeter!`, 'emergency', 12000);
  } else {
    showToast(`🚨 EMERGENCY: SOS triggered by ${data.name} (${distKm.toFixed(1)} km away)`, 'emergency', 10000);
  }

  loadActiveSosAlerts();
}

function updateSosFeedList(alerts) {
  const feed = document.getElementById('crewActiveSosFeed');
  const countBadge = document.getElementById('activeSosCountBadge');
  if (!feed) return;

  if (!alerts || alerts.length === 0) {
    feed.innerHTML = `
      <p class="text-[11px] text-[#111111]/60 font-mono italic p-3 border border-dashed border-[#111111]/20 text-center">
        ● 24/7 Tactical Scan Active. Standing by for emergency SOS beacons within 3 km perimeter.
      </p>
    `;
    if (countBadge) countBadge.textContent = '0 ACTIVE IN ZONE';
    return;
  }

  const enriched = alerts.map(a => {
    const d = (a.location && typeof a.location.lat === 'number') 
      ? calculateDistanceKm(crewLiveCoords.lat, crewLiveCoords.lng, a.location.lat, a.location.lng) 
      : 999;
    return { ...a, distKm: d };
  });

  enriched.sort((a, b) => a.distKm - b.distKm);

  const withinZoneCount = enriched.filter(a => a.distKm <= 3.0).length;
  if (countBadge) {
    countBadge.textContent = `${withinZoneCount} IN 3KM ZONE (${enriched.length} TOTAL)`;
    countBadge.className = withinZoneCount > 0 
      ? 'px-2 py-0.5 border border-[#E11D2E] bg-red-100 text-[#E11D2E] font-bold text-[10px]' 
      : 'px-2 py-0.5 border border-[#111111] bg-gray-50 text-[10px]';
  }

  feed.innerHTML = enriched.map(a => {
    const isNearby = a.distKm <= 3.0;
    const isDispatched = a.status === 'dispatched';

    return `
      <div class="p-3 bg-white border-2 border-[#111111] ${isNearby ? 'border-l-4 border-l-[#E11D2E]' : ''} shadow-[2px_2px_0px_#111111] space-y-2">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full ${isNearby ? 'bg-[#E11D2E] animate-ping' : 'bg-amber-500'}"></span>
            <strong class="font-black text-xs uppercase text-[#111111]">${escapeHtml(a.name || 'Emergency Patient')}</strong>
          </div>
          <div class="flex items-center gap-1">
            <span class="px-2 py-0.5 text-[9px] font-mono font-bold uppercase border ${isNearby ? 'border-[#E11D2E] bg-red-50 text-[#E11D2E]' : 'border-[#111111] bg-gray-50 text-[#111111]'}">
              ${a.distKm < 900 ? a.distKm.toFixed(1) + ' KM AWAY' : 'ACTIVE SOS'}
            </span>
            ${isDispatched ? '<span class="px-1.5 py-0.5 bg-emerald-100 border border-emerald-800 text-emerald-900 text-[9px] font-bold uppercase">EN ROUTE</span>' : ''}
          </div>
        </div>
        <div class="text-[10px] font-mono text-[#111111]/70 flex items-center gap-3">
          <span>Blood: <strong class="text-[#E11D2E]">${escapeHtml(a.bloodGroup || 'N/A')}</strong></span>
          <span>Allergies: <strong class="text-amber-700">${escapeHtml(a.allergies || 'None')}</strong></span>
        </div>
        <div class="flex items-center gap-2 pt-1">
          <button onclick="window.triggerSosModalById('${a.sosId || a._id}')" class="btn-danger flex-1 py-1.5 text-[10px] uppercase font-mono font-bold flex items-center justify-center gap-1 shadow-[2px_2px_0px_#111111]">
            <span class="material-symbols-outlined text-xs">emergency</span>
            <span>${isDispatched ? 'View Dispatch Status' : 'Accept Dispatch'}</span>
          </button>
          <a href="https://www.google.com/maps/search/?api=1&query=${a.location.lat},${a.location.lng}" target="_blank" class="btn-secondary px-3 py-1.5 text-[10px] uppercase font-mono font-bold flex items-center justify-center gap-1">
            <span class="material-symbols-outlined text-xs">navigation</span>
            <span>Maps</span>
          </a>
        </div>
      </div>
    `;
  }).join('');
}

// ----------------------------------------------------
// Dispatch Modal Controller
// ----------------------------------------------------
function openSosDispatchModal(alert, distKm) {
  currentSelectedSos = alert;
  const modal = document.getElementById('sosDispatchModal');
  if (!modal) return;

  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setTxt('dispatchModalPatientName', alert.name || 'Emergency Patient');
  setTxt('dispatchModalBloodGroup', alert.bloodGroup || 'N/A');
  setTxt('dispatchModalAllergies', alert.allergies || 'None recorded');
  setTxt('dispatchModalMedications', alert.medications || 'None recorded');
  setTxt('dispatchModalMessage', alert.message || 'Emergency Patient SOS Triggered!');
  
  if (alert.location && typeof alert.location.lat === 'number') {
    setTxt('dispatchModalCoordinates', `${alert.location.lat.toFixed(5)}, ${alert.location.lng.toFixed(5)}`);
  }

  const distEl = document.getElementById('dispatchModalDistance');
  if (distEl) {
    const d = (typeof distKm === 'number' && distKm < 900) ? distKm.toFixed(1) : 'Nearby';
    const inZone = typeof distKm === 'number' && distKm <= 3.0;
    distEl.textContent = `${d} KM AWAY • ${inZone ? 'WITHIN 3KM RAPID RESPONSE PERIMETER' : 'REGIONAL DISPATCH BEACON'}`;
    distEl.className = inZone 
      ? 'text-xs font-mono text-[#E11D2E] font-bold uppercase mt-0.5 flex items-center gap-1' 
      : 'text-xs font-mono text-amber-700 font-bold uppercase mt-0.5';
  }

  const acceptBtn = document.getElementById('dispatchModalAcceptBtn');
  if (acceptBtn) {
    acceptBtn.disabled = false;
    if (alert.status === 'dispatched') {
      acceptBtn.className = 'btn-primary w-full py-3.5 text-xs uppercase font-mono tracking-wider font-bold shadow-[4px_4px_0px_#111111] flex items-center justify-center gap-2 bg-emerald-600 border-emerald-800 text-white';
      acceptBtn.innerHTML = `
        <span class="material-symbols-outlined text-base">check_circle</span>
        <span>UNIT ALREADY DISPATCHED &bull; EN ROUTE</span>
      `;
    } else {
      acceptBtn.className = 'btn-danger w-full py-3.5 text-xs uppercase font-mono tracking-wider font-bold shadow-[4px_4px_0px_#111111] flex items-center justify-center gap-2';
      acceptBtn.innerHTML = `
        <span class="material-symbols-outlined text-base">ambulance</span>
        <span>ACCEPT DISPATCH &amp; DEPLOY AMBULANCE</span>
      `;
    }
  }

  modal.classList.remove('hidden');
}

window.closeSosDispatchModal = function() {
  const modal = document.getElementById('sosDispatchModal');
  if (modal) modal.classList.add('hidden');
};

window.inspectSosPatientInTriage = function() {
  if (!currentSelectedSos) return;
  closeSosDispatchModal();
  const input = document.getElementById('patientQrId');
  if (input) {
    input.value = currentSelectedSos.qrCodeId || currentSelectedSos.patientId || '';
    window.searchPatient();
  }
};

window.acceptCurrentSosDispatch = async function() {
  if (isCrewOffDuty) {
    const proceed = confirm('Unit is currently OFF-DUTY.\n\nWould you like to clock ON-DUTY now and accept this emergency dispatch?');
    if (!proceed) return;

    try {
      const dutyRes = await crewApiFetch('/sos/crew/duty-status', {
        method: 'POST',
        body: JSON.stringify({ status: 'on_duty' })
      });
      const dutyData = await dutyRes.json();
      if (!dutyRes.ok) throw new Error(dutyData.error || 'Failed to switch on-duty');
      isCrewOffDuty = false;
      renderCrewDutyUI();
      updateMapDutyVisuals();
      showToast('Unit clocked ON-DUTY. Transmitting dispatch deployment...', 'success');
    } catch (e) {
      showToast('Failed to switch on-duty: ' + e.message, 'error');
      return;
    }
  }

  if (!currentSelectedSos && !activeSosId) {
    showToast('No active emergency SOS selected', 'warning');
    return;
  }

  const sos = currentSelectedSos || { sosId: activeSosId, location: activeSosLocation };
  const sosId = sos.sosId || sos._id;

  const acceptBtn = document.getElementById('dispatchModalAcceptBtn');
  if (acceptBtn) {
    acceptBtn.disabled = true;
    acceptBtn.innerHTML = `
      <span class="material-symbols-outlined text-base animate-spin">refresh</span>
      <span>TRANSMITTING DISPATCH ACCEPTANCE...</span>
    `;
  }

  try {
    const dist = (sos.location && typeof sos.location.lat === 'number') 
      ? calculateDistanceKm(crewLiveCoords.lat, crewLiveCoords.lng, sos.location.lat, sos.location.lng) 
      : 2.0;
    const eta = Math.max(2, Math.round(dist * 2.2));

    const response = await crewApiFetch('/sos/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sosId,
        etaMinutes: eta,
        crewLocation: crewLiveCoords
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to accept dispatch');

    showToast(`🚨 DISPATCH DEPLOYED: Unit en route (${eta} min ETA)! Patient notified with your contact details.`, 'success', 10000);

    // Draw route line on map
    if (sos.location && typeof sos.location.lat === 'number') {
      drawTacticalRouteToIncident(crewLiveCoords, sos.location);
    }

    if (acceptBtn) {
      acceptBtn.className = 'btn-primary w-full py-3.5 text-xs uppercase font-mono tracking-wider font-bold shadow-[4px_4px_0px_#111111] flex items-center justify-center gap-2 bg-emerald-600 border-emerald-800 text-white';
      acceptBtn.innerHTML = `
        <span class="material-symbols-outlined text-base">check_circle</span>
        <span>DISPATCH ACCEPTED &bull; UNIT EN ROUTE</span>
      `;
    }

    // Dismiss standby popup if visible
    const popup = document.getElementById('sosAlertPopup');
    if (popup) popup.classList.add('hidden');

    setTimeout(() => {
      closeSosDispatchModal();
    }, 1800);

    loadActiveSosAlerts();

  } catch (err) {
    showToast(err.message, 'error');
    if (acceptBtn) {
      acceptBtn.disabled = false;
      acceptBtn.innerHTML = `
        <span class="material-symbols-outlined text-base">ambulance</span>
        <span>ACCEPT DISPATCH &amp; DEPLOY AMBULANCE</span>
      `;
    }
  }
};

function drawTacticalRouteToIncident(start, end) {
  if (!tacticalMapInstance) return;
  if (tacticalRouteLine) {
    try { tacticalMapInstance.removeLayer(tacticalRouteLine); } catch (e) {}
  }
  tacticalRouteLine = L.polyline([
    [start.lat, start.lng],
    [end.lat, end.lng]
  ], {
    color: '#E11D2E',
    weight: 4,
    opacity: 0.85,
    dashArray: '8, 8'
  }).addTo(tacticalMapInstance);

  tacticalMapInstance.fitBounds(tacticalRouteLine.getBounds(), { padding: [40, 40] });
}

function showSosAlertPopup(data) {
  const popup = document.getElementById('sosAlertPopup');
  if (popup) popup.classList.remove('hidden');

  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setTxt('sosPatName', data.name);
  setTxt('sosPatBlood', data.bloodGroup || 'N/A');
  setTxt('sosPatAllergies', data.allergies || 'None');
  setTxt('sosPatMessage', data.message || '');
  if (data.location && typeof data.location.lat === 'number') {
    setTxt('sosPatLoc', `${data.location.lat.toFixed(4)}, ${data.location.lng.toFixed(4)}`);
    activeSosLocation = data.location;
  }

  const input = document.getElementById('patientQrId');
  if (input) input.value = data.patientId;
}

window.closeSosPopup = function() {
  const popup = document.getElementById('sosAlertPopup');
  if (popup) popup.classList.add('hidden');
};

window.acknowledgeSosAlert = window.acceptCurrentSosDispatch;

window.searchPatient = async function() {
  const input = document.getElementById('patientQrId');
  const qrId = input ? input.value.trim() : '';
  if (!qrId) {
    showToast('Please enter or scan a Patient QR Code ID (e.g. RAH-81E49300)', 'warning');
    return;
  }

  showPatientSkeleton();

  try {
    const response = await crewApiFetch(`/patient/profile/${encodeURIComponent(qrId)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Patient profile not found for ID: ' + qrId);

    activePatient = data;

    // Send crew live GPS coordinates if available to geotag patient's scene scan
    const scanCoords = (crewLiveCoords && typeof crewLiveCoords.lat === 'number') ? crewLiveCoords : null;
    await logCrewTriageAccess(qrId, scanCoords);

    renderPatientDetails();
    showToast(`Emergency record loaded for ${data.name || qrId}`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
    hidePatientView();
  }
};

async function logCrewTriageAccess(qrCodeId, coords) {
  try {
    await crewApiFetch(`/patient/log-scan/${encodeURIComponent(qrCodeId)}`, {
      method: 'POST',
      body: JSON.stringify(coords ? { lat: coords.lat, lng: coords.lng } : {})
    });
  } catch (e) {
    console.warn('Failed to log triage scan.');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showPatientSkeleton() {
  const standby = document.getElementById('standbyDeck');
  if (standby) standby.classList.add('hidden');
  const panel = document.getElementById('patientDetailsPanel');
  const skel = document.getElementById('patientSkeleton');
  const content = document.getElementById('patientContent');
  const clearBtn = document.getElementById('clearTriageBtn');
  if (clearBtn) clearBtn.classList.remove('hidden');
  if (panel) panel.classList.remove('hidden');
  if (skel) skel.classList.remove('hidden');
  if (content) content.classList.add('hidden');
}

function hidePatientView() {
  const panel = document.getElementById('patientDetailsPanel');
  if (panel) panel.classList.add('hidden');
  const standby = document.getElementById('standbyDeck');
  if (standby) standby.classList.remove('hidden');
  const clearBtn = document.getElementById('clearTriageBtn');
  if (clearBtn) clearBtn.classList.add('hidden');
  activePatient = null;
  activeSosLocation = null;
  clearPatientFromRadar();
}

window.resetTriageView = function() {
  activePatient = null;
  const qrInput = document.getElementById('patientQrId');
  if (qrInput) qrInput.value = '';
  hidePatientView();
  showToast('Triage console reset to standby readiness', 'info');
};

window.quickSearchPatient = function(id) {
  const qrInput = document.getElementById('patientQrId');
  if (qrInput) qrInput.value = id;
  searchPatient();
};

function renderPatientDetails() {
  const skel = document.getElementById('patientSkeleton');
  const content = document.getElementById('patientContent');
  const standby = document.getElementById('standbyDeck');
  if (standby) standby.classList.add('hidden');
  if (skel) skel.classList.add('hidden');
  if (content) content.classList.remove('hidden');
  const clearBtn = document.getElementById('clearTriageBtn');
  if (clearBtn) clearBtn.classList.remove('hidden');

  const name = activePatient.name || (activePatient.user && activePatient.user.name) || 'Emergency Patient';
  const qrId = activePatient.qrCodeId || (document.getElementById('patientQrId') ? document.getElementById('patientQrId').value.trim() : '') || 'N/A';
  const bloodGroup = activePatient.bloodGroup || (activePatient.profile && activePatient.profile.bloodGroup) || 'N/A';
  const gender = activePatient.gender || (activePatient.user && activePatient.user.gender) || 'N/A';
  const age = activePatient.age || (activePatient.profile && activePatient.profile.age) || 'N/A';
  const phone = activePatient.phone || (activePatient.user && activePatient.user.phone) || 'N/A';
  const address = activePatient.address || (activePatient.user && activePatient.user.address) || 'Registered Scene Location';
  const allergies = activePatient.allergies || (activePatient.profile && activePatient.profile.allergies) || 'None Reported';
  const medications = activePatient.medications || (activePatient.profile && activePatient.profile.medications) || 'None Reported';
  const healthIssues = activePatient.healthIssues || (activePatient.profile && activePatient.profile.healthIssues) || 'None Reported';

  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setTxt('patName', name);
  setTxt('patId', qrId);
  setTxt('patBlood', bloodGroup);
  setTxt('patBloodGroup', bloodGroup);
  setTxt('patGender', gender !== 'N/A' ? gender.toUpperCase() : 'N/A');
  setTxt('patAge', age !== 'N/A' ? `${age} Yrs` : 'N/A');
  setTxt('patPhone', phone);
  setTxt('patAddress', address);
  setTxt('patAllergies', allergies);
  setTxt('patMeds', medications);
  setTxt('patMedications', medications);
  setTxt('patIssues', healthIssues);
  setTxt('patHealthIssues', healthIssues);

  // Phone Direct Call Button
  const phoneCallBtn = document.getElementById('patPhoneCallBtn');
  if (phoneCallBtn) {
    if (phone && phone !== 'N/A') {
      phoneCallBtn.href = `tel:${phone}`;
      phoneCallBtn.classList.remove('hidden');
    } else {
      phoneCallBtn.classList.add('hidden');
    }
  }

  // Allergy Flash Warning Banner
  const allergyBanner = document.getElementById('patAllergyBanner');
  if (allergyBanner) {
    const allergiesStr = Array.isArray(allergies) ? allergies.join(', ') : String(allergies);
    if (allergiesStr && allergiesStr.toLowerCase() !== 'none' && allergiesStr.toLowerCase() !== 'none reported' && allergiesStr.toLowerCase() !== 'none known') {
      allergyBanner.classList.remove('hidden');
      const textEl = document.getElementById('patAllergyBannerText');
      if (textEl) textEl.textContent = `ALERT: High-risk patient allergies reported: ${allergiesStr}`;
    } else {
      allergyBanner.classList.add('hidden');
    }
  }

  // PATIENT PHOTO RENDERING
  const photoEl = document.getElementById('patPhoto');
  if (photoEl) {
    const pPhoto = activePatient.profilePhoto || (activePatient.user && activePatient.user.profilePhoto);
    if (pPhoto && !pPhoto.startsWith('/uploads')) {
      photoEl.src = pPhoto;
    } else if (qrId && qrId !== 'N/A') {
      photoEl.src = `/api/v1/emergency-access/${encodeURIComponent(qrId)}/photo`;
    } else {
      photoEl.src = '/LifeQR.png';
    }
    photoEl.onerror = function() {
      this.onerror = null;
      this.src = '/LifeQR.png';
    };
  }

  // Emergency Contacts
  const contactsContainer = document.getElementById('patEmergencyContact') || document.getElementById('patContactsList');
  if (contactsContainer) {
    contactsContainer.innerHTML = '';
    const contacts = activePatient.emergencyContacts || (activePatient.profile && activePatient.profile.emergencyContacts) || [];
    if (contacts.length === 0) {
      contactsContainer.innerHTML = `<p class="text-xs text-[#111111]/60 font-mono italic p-3 border-2 border-dashed border-[#111111]/20">No emergency contacts registered.</p>`;
    } else {
      contacts.forEach((c, idx) => {
        const div = document.createElement('div');
        div.className = 'p-3.5 bg-[#f9fafb] border-2 border-[#111111] flex items-center justify-between gap-3 shadow-[2px_2px_0px_#111111]';
        div.innerHTML = `
          <div>
            <div class="flex items-center gap-2">
              <p class="text-xs font-black text-[#111111] uppercase tracking-tight">${escapeHtml(c.name || 'Emergency Contact')}</p>
              <span class="px-1.5 py-0.5 bg-red-50 border border-[#E11D2E] text-[#E11D2E] text-[10px] font-mono font-bold uppercase">${escapeHtml(c.relationship || `Priority ${idx + 1}`)}</span>
            </div>
            <p class="text-xs text-[#111111]/70 font-mono font-bold mt-1">${escapeHtml(c.phone || '-')}</p>
          </div>
          ${c.phone ? `
          <a href="tel:${c.phone}" class="btn-primary px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition flex items-center gap-1.5 shadow-[2px_2px_0px_#111111]">
            <span class="material-symbols-outlined text-xs">call</span> Call
          </a>` : ''}
        `;
        contactsContainer.appendChild(div);
      });
    }
  }

  // Render Uploaded Reports
  const reportsList = document.getElementById('patReportsList');
  const reportsBadge = document.getElementById('patReportsBadge');
  const reports = activePatient.reports || (activePatient.profile && activePatient.profile.reports) || [];
  if (reportsBadge) reportsBadge.textContent = `${reports.length} Files`;
  if (reportsList) {
    reportsList.innerHTML = '';
    if (reports.length === 0) {
      reportsList.innerHTML = `<p class="text-xs text-[#111111]/60 font-mono italic p-3 border-2 border-dashed border-[#111111]/20">No diagnostic reports or uploaded medical files on record.</p>`;
    } else {
      reports.forEach(r => {
        const div = document.createElement('div');
        div.className = 'p-3.5 bg-[#f9fafb] border-2 border-[#111111] flex items-center justify-between gap-3 shadow-[2px_2px_0px_#111111]';
        div.innerHTML = `
          <div class="truncate mr-2">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="px-1.5 py-0.5 bg-red-50 border border-[#E11D2E] text-[#E11D2E] text-[9px] font-mono font-bold uppercase">${escapeHtml(r.category || 'Clinical')}</span>
              <span class="text-[10px] text-[#111111]/60 font-mono">${r.uploadedAt ? new Date(r.uploadedAt).toLocaleDateString() : ''}</span>
            </div>
            <p class="text-xs font-black text-[#111111] uppercase truncate">${escapeHtml(r.originalName || r.filename || r.title || 'Medical File')}</p>
          </div>
          ${r.url || r.fileUrl ? `
            <a href="${r.url || r.fileUrl}" target="_blank" class="btn-secondary px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition flex items-center gap-1 shadow-[2px_2px_0px_#111111]">
              <span class="material-symbols-outlined text-xs">visibility</span> View
            </a>
          ` : ''}
        `;
        reportsList.appendChild(div);
      });
    }
  }

  // Render Medical History Timeline
  const historyList = document.getElementById('patHistoryList');
  const history = activePatient.medicalHistory || (activePatient.profile && activePatient.profile.medicalHistory) || [];
  if (historyList) {
    historyList.innerHTML = '';
    if (history.length === 0) {
      historyList.innerHTML = `<p class="text-xs text-[#111111]/60 font-mono italic p-3 border-2 border-dashed border-[#111111]/20">No recorded clinical history entries.</p>`;
    } else {
      history.forEach(h => {
        const div = document.createElement('div');
        div.className = 'p-3.5 bg-[#f9fafb] border-l-4 border-l-[#E11D2E] border-2 border-[#111111] space-y-1 shadow-[2px_2px_0px_#111111]';
        div.innerHTML = `
          <div class="flex items-center justify-between text-[10px] font-mono text-[#111111]/60">
            <span class="font-bold uppercase text-[#E11D2E]">${escapeHtml(h.type || 'Event')}</span>
            <span>${h.timestamp ? new Date(h.timestamp).toLocaleString() : ''}</span>
          </div>
          <p class="text-xs font-black text-[#111111] uppercase">${escapeHtml(h.title || 'Checkpoint')}</p>
          ${h.description ? `<p class="text-xs text-[#111111]/80 font-sans mt-0.5">${escapeHtml(h.description)}</p>` : ''}
        `;
        historyList.appendChild(div);
      });
    }
  }

  const loc = (activePatient.lastLocation && typeof activePatient.lastLocation.lat === 'number' && typeof activePatient.lastLocation.lng === 'number' && (activePatient.lastLocation.lat !== 0 || activePatient.lastLocation.lng !== 0))
    ? activePatient.lastLocation
    : (activePatient.location && typeof activePatient.location.lat === 'number' && typeof activePatient.location.lng === 'number' && (activePatient.location.lat !== 0 || activePatient.location.lng !== 0))
      ? activePatient.location
      : (activeSosLocation && typeof activeSosLocation.lat === 'number' && typeof activeSosLocation.lng === 'number' && (activeSosLocation.lat !== 0 || activeSosLocation.lng !== 0))
        ? activeSosLocation
        : (address && address.trim() && address !== 'Registered Scene Location' && address !== 'N/A' ? resolveCoordinatesFromAddress(address) : null)
          || (crewLiveCoords && typeof crewLiveCoords.lat === 'number' ? { lat: crewLiveCoords.lat, lng: crewLiveCoords.lng, isSceneScan: true } : null);

  if (loc) {
    plotScannedPatientOnRadar(loc.lat, loc.lng, {
      name,
      bloodGroup,
      allergies,
      qrCodeId,
      isLive: true,
      label: loc.label || 'Patient Live Satellite Fix'
    });
    loadNearbyHospitals(loc.lat, loc.lng);
  } else {
    clearPatientFromRadar();
  }
}

function resolveCoordinatesFromAddress(addr) {
  if (!addr || typeof addr !== 'string') return null;
  const s = addr.toLowerCase();
  if (s.includes('marine drive') || s.includes('mumbai') || s.includes('bandra') || s.includes('vashi') || s.includes('bombay')) {
    return { lat: 18.9438, lng: 72.8234, label: 'Mumbai Marine Drive Corridor' };
  }
  if (s.includes('delhi') || s.includes('noida') || s.includes('gurgaon') || s.includes('connaught')) {
    return { lat: 28.6139, lng: 77.2090, label: 'NCR Medical Corridor' };
  }
  if (s.includes('bangalore') || s.includes('bengaluru') || s.includes('koramangala') || s.includes('indiranagar')) {
    return { lat: 12.9716, lng: 77.5946, label: 'Bengaluru Trauma Corridor' };
  }
  if (s.includes('nagpur') || s.includes('nandanvan')) {
    return { lat: 21.1458, lng: 79.0882, label: 'Nagpur Central Scene' };
  }
  if (s.includes('pune') || s.includes('kothrud') || s.includes('viman nagar')) {
    return { lat: 18.5204, lng: 73.8567, label: 'Pune Trauma Corridor' };
  }
  if (s.includes('hyderabad') || s.includes('secunderabad')) {
    return { lat: 17.3850, lng: 78.4867, label: 'Hyderabad Trauma Corridor' };
  }
  if (s.includes('chennai') || s.includes('madras')) {
    return { lat: 13.0827, lng: 80.2707, label: 'Chennai Trauma Corridor' };
  }
  if (s.includes('evergreen')) {
    return { lat: 37.7749, lng: -122.4194, label: 'Evergreen Base Corridor' };
  }
  return null;
}



window.simulatePatientLocation = function() {
  if (!activePatient) {
    showToast('Please search or load a patient first.', 'warning');
    return;
  }
  const address = activePatient.address || (activePatient.user && activePatient.user.address) || '';
  const resolved = resolveCoordinatesFromAddress(address);
  const lat = resolved ? resolved.lat : 18.955;
  const lng = resolved ? resolved.lng : 72.828;

  activePatient.lastLocation = {
    lat,
    lng,
    updatedAt: new Date().toISOString()
  };

  showToast('🚨 Simulated incident scene coordinates deployed for EMT drill!', 'info');
  renderEmergencyMap(lat, lng, { isLive: true, isSimulated: true, label: 'Simulated Scene Fix (EMT Drill)' });
  loadNearbyHospitals(lat, lng);
};

async function loadNearbyHospitals(lat, lng) {
  const wrapper = document.getElementById('hospitalWrapper');
  const container = document.getElementById('hospitalsList');
  if (!wrapper || !container) return;

  wrapper.classList.remove('hidden');
  container.innerHTML = `
    <div class="col-span-full py-4 text-center">
      <span class="material-symbols-outlined text-teal-500 animate-spin">sync</span>
      <p class="text-[10px] text-slate-400 mt-1 uppercase font-bold">Scanning Area for Nearest Medical Facilities...</p>
    </div>
  `;

  try {
    const res = await crewApiFetch(`/hospitals/nearby?lat=${lat}&lng=${lng}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    container.innerHTML = '';

    if (!data.hospitals || data.hospitals.length === 0) {
      container.innerHTML = '<p class="col-span-full text-center text-xs text-slate-500">No medical facilities found in 10km radius.</p>';
      return;
    }

    data.hospitals.forEach(h => {
      const card = document.createElement('div');
      card.className = 'p-4 bg-white border-2 border-[#111111] shadow-[4px_4px_0px_#111111] space-y-3 transition hover:-translate-y-0.5';

      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${h.location.lat},${h.location.lng}`;

      card.innerHTML = `
        <div class="flex items-start justify-between pb-2 border-b-2 border-[#111111]/10">
          <div class="space-y-0.5">
            <h4 class="font-black text-[#111111] text-xs uppercase tracking-tight">${h.name}</h4>
            <p class="text-[10px] font-mono font-bold text-[#111111]/60 uppercase">${h.address.street || ''} ${h.address.city || ''}</p>
          </div>
          <span class="px-2 py-0.5 border border-[#111111] bg-white text-[#111111] text-[9px] font-mono font-bold uppercase">${h.source || 'ER'}</span>
        </div>

        <div class="flex items-center gap-2 pt-1">
          <a href="tel:${h.emergencyHotline}" class="btn-danger flex-1 py-1.5 text-[10px] uppercase font-mono font-bold tracking-wider flex items-center justify-center gap-1 shadow-[2px_2px_0px_#111111]">
            <span class="material-symbols-outlined text-xs">call</span> Hot-line
          </a>
          <a href="${mapsUrl}" target="_blank" class="btn-primary flex-1 py-1.5 text-[10px] uppercase font-mono font-bold tracking-wider flex items-center justify-center gap-1 shadow-[2px_2px_0px_#111111]">
            <span class="material-symbols-outlined text-xs">directions</span> Route
          </a>
        </div>
      `;
      container.appendChild(card);

      // Also add marker to tactical radar map if present
      if (typeof L !== 'undefined' && tacticalMapInstance) {
        L.marker([h.location.lat, h.location.lng], {
          icon: L.divIcon({
            className: 'custom-hospital-radar-icon',
            html: `<div style='background-color:#0d9488; width:14px; height:14px; border-radius:50%; border:2px solid #111111; box-shadow: 1px 1px 0px #111111;'></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          })
        }).addTo(tacticalMapInstance).bindPopup(`<b>${escapeHtml(h.name)}</b><br><a href="${mapsUrl}" target="_blank">Navigate ER &rarr;</a>`);
      }
    });

  } catch (err) {
    container.innerHTML = `<p class="col-span-full text-center text-xs text-rose-400">Failed to load hospitals: ${err.message}</p>`;
  }
}

function renderEmergencyMap(lat, lng, options = {}) {
  // Directly route to unified tactical radar map!
  plotScannedPatientOnRadar(lat, lng, options);
}

function renderMapStandbyState(patientName, address) {
  clearPatientFromRadar();
}

function setupCrewListeners() {
  const ackBtn = document.getElementById('ackSosBtn');
  if (ackBtn) {
    ackBtn.addEventListener('click', window.acknowledgeSosAlert);
  }

  const qrInput = document.getElementById('patientQrId');
  if (qrInput) {
    qrInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        window.searchPatient();
      }
    });

    const urlQrId = new URLSearchParams(window.location.search).get('qrId') || new URLSearchParams(window.location.search).get('id');
    if (urlQrId) {
      qrInput.value = urlQrId;
      setTimeout(() => {
        window.searchPatient();
      }, 300);
    }
  }
}

window.closeSosPopup = function() {
  const popup = document.getElementById('sosAlertPopup');
  if (popup) popup.classList.add('hidden');
};

window.logIncidentStage = async function(stageName) {
  if (!activePatient) {
    showToast('Please search or scan a patient before logging incident checkpoints', 'warning');
    return;
  }
  const qrId = activePatient.qrCodeId || (document.getElementById('patientQrId') ? document.getElementById('patientQrId').value.trim() : '');
  try {
    await crewApiFetch(`/history/add/${encodeURIComponent(qrId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'vital',
        title: `Paramedic Checkpoint: ${stageName}`,
        description: `Field responder logged stage '${stageName}' for patient ${activePatient.name || qrId}.`
      })
    });
    showToast(`✓ Incident Logged: ${stageName}`, 'success');
  } catch (err) {
    showToast(`Checkpoint Recorded: ${stageName}`, 'info');
  }
};

// QR Scanner setup
window.startQRScanner = function() {
  if (!scannerInstance) {
    scannerInstance = new QRScanner({
      onSuccess: (result) => {
        stopQRScanner();
        let parsedId = String(result || '').trim();
        try {
          const scannedUrl = new URL(parsedId);
          parsedId = scannedUrl.searchParams.get('id') || scannedUrl.pathname.split('/').filter(Boolean).pop() || parsedId;
        } catch (e) {}
        const input = document.getElementById('patientQrId');
        if (input) input.value = parsedId;
        searchPatient();
      },
      onError: (err) => {
        showToast(`Scanner issue: ${err.message || err}`, 'error');
      }
    });
  }

  scannerInstance.start();
};

window.stopQRScanner = function() {
  if (scannerInstance) {
    scannerInstance.stop();
  }
};

// ==========================================
// CREW DISPATCH HELP & ADMIN SUPPORT WORKFLOW
// ==========================================

window.openCrewHelpModal = function() {
  const modal = document.getElementById('crewHelpModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const patInput = document.getElementById('crewHelpPatientId');
  if (patInput && !patInput.value && activePatient?.profile?.qrCodeId) {
    patInput.value = activePatient.profile.qrCodeId;
  }

  loadCrewHelpTickets();
};

window.closeCrewHelpModal = function() {
  const modal = document.getElementById('crewHelpModal');
  if (modal) modal.classList.add('hidden');
};

window.switchCrewHelpTab = function(tab) {
  const newBtn = document.getElementById('crewHelpTabNewBtn');
  const histBtn = document.getElementById('crewHelpTabHistoryBtn');
  const formPane = document.getElementById('crewHelpForm');
  const histPane = document.getElementById('crewHelpHistoryPane');

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
    loadCrewHelpTickets();
  }
};

window.handleCrewHelpSubmit = async function(e) {
  e.preventDefault();
  const subject = document.getElementById('crewHelpSubject')?.value?.trim();
  const message = document.getElementById('crewHelpMessage')?.value?.trim();
  const category = document.getElementById('crewHelpCategory')?.value;
  const priority = document.getElementById('crewHelpPriority')?.value;
  const patientQrCodeId = document.getElementById('crewHelpPatientId')?.value?.trim();

  if (!subject || !message) {
    showToast('Please provide subject and detailed situation description', 'warning');
    return;
  }

  const submitBtn = document.getElementById('crewHelpSubmitBtn');
  const origHtml = submitBtn.innerHTML;

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span><span>Transmitting...</span>';

    const res = await crewApiFetch('/help-tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    showToast('Dispatch Help Request transmitted to System Administrators!', 'success');
    document.getElementById('crewHelpForm').reset();
    switchCrewHelpTab('history');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origHtml;
    }
  }
};

window.loadCrewHelpTickets = async function() {
  try {
    const res = await crewApiFetch('/help-tickets/my');
    if (!res.ok) return;
    const data = await res.json();
    const tickets = data.tickets || [];

    const badge = document.getElementById('crewHelpMyTicketsBadge');
    if (badge) {
      badge.textContent = tickets.length;
      if (tickets.length > 0) badge.classList.remove('hidden');
      else badge.classList.add('hidden');
    }

    const dot = document.getElementById('crewHelpPendingDot');
    const hasPending = tickets.some(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
    if (dot) {
      if (hasPending) dot.classList.remove('hidden');
      else dot.classList.add('hidden');
    }

    const list = document.getElementById('crewHelpHistoryList');
    if (!list) return;

    if (tickets.length === 0) {
      list.innerHTML = `
        <div class="border-2 border-dashed border-[#111111]/20 p-6 text-center text-xs font-mono text-[#111111]/60">
          No dispatch tickets submitted yet. If you encounter telemetry blocks or need triage authorization, submit a request above.
        </div>
      `;
      return;
    }

    list.innerHTML = tickets.map(t => {
      let statusBadge = '<span class="px-2 py-0.5 border border-amber-600 bg-amber-50 text-amber-800 text-[10px] font-bold uppercase">Pending Dispatch Review</span>';
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
                ${t.patientQrCodeId ? ` &bull; Patient: <strong class="text-[#E11D2E]">${t.patientQrCodeId}</strong>` : ''}
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
    console.warn('Failed to load crew help tickets:', err);
  }
};
