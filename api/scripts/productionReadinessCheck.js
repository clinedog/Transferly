'use strict';

/**
 * Production Readiness Check for Transferly
 * Validates all critical systems before launch.
 */

const path = require('node:path');
const fs = require('node:fs');

const repoRoot = path.resolve(__dirname, '../..');

const checks = [];
let passCount = 0;
let failCount = 0;
let warnCount = 0;

function addCheck(name, status, details = '') {
  checks.push({ name, status, details });
  if (status === 'PASS') passCount++;
  else if (status === 'FAIL') failCount++;
  else if (status === 'WARN') warnCount++;
}

// 1. Check required files exist
const requiredFiles = [
  'api/package.json', 'bot/package.json', 'miniapp/package.json',
  'api/db/schema.sql', 'api/config.js',
  'api/routes/index.js', 'api/routes/adminRoutes.js',
  'api/core/observability/httpObservability.js',
  'api/middleware/requireIdempotencyKey.js',
  'api/middleware/requireAdminActor.js',
  'api/controllers/webhookController.js',
  'api/controllers/adminController.js',
  'api/services/paymentReconciliationService.js',
  'api/services/pointLedgerService.js',
  'api/services/pointsFundingService.js',
  'api/repositories/idempotencyRepository.js',
  'api/repositories/apiKeyRepository.js',
  'api/services/apiKeyService.js',
  'api/services/sessionManagementService.js',
  'api/repositories/providerIncidentRepository.js',
  'api/repositories/automationRuleRepository.js',
  'api/services/automationRuleService.js',
  'api/services/automationDispatchService.js',
  'api/scripts/backupRestoreCheck.js',
  'api/test/backupRestoreCheck.test.js',
  'api/test/tenantFinancialIsolation.test.js',
  'api/core/financial/providerExecution.js',
  'api/test/providerExecution.test.js',
  'api/test/requireIdempotencyKey.test.js',
  'api/repositories/automationExecutionRepository.js',
  'api/repositories/organizationRepository.js',
  'api/services/organizationService.js',
  'api/middleware/requireApiKeyScope.js',
  'api/jobs/worker.js',
];

for (const f of requiredFiles) {
  const exists = fs.existsSync(path.join(repoRoot, f));
  addCheck(`File exists: ${f}`, exists ? 'PASS' : 'FAIL', exists ? 'OK' : 'MISSING');
}

// 2. Check package scripts
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'api/package.json'), 'utf8'));
const scripts = ['start', 'test', 'lint', 'db:migrate', 'backup', 'backup:verify', 'backup:prune', 'smoke:providers', 'smoke:readiness', 'verify:paypal:sandbox'];
for (const s of scripts) {
  addCheck(`API script: ${s}`, pkg.scripts[s] ? 'PASS' : 'FAIL', pkg.scripts[s] || 'MISSING');
}

const botPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'bot/package.json'), 'utf8'));
addCheck('Bot tests script', botPkg.scripts.test ? 'PASS' : 'FAIL', botPkg.scripts.test || 'MISSING');

const miniPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'miniapp/package.json'), 'utf8'));
addCheck('MiniApp build script', miniPkg.scripts.build ? 'PASS' : 'FAIL', miniPkg.scripts.build || 'MISSING');
addCheck('MiniApp e2e tests script', miniPkg.scripts['test:e2e'] ? 'PASS' : 'FAIL', miniPkg.scripts['test:e2e'] || 'MISSING');

// 3. Check schema.sql has constraints
const schema = fs.readFileSync(path.join(repoRoot, 'api/db/schema.sql'), 'utf8');
addCheck('Schema has foreign keys', schema.includes('PRAGMA foreign_keys = ON') ? 'PASS' : 'FAIL', 'foreign_keys pragma');
addCheck('Schema has UNIQUE constraints', (schema.match(/UNIQUE/g) || []).length > 0 ? 'PASS' : 'FAIL', `found ${(schema.match(/UNIQUE/g) || []).length} UNIQUE`);
addCheck('Schema has CHECK constraints', (schema.match(/CHECK\s*\(/g) || []).length > 0 ? 'PASS' : 'FAIL', `found ${(schema.match(/CHECK\s*\(/g) || []).length} CHECK`);
addCheck('Schema has indexes', (schema.match(/CREATE INDEX/g) || []).length > 0 ? 'PASS' : 'FAIL', `found ${(schema.match(/CREATE INDEX/g) || []).length} indexes`);
addCheck('Schema has audit tables', schema.includes('audit_logs') ? 'PASS' : 'FAIL', 'audit_logs table');
addCheck('Schema has ledger table', schema.includes('ledger_entries') ? 'PASS' : 'FAIL', 'ledger_entries table');
addCheck('Schema has idempotency table', schema.includes('idempotency_records') ? 'PASS' : 'FAIL', 'idempotency_records table');
addCheck('Schema has webhook_events table', schema.includes('webhook_events') ? 'PASS' : 'FAIL', 'webhook_events table');

// 4. Check config validation
const envFile = path.join(repoRoot, 'api/core/config/environment.js');
const envContent = fs.readFileSync(envFile, 'utf8');
addCheck('Production config validation exists', envContent.includes('validateProductionConfig') ? 'PASS' : 'FAIL', 'validateProductionConfig function');
addCheck('Unsafe secret detection', envContent.includes('isUnsafeSecretValue') ? 'PASS' : 'FAIL', 'isUnsafeSecretValue');
addCheck('Required env checks', envContent.includes('requirePresent') ? 'PASS' : 'FAIL', 'requirePresent');
addCheck('Secret min length checks', envContent.includes('requireSecret') ? 'PASS' : 'FAIL', 'requireSecret');

// 5. Check health endpoints
const kernelFile = path.join(repoRoot, 'api/start/kernel.js');
const kernelContent = fs.readFileSync(kernelFile, 'utf8');
addCheck('Health endpoint /health', kernelContent.includes("app.get('/health'") ? 'PASS' : 'FAIL', '/health route');
addCheck('Health endpoint /api/health', kernelContent.includes("app.get('/api/health'") ? 'PASS' : 'FAIL', '/api/health route');
addCheck('Health endpoint /api/v1/health', kernelContent.includes("app.get('/api/v1/health'") ? 'PASS' : 'FAIL', '/api/v1/health route');
addCheck('Client health endpoint', kernelContent.includes("app.get('/api/health/client'") ? 'PASS' : 'FAIL', '/api/health/client route');
addCheck('OpenAPI endpoint', kernelContent.includes("app.get('/api/v1/openapi.json'") ? 'PASS' : 'FAIL', '/api/v1/openapi.json route');
addCheck('Organization context service', fs.existsSync(path.join(repoRoot, 'api/services/organizationContextService.js')) ? 'PASS' : 'WARN', 'individual workspace compatibility context');
addCheck('Recovery readiness service', fs.existsSync(path.join(repoRoot, 'api/services/recoveryReadinessService.js')) ? 'PASS' : 'WARN', 'backup and restore evidence model');
addCheck('Rate limiting middleware', kernelContent.includes('rateLimit') ? 'PASS' : 'FAIL', 'rateLimit');
addCheck('Helmet security headers', kernelContent.includes('helmet()') ? 'PASS' : 'FAIL', 'helmet');
addCheck('Request timeout middleware', kernelContent.includes('createRequestTimeoutMiddleware') ? 'PASS' : 'FAIL', 'request timeout');

// 6. Check idempotency
const idempKeyFile = path.join(repoRoot, 'api/middleware/requireIdempotencyKey.js');
const idempKeyExists = fs.existsSync(idempKeyFile);
addCheck('Idempotency middleware exists', idempKeyExists ? 'PASS' : 'FAIL', idempKeyExists ? 'requireIdempotencyKey.js' : 'MISSING');

// 7. Check admin authorization
const adminAuthFile = path.join(repoRoot, 'api/middleware/requireAdminActor.js');
const adminAuthExists = fs.existsSync(adminAuthFile);
addCheck('Admin auth middleware exists', adminAuthExists ? 'PASS' : 'FAIL', adminAuthExists ? 'requireAdminActor.js' : 'MISSING');

// 8. Check webhook handling
const webhookController = path.join(repoRoot, 'api/controllers/webhookController.js');
const webhookExists = fs.existsSync(webhookController);
addCheck('Webhook controller exists', webhookExists ? 'PASS' : 'FAIL', webhookExists ? 'webhookController.js' : 'MISSING');

// 9. Check reconciliation
const reconService = path.join(repoRoot, 'api/services/paymentReconciliationService.js');
const reconExists = fs.existsSync(reconService);
addCheck('Reconciliation service exists', reconExists ? 'PASS' : 'FAIL', reconExists ? 'paymentReconciliationService.js' : 'MISSING');

// 10. Check admin routes
const adminRoutes = path.join(repoRoot, 'api/routes/adminRoutes.js');
const adminRoutesContent = fs.readFileSync(adminRoutes, 'utf8');
addCheck('Admin funding approve route', adminRoutesContent.includes('approve') ? 'PASS' : 'FAIL', 'approve endpoint');
addCheck('Admin funding reject route', adminRoutesContent.includes('reject') ? 'PASS' : 'FAIL', 'reject endpoint');
addCheck('Admin reconciliation route', adminRoutesContent.includes('reconciliation') ? 'PASS' : 'FAIL', 'reconciliation endpoint');
addCheck('Admin queue overview route', adminRoutesContent.includes('queue') ? 'PASS' : 'FAIL', 'queue endpoint');
addCheck('Admin adjustments route', adminRoutesContent.includes('adjust') ? 'PASS' : 'FAIL', 'adjust endpoint');

// 11. Check ledger integrity
const ledgerService = path.join(repoRoot, 'api/services/pointLedgerService.js');
const ledgerContent = fs.existsSync(ledgerService) ? fs.readFileSync(ledgerService, 'utf8') : '';
addCheck('Point ledger service exists', fs.existsSync(ledgerService) ? 'PASS' : 'FAIL', ledgerContent ? 'OK' : 'MISSING');
addCheck('Ledger uses transactions', ledgerContent.includes('transaction') ? 'PASS' : 'FAIL', 'transaction usage');
addCheck('Ledger has idempotency key', ledgerContent.includes('entryKey') || ledgerContent.includes('idempotency') ? 'PASS' : 'FAIL', 'idempotency key support');

// 12. Check rate limiting
const configContent = fs.readFileSync(path.join(repoRoot, 'api/config.js'), 'utf8');
addCheck('API rate limit configured', configContent.includes('API_RATE_LIMIT') ? 'PASS' : 'FAIL', 'API_RATE_LIMIT');
addCheck('Auth rate limit configured', configContent.includes('AUTH_RATE_LIMIT') ? 'PASS' : 'FAIL', 'AUTH_RATE_LIMIT');

// 13. Check file upload security
const pointsFundingService = path.join(repoRoot, 'api/services/pointsFundingService.js');
const pfsContent = fs.existsSync(pointsFundingService) ? fs.readFileSync(pointsFundingService, 'utf8') : '';
addCheck('Evidence size limit exists', pfsContent.includes('MAX_EVIDENCE_BYTES') ? 'PASS' : 'FAIL', 'MAX_EVIDENCE_BYTES');
addCheck('Allowed MIME types check', pfsContent.includes('ALLOWED_EVIDENCE_MIME_TYPES') ? 'PASS' : 'FAIL', 'ALLOWED_EVIDENCE_MIME_TYPES');
addCheck('File signature validation', pfsContent.includes('FILE_SIGNATURES') ? 'PASS' : 'FAIL', 'FILE_SIGNATURES');

// 14. Check notifications
const notificationService = path.join(repoRoot, 'api/services/notificationService.js');
addCheck('Notification service exists', fs.existsSync(notificationService) ? 'PASS' : 'FAIL', fs.existsSync(notificationService) ? 'OK' : 'MISSING');

// 15. Check secrets scanning
addCheck('Scan secrets script exists', fs.existsSync(path.join(repoRoot, 'scripts/scan-secrets.js')) ? 'PASS' : 'FAIL', 'scan-secrets.js');
addCheck('Validate skills script exists', fs.existsSync(path.join(repoRoot, 'scripts/validate-skills.js')) ? 'PASS' : 'FAIL', 'validate-skills.js');

// 16. Check dead letter handling
addCheck('Dead letter job handling', fs.existsSync(path.join(repoRoot, 'api/services/deadLetterService.js')) ? 'PASS' : 'FAIL', 'deadLetterService.js');
addCheck('Outbox pattern for events', fs.existsSync(path.join(repoRoot, 'api/services/outboxRecoveryService.js')) ? 'PASS' : 'FAIL', 'outboxRecoveryService.js');

// 17. Check payment provider registry
addCheck('Payment provider registry', fs.existsSync(path.join(repoRoot, 'api/services/paymentProviderRegistry.js')) ? 'PASS' : 'FAIL', 'paymentProviderRegistry.js');
addCheck('Provider health service', fs.existsSync(path.join(repoRoot, 'api/services/providerHealthService.js')) ? 'PASS' : 'FAIL', 'providerHealthService.js');
addCheck('Provider readiness service', fs.existsSync(path.join(repoRoot, 'api/services/providerReadinessService.js')) ? 'PASS' : 'FAIL', 'providerReadinessService.js');
addCheck('Provider status service', fs.existsSync(path.join(repoRoot, 'api/services/providerStatusService.js')) ? 'PASS' : 'FAIL', 'providerStatusService.js');

// Results
const result = {
  status: failCount > 0 ? 'NOT_READY' : (warnCount > 0 ? 'WARN' : 'READY'),
  passed: passCount,
  failed: failCount,
  warnings: warnCount,
  total: passCount + failCount + warnCount,
  checks
};

console.log(JSON.stringify(result, null, 2));
process.exitCode = failCount > 0 ? 1 : 0;
