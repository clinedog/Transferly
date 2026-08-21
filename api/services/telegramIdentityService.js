const crypto = require('node:crypto');

// Verifies Telegram WebApp initData per Telegram docs.
// Exposes verifyInitData(rawInitDataString)

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CLOCK_SKEW_SEC = Number(process.env.TELEGRAM_AUTH_CLOCK_SKEW_SEC || '300'); // 5 minutes

function parseInitData(initData) {
  // initData is the raw query-string-like string from Telegram (e.g. "auth_date=...&user=...&hash=...")
  const params = Object.fromEntries(new URLSearchParams(initData));
  return params;
}

function buildDataCheckString(params) {
  // Exclude hash
  const entries = Object.entries(params).filter(([k]) => k !== 'hash');
  // Sort by key
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  return entries.map(([k, v]) => `${k}=${v}`).join('\n');
}

function timingSafeCompare(a, b) {
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (_err) {
    return false;
  }
}

function verifyHmac(dataCheckString, expectedHash) {
  const secret = crypto.createHash('sha256').update(BOT_TOKEN).digest();
  const hmac = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  return timingSafeCompare(hmac, expectedHash);
}

function verifyAuthDate(authDateStr) {
  const authDate = Number(authDateStr);
  if (!Number.isFinite(authDate)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (authDate < now - CLOCK_SKEW_SEC) return false;
  if (authDate > now + CLOCK_SKEW_SEC) return false;
  return true;
}

async function verifyInitData(initDataRaw) {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const params = parseInitData(initDataRaw);
  const hash = params.hash;
  if (!hash) throw new Error('initData missing hash');
  if (!verifyAuthDate(params.auth_date)) throw new Error('auth_date invalid or expired');
  const dataCheckString = buildDataCheckString(params);
  if (!verifyHmac(dataCheckString, hash)) throw new Error('AUTH_SIGNATURE_INVALID');
  return params; // validated params
}

module.exports = {
  verifyInitData,
  parseInitData,
  buildDataCheckString
};
