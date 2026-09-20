const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

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
  'test-results',
  'paypal_mirror'
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
const forbiddenArtifactNames = new Set([
  'cookies.txt',
  'httrack_cookies.txt'
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
  'payout-reconciliation-secret',
  'tl_invite_test_token_123456789'
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

function isForbiddenArtifact(relativePath) {
  const baseName = path.basename(relativePath).toLowerCase();
  return forbiddenArtifactNames.has(baseName)
    || /(?:cookie|session[-_ ]?export|browser[-_ ]?state)/i.test(baseName);
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

function trackedFiles() {
  try {
    return execFileSync('git', ['ls-files', '-z'], {
      cwd: rootDir,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    }).split('\0').filter(Boolean).map((relativePath) => path.join(rootDir, relativePath));
  } catch (error) {
    if (process.env.CI) {
      throw new Error(`Unable to inspect the git index: ${error.message}`);
    }
    return [];
  }
}

function isAllowedMatch(match) {
  return allowedTestLiterals.some((literal) => match.includes(literal));
}

function scanFile(filePath, findings) {
  const relativePath = path.relative(rootDir, filePath);
  if (shouldIgnore(relativePath)) return;

  if (isForbiddenArtifact(relativePath)) {
    findings.push({
      file: relativePath,
      line: 1,
      name: 'browser session artifact'
    });
    return;
  }

  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (_error) {
    return;
  }

  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const { name, pattern } of patterns) {
      const match = line.match(pattern);
      if (match && !isAllowedMatch(line)) {
        findings.push({
          file: relativePath,
          line: index + 1,
          name
        });
      }
    }
  });
}

function scanHistory(findings, commitCount = 50) {
  let commits;
  try {
    commits = execFileSync('git', ['rev-list', `--max-count=${commitCount}`, 'HEAD'], {
      cwd: rootDir,
      encoding: 'utf8'
    }).trim().split(/\s+/).filter(Boolean);
  } catch (error) {
    throw new Error(`Unable to inspect git history: ${error.message}`);
  }

  for (const commit of commits) {
    const names = execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', commit], {
      cwd: rootDir,
      encoding: 'utf8'
    }).split(/\r?\n/).filter(Boolean);
    for (const relativePath of names) {
      let text;
      try {
        text = execFileSync('git', ['show', `${commit}:${relativePath}`], {
          cwd: rootDir,
          encoding: 'utf8',
          maxBuffer: 2 * 1024 * 1024
        });
      } catch (_error) {
        continue;
      }
      text.split(/\r?\n/).forEach((line, index) => {
        for (const { name, pattern } of patterns) {
          if (pattern.test(line) && !isAllowedMatch(line)) {
            findings.push({ file: `${commit}:${relativePath}`, line: index + 1, name: `${name} in history` });
          }
          pattern.lastIndex = 0;
        }
      });
    }
  }
}

function scan({ includeHistory = false, historyCommits = 50 } = {}) {
  const findings = [];
  const files = new Set([...walk(rootDir), ...trackedFiles()]);
  for (const filePath of files) scanFile(filePath, findings);
  if (includeHistory) scanHistory(findings, historyCommits);
  return findings;
}

if (require.main === module) {
  const includeHistory = process.argv.includes('--history');
  const historyArg = process.argv.find((arg) => arg.startsWith('--history-commits='));
  const historyCommits = historyArg ? Number(historyArg.split('=')[1]) : 50;
  const findings = scan({ includeHistory, historyCommits: Number.isFinite(historyCommits) ? historyCommits : 50 });

  if (findings.length === 0) {
    console.log(`OK secret scan found no high-confidence ${includeHistory ? 'working-tree or history ' : ''}secret patterns.`);
  } else {
    findings.forEach((finding) => {
      console.log(`FAIL ${finding.file}:${finding.line} ${finding.name}`);
    });
    console.error(`Secret scan failed: ${findings.length} high-confidence finding(s).`);
    process.exitCode = 1;
  }
}

module.exports = { scan };
