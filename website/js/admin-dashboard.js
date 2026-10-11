// Admin Dashboard JS Module
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await checkDashboardAccess(['admin']);
  if (!currentUser) return;

  // Initialize display details
  document.getElementById('userName').textContent = currentUser.name;

  // Load stats, users, verifications, and help tickets
  await loadAdminStats();
  await loadAdminUsers();
  await loadVerifications();
  await loadAdminHelpTickets();

  // Wire up Enter key on AI Chat Input
  const chatInput = document.getElementById('aiChatInput');
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitAiOpsQuery();
    });
  }
});

window.switchTab = function(tab) {
  const usersSec = document.getElementById('sectionUsers');
  const sosSec = document.getElementById('sectionSosCommand');
  const fleetSec = document.getElementById('sectionFleetControl');
  const godSec = document.getElementById('sectionGodMode');
  const verSec = document.getElementById('sectionVerifications');
  const helpSec = document.getElementById('sectionHelpTickets');
  const aiSec = document.getElementById('sectionAiOps');

  const usersBtn = document.getElementById('tabUsers');
  const sosBtn = document.getElementById('tabSosCommand');
  const fleetBtn = document.getElementById('tabFleetControl');
  const godBtn = document.getElementById('tabGodMode');
  const verBtn = document.getElementById('tabVerifications');
  const helpBtn = document.getElementById('tabHelpTickets');
  const aiBtn = document.getElementById('tabAiOps');

  // Hide all sections
  [usersSec, sosSec, fleetSec, godSec, verSec, helpSec, aiSec].forEach(s => {
    if (s) s.classList.add('hidden');
  });

  const activeClass = 'btn-primary px-5 py-2.5 uppercase tracking-wider font-bold shadow-[2px_2px_0px_#111111]';
  const inactiveClass = 'btn-secondary px-5 py-2.5 uppercase tracking-wider font-bold';

  if (usersBtn) usersBtn.className = inactiveClass;
  if (sosBtn) sosBtn.className = inactiveClass + ' flex items-center gap-1.5 text-[#E11D2E] hover:text-white';
  if (fleetBtn) fleetBtn.className = inactiveClass + ' flex items-center gap-1.5 text-blue-700 hover:text-white';
  if (godBtn) godBtn.className = inactiveClass + ' flex items-center gap-1.5 text-amber-700 hover:text-white';
  if (verBtn) verBtn.className = inactiveClass;
  if (helpBtn) helpBtn.className = inactiveClass + ' flex items-center gap-1.5 text-blue-700 hover:text-white';
  if (aiBtn) aiBtn.className = inactiveClass + ' flex items-center gap-1.5 text-[#E11D2E] hover:text-white';

  if (tab === 'users') {
    if (usersSec) usersSec.classList.remove('hidden');
    if (usersBtn) usersBtn.className = activeClass;
  } else if (tab === 'sosCommand') {
    if (sosSec) sosSec.classList.remove('hidden');
    if (sosBtn) sosBtn.className = activeClass + ' flex items-center gap-1.5';
    loadAdminSosIncidents();
  } else if (tab === 'fleetControl') {
    if (fleetSec) fleetSec.classList.remove('hidden');
    if (fleetBtn) fleetBtn.className = activeClass + ' flex items-center gap-1.5';
    loadAdminFleet();
  } else if (tab === 'godMode') {
    if (godSec) godSec.classList.remove('hidden');
    if (godBtn) godBtn.className = activeClass + ' flex items-center gap-1.5';
  } else if (tab === 'verifications') {
    if (verSec) verSec.classList.remove('hidden');
    if (verBtn) verBtn.className = activeClass;
  } else if (tab === 'helpTickets') {
    if (helpSec) helpSec.classList.remove('hidden');
    if (helpBtn) helpBtn.className = activeClass + ' flex items-center gap-1.5';
    loadAdminHelpTickets();
  } else if (tab === 'aiOps') {
    if (aiSec) aiSec.classList.remove('hidden');
    if (aiBtn) aiBtn.className = activeClass + ' flex items-center gap-1.5';
    loadAiOpsBrief();
  }
};

async function loadAdminStats() {
  try {
    const response = await fetch('/api/v1/admin/stats', { credentials: 'include' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    document.getElementById('statTotalUsers').textContent = data.users.total;
    document.getElementById('statPatients').textContent = data.users.patient;
    document.getElementById('statDoctors').textContent = data.users.doctor;
    document.getElementById('statCrew').textContent = data.users.crew;
    document.getElementById('statTotalScans').textContent = data.stats.scans;
    if (document.getElementById('statTotalSos')) {
      document.getElementById('statTotalSos').textContent = data.stats?.sos || 0;
    }

    if (document.getElementById('statPendingVerifications')) {
      document.getElementById('statPendingVerifications').textContent = data.verification.pending;
    }

    if (data.helpTickets) {
      const statHelp = document.getElementById('statHelpTickets');
      if (statHelp) statHelp.textContent = data.helpTickets.pending || 0;

      const tabBadge = document.getElementById('statHelpTicketsTabBadge');
      if (tabBadge) {
        tabBadge.textContent = `${data.helpTickets.pending || 0} Pending`;
        if (data.helpTickets.pending > 0) tabBadge.classList.remove('hidden');
        else tabBadge.classList.add('hidden');
      }
    }

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// State variables for user management
let cachedAdminUsers = [];
let activeUserRoleFilter = 'ALL';
let activeUserSearchQuery = '';
let currentInspectedUserForProfile = null;
let currentInspectedTicket = null;

async function loadAdminUsers() {
  try {
    const response = await fetch('/api/v1/admin/users', { credentials: 'include' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    cachedAdminUsers = data.users || [];

    // Calculate role counts
    const total = cachedAdminUsers.length;
    const patients = cachedAdminUsers.filter(u => u.role === 'patient').length;
    const doctors = cachedAdminUsers.filter(u => u.role === 'doctor').length;
    const crew = cachedAdminUsers.filter(u => u.role === 'crew').length;
    const admins = cachedAdminUsers.filter(u => u.role === 'admin').length;

    const elAll = document.getElementById('countRoleAll');
    if (elAll) elAll.textContent = total;
    const elPat = document.getElementById('filterRolePatient');
    if (elPat) elPat.textContent = `Patients (${patients})`;
    const elDoc = document.getElementById('filterRoleDoctor');
    if (elDoc) elDoc.textContent = `Doctors (${doctors})`;
    const elCrew = document.getElementById('filterRoleCrew');
    if (elCrew) elCrew.textContent = `Crew (${crew})`;
    const elAdmin = document.getElementById('filterRoleAdmin');
    if (elAdmin) elAdmin.textContent = `Admins (${admins})`;

    renderAdminUsersTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function filterAdminUsers(role) {
  activeUserRoleFilter = role;

  const btnAll = document.getElementById('filterRoleAll');
  const btnPat = document.getElementById('filterRolePatient');
  const btnDoc = document.getElementById('filterRoleDoctor');
  const btnCrew = document.getElementById('filterRoleCrew');
  const btnAdmin = document.getElementById('filterRoleAdmin');

  const activeClass = 'px-3 py-1.5 bg-[#111111] text-white transition';
  const inactiveClass = 'px-3 py-1.5 bg-white text-[#111111] hover:bg-gray-100 transition border-l border-[#111111]';

  if (btnAll) btnAll.className = role === 'ALL' ? activeClass : inactiveClass.replace('border-l border-[#111111]', '');
  if (btnPat) btnPat.className = role === 'patient' ? activeClass : inactiveClass;
  if (btnDoc) btnDoc.className = role === 'doctor' ? activeClass : inactiveClass;
  if (btnCrew) btnCrew.className = role === 'crew' ? activeClass : inactiveClass;
  if (btnAdmin) btnAdmin.className = role === 'admin' ? activeClass : inactiveClass;

  renderAdminUsersTable();
}

function handleAdminUserSearch(query) {
  activeUserSearchQuery = (query || '').toLowerCase().trim();
  renderAdminUsersTable();
}

function renderAdminUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  let list = [...cachedAdminUsers];
  if (activeUserRoleFilter !== 'ALL') {
    list = list.filter(u => u.role === activeUserRoleFilter);
  }
  if (activeUserSearchQuery) {
    list = list.filter(u => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      const qrid = (u.roleDetails?.qrCodeId || '').toLowerCase();
      const lic = (u.roleDetails?.licenseNumber || '').toLowerCase();
      const veh = (u.roleDetails?.vehicleNumber || '').toLowerCase();
      return name.includes(activeUserSearchQuery) ||
             email.includes(activeUserSearchQuery) ||
             phone.includes(activeUserSearchQuery) ||
             qrid.includes(activeUserSearchQuery) ||
             lic.includes(activeUserSearchQuery) ||
             veh.includes(activeUserSearchQuery);
    });
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center p-8 font-mono text-xs text-[#111111]/60 uppercase font-bold">No user accounts found matching selected criteria.</td></tr>`;
    return;
  }

  list.forEach((u, index) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b-2 border-[#111111]/10 hover:bg-[#f9fafb] transition font-sans';

    let roleBadge = '<span class="px-2 py-0.5 border border-[#111111] bg-gray-50 text-[#111111] font-mono font-bold text-[10px] uppercase">PATIENT</span>';
    if (u.role === 'doctor') {
      roleBadge = '<span class="px-2 py-0.5 border border-blue-600 bg-blue-50 text-blue-800 font-mono font-bold text-[10px] uppercase">DOCTOR</span>';
    } else if (u.role === 'crew') {
      roleBadge = '<span class="px-2 py-0.5 border border-[#E11D2E] bg-red-50 text-[#E11D2E] font-mono font-bold text-[10px] uppercase">PARAMEDIC</span>';
    } else if (u.role === 'admin') {
      roleBadge = '<span class="px-2 py-0.5 border border-[#111111] bg-[#111111] text-white font-mono font-bold text-[10px] uppercase">ADMIN</span>';
    }

    let summaryHtml = '<span class="text-gray-400 font-mono text-[10px]">-</span>';
    if (u.role === 'patient') {
      summaryHtml = `
        <div class="font-mono text-xs leading-tight">
          <span class="font-bold text-[#E11D2E]">${u.roleDetails?.qrCodeId || 'No QR'}</span>
          <span class="text-gray-500 text-[10px] block">&bull; Blood: ${u.roleDetails?.bloodGroup || 'N/A'} &bull; ${u.roleDetails?.contactsCount || 0} Contacts</span>
        </div>
      `;
    } else if (u.role === 'doctor') {
      summaryHtml = `
        <div class="font-mono text-xs leading-tight">
          <span class="font-bold text-blue-800">${u.roleDetails?.licenseNumber || 'Lic: Pending'}</span>
          <span class="text-gray-500 text-[10px] block">&bull; ${u.roleDetails?.specialization || 'Practitioner'} &bull; ${u.roleDetails?.hospital || 'Clinic'}</span>
        </div>
      `;
    } else if (u.role === 'crew') {
      summaryHtml = `
        <div class="font-mono text-xs leading-tight">
          <span class="font-bold text-[#E11D2E]">${u.roleDetails?.vehicleNumber || 'Unit: Pending'}</span>
          <span class="text-gray-500 text-[10px] block">&bull; ${u.roleDetails?.crewType || 'ambulance'} &bull; ${u.roleDetails?.station || 'Base Station'}</span>
        </div>
      `;
    } else if (u.role === 'admin') {
      summaryHtml = `<span class="font-mono text-[10px] font-bold text-gray-700 uppercase">Tier-1 Root Security</span>`;
    }

    let verBadge = '<span class="px-1.5 py-0.5 border border-emerald-600 bg-emerald-50 text-emerald-800 font-mono text-[9px] font-bold uppercase">VERIFIED</span>';
    if (u.verificationStatus === 'PENDING') {
      verBadge = '<span class="px-1.5 py-0.5 border border-amber-600 bg-amber-50 text-amber-900 font-mono text-[9px] font-bold uppercase">PENDING</span>';
    } else if (u.verificationStatus === 'UNDER_REVIEW') {
      verBadge = '<span class="px-1.5 py-0.5 border border-blue-600 bg-blue-50 text-blue-900 font-mono text-[9px] font-bold uppercase">REVIEW</span>';
    } else if (u.verificationStatus === 'SUSPENDED' || u.verificationStatus === 'REVOKED') {
      verBadge = '<span class="px-1.5 py-0.5 border border-[#E11D2E] bg-red-50 text-[#E11D2E] font-mono text-[9px] font-bold uppercase">SUSPENDED</span>';
    }

    const activePill = u.active
      ? '<span class="px-1.5 py-0.5 border border-emerald-600 bg-emerald-50 text-emerald-800 font-mono text-[9px] font-bold uppercase">Active</span>'
      : '<span class="px-1.5 py-0.5 border border-gray-400 bg-gray-100 text-gray-600 font-mono text-[9px] font-bold uppercase">Inactive</span>';

    const ticketBadge = (u.pendingTickets && u.pendingTickets > 0)
      ? `<button onclick="openAdminUserProfile('${u._id}')" class="px-2 py-0.5 border border-[#E11D2E] bg-red-100 text-[#E11D2E] font-mono text-[10px] font-bold rounded-full hover:bg-red-200 transition" title="Click to troubleshoot open tickets">${u.pendingTickets} Open</button>`
      : '<span class="text-gray-400 font-mono text-[10px]">None</span>';

    const toggleBtn = u.role !== 'admin'
      ? `<button onclick="toggleUserStatus('${u._id}', ${!u.active})" class="btn-secondary px-2.5 py-1 text-[10px] uppercase font-mono font-bold tracking-wider ${u.active ? 'text-[#E11D2E]' : 'text-emerald-700'}" title="${u.active ? 'Deactivate Account' : 'Activate Account'}">${u.active ? 'Disable' : 'Enable'}</button>`
      : '';

    tr.innerHTML = `
      <td class="p-3 text-[#111111]/60 font-mono font-bold text-xs">${index + 1}</td>
      <td class="p-3">
        <p class="font-black text-[#111111] text-xs uppercase tracking-tight">${escapeHtml(u.name)}</p>
        <p class="text-[10px] font-mono text-[#111111]/60 font-bold">${escapeHtml(u.email)}</p>
        ${u.phone ? `<p class="text-[9px] font-mono text-gray-500">${escapeHtml(u.phone)}</p>` : ''}
      </td>
      <td class="p-3">
        ${roleBadge}
        <span class="block text-[9px] font-mono text-gray-400 mt-1">${new Date(u.createdAt).toLocaleDateString()}</span>
      </td>
      <td class="p-3">${summaryHtml}</td>
      <td class="p-3">
        <div class="flex items-center gap-1.5 flex-wrap">
          ${activePill}
          ${verBadge}
        </div>
      </td>
      <td class="p-3 text-center">${ticketBadge}</td>
      <td class="p-3 text-right">
        <div class="flex items-center justify-end gap-1.5 font-mono">
          ${u.role === 'patient' ? `
            <button onclick="openEmergencyLivePreview('${u._id}')" class="btn-secondary text-[10px] px-2 py-1 uppercase font-bold flex items-center gap-1 text-[#E11D2E]" title="Test & Preview Emergency View">
              <span class="material-symbols-outlined text-xs">emergency</span>
              <span class="hidden xl:inline">Emergency View</span>
            </button>
          ` : ''}
          <button onclick="openAdminUserProfile('${u._id}')" class="btn-primary text-[10px] px-2.5 py-1 uppercase font-bold tracking-wider flex items-center gap-1 shadow-[1px_1px_0px_#111111]" title="Inspect, Edit, and Fix User Profile">
            <span class="material-symbols-outlined text-xs text-[#E11D2E]">edit_square</span>
            <span>Manage &amp; Fix</span>
          </button>
          ${toggleBtn}
          <button onclick="adminDeleteUser('${u._id}', '${escapeHtml(u.name)}')" class="btn-secondary px-2 py-1 text-[10px] uppercase font-mono font-bold tracking-wider text-[#E11D2E] hover:bg-red-600 hover:text-white" title="Purge user account (God Mode)">
            <span class="material-symbols-outlined text-xs">delete</span>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// State variables for verifications and AI Sentinel
let cachedVerifications = [];
let aiAuditCache = {};
let activeVerificationFilter = 'ALL';
let currentInspectedUser = null;
let currentInspectedAudit = null;

async function loadVerifications() {
  try {
    const response = await fetch('/api/v1/admin/verifications', { credentials: 'include' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    cachedVerifications = data.verifications || [];

    // Update filter counts
    const totalCount = cachedVerifications.length;
    const missingCount = cachedVerifications.filter(v => v.documentsCount === 0).length;
    const docsCount = cachedVerifications.filter(v => v.documentsCount > 0).length;

    const elTotal = document.getElementById('countFilterAll');
    const elMissing = document.getElementById('countFilterMissing');
    const elDocs = document.getElementById('countFilterDocs');
    if (elTotal) elTotal.textContent = totalCount;
    if (elMissing) elMissing.textContent = missingCount;
    if (elDocs) elDocs.textContent = docsCount;

    const aiTotal = document.getElementById('aiStatTotal');
    if (aiTotal) aiTotal.textContent = totalCount;

    renderVerificationsTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderVerificationsTable() {
  const tbody = document.getElementById('verificationsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  let list = [...cachedVerifications];
  if (activeVerificationFilter === 'MISSING') {
    list = list.filter(v => v.documentsCount === 0);
  } else if (activeVerificationFilter === 'DOCS_PRESENT') {
    list = list.filter(v => v.documentsCount > 0);
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8 font-mono text-xs text-[#111111]/60 uppercase font-bold">No verifications matching selected filter.</td></tr>`;
    return;
  }

  list.forEach(v => {
    const tr = document.createElement('tr');
    tr.className = 'border-b-2 border-[#111111]/10 hover:bg-[#f9fafb] transition font-sans';

    // AI Column presentation
    const audit = aiAuditCache[v.id];
    let aiBadgeHtml = '';

    if (audit) {
      if (audit.riskLevel === 'HIGH') {
        aiBadgeHtml = `
          <button onclick="inspectWithAI('${v.id}')" class="px-2.5 py-1 border border-[#E11D2E] bg-red-50 hover:bg-red-100 text-[#E11D2E] font-mono font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 transition" title="Click to view AI findings">
            <span class="w-2 h-2 rounded-full bg-[#E11D2E] animate-pulse"></span>
            <span>HIGH RISK (${audit.score}%)</span>
          </button>
        `;
      } else if (audit.riskLevel === 'MEDIUM') {
        aiBadgeHtml = `
          <button onclick="inspectWithAI('${v.id}')" class="px-2.5 py-1 border border-amber-600 bg-amber-50 hover:bg-amber-100 text-amber-800 font-mono font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 transition" title="Click to view AI findings">
            <span class="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>MED RISK (${audit.score}%)</span>
          </button>
        `;
      } else {
        aiBadgeHtml = `
          <button onclick="inspectWithAI('${v.id}')" class="px-2.5 py-1 border border-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-mono font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 transition" title="Click to view AI findings">
            <span class="w-2 h-2 rounded-full bg-emerald-600"></span>
            <span>VERIFIED (${audit.score}%)</span>
          </button>
        `;
      }
    } else {
      aiBadgeHtml = `
        <button onclick="inspectWithAI('${v.id}')" class="px-2.5 py-1 border border-[#111111]/40 bg-white hover:bg-gray-100 text-[#111111] font-mono font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 transition" title="Run AI Audit">
          <span class="material-symbols-outlined text-xs text-[#E11D2E]">auto_awesome</span>
          <span>AI Audit</span>
        </button>
      `;
    }

    const docCountColor = v.documentsCount === 0 ? 'text-[#E11D2E]' : 'text-emerald-700';

    tr.innerHTML = `
      <td class="p-3">
        <p class="font-black text-[#111111] text-xs uppercase tracking-tight">${v.name}</p>
        <p class="text-[10px] font-mono text-[#111111]/60 font-bold">${v.email}</p>
      </td>
      <td class="p-3">
        <span class="px-2 py-0.5 border border-[#111111] bg-white font-mono font-bold text-[10px] uppercase tracking-wider text-[#111111]">${v.role.toUpperCase()}</span>
      </td>
      <td class="p-3 ${docCountColor} font-mono font-bold text-xs">${v.documentsCount} Files</td>
      <td class="p-3">${aiBadgeHtml}</td>
      <td class="p-3">
        <span class="px-2 py-0.5 border border-amber-600 bg-amber-50 font-mono font-bold text-[10px] uppercase text-amber-800">${v.verificationStatus}</span>
      </td>
      <td class="p-3 text-right flex items-center justify-end gap-1.5 flex-wrap">
        <button onclick="inspectWithAI('${v.id}')" class="btn-secondary px-2.5 py-1 text-[10px] uppercase font-mono font-bold tracking-wider flex items-center gap-1" title="View AI Credential Audit">
          <span class="material-symbols-outlined text-xs text-[#E11D2E]">psychology</span>
          <span class="hidden sm:inline">AI Inspect</span>
        </button>
        <button onclick="approveVerification('${v.id}')" class="btn-primary px-3 py-1 text-[10px] uppercase font-mono font-bold tracking-wider">Approve</button>
        <button onclick="rejectVerification('${v.id}')" class="btn-danger px-3 py-1 text-[10px] uppercase font-mono font-bold tracking-wider">Reject</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.filterVerifications = function(type) {
  activeVerificationFilter = type;
  const btnAll = document.getElementById('filterBtnAll');
  const btnMissing = document.getElementById('filterBtnMissing');
  const btnDocs = document.getElementById('filterBtnDocs');

  if (btnAll) btnAll.className = type === 'ALL' ? 'px-3 py-1 border-2 border-[#111111] bg-[#111111] text-white font-bold uppercase tracking-wider' : 'px-3 py-1 border-2 border-[#111111] bg-white text-[#111111] font-bold uppercase tracking-wider hover:bg-[#f9fafb]';
  if (btnMissing) btnMissing.className = type === 'MISSING' ? 'px-3 py-1 border-2 border-[#111111] bg-[#111111] text-white font-bold uppercase tracking-wider' : 'px-3 py-1 border-2 border-[#111111] bg-white text-[#E11D2E] font-bold uppercase tracking-wider hover:bg-[#f9fafb]';
  if (btnDocs) btnDocs.className = type === 'DOCS_PRESENT' ? 'px-3 py-1 border-2 border-[#111111] bg-[#111111] text-white font-bold uppercase tracking-wider' : 'px-3 py-1 border-2 border-[#111111] bg-white text-emerald-700 font-bold uppercase tracking-wider hover:bg-[#f9fafb]';

  renderVerificationsTable();
};

window.runBatchAIAudit = async function() {
  const btn = document.getElementById('btnAiBatchAudit');
  const originalText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = `<span class="material-symbols-outlined text-sm animate-spin">refresh</span><span>Screening Queue...</span>`;
    btn.disabled = true;
  }

  try {
    const res = await fetch('/api/v1/admin/ai-batch-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    // Cache results
    data.results.forEach(r => {
      aiAuditCache[r.userId] = r;
    });

    // Update KPI UI
    const elHigh = document.getElementById('aiStatHighRisk');
    const elLow = document.getElementById('aiStatLowRisk');
    const elAvg = document.getElementById('aiStatAvgScore');
    if (elHigh) elHigh.textContent = data.summary.highRisk;
    if (elLow) elLow.textContent = data.summary.lowRisk;
    if (elAvg) elAvg.textContent = `${data.summary.averageScore}%`;

    renderVerificationsTable();
    showToast(`AI Sentinel screened ${data.summary.total} practitioners (${data.summary.highRisk} High Risk, ${data.summary.lowRisk} Low Risk)`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }
};

window.inspectWithAI = async function(userId) {
  const modal = document.getElementById('aiInspectionModal');
  if (!modal) return;

  const target = cachedVerifications.find(v => v.id === userId);
  currentInspectedUser = target || { id: userId, name: 'Practitioner', role: 'doctor' };

  modal.classList.remove('hidden');

  // Populate basic info
  document.getElementById('aiModalPractitionerSub').textContent = `${(currentInspectedUser.name || 'Practitioner').toUpperCase()} • ${(currentInspectedUser.role || '').toUpperCase()}`;
  document.getElementById('aiModalTrustScoreText').textContent = 'Analyzing...';
  document.getElementById('aiModalProgressBar').style.width = '20%';
  document.getElementById('aiModalFlagsList').innerHTML = '<div class="text-[#111111]/50 italic">AI evaluating council & credential files...</div>';
  document.getElementById('aiModalSignalsList').innerHTML = '';
  document.getElementById('aiModalSummaryText').textContent = 'Running neural credential verification heuristics...';

  try {
    let audit = aiAuditCache[userId];
    if (!audit) {
      const res = await fetch(`/api/v1/admin/ai-verify/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      audit = data.audit;
      aiAuditCache[userId] = audit;
      renderVerificationsTable();
    }

    currentInspectedAudit = audit;

    // Update modal UI
    document.getElementById('aiModalTrustScoreText').textContent = `${audit.score} / 100`;
    const bar = document.getElementById('aiModalProgressBar');
    bar.style.width = `${audit.score}%`;

    const badge = document.getElementById('aiModalRiskBadge');
    if (audit.riskLevel === 'HIGH') {
      bar.className = 'h-full bg-[#E11D2E] transition-all duration-500';
      badge.className = 'px-2 py-0.5 border border-[#E11D2E] bg-red-100 text-[#E11D2E] font-mono font-bold';
      badge.textContent = `HIGH RISK (${audit.score}%)`;
    } else if (audit.riskLevel === 'MEDIUM') {
      bar.className = 'h-full bg-amber-500 transition-all duration-500';
      badge.className = 'px-2 py-0.5 border border-amber-600 bg-amber-100 text-amber-800 font-mono font-bold';
      badge.textContent = `MEDIUM RISK (${audit.score}%)`;
    } else {
      bar.className = 'h-full bg-emerald-600 transition-all duration-500';
      badge.className = 'px-2 py-0.5 border border-emerald-600 bg-emerald-100 text-emerald-800 font-mono font-bold';
      badge.textContent = `VERIFIED / LOW RISK (${audit.score}%)`;
    }

    document.getElementById('aiModalRecBadge').textContent = audit.recommendation.replace(/_/g, ' ');

    // Flags
    const flagsList = document.getElementById('aiModalFlagsList');
    if (audit.flags.length === 0) {
      flagsList.innerHTML = '<p class="text-emerald-700 font-mono text-[11px]">✔ Zero anomalies detected. Clean verification profile.</p>';
    } else {
      flagsList.innerHTML = audit.flags.map(f => `
        <div class="flex items-start gap-1.5 text-xs text-[#E11D2E]">
          <span class="material-symbols-outlined text-sm flex-shrink-0 mt-0.5">error</span>
          <span>${f}</span>
        </div>
      `).join('');
    }

    // Signals
    const signalsList = document.getElementById('aiModalSignalsList');
    if (audit.positiveSignals.length === 0) {
      signalsList.innerHTML = '<p class="text-[#111111]/50 font-mono text-[11px]">No verified council registry signals found.</p>';
    } else {
      signalsList.innerHTML = audit.positiveSignals.map(s => `
        <div class="flex items-start gap-1.5 text-xs text-emerald-800">
          <span class="material-symbols-outlined text-sm flex-shrink-0 mt-0.5">verified</span>
          <span>${s}</span>
        </div>
      `).join('');
    }

    document.getElementById('aiModalSummaryText').textContent = audit.summary;

  } catch (err) {
    showToast(err.message, 'error');
    document.getElementById('aiModalSummaryText').textContent = `AI Audit Failed: ${err.message}`;
  }
};

window.closeAiModal = function() {
  const modal = document.getElementById('aiInspectionModal');
  if (modal) modal.classList.add('hidden');
};

// ============================================================
// SYSTEM CONFIRMATION & PROMPT DIALOG (Editorial Modal System)
// ============================================================

window.adminConfirmDialog = function(options = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('adminConfirmModal');
    if (!modal) {
      return resolve(window.confirm(options.message || 'Are you sure you want to proceed?'));
    }

    const titleEl = document.getElementById('adminConfirmTitle');
    const subEl = document.getElementById('adminConfirmSubtitle');
    const msgEl = document.getElementById('adminConfirmMessage');
    const warningEl = document.getElementById('adminConfirmWarning');
    const warningBox = document.getElementById('adminConfirmWarningBox');
    const iconEl = document.getElementById('adminConfirmIcon');
    const iconWrap = document.getElementById('adminConfirmIconWrap');
    const inputWrap = document.getElementById('adminConfirmInputWrap');
    const inputLabel = document.getElementById('adminConfirmInputLabel');
    const inputEl = document.getElementById('adminConfirmInput');
    const okBtn = document.getElementById('adminConfirmOkBtn');
    const cancelBtn = document.getElementById('adminConfirmCancelBtn');
    const closeBtn = document.getElementById('adminConfirmCloseBtn');

    if (titleEl) titleEl.textContent = options.title || 'Action Confirmation';
    if (subEl) subEl.textContent = options.subtitle || 'ADMINISTRATIVE OVERRIDE';
    if (msgEl) msgEl.innerHTML = options.message || 'Are you sure you want to proceed with this action?';

    if (warningBox && warningEl) {
      if (options.warning) {
        warningEl.innerHTML = options.warning;
        warningBox.classList.remove('hidden');
      } else {
        warningBox.classList.add('hidden');
      }
    }

    if (inputWrap) {
      if (options.showInput) {
        inputWrap.classList.remove('hidden');
        if (inputLabel) inputLabel.textContent = options.inputLabel || 'Notes / Justification';
        if (inputEl) {
          inputEl.value = options.inputValue || '';
          inputEl.placeholder = options.inputPlaceholder || 'Type note here...';
        }
      } else {
        inputWrap.classList.add('hidden');
      }
    }

    if (iconEl) iconEl.textContent = options.icon || 'warning';
    if (iconWrap) {
      if (options.iconBg) {
        iconWrap.className = `w-10 h-10 ${options.iconBg} ${options.iconColor || 'text-white'} flex items-center justify-center border-2 border-[#111111] shrink-0 font-bold`;
      } else {
        iconWrap.className = 'w-10 h-10 bg-[#111111] text-[#E11D2E] flex items-center justify-center border-2 border-[#111111] shrink-0 font-bold';
      }
    }

    if (okBtn) {
      const okIcon = options.confirmIcon || 'check_circle';
      const okText = options.confirmText || 'Confirm Action';
      okBtn.innerHTML = `<span class="material-symbols-outlined text-sm">${okIcon}</span><span>${okText}</span>`;
      if (options.confirmClass) {
        okBtn.className = options.confirmClass;
      } else {
        okBtn.className = 'btn-primary px-5 py-2 uppercase font-bold text-xs tracking-wider flex items-center gap-1.5 shadow-[2px_2px_0px_#111111]';
      }
    }

    if (cancelBtn) {
      cancelBtn.textContent = options.cancelText || 'Cancel';
    }

    const cleanup = () => {
      modal.classList.add('hidden');
      window.removeEventListener('keydown', keyHandler);
      if (okBtn) okBtn.onclick = null;
      if (cancelBtn) cancelBtn.onclick = null;
      if (closeBtn) closeBtn.onclick = null;
      modal.onclick = null;
    };

    const handleConfirm = () => {
      const val = options.showInput ? (inputEl ? inputEl.value : '') : true;
      cleanup();
      resolve(val);
    };

    const handleCancel = () => {
      cleanup();
      resolve(options.showInput ? null : false);
    };

    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
        if (document.activeElement !== cancelBtn) {
          e.preventDefault();
          handleConfirm();
        }
      }
    };

    if (okBtn) okBtn.onclick = handleConfirm;
    if (cancelBtn) cancelBtn.onclick = handleCancel;
    if (closeBtn) closeBtn.onclick = handleCancel;

    modal.onclick = (e) => {
      if (e.target === modal) handleCancel();
    };

    window.addEventListener('keydown', keyHandler);
    modal.classList.remove('hidden');

    setTimeout(() => {
      if (options.showInput && inputEl) {
        inputEl.focus();
      } else if (okBtn) {
        okBtn.focus();
      }
    }, 50);
  });
};

window.adminPromptDialog = function(options = {}) {
  return window.adminConfirmDialog({
    ...options,
    showInput: true
  });
};

window.applyAiApprove = async function() {
  if (!currentInspectedUser) return;
  const confirmed = await adminConfirmDialog({
    title: 'Confirm AI-Cleared Approval',
    subtitle: 'PRACTITIONER VERIFICATION',
    icon: 'verified',
    iconBg: 'bg-emerald-700',
    iconColor: 'text-white',
    message: `Approve and verify credentials for <strong>${currentInspectedUser.name}</strong> based on AI Sentinel clearance?`,
    warning: 'The practitioner will be granted official verified clinical status immediately.',
    confirmText: 'Approve Practitioner',
    confirmIcon: 'verified',
    confirmClass: 'bg-emerald-700 hover:bg-emerald-800 text-white font-mono font-bold text-xs uppercase px-5 py-2.5 border-2 border-[#111111] flex items-center gap-1.5 shadow-[2px_2px_0px_#111111]'
  });
  if (!confirmed) return;
  closeAiModal();
  await updateVerification(currentInspectedUser.id, 'VERIFIED', 'Verified by Admin via AI Sentinel clearance');
};

window.applyAiReject = async function() {
  if (!currentInspectedUser) return;
  const reason = currentInspectedAudit ? currentInspectedAudit.summary : 'Documents incomplete or invalid';
  closeAiModal();
  await updateVerification(currentInspectedUser.id, 'REVOKED', reason);
};

window.autoRejectMissingCredentials = async function() {
  const missingCount = cachedVerifications.filter(v => v.documentsCount === 0).length;
  if (missingCount === 0) {
    showToast('No pending accounts with 0 documents found.', 'info');
    return;
  }

  const confirmed = await adminConfirmDialog({
    title: 'Batch Reject Uncredentialed Accounts',
    subtitle: 'AI SENTINEL AUTO-TRIAGE',
    icon: 'rule',
    iconBg: 'bg-[#E11D2E]',
    iconColor: 'text-white',
    message: `Are you sure you want AI Sentinel to auto-reject <strong>${missingCount} account(s)</strong> that have 0 uploaded credentials?`,
    warning: 'Affected practitioners will be marked as REVOKED and notified to upload official license certificates.',
    confirmText: `Auto-Reject (${missingCount})`,
    confirmIcon: 'block',
    confirmClass: 'bg-[#E11D2E] hover:bg-red-700 text-white font-mono font-bold text-xs uppercase px-5 py-2.5 border-2 border-[#111111] flex items-center gap-1.5 shadow-[2px_2px_0px_#111111]'
  });
  if (!confirmed) return;

  try {
    const res = await fetch('/api/v1/admin/ai-batch-reject-missing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast(data.message, 'success');
    await loadAdminStats();
    await loadVerifications();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.approveVerification = async function(userId) {
  const confirmed = await adminConfirmDialog({
    title: 'Approve Healthcare Practitioner',
    subtitle: 'OFFICIAL CREDENTIAL VERIFICATION',
    icon: 'verified_user',
    iconBg: 'bg-emerald-700',
    iconColor: 'text-white',
    message: 'Are you sure you want to approve this professional practitioner for full clinical portal access?',
    confirmText: 'Approve Practitioner',
    confirmIcon: 'check_circle',
    confirmClass: 'bg-emerald-700 hover:bg-emerald-800 text-white font-mono font-bold text-xs uppercase px-5 py-2.5 border-2 border-[#111111] flex items-center gap-1.5 shadow-[2px_2px_0px_#111111]'
  });
  if (!confirmed) return;
  updateVerification(userId, 'VERIFIED', 'Verified by Admin');
};

window.rejectVerification = async function(userId) {
  const note = await adminPromptDialog({
    title: 'Revoke Practitioner Application',
    subtitle: 'CREDENTIAL AUDIT REJECTION',
    icon: 'block',
    iconBg: 'bg-[#E11D2E]',
    iconColor: 'text-white',
    message: 'Specify the reason for revoking or rejecting this practitioner\'s credentials. The practitioner will receive this notification.',
    warning: 'The practitioner\'s verification status will be changed to REVOKED.',
    inputLabel: 'Reason for Rejection',
    inputPlaceholder: 'e.g. Unclear medical license badge / Expired council certificate',
    confirmText: 'Revoke Credentials',
    confirmIcon: 'close',
    confirmClass: 'bg-[#E11D2E] hover:bg-red-700 text-white font-mono font-bold text-xs uppercase px-5 py-2.5 border-2 border-[#111111] flex items-center gap-1.5 shadow-[2px_2px_0px_#111111]'
  });
  if (note === null) return;
  updateVerification(userId, 'REVOKED', note || 'Documents incomplete or invalid');
};

async function updateVerification(userId, status, note) {
  try {
    const res = await fetch(`/api/v1/admin/verifications/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status, note })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast(`Practitioner ${status.toLowerCase()} successfully!`, 'success');
    await loadAdminStats();
    await loadVerifications();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

window.toggleUserStatus = async function(userId, activeState) {
  try {
    const response = await fetch(`/api/v1/admin/users/${userId}/toggle-status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ active: activeState })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    showToast(data.message, 'success');
    await loadAdminUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// ============================================================
// AI Operations & Copilot Module Functions
// ============================================================

window.loadAiOpsBrief = async function() {
  try {
    const res = await fetch('/api/v1/admin/ai-ops/system-brief', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const brief = data.brief;
    const elHealth = document.getElementById('aiOpsHealthScore');
    const elThreat = document.getElementById('aiOpsThreatLevel');
    const elTime = document.getElementById('aiOpsBriefTimestamp');
    if (elHealth) elHealth.textContent = brief.healthScore;
    if (elThreat) elThreat.textContent = brief.threatLevel;
    if (elTime) elTime.textContent = `Updated: ${new Date(brief.timestamp).toLocaleTimeString()}`;

    const signalsList = document.getElementById('aiOpsSignalsList');
    if (signalsList) {
      signalsList.innerHTML = brief.aiInsights.map(item => `
        <li class="flex items-start gap-2">
          <span class="material-symbols-outlined text-xs text-[#E11D2E] mt-0.5 flex-shrink-0">check_circle</span>
          <span>${item}</span>
        </li>
      `).join('');
    }

    const recsList = document.getElementById('aiOpsRecsList');
    if (recsList) {
      recsList.innerHTML = brief.aiRecommendations.map(item => `
        <li class="flex items-start gap-2">
          <span class="material-symbols-outlined text-xs text-emerald-700 mt-0.5 flex-shrink-0">lightbulb</span>
          <span>${item}</span>
        </li>
      `).join('');
    }

    showToast('AI Executive Brief refreshed successfully!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.askAiQuery = function(text) {
  const input = document.getElementById('aiChatInput');
  if (input) input.value = text;
  submitAiOpsQuery();
};

window.submitAiOpsQuery = async function() {
  const input = document.getElementById('aiChatInput');
  const chatLog = document.getElementById('aiChatLog');
  const btn = document.getElementById('aiChatSubmitBtn');
  if (!input || !chatLog) return;

  const query = input.value.trim();
  if (!query) return;

  // Append user message
  const userDiv = document.createElement('div');
  userDiv.className = 'flex items-start justify-end gap-2.5';
  userDiv.innerHTML = `
    <div class="bg-[#111111] text-white p-3 border border-[#111111] max-w-xl text-right leading-relaxed font-sans">
      <p class="font-mono text-[10px] text-white/60 mb-0.5 uppercase font-bold">You (Admin):</p>
      <p>${escapeHtml(query)}</p>
    </div>
    <div class="w-6 h-6 rounded-full bg-[#E11D2E] text-white flex items-center justify-center flex-shrink-0 font-mono text-[10px] font-bold">ME</div>
  `;
  chatLog.appendChild(userDiv);
  input.value = '';
  chatLog.scrollTop = chatLog.scrollHeight;

  // Append loading assistant bubble
  const aiLoadingDiv = document.createElement('div');
  aiLoadingDiv.className = 'flex items-start gap-2.5';
  aiLoadingDiv.id = 'aiTempLoadingBubble';
  aiLoadingDiv.innerHTML = `
    <div class="w-6 h-6 rounded-full bg-[#111111] text-[#E11D2E] flex items-center justify-center flex-shrink-0 font-mono text-[10px] font-bold">AI</div>
    <div class="bg-gray-100 p-3 border border-[#111111]/20 max-w-xl text-[#111111] leading-relaxed flex items-center gap-2 font-mono text-[11px]">
      <span class="material-symbols-outlined text-sm animate-spin text-[#E11D2E]">refresh</span>
      <span>Querying neural operational telemetries...</span>
    </div>
  `;
  chatLog.appendChild(aiLoadingDiv);
  chatLog.scrollTop = chatLog.scrollHeight;

  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/v1/admin/ai-ops/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const temp = document.getElementById('aiTempLoadingBubble');
    if (temp) temp.remove();

    // Format markdown-like bold and bullet text
    const formattedAnswer = (data.answer || '')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/• (.*?)(<br>|$)/g, '<li class="ml-4 list-disc">$1</li>');

    const aiDiv = document.createElement('div');
    aiDiv.className = 'flex items-start gap-2.5';
    aiDiv.innerHTML = `
      <div class="w-6 h-6 rounded-full bg-[#111111] text-[#E11D2E] flex items-center justify-center flex-shrink-0 font-mono text-[10px] font-bold">AI</div>
      <div class="bg-gray-100 p-3.5 border border-[#111111]/20 max-w-xl text-[#111111] leading-relaxed">
        <p class="font-bold font-mono text-[11px] text-[#E11D2E] mb-1 uppercase tracking-wider flex items-center gap-1">
          <span class="material-symbols-outlined text-xs">auto_awesome</span>
          <span>LifeQR Operations Sentinel:</span>
        </p>
        <div class="font-sans text-xs space-y-1">${formattedAnswer}</div>
      </div>
    `;
    chatLog.appendChild(aiDiv);
    chatLog.scrollTop = chatLog.scrollHeight;

  } catch (err) {
    const temp = document.getElementById('aiTempLoadingBubble');
    if (temp) temp.remove();

    const errDiv = document.createElement('div');
    errDiv.className = 'flex items-start gap-2.5 text-xs text-[#E11D2E] font-mono p-2 border border-[#E11D2E] bg-red-50';
    errDiv.textContent = `AI Copilot Error: ${err.message}`;
    chatLog.appendChild(errDiv);
  } finally {
    if (btn) btn.disabled = false;
  }
};

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// ADMIN HELP & SUPPORT TICKETS MANAGEMENT
// ============================================================
let adminTickets = [];
let activeTicketFilter = 'ALL';

async function loadAdminHelpTickets() {
  try {
    const res = await fetch('/api/v1/help-tickets/admin', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    adminTickets = data.tickets || [];
    const counts = data.counts || { total: 0, pending: 0, inProgress: 0, resolved: 0, critical: 0 };

    // Update filter counts
    const countAll = document.getElementById('ticketCountAll');
    const countPending = document.getElementById('ticketCountPending');
    const countInProgress = document.getElementById('ticketCountInProgress');
    const countResolved = document.getElementById('ticketCountResolved');
    const countCritical = document.getElementById('ticketCountCritical');

    if (countAll) countAll.textContent = counts.total;
    if (countPending) countPending.textContent = counts.pending;
    if (countInProgress) countInProgress.textContent = counts.inProgress;
    if (countResolved) countResolved.textContent = counts.resolved;
    if (countCritical) countCritical.textContent = counts.critical;

    // Update stat cards and tab badge
    const statHelp = document.getElementById('statHelpTickets');
    if (statHelp) statHelp.textContent = counts.pending;

    const tabBadge = document.getElementById('statHelpTicketsTabBadge');
    if (tabBadge) {
      tabBadge.textContent = `${counts.pending} Pending`;
      if (counts.pending > 0) tabBadge.classList.remove('hidden');
      else tabBadge.classList.add('hidden');
    }

    renderAdminTickets();
  } catch (err) {
    console.warn('Failed to load admin help tickets:', err);
  }
}

window.filterAdminTickets = function(filter) {
  activeTicketFilter = filter;
  const filterBtns = {
    'ALL': document.getElementById('ticketFilterAll'),
    'PENDING': document.getElementById('ticketFilterPending'),
    'IN_PROGRESS': document.getElementById('ticketFilterInProgress'),
    'RESOLVED': document.getElementById('ticketFilterResolved'),
    'CRITICAL': document.getElementById('ticketFilterCritical')
  };

  Object.keys(filterBtns).forEach(k => {
    const btn = filterBtns[k];
    if (!btn) return;
    if (k === filter) {
      btn.className = 'px-3 py-1 border-2 border-[#111111] bg-[#111111] text-white font-bold uppercase tracking-wider';
    } else {
      btn.className = 'px-3 py-1 border-2 border-[#111111] bg-white text-[#111111] font-bold uppercase tracking-wider hover:bg-[#f9fafb]';
    }
  });

  renderAdminTickets();
};

function renderAdminTickets() {
  const tbody = document.getElementById('helpTicketsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  let list = adminTickets;
  if (activeTicketFilter === 'PENDING') {
    list = adminTickets.filter(t => t.status === 'PENDING');
  } else if (activeTicketFilter === 'IN_PROGRESS') {
    list = adminTickets.filter(t => t.status === 'IN_PROGRESS');
  } else if (activeTicketFilter === 'RESOLVED') {
    list = adminTickets.filter(t => t.status === 'RESOLVED');
  } else if (activeTicketFilter === 'CRITICAL') {
    list = adminTickets.filter(t => t.priority === 'CRITICAL');
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-8 text-center text-gray-500 font-mono text-xs">
          No help tickets found in this filter view.
        </td>
      </tr>
    `;
    return;
  }

  // Also populate God Mode problem dropdown
  const probSelect = document.getElementById('godModeProblemSelect');
  if (probSelect) {
    const curVal = probSelect.value;
    probSelect.innerHTML = '<option value="">-- Choose Open Ticket or Enter Custom Issue --</option>';
    adminTickets.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.ticketId;
      opt.textContent = `[${t.priority}] ${t.ticketId}: ${t.subject.slice(0, 42)} (${t.requesterRole.toUpperCase()})`;
      probSelect.appendChild(opt);
    });
    if (curVal) probSelect.value = curVal;
  }

  list.forEach(t => {
    const tr = document.createElement('tr');
    tr.className = 'border-b-2 border-[#111111]/10 hover:bg-[#f9fafb] transition font-sans text-xs';

    let priorityBadge = '<span class="px-2 py-0.5 border border-gray-400 bg-gray-100 text-gray-700 text-[10px] font-mono font-bold">NORMAL</span>';
    if (t.priority === 'HIGH') {
      priorityBadge = '<span class="px-2 py-0.5 border border-amber-600 bg-amber-50 text-amber-900 text-[10px] font-mono font-bold">HIGH</span>';
    } else if (t.priority === 'CRITICAL') {
      priorityBadge = '<span class="px-2 py-0.5 border border-[#E11D2E] bg-red-100 text-[#E11D2E] text-[10px] font-mono font-black animate-pulse">🚨 CRITICAL</span>';
    }

    let statusBadge = '<span class="px-2 py-0.5 border border-amber-600 bg-amber-50 text-amber-900 text-[10px] font-mono font-bold uppercase">PENDING</span>';
    if (t.status === 'IN_PROGRESS') {
      statusBadge = '<span class="px-2 py-0.5 border border-blue-600 bg-blue-50 text-blue-900 text-[10px] font-mono font-bold uppercase">IN PROGRESS</span>';
    } else if (t.status === 'RESOLVED') {
      statusBadge = '<span class="px-2 py-0.5 border border-emerald-600 bg-emerald-50 text-emerald-800 text-[10px] font-mono font-bold uppercase">RESOLVED</span>';
    }

    let roleBadge = 'border border-[#111111] bg-gray-100 text-[#111111]';
    if (t.requesterRole === 'doctor') roleBadge = 'border border-blue-600 bg-blue-50 text-blue-800';
    if (t.requesterRole === 'crew') roleBadge = 'border border-[#E11D2E] bg-red-50 text-[#E11D2E]';

    const dateStr = new Date(t.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

    tr.innerHTML = `
      <td class="p-3 font-mono font-bold text-[#E11D2E]">${t.ticketId}</td>
      <td class="p-3">
        <div class="font-bold text-[#111111]">${escapeHtml(t.requesterName)}</div>
        <div class="text-[10px] font-mono text-gray-500">${escapeHtml(t.requesterEmail)}</div>
        <span class="inline-block mt-0.5 px-1.5 py-0.2 rounded-none ${roleBadge} text-[9px] font-mono font-bold uppercase">${t.requesterRole}</span>
      </td>
      <td class="p-3">
        <span class="block font-mono text-[9px] font-bold text-gray-500 uppercase">${t.category.replace(/_/g, ' ')}</span>
        <strong class="text-xs text-[#111111]">${escapeHtml(t.subject)}</strong>
        <p class="text-[11px] text-gray-600 font-sans truncate max-w-xs mt-0.5">${escapeHtml(t.message)}</p>
      </td>
      <td class="p-3 font-mono text-xs">
        ${t.patientQrCodeId ? `<span class="font-bold text-[#E11D2E]">${t.patientQrCodeId}</span>` : '<span class="text-gray-400">-</span>'}
      </td>
      <td class="p-3">${priorityBadge}</td>
      <td class="p-3">${statusBadge}</td>
      <td class="p-3 font-mono text-[10px] text-gray-500">${dateStr}</td>
      <td class="p-3 text-right">
        <div class="flex items-center justify-end gap-1.5 font-mono">
          <button onclick="openAdminTicketWithAi('${t.ticketId}')" class="btn-primary text-[10px] px-2.5 py-1 uppercase font-bold tracking-wider flex items-center gap-1 bg-[#111111] hover:bg-[#E11D2E] text-white shadow-[1px_1px_0px_#111111]" title="Analyze Problem with AI &amp; Solve">
            <span class="material-symbols-outlined text-xs text-yellow-300">auto_awesome</span>
            <span>AI Solve</span>
          </button>
          <button onclick="openAdminTicketModal('${t.ticketId}')" class="btn-primary text-[10px] px-2 py-1 uppercase font-bold tracking-wider flex items-center gap-1 shadow-[1px_1px_0px_#111111]">
            <span class="material-symbols-outlined text-xs">edit_note</span>
            <span>Review</span>
          </button>
          ${t.status !== 'RESOLVED' ? `
            <button onclick="quickResolveAdminTicket('${t.ticketId}')" class="btn-secondary text-[10px] px-2 py-1 uppercase font-bold tracking-wider text-emerald-800 hover:text-white" title="Quick Resolve">
              ✓
            </button>
          ` : ''}
          <button onclick="adminDeleteTicket('${t.ticketId || t._id}')" class="btn-secondary text-[10px] px-2 py-1 uppercase font-bold tracking-wider text-[#E11D2E] hover:bg-red-600 hover:text-white" title="Purge ticket">
            <span class="material-symbols-outlined text-xs">delete</span>
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

let currentAiTicketAnalysis = null;

window.openAdminTicketWithAi = async function(ticketId) {
  openAdminTicketModal(ticketId);
  await runTicketAiAnalysis();
};

window.openAdminTicketModal = function(ticketId) {
  const ticket = adminTickets.find(t => t.ticketId === ticketId);
  if (!ticket) return;

  currentInspectedTicket = ticket;
  const modal = document.getElementById('adminTicketModal');
  if (!modal) return;

  document.getElementById('adminModalTicketId').textContent = ticket.ticketId;
  document.getElementById('adminModalHiddenTicketId').value = ticket.ticketId;
  document.getElementById('adminModalRequester').textContent = `${ticket.requesterName} (${ticket.requesterEmail}) - Role: ${ticket.requesterRole.toUpperCase()}`;
  document.getElementById('adminModalSubject').textContent = ticket.subject;
  document.getElementById('adminModalMessage').textContent = ticket.message;

  const patContext = document.getElementById('adminModalPatientContext');
  if (patContext) {
    if (ticket.patientQrCodeId) {
      patContext.innerHTML = `Associated Patient QR Code: <strong class="text-[#E11D2E]">${ticket.patientQrCodeId}</strong>`;
    } else {
      patContext.innerHTML = 'Associated Patient: <span class="text-gray-400">None specified</span>';
    }
  }

  const prioBadge = document.getElementById('adminModalPriorityBadge');
  if (prioBadge) {
    prioBadge.textContent = ticket.priority;
    if (ticket.priority === 'CRITICAL') {
      prioBadge.className = 'px-2 py-0.5 border border-[#E11D2E] bg-red-100 text-[#E11D2E] font-mono text-[10px] font-bold uppercase animate-pulse';
    } else if (ticket.priority === 'HIGH') {
      prioBadge.className = 'px-2 py-0.5 border border-amber-500 bg-amber-100 text-amber-900 font-mono text-[10px] font-bold uppercase';
    } else {
      prioBadge.className = 'px-2 py-0.5 border border-gray-400 bg-gray-100 text-gray-700 font-mono text-[10px] font-bold uppercase';
    }
  }

  const statusSel = document.getElementById('adminModalStatusSelect');
  if (statusSel) statusSel.value = ticket.status;

  const notesInput = document.getElementById('adminModalNotesInput');
  if (notesInput) notesInput.value = ticket.adminNotes || '';

  const timeInput = document.getElementById('adminModalTimestamp');
  if (timeInput) {
    timeInput.value = new Date(ticket.createdAt).toLocaleString();
  }

  // Reset AI panel state
  currentAiTicketAnalysis = null;
  const aiResults = document.getElementById('adminModalAiResults');
  const aiPlaceholder = document.getElementById('adminModalAiPlaceholder');
  const aiBadge = document.getElementById('adminAiLiveBadge');
  const aiBtn = document.getElementById('adminModalAiAnalyzeBtn');
  if (aiResults) aiResults.classList.add('hidden');
  if (aiPlaceholder) aiPlaceholder.classList.remove('hidden');
  if (aiBadge) {
    aiBadge.className = 'px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-mono font-bold uppercase border border-emerald-400';
    aiBadge.textContent = 'READY';
  }
  if (aiBtn) {
    aiBtn.innerHTML = '<span class="material-symbols-outlined text-sm text-yellow-300">auto_awesome</span><span>Analyze Problem with AI</span>';
  }

  modal.classList.remove('hidden');
};

window.closeAdminTicketModal = function() {
  const modal = document.getElementById('adminTicketModal');
  if (modal) modal.classList.add('hidden');
};

window.runTicketAiAnalysis = async function() {
  if (!currentInspectedTicket) return;

  const btn = document.getElementById('adminModalAiAnalyzeBtn');
  const liveBadge = document.getElementById('adminAiLiveBadge');
  const placeholder = document.getElementById('adminModalAiPlaceholder');
  const results = document.getElementById('adminModalAiResults');

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span><span>Analyzing Problem...</span>';
  }
  if (liveBadge) {
    liveBadge.className = 'px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-mono font-bold uppercase border border-amber-400 animate-pulse';
    liveBadge.textContent = 'ANALYZING';
  }

  try {
    const res = await fetch('/api/v1/admin/ai-problem-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ticketId: currentInspectedTicket.ticketId,
        subject: currentInspectedTicket.subject,
        message: currentInspectedTicket.message,
        requesterName: currentInspectedTicket.requesterName,
        requesterEmail: currentInspectedTicket.requesterEmail,
        requesterRole: currentInspectedTicket.requesterRole,
        patientQrCodeId: currentInspectedTicket.patientQrCodeId,
        priority: currentInspectedTicket.priority,
        category: currentInspectedTicket.category
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to analyze problem');

    const analysis = data.analysis;
    currentAiTicketAnalysis = analysis;

    // Populate Results
    const simpleWordsEl = document.getElementById('adminAiSimpleWords');
    if (simpleWordsEl) simpleWordsEl.textContent = analysis.problemInSimpleWords;

    const whatToSolveEl = document.getElementById('adminAiWhatToSolve');
    if (whatToSolveEl) whatToSolveEl.textContent = analysis.whatToSolve;

    const rootCauseEl = document.getElementById('adminAiRootCause');
    if (rootCauseEl) rootCauseEl.textContent = analysis.rootCause;

    const urgencyBadge = document.getElementById('adminAiUrgencyBadge');
    if (urgencyBadge) {
      urgencyBadge.textContent = analysis.urgencyLevel || 'CRITICAL';
      if (analysis.urgencyLevel === 'CRITICAL') {
        urgencyBadge.className = 'px-2 py-0.5 bg-red-100 text-[#E11D2E] text-[9px] font-mono font-black uppercase border border-red-300 animate-pulse';
      } else {
        urgencyBadge.className = 'px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-mono font-bold uppercase border border-amber-300';
      }
    }

    const stepList = document.getElementById('adminAiStepList');
    if (stepList) {
      stepList.innerHTML = '';
      (analysis.stepByStepSolution || []).forEach(s => {
        const stepDiv = document.createElement('div');
        stepDiv.className = 'p-2.5 border border-[#111111]/30 bg-[#f9fafb] flex items-start gap-2.5';
        stepDiv.innerHTML = `
          <span class="w-5 h-5 bg-[#111111] text-white flex items-center justify-center font-mono font-bold text-[10px] shrink-0 shadow-[1px_1px_0px_#111111]">${s.step}</span>
          <div class="space-y-0.5">
            <strong class="text-xs text-[#111111] block font-bold">${escapeHtml(s.title)}</strong>
            <p class="text-[11px] text-gray-700 leading-normal">${escapeHtml(s.instruction)}</p>
          </div>
        `;
        stepList.appendChild(stepDiv);
      });
    }

    const suggestedNoteEl = document.getElementById('adminAiSuggestedNote');
    if (suggestedNoteEl) suggestedNoteEl.textContent = analysis.suggestedResolutionNote;

    if (placeholder) placeholder.classList.add('hidden');
    if (results) results.classList.remove('hidden');

    if (liveBadge) {
      liveBadge.className = 'px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-mono font-bold uppercase border border-emerald-400';
      liveBadge.textContent = 'ANALYSIS COMPLETE';
    }

    showToast('⚡ AI Problem Diagnosis generated successfully!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
    if (liveBadge) {
      liveBadge.className = 'px-1.5 py-0.2 bg-red-100 text-[#E11D2E] text-[9px] font-mono font-bold uppercase border border-red-300';
      liveBadge.textContent = 'ERROR';
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined text-sm text-yellow-300">auto_awesome</span><span>Re-Analyze Problem</span>';
    }
  }
};

window.applyAiResolutionNote = function() {
  if (!currentAiTicketAnalysis || !currentAiTicketAnalysis.suggestedResolutionNote) {
    showToast('Run AI Analysis first to generate a suggested note.', 'warning');
    return;
  }
  const notesInput = document.getElementById('adminModalNotesInput');
  const statusSel = document.getElementById('adminModalStatusSelect');

  if (notesInput) {
    notesInput.value = currentAiTicketAnalysis.suggestedResolutionNote;
    notesInput.focus();
    notesInput.classList.add('bg-emerald-50');
    setTimeout(() => notesInput.classList.remove('bg-emerald-50'), 1500);
  }
  if (statusSel) {
    statusSel.value = currentAiTicketAnalysis.recommendedStatus || 'RESOLVED';
  }
  showToast('✨ AI Resolution note inserted into response box! Ready to save.', 'success');
};

// God-Mode Studio Handlers
window.handleGodModeProblemSelectChange = function(ticketId) {
  if (!ticketId) return;
  const ticket = (adminTickets || []).find(t => t.ticketId === ticketId);
  if (!ticket) return;

  const subjEl = document.getElementById('godModeProblemSubject');
  const msgEl = document.getElementById('godModeProblemMessage');
  const roleEl = document.getElementById('godModeProblemRole');
  const qrEl = document.getElementById('godModeProblemQr');

  if (subjEl) subjEl.value = ticket.subject;
  if (msgEl) msgEl.value = ticket.message;
  if (roleEl) roleEl.value = ticket.requesterRole || 'doctor';
  if (qrEl) qrEl.value = ticket.patientQrCodeId || '';
};

window.runGodModeAiAnalysis = async function() {
  const subject = document.getElementById('godModeProblemSubject').value.trim();
  const message = document.getElementById('godModeProblemMessage').value.trim();
  const role = document.getElementById('godModeProblemRole').value;
  const qr = document.getElementById('godModeProblemQr').value.trim();
  const ticketId = document.getElementById('godModeProblemSelect').value;

  if (!subject && !message) {
    showToast('Please enter a problem subject or detailed description.', 'warning');
    return;
  }

  const btn = document.getElementById('btnGodModeAnalyze');
  const placeholder = document.getElementById('godModeAiPlaceholder');
  const results = document.getElementById('godModeAiResults');

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span><span>Analyzing...</span>';
  }

  try {
    const res = await fetch('/api/v1/admin/ai-problem-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ticketId,
        subject,
        message,
        requesterRole: role,
        patientQrCodeId: qr
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to process AI diagnostics');

    const a = data.analysis;

    document.getElementById('godModeAiSimpleWords').textContent = a.problemInSimpleWords;
    document.getElementById('godModeAiWhatToSolve').textContent = a.whatToSolve;
    document.getElementById('godModeAiRootCause').textContent = a.rootCause;

    const stepsContainer = document.getElementById('godModeAiSteps');
    if (stepsContainer) {
      stepsContainer.innerHTML = '';
      (a.stepByStepSolution || []).forEach(s => {
        const item = document.createElement('div');
        item.className = 'p-2 border border-[#111111]/20 bg-white flex items-start gap-2';
        item.innerHTML = `
          <span class="w-5 h-5 bg-[#111111] text-white flex items-center justify-center font-mono font-bold text-[10px] shrink-0">${s.step}</span>
          <div>
            <strong class="text-xs text-[#111111] block font-bold">${escapeHtml(s.title)}</strong>
            <p class="text-[11px] text-gray-700 leading-normal">${escapeHtml(s.instruction)}</p>
          </div>
        `;
        stepsContainer.appendChild(item);
      });
    }

    document.getElementById('godModeAiNote').textContent = a.suggestedResolutionNote;

    if (placeholder) placeholder.classList.add('hidden');
    if (results) results.classList.remove('hidden');

    showToast('⚡ Problem diagnosed successfully with step-by-step instructions!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined text-sm text-yellow-300">auto_awesome</span><span>Analyze &amp; Solve with AI</span>';
    }
  }
};

window.handleAdminTicketSubmit = async function(e) {
  e.preventDefault();
  const ticketId = document.getElementById('adminModalHiddenTicketId').value;
  const status = document.getElementById('adminModalStatusSelect').value;
  const adminNotes = document.getElementById('adminModalNotesInput').value.trim();

  const submitBtn = document.getElementById('adminTicketSubmitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span><span>Updating...</span>';
  }

  try {
    const res = await fetch(`/api/v1/admin/help-tickets/${ticketId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status, adminNotes })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update ticket');

    showToast(`✅ Ticket ${ticketId} updated to ${status}!`, 'success');
    closeAdminTicketModal();
    await loadAdminHelpTickets();
    await loadAdminStats();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm">check_circle</span><span>Save &amp; Notify Requester</span>';
    }
  }
};

window.quickResolveAdminTicket = async function(ticketId) {
  try {
    const res = await fetch(`/api/v1/admin/help-tickets/${ticketId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        status: 'RESOLVED',
        adminNotes: 'Resolved and cleared by System Administrator.'
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to resolve ticket');

    showToast(`✅ Ticket ${ticketId} marked as RESOLVED!`, 'success');
    await loadAdminHelpTickets();
    await loadAdminStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.adminFixProfileFromCurrentTicket = function() {
  if (!currentInspectedTicket) return;
  const reqId = currentInspectedTicket.requesterId?._id || currentInspectedTicket.requesterId;
  closeAdminTicketModal();
  openAdminUserProfile(reqId, currentInspectedTicket.ticketId);
};

// ============================================================
// UNIVERSAL ALL USER TYPES PROFILE HANDLING & TROUBLESHOOTING
// ============================================================

window.openAdminUserProfile = async function(userId, sourceTicketId = null) {
  try {
    const modal = document.getElementById('adminUserProfileModal');
    if (!modal) return;

    showToast('Retrieving comprehensive user profile...', 'info');
    const res = await fetch(`/api/v1/admin/users/${userId}/profile`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch user profile');

    currentInspectedUserForProfile = data;
    const user = data.user;
    const profile = data.profile || {};
    const tickets = data.tickets || [];

    // Header info
    document.getElementById('adminUserModalName').textContent = user.name;
    document.getElementById('adminUserModalId').textContent = user.id;
    document.getElementById('adminUserModalEmail').textContent = user.email;

    const roleBadge = document.getElementById('adminUserModalRoleBadge');
    if (roleBadge) {
      roleBadge.textContent = user.role.toUpperCase();
      if (user.role === 'doctor') roleBadge.className = 'px-2 py-0.5 border border-blue-600 bg-blue-50 text-blue-800 text-[10px] font-mono font-bold uppercase';
      else if (user.role === 'crew') roleBadge.className = 'px-2 py-0.5 border border-[#E11D2E] bg-red-50 text-[#E11D2E] text-[10px] font-mono font-bold uppercase';
      else if (user.role === 'admin') roleBadge.className = 'px-2 py-0.5 border border-[#111111] bg-[#111111] text-white text-[10px] font-mono font-bold uppercase';
      else roleBadge.className = 'px-2 py-0.5 border border-[#111111] bg-gray-50 text-[#111111] text-[10px] font-mono font-bold uppercase';
    }

    const activeBadge = document.getElementById('adminUserModalActiveBadge');
    if (activeBadge) {
      activeBadge.textContent = user.active ? 'ACTIVE' : 'DEACTIVATED';
      activeBadge.className = user.active
        ? 'px-2 py-0.5 border border-emerald-600 bg-emerald-50 text-emerald-800 text-[10px] font-mono font-bold uppercase'
        : 'px-2 py-0.5 border border-[#E11D2E] bg-red-100 text-[#E11D2E] text-[10px] font-mono font-bold uppercase';
    }

    // Hidden inputs
    document.getElementById('adminUserHiddenId').value = user.id;
    document.getElementById('adminUserHiddenRole').value = user.role;
    document.getElementById('adminUserHiddenSourceTicketId').value = sourceTicketId || '';

    // Core fields
    document.getElementById('adminProfName').value = user.name || '';
    document.getElementById('adminProfEmail').value = user.email || '';
    document.getElementById('adminProfPhone').value = user.phone || '';
    document.getElementById('adminProfGender').value = user.gender || 'other';
    if (document.getElementById('adminProfRole')) {
      document.getElementById('adminProfRole').value = user.role;
    }
    document.getElementById('adminProfActive').value = user.active ? 'true' : 'false';
    document.getElementById('adminProfVerificationStatus').value = user.verificationStatus || 'PENDING';
    document.getElementById('adminProfAddress').value = user.address || '';
    document.getElementById('adminProfCity').value = user.city || '';
    document.getElementById('adminProfState').value = user.state || '';
    document.getElementById('adminProfVerificationNote').value = user.verificationNote || '';
    document.getElementById('adminProfNewPassword').value = '';

    // Safety lockout on Delete button for self
    const profDelBtn = document.getElementById('adminProfDeleteBtn');
    if (profDelBtn) {
      if (currentUser && (currentUser._id === user.id || currentUser.id === user.id)) {
        profDelBtn.disabled = true;
        profDelBtn.classList.add('opacity-50', 'cursor-not-allowed');
        profDelBtn.title = 'Cannot purge own active admin account';
      } else {
        profDelBtn.disabled = false;
        profDelBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        profDelBtn.title = 'Purge user account (God Mode)';
      }
    }

    // Quick Actions Bar
    const qBar = document.getElementById('adminUserQuickActions');
    if (qBar) {
      let qHtml = `<div>Member Since: <strong>${new Date(user.createdAt).toLocaleDateString()}</strong></div>`;
      if (user.role === 'patient') {
        const qrId = profile?.qrCodeId || user.roleDetails?.qrCodeId || '';
        const evUrl = qrId ? `/emergency_access.html?id=${encodeURIComponent(qrId)}` : '/emergency_access.html';
        qHtml += `
          <div class="flex items-center gap-2 flex-wrap">
            <button type="button" onclick="adminRegenerateUserQR('${user.id}')" class="btn-secondary px-3 py-1 font-bold text-xs uppercase text-[#E11D2E] flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">cached</span> Regenerate Patient QR
            </button>
            <a href="${evUrl}" target="_blank" class="btn-secondary px-3 py-1 font-bold text-xs uppercase flex items-center gap-1" title="Open patient emergency profile in new tab">
              <span class="material-symbols-outlined text-sm">open_in_new</span> Test Emergency View
            </a>
            <button type="button" onclick="openEmergencyLivePreview('${user.id}')" class="btn-secondary px-3 py-1 font-bold text-xs uppercase text-blue-700 flex items-center gap-1" title="Open interactive mobile phone HUD preview">
              <span class="material-symbols-outlined text-sm">visibility</span> Live Preview
            </button>
            <button type="button" onclick="scrollToEmergencyCustomization()" class="btn-secondary px-3 py-1 font-bold text-xs uppercase text-purple-700 flex items-center gap-1 border-purple-600 bg-purple-50/60 hover:bg-purple-600 hover:text-white transition" title="Jump to Emergency View Customization controls">
              <span class="material-symbols-outlined text-sm">tune</span> Customize Emergency View
            </button>
          </div>
        `;
      } else if (user.role === 'doctor' || user.role === 'crew') {
        qHtml += `
          <div class="flex items-center gap-2 flex-wrap">
            <button type="button" onclick="document.getElementById('adminProfVerificationStatus').value = 'VERIFIED'; showToast('Verification status set to VERIFIED', 'info');" class="btn-secondary px-3 py-1 font-bold text-xs uppercase text-emerald-800 flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">verified</span> Quick Set Verified
            </button>
            <button type="button" onclick="document.getElementById('adminProfVerificationStatus').value = 'SUSPENDED'; showToast('Verification status set to SUSPENDED', 'warning');" class="btn-secondary px-3 py-1 font-bold text-xs uppercase text-[#E11D2E] flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">block</span> Quick Suspend
            </button>
          </div>
        `;
      }
      qBar.innerHTML = qHtml;
    }

    // Render Role Specific Form Section
    renderRoleSpecificForm(user.role, profile, user);

    // Render User Tickets
    const tBadge = document.getElementById('adminUserTicketCountBadge');
    if (tBadge) tBadge.textContent = `${tickets.length} Tickets Filed`;

    const tList = document.getElementById('adminUserTicketList');
    if (tList) {
      if (tickets.length === 0) {
        tList.innerHTML = `<div class="p-3 border border-dashed border-[#111111]/20 text-gray-500 text-center">No help tickets on file from this user.</div>`;
      } else {
        tList.innerHTML = tickets.map(t => {
          let sBadge = '<span class="px-1.5 py-0.5 border border-amber-600 bg-amber-50 text-amber-900 text-[9px] font-bold uppercase">PENDING</span>';
          if (t.status === 'RESOLVED') sBadge = '<span class="px-1.5 py-0.5 border border-emerald-600 bg-emerald-50 text-emerald-800 text-[9px] font-bold uppercase">RESOLVED</span>';
          else if (t.status === 'IN_PROGRESS') sBadge = '<span class="px-1.5 py-0.5 border border-blue-600 bg-blue-50 text-blue-900 text-[9px] font-bold uppercase">IN PROGRESS</span>';

          const isSelected = sourceTicketId === t.ticketId;
          return `
            <div class="p-2.5 border-2 ${isSelected ? 'border-[#E11D2E] bg-red-50/40' : 'border-[#111111] bg-white'} flex items-start justify-between gap-2">
              <div>
                <div class="flex items-center gap-1.5 flex-wrap">
                  <strong class="text-xs uppercase text-[#111111]">${escapeHtml(t.subject)}</strong>
                  <span class="text-[9px] font-mono text-gray-500">#${t.ticketId}</span>
                  ${sBadge}
                </div>
                <p class="font-sans text-xs text-gray-700 mt-1 whitespace-pre-wrap">${escapeHtml(t.message)}</p>
                ${t.adminNotes ? `<div class="mt-1 p-1.5 border border-emerald-600 bg-emerald-50 text-emerald-900 text-[10px] font-mono"><strong>Admin Note:</strong> ${escapeHtml(t.adminNotes)}</div>` : ''}
              </div>
              <button type="button" onclick="selectTicketForAutoResolution('${t.ticketId}')" class="btn-secondary px-2 py-1 text-[10px] uppercase font-bold text-blue-700 hover:text-white flex-shrink-0">
                ${isSelected ? 'Linked' : 'Link to Fix'}
              </button>
            </div>
          `;
        }).join('');
      }
    }

    // Resolution note setup
    const resNoteInput = document.getElementById('adminProfTicketResolutionNote');
    if (resNoteInput) {
      if (sourceTicketId) {
        resNoteInput.value = `Issue resolved: Updated ${user.role} profile parameters in response to ticket #${sourceTicketId}.`;
      } else {
        resNoteInput.value = '';
      }
    }

    // Render Section 4: Security Access Audit Log & Emergency Scans (Admin Clearance)
    const auditListEl = document.getElementById('adminUserAuditList');
    const auditCountBadge = document.getElementById('adminUserAuditCountBadge');
    if (auditListEl) {
      const activities = (profile && Array.isArray(profile.activities)) ? profile.activities : [];
      const auditLogs = Array.isArray(data.auditLogs) ? data.auditLogs : [];
      const totalEvents = activities.length + auditLogs.length;

      if (auditCountBadge) {
        auditCountBadge.textContent = `${totalEvents} ${totalEvents === 1 ? 'Event' : 'Events'}`;
      }

      if (totalEvents === 0) {
        auditListEl.innerHTML = `
          <div class="p-4 border-2 border-dashed border-[#111111]/20 text-center bg-[#f9fafb]">
            <p class="text-xs font-mono text-gray-500 uppercase font-bold">No security scan events or access logs recorded yet.</p>
          </div>
        `;
      } else {
        let eventsHtml = '';
        // Render emergency QR scans and patient activity records
        activities.forEach(act => {
          eventsHtml += `
            <div class="p-3 border-2 border-[#111111] bg-white flex items-start gap-3 shadow-[2px_2px_0px_#111111]">
              <div class="w-8 h-8 border-2 border-[#111111] bg-red-50 text-[#E11D2E] flex items-center justify-center flex-shrink-0">
                <span class="material-symbols-outlined text-sm">history</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <span class="font-black text-xs text-[#111111] uppercase tracking-tight">${escapeHtml(act.title || 'Security Event')}</span>
                  <span class="px-2 py-0.5 border border-[#E11D2E] bg-red-50 text-[#E11D2E] text-[9px] font-mono font-bold uppercase tracking-wider">${escapeHtml(act.type || 'Emergency Scan')}</span>
                </div>
                <p class="text-xs text-[#111111]/80 mt-1 font-sans font-medium">${escapeHtml(act.description || 'Medical profile was accessed by emergency responder.')}</p>
                <span class="text-[10px] font-mono text-gray-500 block mt-1.5 uppercase font-bold">${new Date(act.timestamp).toLocaleString()}</span>
              </div>
            </div>
          `;
        });

        // Render system audit log events
        auditLogs.forEach(al => {
          eventsHtml += `
            <div class="p-3 border-2 border-[#111111]/40 bg-gray-50/70 flex items-start gap-3">
              <div class="w-8 h-8 border-2 border-[#111111] bg-white text-gray-700 flex items-center justify-center flex-shrink-0">
                <span class="material-symbols-outlined text-sm">security</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <span class="font-bold text-xs text-[#111111] uppercase font-mono">${escapeHtml(al.action || 'Audit Event')}</span>
                  <span class="text-[9px] font-mono text-gray-500 font-bold">${al.ipAddress || 'SYSTEM'}</span>
                </div>
                <p class="text-xs text-gray-700 mt-1 font-sans">${escapeHtml(al.details ? (typeof al.details === 'string' ? al.details : JSON.stringify(al.details)) : 'Action recorded in security audit registry')}</p>
                <span class="text-[10px] font-mono text-gray-500 block mt-1.5 uppercase font-bold">${new Date(al.timestamp || al.createdAt).toLocaleString()}</span>
              </div>
            </div>
          `;
        });

        auditListEl.innerHTML = eventsHtml;
      }
    }

    modal.classList.remove('hidden');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.closeAdminUserProfile = function() {
  const modal = document.getElementById('adminUserProfileModal');
  if (modal) modal.classList.add('hidden');
};

window.selectTicketForAutoResolution = function(ticketId) {
  document.getElementById('adminUserHiddenSourceTicketId').value = ticketId;
  const resNote = document.getElementById('adminProfTicketResolutionNote');
  if (resNote && !resNote.value.trim()) {
    resNote.value = `Issue resolved: Updated profile parameters in response to ticket #${ticketId}.`;
  }
  showToast(`Ticket #${ticketId} linked for auto-resolution on save`, 'info');
};

function renderRoleSpecificForm(role, profile, user) {
  const container = document.getElementById('adminRoleSpecificSection');
  if (!container) return;

  if (role === 'patient') {
    const bgList = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between border-b border-[#111111]/20 pb-2">
          <h4 class="font-black text-xs uppercase font-mono text-[#111111] flex items-center gap-1.5">
            <span class="material-symbols-outlined text-sm text-[#E11D2E]">medical_services</span>
            <span>2. Patient Clinical Parameters &amp; Emergency Medical ID</span>
          </h4>
          <span class="text-[10px] font-mono font-bold text-[#E11D2E]">QR: ${profile?.qrCodeId || 'Unassigned'}</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block font-mono text-[10px] font-bold uppercase mb-1">Blood Group</label>
            <select id="adminPatBloodGroup" class="w-full p-2.5 text-xs font-bold border-2 border-[#111111]">
              <option value="" ${!profile?.bloodGroup ? 'selected' : ''}>Not Specified</option>
              ${bgList.map(bg => `<option value="${bg}" ${profile?.bloodGroup === bg ? 'selected' : ''}>${bg}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block font-mono text-[10px] font-bold uppercase mb-1">Age</label>
            <input type="number" id="adminPatAge" value="${profile?.age || ''}" placeholder="E.g. 32" class="w-full p-2.5 text-xs font-mono border-2 border-[#111111]">
          </div>
          <div>
            <label class="block font-mono text-[10px] font-bold uppercase mb-1">Public Emergency Visibility</label>
            <select id="adminPatPublicProfile" class="w-full p-2.5 text-xs font-bold border-2 border-[#111111]">
              <option value="true" ${profile?.publicProfile !== false ? 'selected' : ''}>Public Emergency Access (Enabled)</option>
              <option value="false" ${profile?.publicProfile === false ? 'selected' : ''}>Restricted Access Only</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block font-mono text-[10px] font-bold uppercase mb-1">Severe Allergies (Critical)</label>
            <textarea id="adminPatAllergies" rows="3" class="w-full p-2.5 text-xs font-sans border-2 border-[#111111]" placeholder="E.g. Penicillin, Peanuts (Severe Anaphylaxis)">${profile?.allergies || ''}</textarea>
          </div>
          <div>
            <label class="block font-mono text-[10px] font-bold uppercase mb-1">Active Chronic Conditions</label>
            <textarea id="adminPatHealthIssues" rows="3" class="w-full p-2.5 text-xs font-sans border-2 border-[#111111]" placeholder="E.g. Type 1 Diabetes, Asthma">${profile?.healthIssues || ''}</textarea>
          </div>
          <div>
            <label class="block font-mono text-[10px] font-bold uppercase mb-1">Current Medications</label>
            <textarea id="adminPatMedications" rows="3" class="w-full p-2.5 text-xs font-sans border-2 border-[#111111]" placeholder="E.g. Insulin Glargine 20u qHS, Albuterol">${profile?.medications || ''}</textarea>
          </div>
        </div>

        <!-- Emergency Contacts Section -->
        <div class="border border-[#111111]/30 p-3 bg-gray-50/50 space-y-2">
          <div class="flex items-center justify-between">
            <label class="block font-mono text-[10px] font-bold uppercase text-[#111111]">Emergency Contacts (First Responders Dial Directly)</label>
            <button type="button" onclick="addPatientContactRow()" class="btn-secondary px-2.5 py-1 text-[10px] font-mono font-bold uppercase flex items-center gap-1">
              <span class="material-symbols-outlined text-xs">add</span> Add Contact
            </button>
          </div>
          <div id="adminPatContactsContainer" class="space-y-2">
            <!-- Dynamically populated contacts -->
          </div>
        </div>

        ${profile?.qrCode ? `
          <div class="flex items-center justify-between p-3 border-2 border-[#111111] bg-white gap-4 flex-wrap">
            <div class="flex items-center gap-3">
              <img id="adminPatQrImg" src="${profile.qrCode}" class="w-16 h-16 border border-[#111111] object-contain">
              <div>
                <span id="adminPatQrIdTxt" class="font-bold text-xs font-mono uppercase block">Active Medical QR: ${profile.qrCodeId}</span>
                <span class="text-[10px] font-mono text-gray-500">Scanning opens encrypted emergency medical profile</span>
              </div>
            </div>
            <button type="button" onclick="adminRegenerateUserQR('${user.id || user._id}')" class="btn-secondary text-xs px-3 py-1.5 uppercase font-mono font-bold flex items-center gap-1.5 text-[#E11D2E]">
              <span class="material-symbols-outlined text-sm">cached</span>
              <span>Regenerate Fresh QR</span>
            </button>
          </div>
        ` : ''}

        <!-- Emergency View Customization & Public Display Options -->
        <div id="adminEmergencyViewCustomizationSection" class="border-2 border-purple-900 bg-purple-50/20 p-4 space-y-4">
          <div class="flex items-center justify-between border-b border-purple-900/20 pb-2 flex-wrap gap-2">
            <h4 class="font-black text-xs uppercase font-mono text-purple-950 flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm text-purple-700">tune</span>
              <span>3. Emergency View Customization &amp; First Responder Display</span>
            </h4>
            <div class="flex items-center gap-2">
              <button type="button" onclick="openEmergencyLivePreview('${user.id || user._id}')" class="btn-secondary px-2.5 py-1 text-[10px] font-mono font-bold uppercase flex items-center gap-1 text-purple-900 bg-white hover:bg-purple-100">
                <span class="material-symbols-outlined text-xs">visibility</span> Preview Badge
              </button>
              <a href="${profile?.qrCodeId ? `/emergency_access.html?id=${encodeURIComponent(profile.qrCodeId)}` : '/emergency_access.html'}" target="_blank" class="btn-secondary px-2.5 py-1 text-[10px] font-mono font-bold uppercase flex items-center gap-1 text-[#E11D2E] bg-white hover:bg-red-50">
                <span class="material-symbols-outlined text-xs">open_in_new</span> Test Webpage
              </a>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block font-mono text-[10px] font-bold uppercase mb-1">Emergency Badge Theme</label>
              <select id="adminPatEvThemeColor" class="w-full p-2.5 text-xs font-bold border-2 border-[#111111] bg-white">
                <option value="#E11D2E" ${profile?.emergencyViewSettings?.themeColor === '#E11D2E' || !profile?.emergencyViewSettings?.themeColor ? 'selected' : ''}>Crimson Red (Standard LifeQR)</option>
                <option value="#111111" ${profile?.emergencyViewSettings?.themeColor === '#111111' ? 'selected' : ''}>Tactical Black (High Contrast)</option>
                <option value="#D97706" ${profile?.emergencyViewSettings?.themeColor === '#D97706' ? 'selected' : ''}>Caution Amber (High Visibility)</option>
                <option value="#059669" ${profile?.emergencyViewSettings?.themeColor === '#059669' ? 'selected' : ''}>Medical Emerald (Clinical)</option>
                <option value="#2563EB" ${profile?.emergencyViewSettings?.themeColor === '#2563EB' ? 'selected' : ''}>Trauma Blue (ER Matrix)</option>
              </select>
            </div>
            <div>
              <label class="block font-mono text-[10px] font-bold uppercase mb-1">Severe Allergy Callout</label>
              <select id="adminPatEvAllergyBanner" class="w-full p-2.5 text-xs font-bold border-2 border-[#111111] bg-white">
                <option value="true" ${profile?.emergencyViewSettings?.showAllergiesBanner !== false ? 'selected' : ''}>Flashing High-Risk Banner (Recommended)</option>
                <option value="false" ${profile?.emergencyViewSettings?.showAllergiesBanner === false ? 'selected' : ''}>Standard Inline Text</option>
              </select>
            </div>
            <div>
              <label class="block font-mono text-[10px] font-bold uppercase mb-1">Large Blood Group Display</label>
              <select id="adminPatEvBloodGroupLarge" class="w-full p-2.5 text-xs font-bold border-2 border-[#111111] bg-white">
                <option value="true" ${profile?.emergencyViewSettings?.showBloodGroupLarge !== false ? 'selected' : ''}>Prominent Rh Box (Standard)</option>
                <option value="false" ${profile?.emergencyViewSettings?.showBloodGroupLarge === false ? 'selected' : ''}>Compact Blood Group</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block font-mono text-[10px] font-bold uppercase mb-1">Resuscitation / DNR Directive</label>
              <select id="adminPatEvDnrDirective" class="w-full p-2.5 text-xs font-bold border-2 border-[#111111] bg-white">
                <option value="FULL_CODE" ${!profile?.emergencyViewSettings?.dnrDirective || profile?.emergencyViewSettings?.dnrDirective === 'FULL_CODE' ? 'selected' : ''}>Full Resuscitation (Full Code)</option>
                <option value="DNR" ${profile?.emergencyViewSettings?.dnrDirective === 'DNR' ? 'selected' : ''}>Do Not Resuscitate (DNR / DNAR)</option>
                <option value="ADVANCE_DIRECTIVE" ${profile?.emergencyViewSettings?.dnrDirective === 'ADVANCE_DIRECTIVE' ? 'selected' : ''}>Advance Directive on File</option>
                <option value="COMFORT_CARE" ${profile?.emergencyViewSettings?.dnrDirective === 'COMFORT_CARE' ? 'selected' : ''}>Comfort Measures Only</option>
              </select>
            </div>
            <div>
              <label class="block font-mono text-[10px] font-bold uppercase mb-1">Organ Donor Badge</label>
              <select id="adminPatEvOrganDonor" class="w-full p-2.5 text-xs font-bold border-2 border-[#111111] bg-white">
                <option value="false" ${!profile?.emergencyViewSettings?.organDonor && !profile?.organDonor ? 'selected' : ''}>No / Unspecified</option>
                <option value="true" ${profile?.emergencyViewSettings?.organDonor || profile?.organDonor ? 'selected' : ''}>Registered Organ Donor (Show Badge)</option>
              </select>
            </div>
            <div>
              <label class="block font-mono text-[10px] font-bold uppercase mb-1">Medications Public Visibility</label>
              <select id="adminPatEvMedMasking" class="w-full p-2.5 text-xs font-bold border-2 border-[#111111] bg-white">
                <option value="false" ${profile?.emergencyViewSettings?.showMedicationsPublicly !== false ? 'selected' : ''}>Display Publicly on Scan</option>
                <option value="true" ${profile?.emergencyViewSettings?.showMedicationsPublicly === false ? 'selected' : ''}>Mask for Bystanders (Require Paramedic PIN)</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block font-mono text-[10px] font-bold uppercase mb-1">Bystander Phone Privacy</label>
              <select id="adminPatEvPhoneMasking" class="w-full p-2.5 text-xs font-bold border-2 border-[#111111] bg-white">
                <option value="false" ${!profile?.emergencyViewSettings?.bystanderPhoneMasking ? 'selected' : ''}>Show Full Phone Numbers</option>
                <option value="true" ${profile?.emergencyViewSettings?.bystanderPhoneMasking ? 'selected' : ''}>Mask Phone Digits (1-Tap Call Only)</option>
              </select>
            </div>
            <div>
              <label class="block font-mono text-[10px] font-bold uppercase mb-1">Default Translation Language</label>
              <select id="adminPatEvLanguage" class="w-full p-2.5 text-xs font-bold border-2 border-[#111111] bg-white">
                <option value="en" ${!profile?.emergencyViewSettings?.preferredLanguage || profile?.emergencyViewSettings?.preferredLanguage === 'en' ? 'selected' : ''}>English (EN)</option>
                <option value="hi" ${profile?.emergencyViewSettings?.preferredLanguage === 'hi' ? 'selected' : ''}>Hindi (हिंदी)</option>
                <option value="kn" ${profile?.emergencyViewSettings?.preferredLanguage === 'kn' ? 'selected' : ''}>Kannada (ಕನ್ನಡ)</option>
                <option value="ta" ${profile?.emergencyViewSettings?.preferredLanguage === 'ta' ? 'selected' : ''}>Tamil (தமிழ்)</option>
                <option value="es" ${profile?.emergencyViewSettings?.preferredLanguage === 'es' ? 'selected' : ''}>Spanish (Español)</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block font-mono text-[10px] font-bold uppercase mb-1">Urgent Emergency Banner Notice (Shown at Top of Badge)</label>
            <textarea id="adminPatEvBannerText" rows="2" class="w-full p-2.5 text-xs font-sans border-2 border-[#111111] bg-white" placeholder="E.g. 'Patient has an implanted cardiac defibrillator. Call EMS 112 immediately. Do not administer Penicillin derivatives.'">${profile?.emergencyViewSettings?.emergencyBannerText || ''}</textarea>
          </div>
        </div>
      </div>
    `;

    // Populate contacts rows
    const cContainer = document.getElementById('adminPatContactsContainer');
    const contacts = profile?.emergencyContacts || [];
    if (contacts.length === 0) {
      addPatientContactRow();
    } else {
      contacts.forEach(c => addPatientContactRow(c.name, c.phone, c.relationship));
    }

  } else if (role === 'doctor') {
    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between border-b border-[#111111]/20 pb-2">
          <h4 class="font-black text-xs uppercase font-mono text-[#111111] flex items-center gap-1.5">
            <span class="material-symbols-outlined text-sm text-blue-700">stethoscope</span>
            <span>2. Practitioner Clinical &amp; Registry Credentials</span>
          </h4>
          <span class="text-[10px] font-mono font-bold text-blue-800">DOCTOR PROFILE</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-mono text-[10px] font-bold uppercase mb-1">Medical Specialization *</label>
            <input type="text" id="adminDocSpec" value="${escapeHtml(profile?.specialization || '')}" placeholder="E.g. Cardiology, Emergency Physician" class="w-full p-2.5 text-xs font-bold border-2 border-[#111111]">
          </div>
          <div>
            <label class="block font-mono text-[10px] font-bold uppercase mb-1">Medical License Number *</label>
            <input type="text" id="adminDocLic" value="${escapeHtml(profile?.licenseNumber || '')}" placeholder="E.g. MMC-2018-99214" class="w-full p-2.5 text-xs font-mono font-bold border-2 border-[#111111]">
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block font-mono text-[10px] font-bold uppercase mb-1">Primary Hospital / Clinic *</label>
            <input type="text" id="adminDocHosp" value="${escapeHtml(profile?.hospital || '')}" placeholder="E.g. Apollo Multi-Specialty Hospital" class="w-full p-2.5 text-xs font-bold border-2 border-[#111111]">
          </div>
          <div>
            <label class="block font-mono text-[10px] font-bold uppercase mb-1">Registration State Council</label>
            <input type="text" id="adminDocCouncil" value="${escapeHtml(profile?.registrationCouncil || '')}" placeholder="E.g. Delhi Medical Council" class="w-full p-2.5 text-xs font-mono border-2 border-[#111111]">
          </div>
          <div>
            <label class="block font-mono text-[10px] font-bold uppercase mb-1">Registration Year</label>
            <input type="number" id="adminDocYear" value="${profile?.registrationYear || ''}" placeholder="E.g. 2018" class="w-full p-2.5 text-xs font-mono border-2 border-[#111111]">
          </div>
        </div>
      </div>
    `;

  } else if (role === 'crew') {
    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between border-b border-[#111111]/20 pb-2">
          <h4 class="font-black text-xs uppercase font-mono text-[#111111] flex items-center gap-1.5">
            <span class="material-symbols-outlined text-sm text-[#E11D2E]">airport_shuttle</span>
            <span>2. Paramedic &amp; Dispatch Fleet Credentials</span>
          </h4>
          <span class="text-[10px] font-mono font-bold text-[#E11D2E]">AMBULANCE CREW</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-mono text-[10px] font-bold uppercase mb-1">Vehicle / Ambulance Number *</label>
            <input type="text" id="adminCrewVehicle" value="${escapeHtml(profile?.vehicleNumber || '')}" placeholder="E.g. DL-01-AMB-4402" class="w-full p-2.5 text-xs font-mono font-bold border-2 border-[#111111]">
          </div>
          <div>
            <label class="block font-mono text-[10px] font-bold uppercase mb-1">Crew Classification</label>
            <select id="adminCrewType" class="w-full p-2.5 text-xs font-bold border-2 border-[#111111]">
              <option value="ambulance" ${profile?.crewType === 'ambulance' ? 'selected' : ''}>Ambulance Emergency Medical Service (EMS)</option>
              <option value="fire" ${profile?.crewType === 'fire' ? 'selected' : ''}>Fire &amp; Rescue Paramedic</option>
              <option value="police" ${profile?.crewType === 'police' ? 'selected' : ''}>Police Tactical Responder</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-mono text-[10px] font-bold uppercase mb-1">Assigned Base Station *</label>
            <input type="text" id="adminCrewStation" value="${escapeHtml(profile?.station || '')}" placeholder="E.g. South Metro Central Base" class="w-full p-2.5 text-xs font-bold border-2 border-[#111111]">
          </div>
          <div>
            <label class="block font-mono text-[10px] font-bold uppercase mb-1">Department / Organization</label>
            <input type="text" id="adminCrewOrg" value="${escapeHtml(profile?.organization || '')}" placeholder="E.g. National Emergency Ambulance Service" class="w-full p-2.5 text-xs font-mono border-2 border-[#111111]">
          </div>
        </div>
      </div>
    `;

  } else if (role === 'admin') {
    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between border-b border-[#111111]/20 pb-2">
          <h4 class="font-black text-xs uppercase font-mono text-[#111111] flex items-center gap-1.5">
            <span class="material-symbols-outlined text-sm text-gray-800">shield</span>
            <span>2. Administrator Privileges &amp; Security Permissions</span>
          </h4>
          <span class="text-[10px] font-mono font-bold text-gray-800">ROOT CLEARANCE</span>
        </div>
        <div class="p-3 border-2 border-[#111111] bg-gray-50 text-xs font-mono">
          <p class="font-bold text-[#111111]">Tier-1 System Administrator</p>
          <p class="text-gray-600 mt-1">Granted unconstrained database override, user profile troubleshooting, audit inspection, and help desk dispatch capabilities.</p>
        </div>
      </div>
    `;
  }
}

window.addPatientContactRow = function(name = '', phone = '', rel = '') {
  const container = document.getElementById('adminPatContactsContainer');
  if (!container) return;

  const div = document.createElement('div');
  div.className = 'patient-contact-row grid grid-cols-1 sm:grid-cols-12 gap-2 items-center';
  div.innerHTML = `
    <div class="sm:col-span-4">
      <input type="text" placeholder="Contact Name" value="${escapeHtml(name)}" class="contact-name w-full p-1.5 text-xs border border-[#111111]">
    </div>
    <div class="sm:col-span-4">
      <input type="tel" placeholder="Phone Number" value="${escapeHtml(phone)}" class="contact-phone w-full p-1.5 text-xs font-mono border border-[#111111]">
    </div>
    <div class="sm:col-span-3">
      <input type="text" placeholder="Relationship" value="${escapeHtml(rel)}" class="contact-rel w-full p-1.5 text-xs border border-[#111111]">
    </div>
    <div class="sm:col-span-1 text-right">
      <button type="button" onclick="this.closest('.patient-contact-row').remove()" class="p-1 text-[#E11D2E] hover:bg-red-50" title="Remove Contact">
        <span class="material-symbols-outlined text-base">delete</span>
      </button>
    </div>
  `;
  container.appendChild(div);
};

window.handleAdminProfileSave = async function(e) {
  e.preventDefault();
  const userId = document.getElementById('adminUserHiddenId').value;
  const role = document.getElementById('adminUserHiddenRole').value;
  const sourceTicketId = document.getElementById('adminUserHiddenSourceTicketId').value;
  const ticketResolutionNote = document.getElementById('adminProfTicketResolutionNote').value;

  const name = document.getElementById('adminProfName').value.trim();
  const email = document.getElementById('adminProfEmail').value.trim();
  const phone = document.getElementById('adminProfPhone').value.trim();
  const gender = document.getElementById('adminProfGender').value;
  const active = document.getElementById('adminProfActive').value === 'true';
  const verificationStatus = document.getElementById('adminProfVerificationStatus').value;
  const address = document.getElementById('adminProfAddress').value.trim();
  const city = document.getElementById('adminProfCity').value.trim();
  const state = document.getElementById('adminProfState').value.trim();
  const verificationNote = document.getElementById('adminProfVerificationNote').value.trim();
  const newPassword = document.getElementById('adminProfNewPassword').value.trim();

  const payload = {
    name, email, phone, gender, active,
    verificationStatus, address, city, state,
    verificationNote, newPassword,
    sourceTicketId, ticketResolutionNote
  };

  if (role === 'patient') {
    const age = document.getElementById('adminPatAge')?.value;
    const bloodGroup = document.getElementById('adminPatBloodGroup')?.value;
    const publicProfile = document.getElementById('adminPatPublicProfile')?.value === 'true';
    const allergies = document.getElementById('adminPatAllergies')?.value;
    const healthIssues = document.getElementById('adminPatHealthIssues')?.value;
    const medications = document.getElementById('adminPatMedications')?.value;

    const contactRows = document.querySelectorAll('#adminPatContactsContainer .patient-contact-row');
    const emergencyContacts = [];
    contactRows.forEach((row, i) => {
      const cName = row.querySelector('.contact-name')?.value?.trim();
      const cPhone = row.querySelector('.contact-phone')?.value?.trim();
      const cRel = row.querySelector('.contact-rel')?.value?.trim();
      if (cName || cPhone) {
        emergencyContacts.push({ name: cName, phone: cPhone, relationship: cRel, priority: i + 1 });
      }
    });

    const emergencyViewSettings = {
      themeColor: document.getElementById('adminPatEvThemeColor')?.value || '#E11D2E',
      showAllergiesBanner: document.getElementById('adminPatEvAllergyBanner')?.value === 'true',
      showBloodGroupLarge: document.getElementById('adminPatEvBloodGroupLarge')?.value !== 'false',
      showMedicationsPublicly: document.getElementById('adminPatEvMedMasking')?.value !== 'true',
      organDonor: document.getElementById('adminPatEvOrganDonor')?.value === 'true',
      dnrDirective: document.getElementById('adminPatEvDnrDirective')?.value || 'FULL_CODE',
      emergencyBannerText: document.getElementById('adminPatEvBannerText')?.value?.trim() || '',
      preferredLanguage: document.getElementById('adminPatEvLanguage')?.value || 'en',
      bystanderPhoneMasking: document.getElementById('adminPatEvPhoneMasking')?.value === 'true'
    };

    payload.patientDetails = { 
      age, 
      bloodGroup, 
      publicProfile, 
      allergies, 
      healthIssues, 
      medications, 
      emergencyContacts,
      emergencyViewSettings,
      organDonor: emergencyViewSettings.organDonor
    };
  } else if (role === 'doctor') {
    const specialization = document.getElementById('adminDocSpec')?.value;
    const licenseNumber = document.getElementById('adminDocLic')?.value;
    const hospital = document.getElementById('adminDocHosp')?.value;
    const registrationCouncil = document.getElementById('adminDocCouncil')?.value;
    const registrationYear = document.getElementById('adminDocYear')?.value;

    payload.doctorDetails = { specialization, licenseNumber, hospital, registrationCouncil, registrationYear };
  } else if (role === 'crew') {
    const vehicleNumber = document.getElementById('adminCrewVehicle')?.value;
    const crewType = document.getElementById('adminCrewType')?.value;
    const station = document.getElementById('adminCrewStation')?.value;
    const organization = document.getElementById('adminCrewOrg')?.value;

    payload.crewDetails = { vehicleNumber, crewType, station, organization };
  }

  const saveBtn = document.getElementById('adminProfSaveBtn');
  const origHtml = saveBtn.innerHTML;

  try {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span><span>Applying Fixes...</span>';

    // God-Mode: System Role Promotion / Migration
    const selectedRole = document.getElementById('adminProfRole')?.value;
    if (selectedRole && selectedRole !== role) {
      const roleRes = await fetch(`/api/v1/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: selectedRole })
      });
      const roleData = await roleRes.json();
      if (!roleRes.ok) throw new Error(roleData.error || 'Failed to migrate user role');
    }

    const res = await fetch(`/api/v1/admin/users/${userId}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update user profile');

    showToast(`✅ Profile for ${data.user?.name} updated and resolved successfully!`, 'success');
    closeAdminUserProfile();
    await loadAdminUsers();
    await loadAdminHelpTickets();
    await loadAdminStats();
    await loadVerifications();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = origHtml;
    }
  }
};

window.adminRegenerateUserQR = async function(userId) {
  const confirmed = await adminConfirmDialog({
    title: 'Regenerate Patient QR Code',
    subtitle: 'SECURITY ROTATION & INVALIDATION',
    icon: 'sync_saved_locally',
    message: 'Are you sure you want to regenerate this patient\'s QR code? A new unique cryptographic identifier and badge URL will be issued immediately.',
    warning: '<strong>WARNING:</strong> Previous QR badge links and printed physical cards will immediately cease to resolve and cannot be reused.',
    confirmText: 'Regenerate Patient QR',
    confirmIcon: 'refresh',
    confirmClass: 'bg-[#111111] hover:bg-neutral-850 text-white font-mono font-bold text-xs uppercase px-5 py-2.5 border-2 border-[#111111] flex items-center gap-1.5 shadow-[2px_2px_0px_#E11D2E]',
    cancelText: 'Cancel'
  });
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/v1/admin/users/${userId}/regenerate-qr`, {
      method: 'POST',
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to regenerate QR');

    showToast(`✅ ${data.message}! New ID: ${data.qrCodeId}`, 'success');
    openAdminUserProfile(userId);
    await loadAdminUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// ============================================================
// EMERGENCY VIEW CUSTOMIZATION & LIVE SIMULATOR (Admin)
// ============================================================

let currentEvPreviewMode = 'bystander';
let currentEvPreviewLang = 'en';
let currentEvPreviewData = null;

window.scrollToEmergencyCustomization = function() {
  const sec = document.getElementById('adminEmergencyViewCustomizationSection');
  if (sec) {
    sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    sec.classList.add('ring-4', 'ring-[#E11D2E]', 'transition-all');
    setTimeout(() => {
      sec.classList.remove('ring-4', 'ring-[#E11D2E]');
    }, 2000);
  } else {
    showToast('Emergency View Customization is available in Patient profiles', 'info');
  }
};

window.openEmergencyLivePreview = async function(userIdOrQrId) {
  try {
    const modal = document.getElementById('adminEmergencyPreviewModal');
    if (!modal) return;

    let patientData = null;

    // Check if open in user profile modal
    if (currentInspectedUserForProfile && currentInspectedUserForProfile.user && (currentInspectedUserForProfile.user.id === userIdOrQrId || currentInspectedUserForProfile.user._id === userIdOrQrId)) {
      const u = currentInspectedUserForProfile.user;
      const p = currentInspectedUserForProfile.profile || {};
      
      // Read current un-saved field inputs if user is currently editing
      const liveName = document.getElementById('adminProfName')?.value || u.name;
      const livePhone = document.getElementById('adminProfPhone')?.value || u.phone;
      const liveAddress = document.getElementById('adminProfAddress')?.value || u.address;
      const liveBlood = document.getElementById('adminPatBloodGroup')?.value || p.bloodGroup;
      const liveAge = document.getElementById('adminPatAge')?.value || p.age;
      const liveAllergies = document.getElementById('adminPatAllergies')?.value || p.allergies;
      const liveHealth = document.getElementById('adminPatHealthIssues')?.value || p.healthIssues;
      const liveMeds = document.getElementById('adminPatMedications')?.value || p.medications;

      const liveContacts = [];
      const contactRows = document.querySelectorAll('#adminPatContactsContainer .patient-contact-row');
      contactRows.forEach((row, i) => {
        const cName = row.querySelector('.contact-name')?.value?.trim();
        const cPhone = row.querySelector('.contact-phone')?.value?.trim();
        const cRel = row.querySelector('.contact-rel')?.value?.trim();
        if (cName || cPhone) {
          liveContacts.push({ name: cName, phone: cPhone, relationship: cRel, priority: i + 1 });
        }
      });

      const liveEvSettings = {
        themeColor: document.getElementById('adminPatEvThemeColor')?.value || p.emergencyViewSettings?.themeColor || '#E11D2E',
        showAllergiesBanner: document.getElementById('adminPatEvAllergyBanner')?.value === 'true' || (p.emergencyViewSettings?.showAllergiesBanner !== false),
        showBloodGroupLarge: document.getElementById('adminPatEvBloodGroupLarge')?.value !== 'false',
        showMedicationsPublicly: document.getElementById('adminPatEvMedMasking')?.value !== 'true',
        organDonor: document.getElementById('adminPatEvOrganDonor')?.value === 'true' || !!p.organDonor,
        dnrDirective: document.getElementById('adminPatEvDnrDirective')?.value || p.emergencyViewSettings?.dnrDirective || 'FULL_CODE',
        emergencyBannerText: document.getElementById('adminPatEvBannerText')?.value?.trim() || p.emergencyViewSettings?.emergencyBannerText || '',
        preferredLanguage: document.getElementById('adminPatEvLanguage')?.value || p.emergencyViewSettings?.preferredLanguage || 'en',
        bystanderPhoneMasking: document.getElementById('adminPatEvPhoneMasking')?.value === 'true' || !!p.emergencyViewSettings?.bystanderPhoneMasking
      };

      patientData = {
        name: liveName,
        phone: livePhone,
        address: liveAddress,
        bloodGroup: liveBlood,
        age: liveAge,
        gender: document.getElementById('adminProfGender')?.value || u.gender,
        allergies: liveAllergies,
        healthIssues: liveHealth,
        medications: liveMeds,
        emergencyContacts: liveContacts.length ? liveContacts : (p.emergencyContacts || []),
        qrCodeId: p.qrCodeId || 'EMG-PREVIEW',
        qrCode: p.qrCode || '',
        organDonor: liveEvSettings.organDonor,
        emergencyViewSettings: liveEvSettings
      };
    } else {
      // Fetch fresh profile by userId
      showToast('Loading patient emergency telemetry...', 'info');
      const res = await fetch(`/api/v1/admin/users/${userIdOrQrId}/profile`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load profile for preview');
      
      const u = data.user;
      const p = data.profile || {};
      patientData = {
        name: u.name,
        phone: u.phone,
        address: [u.address, u.city, u.state].filter(Boolean).join(', ') || 'Address on file',
        bloodGroup: p.bloodGroup,
        age: p.age,
        gender: u.gender,
        allergies: p.allergies,
        healthIssues: p.healthIssues,
        medications: p.medications,
        emergencyContacts: p.emergencyContacts || [],
        qrCodeId: p.qrCodeId || 'EMG-PREVIEW',
        qrCode: p.qrCode || '',
        organDonor: p.organDonor || false,
        emergencyViewSettings: p.emergencyViewSettings || {}
      };
    }

    currentEvPreviewData = patientData;
    currentEvPreviewLang = patientData.emergencyViewSettings?.preferredLanguage || 'en';
    const langSel = document.getElementById('adminEvPreviewLangSelect');
    if (langSel) langSel.value = currentEvPreviewLang;

    // Update external link
    const extLink = document.getElementById('adminEvPreviewExternalLink');
    if (extLink) {
      extLink.href = `/emergency_access.html?id=${encodeURIComponent(patientData.qrCodeId || '')}`;
    }

    renderEmergencyPreviewContent();
    modal.classList.remove('hidden');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.closeEmergencyLivePreview = function() {
  const modal = document.getElementById('adminEmergencyPreviewModal');
  if (modal) modal.classList.add('hidden');
};

window.setEmergencyPreviewMode = function(mode) {
  currentEvPreviewMode = mode;
  const btnBystander = document.getElementById('adminEvModeBystanderBtn');
  const btnCrew = document.getElementById('adminEvModeCrewBtn');
  const pill = document.getElementById('adminEvPreviewStatusPill');

  if (mode === 'bystander') {
    if (btnBystander) btnBystander.className = 'px-3 py-1 text-xs font-bold uppercase bg-[#111111] text-white transition flex items-center gap-1';
    if (btnCrew) btnCrew.className = 'px-3 py-1 text-xs font-bold uppercase bg-white text-[#111111] hover:bg-gray-100 transition flex items-center gap-1';
    if (pill) {
      pill.textContent = 'BYSTANDER';
      pill.className = 'px-1.5 py-0.2 bg-white text-[#E11D2E] text-[9px] uppercase font-bold';
    }
  } else {
    if (btnBystander) btnBystander.className = 'px-3 py-1 text-xs font-bold uppercase bg-white text-[#111111] hover:bg-gray-100 transition flex items-center gap-1';
    if (btnCrew) btnCrew.className = 'px-3 py-1 text-xs font-bold uppercase bg-[#111111] text-white transition flex items-center gap-1';
    if (pill) {
      pill.textContent = 'PARAMEDIC UNLOCKED';
      pill.className = 'px-1.5 py-0.2 bg-white text-emerald-800 text-[9px] uppercase font-bold';
    }
  }

  renderEmergencyPreviewContent();
};

window.changeEmergencyPreviewLang = function(lang) {
  currentEvPreviewLang = lang;
  renderEmergencyPreviewContent();
};

window.renderEmergencyPreviewContent = function() {
  const canvas = document.getElementById('adminEvPreviewCanvas');
  if (!canvas || !currentEvPreviewData) return;

  const p = currentEvPreviewData;
  const ev = p.emergencyViewSettings || {};
  const isCrew = currentEvPreviewMode === 'crew';
  const themeColor = ev.themeColor || '#E11D2E';

  // Apply theme banner
  const bannerHeader = document.getElementById('adminEvPreviewHeaderBanner');
  if (bannerHeader) bannerHeader.style.backgroundColor = isCrew ? '#111111' : themeColor;

  const maskPhone = ev.bystanderPhoneMasking && !isCrew;
  const displayPhone = (maskPhone && p.phone && p.phone.length > 5)
    ? p.phone.slice(0, 4) + ' ••••• ' + p.phone.slice(-2)
    : (p.phone || '+91 9876543210');

  let bannerHtml = '';
  if (ev.emergencyBannerText) {
    bannerHtml = `
      <div class="p-2.5 border-2 border-[#111111] bg-amber-100 text-[#111111] font-mono text-[11px] font-bold flex items-center gap-2 shadow-[2px_2px_0px_#111111]">
        <span class="material-symbols-outlined text-sm text-amber-800">warning</span>
        <span>${escapeHtml(ev.emergencyBannerText)}</span>
      </div>
    `;
  }

  const dnrBadge = (ev.dnrDirective && ev.dnrDirective !== 'FULL_CODE')
    ? `<span class="px-1.5 py-0.5 border border-purple-700 bg-purple-50 text-purple-900 font-mono text-[9px] font-bold uppercase">⚖️ ${ev.dnrDirective.replace(/_/g, ' ')}</span>`
    : '';

  const organBadge = '';

  // Allergies display
  const allergiesStr = Array.isArray(p.allergies) ? p.allergies.join(', ') : (p.allergies || 'None Reported');
  const allergyCardClass = (ev.showAllergiesBanner !== false && allergiesStr.toLowerCase() !== 'none' && allergiesStr.toLowerCase() !== 'none reported')
    ? 'border-2 border-[#E11D2E] bg-red-50 text-[#111111] shadow-[2px_2px_0px_#E11D2E]'
    : 'border-2 border-[#111111] bg-gray-50 text-[#111111]';

  // Contacts
  const contacts = p.emergencyContacts || [];
  let contactsListHtml = '';
  if (contacts.length === 0) {
    contactsListHtml = '<p class="text-[10px] font-mono text-gray-500 italic">No emergency contacts registered.</p>';
  } else {
    contactsListHtml = contacts.map(c => {
      const pNum = (maskPhone && c.phone && c.phone.length > 5)
        ? c.phone.slice(0, 4) + ' ••••• ' + c.phone.slice(-2)
        : (c.phone || '-');
      return `
        <div class="p-2.5 border-2 border-[#111111] bg-white flex items-center justify-between gap-2 shadow-[2px_2px_0px_#111111]">
          <div>
            <strong class="text-xs uppercase text-[#111111] block">${escapeHtml(c.name || 'Contact')}</strong>
            <span class="text-[10px] font-mono text-gray-600">${escapeHtml(c.relationship || 'Emergency')} &bull; ${pNum}</span>
          </div>
          <button type="button" class="btn-primary px-2.5 py-1 text-[10px] uppercase font-bold font-mono flex items-center gap-1 shadow-[1px_1px_0px_#111111]">
            <span class="material-symbols-outlined text-xs">phone</span> Call
          </button>
        </div>
      `;
    }).join('');
  }

  // Medications
  let medsHtml = '';
  if (!isCrew && ev.showMedicationsPublicly === false) {
    medsHtml = `
      <div class="p-2.5 border border-dashed border-[#111111]/40 bg-gray-50 text-[10px] font-mono text-gray-600 italic">
        🔒 Active prescriptions on file. Masked for public bystander safety. (Requires Paramedic PIN clearance).
      </div>
    `;
  } else {
    const medsStr = Array.isArray(p.medications) ? p.medications.join(', ') : (p.medications || 'None Reported');
    medsHtml = `<p class="font-bold text-xs text-[#111111] leading-relaxed">${escapeHtml(medsStr)}</p>`;
  }

  const conditionsStr = Array.isArray(p.healthIssues) ? p.healthIssues.join(', ') : (p.healthIssues || 'None Reported');

  canvas.innerHTML = `
    ${bannerHtml}

    <!-- Hero Card -->
    <div class="p-3 border-2 border-[#111111] bg-white flex items-start gap-3 shadow-[3px_3px_0px_#111111]">
      <img src="${p.qrCode || '/LifeQR.png'}" class="w-14 h-14 border border-[#111111] object-contain flex-shrink-0 bg-gray-50">
      <div class="flex-1 min-w-0">
        <h3 class="font-black text-sm uppercase text-[#111111] truncate">${escapeHtml(p.name)}</h3>
        <div class="flex items-center gap-1.5 flex-wrap text-[10px] font-mono text-gray-600 mt-0.5">
          <span>Age: <strong>${p.age || 'N/A'}</strong></span>
          <span>&bull;</span>
          <span class="capitalize">${p.gender || 'N/A'}</span>
          ${organBadge}
          ${dnrBadge}
        </div>
        <p class="text-[10px] font-mono text-gray-500 truncate mt-1">ID: <strong class="text-[#E11D2E]">${p.qrCodeId}</strong></p>
      </div>
      <div class="text-center p-2 border-2 border-[#E11D2E] bg-red-50 flex-shrink-0 min-w-[55px]">
        <span class="text-[9px] font-mono font-bold uppercase text-[#E11D2E] block">BLOOD</span>
        <strong class="font-black text-xl text-[#E11D2E] leading-none">${p.bloodGroup || 'N/A'}</strong>
      </div>
    </div>

    <!-- Phone & Address -->
    <div class="grid grid-cols-2 gap-2 text-[10px] font-mono">
      <div class="p-2 border border-[#111111] bg-gray-50">
        <span class="text-gray-500 uppercase block">Emergency Phone:</span>
        <strong class="text-[#111111] text-[11px]">${displayPhone}</strong>
      </div>
      <div class="p-2 border border-[#111111] bg-gray-50">
        <span class="text-gray-500 uppercase block">Registered Loc:</span>
        <strong class="text-[#111111] truncate block" title="${escapeHtml(p.address || '')}">${escapeHtml(p.address || 'On file')}</strong>
      </div>
    </div>

    <!-- Allergies -->
    <div class="p-2.5 ${allergyCardClass}">
      <div class="flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-[#E11D2E] mb-1">
        <span class="material-symbols-outlined text-xs">warning</span>
        <span>High-Risk Severe Allergies</span>
      </div>
      <p class="font-black text-xs text-[#111111]">${escapeHtml(allergiesStr)}</p>
    </div>

    <!-- Conditions -->
    <div class="p-2.5 border-2 border-[#111111] bg-white shadow-[2px_2px_0px_#111111]">
      <div class="flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-gray-600 mb-1">
        <span class="material-symbols-outlined text-xs">monitor_heart</span>
        <span>Critical Chronic Conditions</span>
      </div>
      <p class="font-bold text-xs text-[#111111]">${escapeHtml(conditionsStr)}</p>
    </div>

    <!-- Medications -->
    <div class="p-2.5 border-2 border-[#111111] bg-white shadow-[2px_2px_0px_#111111]">
      <div class="flex items-center justify-between font-mono text-[10px] font-bold uppercase text-gray-600 mb-1">
        <span class="flex items-center gap-1">
          <span class="material-symbols-outlined text-xs">medication</span>
          <span>Active Medications &amp; Dosages</span>
        </span>
        ${isCrew ? '<span class="text-emerald-800 text-[9px]">Paramedic Unlocked</span>' : ''}
      </div>
      ${medsHtml}
    </div>

    <!-- Emergency Contacts -->
    <div class="space-y-1.5">
      <div class="flex items-center justify-between font-mono text-[10px] font-bold uppercase text-[#111111]">
        <span>Emergency Contacts</span>
        <span class="text-gray-500">1-Tap Dial</span>
      </div>
      ${contactsListHtml}
    </div>

    ${isCrew ? `
      <!-- Crew-Only Section -->
      <div class="p-2.5 border-2 border-emerald-700 bg-emerald-50 text-[10px] font-mono space-y-1.5">
        <div class="font-bold uppercase text-emerald-900 flex items-center gap-1">
          <span class="material-symbols-outlined text-xs">medical_services</span>
          <span>Paramedic Clinical Records Clearance</span>
        </div>
        <p class="text-emerald-800">All EHR history, SOAP consultation notes, and hospital trauma bay handovers authorized for this patient.</p>
      </div>
    ` : ''}
  `;
};

// ============================================================
// GOD-MODE & SUPER-ADMINISTRATOR CAPABILITIES
// ============================================================

window.openCreateUserModal = function() {
  const modal = document.getElementById('adminCreateUserModal');
  if (!modal) return;
  const form = document.getElementById('adminCreateUserForm');
  if (form) form.reset();
  selectCreateUserRole('patient');
  modal.classList.remove('hidden');
};

window.closeCreateUserModal = function() {
  const modal = document.getElementById('adminCreateUserModal');
  if (modal) modal.classList.add('hidden');
};

window.selectCreateUserRole = function(role) {
  const roleInput = document.getElementById('createTargetRole');
  if (roleInput) roleInput.value = role;

  const roles = ['patient', 'doctor', 'crew', 'hospital', 'admin'];
  roles.forEach(r => {
    const btn = document.getElementById(`createRoleBtn_${r}`);
    if (btn) {
      if (r === role) {
        btn.className = 'p-2 border-2 border-[#111111] bg-[#111111] text-white text-center transition';
      } else {
        btn.className = 'p-2 border-2 border-[#111111] bg-white text-[#111111] hover:bg-gray-100 text-center transition';
      }
    }
    const fields = document.getElementById(`createRoleFields_${r}`);
    if (fields) {
      if (r === role) fields.classList.remove('hidden');
      else fields.classList.add('hidden');
    }
  });
};

window.handleAdminCreateUserSubmit = async function(e) {
  e.preventDefault();
  const role = document.getElementById('createTargetRole')?.value || 'patient';
  const name = document.getElementById('createUserName')?.value.trim();
  const email = document.getElementById('createUserEmail')?.value.trim();
  const password = document.getElementById('createUserPassword')?.value;
  const phone = document.getElementById('createUserPhone')?.value.trim();
  const gender = document.getElementById('createUserGender')?.value || 'male';
  const address = document.getElementById('createUserAddress')?.value.trim();
  const city = document.getElementById('createUserCity')?.value.trim();
  const state = document.getElementById('createUserState')?.value.trim();

  let roleDetails = {};
  if (role === 'patient') {
    roleDetails = {
      bloodGroup: document.getElementById('createPatientBloodGroup')?.value || 'O+',
      age: document.getElementById('createPatientAge')?.value ? parseInt(document.getElementById('createPatientAge').value) : undefined,
      allergies: document.getElementById('createPatientAllergies')?.value.trim(),
      healthIssues: document.getElementById('createPatientHealthIssues')?.value.trim(),
      medications: document.getElementById('createPatientMedications')?.value.trim(),
      emergencyContactName: document.getElementById('createPatientEmergencyName')?.value.trim(),
      emergencyContactPhone: document.getElementById('createPatientEmergencyPhone')?.value.trim()
    };
  } else if (role === 'doctor') {
    roleDetails = {
      specialization: document.getElementById('createDoctorSpecialty')?.value.trim() || 'General Medicine',
      licenseNumber: document.getElementById('createDoctorLicense')?.value.trim() || 'MED-' + Date.now().toString(36).toUpperCase(),
      hospital: document.getElementById('createDoctorHospital')?.value.trim() || 'City Hospital'
    };
  } else if (role === 'crew') {
    roleDetails = {
      vehicleNumber: document.getElementById('createCrewVehicle')?.value.trim() || 'EMS-' + Math.floor(100 + Math.random() * 900),
      station: document.getElementById('createCrewStation')?.value.trim() || 'Central Station',
      dutyStatus: document.getElementById('createCrewDutyStatus')?.value || 'on_duty'
    };
  } else if (role === 'hospital') {
    roleDetails = {
      hospitalName: document.getElementById('createHospName')?.value.trim() || 'Central Hospital',
      department: document.getElementById('createHospDept')?.value.trim() || 'Emergency Directorate'
    };
  }

  const btn = document.getElementById('btnSubmitCreateUser');
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span><span>Provisioning...</span>';
  }

  try {
    const res = await fetch('/api/v1/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name, email, password, phone, gender, address, city, state, role, roleDetails
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create user');

    showToast(`✅ Created user ${data.user.name} (${data.user.role.toUpperCase()}) successfully!`, 'success');
    closeCreateUserModal();
    await loadAdminUsers();
    await loadAdminStats();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
};

window.adminDeleteUser = async function(userId, userName) {
  if (currentUser && (currentUser._id === userId || currentUser.id === userId)) {
    showToast('Root Safety: You cannot delete your own active administrator account!', 'error');
    return;
  }

  const confirmed = await adminConfirmDialog({
    title: 'Purge User Account & Records',
    subtitle: 'GOD-MODE PERMANENT DELETION',
    icon: 'delete_forever',
    message: `Are you sure you want to permanently purge user <strong>${escapeHtml(userName || 'User')}</strong>?`,
    warning: '<strong>CRITICAL WARNING:</strong> This action will permanently obliterate this account and cascade-delete all linked medical records, QR credentials, audit entries, and verification files from MongoDB.',
    confirmText: 'Permanently Obliterate User',
    confirmIcon: 'delete_forever',
    confirmClass: 'btn-danger px-5 py-2.5 uppercase font-mono font-bold tracking-wider flex items-center gap-2 shadow-[2px_2px_0px_#111111]'
  });
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/v1/admin/users/${userId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete user');

    showToast(`✅ ${data.message}`, 'success');
    closeAdminUserProfile();
    await loadAdminUsers();
    await loadAdminStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.adminDeleteUserFromModal = function() {
  const userId = document.getElementById('adminUserHiddenId')?.value;
  const userName = document.getElementById('adminProfName')?.value;
  if (!userId) return;
  adminDeleteUser(userId, userName);
};

window.loadAdminSosIncidents = async function() {
  const tbody = document.getElementById('adminSosTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" class="text-center p-6 font-mono text-xs text-gray-500"><span class="material-symbols-outlined text-lg animate-spin text-[#E11D2E] inline align-middle mr-2">refresh</span>Connecting to city-wide SOS beacons...</td></tr>`;

  try {
    const res = await fetch('/api/v1/admin/sos', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch SOS alerts');

    const alerts = data.alerts || [];
    const counts = data.counts || { active: 0, dispatched: 0, resolved: 0, total: 0 };

    if (document.getElementById('sosCountActive')) document.getElementById('sosCountActive').textContent = counts.active;
    if (document.getElementById('sosCountEnRoute')) document.getElementById('sosCountEnRoute').textContent = counts.dispatched;
    if (document.getElementById('sosCountResolved')) document.getElementById('sosCountResolved').textContent = counts.resolved;
    if (document.getElementById('sosCountTotal')) document.getElementById('sosCountTotal').textContent = counts.total;

    if (alerts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center p-8 font-mono text-xs text-gray-500 uppercase font-bold">Zero active or past emergency distress beacons on file.</td></tr>`;
      return;
    }

    tbody.innerHTML = alerts.map((a, idx) => {
      let statusBadge = '<span class="px-2 py-0.5 border border-[#E11D2E] bg-red-100 text-[#E11D2E] font-mono text-[10px] font-bold uppercase animate-pulse">🚨 ACTIVE</span>';
      if (a.status === 'CREW_DISPATCHED' || a.status === 'ACKNOWLEDGED') {
        statusBadge = '<span class="px-2 py-0.5 border border-amber-600 bg-amber-50 text-amber-900 font-mono text-[10px] font-bold uppercase">🚑 EN ROUTE</span>';
      } else if (a.status === 'RESOLVED') {
        statusBadge = '<span class="px-2 py-0.5 border border-emerald-600 bg-emerald-50 text-emerald-800 font-mono text-[10px] font-bold uppercase">✔ RESOLVED</span>';
      }

      const timeAgo = Math.round((Date.now() - new Date(a.createdAt).getTime()) / 60000);
      const timeStr = timeAgo < 60 ? `${timeAgo}m ago` : `${Math.round(timeAgo / 60)}h ago`;

      let locStr = 'GPS Pending';
      if (a.location?.latitude && a.location?.longitude) {
        locStr = `<a href="https://maps.google.com/?q=${a.location.latitude},${a.location.longitude}" target="_blank" class="text-blue-700 hover:underline flex items-center gap-1 font-mono text-[10px]"><span class="material-symbols-outlined text-xs">location_on</span>${a.location.latitude.toFixed(4)}, ${a.location.longitude.toFixed(4)}</a>`;
      }

      return `
        <tr class="border-b border-[#111111]/10 hover:bg-[#f9fafb] font-sans text-xs">
          <td class="p-3 font-mono text-[#111111]/60 font-bold">${idx + 1}</td>
          <td class="p-3">
            <strong class="text-xs uppercase text-[#111111] block">${escapeHtml(a.patientName || 'Emergency Patient')}</strong>
            <span class="font-mono text-[10px] text-[#E11D2E] font-bold">${a.qrCodeId ? `QR: ${a.qrCodeId}` : ''}</span>
          </td>
          <td class="p-3 font-mono text-xs">
            <div>${new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            <div class="text-gray-400 text-[10px]">${timeStr}</div>
          </td>
          <td class="p-3">${locStr}</td>
          <td class="p-3">${statusBadge}</td>
          <td class="p-3 font-mono text-[11px]">
            ${a.assignedCrew ? `<strong class="text-emerald-800">${escapeHtml(a.assignedCrew.vehicleNumber || 'Assigned Crew')}</strong>` : '<span class="text-gray-400">Unassigned</span>'}
          </td>
          <td class="p-3 text-right">
            <div class="flex items-center justify-end gap-1 font-mono">
              ${a.status !== 'RESOLVED' ? `
                <button onclick="adminOverrideSosStatus('${a.sosId || a._id}', 'RESOLVED')" class="btn-primary text-[10px] px-2 py-1 uppercase font-bold" title="Force Resolve Incident">
                  Resolve
                </button>
              ` : ''}
              <button onclick="adminDeleteSos('${a.sosId || a._id}')" class="btn-secondary text-[10px] px-2 py-1 uppercase font-bold text-[#E11D2E] hover:bg-red-600 hover:text-white" title="Purge Beacon Record">
                <span class="material-symbols-outlined text-xs">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-xs text-[#E11D2E] font-mono">Failed to load SOS beacons: ${err.message}</td></tr>`;
  }
};

window.adminOverrideSosStatus = async function(sosId, status) {
  try {
    const res = await fetch(`/api/v1/admin/sos/${sosId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update SOS status');

    showToast(`✅ SOS beacon status changed to ${status}`, 'success');
    loadAdminSosIncidents();
    loadAdminStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.adminDeleteSos = async function(sosId) {
  const confirmed = await adminConfirmDialog({
    title: 'Purge Emergency SOS Beacon',
    subtitle: 'TACTICAL RADAR OVERRIDE',
    icon: 'delete',
    message: 'Are you sure you want to purge this SOS beacon alert from the registry?',
    confirmText: 'Purge SOS Beacon',
    confirmClass: 'btn-danger px-4 py-2 uppercase font-mono font-bold text-xs'
  });
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/v1/admin/sos/${sosId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete SOS alert');

    showToast('✅ SOS beacon record purged', 'success');
    loadAdminSosIncidents();
    loadAdminStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.loadAdminFleet = async function() {
  const tbody = document.getElementById('adminFleetTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" class="text-center p-6 font-mono text-xs text-gray-500"><span class="material-symbols-outlined text-lg animate-spin text-[#E11D2E] inline align-middle mr-2">refresh</span>Retrieving fleet tactical positions...</td></tr>`;

  try {
    const res = await fetch('/api/v1/admin/crew/fleet', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load fleet');

    const fleet = data.fleet || [];
    const counts = data.counts || { total: 0, onDuty: 0, offDuty: 0 };

    if (document.getElementById('fleetStatOnDuty')) document.getElementById('fleetStatOnDuty').textContent = counts.onDuty;
    if (document.getElementById('fleetStatOffDuty')) document.getElementById('fleetStatOffDuty').textContent = counts.offDuty;
    if (document.getElementById('fleetStatTotal')) document.getElementById('fleetStatTotal').textContent = counts.total;

    if (fleet.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8 font-mono text-xs text-gray-500 uppercase font-bold">No ambulance crew units registered in the system.</td></tr>`;
      return;
    }

    tbody.innerHTML = fleet.map(c => {
      const isOnDuty = c.dutyStatus === 'on_duty';
      const dutyBadge = isOnDuty
        ? '<span class="px-2 py-0.5 border border-emerald-600 bg-emerald-50 text-emerald-800 font-mono text-[10px] font-bold uppercase">● ON-DUTY</span>'
        : '<span class="px-2 py-0.5 border border-gray-400 bg-gray-100 text-gray-600 font-mono text-[10px] font-bold uppercase">○ OFF-DUTY</span>';

      let gpsStr = '<span class="text-gray-400">Stationary</span>';
      if (c.currentLocation?.latitude && c.currentLocation?.longitude) {
        gpsStr = `<a href="https://maps.google.com/?q=${c.currentLocation.latitude},${c.currentLocation.longitude}" target="_blank" class="text-blue-700 hover:underline font-mono text-[10px]">${c.currentLocation.latitude.toFixed(4)}, ${c.currentLocation.longitude.toFixed(4)}</a>`;
      }

      return `
        <tr class="border-b border-[#111111]/10 hover:bg-[#f9fafb] font-sans text-xs">
          <td class="p-3">
            <strong class="text-xs uppercase text-[#E11D2E] font-mono block">${escapeHtml(c.vehicleNumber || 'Unassigned')}</strong>
            <span class="text-gray-600 text-[11px]">${escapeHtml(c.crewType || 'ambulance')}</span>
          </td>
          <td class="p-3">
            <strong class="text-xs text-[#111111] block">${escapeHtml(c.crewName || 'Paramedic')}</strong>
            <span class="text-[10px] font-mono text-gray-500">${escapeHtml(c.crewEmail || '')}</span>
          </td>
          <td class="p-3 font-mono text-xs text-gray-700">${escapeHtml(c.station || 'Central Station')}</td>
          <td class="p-3">${gpsStr}</td>
          <td class="p-3">${dutyBadge}</td>
          <td class="p-3 text-right font-mono">
            <button onclick="adminToggleCrewDuty('${c.crewId}', '${isOnDuty ? 'off_duty' : 'on_duty'}')" class="${isOnDuty ? 'btn-secondary text-amber-800 hover:bg-amber-100' : 'btn-primary text-white'} px-3 py-1 text-[10px] uppercase font-bold tracking-wider">
              ${isOnDuty ? 'Force Off-Duty' : 'Force On-Duty'}
            </button>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-xs text-[#E11D2E] font-mono">Fleet load error: ${err.message}</td></tr>`;
  }
};

window.adminToggleCrewDuty = async function(crewId, targetStatus) {
  try {
    const res = await fetch(`/api/v1/admin/crew/${crewId}/duty`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ dutyStatus: targetStatus })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to toggle duty');

    showToast(`✅ Crew duty toggled to ${targetStatus.toUpperCase().replace('_', '-')}`, 'success');
    loadAdminFleet();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.adminRunSystemRepair = async function() {
  const btn = document.getElementById('btnRunSystemRepair');
  const box = document.getElementById('repairResultsBox');
  const summaryEl = document.getElementById('repairSummaryText');
  const logsEl = document.getElementById('repairLogsList');

  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span><span>Executing Diagnostics & Self-Healing...</span>';
  }

  try {
    const res = await fetch('/api/v1/admin/system/repair', {
      method: 'POST',
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'System repair diagnosis failed');

    if (box) box.classList.remove('hidden');
    if (summaryEl) {
      const r = data.results;
      summaryEl.innerHTML = `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
          <div class="p-2 border border-[#111111] bg-white"><strong>Inspected:</strong> ${r.scannedUsers} Users</div>
          <div class="p-2 border border-[#111111] bg-white"><strong>Missing Profiles:</strong> ${r.missingProfilesFixed} Created</div>
          <div class="p-2 border border-[#111111] bg-white"><strong>Security Sync:</strong> ${r.missingSecurityFixed} Repaired</div>
          <div class="p-2 border border-[#111111] bg-white"><strong>QR Codes:</strong> ${r.missingQrFixed} Generated</div>
        </div>
        <p class="mt-2 text-emerald-800 font-bold">✔ Self-healing complete. All detected corruptions or missing relational links resolved.</p>
      `;
    }

    if (logsEl && Array.isArray(data.results?.logs)) {
      logsEl.innerHTML = data.results.logs.map(log => `<div>&bull; ${escapeHtml(log)}</div>`).join('');
    }

    showToast('✅ 1-Click Platform Integrity Self-Healing finished!', 'success');
    await loadAdminStats();
    await loadAdminUsers();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
};

window.adminSendBroadcast = async function(e) {
  e.preventDefault();
  const target = document.getElementById('broadcastTarget')?.value || 'all';
  const priority = document.getElementById('broadcastPriority')?.value || 'emergency';
  const message = document.getElementById('broadcastMessage')?.value.trim();
  if (!message) return;

  const btn = document.getElementById('btnSendBroadcast');
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span><span>Transmitting...</span>';
  }

  try {
    const res = await fetch('/api/v1/admin/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ target, priority, message })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Broadcast failed');

    showToast(`📢 Announcement blasted across socket mesh: ${data.message}`, 'success');
    const msgInput = document.getElementById('broadcastMessage');
    if (msgInput) msgInput.value = '';
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
};

window.adminDeleteTicket = async function(ticketId) {
  const confirmed = await adminConfirmDialog({
    title: 'Purge Help Ticket',
    subtitle: 'SUPPORT CLEARINGHOUSE',
    icon: 'delete',
    message: `Are you sure you want to permanently delete ticket #${ticketId}?`,
    confirmText: 'Delete Ticket',
    confirmClass: 'btn-danger px-4 py-2 uppercase font-mono font-bold text-xs'
  });
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/v1/admin/help-tickets/${ticketId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete ticket');

    showToast('✅ Ticket permanently deleted', 'success');
    await loadAdminHelpTickets();
    await loadAdminStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

