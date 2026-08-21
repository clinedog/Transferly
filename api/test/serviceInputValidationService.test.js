const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  MAX_INPUT_BYTES,
  createServiceInputValidationService
} = require('../services/serviceInputValidationService');

const validationService = createServiceInputValidationService();

function serviceWithSchema(inputSchema) {
  return {
    id: 'service-1',
    inputSchema
  };
}

test('validates order input against service and non-empty template schemas', () => {
  const input = {
    reference: 'ORDER-100',
    recipient: 'finance@example.test'
  };

  assert.equal(
    validationService.validateOrderInput({
      input,
      service: serviceWithSchema({
        type: 'object',
        required: ['reference'],
        properties: {
          reference: { type: 'string', minLength: 3 }
        }
      }),
      template: {
        inputSchema: {
          type: 'object',
          required: ['recipient'],
          properties: {
            recipient: { type: 'string', format: 'email' }
          }
        }
      }
    }),
    input
  );
});

test('reports bounded, value-free validation issues for invalid input', () => {
  assert.throws(
    () => validationService.validateOrderInput({
      input: { recipient: 'not-an-email' },
      service: serviceWithSchema({
        type: 'object',
        required: ['reference'],
        properties: {
          reference: { type: 'string' }
        }
      })
    }),
    (error) => {
      assert.equal(error.statusCode, 422);
      assert.equal(error.code, 'ORDER_INPUT_INVALID');
      assert.deepEqual(error.details.issues, [{
        schema_scope: 'service',
        path: '/reference',
        keyword: 'required',
        message: "must have required property 'reference'"
      }]);
      assert.equal(JSON.stringify(error.details).includes('not-an-email'), false);
      return true;
    }
  );
});

test('treats legacy empty template schemas as additive no-ops', () => {
  assert.doesNotThrow(() => validationService.validateOrderInput({
    input: { reference: 'ORDER-101' },
    service: serviceWithSchema({
      type: 'object',
      required: ['reference'],
      properties: {
        reference: { type: 'string' }
      }
    }),
    template: { inputSchema: {} }
  }));
});

test('fails closed when a stored service schema is malformed', () => {
  assert.throws(
    () => validationService.validateOrderInput({
      input: {},
      service: serviceWithSchema({ type: 'not-a-json-schema-type' })
    }),
    (error) => {
      assert.equal(error.statusCode, 500);
      assert.equal(error.code, 'SERVICE_INPUT_SCHEMA_INVALID');
      assert.deepEqual(error.details, { schema_scope: 'service' });
      return true;
    }
  );

  assert.throws(
    () => validationService.validateOrderInput({
      input: {},
      service: serviceWithSchema({}),
      template: { inputSchema: [] }
    }),
    (error) => {
      assert.equal(error.statusCode, 500);
      assert.equal(error.code, 'SERVICE_INPUT_SCHEMA_INVALID');
      assert.deepEqual(error.details, { schema_scope: 'template' });
      return true;
    }
  );
});

test('rejects non-object and oversized order input before schema execution', () => {
  assert.throws(
    () => validationService.validateOrderInput({
      input: [],
      service: serviceWithSchema({})
    }),
    (error) => error?.statusCode === 422 && error?.code === 'ORDER_INPUT_INVALID'
  );

  assert.throws(
    () => validationService.validateOrderInput({
      input: { payload: 'x'.repeat(MAX_INPUT_BYTES) },
      service: serviceWithSchema({})
    }),
    (error) => error?.statusCode === 413 && error?.code === 'ORDER_INPUT_TOO_LARGE'
  );
});
