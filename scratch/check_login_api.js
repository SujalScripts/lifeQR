const http = require('http');

const req = http.request('http://localhost:5000/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Login res:', body));
});

req.write(JSON.stringify({ email: 'patient@lifeqr.com', password: 'Password@123' }));
req.end();
