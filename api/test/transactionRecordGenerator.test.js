const assert = require('node:assert/strict');
const { test } = require('node:test');

const { TransactionRecordGenerator } = require('../generators/transactionRecordGenerator');

const context = Object.freeze({
  userId: 'owner-1',
  input: { invoiceId: 'invoice-1' }
});

test('transaction records are generated only from an owned persisted invoice', async () => {
  const generator = new TransactionRecordGenerator({
    invoiceRepository: {
      async findById(id) {
        assert.equal(id, 'invoice-1');
        return {
          id,
          userId: 'owner-1',
          invoiceNumber: 'INV-100',
          paypalInvoiceId: 'provider-invoice-100',
          status: 'PAID',
          amountCents: 1250,
          currencyCode: 'USD',
          issueDate: '2026-07-20T00:00:00.000Z',
          paidAt: '2026-07-21T00:00:00.000Z',
          cancelledAt: null,
          refundedAt: null,
          updatedAt: '2026-07-21T00:00:00.000Z'
        };
      }
    }
  });

  assert.deepEqual(await generator.validate({ invoiceId: ' invoice-1 ' }), { invoiceId: 'invoice-1' });
  assert.deepEqual(await generator.preflight(context), {
    ready: true,
    source: { kind: 'invoice', id: 'invoice-1', status: 'PAID' }
  });
  const output = await generator.generate(context);
  const record = JSON.parse(output.asset.content);
  assert.equal(output.asset.classification, 'verified-record');
  assert.equal(record.source.id, 'invoice-1');
  assert.equal(record.verification.generated_from_user_input, false);
  assert.equal('recipient_email' in record.source, false);
});

test('transaction records fail closed for another user invoice', async () => {
  const generator = new TransactionRecordGenerator({
    invoiceRepository: { async findById() { return { id: 'invoice-1', userId: 'other-user' }; } }
  });

  await assert.rejects(
    generator.preflight(context),
    (error) => error.code === 'TRANSACTION_RECORD_SOURCE_NOT_FOUND'
  );
});
