const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async createNotification({ userId, type, title, message, data = {} }) {
    const id = `notif:${uuidv4()}`;
    await db.run(
      `INSERT INTO notifications (id, user_id, type, title, message, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, type, title, message, JSON.stringify(data), new Date().toISOString()]
    );
    return { id };
  }
};
