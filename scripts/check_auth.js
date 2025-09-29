const http = require('http');

function get(u) {
  return new Promise((resolve) => {
    http.get(u, (res) => {
      const { statusCode, headers } = res;
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ url: u, statusCode, headers, body: data }));
    }).on('error', (err) => resolve({ url: u, error: err.message }));
  });
}

(async () => {
  const base = 'http://127.0.0.1:5173';
  const urls = [`${base}/auth/session`, `${base}/auth/signin/google`];
  for (const u of urls) {
    const r = await get(u);
    console.log('---');
    console.log('URL:', r.url);
    if (r.error) {
      console.log('ERROR:', r.error);
      continue;
    }
    console.log('STATUS:', r.statusCode);
    console.log('LOCATION:', r.headers.location || '');
    console.log('SET-COOKIE:', r.headers['set-cookie'] || '');
    console.log('BODY (short):', (r.body || '').slice(0, 300).replace(/\n/g, ' '));
  }
})();
