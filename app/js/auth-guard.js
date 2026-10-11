// Client-side authentication guard for LifeQR
// All auth uses httpOnly cookies — no localStorage token storage

function getApiBase() {
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

window.verifyAuth = async function() {
  try {
    const apiBase = getApiBase();
    const response = await fetch(`${apiBase}/auth/verify`, {
      method: 'GET',
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data && data.user) {
        if (data.user.role) localStorage.setItem('userRole', data.user.role);
        if (data.user.name) localStorage.setItem('userName', data.user.name);
        if (data.user.id) localStorage.setItem('userId', data.user.id);
        return data.user;
      }
    }
  } catch (error) {
    console.error('Auth verification error:', error);
  }
  
  return null;
};

window.checkDashboardAccess = async function(allowedRoles = []) {
  const user = await window.verifyAuth();
  
  if (!user) {
    window.location.href = 'lifeqr_login.html';
    return;
  }
  
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // Redirect to correct dashboard based on actual role
    redirectUserToDashboard(user.role);
    return;
  }
  
  return user;
};

window.checkAuthPagesAccess = async function() {
  const user = await window.verifyAuth();
  if (user) {
    redirectUserToDashboard(user.role);
  }
};

function redirectUserToDashboard(role) {
  if (role === 'patient') {
    window.location.href = 'patient_dashboard.html';
  } else if (role === 'doctor') {
    window.location.href = 'doctor_dashboard.html';
  } else if (role === 'crew') {
    window.location.href = 'CrewAmbulance_dashboard.html';
  } else if (role === 'hospital') {
    window.location.href = 'hospital_dashboard.html';
  } else if (role === 'admin') {
    window.location.href = 'admin_dashboard.html';
  } else {
    window.location.href = 'index.html';
  }
}

window.logout = async function() {
  try {
    const apiBase = getApiBase();
    await fetch(`${apiBase}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch (err) {
    console.error('Logout request failed:', err);
  }
  // Only clear non-sensitive UI routing data
  localStorage.removeItem('userRole');
  localStorage.removeItem('userName');
  localStorage.removeItem('userId');
  window.location.href = 'lifeqr_login.html';
};


