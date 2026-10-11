const http = require('http');

async function test() {
  // Login first
  const loginData = JSON.stringify({ email: 'patient@lifeqr.com', password: 'Password@123' });
  const req = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': loginData.length
    }
  }, res => {
    const cookies = res.headers['set-cookie'];
    console.log('Login status:', res.statusCode);
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      console.log('Login body:', body);
      // Now get patient profile
      const profReq = http.request({
        hostname: 'localhost',
        port: 5000,
        path: '/api/v1/patient-app/profile',
        method: 'GET',
        headers: {
          'Cookie': cookies ? cookies.join('; ') : ''
        }
      }, profRes => {
        let profBody = '';
        profRes.on('data', c => profBody += c);
        profRes.on('end', () => {
          console.log('Profile status:', profRes.statusCode);
          console.log('Profile data:', profBody);
        });
      });
      profReq.end();
    });
  });
  req.write(loginData);
  req.end();
}

test();
