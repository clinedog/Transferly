function readResourceId(payload = {}) {
  const resource = payload.resource || {};
  return (
    resource.id ||
    resource.invoice_id ||
    resource.parent_payment ||
    resource.sale_id ||
    resource.capture_id ||
    resource.authorization_id ||
    resource.payout_batch_id ||
    resource.payout_item_id ||
    null
  );
}

function readCreateTime(payload = {}) {
  return payload.create_time || payload.createTime || payload.resource?.create_time || payload.resource?.createTime || null;
}

function readSummary(payload = {}) {
  const value = payload.summary || payload.event_summary || payload.resource?.status || payload.resource?.state || null;
  return value ? String(value).slice(0, 160) : null;
}

function sanitizePayPalWebhookEvent(event = {}) {
  const payload = event.payload || {};
  const verification = event.verificationPayload || {};
  const verificationStatus = verification.verification_status || verification.verificationStatus || verification.status || null;

  return {
    id: event.id,
    event_id: event.eventId || null,
    event_type: event.eventType || 'PAYPAL.EVENT',
    resource_type: event.resourceType || payload.resource_type || payload.resourceType || null,
    status: event.status || 'recorded',
    signature_verification_status: verificationStatus || (event.transmissionId ? 'verification-recorded' : 'not-recorded'),
    transmission_id_present: Boolean(event.transmissionId),
    linked_resource: {
      provider: 'paypal',
      type: event.resourceType || payload.resource_type || null,
      id: readResourceId(payload)
    },
    sanitized_metadata: {
      create_time: readCreateTime(payload),
      summary: readSummary(payload),
      provider: 'paypal'
    },
    processing_attempts: event.processingAttempts || 0,
    last_error_present: Boolean(event.lastError),
    processed_at: event.processedAt || null,
    created_at: event.createdAt || null,
    updated_at: event.updatedAt || null
  };
}

module.exports = {
  sanitizePayPalWebhookEvent
};
