const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');

const {
  AVAILABLE_SERVICE_STATUSES,
  SANDBOX_REQUIRED_MARKINGS,
  SERVICE_CATALOGUE_SEED,
  SERVICE_STATUS_VALUES
} = require('../constants/serviceCatalogue');

async function loadMiniAppContract() {
  const contractPath = path.resolve(__dirname, '../../miniapp/src/lib/serviceCatalogueContract.js');
  return import(pathToFileURL(contractPath).href);
}

test('Mini App catalogue policy stays aligned with the API manifest', async () => {
  const client = await loadMiniAppContract();
  const serverPolicy = SERVICE_CATALOGUE_SEED.map(({ slug, title, category, badge, status }) => ({
    slug,
    title,
    category,
    badge,
    status
  }));

  assert.deepEqual(client.SERVICE_STATUS_VALUES, SERVICE_STATUS_VALUES);
  assert.deepEqual(client.AVAILABLE_SERVICE_STATUSES, AVAILABLE_SERVICE_STATUSES);
  assert.deepEqual(client.SANDBOX_REQUIRED_MARKINGS, SANDBOX_REQUIRED_MARKINGS);
  assert.deepEqual(client.SERVICE_CATALOGUE_POLICY, serverPolicy);
});

test('unsafe legacy generators stay unavailable in the API and Mini App policies', async () => {
  const client = await loadMiniAppContract();
  const unsafeSlugs = new Set([
    'opay',
    'kuda',
    'palmpay',
    'binance',
    'bybit',
    'coinbase',
    'crypto-com',
    'cash-app',
    'zelle',
    'venmo',
    'trust-wallet',
    'gcash',
    'pass-clone',
    'link-shortener'
  ]);

  for (const service of SERVICE_CATALOGUE_SEED.filter(({ slug }) => unsafeSlugs.has(slug))) {
    assert.equal(service.status, 'disabled', `${service.slug} must remain disabled in the API`);
  }

  for (const service of client.SERVICE_CATALOGUE_POLICY.filter(({ slug }) => unsafeSlugs.has(slug))) {
    assert.equal(client.isServiceAvailable(service), false, `${service.slug} must remain unavailable in the Mini App`);
  }
});
