const { notificationListQuerySchema, notificationParamsSchema, notificationPreferencesSchema } = require('../schemas/notificationSchemas');
const { notificationService } = require('../services/notificationService');
const { notificationPreferencesService } = require('../services/notificationPreferencesService');

async function listCurrentUserNotificationsController(request, response) {
  const query = notificationListQuerySchema.parse(request.query || {});
  response.json(await notificationService.listUserNotifications(request.auth.userId, query));
}

async function markCurrentUserNotificationReadController(request, response) {
  const params = notificationParamsSchema.parse(request.params || {});
  response.json(await notificationService.markUserNotificationRead(request.auth.userId, params.id));
}

async function getCurrentUserNotificationPreferencesController(request, response) {
  response.json({ preferences: await notificationPreferencesService.getPreferences({ userId: request.auth.userId }) });
}

async function updateCurrentUserNotificationPreferencesController(request, response) {
  const body = notificationPreferencesSchema.parse(request.body || {});
  response.json({ preferences: await notificationPreferencesService.updatePreferences({ userId: request.auth.userId, ...body }) });
}

module.exports = {
  listCurrentUserNotificationsController,
  markCurrentUserNotificationReadController,
  getCurrentUserNotificationPreferencesController,
  updateCurrentUserNotificationPreferencesController
};
