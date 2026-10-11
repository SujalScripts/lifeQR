const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/auth/logout',
  method: 'POST'
}, res => {
  console.log('STATUS:', res.statusCode);
  console.log('SET-COOKIE:', res.headers['set-cookie']);
});
req.end();
