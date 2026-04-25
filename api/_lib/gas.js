const https = require('https');

const GAS_URL = process.env.GAS_URL ||
  'https://script.google.com/macros/s/AKfycbwFi3Iq79XFFA9BBAUar9Ius727HeZncIHOVQdxMXczbpNRJ_TiBUgHnsI-YJDYnNl-ew/exec';

// Gửi GET request đến GAS (không bị CORS block phía server)
function gasCall(payload) {
  return new Promise((resolve) => {
    const url = GAS_URL + '?payload=' + encodeURIComponent(JSON.stringify(payload));
    https.get(url, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve({ success: true }); }
      });
    }).on('error', (e) => {
      console.warn('[GAS]', e.message);
      resolve({ success: false, error: e.message });
    });
  });
}

// Kiểm tra email đã đăng ký khoá học và đã thanh toán chưa
async function checkCourseAccess(email) {
  const result = await gasCall({ formType: 'check-access', email });
  return result.activated === true;
}

module.exports = { gasCall, checkCourseAccess };
