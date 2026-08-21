'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

// ---------------------------------------------------------------------------
// ProviderConfig
// ---------------------------------------------------------------------------

describe('providerConfig', () => {
  const { getProviderConfig, isProviderConfigured, listProviderConfigs } = require('../providerConfig');

  it('returns a config object for every known provider', () => {
    const keys = ['paypal', 'stripe', 'wise', 'paystack', 'flutterwave', 'crypto', 'binance', 'cashapp'];
    for (const key of keys) {
      const cfg = getProviderConfig(key);
      assert.equal(typeof cfg, 'object', `${key}: config should be object`);
      assert.equal(typeof cfg.configured, 'boolean', `${key}: configured should be boolean`);
      assert.ok(Array.isArray(cfg.missingKeys), `${key}: missingKeys should be array`);
    }
  });

  it('throws for an unknown provider key', () => {
    assert.throws(() => getProviderConfig('nonexistent'), /Unknown provider key/);
  });

  it('isProviderConfigured returns boolean', () => {
    const result = isProviderConfigured('stripe');
    assert.equal(typeof result, 'boolean');
  });

  it('isProviderConfigured returns false for unknown key', () => {
    assert.equal(isProviderConfigured('unknown'), false);
  });

  it('listProviderConfigs returns every registered configuration shape', () => {
    const list = listProviderConfigs();
    assert.ok(Array.isArray(list));
    assert.deepEqual(
      list.map((entry) => entry.key),
      ['paypal', 'stripe', 'wise', 'paystack', 'flutterwave', 'crypto', 'binance', 'cashapp']
    );
    for (const entry of list) {
      assert.ok(entry.key, 'entry should have key');
      assert.equal(typeof entry.configured, 'boolean');
      assert.ok(Array.isArray(entry.missingKeys));
    }
  });

  it('paypal config has the expected shape', () => {
    const cfg = getProviderConfig('paypal');
    assert.ok('clientId' in cfg);
    assert.ok('clientSecret' in cfg);
    assert.ok('webhookId' in cfg);
    assert.ok('environment' in cfg);
    assert.ok('baseUrl' in cfg);
    assert.ok(cfg.baseUrl.startsWith('https://'));
  });

  it('stripe config has the expected shape', () => {
    const cfg = getProviderConfig('stripe');
    assert.ok('secretKey' in cfg);
    assert.ok('apiVersion' in cfg);
    assert.ok('baseUrl' in cfg);
  });

  it('wise config has the expected shape', () => {
    const cfg = getProviderConfig('wise');
    assert.ok('apiToken' in cfg);
    assert.ok('profileId' in cfg);
  });
});

// ---------------------------------------------------------------------------
// ProviderSDK barrel exports
// ---------------------------------------------------------------------------

describe('providerSDK', () => {
  const sdk = require('../providerSDK');

  it('exports ProviderSDK aggregate object', () => {
    assert.ok(sdk.ProviderSDK, 'ProviderSDK should be exported');
    assert.ok(sdk.ProviderSDK.config);
    assert.ok(sdk.ProviderSDK.registry);
    assert.ok(typeof sdk.ProviderSDK.createProviderAdapter === 'function');
    assert.ok(typeof sdk.ProviderSDK.createProviderWorkspaceModule === 'function');
  });

  it('exports named utilities directly', () => {
    assert.ok(sdk.BaseProvider);
    assert.ok(sdk.providerModuleRegistry);
    assert.ok(typeof sdk.getProviderConfig === 'function');
    assert.ok(typeof sdk.isProviderConfigured === 'function');
    assert.ok(typeof sdk.listProviderConfigs === 'function');
    assert.ok(typeof sdk.normalizeProviderKey === 'function');
  });
});

// ---------------------------------------------------------------------------
// BaseProvider
// ---------------------------------------------------------------------------

describe('BaseProvider', () => {
  const BaseProvider = require('../../base-provider');

  it('constructs with id and name', () => {
    const p = new BaseProvider({ id: 'test', name: 'Test' });
    assert.equal(p.id, 'test');
    assert.equal(p.name, 'Test');
  });

  it('throws without id', () => {
    assert.throws(() => new BaseProvider({ name: 'Test' }), /requires id and name/);
  });

  it('throws without name', () => {
    assert.throws(() => new BaseProvider({ id: 'test' }), /requires id and name/);
  });

  it('getConfig returns object with configured boolean for known provider', () => {
    const p = new BaseProvider({ id: 'stripe', name: 'Stripe' });
    const cfg = p.getConfig();
    assert.equal(typeof cfg.configured, 'boolean');
  });

  it('isConfigured returns boolean for known provider', () => {
    const p = new BaseProvider({ id: 'paypal', name: 'PayPal' });
    assert.equal(typeof p.isConfigured(), 'boolean');
  });

  it('getHealth returns an object with provider key', async () => {
    const p = new BaseProvider({ id: 'stripe', name: 'Stripe' });
    const h = await p.getHealth();
    assert.equal(h.provider, 'stripe');
    assert.ok('status' in h);
    assert.ok('configured' in h);
  });

  it('createClient throws not-implemented error', () => {
    const p = new BaseProvider({ id: 'test', name: 'Test' });
    assert.throws(() => p.createClient(), /not implemented/);
  });

  it('fetchTransactions throws AppError', async () => {
    const p = new BaseProvider({ id: 'test', name: 'Test' });
    await assert.rejects(() => p.fetchTransactions(), { code: 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED' });
  });

  it('validate passes valid data through', () => {
    const { z } = require('zod');
    const p = new BaseProvider({ id: 'test', name: 'Test' });
    const schema = z.object({ amount: z.number().positive() });
    const result = p.validate({ amount: 100 }, schema);
    assert.equal(result.amount, 100);
  });

  it('validate throws AppError on invalid data', () => {
    const { z } = require('zod');
    const p = new BaseProvider({ id: 'test', name: 'Test' });
    const schema = z.object({ amount: z.number().positive() });
    assert.throws(
      () => p.validate({ amount: -5 }, schema),
      { code: 'PROVIDER_VALIDATION_ERROR' }
    );
  });

  it('config override merges over base config', () => {
    const p = new BaseProvider({ id: 'stripe', name: 'Stripe', config: { secretKey: 'override-key' } });
    const cfg = p.getConfig();
    assert.equal(cfg.secretKey, 'override-key');
  });
});

// ---------------------------------------------------------------------------
// ProviderModuleRegistry
// ---------------------------------------------------------------------------

describe('ProviderModuleRegistry', () => {
  const { ProviderModuleRegistry, discoverProviderModules, normalizeProviderKey } = require('../../moduleRegistry');

  it('normalizeProviderKey lowercases and trims', () => {
    assert.equal(normalizeProviderKey('  PayPal '), 'paypal');
    assert.equal(normalizeProviderKey('STRIPE'), 'stripe');
  });

  it('discoverProviderModules returns all 6 providers', () => {
    const modules = discoverProviderModules();
    assert.ok(modules.length >= 6, `expected >= 6 modules, got ${modules.length}`);
    const keys = modules.map((m) => m.key);
    assert.ok(keys.includes('paypal'));
    assert.ok(keys.includes('stripe'));
    assert.ok(keys.includes('wise'));
    assert.ok(keys.includes('paystack'));
    assert.ok(keys.includes('flutterwave'));
    assert.ok(keys.includes('crypto'));
  });

  it('each discovered module has key, adapter, and getContract', () => {
    const modules = discoverProviderModules();
    for (const mod of modules) {
      assert.ok(mod.key, `module should have key`);
      assert.ok(mod.adapter, `${mod.key}: should have adapter`);
      assert.equal(typeof mod.getContract, 'function', `${mod.key}: getContract should be function`);
    }
  });

  it('registry list() returns enabled providers', () => {
    const registry = new ProviderModuleRegistry({ enabledKeys: ['paypal', 'stripe'] });
    const list = registry.list();
    assert.equal(list.length, 2);
    assert.ok(list.some((m) => m.key === 'paypal'));
    assert.ok(list.some((m) => m.key === 'stripe'));
  });

  it('registry list({ includeDisabled: true }) returns all registered providers', () => {
    const registry = new ProviderModuleRegistry({ enabledKeys: ['paypal'] });
    const all = registry.list({ includeDisabled: true });
    assert.ok(all.length >= 6);
  });

  it('registry get() returns a module for enabled provider', () => {
    const registry = new ProviderModuleRegistry({ enabledKeys: ['paypal'] });
    const mod = registry.get('paypal');
    assert.equal(mod.key, 'paypal');
  });

  it('registry get() throws for disabled provider', () => {
    const registry = new ProviderModuleRegistry({ enabledKeys: ['paypal'] });
    assert.throws(() => registry.get('stripe'), { code: 'PAYMENT_PROVIDER_NOT_FOUND' });
  });

  it('registry get() throws for unknown provider', () => {
    const registry = new ProviderModuleRegistry({});
    assert.throws(() => registry.get('nonexistent'), { code: 'PAYMENT_PROVIDER_NOT_FOUND' });
  });

  it('isEnabled returns true for enabled provider', () => {
    const registry = new ProviderModuleRegistry({ enabledKeys: ['stripe'] });
    assert.equal(registry.isEnabled('stripe'), true);
    assert.equal(registry.isEnabled('paypal'), false);
  });

  it('registry throws if provider is registered twice', () => {
    const modules = discoverProviderModules();
    const doubled = [...modules, modules[0]]; // duplicate paypal
    assert.throws(() => new ProviderModuleRegistry({ modules: doubled }), /registered twice/);
  });
});

// ---------------------------------------------------------------------------
// createProviderWorkspaceModule
// ---------------------------------------------------------------------------

describe('createProviderWorkspaceModule', () => {
  const { createProviderWorkspaceModule } = require('../createProviderWorkspaceModule');
  const { createProviderAdapter } = require('../../../adapters/paymentProviders/baseProviderAdapter');

  function makeAdapter(key) {
    return createProviderAdapter({
      key,
      displayName: key,
      requiredEnv: [],
      capabilities: {},
      supportedOperations: []
    });
  }

  it('returns frozen object with key, adapter, getContract, getReadiness', () => {
    const adapter = makeAdapter('test-provider');
    const mod = createProviderWorkspaceModule({ key: 'test-provider', adapter });
    assert.equal(mod.key, 'test-provider');
    assert.ok(typeof mod.getContract === 'function');
    assert.ok(typeof mod.getReadiness === 'function');
    assert.ok(Object.isFrozen(mod));
  });

  it('getContract returns an object with provider key', () => {
    const adapter = makeAdapter('my-provider');
    const mod = createProviderWorkspaceModule({ key: 'my-provider', adapter });
    const contract = mod.getContract();
    assert.equal(contract.provider, 'my-provider');
  });

  it('getReadiness returns configured/missing_env', () => {
    const adapter = makeAdapter('my-provider');
    const mod = createProviderWorkspaceModule({ key: 'my-provider', adapter });
    const readiness = mod.getReadiness();
    assert.ok('configured' in readiness);
    assert.ok(Array.isArray(readiness.missing_env));
  });

  it('throws if key is missing', () => {
    const adapter = makeAdapter('x');
    assert.throws(() => createProviderWorkspaceModule({ adapter }), /requires a key/);
  });

  it('throws if adapter has no getAdapterContract', () => {
    assert.throws(
      () => createProviderWorkspaceModule({ key: 'x', adapter: {} }),
      /requires an adapter contract/
    );
  });
});

// ---------------------------------------------------------------------------
// Per-provider getContract contracts
// ---------------------------------------------------------------------------

describe('per-provider getContract()', () => {
  const providers = ['paypal', 'stripe', 'wise', 'paystack', 'flutterwave', 'crypto', 'binance', 'cashapp'];

  for (const key of providers) {
    it(`${key}: getContract() returns provider key and operations map`, () => {
      const mod = require(`../../${key}`);
      assert.equal(typeof mod.getContract, 'function', `${key}: missing getContract`);
      const contract = mod.getContract();
      assert.equal(contract.provider, key, `${key}: contract.provider mismatch`);
      assert.ok(contract.operations && typeof contract.operations === 'object', `${key}: missing operations`);
    });

    it(`${key}: getReadiness() returns status string`, () => {
      const mod = require(`../../${key}`);
      const readiness = mod.getReadiness();
      assert.ok(readiness.status, `${key}: readiness should have status`);
    });
  }
});

// ---------------------------------------------------------------------------
// mountProviderRoutes helper
// ---------------------------------------------------------------------------

describe('mountPerProviderRoutes', () => {
  const { buildPerProviderRouters } = require('../mountProviderRoutes');

  it('returns providerRouters and webhookRouters arrays', () => {
    const { providerRouters, webhookRouters } = buildPerProviderRouters();
    assert.ok(Array.isArray(providerRouters));
    assert.ok(Array.isArray(webhookRouters));
  });

  it('each entry has a string prefix and a router function', () => {
    const { providerRouters, webhookRouters } = buildPerProviderRouters();
    for (const entry of [...providerRouters, ...webhookRouters]) {
      assert.ok(typeof entry.prefix === 'string', 'prefix should be string');
      assert.ok(typeof entry.router === 'function', 'router should be a function (Express router)');
    }
  });

  it('provider routes are prefixed with /api/providers/<key>', () => {
    const { providerRouters } = buildPerProviderRouters();
    for (const entry of providerRouters) {
      assert.ok(entry.prefix.startsWith('/api/providers/'), `unexpected prefix: ${entry.prefix}`);
    }
  });

  it('provider routes can be exposed under versioned API prefixes', () => {
    const { providerRouters, webhookRouters } = buildPerProviderRouters({ apiPrefixes: ['/api', '/api/v1'] });
    const prefixes = new Set(providerRouters.map((entry) => entry.prefix));

    assert.ok([...prefixes].some((prefix) => prefix.startsWith('/api/providers/')));
    assert.ok([...prefixes].some((prefix) => prefix.startsWith('/api/v1/providers/')));
    assert.equal(webhookRouters.every((entry) => entry.prefix.startsWith('/webhooks/')), true);
  });

  it('webhook routes are prefixed with /webhooks/<key>', () => {
    const { webhookRouters } = buildPerProviderRouters();
    for (const entry of webhookRouters) {
      assert.ok(entry.prefix.startsWith('/webhooks/'), `unexpected prefix: ${entry.prefix}`);
    }
  });
});
