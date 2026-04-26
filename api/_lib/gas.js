const https = require('https');
const http  = require('http');

const GAS_URL = process.env.GAS_URL ||
  'https://script.google.com/macros/s/AKfycbwFi3Iq79XFFA9BBAUar9Ius727HeZncIHOVQdxMXczbpNRJ_TiBUgHnsI-YJDYnNl-ew/exec';

// HTTPS GET tự follow redirect (Node https.get không tự follow)
function httpsGet(url, redirects) {
  redirects = redirects || 0;
  return new Promise((resolve, reject) => {
    if (redirects > 8) { reject(new Error('Too many redirects')); return; }

    const parsed  = new URL(url);
    const lib     = parsed.protocol === 'https:' ? https : http;

    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SammyBot/1.0)',
        'Accept'    : 'application/json, text/plain, */*'
      }
    }, (res) => {
      // Follow redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).toString();
        resolve(httpsGet(next, redirects + 1));
        return;
      }

      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end',  () => resolve(body));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(new Error('GAS request timeout')); });
  });
}

async function gasCall(payload) {
  try {
    const url  = GAS_URL + '?payload=' + encodeURIComponent(JSON.stringify(payload));
    console.log('[GAS] →', url.substring(0, 100) + '...');
    const body = await httpsGet(url);
    console.log('[GAS] ←', body.substring(0, 150));
    try { return JSON.parse(body); }
    catch { return { success: true }; }
  } catch(e) {
    console.warn('[GAS] Error:', e.message);
    return { success: false, error: e.message };
  }
}

async function checkCourseAccess(email) {
  const result = await gasCall({ formType: 'check-access', email });
  return result.activated === true;
}

module.exports = { gasCall, checkCourseAccess, GAS_URL };
