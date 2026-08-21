const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-catalogue-service-'));
process.env.NODE_ENV = 'test';
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'catalogue-service-client';
process.env.PAYPAL_CLIENT_SECRET = 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = 'catalogue-service-webhook';
process.env.SERVICE_FEATURE_FLAGS = 'CATALOGUE_BETA';

const { close } = require('../db');
const { migrate } = require('../db/migrate');
const { SANDBOX_REQUIRED_MARKINGS } = require('../constants/serviceCatalogue');
const { serviceRepository } = require('../repositories/serviceRepository');
const { serviceTemplateRepository } = require('../repositories/serviceTemplateRepository');
const { catalogueService, SANDBOX_WARNING } = require('../services/catalogueService');

const userAuth = Object.freeze({ userId: 'catalogue-user', role: 'USER' });
const adminAuth = Object.freeze({ userId: 'catalogue-admin', role: 'ADMIN' });

async function createService(slug, overrides = {}) {
  return serviceRepository.upsert({
    slug,
    title: overrides.title || slug,
    category: overrides.category || 'catalogue-tests',
    description: overrides.description || `${slug} description`,
    pointPrice: overrides.pointPrice ?? 8,
    status: overrides.status || 'active',
    inputSchema: overrides.inputSchema || { type: 'object' },
    outputType: overrides.outputType || 'application/json',
    configuration: overrides.configuration || { internalSetting: true },
    permissions: overrides.permissions ?? ['authenticated'],
    queueBehavior: overrides.queueBehavior || { attempts: 2 },
    retentionDays: overrides.retentionDays ?? 30,
    executionMode: overrides.executionMode || 'production',
    version: overrides.version || '1',
    featureFlag: overrides.featureFlag ?? null,
    displayOrder: overrides.displayOrder ?? 1000
  });
}

before(async () => {
  await migrate();

  const publicService = await createService('catalogue-public', {
    pointPrice: 8,
    inputSchema: {
      type: 'object',
      required: ['reference'],
      properties: {
        reference: { type: 'string' }
      }
    }
  });

  await serviceTemplateRepository.upsert({
    serviceId: publicService.id,
    templateKey: 'standard',
    title: 'Standard',
    costPoints: '3',
    inputSchema: { type: 'object' },
    rendererConfig: { renderer: 'json-v1' },
    previewAsset: '/assets/catalogue-standard.png',
    version: '2'
  });

  await createService('catalogue-sandbox', {
    status: 'sandbox',
    executionMode: 'sandbox'
  });
  await createService('catalogue-admin', { permissions: ['role:ADMIN'] });
  await createService('catalogue-featured', { featureFlag: 'CATALOGUE_BETA' });
  await createService('catalogue-disabled-feature', { featureFlag: 'CATALOGUE_DISABLED' });
  await createService('catalogue-unknown-role', { permissions: ['role:SUPERADMIN'] });
  await createService('catalogue-unknown-permission', { permissions: ['future:permission'] });
});

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

test('catalogue filters services by authentication, role, feature flag, and known permissions', async () => {
  const anonymousSlugs = new Set(
    (await catalogueService.listServices()).services.map((service) => service.slug)
  );
  const userSlugs = new Set(
    (await catalogueService.listServices({ auth: userAuth })).services.map((service) => service.slug)
  );
  const adminSlugs = new Set(
    (await catalogueService.listServices({ auth: adminAuth })).services.map((service) => service.slug)
  );

  assert.equal(anonymousSlugs.size, 0);
  assert.equal(userSlugs.has('catalogue-public'), true);
  assert.equal(userSlugs.has('catalogue-sandbox'), true);
  assert.equal(userSlugs.has('catalogue-featured'), true);
  assert.equal(userSlugs.has('catalogue-admin'), false);
  assert.equal(userSlugs.has('catalogue-disabled-feature'), false);
  assert.equal(userSlugs.has('catalogue-unknown-role'), false);
  assert.equal(userSlugs.has('catalogue-unknown-permission'), false);
  assert.equal(userSlugs.has('transaction-record'), true);
  assert.equal(userSlugs.has('opay'), false);
  assert.equal(userSlugs.has('pass-clone'), false);
  assert.equal(adminSlugs.has('catalogue-admin'), true);
  assert.equal(adminSlugs.has('catalogue-disabled-feature'), false);
  assert.equal(adminSlugs.has('catalogue-unknown-role'), false);
  assert.equal(adminSlugs.has('catalogue-unknown-permission'), false);
});

test('catalogue detail exposes actor-safe manifest and template fields', async () => {
  const result = await catalogueService.getServiceBySlug('catalogue-public', { auth: userAuth });

  assert.equal(result.service.slug, 'catalogue-public');
  assert.equal(result.service.point_price, 8);
  assert.equal(result.service.availability.available, true);
  assert.deepEqual(result.service.input_schema, {
    type: 'object',
    required: ['reference'],
    properties: {
      reference: { type: 'string' }
    }
  });
  assert.equal(result.service.output_type, 'application/json');
  assert.deepEqual(result.service.permissions, ['authenticated']);
  assert.equal(result.service.execution_mode, 'production');
  assert.equal(result.service.sandbox, false);
  assert.equal(result.service.version, '1');
  assert.equal(Object.hasOwn(result.service, 'configuration'), false);
  assert.equal(Object.hasOwn(result.service, 'queue_behavior'), false);

  assert.equal(result.templates.length, 1);
  assert.equal(result.templates[0].template_key, 'standard');
  assert.equal(result.templates[0].cost_points, 3);
  assert.deepEqual(result.templates[0].input_schema, { type: 'object' });
  assert.deepEqual(result.templates[0].renderer_config, { renderer: 'json-v1' });
  assert.equal(result.templates[0].preview_asset, '/assets/catalogue-standard.png');
  assert.equal(result.templates[0].version, '2');
});

test('sandbox services include an explicit product-safety warning', async () => {
  const result = await catalogueService.getServiceBySlug('catalogue-sandbox', { auth: userAuth });

  assert.equal(result.service.sandbox, true);
  assert.equal(result.service.execution_mode, 'sandbox');
  assert.deepEqual(result.service.warnings, [SANDBOX_WARNING]);
  assert.deepEqual(result.service.required_markings, SANDBOX_REQUIRED_MARKINGS);
  for (const marking of SANDBOX_REQUIRED_MARKINGS) {
    assert.match(SANDBOX_WARNING, new RegExp(marking.replace('/', '\\/')));
  }
});

test('inaccessible service details fail closed as not found', async () => {
  for (const slug of [
    'catalogue-admin',
    'catalogue-disabled-feature',
    'catalogue-unknown-role',
    'catalogue-unknown-permission'
  ]) {
    await assert.rejects(
      catalogueService.getServiceBySlug(slug, { auth: userAuth }),
      (error) => error?.statusCode === 404 && error?.code === 'SERVICE_NOT_FOUND'
    );
  }
});

test('malformed permission storage fails closed', () => {
  assert.equal(
    catalogueService.isServiceAvailableToActor(
      {
        status: 'active',
        featureFlag: null,
        permissions: {}
      },
      userAuth
    ),
    false
  );
});

test('legacy and unknown service statuses fail closed', () => {
  for (const status of ['available', 'comingSoon', 'unknown']) {
    assert.equal(
      catalogueService.isServiceAvailableToActor(
        {
          status,
          featureFlag: null,
          permissions: ['authenticated']
        },
        userAuth
      ),
      false
    );
  }
});
