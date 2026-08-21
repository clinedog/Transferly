const { paymentMatchingService } = require('../services/paymentMatchingService');
const { paymentProviderService } = require('../services/paymentProviderService');

async function handlePaymentProviderWebhookController(request, response) {
  const provider = String(request.params.provider || '').trim().toLowerCase();
  const rawBody = request.rawBody || JSON.stringify(request.body || {});
  const verification = paymentProviderService.verifyHmacWebhook({
    provider,
    headers: request.headers,
    rawBody
  });
  const normalized = paymentProviderService.normalizeTransaction(provider, request.body || {});
  const result = await paymentMatchingService.processVerifiedTransaction(normalized, { verification });

  response.status(result.duplicate ? 200 : 202).json({
    received: true,
    duplicate: result.duplicate,
    provider,
    transaction_id: result.transaction.provider_transaction_id,
    match_status: result.transaction.match_status,
    funding_request_id: result.transaction.funding_request_id,
    auto_approved: result.auto_approved
  });
}

module.exports = {
  handlePaymentProviderWebhookController
};