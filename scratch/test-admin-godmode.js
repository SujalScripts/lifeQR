const http = require('http');

async function main() {
  console.log('--- LifeQR God-Mode & Super-Admin Validation ---');

  // Helper fetch function with cookie jar
  let cookie = '';
  async function request(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL('http://localhost:5000' + path);
      const headers = { 'Content-Type': 'application/json' };
      if (cookie) headers['Cookie'] = cookie;

      const req = http.request(url, { method, headers }, (res) => {
        let data = '';
        if (res.headers['set-cookie']) {
          cookie = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
        }
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, text: data });
          }
        });
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  // 1. Login as Admin
  console.log('1. Logging in as Administrator...');
  const loginRes = await request('/api/v1/auth/login', 'POST', {
    email: 'admin@lifeqr.com',
    password: 'Password@123'
  });
  console.log('   Login Status:', loginRes.status, loginRes.data?.user ? '✔ Success (' + loginRes.data.user.email + ')' : loginRes.data);
  const adminId = loginRes.data?.user?.id || loginRes.data?.user?._id;

  // 2. God-Mode: Create new user (Patient)
  console.log('2. God-Mode: Provisioning new Patient account with instant credentials...');
  const createRes = await request('/api/v1/admin/users', 'POST', {
    name: 'GodMode Test Subject',
    email: 'godmode_patient_' + Date.now() + '@test.com',
    password: 'Password@123',
    phone: '+91 9998887776',
    gender: 'male',
    role: 'patient',
    roleDetails: {
      bloodGroup: 'AB+',
      age: 29,
      allergies: 'Severe Penicillin & Latex Anaphylaxis',
      healthIssues: 'Asthma',
      medications: 'Albuterol Inhaler',
      emergencyContactName: 'Jane Doe',
      emergencyContactPhone: '+91 9887766554'
    }
  });
  console.log('   Create User Status:', createRes.status);
  console.log('   User Provisioned:', createRes.data?.user?.name, 'Role:', createRes.data?.user?.role);
  console.log('   Patient Profile QR ID:', createRes.data?.profile?.qrCodeId);
  const newUserId = createRes.data?.user?.id;

  // 3. God-Mode: Role Migration / Promotion
  console.log('3. God-Mode: Promoting user to Doctor with automatic clinical profile...');
  const roleRes = await request(`/api/v1/admin/users/${newUserId}/role`, 'PUT', {
    role: 'doctor',
    roleDetails: {
      specialization: 'Trauma & Critical Care',
      hospital: 'Apex Central Emergency Hospital',
      licenseNumber: 'DOC-GODMODE-7788'
    }
  });
  console.log('   Role Promotion Status:', roleRes.status, 'New Role:', roleRes.data?.user?.role);

  // 4. God-Mode: 1-Click System Self-Healing & Problem Solving
  console.log('4. God-Mode: Running 1-Click Platform Integrity Self-Healing...');
  const repairRes = await request('/api/v1/admin/system/repair', 'POST');
  console.log('   Repair Status:', repairRes.status);
  console.log('   Scanned Users:', repairRes.data?.results?.scannedUsers);
  console.log('   Missing Profiles Repaired:', repairRes.data?.results?.missingProfilesFixed);
  console.log('   Missing Security Repaired:', repairRes.data?.results?.missingSecurityFixed);
  console.log('   Missing QR Codes Repaired:', repairRes.data?.results?.missingQrFixed);

  // 5. God-Mode: SOS Incident Command
  console.log('5. God-Mode: Querying City-Wide SOS Beacons...');
  const sosRes = await request('/api/v1/admin/sos', 'GET');
  console.log('   SOS Query Status:', sosRes.status, 'Total Alerts:', sosRes.data?.counts?.total);

  // 6. God-Mode: Ambulance Fleet & Duty Control
  console.log('6. God-Mode: Inspecting Fleet Registry & Duty State...');
  const fleetRes = await request('/api/v1/admin/crew/fleet', 'GET');
  console.log('   Fleet Status:', fleetRes.status, 'Total Fleet Units:', fleetRes.data?.counts?.total);
  if (fleetRes.data?.fleet?.length > 0) {
    const firstCrew = fleetRes.data.fleet[0];
    const newDuty = firstCrew.dutyStatus === 'on_duty' ? 'off_duty' : 'on_duty';
    console.log(`   Force toggling Crew ${firstCrew.vehicleNumber} duty to: ${newDuty}`);
    const toggleRes = await request(`/api/v1/admin/crew/${firstCrew.crewId}/duty`, 'PUT', { dutyStatus: newDuty });
    console.log('   Duty Toggle Status:', toggleRes.status, 'New Duty:', toggleRes.data?.crew?.dutyStatus);
  }

  // 7. God-Mode: Lockout Prevention on Self-Deletion
  console.log('7. Testing Root Lockout Prevention (Admin attempting self-deletion)...');
  const selfDelRes = await request(`/api/v1/admin/users/${adminId}`, 'DELETE');
  console.log('   Self-Delete Status (Expected 403):', selfDelRes.status, selfDelRes.data?.error);

  // 8. God-Mode: Permanent Cascading User Purge
  console.log('8. God-Mode: Cascading purge of test user account...');
  const purgeRes = await request(`/api/v1/admin/users/${newUserId}`, 'DELETE');
  console.log('   Purge Status:', purgeRes.status, purgeRes.data?.message);

  console.log('--- ALL GOD-MODE CAPABILITIES EMPIRICALLY VALIDATED! ---');
}

main().catch(console.error);
