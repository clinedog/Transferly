const { notificationRepository } = require('../repositories/notificationRepository');
const { AppError } = require('../utils/errors');

async function listUserNotifications(userId, options = {}) {
  const notifications = await notificationRepository.listForUser(userId, options);
  return {
    data: notifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      read_at: notification.readAt,
      created_at: notification.createdAt
    }))
  };
}

async function markUserNotificationRead(userId, notificationId) {
  const notification = await notificationRepository.markRead(userId, notificationId);
  if (!notification) {
    throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
  }
  return {
    notification: {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      read_at: notification.readAt,
      created_at: notification.createdAt
    }
  };
}

module.exports = {
  notificationService: {
    listUserNotifications,
    markUserNotificationRead
  }
};