const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const { AppError } = require('../utils/errors');

const MAX_INPUT_BYTES = 256 * 1024;
const MAX_SCHEMA_BYTES = 64 * 1024;
const MAX_VALIDATION_ERRORS = 20;
const MAX_VALIDATOR_CACHE_ENTRIES = 128;

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function serializeBounded(value, maxBytes, errorFactory) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw errorFactory();
  }

  if (serialized === undefined || Buffer.byteLength(serialized, 'utf8') > maxBytes) {
    throw errorFactory();
  }

  return serialized;
}

function normalizeIssuePath(error) {
  const path = String(error.instancePath || '').slice(0, 160);
  if (error.keyword !== 'required') {
    return path || '/';
  }

  const missingProperty = String(error.params?.missingProperty || '')
    .replaceAll('~', '~0')
    .replaceAll('/', '~1')
    .slice(0, 80);

  return missingProperty ? `${path}/${missingProperty}` : (path || '/');
}

function toInputIssues(errors, schemaScope) {
  return (errors || []).slice(0, MAX_VALIDATION_ERRORS).map((error) => ({
    schema_scope: schemaScope,
    path: normalizeIssuePath(error),
    keyword: String(error.keyword || 'validation').slice(0, 80),
    message: String(error.message || 'is invalid').slice(0, 160)
  }));
}

function createServiceInputValidationService(options = {}) {
  const ajv = options.ajv || new Ajv({
    addUsedSchema: false,
    allErrors: true,
    coerceTypes: false,
    removeAdditional: false,
    strict: true,
    useDefaults: false
  });
  if (!options.ajv) {
    addFormats(ajv);
  }

  const validatorCache = new Map();

  function getValidator(schema, schemaScope) {
    if (!isPlainObject(schema)) {
      throw new AppError(
        500,
        'SERVICE_INPUT_SCHEMA_INVALID',
        'Service input validation is unavailable.',
        { schema_scope: schemaScope }
      );
    }

    const serializedSchema = serializeBounded(
      schema,
      MAX_SCHEMA_BYTES,
      () => new AppError(
        500,
        'SERVICE_INPUT_SCHEMA_INVALID',
        'Service input validation is unavailable.',
        { schema_scope: schemaScope }
      )
    );
    const cacheKey = `${schemaScope}:${serializedSchema}`;
    const cached = validatorCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let validator;
    try {
      validator = ajv.compile(schema);
    } catch {
      throw new AppError(
        500,
        'SERVICE_INPUT_SCHEMA_INVALID',
        'Service input validation is unavailable.',
        { schema_scope: schemaScope }
      );
    }

    if (validatorCache.size >= MAX_VALIDATOR_CACHE_ENTRIES) {
      validatorCache.delete(validatorCache.keys().next().value);
    }
    validatorCache.set(cacheKey, validator);
    return validator;
  }

  function validateSchema(input, schema, schemaScope) {
    const validator = getValidator(schema, schemaScope);
    if (validator(input)) {
      return;
    }

    throw new AppError(
      422,
      'ORDER_INPUT_INVALID',
      'Order input does not match the selected service requirements.',
      { issues: toInputIssues(validator.errors, schemaScope) }
    );
  }

  function validateOrderInput(input) {
    if (!isPlainObject(input.input)) {
      throw new AppError(422, 'ORDER_INPUT_INVALID', 'Order input must be a JSON object.');
    }

    serializeBounded(
      input.input,
      MAX_INPUT_BYTES,
      () => new AppError(413, 'ORDER_INPUT_TOO_LARGE', 'Order input exceeds the allowed size.')
    );

    validateSchema(input.input, input.service?.inputSchema, 'service');

    if (input.template) {
      const templateSchema = input.template.inputSchema;
      if (!isPlainObject(templateSchema)) {
        throw new AppError(
          500,
          'SERVICE_INPUT_SCHEMA_INVALID',
          'Service input validation is unavailable.',
          { schema_scope: 'template' }
        );
      }

      if (Object.keys(templateSchema).length > 0) {
        validateSchema(input.input, templateSchema, 'template');
      }
    }

    return input.input;
  }

  return {
    validateOrderInput
  };
}

module.exports = {
  MAX_INPUT_BYTES,
  MAX_SCHEMA_BYTES,
  createServiceInputValidationService,
  serviceInputValidationService: createServiceInputValidationService()
};
