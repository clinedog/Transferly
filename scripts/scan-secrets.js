const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const ignoredDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'data',
  '.cache',
  'playwright-report',
  'test-results'
]);
const ignoredFiles = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  '.env',
  '.env.local',
  '.env.development.local',
  '.env.test.local',
  '.env.production.local',
  '.env.example'
]);
const ignoredExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.pdf',
  '.sqlite',
  '.db',
  '.snap'
]);
const allowedTestLiterals = [
  'change-me',
  'replace-with-a-long-random-secret',
  'replace-with-a-long-random-admin-token',
  'replace-with-a-long-random-webhook-secret',
  'your-paypal-sandbox-client-id',
  'your-paypal-sandbox-client-secret',
  'your-paypal-webhook-id',
  'admin-secret-token',
  'paypal-client-secret',
  'paypal-client-id',
  'sk_test_transferly',
  'whsec_transferly',
  'crypto-commerce-key',
  'crypto-commerce-webhook-secret',
  '1234567890:test-mini-app-token',
  'newstrongpassword456',
  'paypal-test-access-token',
  'whsec_provider_dashboard_test',
  'test-jwt-secret-value',
  'sk_test_paystack_transferly',
  'paystack-webhook-secret-transferly',
  'flw-webhook-secret-transferly',
  'wise-api-token-transferly',
  'default-pricing-secret',
  'payment-matching-secret',
  'opay_webhook_secret_for_tests_123456',
  'points-funding-secret',
  'points-reconciliation-secret',
  'jwt-secret-1234-1234-1234-1234',
  'payout-reconciliation-secret'
];

const patterns = [
  {
    name: 'private key block',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----/
  },
  {
    name: 'hardcoded secret assignment',
    pattern: /\b[A-Z0-9_]*(?:SECRET|TOKEN|API_KEY|PRIVATE_KEY|CLIENT_SECRET|PASSWORD)\b\s*[:=]\s*['"]([^'"\n]{20,})['"]/i
  },
  {
    name: 'bearer token literal',
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{24,}/
  }
];

function shouldIgnore(relativePath) {
  const parts = relativePath.split(path.sep);
  if (parts.some((part) => ignoredDirectories.has(part))) {
    return true;
  }
  if (ignoredFiles.has(path.basename(relativePath))) {
    return true;
  }
  return ignoredExtensions.has(path.extname(relativePath).toLowerCase());
}

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(rootDir, absolutePath);

    if (shouldIgnore(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      walk(absolutePath, files);
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

function isAllowedMatch(match) {
  return allowedTestLiterals.some((literal) => match.includes(literal));
}

const findings = [];

for (const filePath of walk(rootDir)) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (_error) {
    continue;
  }

  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const { name, pattern } of patterns) {
      const match = line.match(pattern);
      if (match && !isAllowedMatch(line)) {
        findings.push({
          file: path.relative(rootDir, filePath),
          line: index + 1,
          name
        });
      }
    }
  });
}

if (findings.length === 0) {
  console.log('OK secret scan found no high-confidence committed secret patterns.');
} else {
  findings.forEach((finding) => {
    console.log(`FAIL ${finding.file}:${finding.line} ${finding.name}`);
  });
  console.error(`Secret scan failed: ${findings.length} high-confidence finding(s).`);
  process.exitCode = 1;
}
