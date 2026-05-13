const http = require('http');

const data = JSON.stringify({
  headline: "MARKET CRASH: Tech Stocks Plummet as Interest Rates Rise"
});

const options = {
  hostname: 'localhost',
  port: 3012,
  path: '/update-headline',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => console.log('Response:', body));
});

req.on('error', (e) => console.error(e.message));
req.write(data);
req.end();
