const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3015,
  path: '/toggle-stock',
  method: 'POST',
  headers: {
    'Accept': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => console.log('Response:', body));
});

req.on('error', (e) => console.error(e.message));
req.end();
