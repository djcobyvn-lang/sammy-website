const GAS_URL = process.env.GAS_URL ||
  'https://script.google.com/macros/s/AKfycbwFi3Iq79XFFA9BBAUar9Ius727HeZncIHOVQdxMXczbpNRJ_TiBUgHnsI-YJDYnNl-ew/exec';

// Dùng fetch (Node 18+) — tự follow redirect, không như https.get()
async function gasCall(payload) {
  try {
    const url = GAS_URL + '?payload=' + encodeURIComponent(JSON.stringify(payload));
    console.log('[GAS] Calling:', url.substring(0, 80) + '...');
    const res  = await fetch(url);
    const text = await res.text();
    console.log('[GAS] Response:', text.substring(0, 200));
    try { return JSON.parse(text); }
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

module.exports = { gasCall, checkCourseAccess };
