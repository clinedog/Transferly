const assert = require('node:assert/strict');
const { before, test } = require('node:test');

const { migrate } = require('../db/migrate');
const { webhookEventRepository } = require('../repositories/webhookEventRepository');
const { webhookService } = require('../services/webhookService');

before(async () => {
  await migrate();
});

test('concurrent webhook processing claims exactly one attempt', async () => {
  const webhookEvent = await webhookEventRepository.create({
    eventId: `test-concurrent-webhook-${Date.now()}`,
    eventType: 'unhandled.test.event',
    resourceType: 'test',
    status: 'VERIFIED',
    payload: { id: 'test-event', event_type: 'unhandled.test.event' },
    verificationPayload: { verified: true }
  });

  const [first, second] = await Promise.all([
    webhookService.processWebhookEvent(webhookEvent.id),
    webhookService.processWebhookEvent(webhookEvent.id)
  ]);

  const stored = await webhookEventRepository.findById(webhookEvent.id);
  assert.equal(stored.status, 'IGNORED');
  assert.equal(stored.processingAttempts, 1);
  assert.equal([first.status, second.status].includes('IGNORED'), true);
});
