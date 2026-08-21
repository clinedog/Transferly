const { AppError } = require('../utils/errors');
const { ServiceGenerator } = require('./generatorContract');

const GENERATOR_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const GENERATOR_VERSION_PATTERN = /^[a-z0-9][a-z0-9._-]{0,31}$/i;

function normalizeGeneratorKey(value) {
  const key = String(value || '').trim().toLowerCase();
  if (!GENERATOR_KEY_PATTERN.test(key)) {
    throw new AppError(500, 'GENERATOR_KEY_INVALID', 'Generator key is invalid.');
  }

  return key;
}

function normalizeGeneratorVersion(value) {
  const version = String(value || '').trim();
  if (!GENERATOR_VERSION_PATTERN.test(version)) {
    throw new AppError(500, 'GENERATOR_VERSION_INVALID', 'Generator version is invalid.');
  }

  return version;
}

class GeneratorRegistry {
  constructor() {
    this.definitions = new Map();
  }

  register(input) {
    const key = normalizeGeneratorKey(input?.key);
    const version = normalizeGeneratorVersion(input?.version);
    const registryKey = `${key}@${version}`;

    if (typeof input?.Generator !== 'function') {
      throw new AppError(500, 'GENERATOR_CLASS_INVALID', 'Generator registration requires a class.');
    }

    if (this.definitions.has(registryKey)) {
      throw new AppError(500, 'GENERATOR_ALREADY_REGISTERED', 'Generator version is already registered.', {
        generator_key: key,
        generator_version: version
      });
    }

    this.definitions.set(registryKey, Object.freeze({
      key,
      version,
      Generator: input.Generator,
      enabled: input.enabled !== false
    }));

    return this;
  }

  list() {
    return Array.from(this.definitions.values())
      .map(({ key, version, enabled }) => ({ key, version, enabled }))
      .sort((left, right) => `${left.key}@${left.version}`.localeCompare(`${right.key}@${right.version}`));
  }

  resolve(keyValue, versionValue) {
    const key = normalizeGeneratorKey(keyValue);
    const version = normalizeGeneratorVersion(versionValue);
    const definition = this.definitions.get(`${key}@${version}`);

    if (!definition) {
      const availableVersions = this.list()
        .filter((entry) => entry.key === key)
        .map((entry) => entry.version);

      throw new AppError(422, 'GENERATOR_NOT_REGISTERED', 'Requested generator is not registered.', {
        generator_key: key,
        generator_version: version,
        available_versions: availableVersions
      });
    }

    if (!definition.enabled) {
      throw new AppError(503, 'GENERATOR_DISABLED', 'Requested generator is disabled.', {
        generator_key: key,
        generator_version: version
      });
    }

    return definition;
  }

  create(key, version) {
    const definition = this.resolve(key, version);
    const generator = new definition.Generator();

    if (!(generator instanceof ServiceGenerator)) {
      throw new AppError(
        500,
        'GENERATOR_CONTRACT_INVALID',
        'Registered generator must extend ServiceGenerator.',
        {
          generator_key: definition.key,
          generator_version: definition.version
        }
      );
    }

    return generator;
  }
}

const generatorRegistry = new GeneratorRegistry();
const { TransactionRecordGenerator } = require('./transactionRecordGenerator');

generatorRegistry.register({
  key: 'transaction-record',
  version: '1',
  Generator: TransactionRecordGenerator
});

module.exports = {
  GeneratorRegistry,
  generatorRegistry,
  normalizeGeneratorKey,
  normalizeGeneratorVersion
};
