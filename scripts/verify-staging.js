const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const strict = process.env.STAGING_STRICT === 'true' || process.env.NODE_ENV === 'staging';
const checks = [];

function addCheck(name, pass, detail, level = 'fail') {
  checks.push({ name, pass, detail, level });
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch (_error) {
    return false;
  }
}

function origin(value) {
  try {
    return new URL(value).origin;
  } catch (_error) {
    return '';
  }
}

function envExampleHas(relativePath, key) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return false;
  }
  return new RegExp(`^${key}=`, 'm').test(fs.readFileSync(absolutePath, 'utf8'));
}

[
  ['api/.env.example', 'APP_BASE_URL'],
  ['api/.env.example', 'FRONTEND_URL'],
  ['api/.env.example', 'CORS_ALLOWED_ORIGINS'],
  ['api/.env.example', 'TELEGRAM_MINI_APP_URL'],
  ['bot/.env.example', 'BOT_UPDATE_MODE'],
  ['bot/.env.example', 'BOT_WEBHOOK_URL'],
  ['bot/.env.example', 'BOT_WEBHOOK_SECRET'],
  ['miniapp/.env.example', 'VITE_API_BASE_URL']
].forEach(([file, key]) => {
  addCheck(`${file} documents ${key}`, envExampleHas(file, key), `${key} should be documented before staging deploys.`);
});

const requiredEnv = [
  'APP_BASE_URL',
  'FRONTEND_URL',
  'VITE_API_BASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'CORS_ALLOWED_ORIGINS',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_MINI_APP_URL',
  'BOT_TOKEN',
  'API_URL',
  'MINI_APP_URL',
  'BOT_UPDATE_MODE'
];

requiredEnv.forEach((key) => {
  addCheck(
    `staging env ${key}`,
    Boolean(process.env[key]) || !strict,
    strict ? `${key} must be set for staging validation.` : 'Skipped until STAGING_STRICT=true or NODE_ENV=staging.',
    strict ? 'fail' : 'warn'
  );
});

[
  'APP_BASE_URL',
  'FRONTEND_URL',
  'VITE_API_BASE_URL',
  'TELEGRAM_MINI_APP_URL',
  'BOT_WEBHOOK_URL',
  'API_URL',
  'MINI_APP_URL'
].forEach((key) => {
  if (process.env[key]) {
    addCheck(`staging ${key} uses HTTPS`, isHttpsUrl(process.env[key]), 'Telegram Mini App and webhook staging URLs should use TLS.');
  }
});

if (process.env.FRONTEND_URL && process.env.CORS_ALLOWED_ORIGINS) {
  const frontendOrigin = origin(process.env.FRONTEND_URL);
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS.split(',').map((entry) => entry.trim());
  addCheck(
    'staging CORS includes frontend origin',
    allowedOrigins.includes(frontendOrigin),
    'CORS_ALLOWED_ORIGINS must include FRONTEND_URL origin.'
  );
}

if (process.env.TELEGRAM_MINI_APP_URL && process.env.MINI_APP_URL) {
  addCheck(
    'staging bot and API Mini App URLs match',
    process.env.TELEGRAM_MINI_APP_URL === process.env.MINI_APP_URL,
    'Use one canonical Mini App URL for API auth, bot launch buttons, and Telegram configuration.',
    'warn'
  );
}

if (process.env.BOT_UPDATE_MODE) {
  const updateMode = process.env.BOT_UPDATE_MODE.toLowerCase();
  addCheck(
    'staging bot update mode is valid',
    updateMode === 'webhook' || updateMode === 'polling',
    'BOT_UPDATE_MODE must be webhook or polling.'
  );
  if (updateMode === 'webhook') {
    addCheck('staging webhook URL set', Boolean(process.env.BOT_WEBHOOK_URL), 'BOT_WEBHOOK_URL is required in webhook mode.');
    addCheck('staging webhook secret set', Boolean(process.env.BOT_WEBHOOK_SECRET), 'BOT_WEBHOOK_SECRET is required in webhook mode.');
  }
}

const failed = checks.filter((check) => !check.pass && check.level !== 'warn');
const warnings = checks.filter((check) => !check.pass && check.level === 'warn');

checks.forEach((check) => {
  const marker = check.pass ? 'OK' : check.level === 'warn' ? 'WARN' : 'FAIL';
  console.log(`${marker} ${check.name} - ${check.detail}`);
});

if (warnings.length > 0) {
  console.error(`Staging readiness warnings: ${warnings.length} check(s) should be reviewed.`);
}

if (failed.length > 0) {
  console.error(`Staging readiness failed: ${failed.length} check(s) did not pass.`);
  process.exitCode = 1;
}
