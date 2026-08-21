const { invoiceRepository } = require('../repositories/invoiceRepository');
const { AppError } = require('../utils/errors');
const { ASSET_CLASSIFICATIONS, ServiceGenerator } = require('./generatorContract');

function normalizeInvoiceId(input) {
  const invoiceId = String(input?.invoiceId || '').trim();
  if (!invoiceId || invoiceId.length > 128) {
    throw new AppError(422, 'TRANSACTION_RECORD_SOURCE_INVALID', 'A valid invoice record is required.');
  }
  return invoiceId;
}

function presentInvoiceRecord(invoice) {
  return {
    record_type: 'transferly_verified_invoice_record',
    record_version: 1,
    source: {
      kind: 'invoice',
      id: invoice.id,
      invoice_number: invoice.invoiceNumber,
      provider_reference: invoice.paypalInvoiceId,
      status: invoice.status,
      amount_cents: invoice.amountCents,
      currency_code: invoice.currencyCode,
      issued_at: invoice.issueDate,
      paid_at: invoice.paidAt,
      cancelled_at: invoice.cancelledAt,
      refunded_at: invoice.refundedAt,
      recorded_at: invoice.updatedAt
    },
    verification: {
      authority: 'Transferly persisted invoice record',
      generated_from_user_input: false,
      provider_communication: false
    }
  };
}

class TransactionRecordGenerator extends ServiceGenerator {
  constructor(options = {}) {
    super();
    this.invoices = options.invoiceRepository || invoiceRepository;
  }

  async resolveOwnedInvoice(context) {
    const invoice = await this.invoices.findById(normalizeInvoiceId(context.input));
    if (!invoice || invoice.userId !== context.userId) {
      throw new AppError(404, 'TRANSACTION_RECORD_SOURCE_NOT_FOUND', 'Invoice record was not found.');
    }
    return invoice;
  }

  async validate(input) {
    return { invoiceId: normalizeInvoiceId(input) };
  }

  async preflight(context) {
    const invoice = await this.resolveOwnedInvoice(context);
    return { ready: true, source: { kind: 'invoice', id: invoice.id, status: invoice.status } };
  }

  async generate(context) {
    const invoice = await this.resolveOwnedInvoice(context);
    const record = presentInvoiceRecord(invoice);
    return {
      asset: {
        content: `${JSON.stringify(record, null, 2)}\n`,
        assetType: 'transaction-record',
        mimeType: 'application/json',
        classification: ASSET_CLASSIFICATIONS.VERIFIED_RECORD,
        extension: 'json'
      },
      metadata: {
        record_type: record.record_type,
        source_kind: 'invoice',
        source_id: invoice.id,
        source_status: invoice.status
      }
    };
  }
}

module.exports = {
  TransactionRecordGenerator,
  presentInvoiceRecord
};
