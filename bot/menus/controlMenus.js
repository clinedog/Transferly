'use strict';

const CONTROL_ACTIONS = Object.freeze({
  APP: 'APP',
  ACCOUNT: 'ACCOUNT',
  NOTIFICATIONS: 'NOTIFICATIONS',
  SETTINGS: 'SETTINGS',
  HELP: 'HELP'
});

const CONTROL_LABELS = Object.freeze({
  app: '🚀 Open Transferly',
  buyPoints: '💰 Buy Points',
  services: '🧰 Services',
  orders: '📦 Orders',
  wallet: '👛 Wallet',
  support: '❓ Support',
  account: '👤 Account',
  notifications: '🔔 Notifications',
  settings: '⚙️ Settings',
  help: '❓ Help'
});

const CONTROL_COMMANDS = Object.freeze([
  { command: 'start', description: 'Open Transferly control menu' },
  { command: 'app', description: 'Open the Transferly Mini App' },
  { command: 'account', description: 'Show account access status' },
  { command: 'notifications', description: 'Show notification preferences' },
  { command: 'settings', description: 'Show bot and Mini App settings' },
  { command: 'help', description: 'Get help using Transferly' }
]);

function buildPrimaryControlRows() {
  return [
    [{ type: 'miniapp', label: CONTROL_LABELS.app, section: 'dashboard' }],
    [
      { type: 'callback', label: CONTROL_LABELS.account, action: CONTROL_ACTIONS.ACCOUNT },
      { type: 'callback', label: CONTROL_LABELS.notifications, action: CONTROL_ACTIONS.NOTIFICATIONS }
    ],
    [
      { type: 'callback', label: CONTROL_LABELS.settings, action: CONTROL_ACTIONS.SETTINGS },
      { type: 'callback', label: CONTROL_LABELS.help, action: CONTROL_ACTIONS.HELP }
    ]
  ];
}

function buildStartControlRows() {
  return [
    [{ type: 'miniapp', label: CONTROL_LABELS.app, section: 'dashboard' }],
    [
      { type: 'miniapp', label: CONTROL_LABELS.buyPoints, section: 'wallet' },
      { type: 'miniapp', label: CONTROL_LABELS.services, section: 'services' }
    ],
    [
      { type: 'miniapp', label: CONTROL_LABELS.orders, section: 'orders' },
      { type: 'miniapp', label: CONTROL_LABELS.wallet, section: 'wallet' }
    ],
    [
      { type: 'miniapp', label: CONTROL_LABELS.support, section: 'support' }
    ]
  ];
}

function applyControlRows(keyboard, rows, helpers = {}) {
  const { buildCallbackData, buildMiniAppButton, ctx } = helpers;

  for (const row of rows) {
    const buttons = row
      .map((item) => {
        if (item.type === 'miniapp') {
          return buildMiniAppButton?.(item.label, item.section);
        }
        if (item.type === 'callback') {
          return {
            text: item.label,
            callback_data: buildCallbackData(ctx, item.action)
          };
        }
        if (item.type === 'url') {
          return { text: item.label, url: item.url };
        }
        return null;
      })
      .filter(Boolean);

    if (buttons.length > 0) {
      keyboard.inline_keyboard.push(buttons);
    }
  }

  return keyboard;
}

module.exports = {
  CONTROL_ACTIONS,
  CONTROL_COMMANDS,
  CONTROL_LABELS,
  applyControlRows,
  buildPrimaryControlRows,
  buildStartControlRows
};