#!/usr/bin/env node
'use strict';

require('dotenv').config();

const https = require('https');

const token = process.env.BOT_TOKEN;
const chatId = process.env.SMOKE_CHAT_ID || process.env.ADMIN_TELEGRAM_ID;
const miniAppUrl = process.env.MINI_APP_URL || process.env.WEB_APP_URL || process.env.FRONTEND_URL;
const dryRun = process.argv.includes('--dry-run');

if ((!token || !chatId) && !dryRun) {
  console.error('Missing BOT_TOKEN or SMOKE_CHAT_ID/ADMIN_TELEGRAM_ID.');
  process.exit(1);
}

function miniAppDashboardUrl() {
  if (!miniAppUrl) return '';
  const url = new URL(miniAppUrl);
  if (url.pathname === '/' && !url.search && !url.hash) {
    return url.origin;
  }
  return url.toString();
}

function apiRequest(method, payload = null) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : null;
    const request = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/${method}`,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(body ? { 'content-length': Buffer.byteLength(body) } : {}),
      },
    }, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data || '{}');
          if (!parsed.ok) {
            reject(new Error(parsed.description || `Telegram ${method} failed`));
            return;
          }
          resolve(parsed.result);
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

function callback(action) {
  return action;
}

async function main() {
  const me = dryRun ? { username: 'transferly_dry_run_bot' } : await apiRequest('getMe');
  const dashboardUrl = miniAppDashboardUrl();
  const text = [
    '<b>Transferly Bot Live Smoke</b>',
    '',
    `Bot: @${me.username || me.first_name}`,
    '',
    'Manual tap path:',
    '1. Tap Open Transferly',
    '2. Confirm the Telegram Mini App opens on the home/dashboard page',
    '3. Return to Telegram and tap Account',
    '4. Tap Notifications and confirm concise notification guidance is shown',
    '5. Tap Settings and confirm it points back to the Mini App',
    '6. Tap Help and confirm it returns to the focused control menu',
    '',
    'Telegram does not let a bot click its own inline buttons, so this smoke script verifies token/chat delivery and sends minimal operator tap-through buttons.',
  ].join('\n');
  const inlineKeyboard = [
    [
      dashboardUrl
        ? { text: '🚀 Open Transferly', web_app: { url: dashboardUrl } }
        : { text: '🚀 Open Transferly', callback_data: callback('APP') },
    ],
    [
      { text: '👤 Account', callback_data: callback('ACCOUNT') },
      { text: '🔔 Notifications', callback_data: callback('NOTIFICATIONS') },
    ],
    [
      { text: '⚙️ Settings', callback_data: callback('SETTINGS') },
      { text: '❓ Help', callback_data: callback('HELP') },
    ],
  ];

  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
  };

  if (dryRun) {
    console.log(JSON.stringify({
      ok: true,
      dry_run: true,
      payload,
    }, null, 2));
    return;
  }

  const result = await apiRequest('sendMessage', payload);

  console.log(JSON.stringify({
    ok: true,
    bot: me.username || me.first_name,
    chat_id: chatId,
    message_id: result.message_id,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
