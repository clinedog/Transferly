const { auditLogService } = require('./auditLogService');
const { notificationPreferencesRepository } = require('../repositories/notificationPreferencesRepository');

async function getPreferences({ userId, repository = notificationPreferencesRepository }) {
  return repository.getForUser(userId);
}

async function updatePreferences({ userId, channels, categories, repository = notificationPreferencesRepository, audit = auditLogService }) {
  const preferences = await repository.upsertForUser(userId, { channels, categories });
  await audit.log({
    actorType: 'user',
    actorId: userId,
    action: 'notification_preferences.updated',
    entityType: 'notification_preferences',
    entityId: userId,
    metadata: { channels: preferences.channels, categories: preferences.categories }
  });
  return preferences;
}

module.exports = { notificationPreferencesService: { getPreferences, updatePreferences } };
