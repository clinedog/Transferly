const { notificationListQuerySchema, notificationParamsSchema } = require('../schemas/notificationSchemas');
const { notificationService } = require('../services/notificationService');

async function listCurrentUserNotificationsController(request, response) {
  const query = notificationListQuerySchema.parse(request.query || {});
  response.json(await notificationService.listUserNotifications(request.auth.userId, query));
}

async function markCurrentUserNotificationReadController(request, response) {
  const params = notificationParamsSchema.parse(request.params || {});
  response.json(await notificationService.markUserNotificationRead(request.auth.userId, params.id));
}

module.exports = {
  listCurrentUserNotificationsController,
  markCurrentUserNotificationReadController
};