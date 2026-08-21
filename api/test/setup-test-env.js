const path = require('path');
const fs = require('fs');

// Load optional .env.test located at repo root or api/
const candidates = [path.resolve(process.cwd(), '.env.test'), path.resolve(__dirname, '..', '.env.test')];
for (const p of candidates) {
  if (fs.existsSync(p)) {
    require('dotenv').config({ path: p });
    break;
  }
}

const defaults = {
  PAYPAL_CLIENT_ID: 'paypal-test-client',
  PAYPAL_CLIENT_SECRET: 'paypal-test-secret',
  PAYPAL_WEBHOOK_ID: 'paypal-webhook-id',
  JWT_SECRET: 'test-jwt-secret-value',
  REDIS_URL: 'redis://127.0.0.1:6379',
  SQLITE_DATABASE_PATH: './data/test.sqlite',
  ADMIN_API_TOKEN: 'admin-test-token',
  TRANSFERLY_OWNER_TELEGRAM_USER_IDS: '9001003',
  TRANSFERLY_ADMIN_TELEGRAM_USER_IDS: '9001004'
};

Object.keys(defaults).forEach((k) => {
  if (!process.env[k]) process.env[k] = defaults[k];
});

// Provide a simple debug print when running tests locally (only in non-CI)
if (!process.env.CI) {
  console.log('Test env variables loaded from setup-test-env:', Object.keys(defaults).filter(k => process.env[k] === defaults[k]));
}
