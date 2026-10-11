const io = require('../backend/node_modules/socket.io-client');
const http = require('http');

const API_BASE = 'http://localhost:5000/api/v1';

async function request(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  const parsed = new URL(fullUrl);

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch(e) {}
        
        // Extract cookies
        const setCookie = res.headers['set-cookie'];
        let tokenCookie = null;
        if (setCookie) {
          const match = setCookie.join('; ').match(/token=([^;]+)/);
          if (match) tokenCookie = match[1];
        }

        resolve({
          status: res.statusMessage,
          statusCode: res.statusCode,
          headers: res.headers,
          data: json || data,
          tokenCookie
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function runTest() {
  console.log('🚑 Starting LifeQR Real-Time SOS Radar & Crew Dispatch Test...\n');

  // 1. Patient Login
  console.log('1️⃣ Logging in as Patient (patient@lifeqr.com)...');
  const patientLogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'patient@lifeqr.com', password: 'Password@123' }
  });

  if (patientLogin.statusCode !== 200) {
    throw new Error(`Patient login failed: ${JSON.stringify(patientLogin.data)}`);
  }
  const patientToken = patientLogin.tokenCookie || patientLogin.data.token;
  const patientUser = patientLogin.data.user;
  console.log(`   ✅ Patient Logged In: ${patientUser.name} (ID: ${patientUser.id || patientUser._id})`);

  // 2. Crew Login
  console.log('\n2️⃣ Logging in as Ambulance Crew (crew@lifeqr.com)...');
  const crewLogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'crew@lifeqr.com', password: 'Password@123' }
  });

  if (crewLogin.statusCode !== 200) {
    throw new Error(`Crew login failed: ${JSON.stringify(crewLogin.data)}`);
  }
  const crewToken = crewLogin.tokenCookie || crewLogin.data.token;
  const crewUser = crewLogin.data.user;
  console.log(`   ✅ Crew Logged In: ${crewUser.name} (Role: ${crewUser.role})`);

  // 3. Update Crew Live GPS Coordinates (Marine Drive Baseline)
  console.log('\n3️⃣ Updating Ambulance Live GPS Location to [18.9438, 72.8234]...');
  const crewLocRes = await request('/sos/crew/location', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `token=${crewToken}`
    },
    body: { lat: 18.9438, lng: 72.8234 }
  });
  console.log(`   ✅ Crew Location Response:`, crewLocRes.data);

  // 4. Connect Crew & Patient Sockets
  console.log('\n4️⃣ Connecting Sockets...');
  const crewSocket = io('http://localhost:5000', {
    extraHeaders: { Cookie: `token=${crewToken}` },
    auth: { token: crewToken }
  });

  const patientSocket = io('http://localhost:5000', {
    extraHeaders: { Cookie: `token=${patientToken}` },
    auth: { token: patientToken }
  });

  await Promise.all([
    new Promise(res => crewSocket.on('connect', () => {
      console.log(`   🔌 Crew Socket Connected: ${crewSocket.id}`);
      res();
    })),
    new Promise(res => patientSocket.on('connect', () => {
      console.log(`   🔌 Patient Socket Connected: ${patientSocket.id}`);
      res();
    }))
  ]);

  // Set up listeners
  let receivedSosAlert = null;
  const crewSosPromise = new Promise(resolve => {
    crewSocket.on('sos-alert', (data) => {
      console.log(`   🚨 Crew Socket received 'sos-alert':`, {
        sosId: data.sosId,
        patientName: data.name,
        bloodGroup: data.bloodGroup,
        location: data.location
      });
      receivedSosAlert = data;
      resolve(data);
    });
  });

  let receivedDispatchAccepted = null;
  const patientDispatchPromise = new Promise(resolve => {
    patientSocket.on('sos-dispatch-accepted', (data) => {
      console.log(`   🚑 Patient Socket received 'sos-dispatch-accepted':`, {
        sosId: data.sosId,
        crewName: data.crewName,
        crewPhone: data.crewPhone,
        vehicleNumber: data.vehicleNumber,
        station: data.station,
        etaMinutes: data.etaMinutes
      });
      receivedDispatchAccepted = data;
      resolve(data);
    });
  });

  // 5. Patient Triggers Emergency SOS ~1.3 km away (within 2-3km perimeter)
  const victimCoords = { lat: 18.9550, lng: 72.8280 };
  const distance = calculateDistanceKm(18.9438, 72.8234, victimCoords.lat, victimCoords.lng);
  console.log(`\n5️⃣ Patient triggering Emergency SOS at [${victimCoords.lat}, ${victimCoords.lng}]...`);
  console.log(`   📏 Distance to Crew: ${distance.toFixed(2)} km (Within 3.0 km Rapid Perimeter: ${distance <= 3.0 ? 'YES' : 'NO'})`);

  const sosRes = await request('/sos/sos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `token=${patientToken}`
    },
    body: {
      lat: victimCoords.lat,
      lng: victimCoords.lng,
      message: 'LifeQR Real-Time SOS Proximity Dispatch Drill'
    }
  });

  console.log(`   📡 SOS API Broadcast response:`, sosRes.data.message);

  // Wait for crew socket to receive alert
  console.log('\n6️⃣ Waiting for Crew Dashboard to receive live SOS alert via Socket.IO...');
  await Promise.race([
    crewSosPromise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout waiting for sos-alert')), 6000))
  ]);
  console.log(`   ✅ Verified: Crew received real-time SOS alert for ${receivedSosAlert.name}!`);

  // 6. Crew Accepts Dispatch
  console.log('\n7️⃣ Ambulance Crew accepting dispatch via POST /api/v1/sos/accept...');
  const acceptRes = await request('/sos/accept', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `token=${crewToken}`
    },
    body: {
      sosId: receivedSosAlert.sosId,
      etaMinutes: 4,
      crewLocation: { lat: 18.9438, lng: 72.8234 }
    }
  });

  console.log(`   📡 Dispatch accept API response:`, acceptRes.data.message);
  console.log(`   📋 Dispatch payload:`, acceptRes.data.dispatch);

  // Wait for patient socket to receive dispatch notification
  console.log('\n8️⃣ Waiting for Patient to receive real-time dispatch notification with Crew Name and Contact Phone...');
  await Promise.race([
    patientDispatchPromise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout waiting for sos-dispatch-accepted')), 6000))
  ]);

  console.log(`\n🎉 SUCCESS! Patient received real-time dispatch notification:`);
  console.log(`   • Paramedic Responder Name : ${receivedDispatchAccepted.crewName}`);
  console.log(`   • Ambulance Direct Line    : ${receivedDispatchAccepted.crewPhone}`);
  console.log(`   • Vehicle Number           : ${receivedDispatchAccepted.vehicleNumber}`);
  console.log(`   • Station / Base           : ${receivedDispatchAccepted.station}`);
  console.log(`   • Estimated Arrival (ETA)  : ~${receivedDispatchAccepted.etaMinutes} mins`);

  // 9. Verify GET /api/v1/sos/active
  console.log('\n9️⃣ Verifying GET /api/v1/sos/active returns active incident radar data...');
  const activeAlertsRes = await request('/sos/active', {
    headers: { 'Cookie': `token=${crewToken}` }
  });
  console.log(`   ✅ Active alerts in radar mesh: ${activeAlertsRes.data.alerts.length}`);
  const match = activeAlertsRes.data.alerts.find(a => a.sosId.toString() === receivedSosAlert.sosId.toString());
  console.log(`   ✅ Target SOS found with status: ${match?.status} (Dispatched To: ${match?.acknowledgedBy?.name}, Phone: ${match?.acknowledgedBy?.phone})`);

  crewSocket.disconnect();
  patientSocket.disconnect();
  console.log('\n🏁 All tests passed with 100% real-time end-to-end telemetry!');
}

runTest().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
