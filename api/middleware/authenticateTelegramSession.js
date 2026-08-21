const { verifyInitData } = require('../services/telegramIdentityService');
const { db } = require('../db');

// Middleware expects initData in body.initData or query.initData
module.exports = async function authenticateTelegramSession(req, res, next) {
  try {
    const raw = req.body && req.body.initData ? req.body.initData : req.query && req.query.initData ? req.query.initData : null;
    if (!raw) {
      return res.status(400).json({ success: false, error: { code: 'AUTH_INIT_DATA_MISSING', message: 'initData is required' } });
    }

    const params = await verifyInitData(raw);

    // Upsert telegram_accounts and users minimally. Full provisioning is handled by sessionService.
    const telegramUserId = String(params.user_id || params.id || (params.user && params.user.id));
    if (!telegramUserId) {
      return res.status(400).json({ success: false, error: { code: 'AUTH_INIT_DATA_MALFORMED', message: 'telegram user id missing' } });
    }

    // Note: This is a lightweight upsert. Larger provisioning moved to sessionService in later steps.
    const now = new Date().toISOString();
    await db.run(`INSERT OR IGNORE INTO users (id, email, display_name, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)
      `, [
      `tg:${telegramUserId}`,
      null,
      params.user && params.user.first_name ? `${params.user.first_name}${params.user.last_name ? ' ' + params.user.last_name : ''}` : `telegram:${telegramUserId}`,
      now,
      now
    ]);

    await db.run(`INSERT OR IGNORE INTO telegram_accounts (id, user_id, telegram_user_id, chat_id, username, first_name, last_name, language_code, last_authenticated_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      `tgacc:${telegramUserId}`,
      `tg:${telegramUserId}`,
      telegramUserId,
      params.user && params.user.id ? String(params.user.id) : telegramUserId,
      params.user && params.user.username ? params.user.username : null,
      params.user && params.user.first_name ? params.user.first_name : null,
      params.user && params.user.last_name ? params.user.last_name : null,
      params.user && params.user.language_code ? params.user.language_code : null,
      now,
      now,
      now
    ]);

    // Attach verified data to the request for downstream session issuance
    req.telegramInit = params;
    req.user = { id: `tg:${telegramUserId}`, telegram_user_id: telegramUserId };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: { code: err.message || 'AUTH_SIGNATURE_INVALID', message: 'Telegram initData verification failed' } });
  }
};
